/* Ormritaren — utskriftsrute, modalar og fanar.
 *
 * All tekst frå elevkode blir sett inn med textContent (AGENTS.md §5.3).
 */
const OrmUI = (function () {

    let ut, statuslinje, tregvarsel;

    function init(el) {
        ut = el.utskrift;
        statuslinje = el.status;
        tregvarsel = el.treg;
    }

    /* ---- utskrift ------------------------------------------------------ */

    function skriv(tekst, erFeil) {
        const bit = document.createElement('span');
        if (erFeil) bit.className = 'orm-ut-feil';
        bit.textContent = tekst;
        ut.appendChild(bit);
        ut.scrollTop = ut.scrollHeight;
    }

    function tomUtskrift() {
        ut.textContent = '';
    }

    /** Feilblokk: nynorsk forklaring over, ekte traceback under. */
    function skrivFeil(feil) {
        const boks = document.createElement('div');
        boks.className = 'orm-feilboks';

        const tittel = document.createElement('div');
        tittel.className = 'orm-feil-tittel';
        tittel.textContent = feil.linje
            ? `${feil.type} — linje ${feil.linje}`
            : feil.type;
        boks.appendChild(tittel);

        const hjelp = document.createElement('p');
        hjelp.className = 'orm-feil-hjelp';
        hjelp.innerHTML = OrmFeil.forklar(feil);   // berre <code> vi lagar sjølve
        boks.appendChild(hjelp);

        const detaljar = document.createElement('details');
        const samandrag = document.createElement('summary');
        samandrag.textContent = 'Vis den opphavlege feilmeldinga frå Python';
        detaljar.appendChild(samandrag);
        const pre = document.createElement('pre');
        pre.className = 'orm-traceback';
        pre.textContent = feil.traceback || '';
        detaljar.appendChild(pre);
        boks.appendChild(detaljar);

        ut.appendChild(boks);
        ut.scrollTop = ut.scrollHeight;
    }

    /* ---- variablar ----------------------------------------------------- */

    /** Viser kva eleven sat att med. Panelet står skjult når det er tomt. */
    function visVariablar(liste) {
        const panel = document.getElementById('panelVariablar');
        const kropp = document.getElementById('varliste');
        if (!panel || !kropp) return;

        kropp.textContent = '';
        if (!liste || !liste.length) { panel.hidden = true; return; }

        liste.forEach(v => {
            const rad = document.createElement('tr');

            const namn = document.createElement('th');
            namn.scope = 'row';
            namn.className = 'orm-varnamn';
            namn.textContent = v.namn;
            rad.appendChild(namn);

            const verdi = document.createElement('td');
            verdi.className = 'orm-varverdi';
            verdi.textContent = v.verdi;
            // Typen er nyttig når 12 og "12" ser like ut, men skal ikkje
            // stele merksemda frå verdien.
            const type = document.createElement('span');
            type.className = 'orm-vartype';
            type.textContent = v.type;
            verdi.appendChild(type);
            rad.appendChild(verdi);

            kropp.appendChild(rad);
        });
        panel.hidden = false;
    }

    /* ---- status -------------------------------------------------------- */

    function status(tekst, tilstand) {
        statuslinje.textContent = tekst;
        statuslinje.dataset.tilstand = tilstand || '';
    }

    function visTreg(vis) {
        tregvarsel.hidden = !vis;
    }

    /* ---- input-modal --------------------------------------------------- */

    /* Modalen blir vist med klassa .open, ikkje med hidden-attributtet:
     * .modal-overlay er display:none i neobrutalisme.css, og eit hidden-attributt
     * gjer ingenting mot ein eksplisitt display-regel. Set du berre hidden=false,
     * blir modalen ståande usynleg medan Python ventar i det uendelege. */
    function spor(ledetekst, svar, avbryt) {
        const overlay = document.getElementById('inputOverlay');
        const felt = document.getElementById('inputFelt');
        const merke = document.getElementById('inputLedetekst');
        const skjema = document.getElementById('inputSkjema');

        const harLedetekst = ledetekst && ledetekst.trim();
        merke.textContent = harLedetekst
            ? ledetekst
            : 'Programmet ventar på at du skriv noko:';
        felt.value = '';
        overlay.classList.add('open');
        felt.focus();

        function lukk() {
            skjema.removeEventListener('submit', ferdig);
            document.removeEventListener('keydown', paaTast);
            overlay.classList.remove('open');
        }

        function ferdig(e) {
            e.preventDefault();
            const verdi = felt.value;
            lukk();
            // Ekko både ledetekst og svar inn i utskrifta, slik at samtalen
            // heng saman etterpå — som i eit vanleg terminalvindauge.
            if (harLedetekst) skriv(ledetekst, false);
            skriv(verdi + '\n', false);
            svar(verdi);
        }

        /* Escape skal lukke modalar (AGENTS.md §5.4). Her kan vi ikkje berre
         * lukke: Python står og ventar, så vi stoppar programmet i staden. */
        function paaTast(e) {
            if (e.key !== 'Escape') return;
            lukk();
            avbryt?.();
        }

        skjema.addEventListener('submit', ferdig);
        document.addEventListener('keydown', paaTast);
    }

    /* ---- fanar (mobil) -------------------------------------------------- */

    /* Fanane gøymer panel med CSS, ikkje med hidden-attributtet.
     * På desktop står begge panela side om side, og eit hidden-attributt sett
     * her ville følgt med dit og gøymt utskrifta. Difor set vi berre eit
     * data-fane på arbeidsflata, og lèt media-spørjinga avgjere kva det tyder. */
    function koplFanar(fanerad, flate, etterBytte) {
        fanerad.addEventListener('click', (e) => {
            const knapp = e.target.closest('.box-tab');
            if (!knapp) return;
            fanerad.querySelectorAll('.box-tab').forEach(k => {
                const aktiv = k === knapp;
                k.classList.toggle('active', aktiv);
                k.setAttribute('aria-selected', String(aktiv));
            });
            flate.dataset.fane = knapp.dataset.fane;
            etterBytte?.(knapp.dataset.fane);
        });
    }

    return { init, skriv, tomUtskrift, skrivFeil, status, visTreg, spor, koplFanar, visVariablar };
})();
