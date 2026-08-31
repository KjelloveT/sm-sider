/* ══════════════════════════════════════════════
   ROPET3D.JS — leirplassen, og figuren som går rundt i han

   Teiknar Bokstavropet i 3D: ei lita øy med telt, bål og tre, og ein
   figur eleven styrer.

   ── SKJELETTET HAR SJU LEDD ──

   Det er heile grunnen til at dette går utan eit bibliotek. Figuren frå
   Kenney har root, to bein, ein torso, to armar og eit hovud. Sju
   leddmatriser per bilete er ei løkke på sju; shaderen slår opp fire av
   dei per hjørne og blandar. three.js gjer det same, og gjer det betre,
   men det er 600 kB på ei skule-iPad for ei løkke på sju.

   ── HER KØYRER DET EI LØKKE ──

   Til skilnad frå skogen. Ein figur som går må teiknast om att seksti
   gonger i sekundet, og då er requestAnimationFrame rett verktøy. Løkka
   stoppar når fana blir gøymd, og når spelet blir rive.

   ── KAMERAET SNUR SEG IKKJE ──

   Det står fast bak leiren og følgjer figuren. Ein seksåring som skal
   finne eit telt skal ikkje samtidig halde styr på kva veg han ser: opp
   er bort frå deg, ned er mot deg, kvar gong.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const ROT = 'ropet/';

  let bib = null;      // leir.json
  let bin = null;      // DataView over leir.bin
  let lastar = null;

  /* ──────────────── Lasting ──────────────── */

  function stott() {
    if (!root.WebGLRenderingContext) return false;
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  function last() {
    if (lastar) return lastar;
    lastar = Promise.all([
      fetch(ROT + 'leir.json').then(function (r) {
        if (!r.ok) throw new Error('leir.json: ' + r.status);
        return r.json();
      }),
      fetch(ROT + 'leir.bin').then(function (r) {
        if (!r.ok) throw new Error('leir.bin: ' + r.status);
        return r.arrayBuffer();
      })
    ]).then(function (svar) {
      bib = svar[0];
      bin = new DataView(svar[1]);
      return bib;
    });
    return lastar;
  }

  /* ──────────────── Matriser ──────────────── */

  function ident() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function gonge(a, b) {
    const ut = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        ut[i * 4 + j] = s;
      }
    }
    return ut;
  }

  function perspektiv(fov, sideforhold, naer, fjern) {
    const f = 1 / Math.tan(fov / 2);
    const ut = new Float32Array(16);
    ut[0] = f / sideforhold; ut[5] = f;
    ut[10] = (fjern + naer) / (naer - fjern); ut[11] = -1;
    ut[14] = 2 * fjern * naer / (naer - fjern);
    return ut;
  }

  function sePaa(oye, maal, opp) {
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function kryss(a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }
    function norm(v) {
      const l = Math.hypot(v[0], v[1], v[2]) || 1e-9;
      return [v[0] / l, v[1] / l, v[2] / l];
    }
    function prikk(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    const z = norm(sub(oye, maal));
    const x = norm(kryss(opp, z));
    const y = kryss(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -prikk(x, oye), -prikk(y, oye), -prikk(z, oye), 1
    ]);
  }

  /** Flytt, snu om y-aksen, og skalér — i den rekkjefølgja. */
  function plassering(x, y, z, vinkel, skala) {
    const c = Math.cos(vinkel) * skala, s = Math.sin(vinkel) * skala;
    return new Float32Array([
      c, 0, -s, 0,
      0, skala, 0, 0,
      s, 0, c, 0,
      x, y, z, 1
    ]);
  }

  function fraTRS(t, r, s) {
    const x = r[0], y = r[1], z = r[2], w = r[3];
    const m = [
      (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
      (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
      (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
      t[0], t[1], t[2], 1
    ];
    return new Float32Array(m);
  }

  /* Kortaste veg mellom to kvaternionar. Utan teiknsjekken går armen
     den lange vegen rundt når to nøklar ligg på kvar si side av null. */
  function slerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let bb = b;
    if (d < 0) { bb = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
    if (d > 0.9995) {
      const ut = [
        a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t,
        a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t
      ];
      const l = Math.hypot(ut[0], ut[1], ut[2], ut[3]) || 1;
      return [ut[0] / l, ut[1] / l, ut[2] / l, ut[3] / l];
    }
    const v = Math.acos(d), sv = Math.sin(v);
    const k0 = Math.sin((1 - t) * v) / sv, k1 = Math.sin(t * v) / sv;
    return [a[0] * k0 + bb[0] * k1, a[1] * k0 + bb[1] * k1,
            a[2] * k0 + bb[2] * k1, a[3] * k0 + bb[3] * k1];
  }

  /* ──────────────── Geometri ut av fila ──────────────── */

  /** Statisk modell, plassert i verda. Bakar inn plasseringa. */
  function leggStatisk(namn, ut, x, y, z, vinkel, skala) {
    const mod = bib.modellar[namn];
    if (!mod) return;
    const s = 1 / bib.skala;
    const c = Math.cos(vinkel), si = Math.sin(vinkel);
    for (let i = 0; i < mod.tal; i++) {
      const o = (mod.start + i) * bib.stegStatisk;
      const px = bin.getInt16(o, true) * s;
      const py = bin.getInt16(o + 2, true) * s;
      const pz = bin.getInt16(o + 4, true) * s;
      const nx = bin.getInt8(o + 6) / 127;
      const ny = bin.getInt8(o + 7) / 127;
      const nz = bin.getInt8(o + 8) / 127;
      ut.pos.push((px * c - pz * si) * skala + x, py * skala + y, (px * si + pz * c) * skala + z);
      ut.nor.push(nx * c - nz * si, ny, nx * si + nz * c);
      ut.far.push(bin.getUint8(o + 9) / 255, bin.getUint8(o + 10) / 255, bin.getUint8(o + 11) / 255);
    }
  }

  /** Figuren. Kjem i sitt eige buffer, for han blir bøygd i shaderen. */
  function figurBuffer() {
    const f = bib.figur;
    const s = 1 / bib.skala;
    const pos = [], nor = [], far = [], ledd = [], vekt = [];
    for (let i = 0; i < f.tal; i++) {
      const o = bib.figurStart + i * bib.stegFigur;
      pos.push(bin.getInt16(o, true) * s, bin.getInt16(o + 2, true) * s,
               bin.getInt16(o + 4, true) * s);
      nor.push(bin.getInt8(o + 6) / 127, bin.getInt8(o + 7) / 127, bin.getInt8(o + 8) / 127);
      far.push(bin.getUint8(o + 9) / 255, bin.getUint8(o + 10) / 255, bin.getUint8(o + 11) / 255);
      ledd.push(bin.getUint8(o + 12), bin.getUint8(o + 13),
                bin.getUint8(o + 14), bin.getUint8(o + 15));
      vekt.push(bin.getUint8(o + 16) / 255, bin.getUint8(o + 17) / 255,
                bin.getUint8(o + 18) / 255, bin.getUint8(o + 19) / 255);
    }
    return { pos: pos, nor: nor, far: far, ledd: ledd, vekt: vekt, tal: f.tal };
  }

  /* ──────────────── Skjelettet ──────────────── */

  /* Ein leddmatrise per bilete: der leddet står no, gonga med matrisa
     som tek eit hjørne frå kvilepositur og inn i leddet sitt eige rom.
     Det siste er «inverse bind matrix», og han er rekna ut ein gong av
     Blender — vi berre les han. */
  function leddmatriser(klippNamn, tid, ut) {
    const f = bib.figur;
    const klipp = f.klipp[klippNamn];
    const lokale = f.ledd.map(function (l) { return { t: l.t, r: l.r, s: l.s }; });

    if (klipp) {
      const t = klipp.lengd > 0 ? (tid % klipp.lengd) : 0;
      klipp.spor.forEach(function (sp) {
        const tider = sp.tid;
        let i = 0;
        while (i < tider.length - 2 && tider[i + 1] < t) i++;
        const t0 = tider[i], t1 = tider[Math.min(i + 1, tider.length - 1)];
        const u = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 0;
        const a = sp.verdi[i], b = sp.verdi[Math.min(i + 1, sp.verdi.length - 1)];
        const l = lokale[sp.ledd];
        if (sp.kva === 'rotation') {
          l.r = slerp(a, b, u);
        } else if (sp.kva === 'translation') {
          l.t = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        } else if (sp.kva === 'scale') {
          l.s = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        }
      });
    }

    /* Foreldre kjem alltid før barna i lista, så éin gjennomgang held. */
    const globale = [];
    f.ledd.forEach(function (l, i) {
      const eiga = fraTRS(lokale[i].t, lokale[i].r, lokale[i].s);
      globale[i] = l.forelder >= 0 ? gonge(globale[l.forelder], eiga) : eiga;
    });
    f.ledd.forEach(function (l, i) {
      const m = gonge(globale[i], new Float32Array(l.bind));
      ut.set(m, i * 16);
    });
    return ut;
  }

  /* ──────────────── Shaderar ──────────────── */

  const VS = [
    'attribute vec3 aPos;', 'attribute vec3 aNor;', 'attribute vec3 aFar;',
    'uniform mat4 uMvp;',
    'varying vec3 vNor;', 'varying vec3 vFar;',
    'void main() {',
    '  vNor = aNor; vFar = aFar;',
    '  gl_Position = uMvp * vec4(aPos, 1.0);',
    '}'
  ].join('\n');

  /* Same lyssetjinga som i skogen: eit hovudlys, eit svakt fyllys og
     eit grunnlys. Eitt einaste retningslys gjer undersida av alt heilt
     svart, og då ser ein leirplass ut som ein haug med hòl. */
  const FS = [
    'precision mediump float;',
    'varying vec3 vNor;', 'varying vec3 vFar;',
    'void main() {',
    '  vec3 n = normalize(vNor);',
    '  float hovud = max(dot(n, normalize(vec3(-0.42, 0.86, 0.30))), 0.0);',
    '  float fyll  = max(dot(n, normalize(vec3(0.55, 0.25, -0.60))), 0.0);',
    '  gl_FragColor = vec4(vFar * (0.52 + 0.42 * hovud + 0.14 * fyll), 1.0);',
    '}'
  ].join('\n');

  /* Fire ledd per hjørne er glTF sin standard, og meir enn denne figuren
     brukar: eit kne heng i to. Vi reknar alle fire uansett — ei greining
     per hjørne kostar meir enn ei gonging som gjev null. */
  const FIGUR_VS = [
    'attribute vec3 aPos;', 'attribute vec3 aNor;', 'attribute vec3 aFar;',
    'attribute vec4 aLedd;', 'attribute vec4 aVekt;',
    'uniform mat4 uMvp;', 'uniform mat4 uModell;', 'uniform mat4 uLedd[7];',
    'varying vec3 vNor;', 'varying vec3 vFar;',
    'void main() {',
    '  mat4 hud = uLedd[int(aLedd.x)] * aVekt.x',
    '           + uLedd[int(aLedd.y)] * aVekt.y',
    '           + uLedd[int(aLedd.z)] * aVekt.z',
    '           + uLedd[int(aLedd.w)] * aVekt.w;',
    '  vec4 p = uModell * hud * vec4(aPos, 1.0);',
    '  vNor = mat3(uModell) * (mat3(hud) * aNor);',
    '  vFar = aFar;',
    '  gl_Position = uMvp * p;',
    '}'
  ].join('\n');

  function lagShader(gl, type, kjelde) {
    const s = gl.createShader(type);
    gl.shaderSource(s, kjelde);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('shader: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function lagProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, lagShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, lagShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('program: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  /* ──────────────── Leirplassen ──────────────── */

  const OY_R = 5.6;
  const SIDER = 40;

  function omkrins(v) {
    const bulk = 1 + 0.07 * Math.sin(v * 3 + 0.5) + 0.045 * Math.sin(v * 5 - 1.4);
    return { x: Math.cos(v) * OY_R * bulk, z: Math.sin(v) * OY_R * bulk };
  }

  function trekant(ut, a, b, c, farge) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1e-9;
    [a, b, c].forEach(function (p) {
      ut.pos.push(p[0], p[1], p[2]);
      ut.nor.push(nx / nl, ny / nl, nz / nl);
      ut.far.push(farge[0], farge[1], farge[2]);
    });
  }

  function oy(ut) {
    const gras = [0.17, 0.85, 0.72];
    const jord = [0.89, 0.51, 0.34];
    const djup = [0.71, 0.41, 0.27];
    const ringar = [
      { y: 0, k: 1.00, farge: jord },
      { y: -0.36, k: 0.96, farge: jord },
      { y: -1.20, k: 0.66, farge: djup }
    ];
    for (let i = 0; i < SIDER; i++) {
      const a0 = omkrins(i / SIDER * Math.PI * 2);
      const a1 = omkrins((i + 1) / SIDER * Math.PI * 2);
      trekant(ut, [0, 0, 0], [a1.x, 0, a1.z], [a0.x, 0, a0.z], gras);
      for (let r = 0; r < ringar.length - 1; r++) {
        const o = ringar[r], n = ringar[r + 1];
        trekant(ut, [a0.x * o.k, o.y, a0.z * o.k], [a0.x * n.k, n.y, a0.z * n.k],
                [a1.x * n.k, n.y, a1.z * n.k], o.farge);
        trekant(ut, [a0.x * o.k, o.y, a0.z * o.k], [a1.x * n.k, n.y, a1.z * n.k],
                [a1.x * o.k, o.y, a1.z * o.k], o.farge);
      }
      const s = ringar[ringar.length - 1];
      trekant(ut, [a0.x * s.k, s.y, a0.z * s.k], [0, s.y - 0.7, 0],
              [a1.x * s.k, s.y, a1.z * s.k], djup);
    }
  }

  /* ── TELTA STÅR I EIN RING RUNDT BÅLET ──

     Ikkje i ein boge framfor eleven: ein ring gjer at ingen telt er
     «det første», og at avstanden frå bålet til kvart av dei er den
     same. Med to telt blir ringen ein boge av seg sjølv.

     Ringen veks med talet telt, så to som står ved sida av kvarandre
     alltid har same avstand. To telt som står tett er to telt eleven kan
     komme borti på ein gong, og då er valet hans ikkje eit val.

     Og dei vender inn mot bålet. Ein leirplass der telta snur ryggen
     til elden er ikkje ein leirplass. */
  const BAAL = { x: 0, z: 1.5 };
  const TELT_AVSTAND = 1.85;     // minste avstand mellom to teltmidtar

  function teltplassar(tal) {
    const ut = [];
    /* Radius slik at nabotelt får minst TELT_AVSTAND mellom seg, men
       aldri så stor at telta hamnar utanfor øya. */
    const spenn = Math.min(Math.PI * 1.45, 0.62 * tal + 0.5);
    const bogeSteg = tal > 1 ? spenn / (tal - 1) : 0;
    const r = Math.max(2.9, Math.min(OY_R * 0.62,
      bogeSteg > 0 ? TELT_AVSTAND / (2 * Math.sin(bogeSteg / 2)) : 2.9));

    for (let i = 0; i < tal; i++) {
      const v = -Math.PI / 2 + (tal === 1 ? 0 : (i / (tal - 1) - 0.5) * spenn);
      const x = BAAL.x + Math.cos(v) * r;
      const z = BAAL.z + Math.sin(v) * r;
      /* SNU OPNINGA MOT BÅLET.

         Målt og ikkje gjetta: teiknar ein det same teltet ved 0, 90, 180
         og 270 grader og ser rett på dei, er det 180 som vender opninga
         mot kameraet. Kameraet står på +z, så opninga ligg på -z i
         modellen når vinkelen er null.

         leggStatisk roterer slik at eit punkt (0, -1) hamnar på
         (sin v, -cos v). Skal det peike i retning (dx, dz), må
         sin v = dx og cos v = -dz — altså atan2(dx, -dz).

         Dei to første utgåvene la på ein halv og ein kvart omdreiing på
         atan2(dx, dz). Det er ei SPEGLING og ikkje ei dreiing: han
         traff for telt rett nord for bålet og bomma meir og meir dess
         lenger ut til sida dei stod. */
      ut.push({ x: x, z: z, vinkel: Math.atan2(BAAL.x - x, -(BAAL.z - z)) });
    }
    return ut;
  }

  /* Alt som ikkje er telt: bål, kubbar, tre langs kanten, litt gras.
     Faste plassar frå eit frø, så leiren ser lik ut kvar gong.

     Dei store tinga blir samtidig lagde i ei liste over HINDRINGAR med
     ein radius kvar. Ein figur som glir tvers gjennom eit tre gjer
     leiren til ein kulisse; ein som må gå rundt gjer han til ein stad.
     Graset og blomane står ikkje i lista — å bli stoppa av ei grastust
     er verre enn å gå gjennom henne. */
  function pynt(ut) {
    let fro = 90210;
    function neste() {
      fro = (fro * 1103515245 + 12345) & 0x7fffffff;
      return fro / 0x7fffffff;
    }
    ut.hindringar = ut.hindringar || [];
    function stopp(x, z, r) { ut.hindringar.push({ x: x, z: z, r: r }); }

    /* MIDTEN ER BERRE BÅLET. Alt anna som stod inne mellom telta var
       noko eleven måtte gå rundt for å komme fram, og vegen til teltet
       er ikkje der oppgåva ligg. Kubbane er flytta ut utanfor teltringen
       — dei ser framleis ut som ein leirplass, men dei står ikkje i
       vegen for nokon. */
    leggStatisk('campfire_stones', ut, BAAL.x, 0, BAAL.z, 0, 1.0);
    leggStatisk('campfire_logs', ut, BAAL.x, 0.02, BAAL.z, 0.6, 1.0);
    stopp(BAAL.x, BAAL.z, 0.52);

    const utanfor = [
      { namn: 'log', v: 2.35, r: 4.5, vri: 0.4 },
      { namn: 'log_stack', v: 0.75, r: 4.6, vri: -0.3 },
      { namn: 'log', v: -2.1, r: 4.4, vri: 1.1 }
    ];
    utanfor.forEach(function (k) {
      const x = BAAL.x + Math.cos(k.v) * k.r;
      const z = BAAL.z + Math.sin(k.v) * k.r;
      leggStatisk(k.namn, ut, x, 0, z, k.vri, 1.0);
      stopp(x, z, 0.42);
    });

    const kant = ['tree_pineDefaultA', 'tree_default', 'tree_small'];
    for (let i = 0; i < 12; i++) {
      const v = (i / 12) * Math.PI * 2 + 0.2;
      const k = omkrins(v);
      const r = 0.86 + neste() * 0.08;
      const sk = 0.5 + neste() * 0.25;
      leggStatisk(kant[i % kant.length], ut, k.x * r, 0, k.z * r,
                  neste() * Math.PI * 2, sk);
      /* Stammen, ikkje krona: eit tre skal stoppe deg der han står i
         bakken, ikkje ein halv meter før. */
      stopp(k.x * r, k.z * r, 0.30 * sk + 0.18);
    }
    /* Gras og blomar berre UTANFOR teltringen. Inne på plassen skal det
       vere fri veg til kvart telt; ein blome ein må gå rundt er ein
       blome for mykje. Steinar er heilt ute — dei var det einaste her som
       stoppa nokon. */
    const smaatt = ['plant_bush', 'grass', 'grass_large', 'flower_redA',
                    'flower_yellowA', 'mushroom_red'];
    for (let i = 0; i < 22; i++) {
      const v = neste() * Math.PI * 2;
      const k = omkrins(v);
      const r = 0.62 + neste() * 0.22;
      const x = k.x * r, z = k.z * r;
      if (Math.hypot(x - BAAL.x, z - BAAL.z) < 4.0) continue;   // ikkje inne på plassen
      leggStatisk(smaatt[Math.floor(neste() * smaatt.length) % smaatt.length],
                  ut, x, 0, z, neste() * Math.PI * 2, 0.6 + neste() * 0.5);
    }
  }

  root.RopetVerd = {
    stott: stott, last: last,
    ident: ident, gonge: gonge, perspektiv: perspektiv, sePaa: sePaa,
    plassering: plassering, leddmatriser: leddmatriser,
    leggStatisk: leggStatisk, figurBuffer: figurBuffer,
    oy: oy, pynt: pynt, teltplassar: teltplassar, omkrins: omkrins,
    BAAL: BAAL, TELT_AVSTAND: TELT_AVSTAND,
    lagProgram: lagProgram, VS: VS, FS: FS, FIGUR_VS: FIGUR_VS,
    OY_R: OY_R,
    bib: function () { return bib; }
  };
})(window);
