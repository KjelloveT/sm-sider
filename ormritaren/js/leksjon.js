/* Ormritaren — leksjonsvising og kodeturné.
 *
 * Ei leksjon har fire delar: læretekst med eit køyrbart døme, ein kodeturné
 * der programmet blir bygd opp steg for steg, oppgåver, og ei oppsummering.
 *
 * Læreteksten kjem som blokker i JSON og blir bygd med textContent og
 * element vi lagar sjølve — aldri innerHTML på ein streng frå fila
 * (AGENTS.md §5.3). Det kostar litt meir kode enn å skrive HTML rett i JSON,
 * men er den einaste forma som framleis er trygg den dagen ein lærar
 * importerer eit oppgåvesett han har fått tilsendt.
 */
const OrmLeksjon = (function () {

    let modul = null;         // heile modulfila
    let leksjon = null;       // den aktive leksjonen
    let indeks = 0;
    let vert = {};            // callbacks inn i app.js
    let turnesteg = 0;

    function init(verten) { vert = verten; }

    /* ---- lasting -------------------------------------------------------- */

    async function last(modulId, leksjonId) {
        const katalog = await (await fetch('moduler/index.json')).json();
        const oppf = (katalog.modular || []).find(m => m.id === modulId);
        if (!oppf) throw new Error(`Fann ingen modul som heiter ${modulId}`);
        if (oppf.klar === false) throw new Error(`${oppf.tittel} er ikkje skriven enno.`);

        modul = await (await fetch('moduler/' + oppf.fil)).json();
        modul.katalog = oppf;

        const idar = modul.leksjonar.map(l => l.id);
        const valt = leksjonId || OrmFramgang.neste(modul.id, idar) || idar[0];
        indeks = Math.max(0, idar.indexOf(valt));
        leksjon = modul.leksjonar[indeks];

        OrmFramgang.merk(modul.id, leksjon.id, {});
        return { modul, leksjon, indeks };
    }

    /* ---- rendering ------------------------------------------------------ */

    function teikn(panel) {
        panel.textContent = '';
        turnesteg = 0;

        panel.appendChild(topptekst());
        panel.appendChild(blokker(leksjon.tekst || []));

        if (leksjon.doeme) panel.appendChild(doeme(leksjon.doeme));
        if (leksjon.turne) panel.appendChild(turne(leksjon.turne));
        if (leksjon.oppgaver?.length) panel.appendChild(oppgaver(leksjon.oppgaver));
        if (leksjon.oppsummering) panel.appendChild(oppsummering());

        panel.appendChild(navigasjon());
        if (window.hydrateIcons) hydrateIcons(panel);
    }

    function topptekst() {
        const topp = document.createElement('header');
        topp.className = 'orm-leksjonstopp';

        const sti = document.createElement('a');
        sti.className = 'orm-leksjonssti';
        sti.href = 'index.html';
        sti.textContent = '← ' + modul.tittel;
        topp.appendChild(sti);

        const teljar = document.createElement('p');
        teljar.className = 'orm-leksjonsteljar';
        teljar.textContent = `Leksjon ${indeks + 1} av ${modul.leksjonar.length}`;
        topp.appendChild(teljar);

        const h1 = document.createElement('h1');
        h1.className = 'heading2 no-mt';
        h1.textContent = leksjon.tittel;
        topp.appendChild(h1);

        if (leksjon.kompetansemaal?.length) {
            const maal = document.createElement('details');
            maal.className = 'orm-maal';
            const s = document.createElement('summary');
            s.textContent = 'Kompetansemål';
            maal.appendChild(s);
            const ul = document.createElement('ul');
            ul.className = 'orm-maalliste';
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

    /** Læretekst-blokkene. Berre desse fire typane finst — med vilje. */
    function blokker(liste) {
        const boks = document.createElement('div');
        boks.className = 'orm-leksjonstekst';

        liste.forEach(b => {
            if (b.type === 'avsnitt') {
                const p = document.createElement('p');
                p.textContent = b.tekst;
                boks.appendChild(p);

            } else if (b.type === 'kode') {
                const pre = document.createElement('pre');
                pre.className = 'orm-leskode';
                pre.textContent = b.kode;
                boks.appendChild(pre);

            } else if (b.type === 'merk') {
                const p = document.createElement('p');
                p.className = 'orm-merk';
                p.textContent = b.tekst;
                boks.appendChild(p);

            } else if (b.type === 'punkt') {
                const ul = document.createElement('ul');
                ul.className = 'orm-punktliste';
                (b.punkt || []).forEach(t => {
                    const li = document.createElement('li');
                    li.textContent = t;
                    ul.appendChild(li);
                });
                boks.appendChild(ul);
            }
        });

        return boks;
    }

    /* ---- døme ----------------------------------------------------------- */

    function doeme(d) {
        const seksjon = document.createElement('section');
        seksjon.className = 'orm-leksjonsdel';

        seksjon.appendChild(deltittel('Prøv sjølv'));

        const pre = document.createElement('pre');
        pre.className = 'orm-leskode';
        pre.textContent = d.kode;
        seksjon.appendChild(pre);

        if (d.oppmoding) {
            const p = document.createElement('p');
            p.className = 'orm-oppmoding';
            p.textContent = d.oppmoding;
            seksjon.appendChild(p);
        }

        const knapp = document.createElement('button');
        knapp.type = 'button';
        knapp.className = 'btn orm-btn-liten';
        knapp.textContent = 'Hent dømet inn i editoren';
        knapp.addEventListener('click', () => vert.opneKode(d.kode));
        seksjon.appendChild(knapp);

        return seksjon;
    }

    /* ---- kodeturné ------------------------------------------------------ */

    function turne(t) {
        const seksjon = document.createElement('section');
        seksjon.className = 'orm-leksjonsdel orm-turne';

        seksjon.appendChild(deltittel(t.tittel || 'Bygg programmet steg for steg'));

        const tekst = document.createElement('p');
        tekst.className = 'orm-turnetekst';
        seksjon.appendChild(tekst);

        const proev = document.createElement('p');
        proev.className = 'orm-oppmoding';
        seksjon.appendChild(proev);

        const rad = document.createElement('div');
        rad.className = 'orm-turnerad';

        const foerre = document.createElement('button');
        foerre.type = 'button';
        foerre.className = 'btn orm-btn-liten';
        foerre.textContent = 'Førre';
        rad.appendChild(foerre);

        const teljar = document.createElement('span');
        teljar.className = 'orm-turneteljar';
        rad.appendChild(teljar);

        const neste = document.createElement('button');
        neste.type = 'button';
        neste.className = 'btn orm-btn-liten orm-btn-neste';
        neste.textContent = 'Neste steg';
        rad.appendChild(neste);

        seksjon.appendChild(rad);

        const vis = (n, skrivKode) => {
            turnesteg = Math.max(0, Math.min(n, t.steg.length - 1));
            const steg = t.steg[turnesteg];
            tekst.textContent = steg.tekst;
            proev.textContent = steg.proev || '';
            proev.hidden = !steg.proev;
            teljar.textContent = `Steg ${turnesteg + 1} av ${t.steg.length}`;
            foerre.disabled = turnesteg === 0;
            neste.disabled = turnesteg === t.steg.length - 1;
            if (skrivKode) {
                const foerreKode = turnesteg > 0 ? t.steg[turnesteg - 1].kode : '';
                vert.opneTurnesteg(steg.kode, nyeLinjer(foerreKode, steg.kode));
            }
        };

        foerre.addEventListener('click', () => vis(turnesteg - 1, true));
        neste.addEventListener('click', () => vis(turnesteg + 1, true));

        const start = document.createElement('button');
        start.type = 'button';
        start.className = 'btn orm-btn-liten';
        start.textContent = 'Start turneen';
        start.addEventListener('click', () => vis(0, true));
        rad.insertBefore(start, foerre);

        vis(0, false);
        return seksjon;
    }

    /** Kva linjer som er nye i dette steget, så editoren kan markere dei.
     *  Vi lagrar heile koden per steg framfor eit diff — eit steg kan då
     *  aldri hamne i utakt med førehistoria si, og eleven kan hoppe rett
     *  til steg 5 utan at vi må spele av 1–4. */
    function nyeLinjer(foer, etter) {
        const gamle = foer ? foer.split('\n') : [];
        const nye = etter.split('\n');
        const att = gamle.slice();
        const treff = [];

        nye.forEach((linje, i) => {
            const j = att.indexOf(linje);
            if (j >= 0) att.splice(j, 1);   // fanst frå før
            else treff.push(i);             // ny i dette steget
        });
        return treff;
    }

    /* ---- oppgåver ------------------------------------------------------- */

    function oppgaver(liste) {
        const seksjon = document.createElement('section');
        seksjon.className = 'orm-leksjonsdel';
        seksjon.appendChild(deltittel(liste.length === 1 ? 'Oppgåve' : 'Oppgåver'));
        liste.forEach((o, i) => seksjon.appendChild(OrmOppgaver.kort(o, i + 1)));
        return seksjon;
    }

    /* ---- oppsummering og navigasjon ------------------------------------- */

    function oppsummering() {
        const seksjon = document.createElement('section');
        seksjon.className = 'orm-leksjonsdel orm-oppsummering';
        seksjon.appendChild(deltittel('Kort oppsummert'));
        const p = document.createElement('p');
        p.textContent = leksjon.oppsummering;
        seksjon.appendChild(p);
        return seksjon;
    }

    function navigasjon() {
        const nav = document.createElement('nav');
        nav.className = 'orm-leksjonsnav';
        nav.setAttribute('aria-label', 'Naviger mellom leksjonar');

        if (indeks > 0) nav.appendChild(navlenkje(modul.leksjonar[indeks - 1], '← Førre'));

        const ferdig = document.createElement('button');
        ferdig.type = 'button';
        ferdig.className = 'btn orm-btn-ferdig';
        const alt = OrmFramgang.erFerdig(modul.id, leksjon.id);
        ferdig.textContent = alt ? 'Merkt som ferdig ✓' : 'Merk som ferdig';
        ferdig.disabled = alt;
        ferdig.addEventListener('click', () => {
            OrmFramgang.merk(modul.id, leksjon.id, { status: 'ferdig' });
            ferdig.textContent = 'Merkt som ferdig ✓';
            ferdig.disabled = true;
        });
        nav.appendChild(ferdig);

        if (indeks < modul.leksjonar.length - 1) {
            nav.appendChild(navlenkje(modul.leksjonar[indeks + 1], 'Neste →'));
        }
        return nav;
    }

    function navlenkje(mot, tekst) {
        const a = document.createElement('a');
        a.className = 'btn orm-btn-liten';
        a.href = `kode.html?modul=${encodeURIComponent(modul.id)}&leksjon=${encodeURIComponent(mot.id)}`;
        a.textContent = tekst;
        return a;
    }

    function deltittel(tekst) {
        const h = document.createElement('h2');
        h.className = 'heading4';
        h.textContent = tekst;
        return h;
    }

    /* ---- offentleg ------------------------------------------------------ */

    const finnOppgave = (id) => (leksjon?.oppgaver || []).find(o => o.id === id) || null;

    /** Alle oppgåvene løyste? Då er leksjonen reelt gjennomført. */
    function alleLoeyste(loeyste) {
        const ider = (leksjon?.oppgaver || []).map(o => o.id);
        return ider.length > 0 && ider.every(id => loeyste.has(id));
    }

    return {
        init, last, teikn, finnOppgave, alleLoeyste,
        modul: () => modul,
        leksjon: () => leksjon
    };
})();
