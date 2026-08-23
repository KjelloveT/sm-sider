/* Bolkestokk — landingssida.
 *
 * Speglar ormritaren/js/landing.js. Kortet er ikkje sjølv ei lenkje, fordi
 * det inneheld ei lenkje per leksjon — og lenkje inni lenkje er ugyldig.
 */
(function () {

    document.addEventListener('DOMContentLoaded', start);

    async function start() {
        const boks = document.getElementById('modulgrupper');
        const melding = document.getElementById('lasteMelding');

        let katalog;
        try {
            const svar = await fetch('moduler/index.json');
            if (!svar.ok) throw new Error('status ' + svar.status);
            katalog = await svar.json();
        } catch (feil) {
            melding.textContent =
                'Klarte ikkje hente modulane. Du kan framleis byggje fritt.';
            melding.classList.add('bs-landing-feil');
            return;
        }

        melding.remove();
        (katalog.grupper || []).forEach(gruppe => {
            const modular = (katalog.modular || []).filter(m => m.gruppe === gruppe.id);
            if (modular.length) boks.appendChild(teiknGruppe(gruppe, modular));
        });

        if (window.hydrateIcons) hydrateIcons(document);

        // Leksjonslistene kjem etterpå, i parallell. Modulfilene er små —
        // nokre titals kilobyte kvar — og sida er allereie teikna, så dette
        // rører ikkje ved poenget med at landingssida skal opne fort.
        hentLeksjonar((katalog.modular || []).filter(m => m.klar !== false));
    }

    async function hentLeksjonar(modular) {
        await Promise.all(modular.map(async m => {
            try {
                const fil = await (await fetch('moduler/' + m.fil)).json();
                teiknLeksjonsliste(m, fil.leksjonar || []);
            } catch (feil) {
                // Kortet står fint utan lista; ho er ei snarveg, ikkje sjølve inngangen.
            }
        }));
        if (window.hydrateIcons) hydrateIcons(document);
    }

    function teiknGruppe(gruppe, modular) {
        const seksjon = document.createElement('section');
        seksjon.className = 'bs-modulgruppe';

        const tittel = document.createElement('h2');
        tittel.className = 'heading3';
        tittel.textContent = gruppe.tittel;
        seksjon.appendChild(tittel);

        if (gruppe.skildring) {
            const p = document.createElement('p');
            p.className = 'bs-gruppetekst';
            p.textContent = gruppe.skildring;
            seksjon.appendChild(p);
        }

        const rutenett = document.createElement('div');
        rutenett.className = 'bs-modulrutenett';
        modular.forEach(m => rutenett.appendChild(teiknModul(m)));
        seksjon.appendChild(rutenett);

        return seksjon;
    }

    function teiknModul(modul) {
        const klar = modul.klar !== false;

        /* Kortet er ikkje sjølv ei lenkje: det inneheld lenkjer til kvar
         * einskild leksjon, og lenkje inni lenkje er ugyldig. I staden er
         * overskrifta lenkja som tek deg til modulen. */
        const kort = document.createElement('div');
        kort.className = 'box4 bs-modulkort' + (klar ? '' : ' bs-modulkort-kjem');

        /* --- topp --- */
        const topp = document.createElement(klar ? 'a' : 'div');
        topp.className = 'box-header bs-modultopp';
        topp.dataset.accent = modul.accent || 'accent';
        if (klar) topp.href = `bygg.html?modul=${encodeURIComponent(modul.id)}`;

        const brikke = document.createElement('span');
        brikke.className = 'bs-modulbrikke';
        topp.appendChild(brikke);

        const ikon = document.createElement('span');
        ikon.dataset.icon = modul.ikon || 'book';
        ikon.dataset.iconSize = '20';
        topp.appendChild(ikon);

        const namn = document.createElement('span');
        namn.className = 'bs-modulnamn';
        namn.textContent = modul.tittel;
        topp.appendChild(namn);

        const trinn = document.createElement('span');
        trinn.className = 'bs-modultrinn';
        trinn.textContent = modul.trinn || '';
        topp.appendChild(trinn);

        kort.appendChild(topp);

        /* --- kropp --- */
        const kropp = document.createElement('div');
        kropp.className = 'box-body bs-modulkropp';

        const tekst = document.createElement('p');
        tekst.className = 'bs-modultekst';
        tekst.textContent = modul.skildring || '';
        kropp.appendChild(tekst);

        /* Kva modulen byggjer på. Ein lærar som vel ein modul til klassa si
         * må sjå dette FØR han vel, ikkje etter — elles set han elevane til
         * ei lykkje-oppgåve dei ikkje har fått lykkja forklart. */
        if (modul.krev) {
            const krev = document.createElement('p');
            krev.className = 'bs-modulkrev';
            krev.textContent = 'Byggjer på grunnkurset';
            kropp.appendChild(krev);
        }

        if (klar) {
            kropp.appendChild(framgangslinje(modul));
            const liste = document.createElement('ol');
            liste.className = 'bs-leksjonsliste';
            liste.id = 'leksjonar-' + modul.id;
            kropp.appendChild(liste);
        } else {
            const kjem = document.createElement('p');
            kjem.className = 'bs-modulkjem';
            kjem.textContent = `Kjem snart — ${modul.talLeksjonar} leksjonar er planlagde.`;
            kropp.appendChild(kjem);
        }

        if (modul.kompetansemaal?.length) {
            kropp.appendChild(kompetansemaal(modul.kompetansemaal));
        }

        kort.appendChild(kropp);
        return kort;
    }

    /* Alle leksjonane i modulen, med kva som er gjort og kvar ein skal
     * halde fram. Kvar er ei lenkje, så eleven kan hoppe rett dit. */
    function teiknLeksjonsliste(modul, leksjonar) {
        const liste = document.getElementById('leksjonar-' + modul.id);
        if (!liste || !leksjonar.length) return;

        const nesteId = BolkFramgang.neste(modul.id, leksjonar.map(l => l.id));

        leksjonar.forEach((l, i) => {
            const ferdig = BolkFramgang.erFerdig(modul.id, l.id);
            const erNeste = l.id === nesteId;

            const li = document.createElement('li');
            li.className = 'bs-leksjonspost'
                + (ferdig ? ' er-ferdig' : '')
                + (erNeste ? ' er-neste' : '');

            const lenkje = document.createElement('a');
            lenkje.className = 'bs-leksjonslenkje';
            lenkje.href = `bygg.html?modul=${encodeURIComponent(modul.id)}&leksjon=${encodeURIComponent(l.id)}`;

            const merke = document.createElement('span');
            merke.className = 'bs-leksjonsmerke';
            if (ferdig) {
                merke.dataset.icon = 'check';
                merke.dataset.iconSize = '14';
                merke.setAttribute('aria-label', 'Ferdig');
            } else {
                merke.textContent = String(i + 1);
            }
            lenkje.appendChild(merke);

            const tittel = document.createElement('span');
            tittel.className = 'bs-leksjonstittel';
            tittel.textContent = l.tittel;
            lenkje.appendChild(tittel);

            // Statusen står med ord i tillegg til farge og hake, slik at han
            // ikkje fell bort for den som ikkje skil fargane.
            if (erNeste) {
                const her = document.createElement('span');
                her.className = 'bs-leksjonsher';
                her.textContent = ferdig ? '' : 'held fram her';
                lenkje.appendChild(her);
            }

            li.appendChild(lenkje);
            liste.appendChild(li);
        });
    }

    function framgangslinje(modul) {
        const ferdige = BolkFramgang.talFerdige(modul.id);
        const total = modul.talLeksjonar || 0;

        const boks = document.createElement('div');
        boks.className = 'bs-framgang';

        const spor = document.createElement('div');
        spor.className = 'bs-framgang-spor';
        const fyll = document.createElement('div');
        fyll.className = 'bs-framgang-fyll';
        fyll.style.width = total ? Math.round(ferdige / total * 100) + '%' : '0';
        spor.appendChild(fyll);
        boks.appendChild(spor);

        const tal = document.createElement('span');
        tal.className = 'bs-framgang-tal';
        tal.textContent = ferdige
            ? `${ferdige} av ${total} ferdige`
            : `${total} leksjonar`;
        boks.appendChild(tal);

        return boks;
    }

    function kompetansemaal(maal) {
        const boks = document.createElement('details');
        boks.className = 'bs-maal';

        const samandrag = document.createElement('summary');
        samandrag.textContent = maal.length === 1
            ? 'Kompetansemål'
            : `Kompetansemål (${maal.length})`;
        boks.appendChild(samandrag);

        const liste = document.createElement('ul');
        liste.className = 'bs-maalliste';
        maal.forEach(m => {
            const li = document.createElement('li');
            li.textContent = m;
            liste.appendChild(li);
        });
        boks.appendChild(liste);

        // Kortet er ei lenkje — utan dette hoppar sida til bygg.html når
        // læraren berre ville folde ut måla.
        boks.addEventListener('click', (e) => e.preventDefault());
        samandrag.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            boks.open = !boks.open;
        });

        return boks;
    }
})();
