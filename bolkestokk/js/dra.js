/* Bolkestokk — å flytte blokker.
 *
 * Pointer Events, ikkje HTML5 sitt drag-and-drop-API. Mønsteret er henta frå
 * eikekveik/js/interaction.js: same hendingar for mus, finger og penn, og
 * ingenting som berre verkar på ei av dei. HTML5-DnD finst ikkje på iPad i
 * praksis, og halve klassen sit på iPad.
 *
 * Tre ting er verdt å vite om korleis dette er laga:
 *
 * 1. Vi tek IKKJE pointer capture. Arbeidsbenken blir teikna på nytt medan
 *    ein dreg, og då forsvinn elementet vi ville fanga på. I staden lyttar
 *    vi på window så lenge draget varer.
 *
 * 2. Blokka blir teken UT av treet med ein gong draget startar. Då kan han
 *    ikkje sleppast inni seg sjølv — det er ikkje ein sjekk vi har skrive,
 *    det er ein tilstand som ikkje finst.
 *
 * 3. Trykk-for-å-setje er ikkje ein reserveløysing for dragging som feilar.
 *    Det er den vegen inn for tastatur og skjermlesar, og for elevar som
 *    ikkje treffer med fingeren. Difor er palettblokkene <button>.
 */
const BolkDra = (function () {

    /* Under denne avstanden er det eit trykk, ikkje eit drag. Utan terskelen
     * ville kvart forsøk på å setje skrivemerket i eit talfelt rive blokka
     * laus. 6 px er nok til å sleppe unna skjelving i handa. */
    const TERSKEL = 6;

    let el = {};             // { palett, arbeid, soppel }
    let vert = {};           // { paaEndring }
    let program = null;

    let start = null;        // { x, y, id, type, fraaPalett }
    let drag = null;         // { node, skygge, breidd }
    let markor = null;
    let dro = false;         // vart det eit drag? styrer om click skal telje

    function init(elementa, verten) {
        el = elementa;
        vert = verten || {};

        el.arbeid.addEventListener('pointerdown', paaNed);
        el.palett.addEventListener('pointerdown', paaNed);
        el.palett.addEventListener('click', paaPalettklikk);
        el.arbeid.addEventListener('keydown', paaTast);
    }

    const set = (p) => { program = p; };

    /* ---- start ------------------------------------------------------------ */

    function paaNed(e) {
        if (e.button !== undefined && e.button > 0) return;      // berre venstre
        if (e.target.closest('.bs-felt')) return;                 // redigering

        const boks = e.target.closest('.bs-blokk');
        if (!boks) return;
        if (boks.dataset.form === 'hatt') return;                 // hattar sit fast

        /* Breidda blir malt pa heile posten. Dreg du ei gjenta-blokk, er
         * det C-forma som skal folgje fingeren, ikkje berre hovudet. */
        const post = boks.closest(POST) || boks;

        dro = false;
        start = {
            x: e.clientX, y: e.clientY,
            id: boks.dataset.id || null,
            type: boks.dataset.type,
            fraaPalett: boks.classList.contains('bs-palettblokk'),
            breidd: post.getBoundingClientRect().width
        };

        window.addEventListener('pointermove', paaRoersle);
        window.addEventListener('pointerup', paaOpp);
        window.addEventListener('pointercancel', paaOpp);
    }

    function paaRoersle(e) {
        if (!start) return;

        if (!drag) {
            const av = Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y);
            if (av < TERSKEL) return;
            if (!byrjaDrag()) { rydd(); return; }
        }

        flyttSkygge(e.clientX, e.clientY);
        visMaal(finnMaal(e.clientX, e.clientY));
    }

    function byrjaDrag() {
        let node;
        if (start.fraaPalett) {
            node = BolkTre.nyNode(start.type);
        } else {
            node = BolkTre.loys(program, start.id);
            if (!node) return false;
            BolkEditor.teikn();          // blokka er borte frå benken no
        }

        dro = true;
        const skygge = document.createElement('div');
        skygge.className = 'bs-drag';
        skygge.style.width = start.breidd + 'px';
        skygge.appendChild(BolkEditor.blokk(node));
        document.body.appendChild(skygge);

        drag = { node, skygge };
        document.body.classList.add('bs-dreg');
        return true;
    }

    function flyttSkygge(x, y) {
        // Litt over fingeren, så blokka ikkje ligg under han.
        drag.skygge.style.left = (x - 24) + 'px';
        drag.skygge.style.top = (y - 18) + 'px';
    }

    /* ---- kvar hamnar han? -------------------------------------------------- */

    /**
     * Skyggen har `pointer-events: none` i CSS, så elementFromPoint ser rett
     * gjennom han og finn det som faktisk ligg under fingeren.
     */
    function finnMaal(x, y) {
        const under = document.elementFromPoint(x, y);
        if (!under) return null;

        // Over paletten? Då er dette ei sletting.
        if (el.palett.contains(under)) return { slett: true };

        const erVerdi = BolkBlokkar.hent(drag.node.type).form === 'verdi';

        if (erVerdi) {
            const hol = under.closest('.bs-hol[data-tak-verdi], .bs-hol-fylt');
            if (!hol) return null;
            const vertBlokk = hol.closest('.bs-blokk[data-id]');
            if (!vertBlokk) return null;
            return { hol, nodeId: vertBlokk.dataset.id, felt: hol.dataset.holFelt };
        }

        // Ei setning skal ned i ein stabel. closest() gjev den inste, så eit
        // slepp inni ei gjenta-blokk hamnar i kroppen hennar heilt av seg sjølv.
        const stabel = under.closest('.bs-stabel');
        if (!stabel || !el.arbeid.contains(stabel)) return null;
        return { stabel, indeks: indeksI(stabel, y) };
    }

    /* Ein post i ein stabel er anten ei vanleg blokk eller heile C-forma
     * rundt ei gjenta-blokk. Begge har klassa bs-stabelpost, slik at dette
     * ikkje treng vite kva slag han har med a gjere. */
    const POST = '.bs-stabelpost';

    /** Kvar mellom postane i stabelen ligg y? */
    function indeksI(stabel, y) {
        const born = [...stabel.children].filter(b => b.matches(POST));
        for (let i = 0; i < born.length; i++) {
            const r = born[i].getBoundingClientRect();
            if (y < r.top + r.height / 2) return i;
        }
        return born.length;
    }

    /* Markøren er eit ekte element i stabelen, ikkje ei strek teikna oppå.
     * Då flyttar blokkene under seg til side, og eleven ser plassen bli
     * laga før han slepper — ikkje berre ei linje som lovar noko. */
    function visMaal(maal) {
        fjernMarkor();
        el.palett.classList.toggle('er-soppel', !!(maal && maal.slett));
        if (!maal || maal.slett) return;

        if (maal.hol) { maal.hol.classList.add('er-maal'); markor = maal.hol; return; }

        markor = document.createElement('div');
        markor.className = 'bs-markor';
        const born = [...maal.stabel.children].filter(b => b.matches(POST));
        if (maal.indeks >= born.length) maal.stabel.appendChild(markor);
        else maal.stabel.insertBefore(markor, born[maal.indeks]);
    }

    function fjernMarkor() {
        if (!markor) return;
        if (markor.classList.contains('bs-hol')) markor.classList.remove('er-maal');
        else markor.remove();
        markor = null;
    }

    /* ---- slepp -------------------------------------------------------------- */

    function paaOpp(e) {
        if (drag) {
            const maal = finnMaal(e.clientX, e.clientY);
            if (maal && !maal.slett) slepp(maal);
            // Ingen maal? Blokka er alt teken ut av treet, så ho forsvinn —
            // som å dra henne ut av vindauget. Det er òg måten å slette på.
            avsluttDrag();
        }
        rydd();

        /* `dro` må stå gjennom click-fasen, elles ville eit drag som endar
         * på same blokka det starta frå — typisk ei sletting tilbake til
         * paletten — bli talt som eit trykk òg, og leggje ut ei ny blokk.
         * Men han må ryddast rett etterpå: står han att, blir det NESTE
         * ekte trykket svelgt. Ein tick er nok; click kjem synkront etter
         * pointerup. */
        if (dro) setTimeout(() => { dro = false; }, 0);
    }

    function slepp(maal) {
        if (maal.hol) {
            const stad = BolkTre.finn(program, maal.nodeId);
            if (stad) stad.node.felt[maal.felt] = drag.node;
        } else {
            const nokkel = maal.stabel.dataset.stabelId;
            const liste = stabelFor(nokkel);
            if (liste) liste.splice(maal.indeks, 0, drag.node);
        }
        BolkEditor.merk(drag.node.id);
        if (vert.paaEndring) vert.paaEndring();
    }

    /** Frå DOM-nøkkel til den faktiske lista i treet. */
    function stabelFor(nokkel) {
        if (nokkel === 'start') return program.start;
        if (nokkel.indexOf('kmd:') === 0) {
            const k = program.kommandoar[Number(nokkel.slice(4))];
            return k ? k.kropp : null;
        }
        if (nokkel.indexOf('krop:') === 0) {
            const stad = BolkTre.finn(program, nokkel.slice(5));
            return stad ? stad.node.kropp : null;
        }
        return null;
    }

    function avsluttDrag() {
        fjernMarkor();
        el.palett.classList.remove('er-soppel');
        drag.skygge.remove();
        document.body.classList.remove('bs-dreg');
        drag = null;
        BolkEditor.teikn();
    }

    function rydd() {
        start = null;
        window.removeEventListener('pointermove', paaRoersle);
        window.removeEventListener('pointerup', paaOpp);
        window.removeEventListener('pointercancel', paaOpp);
    }

    /* ---- trykk-for-å-setje --------------------------------------------------- */

    function paaPalettklikk(e) {
        if (dro) { dro = false; return; }        // dette var eit drag, ikkje eit trykk
        const knapp = e.target.closest('.bs-palettblokk');
        if (!knapp) return;
        settInn(knapp.dataset.type);
    }

    /**
     * Legg blokka der eleven mest sannsynleg vil ha henne.
     *
     * Er ei gjenta-blokk merkt, hamnar den nye INNI henne. Det er nesten
     * alltid det ein vil rett etter å ha lagt ut ei løkke, og alternativet —
     * å leggje henne etter — tvingar fram eit drag med ein gong.
     */
    function settInn(type) {
        const node = BolkTre.nyNode(type);
        const def = BolkBlokkar.hent(type);
        const valdId = BolkEditor.vald();
        const stad = valdId ? BolkTre.finn(program, valdId) : null;

        if (def.form === 'verdi') {
            if (!settIFyrsteLedigeHol(node, stad)) return;
        } else if (stad && stad.node && BolkBlokkar.hent(stad.node.type).form === 'krop') {
            stad.node.kropp.push(node);
        } else if (stad && stad.stabel) {
            stad.stabel.splice(stad.indeks + 1, 0, node);
        } else {
            program.start.push(node);
        }

        BolkEditor.merk(node.id);
        BolkEditor.teikn();
        if (vert.paaEndring) vert.paaEndring();
    }

    /** Ei verdiblokk må ha eit hòl. Utan eitt ledig har trykket ingen stad å gå. */
    function settIFyrsteLedigeHol(node, stad) {
        const vertNode = stad && stad.node;
        if (!vertNode) return false;
        const ledig = BolkBlokkar.felt(vertNode.type)
            .find(f => f.slag === 'tal' && typeof vertNode.felt[f.felt] !== 'object');
        if (!ledig) return false;
        vertNode.felt[ledig.felt] = node;
        return true;
    }

    /* ---- tastatur ------------------------------------------------------------ */

    function paaTast(e) {
        if (e.target.closest('.bs-felt')) return;
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        const valdId = BolkEditor.vald();
        if (!valdId) return;
        e.preventDefault();
        BolkTre.loys(program, valdId);
        BolkEditor.merk(null);
        BolkEditor.teikn();
        if (vert.paaEndring) vert.paaEndring();
    }

    return { init, set, settInn };
})();
