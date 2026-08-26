/* ══════════════════════════════════════════════
   LAERARBANER.JS — Banene læraren har laga, på framsida av Ljodstigen

   EIN EIGEN SEKSJON, IKKJE BLANDA INN I PROGRESJONEN. Desse banene er
   alltid opne, uavhengig av kor langt eleven er komen: ein elev som har
   låst opp lite skal likevel kunne spele det læraren laga til nettopp
   han. Dei rører ikkje stjernene eller opplåsinga i dei innebygde
   verdene.

   Seksjonen er heilt borte når det ikkje finst nokon slike baner — ei
   tom overskrift fortel eleven ingenting.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const TYPE = {
    lyd: 'Finn bokstaven du høyrer',
    rekkje: 'Fleire bokstavar etter kvarandre',
    ord: 'Samle eit heilt ord'
  };

  function vis() {
    const vert = document.getElementById('laerarbaner');
    if (!vert || !root.JaktaEigne) return;
    const alle = JaktaEigne.alle();
    const seksjon = vert.closest ? vert.closest('[data-laerarbaner]') : null;
    if (seksjon) seksjon.hidden = !alle.length;
    vert.innerHTML = '';

    alle.forEach(function (b) {
      const a = document.createElement('a');
      a.className = 'ljod-mode';
      a.href = 'jakta.html?bane=eigen:' + encodeURIComponent(b.id);

      const t = document.createElement('span');
      t.className = 'ljod-mode-title';
      t.textContent = b.namn;
      a.appendChild(t);

      const b2 = document.createElement('span');
      b2.className = 'ljod-mode-blurb';
      b2.textContent = TYPE[b.type] || TYPE.lyd;
      a.appendChild(b2);

      vert.appendChild(a);
    });
  }

  root.LjodLaerarbaner = { vis: vis };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', vis);
  } else { vis(); }
})(window);
