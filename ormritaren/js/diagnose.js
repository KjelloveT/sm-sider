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

    /* Dei tunge prøvene, i den rekkjefylgja Pyodide sjølv gjer dei. Rekkjefylgja
     * er poenget: den fyrste som ikkje svarer er den som felte iPaden. */
    const TUNGE = [
        'Wasm-minne (4 GB tak)',
        'Kompilerer Python-motoren',
        'Importerer pyodide.mjs',
        'Importerer pyodide.asm.mjs',
        'Minne som let seg ta i bruk',
    ];

    /** Køyrer dei ekte oppstartsstega i ein worker og ser kor langt dei kjem.
     *
     * Ei worker som blir drepen av minnemangel svarer ikkje i det heile — ho
     * berre tagnar. Difor er det ikkje nok å samle svara; vi må òg vite kva
     * steg som mangla svar, for det er der iPaden gav opp. */
    function proevOppstart() {
        return new Promise(svar => {
            const funne = new Map();
            let w;
            let ferdig = false;

            function avslutt() {
                if (ferdig) return;   // timeout og onerror kan kome i same slengen
                ferdig = true;
                clearTimeout(tid);
                try { w.terminate(); } catch (e) {}
                const rader = [];
                let fyrsteTapte = null;
                TUNGE.forEach(steg => {
                    if (funne.has(steg)) {
                        rader.push([steg, funne.get(steg)]);
                    } else if (!fyrsteTapte) {
                        fyrsteTapte = steg;
                        rader.push([steg, 'nei — nettlesaren gav opp her, utan feilmelding']);
                    } else {
                        rader.push([steg, '(ikkje prøvd)']);
                    }
                });
                // Ekstraprøver som berre finst når noko gjekk gale.
                funne.forEach((verdi, steg) => {
                    if (!TUNGE.includes(steg) && steg !== '__ferdig') rader.push([steg, verdi]);
                });
                svar(rader);
            }

            // Å kompilere 9,6 MB wasm tek tid på ein gamal iPad. Betre å vente
            // for lenge enn å melde feil på ein maskin som berre er treg.
            const tid = setTimeout(avslutt, 30000);

            try {
                w = new Worker('js/probe-wasm.js', { type: 'module' });
            } catch (e) {
                clearTimeout(tid);
                svar([['Oppstartsprøvene', 'nei — ' + e.message]]);
                return;
            }
            w.onmessage = (e) => {
                funne.set(e.data.steg, e.data.resultat);
                if (e.data.steg === '__ferdig') avslutt();
            };
            w.onerror = (e) => {
                funne.set('Prøveworkeren', 'stoppa — ' + (e.message || 'utan feilmelding'));
                avslutt();
            };
        });
    }

    async function samle() {
        const [modulWorker, filer] = await Promise.all([proevModulWorker(), proevFiler()]);
        const rader = [
            ['Nettlesar', navigator.userAgent],
            ['Python-filene', filer],
            ['Module workers', modulWorker],
            ['WebAssembly', typeof WebAssembly === 'undefined' ? 'nei' : 'ja'],
            ['Delt minne', typeof SharedArrayBuffer === 'undefined' ? 'nei' : 'ja'],
            ['Cross-origin isolert', self.crossOriginIsolated ? 'ja' : 'nei'],
            ['Minne oppgjeve', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : '(ikkje oppgjeve)'],
        ];

        // Dei tunge prøvene har berre meining om grunnlaget er på plass.
        if (typeof WebAssembly !== 'undefined' && modulWorker === 'ja' && filer === 'ja') {
            rader.push(...await proevOppstart());
        }
        return rader;
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
        const minne = f['Wasm-minne (4 GB tak)'] || '';
        if (minne.startsWith('nei')) {
            const utanTak = f['Wasm-minne utan tak'] || '';
            if (utanTak.startsWith('ja')) {
                return 'Nettlesaren nektar å setje av så mykje minne som Python-motoren ber om. '
                     + 'Dette er den kjende grensa i Safari på iPad. Prøv å lukke andre faner og appar '
                     + 'og lasta sida på nytt — eller bruk ein PC eller Chromebook.';
            }
            return 'iPaden har ikkje minne nok til Python akkurat no. Lukk andre faner og appar, '
                 + 'start Safari på nytt, og prøv igjen.';
        }
        if ((f['Kompilerer Python-motoren'] || '').startsWith('nei')) {
            return 'Nettlesaren greidde ikkje byggje Python-motoren. Oftast er det minnet som tek slutt '
                 + 'midtvegs. Lukk andre faner og appar og prøv på nytt.';
        }
        if ((f['Importerer pyodide.mjs'] || '').startsWith('nei')
            || (f['Importerer pyodide.asm.mjs'] || '').startsWith('nei')) {
            return 'Nettlesaren fekk ikkje lasta Python-filene inn i bakgrunnsprosessen. '
                 + 'Sjekk om noko blokkerer skript på denne sida.';
        }
        const bruk = f['Minne som let seg ta i bruk'] || '';
        if (bruk.startsWith('nei')) {
            return 'iPaden slepp Python til å reservere minne, men ikkje til å bruke det. '
                 + bruk.replace(/^nei — /, 'Han ') + '. Python treng kring 300 MB når '
                 + 'standardbiblioteket er inne. Lukk andre faner og appar, start Safari på nytt, '
                 + 'og prøv igjen — hjelper det ikkje, har eininga for lite minne til dette verktøyet.';
        }
        if (TUNGE.some(steg => (f[steg] || '').includes('gav opp her'))) {
            return 'Nettlesaren stoppa midt i oppstarten utan å seie kvifor. Det er nesten alltid minnet '
                 + 'som tek slutt. Lukk andre faner og appar, start Safari på nytt, og prøv igjen.';
        }
        return 'Alle prøvene gjekk gjennom, så feilen ligg lenger inne. Den ramma teksten rett under '
             + 'er den viktigaste opplysninga — send henne vidare ordrett.';
    }

    /** Heile diagnosen som rein tekst, klar til å limast inn i ein e-post. */
    function somTekst(rader, feilmelding) {
        return ['Ormritaren — Python starta ikkje', '', tolk(rader), '',
                feilmelding ? 'Melding: ' + feilmelding : 'Ingen feilmelding.', '',
                ...rader.map(([namn, verdi]) => `${namn}: ${verdi}`), '',
                location.href].join('\n');
    }

    /* Ein knapp som tek heile rapporten, ikkje berre feilmeldinga.
     *
     * Ei tabellrad blir borte på vegen når nokon skriv av det dei ser, og det
     * er alltid den eine rada som forklarte alt. Tre rundar med skjermbilete
     * som mangla den avgjerande linja er nok. */
    function lagKopiknapp(rader, feilmelding) {
        const knapp = document.createElement('button');
        knapp.type = 'button';
        knapp.className = 'orm-diagnose-kopi';
        knapp.textContent = 'Kopier heile rapporten';
        knapp.addEventListener('click', async () => {
            const tekst = somTekst(rader, feilmelding);
            try {
                await navigator.clipboard.writeText(tekst);
                knapp.textContent = 'Kopiert — lim inn i ein e-post';
            } catch (e) {
                // Utan løyve til utklippstavla er det beste vi kan gjere å
                // merke teksten, så eleven berre treng «Kopier» sjølv.
                const felt = document.createElement('textarea');
                felt.className = 'orm-diagnose-felt';
                felt.value = tekst;
                felt.readOnly = true;
                knapp.replaceWith(felt);
                felt.focus();
                felt.select();
            }
        });
        return knapp;
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
        venter.textContent = 'Sjekkar kva som er gale — dette kan ta eit halvt minutt …';
        vert.appendChild(venter);

        const rader = await samle();

        venter.textContent = tolk(rader);

        // Meldinga står her jamvel når ho manglar. Ei tom rute er ei opplysning
        // i seg sjølv — då sa nettlesaren ingenting, og det må vi få vite.
        const m = document.createElement('p');
        m.className = 'orm-diagnose-melding';
        m.textContent = feilmelding || 'Nettlesaren gav inga feilmelding.';
        vert.appendChild(m);

        vert.appendChild(lagKopiknapp(rader, feilmelding));

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
