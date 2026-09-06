/* ══════════════════════════════════════════════
   VYRDEPIL — felles småhjelparar
   ══════════════════════════════════════════════

   Éi utgåve av dei funksjonane kvart einaste verktøy elles skriv på nytt:
   escapeHtml, shuffle, downloadBlob, slug, uuid, el, modalhandtering og toast.

   Bakgrunnen: før denne fila fanst, låg det ni ulike `toast()`, åtte
   `downloadBlob()`, ti `shuffle()` og fire `escapeHtml()` rundt i repoet. Det
   er ikkje berre kodemengd — det er fire sjansar til å skrive escapinga litt
   feil, og éin av dei fire gjorde det: han rensa ikkje hermeteikn i det heile
   og var difor verdlaus inne i eit HTML-attributt.

   Bruk:

     <script src="../js/vyrdepil-util.js"></script>

   Modulen legg seg på `window.Vy`. Verktøy som alt har eit eige `util`-objekt
   skal la det peike hit i staden for å halde sin eigen kopi — sjå
   `leitekryss/js/util.js` for mønsteret.
   ══════════════════════════════════════════════ */

window.Vy = (function () {
    'use strict';

    /* ──────────────── Tekst ──────────────── */

    /**
     * Gjer ein streng trygg å setje inn i HTML.
     *
     * Merk at apostrofen er med. Han manglar i dei fleste escapeHtml-ar folk
     * skriv i farta, og det går bra heilt til nokon skriv `attributt='...'`
     * med enkle hermeteikn — då er escapinga verdlaus. Vi tek han med så
     * funksjonen er trygg uansett kvar resultatet hamnar.
     *
     * Dette er likevel andrevalet. Fyrstevalet er `textContent` eller
     * `Vy.el()`, som ikkje kan gå gale i det heile (AGENTS.md §5.3).
     *
     * @param {*} value
     * @returns {string}
     */
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Trygt filnamn ut frå ein tittel. Æ, ø og å blir skrivne ut, alt anna
     * enn bokstavar og siffer blir til bindestrek.
     *
     * @param {string} text
     * @param {string} [fallback] brukt når teksten ikkje gjev noko att
     * @returns {string}
     */
    function slug(text, fallback) {
        const s = String(text || '').trim().toLowerCase()
            .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return s || fallback || 'vyrdepil';
    }

    /** Unik id, med fallback for eldre nettlesarar. */
    function uuid(prefix) {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return (prefix || 'vy') + '-' + Date.now().toString(36) +
            '-' + Math.random().toString(36).slice(2, 10);
    }

    /* ──────────────── Lister ──────────────── */

    /**
     * Fisher-Yates på ein KOPI av lista. Originalen blir ikkje rørt — det er
     * med vilje: ei stokking som endrar inndata har fleire gonger ført til at
     * ei elevliste kom ut i ny rekkjefølgje kvar gong ho blei vist.
     *
     * @param {Array} list
     * @param {function():number} [random] eigen generator, t.d. eit fast frø
     * @returns {Array} ny, stokka liste
     */
    function shuffle(list, random) {
        const rnd = random || Math.random;
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(rnd() * (i + 1));
            const tmp = out[i];
            out[i] = out[j];
            out[j] = tmp;
        }
        return out;
    }

    /**
     * Deterministisk tilfeldig-generator (mulberry32). Same frø gjev same
     * rekkje, så eit rutenett eller ei trekning kan lagast om att.
     *
     * @param {number} seed
     * @returns {function():number}
     */
    function rng(seed) {
        let a = (seed >>> 0) || 1;
        return function () {
            a += 0x6D2B79F5;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /** Nytt tilfeldig frø til `rng()`. */
    function newSeed() {
        return Math.floor(Math.random() * 2147483647) + 1;
    }

    /* ──────────────── DOM ──────────────── */

    /**
     * Lag eit element med klasse og tekst i eitt kall.
     * Teksten går gjennom `textContent`, så han kan ikkje bere HTML — det er
     * heile poenget.
     *
     * @param {string} tag
     * @param {string} [className]
     * @param {string} [text]
     * @returns {HTMLElement}
     */
    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    /* ──────────────── Nedlasting ──────────────── */

    /**
     * Last ned ein Blob som fil.
     *
     * Lenkja blir lagd i dokumentet før klikket. Det ser unødvendig ut, men
     * Firefox utløyser ikkje nedlastinga på eit element som ikkje står i
     * DOM-en. `revokeObjectURL` ventar eit sekund av same grunn: nettlesaren
     * er ikkje ferdig med URL-en når `click()` returnerer.
     *
     * @param {Blob} blob
     * @param {string} filename
     */
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    /**
     * Last ned eit objekt som JSON-fil.
     *
     * Objektet skal alt ha `app` og `version` på toppnivå (AGENTS.md §5.2) —
     * funksjonen legg dei ikkje på for deg, for han veit ikkje kva app du er.
     *
     * @param {object} obj
     * @param {string} filename
     */
    function downloadJson(obj, filename) {
        downloadBlob(
            new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }),
            filename
        );
    }

    /* ──────────────── Modalar ──────────────── */

    /* Stabelen gjer at Escape lukkar den øvste modalen, ikkje alle på ein
       gong. AGENTS.md §5.4 krev at ein modal kan lukkast med Escape; med
       denne modulen får kvart verktøy det utan å skrive lyttaren sjølv. */
    const openStack = [];

    /** Opnar overlegget og set fokus i det første feltet som tek imot det. */
    function openModal(overlay) {
        if (!overlay) return;
        overlay.classList.add('open');
        if (openStack.indexOf(overlay) === -1) openStack.push(overlay);
        const focusable = overlay.querySelector(
            'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
        );
        if (focusable) focusable.focus();
    }

    /** Lukkar overlegget. */
    function closeModal(overlay) {
        if (!overlay) return;
        overlay.classList.remove('open');
        const i = openStack.indexOf(overlay);
        if (i !== -1) openStack.splice(i, 1);
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape' || !openStack.length) return;
        closeModal(openStack[openStack.length - 1]);
    });

    /** Står dette overlegget ope no? */
    function modalOpen(overlay) {
        return !!overlay && overlay.classList.contains('open');
    }

    /**
     * Står det EIN modal open? Brukt av verktøy som må la tastatursnarvegar
     * ligge medan ein dialog er framme — Rissverk slettar til dømes ei form
     * med Delete, og det skal ikkje skje medan brukaren skriv i eit felt.
     */
    function anyModalOpen() {
        return openStack.length > 0;
    }

    /** Lukk modalen når ein klikkar på det mørke feltet utanfor. */
    function bindOverlayClose(overlay) {
        if (!overlay) return;
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal(overlay);
        });
    }

    /* ──────────────── Kort melding (toast) ──────────────── */

    /* Meldingane blir lagde i ein felles container. `role="status"` gjer at
       skjermlesarar les dei opp utan å flytte fokus — ei melding som stel
       fokus midt i ei oppgåve er verre enn inga melding. */
    let toastHost = null;

    function ensureToastHost() {
        if (toastHost && document.body.contains(toastHost)) return toastHost;
        toastHost = document.createElement('div');
        toastHost.className = 'vy-toast-host';
        toastHost.setAttribute('role', 'status');
        toastHost.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastHost);
        return toastHost;
    }

    /**
     * Kort melding nedst på skjermen.
     *
     *   Vy.toast('Lagra');
     *   Vy.toast('Kortet gav 3 poeng!', { icon: 'coins', kind: 'good' });
     *
     * @param {string} message
     * @param {object} [opts]
     * @param {string} [opts.icon]  namn på eit Lucide-ikon (krev vyrdepil-icons.js)
     * @param {string} [opts.kind]  'good' | 'warn' | 'badge' — utan dette blir han nøytral
     * @param {number} [opts.ms]    levetid i millisekund (standard 3200)
     */
    function toast(message, opts) {
        opts = opts || {};
        const host = ensureToastHost();

        const node = el('div', 'vy-toast' + (opts.kind ? ' vy-toast-' + opts.kind : ''));

        if (opts.icon && typeof window.ICON === 'function') {
            const ico = el('span', 'vy-toast-ico');
            /* ICON() gjev fast SVG-markup frå vår eigen ikonmodul, aldri
               brukartekst — difor er innerHTML trygt akkurat her. */
            ico.innerHTML = window.ICON(opts.icon, 18);
            node.appendChild(ico);
        }

        node.appendChild(el('span', 'vy-toast-msg', message));
        host.appendChild(node);

        /* Framtving ei omrekning før klassen blir sett, elles hoppar han rett
           til sluttilstanden og overgangen blir aldri spelt.

           Dette var eit `requestAnimationFrame` fyrst, men rAF står stille i
           ei fane som ikkje er synleg. Ein toast som blei utløyst medan fana
           låg i bakgrunnen fekk då aldri `.open`, og stod usynleg til han
           blei rydda bort. Ei tvinga omrekning bryr seg ikkje om det. */
        void node.offsetWidth;
        node.classList.add('open');

        const levetid = typeof opts.ms === 'number' ? opts.ms : 3200;
        setTimeout(function () {
            node.classList.remove('open');
            setTimeout(function () { node.remove(); }, 400);
        }, levetid);

        return node;
    }

    return {
        escapeHtml: escapeHtml,
        slug: slug,
        uuid: uuid,
        shuffle: shuffle,
        rng: rng,
        newSeed: newSeed,
        el: el,
        downloadBlob: downloadBlob,
        downloadJson: downloadJson,
        openModal: openModal,
        closeModal: closeModal,
        modalOpen: modalOpen,
        anyModalOpen: anyModalOpen,
        bindOverlayClose: bindOverlayClose,
        toast: toast
    };
})();
