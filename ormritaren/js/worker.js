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
const TURTLE_URL = new URL('../py/turtle.py', import.meta.url).href;
const MPL_URL = new URL('../py/_mpl_bru.py', import.meta.url).href;
const TEST_URL = new URL('../py/_test.py', import.meta.url).href;

let pyodide = null;
let runUserCode = null;
let hentVariablar = null;
let koyrTestar = null;
let mplKopla = false;

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
    // turtle og matplotlib sender teikninga si same vegen.
    pyodide.registerJsModule('_ormbru', {
        les_linje: lesLinje,
        teikn: (kommandoar) => meld('teikn', { kommandoar: kommandoar.toJs
            ? kommandoar.toJs({ dict_converter: Object.fromEntries })
            : kommandoar }),
        vis_bilete: (base64) => meld('bilete', { base64 })
    });

    // sys.stdin.readline() o.l. skal òg verke. Emscripten vil ha linjeskiftet med.
    pyodide.setStdin({ stdin: () => lesLinje('') + '\n', isatty: false });

    meld('framdrift', { steg: 'Set opp køyremiljøet …' });

    const boot = await (await fetch(BOOT_URL)).text();
    pyodide.runPython(boot, { globals: pyodide.globals });
    runUserCode = pyodide.globals.get('run_user_code');
    hentVariablar = pyodide.globals.get('variablar');

    // turtle finst ikkje i Pyodide (stdlib-versjonen krev tkinter), så vi
    // legg vår eiga utgåve i arbeidsmappa, som ligg på sys.path.
    const turtle = await (await fetch(TURTLE_URL)).text();
    pyodide.FS.writeFile('/home/pyodide/turtle.py', turtle);

    meld('klar', { versjon: pyodide.version });
}

/* ---- bibliotek --------------------------------------------------------- */

/** Hentar hjul frå _libs/pyodide/ og koplar opp det som treng ei bru. */
async function lastPakkar(pakkar) {
    if (!pakkar || !pakkar.length) return;
    meld('framdrift', { steg: `Hentar ${pakkar.join(', ')} …` });
    await pyodide.loadPackage(pakkar, {
        messageCallback: () => {},   // Pyodide er pratsam; framdrifta vår held
        errorCallback: (t) => meld('feilut', { tekst: t + '\n' })
    });
    await etterLasting();
}

/** Les importane i koden og hent det som manglar. */
async function lastFraaImportar(kode) {
    const foer = new Set(Object.keys(pyodide.loadedPackages));
    await pyodide.loadPackagesFromImports(kode, {
        messageCallback: () => {},
        errorCallback: () => {}
    });
    const nye = Object.keys(pyodide.loadedPackages).filter(p => !foer.has(p));
    if (nye.length) await etterLasting();
}

/** Køyrer brukoden for dei biblioteka som nettopp vart tilgjengelege. */
async function etterLasting() {
    if (!mplKopla && pyodide.loadedPackages.matplotlib) {
        const kode = await (await fetch(MPL_URL)).text();
        await pyodide.runPythonAsync(kode);
        mplKopla = true;
    }
    meld('pakkeliste', { pakkar: Object.keys(pyodide.loadedPackages) });
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

    if (m.type === 'lastPakke') {
        try {
            await lastPakkar(m.pakkar);
            meld('pakkarKlare', { pakkar: m.pakkar });
        } catch (feil) {
            meld('pakkefeil', { melding: String(feil && feil.message || feil) });
        }
        return;
    }

    if (m.type === 'test') {
        try {
            // Testkoden blir lasta fyrst når nokon faktisk rettar ei oppgåve.
            if (!koyrTestar) {
                const kode = await (await fetch(TEST_URL)).text();
                pyodide.runPython(kode, { globals: pyodide.globals });
                koyrTestar = pyodide.globals.get('koyr_testar');
            }
            // Oppgåva kan bruke bibliotek eleven ikkje har henta enno.
            await lastFraaImportar(m.kode);

            const svar = koyrTestar(m.kode, JSON.stringify(m.testar));
            meld('testsvar', { id: m.id, resultat: JSON.parse(svar) });
        } catch (feil) {
            meld('testsvar', {
                id: m.id,
                resultat: [{ ok: false, melding: String(feil && feil.message || feil) }]
            });
        }
        return;
    }

    if (m.type === 'koyr') {
        if (m.sab) {
            kontroll = new Int32Array(m.sab, 0, 2);
            data = new Uint8Array(m.sab, 8);
        }
        try {
            // Eleven skal berre skrive «import numpy» og ha det til å verke.
            // Pyodide les importane i koden og hentar dei hjula som trengst —
            // frå vår eigen tenar, aldri frå PyPI.
            await lastFraaImportar(m.kode);

            // Skilpadda skal stå i midten når eleven køyrer på nytt. sys.modules
            // held på modulen mellom køyringane, så vi tek han ut og lèt
            // importen i elevkoden byggje han opp att.
            pyodide.runPython("import sys\nsys.modules.pop('turtle', None)");

            const resultat = await runUserCode(m.kode);

            // Dei siste strekane kan liggje att i bufferen når programmet sluttar.
            pyodide.runPython(
                "import sys\n"
                + "_t = sys.modules.get('turtle')\n"
                + "if _t is not None: _t.tøm()\n"
            );

            meld('ferdig', {
                feil: resultat ? JSON.parse(resultat) : null,
                variablar: JSON.parse(hentVariablar())
            });
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
