/* Ormritaren — prøver dei stega Python faktisk fell på.
 *
 * Den fyrste sjølvdiagnosen svarte «ja» på alt og hjelpte ingen: han prøvde
 * om nettlesaren *kunne* module workers og WebAssembly, ikkje om han greidde
 * akkurat det Pyodide gjer. På iPad er det nettopp der det ryk — reservasjonen
 * av 4 GB adresserom, eller kompileringa av ein wasm-modul på 9,6 MB.
 *
 * Difor gjer denne workeren dei fire stega på ekte, kvar for seg, og seier frå
 * etter kvart. Alt skjer i ein worker, så ei tom-for-minne-krasj tek med seg
 * prøven og ikkje sida eleven står på.
 */

const BASE = new URL('../../_libs/pyodide/', import.meta.url).href;

function meld(steg, resultat) {
    self.postMessage({ steg, resultat });
}

/** Feilmeldinga slik ho faktisk kan lesast opp for ein lærar. */
function forklar(feil) {
    if (!feil) return 'ukjend feil';
    const namn = feil.name || 'Error';
    const tekst = feil.message || String(feil);
    return tekst.includes(namn) ? tekst : `${namn}: ${tekst}`;
}

async function proev(steg, arbeid) {
    try {
        const svar = await arbeid();
        meld(steg, svar || 'ja');
        return true;
    } catch (feil) {
        meld(steg, 'nei — ' + forklar(feil));
        return false;
    }
}

async function koeyr() {
    /* 1. Adresserommet. Pyodide-modulen ber om 30 MB no og opptil 4 GB seinare.
     * Safari på iPad reserverer heile makset med ein gong, og på ein iPad med
     * lite minne er det der det stoppar — før ei einaste linje Python. */
    const minneOk = await proev('Wasm-minne (4 GB tak)', () => {
        const m = new WebAssembly.Memory({ initial: 480, maximum: 65536 });
        const mb = m.buffer.byteLength / (1024 * 1024);
        return `ja — ${mb} MB`;
    });

    /* Fell det, er spørsmålet kor mykje som er råd. Svaret skil ein iPad som
     * er tom for minne akkurat no frå ein som aldri kjem til å greie det. */
    if (!minneOk) {
        await proev('Wasm-minne utan tak', () => {
            const m = new WebAssembly.Memory({ initial: 480 });
            return `ja — ${m.buffer.byteLength / (1024 * 1024)} MB`;
        });
    }

    /* 2. Sjølve Python-modulen, 9,6 MB wasm. Pyodide svelgjer denne feilen med
     * ein console.warn og lèt oppstarten henge for alltid, så her er einaste
     * staden feilen er råd å få tak i. */
    await proev('Kompilerer Python-motoren', async () => {
        const svar = await fetch(BASE + 'pyodide.asm.wasm');
        if (!svar.ok) throw new Error(`HTTP ${svar.status}`);
        if (WebAssembly.compileStreaming) {
            await WebAssembly.compileStreaming(svar);
        } else {
            await WebAssembly.compile(await svar.arrayBuffer());
        }
        return 'ja';
    });

    /* 3. og 4. Dei to ESM-filene. Ein module worker som ikkje får importere
     * vidare ser utanfrå ut som ein worker som aldri starta. */
    await proev('Importerer pyodide.mjs', async () => {
        await import(BASE + 'pyodide.mjs');
        return 'ja';
    });

    await proev('Importerer pyodide.asm.mjs', async () => {
        await import(BASE + 'pyodide.asm.mjs');
        return 'ja';
    });

    /* 5. Minnet som faktisk blir teke i bruk.
     *
     * Å be om ein Memory med tak på 4 GB kostar ingenting — nettlesaren berre
     * reserverer adresserom, og ein iPad seier gladeleg ja. Det er når CPython
     * pakkar ut standardbiblioteket og veks til eit par hundre MB at rekninga
     * kjem. Difor veks vi minnet på ekte her, og skriv i kvart steg: utan å
     * røre ved sidene set nettlesaren dei aldri av, og prøven ville løge.
     *
     * Denne står sist med vilje. Blir workeren drepen her, er dei fire andre
     * svara alt sende, og «stoppa på N MB» er sjølve svaret vi er ute etter. */
    await proev('Minne som let seg ta i bruk', () => {
        const STEG_MB = 32;
        const MAAL_MB = 320;   // om lag det Pyodide treng når stdlib er inne
        const m = new WebAssembly.Memory({ initial: 480, maximum: 65536 });
        let mb = m.buffer.byteLength / (1024 * 1024);
        try {
            while (mb < MAAL_MB) {
                m.grow(STEG_MB * 1024 / 64);   // ei wasm-side er 64 kB
                mb += STEG_MB;
                // grow() byter ut bufferen, så synsvinkelen må lagast på nytt.
                new Uint8Array(m.buffer, m.buffer.byteLength - 4096, 4096).fill(1);
            }
            return `ja — ${mb} MB`;
        } catch (feil) {
            return `nei — stoppa på ${mb} MB: ${forklar(feil)}`;
        }
    });

    meld('__ferdig', 'ja');
}

koeyr().catch(feil => {
    meld('Prøvene sjølve', 'nei — ' + forklar(feil));
    meld('__ferdig', 'ja');
});
