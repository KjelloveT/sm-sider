/* ══════════════════════════════════════════════
   DESIGN.JS — Designoppsettet, malane og reglane

   Heile utsjånaden til ein kode ligg i eitt reint dataobjekt. Det er
   det same objektet som blir teikna, lagra, eksportert som JSON og lagt
   i ein mal — ingen del av utsjånaden bur i DOM-en. Difor kan ein mal
   vere data og ikkje kode, og difor kan ei lagra fil opne seg likt i
   morgon.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.design = (function () {
  'use strict';

  function defaults() {
    return {
      module: { shape: 'rounded', radius: 0.35, gap: 0 },
      eye: { frame: 'rounded', pupil: 'rounded', sameColor: true, color: '#1a1a1a' },
      alignment: { style: 'module' },
      fill: { type: 'solid', color: '#1a1a1a', color2: '#2b2d42', angle: 45, target: 'all' },
      bg: { color: '#ffffff', transparent: false },
      frame: { style: 'none', text: 'SKANN MEG', textPos: 'bottom', color: '#1a1a1a' },
      quiet: 4,
      ecc: 'auto',
      minVersion: 0,
      logo: {
        source: 'none',      // none | icon | app | upload
        icon: 'wifi',
        app: '',
        dataUri: '',
        vector: false,       // true når dataUri er ein SVG
        color: '#1a1a1a',
        weight: 2,
        size: 0.2,
        plate: 'roundrect',  // none | circle | roundrect
        plateColor: '#ffffff',
        platePad: 0.22,
        excavate: true
      }
    };
  }

  /* Djupkopi som toler at oppsettet berre er data. Ingen funksjonar,
     ingen datoar, ingen sykliske referansar — JSON held. */
  function clone(d) {
    return JSON.parse(JSON.stringify(d));
  }

  /* Fyller ut felt som manglar i eit oppsett frå ei eldre lagring, slik at
     ein gammal fil ikkje kræsjar teiknaren på ein nøkkel som kom til seinare. */
  function normalise(input) {
    const base = defaults();
    if (!input || typeof input !== 'object') return base;
    Object.keys(base).forEach((key) => {
      const v = input[key];
      if (v == null) return;
      if (typeof base[key] === 'object' && !Array.isArray(base[key])) {
        Object.keys(base[key]).forEach((k2) => {
          if (v[k2] != null) base[key][k2] = v[k2];
        });
      } else {
        base[key] = v;
      }
    });
    return base;
  }

  /* ──────────────── Ferdigmalar ──────────────── */

  const PRESETS = [
    {
      id: 'klassisk', label: 'Klassisk',
      patch: {
        module: { shape: 'square', radius: 0, gap: 0 },
        eye: { frame: 'square', pupil: 'square', sameColor: true },
        fill: { type: 'solid', color: '#000000' },
        bg: { color: '#ffffff', transparent: false },
        frame: { style: 'none' }
      }
    },
    {
      id: 'runda', label: 'Runda',
      patch: {
        module: { shape: 'liquid', radius: 0.9, gap: 0 },
        eye: { frame: 'rounded', pupil: 'rounded', sameColor: true },
        fill: { type: 'solid', color: '#1a1a1a' },
        bg: { color: '#ffffff', transparent: false }
      }
    },
    {
      id: 'prikkar', label: 'Prikkar',
      patch: {
        module: { shape: 'dot', radius: 1, gap: 0.06 },
        eye: { frame: 'circle', pupil: 'circle', sameColor: true },
        fill: { type: 'solid', color: '#2b2d42' },
        bg: { color: '#ffffff', transparent: false }
      }
    },
    {
      id: 'nattbla', label: 'Nattblå',
      patch: {
        module: { shape: 'rounded', radius: 0.5, gap: 0 },
        eye: { frame: 'rounded', pupil: 'rounded', sameColor: false, color: '#d90429' },
        fill: { type: 'solid', color: '#14213d' },
        bg: { color: '#ffffff', transparent: false }
      }
    },
    {
      id: 'skogsgron', label: 'Skogsgrøn',
      patch: {
        module: { shape: 'liquid', radius: 0.8, gap: 0 },
        eye: { frame: 'leaf', pupil: 'circle', sameColor: false, color: '#1b4332' },
        fill: { type: 'solid', color: '#2d6a4f' },
        bg: { color: '#f1faee', transparent: false }
      }
    },
    {
      id: 'solnedgang', label: 'Solnedgang',
      patch: {
        module: { shape: 'dot', radius: 1, gap: 0.04 },
        eye: { frame: 'circle', pupil: 'circle', sameColor: true },
        fill: { type: 'linear', color: '#d90429', color2: '#f77f00', angle: 45, target: 'all' },
        bg: { color: '#ffffff', transparent: false }
      }
    },
    {
      id: 'kritt', label: 'Kritt',
      patch: {
        module: { shape: 'rounded', radius: 0.3, gap: 0.04 },
        eye: { frame: 'rounded', pupil: 'rounded', sameColor: true },
        fill: { type: 'solid', color: '#f8f9fa' },
        bg: { color: '#22333b', transparent: false }
      }
    },
    {
      id: 'skann-meg', label: 'Skann meg',
      patch: {
        module: { shape: 'rounded', radius: 0.4, gap: 0 },
        eye: { frame: 'rounded', pupil: 'rounded', sameColor: true },
        fill: { type: 'solid', color: '#1a1a1a' },
        bg: { color: '#ffffff', transparent: false },
        frame: { style: 'thick', text: 'SKANN MEG', textPos: 'bottom', color: '#d90429' }
      }
    },
    {
      id: 'snakkeboble', label: 'Snakkeboble',
      patch: {
        module: { shape: 'liquid', radius: 0.9, gap: 0 },
        eye: { frame: 'rounded', pupil: 'rounded', sameColor: true },
        fill: { type: 'solid', color: '#264653' },
        bg: { color: '#ffffff', transparent: false },
        frame: { style: 'speech', text: 'Skann meg!', textPos: 'bottom', color: '#264653' }
      }
    },
    {
      id: 'vyrdepil', label: 'Vyrdepil',
      patch: {
        module: { shape: 'classy', radius: 0.9, gap: 0 },
        eye: { frame: 'cut', pupil: 'rounded', sameColor: false, color: '#d90429' },
        fill: { type: 'solid', color: '#2b2d42' },
        bg: { color: '#ffffff', transparent: false },
        frame: { style: 'label', text: 'VYRDEPIL', textPos: 'bottom', color: '#2b2d42' }
      }
    }
  ];

  /* Ein mal set berre det han faktisk har ei meining om. Fargeval på
     logoen og storleiken hans er brukaren sine, ikkje malen sine. */
  function applyPreset(design, preset) {
    const out = clone(design);
    Object.keys(preset.patch).forEach((key) => {
      Object.keys(preset.patch[key]).forEach((k2) => {
        out[key][k2] = preset.patch[key][k2];
      });
    });
    return out;
  }

  function presetById(id) {
    for (let i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].id === id) return PRESETS[i];
    }
    return null;
  }

  /* ──────────────── Grenser vi held oss innanfor ──────────────── */

  /* Logo-grensene er målte, ikkje gjetta. Med utsparing, plate og
     feilretting H las lesaren koden på 15, 20 og 25 %, og ikkje på 30 og
     35 % — i nokon av dei tre storleikane vi prøver. Vakta står difor
     mellom: 25 % er siste målte suksess, 28 % er der vi seier frå tydeleg.
     Skyvaren går likevel til 35 %, fordi det er brukaren sitt val — men
     han skal ikkje kunne ta det utan å bli fortalt kva som skjer. */
  const LIMITS = {
    gapMax: 0.12,        // over dette byrjar skannarar å miste modulane
    logoWarn: 0.25,
    logoDanger: 0.28,
    logoMax: 0.35,
    quietMin: 4,
    contrastMin: 4
  };

  return { defaults, clone, normalise, PRESETS, applyPreset, presetById, LIMITS };
})();
