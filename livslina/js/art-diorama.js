/* Livslina — art-diorama.js
 * Hybel-dioramaet (portert frå stilguiden). Faste detaljar + utbyttbare «slots»
 * (seng, arbeidsplass, hjørne) styrt av state.possessions.
 * LL.artDiorama.svg(state) → full <svg>-streng.
 */
window.LL = window.LL || {};

LL.artDiorama = (function () {
  'use strict';

  const FIXED = `
    <rect class="ll-o" x="24" y="24" width="420" height="210" fill="#cfe0ea"/>
    <rect class="ll-o" x="24" y="234" width="420" height="68" fill="#c99e66"/>
    <path class="ll-l xthin" d="M24 268 H444 M94 234 V268 M164 234 V268 M234 234 V268 M304 234 V268 M374 234 V268 M59 268 V302 M129 268 V302 M199 268 V302 M269 268 V302 M339 268 V302 M409 268 V302"/>
    <rect class="ll-o thin" x="24" y="224" width="420" height="10" fill="#e8e2d4"/>
    <rect class="ll-o" x="48" y="44" width="104" height="88" fill="#8a5a33"/>
    <rect class="ll-o thin" x="58" y="54" width="84" height="68" fill="#bde3f2"/>
    <path class="ll-l thin" d="M100 54 V122 M58 88 H142"/>
    <circle cx="78" cy="70" r="8" fill="#f4b942"/>
    <circle cx="118" cy="68" r="6" fill="#faf7f0"/>
    <circle cx="127" cy="70" r="5" fill="#faf7f0"/>
    <rect class="ll-o thin" x="44" y="132" width="112" height="10" rx="3" fill="#e8e2d4"/>
    <path class="ll-o thin" d="M64 118 L80 118 L77 132 L67 132 Z" fill="#ef7d2f"/>
    <rect class="ll-o thin" x="67" y="100" width="10" height="20" rx="5" fill="#2f9e63"/>
    <circle cx="72" cy="100" r="3.5" fill="#e63946"/>
    <path class="ll-l" d="M40 38 H164"/>
    <circle cx="40" cy="38" r="4" fill="#1a1a1a"/>
    <circle cx="164" cy="38" r="4" fill="#1a1a1a"/>
    <path class="ll-o thin" d="M46 40 L62 40 L58 126 Q52 118 46 128 Z" fill="#e63946"/>
    <path class="ll-o thin" d="M154 40 L138 40 L142 126 Q148 118 154 128 Z" fill="#e63946"/>
    <rect class="ll-o" x="180" y="40" width="52" height="68" fill="#7c5cd6"/>
    <rect class="ll-o thin" x="186" y="48" width="40" height="8" fill="#f4b942"/>
    <circle cx="196" cy="92" r="4.5" fill="#faf7f0"/>
    <circle cx="212" cy="88" r="4.5" fill="#faf7f0"/>
    <path class="ll-l thin" d="M200 91 V68 L216 64 V87 M200 68 L216 64"/>
    <rect class="ll-o thin" x="244" y="52" width="34" height="26" fill="#faf7f0"/>
    <path class="ll-o xthin" d="M250 72 L259 58 L268 72 Z" fill="#f4b942"/>
    <circle cx="270" cy="59" r="3" fill="#f4b942"/>
    <rect class="ll-o xthin" x="252" y="48" width="18" height="7" fill="#d9d3c7"/>
    <circle class="ll-o" cx="308" cy="58" r="16" fill="#faf7f0"/>
    <path class="ll-l thin" d="M308 58 V47 M308 58 L316 61"/>
    <circle cx="308" cy="58" r="2.5" fill="#1a1a1a"/>
    <rect class="ll-o thin" x="352" y="86" width="86" height="9" fill="#8a5a33"/>
    <path class="ll-o xthin" d="M360 95 L360 104 L369 95 Z" fill="#6d4526"/>
    <path class="ll-o xthin" d="M424 95 L424 104 L433 95 Z" fill="#6d4526"/>
    <rect class="ll-o thin" x="358" y="60" width="11" height="26" fill="#e63946"/>
    <rect class="ll-o thin" x="371" y="64" width="10" height="22" fill="#2b6cb0"/>
    <rect class="ll-o thin" x="383" y="58" width="11" height="28" fill="#2f9e63"/>
    <rect class="ll-o thin" x="396" y="62" width="9" height="25" fill="#7c5cd6" transform="rotate(12 400 87)"/>
    <path class="ll-o thin" d="M412 60 H432 L429 71 Q422 77 415 71 Z" fill="#f4b942"/>
    <rect class="ll-o xthin" x="419" y="75" width="6" height="6" fill="#f4b942"/>
    <rect class="ll-o xthin" x="414" y="81" width="16" height="5" rx="1" fill="#f4b942"/>
    <path class="ll-l thin" d="M348 32 Q392 52 436 32"/>
    <circle cx="355" cy="38" r="4" fill="#f4b942"/>
    <circle cx="370" cy="44" r="4" fill="#e63946"/>
    <circle cx="392" cy="47" r="4" fill="#8ecae6"/>
    <circle cx="414" cy="44" r="4" fill="#2f9e63"/>
    <circle cx="429" cy="38" r="4" fill="#f4b942"/>
    <ellipse class="ll-o thin" cx="235" cy="288" rx="62" ry="12" fill="#f4b942"/>
    <ellipse class="ll-l xthin" cx="235" cy="288" rx="44" ry="8"/>`;

  const DESK = {
    enkel: `
      <rect class="ll-o thin" x="50" y="207" width="9" height="66" fill="#6d4526"/>
      <rect class="ll-o thin" x="158" y="207" width="9" height="66" fill="#6d4526"/>
      <rect class="ll-o xthin" x="59" y="246" width="99" height="6" fill="#6d4526"/>
      <rect class="ll-o" x="44" y="196" width="132" height="11" rx="3" fill="#8a5a33"/>
      <rect class="ll-o thin" x="54" y="189" width="18" height="7" rx="3" fill="#2b6cb0"/>
      <path class="ll-l thin" d="M63 189 L57 170"/>
      <path class="ll-o thin" d="M46 162 L68 156 L61 173 Z" fill="#2b6cb0"/>
      <rect class="ll-o thin" x="88" y="158" width="46" height="32" rx="3" fill="#3a352f"/>
      <rect x="92" y="162" width="38" height="24" fill="#8ecae6"/>
      <rect x="95" y="166" width="14" height="3" fill="#2b6cb0"/>
      <rect x="95" y="171" width="22" height="3" fill="#e63946"/>
      <rect x="95" y="176" width="12" height="3" fill="#2f9e63"/>
      <rect x="95" y="181" width="18" height="3" fill="#2b6cb0"/>
      <rect class="ll-o thin" x="84" y="190" width="54" height="7" rx="2" fill="#57514a"/>
      <rect class="ll-o thin" x="146" y="183" width="14" height="13" rx="2" fill="#e63946"/>
      <path class="ll-l xthin" d="M160 186 Q166 189 160 193 M151 178 Q153 174 151 170 M156 178 Q158 174 156 170"/>
      <rect class="ll-o" x="198" y="236" width="38" height="10" rx="4" fill="#2b6cb0"/>
      <rect class="ll-o thin" x="202" y="246" width="7" height="28" fill="#6d4526"/>
      <rect class="ll-o thin" x="225" y="246" width="7" height="28" fill="#6d4526"/>`,
    gaming: `
      <rect class="ll-o thin" x="50" y="207" width="9" height="66" fill="#57514a"/>
      <rect class="ll-o thin" x="158" y="207" width="9" height="66" fill="#57514a"/>
      <rect class="ll-o" x="44" y="196" width="132" height="11" rx="3" fill="#3a352f"/>
      <rect class="ll-o xthin" x="86" y="186" width="8" height="10" fill="#57514a"/>
      <rect class="ll-o xthin" x="78" y="193" width="24" height="5" rx="2" fill="#57514a"/>
      <rect class="ll-o thin" x="62" y="148" width="56" height="38" rx="3" fill="#3a352f"/>
      <rect x="66" y="152" width="48" height="30" fill="#8ecae6"/>
      <rect x="66" y="174" width="48" height="8" fill="#2f9e63"/>
      <rect x="84" y="167" width="5" height="7" fill="#e63946"/>
      <rect x="101" y="169" width="4" height="5" fill="#7c5cd6"/>
      <rect class="ll-o xthin" x="139" y="186" width="8" height="10" fill="#57514a"/>
      <rect class="ll-o thin" x="124" y="158" width="38" height="28" rx="3" fill="#3a352f"/>
      <rect x="128" y="162" width="30" height="20" fill="#26201c"/>
      <rect x="131" y="165" width="16" height="2.5" fill="#2f9e63"/>
      <rect x="131" y="170" width="22" height="2.5" fill="#2f9e63"/>
      <rect x="131" y="175" width="12" height="2.5" fill="#2f9e63"/>
      <rect class="ll-o thin" x="70" y="190" width="48" height="7" rx="2" fill="#26201c"/>
      <rect x="74" y="192" width="4" height="3" fill="#e63946"/>
      <rect x="80" y="192" width="4" height="3" fill="#f4b942"/>
      <rect x="86" y="192" width="4" height="3" fill="#2f9e63"/>
      <rect x="92" y="192" width="4" height="3" fill="#8ecae6"/>
      <rect x="98" y="192" width="4" height="3" fill="#7c5cd6"/>
      <ellipse class="ll-o xthin" cx="130" cy="193" rx="5" ry="4" fill="#e63946"/>
      <path class="ll-l thin" d="M150 186 A10 10 0 0 1 170 186"/>
      <rect class="ll-o xthin" x="147" y="184" width="7" height="10" rx="3" fill="#e63946"/>
      <rect class="ll-o xthin" x="167" y="184" width="7" height="10" rx="3" fill="#e63946"/>
      <rect class="ll-o" x="192" y="232" width="46" height="11" rx="4" fill="#3a352f"/>
      <rect class="ll-o" x="228" y="186" width="13" height="52" rx="6" fill="#e63946"/>
      <rect class="ll-o thin" x="210" y="243" width="7" height="20" fill="#57514a"/>
      <rect class="ll-o thin" x="196" y="263" width="36" height="6" rx="3" fill="#57514a"/>
      <circle class="ll-o xthin" cx="200" cy="273" r="5" fill="#3a352f"/>
      <circle class="ll-o xthin" cx="228" cy="273" r="5" fill="#3a352f"/>`
  };

  const HOBBY = {
    plante: `
      <path class="ll-l thin" d="M272 252 Q262 234 256 220 M276 252 Q277 228 278 210 M280 252 Q290 236 296 222"/>
      <ellipse class="ll-o thin" cx="254" cy="212" rx="9" ry="14" fill="#2f9e63" transform="rotate(-24 254 212)"/>
      <ellipse class="ll-o thin" cx="278" cy="196" rx="10" ry="15" fill="#2f9e63"/>
      <ellipse class="ll-o thin" cx="298" cy="214" rx="9" ry="14" fill="#2f9e63" transform="rotate(22 298 214)"/>
      <path class="ll-l xthin" d="M258 202 L250 222 M278 186 V206 M294 204 L302 224"/>
      <path class="ll-o" d="M260 262 L292 262 L287 292 L265 292 Z" fill="#ef7d2f"/>
      <rect class="ll-o thin" x="256" y="252" width="40" height="10" rx="3" fill="#ef7d2f"/>`,
    gitar: `
      <g transform="rotate(-10 276 250)">
        <rect class="ll-o thin" x="270" y="158" width="11" height="66" fill="#8a5a33"/>
        <rect class="ll-o thin" x="268" y="142" width="15" height="18" rx="3" fill="#3a352f"/>
        <circle cx="266" cy="146" r="2.5" fill="#d9d3c7"/>
        <circle cx="266" cy="152" r="2.5" fill="#d9d3c7"/>
        <circle cx="285" cy="149" r="2.5" fill="#d9d3c7"/>
        <circle class="ll-o" cx="276" cy="234" r="17" fill="#f4b942"/>
        <circle class="ll-o" cx="276" cy="260" r="24" fill="#f4b942"/>
        <circle class="ll-o thin" cx="276" cy="248" r="7" fill="#8a5a33"/>
        <rect class="ll-o xthin" x="268" y="268" width="16" height="5" rx="2" fill="#3a352f"/>
        <path class="ll-l xthin" d="M272 162 V266 M280 162 V266"/>
      </g>`,
    trening: `
      <rect class="ll-o thin" x="248" y="238" width="9" height="24" rx="3" fill="#3a352f"/>
      <rect class="ll-o thin" x="285" y="238" width="9" height="24" rx="3" fill="#3a352f"/>
      <rect class="ll-o xthin" x="257" y="246" width="28" height="8" rx="3" fill="#8a8378"/>
      <rect class="ll-o" x="246" y="270" width="52" height="20" rx="10" fill="#7c5cd6"/>
      <circle class="ll-o thin" cx="288" cy="280" r="10" fill="#7c5cd6"/>
      <circle class="ll-o xthin" cx="288" cy="280" r="4" fill="#faf7f0"/>`
  };

  const BED = {
    madrass: `
      <rect class="ll-o" x="316" y="264" width="120" height="24" rx="8" fill="#e8e2d4"/>
      <rect class="ll-o" x="310" y="252" width="78" height="30" rx="10" fill="#e63946"/>
      <path class="ll-l xthin" d="M310 266 H388"/>
      <rect class="ll-o thin" x="398" y="250" width="34" height="18" rx="7" fill="#faf7f0"/>`,
    seng: `
      <rect class="ll-o" x="430" y="200" width="11" height="70" rx="4" fill="#8a5a33"/>
      <rect class="ll-o thin" x="322" y="270" width="9" height="22" fill="#6d4526"/>
      <rect class="ll-o thin" x="423" y="270" width="9" height="22" fill="#6d4526"/>
      <rect class="ll-o" x="318" y="250" width="116" height="20" rx="4" fill="#8a5a33"/>
      <rect class="ll-o" x="318" y="234" width="116" height="18" rx="6" fill="#e8e2d4"/>
      <rect class="ll-o thin" x="398" y="220" width="32" height="18" rx="7" fill="#faf7f0"/>
      <rect class="ll-o" x="312" y="228" width="80" height="30" rx="10" fill="#e63946"/>
      <path class="ll-l xthin" d="M312 243 H392 M336 228 V258 M362 228 V258"/>`
  };

  // Vel hjørne-variant ut frå eigedelar / aktivitetar
  function hobbyVariant(state) {
    if (state.possessions.hobby) return state.possessions.hobby;
    const acts = (state.plan && state.plan.activities) || [];
    if (acts.includes('sport') || acts.includes('gym')) return 'trening';
    if (acts.includes('kultur')) return 'gitar';
    return 'plante';
  }

  function svg(state) {
    const desk = state.possessions.desk === 'gaming' ? DESK.gaming : DESK.enkel;
    const bed = state.possessions.bed === 'seng' ? BED.seng : BED.madrass;
    const hobby = HOBBY[hobbyVariant(state)] || HOBBY.plante;
    return `<svg class="ll-svg ll-svg-lg" viewBox="0 0 480 340" role="img" aria-label="Rommet ditt">`
      + `<rect class="ink" x="17" y="17" width="452" height="310" rx="16"/>`
      + `<rect class="plate" x="8" y="8" width="452" height="310" rx="16"/>`
      + FIXED
      + `<g>${desk}</g><g>${hobby}</g><g>${bed}</g>`
      + `</svg>`;
  }

  return { svg };
})();
