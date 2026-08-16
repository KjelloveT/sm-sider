/* Ormritaren — landingssida.
 *
 * Lastar ikkje Pyodide. Det er poenget med å skilje henne ut: 13 MB skal
 * ikkje hentast av nokon som berre ville sjå kva verktøyet er.
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
                'Klarte ikkje hente modulane. Du kan framleis bruke fri programmering.';
            melding.classList.add('orm-landing-feil');
            return;
        }

        melding.remove();
        (katalog.grupper || []).forEach(gruppe => {
            const modular = (katalog.modular || []).filter(m => m.gruppe === gruppe.id);
            if (modular.length) boks.appendChild(teiknGruppe(gruppe, modular));
        });

        if (window.hydrateIcons) hydrateIcons(document);
    }

    function teiknGruppe(gruppe, modular) {
        const seksjon = document.createElement('section');
        seksjon.className = 'orm-modulgruppe';

        const tittel = document.createElement('h2');
        tittel.className = 'heading3';
        tittel.textContent = gruppe.tittel;
        seksjon.appendChild(tittel);

        if (gruppe.skildring) {
            const p = document.createElement('p');
            p.className = 'orm-gruppetekst';
            p.textContent = gruppe.skildring;
            seksjon.appendChild(p);
        }

        const rutenett = document.createElement('div');
        rutenett.className = 'orm-modulrutenett';
        modular.forEach(m => rutenett.appendChild(teiknModul(m)));
        seksjon.appendChild(rutenett);

        return seksjon;
    }

    function teiknModul(modul) {
        const klar = modul.klar !== false;

        // Ein modul som ikkje er skriven enno skal ikkje vere ei lenkje —
        // men han skal synast, så læraren ser kva som er på veg.
        const kort = document.createElement(klar ? 'a' : 'div');
        kort.className = 'box4 orm-modulkort' + (klar ? '' : ' orm-modulkort-kjem');
        if (klar) kort.href = `kode.html?modul=${encodeURIComponent(modul.id)}`;

        /* --- topp --- */
        const topp = document.createElement('div');
        topp.className = 'box-header orm-modultopp';
        topp.dataset.accent = modul.accent || 'accent';

        const brikke = document.createElement('span');
        brikke.className = 'orm-modulbrikke';
        topp.appendChild(brikke);

        const ikon = document.createElement('span');
        ikon.dataset.icon = modul.ikon || 'book';
        ikon.dataset.iconSize = '20';
        topp.appendChild(ikon);

        const namn = document.createElement('span');
        namn.className = 'orm-modulnamn';
        namn.textContent = modul.tittel;
        topp.appendChild(namn);

        const trinn = document.createElement('span');
        trinn.className = 'orm-modultrinn';
        trinn.textContent = modul.trinn || '';
        topp.appendChild(trinn);

        kort.appendChild(topp);

        /* --- kropp --- */
        const kropp = document.createElement('div');
        kropp.className = 'box-body orm-modulkropp';

        const tekst = document.createElement('p');
        tekst.className = 'orm-modultekst';
        tekst.textContent = modul.skildring || '';
        kropp.appendChild(tekst);

        if (klar) {
            kropp.appendChild(framgangslinje(modul));
        } else {
            const kjem = document.createElement('p');
            kjem.className = 'orm-modulkjem';
            kjem.textContent = `Kjem snart — ${modul.talLeksjonar} leksjonar er planlagde.`;
            kropp.appendChild(kjem);
        }

        if (modul.kompetansemaal?.length) {
            kropp.appendChild(kompetansemaal(modul.kompetansemaal));
        }

        kort.appendChild(kropp);
        return kort;
    }

    function framgangslinje(modul) {
        const ferdige = OrmFramgang.talFerdige(modul.id);
        const total = modul.talLeksjonar || 0;

        const boks = document.createElement('div');
        boks.className = 'orm-framgang';

        const spor = document.createElement('div');
        spor.className = 'orm-framgang-spor';
        const fyll = document.createElement('div');
        fyll.className = 'orm-framgang-fyll';
        fyll.style.width = total ? Math.round(ferdige / total * 100) + '%' : '0';
        spor.appendChild(fyll);
        boks.appendChild(spor);

        const tal = document.createElement('span');
        tal.className = 'orm-framgang-tal';
        tal.textContent = ferdige
            ? `${ferdige} av ${total} ferdige`
            : `${total} leksjonar`;
        boks.appendChild(tal);

        return boks;
    }

    function kompetansemaal(maal) {
        const boks = document.createElement('details');
        boks.className = 'orm-maal';

        const samandrag = document.createElement('summary');
        samandrag.textContent = maal.length === 1
            ? 'Kompetansemål'
            : `Kompetansemål (${maal.length})`;
        boks.appendChild(samandrag);

        const liste = document.createElement('ul');
        liste.className = 'orm-maalliste';
        maal.forEach(m => {
            const li = document.createElement('li');
            li.textContent = m;
            liste.appendChild(li);
        });
        boks.appendChild(liste);

        // Kortet er ei lenkje — utan dette hoppar sida til kode.html når
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
