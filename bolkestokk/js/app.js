/* Bolkestokk — limet.
 *
 * Held programmet, koplar modulane saman og driv køyringa. Same rolla som
 * ormritaren/js/app.js har der: den einaste staden modulane snakkar saman,
 * slik at ingen av dei treng kjenne kvarandre.
 */
(function () {

    /* Steg per SEKUND, ikkje per bilete.
     *
     * Fyrste utgåva talde steg per animasjonsbilete, og då vart lågaste fart
     * eitt steg per bilete — altså seksti i sekundet på ein vanleg skjerm.
     * Heile skalaen låg mellom «for fort å følgje med på» og «endå fortare».
     * Med tid som eining betyr hakka det same same kor rask skjermen er.
     *
     * Skalaen strekkjer seg heilt ned til éi blokk annakvart sekund. Det
     * verkar absurd sakte til ein set seg ved sida av ein elev som ikkje har
     * skjøna kva løkka gjer: der er det nettopp den farten som trengst, og
     * to i sekundet — som var det tregaste i fyrste utgåva — ligg no midt på
     * skalaen. Øvste hakket hoppar over animasjonen heilt, for den som berre
     * vil sjå figuren. */
    const FART = { 1: 0.5, 2: 1, 3: 2, 4: 5, 5: 15, 6: Infinity };

    const el = {};
    let program = null;
    let koyring = null;          // { g, ktx, id }
    let ulagra = false;

    document.addEventListener('DOMContentLoaded', start);

    function start() {
        ['palett', 'arbeid', 'koyr', 'stopp', 'toem', 'nyFunksjon', 'fart', 'status',
         'lerret', 'utskrift', 'feil', 'faneTeikning', 'fanePython',
         'ruteTeikning', 'rutePython', 'leksjonspanel',
         'stegKnapp', 'stegrad', 'nesteSteg', 'spelAv', 'stegInfo',
         'stegblokk', 'stegblokkTekst', 'stegGjort', 'stegGjortTekst', 'variablar',
         'flate', 'spalteLeksjon', 'spaltePalett', 'spalteResultat',
         'kollapsLeksjon', 'kollapsPalett', 'kollapsResultat']
            .forEach(id => { el[id] = document.getElementById(id); });

        program = BolkLager.hentSiste() || nyttProgram();

        BolkLerret.init(el.lerret);
        BolkEditor.init({ palett: el.palett, arbeid: el.arbeid },
                        { paaEndring: endra, paaVal: () => {} });
        BolkDra.init({ palett: el.palett, arbeid: el.arbeid }, { paaEndring: endra });

        BolkEditor.set(program);
        BolkDra.set(program);
        BolkEditor.teiknPalett();
        BolkEditor.teikn();
        BolkLerret.tom();

        el.koyr.addEventListener('click', () => koyr());
        el.stopp.addEventListener('click', stopp);
        el.toem.addEventListener('click', toem);
        el.nyFunksjon.addEventListener('click', nyFunksjon);
        el.faneTeikning.addEventListener('click', () => fane('teikning'));
        el.fanePython.addEventListener('click', () => fane('python'));
        el.stegKnapp.addEventListener('click', startStegmodus);
        el.nesteSteg.addEventListener('click', () => { stansAvspeling(); eittSteg(); });
        el.spelAv.addEventListener('click', vekselAvspeling);
        SPALTER.forEach(sp => el[sp.knapp].addEventListener(
            'click', () => vekselSpalte(sp, true)));

        // Ei uferdig teikning er ikkje verdt å miste fordi ein fane vart lukka.
        window.addEventListener('beforeunload', lagre);
        setInterval(() => { if (ulagra) lagre(); }, 4000);

        /* Nettlesaren pausar requestAnimationFrame i ei fane som ligg i
         * bakgrunnen. Utan dette ville eit program eleven starta og så bytte
         * vekk frå, stå fryst midt i figuren — og Køyr-knappen bli ståande
         * deaktivert til han lasta sida på nytt. Animasjonen er til for den
         * som ser på; er ingen der, teiknar vi ferdig med ein gong. Same
         * grepet som Ormritaren gjer med turtle-avspelinga. */
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && koyring) fullfoerStrakt();
        });

        /* `typeof`, ikkje `window.BolkLeksjon`: modulane er deklarerte med
         * `const` på toppnivå, og ein slik konstant blir aldri ein eigenskap
         * på window. Vakta ville difor alltid vore usann. */
        /* Resultatet er lukka til det finst eit resultat.
         *
         * Ei tom kvit teikneflate og ei tom utskriftsrute fortel ingenting, og
         * dei tek ein fjerdedel av flata frå blokkene eleven skal byggje med.
         * Fyrste Køyr opnar spalta, og då blir ho ståande — det er der han
         * skal sjå etter frå då av. */
        setSpalte(RESULTAT, true);

        if (typeof BolkLeksjon !== 'undefined') BolkLeksjon.start(vertsapi());
    }

    function nyttProgram() {
        const p = BolkTre.nyttProgram();
        return p;
    }

    /* ---- endringar ------------------------------------------------------- */

    function endra() {
        ulagra = true;
        if (!el.rutePython.hidden) visPython();
    }

    function lagre() {
        if (!ulagra) return;
        BolkLager.lagreSiste(program);
        ulagra = false;
    }

    function setProgram(nytt) {
        program = nytt;
        BolkEditor.set(program);
        BolkDra.set(program);
        BolkEditor.merk(null);
        BolkEditor.teikn();
        BolkLerret.tom();
        el.utskrift.textContent = '';
        el.feil.hidden = true;
        el.variablar.hidden = true;
        el.stegblokk.hidden = true;
        el.stegGjort.hidden = true;
        ulagra = true;
    }

    function toem() {
        if (BolkTre.tel(program) && !confirm('Vil du fjerne alle blokkene?')) return;
        setProgram(BolkTre.nyttProgram());
    }

    function nyFunksjon() {
        const brukte = BolkTre.funksjonsnamn(program);
        let namn = 'firkant', n = 2;
        while (brukte.indexOf(namn) >= 0) namn = 'firkant' + (n++);
        program.funksjonar.push({ namn, kropp: [] });
        BolkEditor.teikn();
        endra();
    }

    /* ---- spaltene kan kollapsast --------------------------------------------
     *
     * Kvar av dei tre sidespaltene har ei overskrift med ein kollapsknapp.
     * Kollapsa blir spalta ei 10px farga stripe som er eitt stort trykkfelt
     * — det einaste som gjev meining på den breidda.
     *
     * Medan programmet køyrer gjer leksjonen plass av seg sjølv, for då er
     * det teikninga og blokkene eleven ser på. Ho kjem att litt etterpå.
     * Har eleven sjølv kollapsa henne, kjem ho ikkje att av seg sjølv — det
     * ville vore å overprøve han. */

    const SPALTER = [
        { id: 'leksjon',  spalte: 'spalteLeksjon',  knapp: 'kollapsLeksjon',
          opne: 'Vis leksjonen',    lukke: 'Skjul leksjonen',   klasse: 'bs-skjul-leksjon' },
        { id: 'palett',   spalte: 'spaltePalett',   knapp: 'kollapsPalett',
          opne: 'Vis kodeblokkene', lukke: 'Skjul kodeblokkene', klasse: 'bs-skjul-palett' },
        { id: 'resultat', spalte: 'spalteResultat', knapp: 'kollapsResultat',
          opne: 'Vis resultatet',   lukke: 'Skjul resultatet',   klasse: 'bs-skjul-resultat' }
    ];

    const VENT_FOER_VISING = 1600;
    let brukarSkjultLeksjon = false;
    let visTimer = null;

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
    function vekselSpalte(sp, frivilja) {
        const skalKollapse = !erKollapsa(sp);
        if (sp.id === 'leksjon' && frivilja) brukarSkjultLeksjon = skalKollapse;
        if (frivilja) clearTimeout(visTimer);
        setSpalte(sp, skalKollapse);
    }

    const LEKSJON = SPALTER[0];
    const RESULTAT = SPALTER[2];

    function leksjonOpna() {
        el.spalteLeksjon.hidden = false;
        setSpalte(LEKSJON, false);
    }

    function gjemLeksjonMedanKoyrer() {
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

    /* ---- køyring --------------------------------------------------------- */

    function koyr(naarFerdig) {
        stopp();
        el.feil.hidden = true;
        el.utskrift.textContent = '';

        const ktx = BolkTolk.nyKontekst(program);
        const g = BolkTolk.koyr(program, { ktx });
        koyring = { g, ktx, id: null, naarFerdig, sist: null, rest: 0,
                    sisteBlokk: null, foerreBlokk: null };

        el.stopp.disabled = false;
        el.koyr.disabled = true;
        melding('Køyrer …');
        gjemLeksjonMedanKoyrer();

        // Ligg fana alt i bakgrunnen, får vi aldri eit animasjonsbilete å
        // steppe på. Då teiknar vi ferdig med det same.
        if (document.hidden) return fullfoerStrakt();
        steg();
    }

    function steg(naa) {
        if (!koyring) return;

        const perSekund = FART[el.fart.value] || 30;
        let aa = 0;

        if (perSekund === Infinity) {
            aa = Infinity;
        } else {
            /* Vi samlar opp brøkdelar av eit steg mellom bileta. Utan det
             * ville alt under eitt steg per bilete runda ned til null, og
             * dei sakte hakka hadde stått heilt stille. */
            if (koyring.sist === null) koyring.sist = naa || performance.now();
            const gaatt = Math.min(250, (naa || performance.now()) - koyring.sist);
            koyring.sist = naa || performance.now();
            koyring.rest += gaatt / 1000 * perSekund;
            aa = Math.floor(koyring.rest);
            koyring.rest -= aa;
        }

        /* Vi held på den førre blokka òg, ikkje berre den som står for tur.
         * På høg fart går det mange blokker per bilete, og då er `foerre` den
         * nest siste i bunken — ikkje den som stod her i førre biletet. Det er
         * rett: markeringa skal seie kva som nettopp skjedde i programmet. */
        let siste = koyring.sisteBlokk;
        let foerre = koyring.foerreBlokk;
        try {
            for (let n = 0; n < aa; n++) {
                const r = koyring.g.next();
                if (r.done) return ferdig(null);
                if (r.value && r.value.blokk && r.value.blokk !== siste) {
                    foerre = siste;
                    siste = r.value.blokk;
                }
            }
        } catch (f) {
            return ferdig(f.message || String(f));
        }

        if (siste !== koyring.sisteBlokk) {
            koyring.sisteBlokk = siste;
            koyring.foerreBlokk = foerre;
            BolkEditor.markerKoyrande(siste, foerre);
        }
        if (aa) teiknNo();
        koyring.id = requestAnimationFrame(steg);
    }

    /** Køyr resten av programmet utan pause. Brukt når fana blir borte. */
    function fullfoerStrakt() {
        if (koyring.id) cancelAnimationFrame(koyring.id);
        koyring.id = null;
        try {
            let n = 0;
            for (;;) {
                const r = koyring.g.next();
                if (r.done) break;
                // Same taket som tolken har, så ei uventa stor løkke ikkje
                // låser tråden i staden for å seie frå.
                if (++n > BolkTolk.MAKS_STEG) throw new Error('Programmet vart for langt.');
            }
        } catch (f) {
            return ferdig(f.message || String(f));
        }
        ferdig(null);
    }

    function teiknNo() {
        BolkLerret.teikn(koyring.ktx.skilpadde.strek, koyring.ktx.skilpadde.tilstand);
        if (koyring.ktx.utskrift.length) {
            el.utskrift.textContent = koyring.ktx.utskrift.join('\n');
        }
        // Variablane er like nyttige i vanleg køyring som stegvis — det er
        // dei som gjer at ein spiral er noko anna enn ein figur som veks.
        visVariablar(koyring.ktx.variablar);
    }

    function ferdig(feil) {
        teiknNo();
        // Skilpadda blir ståande, men ikkje utheva — figuren er det som skal
        // sjåast når programmet er slutt.
        BolkEditor.markerKoyrande(null);

        const ktx = koyring.ktx;
        const kall = koyring.naarFerdig;
        avslutt();

        if (feil) {
            el.feil.hidden = false;
            el.feil.textContent = feil;
            melding('Programmet stoppa.');
        } else {
            melding('Ferdig — ' + ktx.skilpadde.strek.length + ' strek teikna.');
        }
        hentLeksjonAtt();
        if (kall) kall({ ktx, feil });
    }

    function stopp() {
        if (!koyring) return;
        if (koyring.id) cancelAnimationFrame(koyring.id);
        BolkEditor.markerKoyrande(null);
        avslutt();
        melding('Stoppa.');
        hentLeksjonAtt();
    }

    /* Ingen worker å terminere: å stoppe er berre å slutte å be generatoren
     * om fleire steg. Han blir samla inn som alt anna. */
    function avslutt() {
        koyring = null;
        stansAvspeling();
        el.stegrad.hidden = true;
        el.stegblokk.hidden = true;
        el.stegGjort.hidden = true;
        el.stegKnapp.disabled = false;
        el.stopp.disabled = true;
        el.koyr.disabled = false;
    }

    /* ---- steg for steg -----------------------------------------------------
     *
     * Same tanken som i Ormritaren: blokka som står for tur lyser opp, og
     * teikning, utskrift og variablar oppdaterer seg i same augeblink.
     *
     * Den utheva blokka er den som skal køyre NO, ikkje den som nettopp
     * køyrde. Det er same semantikken som `sys.settrace` gjev Ormritaren, og
     * det er den som let eleven gjette kva som kjem til å skje før han
     * trykkjer — som er heile grunnen til at ein går stegvis.
     */

    let avspelingsTimer = null;

    function startStegmodus() {
        stopp();
        el.feil.hidden = true;
        el.utskrift.textContent = '';

        const ktx = BolkTolk.nyKontekst(program);
        const g = BolkTolk.koyr(program, { ktx });
        koyring = { g, ktx, id: null, stegvis: true, teljar: 0, naarFerdig: null, venteBlokk: null };

        el.stegrad.hidden = false;
        el.stegKnapp.disabled = true;
        el.stopp.disabled = false;
        /* Køyr blir med vilje ståande open. Ein elev som er lei av å trykkje
         * seg gjennom skal kunne la resten gå av seg sjølv utan å måtte finne
         * ut at han fyrst må trykkje Stopp — koyr() ryddar opp i stegmodus
         * sjølv gjennom stopp(). */
        oppdaterAvspelingsknapp();
        BolkLerret.tom();
        melding('Steg for steg.');

        eittSteg();
    }

    /** Køyr blokka som står for tur, og vis kva som kjem etterpå. */
    function eittSteg() {
        if (!koyring || !koyring.stegvis) return;

        /* Blokka som stod for tur, er den som blir utført av dette kallet.
         * Generatoren stoppar FØR kvar blokk, så `next()` gjer to ting på ein
         * gong: han køyrer den som venta, og melder frå om den neste. */
        const gjort = koyring.venteBlokk || null;

        let r;
        try {
            r = koyring.g.next();
        } catch (f) {
            return ferdig(f.message || String(f));
        }
        if (r.done) {
            // Siste blokka køyrde nettopp. Vis henne, og at det ikkje er meir.
            visStegblokk(null, gjort);
            return ferdig(null);
        }

        koyring.teljar++;
        const id = r.value && r.value.blokk;
        koyring.venteBlokk = id;
        BolkEditor.markerKoyrande(id, gjort);
        visStegblokk(id, gjort);
        visVariablar(koyring.ktx.variablar);
        teiknNo();

        if (avspelingsTimer !== null) {
            const per = FART[el.fart.value] || 2;
            avspelingsTimer = setTimeout(eittSteg, per === Infinity ? 0 : Math.round(1000 / per));
        }
    }

    /* Blokka blir gjenteken som tekst rett over teikninga. Utan det måtte
     * eleven som følgjer skilpadda sjå bort på arbeidsbenken for kvart steg
     * — og då ser han ikkje streken bli teikna, som var heile poenget. */
    /**
     * Dei to rutene ved sida av teikninga: kva som nettopp køyrde, og kva som
     * står for tur.
     *
     * Begge trengst. Utheva blokk på arbeidsbenken er den som skal køyre, for
     * det er den eleven skal gjette på før han trykkjer. Men når streken
     * dukkar opp på lerretet, er det den FØRRE blokka som laga han — og utan
     * ei rute som seier det, må eleven hugse eitt steg tilbake sjølv.
     *
     * @param {?string} id     blokka som står for tur, eller null når det er slutt
     * @param {?string} gjortId blokka som nettopp køyrde
     */
    function visStegblokk(id, gjortId) {
        const tekst = (bid) => {
            const stad = bid ? BolkTre.finn(program, bid) : null;
            return stad ? BolkBlokkar.lesbar(stad.node) : null;
        };

        const gjort = tekst(gjortId);
        el.stegGjort.hidden = !gjort;
        if (gjort) el.stegGjortTekst.textContent = gjort;

        const neste = tekst(id);
        el.stegblokk.hidden = !neste;
        if (neste) el.stegblokkTekst.textContent = neste;

        el.stegInfo.textContent = 'Steg ' + koyring.teljar;
    }

    function vekselAvspeling() {
        if (avspelingsTimer !== null) { stansAvspeling(); return; }
        avspelingsTimer = 0;               // 0 = spelar av, men ingen timer enno
        oppdaterAvspelingsknapp();
        eittSteg();
    }

    function stansAvspeling() {
        if (avspelingsTimer) clearTimeout(avspelingsTimer);
        avspelingsTimer = null;
        oppdaterAvspelingsknapp();
    }

    function oppdaterAvspelingsknapp() {
        if (!el.spelAv) return;
        const spelar = avspelingsTimer !== null;
        el.spelAv.textContent = spelar ? 'Pause' : 'Spel av';
        el.nesteSteg.disabled = spelar;
    }

    /* ---- variablar ----------------------------------------------------------
     *
     * Berre synlege når programmet faktisk har nokon. Dei tre fyrste
     * leksjonane brukar ingen variablar, og ei tom rute under kvar køyring
     * er berre rot. */
    function visVariablar(vars) {
        const namn = Object.keys(vars || {});
        el.variablar.textContent = '';
        el.variablar.hidden = !namn.length;
        if (!namn.length) return;

        namn.forEach(n => {
            const brikke = document.createElement('span');
            brikke.className = 'bs-variabel';
            const nm = document.createElement('strong');
            nm.textContent = n;
            brikke.appendChild(nm);
            brikke.appendChild(document.createTextNode(' = ' + BolkBlokkar.talTekst(vars[n])));
            el.variablar.appendChild(brikke);
        });
    }

    const melding = (t) => { el.status.textContent = t; };

    /* ---- faner ------------------------------------------------------------ */

    function fane(kva) {
        const py = kva === 'python';
        el.ruteTeikning.hidden = py;
        el.rutePython.hidden = !py;
        el.faneTeikning.classList.toggle('active', !py);
        el.fanePython.classList.toggle('active', py);
        el.faneTeikning.setAttribute('aria-pressed', String(!py));
        el.fanePython.setAttribute('aria-pressed', String(py));
        if (py) visPython();
        else BolkLerret.teiknPaaNytt();
    }

    const visPython = () => { el.rutePython.textContent = BolkPython.tekst(program); };

    /* ---- det leksjonslaget får bruke ---------------------------------------- */

    function vertsapi() {
        return {
            panel: el.leksjonspanel,
            leksjonOpna,
            setProgram,
            hentProgram: () => program,
            setPalett: (liste) => { BolkEditor.setPalett(liste); BolkEditor.teiknPalett(); },
            /* Ein leksjon kan be om rutenett i staden for fri teikneflate.
             * Det er ei eigenskap ved leksjonen og ikkje ved programmet:
             * dei same blokkene teiknar det same anten rutene er der eller
             * ikkje, det er berre eleven som ser meir. */
            setRutenett: (spek) => BolkLerret.setRutenett(spek || null),
            koyr,
            /* Retting går utanom animasjonen: han skal svare med ein gong,
             * ikkje vente på at figuren blir teikna ferdig. */
            sjekk: (oppgave) => BolkTest.sjekk(program, oppgave),
            melding
        };
    }
})();
