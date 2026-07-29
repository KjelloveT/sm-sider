/* ══════════════════════════════════════
   APP.JS — Wiring av BiletFlett-grensesnittet
   ══════════════════════════════════════ */

(() => {
    let canvas, fileInput, slotInput, slotTarget = -1;
    let crop = null; // { img, id, sel, dragging }

    document.addEventListener('DOMContentLoaded', () => {
        Icons.inject();
        canvas = document.getElementById('collage-canvas');
        fileInput = document.getElementById('file-input');
        slotInput = document.getElementById('slot-input');

        Collage.init(canvas, {
            onEmptyClick: (idx) => { slotTarget = idx; slotInput.click(); },
            onChange: () => {}
        });
        Collage.setCropHandler(openCrop);

        buildGallery();
        bindToolbar();
        bindCrop();
        bindModals();

        // Canvas teiknar med reservefont om fontfilene ikkje er klare enno,
        // så vi ventar på dei før første render — og teiknar på nytt etterpå
        // i tilfelle noko kom seint.
        Fonts.load().then(() => Collage.render());
        selectTemplate(Templates.all[0].id);
    });

    /* ──────────────── Malgalleri med miniatyrar ──────────────── */
    function buildGallery() {
        const host = document.getElementById('gallery');
        host.innerHTML = '';
        const groups = [
            { label: 'Standard', items: Templates.standard },
            { label: 'Tema', items: Templates.tema },
            { label: 'Ungdomssteget', items: Templates.ungdom }
        ];
        groups.forEach(g => {
            const h = document.createElement('div');
            h.className = 'gallery-group-title';
            h.textContent = g.label;
            host.appendChild(h);
            g.items.forEach(t => {
                const card = document.createElement('button');
                card.className = 'tpl-card';
                card.dataset.id = t.id;
                card.setAttribute('aria-label', 'Vel mal: ' + t.name);
                const thumb = document.createElement('canvas');
                renderThumb(thumb, t);
                const name = document.createElement('span');
                name.className = 'tpl-name';
                name.textContent = t.name;
                card.appendChild(thumb);
                card.appendChild(name);
                card.addEventListener('click', () => selectTemplate(t.id));
                host.appendChild(card);
            });
        });
    }

    function renderThumb(cv, t) {
        const ratio = t.orientation === 'landscape' ? [168, 119] : t.orientation === 'square' ? [140, 140] : [119, 168];
        cv.width = ratio[0]; cv.height = ratio[1];
        const c = cv.getContext('2d');
        const W = cv.width, H = cv.height, pal = t.palette;
        Decor.background(c, W, H, t.background, pal);
        (t.decor || []).filter(d => d.layer === 'back').forEach(d => Decor.item(c, W, H, d, pal));
        t.slots.forEach(s => {
            c.save();
            c.fillStyle = pal.accent || '#999'; c.globalAlpha = 0.55;
            const x = s.x * W, y = s.y * H, w = s.w * W, h = s.h * H;
            c.translate(x + w / 2, y + h / 2); c.rotate((s.rotation || 0) * Math.PI / 180);
            c.fillStyle = s.frame === 'polaroid' ? '#ffffff' : (pal.accent || '#999');
            if (s.frame === 'circle') { c.beginPath(); c.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill(); }
            else c.fillRect(-w / 2, -h / 2, w, h);
            c.restore();
        });
        (t.decor || []).filter(d => d.layer !== 'back').forEach(d => Decor.item(c, W, H, d, pal));
    }

    function selectTemplate(id) {
        Collage.setTemplate(id);
        document.querySelectorAll('.tpl-card').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });
        syncFormatButtons();
        buildTextPanel();
    }

    /* ──────────────── Tekst-panel ──────────────── */
    function buildTextPanel() {
        const host = document.getElementById('text-fields');
        host.innerHTML = '';
        const fields = Collage.getTextFields();
        if (!fields.length) {
            const p = document.createElement('p');
            p.className = 'panel-hint';
            p.textContent = 'Denne malen har ingen tekstfelt.';
            host.appendChild(p);
            return;
        }
        fields.forEach(f => {
            const wrap = document.createElement('label');
            wrap.className = 'field';
            const span = document.createElement('span');
            span.className = 'field-label';
            span.textContent = labelFor(f.id);
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'neo-input';
            input.value = f.text || '';
            input.setAttribute('aria-label', labelFor(f.id));
            input.addEventListener('input', () => Collage.setText(f.id, input.value));
            wrap.appendChild(span);
            wrap.appendChild(input);
            host.appendChild(wrap);
        });
    }

    function labelFor(id) {
        const map = {
            title: 'Tittel', sub: 'Undertittel', date: 'Dato', name: 'Namn', age: 'Alder',
            class: 'Klasse', label: 'Merkelapp', when: 'Når', where: 'Stad',
            cap1: 'Bilettekst 1', cap2: 'Bilettekst 2', cap3: 'Bilettekst 3', cap4: 'Bilettekst 4'
        };
        return map[id] || 'Tekst';
    }

    /* ──────────────── Verktøyrad ──────────────── */
    function bindToolbar() {
        document.getElementById('btn-add').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => { Collage.addImages(e.target.files); e.target.value = ''; });
        slotInput.addEventListener('change', (e) => {
            if (slotTarget >= 0) Collage.addImagesToSlot(e.target.files, slotTarget);
            slotTarget = -1; e.target.value = '';
        });
        document.getElementById('btn-download').addEventListener('click', () => Collage.exportPNG());
        document.getElementById('btn-clear').addEventListener('click', () => {
            if (confirm('Vil du fjerne alle bileta frå malen?')) Collage.clearAll();
        });
        document.querySelectorAll('[data-format]').forEach(btn => {
            btn.addEventListener('click', () => { Collage.setFormat(btn.dataset.format); syncFormatButtons(); });
        });
        // dra-og-slepp filer på lerretet
        canvas.addEventListener('dragover', (e) => e.preventDefault());
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) Collage.addImages(e.dataTransfer.files);
        });
    }

    function syncFormatButtons() {
        document.querySelectorAll('[data-format]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.format === Collage.format);
        });
    }

    /* ──────────────── Beskjering ──────────────── */
    function openCrop(slotIdx) {
        const id = Collage.getSlotImageId(slotIdx);
        const img = id != null ? Collage.poolImg(id) : null;
        if (!img) return;
        const cv = document.getElementById('crop-canvas');
        const maxW = 760, maxH = 520;
        let w = img.width, h = img.height;
        if (w > maxW || h > maxH) { const r = Math.min(maxW / w, maxH / h); w *= r; h *= r; }
        cv.width = w; cv.height = h;
        crop = { img, id, sel: null, dragging: false };
        drawCrop();
        openOverlay('crop-modal');
    }

    function bindCrop() {
        const cv = document.getElementById('crop-canvas');
        const cpt = (e) => {
            const r = cv.getBoundingClientRect();
            return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
        };
        cv.addEventListener('mousedown', (e) => { const p = cpt(e); crop.dragging = true; crop.sel = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; });
        cv.addEventListener('mousemove', (e) => { if (!crop || !crop.dragging) return; const p = cpt(e); crop.sel.x1 = p.x; crop.sel.y1 = p.y; drawCrop(); });
        window.addEventListener('mouseup', () => { if (crop) crop.dragging = false; });
        document.getElementById('crop-apply').addEventListener('click', applyCrop);
        document.getElementById('crop-cancel').addEventListener('click', () => closeOverlay('crop-modal'));
    }

    function drawCrop() {
        const cv = document.getElementById('crop-canvas');
        const c = cv.getContext('2d');
        c.clearRect(0, 0, cv.width, cv.height);
        c.drawImage(crop.img, 0, 0, cv.width, cv.height);
        if (!crop.sel) return;
        const s = norm(crop.sel);
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(0, 0, cv.width, s.y);
        c.fillRect(0, s.y, s.x, s.h);
        c.fillRect(s.x + s.w, s.y, cv.width - s.x - s.w, s.h);
        c.fillRect(0, s.y + s.h, cv.width, cv.height - s.y - s.h);
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(s.x, s.y, s.w, s.h);
    }

    function norm(sel) {
        return { x: Math.min(sel.x0, sel.x1), y: Math.min(sel.y0, sel.y1), w: Math.abs(sel.x1 - sel.x0), h: Math.abs(sel.y1 - sel.y0) };
    }

    function applyCrop() {
        if (!crop || !crop.sel) { closeOverlay('crop-modal'); return; }
        const cv = document.getElementById('crop-canvas');
        const s = norm(crop.sel);
        if (s.w < 8 || s.h < 8) { closeOverlay('crop-modal'); return; }
        const sx = crop.img.width / cv.width, sy = crop.img.height / cv.height;
        const out = document.createElement('canvas');
        out.width = s.w * sx; out.height = s.h * sy;
        out.getContext('2d').drawImage(crop.img, s.x * sx, s.y * sy, s.w * sx, s.h * sy, 0, 0, out.width, out.height);
        const newImg = new Image();
        newImg.onload = () => { Collage.replaceImage(crop.id, newImg); closeOverlay('crop-modal'); };
        newImg.src = out.toDataURL();
    }

    /* ──────────────── Modalar ──────────────── */
    function openOverlay(id) { document.getElementById(id).classList.add('open'); }
    function closeOverlay(id) { document.getElementById(id).classList.remove('open'); }

    function bindModals() {
        document.getElementById('btn-privacy').addEventListener('click', () => openOverlay('privacy-modal'));
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => closeOverlay(btn.dataset.close));
        });
        document.querySelectorAll('.modal-overlay').forEach(ov => {
            ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(ov => ov.classList.remove('open'));
        });
    }
})();
