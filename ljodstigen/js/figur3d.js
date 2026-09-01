/* ══════════════════════════════════════════════
   FIGUR3D.JS — figuren, skjelettet hans, og matrisene alle treng

   Delt av leirplassen og skogen. Begge har ein figur eleven styrer, og
   utan denne fila ville dei hatt kvar sin kopi av det same skjelettet,
   den same shaderen og dei same seksti linjene matrisemattematikk. To
   kopiar av noko som må vere likt er ein kopi for mykje.

   ── SJU LEDD ──

   Kenney-figuren har root, to bein, ein torso, to armar og eit hovud.
   Sju leddmatriser per bilete er ei løkke på sju; shaderen slår opp fire
   av dei per hjørne og blandar. three.js gjer det same og gjer det
   betre, men det er 600 kB på ei skule-iPad for ei løkke på sju.

   Geometrien og klippa blir bygde av bygg_ljodstigen_ropet.py.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const ROT = 'figur/';

  let bib = null;      // figur.json
  let bin = null;      // DataView over figur.bin
  let lastar = null;

  /* ──────────────── Lasting ──────────────── */

  function last() {
    if (lastar) return lastar;
    lastar = Promise.all([
      fetch(ROT + 'figur.json').then(function (r) {
        if (!r.ok) throw new Error('figur.json: ' + r.status);
        return r.json();
      }),
      fetch(ROT + 'figur.bin').then(function (r) {
        if (!r.ok) throw new Error('figur.bin: ' + r.status);
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
    return new Float32Array([
      (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
      (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
      (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
      t[0], t[1], t[2], 1
    ]);
  }

  /* Kortaste veg mellom to kvaternionar. Utan teiknsjekken går armen den
     lange vegen rundt når to nøklar ligg på kvar si side av null. */
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

  /* ── KORTASTE VEG MELLOM TO VINKLAR ──

     Det er denne som gjer at kameraet ikkje hoppar. Går figuren frå 179
     til -179 grader, er det to grader unna og ikkje 358 — men eit rått
     mellomsteg mellom dei to tala sveipar heile vegen rundt.

     mjuk() dreg ein verdi mot eit mål med ein fast del av det som står
     att per sekund. Resultatet er uavhengig av bildefrekvensen: ei rask
     maskin og ei treg kjem fram like fort. */
  function vinkelDiff(fraa, til) {
    let d = (til - fraa) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function mjukVinkel(naa, maal, fart, dt) {
    return naa + vinkelDiff(naa, maal) * (1 - Math.exp(-fart * dt));
  }

  function mjuk(naa, maal, fart, dt) {
    return naa + (maal - naa) * (1 - Math.exp(-fart * dt));
  }

  /* ── EI FJØR I STADEN FOR EI UTGLATTING ──

     mjukVinkel() tek av med full fart i det målet flyttar seg: farten er
     størst i første biletet og avtek derifrå. Det ser rykkete ut nettopp
     når rørsla er størst — kameraet slår ut, og bremsar.

     Ei kritisk dempa fjør har farten som sin eigen storleik. Ho må byggje
     han opp før ho kan bruke han, så starten blir mjuk òg, og ho kjem
     fram utan å svinge forbi og tilbake. «Kritisk dempa» er nettopp det:
     dempinga er sett til 2·√stivleik, som er grensa der ho sluttar å
     svinge.

     Tilstanden er eit fartstal som kallaren må ta vare på mellom bileta —
     difor tek funksjonen eit objekt og ikkje eit tal. */
  function fjaerVinkel(s, maal, stivleik, dt) {
    const d = vinkelDiff(s.verdi, maal);
    const demping = 2 * Math.sqrt(stivleik);
    s.fart += (stivleik * d - demping * s.fart) * dt;
    s.verdi += s.fart * dt;
    return s.verdi;
  }

  /* ──────────────── Geometrien ──────────────── */

  /** Hjørna til figuren, klare til fem buffer. */
  function buffer() {
    const s = 1 / bib.skala;
    const pos = [], nor = [], far = [], ledd = [], vekt = [];
    for (let i = 0; i < bib.tal; i++) {
      const o = i * bib.steg;
      pos.push(bin.getInt16(o, true) * s, bin.getInt16(o + 2, true) * s,
               bin.getInt16(o + 4, true) * s);
      nor.push(bin.getInt8(o + 6) / 127, bin.getInt8(o + 7) / 127, bin.getInt8(o + 8) / 127);
      far.push(bin.getUint8(o + 9) / 255, bin.getUint8(o + 10) / 255, bin.getUint8(o + 11) / 255);
      ledd.push(bin.getUint8(o + 12), bin.getUint8(o + 13),
                bin.getUint8(o + 14), bin.getUint8(o + 15));
      vekt.push(bin.getUint8(o + 16) / 255, bin.getUint8(o + 17) / 255,
                bin.getUint8(o + 18) / 255, bin.getUint8(o + 19) / 255);
    }
    return { pos: pos, nor: nor, far: far, ledd: ledd, vekt: vekt, tal: bib.tal };
  }

  /** Kor høg figuren er i kvilepositur, til å skalere han mot verda. */
  function hogd() {
    const s = 1 / bib.skala;
    let lav = Infinity, hoy = -Infinity;
    for (let i = 0; i < bib.tal; i++) {
      const y = bin.getInt16(i * bib.steg + 2, true) * s;
      if (y < lav) lav = y;
      if (y > hoy) hoy = y;
    }
    return hoy - lav;
  }

  /* Ein leddmatrise per bilete: der leddet står no, gonga med matrisa som
     tek eit hjørne frå kvilepositur og inn i leddet sitt eige rom. Det
     siste er «inverse bind matrix», rekna ut ein gong av Blender. */
  function leddmatriser(klippNamn, tid, ut) {
    const klipp = bib.klipp[klippNamn];
    const lokale = bib.ledd.map(function (l) { return { t: l.t, r: l.r, s: l.s }; });

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
    bib.ledd.forEach(function (l, i) {
      const eiga = fraTRS(lokale[i].t, lokale[i].r, lokale[i].s);
      globale[i] = l.forelder >= 0 ? gonge(globale[l.forelder], eiga) : eiga;
    });
    bib.ledd.forEach(function (l, i) {
      ut.set(gonge(globale[i], new Float32Array(l.bind)), i * 16);
    });
    return ut;
  }

  /* ──────────────── Shader ──────────────── */

  /* Fire ledd per hjørne er glTF sin standard, og meir enn denne figuren
     brukar: eit kne heng i to. Vi reknar alle fire uansett — ei greining
     per hjørne kostar meir enn ei gonging som gjev null. */
  const VS = [
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
  ].join(String.fromCharCode(10));

  /* ── DEN STILLE SHADEREN ──

     Alt som ikkje har eit skjelett — øya, telta, trea, skilta — blir
     teikna med denne. Han ligg her og ikkje i kvart spel fordi begge
     spela treng nøyaktig den same: eit hovudlys, eit svakt fyllys frå
     motsett kant, og eit grunnlys. Eitt einaste retningslys gjer
     undersida av alt heilt svart, og då ser ein leirplass ut som ein
     haug med hòl. */
  const STATISK_VS = [
    'attribute vec3 aPos;', 'attribute vec3 aNor;', 'attribute vec3 aFar;',
    'uniform mat4 uMvp;',
    'varying vec3 vNor;', 'varying vec3 vFar;',
    'void main() {',
    '  vNor = aNor; vFar = aFar;',
    '  gl_Position = uMvp * vec4(aPos, 1.0);',
    '}'
  ].join(String.fromCharCode(10));

  const FS = [
    'precision mediump float;',
    'varying vec3 vNor;', 'varying vec3 vFar;',
    'void main() {',
    '  vec3 n = normalize(vNor);',
    '  float hovud = max(dot(n, normalize(vec3(-0.42, 0.86, 0.30))), 0.0);',
    '  float fyll  = max(dot(n, normalize(vec3(0.55, 0.25, -0.60))), 0.0);',
    '  gl_FragColor = vec4(vFar * (0.52 + 0.42 * hovud + 0.14 * fyll), 1.0);',
    '}'
  ].join(String.fromCharCode(10));

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

  root.Figur3D = {
    last: last, buffer: buffer, hogd: hogd, leddmatriser: leddmatriser,
    ident: ident, gonge: gonge, perspektiv: perspektiv, sePaa: sePaa,
    plassering: plassering, fraTRS: fraTRS, slerp: slerp,
    vinkelDiff: vinkelDiff, mjukVinkel: mjukVinkel, mjuk: mjuk,
    fjaerVinkel: fjaerVinkel,
    lagProgram: lagProgram, lagShader: lagShader,
    VS: VS, STATISK_VS: STATISK_VS, FS: FS,
    LEDD: 7,
    bib: function () { return bib; }
  };
})(window);
