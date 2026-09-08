/* ══════════════════════════════════════════════
   VYRDEPIL — elevlister
   ══════════════════════════════════════════════

   Éin stad der elevnamn blir henta frå Flokkdeilar og Klassekart, reinska og
   viste fram. Før denne fila låg same logikken i tre utgåver — i
   `leitekryss/js/names.js`, `ordkryss/js/names.js` og inne i
   `tidvis/js/export.js` — som skilde seg berre på klasseprefiks og eit par
   setningar. Ei retting måtte gjerast tre stader for å telje.

   **Kvifor akkurat denne biten er verd ein fellesmodul:** elevnamn er den
   einaste datatypen i heile Vyrdepil som faktisk er personopplysningar om
   born. Å ha éin stad der dei blir lesne, kopierte og tømde er like mykje eit
   personverngrep som eit kodegrep — det er der ei framtidig sletteknapp eller
   ei innstramming skal gjerast, og då skal ho gjelde alle verktøy med ein
   gong.

   **Namna blir kopierte, ikkje kopla.** Hentar eit verktøy ei liste, tek det
   ein augeblinkskopi. Endrar læraren lista i Flokkdeilar etterpå, følgjer ikkje
   endringa med. Det er med vilje: eit ferdig utskrive ark skal ikkje kunne
   endre seg under føtene på den som skreiv det ut.

   Bruk:

     <script src="../js/vyrdepil-util.js"></script>
     <script src="../js/vyrdepil-elevlister.js"></script>

   Modulen krev `VyrdepilStorage` og `Vy` (vyrdepil-util.js), og `ICON` frå
   `vyrdepil-icons.js` dersom du brukar `lagVeljar()`.
   ══════════════════════════════════════════════ */

