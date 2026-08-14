/* Ormritaren — Pyodide-worker.
 *
 * Køyrer som module worker (type: 'module') fordi Pyodide-limet er ESM.
 * All elevkode køyrer her, aldri på hovudtråden, slik at ei uendeleg løkke
 * kan avbrytast med worker.terminate() utan at eleven mistar arbeidet sitt.
 *
 * input() er synkron i Python, men postMessage er det ikkje. Difor blokkerer
 * vi på ein SharedArrayBuffer med Atomics.wait medan hovudtråden hentar svaret.
 * Det krev at sida er cross-origin isolated (COOP/COEP) — sjå staticwebapp.config.json.
 */

import { loadPyodide } from '../../_libs/pyodide/pyodide.mjs';

const PYODIDE_URL = new URL('../../_libs/pyodide/', import.meta.url).href;
const BOOT_URL = new URL('../py/_vyrdepil_boot.py', import.meta.url).href;

let pyodide = null;
let runUserCode = null;

/* Delt minne for stdin. Oppsett frå hovudtråden ved kvar køyring:
 *   kontroll[0] = 0 medan vi ventar, 1 når svaret ligg klart
 *   kontroll[1] = tal byte skrivne i databufferen  */
let kontroll = null;
let data = null;

const dekodar = new TextDecoder();

function meld(type, felt = {}) {
    self.postMessage({ type, ...felt });
}

/* ---- stdin ------------------------------------------------------------ */

function lesLinje(ledetekst) {
    if (!kontroll) {
        // Utan SharedArrayBuffer kan vi ikkje blokkere. Betre å seie det rett ut
        // enn å returnere tom streng og la eleven undre seg.
        throw new Error(
            'input() krev at sida køyrer med COOP/COEP. Sjå meldinga øvst på sida.'
        );
    }

    Atomics.store(kontroll, 0, 0);
    meld('input', { ledetekst: ledetekst ?? '' });

    // Blokkerer heilt til hovudtråden har skrive svaret og kalla Atomics.notify.
    Atomics.wait(kontroll, 0, 0);

    const lengd = Atomics.load(kontroll, 1);
    // TextDecoder nektar å lese ein buffer som ligg i delt minne, så vi tek
    // ein kopi over i ein vanleg ArrayBuffer fyrst.
    return dekodar.decode(new Uint8Array(data.subarray(0, lengd)));
}

/* ---- oppstart --------------------------------------------------------- */

async function start() {
    meld('framdrift', { steg: 'Lastar Python-motoren …' });

    pyodide = await loadPyodide({
        indexURL: PYODIDE_URL,
        stdout: (linje) => meld('ut', { tekst: linje + '\n' }),
        stderr: (linje) => meld('feilut', { tekst: linje + '\n' }),
    });

    // input() går gjennom denne brua i staden for stdin — sjå _vyrdepil_boot.py.
    pyodide.registerJsModule('_ormbru', { les_linje: lesLinje });

    // sys.stdin.readline() o.l. skal òg verke. Emscripten vil ha linjeskiftet med.
    pyodide.setStdin({ stdin: () => lesLinje('') + '\n', isatty: false });

    meld('framdrift', { steg: 'Set opp køyremiljøet …' });

    const boot = await (await fetch(BOOT_URL)).text();
    pyodide.runPython(boot, { globals: pyodide.globals });
    runUserCode = pyodide.globals.get('run_user_code');

    meld('klar', { versjon: pyodide.version });
}

/* ---- meldingar frå hovudtråden ---------------------------------------- */

self.onmessage = async (e) => {
    const m = e.data;

    if (m.type === 'start') {
        try {
            await start();
        } catch (feil) {
            meld('oppstartsfeil', { melding: String(feil && feil.message || feil) });
        }
        return;
    }

    if (m.type === 'koyr') {
        if (m.sab) {
            kontroll = new Int32Array(m.sab, 0, 2);
            data = new Uint8Array(m.sab, 8);
        }
        try {
            const resultat = await runUserCode(m.kode);
            meld('ferdig', { feil: resultat ? JSON.parse(resultat) : null });
        } catch (feil) {
            // Feil som slepp forbi Python-sida (t.d. input() utan SAB).
            meld('ferdig', {
                feil: {
                    type: 'RuntimeError',
                    melding: String(feil && feil.message || feil),
                    linje: null,
                    traceback: String(feil && feil.message || feil),
                },
            });
        }
    }
};
