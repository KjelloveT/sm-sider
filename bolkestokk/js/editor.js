/* Bolkestokk — teikning av palett og arbeidsbenk.
 *
 * Blokkene er DOM, ikkje SVG. Scratch og Blockly teiknar sine i SVG fordi
 * dei har puslespelknastar som må passe millimeterpresist i kvarandre. Vi
 * har ikkje det: ei blokk her er ei neobrutalistisk ramme, og hierarkiet
 * kjem av innrykk og ei fargestripe til venstre.
 *
 * Det gjer tre ting enklare, og alle tre betyr noko på eit nettbrett:
 *   - tal-hòl er ekte <input type="number">, så eleven får taltastaturet
 *   - nedtrekk er ekte <select>, så han får systemet sin eigen veljar
 *   - ei gjenta-blokk sin kropp er ein ekte DOM-forelder, så teksten bryt
 *     og blokka veks slik ho skal utan at vi reknar ut ein einaste koordinat
 *
 * Ingenting her endrar treet. Alt som endrar noko ligg i dra.js.
 */
const BolkEditor = (function () {

    let el = {};              // { palett, arbeid }
    let vert = {};            // { paaEndring, paaVal }
    let program = null;
    let palett = null;        // liste med blokk-id-ar, eller null for alt
    let valdId = null;        // blokka som er merkt (for trykk-for-å-setje)

    function init(elementa, verten) {
        el = elementa;
        vert = verten || {};
        el.arbeid.addEventListener('click', paaArbeidsklikk);
    }

    const set = (p) => { program = p; };
    const hentProgram = () => program;
    const setPalett = (liste) => { palett = liste && liste.length ? liste : null; };
    const vald = () => valdId;

    /* ---- palett ---------------------------------------------------------- */

    /**
     * Berre blokkene leksjonen har opna for.
     *
     * Leksjon 1 skal vise fem blokker, ikkje tjue. Ein elev som ser heile
     * paletten fyrste timen leitar i staden for å byggje, og «Set farge til»
     * er ikkje eit svar på noka oppgåve han har fått enno.
     */
    function synlege() {
        return BolkBlokkar.DEF.filter(d => {
            if (d.form === 'hatt') return false;          // hattane ligg alt ute
            return !palett || palett.indexOf(d.id) >= 0;
        });
    }

    function teiknPalett() {
        el.palett.textContent = '';
        const blokker = synlege();

        BolkBlokkar.KATEGORIAR.forEach(kat => {
            const mine = blokker.filter(b => b.kategori === kat.id);
            if (!mine.length) return;

            const bolk = document.createElement('section');
            bolk.className = 'bs-palettbolk';

            const tittel = document.createElement('h3');
            tittel.className = 'bs-paletttittel';
            const brikke = document.createElement('span');
            brikke.className = 'bs-katbrikke';
            brikke.dataset.accent = kat.accent;
            tittel.appendChild(brikke);
            tittel.appendChild(document.createTextNode(kat.tittel));
            bolk.appendChild(tittel);

            mine.forEach(def => bolk.appendChild(palettblokk(def)));
            el.palett.appendChild(bolk);
        });

        if (window.hydrateIcons) hydrateIcons(el.palett);
    }

    /* Ei palettblokk er ein <button>. Det er ikkje pynt: knappen gjev
     * tabbing, Enter og skjermlesar gratis, og det er den vegen inn for
     * alle som ikkje kan eller vil dra med fingeren (AGENTS.md §5.4). */
    function palettblokk(def) {
        const knapp = document.createElement('button');
        knapp.type = 'button';
        knapp.className = 'bs-blokk bs-palettblokk';
        knapp.dataset.type = def.id;
        knapp.dataset.form = def.form;
        knapp.dataset.kat = def.kategori;
        knapp.setAttribute('aria-label', 'Legg til blokka ' + reintNamn(def));

        knapp.appendChild(blokkrad(null, def, true));
        return knapp;
    }

    /* Blokka lesen som ei setning, til aria-label.
     *
     * Blokker som er berre hòl — rekneblokka er «… ÷ …» og ikkje meir —
     * ville blitt til «Legg til blokka … … …» for ein skjermlesar. Dei har
     * difor eit eige `namn` i katalogen. */
    function reintNamn(def) {
        if (def.namn) return def.namn;
        return def.tekst.map(d => typeof d === 'string' ? d : '…').join(' ').trim();
    }

    /* ---- arbeidsbenk ------------------------------------------------------ */

    function teikn() {
        if (!program) return;
        const rulla = el.arbeid.scrollTop;
        el.arbeid.textContent = '';

        el.arbeid.appendChild(stabelboks(
            BolkBlokkar.hent('start'), program.start, 'start', null));

        (program.kommandoar || []).forEach((k, i) => {
            el.arbeid.appendChild(stabelboks(
                BolkBlokkar.hent('lagKommando'), k.kropp, 'kmd:' + i, k));
        });

        el.arbeid.scrollTop = rulla;
        if (window.hydrateIcons) hydrateIcons(el.arbeid);
    }

    /** Ein hatt med stabelen sin under. */
    function stabelboks(def, stabel, nokkel, kommando) {
        const boks = document.createElement('div');
        boks.className = 'bs-stabelboks';
        boks.dataset.stabel = nokkel;

        const hatt = document.createElement('div');
        hatt.className = 'bs-blokk bs-hatt';
        hatt.dataset.form = 'hatt';
        hatt.dataset.kat = def.kategori;
        hatt.appendChild(blokkrad(kommando ? { felt: kommando } : null, def, false, nokkel));
        boks.appendChild(hatt);

        boks.appendChild(stabelliste(stabel, nokkel));
        return boks;
    }

    function stabelliste(stabel, nokkel) {
        const liste = document.createElement('div');
        liste.className = 'bs-stabel';
        liste.dataset.stabelId = nokkel;

        stabel.forEach(node => liste.appendChild(blokk(node)));

        if (!stabel.length) {
            const tom = document.createElement('p');
            tom.className = 'bs-tom';
            tom.textContent = 'Dra ei blokk hit';
            liste.appendChild(tom);
        }
        return liste;
    }

    function blokk(node) {
        const def = BolkBlokkar.hent(node.type);
        const boks = document.createElement('div');
        boks.className = 'bs-blokk bs-' + def.form;
        boks.dataset.id = node.id;
        boks.dataset.type = node.type;
        boks.dataset.form = def.form;
        boks.dataset.kat = def.kategori;
        if (node.id === valdId) boks.classList.add('er-vald');

        boks.appendChild(blokkrad(node, def, false));

        if (def.form === 'krop') {
            const kropp = document.createElement('div');
            kropp.className = 'bs-kropp bs-stabel';
            kropp.dataset.stabelId = 'krop:' + node.id;
            (node.kropp || []).forEach(k => kropp.appendChild(blokk(k)));
            if (!(node.kropp || []).length) {
                const tom = document.createElement('p');
                tom.className = 'bs-tom bs-tom-inni';
                tom.textContent = 'Dra hit';
                kropp.appendChild(tom);
            }
            boks.appendChild(kropp);
            // Ein botn under kroppen, så det synest at gjenta femner om han.
            const botn = document.createElement('div');
            botn.className = 'bs-krop-botn';
            boks.appendChild(botn);
        }

        return boks;
    }

    /** Orda og hòla i ei blokk. */
    function blokkrad(node, def, erPalett, stabelNokkel) {
        const rad = document.createElement('div');
        rad.className = 'bs-rad';

        def.tekst.forEach(del => {
            if (typeof del === 'string') {
                const ord = document.createElement('span');
                ord.className = 'bs-ord';
                ord.textContent = del;
                rad.appendChild(ord);
                return;
            }
            rad.appendChild(hol(node, def, del, erPalett, stabelNokkel));
        });

        return rad;
    }

    function hol(node, def, spek, erPalett, stabelNokkel) {
        const verdi = node ? node.felt[spek.felt] : spek.standard;

        // Ei verdiblokk som er dregen inn i hòlet.
        if (verdi && typeof verdi === 'object') {
            const skal = document.createElement('span');
            skal.className = 'bs-hol bs-hol-fylt';
            skal.dataset.holFelt = spek.felt;
            if (node) skal.dataset.holNode = node.id;
            skal.appendChild(blokk(verdi));
            return skal;
        }

        const skal = document.createElement('span');
        skal.className = 'bs-hol';
        skal.dataset.holFelt = spek.felt;
        if (node) skal.dataset.holNode = node.id;
        if (spek.slag === 'tal') skal.dataset.takVerdi = '1';

        if (spek.slag === 'val') skal.appendChild(nedtrekk(node, spek, verdi, erPalett));
        else skal.appendChild(tekstfelt(node, spek, verdi, erPalett, stabelNokkel));

        return skal;
    }

    function tekstfelt(node, spek, verdi, erPalett, stabelNokkel) {
        const felt = document.createElement('input');
        felt.className = 'bs-felt' + (spek.slag === 'tal' ? ' bs-felt-tal' : ' bs-felt-tekst');
        felt.type = spek.slag === 'tal' ? 'number' : 'text';
        felt.value = verdi === undefined || verdi === null ? '' : verdi;
        felt.setAttribute('aria-label', spek.felt);
        // Ei blokk i paletten er eit døme, ikkje noko ein skriv i.
        if (erPalett) { felt.tabIndex = -1; felt.readOnly = true; return felt; }

        felt.addEventListener('input', () => {
            const ny = spek.slag === 'tal' ? (felt.value === '' ? '' : Number(felt.value)) : felt.value;
            if (node) node.felt[spek.felt] = ny;
            // Namnet på ein kommando bur i kommando-posten, ikkje i ein node.
            else if (stabelNokkel && stabelNokkel.indexOf('kmd:') === 0) {
                program.kommandoar[Number(stabelNokkel.slice(4))].namn = String(ny).trim();
            }
            if (vert.paaEndring) vert.paaEndring();
        });
        // Utan dette startar eit trykk i feltet ei dra-rørsle i staden for
        // å setje skrivemerket.
        felt.addEventListener('pointerdown', (e) => e.stopPropagation());
        return felt;
    }

    function nedtrekk(node, spek, verdi, erPalett) {
        const veljar = document.createElement('select');
        veljar.className = 'bs-felt bs-felt-val';
        veljar.setAttribute('aria-label', spek.felt);

        val(spek).forEach(v => {
            const o = document.createElement('option');
            o.value = v.verdi;
            o.textContent = v.tekst;
            if (v.verdi === verdi) o.selected = true;
            veljar.appendChild(o);
        });

        if (erPalett) { veljar.tabIndex = -1; veljar.disabled = true; return veljar; }

        veljar.addEventListener('change', () => {
            if (node) node.felt[spek.felt] = veljar.value;
            if (vert.paaEndring) vert.paaEndring();
        });
        veljar.addEventListener('pointerdown', (e) => e.stopPropagation());
        return veljar;
    }

    /** Alternativa i eit nedtrekk. Nokre lister er faste, andre kjem frå treet. */
    function val(spek) {
        if (spek.val === 'variablar') {
            return (program ? BolkTre.variablar(program) : BolkTre.GRUNNVARIABLAR)
                .map(n => ({ verdi: n, tekst: n }));
        }
        if (spek.val === 'kommandoar') {
            const namn = program ? BolkTre.kommandonamn(program) : [];
            return namn.length ? namn.map(n => ({ verdi: n, tekst: n }))
                               : [{ verdi: '', tekst: '(ingen enno)' }];
        }
        return spek.val || [];
    }

    /* ---- val og utheving -------------------------------------------------- */

    function paaArbeidsklikk(e) {
        if (e.target.closest('.bs-felt')) return;      // klikk i eit felt er redigering
        const boks = e.target.closest('.bs-blokk[data-id]');
        merk(boks ? boks.dataset.id : null);
    }

    function merk(id) {
        valdId = id;
        el.arbeid.querySelectorAll('.bs-blokk.er-vald')
            .forEach(b => b.classList.remove('er-vald'));
        if (id) {
            const b = el.arbeid.querySelector('.bs-blokk[data-id="' + id + '"]');
            if (b) b.classList.add('er-vald');
        }
        if (vert.paaVal) vert.paaVal(id);
    }

    /** Blokka som køyrer no. Kalla mange gonger i sekundet — rører berre klassar. */
    function markerKoyrande(id) {
        el.arbeid.querySelectorAll('.bs-blokk.er-koyrande')
            .forEach(b => b.classList.remove('er-koyrande'));
        if (!id) return;
        const b = el.arbeid.querySelector('.bs-blokk[data-id="' + id + '"]');
        if (b) b.classList.add('er-koyrande');
    }

    return {
        init, set, hentProgram, setPalett, teikn, teiknPalett,
        merk, vald, markerKoyrande, blokk, synlege
    };
})();
