/* ══════════════════════════════════════
   VECTORIZE.JS — Reinskore bilete → SVG

   Eit vanleg foto har millionar av fargar og lèt seg ikkje gjere om til
   vektor på nokon fornuftig måte. Eit reinskore bilete med fire flate
   fargar er derimot alt nesten ei teikning: kvar farge er eit område, og
   eit område er ein <path>.

   Gangen er:
     1. les pikslane og lag eit indekskart over kva farge kvar piksel har
     2. jamn ut einslege pikslar (valfritt, styrt av detaljnivået)
     3. følg kanten rundt kvart samanhengande område
     4. forenkla kanten, så små hakk frå enkeltpiksler forsvinn
     5. skriv den største fargen som bakgrunn og resten som eitt path per farge

   To detaljar avgjer om fila blir brukande:

   * Hòl blir laga med omvend omløpsretning, ikkje med fill-rule="evenodd".
     Rissverk les ikkje fill-rule ved import og fyller etter nonzero-regelen,
     så eit auge i eit andlet ville blitt fylt igjen. Retninga kjem gratis
     her: vi legg alltid kanten slik at fargen ligg på same sida, og då snur
     hòla seg av seg sjølve.
   * Kvart område får ein hårstrek i same farge som fyllet. Utan han kan det
     kome tynne lyse striper mellom nabofargar ved visning og utskrift.
   ══════════════════════════════════════ */

