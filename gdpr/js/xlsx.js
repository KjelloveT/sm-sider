/* ══════════════════════════════════════════════
   XLSX.JS — Ein liten OOXML-skrivar

   Skriv ei .xlsx-fil med JSZip. Han kjenner ingenting til GDPR — han tek ark
   med rader av strengar og gjev deg ein Blob. `export-xlsx.js` er den som veit
   kva ein behandlingsprotokoll er.

   KVIFOR IKKJE EIT BIBLIOTEK. Ei .xlsx-fil er ein ZIP med sju XML-filer, og
   JSZip ligg alt godkjend og sjølv-hosta i `_libs/` frå Bildebehandling og
   Vitjingsruta. Alternativet — SheetJS — er kring 900 kB mot 98 kB, ville vore
   ei ny avhengnad etter §5.6, og gjev oss ikkje det einaste vi eigentleg treng
   frå eit bibliotek: brytande tekst i celler. Cellestilar er ikkje med i
   community-utgåva deira, så vi hadde uansett måtta skrive `styles.xml` sjølve.

   Vurdert og forkasta: å skrive ZIP-en sjølv, utan JSZip. Det er kring 110
   linjer med ein CRC-32-tabell, men gjev berre STORE-komprimering (fila blir
   fem til ti gonger større), og ein CRC med éin bitfeil gjev ei fil Excel
   nektar å opne utan å seie kvifor. JSZip er gratis for oss.

   FALLGRUVENE, som alle er lærte på den harde måten av andre:

   1. UGYLDIGE XML-TEIKN VELTAR HEILE FILA. Tekst limt inn frå Word eller PDF
      ber jamleg vertikal tabulator, sideskift eller nullteikn. XML 1.0 forbyr
      heile C0-området unnateke tab, LF og CR, og eitt slikt teikn kvar som
      helst gjev «Vi fann eit problem med noko av innhaldet». I eit verktøy der
      heile poenget er at folk limer inn frå eit eksisterande dokument, er dette
      ikkje ein teoretisk risiko.

   2. `xml:space="preserve"` PÅ KVAR `<t>`. Eit textarea gjev nesten alltid eit
      avsluttande linjeskift, og det er kvitrom. Vi legg attributtet på alle —
      22 byte per celle som DEFLATE et opp.

   3. KOLONNEBOKSTAVAR ER BIJEKTIV BASE 26. 26 blir «Z», ikkje «A0». Med nitten
      kolonnar stoppar vi på «S» og ville aldri oppdaga feilen i testing.

   4. BARNEREKKJEFØLGJA ER EIN SEKVENS, IKKJE EIT VAL. I `<worksheet>` kjem
      `cols` FØR `sheetData`, og `autoFilter` ETTER. I `<workbook>` kjem
      `bookViews` før `sheets`. Feil rekkjefølgje får Excel til å be om å
      reparere fila — medan LibreOffice og Google Sheets opnar henne utan å seie
      noko, som er verre, for då rekk du å sende henne frå deg.

   5. `styles.xml` ER IKKJE VALFRI FOR OSS. Eit linjeskift i ei celle blir lagra
      utan henne, men berre TEIKNA når cella har `wrapText`. Utan fila blir ein
      lang sikringstiltak-tekst til éi linje. Og styles har eigne krav som kjem
      frå Excel og ikkje frå spesifikasjonen: `<fills>` må ha minst to, der
      indeks 1 er `gray125`, elles forskyv indeksane seg.

   6. INGEN AUTO-FIT. Formatet har det ikkje — Excel reknar breidder når EXCEL
      skriv fila. Breiddene må forfattast, og eininga er talet på teikn i breidda
      til det breiaste sifferet i standardfonten.

   7. JSZip BRUKAR STORE SOM STANDARD. `compression: 'DEFLATE'` må seiast.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ──────────────── JSZip på etterspurnad ────────────────
     Dei fleste som opnar Protokollsmia trykkjer aldri på «Last ned .xlsx».
     Same mønster som vitjingsruta/js/check.js brukar for jsQR. */

  let jszipLovnad = null;

  function lastJSZip() {
    if (root.JSZip) return Promise.resolve(root.JSZip);
    if (jszipLovnad) return jszipLovnad;
    jszipLovnad = new Promise(function (ok, feil) {
      const s = document.createElement('script');
      s.src = '../_libs/jszip/jszip.min.js';
      s.onload = function () {
        if (root.JSZip) ok(root.JSZip);
        else feil(new Error('JSZip lasta, men blei ikkje tilgjengeleg.'));
      };
      s.onerror = function () { feil(new Error('Fekk ikkje lasta zip-biblioteket.')); };
      document.head.appendChild(s);
    });
    return jszipLovnad;
  }

  /* ──────────────── Tekst ──────────────── */

  /* Fallgruve 1. Vaskar bort alt XML 1.0 ikkje tillèt, og einslege surrogat
     som ville gjeve ugyldig UTF-8. CR LF blir normalisert til LF så linjeskift
     tel likt uansett kvar teksten kjem frå. */
  const UGYLDIG = new RegExp(
    '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]', 'g');
  const EINSLEG_HOEG = new RegExp('[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])', 'g');
  const EINSLEG_LAAG = new RegExp('(^|[^\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]', 'g');

  function vask(tekst) {
    return String(tekst == null ? '' : tekst)
      .replace(/\r\n?/g, '\n')
      .replace(UGYLDIG, '')
      .replace(EINSLEG_HOEG, '')
      .replace(EINSLEG_LAAG, '$1');
  }

  function esc(tekst) {
    return vask(tekst)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Fallgruve 3. Bijektiv base 26: 1 = A, 26 = Z, 27 = AA. */
  function kolonnenamn(n) {
    let ut = '';
    while (n > 0) {
      const rest = (n - 1) % 26;
      ut = String.fromCharCode(65 + rest) + ut;
      n = Math.floor((n - 1) / 26);
    }
    return ut;
  }

  /* ──────────────── Delane ──────────────── */

  function contentTypes(talArk) {
    let ut = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    for (let i = 1; i <= talArk; i++) {
      ut += '<Override PartName="/xl/worksheets/sheet' + i +
        '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }
    return ut + '</Types>';
  }

  function rotRels() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';
  }

  /* Fallgruve 4: bookViews før sheets. */
  function workbook(ark) {
    let ut = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView/></bookViews><sheets>';
    ark.forEach(function (a, i) {
      /* Arknamn: maks 31 teikn, og ikkje kolon, skråstrek, spørjeteikn,
         stjerne eller hakeparentes. */
      const namn = esc(String(a.namn || ('Ark' + (i + 1)))
        .replace(/[:\\/?*[\]]/g, ' ').slice(0, 31));
      ut += '<sheet name="' + namn + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    });
    return ut + '</sheets></workbook>';
  }

  function workbookRels(talArk) {
    let ut = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (let i = 1; i <= talArk; i++) {
      ut += '<Relationship Id="rId' + i +
        '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + i + '.xml"/>';
    }
    /* Styles får ein id etter arka, så nummereringa ikkje kolliderer. */
    ut += '<Relationship Id="rId' + (talArk + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    return ut + '</Relationships>';
  }

  /* Fallgruve 5. Tre stilar:
       0 = vanleg
       1 = brytande tekst, toppjustert, ramme  (datacellene)
       2 = som 1, men feit og med grå fyll     (overskriftsrada)
     `fills` må ha none på 0 og gray125 på 1 — Excel går ut frå det. */
  function styles() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
        '<font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
        '<fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFE8E8E8"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="2">' +
        '<border/>' +
        '<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>' +
      '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">' +
          '<alignment vertical="top" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
          '<alignment vertical="top" wrapText="1"/></xf>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '<dxfs count="0"/><tableStyles count="0"/>' +
      '</styleSheet>';
  }

  /**
   * Eitt ark.
   * @param {object} ark { namn, rader: [[celle, ...], ...], breidder: [tal, ...],
   *                       harOverskrift: bool, frys: bool }
   */
  function sheet(ark) {
    const rader = ark.rader || [];
    const breidder = ark.breidder || [];
    const maksKol = rader.reduce(function (m, r) { return Math.max(m, r.length); }, 0);

    let ut = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

    /* Fallgruve 4: dimension, sheetViews, cols — så sheetData. */
    if (rader.length && maksKol) {
      ut += '<dimension ref="A1:' + kolonnenamn(maksKol) + rader.length + '"/>';
    }

    /* Frys overskriftsrada. Ein protokoll med tjue aktivitetar er umogleg å
       lese utan — du gløymer kva kolonne du er i etter tre rader. */
    if (ark.frys) {
      ut += '<sheetViews><sheetView workbookViewId="0">' +
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
        '</sheetView></sheetViews>';
    }

    if (breidder.length) {
      ut += '<cols>';
      breidder.forEach(function (b, i) {
        ut += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + b + '" customWidth="1"/>';
      });
      ut += '</cols>';
    }

    ut += '<sheetData>';
    rader.forEach(function (rad, ri) {
      /* Fallgruve 6-motstykket: INGEN ht/customHeight på datarader. Set vi
         høgda, held Excel henne og reknar ikkje ut plass til den brotne
         teksten. Utan begge har vi best sjanse for at radene blir høge nok. */
      ut += '<row r="' + (ri + 1) + '">';
      rad.forEach(function (celle, ki) {
        const verdi = vask(celle);
        if (!verdi) return;   /* tomme celler blir utelatne */
        const stil = (ark.harOverskrift && ri === 0) ? 2 : 1;
        ut += '<c r="' + kolonnenamn(ki + 1) + (ri + 1) + '" t="inlineStr" s="' + stil + '">' +
          '<is><t xml:space="preserve">' + esc(verdi) + '</t></is></c>';
      });
      ut += '</row>';
    });
    ut += '</sheetData>';

    /* Fallgruve 4: autoFilter kjem ETTER sheetData. */
    if (ark.harOverskrift && rader.length > 1 && maksKol) {
      ut += '<autoFilter ref="A1:' + kolonnenamn(maksKol) + rader.length + '"/>';
    }

    return ut + '</worksheet>';
  }

  /**
   * Byggjer arbeidsboka.
   * @param {Array} ark liste av arkobjekt, sjå sheet()
   * @returns {Promise<Blob>}
   */
  function bygg(ark) {
    return lastJSZip().then(function (JSZip) {
      const zip = new JSZip();

      /* [Content_Types].xml først. Ingen moderne lesar krev det, men det er
         gratis og er slik andre skrivarar gjer det. */
      zip.file('[Content_Types].xml', contentTypes(ark.length));
      zip.folder('_rels').file('.rels', rotRels());
      const xl = zip.folder('xl');
      xl.file('workbook.xml', workbook(ark));
      xl.file('styles.xml', styles());
      xl.folder('_rels').file('workbook.xml.rels', workbookRels(ark.length));
      const arkmappe = xl.folder('worksheets');
      ark.forEach(function (a, i) {
        arkmappe.file('sheet' + (i + 1) + '.xml', sheet(a));
      });

      /* Fallgruve 7. */
      return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    });
  }

  root.GD = root.GD || {};
  root.GD.xlsx = {
    bygg: bygg,
    sheet: sheet,
    kolonnenamn: kolonnenamn,
    vask: vask,
    esc: esc
  };
})(window);
