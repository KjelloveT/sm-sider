/* Livslina — art-vignettes.js
 * Små SVG-vignettar til hendingskort. Same flate stil som resten (plate + motiv).
 * LL.artVignette.svg(key) → full <svg>-streng med papirplate.
 */
window.LL = window.LL || {};

LL.artVignette = (function () {
  'use strict';

  const MOTIFS = {
    phone: `
      <path class="ll-o" fill="#8a8378" d="M20 150 H220 V166 Q220 180 206 180 L34 180 Q20 180 20 166 Z"/>
      <g transform="rotate(-10 120 105)">
        <rect class="ll-o" x="90" y="48" width="60" height="106" rx="12" fill="#3a352f"/>
        <rect class="ll-o thin" x="96" y="58" width="48" height="80" rx="4" fill="#8ecae6"/>
        <path class="ll-l thin" d="M112 86 L102 98 L106 112 L98 126 M112 86 L124 96 L120 110 M112 86 L120 78 L130 72 M112 86 L102 76"/>
        <circle fill="#1a1a1a" cx="112" cy="86" r="3"/>
      </g>
      <path class="ll-l" d="M72 40 L82 48 M104 30 L108 40 M136 30 L134 40"/>`,
    shield: `
      <path class="ll-o" fill="#2f9e63" d="M120 34 L172 52 V104 Q172 150 120 172 Q68 150 68 104 V52 Z"/>
      <path class="ll-l" d="M98 104 L114 122 L146 82" stroke="#faf7f0" stroke-width="7"/>`,
    warning: `
      <path class="ll-o" fill="#f4b942" d="M120 40 L184 158 Q188 168 176 168 L64 168 Q52 168 56 158 Z"/>
      <rect x="113" y="78" width="14" height="46" rx="6" fill="#1a1a1a"/>
      <circle cx="120" cy="146" r="8" fill="#1a1a1a"/>`,
    bus: `
      <rect class="ll-o" x="40" y="60" width="160" height="86" rx="14" fill="#f4b942"/>
      <rect class="ll-o thin" x="54" y="74" width="40" height="30" rx="4" fill="#bde3f2"/>
      <rect class="ll-o thin" x="100" y="74" width="40" height="30" rx="4" fill="#bde3f2"/>
      <rect class="ll-o thin" x="146" y="74" width="40" height="30" rx="4" fill="#bde3f2"/>
      <rect class="ll-o thin" x="54" y="116" width="132" height="10" rx="3" fill="#e63946"/>
      <circle class="ll-o" cx="78" cy="150" r="16" fill="#3a352f"/>
      <circle class="ll-o" cx="162" cy="150" r="16" fill="#3a352f"/>
      <circle cx="78" cy="150" r="5" fill="#d9d3c7"/>
      <circle cx="162" cy="150" r="5" fill="#d9d3c7"/>`,
    laptop: `
      <rect class="ll-o" x="66" y="52" width="108" height="72" rx="6" fill="#3a352f"/>
      <rect x="74" y="60" width="92" height="56" fill="#8ecae6"/>
      <path class="ll-o" d="M52 124 H188 L200 150 H40 Z" fill="#d9d3c7"/>
      <ellipse class="ll-o thin" cx="150" cy="52" rx="16" ry="8" fill="#6d4526"/>
      <path class="ll-l thin" d="M150 44 Q156 40 150 36"/>`,
    star: `
      <path class="ll-o" fill="#f4b942" d="M120 40 L138 92 L192 94 L149 126 L164 178 L120 148 L76 178 L91 126 L48 94 L102 92 Z"/>`,
    gift: `
      <rect class="ll-o" x="60" y="86" width="120" height="80" rx="6" fill="#e63946"/>
      <rect class="ll-o thin" x="52" y="66" width="136" height="26" rx="5" fill="#c1502e"/>
      <rect x="110" y="66" width="20" height="100" fill="#f4b942"/>
      <path class="ll-o thin" d="M120 66 Q100 44 84 56 Q78 66 120 66 Q140 44 156 56 Q162 66 120 66 Z" fill="#f4b942"/>`,
    coins: `
      <ellipse class="ll-o" cx="120" cy="150" rx="46" ry="16" fill="#f4b942"/>
      <ellipse class="ll-o" cx="120" cy="126" rx="46" ry="16" fill="#f4b942"/>
      <ellipse class="ll-o" cx="120" cy="102" rx="46" ry="16" fill="#f4b942"/>
      <ellipse class="ll-o thin" cx="120" cy="78" rx="46" ry="16" fill="#f4b942"/>
      <text x="120" y="84" text-anchor="middle" font-size="20" font-weight="800" fill="#1a1a1a">kr</text>`,
    home: `
      <path class="ll-o" d="M120 46 L188 104 H52 Z" fill="#e63946"/>
      <rect class="ll-o" x="66" y="104" width="108" height="64" fill="#e8e2d4"/>
      <rect class="ll-o thin" x="106" y="126" width="28" height="42" fill="#8a5a33"/>
      <rect class="ll-o thin" x="80" y="118" width="20" height="20" fill="#bde3f2"/>`,
    book: `
      <path class="ll-o" d="M56 56 Q120 44 184 56 L184 156 Q120 144 56 156 Z" fill="#2b6cb0"/>
      <path class="ll-l" d="M120 50 V150"/>
      <path class="ll-l thin" d="M72 78 Q96 72 112 76 M72 98 Q96 92 112 96 M128 76 Q152 72 168 78 M128 96 Q152 92 168 98"/>`
  };

  function svg(key) {
    const motif = MOTIFS[key] || MOTIFS.star;
    return `<svg class="ll-svg" viewBox="0 0 240 200" role="img" aria-hidden="true">`
      + `<rect class="ink" x="13" y="13" width="218" height="178" rx="14"/>`
      + `<rect class="plate" x="6" y="6" width="218" height="178" rx="14"/>`
      + motif + `</svg>`;
  }

  return { svg };
})();