const Vectorize = (() => {

    const MAX_COLORS = 64;

    /* Detaljnivå 1–5 → konkrete tal. Lågt nivå gjev reine former og ei lita
       fil, høgt nivå gjev fleire detaljar og ei tyngre fil. */
    function settingsFor(level) {
        const table = {
            1: { maxSide: 700,  despeckle: 2, tolerance: 2.4, minArea: 260 },
            2: { maxSide: 900,  despeckle: 1, tolerance: 1.6, minArea: 120 },
            3: { maxSide: 1200, despeckle: 1, tolerance: 1.1, minArea: 60 },
            4: { maxSide: 1500, despeckle: 0, tolerance: 0.7, minArea: 24 },
            5: { maxSide: 1900, despeckle: 0, tolerance: 0.4, minArea: 8 }
        };
        return table[Math.max(1, Math.min(5, Math.round(level || 3)))];
    }

    /* Hovudinngangen. canvas er det ferdig reinskorne biletet.
       outW/outH er måla fila skal opplysast med — teikninga blir den same,
       men SVG-en kan skalerast fritt uansett. */
    function toSvg(canvas, opt) {
        const o = Object.assign({ level: 3 }, opt || {});
        const cfg = settingsFor(o.level);
        const work = fit(canvas, cfg.maxSide);
        const W = work.width, H = work.height;

        const { idx, colors } = indexPixels(work);
        for (let i = 0; i < cfg.despeckle; i++) majority(idx, W, H);

        const counts = new Array(colors.length).fill(0);
        for (let p = 0; p < idx.length; p++) counts[idx[p]]++;
        let bg = 0;
        for (let c = 1; c < colors.length; c++) if (counts[c] > counts[bg]) bg = c;

        const parts = [];
        let shapes = 1;   // bakgrunnsrektangelet
        for (let c = 0; c < colors.length; c++) {
            if (c === bg || !counts[c]) continue;
            const loops = [];
            for (const raw of trace(idx, W, H, c)) {
                const loop = simplify(dropCollinear(raw), cfg.tolerance);
                if (loop.length > 2 && Math.abs(area(loop)) >= cfg.minArea) loops.push(loop);
            }
            if (loops.length) { parts.push({ color: colors[c], loops }); shapes += loops.length; }
        }

        const outW = Math.round(o.outW || canvas.width);
        const outH = Math.round(o.outH || canvas.height);
        const svg = writeSvg(parts, colors[bg], W, H, outW, outH);
        return { svg, shapes, bytes: svg.length };
    }

    /* ──────────────── Steg 1: pikslar → indekskart ──────────────── */

    function fit(canvas, maxSide) {
        const long = Math.max(canvas.width, canvas.height);
        if (long <= maxSide) return canvas;
        const k = maxSide / long;
        const out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(canvas.width * k));
        out.height = Math.max(1, Math.round(canvas.height * k));
        const ctx = out.getContext('2d');
        // Ingen utjamning: vi vil ta vare på dei flate fargane, ikkje blande dei.
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, out.width, out.height);
        return out;
    }

    function indexPixels(canvas) {
        const W = canvas.width, H = canvas.height;
        const data = canvas.getContext('2d', { willReadFrequently: true })
            .getImageData(0, 0, W, H).data;
        const colors = [];
        const seen = new Map();
        const idx = new Uint8Array(W * H);
        for (let p = 0, i = 0; p < W * H; p++, i += 4) {
            const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            let c = seen.get(key);
            if (c === undefined) {
                if (colors.length >= MAX_COLORS) {
                    throw new Error('Biletet har for mange fargar til å bli vektor. Slå på reinskoring først.');
                }
                c = colors.length;
                colors.push([data[i], data[i + 1], data[i + 2]]);
                seen.set(key, c);
            }
            idx[p] = c;
        }
        return { idx, colors };
    }

    /* ──────────────── Steg 2: fjern einslege pikslar ────────────────
       Kvar piksel blir den fargen som er vanlegast blant naboane. Det tek
       bort støy som elles ville blitt hundrevis av bittesmå former. */
    function majority(idx, W, H) {
        const src = idx.slice();
        const tally = new Uint8Array(MAX_COLORS);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                tally.fill(0);
                let best = src[y * W + x], bestN = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    const yy = y + dy;
                    if (yy < 0 || yy >= H) continue;
                    for (let dx = -1; dx <= 1; dx++) {
                        const xx = x + dx;
                        if (xx < 0 || xx >= W) continue;
                        const c = src[yy * W + xx];
                        const n = ++tally[c];
                        if (n > bestN) { bestN = n; best = c; }
                    }
                }
                idx[y * W + x] = best;
            }
        }
    }

    /* ──────────────── Steg 3: følg kantane ────────────────
       For kvar piksel med rett farge legg vi ei retta kant mot kvar nabo
       som har ein annan farge. Retningane er valde slik at fargen alltid
       ligg på same sida. Då kjem kantane av seg sjølve i lukka løkker, og
       hòl får motsett omløpsretning enn ytterkanten. */
    function trace(idx, W, H, color) {
        const out = new Map();          // hjørnepunkt → utgåande kantar
        const push = (x0, y0, x1, y1) => {
            const key = y0 * (W + 1) + x0;
            let list = out.get(key);
            if (!list) { list = []; out.set(key, list); }
            list.push(x1, y1);
        };
        const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : idx[y * W + x];

        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (idx[y * W + x] !== color) continue;
                if (at(x, y - 1) !== color) push(x + 1, y, x, y);
                if (at(x, y + 1) !== color) push(x, y + 1, x + 1, y + 1);
                if (at(x - 1, y) !== color) push(x, y, x, y + 1);
                if (at(x + 1, y) !== color) push(x + 1, y + 1, x + 1, y);
            }
        }

        const loops = [];
        const limit = 4 * W * H + 16;
        for (const [startKey, list] of out) {
            while (list.length) {
                const sx = startKey % (W + 1);
                const sy = (startKey - sx) / (W + 1);
                const loop = [sx, sy];
                let cx = sx, cy = sy, closed = false;
                for (let step = 0; step < limit; step++) {
                    const edges = out.get(cy * (W + 1) + cx);
                    if (!edges || !edges.length) break;
                    const ny = edges.pop(), nx = edges.pop();
                    if (nx === sx && ny === sy) { closed = true; break; }
                    loop.push(nx, ny);
                    cx = nx; cy = ny;
                }
                if (closed && loop.length >= 6) loops.push(loop);
            }
        }
        return loops;
    }

    /* ──────────────── Steg 4: forenkling ────────────────
       Kantane er trappetrinn langs pikselgrensene. Først fjernar vi punkt
       som ligg midt på ei rett linje, så kortar Douglas–Peucker ned resten. */
    function dropCollinear(flat) {
        const n = flat.length / 2;
        const out = [];
        for (let i = 0; i < n; i++) {
            const px = flat[((i - 1 + n) % n) * 2], py = flat[((i - 1 + n) % n) * 2 + 1];
            const cx = flat[i * 2], cy = flat[i * 2 + 1];
            const nx = flat[((i + 1) % n) * 2], ny = flat[((i + 1) % n) * 2 + 1];
            if ((cx - px) * (ny - cy) !== (cy - py) * (nx - cx)) out.push([cx, cy]);
        }
        return out.length >= 3 ? out : [];
    }

    function simplify(points, tolerance) {
        if (points.length < 4 || tolerance <= 0) return points;
        // Lukka løkke: hald start- og sluttpunktet fast og køyr på ei open linje.
        const line = points.concat([points[0]]);
        const keep = new Uint8Array(line.length);
        keep[0] = 1; keep[line.length - 1] = 1;
        rdp(line, 0, line.length - 1, tolerance, keep);
        const out = [];
        for (let i = 0; i < line.length - 1; i++) if (keep[i]) out.push(line[i]);
        return out.length >= 3 ? out : points;
    }

    function rdp(pts, first, last, tol, keep) {
        if (last <= first + 1) return;
        const [ax, ay] = pts[first];
        const [bx, by] = pts[last];
        const dx = bx - ax, dy = by - ay;
        const len = Math.hypot(dx, dy);
        let worst = -1, index = -1;
        for (let i = first + 1; i < last; i++) {
            const [px, py] = pts[i];
            const dist = len === 0
                ? Math.hypot(px - ax, py - ay)
                : Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
            if (dist > worst) { worst = dist; index = i; }
        }
        if (worst > tol && index > first) {
            keep[index] = 1;
            rdp(pts, first, index, tol, keep);
            rdp(pts, index, last, tol, keep);
        }
    }

    function area(points) {
        let sum = 0;
        for (let i = 0, n = points.length; i < n; i++) {
            const a = points[i], b = points[(i + 1) % n];
            sum += a[0] * b[1] - b[0] * a[1];
        }
        return sum / 2;
    }

    /* ──────────────── Steg 5: skriv fila ──────────────── */

    function hex(c) {
        return '#' + [c[0], c[1], c[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    }

    function writeSvg(parts, bgColor, W, H, outW, outH) {
        const lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${W} ${H}">`,
            '  <!-- Laga med Handsam bilete (Vyrdepil). Kvar farge er eitt område. -->',
            `  <rect width="${W}" height="${H}" fill="${hex(bgColor)}"/>`
        ];
        for (const part of parts) {
            const color = hex(part.color);
            let d = '';
            for (const loop of part.loops) {
                d += 'M' + loop.map(p => `${p[0]} ${p[1]}`).join('L') + 'Z';
            }
            lines.push(`  <path d="${d}" fill="${color}" stroke="${color}" stroke-width="0.6"/>`);
        }
        lines.push('</svg>');
        return lines.join('\n');
    }

    return { toSvg, settingsFor };
})();
