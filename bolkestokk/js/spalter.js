/* Bolkestokk — dei tre sidespaltene og korleis dei kollapsar.
 *
 * Kvar av spaltene — leksjon, kodeblokker, resultat — har ei overskrift med
 * ein kollapsknapp. Kollapsa blir spalta ei 15px farga stripe som er eitt
 * stort trykkfelt; det einaste som gjev meining på den breidda.
 *
 * Medan programmet køyrer gjer leksjonen plass av seg sjølv, for då er det
 * teikninga og blokkene eleven ser på. Ho kjem att litt etterpå. Har eleven
 * SJØLV kollapsa henne, kjem ho ikkje att — det ville vore å overprøve han.
 *
 * Fila er skild ut frå app.js, som gjorde køyring, fart, stegmodus og
 * spaltekoreografi i eitt. Dei to har ingenting med kvarandre å gjere: det
 * einaste app.js treng herifrå er tre kall — `leksjonOpna`, `medanKoyrer` og
 * `hentLeksjonAtt`.
 *
 * MERK: rørsla ligg på innhaldet og ikkje på `grid-template-columns`. Sjå
 * grunngjevinga i style.css. Ikkje legg ein overgang på grid-eigenskapen inn
 * att — han frys spaltebreidda for godt.
 */
const BolkSpalter = (function () {

    const SPALTER = [
        { id: 'leksjon',  spalte: 'spalteLeksjon',  knapp: 'kollapsLeksjon',
          opne: 'Vis leksjonen',    lukke: 'Skjul leksjonen',   klasse: 'bs-skjul-leksjon' },
        { id: 'palett',   spalte: 'spaltePalett',   knapp: 'kollapsPalett',
          opne: 'Vis kodeblokkene', lukke: 'Skjul kodeblokkene', klasse: 'bs-skjul-palett' },
        { id: 'resultat', spalte: 'spalteResultat', knapp: 'kollapsResultat',
          opne: 'Vis resultatet',   lukke: 'Skjul resultatet',   klasse: 'bs-skjul-resultat' }
    ];

    const LEKSJON = SPALTER[0];
    const RESULTAT = SPALTER[2];
    const VENT_FOER_VISING = 1600;

    let el = null;
    let brukarSkjultLeksjon = false;
    let visTimer = null;

    /** @param {Object} element oppslag frå id til DOM-node, sett opp av app.js */
    function init(element) {
        el = element;
        SPALTER.forEach(sp => el[sp.knapp].addEventListener(
            'click', () => veksel(sp, true)));
        /* Resultatet startar lukka. Ei tom kvit teikneflate fortel ingenting,
         * og ho tek ein fjerdedel av flata frå blokkene eleven skal byggje
         * med. Køyr opnar henne. */
        setSpalte(RESULTAT, true);
    }

    const harLeksjon = () => el.spalteLeksjon && !el.spalteLeksjon.hidden;
    const erKollapsa = (sp) => el[sp.spalte].classList.contains('er-kollapsa');

    function setSpalte(sp, kollapsa) {
        el[sp.spalte].classList.toggle('er-kollapsa', kollapsa);
        el.flate.classList.toggle(sp.klasse, kollapsa);
        const knapp = el[sp.knapp];
        const tekst = kollapsa ? sp.opne : sp.lukke;
        knapp.setAttribute('aria-expanded', String(!kollapsa));
        knapp.setAttribute('aria-label', tekst);
        knapp.setAttribute('title', tekst);
    }

    /** @param {boolean} frivilja true når det er eleven som trykte */
    function veksel(sp, frivilja) {
        const skalKollapse = !erKollapsa(sp);
        if (sp.id === 'leksjon' && frivilja) brukarSkjultLeksjon = skalKollapse;
        if (frivilja) clearTimeout(visTimer);
        setSpalte(sp, skalKollapse);
    }

    function leksjonOpna() {
        el.spalteLeksjon.hidden = false;
        setSpalte(LEKSJON, false);
    }

    /** Kalla når Køyr blir trykt. */
    function medanKoyrer() {
        // Resultatet kjem fram i same augeblink som leksjonen gjer plass.
        if (erKollapsa(RESULTAT)) setSpalte(RESULTAT, false);
        if (!harLeksjon() || erKollapsa(LEKSJON)) return;
        clearTimeout(visTimer);
        setSpalte(LEKSJON, true);
    }

    /* Berre leksjonen kjem att av seg sjølv. Resultatet blir ståande til
     * eleven lukkar det sjølv — han er som regel ikkje ferdig med å sjå på
     * figuren i det programmet stoppar. */
    function hentLeksjonAtt() {
        if (!harLeksjon() || brukarSkjultLeksjon) return;
        clearTimeout(visTimer);
        visTimer = setTimeout(() => setSpalte(LEKSJON, false), VENT_FOER_VISING);
    }

    return { init, leksjonOpna, medanKoyrer, hentLeksjonAtt };
})();
