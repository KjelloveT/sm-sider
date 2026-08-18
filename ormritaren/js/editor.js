/* Ormritaren — kodeeditoren.
 *
 * CodeMirror 5 (UMD, sjølvhosta i _libs/). Temafargane kjem ikkje frå
 * designsystemet, så dei er sette for hand i css/style.css mot dei same
 * CSS-variablane — elles blir koden uleseleg i mørkt tema.
 */
const OrmEditor = (function () {

    /* Norske nettbrett-tastatur gøymer desse bak fleire trykk. Utan denne rada
     * er Ormritaren i praksis ubrukeleg på iPad, som er den vanlegaste eininga
     * i norsk grunnskule. */
    const SYMBOL = ['    ', ':', '(', ')', '[', ']', '{', '}', '"', "'", '=', '<', '>', '+', '-', '*', '/', '#', '_', '.', ','];

    let cm = null;
    let visForslag = null;

    function lag(textarea, symbolrad, veKoyr) {
        cm = CodeMirror.fromTextArea(textarea, {
            mode: 'python',
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            matchBrackets: true,
            autoCloseBrackets: true,
            styleActiveLine: true,
            lineWrapping: true,
            extraKeys: {
                'Ctrl-Enter': veKoyr,
                'Cmd-Enter': veKoyr,
                'Ctrl-Space': () => visForslag && visForslag(),
                'Alt-Space': () => visForslag && visForslag(),
                'Ctrl-/': (c) => c.toggleComment(),
                'Cmd-/': (c) => c.toggleComment(),
                // Tab skal rykkje inn, ikkje hoppe ut av editoren — men berre
                // når noko er markert eller vi står i innrykket, elles fangar
                // vi tastaturnavigasjon for dei som ikkje bruker mus.
                Tab: (c) => {
                    if (c.somethingSelected()) c.indentSelection('add');
                    else c.replaceSelection('    ', 'end');
                },
                'Shift-Tab': (c) => c.indentSelection('subtract'),
                Esc: (c) => c.getInputField().blur()
            }
        });

        byggSymbolrad(symbolrad);
        // typeof, ikkje window.OrmForslag: modulane her er deklarerte med
        // const, og då hamnar dei i det globale leksikalske skopet — ikkje
        // som ein eigenskap på window.
        if (typeof OrmForslag !== 'undefined') visForslag = OrmForslag.kople(cm);
        return cm;
    }

    function byggSymbolrad(rad) {
        if (!rad) return;
        SYMBOL.forEach(teikn => {
            const knapp = document.createElement('button');
            knapp.type = 'button';
            knapp.className = 'orm-symbol';
            knapp.textContent = teikn === '    ' ? '⇥' : teikn;
            knapp.setAttribute('aria-label',
                teikn === '    ' ? 'Innrykk (fire mellomrom)' : `Set inn ${teikn}`);
            // mousedown i staden for click: elles mistar editoren fokus fyrst,
            // og markøren hoppar til starten av dokumentet på mobil.
            knapp.addEventListener('mousedown', (e) => {
                e.preventDefault();
                cm.replaceSelection(teikn, 'end');
                cm.focus();
            });
            rad.appendChild(knapp);
        });
    }

    const hent = () => (cm ? cm.getValue() : '');
    const set = (kode) => { if (cm) { cm.setValue(kode || ''); cm.clearHistory(); } };

    function markerFeillinje(linje) {
        if (!cm) return;
        reinsk();
        if (!linje || linje < 1 || linje > cm.lineCount()) return;
        cm.addLineClass(linje - 1, 'background', 'orm-feillinje');
        cm.scrollIntoView({ line: linje - 1, ch: 0 }, 80);
    }

    function reinsk() {
        if (!cm) return;
        for (let i = 0; i < cm.lineCount(); i++) {
            cm.removeLineClass(i, 'background', 'orm-feillinje');
            cm.removeLineClass(i, 'background', 'orm-nylinje');
            cm.removeLineClass(i, 'background', 'orm-koyrelinje');
        }
    }

    /** Markerer linja som står for tur i stegvis køyring. */
    function markerKoyrelinje(linje) {
        if (!cm) return;
        for (let i = 0; i < cm.lineCount(); i++) {
            cm.removeLineClass(i, 'background', 'orm-koyrelinje');
        }
        if (!linje || linje < 1 || linje > cm.lineCount()) return;
        cm.addLineClass(linje - 1, 'background', 'orm-koyrelinje');
        cm.scrollIntoView({ line: linje - 1, ch: 0 }, 90);
    }

    /** Markerer linjene som kom til i dette steget av ein kodeløype. */
    function markerNyeLinjer(linjer) {
        if (!cm || !linjer?.length) return;
        reinsk();
        linjer.forEach(i => {
            if (i >= 0 && i < cm.lineCount()) cm.addLineClass(i, 'background', 'orm-nylinje');
        });
        cm.scrollIntoView({ line: linjer[0], ch: 0 }, 80);
    }

    function setSkrift(px) {
        const flate = cm && cm.getWrapperElement();
        if (flate) { flate.style.fontSize = px + 'px'; cm.refresh(); }
    }

    return { lag, hent, set, markerFeillinje, markerNyeLinjer, markerKoyrelinje,
             reinsk, setSkrift, cm: () => cm };
})();
