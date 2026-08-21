/* ══════════════════════════════════════
   APP.JS — Wiring av Handsam bilete

   Grunnregelen i heile verktøyet: ei endring gjeld dei bileta som er
   huka av. Difor ligg innstillingane på kvart bilete (item.s), ikkje i
   panelet. Panelet viser verdiane til biletet på arbeidsflata, og eit
   grep skriv den nye verdien til alle avhuka bilete.

   Førehandsvisinga blir rekna på ein nedskalert kopi så det held seg
   raskt på nettbrett. Den fulle oppløysinga blir berre rekna når vi
   treng filstorleiken, og når du lastar ned.
   ══════════════════════════════════════ */

(() => {
    const PREVIEW_MAX = 1400;      // lengste side i førehandsvisinga

    /* item: { id, name, source:Image, origBytes, picked, dirty,
              s:innstillingar, result:{blob,url,width,height}|null, svg:{svg,shapes}|null } */
    let items = [];
    let activeId = null;
    let logo = null;               // felles logo for vassmerke
    let namePattern = '{namn}';
    let seq = 0;

    let previewTimer = null, measureTimer = null, svgTimer = null;
    let measureToken = 0, svgToken = 0;
    let beforeCache = null;        // { key, canvas }

    const $ = (id) => document.getElementById(id);
    let els = {};

    function defaults() {
        return {
            rotation: 0, flipH: false, flipV: false, crop: null,
            resize: { kind: 'pct', value: 100 },
            colors: { on: false, mode: 'gray', levels: 4, brightness: 0, contrast: 0 },
            wm: { text: '', position: 'bottom-right', size: 24, opacity: 80, color: '#ffffff', logoScale: 20 },
            out: { format: 'jpeg', quality: 90, targetKb: null }
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        hydrateIcons();
        els = {
            app: $('app'), uploadZone: $('upload-zone'), fileInput: $('file-input'), logoInput: $('logo-input'),
            stripList: $('strip-list'), selText: $('sel-text'),
            viewerInner: $('viewer-inner'), before: $('cv-before'), after: $('cv-after'),
            split: $('split'), cropLayer: $('crop-layer'), cropBox: $('crop-box'),
            metaDims: $('meta-dims'), metaSize: $('meta-size'),
            resizeW: $('resize-w'), resizeH: $('resize-h'), lockAspect: $('lock-aspect'),
            poOn: $('po-on'), poFields: $('po-fields'), poLevels: $('po-levels'), poLevelsVal: $('po-levels-val'),
            poBright: $('po-bright'), poBrightVal: $('po-bright-val'),
            poContrast: $('po-contrast'), poContrastVal: $('po-contrast-val'),
            svgDetail: $('svg-detail'), svgDetailVal: $('svg-detail-val'), svgInfo: $('svg-info'),
            wmText: $('wm-text'), wmGrid: $('wm-grid'), wmSize: $('wm-size'), wmSizeVal: $('wm-size-val'),
            wmOpacity: $('wm-opacity'), wmOpacityVal: $('wm-opacity-val'), wmColor: $('wm-color'),
            wmLogoChip: $('wm-logo-chip'), wmLogoName: $('wm-logo-name'),
            wmLogoScale: $('wm-logo-scale'), wmLogoScaleVal: $('wm-logo-scale-val'), wmLogoScaleRow: $('wm-logo-scale-row'),
            format: $('format'), quality: $('quality'), qualityVal: $('quality-val'), qualityRow: $('quality-row'),
            targetOn: $('target-on'), targetRow: $('target-row'), targetKb: $('target-kb'),
            namePattern: $('name-pattern'), nameExample: $('name-example')
        };
        bindUpload();
        bindSteps();
        bindSelection();
        bindTools();
        bindCropTool();
        bindGeometry();
        bindSize();
        bindColors();
        bindWatermark();
        bindSave();
        bindSplit();
        bindDownloads();
        bindModals();
    });

    /* ──────────────── Utval og oppslag ──────────────── */
    const active = () => items.find(it => it.id === activeId) || null;
    const picked = () => items.filter(it => it.picked);

    /* Skriv ei endring til alle avhuka bilete. */
    function applyToPicked(fn) {
        const list = picked();
        if (!list.length) { notify('Ingen bilete er huka av, så endringa gjeld ingen.'); return; }
        list.forEach(it => { fn(it.s, it); it.dirty = true; it.svg = null; });
        afterChange();
    }

    function afterChange() {
        beforeCache = null;
        schedulePreview();
        scheduleMeasure();
        scheduleSvg();
        updateMixedNotes();
        updateSelText();
        updateMeta();
    }

    function setActive(id) {
        activeId = id;
        const it = active();
        if (it && !it.picked) { it.picked = true; }   // det du ser på, er alltid med
        beforeCache = null;
        syncPanel();
        renderStrip();
        updateSelText();
        renderPreview();
        updateMeta();
        updateCropLayer();
        scheduleSvg();
    }

    /* ──────────────── Opplasting ──────────────── */
    function bindUpload() {
        const open = () => els.fileInput.click();
        els.uploadZone.addEventListener('click', open);
        els.uploadZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
        els.fileInput.addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
        $('btn-add-more').addEventListener('click', open);
        $('strip-add').addEventListener('click', open);

        ['dragenter', 'dragover'].forEach(ev =>
            document.addEventListener(ev, (e) => { e.preventDefault(); els.uploadZone.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach(ev =>
            document.addEventListener(ev, (e) => { e.preventDefault(); els.uploadZone.classList.remove('dragover'); }));
        document.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        });
    }

    async function addFiles(fileList) {
        const all = Array.from(fileList);
        const files = all.filter(f => f.type.startsWith('image/'));
        let skipped = all.length - files.length;
        const template = items.length ? clone(active() ? active().s : items[0].s) : null;

        for (const file of files) {
            try {
                const source = await Processor.loadImage(file);
                items.push({
                    id: ++seq, name: file.name, source, origBytes: file.size,
                    picked: true, dirty: true, result: null, svg: null,
                    // Nye bilete arvar innstillingane som alt er sette, så ein
                    // bunke som kjem i to omgangar blir handsama likt.
                    s: template ? geometryReset(template) : defaults()
                });
            } catch (err) {
                console.error('Klarte ikkje laste', file.name, err);
                skipped++;
            }
        }
        if (skipped > 0) {
            notify(skipped === 1
                ? '1 fil vart hoppa over (ikkje eit gyldig bilete).'
                : `${skipped} filer vart hoppa over (ikkje gyldige bilete).`);
        }
        if (!items.length) return;
        els.app.hidden = false;
        els.uploadZone.hidden = items.length > 0;
        if (!active()) activeId = items[0].id;
        setActive(activeId);
        afterChange();
    }

    /* Ei kopi av innstillingane utan det som er knytt til akkurat eitt bilete. */
    function geometryReset(s) {
        const copy = clone(s);
        copy.rotation = 0; copy.flipH = false; copy.flipV = false; copy.crop = null;
        return copy;
    }
    const clone = (o) => JSON.parse(JSON.stringify(o));

    /* ──────────────── Steg ──────────────── */
    function bindSteps() {
        document.querySelectorAll('.step').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.step').forEach(b => b.classList.toggle('active', b === btn));
                document.querySelectorAll('.tool-step').forEach(p =>
                    p.hidden = p.dataset.panel !== btn.dataset.step);
                updateCropLayer();
            });
        });
    }

    /* ──────────────── Utvalslinje ──────────────── */
    function bindSelection() {
        $('sel-all').addEventListener('click', () => {
            items.forEach(it => it.picked = true);
            renderStrip(); updateSelText(); updateMixedNotes();
        });
        $('sel-none').addEventListener('click', () => {
            items.forEach(it => it.picked = false);
            const it = active();
            if (it) it.picked = true;    // arbeidsflata er alltid med
            renderStrip(); updateSelText(); updateMixedNotes();
        });
    }

    function updateSelText() {
        const n = picked().length, total = items.length;
        els.selText.textContent = n === total
            ? (total === 1 ? 'Endringane gjeld biletet' : `Endringane gjeld alle ${total} bileta`)
            : `Endringane gjeld ${n} av ${total} bilete`;
    }

    /* ──────────────── Biletstrimmel ──────────────── */
    function renderStrip() {
        els.stripList.innerHTML = '';
        items.forEach(it => {
            const card = document.createElement('div');
            card.className = 'strip-item' + (it.id === activeId ? ' active' : '');
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', it.name);
            card.innerHTML = `
                <img alt="">
                <input type="checkbox" class="strip-pick" aria-label="Ta med ${escapeHtml(it.name)} i endringane">
                <button class="strip-x" aria-label="Fjern ${escapeHtml(it.name)}"><span data-icon="x" data-icon-size="12"></span></button>`;
            const img = card.querySelector('img');
            img.src = it.result ? it.result.url : it.source.src;
            const box = card.querySelector('.strip-pick');
            box.checked = it.picked;
            box.addEventListener('click', (e) => e.stopPropagation());
            box.addEventListener('change', () => {
                it.picked = box.checked;
                if (!it.picked && it.id === activeId) {
                    const next = items.find(x => x.picked);
                    if (next) { setActive(next.id); return; }
                    it.picked = true; box.checked = true;
                    notify('Minst eitt bilete må vere huka av.');
                }
                updateSelText(); updateMixedNotes();
            });
            card.querySelector('.strip-x').addEventListener('click', (e) => {
                e.stopPropagation(); removeItem(it);
            });
            card.addEventListener('click', () => setActive(it.id));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(it.id); }
            });
            hydrateIcons(card);
            els.stripList.appendChild(card);
        });
    }

    function updateThumb(it) {
        const cards = els.stripList.children;
        const i = items.indexOf(it);
        if (i < 0 || !cards[i]) return;
        const img = cards[i].querySelector('img');
        if (it.result) img.src = it.result.url;
    }

    function removeItem(it) {
        if (it.result) URL.revokeObjectURL(it.result.url);
        items = items.filter(x => x !== it);
        if (!items.length) {
            els.app.hidden = true;
            els.uploadZone.hidden = false;
            activeId = null;
            return;
        }
        if (activeId === it.id) activeId = items[0].id;
        setActive(activeId);
    }

    /* ──────────────── Verktøyfaner ──────────────── */
    function bindTools() {
        document.querySelectorAll('.tool').forEach(tool => {
            tool.addEventListener('toggle', () => {
                if (tool.open) {
                    document.querySelectorAll('.tool').forEach(o => { if (o !== tool) o.open = false; });
                }
                updateCropLayer();
            });
        });
    }

    function cropToolOpen() {
        const tool = document.querySelector('.tool[data-tool="crop"]');
        const step = document.querySelector('.tool-step[data-panel="edit"]');
        return tool && tool.open && step && !step.hidden;
    }

    function updateCropLayer() {
        const on = cropToolOpen();
        els.cropLayer.hidden = !on;
        els.viewerInner.classList.toggle('split-off', on);
        if (!on) { sel = null; drawCropBox(); }
    }

    /* ──────────────── Beskjering ──────────────── */
    let sel = null;                 // { x, y, w, h } i del av flata (0–1)
    let ratio = 0;                  // 0 = fritt
    let drag = null;

    function bindCropTool() {
        document.querySelectorAll('#crop-ratios [data-ratio]').forEach(btn =>
            btn.addEventListener('click', () => {
                ratio = btn.dataset.ratio === 'free' ? 0 : parseFloat(btn.dataset.ratio);
                setActiveBtn('#crop-ratios [data-ratio]', btn);
                if (sel) { sel = applyRatio(sel, sel.x, sel.y); drawCropBox(); }
            }));

        $('crop-apply').addEventListener('click', () => {
            if (!sel || sel.w < 0.02 || sel.h < 0.02) { notify('Dra eit utsnitt på biletet først.'); return; }
            const rel = { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
            applyToPicked((s) => { s.crop = composeCrop(s.crop, rel); });
            sel = null; drawCropBox();
        });
        $('crop-clear').addEventListener('click', () => {
            applyToPicked((s) => { s.crop = null; });
            sel = null; drawCropBox();
        });

        els.cropLayer.addEventListener('pointerdown', onCropDown);
        window.addEventListener('pointermove', onCropMove);
        window.addEventListener('pointerup', () => { drag = null; });
    }

    function layerRect() { return els.cropLayer.getBoundingClientRect(); }
    function pointAt(e) {
        const r = layerRect();
        return {
            x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
            y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
        };
    }

    function onCropDown(e) {
        const handle = e.target.closest('[data-handle]');
        const p = pointAt(e);
        e.preventDefault();
        if (handle) {
            drag = { mode: 'resize', corner: handle.dataset.handle, start: sel };
        } else if (e.target === els.cropBox && sel) {
            drag = { mode: 'move', grab: { x: p.x - sel.x, y: p.y - sel.y } };
        } else {
            drag = { mode: 'new', origin: p };
            sel = { x: p.x, y: p.y, w: 0, h: 0 };
            drawCropBox();
        }
    }

    function onCropMove(e) {
        if (!drag) return;
        const p = pointAt(e);
        if (drag.mode === 'new') {
            sel = applyRatio(rectFrom(drag.origin, p), drag.origin.x, drag.origin.y);
        } else if (drag.mode === 'move' && sel) {
            sel.x = Math.min(1 - sel.w, Math.max(0, p.x - drag.grab.x));
            sel.y = Math.min(1 - sel.h, Math.max(0, p.y - drag.grab.y));
        } else if (drag.mode === 'resize' && sel) {
            const fixed = {
                x: drag.corner.includes('w') ? sel.x + sel.w : sel.x,
                y: drag.corner.includes('n') ? sel.y + sel.h : sel.y
            };
            sel = applyRatio(rectFrom(fixed, p), fixed.x, fixed.y);
        }
        drawCropBox();
    }

    function rectFrom(a, b) {
        return {
            x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
            w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y)
        };
    }

    /* Held fast forholdet, og passar på at utsnittet held seg innanfor biletet.
       ankerX/ankerY er hjørnet brukaren ikkje dreg i. */
    function applyRatio(r, ankerX, ankerY) {
        if (!ratio) return r;
        const box = layerRect();
        const aspect = ratio * (box.height / box.width);   // frå biletformat til del av flata
        let w = r.w, h = r.w / aspect;
        if (h < r.h) { h = r.h; w = r.h * aspect; }
        const left = r.x < ankerX;
        const up = r.y < ankerY;
        let x = left ? ankerX - w : ankerX;
        let y = up ? ankerY - h : ankerY;
        if (x < 0) { w += x; h = w / aspect; x = 0; }
        if (y < 0) { h += y; w = h * aspect; y = 0; }
        if (x + w > 1) { w = 1 - x; h = w / aspect; }
        if (y + h > 1) { h = 1 - y; w = h * aspect; }
        return { x, y, w, h };
    }

    function drawCropBox() {
        if (!sel || sel.w <= 0 || sel.h <= 0) {
            els.cropBox.style.display = 'none';
            return;
        }
        els.cropBox.style.display = 'block';
        els.cropBox.style.left = (sel.x * 100) + '%';
        els.cropBox.style.top = (sel.y * 100) + '%';
        els.cropBox.style.width = (sel.w * 100) + '%';
        els.cropBox.style.height = (sel.h * 100) + '%';
    }

    function composeCrop(prev, rel) {
        if (!prev) return rel;
        return {
            x: prev.x + rel.x * prev.w, y: prev.y + rel.y * prev.h,
            w: prev.w * rel.w, h: prev.h * rel.h
        };
    }

    /* ──────────────── Roter og spegle ──────────────── */
    function bindGeometry() {
        document.querySelectorAll('[data-rotate]').forEach(btn =>
            btn.addEventListener('click', () => {
                const d = parseInt(btn.dataset.rotate, 10);
                applyToPicked((s) => {
                    s.rotation = (((s.rotation + d) % 360) + 360) % 360;
                    s.crop = rotateCrop(s.crop, d);
                });
            }));
        document.querySelectorAll('[data-flip]').forEach(btn =>
            btn.addEventListener('click', () => {
                const h = btn.dataset.flip === 'h';
                applyToPicked((s) => {
                    if (h) { s.flipH = !s.flipH; } else { s.flipV = !s.flipV; }
                    s.crop = flipCrop(s.crop, h);
                });
            }));
        $('btn-reset-one').addEventListener('click', () => {
            const it = active(); if (!it) return;
            it.s = defaults(); it.dirty = true; it.svg = null;
            syncPanel(); afterChange(); renderPreview(); updateMeta();
        });
        $('btn-reset-all').addEventListener('click', () => {
            items.forEach(it => { it.s = defaults(); it.dirty = true; it.svg = null; });
            syncPanel(); afterChange(); renderPreview(); updateMeta();
        });
        $('btn-clear').addEventListener('click', () => {
            if (!items.length || confirm('Vil du fjerne alle bileta?')) {
                items.forEach(it => it.result && URL.revokeObjectURL(it.result.url));
                items = []; activeId = null;
                els.app.hidden = true; els.uploadZone.hidden = false;
                renderStrip();
            }
        });
    }

    /* Utsnittet er lagra som del av flata, så det må snu saman med biletet. */
    function rotateCrop(c, deg) {
        if (!c) return null;
        const cw = ((deg % 360) + 360) % 360 === 90;
        return cw
            ? { x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w }
            : { x: c.y, y: 1 - c.x - c.w, w: c.h, h: c.w };
    }
    function flipCrop(c, horizontal) {
        if (!c) return null;
        return horizontal
            ? { x: 1 - c.x - c.w, y: c.y, w: c.w, h: c.h }
            : { x: c.x, y: 1 - c.y - c.h, w: c.w, h: c.h };
    }

    /* ──────────────── Storleik ──────────────── */
    function bindSize() {
        document.querySelectorAll('[data-resize-px]').forEach(btn =>
            btn.addEventListener('click', () => {
                setActiveBtn('[data-resize-px],[data-resize-pct]', btn);
                els.resizeW.value = ''; els.resizeH.value = '';
                applyToPicked((s) => { s.resize = { kind: 'long', value: parseInt(btn.dataset.resizePx, 10) }; });
            }));
        document.querySelectorAll('[data-resize-pct]').forEach(btn =>
            btn.addEventListener('click', () => {
                setActiveBtn('[data-resize-px],[data-resize-pct]', btn);
                els.resizeW.value = ''; els.resizeH.value = '';
                applyToPicked((s) => { s.resize = { kind: 'pct', value: parseInt(btn.dataset.resizePct, 10) }; });
            }));
        const onDim = () => {
            setActiveBtn('[data-resize-px],[data-resize-pct]', null);
            const w = parseInt(els.resizeW.value, 10) || 0;
            const h = parseInt(els.resizeH.value, 10) || 0;
            const lock = els.lockAspect.checked;
            applyToPicked((s) => { s.resize = { kind: 'exact', w, h, lock }; });
        };
        els.resizeW.addEventListener('input', onDim);
        els.resizeH.addEventListener('input', onDim);
        els.lockAspect.addEventListener('change', onDim);
    }

    /* ──────────────── Fargar ──────────────── */
    function bindColors() {
        els.poOn.addEventListener('change', () => {
            els.poFields.hidden = !els.poOn.checked;
            applyToPicked((s) => { s.colors.on = els.poOn.checked; });
        });
        document.querySelectorAll('#po-mode [data-mode]').forEach(btn =>
            btn.addEventListener('click', () => {
                setActiveBtn('#po-mode [data-mode]', btn);
                applyToPicked((s) => { s.colors.mode = btn.dataset.mode; });
            }));
        slider(els.poLevels, els.poLevelsVal, (v) => applyToPicked((s) => { s.colors.levels = v; }));
        slider(els.poBright, els.poBrightVal, (v) => applyToPicked((s) => { s.colors.brightness = v; }));
        slider(els.poContrast, els.poContrastVal, (v) => applyToPicked((s) => { s.colors.contrast = v; }));
        slider(els.svgDetail, els.svgDetailVal, () => { items.forEach(it => it.svg = null); scheduleSvg(); });
        $('btn-svg').addEventListener('click', downloadSvg);
    }

    /* ──────────────── Vassmerke ──────────────── */
    function bindWatermark() {
        els.wmText.addEventListener('input', () =>
            applyToPicked((s) => { s.wm.text = els.wmText.value; }));
        els.wmGrid.querySelectorAll('.pos-btn').forEach(btn =>
            btn.addEventListener('click', () => {
                setActiveBtn('.pos-btn', btn);
                applyToPicked((s) => { s.wm.position = btn.dataset.pos; });
            }));
        slider(els.wmSize, els.wmSizeVal, (v) => applyToPicked((s) => { s.wm.size = v; }));
        slider(els.wmOpacity, els.wmOpacityVal, (v) => applyToPicked((s) => { s.wm.opacity = v; }));
        els.wmColor.addEventListener('input', () =>
            applyToPicked((s) => { s.wm.color = els.wmColor.value; }));
        slider(els.wmLogoScale, els.wmLogoScaleVal, (v) => applyToPicked((s) => { s.wm.logoScale = v; }));

        $('wm-logo-btn').addEventListener('click', () => els.logoInput.click());
        els.logoInput.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                logo = await Processor.loadImage(e.target.files[0]);
                els.wmLogoName.textContent = e.target.files[0].name;
                els.wmLogoChip.hidden = false;
                els.wmLogoScale.hidden = false; els.wmLogoScaleRow.hidden = false;
                items.forEach(it => { it.dirty = true; it.svg = null; });
                afterChange();
            }
            e.target.value = '';
        });
        $('wm-logo-clear').addEventListener('click', () => {
            logo = null;
            els.wmLogoChip.hidden = true;
            els.wmLogoScale.hidden = true; els.wmLogoScaleRow.hidden = true;
            items.forEach(it => { it.dirty = true; it.svg = null; });
            afterChange();
        });
    }

    /* ──────────────── Lagre-innstillingar ──────────────── */
    function bindSave() {
        els.format.addEventListener('change', () => {
            const png = els.format.value === 'png';
            els.qualityRow.style.opacity = png ? 0.4 : 1;
            els.quality.disabled = png;
            applyToPicked((s) => { s.out.format = els.format.value; });
            updateNameExample();
        });
        slider(els.quality, els.qualityVal, (v) => applyToPicked((s) => { s.out.quality = v; }));
        els.targetOn.addEventListener('change', () => {
            els.targetRow.hidden = !els.targetOn.checked;
            applyToPicked((s) => {
                s.out.targetKb = els.targetOn.checked ? Math.max(10, parseInt(els.targetKb.value, 10) || 200) : null;
            });
        });
        els.targetKb.addEventListener('input', () => {
            if (!els.targetOn.checked) return;
            applyToPicked((s) => { s.out.targetKb = Math.max(10, parseInt(els.targetKb.value, 10) || 200); });
        });
        els.namePattern.addEventListener('input', () => {
            namePattern = els.namePattern.value;
            updateNameExample();
        });
        document.querySelectorAll('#name-tokens [data-token]').forEach(btn =>
            btn.addEventListener('click', () => {
                const now = els.namePattern.value.trim();
                // Set inn ein bindestrek mellom sjablonane, elles blir
                // «{namn}{dato}» til «klasse-012026-08-20».
                const join = now && !/[-_ ]$/.test(now) ? '-' : '';
                els.namePattern.value = now + join + btn.dataset.token;
                namePattern = els.namePattern.value;
                updateNameExample();
            }));
    }

    function updateNameExample() {
        const it = active();
        if (!it) { els.nameExample.textContent = ''; return; }
        els.nameExample.textContent = 'Døme: ' + fileBase(it, 0) + '.' + Processor.ext(it.s.out.format);
    }

    /* ──────────────── Panelet speglar det aktive biletet ──────────────── */
    function syncPanel() {
        const it = active(); if (!it) return;
        const s = it.s;

        setActiveBtn('[data-resize-px],[data-resize-pct]', null);
        els.resizeW.value = ''; els.resizeH.value = '';
        if (s.resize.kind === 'long') {
            setActiveBtn('[data-resize-px],[data-resize-pct]', document.querySelector(`[data-resize-px="${s.resize.value}"]`));
        } else if (s.resize.kind === 'pct') {
            setActiveBtn('[data-resize-px],[data-resize-pct]', document.querySelector(`[data-resize-pct="${s.resize.value}"]`));
        } else {
            els.resizeW.value = s.resize.w || '';
            els.resizeH.value = s.resize.h || '';
            els.lockAspect.checked = s.resize.lock !== false;
        }

        els.poOn.checked = s.colors.on;
        els.poFields.hidden = !s.colors.on;
        setActiveBtn('#po-mode [data-mode]', document.querySelector(`#po-mode [data-mode="${s.colors.mode}"]`));
        setSlider(els.poLevels, els.poLevelsVal, s.colors.levels);
        setSlider(els.poBright, els.poBrightVal, s.colors.brightness);
        setSlider(els.poContrast, els.poContrastVal, s.colors.contrast);

        els.wmText.value = s.wm.text;
        setActiveBtn('.pos-btn', els.wmGrid.querySelector(`[data-pos="${s.wm.position}"]`));
        setSlider(els.wmSize, els.wmSizeVal, s.wm.size);
        setSlider(els.wmOpacity, els.wmOpacityVal, s.wm.opacity);
        els.wmColor.value = s.wm.color;
        setSlider(els.wmLogoScale, els.wmLogoScaleVal, s.wm.logoScale);

        els.format.value = s.out.format;
        const png = s.out.format === 'png';
        els.qualityRow.style.opacity = png ? 0.4 : 1;
        els.quality.disabled = png;
        setSlider(els.quality, els.qualityVal, s.out.quality);
        els.targetOn.checked = s.out.targetKb != null;
        els.targetRow.hidden = s.out.targetKb == null;
        if (s.out.targetKb != null) els.targetKb.value = s.out.targetKb;

        updateNameExample();
        updateMixedNotes();
    }

    /* «Ulike verdiar» — når dei avhuka bileta ikkje er samde. */
    const TOOL_KEYS = {
        crop: (s) => [s.rotation, s.flipH, s.flipV, s.crop],
        size: (s) => s.resize,
        colors: (s) => s.colors,
        watermark: (s) => s.wm,
        save: (s) => s.out
    };

    function updateMixedNotes() {
        const list = picked();
        Object.keys(TOOL_KEYS).forEach(key => {
            const host = key === 'save'
                ? document.querySelector('.tool-step[data-panel="save"]')
                : document.querySelector(`.tool[data-tool="${key}"] .tool-body`);
            if (!host) return;
            let note = host.querySelector('.mixed-note');
            const differs = list.length > 1 &&
                new Set(list.map(it => JSON.stringify(TOOL_KEYS[key](it.s)))).size > 1;
            if (differs && !note) {
                note = document.createElement('p');
                note.className = 'hint warn mixed-note';
                note.textContent = 'Dei avhuka bileta har ulike verdiar her. Rører du ein kontroll, får alle same verdi.';
                host.insertBefore(note, host.firstChild);
            } else if (!differs && note) {
                note.remove();
            }
        });
    }

    /* ──────────────── Rekne ut mål ──────────────── */
    function naturalDims(item) {
        const s = item.s;
        const swap = s.rotation === 90 || s.rotation === 270;
        const ow = swap ? item.source.height : item.source.width;
        const oh = swap ? item.source.width : item.source.height;
        return {
            width: Math.max(1, Math.round(ow * (s.crop ? s.crop.w : 1))),
            height: Math.max(1, Math.round(oh * (s.crop ? s.crop.h : 1)))
        };
    }

    function dimsFor(item) {
        const s = item.s;
        const nat = naturalDims(item);
        const w0 = nat.width, h0 = nat.height;
        const m = s.resize;
        if (m.kind === 'pct') {
            return m.value === 100 ? nat : { width: Math.round(w0 * m.value / 100), height: Math.round(h0 * m.value / 100) };
        }
        if (m.kind === 'long') {
            const r = m.value / Math.max(w0, h0);
            return r >= 1 ? nat : { width: Math.round(w0 * r), height: Math.round(h0 * r) };
        }
        if (m.kind === 'exact') {
            const w = m.w || 0, h = m.h || 0, lock = m.lock !== false;
            const aspect = w0 / h0;
            if (w && h) return lock ? scaleToBox(w0, h0, w, h) : { width: w, height: h };
            if (w) return { width: w, height: lock ? Math.round(w / aspect) : h0 };
            if (h) return { width: lock ? Math.round(h * aspect) : w0, height: h };
        }
        return nat;
    }
    function scaleToBox(w0, h0, boxW, boxH) {
        const r = Math.min(boxW / w0, boxH / h0);
        return { width: Math.max(1, Math.round(w0 * r)), height: Math.max(1, Math.round(h0 * r)) };
    }

    function specFor(item, preview) {
        const s = item.s;
        const d = dimsFor(item);
        let width = d.width, height = d.height, scale = 1;
        if (preview) {
            const long = Math.max(width, height);
            if (long > PREVIEW_MAX) {
                scale = PREVIEW_MAX / long;
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));
            }
        }
        const hasWm = s.wm.text.trim() || logo;
        return {
            rotation: s.rotation, flipH: s.flipH, flipV: s.flipV, crop: s.crop,
            width, height,
            colors: s.colors.on ? s.colors : null,
            watermark: hasWm ? Object.assign({}, s.wm, { text: s.wm.text.trim(), logo, scale }) : null,
            format: s.out.format, quality: s.out.quality, targetKb: s.out.targetKb
        };
    }

    /* ──────────────── Førehandsvising ──────────────── */
    function schedulePreview() {
        clearTimeout(previewTimer);
        previewTimer = setTimeout(renderPreview, 60);
    }

    function renderPreview() {
        const it = active(); if (!it) return;
        const spec = specFor(it, true);

        // «Før» er same utsnitt og storleik, men utan fargar og vassmerke,
        // så dei to bileta ligg nøyaktig oppå kvarandre.
        const key = [it.id, spec.rotation, spec.flipH, spec.flipV, JSON.stringify(spec.crop), spec.width, spec.height].join('|');
        if (!beforeCache || beforeCache.key !== key) {
            const bare = Object.assign({}, spec, { colors: null, watermark: null });
            beforeCache = { key, canvas: Processor.render(it, bare).canvas };
        }
        paint(els.before, beforeCache.canvas);

        const out = Processor.render(it, spec);
        paint(els.after, out.canvas);

        fitViewer(beforeCache.canvas.width, beforeCache.canvas.height);
        setSplit(splitPct);
        drawCropBox();
    }

    function paint(target, source) {
        target.width = source.width;
        target.height = source.height;
        target.getContext('2d').drawImage(source, 0, 0);
    }

    /* Vi reknar visingsbreidda sjølve. Overlet vi det til CSS, kan «etter»
       (som ligg oppå med 100 % breidd) hamne på ein annan storleik enn
       «før» når biletet er avgrensa av høgda i staden for breidda. */
    let viewerAspect = 1;
    function fitViewer(w, h) {
        viewerAspect = w / h;
        const box = $('viewer').clientWidth - 24;
        const maxH = Math.max(240, window.innerHeight * 0.62);
        const k = Math.min(1, box / w, maxH / h);
        els.viewerInner.style.width = Math.max(80, Math.round(w * k)) + 'px';
    }
    window.addEventListener('resize', () => {
        if (!active()) return;
        const w = els.before.width, h = els.before.height;
        if (w && h) fitViewer(w, h);
    });

    let splitPct = 50;
    function setSplit(pct) {
        splitPct = Math.min(100, Math.max(0, pct));
        els.after.style.clipPath = `inset(0 0 0 ${splitPct}%)`;
        els.split.style.left = `calc(${splitPct}% - 1px)`;
    }
    function bindSplit() {
        let dragging = false;
        els.split.addEventListener('pointerdown', (e) => { dragging = true; e.preventDefault(); });
        window.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const r = els.viewerInner.getBoundingClientRect();
            setSplit(((e.clientX - r.left) / r.width) * 100);
        });
        window.addEventListener('pointerup', () => { dragging = false; });
        els.split.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            setSplit(splitPct + (e.key === 'ArrowLeft' ? -5 : 5));
        });
    }

    function updateMeta() {
        const it = active();
        if (!it) { els.metaDims.textContent = ''; els.metaSize.textContent = ''; return; }
        const d = dimsFor(it);
        const swap = it.s.rotation === 90 || it.s.rotation === 270;
        const ow = swap ? it.source.height : it.source.width;
        const oh = swap ? it.source.width : it.source.height;
        els.metaDims.textContent = `${ow} × ${oh} → ${d.width} × ${d.height} px`;
        if (it.result) {
            const pct = it.origBytes ? Math.round((1 - it.result.blob.size / it.origBytes) * 100) : 0;
            els.metaSize.textContent = `${formatSize(it.origBytes)} → ${formatSize(it.result.blob.size)}`
                + (pct > 0 ? ` · spart ${pct} %` : '');
        } else {
            els.metaSize.textContent = 'Reknar ut filstorleik …';
        }
    }

    /* ──────────────── Full oppløysing (filstorleik) ──────────────── */
    function scheduleMeasure() {
        clearTimeout(measureTimer);
        measureTimer = setTimeout(runMeasure, 700);
    }

    async function runMeasure() {
        const token = ++measureToken;
        for (const it of items) {
            if (token !== measureToken) return;
            if (!it.dirty && it.result) continue;
            try {
                const res = await Processor.process(it, specFor(it, false));
                if (token !== measureToken) return;
                if (it.result) URL.revokeObjectURL(it.result.url);
                it.result = { blob: res.blob, url: URL.createObjectURL(res.blob), width: res.width, height: res.height };
                it.dirty = false;
                updateThumb(it);
                if (it.id === activeId) updateMeta();
            } catch (err) {
                console.error('Prosesseringsfeil', it.name, err);
            }
            await new Promise(r => setTimeout(r, 0));   // slepp UI-en til
        }
    }

    async function ensureResult(it) {
        if (it.result && !it.dirty) return it.result;
        const res = await Processor.process(it, specFor(it, false));
        if (it.result) URL.revokeObjectURL(it.result.url);
        it.result = { blob: res.blob, url: URL.createObjectURL(res.blob), width: res.width, height: res.height };
        it.dirty = false;
        updateThumb(it);
        return it.result;
    }

    /* ──────────────── SVG ──────────────── */
    function scheduleSvg() {
        clearTimeout(svgTimer);
        svgTimer = setTimeout(runSvg, 900);
    }

    function svgFor(it) {
        // Vassmerket skal ikkje bli til vektorformer, så vi teiknar utan.
        const spec = Object.assign({}, specFor(it, true), { watermark: null });
        const full = dimsFor(it);
        const { canvas } = Processor.render(it, spec);
        return Vectorize.toSvg(canvas, {
            level: parseInt(els.svgDetail.value, 10),
            outW: full.width, outH: full.height
        });
    }

    function runSvg() {
        const it = active();
        if (!it || !it.s.colors.on) { els.svgInfo.textContent = ''; return; }
        const token = ++svgToken;
        els.svgInfo.textContent = 'Reknar ut …';
        // Eit steg ut i køen, så panelet rekk å teikne seg før vi bind opp tråden.
        setTimeout(() => {
            if (token !== svgToken) return;
            try {
                it.svg = svgFor(it);
                els.svgInfo.textContent = `${it.svg.shapes} former · om lag ${formatSize(it.svg.bytes)}`;
            } catch (err) {
                it.svg = null;
                els.svgInfo.textContent = err.message;
            }
        }, 0);
    }

    async function downloadSvg() {
        const list = picked().filter(it => it.s.colors.on);
        if (!list.length) { notify('Slå på reinskoring først — SVG av eit uendra foto gjev ikkje meining.'); return; }
        try {
            if (list.length === 1) {
                const it = list[0];
                const out = it.svg || svgFor(it);
                saveBlob(new Blob([out.svg], { type: 'image/svg+xml;charset=utf-8' }), fileBase(it, 0) + '.svg');
                return;
            }
            notify(`Lagar ${list.length} SVG-filer …`);
            const zip = new JSZip();
            const used = {};
            for (const it of list) {
                const out = svgFor(it);
                let name = fileBase(it, items.indexOf(it)) + '.svg';
                if (used[name]) name = fileBase(it, items.indexOf(it)) + '_' + (++used[name]) + '.svg';
                else used[name] = 1;
                zip.file(name, out.svg);
                await new Promise(r => setTimeout(r, 0));
            }
            saveBlob(await zip.generateAsync({ type: 'blob' }), 'bilete-svg.zip');
        } catch (err) {
            notify(err.message);
        }
    }

    /* ──────────────── Nedlasting ──────────────── */
    function bindDownloads() {
        $('btn-download-one').addEventListener('click', async () => {
            const it = active(); if (!it) return;
            const res = await ensureResult(it);
            saveBlob(res.blob, fileBase(it, items.indexOf(it)) + '.' + Processor.ext(it.s.out.format));
        });
        $('btn-download-all').addEventListener('click', downloadAll);
    }

    async function downloadAll() {
        if (!items.length) return;
        if (items.length === 1) {
            const it = items[0];
            const res = await ensureResult(it);
            saveBlob(res.blob, fileBase(it, 0) + '.' + Processor.ext(it.s.out.format));
            return;
        }
        notify(`Gjer klar ${items.length} bilete …`);
        const zip = new JSZip();
        const used = {};
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const res = await ensureResult(it);
            let name = fileBase(it, i) + '.' + Processor.ext(it.s.out.format);
            if (used[name]) name = fileBase(it, i) + '_' + (++used[name]) + '.' + Processor.ext(it.s.out.format);
            else used[name] = 1;
            zip.file(name, res.blob);
        }
        saveBlob(await zip.generateAsync({ type: 'blob' }), 'bilete.zip');
    }

    function fileBase(it, index) {
        const orig = it.name.replace(/\.[^/.]+$/, '');
        const today = new Date().toISOString().slice(0, 10);
        const pattern = (namePattern || '').trim() || '{namn}';
        return pattern
            .replace(/\{namn\}/g, orig)
            .replace(/\{n\}/g, String(index + 1).padStart(3, '0'))
            .replace(/\{dato\}/g, today) || orig;
    }

    function saveBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        a.click();
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
    function slider(input, label, cb) {
        input.addEventListener('input', () => {
            label.textContent = input.value;
            cb(parseInt(input.value, 10));
        });
    }
    function setSlider(input, label, value) {
        input.value = value;
        label.textContent = value;
    }
    function setActiveBtn(selector, el) {
        document.querySelectorAll(selector).forEach(b => b.classList.toggle('active', b === el));
    }

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

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }
})();
