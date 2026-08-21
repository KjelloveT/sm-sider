/* Bolkestokk — blokktreet.
 *
 * Ein node er:
 *   { id, type, felt: {...}, kropp: [node, ...] }
 *
 * `kropp` finst berre på blokker med form 'krop' og 'hatt'. Eit felt held
 * anten ein enkel verdi (tal eller streng — det eleven har skrive rett i
 * hòlet) eller ein heil node (ei verdiblokk som er dregen inn i hòlet).
 * Skiljet er `typeof === 'object'`, og det er den einaste staden i koden
 * som treng vite om det.
 *
 * Programmet:
 *   { app, version, start: [node,...], kommandoar: [{namn, kropp:[node,...]}] }
 *
 * Toppnivået følgjer AGENTS.md §5.2 så eit lagra program kan skiljast frå
 * andre appar sine filer når nokon importerer dei.
 */
const BolkTre = (function () {

    let teljar = 0;
    const nyId = () => 'b' + (++teljar);

    /* ---- lage ------------------------------------------------------------ */

    function nyNode(type, felt) {
        const def = BolkBlokkar.hent(type);
        const node = {
            id: nyId(),
            type,
            felt: Object.assign(BolkBlokkar.standardFelt(type), felt || {})
        };
        if (def && (def.form === 'krop' || def.form === 'hatt')) node.kropp = [];
        return node;
    }

    function nyttProgram() {
        return { app: 'bolkestokk', version: 1, start: [], kommandoar: [] };
    }

    /** Djup kopi med ferske id-ar. Brukt av palett-drag og av rettemotoren,
     *  som må ha eit urørt tre per test (sjå test.js). */
    function klone(node) {
        const ny = { id: nyId(), type: node.type, felt: {} };
        Object.keys(node.felt || {}).forEach(k => {
            const v = node.felt[k];
            ny.felt[k] = (v && typeof v === 'object') ? klone(v) : v;
        });
        if (node.kropp) ny.kropp = node.kropp.map(klone);
        return ny;
    }

    function kloneProgram(p) {
        return {
            app: 'bolkestokk', version: 1,
            start: (p.start || []).map(klone),
            kommandoar: (p.kommandoar || []).map(k => ({
                namn: k.namn, kropp: (k.kropp || []).map(klone)
            }))
        };
    }

    /* ---- gå gjennom ------------------------------------------------------ */

    /** Alle nodar i programmet, verdiblokker i hòl medrekna. */
    function alle(program) {
        const ut = [];
        const gaa = (n) => {
            ut.push(n);
            Object.values(n.felt || {}).forEach(v => { if (v && typeof v === 'object') gaa(v); });
            (n.kropp || []).forEach(gaa);
        };
        stablar(program).forEach(s => s.forEach(gaa));
        return ut;
    }

    /** Dei sjølvstendige stablane: hovudprogrammet og kvar kommandokropp. */
    function stablar(program) {
        return [program.start || []].concat((program.kommandoar || []).map(k => k.kropp || []));
    }

    /**
     * Kvar ein node sit. Returnerer null om han ikkje finst.
     * `stabel` + `indeks` for ein node i ein stabel, `vert` + `felt` for ein
     * node som ligg i eit verdi-hòl.
     */
    function finn(program, id) {
        let treff = null;

        const iStabel = (stabel) => {
            stabel.forEach((n, i) => {
                if (treff) return;
                if (n.id === id) { treff = { node: n, stabel, indeks: i }; return; }
                iNode(n);
            });
        };
        const iNode = (n) => {
            Object.keys(n.felt || {}).forEach(k => {
                if (treff) return;
                const v = n.felt[k];
                if (v && typeof v === 'object') {
                    if (v.id === id) { treff = { node: v, vert: n, felt: k }; return; }
                    iNode(v);
                }
            });
            if (!treff && n.kropp) iStabel(n.kropp);
        };

        stablar(program).forEach(s => { if (!treff) iStabel(s); });
        return treff;
    }

    /** Tek noden ut av treet og gjev han tilbake. */
    function loys(program, id) {
        const stad = finn(program, id);
        if (!stad) return null;
        if (stad.stabel) stad.stabel.splice(stad.indeks, 1);
        else stad.vert.felt[stad.felt] = BolkBlokkar.standardFelt(stad.vert.type)[stad.felt];
        return stad.node;
    }

    /** Er `mogleg` noden sjølv, eller noko som ligg inni han? */
    function inni(node, moglegId) {
        if (node.id === moglegId) return true;
        const iFelt = Object.values(node.felt || {})
            .some(v => v && typeof v === 'object' && inni(v, moglegId));
        return iFelt || (node.kropp || []).some(k => inni(k, moglegId));
    }

    /* ---- måling ---------------------------------------------------------- */

    /**
     * Tal blokker eleven har lagt ut.
     *
     * Hattar tel ikkje med: `start` ligg der frå før, og `lag kommandoen` er
     * ramma rundt ein kommando, ikkje eit steg i han. Eit tal skrive rett i
     * eit hòl tel heller ikkje — det er ein verdi, ikkje ei blokk. Difor er
     * «teikn ein sekskant med høgst 5 blokker» eit ærleg krav: det er dei
     * fem blokkene eleven faktisk drog ut.
     */
    function tel(program) {
        return alle(program).filter(n => {
            const def = BolkBlokkar.hent(n.type);
            return def && def.form !== 'hatt';
        }).length;
    }

    /** Brukar programmet denne blokktypen? */
    function brukar(program, type) {
        return alle(program).some(n => n.type === type);
    }

    /** Brukar programmet `type` ein eller annan stad inni ein `vertType`? */
    function brukarInni(program, type, vertType) {
        const leit = (n, inneI) => {
            if (n.type === type && inneI) return true;
            const her = inneI || n.type === vertType;
            const iFelt = Object.values(n.felt || {})
                .some(v => v && typeof v === 'object' && leit(v, her));
            return iFelt || (n.kropp || []).some(k => leit(k, her));
        };
        return stablar(program).some(s => s.some(n => leit(n, false)));
    }

    /* ---- variablar og kommandoar ------------------------------------------ */

    const GRUNNVARIABLAR = ['lengd', 'vinkel', 'tal'];

    /** Namna som skal stå i nedtrekkslistene for variablar. */
    function variablar(program) {
        const sett = new Set(GRUNNVARIABLAR);
        alle(program).forEach(n => {
            if (n.felt && typeof n.felt.namn === 'string'
                && (n.type === 'settVar' || n.type === 'endreVar' || n.type === 'lesVar')) {
                if (n.felt.namn) sett.add(n.felt.namn);
            }
        });
        return [...sett];
    }

    function kommandonamn(program) {
        return (program.kommandoar || []).map(k => k.namn).filter(Boolean);
    }

    /* ---- lagring ---------------------------------------------------------- */

    /** Program → reint JSON-objekt, utan id-ane som berre gjeld denne økta. */
    function serialiser(program) {
        const reins = (n) => {
            const ut = { type: n.type, felt: {} };
            Object.keys(n.felt || {}).forEach(k => {
                const v = n.felt[k];
                ut.felt[k] = (v && typeof v === 'object') ? reins(v) : v;
            });
            if (n.kropp) ut.kropp = n.kropp.map(reins);
            return ut;
        };
        return {
            app: 'bolkestokk', version: 1,
            start: (program.start || []).map(reins),
            kommandoar: (program.kommandoar || []).map(k => ({
                namn: k.namn, kropp: (k.kropp || []).map(reins)
            }))
        };
    }

    /**
     * JSON → program med ferske id-ar.
     *
     * Ukjende blokktypar blir kasta stille. Ei fil kan vere skriven av ei
     * nyare utgåve enn den som opnar henne, og då er det betre å opne det
     * som går an enn å nekte heile programmet.
     */
    function lesInn(data) {
        const bygg = (d) => {
            if (!d || !BolkBlokkar.hent(d.type)) return null;
            const n = nyNode(d.type);
            Object.keys(d.felt || {}).forEach(k => {
                const v = d.felt[k];
                if (v && typeof v === 'object') { const b = bygg(v); if (b) n.felt[k] = b; }
                else n.felt[k] = v;
            });
            if (n.kropp) n.kropp = (d.kropp || []).map(bygg).filter(Boolean);
            return n;
        };
        return {
            app: 'bolkestokk', version: 1,
            start: ((data && data.start) || []).map(bygg).filter(Boolean),
            kommandoar: ((data && data.kommandoar) || []).map(k => ({
                namn: k.namn, kropp: (k.kropp || []).map(bygg).filter(Boolean)
            }))
        };
    }

    return {
        nyNode, nyttProgram, klone, kloneProgram,
        alle, stablar, finn, loys, inni,
        tel, brukar, brukarInni,
        variablar, kommandonamn, GRUNNVARIABLAR,
        serialiser, lesInn
    };
})();
