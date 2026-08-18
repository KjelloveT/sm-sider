/* Ormritaren — sjølvdiagnose når Python ikkje startar.
 *
 * Før dette sa appen berre «Python starta ikkje». Sjølve årsaka hamna i
 * utskriftsruta, som på mobil ligg bak ei fane eleven ikkje ser på — så den
 * einaste opplysninga som kunne hjelpe var gøymd. Ein lærar med ein iPad som
 * ikkje verkar hadde ingenting å gå på.
 *
 * No køyrer vi eit sett prøver og skriv svaret der feilen står, i ei form som
 * kan lesast opp eller fotograferast.
 */
const OrmDiagnose = (function () {

    const PYODIDE = '../_libs/pyodide/pyodide.mjs';

    /** Startar module workers i det heile i denne nettlesaren? */
    function proevModulWorker() {
        return new Promise(svar => {
            let w;
            const tid = setTimeout(() => { try { w.terminate(); } catch (e) {} svar('svarar ikkje'); }, 4000);
            try {
                w = new Worker('js/probe-worker.js', { type: 'module' });
                w.onmessage = () => { clearTimeout(tid); w.terminate(); svar('ja'); };
                w.onerror = (e) => {
                    clearTimeout(tid);
                    svar('nei — ' + (e.message || 'ukjend feil'));
                };
            } catch (e) {
                clearTimeout(tid);
                svar('nei — ' + e.message);
            }
        });
    }

    /** Ligg Python-filene der dei skal? Ein 404 her forklarer alt. */
    async function proevFiler() {
        try {
            const svar = await fetch(PYODIDE, { method: 'GET', headers: { Range: 'bytes=0-64' } });
            if (!svar.ok) return `nei — HTTP ${svar.status}`;
            const type = svar.headers.get('content-type') || '(ingen)';
            // Ein module worker nektar å importere noko som ikkje er JavaScript.
            if (!/javascript|ecmascript/i.test(type)) {
                return `feil filtype — ${type}`;
            }
            return 'ja';
        } catch (e) {
            return 'nei — ' + e.message;
        }
    }

    async function samle() {
        const [modulWorker, filer] = await Promise.all([proevModulWorker(), proevFiler()]);
        return [
            ['Nettlesar', navigator.userAgent],
            ['Python-filene', filer],
            ['Module workers', modulWorker],
            ['WebAssembly', typeof WebAssembly === 'undefined' ? 'nei' : 'ja'],
            ['Delt minne', typeof SharedArrayBuffer === 'undefined' ? 'nei' : 'ja'],
            ['Cross-origin isolert', self.crossOriginIsolated ? 'ja' : 'nei'],
            ['Minne oppgjeve', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '(ikkje oppgjeve)'],
        ];
    }

    /** Kort forklaring på norsk, ut frå kva prøvene fann. */
    function tolk(rader) {
        const f = Object.fromEntries(rader);
        if (f['Python-filene'].startsWith('nei — HTTP 404')) {
            return 'Python-filene finst ikkje på denne adressa. Er dette eit preview-miljø som er teke ned? Prøv hovudadressa i staden.';
        }
        if (f['Python-filene'].startsWith('nei')) {
            return 'Kom ikkje til Python-filene. Sjekk nettsambandet, eller om noko blokkerer nedlastinga.';
        }
        if (f['Python-filene'].startsWith('feil filtype')) {
            return 'Tenaren sender Python-filene med feil filtype, og då nektar nettlesaren å bruke dei.';
        }
        if (f['Module workers'].startsWith('nei') || f['Module workers'] === 'svarar ikkje') {
            return 'Nettlesaren greier ikkje starte den typen bakgrunnsprosess Ormritaren treng. Prøv å oppdatere nettlesaren til nyaste versjon.';
        }
        if (f['WebAssembly'] === 'nei') {
            return 'Nettlesaren støttar ikkje WebAssembly, som Python køyrer på.';
        }
        return 'Alle prøvene gjekk gjennom, så feilen ligg lenger inne. Meldinga under er den viktigaste opplysninga.';
    }

    /** Teiknar heile diagnosen i eit element. */
    async function vis(feilmelding, vert) {
        if (!vert) return;
        vert.textContent = '';
        vert.hidden = false;

        const tittel = document.createElement('p');
        tittel.className = 'orm-diagnose-tittel';
        tittel.textContent = 'Python starta ikkje';
        vert.appendChild(tittel);

        const venter = document.createElement('p');
        venter.className = 'orm-diagnose-tekst';
        venter.textContent = 'Sjekkar kva som er gale …';
        vert.appendChild(venter);

        const rader = await samle();

        venter.textContent = tolk(rader);

        if (feilmelding) {
            const m = document.createElement('p');
            m.className = 'orm-diagnose-melding';
            m.textContent = feilmelding;
            vert.appendChild(m);
        }

        const detaljar = document.createElement('details');
        detaljar.className = 'orm-diagnose-detalj';
        const s = document.createElement('summary');
        s.textContent = 'Tekniske detaljar — ta gjerne eit skjermbilete av dette';
        detaljar.appendChild(s);

        const tabell = document.createElement('table');
        tabell.className = 'orm-diagnose-tabell';
        rader.forEach(([namn, verdi]) => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.scope = 'row';
            th.textContent = namn;
            tr.appendChild(th);
            const td = document.createElement('td');
            td.textContent = verdi;
            tr.appendChild(td);
            tabell.appendChild(tr);
        });
        detaljar.appendChild(tabell);

        const adresse = document.createElement('p');
        adresse.className = 'orm-diagnose-adresse';
        adresse.textContent = location.href;
        detaljar.appendChild(adresse);

        vert.appendChild(detaljar);
    }

    return { vis, samle };
})();
