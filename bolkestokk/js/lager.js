/* Bolkestokk — lagring.
 *
 * Alt går gjennom VyrdepilStorage; direkte localStorage er forbode inne i
 * eit verktøy (AGENTS.md §2). To spor:
 *
 *   gameState  — programmet eleven arbeider med no, så ei lukka fane ikkje
 *                kostar han arbeidet
 *   liste      — program han sjølv har gitt namn og teke vare på
 *
 * Framgangen gjennom leksjonane ligg for seg sjølv i framgang.js.
 */
const BolkLager = (function () {

    const APP = 'bolkestokk';

    /* Eit program med tusen blokker er ikkje eit program, det er ein feil —
     * og localStorage har eit tak vi deler med alle dei andre verktøya i
     * samlinga. Grensa er sett høgt nok til at ingen elev møter henne. */
    const MAKS_BLOKKER = 800;
    const MAKS_LAGRA = 40;

    /* ---- arbeidet no ------------------------------------------------------ */

    function lagreSiste(program) {
        if (BolkTre.tel(program) > MAKS_BLOKKER) return false;
        VyrdepilStorage.setGameState(APP, { program: BolkTre.serialiser(program) });
        return true;
    }

    function hentSiste() {
        const s = VyrdepilStorage.getGameState(APP);
        if (!s || !s.program) return null;
        try { return BolkTre.lesInn(s.program); } catch (f) { return null; }
    }

    /* ---- lagra program ----------------------------------------------------- */

    function alle() {
        return VyrdepilStorage.getList(APP, 'program') || [];
    }

    function lagre(namn, program) {
        const liste = alle();
        const post = {
            namn: String(namn || '').trim().slice(0, 60) || 'Utan namn',
            data: BolkTre.serialiser(program),
            dato: new Date().toISOString()
        };
        const i = liste.findIndex(p => p.namn === post.namn);
        if (i >= 0) liste[i] = post;
        else liste.unshift(post);
        VyrdepilStorage.setList(APP, 'program', liste.slice(0, MAKS_LAGRA));
        return post;
    }

    function hent(namn) {
        const post = alle().find(p => p.namn === namn);
        return post ? BolkTre.lesInn(post.data) : null;
    }

    function slett(namn) {
        VyrdepilStorage.setList(APP, 'program', alle().filter(p => p.namn !== namn));
    }

    return { lagreSiste, hentSiste, alle, lagre, hent, slett, MAKS_BLOKKER };
})();
