/* ══════════════════════════════════════
   APP.JS — Wiring av Handsam bilete
   ══════════════════════════════════════ */

(() => {
    /* item: { id, name, source:Image, cropped:canvas|null, rotation, flipH, flipV,
              origBytes, result:{blob,url,width,height}|null } */
    let items = [];
    let logo = null;            // Image for vassmerke-logo
    let wmPos = 'bottom-right';
    let resizeMode = { kind: 'none' };   // 'none' | 'pct' | 'long' | 'exact'
    let cropState = null;       // { item, sel, dragging }
    let renderTimer = null;
    let seq = 0;

    const $ = (id) => document.getElementById(id);
    let els = {};

    document.addEventListener('DOMContentLoaded', () => {
        hydrateIcons();
        els = {
            uploadZone: $('upload-zone'), fileInput: $('file-input'), logoInput: $('logo-input'),
            layout: $('app-layout'), grid: $('preview-grid'), count: $('count'), savings: $('savings'),
            resizeW: $('resize-w'), resizeH: $('resize-h'), lockAspect: $('lock-aspect'),
            format: $('format'), quality: $('quality'), qualityVal: $('quality-val'), qualityRow: $('quality-row'),
            targetOn: $('target-on'), targetRow: $('target-row'), targetKb: $('target-kb'),
            wmText: $('wm-text'), wmGrid: $('wm-grid'), wmSize: $('wm-size'), wmSizeVal: $('wm-size-val'),
            wmOpacity: $('wm-opacity'), wmOpacityVal: $('wm-opacity-val'), wmColor: $('wm-color'),
            wmLogoBtn: $('wm-logo-btn'), wmLogoChip: $('wm-logo-chip'), wmLogoName: $('wm-logo-name'),
            wmLogoClear: $('wm-logo-clear'), wmLogoScale: $('wm-logo-scale'), wmLogoScaleVal: $('wm-logo-scale-val'),
            wmLogoScaleRow: $('wm-logo-scale-row'),
            namePattern: $('name-pattern')
        };
        bindUpload();
        bindToolbar();
        bindSettings();
        bindCrop();
        bindModals();
    });

    /* ──────────────── Opplasting ──────────────── */
    function bindUpload() {
        const open = () => els.fileInput.click();
        els.uploadZone.addEventListener('click', open);
        els.uploadZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
        els.fileInput.addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
        $('btn-add-more').addEventListener('click', open);

        ['dragenter', 'dragover'].forEach(ev =>
            els.uploadZone.addEventListener(ev, (e) => { e.preventDefault(); els.uploadZone.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach(ev =>
            els.uploadZone.addEventListener(ev, (e) => { e.preventDefault(); els.uploadZone.classList.remove('dragover'); }));
        els.uploadZone.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
    }

    async function addFiles(fileList) {
        const all = Array.from(fileList);
        const files = all.filter(f => f.type.startsWith('image/'));
        let skipped = all.length - files.length;   // ikkje-bilete-filer
        for (const file of files) {
            try {
                const source = await Processor.loadImage(file);
                items.push({
                    id: ++seq, name: file.name, source, cropped: null,
                    rotation: 0, flipH: false, flipV: false,
                    origBytes: file.size, result: null
                });
            } catch (err) {
                console.error('Klarte ikkje laste', file.name, err);
                skipped++;   // fil som ikkje lét seg lese
            }
        }
        if (skipped > 0) {
            notify(skipped === 1
                ? '1 fil vart hoppa over (ikkje eit gyldig bilete).'
                : `${skipped} filer vart hoppa over (ikkje gyldige bilete).`);
        }
        els.layout.hidden = items.length === 0;
        renderCards();
        scheduleProcess();
    }

    /* Liten, sjølvstendig notis (bildebehandling har ingen delt toast). */
    let notifyEl = null, notifyTimer = null;
    function notify(msg) {
        if (!notifyEl) {
            notifyEl = document.createElement('div');
            notifyEl.setAttribute('role', 'status');
            notifyEl.style.cssText =
                'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:3000;' +
                'background:var(--accent2);color:var(--text-on-accent);border:3px solid var(--border);' +
                'box-shadow:4px 4px 0 var(--shadow);padding:10px 16px;font-weight:800;font-size:0.9rem;' +
                'max-width:90vw;opacity:0;transition:opacity 0.2s;';
            document.body.appendChild(notifyEl);
        }
        notifyEl.textContent = msg;
        requestAnimationFrame(() => { notifyEl.style.opacity = '1'; });
        clearTimeout(notifyTimer);
        notifyTimer = setTimeout(() => { notifyEl.style.opacity = '0'; }, 3500);
    }

    /* ──────────────── Verktøyrad ──────────────── */
    function bindToolbar() {
        $('btn-apply-all').addEventListener('click', processAll);
        $('btn-reset').addEventListener('click', () => {
            items.forEach(it => { it.rotation = 0; it.flipH = false; it.flipV = false; it.cropped = null; });
            renderCards();
            processAll();
        });
        $('btn-clear').addEventListener('click', () => {
            if (!items.length || confirm('Vil du fjerne alle bileta?')) {
                items.forEach(it => it.result && URL.revokeObjectURL(it.result.url));
                items = [];
                els.layout.hidden = true;
                renderCards();
                updateMeta();
            }
        });
        $('btn-zip').addEventListener('click', downloadZip);
    }

    /* ──────────────── Innstillingar ──────────────── */
    function bindSettings() {
        // Storleik-presets
        document.querySelectorAll('[data-resize-px]').forEach(b =>
            b.addEventListener('click', () => {
                resizeMode = { kind: 'long', value: parseInt(b.dataset.resizePx, 10) };
                setActive('[data-resize-px],[data-resize-pct]', b);
                els.resizeW.value = ''; els.resizeH.value = '';
                scheduleProcess();
            }));
        document.querySelectorAll('[data-resize-pct]').forEach(b =>
            b.addEventListener('click', () => {
                resizeMode = { kind: 'pct', value: parseInt(b.dataset.resizePct, 10) };
                setActive('[data-resize-px],[data-resize-pct]', b);
                els.resizeW.value = ''; els.resizeH.value = '';
                scheduleProcess();
            }));
        const onDim = () => {
            resizeMode = { kind: 'exact' };
            setActive('[data-resize-px],[data-resize-pct]', null);
            scheduleProcess();
        };
        els.resizeW.addEventListener('input', onDim);
        els.resizeH.addEventListener('input', onDim);
        els.lockAspect.addEventListener('change', scheduleProcess);

        // Roter / spegle (batch)
        document.querySelectorAll('[data-rotate]').forEach(b =>
            b.addEventListener('click', () => {
                const d = parseInt(b.dataset.rotate, 10);
                items.forEach(it => it.rotation = (((it.rotation + d) % 360) + 360) % 360);
                processAll();
            }));
        document.querySelectorAll('[data-flip]').forEach(b =>
            b.addEventListener('click', () => {
                items.forEach(it => b.dataset.flip === 'h' ? (it.flipH = !it.flipH) : (it.flipV = !it.flipV));
                processAll();
            }));

        // Format / kvalitet
        els.format.addEventListener('change', () => {
            const png = els.format.value === 'png';
            els.qualityRow.style.opacity = png ? 0.4 : 1;
            els.quality.disabled = png;
            scheduleProcess();
        });
        slider(els.quality, els.qualityVal, scheduleProcess);
        els.targetOn.addEventListener('change', () => {
            els.targetRow.hidden = !els.targetOn.checked;
            scheduleProcess();
        });
        els.targetKb.addEventListener('input', scheduleProcess);

        // Vassmerke
        els.wmText.addEventListener('input', scheduleProcess);
        els.wmGrid.querySelectorAll('.pos-btn').forEach(b =>
            b.addEventListener('click', () => { wmPos = b.dataset.pos; setActive('.pos-btn', b); scheduleProcess(); }));
        slider(els.wmSize, els.wmSizeVal, scheduleProcess);
        slider(els.wmOpacity, els.wmOpacityVal, scheduleProcess);
        els.wmColor.addEventListener('input', scheduleProcess);
        els.wmLogoBtn.addEventListener('click', () => els.logoInput.click());
        els.logoInput.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                logo = await Processor.loadImage(e.target.files[0]);
                els.wmLogoName.textContent = e.target.files[0].name;
                els.wmLogoChip.hidden = false;
                els.wmLogoScale.hidden = false; els.wmLogoScaleRow.hidden = false;
                scheduleProcess();
            }
            e.target.value = '';
        });
        els.wmLogoClear.addEventListener('click', () => {
            logo = null; els.wmLogoChip.hidden = true;
            els.wmLogoScale.hidden = true; els.wmLogoScaleRow.hidden = true;
            scheduleProcess();
        });
        slider(els.wmLogoScale, els.wmLogoScaleVal, scheduleProcess);
    }

    function slider(input, label, cb) {
        input.addEventListener('input', () => { label.textContent = input.value; cb(); });
    }
    function setActive(selector, el) {
        document.querySelectorAll(selector).forEach(b => b.classList.toggle('active', b === el));
    }

    /* ──────────────── Innstillingar -> spec ──────────────── */
    function readSettings() {
        const wmText = els.wmText.value.trim();
        const hasWm = wmText || logo;
        return {
            format: els.format.value,
            quality: parseInt(els.quality.value, 10),
            targetKb: els.targetOn.checked ? Math.max(10, parseInt(els.targetKb.value, 10) || 0) : null,
            watermark: hasWm ? {
                text: wmText, position: wmPos,
                size: parseInt(els.wmSize.value, 10),
                opacity: parseInt(els.wmOpacity.value, 10),
                color: els.wmColor.value,
                logo, logoScale: parseInt(els.wmLogoScale.value, 10)
            } : null
        };
    }

    function dimsFor(item) {
        const src = item.cropped || item.source;
        const baseRot = item.rotation === 90 || item.rotation === 270;
        const w0 = baseRot ? src.height : src.width;
        const h0 = baseRot ? src.width : src.height;
        const aspect = w0 / h0;
        const m = resizeMode;
        if (m.kind === 'pct') return { width: w0 * m.value / 100, height: h0 * m.value / 100 };
        if (m.kind === 'long') {
            const r = m.value / Math.max(w0, h0);
            return r >= 1 ? {} : { width: w0 * r, height: h0 * r };
        }
        if (m.kind === 'exact') {
            const w = parseInt(els.resizeW.value, 10) || 0;
            const h = parseInt(els.resizeH.value, 10) || 0;
            const lock = els.lockAspect.checked;
            if (w && h) return lock
                ? scaleToBox(w0, h0, w, h)
                : { width: w, height: h };
            if (w) return { width: w, height: lock ? Math.round(w / aspect) : h0 };
            if (h) return { width: lock ? Math.round(h * aspect) : w0, height: h };
        }
        return {};
    }
    function scaleToBox(w0, h0, boxW, boxH) {
        const r = Math.min(boxW / w0, boxH / h0);
        return { width: Math.round(w0 * r), height: Math.round(h0 * r) };
    }

    /* ──────────────── Prosessering ──────────────── */
    function scheduleProcess() {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(processAll, 350);
    }

    async function processAll() {
        clearTimeout(renderTimer);
        const base = readSettings();
        for (const it of items) {
            const dims = dimsFor(it);
            const settings = Object.assign({}, base, dims);
            try {
                const res = await Processor.process(it, settings);
                if (it.result) URL.revokeObjectURL(it.result.url);
                it.result = { blob: res.blob, url: URL.createObjectURL(res.blob), width: res.width, height: res.height };
                updateCard(it);
            } catch (err) {
                console.error('Prosesseringsfeil', it.name, err);
            }
        }
        updateMeta();
    }

    /* ──────────────── Kort ──────────────── */
    function renderCards() {
        els.grid.innerHTML = '';
        items.forEach(it => {
            const card = document.createElement('div');
            card.className = 'preview-card';
            card.dataset.id = it.id;
            card.innerHTML = `
                <div class="thumb-wrap"><img class="thumb" alt="${escapeHtml(it.name)}"></div>
                <div class="card-info">
                    <span class="card-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>
                    <span class="card-dims"></span>
                    <span class="card-size"></span>
                </div>
                <div class="card-actions">
                    <button class="btn mini" data-act="crop"><span data-icon="crop"></span> Skjer</button>
                    <button class="btn mini" data-act="rotate" aria-label="Roter"><span data-icon="rotateCw"></span></button>
                    <button class="btn mini c-green" data-act="download" aria-label="Last ned"><span data-icon="download"></span></button>
                    <button class="btn mini c-red" data-act="remove" aria-label="Fjern"><span data-icon="trash2"></span></button>
                </div>`;
            hydrateIcons(card);
            card.querySelector('[data-act="crop"]').addEventListener('click', () => openCrop(it));
            card.querySelector('[data-act="rotate"]').addEventListener('click', () => {
                it.rotation = (it.rotation + 90) % 360; processItem(it);
            });
            card.querySelector('[data-act="download"]').addEventListener('click', () => downloadOne(it));
            card.querySelector('[data-act="remove"]').addEventListener('click', () => removeItem(it));
            els.grid.appendChild(card);
            updateCard(it);
        });
    }

    async function processItem(it) {
        const settings = Object.assign({}, readSettings(), dimsFor(it));
        const res = await Processor.process(it, settings);
        if (it.result) URL.revokeObjectURL(it.result.url);
        it.result = { blob: res.blob, url: URL.createObjectURL(res.blob), width: res.width, height: res.height };
        updateCard(it);
        updateMeta();
    }

    function updateCard(it) {
        const card = els.grid.querySelector(`[data-id="${it.id}"]`);
        if (!card) return;
        const r = it.result;
        if (r) {
            card.querySelector('.thumb').src = r.url;
            card.querySelector('.card-dims').textContent = `${r.width} × ${r.height} px`;
            const pct = it.origBytes ? Math.round((1 - r.blob.size / it.origBytes) * 100) : 0;
            const tag = pct > 0 ? ` (−${pct}%)` : '';
            card.querySelector('.card-size').textContent = `${formatSize(it.origBytes)} → ${formatSize(r.blob.size)}${tag}`;
        }
    }

    function removeItem(it) {
        if (it.result) URL.revokeObjectURL(it.result.url);
        items = items.filter(x => x !== it);
        if (!items.length) els.layout.hidden = true;
        renderCards();
        updateMeta();
    }

    function updateMeta() {
        els.count.textContent = `${items.length} ${items.length === 1 ? 'bilete' : 'bilete'}`;
        const done = items.filter(it => it.result);
        if (done.length) {
            const orig = done.reduce((s, it) => s + it.origBytes, 0);
            const out = done.reduce((s, it) => s + it.result.blob.size, 0);
            const pct = orig ? Math.round((1 - out / orig) * 100) : 0;
            els.savings.textContent = `${formatSize(orig)} → ${formatSize(out)}` + (pct > 0 ? ` · spart ${pct}%` : '');
        } else {
            els.savings.textContent = '';
        }
    }

    /* ──────────────── Beskjering ──────────────── */
    function openCrop(it) {
        const src = it.cropped || it.source;
        const cv = $('crop-canvas');
        const maxW = 760, maxH = 520;
        let w = src.width, h = src.height;
        if (w > maxW || h > maxH) { const r = Math.min(maxW / w, maxH / h); w *= r; h *= r; }
        cv.width = Math.round(w); cv.height = Math.round(h);
        cropState = { item: it, src, sel: null, dragging: false };
        drawCrop();
        $('crop-modal').classList.add('open');
    }

    function bindCrop() {
        const cv = $('crop-canvas');
        const pt = (e) => {
            const r = cv.getBoundingClientRect();
            const cx = (e.touches ? e.touches[0].clientX : e.clientX);
            const cy = (e.touches ? e.touches[0].clientY : e.clientY);
            return { x: (cx - r.left) * (cv.width / r.width), y: (cy - r.top) * (cv.height / r.height) };
        };
        const down = (e) => { if (!cropState) return; e.preventDefault(); const p = pt(e); cropState.dragging = true; cropState.sel = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; };
        const move = (e) => { if (!cropState || !cropState.dragging) return; const p = pt(e); cropState.sel.x1 = p.x; cropState.sel.y1 = p.y; drawCrop(); };
        const up = () => { if (cropState) cropState.dragging = false; };
        cv.addEventListener('mousedown', down);
        cv.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        cv.addEventListener('touchstart', down, { passive: false });
        cv.addEventListener('touchmove', move, { passive: false });
        cv.addEventListener('touchend', up);
        $('crop-apply').addEventListener('click', applyCrop);
        $('crop-cancel').addEventListener('click', () => $('crop-modal').classList.remove('open'));
    }

    function drawCrop() {
        const cv = $('crop-canvas');
        const c = cv.getContext('2d');
        c.clearRect(0, 0, cv.width, cv.height);
        c.drawImage(cropState.src, 0, 0, cv.width, cv.height);
        if (!cropState.sel) return;
        const s = norm(cropState.sel);
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
        if (!cropState || !cropState.sel) { $('crop-modal').classList.remove('open'); return; }
        const cv = $('crop-canvas');
        const s = norm(cropState.sel);
        if (s.w < 8 || s.h < 8) { $('crop-modal').classList.remove('open'); return; }
        const sx = cropState.src.width / cv.width, sy = cropState.src.height / cv.height;
        const it = cropState.item;
        it.cropped = Processor.crop(cropState.src, { x: s.x * sx, y: s.y * sy, w: s.w * sx, h: s.h * sy });
        it.rotation = 0; it.flipH = false; it.flipV = false;
        $('crop-modal').classList.remove('open');
        processItem(it);
    }

    /* ──────────────── Nedlasting ──────────────── */
    function fileBase(it, index) {
        const orig = it.name.replace(/\.[^/.]+$/, '');
        const today = new Date().toISOString().slice(0, 10);
        const pattern = els.namePattern.value.trim() || '{namn}';
        return pattern
            .replace(/\{namn\}/g, orig)
            .replace(/\{n\}/g, String(index + 1).padStart(3, '0'))
            .replace(/\{dato\}/g, today) || orig;
    }

    function downloadOne(it) {
        if (!it.result) return;
        const i = items.indexOf(it);
        const a = document.createElement('a');
        a.href = it.result.url;
        a.download = fileBase(it, i) + '.' + Processor.ext(els.format.value);
        a.click();
    }

    async function downloadZip() {
        if (!items.length) return;
        const ready = items.filter(it => it.result);
        if (!ready.length) { await processAll(); }
        const zip = new JSZip();
        const ext = Processor.ext(els.format.value);
        const used = {};
        items.forEach((it, i) => {
            if (!it.result) return;
            let name = fileBase(it, i) + '.' + ext;
            if (used[name]) { name = fileBase(it, i) + '_' + (++used[name]) + '.' + ext; }
            else used[name] = 1;
            zip.file(name, it.result.blob);
        });
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'bilete.zip'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /* ──────────────── Modalar ──────────────── */
    function bindModals() {
        $('btn-privacy').addEventListener('click', () => $('privacy-modal').classList.add('open'));
        document.querySelectorAll('[data-close]').forEach(b =>
            b.addEventListener('click', () => $(b.dataset.close).classList.remove('open')));
        document.querySelectorAll('.modal-overlay').forEach(ov =>
            ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); }));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(ov => ov.classList.remove('open'));
        });
    }

    /* ──────────────── Hjelparar ──────────────── */
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    function escapeHtml(s) {
        return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }
})();
