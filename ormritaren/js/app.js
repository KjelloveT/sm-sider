/* Ormritaren — oppstart og kopling mellom modulane. */
(function () {

    const STARTKODE = `# Velkomen til Ormritaren!
# Trykk "Køyr" eller Ctrl+Enter for å starte programmet.

namn = input("Kva heiter du? ")
print("Hei,", namn + "!")

for i in range(1, 6):
    print(i, "gonger 7 er", i * 7)
`;

    const el = {};
    let aktivFilId = null;
    let ulagraEndringar = false;

    document.addEventListener('DOMContentLoaded', start);

    function start() {
        [
            'utskrift', 'status', 'tregVarsel', 'koyrKnapp', 'stoppKnapp', 'tomKnapp',
            'filliste', 'nyKnapp', 'lagreKnapp', 'lastNedKnapp', 'lastOppFelt',
            'filnamn', 'symbolrad', 'kodefelt', 'skriftMindre', 'skriftMeir',
            'fanerad', 'arbeidsflate', 'isolasjonsVarsel', 'lagringsVarsel'
        ].forEach(id => { el[id] = document.getElementById(id); });

        OrmUI.init({ utskrift: el.utskrift, status: el.status, treg: el.tregVarsel });
        OrmEditor.lag(el.kodefelt, el.symbolrad, koyr);
        OrmEditor.cm().on('change', () => { ulagraEndringar = true; oppdaterLagreknapp(); });

        if (window.hydrateIcons) hydrateIcons(document);

        koplKnappar();
        // CodeMirror måler feil om han blir vist att etter display:none.
        OrmUI.koplFanar(el.fanerad, el.arbeidsflate, (fane) => {
            if (fane === 'kode') OrmEditor.cm().refresh();
        });

        if (!OrmRunner.harStdin()) el.isolasjonsVarsel.hidden = false;

        lastFiler();
        gjenopprett();
        startMotor();
    }

    /* ---- motoren ------------------------------------------------------- */

    function startMotor() {
        OrmUI.status('Startar Python …', 'ventar');
        el.koyrKnapp.disabled = true;

        OrmRunner.init({
            onFramdrift: (steg) => OrmUI.status(steg, 'ventar'),
            onKlar: (versjon) => {
                OrmUI.status(`Klar — Python ${versjon}`, 'klar');
                el.koyrKnapp.disabled = false;
            },
            onOppstartsfeil: (melding) => {
                OrmUI.status('Python starta ikkje', 'feil');
                OrmUI.skriv('Klarte ikkje starte Python: ' + melding + '\n', true);
            },
            onStart: () => {
                OrmUI.tomUtskrift();
                OrmEditor.reinsk();
                OrmUI.status('Køyrer …', 'koyrer');
                el.koyrKnapp.disabled = true;
                el.stoppKnapp.disabled = false;
            },
            onUtskrift: (tekst, erFeil) => OrmUI.skriv(tekst, erFeil),
            onInput: (ledetekst, svar) => OrmUI.spor(ledetekst, svar, () => OrmRunner.stopp()),
            onTreg: (treg) => OrmUI.visTreg(treg),
            onFerdig: (feil) => {
                el.koyrKnapp.disabled = false;
                el.stoppKnapp.disabled = true;
                if (feil) {
                    OrmUI.skrivFeil(feil);
                    OrmEditor.markerFeillinje(feil.linje);
                    OrmUI.status('Programmet stoppa med feil', 'feil');
                } else {
                    OrmUI.status('Ferdig', 'klar');
                }
            },
            onStoppa: () => {
                el.stoppKnapp.disabled = true;
                OrmUI.skriv('\n— Du stoppa programmet. —\n', true);
                OrmUI.status('Startar Python på nytt …', 'ventar');
            }
        });
    }

    function koyr() {
        if (!OrmRunner.erKlar() || OrmRunner.koyrer()) return;
        // På mobil ligg utskrifta i ei anna fane — hopp dit så eleven ser noko skje.
        if (window.matchMedia('(max-width: 860px)').matches) visFane('ut');
        OrmRunner.koyr(OrmEditor.hent());
    }

    /* ---- knappar ------------------------------------------------------- */

    function koplKnappar() {
        el.koyrKnapp.addEventListener('click', koyr);
        el.stoppKnapp.addEventListener('click', () => OrmRunner.stopp());
        el.tomKnapp.addEventListener('click', () => OrmUI.tomUtskrift());

        el.nyKnapp.addEventListener('click', nyFil);
        el.lagreKnapp.addEventListener('click', lagreFil);
        el.lastNedKnapp.addEventListener('click', lastNed);
        el.lastOppFelt.addEventListener('change', lastOpp);

        el.filnamn.addEventListener('input', () => { ulagraEndringar = true; oppdaterLagreknapp(); });

        let skrift = OrmLager.tilstand().skrift || 15;
        OrmEditor.setSkrift(skrift);
        const stillSkrift = (delta) => {
            skrift = Math.min(30, Math.max(11, skrift + delta));
            OrmEditor.setSkrift(skrift);
            OrmLager.setTilstand({ skrift });
        };
        el.skriftMindre.addEventListener('click', () => stillSkrift(-1));
        el.skriftMeir.addEventListener('click', () => stillSkrift(1));

        window.addEventListener('beforeunload', (e) => {
            if (!ulagraEndringar) return;
            e.preventDefault();
            e.returnValue = '';
        });
    }

    function visFane(namn) {
        const knapp = el.fanerad.querySelector(`.box-tab[data-fane="${namn}"]`);
        if (knapp) knapp.click();
    }

    function oppdaterLagreknapp() {
        el.lagreKnapp.classList.toggle('orm-ulagra', ulagraEndringar);
    }

    /* ---- filer --------------------------------------------------------- */

    function lastFiler() {
        const filer = OrmLager.filer();
        el.filliste.textContent = '';

        if (!filer.length) {
            const tom = document.createElement('p');
            tom.className = 'orm-tomliste';
            tom.textContent = 'Ingen lagra filer enno.';
            el.filliste.appendChild(tom);
            return;
        }

        filer.slice().sort((a, b) => (b.endra || '').localeCompare(a.endra || ''))
            .forEach(fil => el.filliste.appendChild(filrad(fil)));
    }

    function filrad(fil) {
        const rad = document.createElement('div');
        rad.className = 'orm-filrad' + (fil.id === aktivFilId ? ' aktiv' : '');

        const opne = document.createElement('button');
        opne.type = 'button';
        opne.className = 'orm-filnamn';
        opne.textContent = fil.namn;               // brukargenerert — textContent
        opne.addEventListener('click', () => opneFil(fil.id));
        rad.appendChild(opne);

        const slett = document.createElement('button');
        slett.type = 'button';
        slett.className = 'orm-filslett';
        slett.setAttribute('aria-label', `Slett ${fil.namn}`);
        slett.innerHTML = window.ICON ? ICON('trash2', 15) : '×';
        slett.addEventListener('click', () => {
            if (!confirm(`Slette «${fil.namn}»?`)) return;
            OrmLager.slett(fil.id);
            if (aktivFilId === fil.id) { aktivFilId = null; OrmLager.setTilstand({ aktivFil: null }); }
            lastFiler();
        });
        rad.appendChild(slett);

        return rad;
    }

    function opneFil(id) {
        if (ulagraEndringar && !confirm('Du har endringar som ikkje er lagra. Opne ei anna fil likevel?')) return;
        const fil = OrmLager.hent(id);
        if (!fil) return;
        aktivFilId = fil.id;
        el.filnamn.value = fil.namn;
        OrmEditor.set(fil.kode);
        ulagraEndringar = false;
        oppdaterLagreknapp();
        OrmLager.setTilstand({ aktivFil: fil.id });
        lastFiler();
        visFane('kode');
    }

    function nyFil() {
        if (ulagraEndringar && !confirm('Du har endringar som ikkje er lagra. Lage ei ny fil likevel?')) return;
        aktivFilId = null;
        el.filnamn.value = 'nytt-program.py';
        OrmEditor.set('# Skriv koden din her\n');
        ulagraEndringar = false;
        oppdaterLagreknapp();
        OrmLager.setTilstand({ aktivFil: null });
        lastFiler();
        visFane('kode');
    }

    function lagreFil() {
        const namn = (el.filnamn.value || '').trim() || 'utan-namn.py';
        const svar = OrmLager.lagre({ id: aktivFilId, namn, kode: OrmEditor.hent() });

        if (!svar.ok) {
            el.lagringsVarsel.textContent = svar.grunn;
            el.lagringsVarsel.hidden = false;
            return;
        }
        el.lagringsVarsel.hidden = true;
        aktivFilId = svar.id;
        ulagraEndringar = false;
        oppdaterLagreknapp();
        OrmLager.setTilstand({ aktivFil: svar.id });
        lastFiler();
        OrmUI.status(`Lagra «${namn}»`, 'klar');
    }

    function lastNed() {
        const namn = (el.filnamn.value || 'program.py').trim();
        const blob = new Blob([OrmEditor.hent()], { type: 'text/x-python;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = namn.endsWith('.py') ? namn : namn + '.py';
        a.click();
        URL.revokeObjectURL(url);
    }

    function lastOpp(e) {
        const fil = e.target.files && e.target.files[0];
        if (!fil) return;
        const lesar = new FileReader();
        lesar.onload = () => {
            aktivFilId = null;
            el.filnamn.value = fil.name;
            OrmEditor.set(String(lesar.result));
            ulagraEndringar = true;
            oppdaterLagreknapp();
            visFane('kode');
        };
        lesar.readAsText(fil);
        e.target.value = '';
    }

    function gjenopprett() {
        const sist = OrmLager.tilstand().aktivFil;
        const fil = sist && OrmLager.hent(sist);
        if (fil) {
            aktivFilId = fil.id;
            el.filnamn.value = fil.namn;
            OrmEditor.set(fil.kode);
            lastFiler();
        } else {
            el.filnamn.value = 'fyrste-program.py';
            OrmEditor.set(STARTKODE);
        }
        ulagraEndringar = false;
        oppdaterLagreknapp();
    }
})();
