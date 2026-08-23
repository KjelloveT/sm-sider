/* Bolkestokk — tolken.
 *
 * Går rett på blokktreet. Ingen mellomkode, ingen eval, ingen worker.
 *
 * Han er ein generator: kvart `yield` er eitt utført steg og ber id-en til
 * blokka som nettopp køyrde. Det gjev tre ting for prisen av ein:
 * stegvis køyring, uthevinga av den blokka som arbeider, og ein fartsknapp
 * — utan at nokon av dei treng eigen kode. Å stoppe er berre å slutte å be
 * om fleire steg; det finst ingen tråd å drepe.
 *
 * Verdiar blir rekna ut synkront, utan yield. Ei verdiblokk kan ikkje endre
 * skilpadda eller kalle ein funksjon, så ho har ingenting å stoppe midt i.
 */
const BolkTolk = (function () {

    /* Utan medan-lykkje kan eit program ikkje gå i evig lykkje, så dette er
     * inga tryggingsgrense. Det er ei øvre ramme for kor mykje ein figur kan
     * innehalde før vi heller seier frå enn å teikne i eitt minutt. */
    const MAKS_STEG = 50000;

    function nyKontekst(program, val) {
        const funksjonar = {};
        (program.funksjonar || []).forEach(k => { if (k.namn) funksjonar[k.namn] = k.kropp || []; });
        return {
            skilpadde: (val && val.skilpadde) || BolkSkilpadde(),
            variablar: {},
            /* Lister ligg for seg og ikkje blant variablane. Ein variabel er
             * eitt tal, ei liste er mange, og blandar vi dei to i same
             * oppslagsverket, kan «Set tala til 5» øydeleggje eit datasett
             * utan at noko seier frå. */
            lister: {},
            funksjonar,
            utskrift: [],
            steg: 0,
            djupn: 0,
            tilfeldig: (val && val.tilfeldig) || Math.random
        };
    }

    /** Verdien i eit hòl: anten det eleven skreiv, eller ei verdiblokk. */
    function verdi(hol, ktx) {
        if (hol === null || hol === undefined || hol === '') return 0;
        if (typeof hol === 'object') {
            const def = BolkBlokkar.hent(hol.type);
            if (!def || !def.verdi) return 0;
            return def.verdi(hol.felt, ktx, hj) || 0;
        }
        const n = Number(hol);
        return isFinite(n) ? n : 0;
    }

    const hj = { verdi, koyrStabel };

    function* koyrStabel(stabel, ktx) {
        for (const node of stabel) yield* koyrNode(node, ktx);
    }

    function* koyrNode(node, ktx) {
        const def = BolkBlokkar.hent(node.type);
        if (!def || !def.koyr) return;

        if (++ktx.steg > MAKS_STEG) {
            throw new Error('Programmet gjorde over ' + MAKS_STEG
                + ' steg. Er det eit tal som har blitt for stort i ei gjenta-blokk?');
        }

        /* Blokka blir meldt FØR ho køyrer. Eleven skal sjå kva som er i ferd
         * med å skje medan skilpadda gjer det, ikkje etterpå. */
        yield { blokk: node.id };
        yield* def.koyr(node, ktx, hj);
    }

    /**
     * Generatoren for heile programmet. Kall `.next()` så mange gonger du vil,
     * så fort du vil — eller ikkje fleire, om eleven trykte Stopp.
     */
    function* koyr(program, val) {
        const ktx = (val && val.ktx) || nyKontekst(program, val);
        yield* koyrStabel(program.start || [], ktx);
    }

    /**
     * Køyr ferdig med ein gong. Dette er inngangen for rettemotoren, som
     * berre er interessert i kva som står att når programmet er slutt.
     */
    function koyrHeilt(program, val) {
        const ktx = nyKontekst(program, val);
        const ut = { skilpadde: ktx.skilpadde, utskrift: ktx.utskrift, variablar: ktx.variablar, feil: null };
        try {
            const g = koyrStabel(program.start || [], ktx);
            let n = g.next();
            while (!n.done) n = g.next();
        } catch (f) {
            ut.feil = f.message || String(f);
        }
        ut.steg = ktx.steg;
        return ut;
    }

    return { koyr, koyrHeilt, nyKontekst, verdi, MAKS_STEG };
})();
