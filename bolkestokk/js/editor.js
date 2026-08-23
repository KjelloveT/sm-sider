/* Bolkestokk — teikning av palett og arbeidsbenk.
 *
 * Blokkene er DOM, ikkje SVG — også etter at dei fekk knastar. Scratch og
 * Blockly teiknar sine i SVG, men knastane her er to pseudoelement på
 * 46×15px, og C-forma rundt ei gjenta-blokk er tre vanlege boksar i ein
 * flexbox. Ingen koordinatar blir rekna ut nokon stad.
 *
 * DOM gjev tre ting SVG ikkje gjev, og alle tre betyr noko på eit nettbrett:
 *   - tal-hòl er ekte <input type="number">, så eleven får taltastaturet
 *   - nedtrekk er ekte <select>, så han får systemet sin eigen veljar
 *   - ei gjenta-blokk sin kropp er ein ekte DOM-forelder, så teksten bryt
 *     og blokka veks slik ho skal utan at vi reknar ut ein einaste koordinat
 *
 * Kvar blokk er fylt med kategorifargen sin og har eit Lucide-symbol før
 * orda. Sjå css/blokk.css for forma og css/palett.css for fargane.
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
            tittel.dataset.farge = kat.farge;
            const brikke = document.createElement('span');
            brikke.className = 'bs-katbrikke';
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
        knapp.className = 'bs-blokk bs-palettblokk bs-' + def.form;
        knapp.dataset.type = def.id;
        knapp.dataset.form = def.form;
        knapp.dataset.farge = def.farge;
        knapp.setAttribute('aria-label', 'Legg til blokka ' + reintNamn(def));

        knapp.appendChild(blokkrad(null, def, true));
        if (def.form !== 'krop') return knapp;

        /* Gjenta i paletten skal vise at ho har eit rom inni seg. Ho blir
         * pakka i same C-forma som pa benken, men utan noko a leggje i. */
        const ytre = document.createElement('div');
        ytre.className = 'bs-krop-ytre';
        ytre.dataset.farge = def.farge;
        ytre.appendChild(knapp);

        const midt = document.createElement('div');
        midt.className = 'bs-krop-midt';
        const spine = document.createElement('div');
        spine.className = 'bs-krop-spine';
        const hol = document.createElement('div');
        hol.className = 'bs-kropp';
        midt.appendChild(spine); midt.appendChild(hol);
        ytre.appendChild(midt);

        const botn = document.createElement('div');
        botn.className = 'bs-krop-botn';
        ytre.appendChild(botn);
        return ytre;
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
        hatt.dataset.farge = def.farge;
        hatt.appendChild(blokkrad(kommando ? { felt: kommando } : null, def, false, nokkel));
        boks.appendChild(hatt);

        boks.appendChild(stabelliste(stabel, nokkel, def.farge));
        return boks;
    }

    /**
     * Ein stabel med blokker.
     *
     * `--bs-over` er fargen på blokka rett over. Hakket i toppen av kvar
     * blokk blir måla i han, slik at tappen ovanfrå ser ut til å fylle
     * hakket i staden for å ligge oppå. Fyrste blokka arvar flata bak.
     */
    function stabelliste(stabel, nokkel, overFarge) {
        const liste = document.createElement('div');
        liste.className = 'bs-stabel';
        liste.dataset.stabelId = nokkel;

        let over = overFarge || null;
        stabel.forEach(node => {
            const post = blokk(node);
            if (over) post.style.setProperty('--bs-over', 'var(--bs-' + over + ')');
            liste.appendChild(post);
            over = (BolkBlokkar.hent(node.type) || {}).farge || over;
        });

        if (!stabel.length) {
            const tom = document.createElement('p');
            tom.className = 'bs-tom';
            tom.textContent = 'Dra ei blokk hit';
            liste.appendChild(tom);
        }
        return liste;
    }

    /**
     * Éi blokk. Blokker med kropp blir pakka i ei ytre C-form, så
     * arbeidsbenken kan behandle dei som éin post i stabelen.
     */
    function blokk(node) {
        const def = BolkBlokkar.hent(node.type);
        const hovud = document.createElement('div');
        hovud.className = 'bs-blokk bs-' + def.form + ' bs-stabelpost';
        hovud.dataset.id = node.id;
        hovud.dataset.type = node.type;
        hovud.dataset.form = def.form;
        hovud.dataset.farge = def.farge;
        if (node.id === valdId) hovud.classList.add('er-vald');

        hovud.appendChild(blokkrad(node, def, false));
        if (def.form !== 'krop') return hovud;

        /* C-forma: hovud, ryggsøyle med kroppen ved sida, og ein fot.
         * Ryggsøyla er eit ekte element og ikkje ein kant, fordi han skal
         * strekkje seg like langt ned som kroppen er høg — og det veit
         * flexbox, medan CSS-kantar ikkje gjer det. */
        const ytre = document.createElement('div');
        ytre.className = 'bs-krop-ytre bs-stabelpost';
        ytre.dataset.farge = def.farge;
        hovud.classList.remove('bs-stabelpost');
        ytre.appendChild(hovud);

        const midt = document.createElement('div');
        midt.className = 'bs-krop-midt';

        const spine = document.createElement('div');
        spine.className = 'bs-krop-spine';
        midt.appendChild(spine);

        const kropp = document.createElement('div');
        kropp.className = 'bs-kropp bs-stabel';
        kropp.dataset.stabelId = 'krop:' + node.id;
        let over = def.farge;
        (node.kropp || []).forEach(k => {
            const post = blokk(k);
            post.style.setProperty('--bs-over', 'var(--bs-' + over + ')');
            kropp.appendChild(post);
            over = (BolkBlokkar.hent(k.type) || {}).farge || over;
        });
        if (!(node.kropp || []).length) {
            const tom = document.createElement('p');
            tom.className = 'bs-tom bs-tom-inni';
            tom.textContent = 'Dra hit';
            kropp.appendChild(tom);
        }
        midt.appendChild(kropp);
        ytre.appendChild(midt);

        const botn = document.createElement('div');
        botn.className = 'bs-krop-botn';
        ytre.appendChild(botn);

        return ytre;
    }

    /** Orda og hòla i ei blokk, med symbolet først. */
    function blokkrad(node, def, erPalett, stabelNokkel) {
        const rad = document.createElement('div');
        rad.className = 'bs-rad';

        /* Symbolet kjem før orda. Ein elev som ikkje har lese ferdig
         * kjenner att pila eller pennen lenge før han kjenner att ordet,
         * og på ei blokk som er dregen i full fart er det symbolet som
         * seier kva ho er. Lucide, ikkje emoji (AGENTS.md §3.2). */
        if (def.ikon) {
            const sym = document.createElement('span');
            sym.className = 'bs-symbol';
            sym.dataset.icon = def.ikon;
            sym.dataset.iconSize = '24';
            sym.setAttribute('aria-hidden', 'true');
            rad.appendChild(sym);
        }

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
        else if (spek.slag === 'tal') skal.appendChild(talfelt(node, spek, verdi, erPalett));
        else skal.appendChild(tekstfelt(node, spek, verdi, erPalett, stabelNokkel));

        return skal;
    }

    /**
     * Eit tal med − og + rundt seg.
     *
     * Feltet åleine ville halde, men på nettbrett er det tungt: ein må
     * treffe eit lite felt, vente på tastaturet, merke det som står og
     * skrive nytt. To store knappar gjer det same med eitt trykk, og
     * `steg` i blokkdefinisjonen gjer at dei flyttar seg i tal som betyr
     * noko — 15 gradar om gongen, ikkje éin.
     */
    function talfelt(node, spek, verdi, erPalett) {
        const tekst = verdi === undefined || verdi === null ? '' : String(verdi);

        /* I paletten er talet berre eit døme. Felta der har alltid vore
         * readOnly, så knappane hadde ingen jobb — og dei tok 44px av ei
         * blokk som må få plass på ei linje i ei smal spalte. */
        if (erPalett) {
            const brikke = document.createElement('span');
            brikke.className = 'bs-brikke';
            brikke.textContent = tekst;
            return brikke;
        }

        const boks = document.createElement('span');
        boks.className = 'bs-steg';

        const felt = document.createElement('input');
        felt.className = 'bs-felt bs-felt-tal';
        felt.type = 'number';
        felt.value = tekst;
        felt.setAttribute('aria-label', spek.felt);
        boks.appendChild(felt);

        /* + over −, i kvar si rute til høgre for talet. Vassrett tok gruppa
         * over halve blokkbreidda i paletten; loddrett tek ho to tredelar av
         * det. Sjå kommentaren i blokk.css for treffflate-avveginga. */
        const kolonne = document.createElement('span');
        kolonne.className = 'bs-steg-kolonne';

        const knapp = (merke, retning) => {
            const k = document.createElement('button');
            k.type = 'button';
            k.className = 'bs-steg-knapp';
            k.textContent = merke;
            k.setAttribute('aria-label', (retning > 0 ? 'Auk ' : 'Minsk ') + spek.felt);
            k.addEventListener('click', (e) => {
                e.stopPropagation();
                const n = Number(felt.value) || 0;
                const ny = n + retning * (spek.steg || 1);
                felt.value = ny;
                if (node) node.felt[spek.felt] = ny;
                if (vert.paaEndring) vert.paaEndring();
            });
            k.addEventListener('pointerdown', (e) => e.stopPropagation());
            return k;
        };

        kolonne.appendChild(knapp('+', 1));
        kolonne.appendChild(knapp('−', -1));
        boks.appendChild(kolonne);

        felt.addEventListener('input', () => {
            if (node) node.felt[spek.felt] = felt.value === '' ? '' : Number(felt.value);
            if (vert.paaEndring) vert.paaEndring();
        });
        felt.addEventListener('pointerdown', (e) => e.stopPropagation());
        return boks;
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

    /**
     * Dei to køyremarkeringane: blokka som står for tur, og den som nettopp
     * køyrde. Kalla mange gonger i sekundet — rører berre klassar.
     *
     * @param {?string} id     står for tur
     * @param {?string} gjortId køyrde nettopp
     */
    function markerKoyrande(id, gjortId) {
        el.arbeid.querySelectorAll('.bs-blokk.er-koyrande, .bs-blokk.er-gjort')
            .forEach(b => b.classList.remove('er-koyrande', 'er-gjort'));

        /* «Nettopp køyrt» blir sett fyrst. Er det same blokka begge stader —
         * ei løkke som gjentek seg sjølv med éi blokk inni — skal ho vise
         * fargen for det som skjer no. */
        const finn = (x) => x ? el.arbeid.querySelector('.bs-blokk[data-id="' + x + '"]') : null;
        const g = finn(gjortId);
        if (g) g.classList.add('er-gjort');
        const b = finn(id);
        if (b) { b.classList.remove('er-gjort'); b.classList.add('er-koyrande'); }
    }

    return {
        init, set, hentProgram, setPalett, teikn, teiknPalett,
        merk, vald, markerKoyrande, blokk, synlege
    };
})();
