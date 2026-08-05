/* ══════════════════════════════════════
   EXPORT.JS — PNG-eksport og utskrift (PDF) av trekte grupper
   Reint canvas + window.print(). Ingen eksterne avhengnader.
   ══════════════════════════════════════ */

const FlokkExport = (() => {

    const SCALE      = 2;      // 2× for skarp PNG
    const PAGE_PAD   = 48;
    const CARD_W     = 380;
    const GAP        = 28;
    const CARD_PAD   = 26;
    const ICON_SIZE  = 72;
    const NAME_SIZE  = 30;
    const MEMBER_SIZE = 24;
    const MEMBER_GAP = 10;
    const INK        = '#1a1a1a';
    const FONT       = 'system-ui, "Segoe UI", Arial, sans-serif';

    /* ── SVG-ikon → <img> som kan teiknast på canvas ── */
    function loadIcon(name, size) {
        return new Promise(resolve => {
            const svg = ICON(name, size)
                .replace('stroke="currentColor"', `stroke="${INK}"`);
            const img = new Image();
            img.onload  = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        });
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y,     x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x,     y + h, r);
        ctx.arcTo(x,     y + h, x,     y,     r);
        ctx.arcTo(x,     y,     x + w, y,     r);
        ctx.closePath();
    }

    function fitText(ctx, text, maxW) {
        if (ctx.measureText(text).width <= maxW) return text;
        let t = text;
        while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
        return t + '…';
    }

    function cardHeight(g) {
        const members = (g.members || []).length;
        return CARD_PAD + ICON_SIZE + 16 + NAME_SIZE + 14
             + members * (MEMBER_SIZE + MEMBER_GAP)
             + CARD_PAD;
    }

    /* ── Hovudfunksjon: teikn alle gruppene og last ned PNG ── */
    async function toPNG(groups, title) {
        if (!groups || groups.length === 0) return;

        const cols     = Math.min(3, groups.length);
        const rows     = Math.ceil(groups.length / cols);
        const heights  = groups.map(cardHeight);
        const rowH     = [];
        for (let r = 0; r < rows; r++) {
            rowH.push(Math.max(...heights.slice(r * cols, (r + 1) * cols)));
        }

        const headerH = 78;
        const gridW   = cols * CARD_W + (cols - 1) * GAP;
        const gridH   = rowH.reduce((a, b) => a + b, 0) + (rows - 1) * GAP;
        const W       = gridW + PAGE_PAD * 2;
        const H       = headerH + gridH + PAGE_PAD * 2;

        const canvas = document.createElement('canvas');
        canvas.width  = W * SCALE;
        canvas.height = H * SCALE;
        const ctx = canvas.getContext('2d');
        ctx.scale(SCALE, SCALE);

        /* Bakgrunn */
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        /* Topptekst */
        ctx.fillStyle = INK;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.font = `800 34px ${FONT}`;
        ctx.fillText(fitText(ctx, title || 'Grupper', gridW), PAGE_PAD, PAGE_PAD + 32);
        ctx.font = `500 18px ${FONT}`;
        ctx.fillStyle = '#555';
        ctx.fillText(new Date().toLocaleDateString('nn-NO', {
            day: 'numeric', month: 'long', year: 'numeric'
        }), PAGE_PAD, PAGE_PAD + 58);

        /* Ikona må vere lasta før vi teiknar */
        const icons = await Promise.all(groups.map(g => loadIcon(g.icon, ICON_SIZE)));

        let y = PAGE_PAD + headerH;
        for (let r = 0; r < rows; r++) {
            let x = PAGE_PAD;
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                if (i >= groups.length) break;
                drawCard(ctx, groups[i], icons[i], x, y, CARD_W, heights[i]);
                x += CARD_W + GAP;
            }
            y += rowH[r] + GAP;
        }

        const filename = 'flokkdeilar-'
            + (title || 'grupper').toLowerCase().replace(/[^a-z0-9æøå]+/gi, '-').replace(/^-|-$/g, '')
            + '.png';

        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
    }

    function drawCard(ctx, g, iconImg, x, y, w, h) {
        /* Skugge som i UI-et (4px offset, ingen blur) */
        ctx.fillStyle = INK;
        roundRect(ctx, x + 4, y + 4, w, h, 16);
        ctx.fill();

        ctx.fillStyle = g.color || '#ffffff';
        roundRect(ctx, x, y, w, h, 16);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        roundRect(ctx, x, y, w, h, 16);
        ctx.stroke();

        const cx = x + w / 2;
        let cy = y + CARD_PAD;

        if (iconImg) {
            ctx.drawImage(iconImg, cx - ICON_SIZE / 2, cy, ICON_SIZE, ICON_SIZE);
        }
        cy += ICON_SIZE + 16;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = INK;
        ctx.font = `800 ${NAME_SIZE}px ${FONT}`;
        ctx.fillText(fitText(ctx, g.name || '', w - CARD_PAD * 2), cx, cy);
        cy += NAME_SIZE + 14;

        ctx.font = `600 ${MEMBER_SIZE}px ${FONT}`;
        (g.members || []).forEach(m => {
            ctx.fillText(fitText(ctx, m.name, w - CARD_PAD * 2), cx, cy);
            cy += MEMBER_SIZE + MEMBER_GAP;
        });
    }

    /* ── Utskrift / lagre som PDF via nettlesaren sin utskriftsdialog ── */
    function printGroups() {
        window.print();
    }

    return { toPNG, printGroups };
})();
