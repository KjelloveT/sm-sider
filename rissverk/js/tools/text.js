/* ══════════════════════════════════════════════
   TEXT.JS — Tekst på teikninga

   Teksten blir lagra som TEKST, ikkje som kurver. Han kan difor
   redigerast i morgon, og skrivefeil kan rettast utan å teikne bokstavane
   på nytt. Prisen er kjend og verdt å seie tydeleg frå om:

     Ei SVG-fil med tekst ser berre lik ut på ei maskin som har same
     fonten. Difor held vi oss til FONTAR SOM FINST OVERALT, og difor
     nemner vi det i grensesnittet når brukaren lagrar ein SVG med
     tekst i. Vil ein vere heilt trygg, er PNG svaret — der er
     bokstavane allereie teikna.

   Retningslinjene forbyr eksterne font-bibliotek, så lista er kuratert
   for hand: berre stablar der minst éin font finst på Windows, Mac,
   Linux og iOS/Android. Kvart val har eit fullt fallback-tre, slik at
   ein maskin som manglar førstevalet får noko som liknar i staden for
   nettlesaren sin standardfont.

   REDIGERING skjer i eit vanleg <textarea> som ligg oppå lerretet, i
   staden for at vi skriv vår eigen tekstmarkør inni SVG-en. Det gjev
   oss markørplassering, merking, angre, autofullføring, retteprogram og
   tastatur på nettbrett — alt saman ting vi elles måtte bygd sjølve, og
   som brukaren likevel ville venta seg.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

(function () {
  'use strict';

  /* Fontstablar som finst på alle vanlege maskiner. Namnet i UI-et er
     det brukaren ser; `stack` er det som hamnar i fila. */
  const FONTS = [
    { id: 'sans',   name: 'Grotesk',      stack: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif" },
    { id: 'serif',  name: 'Antikva',      stack: "Georgia, 'Times New Roman', Times, serif" },
    { id: 'mono',   name: 'Fastbreidd',   stack: "'Consolas', 'SF Mono', 'DejaVu Sans Mono', 'Courier New', monospace" },
    { id: 'round',  name: 'Rund',         stack: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" },
    { id: 'heavy',  name: 'Tung',         stack: "'Arial Black', 'Arial Bold', Impact, sans-serif" },
    { id: 'narrow', name: 'Smal',         stack: "'Arial Narrow', 'Helvetica Neue Condensed', 'Liberation Sans Narrow', sans-serif" }
  ];

  const ALIGN = [
    { value: 'start',  label: 'Venstre' },
    { value: 'middle', label: 'Midtstilt' },
    { value: 'end',    label: 'Høgre' }
  ];

  const DEFAULT_SIZE = 48;

  let editing = null;        // node-id som blir redigert
  let editor = null;         // <textarea> oppå lerretet
  let undoSnapshot = null;

  function fontStack(id) {
    const found = FONTS.find(f => f.id === id);
    return found ? found.stack : FONTS[0].stack;
  }

  /* ──────────────── Nye tekstnodar ──────────────── */

  function makeText(x, y) {
    const style = RV.state.data.style;
    const node = RV.state.makeNode('text', {
      x: x, y: y,
      text: '',
      font: 'sans',
      size: DEFAULT_SIZE,
      weight: 400,
      italic: false,
      align: 'start',
      lineHeight: 1.25
    });
    node.name = 'Tekst';
    // Tekst utan fyll er usynleg, og strek på tekst er sjeldan det ein vil.
    node.fill = (style.fill && style.fill.type !== 'none')
      ? JSON.parse(JSON.stringify(style.fill))
      : { type: 'solid', color: '#1a1a1a', opacity: 1 };
    node.stroke = { type: 'none' };
    return node;
  }

  /* ──────────────── Peikar ──────────────── */

  function onDown(ctx) {
    // Klikk på ein tekst som finst frå før: rediger han i staden for å
    // leggje ein ny oppå.
    const hit = RV.hit.nodeAt(ctx.x, ctx.y);
    if (hit && hit.type === 'text') {
      RV.state.setSelection([hit.id]);
      RV.state.emit('selection');
      beginEdit(hit.id);
      return;
    }

    undoSnapshot = RV.state.snapshot();
    const at = RV.snap.point(RV.view.snapPoint({ x: ctx.x, y: ctx.y }), ctx.ctrl);
    const node = makeText(at.x, at.y);
    RV.state.add(node, null);
    RV.state.setSelection([node.id]);
    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
    beginEdit(node.id);
  }

  /* ──────────────── Redigering ──────────────── */

  /**
   * Legg eit textarea nøyaktig oppå der teksten står, med same font,
   * storleik og farge. Illusjonen treng ikkje vere perfekt — brukaren
   * ser at han skriv, og teksten under blir oppdatert medan han gjer det.
   */
  function beginEdit(id) {
    endEdit();
    const node = RV.state.get(id);
    if (!node || node.type !== 'text') return;

    editing = id;
    if (!undoSnapshot) undoSnapshot = RV.state.snapshot();

    editor = RV.util.el('textarea', 'rv-text-editor');
    editor.value = node.geom.text;
    editor.spellcheck = false;
    editor.setAttribute('aria-label', 'Skriv teksten');
    document.getElementById('stage').appendChild(editor);

    place();
    editor.focus();
    editor.select();

    editor.addEventListener('input', () => {
      const live = RV.state.get(editing);
      if (!live) return;
      live.geom.text = editor.value;
      RV.hit.invalidate();
      RV.state.emit('nodes');
      place();
    });

    editor.addEventListener('keydown', (e) => {
      e.stopPropagation();                    // hurtigtastane skal ligge i ro
      // Escape og Ctrl+Enter avsluttar. Vanleg Enter gjev ny linje —
      // tekst i ei teikning er ofte fleire linjer.
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        endEdit();
        RV.tools.setActive('select');
      }
    });

    editor.addEventListener('blur', () => endEdit());
    RV.state.emit('hover');
  }

  /** Held redigeringsfeltet oppå teksten når ein zoomar eller panorerer. */
  function place() {
    if (!editor || !editing) return;
    const node = RV.state.get(editing);
    if (!node) return;

    const m = RV.overlay.screenMatrix(editing);
    const at = RV.matrix.apply(m, node.geom.x, node.geom.y);
    const scale = RV.matrix.meanScale(m);
    const size = node.geom.size * scale;

    Object.assign(editor.style, {
      left: at.x + 'px',
      top: (at.y - size) + 'px',
      font: (node.geom.italic ? 'italic ' : '') + node.geom.weight + ' ' +
            size + 'px/' + node.geom.lineHeight + ' ' + fontStack(node.geom.font),
      textAlign: node.geom.align === 'middle' ? 'center' :
                 (node.geom.align === 'end' ? 'right' : 'left'),
      transform: node.geom.align === 'middle' ? 'translateX(-50%)' :
                 (node.geom.align === 'end' ? 'translateX(-100%)' : 'none'),
      width: Math.max(80, editor.scrollWidth + size) + 'px',
      height: Math.max(size * 1.4, editor.scrollHeight) + 'px'
    });
  }

  function endEdit() {
    if (!editor) return;

    const node = editing ? RV.state.get(editing) : null;
    const el = editor;
    editor = null;                            // hindrar at blur køyrer om att
    if (el.parentNode) el.parentNode.removeChild(el);

    // Ein tom tekstnode er eit uhell, ikkje eit objekt.
    if (node && !node.geom.text.trim()) {
      RV.state.remove(node.id);
      RV.state.clearSelection();
    } else if (undoSnapshot) {
      RV.state.pushUndoSnapshot(undoSnapshot);
    }

    editing = null;
    undoSnapshot = null;
    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
  }

  function isEditing() {
    return !!editor;
  }

  /* Zoom og panorering flyttar teksten under feltet. */
  RV.state.onChange((topic) => {
    if (editor && (topic === 'view' || topic === 'nodes')) place();
  });

  RV.tools.register({
    id: 'text',
    name: 'Tekst',
    hint: 'Klikk på flata og skriv. Klikk på ein tekst som finst for å endre han. Escape eller Ctrl+Enter avsluttar.',
    icon: 'type',
    key: 't',
    level: 'advanced',
    cursor: 'text',
    onDown: onDown,
    onCancel: endEdit,
    onLeave: endEdit
  });

  RV.text = { FONTS, ALIGN, fontStack, beginEdit, endEdit, isEditing, DEFAULT_SIZE };
})();
