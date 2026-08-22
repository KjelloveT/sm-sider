/* Bolkestokk — oppgåvekort og retting.
 *
 * Tre typar, same tredeling som ormritaren/js/oppgaver.js:
 *   bygg  — eleven byggjer sjølv, testane rettar
 *   rett  — eleven får eit program som gjer nesten det rette og skal fikse det
 *   les   — eleven ser eit ferdig program og svarar på kva det teiknar, utan
 *           å køyre det
 *
 * `les` finst fordi det å lese eit program er noko anna enn å skrive eitt.
 * Ein elev som gjettar seg fram til rett figur ved å prøve tal, har ikkje
 * forstått kva løkka gjer — og det er nettopp den forståinga «kva teiknar
 * dette?» krev.
 */
const BolkOppgaver = (function () {

    let vert = {};
    const loyste = new Set();

    function init(verten) { vert = verten; }

    const erLoyst = (id) => loyste.has(id);

    /* Kvar type har eige ikon og eige merke. Fargen åleine ville ikkje halde
     * — difor står typen alltid med ord i tillegg. */
    const TYPAR = {
        bygg: { merke: 'Bygg',        ikon: 'layers' },
        rett: { merke: 'Rett feilen', ikon: 'search' },
        les:  { merke: 'Les blokkene', ikon: 'eye' }
    };

    /** @returns {HTMLElement} kortet for éi oppgåve */
    function kort(oppgave, nr) {
        const type = TYPAR[oppgave.type] || { merke: 'Oppgåve', ikon: 'helpCircle' };

        /* Kortet er eit trekkspel.
         *
         * Ei leksjon har opptil tre oppgåver, kvar med tekst, knappar, hint
         * og svar. Lagt ut samtidig blir det ein vegg av tekst før eleven
         * har gjort noko som helst. No ser han tre linjer, og opnar den han
         * skal arbeide med.
         *
         * <details> og ikkje eigen JS: tastatur, skjermlesar og Ctrl+F i
         * nettlesaren verkar av seg sjølv. */
        const boks = document.createElement('details');
        boks.className = 'box4 bs-oppgave';
        boks.dataset.type = oppgave.type;
        boks.dataset.id = oppgave.id;

        const topp = document.createElement('summary');
        topp.className = 'box-header bs-oppgavetopp';

        const merke = document.createElement('span');
        merke.className = 'bs-oppgavemerke';
        const ikon = document.createElement('span');
        ikon.dataset.icon = type.ikon;
        ikon.dataset.iconSize = '15';
        merke.appendChild(ikon);
        const merketekst = document.createElement('span');
        merketekst.textContent = type.merke;
        merke.appendChild(merketekst);
        topp.appendChild(merke);

        /* Målet står i sjølve samandraget. Ein elev som ser etter noko han
         * ikkje har gjort enno, skal sleppe å opne alle tre for å finne det. */
        const tittel = document.createElement('span');
        tittel.className = 'bs-oppgavemaal';
        tittel.textContent = oppgave.maal || ('Oppgåve ' + nr);
        topp.appendChild(tittel);

        const nummer = document.createElement('span');
        nummer.className = 'bs-oppgavenummer';
        nummer.textContent = String(nr);
        topp.appendChild(nummer);
        boks.appendChild(topp);

        const kropp = document.createElement('div');
        kropp.className = 'box-body bs-oppgavekropp';
        boks.appendChild(kropp);

        if (oppgave.tekst) {
            const p = document.createElement('p');
            p.className = 'bs-oppgavetekst';
            BolkTekst.set(p, oppgave.tekst);
            kropp.appendChild(p);
        }

        if (oppgave.type === 'les') byggLes(oppgave, kropp, boks);
        else byggProgram(oppgave, kropp, boks);

        return boks;
    }

    /* ---- bygg og rett -------------------------------------------------------- */

    function byggProgram(oppgave, kropp, boks) {
        const knappar = document.createElement('div');
        knappar.className = 'bs-oppgaveknappar';

        if (oppgave.startProgram) {
            const opne = document.createElement('button');
            opne.type = 'button';
            opne.className = 'btn bs-btn-liten';
            opne.textContent = oppgave.type === 'rett'
                ? 'Hent programmet som er feil'
                : 'Hent startblokkene';
            opne.addEventListener('click', () => {
                vert.setProgram(BolkTre.lesInn(oppgave.startProgram));
            });
            knappar.appendChild(opne);
        }

        const sjekk = document.createElement('button');
        sjekk.type = 'button';
        sjekk.className = 'btn bs-btn-sjekk';
        sjekk.textContent = 'Sjekk svaret';
        knappar.appendChild(sjekk);
        kropp.appendChild(knappar);

        const svarboks = document.createElement('div');
        svarboks.className = 'bs-svar';
        svarboks.hidden = true;
        kropp.appendChild(svarboks);

        const hjelp = hintTrapp(oppgave, kropp);

        sjekk.addEventListener('click', () => {
            const resultat = vert.sjekk(oppgave);
            visResultat(svarboks, resultat, oppgave, boks, hjelp);
        });
    }

    function visResultat(svarboks, resultat, oppgave, boks, hjelp) {
        svarboks.textContent = '';
        svarboks.hidden = false;

        const feila = resultat.filter(r => !r.ok);
        const rett = feila.length === 0;

        boks.classList.toggle('bs-oppgave-rett', rett);
        boks.open = true;
        svarboks.className = 'bs-svar ' + (rett ? 'bs-svar-rett' : 'bs-svar-feil');

        const tittel = document.createElement('p');
        tittel.className = 'bs-svartittel';
        tittel.textContent = rett
            ? 'Rett! Alle krava er oppfylte.'
            : (feila.length === 1 ? 'Ikkje heilt enno:' : feila.length + ' ting stemmer ikkje:');
        svarboks.appendChild(tittel);

        feila.forEach(f => {
            const rad = document.createElement('div');
            rad.className = 'bs-svarrad';

            const namn = document.createElement('strong');
            namn.textContent = f.tittel + ': ';
            rad.appendChild(namn);

            if (f.melding) {
                rad.appendChild(document.createTextNode(f.melding));
            } else if (f.fekk !== undefined) {
                rad.appendChild(document.createTextNode('Du fekk ' + f.fekk + ', venta ' + f.vent + '.'));
            }
            svarboks.appendChild(rad);
        });

        if (rett) {
            loyste.add(oppgave.id);
            if (vert.loyst) vert.loyst(oppgave.id);
        } else {
            hjelp.etterMislukka();
        }
    }

    /* ---- hint ------------------------------------------------------------------ */

    /**
     * Hint kjem eitt om gongen, og fyrst etter eit forsøk som ikkje gjekk.
     *
     * Ligg alle hinta ute frå starten, les eleven dei i staden for å tenkje.
     * Løysinga kjem heilt til slutt, og berre etter at hinta er brukte opp.
     */
    function hintTrapp(oppgave, kropp) {
        const hint = oppgave.hint || [];
        const boks = document.createElement('div');
        boks.className = 'bs-hint';
        kropp.appendChild(boks);

        let vist = 0;
        let harFeila = false;

        const knapp = document.createElement('button');
        knapp.type = 'button';
        knapp.className = 'btn bs-btn-liten bs-btn-hint';
        knapp.hidden = true;
        kropp.appendChild(knapp);

        function oppdater() {
            if (!harFeila) { knapp.hidden = true; return; }
            knapp.hidden = false;
            if (vist < hint.length) {
                knapp.textContent = vist === 0 ? 'Gje meg eit hint' : 'Eitt hint til';
            } else if (oppgave.loeysing) {
                knapp.textContent = 'Vis meg ei løysing';
            } else {
                knapp.hidden = true;
            }
        }

        knapp.addEventListener('click', () => {
            if (vist < hint.length) {
                const p = document.createElement('p');
                p.className = 'bs-hinttekst';
                BolkTekst.set(p, hint[vist]);
                boks.appendChild(p);
                vist++;
            } else if (oppgave.loeysing) {
                vert.setProgram(BolkTre.lesInn(oppgave.loeysing));
                const p = document.createElement('p');
                p.className = 'bs-hinttekst bs-loeysingstekst';
                p.textContent = 'Ei løysing ligg no i programmet. Køyr han, '
                    + 'og sjå om du forstår kvifor han verkar.';
                boks.appendChild(p);
                knapp.hidden = true;
            }
            oppdater();
        });

        return { etterMislukka: () => { harFeila = true; oppdater(); } };
    }

    /* ---- les blokkene ------------------------------------------------------------ */

    /**
     * Programmet blir teikna med den same blokkteiknaren arbeidsbenken
     * brukar, berre utan at ein kan røre det. Eit bilete ville drive
     * frå kvarandre; dette kan ikkje.
     */
    function byggLes(oppgave, kropp, boks) {
        if (oppgave.program) {
            const rute = document.createElement('div');
            rute.className = 'bs-lesblokker';
            rute.setAttribute('aria-label', 'Programmet du skal lese');
            const p = BolkTre.lesInn(oppgave.program);

            /* Kommandoane må vere med. Eit spørsmål om kor mange strek
             * «Bruk firkant» teiknar er umogleg å svare på om eleven ikkje
             * får sjå kva `firkant` er. */
            (p.kommandoar || []).forEach(k => {
                const tittel = document.createElement('p');
                tittel.className = 'bs-leshatt';
                tittel.textContent = 'Lag kommandoen ' + k.namn;
                rute.appendChild(tittel);
                (k.kropp || []).forEach(n => rute.appendChild(BolkEditor.blokk(n)));
            });

            if ((p.kommandoar || []).length && p.start.length) {
                const tittel = document.createElement('p');
                tittel.className = 'bs-leshatt';
                tittel.textContent = 'Når eg trykkjer Køyr';
                rute.appendChild(tittel);
            }

            p.start.forEach(n => rute.appendChild(BolkEditor.blokk(n)));
            kropp.appendChild(rute);
        }

        if (oppgave.sporsmal) {
            const sp = document.createElement('p');
            sp.className = 'bs-sporsmal';
            BolkTekst.set(sp, oppgave.sporsmal);
            kropp.appendChild(sp);
        }

        const liste = document.createElement('div');
        liste.className = 'bs-alternativ';
        kropp.appendChild(liste);

        const svarboks = document.createElement('div');
        svarboks.className = 'bs-svar';
        svarboks.hidden = true;
        kropp.appendChild(svarboks);

        (oppgave.alternativ || []).forEach((tekst, i) => {
            const k = document.createElement('button');
            k.type = 'button';
            k.className = 'btn bs-alternativ-knapp';
            k.textContent = tekst;
            k.addEventListener('click', () => svar(i, k));
            liste.appendChild(k);
        });

        function svar(i, k) {
            const rett = i === oppgave.rett;
            liste.querySelectorAll('button').forEach(b => { b.disabled = true; });
            k.classList.add(rett ? 'er-rett' : 'er-feil');
            if (!rett) {
                const fasit = liste.children[oppgave.rett];
                if (fasit) fasit.classList.add('er-rett');
            }

            svarboks.hidden = false;
            svarboks.className = 'bs-svar ' + (rett ? 'bs-svar-rett' : 'bs-svar-feil');
            svarboks.textContent = '';

            const t = document.createElement('p');
            t.className = 'bs-svartittel';
            t.textContent = rett ? 'Rett!' : 'Ikkje heilt — det rette svaret står markert.';
            svarboks.appendChild(t);

            if (oppgave.forklaring) {
                svarboks.appendChild(BolkTekst.set(document.createElement('p'), oppgave.forklaring));
            }

            boks.classList.toggle('bs-oppgave-rett', rett);
            boks.open = true;
            // Ei lesoppgåve tel som løyst når ho er svara på: eleven har
            // sett fasiten og forklaringa, og å svare på nytt lærer ingen noko.
            loyste.add(oppgave.id);
            if (vert.loyst) vert.loyst(oppgave.id);
        }
    }

    return { init, kort, erLoyst, TYPAR };
})();
