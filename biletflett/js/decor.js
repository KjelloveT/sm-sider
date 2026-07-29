/* ══════════════════════════════════════
   DECOR.JS — Canvas-teikna pynt-primitiv for BiletFlett
   Alt er teikna med Canvas 2D — ingen emoji, ingen eksterne bilete.
   Kvar funksjon teiknar på (ctx) med lerretsmål (W, H).

   Fargar i ein pynt-post kan skrivast som paletnøkkel ('accent'),
   Open Color-token ('blue.7') eller rå hex. Dei blir slegne opp mot
   malpaletten i item()/background() før teiknefunksjonane får dei,
   så kvar einskild funksjon slepp å bry seg om det.
   ══════════════════════════════════════ */

const Decor = (() => {

    /* Seeda PRNG (mulberry32) — gjev stabil pynt mellom re-render */
    function rng(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function hashItem(item) {
        const s = JSON.stringify(item);
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    function star(ctx, cx, cy, spikes, outer, inner) {
        let rot = -Math.PI / 2;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outer);
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer); rot += step;
            ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner); rot += step;
        }
        ctx.closePath();
    }

    function roundRectPath(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /* Slår opp alle fargefelta i ein post mot paletten. Returnerer ein
       kopi, slik at maldefinisjonane sjølve aldri blir endra. */
    const COLOR_KEYS = ['color', 'color2', 'from', 'to'];
    function resolved(it, palette) {
        const out = Object.assign({}, it);
        COLOR_KEYS.forEach(k => {
            if (out[k] != null) out[k] = Palette.resolve(out[k], palette);
        });
        if (Array.isArray(out.colors)) {
            out.colors = out.colors.map(c => Palette.resolve(c, palette));
        }
        return out;
    }

    /* ──────────────── BAKGRUNN ────────────────
       Ein bakgrunn er ein grunnfyll (solid/gradient/papir) pluss valfrie
       botnlag frå backdrops.js — store former som gjev djupn. Lag-lista
       blir teikna i rekkjefølgje oppå grunnfyllet, men under all pynt. */
    function background(ctx, W, H, bg, palette) {
        bg = bg ? resolved(bg, palette) : { type: 'solid', color: palette.bg };
        fillBase(ctx, W, H, bg, palette);
        (bg.layers || []).forEach(layer => {
            if (typeof Backdrops !== 'undefined' && Backdrops.has(layer.type)) {
                Backdrops.render(ctx, W, H, layer, palette);
            }
        });
    }

    function fillBase(ctx, W, H, bg, palette) {
        if (bg.type === 'gradient') {
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, bg.from || palette.bg);
            g.addColorStop(1, bg.to || palette.accent3);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
        } else if (bg.type === 'pattern' && bg.kind === 'paper') {
            ctx.fillStyle = bg.color || palette.bg;
            ctx.fillRect(0, 0, W, H);
            const r = rng(99);
            ctx.fillStyle = bg.color2 || '#00000010';
            for (let i = 0; i < 2200; i++) {
                ctx.globalAlpha = 0.04 + r() * 0.05;
                ctx.fillRect(r() * W, r() * H, 2, 2);
            }
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = bg.color || palette.bg;
            ctx.fillRect(0, 0, W, H);
        }
    }

    /* ──────────────── PYNT-TYPAR ──────────────── */
    const draw = {
        sun(ctx, W, H, it) {
            const cx = it.x * W, cy = it.y * H, r = (it.r || 0.08) * W;
            ctx.save();
            ctx.strokeStyle = it.color || '#f4c542';
            ctx.lineWidth = Math.max(3, W * 0.006);
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25);
                ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6);
                ctx.stroke();
            }
            ctx.fillStyle = it.color || '#f4c542';
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        },

        mountains(ctx, W, H, it) {
            const baseH = (it.h || 0.3) * H, top = H - baseH;
            ctx.save();
            ctx.fillStyle = it.color || '#9cc78a';
            ctx.beginPath(); ctx.moveTo(0, H);
            ctx.lineTo(0, top + baseH * 0.4);
            ctx.lineTo(W * 0.30, top); ctx.lineTo(W * 0.55, top + baseH * 0.5);
            ctx.lineTo(W * 0.78, top - baseH * 0.05); ctx.lineTo(W, top + baseH * 0.45);
            ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
            ctx.fillStyle = it.color2 || '#3f7d33';
            ctx.beginPath(); ctx.moveTo(0, H);
            ctx.lineTo(W * 0.15, top + baseH * 0.5); ctx.lineTo(W * 0.42, top + baseH * 0.15);
            ctx.lineTo(W * 0.68, top + baseH * 0.55); ctx.lineTo(W, top + baseH * 0.25);
            ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
            if (it.snow) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(W * 0.42, top + baseH * 0.15);
                ctx.lineTo(W * 0.36, top + baseH * 0.33); ctx.lineTo(W * 0.40, top + baseH * 0.30);
                ctx.lineTo(W * 0.44, top + baseH * 0.36); ctx.lineTo(W * 0.48, top + baseH * 0.30);
                ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        },

        grass(ctx, W, H, it) {
            const gh = (it.h || 0.14) * H;
            ctx.save();
            ctx.fillStyle = it.color || '#27ae60';
            ctx.beginPath(); ctx.moveTo(0, H);
            const blades = 40;
            for (let i = 0; i <= blades; i++) {
                const x = (i / blades) * W;
                const y = H - gh + Math.sin(i * 1.3) * gh * 0.25;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
            ctx.restore();
        },

        waves(ctx, W, H, it) {
            const wh = (it.h || 0.16) * H;
            ctx.save();
            const cols = [it.color2 || '#5cc8ee', it.color || '#0d9bd1'];
            cols.forEach((c, layer) => {
                ctx.fillStyle = c;
                ctx.beginPath();
                ctx.moveTo(0, H);
                const baseY = H - wh + layer * wh * 0.4;
                for (let x = 0; x <= W; x += 12) {
                    ctx.lineTo(x, baseY + Math.sin((x / W) * Math.PI * 6 + layer) * wh * 0.18);
                }
                ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
            });
            ctx.restore();
        },

        scatter(ctx, W, H, it, shape) {
            const r = rng(hashItem(it));
            const count = it.count || 16;
            const colors = it.colors || [it.color || '#ffffff'];
            ctx.save();
            for (let i = 0; i < count; i++) {
                const x = r() * W, y = r() * H;
                const s = (0.012 + r() * 0.02) * W;
                ctx.fillStyle = colors[i % colors.length];
                shape(ctx, x, y, s, r);
            }
            ctx.restore();
        },

        confetti(ctx, W, H, it) {
            const r = rng(hashItem(it));
            const count = it.count || 50;
            const colors = it.colors || ['#e84393', '#4aa3df', '#ffd23f', '#7bd389'];
            ctx.save();
            for (let i = 0; i < count; i++) {
                const x = r() * W, y = r() * H, s = (0.008 + r() * 0.012) * W;
                ctx.fillStyle = colors[i % colors.length];
                ctx.save();
                ctx.translate(x, y); ctx.rotate(r() * Math.PI);
                if (r() > 0.5) ctx.fillRect(-s / 2, -s / 2, s, s * 1.6);
                else { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.fill(); }
                ctx.restore();
            }
            ctx.restore();
        },

        sparkles(ctx, W, H, it) {
            draw.scatter(ctx, W, H, it, (c, x, y, s) => {
                star(c, x, y, 4, s, s * 0.32); c.fill();
            });
        },

        stars(ctx, W, H, it) {
            draw.scatter(ctx, W, H, it, (c, x, y, s) => {
                star(c, x, y, 5, s, s * 0.45); c.fill();
            });
        },

        polkaDots(ctx, W, H, it) {
            const r = rng(hashItem(it));
            const count = it.count || 26;
            ctx.save();
            ctx.fillStyle = it.color || '#e0b54a';
            for (let i = 0; i < count; i++) {
                ctx.beginPath();
                ctx.arc(r() * W, r() * H, (it.r || 0.014) * W, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        },

        hearts(ctx, W, H, it) {
            draw.scatter(ctx, W, H, it, (c, x, y, s) => {
                c.save(); c.translate(x, y); c.scale(s / 16, s / 16);
                c.beginPath();
                c.moveTo(0, 4);
                c.bezierCurveTo(-2, -2, -9, -1, -9, 4);
                c.bezierCurveTo(-9, 9, -3, 12, 0, 15);
                c.bezierCurveTo(3, 12, 9, 9, 9, 4);
                c.bezierCurveTo(9, -1, 2, -2, 0, 4);
                c.closePath(); c.fill(); c.restore();
            });
        },

        flowers(ctx, W, H, it) {
            draw.scatter(ctx, W, H, it, (c, x, y, s, r) => {
                const petals = 5;
                for (let p = 0; p < petals; p++) {
                    const a = (p / petals) * Math.PI * 2;
                    c.beginPath();
                    c.ellipse(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.5, s * 0.32, a, 0, Math.PI * 2);
                    c.fill();
                }
                c.save(); c.fillStyle = '#f7d046';
                c.beginPath(); c.arc(x, y, s * 0.34, 0, Math.PI * 2); c.fill(); c.restore();
            });
        },

        snow(ctx, W, H, it) {
            const r = rng(hashItem(it));
            ctx.save();
            ctx.fillStyle = it.color || '#ffffff';
            for (let i = 0; i < (it.count || 50); i++) {
                ctx.globalAlpha = 0.5 + r() * 0.5;
                ctx.beginPath();
                ctx.arc(r() * W, r() * H, (0.004 + r() * 0.006) * W, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        },

        leaves(ctx, W, H, it) {
            draw.scatter(ctx, W, H, it, (c, x, y, s, r) => {
                c.save(); c.translate(x, y); c.rotate(r() * Math.PI * 2);
                c.beginPath();
                c.moveTo(0, -s); c.quadraticCurveTo(s, 0, 0, s); c.quadraticCurveTo(-s, 0, 0, -s);
                c.closePath(); c.fill();
                c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = s * 0.08;
                c.beginPath(); c.moveTo(0, -s); c.lineTo(0, s); c.stroke();
                c.restore();
            });
        },

        bunting(ctx, W, H, it) {
            const y = (it.y || 0.05) * H;
            const colors = it.colors || ['#e84393', '#4aa3df', '#ffd23f'];
            const sag = H * 0.04, n = 12, fw = W / n;
            ctx.save();
            ctx.strokeStyle = '#00000055'; ctx.lineWidth = Math.max(2, W * 0.003);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.quadraticCurveTo(W / 2, y + sag, W, y); ctx.stroke();
            for (let i = 0; i < n; i++) {
                const fx = i * fw + fw * 0.5;
                const t = fx / W;
                const fy = y + Math.sin(t * Math.PI) * sag;
                ctx.fillStyle = colors[i % colors.length];
                ctx.beginPath();
                ctx.moveTo(fx - fw * 0.4, fy); ctx.lineTo(fx + fw * 0.4, fy); ctx.lineTo(fx, fy + fw * 0.8);
                ctx.closePath(); ctx.fill();
                if (colors[i % colors.length].toLowerCase() === '#ffffff') {
                    ctx.strokeStyle = '#00000033'; ctx.lineWidth = 2; ctx.stroke();
                }
            }
            ctx.restore();
        },

        streamers(ctx, W, H, it) {
            const colors = it.colors || ['#ba0c2f', '#002a6d'];
            ctx.save();
            ctx.lineWidth = Math.max(4, W * 0.008);
            [[0, 0], [W, 0]].forEach((corner, ci) => {
                ctx.strokeStyle = colors[ci % colors.length];
                ctx.beginPath();
                ctx.moveTo(corner[0], corner[1]);
                const dir = ci === 0 ? 1 : -1;
                for (let s = 0; s < 6; s++) {
                    ctx.quadraticCurveTo(
                        corner[0] + dir * (s + 0.5) * W * 0.06, (s + 0.5) * H * 0.05 + (s % 2 ? H * 0.02 : 0),
                        corner[0] + dir * (s + 1) * W * 0.06, (s + 1) * H * 0.05);
                }
                ctx.stroke();
            });
            ctx.restore();
        },

        balloons(ctx, W, H, it) {
            const bx = (it.x || 0.5) * W, by = (it.y || 0.3) * H;
            const colors = it.colors || ['#e84393', '#ffd23f', '#4aa3df'];
            const br = W * 0.05;
            ctx.save();
            colors.forEach((c, i) => {
                const ox = bx + (i - 1) * br * 1.3;
                const oy = by + (i % 2) * br * 0.6;
                ctx.strokeStyle = '#00000055'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(ox, oy + br); ctx.quadraticCurveTo(ox + br * 0.3, oy + br * 2.2, ox, oy + br * 3); ctx.stroke();
                ctx.fillStyle = c;
                ctx.beginPath(); ctx.ellipse(ox, oy, br * 0.8, br, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.35)';
                ctx.beginPath(); ctx.ellipse(ox - br * 0.25, oy - br * 0.3, br * 0.18, br * 0.3, -0.4, 0, Math.PI * 2); ctx.fill();
            });
            ctx.restore();
        },

        crown(ctx, W, H, it) {
            const cx = (it.x || 0.5) * W, cy = (it.y || 0.25) * H, cw = (it.w || 0.3) * W, ch = cw * 0.55;
            ctx.save();
            ctx.fillStyle = it.color || '#f2a900';
            ctx.strokeStyle = '#00000033'; ctx.lineWidth = Math.max(2, W * 0.003);
            ctx.beginPath();
            ctx.moveTo(cx - cw / 2, cy + ch / 2);
            ctx.lineTo(cx - cw / 2, cy - ch * 0.2);
            ctx.lineTo(cx - cw * 0.25, cy + ch * 0.15);
            ctx.lineTo(cx, cy - ch / 2);
            ctx.lineTo(cx + cw * 0.25, cy + ch * 0.15);
            ctx.lineTo(cx + cw / 2, cy - ch * 0.2);
            ctx.lineTo(cx + cw / 2, cy + ch / 2);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ['#e8523f', '#7b5bd6', '#36e3c2'].forEach((g, i) => {
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(cx + (i - 1) * cw * 0.28, cy + ch * 0.2, cw * 0.05, 0, Math.PI * 2); ctx.fill();
            });
            ctx.restore();
        },

        scribbles(ctx, W, H, it) {
            const r = rng(hashItem(it));
            ctx.save();
            ctx.strokeStyle = it.color || '#ffffff';
            ctx.lineWidth = Math.max(2, W * 0.004);
            ctx.globalAlpha = 0.55;
            for (let i = 0; i < (it.count || 6); i++) {
                const x = r() * W, y = r() * H, len = (0.04 + r() * 0.06) * W;
                ctx.beginPath(); ctx.moveTo(x, y);
                for (let s = 0; s < 5; s++) ctx.lineTo(x + s * len * 0.3, y + Math.sin(s + r()) * len * 0.3);
                ctx.stroke();
            }
            ctx.restore();
        },

        ribbonBanner(ctx, W, H, it) {
            const x = it.x * W, y = it.y * H, w = it.w * W, h = it.h * H;
            ctx.save();
            ctx.fillStyle = it.color;
            ctx.beginPath();
            ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h);
            ctx.lineTo(x + w / 2, y + h * 1.35); ctx.lineTo(x, y + h);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x - w * 0.02, y + h * 1.18); ctx.lineTo(x + w * 0.05, y + h); ctx.closePath(); ctx.fill();
            ctx.restore();
        },

        timeline(ctx, W, H, it) {
            ctx.save();
            ctx.strokeStyle = it.color || '#c2682b';
            ctx.lineWidth = Math.max(3, W * 0.006);
            const x = (it.x || 0.2) * W;
            ctx.beginPath(); ctx.moveTo(x, H * 0.17); ctx.lineTo(x, H * 0.92); ctx.stroke();
            [0.26, 0.46, 0.66, 0.86].forEach(ty => {
                ctx.fillStyle = it.color || '#c2682b';
                ctx.beginPath(); ctx.arc(x, ty * H, W * 0.012, 0, Math.PI * 2); ctx.fill();
            });
            ctx.restore();
        },

        tape(ctx, W, H, it) {
            const items = it.items || [];
            ctx.save();
            items.forEach(t => {
                ctx.save();
                ctx.translate(t.x * W, t.y * H);
                ctx.rotate((t.rot || 0) * Math.PI / 180);
                ctx.fillStyle = it.color || '#d9a441';
                ctx.globalAlpha = 0.7;
                const tw = W * 0.10, th = W * 0.035;
                ctx.fillRect(-tw / 2, -th / 2, tw, th);
                ctx.restore();
            });
            ctx.restore();
        },

        /* Eitt Lucide-ikon plassert på ein bestemt stad.
           { type:'glyph', name:'cake', x, y, size, color, rotation, weight, alpha } */
        glyph(ctx, W, H, it) {
            Glyphs.draw(ctx, it.name, it.x * W, it.y * H, (it.size || 0.12) * W, {
                color: it.color || '#1a1a1a',
                fill: it.fill,
                alpha: it.alpha,
                rotation: it.rotation,
                weight: it.weight
            });
        },

        /* Fleire ikon strødd utover, med same seeda tilfeldigheit som
           resten av pynten så oppsettet er stabilt mellom re-render.
           { type:'glyphScatter', names:[…], count, colors:[…], min, max } */
        glyphScatter(ctx, W, H, it) {
            const names = it.names || (it.name ? [it.name] : []);
            if (!names.length) return;
            const r = rng(hashItem(it));
            const colors = it.colors || [it.color || '#1a1a1a'];
            const count = it.count || 10;
            const min = it.min || 0.05, max = it.max || 0.09;
            const margin = it.margin != null ? it.margin : 0.06;
            for (let i = 0; i < count; i++) {
                const size = (min + r() * (max - min)) * W;
                const x = (margin + r() * (1 - margin * 2)) * W;
                const y = (margin + r() * (1 - margin * 2)) * H;
                Glyphs.draw(ctx, names[i % names.length], x, y, size, {
                    color: colors[i % colors.length],
                    alpha: it.alpha,
                    rotation: it.spin === false ? 0 : (r() * 40 - 20),
                    weight: it.weight
                });
            }
        },

        frame(ctx, W, H, it) {
            const col = it.color || '#1a1a1a';
            const lw = (it.width || 0.018) * W;
            ctx.save();
            ctx.strokeStyle = col;
            if (it.variant === 'dashed') {
                ctx.lineWidth = lw * 0.7;
                ctx.setLineDash([lw * 1.5, lw]);
                ctx.strokeRect(lw, lw, W - lw * 2, H - lw * 2);
            } else if (it.variant === 'double') {
                ctx.lineWidth = lw * 0.5;
                ctx.strokeRect(lw, lw, W - lw * 2, H - lw * 2);
                ctx.strokeRect(lw * 2.2, lw * 2.2, W - lw * 4.4, H - lw * 4.4);
            } else if (it.variant === 'scallop') {
                ctx.fillStyle = col;
                const r = lw * 1.1, step = r * 2;
                for (let x = r; x < W; x += step) { circle(ctx, x, r, r); circle(ctx, x, H - r, r); }
                for (let y = r; y < H; y += step) { circle(ctx, r, y, r); circle(ctx, W - r, y, r); }
            } else if (it.variant === 'tape-corners') {
                drawTapeCorner(ctx, lw, lw, 30, col, W);
                drawTapeCorner(ctx, W - lw, lw, -30, col, W);
                drawTapeCorner(ctx, lw, H - lw, -30, col, W);
                drawTapeCorner(ctx, W - lw, H - lw, 30, col, W);
            } else {
                ctx.lineWidth = lw;
                ctx.strokeRect(lw / 2, lw / 2, W - lw, H - lw);
            }
            ctx.restore();
        }
    };

    function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    function drawTapeCorner(ctx, x, y, rot, col, W) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180);
        ctx.fillStyle = col; ctx.globalAlpha = 0.65;
        const tw = W * 0.13, th = W * 0.04;
        ctx.fillRect(-tw / 2, -th / 2, tw, th);
        ctx.restore();
    }

    /* Teikn ein pynt-post (kallast frå collage for valt lag) */
    function item(ctx, W, H, it, palette) {
        const fn = draw[it.type];
        if (fn) fn(ctx, W, H, resolved(it, palette), palette);
    }

    return { background, item };
})();
