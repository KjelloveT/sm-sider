/* ══════════════════════════════════════
   Dagsvegen — kompat-lag mot det felles ikon-settet (../js/vyrdepil-icons.js)
   + Dom-hjelpar for trygg DOM-bygging (textContent, aldri innerHTML
   med dynamiske strenger).
   ══════════════════════════════════════ */

const Icons = (() => {
    function create(name, size) {
        const s = document.createElement('span');
        s.innerHTML = ICON(name, size || 18);
        return s.firstChild;
    }
    function html(name, size) { return ICON(name, size || 18); }
    function inject(root) { hydrateIcons(root); }
    return { create, html, inject };
})();

const Dom = (() => {
    /* el('div', { class: 'x', text: 'trygg tekst', onclick: fn }, child1, child2) */
    function el(tag, opts, ...children) {
        const node = document.createElement(tag);
        if (opts) {
            for (const key in opts) {
                const val = opts[key];
                if (key === 'class') node.className = val;
                else if (key === 'text') node.textContent = val;
                else if (key === 'dataset') Object.assign(node.dataset, val);
                else if (key.startsWith('on')) node.addEventListener(key.slice(2), val);
                else if (val !== false && val != null) node.setAttribute(key, val);
            }
        }
        for (const child of children) {
            if (child == null) continue;
            node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        }
        return node;
    }
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
    return { el, clear };
})();
