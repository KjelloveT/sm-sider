/* Ormritaren — livssyklus for Python-workeren.
 *
 * Eig workeren, stdin-brua og stopp-knappen. Resten av appen snakkar berre
 * med denne modulen gjennom callbacks, og treng ikkje vite noko om Atomics.
 */
const OrmRunner = (function () {

    const STDIN_BYTES = 1 << 20;   // 1 MB held til alt ein elev skriv inn
    const TREG_MS = 5000;          // når vi spør om det er ei uendeleg løkke

    let worker = null;
    let klar = false;
    let koyrer = false;
    let sab = null;
    let kontroll = null;
    let data = null;
    let tregTimer = null;

    const enkodar = new TextEncoder();
    const cb = {};   // sett av init()

    const harSAB = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;

    if (harSAB) {
        sab = new SharedArrayBuffer(8 + STDIN_BYTES);
        kontroll = new Int32Array(sab, 0, 2);
        data = new Uint8Array(sab, 8);
    }

    function lagWorker() {
        klar = false;
        worker = new Worker('js/worker.js', { type: 'module' });
        worker.onmessage = (e) => handter(e.data);
        worker.onerror = (e) => {
            cb.onOppstartsfeil?.(e.message || 'Ukjend feil i workeren.');
        };
        worker.postMessage({ type: 'start' });
    }

    function handter(m) {
        switch (m.type) {
            case 'framdrift':
                cb.onFramdrift?.(m.steg);
                break;
            case 'klar':
                klar = true;
                cb.onKlar?.(m.versjon);
                break;
            case 'oppstartsfeil':
                cb.onOppstartsfeil?.(m.melding);
                break;
            case 'ut':
                cb.onUtskrift?.(m.tekst, false);
                break;
            case 'feilut':
                cb.onUtskrift?.(m.tekst, true);
                break;
            case 'input':
                cb.onInput?.(m.ledetekst, svarPaaInput);
                break;
            case 'teikn':
                cb.onTeikn?.(m.kommandoar);
                break;
            case 'bilete':
                cb.onBilete?.(m.base64);
                break;
            case 'pakkeliste':
                cb.onPakkeliste?.(m.pakkar);
                break;
            case 'ferdig':
                avsluttKoyring();
                cb.onFerdig?.(m.feil, m.variablar || []);
                break;
            case 'testsvar': {
                const svar = ventandeTestar.get(m.id);
                if (svar) { ventandeTestar.delete(m.id); svar(m.resultat); }
                break;
            }
        }
    }

    /** Skriv svaret inn i det delte minnet og vekk workeren. */
    function svarPaaInput(tekst) {
        if (!kontroll) return;
        const bytes = enkodar.encode(String(tekst ?? '') );
        const lengd = Math.min(bytes.length, STDIN_BYTES);
        data.set(bytes.subarray(0, lengd));
        Atomics.store(kontroll, 1, lengd);
        Atomics.store(kontroll, 0, 1);
        Atomics.notify(kontroll, 0);
    }

    function avsluttKoyring() {
        koyrer = false;
        clearTimeout(tregTimer);
        cb.onTreg?.(false);
    }

    /* ---- offentleg API ------------------------------------------------- */

    function init(callbacks) {
        Object.assign(cb, callbacks);
        lagWorker();
    }

    function koyr(kode) {
        if (!klar || koyrer) return false;
        koyrer = true;
        cb.onStart?.();
        clearTimeout(tregTimer);
        tregTimer = setTimeout(() => cb.onTreg?.(true), TREG_MS);
        worker.postMessage({ type: 'koyr', kode, sab });
        return true;
    }

    /** Drep workeren midt i ei køyring og bygg han opp att. */
    function stopp() {
        if (!worker) return;
        worker.terminate();
        avsluttKoyring();
        // Ein test som var undervegs får aldri svar frå ein daud worker.
        ventandeTestar.forEach(svar => svar([{ ok: false, melding: 'Køyringa vart stoppa.' }]));
        ventandeTestar.clear();
        cb.onStoppa?.();
        lagWorker();
    }

    /* ---- retting -------------------------------------------------------- */

    let testTeljar = 0;
    const ventandeTestar = new Map();

    /* Kor lenge ei retting får lov til å ta før vi drep workeren.
     *
     * Ein elev kan skrive ei løkke som aldri sluttar, og trykkje «Sjekk
     * svaret». Utan denne grensa heng workeren, og einaste utvegen er
     * Stopp-knappen — som eleven ikkje har nokon grunn til å tenkje på når
     * han nettopp bad om å få svaret retta. */
    const TEST_GRENSE_MS = 10000;

    /**
     * Køyrer testane mot koden og gjev eitt resultat per test.
     * Testane køyrer kvar for seg i eit ferskt __main__ på Python-sida, så
     * dei kan ikkje smitte over på kvarandre eller på eleven si eiga køyring.
     * @returns {Promise<Array<{ok:boolean, melding?:string, fekk?:string, vente?:string}>>}
     */
    function test(kode, testar) {
        if (!klar) {
            return Promise.resolve([{ ok: false, melding: 'Python er ikkje klar enno.' }]);
        }
        return new Promise((svar) => {
            const id = ++testTeljar;

            const klokke = setTimeout(() => {
                if (!ventandeTestar.has(id)) return;
                ventandeTestar.delete(id);
                // Workeren står fast i elevkoden og tek ikkje imot meldingar.
                // Einaste utvegen er å drepe han og byggje han opp att.
                worker.terminate();
                lagWorker();
                cb.onStoppa?.();
                svar([{ ok: false, melding:
                    'Rettinga brukte for lang tid. Har koden ei løkke som aldri sluttar?' }]);
            }, TEST_GRENSE_MS);

            ventandeTestar.set(id, (resultat) => { clearTimeout(klokke); svar(resultat); });
            worker.postMessage({ type: 'test', id, kode, testar });
        });
    }

    return {
        init, koyr, stopp, test,
        erKlar: () => klar,
        koyrer: () => koyrer,
        harStdin: () => harSAB
    };
})();
