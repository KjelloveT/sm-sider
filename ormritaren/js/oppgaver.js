/* Ormritaren — oppgåvekort og retting.
 *
 * Tre typar:
 *   skriv  — eleven skriv koden sjølv, testane rettar
 *   les    — eleven ser eit program og svarar på kva det skriv ut, utan å køyre
 *   rett   — eleven får eit program med vanlege nybyrjarfeil og skal fikse det
 *
 * `les` finst fordi 10. trinn har eit eige kompetansemål om å *lese og
 * forklare* Python-kode. Det blir ikkje dekt av å skrive kode sjølv.
 */
const OrmOppgaver = (function () {

    /* Kva som er meldt inn utanfrå: opne kode i editoren, hente koden,
     * køyre testar, og seie frå når ei oppgåve er løyst. */
    let vert = {};

    function init(verten) { vert = verten; }

    /** @returns {HTMLElement} kortet for éi oppgåve */
    function kort(oppgave, nr) {
        const boks = document.createElement('section');
        boks.className = 'box4 orm-oppgave';
        boks.dataset.type = oppgave.type;
        boks.dataset.id = oppgave.id;

        const topp = document.createElement('div');
        topp.className = 'box-header orm-oppgavetopp';
        const merke = document.createElement('span');
        merke.className = 'orm-oppgavemerke';
        merke.textContent = { skriv: 'Skriv', les: 'Les', rett: 'Rett feilen' }[oppgave.type] || 'Oppgåve';
        topp.appendChild(merke);
        const tittel = document.createElement('span');
        tittel.textContent = `Oppgåve ${nr}`;
        topp.appendChild(tittel);
        boks.appendChild(topp);

        const kropp = document.createElement('div');
        kropp.className = 'box-body orm-oppgavekropp';
        boks.appendChild(kropp);

        if (oppgave.tekst) {
            const p = document.createElement('p');
            p.className = 'orm-oppgavetekst';
            p.textContent = oppgave.tekst;
            kropp.appendChild(p);
        }

        if (oppgave.type === 'les') byggLes(oppgave, kropp, boks);
        else byggKode(oppgave, kropp, boks);

        return boks;
    }

    /* ---- skriv og rett -------------------------------------------------- */

    function byggKode(oppgave, kropp, boks) {
        const knappar = document.createElement('div');
        knappar.className = 'orm-oppgaveknappar';

        const opne = document.createElement('button');
        opne.type = 'button';
        opne.className = 'btn orm-btn-liten';
        opne.textContent = oppgave.type === 'rett'
            ? 'Hent den øydelagde koden'
            : 'Hent startkoden';
        opne.addEventListener('click', () => vert.opneKode(oppgave.startkode || '', oppgave.id));
        knappar.appendChild(opne);

        const sjekk = document.createElement('button');
        sjekk.type = 'button';
        sjekk.className = 'btn orm-btn-sjekk';
        sjekk.textContent = 'Sjekk svaret';
        knappar.appendChild(sjekk);

        kropp.appendChild(knappar);

        const svarboks = document.createElement('div');
        svarboks.className = 'orm-svar';
        svarboks.hidden = true;
        kropp.appendChild(svarboks);

        const hjelp = hintTrapp(oppgave, kropp);

        sjekk.addEventListener('click', async () => {
            sjekk.disabled = true;
            sjekk.textContent = 'Sjekkar …';
            const resultat = await vert.sjekk(oppgave);
            sjekk.disabled = false;
            sjekk.textContent = 'Sjekk svaret';
            visResultat(svarboks, resultat, oppgave, boks, hjelp);
        });
    }

    function visResultat(svarboks, resultat, oppgave, boks, hjelp) {
        svarboks.textContent = '';
        svarboks.hidden = false;

        const feila = resultat.filter(r => !r.ok);
        const rett = feila.length === 0;

        boks.classList.toggle('orm-oppgave-rett', rett);
        svarboks.className = 'orm-svar ' + (rett ? 'orm-svar-rett' : 'orm-svar-feil');

        const tittel = document.createElement('p');
        tittel.className = 'orm-svartittel';
        tittel.textContent = rett
            ? 'Rett! Alle testane gjekk gjennom.'
            : (feila.length === 1 ? 'Ikkje heilt enno:' : `${feila.length} ting stemmer ikkje:`);
        svarboks.appendChild(tittel);

        if (rett) {
            vert.loest(oppgave.id);
            hjelp?.avslør();
            return;
        }

        const liste = document.createElement('ul');
        liste.className = 'orm-svarliste';
        feila.forEach(f => {
            const li = document.createElement('li');
            li.textContent = f.melding || 'Testen gjekk ikkje gjennom.';
            if (f.linje) li.textContent += ` (linje ${f.linje})`;

            if (f.fekk !== undefined) {
                const jf = document.createElement('div');
                jf.className = 'orm-svarjamfoer';
                jf.appendChild(jamfoerrad('Du fekk', f.fekk));
                jf.appendChild(jamfoerrad('Venta', f.vente));
                li.appendChild(jf);
            }
            liste.appendChild(li);
        });
        svarboks.appendChild(liste);
        hjelp?.tilby();
    }

    function jamfoerrad(merkelapp, verdi) {
        const rad = document.createElement('div');
        const m = document.createElement('span');
        m.className = 'orm-jamfoer-merke';
        m.textContent = merkelapp + ':';
        rad.appendChild(m);
        const v = document.createElement('code');
        v.className = 'orm-jamfoer-verdi';
        v.textContent = String(verdi);
        rad.appendChild(v);
        return rad;
    }

    /* ---- les ------------------------------------------------------------ */

    function byggLes(oppgave, kropp, boks) {
        const pre = document.createElement('pre');
        pre.className = 'orm-leskode';
        pre.textContent = oppgave.kode;
        kropp.appendChild(pre);

        const sporsmal = document.createElement('p');
        sporsmal.className = 'orm-lessporsmal';
        sporsmal.textContent = oppgave.sporsmal || 'Kva skriv programmet ut?';
        kropp.appendChild(sporsmal);

        const gruppe = document.createElement('div');
        gruppe.className = 'orm-alternativ';
        gruppe.setAttribute('role', 'radiogroup');
        gruppe.setAttribute('aria-label', sporsmal.textContent);

        const namn = 'alt-' + oppgave.id;
        (oppgave.alternativ || []).forEach((alt, i) => {
            const merkelapp = document.createElement('label');
            merkelapp.className = 'orm-alternativ-val';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = namn;
            radio.value = String(i);
            merkelapp.appendChild(radio);

            const tekst = document.createElement('code');
            tekst.textContent = alt;
            merkelapp.appendChild(tekst);

            gruppe.appendChild(merkelapp);
        });
        kropp.appendChild(gruppe);

        const knappar = document.createElement('div');
        knappar.className = 'orm-oppgaveknappar';
        const svarKnapp = document.createElement('button');
        svarKnapp.type = 'button';
        svarKnapp.className = 'btn orm-btn-sjekk';
        svarKnapp.textContent = 'Svar';
        knappar.appendChild(svarKnapp);
        kropp.appendChild(knappar);

        const svarboks = document.createElement('div');
        svarboks.className = 'orm-svar';
        svarboks.hidden = true;
        kropp.appendChild(svarboks);

        svarKnapp.addEventListener('click', () => {
            const valt = gruppe.querySelector('input:checked');
            if (!valt) {
                svarboks.hidden = false;
                svarboks.className = 'orm-svar orm-svar-feil';
                svarboks.textContent = 'Vel eit av alternativa fyrst.';
                return;
            }
            const rett = Number(valt.value) === oppgave.rett;
            svarboks.textContent = '';
            svarboks.hidden = false;
            svarboks.className = 'orm-svar ' + (rett ? 'orm-svar-rett' : 'orm-svar-feil');
            boks.classList.toggle('orm-oppgave-rett', rett);

            const tittel = document.createElement('p');
            tittel.className = 'orm-svartittel';
            tittel.textContent = rett ? 'Rett!' : 'Ikkje heilt.';
            svarboks.appendChild(tittel);

            if (oppgave.forklaring) {
                const f = document.createElement('p');
                f.className = 'orm-svarforklaring';
                f.textContent = oppgave.forklaring;
                svarboks.appendChild(f);
            }

            // Halve poenget: fyrst tenkje, så sjekke sjølv. Køyring blir
            // difor fyrst tilgjengeleg etter at eleven har svart.
            const proev = document.createElement('button');
            proev.type = 'button';
            proev.className = 'btn orm-btn-liten';
            proev.textContent = 'Køyr koden og sjå sjølv';
            proev.addEventListener('click', () => vert.opneKode(oppgave.kode, oppgave.id));
            svarboks.appendChild(proev);

            if (rett) vert.loest(oppgave.id);
            svarKnapp.disabled = true;
        });
    }

    /* ---- hint ----------------------------------------------------------- */

    /** Hint kjem eitt om gongen, og fyrst etter eit mislukka forsøk. */
    function hintTrapp(oppgave, kropp) {
        const hint = oppgave.hint || [];
        if (!hint.length && !oppgave.loeysing) return null;

        const boks = document.createElement('div');
        boks.className = 'orm-hintboks';
        boks.hidden = true;
        kropp.appendChild(boks);

        let vist = 0;

        const knapp = document.createElement('button');
        knapp.type = 'button';
        knapp.className = 'btn orm-btn-liten orm-btn-hint';
        knapp.textContent = hint.length ? 'Vis eit hint' : 'Vis løysingsforslag';
        boks.appendChild(knapp);

        const liste = document.createElement('div');
        liste.className = 'orm-hintliste';
        boks.insertBefore(liste, knapp);

        knapp.addEventListener('click', () => {
            if (vist < hint.length) {
                const p = document.createElement('p');
                p.className = 'orm-hint-tekst';
                p.textContent = hint[vist];
                liste.appendChild(p);
                vist++;
                if (vist < hint.length) knapp.textContent = 'Vis eit hint til';
                else if (oppgave.loeysing) knapp.textContent = 'Vis løysingsforslag';
                else knapp.hidden = true;
            } else if (oppgave.loeysing) {
                visLoeysing(liste, oppgave.loeysing);
                knapp.hidden = true;
            }
        });

        return {
            tilby: () => { boks.hidden = false; },
            avslør: () => { boks.hidden = false; }
        };
    }

    function visLoeysing(liste, loeysing) {
        const tittel = document.createElement('p');
        tittel.className = 'orm-hint-tekst';
        tittel.textContent = 'Eitt forslag til løysing — det finst ofte fleire:';
        liste.appendChild(tittel);
        const pre = document.createElement('pre');
        pre.className = 'orm-leskode';
        pre.textContent = loeysing;
        liste.appendChild(pre);
    }

    return { init, kort };
})();
