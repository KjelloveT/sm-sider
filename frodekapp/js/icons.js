// Frødekapp — spelspesifikke ikon-hjelparar.
// Sjølve ikon-settet ligg i ../js/vyrdepil-icons.js (global ICON/hydrateIcons).

// Svar-form per indeks (0-3)
const ANSWER_ICON_NAMES = ['triangle', 'diamond', 'circle', 'square'];

/**
 * Lag eit SVG-element (DOM-node) for trygg innsetjing utan innerHTML.
 * @returns {SVGElement}
 */
function ICON_EL(name, size = 18, extraClass = '') {
    const wrap = document.createElement('span');
    wrap.innerHTML = ICON(name, size, extraClass);
    return wrap.firstChild;
}

if (typeof window !== 'undefined') {
    window.ICON_EL = ICON_EL;
    window.ANSWER_ICON_NAMES = ANSWER_ICON_NAMES;
}
