/* Bolkestokk — limet.
 *
 * Held programmet, koplar modulane saman og driv køyringa. Same rolla som
 * ormritaren/js/app.js har der: den einaste staden modulane snakkar saman,
 * slik at ingen av dei treng kjenne kvarandre.
 */
(function () {

    /* Steg per bilete. Ei blokk i sekundet er for seint til å halde ut,
     * og alt på ein gong lærer ingen noko — difor ein skala. Øvste hakket
     * hoppar over animasjonen heilt, for den som berre vil sjå figuren. */
    const FART = { 1: 1, 2: 2, 3: 5, 4: 14, 5: 60, 6: Infinity };

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
        koyring = { g, ktx, id: null, naarFerdig };

        el.stopp.disabled = false;
        el.koyr.disabled = true;
        melding('Køyrer …');
        steg();
    }

    function steg() {
        if (!koyring) return;
        const per = FART[el.fart.value] || 14;
        let n = 0;
        let siste = null;

        try {
            while (n < per) {
                const r = koyring.g.next();
                if (r.done) return ferdig(null);
                if (r.value && r.value.blokk) siste = r.value.blokk;
                n++;
            }
        } catch (f) {
            return ferdig(f.message || String(f));
        }

        BolkEditor.markerKoyrande(siste);
        teiknNo();
        koyring.id = requestAnimationFrame(steg);
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
