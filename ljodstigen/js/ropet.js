/* ══════════════════════════════════════════════
   ROPET.JS — Bokstavropet på leirplassen

   Same oppgåva som skjermutgåva: eleven ser ein bokstav og skal finne
   lyden hans. Skilnaden er at lydane bur i telt, og at han må gå bort
   til dei for å høyre dei.

   DET ER IKKJE BERRE PYNT. I skjermutgåva ligg alle alternativa framme
   samtidig, og eleven kan klikke seg gjennom dei på eit sekund. Her må
   han gå, og det tek tid — tid der bokstaven står midt på skjermen og
   han må halde lyden i hovudet medan han går til neste telt. Det er
   arbeidsminne, og det er nettopp det som skil å kjenne att ein lyd frå
   å hente han fram.

   Vi måler framleis KVA han kan og ikkje kor snøgt han gjekk: svaret går
   inn i motoren med responstid rekna frå han kom fram til teltet, ikkje
   frå oppgåva starta.

   STYRING: piltastar eller WASD, mellomrom for å velje. På nettbrett ein
   styrespak nede til venstre og ein knapp til høgre. Begge er der heile
   tida — ein elev med tastatur skal ikkje måtte leite etter spaken, og
   ein utan skal ikkje møte ei tom rute.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const FART = 3.4;            // einingar i sekundet
  const NAER = 1.5;            // kor nær eit telt ein må vere
  const FIGUR_SKALA = 1.15;
  const FIGUR_R = 0.28;        // kor brei figuren er, til kollisjon
  const START = { x: 0, z: 3.4 };
  const FLYGETID = 1.0;        // sekund frå telt til startpunkt

  function $(id) { return document.getElementById(id); }

  /* ──────────────── Styring ──────────────── */

  /* Ein retningsvektor og ein knapp. Tastatur, styrespak og knapp skriv
     alle til det same, så resten av spelet slepp å vite kva eleven har. */
  function lagStyring(spak, knapp) {
    const s = { x: 0, z: 0, vald: false, tastar: {} };

    root.addEventListener('keydown', function (e) {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'enter') { s.vald = true; e.preventDefault(); return; }
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].indexOf(k) !== -1) {
        s.tastar[k] = true;
        e.preventDefault();
      }
    });
    root.addEventListener('keyup', function (e) { s.tastar[e.key.toLowerCase()] = false; });

    /* Styrespaken: eit felt du legg fingeren i, og ein knott som følgjer
       han. Utslaget er retninga, avstanden er farten — opp til ein
       radius, så eit langt drag ikkje blir raskare enn eit kort. */
    let peikar = null;
    const knott = spak.querySelector('.ropet-knott');
    const R = 46;

    function sett(e) {
      const r = spak.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = dx / l * R; dy = dy / l * R; }
      knott.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      s.spakX = dx / R;
      s.spakZ = dy / R;
    }
    function slepp() {
      peikar = null;
      knott.style.transform = '';
      s.spakX = 0; s.spakZ = 0;
    }
    spak.addEventListener('pointerdown', function (e) {
      peikar = e.pointerId;
      try { spak.setPointerCapture(e.pointerId); } catch (f) { /* går fint utan */ }
      sett(e); e.preventDefault();
    });
    spak.addEventListener('pointermove', function (e) {
      if (peikar === e.pointerId) sett(e);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) {
      spak.addEventListener(n, function (e) { if (peikar === e.pointerId) slepp(); });
    });

    knapp.addEventListener('click', function () { s.vald = true; });

    s.les = function () {
      let x = s.spakX || 0, z = s.spakZ || 0;
      if (s.tastar.arrowleft || s.tastar.a) x -= 1;
      if (s.tastar.arrowright || s.tastar.d) x += 1;
      if (s.tastar.arrowup || s.tastar.w) z -= 1;
      if (s.tastar.arrowdown || s.tastar.s) z += 1;
      const l = Math.hypot(x, z);
      if (l > 1) { x /= l; z /= l; }
      return { x: x, z: z, fart: Math.min(1, l) };
    };
    return s;
  }

  /* ──────────────── Spelet ──────────────── */

  function start(vert, profil, kroken) {
    const V = root.RopetVerd;
    const canvas = vert.querySelector('canvas');
    const gl = canvas.getContext('webgl', { antialias: true, alpha: true })
      || canvas.getContext('experimental-webgl', { antialias: true, alpha: true });
    if (!gl) throw new Error('ingen webgl-kontekst');

    const prog = V.lagProgram(gl, V.VS, V.FS);
    const figurProg = V.lagProgram(gl, V.FIGUR_VS, V.FS);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    const st = {
      pos: gl.getAttribLocation(prog, 'aPos'),
      nor: gl.getAttribLocation(prog, 'aNor'),
      far: gl.getAttribLocation(prog, 'aFar'),
      mvp: gl.getUniformLocation(prog, 'uMvp')
    };
    const fst = {
      pos: gl.getAttribLocation(figurProg, 'aPos'),
      nor: gl.getAttribLocation(figurProg, 'aNor'),
      far: gl.getAttribLocation(figurProg, 'aFar'),
      ledd: gl.getAttribLocation(figurProg, 'aLedd'),
      vekt: gl.getAttribLocation(figurProg, 'aVekt'),
      mvp: gl.getUniformLocation(figurProg, 'uMvp'),
      modell: gl.getUniformLocation(figurProg, 'uModell'),
      leddM: gl.getUniformLocation(figurProg, 'uLedd')
    };

    function buffer(data, storleik) {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      b.storleik = storleik;
      return b;
    }

    /* ── Verda ── */
    let verd = null, verdBuf = null;
    function byggVerd(telt) {
      const ut = { pos: [], nor: [], far: [], hindringar: [] };
      V.oy(ut);
      V.pynt(ut);
      telt.forEach(function (t) {
        V.leggStatisk(t.modell, ut, t.x, 0, t.z, t.vinkel, 1.25);
        /* Teltet stoppar deg, men mindre enn han ser ut: ein figur som
           blir stoppa ein halv meter framfor teltet ser ut til å ha gått
           inn i ein usynleg vegg. */
        ut.hindringar.push({ x: t.x, z: t.z, r: 0.46 });
      });
      hindringar = ut.hindringar;
      verd = ut;
      verdBuf = {
        pos: buffer(ut.pos, 3), nor: buffer(ut.nor, 3), far: buffer(ut.far, 3),
        tal: ut.pos.length / 3
      };
    }

    const fig = V.figurBuffer();
    const figBuf = {
      pos: buffer(fig.pos, 3), nor: buffer(fig.nor, 3), far: buffer(fig.far, 3),
      ledd: buffer(fig.ledd, 4), vekt: buffer(fig.vekt, 4), tal: fig.tal
    };
    const leddM = new Float32Array(7 * 16);

    /* ── Tilstand ── */
    const spelar = { x: START.x, z: START.z, vinkel: Math.PI, y: 0 };
    let hindringar = [];
    let flyg = null;             // { fraa, tid } medan han er i lufta
    let rekkje = 0;

    /* Skyv figuren ut av alt han står oppi. To rundar, for å komme ut av
       eitt hinder kan skyve han inn i eit anna — det skjer mellom to tre
       som står tett. Fleire rundar er ikkje verdt det: står han fast
       mellom tre ting, står han òg fast i verkelegheita. */
    function losne(p) {
      for (let runde = 0; runde < 2; runde++) {
        let rorte = false;
        for (let i = 0; i < hindringar.length; i++) {
          const h = hindringar[i];
          const dx = p.x - h.x, dz = p.z - h.z;
          const d = Math.hypot(dx, dz);
          const minst = h.r + FIGUR_R;
          if (d < minst && d > 1e-4) {
            p.x = h.x + dx / d * minst;
            p.z = h.z + dz / d * minst;
            rorte = true;
          }
        }
        if (!rorte) break;
      }
    }
    let telt = [];
    let oppgaave = null;
    let naerTelt = -1;
    let laast = false;
    let klipp = 'idle', klippTid = 0, klippLaas = 0;
    let sist = 0, kar = null;

    const styring = lagStyring($('ropet-spak'), $('ropet-knapp'));

    function settKlipp(namn, laasSek) {
      if (klippLaas > 0 && !laasSek) return;
      if (klipp !== namn) { klipp = namn; klippTid = 0; }
      if (laasSek) klippLaas = laasSek;
    }

    /* ── Oppgåve ── */

    function nyOppgaave() {
      const q = LjodAdaptive.pick(profil.adaptive, {});
      if (!q) return;
      oppgaave = { ch: q.ch, options: q.options.slice(), komFram: 0 };
      const plassar = V.teltplassar(q.options.length);
      telt = plassar.map(function (p, i) {
        return {
          x: p.x, z: p.z, vinkel: p.vinkel, ch: q.options[i],
          modell: V.bib().telt[i % V.bib().telt.length],
          hoyrd: false
        };
      });
      byggVerd(telt);
      naerTelt = -1;
      laast = false;
      $('ropet-bokstav').textContent = q.ch;
      $('ropet-melding').textContent = 'Gå til eit telt for å høyre lyden.';
      visFramgang();
      /* Figuren står igjen der han var. Å teleportere han til start
         mellom kvar oppgåve ville rive han ut av staden han er i. */
    }

    /* Kor mange bokstavar som sit, og kor mange som står att. Same tal
       som skogen viser — det er den same motoren, og eleven skal ikkje
       møte to ulike svar på kor langt han er komen. */
    function visFramgang() {
      const st = LjodAdaptive.stats(profil.adaptive);
      const att = st.total - st.mastered;
      $('ropet-tal').textContent = st.mastered + ' / ' + st.total;
      $('ropet-stripe-fyll').style.width =
        (st.total ? (st.mastered / st.total * 100) : 0) + '%';
      $('ropet-framgang').setAttribute('aria-label',
        st.mastered + ' av ' + st.total + ' bokstavar er ferdige. ' +
        att + ' står att.');
      const r = $('ropet-rekkje');
      r.hidden = rekkje < 2;
      r.textContent = rekkje + ' på rad';
    }

    function hoyr(i) {
      const t = telt[i];
      if (!t) return;
      t.hoyrd = true;
      oppgaave.komFram = performance.now();
      LjodAudio.play('f_' + t.ch);
      $('ropet-melding').textContent = 'Er dette lyden til ' + oppgaave.ch.toUpperCase() +
        '? Trykk for å velje.';
    }

    function velg() {
      if (laast || naerTelt < 0 || !oppgaave) return;
      laast = true;
      const t = telt[naerTelt];
      const rett = t.ch === oppgaave.ch;
      const svartid = oppgaave.komFram ? performance.now() - oppgaave.komFram : 4000;

      settKlipp(rett ? 'emote-yes' : 'emote-no', 1.1);
      $('ropet-melding').textContent = rett ? 'Riktig!' : 'Ikkje det teltet.';

      LjodAdaptive.record(profil.adaptive, oppgaave.ch, rett, svartid,
                          rett ? null : t.ch);
      LjodState.saveProfile(profil);
      if (kroken && kroken.etterSvar) kroken.etterSvar(rett);

      if (rett) { rekkje++; } else { rekkje = 0; }
      visFramgang();

      LjodRender.feedback(rett, rett ? [] : ['f_' + oppgaave.ch]).then(function () {
        if (rett) {
          /* HEIM I EIN BOGE. Å teleportere figuren tilbake ville spart
             eit sekund og teke bort det einaste augeblikket i spelet der
             han har klart noko. Ein flygetur er ei markering eleven kan
             sjå, og han set han samtidig på startpunktet, så neste
             oppgåve byrjar likt for alle telt. */
          flyg = { fraaX: spelar.x, fraaZ: spelar.z, tid: 0 };
          settKlipp('sprint', FLYGETID);
        } else {
          settKlipp('idle');
        }
        nyOppgaave();
      });
    }

    /* ── Løkka ── */

    function steg(dt) {
      /* Flygeturen eig figuren medan han varer. Ein boge opp og ned med
         ein sinus: han er null i begge endar, så figuren tek av og landar
         på bakken og ikkje i lufta. */
      if (flyg) {
        flyg.tid += dt;
        const u = Math.min(1, flyg.tid / FLYGETID);
        spelar.x = flyg.fraaX + (START.x - flyg.fraaX) * u;
        spelar.z = flyg.fraaZ + (START.z - flyg.fraaZ) * u;
        spelar.y = Math.sin(u * Math.PI) * 1.7;
        /* Han snurrar rundt éin gong på vegen. */
        spelar.vinkel += dt * 7.0;
        if (u >= 1) {
          flyg = null;
          spelar.y = 0;
          spelar.vinkel = Math.PI;
          /* Låsen må opnast FØRST. Ho blir sett når flygeturen startar,
             og tid blir berre trekt frå i den andre greina av steg() —
             som flygeturen hoppar over. Utan dette blei figuren ståande
             og springe på staden etter landing. */
          klippLaas = 0;
          settKlipp('idle');
        }
        return;
      }

      if (!laast) {
        const inn = styring.les();
        const flytt = Math.hypot(inn.x, inn.z) > 0.02;
        if (flytt) {
          spelar.x += inn.x * FART * dt;
          spelar.z += inn.z * FART * dt;
          /* Hald deg på øya. Ein figur som fell utfor kanten er ein
             figur ein seksåring ikkje får tilbake. */
          const r = Math.hypot(spelar.x, spelar.z);
          const kant = V.OY_R * 0.82;
          if (r > kant) { spelar.x = spelar.x / r * kant; spelar.z = spelar.z / r * kant; }
          losne(spelar);
          spelar.vinkel = Math.atan2(inn.x, inn.z);
        }
        settKlipp(flytt ? 'walk' : 'idle');

        let naerast = -1, best = NAER;
        telt.forEach(function (t, i) {
          const d = Math.hypot(spelar.x - t.x, spelar.z - t.z);
          if (d < best) { best = d; naerast = i; }
        });
        if (naerast !== naerTelt) {
          naerTelt = naerast;
          if (naerTelt >= 0) hoyr(naerTelt);
          else $('ropet-melding').textContent = 'Gå til eit telt for å høyre lyden.';
        }
        $('ropet-knapp').disabled = naerTelt < 0;
      }

      if (styring.vald) { styring.vald = false; velg(); }

      klippTid += dt;
      if (klippLaas > 0) {
        klippLaas -= dt;
        if (klippLaas <= 0) settKlipp('idle');
      }
    }

    function teikn() {
      /* Lerretet fyller heile scena i CSS. Her set vi berre bakgrunns-
         bufferen til den storleiken det faktisk har fått — set vi
         høgda i JS òg, kranglar dei to om kven som bestemmer. */
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const b = canvas.clientWidth || root.innerWidth || 640;
      const h = canvas.clientHeight || root.innerHeight || 400;
      const cw = Math.round(b * dpr), chh = Math.round(h * dpr);
      if (canvas.width !== cw || canvas.height !== chh) {
        canvas.width = cw; canvas.height = chh;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      /* Kameraet ligg bak og over figuren og ser mot han, men det snur
         seg aldri: retningane skal bety det same heile tida. */
      /* Kameraet følgjer figuren halvvegs. Følgjer det heilt, står han
         limt midt i biletet og verda glir under han; følgjer det ikkje,
         går han ut av biletet. Halvvegs gjev begge delar. */
      const maal = [spelar.x * 0.55, 0.55, spelar.z * 0.55 + 0.3];
      const oye = [maal[0], maal[1] + 3.3, maal[2] + 4.6];
      const P = V.perspektiv(0.62, b / h, 0.4, 80);
      const mvp = V.gonge(P, V.sePaa(oye, maal, [0, 1, 0]));

      gl.useProgram(prog);
      gl.uniformMatrix4fv(st.mvp, false, mvp);
      [['pos', st.pos], ['nor', st.nor], ['far', st.far]].forEach(function (d) {
        gl.bindBuffer(gl.ARRAY_BUFFER, verdBuf[d[0]]);
        gl.enableVertexAttribArray(d[1]);
        gl.vertexAttribPointer(d[1], 3, gl.FLOAT, false, 0, 0);
      });
      gl.drawArrays(gl.TRIANGLES, 0, verdBuf.tal);
      [st.pos, st.nor, st.far].forEach(function (a) { gl.disableVertexAttribArray(a); });

      V.leddmatriser(klipp, klippTid, leddM);
      gl.useProgram(figurProg);
      gl.uniformMatrix4fv(fst.mvp, false, mvp);
      gl.uniformMatrix4fv(fst.modell, false,
        V.plassering(spelar.x, spelar.y, spelar.z, spelar.vinkel, FIGUR_SKALA));
      gl.uniformMatrix4fv(fst.leddM, false, leddM);
      [['pos', fst.pos, 3], ['nor', fst.nor, 3], ['far', fst.far, 3],
       ['ledd', fst.ledd, 4], ['vekt', fst.vekt, 4]].forEach(function (d) {
        gl.bindBuffer(gl.ARRAY_BUFFER, figBuf[d[0]]);
        gl.enableVertexAttribArray(d[1]);
        gl.vertexAttribPointer(d[1], d[2], gl.FLOAT, false, 0, 0);
      });
      gl.drawArrays(gl.TRIANGLES, 0, figBuf.tal);
      [fst.pos, fst.nor, fst.far, fst.ledd, fst.vekt].forEach(function (a) {
        gl.disableVertexAttribArray(a);
      });
    }

    let leverandor = null;
    function ramme(no) {
      leverandor = root.requestAnimationFrame(ramme);
      const dt = Math.min(0.05, (no - sist) / 1000 || 0);
      sist = no;
      steg(dt);
      teikn();
    }

    nyOppgaave();
    sist = performance.now();
    leverandor = root.requestAnimationFrame(ramme);

    return {
      /* Innmaten, så spelet kan prøvast utan ein skjerm: flytt figuren,
         sjå kva telt han står ved, vel, og sjå kva motoren fekk. */
      steg: steg,
      teikn: teikn,
      tilstand: function () {
        return {
          spelar: spelar, telt: telt, oppgaave: oppgaave,
          naerTelt: naerTelt, laast: laast, klipp: klipp
        };
      },
      flyttTil: function (x, z) { spelar.x = x; spelar.z = z; },
      hindringar: function () { return hindringar; },
      rekkje: function () { return rekkje; },
      velg: velg,
      riv: function () {
        if (leverandor) root.cancelAnimationFrame(leverandor);
        const u = gl.getExtension('WEBGL_lose_context');
        if (u) u.loseContext();
      }
    };
  }

  root.LjodRopet3D = { start: start };
})(window);
