/* Livslina — art-doll.js
 * Lagdelt paper doll-SVG (portert frå stilguiden). Byggjer SVG-streng ut frå
 * eit character-objekt: { skin, hair, hairColor, top, topColor }.
 */
window.LL = window.LL || {};

LL.artDoll = (function () {
  'use strict';

  const SKIN_TONES = ['#f6d7b0', '#e8b98a', '#b07b4f', '#7c4a2a'];
  const HAIR_COLORS = ['#26201c', '#e3b23c', '#c1502e', '#6b6b6b'];
  const TOP_COLORS = ['#e63946', '#2b6cb0', '#2f9e63', '#f4b942', '#7c5cd6'];

  const HAIR_STYLES = [
    { id: 'kort', label: 'Kort' },
    { id: 'langt', label: 'Langt' },
    { id: 'krollete', label: 'Krøllete' }
  ];
  const TOP_STYLES = [
    { id: 'tskjorte', label: 'T-skjorte' },
    { id: 'genser', label: 'Genser' },
    { id: 'hettegenser', label: 'Hettegenser' }
  ];

  const BASE = `
    <rect class="ll-o" x="74" y="178" width="22" height="52" rx="9" fill="#2b3a55"/>
    <rect class="ll-o" x="104" y="178" width="22" height="52" rx="9" fill="#2b3a55"/>
    <rect class="ll-o" x="68" y="226" width="32" height="16" rx="8" fill="#3a352f"/>
    <rect class="ll-o" x="100" y="226" width="32" height="16" rx="8" fill="#3a352f"/>
    <rect class="ll-o skin" x="44" y="114" width="18" height="60" rx="9"/>
    <rect class="ll-o skin" x="138" y="114" width="18" height="60" rx="9"/>
    <circle class="ll-o skin" cx="53" cy="180" r="9"/>
    <circle class="ll-o skin" cx="147" cy="180" r="9"/>
    <rect class="ll-o skin" x="66" y="104" width="68" height="78" rx="12"/>
    <rect class="ll-o skin" x="90" y="92" width="20" height="18"/>
    <circle class="ll-o skin" cx="58" cy="64" r="8"/>
    <circle class="ll-o skin" cx="142" cy="64" r="8"/>
    <circle class="ll-o skin" cx="100" cy="60" r="42"/>
    <circle fill="#1a1a1a" cx="85" cy="62" r="4.5"/>
    <circle fill="#1a1a1a" cx="115" cy="62" r="4.5"/>
    <circle fill="#f2a6a0" cx="76" cy="74" r="5"/>
    <circle fill="#f2a6a0" cx="124" cy="74" r="5"/>
    <path class="ll-l" d="M90 79 Q100 88 110 79"/>`;

  const TOPS = {
    tskjorte: `
      <rect class="ll-o top" x="42" y="110" width="22" height="32" rx="10"/>
      <rect class="ll-o top" x="136" y="110" width="22" height="32" rx="10"/>
      <rect class="ll-o top" x="64" y="102" width="72" height="78" rx="12"/>
      <path class="ll-l" d="M88 102 Q100 112 112 102"/>`,
    genser: `
      <rect class="ll-o top" x="42" y="108" width="22" height="64" rx="10"/>
      <rect class="ll-o top" x="136" y="108" width="22" height="64" rx="10"/>
      <rect class="ll-o top" x="42" y="162" width="22" height="10" rx="4"/>
      <rect class="ll-o top" x="136" y="162" width="22" height="10" rx="4"/>
      <rect class="ll-o top" x="62" y="100" width="76" height="82" rx="12"/>
      <rect class="ll-o top" x="62" y="172" width="76" height="10" rx="4"/>
      <path class="ll-l" d="M86 100 Q100 110 114 100"/>`,
    hettegenser: `
      <rect class="ll-o top" x="42" y="108" width="22" height="64" rx="10"/>
      <rect class="ll-o top" x="136" y="108" width="22" height="64" rx="10"/>
      <rect class="ll-o top" x="62" y="100" width="76" height="82" rx="12"/>
      <path class="ll-o top" d="M64 100 Q100 124 136 100 L141 116 Q100 140 59 116 Z"/>
      <rect class="ll-o top" x="79" y="146" width="42" height="26" rx="9"/>
      <path class="ll-l thin" d="M92 116 L90 138 M108 116 L110 138"/>
      <circle fill="#1a1a1a" cx="90" cy="140" r="3"/>
      <circle fill="#1a1a1a" cx="110" cy="140" r="3"/>`
  };

  const HAIRS = {
    kort: `<path class="ll-o hair" d="M58 60 A42 42 0 0 1 142 60 Q131 50 120 56 Q109 46 100 52 Q91 46 80 56 Q69 50 58 60 Z"/>`,
    langt: `<path class="ll-o hair" d="M58 60 A42 42 0 0 1 142 60 L146 116 Q147 128 135 127 L133 92 Q120 54 100 54 Q80 54 67 92 L65 127 Q53 128 54 116 Z"/>`,
    krollete: `
      <circle class="ll-o hair" cx="56" cy="62" r="11"/>
      <circle class="ll-o hair" cx="144" cy="62" r="11"/>
      <circle class="ll-o hair" cx="64" cy="46" r="13"/>
      <circle class="ll-o hair" cx="136" cy="46" r="13"/>
      <circle class="ll-o hair" cx="82" cy="32" r="13"/>
      <circle class="ll-o hair" cx="118" cy="32" r="13"/>
      <circle class="ll-o hair" cx="100" cy="26" r="13"/>`
  };

  // Byggjer SVG-innhald (utan <svg>-wrapper). withPlate=true legg på papirplate.
  function inner(ch, withPlate) {
    const plate = withPlate
      ? `<rect class="ink" x="13" y="13" width="192" height="252" rx="14"/>
         <rect class="plate" x="6" y="6" width="192" height="252" rx="14"/>`
      : '';
    return plate
      + '<g>' + BASE + '</g>'
      + '<g>' + (TOPS[ch.top] || TOPS.tskjorte) + '</g>'
      + '<g>' + (HAIRS[ch.hair] || HAIRS.kort) + '</g>';
  }

  // Full <svg>. opts: { withPlate, className, ariaLabel }
  function svg(ch, opts) {
    opts = opts || {};
    const cls = 'll-svg' + (opts.className ? ' ' + opts.className : '');
    const style = `--doll-skin:${ch.skin}; --doll-hair:${ch.hairColor}; --doll-top:${ch.topColor};`;
    return `<svg class="${cls}" viewBox="0 0 212 272" role="img" aria-label="${opts.ariaLabel || 'Spelfigur'}" style="${style}">`
      + inner(ch, opts.withPlate !== false)
      + '</svg>';
  }

  return { svg, inner, SKIN_TONES, HAIR_COLORS, TOP_COLORS, HAIR_STYLES, TOP_STYLES };
})();
