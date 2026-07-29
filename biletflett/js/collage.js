/* ══════════════════════════════════════
   COLLAGE.JS — Render-motor og tilstand for BiletFlett
   Teiknar mal (bakgrunn → pynt bak → fotofelt → pynt framfor → tekst)
   på eit høgoppløyst lerret. Treff-deteksjon skalerer korrekt mellom
   lerretsoppløysing og vist storleik (fiksar den gamle koordinat-bugen).
   ══════════════════════════════════════ */

const Collage = (() => {
    const DIMS = { portrait: [1240, 1754], landscape: [1754, 1240], square: [1240, 1240] };

    let canvas, ctx, W = 1240, H = 1754;
    let template = null;
    let format = 'portrait';
    let pool = [];            // { id, img }
    let slotData = {};        // slotIndex -> { imgId, offsetX, offsetY, zoom }
    let textValues = {};      // textId -> string
    let hovered = -1;
    let dragging = false, dragSlot = -1, dragLast = { x: 0, y: 0 };
    let controlRects = [];
    let nextId = 1;
    let onEmptyClick = null, onChange = null;

    /* ──────────────── Oppsett ──────────────── */
    function init(canvasEl, opts) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        onEmptyClick = (opts && opts.onEmptyClick) || null;
        onChange = (opts && opts.onChange) || null;
        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        canvas.addEventListener('mouseleave', () => { if (hovered !== -1) { hovered = -1; render(); } });
        canvas.addEventListener('touchstart', touchTo('mousedown'), { passive: false });
        canvas.addEventListener('touchmove', touchTo('mousemove'), { passive: false });
        canvas.addEventListener('touchend', (e) => { e.preventDefault(); onUp({}); });
    }

    function touchTo(type) {
        return (e) => {
            e.preventDefault();
            const t = e.touches[0]; if (!t && type !== 'mouseup') return;
            if (t) canvas.dispatchEvent(new MouseEvent(type, { clientX: t.clientX, clientY: t.clientY }));
        };
    }

    /* Skaler klientkoordinat til lerretspikslar (KJERNEFIKS) */
    function pt(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - r.left) * (canvas.width / r.width),
            y: (e.clientY - r.top) * (canvas.height / r.height)
        };
    }

    /* ──────────────── Mal og format ──────────────── */
    function setTemplate(id) {
        template = Templates.get(id);
        if (!template) return;
        format = template.orientation || 'portrait';
        slotData = {};
        textValues = {};
        (template.texts || []).forEach(t => { textValues[t.id] = t.text || ''; });
        applyFormat();
        autofill();
        render();
    }

    function setFormat(fmt) {
        if (!DIMS[fmt]) return;
        format = fmt;
        applyFormat();
        render();
    }

    function applyFormat() {
        [W, H] = DIMS[format];
        canvas.width = W;
        canvas.height = H;
    }

    function setText(id, value) {
        textValues[id] = value;
        render();
    }

    function getTextFields() {
        return (template && template.texts) ? template.texts : [];
    }

    /* ──────────────── Bilete ──────────────── */
    function addImages(fileList) {
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        let remaining = files.length;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    pool.push({ id: nextId++, img });
                    autofill();
                    render();
                    if (--remaining === 0 && onChange) onChange();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function addImagesToSlot(fileList, slotIdx) {
        const file = Array.from(fileList).find(f => f.type.startsWith('image/'));
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const entry = { id: nextId++, img };
                pool.push(entry);
                slotData[slotIdx] = { imgId: entry.id, offsetX: 0, offsetY: 0, zoom: 1 };
                render();
                if (onChange) onChange();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    function autofill() {
        if (!template) return;
        const used = new Set(Object.values(slotData).map(s => s.imgId));
        const free = pool.filter(p => !used.has(p.id));
        let fi = 0;
        template.slots.forEach((slot, idx) => {
            if (!slotData[idx] && fi < free.length) {
                slotData[idx] = { imgId: free[fi].id, offsetX: 0, offsetY: 0, zoom: 1 };
                fi++;
            }
        });
    }

    function poolImg(id) { const e = pool.find(p => p.id === id); return e ? e.img : null; }
    function getSlotImageId(idx) { return slotData[idx] ? slotData[idx].imgId : null; }

    function replaceImage(id, newImg) {
        const e = pool.find(p => p.id === id);
        if (e) { e.img = newImg; render(); }
    }

    function clearSlot(idx) {
        delete slotData[idx];
        render();
        if (onChange) onChange();
    }

    function clearAll() {
        pool = []; slotData = {};
        render();
        if (onChange) onChange();
    }

    function zoomSlot(idx, factor) {
        if (!slotData[idx]) return;
        slotData[idx].zoom = Math.max(0.5, Math.min(4, slotData[idx].zoom * factor));
        render();
    }

    /* ──────────────── Geometri ──────────────── */
    function slotRect(slot) {
        return { x: slot.x * W, y: slot.y * H, w: slot.w * W, h: slot.h * H };
    }

    function pointInSlot(px, py, slot) {
        const r = slotRect(slot);
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        const a = -(slot.rotation || 0) * Math.PI / 180;
        const dx = px - cx, dy = py - cy;
        const lx = dx * Math.cos(a) - dy * Math.sin(a);
        const ly = dx * Math.sin(a) + dy * Math.cos(a);
        return Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2;
    }

    /* ──────────────── Render ──────────────── */
    function render(interactive = true) {
        if (!template) { ctx.clearRect(0, 0, W, H); return; }
        const pal = template.palette;
        Decor.background(ctx, W, H, template.background, pal);

        (template.decor || []).filter(d => d.layer === 'back').forEach(d => Decor.item(ctx, W, H, d, pal));

        template.slots.forEach((slot, idx) => drawSlot(slot, idx));

        (template.decor || []).filter(d => d.layer !== 'back').forEach(d => Decor.item(ctx, W, H, d, pal));

        (template.texts || []).forEach(t => drawText(t));

        controlRects = [];
        if (interactive && hovered !== -1 && slotData[hovered]) drawControls(template.slots[hovered], hovered);
    }

    function drawSlot(slot, idx) {
        const r = slotRect(slot);
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        const data = slotData[idx];
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((slot.rotation || 0) * Math.PI / 180);
        const x = -r.w / 2, y = -r.h / 2, w = r.w, h = r.h;
        const frame = slot.frame || 'plain';
        const min = Math.min(w, h);

        if (frame === 'polaroid') {
            const pad = min * 0.07, bottom = min * 0.22;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.30)'; ctx.shadowBlur = min * 0.06;
            ctx.shadowOffsetX = min * 0.02; ctx.shadowOffsetY = min * 0.03;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad + bottom);
            ctx.restore();
        } else if (frame === 'rounded' || frame === 'circle') {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = min * 0.05;
            ctx.shadowOffsetY = min * 0.02;
            ctx.fillStyle = '#ffffff';
            clipShape(x, y, w, h, frame); ctx.fill();
            ctx.restore();
        }

        // bilete eller plassholdar (klippa til ramme)
        ctx.save();
        clipShape(x, y, w, h, frame);
        ctx.clip();
        const img = data ? poolImg(data.imgId) : null;
        if (img) {
            const ir = img.width / img.height, sr = w / h;
            const z = data.zoom || 1;
            let dw, dh;
            if (ir > sr) { dh = h * z; dw = dh * ir; } else { dw = w * z; dh = dw / ir; }
            const ox = (w - dw) / 2 + (data.offsetX || 0);
            const oy = (h - dh) / 2 + (data.offsetY || 0);
            ctx.drawImage(img, x + ox, y + oy, dw, dh);
        } else {
            drawPlaceholder(x, y, w, h, idx);
        }
        ctx.restore();

        // ramme-kant
        ctx.lineJoin = 'round';
        if (frame === 'plain') {
            ctx.strokeStyle = '#e2e2e2'; ctx.lineWidth = W * 0.0025;
            clipShape(x, y, w, h, frame); ctx.stroke();
        } else if (frame === 'rounded' || frame === 'circle') {
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = min * 0.03;
            clipShape(x, y, w, h, frame); ctx.stroke();
        }
        ctx.restore();
    }

    function clipShape(x, y, w, h, frame) {
        if (frame === 'circle') {
            ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        } else if (frame === 'rounded') {
            const r = Math.min(w, h) * 0.10;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        } else {
            ctx.beginPath(); ctx.rect(x, y, w, h);
        }
    }

    function drawPlaceholder(x, y, w, h, idx) {
        const pal = template.palette;
        ctx.fillStyle = pal.accent3 || '#e6e6e6';
        ctx.globalAlpha = 0.6; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
        const s = Math.min(w, h) * 0.22, mx = x + w / 2, my = y + h / 2;
        ctx.strokeStyle = pal.accent || '#888'; ctx.lineWidth = Math.max(2, s * 0.07);
        ctx.strokeRect(mx - s, my - s * 0.8, s * 2, s * 1.6);
        ctx.fillStyle = pal.accent || '#888';
        ctx.beginPath(); ctx.arc(mx - s * 0.4, my - s * 0.3, s * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(mx - s, my + s * 0.8);
        ctx.lineTo(mx - s * 0.2, my - s * 0.1);
        ctx.lineTo(mx + s * 0.4, my + s * 0.4);
        ctx.lineTo(mx + s, my - s * 0.2);
        ctx.lineTo(mx + s, my + s * 0.8);
        ctx.closePath(); ctx.fill();
    }

    /* ──────────────── Tekst ──────────────── */
    function drawText(t) {
        const val = textValues[t.id] != null ? textValues[t.id] : (t.text || '');
        if (!val) return;
        const boxX = t.x * W, boxW = t.w * W, fontPx = t.size * W;
        const lineH = fontPx * 1.18;
        ctx.save();
        const face = t.font || Fonts.stack.bold;
        ctx.font = `${t.weight || Fonts.weightFor(face)} ${fontPx}px ${face}`;
        ctx.textBaseline = 'top';
        ctx.textAlign = t.align || 'left';
        const lines = wrap(val, boxW);
        const blockH = lines.length * lineH;
        let anchorX = boxX;
        if (t.align === 'center') anchorX = boxX + boxW / 2;
        else if (t.align === 'right') anchorX = boxX + boxW;
        const topY = t.y * H;

        if (t.rotation) {
            ctx.translate(anchorX, topY + blockH / 2);
            ctx.rotate(t.rotation * Math.PI / 180);
            ctx.translate(-anchorX, -(topY + blockH / 2));
        }

        if (t.bg) {
            let maxW = 0;
            lines.forEach(l => { maxW = Math.max(maxW, ctx.measureText(l).width); });
            const pad = (t.bg.pad || 0.015) * W;
            let bx = anchorX - (t.align === 'center' ? maxW / 2 : t.align === 'right' ? maxW : 0) - pad;
            const bw = maxW + pad * 2, by = topY - pad, bh = blockH + pad * 2;
            ctx.fillStyle = Palette.resolve(t.bg.color, template.palette, '#ffffff');
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = pad; ctx.shadowOffsetY = pad * 0.4;
            roundRect(bx, by, bw, bh, pad * 0.8); ctx.fill();
            ctx.restore();
        }

        if (t.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = fontPx * 0.12; ctx.shadowOffsetY = fontPx * 0.06; }

        lines.forEach((line, i) => {
            const ly = topY + i * lineH;
            if (t.stroke) {
                ctx.strokeStyle = Palette.resolve(t.stroke, template.palette, '#ffffff');
                ctx.lineWidth = (t.strokeW || 0.006) * W;
                ctx.lineJoin = 'round';
                ctx.strokeText(line, anchorX, ly);
            }
            ctx.fillStyle = Palette.resolve(t.color, template.palette, '#1a1a1a');
            ctx.fillText(line, anchorX, ly);
        });
        ctx.restore();
    }

    function wrap(text, maxW) {
        const out = [];
        text.split('\n').forEach(para => {
            const words = para.split(' ');
            let line = '';
            words.forEach(word => {
                const test = line ? line + ' ' + word : word;
                if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; }
                else line = test;
            });
            out.push(line);
        });
        return out;
    }

    function roundRect(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /* ──────────────── Slot-kontrollar (overlay) ──────────────── */
    function drawControls(slot, idx) {
        const r = slotRect(slot);
        const size = Math.max(34, W * 0.040);
        const gap = size * 0.25;
        const actions = ['zoomOut', 'zoomIn', 'crop', 'remove'];
        const totalW = actions.length * size + (actions.length - 1) * gap;
        let bx = r.x + r.w / 2 - totalW / 2;
        const by = r.y + gap;
        actions.forEach(act => {
            ctx.save();
            ctx.fillStyle = act === 'remove' ? 'rgba(217,48,37,0.92)' : 'rgba(26,26,26,0.82)';
            ctx.beginPath(); ctx.arc(bx + size / 2, by + size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, size * 0.07);
            ctx.lineCap = 'round';
            glyph(act, bx + size / 2, by + size / 2, size * 0.26);
            ctx.restore();
            controlRects.push({ action: act, x: bx, y: by, w: size, h: size });
            bx += size + gap;
        });
    }

    function glyph(act, cx, cy, s) {
        ctx.beginPath();
        if (act === 'zoomIn' || act === 'zoomOut') {
            ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
            if (act === 'zoomIn') { ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); }
        } else if (act === 'remove') {
            ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s);
            ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s);
        } else if (act === 'crop') {
            ctx.moveTo(cx - s, cy - s * 0.4); ctx.lineTo(cx - s, cy + s); ctx.lineTo(cx + s * 0.4, cy + s);
            ctx.moveTo(cx + s, cy + s * 0.4); ctx.lineTo(cx + s, cy - s); ctx.lineTo(cx - s * 0.4, cy - s);
        }
        ctx.stroke();
    }

    /* ──────────────── Inndata ──────────────── */
    let cropRequest = null;
    function setCropHandler(fn) { cropRequest = fn; }

    function onDown(e) {
        if (!template) return;
        const p = pt(e);
        // kontrollar på den hovra sloten
        if (hovered !== -1 && slotData[hovered]) {
            for (const c of controlRects) {
                if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
                    if (c.action === 'zoomIn') zoomSlot(hovered, 1.15);
                    else if (c.action === 'zoomOut') zoomSlot(hovered, 0.87);
                    else if (c.action === 'remove') clearSlot(hovered);
                    else if (c.action === 'crop' && cropRequest) cropRequest(hovered);
                    return;
                }
            }
        }
        // klikk i slot
        for (let i = 0; i < template.slots.length; i++) {
            if (pointInSlot(p.x, p.y, template.slots[i])) {
                if (slotData[i]) { dragging = true; dragSlot = i; dragLast = p; canvas.style.cursor = 'grabbing'; }
                else if (onEmptyClick) onEmptyClick(i);
                return;
            }
        }
    }

    function onMove(e) {
        if (!template) return;
        const p = pt(e);
        if (dragging && slotData[dragSlot]) {
            slotData[dragSlot].offsetX += p.x - dragLast.x;
            slotData[dragSlot].offsetY += p.y - dragLast.y;
            dragLast = p;
            render();
            return;
        }
        let h = -1;
        for (let i = 0; i < template.slots.length; i++) {
            if (pointInSlot(p.x, p.y, template.slots[i])) { h = i; break; }
        }
        if (h !== hovered) { hovered = h; render(); }
        canvas.style.cursor = (h !== -1 && slotData[h]) ? 'grab' : (h !== -1 ? 'pointer' : 'default');
    }

    function onUp() {
        dragging = false; dragSlot = -1;
        if (canvas) canvas.style.cursor = 'default';
    }

    /* ──────────────── Eksport ──────────────── */
    function exportPNG() {
        render(false);
        const url = canvas.toDataURL('image/png');
        render(true);
        const link = document.createElement('a');
        link.download = `biletflett-${template ? template.id : 'collage'}.png`;
        link.href = url;
        link.click();
    }

    return {
        init, setTemplate, setFormat, setText, getTextFields,
        addImages, addImagesToSlot, replaceImage, clearAll,
        getSlotImageId, poolImg, exportPNG, render,
        setCropHandler,
        get format() { return format; },
        get current() { return template; }
    };
})();