window.VyrdepilElevlister = (function () {
    'use strict';

    /* ──────────────── Data ──────────────── */

    /** Ein elev kan vere lagra som `{ name }` eller som ein rein streng. */
    function namnAv(s) {
        return (s && s.name) || s;
    }

    /**
     * Trimmar, fjernar tomme og dublettar, og held rekkjefølgja.
     *
     * Dublettar er ikkje eit teoretisk problem: to elevar med same fornamn i
     * same klasse er heilt vanleg, men same NAMN to gonger i lista kjem alltid
     * av ein tastefeil eller ei dobbel innliming, og gjev eit ark for mykje.
     *
     * @param {Array<string|{name:string}>} list
     * @returns {string[]}
     */
    function reinsk(list) {
        const sedd = new Set();
        const ut = [];
        (list || []).forEach(function (raw) {
            const namn = String(namnAv(raw) || '').trim();
            if (!namn || sedd.has(namn)) return;
            sedd.add(namn);
            ut.push(namn);
        });
        return ut;
    }

    /** «1 elev» / «7 elevar». */
    function tel(n) {
        return n + (n === 1 ? ' elev' : ' elevar');
    }

    /** Klasselister frå Flokkdeilar. */
    function fraaFlokkdeilar() {
        return VyrdepilStorage.getList('flokkdeilar', 'lister').map(function (item) {
            return {
                label: item.name || 'Utan namn',
                source: 'Flokkdeilar',
                names: reinsk(item.students || [])
            };
        });
    }

    /**
     * Frå Klassekart: både dei lagra oppsetta og fanene som står opne no.
     * Dei opne fanene er med fordi ein lærar som nettopp har sett opp klassen
     * sjeldan har trykt «lagre» enno — og då er lista han vil bruke nettopp
     * den han ser på skjermen.
     */
    function fraaKlassekart() {
        const ut = [];
        VyrdepilStorage.getList('klassekart', 'oppsett').forEach(function (item) {
            ut.push({
                label: item.name || 'Utan namn',
                source: 'Klassekart',
                names: reinsk((item.data && item.data.students) || [])
            });
        });
        const state = VyrdepilStorage.getGameState('klassekart');
        ((state && state.tabs) || []).forEach(function (tab) {
            ut.push({
                label: (tab.name || 'Fane') + ' (open fane)',
                source: 'Klassekart',
                names: reinsk((tab.data && tab.data.students) || [])
            });
        });
        return ut;
    }

    /**
     * Alle klasselister vi finn i denne nettlesaren, tomme lister utelatne.
     *
     * Feilar oppslaget — gammal datastruktur, full lagring, privat modus —
     * gjev vi tom liste i staden for å kaste. Verktøyet skal framleis kunne
     * brukast med innliming når Flokkdeilar er tomt.
     *
     * @returns {Array<{label:string, source:string, names:string[]}>}
     */
    function kjelder() {
        let lister = [];
        try {
            lister = fraaFlokkdeilar().concat(fraaKlassekart());
        } catch (e) {
            lister = [];
        }
        return lister.filter(function (l) { return l.names.length; });
    }

    /* ──────────────── Veljaren ──────────────── */

    /**
     * Byggjer den vanlege «hent elevnamn»-dialogen: ei liste over
     * klasselister i nettlesaren, og eit felt for å lime inn namn.
     *
     * Verktøyet eig sjølve markupen (id-ane under) og får eit lite objekt
     * attende til å styre han med. Grunnen til at dialogen er delt, men ikkje
     * HTML-en, er at klasseprefikset og hjelpeteksten skil seg frå verktøy til
     * verktøy — og ein modul som tek tjue klassenamn som parameter er ikkje
     * enklare enn den han erstattar.
     *
     * @param {object} o
     * @param {string} o.prefix        klasseprefiks i verktøyet, t.d. 'lk' eller 'ok'
     * @param {object} o.dom           elementa: openBtn, clearBtn, info, chips,
     *                                 overlay, sources, paste, pasteConfirm, cancel, close
     * @param {function(string[],string)} o.onApply  kalla med (namn, kjeldetekst)
     * @param {function():{names:string[], source:string}} o.read  gjeldande tilstand
     * @param {string} [o.emptyText]   tekst når ingen namn er valde
     * @param {string} [o.filledText]  hale på teksten når namn ER valde
     * @returns {{open:function, render:function}}
     */
    function lagVeljar(o) {
        const p = o.prefix;
        const dom = o.dom;
        const el = Vy.el;

        function open() {
            dom.sources.textContent = '';
            const lister = kjelder();

            if (!lister.length) {
                dom.sources.appendChild(el('p', p + '-muted',
                    'Fann ingen klasselister i Flokkdeilar eller Klassekart i denne ' +
                    'nettlesaren. Du kan lime inn namn nedanfor.'));
            } else {
                dom.sources.appendChild(el('span', p + '-field-label', 'Klasselister i nettlesaren'));
                lister.forEach(function (liste) {
                    const rad = el('div', p + '-source-row');
                    const tekst = el('div', p + '-source-text');
                    tekst.appendChild(el('strong', null, liste.label));
                    tekst.appendChild(el('span', p + '-muted',
                        ' ' + liste.source + ' · ' + tel(liste.names.length)));
                    rad.appendChild(tekst);

                    const knapp = el('button', 'btn ' + p + '-btn-small');
                    knapp.type = 'button';
                    const ikon = el('span');
                    /* ICON() gjev fast SVG-markup frå vår eigen modul. */
                    if (typeof window.ICON === 'function') ikon.innerHTML = window.ICON('users', 16);
                    knapp.appendChild(ikon);
                    knapp.appendChild(document.createTextNode('Bruk'));
                    knapp.addEventListener('click', function () {
                        bruk(liste.names, liste.source + ': ' + liste.label);
                        Vy.closeModal(dom.overlay);
                    });
                    rad.appendChild(knapp);
                    dom.sources.appendChild(rad);
                });
            }
            Vy.openModal(dom.overlay);
        }

        function limInn() {
            const namn = reinsk(dom.paste.value.split(/\r?\n/));
            if (!namn.length) {
                Vy.toast('Skriv minst eitt namn.');
                return;
            }
            bruk(namn, 'Innliming');
            dom.paste.value = '';
            Vy.closeModal(dom.overlay);
        }

        function bruk(namn, kjelde) {
            o.onApply(namn, namn.length ? kjelde : '');
            if (namn.length) Vy.toast('Henta ' + namn.length + ' namn.');
        }

        function render() {
            const s = o.read();
            const namn = s.names || [];
            dom.chips.textContent = '';
            dom.clearBtn.hidden = !namn.length;

            if (!namn.length) {
                dom.info.textContent = o.emptyText ||
                    'Utan namn blir det eitt ark med blank namnelinje. Hentar du namn, ' +
                    'får kvar elev sitt eige ark.';
                return;
            }
            dom.info.textContent = tel(namn.length) + ' · kjelde: ' +
                (s.source || 'ukjend') + '. ' + (o.filledText || 'Kvar elev får eit ferdig namngjeve ark.');
            namn.forEach(function (n) {
                dom.chips.appendChild(el('span', p + '-chip', n));
            });
        }

        dom.openBtn.addEventListener('click', open);
        dom.cancel.addEventListener('click', function () { Vy.closeModal(dom.overlay); });
        dom.close.addEventListener('click', function () { Vy.closeModal(dom.overlay); });
        dom.pasteConfirm.addEventListener('click', limInn);
        dom.clearBtn.addEventListener('click', function () { bruk([], ''); });
        Vy.bindOverlayClose(dom.overlay);

        return { open: open, render: render };
    }

    return {
        reinsk: reinsk,
        tel: tel,
        kjelder: kjelder,
        lagVeljar: lagVeljar
    };
})();
