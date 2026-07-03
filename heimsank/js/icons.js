// Heimsank — spelspesifikk ikon-hjelpar.
// Sjølve ikon-settet ligg i ../js/vyrdepil-icons.js (global ICON/hydrateIcons).

/**
 * Render a category icon by key, falling back to inline text.
 */
function CAT_ICON(key, size = 16) {
  return (window.VyrdepilIcons && VyrdepilIcons.has(key)) ? ICON(key, size) : (key || '');
}

if (typeof window !== 'undefined') {
  window.CAT_ICON = CAT_ICON;
}
