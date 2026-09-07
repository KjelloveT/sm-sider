/* ══════════════════════════════════════════════
   UI.JS — Skjemaet, panela og limet

   All tilstand ligg i `state`. Kontrollane skriv inn i han og ber om ei
   ny teikning; ingen kontroll teiknar noko sjølv, og ingen kontroll les
   noko frå ein annan kontroll. Det er difor ein mal, ei lagra fil og eit
   klikk på ein skyvar alle kjem fram til det same biletet.
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const U = VR.util;

  const state = {
    name: '',
    content: { type: 'url', values: {} },
    design: VR.design.defaults(),
    logoAsset: null,
    qr: null,
    scene: null,
    text: ''
  };

  let els = {};
  let pendingSave = null;

  /* ──────────────── Meldingar ──────────────── */

  let toastTimer = 0;
  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3600);
  }

  /* ──────────────── Innhaldsskjemaet ──────────────── */

  function buildTypeGrid() {
    U.clear(els.typeGrid);
    VR.content.TYPES.forEach((type) => {
      const btn = U.el('button', 'vr-type');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.dataset.type = type.id;
      const icon = U.el('span', 'vr-type-icon');
      icon.innerHTML = ICON(type.icon, 22);
      btn.appendChild(icon);
      btn.appendChild(U.el('span', 'vr-type-label', type.label));
      btn.addEventListener('click', () => selectType(type.id));
      els.typeGrid.appendChild(btn);
    });
  }

  function selectType(id) {
    if (state.content.type !== id) {
      state.content = { type: id, values: {} };
    }
    buildFields();
    update();
  }

  function buildFields() {
    const type = VR.content.byId(state.content.type);

    els.typeGrid.querySelectorAll('.vr-type').forEach((b) => {
      const on = b.dataset.type === type.id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    els.typeHint.textContent = type.hint || '';

    U.clear(els.fields);
    type.fields.forEach((field) => {
      const wrap = U.el('div', 'vr-field' + (field.wide ? ' vr-field-wide' : ''));
      const inputId = 'f-' + type.id + '-' + field.name;

      if (field.type === 'checkbox') {
        const label = U.el('label', 'vr-check');
        const box = U.el('input');
        box.type = 'checkbox';
        box.id = inputId;
        box.checked = !!state.content.values[field.name];
        box.addEventListener('change', () => {
          state.content.values[field.name] = box.checked;
          update();
        });
        label.appendChild(box);
        label.appendChild(document.createTextNode(' ' + field.label));
        wrap.appendChild(label);
        els.fields.appendChild(wrap);
        return;
      }

      const label = U.el('label', 'vr-setting-label', field.label);
      label.htmlFor = inputId;
      wrap.appendChild(label);

      let input;
      if (field.type === 'textarea') {
        input = U.el('textarea', 'vr-textarea');
        input.rows = 3;
      } else if (field.type === 'select') {
        input = U.el('select', 'vr-select');
        field.options.forEach((opt) => {
          const o = U.el('option', null, opt.label);
          o.value = opt.value;
          input.appendChild(o);
        });
      } else {
        input = U.el('input', 'vr-text-input');
        input.type = field.type;
      }
      input.id = inputId;
      if (field.placeholder) input.placeholder = field.placeholder;

      const stored = state.content.values[field.name];
      if (stored != null) input.value = stored;
      else if (field.type === 'select') state.content.values[field.name] = input.value;

      const onInput = () => {
        state.content.values[field.name] = input.value;
        update();
      };
      input.addEventListener('input', onInput);
      input.addEventListener('change', onInput);

      wrap.appendChild(input);
      els.fields.appendChild(wrap);
    });
  }

  /* ──────────────── Designkontrollane ──────────────── */

  function chips(container, items, current, onPick) {
    U.clear(container);
    items.forEach((item) => {
      const btn = U.el('button', 'vr-chip' + (item.id === current ? ' active' : ''), item.label);
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', item.id === current ? 'true' : 'false');
      btn.addEventListener('click', () => { onPick(item.id); });
      container.appendChild(btn);
    });
  }

  function buildPresets() {
    U.clear(els.presets);
    VR.design.PRESETS.forEach((preset) => {
      const btn = U.el('button', 'vr-preset');
      btn.type = 'button';
      btn.title = preset.label;
      const p = preset.patch;
      const ink = (p.fill && p.fill.color) || '#1a1a1a';
      const bg = (p.bg && p.bg.color) || '#ffffff';
      const dot = U.el('span', 'vr-preset-dot');
      dot.style.background = bg;
      dot.style.borderColor = ink;
      const inner = U.el('span', 'vr-preset-ink');
      inner.style.background = (p.fill && p.fill.type === 'linear')
        ? 'linear-gradient(45deg,' + p.fill.color + ',' + p.fill.color2 + ')'
        : ink;
      dot.appendChild(inner);
      btn.appendChild(dot);
      btn.appendChild(U.el('span', 'vr-preset-name', preset.label));
      btn.addEventListener('click', () => {
        state.design = VR.design.applyPreset(state.design, preset);
        syncControls();
        update();
      });
      els.presets.appendChild(btn);
    });
  }

  function buildMyTemplates() {
    U.clear(els.myTemplates);
    const mine = VR.storage.templates();
    mine.forEach((tpl) => {
      const btn = U.el('button', 'vr-preset');
      btn.type = 'button';
      const dot = U.el('span', 'vr-preset-dot');
      dot.style.background = tpl.design.bg.color;
      dot.style.borderColor = tpl.design.fill.color;
      const inner = U.el('span', 'vr-preset-ink');
      inner.style.background = tpl.design.fill.color;
      dot.appendChild(inner);
      btn.appendChild(dot);
      btn.appendChild(U.el('span', 'vr-preset-name', tpl.name));
      btn.addEventListener('click', () => {
        const logo = state.design.logo;
        state.design = VR.design.normalise(tpl.design);
        state.design.logo = logo;
        syncControls();
        update();
      });

      const del = U.el('button', 'vr-preset-del');
      del.type = 'button';
      del.innerHTML = ICON('x', 14);
      del.setAttribute('aria-label', 'Slett stilen ' + tpl.name);
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        VR.storage.removeTemplate(tpl.id);
        buildMyTemplates();
      });

      const cell = U.el('span', 'vr-preset-cell');
      cell.appendChild(btn);
      cell.appendChild(del);
      els.myTemplates.appendChild(cell);
    });
  }

  /* Fargeknappane er alle like: ein rute som viser fargen, og ein
     veljar som skriv tilbake i oppsettet. */
  function bindSwatch(button, valueEl, get, set) {
    function paint() {
      button.style.background = get();
      if (valueEl) valueEl.textContent = get();
    }
    button.addEventListener('click', () => {
      VR.color.open(button, get(), (hex) => {
        set(hex);
        paint();
        update();
      });
    });
    return paint;
  }

  const painters = [];

  function buildControls() {
    const d = state.design;

    /* Brikkene blir bygde av syncControls(); her fyller vi berre dei
       kontrollane som ikkje skal byggjast på nytt for kvar endring. */
    VR.render.FRAME_STYLES.forEach((f) => {
      const o = U.el('option', null, f.label);
      o.value = f.id;
      els.frameStyle.appendChild(o);
    });

    VR.content.TYPES.forEach((t) => {
      const o = U.el('option', null, t.label);
      o.value = t.id;
      els.batchType.appendChild(o);
    });
    els.batchType.value = 'url';

    range(els.radius, els.radiusOut, () => d.module.radius, (v) => { d.module.radius = v; },
      (v) => Math.round(v * 100) + ' %');
    range(els.gap, els.gapOut, () => d.module.gap, (v) => { d.module.gap = v; },
      (v) => Math.round(v * 100) + ' %');
    range(els.angle, els.angleOut, () => d.fill.angle, (v) => { d.fill.angle = v; },
      (v) => Math.round(v) + '°');
    range(els.quiet, els.quietOut, () => d.quiet, (v) => { d.quiet = v; },
      (v) => Math.round(v) + ' modular');
    range(els.logoSize, els.logoSizeOut, () => d.logo.size, (v) => { d.logo.size = v; },
      (v) => Math.round(v * 100) + ' %');
    range(els.platePad, els.platePadOut, () => d.logo.platePad, (v) => { d.logo.platePad = v; },
      (v) => Math.round(v * 100) + ' %');
    range(els.logoWeight, els.logoWeightOut, () => d.logo.weight, (v) => { d.logo.weight = v; },
      (v) => v.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''));

    select(els.alignStyle, () => d.alignment.style, (v) => { d.alignment.style = v; });
    select(els.fillType, () => d.fill.type, (v) => { d.fill.type = v; });
    select(els.fillTarget, () => d.fill.target, (v) => { d.fill.target = v; });
    select(els.frameStyle, () => d.frame.style, (v) => { d.frame.style = v; });
    select(els.framePos, () => d.frame.textPos, (v) => { d.frame.textPos = v; });
    select(els.ecc, () => d.ecc, (v) => { d.ecc = v; });
    select(els.logoPlate, () => d.logo.plate, (v) => { d.logo.plate = v; });

    check(els.eyeSame, () => d.eye.sameColor, (v) => { d.eye.sameColor = v; });
    check(els.bgTransparent, () => d.bg.transparent, (v) => { d.bg.transparent = v; });
    check(els.excavate, () => d.logo.excavate, (v) => { d.logo.excavate = v; });

    els.frameText.addEventListener('input', () => {
      d.frame.text = els.frameText.value;
      update();
    });

    painters.push(bindSwatch(els.inkSwatch, els.inkValue, () => d.fill.color, (v) => { d.fill.color = v; }));
    painters.push(bindSwatch(els.ink2Swatch, els.ink2Value, () => d.fill.color2, (v) => { d.fill.color2 = v; }));
    painters.push(bindSwatch(els.eyeSwatch, els.eyeValue, () => d.eye.color, (v) => { d.eye.color = v; }));
    painters.push(bindSwatch(els.bgSwatch, els.bgValue, () => d.bg.color, (v) => { d.bg.color = v; }));
    painters.push(bindSwatch(els.frameSwatch, els.frameValue, () => d.frame.color, (v) => { d.frame.color = v; }));
    painters.push(bindSwatch(els.plateSwatch, els.plateValue, () => d.logo.plateColor, (v) => { d.logo.plateColor = v; }));
    painters.push(bindSwatch(els.logoColorSwatch, els.logoColorValue, () => d.logo.color, (v) => { d.logo.color = v; }));
  }

  function range(input, out, get, set, fmt) {
    input.addEventListener('input', () => {
      set(parseFloat(input.value));
      if (out) out.textContent = fmt(parseFloat(input.value));
      update();
    });
  }

  function select(input, get, set) {
    input.addEventListener('change', () => {
      set(input.value);
      syncControls();
      update();
    });
  }

  function check(input, get, set) {
    input.addEventListener('change', () => {
      set(input.checked);
      syncControls();
      update();
    });
  }

  /* Set alle kontrollane til det oppsettet faktisk seier. Blir kalla
     etter ein mal, ein import eller eit lagra oppsett — alt som endrar
     oppsettet utan å gå gjennom kontrollane. */
  function syncControls() {
    const d = state.design;

    chips(els.moduleShapes, VR.shapes.MODULE_SHAPES, d.module.shape, (id) => {
      d.module.shape = id; syncControls(); update();
    });
    chips(els.eyeFrames, VR.shapes.EYE_FRAMES, d.eye.frame, (id) => {
      d.eye.frame = id; syncControls(); update();
    });
    chips(els.eyePupils, VR.shapes.EYE_PUPILS, d.eye.pupil, (id) => {
      d.eye.pupil = id; syncControls(); update();
    });

    els.radius.value = d.module.radius;
    els.radiusOut.textContent = Math.round(d.module.radius * 100) + ' %';
    els.gap.value = d.module.gap;
    els.gapOut.textContent = Math.round(d.module.gap * 100) + ' %';
    els.angle.value = d.fill.angle;
    els.angleOut.textContent = Math.round(d.fill.angle) + '°';
    els.quiet.value = d.quiet;
    els.quietOut.textContent = d.quiet + ' modular';
    els.logoSize.value = d.logo.size;
    els.logoSizeOut.textContent = Math.round(d.logo.size * 100) + ' %';
    els.platePad.value = d.logo.platePad;
    els.platePadOut.textContent = Math.round(d.logo.platePad * 100) + ' %';
    els.logoWeight.value = d.logo.weight;
    els.logoWeightOut.textContent = String(d.logo.weight);

    els.alignStyle.value = d.alignment.style;
    els.fillType.value = d.fill.type;
    els.fillTarget.value = d.fill.target;
    els.frameStyle.value = d.frame.style;
    els.framePos.value = d.frame.textPos;
    els.frameText.value = d.frame.text;
    els.ecc.value = d.ecc;
    els.logoSource.value = d.logo.source;
    els.logoPlate.value = d.logo.plate;

    els.eyeSame.checked = d.eye.sameColor;
    els.bgTransparent.checked = d.bg.transparent;
    els.excavate.checked = d.logo.excavate;

    painters.forEach(fn => fn());

    /* Kontrollar som berre gjev meining i somme oppsett skal vere borte,
       ikkje grå. Ein grå kontroll ser ut som noko som er i ustand. */
    const gradient = d.fill.type !== 'solid';
    els.ink2Row.hidden = !gradient;
    els.angleRow.hidden = d.fill.type !== 'linear';
    els.targetRow.hidden = !gradient;
    els.eyeColorRow.hidden = d.eye.sameColor;

    const shaped = d.module.shape === 'rounded' || d.module.shape === 'classy' ||
      d.module.shape === 'liquid';
    els.radius.closest('.vr-setting').hidden = !shaped;

    els.iconPickerBox.hidden = d.logo.source !== 'icon';
    els.appPickerBox.hidden = d.logo.source !== 'app';
    els.uploadBox.hidden = d.logo.source !== 'upload';
    els.logoOptions.hidden = d.logo.source === 'none';
    els.plateColorRow.hidden = d.logo.plate === 'none';

    const framed = d.frame.style !== 'none';
    els.frameText.closest('.vr-setting').hidden = !framed;
    els.framePos.closest('.vr-setting').hidden = !framed;
    els.frameSwatch.closest('.vr-setting').hidden = !framed;
  }

  /* ──────────────── Ikon- og app-galleri ──────────────── */

  let iconNames = [];

  function buildIconGrid(filter) {
    U.clear(els.iconGrid);
    const q = String(filter || '').trim().toLowerCase();
    const shown = (q ? iconNames.filter(n => n.toLowerCase().indexOf(q) !== -1) : iconNames)
      .slice(0, 140);
    shown.forEach((name) => {
      const btn = U.el('button', 'vr-icon-btn' + (name === state.design.logo.icon ? ' active' : ''));
      btn.type = 'button';
      btn.title = name;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', name === state.design.logo.icon ? 'true' : 'false');
      btn.setAttribute('aria-label', 'Ikon ' + name);
      btn.innerHTML = ICON(name, 22);
      btn.addEventListener('click', () => {
        state.design.logo.icon = name;
        state.logoAsset = VR.logo.fromIcon(name);
        buildIconGrid(els.iconSearch.value);
        update();
      });
      els.iconGrid.appendChild(btn);
    });
    if (!shown.length) {
      els.iconGrid.appendChild(U.el('p', 'vr-muted vr-tiny', 'Ingen ikon med det namnet.'));
    }
  }

  async function buildAppGrid() {
    let apps = [];
    try {
      const res = await fetch('../json/apps.json');
      const data = await res.json();
      apps = (data.apps || []).filter(a => a.img && !a.hidden);
    } catch (err) {
      els.appGrid.appendChild(U.el('p', 'vr-muted vr-tiny', 'Fekk ikkje lasta lista over sider.'));
      return;
    }
    U.clear(els.appGrid);
    apps.forEach((app) => {
      const btn = U.el('button', 'vr-app-btn' + (app.id === state.design.logo.app ? ' active' : ''));
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', app.id === state.design.logo.app ? 'true' : 'false');
      const img = U.el('img');
      img.src = '../' + String(app.img).replace(/^\.?\//, '');
      img.alt = '';
      img.loading = 'lazy';
      btn.appendChild(img);
      btn.appendChild(U.el('span', null, app.name));
      btn.addEventListener('click', async () => {
        try {
          state.logoAsset = await VR.logo.fromApp(img.src);
          state.design.logo.app = app.id;
          state.design.logo.dataUri = state.logoAsset.dataUri;
          buildAppGrid();
          update();
        } catch (err) {
          toast('Fekk ikkje lasta den logoen.');
        }
      });
      els.appGrid.appendChild(btn);
    });
  }

  /* ──────────────── Opplasting ──────────────── */

  async function takeFile(file) {
    try {
      const result = await VR.logo.fromFile(file);
      state.logoAsset = result.asset;
      state.design.logo.source = 'upload';
      state.design.logo.dataUri = result.asset.dataUri;
      state.design.logo.vector = result.asset.vector;
      els.uploadNote.textContent = result.note ||
        ('Lasta inn: ' + (result.asset.name || 'fila'));
      els.uploadNote.hidden = false;
      syncControls();
      update();
    } catch (err) {
      els.uploadNote.textContent = err.message;
      els.uploadNote.hidden = false;
      toast(err.message);
    }
  }

  function bindUpload() {
    const open = () => els.logoInput.click();
    els.uploadZone.addEventListener('click', open);
    els.uploadZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    els.logoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) takeFile(e.target.files[0]);
      e.target.value = '';
    });
    ['dragenter', 'dragover'].forEach(ev => els.uploadZone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.uploadZone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(ev => els.uploadZone.addEventListener(ev, () => {
      els.uploadZone.classList.remove('dragover');
    }));
    els.uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files.length) takeFile(e.dataTransfer.files[0]);
    });
  }

  /* ──────────────── Teikninga ──────────────── */

  function activeLogo() {
    return state.design.logo.source === 'none' ? null : state.logoAsset;
  }

  function update() {
    const type = VR.content.byId(state.content.type);
    state.text = VR.content.build(state.content);

    const warn = VR.content.warn(state.content);
    els.contentWarn.textContent = warn || '';
    els.contentWarn.hidden = !warn;

    const logo = activeLogo();

    if (!state.text) {
      state.qr = null;
      state.scene = null;
      els.previewEmpty.hidden = false;
      els.preview.hidden = true;
      els.capacity.textContent = 'Tomt';
      els.meterBar.style.width = '0%';
      setStatus('none', 'Ingen kode enno', []);
      enableExports(false);
      return;
    }

    const ecc = state.design.ecc === 'auto'
      ? VR.qr.autoEcc(state.text, { hasLogo: !!logo, minVersion: state.design.minVersion })
      : state.design.ecc;

    const qr = VR.qr.build(state.text, { ecc: ecc, minVersion: state.design.minVersion });
    const bytes = U.byteLength(state.text);
    const max = VR.qr.maxBytes(ecc);
    els.capacity.textContent = bytes + ' av ' + max + ' byte ved feilretting ' + ecc +
      (qr ? ' — versjon ' + qr.version + ', ' + qr.size + '×' + qr.size + ' modular' : '');
    els.meterBar.style.width = U.clamp(bytes / max * 100, 0, 100) + '%';
    els.meterBar.classList.toggle('vr-meter-full', bytes > max * 0.9);

    if (!qr) {
      state.qr = null;
      state.scene = null;
      els.previewEmpty.hidden = false;
      els.previewEmpty.textContent =
        'Innhaldet er for langt for ein QR-kode på feilretting ' + ecc +
        '. Kort ned teksten, eller vel eit lågare feilrettingsnivå.';
      els.preview.hidden = true;
      setStatus('bad', 'Får ikkje plass', [{ level: 'bad', text: 'Innhaldet er for langt.' }]);
      enableExports(false);
      return;
    }

    state.qr = qr;
    state.scene = VR.render.buildScene(qr, state.design, logo);

    els.previewEmpty.hidden = true;
    els.preview.hidden = false;
    VR.canvasRender.draw(els.preview, state.scene, 760);
    els.preview.setAttribute('aria-label',
      'QR-kode for ' + type.label.toLowerCase() + ': ' + shortText(state.text));

    const report = VR.check.rules(qr, state.design, logo);
    setStatus(report.level,
      report.level === 'ok' ? 'Ser bra ut' :
      report.level === 'warn' ? 'Bør sjekkast' : 'Truleg ulesbar',
      report.notes);
    enableExports(true);
  }

  function shortText(text) {
    const one = String(text).replace(/\s+/g, ' ').trim();
    return one.length > 70 ? one.slice(0, 70) + '…' : one;
  }

  function setStatus(level, title, notes) {
    els.status.dataset.level = level;
    els.statusTitle.textContent = title;
    U.clear(els.statusList);
    notes.forEach((note) => {
      const li = U.el('li', 'vr-note vr-note-' + note.level, note.text);
      els.statusList.appendChild(li);
    });
    els.verifyBtn.disabled = level === 'none';
  }

  function enableExports(on) {
    [els.pngBtn, els.svgBtn, els.copyBtn, els.printBtn, els.saveBtn, els.exportJsonBtn]
      .forEach(b => { b.disabled = !on; });
  }

  /* ──────────────── Eksport ──────────────── */

  function exportName() {
    return state.name || VR.content.byId(state.content.type).label + '-' + shortText(state.text).slice(0, 24);
  }

  function bindExports() {
    els.pngBtn.addEventListener('click', async () => {
      await VR.exporter.png(state.scene, parseInt(els.pngSize.value, 10), exportName());
      toast('PNG lasta ned.');
    });

    els.svgBtn.addEventListener('click', () => {
      VR.exporter.svg(state.scene, parseInt(els.pngSize.value, 10), exportName(),
        'QR-kode: ' + shortText(state.text));
      toast('SVG lasta ned.');
    });

    els.copyBtn.addEventListener('click', async () => {
      try {
        const how = await VR.exporter.copy(state.scene, parseInt(els.pngSize.value, 10), exportName());
        toast(how === 'copied'
          ? 'Koden ligg i utklippstavla.'
          : 'Nettlesaren din kan ikkje kopiere bilete — koden vart lasta ned i staden.');
      } catch (err) {
        toast('Fekk ikkje kopiert. Prøv å laste ned i staden.');
      }
    });

    els.printBtn.addEventListener('click', () => {
      U.clear(els.sheet);
      VR.exporter.print(state.scene, els.printImg, state.name || '', els.printCaption);
    });

    els.exportJsonBtn.addEventListener('click', () => {
      VR.exporter.saveJson(state);
      toast('Oppsettet er lasta ned.');
    });

    els.importJsonBtn.addEventListener('click', () => els.jsonInput.click());
    els.jsonInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          const data = VR.exporter.parseJson(String(fr.result));
          await applyState(data);
          toast('Oppsettet er lasta inn.');
        } catch (err) {
          toast(err.message);
        }
      };
      fr.readAsText(file);
    });
  }

  /* Eit oppsett utanfrå kan peike på ein logo vi må byggje opp att før
     noko kan teiknast — difor er dette asynkront. */
  async function applyState(data) {
    if (data.content) state.content = data.content;
    state.design = data.design;
    state.name = data.name || '';
    state.logoAsset = null;

    const lg = state.design.logo;
    try {
      if (lg.source === 'icon') state.logoAsset = VR.logo.fromIcon(lg.icon);
      else if (lg.dataUri) state.logoAsset = await VR.logo.fromDataUri(lg.dataUri, lg.vector);
    } catch (err) {
      state.design.logo.source = 'none';
    }

    buildFields();
    syncControls();
    buildIconGrid(els.iconSearch.value);
    update();
  }

  /* ──────────────── Lagring ──────────────── */

  function bindSaving() {
    els.saveBtn.addEventListener('click', () => {
      pendingSave = 'setup';
      els.nameInput.value = state.name || '';
      openName('Gje oppsettet eit namn');
    });

    els.saveTemplateBtn.addEventListener('click', () => {
      pendingSave = 'template';
      els.nameInput.value = '';
      openName('Gje stilen eit namn');
    });

    els.nameOk.addEventListener('click', commitName);
    els.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitName(); }
    });
    els.nameCancel.addEventListener('click', closeName);
    els.nameClose.addEventListener('click', closeName);
    els.nameOverlay.addEventListener('click', (e) => {
      if (e.target === els.nameOverlay) closeName();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.nameOverlay.classList.contains('open')) closeName();
    });

    els.clearRecentBtn.addEventListener('click', () => {
      VR.storage.clearRecent();
      buildRecent();
    });
  }

  function openName(title) {
    $('nameTitle').textContent = title;
    els.nameOverlay.classList.add('open');
    els.nameInput.focus();
    els.nameInput.select();
  }

  function closeName() {
    els.nameOverlay.classList.remove('open');
    pendingSave = null;
  }

  function commitName() {
    const name = els.nameInput.value.trim() || 'Utan namn';
    if (pendingSave === 'template') {
      const design = VR.design.clone(state.design);
      VR.storage.saveTemplate(name, design);
      buildMyTemplates();
      toast('Stilen er lagra.');
    } else {
      state.name = name;
      VR.storage.save({
        name: name,
        content: state.content,
        design: state.design
      });
      buildSaved();
      toast('Oppsettet er lagra.');
    }
    closeName();
  }

  function buildSaved() {
    U.clear(els.savedList);
    const items = VR.storage.saved();
    if (!items.length) {
      els.savedList.appendChild(U.el('p', 'vr-muted', 'Ingenting lagra enno.'));
      return;
    }
    items.forEach((item) => {
      const row = U.el('div', 'vr-saved-row');
      const open = U.el('button', 'btn vr-small', item.name);
      open.type = 'button';
      open.addEventListener('click', async () => {
        await applyState({
          name: item.name,
          content: item.content,
          design: VR.design.normalise(item.design)
        });
        toast('Henta «' + item.name + '».');
      });
      const del = U.el('button', 'btn vr-small vr-icon-only');
      del.type = 'button';
      del.innerHTML = ICON('trash2', 16);
      del.setAttribute('aria-label', 'Slett ' + item.name);
      del.addEventListener('click', () => {
        VR.storage.remove(item.id);
        buildSaved();
      });
      row.appendChild(open);
      row.appendChild(del);
      els.savedList.appendChild(row);
    });
  }

  function buildRecent() {
    const items = VR.storage.recent();
    els.recentBox.hidden = !items.length;
    U.clear(els.recentList);
    items.forEach((item) => {
      const btn = U.el('button', 'btn vr-small', shortText(item.label));
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.content = { type: item.type, values: Object.assign({}, item.values) };
        buildFields();
        update();
      });
      els.recentList.appendChild(btn);
    });
  }

  /* ──────────────── Lesbarheitssjekk ──────────────── */

  function bindVerify() {
    els.verifyBtn.addEventListener('click', async () => {
      if (!state.scene) return;
      els.verifyBtn.disabled = true;
      els.verifyNote.textContent = 'Les koden …';
      try {
        const result = await VR.check.decode(state.scene, state.text);
        const failed = result.sizes.filter(s => !s.ok).map(s => s.px + ' px');
        if (result.ok) {
          els.verifyNote.textContent =
            'Lesen i alle tre storleikane (' + result.sizes.map(s => s.px + ' px').join(', ') +
            '). Koden verkar.';
        } else if (result.text === state.text) {
          els.verifyNote.textContent =
            'Lesen i somme storleikar, men ikkje i ' + failed.join(' og ') + '. ' +
            'Koden er på grensa — han kan svikte alt etter kor stort han blir vist.';
        } else if (result.text) {
          els.verifyNote.textContent =
            'Koden vart lesen, men teksten stemte ikkje. Det bør ikkje kunne skje — sei frå om det.';
        } else {
          els.verifyNote.textContent =
            'Klarte ikkje lese koden. Prøv lågare logostorleik, meir kontrast eller mindre luft mellom modulane.';
        }
      } catch (err) {
        els.verifyNote.textContent = err.message;
      }
      els.verifyBtn.disabled = false;
    });
  }

  /* ──────────────── Mange kodar ──────────────── */

  function bindBatch() {
    function rows() {
      return VR.batch.parse(els.batchText.value, els.batchType.value);
    }

    function report(built) {
      if (built.failed.length) {
        els.batchWarn.textContent = built.failed.length +
          ' linje(r) vart hoppa over fordi innhaldet ikkje let seg kode: ' +
          built.failed.map(r => r.label).slice(0, 5).join(', ') +
          (built.failed.length > 5 ? ' …' : '');
        els.batchWarn.hidden = false;
      } else {
        els.batchWarn.hidden = true;
      }
      return built.ok.length;
    }

    els.batchSheetBtn.addEventListener('click', () => {
      const built = VR.batch.buildAll(rows(), state.design, activeLogo());
      if (!report(built)) { toast('Ingen kodar å skrive ut.'); return; }
      els.printImg.removeAttribute('src');
      els.printCaption.textContent = '';
      VR.batch.sheet(built.ok, els.sheet, els.batchCols.value);
      setTimeout(() => window.print(), 120);
    });

    async function zip(format) {
      const built = VR.batch.buildAll(rows(), state.design, activeLogo());
      if (!report(built)) { toast('Ingen kodar å pakke.'); return; }
      try {
        await VR.batch.zip(built.ok, {
          format: format,
          pixelWidth: parseInt(els.pngSize.value, 10),
          name: state.name || 'qr-kodar'
        });
        toast(built.ok.length + ' kodar lasta ned.');
      } catch (err) {
        toast(err.message);
      }
    }

    els.batchZipBtn.addEventListener('click', () => zip('png'));
    els.batchZipSvgBtn.addEventListener('click', () => zip('svg'));
  }

  /* ──────────────── Panelfaner ──────────────── */

  function bindPanels() {
    const tabs = document.querySelectorAll('.box-tab[data-panel]');
    const panels = document.querySelectorAll('.vr-panel[data-panel]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panels.forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.panel; });
      });
    });
  }

  /* ──────────────── Oppstart ──────────────── */

  function collect() {
    [
      'typeGrid', 'typeHint', 'fields', 'contentWarn', 'capacity', 'meterBar',
      'recentBox', 'recentList', 'clearRecentBtn',
      'preview', 'previewEmpty', 'status', 'statusTitle', 'statusList',
      'verifyBtn', 'verifyNote',
      'pngBtn', 'svgBtn', 'copyBtn', 'printBtn', 'pngSize',
      'saveBtn', 'exportJsonBtn', 'importJsonBtn', 'jsonInput',
      'presets', 'myTemplates', 'saveTemplateBtn',
      'moduleShapes', 'radius', 'radiusOut', 'gap', 'gapOut',
      'eyeFrames', 'eyePupils', 'alignStyle',
      'fillType', 'inkSwatch', 'inkValue', 'ink2Row', 'ink2Swatch', 'ink2Value',
      'angleRow', 'angle', 'angleOut', 'targetRow', 'fillTarget',
      'eyeSame', 'eyeColorRow', 'eyeSwatch', 'eyeValue',
      'bgSwatch', 'bgValue', 'bgTransparent',
      'logoSource', 'iconPickerBox', 'iconSearch', 'iconGrid',
      'logoColorSwatch', 'logoColorValue', 'logoWeight', 'logoWeightOut',
      'appPickerBox', 'appGrid', 'uploadBox', 'uploadZone', 'logoInput', 'uploadNote',
      'logoOptions', 'logoSize', 'logoSizeOut', 'logoPlate',
      'plateColorRow', 'plateSwatch', 'plateValue', 'platePad', 'platePadOut', 'excavate',
      'frameStyle', 'frameText', 'framePos', 'frameSwatch', 'frameValue',
      'quiet', 'quietOut', 'ecc',
      'batchText', 'batchType', 'batchCols', 'batchSheetBtn', 'batchZipBtn',
      'batchZipSvgBtn', 'batchWarn',
      'savedList', 'printImg', 'printCaption', 'sheet',
      'nameOverlay', 'nameInput', 'nameOk', 'nameCancel', 'nameClose',
      'toast'
    ].forEach((id) => { els[id] = $(id); });
  }

  function init() {
    collect();
    VR.color.attach();
    iconNames = VR.logo.iconNames();

    buildTypeGrid();
    buildFields();
    buildControls();
    buildPresets();
    buildMyTemplates();
    buildSaved();
    buildRecent();
    buildIconGrid('');
    bindUpload();
    bindExports();
    bindSaving();
    bindVerify();
    bindBatch();
    bindPanels();

    els.logoSource.addEventListener('change', async () => {
      const src = els.logoSource.value;
      state.design.logo.source = src;
      if (src === 'icon') {
        state.logoAsset = VR.logo.fromIcon(state.design.logo.icon);
      } else if (src === 'app') {
        if (!els.appGrid.childElementCount) await buildAppGrid();
        if (!state.design.logo.dataUri) state.logoAsset = null;
      } else if (src === 'none') {
        state.logoAsset = null;
      }
      syncControls();
      update();
    });

    els.iconSearch.addEventListener('input', U.debounce(() => {
      buildIconGrid(els.iconSearch.value);
    }, 120));

    /* Innhaldet blir hugsa når brukaren har vore stille ei stund, ikkje
       for kvart tastetrykk — elles ville lista fylt seg med halve lenkjer. */
    const rememberSoon = U.debounce(() => {
      if (!state.text) return;
      VR.storage.remember(state.content.type, shortText(state.text),
        Object.assign({}, state.content.values));
      buildRecent();
    }, 4000);
    els.fields.addEventListener('input', rememberSoon);

    syncControls();
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
