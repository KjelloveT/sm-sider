/* ══════════════════════════════════════════════
   CHECK.JS — Er koden lesbar?

   To lag, og skilnaden mellom dei er poenget.

   Reglane under er tommelfingerreglar: kontrast, stillesone, logostorleik,
   modulmellomrom. Dei fangar det meste og kostar ingenting.

   Dekodinga er noko anna. Ho tek den FERDIGE koden — med runde modular,
   logo og fargeovergang — teiknar han i den storleiken han truleg blir
   vist i, og les han tilbake. Står det same teksten der, veit vi at han
   let seg lese. Reglar kan seie «dette bør gå bra». Berre dekodinga kan
   seie «dette gjekk bra».

   jsQR blir henta først når nokon spør. Han er 257 kB, og dei fleste som
   lagar ein QR-kode gjer det på ti sekund utan å trykkje på noko.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.check = (function () {
  'use strict';

  const L = VR.design.LIMITS;

  /* ──────────────── Reglane ──────────────── */

  /**
   * @returns {{level: 'ok'|'warn'|'bad', notes: Array<{level, text}>}}
   */
  function rules(qr, design, logo) {
    const notes = [];
    const d = design;

    /* Kontrast. Ein gradient blir vurdert på den svakaste av dei to endane. */
    if (!d.bg.transparent) {
      const inks = d.fill.type === 'solid' ? [d.fill.color] : [d.fill.color, d.fill.color2];
      if (!d.eye.sameColor) inks.push(d.eye.color);
      let worst = 21, worstInk = inks[0];
      inks.forEach((ink) => {
        const c = VR.util.contrast(ink, d.bg.color);
        if (c < worst) { worst = c; worstInk = ink; }
      });
      if (worst < 2.5) {
        notes.push({ level: 'bad', short: 'For lite skilnad mellom prikkfarge og bakgrunn.', text: 'Altfor lite skilnad mellom prikkfarge og bakgrunn (' + worst.toFixed(1) + ':1). Koden blir ikkje lesen.' });
      } else if (worst < L.contrastMin) {
        notes.push({ level: 'warn', short: 'Låg kontrast mot bakgrunnen — kan svikte på papir.', text: 'Låg kontrast mellom ' + worstInk + ' og bakgrunnen (' + worst.toFixed(1) + ':1). Han kan svikte på papir og i dårleg lys.' });
      }

      /* Invertert kode: lyse modular på mørk botn. Kontrasten kan vere
         perfekt og koden likevel ulesbar, fordi ein del skannarar leitar
         etter mørkt på lyst og ikkje snur på det. */
      const inkLum = VR.util.luminance(d.fill.color);
      const bgLum = VR.util.luminance(d.bg.color);
      if (inkLum > bgLum) {
        notes.push({ level: 'warn', short: 'Lyse prikkar på mørk botn — eldre skannarar slit.', text: 'Koden er invertert — lyse prikkar på mørk botn. Nyare telefonar klarer det; eldre skannarar gjer det ofte ikkje.' });
      }
    } else {
      notes.push({ level: 'warn', short: 'Gjennomsiktig botn — legg koden på ei lys, roleg flate.', text: 'Gjennomsiktig bakgrunn. Koden må leggjast på ei lys, roleg flate — eit mønster bak gjer han ulesbar.' });
    }

    /* Stillesona. */
    if (d.quiet < L.quietMin) {
      notes.push({
        level: d.quiet < 2 ? 'bad' : 'warn',
        short: 'For lite luft rundt koden (stillesona er ' + d.quiet + ' av 4).',
        text: 'Stillesona er ' + d.quiet + ' modular. Standarden krev 4 — utan luft rundt finn ikkje skannaren kanten på koden.'
      });
    }

    /* Mellomrom mellom modulane. */
    if (d.module.gap > 0.09) {
      notes.push({ level: 'warn', short: 'Mykje luft mellom prikkane.', text: 'Mykje luft mellom prikkane. Over ti prosent byrjar skannarar å lese dei som skilde prikkar.' });
    }

    /* Augene er den mest utsette delen av heile designet. Skannaren finn
       koden ved å måle forholdet 1:1:3:1:1 tvers over dei tre hjørna, og
       kvar form som ikkje er kvadratisk endrar det talet. Vi måler ikkje
       kor gale det er — det er nettopp difor lesbarheitssjekken finst. */
    if (d.eye.frame !== 'square' || d.eye.pupil !== 'square') {
      notes.push({
        level: 'info',
        short: 'Hjørnemerka har eiga form.',
        text: 'Hjørnemerka har eiga form. Det er den delen av designet skannaren er mest kresen på.'
      });
    }

    /* Logoen. */
    if (logo) {
      const pct = Math.round(d.logo.size * 100);
      if (d.logo.size > L.logoDanger) {
        notes.push({ level: 'bad', short: 'Logoen dekkjer ' + pct + ' % — det er for mykje.', text: 'Logoen dekkjer ' + pct + ' % av koden. I målingane våre slutta koden å la seg lese mellom 25 og 30 % — sjølv med utsparing og feilretting H.' });
      } else if (d.logo.size > L.logoWarn) {
        notes.push({ level: 'warn', short: 'Logoen dekkjer ' + pct + ' % — over det vi har målt som trygt.', text: 'Logoen dekkjer ' + pct + ' %. Det er over det vi har målt som trygt (25 %).' });
      }
      if (qr.ecc === 'L' || qr.ecc === 'M') {
        notes.push({ level: 'warn', short: 'Logo på feilrettingsnivå ' + qr.ecc + ' — vel Q eller H.', text: 'Logo på feilrettingsnivå ' + qr.ecc + '. Vel Q eller H — logoen et prikkar, og feilrettinga er det einaste som veg opp.' });
      }
      /* Eit auge som er delvis dekt gjer koden ubrukeleg: skannaren finn
         ikkje koden i det heile utan alle tre. */
      const box = VR.render.plateBox(qr, d, 0, 0);
      const near = box.x < 8 || box.y < 8 ||
        box.x + box.size > qr.size - 8 || box.y + box.size > qr.size - 8;
      if (near) {
        notes.push({ level: 'bad', short: 'Logoen dekkjer eit hjørnemerke.', text: 'Logoen kjem borti eit av hjørnemerka. Utan alle tre finn ikkje skannaren koden.' });
      }
    }

    /* «info» seier noko verdt å vite, men senkjer ikkje karakteren. */
    let level = 'ok';
    notes.forEach((x) => {
      if (x.level === 'bad') level = 'bad';
      else if (x.level === 'warn' && level !== 'bad') level = 'warn';
    });
    /* Den eine merknaden som er verdt plass i statusfeltet. */
    const worstNote =
      notes.filter(x => x.level === 'bad')[0] ||
      notes.filter(x => x.level === 'warn')[0] || null;

    return { level: level, notes: notes, worst: worstNote };
  }

  /* ──────────────── Dekoding ──────────────── */

  let jsqrPromise = null;

  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (jsqrPromise) return jsqrPromise;
    jsqrPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '../_libs/jsqr/jsQR.js';
      s.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR lasta ikkje.'));
      s.onerror = () => reject(new Error('Fekk ikkje lasta lesaren.'));
      document.head.appendChild(s);
    });
    return jsqrPromise;
  }

  /**
   * Teiknar scena i eit par realistiske storleikar og prøver å lese henne.
   * Den vesle storleiken er den harde prøven: ein kode på eit ark blir
   * ofte skanna frå avstand, og då har kvar modul få pikslar å gå på.
   *
   * @returns {Promise<{ok: boolean, sizes: Array<{px: number, ok: boolean}>, text: string|null}>}
   */
  async function decode(scene, expected) {
    const jsQR = await loadJsQR();
    /* Tre storleikar som spenner over det ein kode faktisk blir lesen i:
       ein liten på eit ark, ein på skjerm, og ein stor på ein plakat. */
    const sizes = [220, 512, 1024];
    const results = [];
    let text = null;

    for (let i = 0; i < sizes.length; i++) {
      const canvas = VR.canvasRender.toCanvas(scene, sizes[i]);
      const ctx = canvas.getContext('2d');
      /* Ein gjennomsiktig bakgrunn blir svart i ImageData. Vi legg på kvitt
         under, slik ein skannar ville sett koden på eit ark. */
      if (!scene.bg) {
        const flat = document.createElement('canvas');
        flat.width = canvas.width; flat.height = canvas.height;
        const fctx = flat.getContext('2d');
        fctx.fillStyle = '#ffffff';
        fctx.fillRect(0, 0, flat.width, flat.height);
        fctx.drawImage(canvas, 0, 0);
        const dataFlat = fctx.getImageData(0, 0, flat.width, flat.height);
        const rFlat = jsQR(dataFlat.data, flat.width, flat.height);
        if (rFlat && text == null) text = rFlat.data;
        results.push({ px: sizes[i], ok: !!rFlat && rFlat.data === expected });
        continue;
      }
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const r = jsQR(data.data, canvas.width, canvas.height);
      if (r && text == null) text = r.data;
      results.push({ px: sizes[i], ok: !!r && r.data === expected });
    }

    return {
      ok: results.every(x => x.ok),
      sizes: results,
      text: text
    };
  }

  return { rules, decode };
})();
