/* ══════════════════════════════════════════════
   CLIP.JS — Maske: skjer eit objekt til ei form

   Den ØVSTE forma i markeringa blir malen, og alt under blir skore til
   henne. Det er same regel som i andre vektorprogram, og han er lett å
   hugse: du legg forma oppå det du vil skjere, og trykkjer.

   Vi brukar `clipPath` og ikkje `mask`. Skilnaden er at ein clipPath
   berre spør «er dette punktet innanfor?», medan ei maske brukar
   lysstyrken i maskeforma og kan gje mjuke overgangar. Klipping er
   det brukaren vanlegvis vil ha — ein hard kant — og resultatet blir
   ei mindre og lettare fil.

   Malen blir teken VARE PÅ inni maska. Slepp ein maska opp att, kjem
   ho tilbake som ei vanleg form, slik at ingenting går tapt.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.clip = (function () {
  'use strict';

  /**
   * Legg ei maske på det valde.
   * @returns {string|null} feilmelding, eller null
   */
  function apply() {
    const ids = RV.state.topSelection();
    if (ids.length < 2) return 'Vel forma du vil skjere med, og det som skal skjerast.';

    const order = RV.state.data.root.filter(id => ids.indexOf(id) !== -1);
    if (order.length !== ids.length) {
      return 'Formene må liggje på same nivå — løys opp gruppa først.';
    }

    const maskId = order[order.length - 1];      // den øvste er malen
    const mask = RV.state.get(maskId);
    if (mask.type === 'image' || mask.type === 'group') {
      return 'Bruk ei enkel form som mal — ikkje ei gruppe eller eit bilete.';
    }

    RV.state.pushUndo();

    /* Innhaldet blir samla i ei gruppe, og gruppa ber maska. Utan
       gruppa måtte kvar einskild form fått si eiga maske, og då ville
       dei blitt klipte kvar for seg — flyttar du éi av dei etterpå,
       ville ho hatt sitt eige utsnitt med seg. */
    const content = order.slice(0, -1);
    const at = RV.state.data.root.indexOf(content[0]);

    const holder = RV.state.makeNode('group', {});
    holder.name = 'Maska form';
    holder.fill = { type: 'none' };
    holder.stroke = { type: 'none' };
    RV.state.add(holder, null, at);

    content.forEach((id) => {
      RV.state.moveTo(id, holder.id, RV.state.listOf(holder.id).length);
    });

    // Malen blir teken ut av teikninga og lagra som maske på gruppa.
    // Han ber si eiga verdsmatrise, så han ligg der han låg.
    const world = RV.state.worldMatrix(maskId);
    const stored = JSON.parse(JSON.stringify(mask));
    stored.transform = world;
    RV.state.remove(maskId);

    holder.clip = stored;
    RV.state.setSelection([holder.id]);
    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
    return null;
  }

  /** Tek bort maska og gjev malen tilbake som ei vanleg form. */
  function release() {
    const nodes = RV.state.selectedNodes().filter(n => n.clip);
    if (!nodes.length) return 'Ingen av dei valde har ei maske.';

    RV.state.pushUndo();
    nodes.forEach((node) => {
      const stored = node.clip;
      delete node.clip;

      const back = JSON.parse(JSON.stringify(stored));
      back.id = RV.util.nextId('n');
      back.parent = null;
      // Malen låg i dokumentrommet; gruppa kan ha si eiga matrise, så
      // vi tek han tilbake til øvste nivå der han høyrer heime.
      RV.state.add(back, null);
    });

    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
    return null;
  }

  /** Har noko i markeringa ei maske? Styrer om knappen er aktiv. */
  function hasClip() {
    return RV.state.selectedNodes().some(n => n.clip);
  }

  /* ──────────────── Teikning ──────────────── */

  /**
   * Byggjer clipPath-elementa for alle maskerte nodar.
   * Kalla frå render.js medan defs blir bygde.
   */
  function buildClips(defsEl) {
    RV.state.walk((node) => {
      if (!node.clip) return;

      const path = RV.util.svg('clipPath', {
        id: 'clip-' + node.id,
        clipPathUnits: 'userSpaceOnUse'
      });

      const shape = RV.util.svg('path', {
        d: RV.geom.toPathData(
          RV.geom.transformSubpaths(RV.geom.toSubpaths(node.clip), node.clip.transform))
      });
      path.appendChild(shape);
      defsEl.appendChild(path);
    });
  }

  /** Ramma til maska, i nodens eige rom — avgrensar det som er synleg. */
  function clipBounds(node) {
    if (!node.clip) return null;
    const subpaths = RV.geom.toSubpaths(node.clip);
    if (!subpaths.length) return null;
    return RV.geom.boundsOfSubpaths(
      RV.geom.transformSubpaths(subpaths, node.clip.transform));
  }

  return { apply, release, hasClip, buildClips, clipBounds };
})();
