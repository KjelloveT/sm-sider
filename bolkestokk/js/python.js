/* Bolkestokk — blokktre til Python.
 *
 * Dette er brua til Ormritaren, og han ber berre om eleven trur på han.
 * Difor skriv vi ikkje ut nynorske hjelpefunksjonar som `framover()` — det
 * ville vore lettare å lese, men det ville vore vår Python og ikkje Python.
 * Vi skriv `forward()`, altså nøyaktig det som står i turtle-modulen eleven
 * møter i Ormritaren. Prisen er at han må bru eitt ord; gevinsten er at
 * koden faktisk køyrer der.
 *
 * Éin ting må rettast opp: Python sin turtle startar peikande mot høgre,
 * Bolkestokk peikar opp. Difor står det eit `setheading(90)` øvst.
 */
const BolkPython = (function () {

    const INNRYKK = '    ';

    /** Eit verdi-hòl som Python-uttrykk. */
    function uttrykk(hol) {
        if (hol === null || hol === undefined || hol === '') return '0';
        if (typeof hol === 'object') {
            const def = BolkBlokkar.hent(hol.type);
            if (!def || !def.python) return '0';
            return def.python(hol.felt, hj);
        }
        return BolkBlokkar.talTekst(Number(hol) || 0);
    }

    const hj = { uttrykk };

    function stabel(liste, niva) {
        const ut = [];
        const pad = INNRYKK.repeat(niva);

        liste.forEach(node => {
            const def = BolkBlokkar.hent(node.type);
            if (!def || !def.python) return;

            const linje = def.python(node.felt, hj);
            if (linje === null) return;

            // Nokre blokker blir til fleire linjer (Gå til start er fire),
            // og gjev då ei liste i staden for ein streng.
            const linjer = Array.isArray(linje) ? linje : [linje];
            linjer.forEach(l => ut.push(pad + l));

            if (def.form === 'krop') {
                const inni = stabel(node.kropp || [], niva + 1);
                // Ei tom løkke er ikkje gyldig Python. `pass` er òg ærlegare
                // enn å skjule at eleven ikkje har lagt noko inni enno.
                ut.push(inni.length ? inni.join('\n') : pad + INNRYKK + 'pass');
            }
        });

        return ut;
    }

    /** Kva som må importerast — berre det programmet faktisk brukar. */
    function importar(program) {
        const ut = ['from turtle import *'];
        if (BolkTre.brukar(program, 'tilfeldig')) ut.push('from random import randint');
        return ut;
    }

    /**
     * Heile programmet som Python-tekst.
     * Funksjonane kjem fyrst, slik Python krev: ein funksjon må vere
     * definert før han blir kalla.
     */
    function tekst(program) {
        const ut = ['# Programmet ditt, skrive som Python.'];
        ut.push.apply(ut, importar(program));
        ut.push('');
        ut.push('setheading(90)   # i Bolkestokk peikar 0 gradar opp');

        /* Rutenettblokkene reknar om frå rutetal til teikneeiningar. Skriv
         * vi 150 rett inn i `goto`, forsvinn koordinaten eleven såg. Med ein
         * namngjeven konstant står `goto(3 * RUTE, 4 * RUTE)` att, og då er
         * trearen og firaren framleis å sjå i koden. */
        if (['gaaTilRute', 'lesX', 'lesY'].some(b => BolkTre.brukar(program, b))) {
            ut.push('RUTE = ' + BolkBlokkar.RUTE + '      # teikneeiningar i éi rute');
        }
        ut.push('');

        (program.funksjonar || []).forEach(k => {
            if (!k.namn) return;
            ut.push('def ' + k.namn + '():');
            const kropp = stabel(k.kropp || [], 1);
            ut.push(kropp.length ? kropp.join('\n') : INNRYKK + 'pass');
            ut.push('');
        });

        const hovud = stabel(program.start || [], 0);
        if (hovud.length) ut.push(hovud.join('\n'));
        else ut.push('# Ingen blokker enno — dra noko inn under «Når eg trykkjer Køyr».');

        return ut.join('\n') + '\n';
    }

    return { tekst, uttrykk };
})();
