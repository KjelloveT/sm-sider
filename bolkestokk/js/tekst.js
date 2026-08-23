/* Bolkestokk — enkel formatering i læretekst og oppgåvetekst.
 *
 * To ting, og ikkje fleire:
 *   **utheva**   → <strong>
 *   `kode`       → <code> i maskinskrift
 *
 * Kodeord midt i ei setning er det viktigaste av dei to. Utan eiga skrift
 * er det vanskeleg å sjå kva som er namnet på ei blokk og kva som er
 * vanleg tekst: «dra inn `Gjenta`» peikar på ei blokk eleven skal finne,
 * medan «gjenta det du gjorde» berre er ein instruks.
 *
 * Vi byggjer DOM-nodar og set innhaldet med textContent. Ingen innerHTML,
 * ingen HTML i JSON-filene (AGENTS.md §5.3). Då kan ei oppgåvefil ein lærar
 * har fått tilsendt aldri smugle inn markup.
 */
const BolkTekst = (function () {

    const MØNSTER = /(\*\*[^*]+\*\*|`[^`]+`)/g;

    /** @returns {DocumentFragment} */
    function formater(tekst) {
        const frag = document.createDocumentFragment();

        String(tekst ?? '').split(MØNSTER).forEach(bit => {
            if (!bit) return;

            if (bit.length > 4 && bit.startsWith('**') && bit.endsWith('**')) {
                const sterk = document.createElement('strong');
                sterk.textContent = bit.slice(2, -2);
                frag.appendChild(sterk);

            } else if (bit.length > 2 && bit.startsWith('`') && bit.endsWith('`')) {
                const kode = document.createElement('code');
                kode.className = 'bs-kodeord';
                kode.textContent = bit.slice(1, -1);
                frag.appendChild(kode);

            } else {
                frag.appendChild(document.createTextNode(bit));
            }
        });

        return frag;
    }

    /** Tømmer elementet og set formatert tekst i det. */
    function set(el, tekst) {
        el.textContent = '';
        el.appendChild(formater(tekst));
        return el;
    }

    return { formater, set };
})();
