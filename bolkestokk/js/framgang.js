/* Bolkestokk — framgang gjennom leksjonane.
 *
 * Ligg lokalt gjennom VyrdepilStorage (AGENTS.md §2). Framgangen er elevens
 * eiga: ho er til for at han skal finne att staden sin, ikkje for å vurdere
 * han, og ingen lærar kan hente henne inn.
 */
const BolkFramgang = (function () {

    const APP = 'bolkestokk';
    const SAMLING = 'framgang';

    /** @returns {Array<{modul:string, leksjon:string, status:string, forsok:number, dato:string}>} */
    function alle() {
        return VyrdepilStorage.getCollection(APP, SAMLING) || [];
    }

    function lagre(liste) {
        VyrdepilStorage.setCollection(APP, SAMLING, liste);
    }

    function hent(modul, leksjon) {
        return alle().find(f => f.modul === modul && f.leksjon === leksjon) || null;
    }

    /** Set eller oppdaterer status for éi leksjon. */
    function merk(modul, leksjon, endringar) {
        const liste = alle();
        const i = liste.findIndex(f => f.modul === modul && f.leksjon === leksjon);
        const grunn = { modul, leksjon, status: 'paabegynt', forsok: 0 };
        const ny = { ...(i >= 0 ? liste[i] : grunn), ...endringar, dato: new Date().toISOString() };

        // Ei ferdig leksjon skal ikkje bli «påbegynt» att om eleven kjem tilbake.
        if (i >= 0 && liste[i].status === 'ferdig' && ny.status !== 'ferdig') {
            ny.status = 'ferdig';
        }

        if (i >= 0) liste[i] = ny; else liste.push(ny);
        lagre(liste);
        return ny;
    }

    function telForsok(modul, leksjon) {
        const no = hent(modul, leksjon);
        return merk(modul, leksjon, { forsok: (no ? no.forsok : 0) + 1 });
    }

    const erFerdig = (modul, leksjon) => hent(modul, leksjon)?.status === 'ferdig';

    /** Tal ferdige leksjonar i ein modul. */
    function talFerdige(modul) {
        return alle().filter(f => f.modul === modul && f.status === 'ferdig').length;
    }

    /** Fyrste leksjonen som ikkje er ferdig — det eleven skal halde fram med. */
    function neste(modul, leksjonIdar) {
        return leksjonIdar.find(id => !erFerdig(modul, id)) || null;
    }

    function nullstill(modul) {
        lagre(alle().filter(f => f.modul !== modul));
    }

    return { alle, hent, merk, telForsok, erFerdig, talFerdige, neste, nullstill };
})();
