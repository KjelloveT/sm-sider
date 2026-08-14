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
                cb.onFerdig?.(m.feil);
                break;
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
        cb.onStoppa?.();
        lagWorker();
    }

    return {
        init, koyr, stopp,
        erKlar: () => klar,
        koyrer: () => koyrer,
        harStdin: () => harSAB
    };
})();
