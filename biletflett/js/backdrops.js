/* ══════════════════════════════════════
   BACKDROPS.JS — Komponerte bakgrunnar for BiletFlett

   Malane såg flate ut fordi alt låg i eitt plan: ein solid farge eller
   ein rett gradient, og så pynt oppå. Her lagar vi botnlaget — store
   former som ligg BAK alt anna og gjev djupn.

   Formene er proseduralt genererte, ikkje importert SVG. Grunnen er at
   malane finst i portrett, landskap og kvadrat: ei fast path-data frå
   ein generator ville strekt seg feil i to av tre format. Formspråket
   er henta frå Haikei/Get Waves (blobbar, lagdelte bølgjer, stabla
   toppar, buer), men rekna ut for det faktiske lerretet.

   Organiske typar (mjukt, småskulen):   blobField, waveStack, hillStack
   Geometriske typar (stramt, ungdom):   arcBands, peaks, diagonalBands, patternTile

   Alle tek fargar som Open Color-token eller paletnøklar, og alle er
   seeda så same mal alltid gjev same bakgrunn.
   ══════════════════════════════════════ */

const Backdrops = (() => {

    /* Same seeda PRNG som decor.js, så bakgrunn og pynt er like stabile
       mellom re-render. Modulane er med vilje uavhengige av kvarandre. */
    function rng(seed) {
        let a = (seed || 1) >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function col(v, palette, fallback) {
        return Palette.resolve(v, palette, fallback);
    }

    function colorList(spec, palette, fallback) {
        const list = Array.isArray(spec) ? spec : (spec != null ? [spec] : fallback);
        return list.map(c => col(c, palette, '#cccccc'));
    }

    /* Mjuk lukka kurve gjennom punkta — gjev organiske former utan knekk. */
    function smoothClosed(ctx, pts) {
        const n = pts.length;
        if (n < 3) return;
        ctx.beginPath();
        ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
        for (let i = 0; i < n; i++) {
            const cur = pts[i], next = pts[(i + 1) % n];
            ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
        }
        ctx.closePath();
    }

    /* ──────────────── ORGANISKE ──────────────── */
    const draw = {

        /* Store mjuke klattar. { colors, count, alpha, min, max } */
        blobField(ctx, W, H, s, pal) {
            const r = rng(s.seed || 11);
            const colors = colorList(s.colors, pal, ['accent3', 'accent2']);
            const count = s.count || 3;
            const min = s.min != null ? s.min : 0.28;
            const max = s.max != null ? s.max : 0.55;
            const D = Math.max(W, H);
            ctx.save();
            ctx.globalAlpha = s.alpha != null ? s.alpha : 0.5;
            for (let i = 0; i < count; i++) {
                const cx = (0.1 + r() * 0.8) * W;
                const cy = (0.1 + r() * 0.8) * H;
                const rad = (min + r() * (max - min)) * D * 0.5;
                const lobes = 7 + Math.floor(r() * 3);
                const pts = [];
                for (let k = 0; k < lobes; k++) {
                    const a = (k / lobes) * Math.PI * 2;
                    const rr = rad * (0.72 + r() * 0.48);
                    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
                }
                ctx.fillStyle = colors[i % colors.length];
                smoothClosed(ctx, pts);
                ctx.fill();
            }
            ctx.restore();
        },

        /* Lagdelte bølgjer nedanfrå (eller ovanfrå med from:'top'). */
        waveStack(ctx, W, H, s, pal) {
            const colors = colorList(s.colors, pal, ['accent3', 'accent2', 'accent']);
            const layers = colors.length;
            const top = s.from === 'top';
            const height = (s.h != null ? s.h : 0.55) * H;
            ctx.save();
            if (s.alpha != null) ctx.globalAlpha = s.alpha;
            for (let l = 0; l < layers; l++) {
                const t = layers > 1 ? l / (layers - 1) : 0;
                const base = top
                    ? height * (0.35 + t * 0.65)
                    : H - height * (1 - t * 0.62);
                const amp = height * 0.10 * (1 - t * 0.4);
                const freq = 1.6 + l * 0.7;
                const phase = l * 1.3;
                ctx.fillStyle = colors[l];
                ctx.beginPath();
                ctx.moveTo(0, top ? 0 : H);
                for (let x = 0; x <= W; x += 8) {
                    const u = x / W;
                    const y = base + Math.sin(u * Math.PI * freq + phase) * amp
                                   + Math.sin(u * Math.PI * freq * 2.3 + phase) * amp * 0.35;
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(W, top ? 0 : H);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        },

        /* Runde overlappande haugar — mjukare enn bølgjer, roleg botn. */
        hillStack(ctx, W, H, s, pal) {
            const r = rng(s.seed || 23);
            const colors = colorList(s.colors, pal, ['accent3', 'accent2']);
            const count = s.count || colors.length;
            const height = (s.h != null ? s.h : 0.42) * H;
            ctx.save();
            if (s.alpha != null) ctx.globalAlpha = s.alpha;
            for (let i = 0; i < count; i++) {
                const t = count > 1 ? i / (count - 1) : 0;
                const cy = H - height * (0.15 + t * 0.55);
                const rx = W * (0.45 + r() * 0.35);
                const ry = height * (0.55 + r() * 0.5);
                const cx = W * (0.15 + r() * 0.7);
                ctx.fillStyle = colors[i % colors.length];
                ctx.beginPath();
                ctx.ellipse(cx, cy + ry, rx, ry, 0, Math.PI, Math.PI * 2);
                ctx.lineTo(cx + rx, H);
                ctx.lineTo(cx - rx, H);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        },

        /* ──────────────── GEOMETRISKE ──────────────── */

        /* Konsentriske buer ut frå eit hjørne. { corner, colors, count, width } */
        arcBands(ctx, W, H, s, pal) {
            const colors = colorList(s.colors, pal, ['accent3', 'accent2']);
            const count = s.count || 7;
            const corner = s.corner || 'tr';
            const cx = corner.includes('l') ? 0 : W;
            const cy = corner.startsWith('b') ? H : 0;
            const maxR = Math.hypot(W, H) * (s.reach != null ? s.reach : 1.05);
            const step = maxR / count;
            const width = (s.width != null ? s.width : 0.45) * step;
            ctx.save();
            if (s.alpha != null) ctx.globalAlpha = s.alpha;
            ctx.lineWidth = width;
            for (let i = count; i >= 1; i--) {
                ctx.strokeStyle = colors[i % colors.length];
                ctx.beginPath();
                ctx.arc(cx, cy, i * step - width / 2, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();
        },

        /* Stabla kantete toppar. Strammare slektning av hillStack. */
        peaks(ctx, W, H, s, pal) {
            const r = rng(s.seed || 31);
            const colors = colorList(s.colors, pal, ['accent3', 'accent2', 'accent']);
            const height = (s.h != null ? s.h : 0.45) * H;
            ctx.save();
            if (s.alpha != null) ctx.globalAlpha = s.alpha;
            for (let l = 0; l < colors.length; l++) {
                const t = colors.length > 1 ? l / (colors.length - 1) : 0;
                const base = H - height * (1 - t * 0.55);
                const n = 3 + Math.floor(r() * 3);
                ctx.fillStyle = colors[l];
                ctx.beginPath();
                ctx.moveTo(0, H);
                ctx.lineTo(0, base + height * 0.25);
                for (let i = 0; i <= n; i++) {
                    const x = (i / n) * W;
                    const up = i % 2 === 0 ? r() * 0.45 : -r() * 0.25;
                    ctx.lineTo(x, base - height * up * 0.6);
                }
                ctx.lineTo(W, base + height * 0.2);
                ctx.lineTo(W, H);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        },

        /* Skrå band. { colors, angle, count, alpha } */
        diagonalBands(ctx, W, H, s, pal) {
            const colors = colorList(s.colors, pal, ['accent3']);
            const angle = (s.angle != null ? s.angle : -30) * Math.PI / 180;
            const count = s.count || 9;
            const span = Math.hypot(W, H);
            const band = span * 1.6 / count;
            ctx.save();
            if (s.alpha != null) ctx.globalAlpha = s.alpha;
            ctx.translate(W / 2, H / 2);
            ctx.rotate(angle);
            for (let i = -count; i <= count; i++) {
                const w = band * (s.ratio != null ? s.ratio : 0.5);
                ctx.fillStyle = colors[((i % colors.length) + colors.length) % colors.length];
                ctx.fillRect(i * band - w / 2, -span, w, span * 2);
            }
            ctx.restore();
        },

        /* Saumlaust mønster lagt over grunnfargen.
           { kind:'dots'|'grid'|'cross'|'chevron'|'triangles'|'plus', color, scale, alpha } */
        patternTile(ctx, W, H, s, pal) {
            const size = Math.max(12, Math.round((s.scale != null ? s.scale : 0.045) * W));
            const color = col(s.color, pal, '#000000');
            const tile = document.createElement('canvas');
            tile.width = tile.height = size;
            const t = tile.getContext('2d');
            t.strokeStyle = color;
            t.fillStyle = color;
            t.lineWidth = Math.max(1, size * (s.weight != null ? s.weight : 0.06));
            t.lineCap = 'round';
            const m = size / 2;

            switch (s.kind || 'dots') {
                case 'grid':
                    t.beginPath();
                    t.moveTo(0, 0); t.lineTo(size, 0);
                    t.moveTo(0, 0); t.lineTo(0, size);
                    t.stroke();
                    break;
                case 'cross':
                    t.beginPath();
                    t.moveTo(0, 0); t.lineTo(size, size);
                    t.moveTo(size, 0); t.lineTo(0, size);
                    t.stroke();
                    break;
                case 'chevron':
                    t.beginPath();
                    t.moveTo(0, m); t.lineTo(m, 0); t.lineTo(size, m);
                    t.moveTo(0, size); t.lineTo(m, m); t.lineTo(size, size);
                    t.stroke();
                    break;
                case 'triangles':
                    t.beginPath();
                    t.moveTo(m, size * 0.18); t.lineTo(size * 0.85, size * 0.82); t.lineTo(size * 0.15, size * 0.82);
                    t.closePath(); t.fill();
                    break;
                case 'plus':
                    t.beginPath();
                    t.moveTo(m, size * 0.25); t.lineTo(m, size * 0.75);
                    t.moveTo(size * 0.25, m); t.lineTo(size * 0.75, m);
                    t.stroke();
                    break;
                default: // dots
                    t.beginPath();
                    t.arc(m, m, size * (s.dot != null ? s.dot : 0.12), 0, Math.PI * 2);
                    t.fill();
                    break;
            }

            const pattern = ctx.createPattern(tile, 'repeat');
            if (!pattern) return;
            ctx.save();
            ctx.globalAlpha = s.alpha != null ? s.alpha : 0.18;
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
    };

    function has(type) { return Object.prototype.hasOwnProperty.call(draw, type); }

    /* Teiknar eitt botnlag. Grunnfargen er alt fylt av Decor.background(). */
    function render(ctx, W, H, spec, palette) {
        const fn = draw[spec.type];
        if (fn) fn(ctx, W, H, spec, palette);
    }

    return { has, render, ORGANIC: ['blobField', 'waveStack', 'hillStack'],
             GEOMETRIC: ['arcBands', 'peaks', 'diagonalBands', 'patternTile'] };
})();
