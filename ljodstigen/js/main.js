/* ══════════════════════════════════════════════
   MAIN.JS — Økta

   Ei økt er 12 oppgåver, fem til sju minutt. Ho har ein fast form, og
   to av eigenskapane hennar er meir gjennomtenkte enn dei ser ut:

   1. SISTE OPPGÅVE ER ALLTID EIN SIGER. Vi ber motoren om ei garantert
      oppgåve på slutten. Kva eleven ser sist avgjer om han opnar appen
      i morgon, og ein elev som sluttar på eit nederlag gjer ikkje det.

   2. HAGEN ER DET SISTE BILETET. Ikkje eit resultat, ikkje ein prosent.
      Ein prosent under adaptiv vanskegrad seier uansett ingenting:
      motoren siktar mot same treffrate for alle.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const TASKS_PER_SESSION = 12;

  const MODES = {
    lydfangst: function () { return LjodMode_lydfangst; },
    bokstavropet: function () { return LjodMode_bokstavropet; },
    forstelyd: function () { return LjodMode_forstelyd; },
    ordbyggjar: function () { return LjodMode_ordbyggjar; }
  };

  const R = function () { return LjodRender; };

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function go(url) { location.href = url; }

  /* ──────────────── Oppstart ──────────────── */

  function start() {
    const host = document.getElementById('play');
    if (!host) return;

    const profileId = param('p');
    const modeId = param('m') || 'lydfangst';
    const profile = profileId ? LjodState.getProfile(profileId) : null;
    const mode = MODES[modeId] ? MODES[modeId]() : null;

    if (!profile || !mode) { go('index.html'); return; }

    document.body.dataset.font = LjodState.read().font;

    /* Lasteskjerm. Lyden skal vere ferdig dekoda før første oppgåve —
       ei oppgåve som ventar på nettverket er ei oppgåve eleven trur er
       øydelagd. */
    R().clear(host);
    const loading = R().h('div', 'ljod-loading');
    loading.appendChild(R().h('p', 'ljod-prompt', 'Hentar lydane…'));
    const bar = R().h('div', 'ljod-progress');
    const fill = R().h('div', 'ljod-progress-fill');
    bar.appendChild(fill);
    loading.appendChild(bar);
    host.appendChild(loading);

    LjodAudio.load(function (done, total) {
      fill.style.width = Math.round(100 * done / total) + '%';
    }).then(function (res) {
      runSession(host, profile, mode, res);
    });
  }

  /* ──────────────── Sjølve økta ──────────────── */

  function runSession(host, profile, mode, audioRes) {
    const newStars = LjodState.startSession(profile, mode.id);
    LjodState.saveProfile(profile);

    const frame = R().taskFrame({ prompt: '' });
    R().clear(host);
    host.appendChild(frame.root);

    /* Køyrer vi på plasshaldartonar, skal det stå. Ein lærar som ikkje
       veit det vil tru at appen er øydelagd. */
    if (audioRes && audioRes.missing.length) {
      const note = R().h('p', 'ljod-audio-note',
        'Lyden er ikkje spelt inn enno — du høyrer tonar i staden for bokstavlydar.');
      frame.head.appendChild(note);
    }

    const ctx = { profile: profile, adaptive: profile.adaptive, guarantee: false };
    let n = 0;

    function nextTask() {
      if (n >= TASKS_PER_SESSION) { finish(host, profile, newStars); return; }

      frame.setProgress(n, TASKS_PER_SESSION);
      /* Siste oppgåva skal eleven klare. */
      ctx.guarantee = (n === TASKS_PER_SESSION - 1);

      const p = mode.run(frame, ctx);
      if (!p) { finish(host, profile, newStars); return; }

      p.then(function (res) {
        if (!res) { finish(host, profile, newStars); return; }
        applyResult(profile, res);
        LjodState.saveProfile(profile);
        n++;
        nextTask();
      });
    }

    nextTask();
  }

  /* Eitt svar inn i motoren og i merka. Ordbyggjaren leverer eit svar
     per rute, sidan eleven kan ha to bokstavar rett og éin feil. */
  function applyResult(profile, res) {
    const a = profile.adaptive;
    if (res.letters) {
      res.letters.forEach(function (l) {
        LjodAdaptive.record(a, l.ch, l.correct, res.latencyMs / res.letters.length, l.chosen);
        LjodMerke.noteAnswer(profile, l.ch, l.correct, res.latencyMs / res.letters.length, l.chosen);
      });
    } else {
      LjodAdaptive.record(a, res.ch, res.correct, res.latencyMs, res.chosen);
      LjodMerke.noteAnswer(profile, res.ch, res.correct, res.latencyMs, res.chosen);
    }
  }

  /* ──────────────── Slutten ──────────────── */

  function finish(host, profile, newStars) {
    const wonBadges = LjodMerke.check(profile);
    LjodState.saveProfile(profile);

    R().clear(host);
    const box = R().h('div', 'box2 ljod-done');

    const canvas = R().h('canvas', 'ljod-confetti');
    box.appendChild(canvas);

    box.appendChild(R().h('h2', 'heading2 no-mt', 'Godt jobba!'));

    /* Nye merke og stjerner blir feira. Resten står i hagen. */
    if (wonBadges.length) {
      const list = R().h('div', 'ljod-won');
      wonBadges.forEach(function (b) {
        const cell = R().h('div', 'ljod-badge is-earned');
        cell.appendChild(LjodShapes.badge(44, true));
        cell.appendChild(R().h('span', 'ljod-badge-title', b.title));
        list.appendChild(cell);
      });
      box.appendChild(R().h('p', 'ljod-prompt', wonBadges.length === 1 ? 'Nytt merke!' : 'Nye merke!'));
      box.appendChild(list);
    }

    const stars = R().h('div');
    LjodHage.renderStars(stars, profile);
    box.appendChild(stars);

    /* Hagen er det siste eleven ser. */
    const garden = R().h('div');
    LjodHage.renderGarden(garden, profile);
    box.appendChild(garden);

    const row = R().h('div', 'ljod-btn-row');
    const again = R().h('button', 'btn', 'Ein runde til');
    again.type = 'button';
    again.addEventListener('click', function () { location.reload(); });
    const back = R().h('a', 'btn', 'Tilbake');
    back.href = 'index.html';
    row.appendChild(again);
    row.appendChild(back);
    box.appendChild(row);

    host.appendChild(box);

    R().setMood('cool');
    LjodAudio.play('r_okt');
    requestAnimationFrame(function () { LjodHage.celebrate(canvas); });
  }

  root.LjodMain = { start: start, TASKS_PER_SESSION: TASKS_PER_SESSION, MODES: MODES };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
