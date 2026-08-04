/* ══════════════════════════════════════════════
   UI-PROPS.JS — Panelet for utsjånad og plassering

   Panelet blir BYGD på nytt når markeringa skifter, men berre SYNKA når
   verdiane endrar seg. Skilnaden er avgjerande: å byggje det på nytt for
   kvart musesteg under ei dra ville rive innskrivingsfeltet ut under
   fingrane på den som står og skriv i det.

   Er ingenting valt, viser panelet stilen NESTE form får. Då kan
   brukaren velje farge før han teiknar, i staden for å teikne noko i feil
   farge og rette det opp etterpå.

   Ved fleirval viser felt med ulike verdiar ingenting i det heile — eit
   tomt felt er ærlegare enn å plukke ut verdien til den første og la
   brukaren tru at alle er like.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.props = (function () {
  'use strict';

  let bodyEl = null;
  let emptyEl = null;
  const fields = {};          // namn → { el, set }

  const DASHES = [
    { value: '', label: 'Heil' },
    { value: '6 4', label: 'Stipla' },
    { value: '1 5', label: 'Prikka' },
    { value: '12 5 2 5', label: 'Strek og prikk' }
  ];

  const CAPS = [
    { value: 'butt', label: 'Rett' },
    { value: 'round', label: 'Rund' },
    { value: 'square', label: 'Firkanta' }
  ];

  const JOINS = [
    { value: 'miter', label: 'Spiss' },
    { value: 'round', label: 'Rund' },
    { value: 'bevel', label: 'Avstumpa' }
  ];

  function attach() {
    bodyEl = document.getElementById('propsBody');
    emptyEl = document.getElementById('propsEmpty');
  }

  /* ──────────────── Kva panelet gjeld ──────────────── */

  function targets() {
    return RV.state.topSelection().map(RV.state.get).filter(Boolean);
  }

  /** Ein felles verdi, eller null når dei er ulike. */
  function shared(nodes, read) {
    if (!nodes.length) return null;
    const first = read(nodes[0]);
    const key = JSON.stringify(first);
    return nodes.every(n => JSON.stringify(read(n)) === key) ? first : null;
  }

  /* ──────────────── Byggjeklossar ──────────────── */

  function group(title) {
    const box = RV.util.el('div', 'rv-prop-group');
    if (title) box.appendChild(RV.util.el('h4', 'rv-prop-title', title));
    return box;
  }

  function row(labelText, control, extraClass) {
    const wrap = RV.util.el('div', 'rv-prop-row' + (extraClass ? ' ' + extraClass : ''));
    if (labelText) {
      const label = RV.util.el('span', 'rv-prop-label', labelText);
      const id = 'rvp-' + Math.random().toString(36).slice(2, 8);
      control.id = id;
      label.setAttribute('for', id);
      wrap.appendChild(label);
    }
    wrap.appendChild(control);
    return wrap;
  }

  function numberInput(value, opts, onCommit) {
    const input = RV.util.el('input', 'rv-text-input rv-num-input');
    input.type = 'number';
    if (opts.min != null) input.min = opts.min;
    if (opts.max != null) input.max = opts.max;
    input.step = opts.step == null ? 1 : opts.step;
    input.value = value == null ? '' : RV.matrix.round(value);
    if (value == null) input.placeholder = 'ulikt';

    const commit = () => {
      if (input.value === '') return;
      onCommit(RV.util.parseNum(input.value, 0));
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { commit(); input.blur(); }
      e.stopPropagation();          // hurtigtastane skal ikkje sløkkje sifra
    });
    return input;
  }

  function select(options, value, onChange) {
    const el = RV.util.el('select', 'rv-select');
    options.forEach((o) => {
      const opt = RV.util.el('option', null, o.label);
      opt.value = o.value;
      el.appendChild(opt);
    });
    el.value = value == null ? '' : value;
    el.addEventListener('change', () => onChange(el.value));
    el.addEventListener('keydown', e => e.stopPropagation());
    return el;
  }

  function checkbox(labelText, checked, onChange) {
    const wrap = RV.util.el('label', 'rv-check');
    const box = RV.util.el('input');
    box.type = 'checkbox';
    box.checked = !!checked;
    box.addEventListener('change', () => onChange(box.checked));
    wrap.appendChild(box);
    wrap.appendChild(RV.util.el('span', null, labelText));
    return wrap;
  }

  /* ──────────────── Fargeknapp ──────────────── */

  /**
   * Ein rute som viser fargen og opnar veljaren. Rutenettet bak viser
   * gjennom når fargen er delvis gjennomsiktig, så «lys farge» og
   * «gjennomsiktig farge» ikkje ser like ut.
   */
  const PAINT_KINDS = [
    { value: 'solid',  label: 'Farge' },
    { value: 'linear', label: 'Overgang' },
    { value: 'radial', label: 'Stråleovergang' },
    { value: 'none',   label: 'Ingen' }
  ];

  function kindOf(paint) {
    if (!paint || paint.type === 'none') return 'none';
    if (paint.type !== 'gradient') return 'solid';
    const g = RV.gradient.get(paint.id);
    return g && g.kind === 'radial' ? 'radial' : 'linear';
  }

  function paintSwatch(paint, onChange, nodes) {
    const wrap = RV.util.el('div', 'rv-paint');
    const kind = kindOf(paint);

    /* Kva SLAG fyll — farge, overgang eller ingenting. Ein veljar i
       staden for tre knappar: dei fire vala utelukkar kvarandre, og ein
       veljar seier det tydelegare enn tre knappar der éin er trykt inn. */
    wrap.appendChild(select(PAINT_KINDS, kind, (v) => {
      if (v === 'none') { RV.color.close(); onChange({ type: 'none' }); return; }
      if (v === 'solid') {
        onChange({ type: 'solid', color: solidColorOf(paint), opacity: 1 });
        return;
      }
      // Overgang: kvar form får sin eigen, så to former ikkje endrar seg
      // saman utan at brukaren har bede om det.
      if (!nodes) { RV.util.toast('Vel ei form for å leggje på ein overgang.'); return; }
      RV.state.pushUndo();
      nodes.forEach((n) => {
        const part = paint === n.stroke ? 'stroke' : 'fill';
        n[part] = { type: 'gradient', id: RV.gradient.create(n, v, n[part]) };
      });
      RV.gradient.collectGarbage();
      RV.hit.invalidate();
      RV.state.emit('nodes');
      build();
    }));

    if (kind !== 'none') {
      const btn = RV.util.el('button', 'rv-swatch');
      btn.type = 'button';

      if (kind === 'solid') {
        btn.style.background = paint.color;
        btn.style.opacity = paint.opacity;
        btn.title = paint.color;
        btn.setAttribute('aria-label', 'Farge ' + paint.color);
        btn.addEventListener('click', () => {
          RV.color.open(btn, paint, (hex, alpha) => {
            onChange({ type: 'solid', color: hex, opacity: alpha });
          });
        });
      } else {
        const g = RV.gradient.get(paint.id);
        btn.style.background = g ? RV.gradient.toCss(g) : '#888';
        btn.title = 'Overgang';
        btn.setAttribute('aria-label', 'Rediger overgangen');
        btn.addEventListener('click', () => build());
      }

      wrap.appendChild(btn);
    }

    return wrap;
  }

  /** Ein rimeleg heilfarge å falle tilbake på når ein forlèt ein overgang. */
  function solidColorOf(paint) {
    if (paint && paint.type === 'solid') return paint.color;
    if (paint && paint.type === 'gradient') {
      const g = RV.gradient.get(paint.id);
      if (g && g.stops.length) return g.stops[0].color;
    }
    return '#8ecae6';
  }

  /* ──────────────── Stoppunkt i ein overgang ──────────────── */

  /**
   * Stripa med stoppunkta. Klikk på stripa legg til eit nytt der ein
   * peika, med den fargen overgangen alt har på den plassen — så
   * ingenting endrar utsjånad før brukaren sjølv vel ein annan farge.
   */
  function gradientEditor(found) {
    const box = group('Overgang');
    const g = found.gradient;

    const bar = RV.util.el('div', 'rv-grad-bar');
    bar.style.background = RV.gradient.toCss(
      Object.assign({}, g, { kind: 'linear' }));   // stripa er alltid rett fram
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Stoppunkt i overgangen');

    g.stops.forEach((stop, i) => {
      const dot = RV.util.el('button', 'rv-grad-stop');
      dot.type = 'button';
      dot.style.left = (stop.offset * 100) + '%';
      dot.style.background = stop.color;
      dot.title = Math.round(stop.offset * 100) + ' % — ' + stop.color;
      dot.setAttribute('aria-label', 'Stoppunkt ' + (i + 1) + ' på ' +
        Math.round(stop.offset * 100) + ' prosent');

      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        RV.color.open(dot, stop, (hex, alpha) => {
          stop.color = hex;
          stop.opacity = alpha;
          dot.style.background = hex;
          bar.style.background = RV.gradient.toCss(Object.assign({}, g, { kind: 'linear' }));
          RV.state.emit('nodes');
        });
      });

      // Dra stoppunktet langs stripa.
      dot.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const rect = bar.getBoundingClientRect();
        let moved = false;
        const snapshot = RV.state.snapshot();

        const move = (ev) => {
          moved = true;
          stop.offset = RV.util.clamp((ev.clientX - rect.left) / rect.width, 0, 1);
          RV.gradient.sortStops(g);
          dot.style.left = (stop.offset * 100) + '%';
          bar.style.background = RV.gradient.toCss(Object.assign({}, g, { kind: 'linear' }));
          RV.state.emit('nodes');
        };
        const up = () => {
          document.removeEventListener('pointermove', move);
          document.removeEventListener('pointerup', up);
          if (moved) { RV.state.pushUndoSnapshot(snapshot); build(); }
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
      });

      bar.appendChild(dot);
    });

    bar.addEventListener('click', (e) => {
      const rect = bar.getBoundingClientRect();
      RV.state.pushUndo();
      RV.gradient.addStop(g, (e.clientX - rect.left) / rect.width);
      RV.state.emit('nodes');
      build();
    });

    box.appendChild(bar);
    box.appendChild(RV.util.el('p', 'rv-muted',
      'Klikk på stripa for eit nytt stoppunkt, og dra i det for å flytte det. Handtaka på sjølve forma styrer retninga.'));

    if (g.stops.length > 2) {
      const rens = RV.util.el('button', 'btn rv-btn-small rv-prop-button');
      rens.type = 'button';
      rens.textContent = 'Fjern det siste stoppunktet';
      rens.addEventListener('click', () => {
        RV.state.pushUndo();
        RV.gradient.removeStop(g, g.stops.length - 1);
        RV.state.emit('nodes');
        build();
      });
      box.appendChild(rens);
    }

    return box;
  }

  /* ──────────────── Endringar ──────────────── */

  /** Køyrer ei endring på alle valde nodar, med eitt angre-steg. */
  function edit(fn, rebuild) {
    const nodes = targets();
    if (!nodes.length) return;
    RV.state.pushUndo();
    nodes.forEach(fn);
    RV.hit.invalidate();
    RV.state.emit('nodes');
    if (rebuild) build();
  }

  /** Endrar standardstilen som nye former arvar. */
  function editDefault(fn) {
    fn(RV.state.data.style);
    RV.state.emit('style');
    build();
  }

  /* ──────────────── Panelet ──────────────── */

  function build() {
    if (!bodyEl) return;
    RV.util.clear(bodyEl);

    const nodes = targets();
    const advanced = RV.tools.isAdvanced();

    if (!nodes.length) {
      emptyEl.hidden = false;
      emptyEl.textContent = 'Ingenting er valt. Fargane under gjeld den neste forma du teiknar.';
      bodyEl.appendChild(emptyEl);
      buildPaint(bodyEl, null, advanced);
      return;
    }

    emptyEl.hidden = true;
    buildPaint(bodyEl, nodes, advanced);

    const grad = RV.gradient.active();
    if (grad) bodyEl.appendChild(gradientEditor(grad));

    buildPendingSymbol(bodyEl);

    buildShape(bodyEl, nodes);
    buildPlacement(bodyEl, nodes, advanced);
  }

  /* ---- Fyll og strek ---- */

  function buildPaint(parent, nodes, advanced) {
    const style = RV.state.data.style;

    const fill = nodes ? shared(nodes, n => n.fill) : style.fill;
    const stroke = nodes ? shared(nodes, n => n.stroke) : style.stroke;

    const g = group('Fyll og strek');

    g.appendChild(row('Fyll', paintSwatch(fill, (paint) => {
      if (nodes) edit(n => { n.fill = paint; }, true);
      else editDefault(s => { s.fill = paint; });
    }, nodes)));

    g.appendChild(row('Strek', paintSwatch(stroke, (paint) => {
      const next = paint.type === 'none'
        ? { type: 'none' }
        : Object.assign({ width: 2, dash: '', cap: 'butt', join: 'miter' },
                        stroke && stroke.type !== 'none' ? stroke : {}, paint);
      if (nodes) edit(n => { n.stroke = next; }, true);
      else editDefault(s => { s.stroke = next; });
    }, nodes)));

    const hasStroke = stroke && stroke.type !== 'none';
    if (hasStroke || !stroke) {
      const width = nodes ? shared(nodes, n => n.stroke && n.stroke.width) : style.stroke.width;
      g.appendChild(row('Tjukn', numberInput(width, { min: 0, max: 400, step: 0.5 }, (v) => {
        if (nodes) edit(n => { if (n.stroke && n.stroke.type !== 'none') n.stroke.width = Math.max(0, v); });
        else editDefault(s => { s.stroke.width = Math.max(0, v); });
      })));

      if (advanced) {
        const dash = nodes ? shared(nodes, n => (n.stroke && n.stroke.dash) || '') : style.stroke.dash;
        g.appendChild(row('Strekmønster', select(DASHES, dash, (v) => {
          if (nodes) edit(n => { if (n.stroke && n.stroke.type !== 'none') n.stroke.dash = v; });
          else editDefault(s => { s.stroke.dash = v; });
        })));

        const cap = nodes ? shared(nodes, n => (n.stroke && n.stroke.cap) || 'butt') : style.stroke.cap;
        g.appendChild(row('Endar', select(CAPS, cap, (v) => {
          if (nodes) edit(n => { if (n.stroke && n.stroke.type !== 'none') n.stroke.cap = v; });
          else editDefault(s => { s.stroke.cap = v; });
        })));

        const join = nodes ? shared(nodes, n => (n.stroke && n.stroke.join) || 'miter') : style.stroke.join;
        g.appendChild(row('Hjørne', select(JOINS, join, (v) => {
          if (nodes) edit(n => { if (n.stroke && n.stroke.type !== 'none') n.stroke.join = v; });
          else editDefault(s => { s.stroke.join = v; });
        })));

        // Pilspissar gjev berre meining på noko med to endar.
        if (nodes && nodes.some(n => n.type === 'line' || n.type === 'path')) {
          const start = shared(nodes, n => (n.stroke && n.stroke.markerStart) || '');
          g.appendChild(row('Start', select(RV.connect.CHOICES, start, (v) => {
            edit(n => { if (n.stroke && n.stroke.type !== 'none') n.stroke.markerStart = v; });
          })));

          const end = shared(nodes, n => (n.stroke && n.stroke.markerEnd) || '');
          g.appendChild(row('Slutt', select(RV.connect.CHOICES, end, (v) => {
            edit(n => { if (n.stroke && n.stroke.type !== 'none') n.stroke.markerEnd = v; });
          })));
        }
      }
    }

    if (nodes) {
      const opacity = shared(nodes, n => n.opacity);
      const slider = RV.util.el('input', 'rv-slider');
      slider.type = 'range';
      slider.min = 0; slider.max = 1; slider.step = 0.01;
      slider.value = opacity == null ? 1 : opacity;
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        targets().forEach(n => { n.opacity = v; });
        RV.state.emit('nodes');
      });
      // Angre-steget kjem når skyvaren slepp, ikkje for kvar piksel.
      slider.addEventListener('change', () => edit(n => { n.opacity = parseFloat(slider.value); }));
      g.appendChild(row('Synlegheit', slider, 'rv-prop-row-wide'));
    }

    parent.appendChild(g);
  }

  /**
   * Etter at ein instans er løyst opp, står vi att med vanlege former og
   * eit symbol som ventar på nytt innhald. Knappen dukkar opp her, i
   * staden for i verktøyraden — han gjeld berre akkurat no, og ein
   * knapp som er meiningslaus nitten av tjue gonger høyrer ikkje heime
   * i raden.
   */
  function buildPendingSymbol(parent) {
    const symId = RV.state.data.pendingSymbol;
    if (!symId || !RV.symbol.get(symId)) return;

    const box = group('Symbol under endring');
    box.appendChild(RV.util.el('p', 'rv-muted',
      'Marker formene som skal bli det nye innhaldet, og trykk under. Alle instansane blir oppdaterte.'));

    const oppdater = RV.util.el('button', 'btn btn-accent rv-btn-small rv-prop-button');
    oppdater.type = 'button';
    oppdater.textContent = 'Oppdater symbolet';
    oppdater.addEventListener('click', () => {
      const error = RV.symbol.update(symId);
      if (error) { RV.util.toast(error); return; }
      delete RV.state.data.pendingSymbol;
      RV.util.toast('Symbolet er oppdatert overalt.');
      build();
    });
    box.appendChild(oppdater);

    const avbryt = RV.util.el('button', 'btn rv-btn-small rv-prop-button');
    avbryt.type = 'button';
    avbryt.textContent = 'Avbryt';
    avbryt.addEventListener('click', () => {
      delete RV.state.data.pendingSymbol;
      build();
    });
    box.appendChild(avbryt);

    parent.appendChild(box);
  }

  /* ---- Formspesifikke felt ---- */

  function buildShape(parent, nodes) {
    if (nodes.length !== 1) return;
    const node = nodes[0];

    if (node.type === 'rect') {
      const g = group('Rektangel');
      g.appendChild(row('Runde hjørne', numberInput(node.geom.rx || 0, { min: 0, step: 1 }, (v) => {
        edit((n) => {
          const max = Math.min(Math.abs(n.geom.w), Math.abs(n.geom.h)) / 2;
          n.geom.rx = RV.util.clamp(v, 0, max);
          n.geom.ry = n.geom.rx;
        });
      })));
      parent.appendChild(g);
      return;
    }

    if (node.type === 'use') {
      const symId = node.geom.symbol;
      const box = group('Symbol');
      const antal = RV.symbol.countInstances(symId);

      box.appendChild(RV.util.el('p', 'rv-muted', antal === 1
        ? 'Dette symbolet er brukt éin stad.'
        : 'Dette symbolet er brukt ' + antal + ' stader. Endrar du det, endrar alle seg.'));

      const loys = RV.util.el('button', 'btn rv-btn-small rv-prop-button');
      loys.type = 'button';
      loys.textContent = 'Løys opp denne instansen';
      loys.title = 'Gjer instansen om til vanlege former du kan endre';
      loys.addEventListener('click', () => {
        const error = RV.symbol.detach();
        if (error) { RV.util.toast(error); return; }
        RV.util.toast('Løyst opp. Endre formene, marker dei, og trykk «Oppdater symbolet» for å endre alle instansane.');
        RV.state.data.pendingSymbol = symId;
        build();
      });
      box.appendChild(loys);

      parent.appendChild(box);
      return;
    }

    if (RV.connect.isLink(node)) {
      const box = group('Kopling');
      box.appendChild(RV.util.el('p', 'rv-muted',
        'Denne linja følgjer dei to formene ho er festa til. Flytt ei av dei, så følgjer pila etter.'));

      const loys = RV.util.el('button', 'btn rv-btn-small rv-prop-button');
      loys.type = 'button';
      loys.textContent = 'Løys frå formene';
      loys.addEventListener('click', () => {
        RV.state.pushUndo();
        delete node.geom.from;
        delete node.geom.to;
        RV.state.emit('nodes');
        build();
      });
      box.appendChild(loys);
      parent.appendChild(box);
    }

    if (node.type === 'text') {
      const g = node.geom;
      const box = group('Tekst');

      box.appendChild(row('Skrift', select(
        RV.text.FONTS.map(f => ({ value: f.id, label: f.name })), g.font,
        (v) => edit(n => { n.geom.font = v; }))));

      box.appendChild(row('Storleik', numberInput(g.size, { min: 4, max: 800, step: 1 },
        (v) => edit(n => { n.geom.size = RV.util.clamp(v, 4, 800); }))));

      box.appendChild(row('Tjukn', select([
        { value: '300', label: 'Tynn' }, { value: '400', label: 'Vanleg' },
        { value: '600', label: 'Halvfeit' }, { value: '700', label: 'Feit' },
        { value: '900', label: 'Ekstra feit' }
      ], String(g.weight), (v) => edit(n => { n.geom.weight = Number(v); }))));

      box.appendChild(row('Justering', select(RV.text.ALIGN, g.align,
        (v) => edit(n => { n.geom.align = v; }))));

      box.appendChild(row('Linjeavstand', numberInput(g.lineHeight, { min: 0.6, max: 4, step: 0.05 },
        (v) => edit(n => { n.geom.lineHeight = RV.util.clamp(v, 0.6, 4); }))));

      box.appendChild(checkbox('Kursiv', g.italic, (on) => edit(n => { n.geom.italic = on; })));

      const editBtn = RV.util.el('button', 'btn rv-btn-small rv-prop-button');
      editBtn.type = 'button';
      editBtn.textContent = 'Endre teksten';
      editBtn.addEventListener('click', () => {
        RV.tools.setActive('text');
        RV.text.beginEdit(node.id);
      });
      box.appendChild(editBtn);

      parent.appendChild(box);
      return;
    }

    if (node.type === 'poly') {
      const g = group('Mangekant');
      g.appendChild(row('Kantar', numberInput(node.geom.sides, { min: 3, max: 60, step: 1 }, (v) => {
        edit(n => { n.geom.sides = RV.util.clamp(Math.round(v), 3, 60); });
        RV.shapeTool.setPolySettings({ sides: RV.util.clamp(Math.round(v), 3, 60) });
      })));
      g.appendChild(checkbox('Stjerne', node.geom.star, (on) => {
        edit(n => { n.geom.star = on; }, true);
        RV.shapeTool.setPolySettings({ star: on });
      }));
      if (node.geom.star) {
        const ratio = node.geom.r1 ? node.geom.r2 / node.geom.r1 : 0.45;
        g.appendChild(row('Djupn', numberInput(ratio * 100, { min: 5, max: 95, step: 1 }, (v) => {
          const f = RV.util.clamp(v / 100, 0.05, 0.95);
          edit(n => { n.geom.r2 = n.geom.r1 * f; });
          RV.shapeTool.setPolySettings({ innerRatio: f });
        })));
      }
      parent.appendChild(g);
    }
  }

  /* ---- Plassering og storleik ---- */

  function buildPlacement(parent, nodes, advanced) {
    const ids = nodes.map(n => n.id);
    const box = RV.state.boundsOf(ids);
    if (!box) return;

    const g = group('Plassering');
    const grid = RV.util.el('div', 'rv-prop-grid');

    /* Ramma blir lesen på nytt i det brukaren skriv, ikkje her. Ei dra
       oppdaterer berre TALA i felta (sync), ikkje panelet — og hadde
       handterarane hengt på ramma frå då panelet blei bygd, ville ei ny
       breidd blitt rekna mot ein storleik forma ikkje har lenger. */
    const now = () => RV.state.boundsOf(ids) || box;

    grid.appendChild(row('X', numberInput(box.x, { step: 1 },
      (v) => moveTo(ids, v - now().x, 0))));
    grid.appendChild(row('Y', numberInput(box.y, { step: 1 },
      (v) => moveTo(ids, 0, v - now().y))));
    grid.appendChild(row('Breidd', numberInput(box.w, { min: 0.1, step: 1 },
      (v) => resize(ids, now(), v, null))));
    grid.appendChild(row('Høgd', numberInput(box.h, { min: 0.1, step: 1 },
      (v) => resize(ids, now(), null, v))));
    g.appendChild(grid);

    if (nodes.length === 1) {
      const id = nodes[0].id;
      const rotNow = () => RV.matrix.decompose(RV.state.worldMatrix(id)).rotation;
      g.appendChild(row('Rotasjon (°)', numberInput(Math.round(rotNow() * 10) / 10, { step: 1 }, (v) => {
        const b = now();
        const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
        RV.state.pushUndo();
        RV.state.applyWorld(id, RV.matrix.rotate(v - rotNow(), c.x, c.y));
        RV.hit.invalidate();
        RV.state.emit('nodes');
        build();
      })));
    }

    if (advanced) {
      g.appendChild(checkbox('Skaler strek med forma', RV.state.data.scaleStrokes, (on) => {
        RV.state.data.scaleStrokes = on;
      }));
    }

    parent.appendChild(g);
  }

  function moveTo(ids, dx, dy) {
    if (!dx && !dy) return;
    RV.state.pushUndo();
    const delta = RV.matrix.translate(dx, dy);
    ids.forEach(id => RV.state.applyWorld(id, delta));
    RV.hit.invalidate();
    RV.state.emit('nodes');
    build();
  }

  /**
   * Endrar storleik ved å skalere om det øvre venstre hjørnet av ramma.
   * Det er hjørnet brukaren les X og Y frå, så forma blir verande der
   * han trur ho er når han skriv inn ei ny breidd.
   */
  function resize(ids, box, width, height) {
    const sx = width == null ? 1 : (box.w ? Math.max(0.01, width) / box.w : 1);
    const sy = height == null ? 1 : (box.h ? Math.max(0.01, height) / box.h : 1);
    if (sx === 1 && sy === 1) return;
    RV.state.pushUndo();
    const delta = RV.matrix.scaleAround(sx, sy, box.x, box.y);
    ids.forEach(id => RV.state.applyWorld(id, delta));
    RV.hit.invalidate();
    RV.state.emit('nodes');
    build();
  }

  /* ──────────────── Synking under dra ──────────────── */

  /**
   * Oppdaterer tala utan å byggje panelet på nytt. Felt som har fokus
   * blir late i fred — brukaren står og skriv i dei.
   */
  function sync() {
    if (!bodyEl) return;
    const nodes = targets();
    if (!nodes.length) return;

    const box = RV.state.boundsOf(nodes.map(n => n.id));
    if (!box) return;

    const inputs = bodyEl.querySelectorAll('.rv-prop-grid input');
    const values = [box.x, box.y, box.w, box.h];
    inputs.forEach((input, i) => {
      if (input === document.activeElement || values[i] == null) return;
      input.value = RV.matrix.round(values[i]);
    });
  }

  return { attach, build, sync, fields };
})();
