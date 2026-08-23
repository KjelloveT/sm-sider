/* Bolkestokk — tre ikon som ikkje finst i det felles settet.
 *
 * Dei blir registrerte i `VyrdepilIcons.ICON_PATHS` i staden for å leggjast
 * inn i `js/vyrdepil-icons.js`. Settet der er delt av alle 27 appane, og tre
 * ikon som berre eitt verktøy brukar høyrer ikkje heime i det. Registeret er
 * eksponert nettopp for dette.
 *
 * Alle tre er teikna i same form som resten av settet: 24×24-rute, ingen
 * fyll, `currentColor` som strek, runde endar. Då arvar dei skriftfargen og
 * ser ut som Lucide-ikona dei står ved sida av.
 */
(function () {

    if (typeof VyrdepilIcons === 'undefined' || !VyrdepilIcons.ICON_PATHS) return;

    /* Blyanten er Lucide sin eigen `pencil`, krympa til 64% og flytta ned i
     * venstre hjørne så det blir rom til pila. Vi skalerer den ekte stien
     * framfor å teikne ein ny blyant: då er han den same blyanten som står
     * på «Penn ned»-blokka og i resten av settet. */
    const BLYANT =
        '<g transform="translate(-1,5) scale(0.64)">' +
        '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>' +
        '</g>';

    const NYE = {
        /* Penn ned: blyant med ei pil som peikar ned. Blokka set pennen mot
         * arket, og det er retninga pila viser. */
        pennNed: BLYANT +
            '<path d="M20 4v11"/>' +
            '<path d="m16.8 11.8 3.2 3.2 3.2-3.2"/>',

        /* Penn opp: same blyant, pil opp.
         *
         * Før stod det eit viskelær her. Det er feil på to måtar: blokka
         * viskar ikkje ut noko, og eit viskelær får eleven til å tru at han
         * kan fjerne strek han alt har teikna. Ho løftar berre pennen. */
        pennOpp: BLYANT +
            '<path d="M20 20V9"/>' +
            '<path d="m16.8 12.2 3.2-3.2 3.2 3.2"/>',

        /* Orm — til Python-fana. Namnet på Python kjem frå Monty Python og
         * ikkje frå slangen, men slangen er det språket blir kjent på, og
         * det er han Ormritaren har namnet sitt frå. */
        orm: '<path d="M2.5 17.5c2.5 0 2.5-5 5-5s2.5 5 5 5 2.5-5 5-5"/>' +
             '<circle cx="19.3" cy="9.6" r="2.2"/>' +
             '<path d="M21.4 8.7 23.2 8"/>'
    };

    Object.keys(NYE).forEach(namn => {
        if (!VyrdepilIcons.ICON_PATHS[namn]) VyrdepilIcons.ICON_PATHS[namn] = NYE[namn];
    });
})();
