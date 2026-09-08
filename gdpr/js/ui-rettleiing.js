/* ══════════════════════════════════════════════
   UI-RETTLEIING.JS — Forklaringane under kvart felt

   Dette er det Protokollsmia er til for. Eit rekneark kan vise deg nitten
   kolonneoverskrifter; det kan ikkje fortelje deg kvifor kolonnen står der,
   kva eit godt svar ser ut som, eller kva eit tilsyn har hatt innvendingar mot.

   RETTLEIINGA ER KOLLAPSA SOM STANDARD. Nitten opne forklaringar samtidig er
   ein vegg, og den som har fylt ut protokollen før treng dei ikkje. Ho ligg bak
   ein «Kvifor spør vi om dette?»-knapp per felt — synleg nok til å bli funnen,
   stille nok til ikkje å vere i vegen.

   <details> og <summary> gjer jobben utan JavaScript: tastatur, skjermlesar og
   utskrift fungerer av seg sjølv. Designsystemet har alt `.accordion-box` for
   akkurat dette mønsteret.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const U = function () { return GD.util; };

  /**
   * Hektar rettleiing på alle felt som har ein krok. Kallast etter kvar
   * teikning av skjemaet, og er trygg å kalle når rettleiinga ikkje er lasta.
   */
  function hekt(rot) {
    if (!GD.innhald.harRettleiing()) return;
    const kroker = (rot || document).querySelectorAll('.gd-felt-under[data-felt]');
    Array.prototype.forEach.call(kroker, function (krok) {
      if (krok.querySelector('.gd-rettleiing')) return;
      const r = GD.innhald.forFelt(krok.dataset.felt);
      if (!r) return;
      krok.appendChild(blokk(r));
    });
  }

  function blokk(r) {
    const u = U();
    const d = u.el('details', 'accordion-box gd-rettleiing');
    const s = u.el('summary', null, 'Kvifor spør vi om dette?');
    d.appendChild(s);

    const kropp = u.el('div', 'accordion-body');

    if (r.kort) kropp.appendChild(u.el('p', 'gd-rettleiing-kort', r.kort));
    if (r.kvifor) kropp.appendChild(u.el('p', null, r.kvifor));

    if (r.dome && r.dome.length) {
      kropp.appendChild(u.el('h4', 'gd-rettleiing-tittel', 'Døme på gode svar'));
      const ul = u.el('ul', 'gd-dome');
      r.dome.forEach(function (t) { ul.appendChild(u.el('li', null, t)); });
      kropp.appendChild(ul);
    }

    if (r.feil && r.feil.length) {
      kropp.appendChild(u.el('h4', 'gd-rettleiing-tittel', 'Vanlege feil'));
      const ul = u.el('ul', 'gd-feil');
      r.feil.forEach(function (t) { ul.appendChild(u.el('li', null, t)); });
      kropp.appendChild(ul);
    }

    if (r.kjelde && r.kjelde.tekst) {
      const p = u.el('p', 'gd-kjelde');
      p.appendChild(document.createTextNode('Kjelde: '));
      if (r.kjelde.url) {
        const a = u.el('a', null, r.kjelde.tekst);
        a.href = r.kjelde.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        p.appendChild(a);
      } else {
        p.appendChild(document.createTextNode(r.kjelde.tekst));
      }
      kropp.appendChild(p);
    }

    d.appendChild(kropp);
    return d;
  }

  root.GD = root.GD || {};
  root.GD.uiRettleiing = { hekt: hekt };
})(window);
