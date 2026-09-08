/* ══════════════════════════════════════════════
   EXPORT-HTML.JS — Protokollen som éi sjølvstendig fil

   Ei HTML-fil med alt innhaldet og all stilen inni. Ho kan arkiverast, sendast
   på e-post og opnast av kven som helst utan spesialprogram — og ho ser lik ut
   om ti år, sidan ho ikkje hentar noko utanfrå.

   DETTE ER SVARET PÅ EIT KONKRET RÅD. Det irske datatilsynet fann protokollar
   som viste til dokument tilsynet ikkje hadde tilgang til, og slår fast at
   protokollen skal vere «a complete, self-contained document». Ei fil som ber
   alt ho treng er akkurat det.

   VI BYGGJER DEN SAME DOM-EN SOM UTSKRIFTA. `print.js` veit alt korleis ein
   protokoll ser ut på papir; her hentar vi den strukturen og pakkar han i eit
   dokument med stilen inni. To utgåver av same oppsettet ville drive frå
   kvarandre.

   XSS: all brukartekst går gjennom DOM-en, ikkje gjennom strengar. Vi les ut
   `innerHTML` frå eit tre som er bygd med `textContent` (AGENTS.md §5.3), så
   det som hamnar i fila er alt escapa av nettlesaren.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Stilen ligg her og ikkje i style.css, fordi fila skal stå åleine. Faste
     fargar, ingen temavariablar — mottakaren har ikkje Vyrdepil sitt tema. */
  const STIL = [
    ':root { color-scheme: light; }',
    'body { margin: 0; padding: 32px 20px 64px; background: #ffffff; color: #1a1a1a;',
    '  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.55; }',
    '.ark { max-width: 900px; margin: 0 auto 48px; }',
    'h1 { font-size: 1.7rem; margin: 0 0 4px; }',
    'h2 { font-size: 1.15rem; margin: 28px 0 8px; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; }',
    '.gd-ark-under { margin: 0 0 24px; color: #555; }',
    'table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }',
    'th, td { border: 1px solid #bbb; padding: 7px 9px; text-align: left; vertical-align: top;',
    '  font-size: 0.94rem; }',
    'th { width: 32%; background: #f2f2f2; font-weight: 700; }',
    '.gd-ark-krav { font-weight: 400; color: #666; font-size: 0.85em; }',
    '.gd-ark-tom { color: #999; font-style: italic; }',
    '.gd-ark-fot { margin-top: 28px; color: #666; font-size: 0.88rem; }',
    '.gd-ark-aktivitet { margin-bottom: 26px; }',
    '.merknad { max-width: 900px; margin: 0 auto 32px; padding: 12px 16px;',
    '  border: 2px solid #1a1a1a; background: #f7f7f7; font-size: 0.92rem; }',
    '@media print { body { padding: 0; } .ark + .ark { page-break-before: always; }',
    '  .gd-ark-aktivitet { page-break-inside: avoid; } @page { size: A4; margin: 14mm; } }'
  ].join('\n');

  function lastNed() {
    const u = GD.util;

    if (!GD.state.aktivitetar().length) {
      u.toast('Legg til minst éin behandlingsaktivitet først.', { kind: 'warn' });
      return;
    }

    /* Byggjer utskrifts-DOM-en og låner strukturen derifrå. */
    const omraade = GD.print.bygg();
    if (!omraade) return;

    const kropp = document.createElement('div');
    Array.prototype.forEach.call(omraade.children, function (ark) {
      const kopi = ark.cloneNode(true);
      kopi.className = 'ark';
      kropp.appendChild(kopi);
    });

    const data = GD.state.data;
    const tittel = (data.forside.verksemd || 'Protokoll') +
      ' — protokoll over behandlingsaktivitetar';

    /* `kropp.innerHTML` er trygt her: treet er bygd med `textContent` i
       print.js, så alt brukarinnhald er alt escapa av nettlesaren. Tittelen
       går gjennom escapeHtml, sidan han blir sett inn som streng. */
    const html = '<!DOCTYPE html>\n<html lang="nn">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + u.escapeHtml(tittel) + '</title>\n' +
      '<style>\n' + STIL + '\n</style>\n' +
      '</head>\n<body>\n' +
      '<div class="merknad">Denne fila er ein behandlingsprotokoll etter artikkel 30 nr. 1 i ' +
      'personvernforordninga. Ho står åleine og hentar ingenting utanfrå. ' +
      'Laga med Protokollsmia ' + new Date().toISOString().slice(0, 10) + '.</div>\n' +
      kropp.innerHTML + '\n</body>\n</html>\n';

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    u.downloadBlob(blob, u.slug(data.forside.verksemd || 'protokoll', 'protokoll') + '-artikkel30.html');
  }

  root.GD = root.GD || {};
  root.GD.exportHtml = { lastNed: lastNed, STIL: STIL };
})(window);
