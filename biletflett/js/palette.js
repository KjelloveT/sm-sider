/* ══════════════════════════════════════
   PALETTE.JS — Fargesystem for BiletFlett

   Byggjer på Open Color (https://yeun.github.io/open-color/, MIT).
   Kvar kulør har ti steg (0 = lysast, 9 = mørkast), og steg-nummeret
   har same oppfatta lysheit på tvers av kulørane. Det er difor malane
   heng saman visuelt sjølv når dei brukar heilt ulike fargar:
   ein «accent» på steg 7 er like tung anten han er raud eller blå.

   Fargar blir skrivne som tokenet 'kulør.steg' — t.d. 'green.7'.
   Palette.at() gjer om til hex. Reine hex-verdiar går uendra gjennom,
   så ein mal kan framleis bruke ein eksakt farge der det trengst.
   ══════════════════════════════════════ */

const Palette = (() => {

    const OC = {
        gray  : ['#f8f9fa', '#f1f3f5', '#e9ecef', '#dee2e6', '#ced4da', '#adb5bd', '#868e96', '#495057', '#343a40', '#212529'],
        red   : ['#fff5f5', '#ffe3e3', '#ffc9c9', '#ffa8a8', '#ff8787', '#ff6b6b', '#fa5252', '#f03e3e', '#e03131', '#c92a2a'],
        pink  : ['#fff0f6', '#ffdeeb', '#fcc2d7', '#faa2c1', '#f783ac', '#f06595', '#e64980', '#d6336c', '#c2255c', '#a61e4d'],
        grape : ['#f8f0fc', '#f3d9fa', '#eebefa', '#e599f7', '#da77f2', '#cc5de8', '#be4bdb', '#ae3ec9', '#9c36b5', '#862e9c'],
        violet: ['#f3f0ff', '#e5dbff', '#d0bfff', '#b197fc', '#9775fa', '#845ef7', '#7950f2', '#7048e8', '#6741d9', '#5f3dc4'],
        indigo: ['#edf2ff', '#dbe4ff', '#bac8ff', '#91a7ff', '#748ffc', '#5c7cfa', '#4c6ef5', '#4263eb', '#3b5bdb', '#364fc7'],
        blue  : ['#e7f5ff', '#d0ebff', '#a5d8ff', '#74c0fc', '#4dabf7', '#339af0', '#228be6', '#1c7ed6', '#1971c2', '#1864ab'],
        cyan  : ['#e3fafc', '#c5f6fa', '#99e9f2', '#66d9e8', '#3bc9db', '#22b8cf', '#15aabf', '#1098ad', '#0c8599', '#0b7285'],
        teal  : ['#e6fcf5', '#c3fae8', '#96f2d7', '#63e6be', '#38d9a9', '#20c997', '#12b886', '#0ca678', '#099268', '#087f5b'],
        green : ['#ebfbee', '#d3f9d8', '#b2f2bb', '#8ce99a', '#69db7c', '#51cf66', '#40c057', '#37b24d', '#2f9e44', '#2b8a3e'],
        lime  : ['#f4fce3', '#e9fac8', '#d8f5a2', '#c0eb75', '#a9e34b', '#94d82d', '#82c91e', '#74b816', '#66a80f', '#5c940d'],
        yellow: ['#fff9db', '#fff3bf', '#ffec99', '#ffe066', '#ffd43b', '#fcc419', '#fab005', '#f59f00', '#f08c00', '#e67700'],
        orange: ['#fff4e6', '#ffe8cc', '#ffd8a8', '#ffc078', '#ffa94d', '#ff922b', '#fd7e14', '#f76707', '#e8590c', '#d9480f']
    };

    const WHITE = '#ffffff';
    const BLACK = '#000000';

    /* Gjer om eit token til hex. Ukjende verdiar (hex, rgba(), 'white')
       går urørte gjennom, slik at malane kan overstyre når dei må. */
    function at(token) {
        if (typeof token !== 'string') return token;
        if (token === 'white') return WHITE;
        if (token === 'black') return BLACK;
        const dot = token.indexOf('.');
        if (dot < 0) return token;
        const hue = OC[token.slice(0, dot)];
        if (!hue) return token;
        const step = Number(token.slice(dot + 1));
        return Number.isInteger(step) && hue[step] ? hue[step] : token;
    }

    /* Byggjer ein malpalett. Argumenta er token, og resultatet er
       ferdig oppslegne hex-verdiar slik resten av koden ventar. */
    function build(bg, ink, accent, accent2, accent3) {
        return {
            bg: at(bg), ink: at(ink),
            accent: at(accent), accent2: at(accent2), accent3: at(accent3)
        };
    }

    /* Slår opp ein farge i høve til ein palett. Godtek paletnøklar
       ('accent', 'ink', …), Open Color-token ('blue.7') og rå hex. */
    function resolve(value, palette, fallback) {
        if (value == null) return fallback;
        if (palette && Object.prototype.hasOwnProperty.call(palette, value)) return palette[value];
        return at(value);
    }

    return { OC, at, build, resolve, WHITE, BLACK };
})();
