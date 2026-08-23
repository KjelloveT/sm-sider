/* Bolkestokk — leksjonsvising.
 *
 * Speglar ormritaren/js/leksjon.js: ei leksjon har læretekst med eit
 * køyrbart døme, ei løype der programmet blir bygd steg for steg, oppgåver,
 * og ei oppsummering. Same fire tekstblokktypar — avsnitt, kode, merk,
 * punkt — og ikkje fleire, av same grunn som der.
 *
 * All tekst blir sett med textContent gjennom BolkTekst (AGENTS.md §5.3).
 * Det er ikkje teori: ei modulfil er akkurat den slags fil ein lærar sender
 * vidare til ein annan lærar.
 */
const BolkLeksjon = (function () {

    let vert = {};
    let modul = null;
    let leksjon = null;
    let indeks = 0;
    let loypesteg = 0;

    async function start(vertsapi) {
        vert = vertsapi;
        const p = new URLSearchParams(location.search);
        const modulId = p.get('modul');
        if (!modulId) return;                    // fri bygging

        try {
            await last(modulId, p.get('leksjon'));
        } catch (feil) {
            vert.melding('Klarte ikkje opne leksjonen: ' + feil.message);
            return;
        }

        vert.panel.hidden = false;
        if (vert.leksjonOpna) vert.leksjonOpna();
        vert.setPalett(leksjon.palett || null);
        if (vert.setRutenett) vert.setRutenett(leksjon.rutenett || null);
        teikn();

        if (leksjon.startProgram) vert.setProgram(BolkTre.lesInn(leksjon.startProgram));
    }

    async function last(modulId, leksjonId) {
        const katalog = await (await fetch('moduler/index.json')).json();
        const oppf = (katalog.modular || []).find(m => m.id === modulId);
        if (!oppf) throw new Error('fann ingen modul som heiter ' + modulId);
        if (oppf.klar === false) throw new Error(oppf.tittel + ' er ikkje skriven enno.');

        modul = await (await fetch('moduler/' + oppf.fil)).json();
        modul.katalog = oppf;

        const idar = modul.leksjonar.map(l => l.id);
        const valt = leksjonId || BolkFramgang.neste(modul.id, idar) || idar[0];
        indeks = Math.max(0, idar.indexOf(valt));
        leksjon = modul.leksjonar[indeks];

        BolkFramgang.merk(modul.id, leksjon.id, {});
    }

    /* ---- teikning ---------------------------------------------------------- */

    function teikn() {
        const panel = vert.panel;
        panel.textContent = '';
        loypesteg = 0;

        panel.appendChild(topptekst());
        panel.appendChild(blokker(leksjon.tekst || []));
        if (leksjon.doeme) panel.appendChild(doeme(leksjon.doeme));
        if (leksjon.loype) panel.appendChild(loype(leksjon.loype));
        if (leksjon.oppgaver && leksjon.oppgaver.length) panel.appendChild(oppgavebolk());
        if (leksjon.oppsummering) panel.appendChild(oppsummering());
        panel.appendChild(navigasjon());

        if (window.hydrateIcons) hydrateIcons(panel);
    }

    function topptekst() {
        const topp = document.createElement('header');
        topp.className = 'bs-leksjonstopp';

        const sti = document.createElement('a');
        sti.className = 'bs-leksjonssti';
        sti.href = 'index.html';
        sti.textContent = '← ' + modul.tittel;
        topp.appendChild(sti);

        const teljar = document.createElement('p');
        teljar.className = 'bs-leksjonsteljar';
        teljar.textContent = 'Leksjon ' + (indeks + 1) + ' av ' + modul.leksjonar.length;
        topp.appendChild(teljar);

        const h1 = document.createElement('h1');
        h1.className = 'heading2 no-mt';
        h1.textContent = leksjon.tittel;
        topp.appendChild(h1);

        if (leksjon.kompetansemaal && leksjon.kompetansemaal.length) {
            const maal = document.createElement('details');
            maal.className = 'bs-maal';
            const s = document.createElement('summary');
            s.textContent = 'Kompetansemål';
            maal.appendChild(s);
            const ul = document.createElement('ul');
            ul.className = 'bs-maalliste';
            leksjon.kompetansemaal.forEach(m => {
                const li = document.createElement('li');
                li.textContent = m;
                ul.appendChild(li);
            });
            maal.appendChild(ul);
            topp.appendChild(maal);
        }
        return topp;
    }

    /** Læreteksten. Berre desse fire typane finst — med vilje. */
    function blokker(liste) {
        const boks = document.createElement('div');
        boks.className = 'bs-leksjonstekst';

        liste.forEach(b => {
            if (b.type === 'avsnitt') {
                boks.appendChild(BolkTekst.set(document.createElement('p'), b.tekst));

            } else if (b.type === 'kode') {
                const pre = document.createElement('pre');
                pre.className = 'bs-leskode';
                pre.textContent = b.kode;
                boks.appendChild(pre);

            } else if (b.type === 'merk') {
                const p = document.createElement('p');
                p.className = 'bs-merk';
                boks.appendChild(BolkTekst.set(p, b.tekst));

            } else if (b.type === 'punkt') {
                const ul = document.createElement('ul');
                ul.className = 'bs-punktliste';
                (b.punkt || []).forEach(t => {
                    ul.appendChild(BolkTekst.set(document.createElement('li'), t));
                });
                boks.appendChild(ul);
            }
        });
        return boks;
    }

    /**
     * Ein del som er lukka til eleven treng han.
     *
     * Fyrste utgava la laretekst, dome, loype, tre oppgaver og oppsummering
     * ut samtidig. Ein sjetteklassing som opna sida moette da ein vegg av
     * tekst for han hadde gjort noko som helst. No er alt bortsett fra
     * laereteksten lukka, og han opnar det han skal bruke.
     *
     * <details> og ikkje eigen JS: tastatur og skjermlesar folgjer med.
     */
    function trekkspel(tittel, ikon, ope) {
        const boks = document.createElement('details');
        boks.className = 'box4 bs-del';
        if (ope) boks.open = true;

        const hovud = document.createElement('summary');
        hovud.className = 'box-header bs-deltopp';
        const i = document.createElement('span');
        i.dataset.icon = ikon;
        i.dataset.iconSize = '18';
        hovud.appendChild(i);
        const t = document.createElement('span');
        t.className = 'bs-deltittel-tekst';
        t.textContent = tittel;
        hovud.appendChild(t);
        boks.appendChild(hovud);

        const kropp = document.createElement('div');
        kropp.className = 'box-body bs-delkropp';
        boks.appendChild(kropp);
        boks.kropp = kropp;
        return boks;
    }

    function deltittel(tekst, ikon) {
        const h = document.createElement('h2');
        h.className = 'bs-deltittel';
        const i = document.createElement('span');
        i.dataset.icon = ikon;
        i.dataset.iconSize = '18';
        h.appendChild(i);
        h.appendChild(document.createTextNode(tekst));
        return h;
    }

    /* ---- dømet -------------------------------------------------------------- */

    function doeme(d) {
        const seksjon = trekkspel('Prøv sjølv', 'play', true);
        seksjon.classList.add('bs-doeme');

        if (d.oppmoding) {
            seksjon.kropp.appendChild(BolkTekst.set(document.createElement('p'), d.oppmoding));
        }

        const knapp = document.createElement('button');
        knapp.type = 'button';
        knapp.className = 'btn';
        knapp.textContent = 'Hent dømet inn i programmet';
        knapp.addEventListener('click', () => {
            vert.setProgram(BolkTre.lesInn(d.program));
            vert.melding('Dømet ligg klart. Trykk Køyr.');
        });
        seksjon.kropp.appendChild(knapp);
        return seksjon;
    }

    /* ---- løypa -------------------------------------------------------------- */

    /**
     * Programmet bygd opp steg for steg.
     *
     * Ormritaren uthevar dei nye LINJENE i kvart steg. Vi gjer ikkje det
     * same med blokkene her, og det er eit val: ein blokkdiff må samanlikne
     * tre og ikkje tekst, og gevinsten er mindre når steget uansett står
     * skrive med ord rett over knappen. Steget si eiga forklaring gjer
     * jobben.
     */
    function loype(t) {
        const seksjon = trekkspel(t.tittel || 'Bygg programmet steg for steg', 'footprints', false);
        seksjon.classList.add('bs-loype');
        const inn = (n) => seksjon.kropp.appendChild(n);

        if (t.maal) {
            const m = document.createElement('p');
            m.className = 'bs-loypemaal';
            BolkTekst.set(m, 'Målet: ' + t.maal);
            inn(m);
        }

        const teljar = document.createElement('p');
        teljar.className = 'bs-loypeteljar';
        inn(teljar);

        const tekst = document.createElement('p');
        tekst.className = 'bs-loypetekst';
        inn(tekst);

        const proev = document.createElement('p');
        proev.className = 'bs-loypeproev';
        inn(proev);

        const rad = document.createElement('div');
        rad.className = 'bs-loypeknappar';

        const foerre = knapp('Førre', () => vis(loypesteg - 1));
        const neste = knapp('Neste steg', () => vis(loypesteg + 1));
        const hent = knapp('Legg steget i programmet', () => {
            vert.setProgram(BolkTre.lesInn(t.steg[loypesteg].program));
            vert.melding('Steg ' + (loypesteg + 1) + ' ligg i programmet.');
        });
        hent.classList.add('bs-btn-hent');
        rad.appendChild(foerre); rad.appendChild(neste); rad.appendChild(hent);
        inn(rad);

        function vis(i) {
            loypesteg = Math.max(0, Math.min(t.steg.length - 1, i));
            const steg = t.steg[loypesteg];
            teljar.textContent = 'Steg ' + (loypesteg + 1) + ' av ' + t.steg.length;
            BolkTekst.set(tekst, steg.tekst || '');
            proev.hidden = !steg.proev;
            if (steg.proev) BolkTekst.set(proev, 'Prøv: ' + steg.proev);
            foerre.disabled = loypesteg === 0;
            neste.disabled = loypesteg === t.steg.length - 1;
        }
        vis(0);
        return seksjon;
    }

    function knapp(tekst, ved) {
        const k = document.createElement('button');
        k.type = 'button';
        k.className = 'btn bs-btn-liten';
        k.textContent = tekst;
        k.addEventListener('click', ved);
        return k;
    }

    /* ---- oppgåvene ----------------------------------------------------------- */

    function oppgavebolk() {
        const seksjon = document.createElement('section');
        seksjon.className = 'bs-oppgavebolk';
        seksjon.appendChild(deltittel('Oppgåver', 'list'));

        BolkOppgaver.init({
            hentProgram: vert.hentProgram,
            setProgram: vert.setProgram,
            sjekk: vert.sjekk,
            loyst: () => {
                BolkFramgang.telForsok(modul.id, leksjon.id);
                if (alleLoeyste()) {
                    BolkFramgang.merk(modul.id, leksjon.id, { status: 'ferdig' });
                    vert.melding('Alle oppgåvene er løyste. Leksjonen er ferdig!');
                }
            }
        });

        leksjon.oppgaver.forEach((o, i) => seksjon.appendChild(BolkOppgaver.kort(o, i + 1)));
        return seksjon;
    }

    function alleLoeyste() {
        return leksjon.oppgaver.every(o => BolkOppgaver.erLoyst(o.id));
    }

    /* ---- botn ------------------------------------------------------------------ */

    function oppsummering() {
        const boks = trekkspel('Kort sagt', 'bookmark', false);
        boks.classList.add('bs-oppsummering');
        boks.kropp.appendChild(BolkTekst.set(document.createElement('p'), leksjon.oppsummering));
        return boks;
    }

    function navigasjon() {
        const nav = document.createElement('nav');
        nav.className = 'bs-leksjonsnav';

        /* Berre piler. Med tekst braut «Førre leksjon» og «Neste leksjon»
         * over to linjer i den smale spalta. Namnet på leksjonen det ber til
         * står i aria-label og title, så ingen mistar kva pila gjer. */
        const lenkje = (i, ikon, klasse) => {
            const a = document.createElement('a');
            a.className = 'btn bs-ikonknapp ' + klasse;
            a.href = 'bygg.html?modul=' + encodeURIComponent(modul.id)
                   + '&leksjon=' + encodeURIComponent(modul.leksjonar[i].id);
            const merke = (i < indeks ? 'Førre leksjon: ' : 'Neste leksjon: ')
                        + modul.leksjonar[i].tittel;
            a.setAttribute('aria-label', merke);
            a.setAttribute('title', merke);
            const sp = document.createElement('span');
            sp.dataset.icon = ikon;
            sp.dataset.iconSize = '20';
            a.appendChild(sp);
            return a;
        };

        if (indeks > 0) nav.appendChild(lenkje(indeks - 1, 'arrowLeft', 'bs-nav-foerre'));
        if (indeks < modul.leksjonar.length - 1) {
            nav.appendChild(lenkje(indeks + 1, 'arrowRight', 'bs-nav-neste'));
        } else {
            nav.appendChild(bru());
        }
        return nav;
    }

    /* Brua til Ormritaren. Ho står berre på den siste leksjonen: før det er
     * ho ei avsporing, etter det er ho det naturlege neste steget. */
    function bru() {
        const boks = document.createElement('div');
        boks.className = 'box1 bs-bru';
        const h = document.createElement('h3');
        h.className = 'heading4 no-mt';
        h.textContent = 'Vidare herifrå';
        boks.appendChild(h);
        const p = document.createElement('p');
        BolkTekst.set(p, 'Du har vore gjennom heile modulen. Trykk på **Python**-fana '
            + 'ved sida av teikninga: der står programmet ditt som skriven kode. Det er '
            + 'same språket som **Ormritaren** brukar, og der kan du skrive det sjølv.');
        boks.appendChild(p);
        const a = document.createElement('a');
        a.className = 'btn';
        a.href = '../ormritaren/index.html';
        a.textContent = 'Opne Ormritaren →';
        boks.appendChild(a);
        return boks;
    }

    return { start };
})();
