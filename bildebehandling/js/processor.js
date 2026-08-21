/* ══════════════════════════════════════
   PROCESSOR.JS — Rein biletlogikk (canvas)
   Ingen DOM-avhengnad utanom canvas-element vi lagar sjølve.

   Rekkjefølgja i pipelinen er fast, og ho er ikkje tilfeldig:
   roter/spegl → skjer → skaler → reinskore → vassmerk → lagre.
   Reinskoringa må kome etter skaleringa. Skalerer vi etterpå, blandar
   interpoleringa fargane i kantane og dei flate flatene blir ikkje flate.
   ══════════════════════════════════════ */

const Processor = (() => {

    /* Les ei fil til eit dekoda Image-objekt vi kan teikne på canvas. */
    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Klarte ikkje lese fila'));
            reader.onload = () => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Klarte ikkje dekode biletet'));
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    /* Teikn kjeldebiletet med rotasjon + spegling til ein ny canvas.
       rotation: 0/90/180/270. flipH/flipV: bool.
       scale < 1 teiknar mindre med ein gong, så vi slepp å halde eit
       12-megapikselbilete i minnet berre for å vise ei førehandsvising. */
    function orient(source, rotation, flipH, flipV, scale) {
        const k = scale && scale > 0 && scale < 1 ? scale : 1;
        const rot = ((rotation % 360) + 360) % 360;
        const swap = rot === 90 || rot === 270;
        const sw = Math.max(1, Math.round(source.width * k));
        const sh = Math.max(1, Math.round(source.height * k));
        const cv = document.createElement('canvas');
        cv.width = swap ? sh : sw;
        cv.height = swap ? sw : sh;
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.translate(cv.width / 2, cv.height / 2);
        ctx.rotate(rot * Math.PI / 180);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        ctx.drawImage(source, -sw / 2, -sh / 2, sw, sh);
        return cv;
    }

    /* Skjer ein canvas etter eit rektangel oppgjeve som del av flata (0–1).
       Brøk framfor pikslar, så same beskjering kan brukast på fleire bilete
       med ulike mål. */
    function cropRect(canvas, f) {
        if (!f) return canvas;
        const x = Math.max(0, Math.round(f.x * canvas.width));
        const y = Math.max(0, Math.round(f.y * canvas.height));
        const w = Math.max(1, Math.min(canvas.width - x, Math.round(f.w * canvas.width)));
        const h = Math.max(1, Math.min(canvas.height - y, Math.round(f.h * canvas.height)));
        if (x === 0 && y === 0 && w === canvas.width && h === canvas.height) return canvas;
        const out = document.createElement('canvas');
        out.width = w; out.height = h;
        out.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
        return out;
    }

    /* Skaler ein canvas til mål-storleik (om sett). */
    function resize(canvas, targetW, targetH) {
        if (!targetW && !targetH) return canvas;
        const w = Math.max(1, Math.round(targetW || canvas.width));
        const h = Math.max(1, Math.round(targetH || canvas.height));
        if (w === canvas.width && h === canvas.height) return canvas;
        const out = document.createElement('canvas');
        out.width = w; out.height = h;
        const ctx = out.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, w, h);
        return out;
    }

    /* ──────────────── Reinskoring ────────────────
       Reduserer biletet til få, flate fargar. I gråtone gjer han det same
       som det gamle verktøyet Reinskore bilete. I fargemodus vel han dei
       n fargane som passar biletet best, slik at «tal på fargar» tyder det
       same i begge modusane. Returnerer paletten som blei brukt. */
    function posterize(canvas, o) {
        const levels = Math.max(2, Math.min(9, Math.round(o.levels || 4)));
        const brightness = o.brightness || 0;
        const contrast = o.contrast || 0;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = img.data;

        const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const adj = (v) => {
            const x = cf * (v + brightness - 128) + 128;
            return x < 0 ? 0 : x > 255 ? 255 : x;
        };

        let palette;
        if (o.mode === 'color') {
            for (let i = 0; i < d.length; i += 4) {
                d[i] = adj(d[i]); d[i + 1] = adj(d[i + 1]); d[i + 2] = adj(d[i + 2]);
            }
            palette = medianCut(d, levels);
            applyPalette(d, palette);
        } else {
            const step = 255 / (levels - 1);
            palette = [];
            for (let l = 0; l < levels; l++) {
                const v = Math.round(l * step);
                palette.push([v, v, v]);
            }
            for (let i = 0; i < d.length; i += 4) {
                const gray = adj(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
                const v = Math.round(Math.round(gray / step) * step);
                d[i] = v; d[i + 1] = v; d[i + 2] = v;
            }
        }
        ctx.putImageData(img, 0, 0);
        return palette;
    }

    /* Median cut: del fargerommet i n boksar og ta snittfargen i kvar.
       Vi tek stikkprøver av pikslane — heile biletet ville vore unødig tungt. */
    function medianCut(data, n) {
        const total = data.length / 4;
        const stride = Math.max(1, Math.floor(total / 20000));
        const px = [];
        for (let i = 0; i < total; i += stride) {
            const j = i * 4;
            if (data[j + 3] < 8) continue;
            px.push([data[j], data[j + 1], data[j + 2]]);
        }
        if (!px.length) return [[0, 0, 0]];

        let boxes = [px];
        while (boxes.length < n) {
            let target = -1, widest = -1, channel = 0;
            for (let i = 0; i < boxes.length; i++) {
                const box = boxes[i];
                if (box.length < 2) continue;
                for (let c = 0; c < 3; c++) {
                    let lo = 255, hi = 0;
                    for (let p = 0; p < box.length; p++) {
                        const v = box[p][c];
                        if (v < lo) lo = v;
                        if (v > hi) hi = v;
                    }
                    if (hi - lo > widest) { widest = hi - lo; target = i; channel = c; }
                }
            }
            if (target < 0 || widest <= 0) break;
            const box = boxes[target];
            box.sort((a, b) => a[channel] - b[channel]);
            const mid = box.length >> 1;
            boxes.splice(target, 1, box.slice(0, mid), box.slice(mid));
        }

        return boxes.map(box => {
            let r = 0, g = 0, b = 0;
            for (let p = 0; p < box.length; p++) { r += box[p][0]; g += box[p][1]; b += box[p][2]; }
            return [Math.round(r / box.length), Math.round(g / box.length), Math.round(b / box.length)];
        });
    }

    /* Sett kvar piksel til næraste palettfarge. Vi hugsar svaret per
       15-bits fargenøkkel, elles ville vi rekna same avstand tusenvis av gonger. */
    function applyPalette(d, palette) {
        const cache = new Int16Array(32768).fill(-1);
        for (let i = 0; i < d.length; i += 4) {
            const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
            let idx = cache[key];
            if (idx < 0) {
                let best = Infinity;
                for (let p = 0; p < palette.length; p++) {
                    const dr = d[i] - palette[p][0];
                    const dg = d[i + 1] - palette[p][1];
                    const db = d[i + 2] - palette[p][2];
                    const dist = dr * dr + dg * dg + db * db;
                    if (dist < best) { best = dist; idx = p; }
                }
                cache[key] = idx;
            }
            const c = palette[idx];
            d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        }
    }

    /* Skriv tekst- og/eller logo-vassmerke på ein canvas (in-place).
       wm.scale skalerer tekststorleiken, så eit vassmerke ser likt ut i
       førehandsvisinga som i den ferdige fila. */
    function watermark(canvas, wm) {
        if (!wm) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const pad = Math.round(Math.min(W, H) * 0.03) + 6;

        if (wm.logo) {
            const scale = (wm.logoScale || 20) / 100;
            const lw = W * scale;
            const lh = lw * (wm.logo.height / wm.logo.width);
            const [x, y] = anchor(wm.position, W, H, lw, lh, pad);
            ctx.save();
            ctx.globalAlpha = (wm.opacity ?? 80) / 100;
            ctx.drawImage(wm.logo, x, y, lw, lh);
            ctx.restore();
        }

        if (wm.text) {
            const size = Math.max(6, Math.round((wm.size || 24) * (wm.scale || 1)));
            ctx.save();
            ctx.globalAlpha = (wm.opacity ?? 80) / 100;
            ctx.font = `900 ${size}px Arial, sans-serif`;
            ctx.textBaseline = 'top';
            ctx.fillStyle = wm.color || '#ffffff';
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = Math.max(2, size / 12);
            const m = ctx.measureText(wm.text);
            const [x, y] = anchor(wm.position, W, H, m.width, size, pad);
            ctx.strokeText(wm.text, x, y);
            ctx.fillText(wm.text, x, y);
            ctx.restore();
        }
    }

    function anchor(pos, W, H, w, h, pad) {
        const map = {
            'top-left':      [pad, pad],
            'top-center':    [(W - w) / 2, pad],
            'top-right':     [W - w - pad, pad],
            'center-left':   [pad, (H - h) / 2],
            'center':        [(W - w) / 2, (H - h) / 2],
            'center-right':  [W - w - pad, (H - h) / 2],
            'bottom-left':   [pad, H - h - pad],
            'bottom-center': [(W - w) / 2, H - h - pad],
            'bottom-right':  [W - w - pad, H - h - pad]
        };
        return map[pos] || map['bottom-right'];
    }

    function mime(format) {
        return format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
    }
    function ext(format) {
        return format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg';
    }

    function toBlob(canvas, format, quality) {
        return new Promise(resolve => canvas.toBlob(resolve, mime(format), quality));
    }

    /* Eksporter canvas. Om targetBytes er sett (og format ikkje png),
       iterer kvaliteten ned til storleiken er under målet. */
    async function exportCanvas(canvas, format, quality, targetBytes) {
        if (!targetBytes || format === 'png') {
            return toBlob(canvas, format, quality / 100);
        }
        let lo = 0.1, hi = 0.95, best = null;
        for (let i = 0; i < 7; i++) {
            const q = (lo + hi) / 2;
            const blob = await toBlob(canvas, format, q);
            if (blob.size > targetBytes) {
                hi = q;
            } else {
                best = blob;
                lo = q;
            }
        }
        // Fall tilbake til lågaste kvalitet om vi aldri kom under målet.
        return best || toBlob(canvas, format, lo);
    }

    /* Kor mykje av kjeldebiletet treng vi eigentleg?
       Skal resultatet bli 800 px breitt, er det ingen grunn til å teikne
       4000 px først. Vi held litt monn att så kantane held seg skarpe. */
    function sourceScale(item, s) {
        if (!s.width && !s.height) return 1;
        const swap = s.rotation === 90 || s.rotation === 270;
        const ow = swap ? item.source.height : item.source.width;
        const oh = swap ? item.source.width : item.source.height;
        const cw = ow * (s.crop ? s.crop.w : 1);
        const ch = oh * (s.crop ? s.crop.h : 1);
        const need = Math.max((s.width || 0) / cw, (s.height || 0) / ch);
        return need < 0.5 ? Math.min(1, need * 1.4) : 1;
    }

    /* Heile pipelinen fram til ferdig canvas. Returnerer òg paletten,
       som SVG-eksporten treng. */
    function render(item, s) {
        let cv = orient(item.source, s.rotation, s.flipH, s.flipV, sourceScale(item, s));
        cv = cropRect(cv, s.crop);
        cv = resize(cv, s.width, s.height);
        let palette = null;
        if (s.colors && s.colors.on) palette = posterize(cv, s.colors);
        watermark(cv, s.watermark);
        return { canvas: cv, palette };
    }

    /* Full pipeline for eitt bilete -> { blob, width, height }. */
    async function process(item, s) {
        const { canvas } = render(item, s);
        const targetBytes = s.targetKb ? s.targetKb * 1024 : null;
        const blob = await exportCanvas(canvas, s.format, s.quality, targetBytes);
        return { blob, width: canvas.width, height: canvas.height };
    }

    return {
        loadImage, orient, cropRect, resize, posterize, watermark,
        render, process, exportCanvas, mime, ext
    };
})();
