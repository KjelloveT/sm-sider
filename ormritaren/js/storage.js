/* Ormritaren — lagring.
 *
 * Tynn innpakking over VyrdepilStorage (AGENTS.md §2 — direkte localStorage
 * er forbode i appane). localStorage er delt mellom alle Vyrdepil-appar og
 * er berre nokre få megabyte, så vi held eit tak og seier frå i god tid.
 */
const OrmLager = (function () {

    const APP = 'ormritaren';
    const MAKS_FILER = 60;
    const MAKS_TEIKN = 400000;   // ~400 kB samla; kodefiler er små, dette er rikeleg

    function filer() {
        return VyrdepilStorage.getList(APP, 'filer');
    }

    function samlaTeikn(liste) {
        return liste.reduce((sum, f) => sum + (f.kode ? f.kode.length : 0), 0);
    }

    /** @returns {{ok:true}|{ok:false, grunn:string}} */
    function plassSjekk(liste, nyKode, idSomVertErstatta) {
        if (!idSomVertErstatta && liste.length >= MAKS_FILER) {
            return { ok: false, grunn: `Du har ${MAKS_FILER} filer, som er taket. Slett ei fil for å lagre ei ny.` };
        }
        const utan = idSomVertErstatta ? liste.filter(f => f.id !== idSomVertErstatta) : liste;
        if (samlaTeikn(utan) + (nyKode ? nyKode.length : 0) > MAKS_TEIKN) {
            return { ok: false, grunn: 'Filene dine tek for mykje plass i nettlesaren. Slett noko, eller last ned filene du vil ta vare på.' };
        }
        return { ok: true };
    }

    function nyId() {
        return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function lagre(fil) {
        const liste = filer();
        const finst = fil.id && liste.some(f => f.id === fil.id);
        const sjekk = plassSjekk(liste, fil.kode, finst ? fil.id : null);
        if (!sjekk.ok) return sjekk;

        if (finst) {
            VyrdepilStorage.updateListItem(APP, 'filer', fil.id, {
                namn: fil.namn, kode: fil.kode, endra: new Date().toISOString()
            });
            return { ok: true, id: fil.id };
        }
        const id = fil.id || nyId();
        VyrdepilStorage.saveListItem(APP, 'filer', {
            id, namn: fil.namn, kode: fil.kode,
            laga: new Date().toISOString(), endra: new Date().toISOString()
        });
        return { ok: true, id };
    }

    function slett(id) {
        VyrdepilStorage.deleteListItem(APP, 'filer', id);
    }

    function hent(id) {
        return filer().find(f => f.id === id) || null;
    }

    /* Kva fil som var open sist, og korleis panela stod. */
    function tilstand() {
        return VyrdepilStorage.getGameState(APP) || {};
    }

    function setTilstand(endringar) {
        VyrdepilStorage.setGameState(APP, { ...tilstand(), ...endringar });
    }

    return { filer, lagre, slett, hent, tilstand, setTilstand, MAKS_FILER };
})();
