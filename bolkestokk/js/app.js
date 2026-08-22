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
     * To steg i sekundet er sakte nok til at ein sjetteklassing rekk å lese
     * blokka som lyser opp før neste tek over. Øvste hakket hoppar over
     * animasjonen heilt, for den som berre vil sjå figuren. */
    const FART = { 1: 2, 2: 5, 3: 12, 4: 30, 5: 90, 6: Infinity };

    const el = {};
    let program = null;
    let koyring = null;          // { g, ktx, id }
    let ulagra = false;

    document.addEventListener('DOMContentLoaded', start);

    function start() {
        ['palett', 'arbeid', 'koyr', 'stopp', 'toem', 'nyKommando', 'fart', 'status',
         'lerret', 'utskrift', 'feil', 'faneTeikning', 'fanePython',
         'ruteTeikning', 'rutePython', 'leksjonspanel']
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
        el.nyKommando.addEventListener('click', nyKommando);
        el.faneTeikning.addEventListener('click', () => fane('teikning'));
        el.fanePython.addEventListener('click', () => fane('python'));

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
        ulagra = true;
    }

    function toem() {
        if (BolkTre.tel(program) && !confirm('Vil du fjerne alle blokkene?')) return;
        setProgram(BolkTre.nyttProgram());
    }

    function nyKommando() {
        const brukte = BolkTre.kommandonamn(program);
        let namn = 'firkant', n = 2;
        while (brukte.indexOf(namn) >= 0) namn = 'firkant' + (n++);
        program.kommandoar.push({ namn, kropp: [] });
        BolkEditor.teikn();
        endra();
    }

    /* ---- køyring --------------------------------------------------------- */

    function koyr(naarFerdig) {
        stopp();
        el.feil.hidden = true;
        el.utskrift.textContent = '';

        const ktx = BolkTolk.nyKontekst(program);
        const g = BolkTolk.koyr(program, { ktx });
        koyring = { g, ktx, id: null, naarFerdig, sist: null, rest: 0, sisteBlokk: null };

        el.stopp.disabled = false;
        el.koyr.disabled = true;
        melding('Køyrer …');

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

        let siste = koyring.sisteBlokk;
        try {
            for (let n = 0; n < aa; n++) {
                const r = koyring.g.next();
                if (r.done) return ferdig(null);
                if (r.value && r.value.blokk) siste = r.value.blokk;
            }
        } catch (f) {
            return ferdig(f.message || String(f));
        }

        if (siste !== koyring.sisteBlokk) {
            koyring.sisteBlokk = siste;
            BolkEditor.markerKoyrande(siste);
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
        if (kall) kall({ ktx, feil });
    }

    function stopp() {
        if (!koyring) return;
        if (koyring.id) cancelAnimationFrame(koyring.id);
        BolkEditor.markerKoyrande(null);
        avslutt();
        melding('Stoppa.');
    }

    /* Ingen worker å terminere: å stoppe er berre å slutte å be generatoren
     * om fleire steg. Han blir samla inn som alt anna. */
    function avslutt() {
        koyring = null;
        el.stopp.disabled = true;
        el.koyr.disabled = false;
    }

    const melding = (t) => { el.status.textContent = t; };

    /* ---- faner ------------------------------------------------------------ */

    function fane(kva) {
        const py = kva === 'python';
        el.ruteTeikning.hidden = py;
        el.rutePython.hidden = !py;
        el.faneTeikning.classList.toggle('active', !py);
        el.fanePython.classList.toggle('active', py);
        el.faneTeikning.setAttribute('aria-selected', String(!py));
        el.fanePython.setAttribute('aria-selected', String(py));
        if (py) visPython();
        else BolkLerret.teiknPaaNytt();
    }

    const visPython = () => { el.rutePython.textContent = BolkPython.tekst(program); };

    /* ---- det leksjonslaget får bruke ---------------------------------------- */

    function vertsapi() {
        return {
            panel: el.leksjonspanel,
            setProgram,
            hentProgram: () => program,
            setPalett: (liste) => { BolkEditor.setPalett(liste); BolkEditor.teiknPalett(); },
            koyr,
            /* Retting går utanom animasjonen: han skal svare med ein gong,
             * ikkje vente på at figuren blir teikna ferdig. */
            sjekk: (oppgave) => BolkTest.sjekk(program, oppgave),
            melding
        };
    }
})();
