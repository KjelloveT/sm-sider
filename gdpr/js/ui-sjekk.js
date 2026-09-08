/* ══════════════════════════════════════════════
   UI-SJEKK.JS — Rapporten

   GRUPPERT ETTER FUNNTYPE, IKKJE ETTER AKTIVITET. «Sikringstiltaka er for vage
   i sju aktivitetar» er éin ting å lære og rette; den same åtvaringa prenta sju
   gonger er støy som får folk til å slutte å lese.

   KVART FUNN HAR TRE DELAR: kva, kvifor og eit betre svar. «Ver meir spesifikk»
   er ikkje undervisning — difor ber kvar regel eit konkret framlegg i `gjer`.

   BRUKAREN KAN AVVISE EIT FUNN MED EIN GRUNN. Nokre av reglane vil ta feil: ei
   verksemd som faktisk har «som skildra i ISO 27001-sertifikat nr. …» har eit
   forsvarleg svar. Ein kontroll ein ikkje kan overprøve, blir gått rundt — og
   grunngjevinga blir ståande i protokollen, som i seg sjølv er god
   ansvarlegheitspraksis etter artikkel 5 nr. 2.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const U = function () { return GD.util; };

  const NIVAA = {
    mangel:    { tittel: 'Mangel',   klasse: 'gd-nivaa-mangel' },
    aatvaring: { tittel: 'Åtvaring', klasse: 'gd-nivaa-aatvaring' },
    merknad:   { tittel: 'Merknad',  klasse: 'gd-nivaa-merknad' }
  };

  function teikn() {
    const u = U();
    const vert = document.getElementById('sjekkrapport');
    if (!vert) return;
    vert.textContent = '';

    if (!GD.innhald.reglar().length) {
      vert.appendChild(u.el('p', 'gd-muted',
        'Sjekkreglane kunne ikkje lastast. Du kan framleis arbeide med protokollen.'));
      return;
    }

    if (!GD.state.aktivitetar().length) {
      vert.appendChild(u.el('p', 'gd-muted',
        'Legg til minst éin behandlingsaktivitet, så kan vi sjå på henne.'));
      return;
    }

    const funn = GD.sjekk.koeyr();
    const s = GD.sjekk.samandrag(funn);

    /* Kva sjekken IKKJE er. Denne setninga er skilnaden på eit opplærings-
       verktøy og ein falsk tryggleik, og ho høyrer heime i grensesnittet. */
    const atterhald = u.el('div', 'gd-sjekk-atterhald');
    atterhald.appendChild(u.el('p', null,
      'Sjekken kontrollerer forma på svara mot feil tilsynsstyresmakter faktisk ' +
      'har hatt innvendingar mot. Han kan ikkje sjå om det du har skrive er sant. ' +
      'Ein protokoll som går gjennom utan merknader kan framleis vere feil.'));
    vert.appendChild(atterhald);

    vert.appendChild(oppsummering(s));

    if (!funn.length) {
      vert.appendChild(u.el('p', 'gd-sjekk-reint',
        'Ingen funn. Det tyder at forma er i orden — ikkje at innhaldet er det.'));
      return;
    }

    const opne = GD.sjekk.grupper(funn.filter(function (f) { return !f.avvist; }));
    const avviste = GD.sjekk.grupper(funn.filter(function (f) { return f.avvist; }));

    opne.forEach(function (g) { vert.appendChild(gruppe(g, false)); });

    if (avviste.length) {
      vert.appendChild(u.el('h3', 'heading4', 'Vurdert og avvist'));
      vert.appendChild(u.el('p', 'gd-hjelp',
        'Desse har du sett på og bestemt deg for. Grunngjevinga blir lagra saman med protokollen.'));
      avviste.forEach(function (g) { vert.appendChild(gruppe(g, true)); });
    }
  }

  function oppsummering(s) {
    const u = U();
    const rad = u.el('div', 'gd-sjekk-sum');
    [
      [s.aktivitetar, s.aktivitetar === 1 ? 'aktivitet' : 'aktivitetar', ''],
      [s.manglar, s.manglar === 1 ? 'mangel' : 'manglar', 'gd-nivaa-mangel'],
      [s.aatvaringar, s.aatvaringar === 1 ? 'åtvaring' : 'åtvaringar', 'gd-nivaa-aatvaring'],
      [s.merknader, s.merknader === 1 ? 'merknad' : 'merknader', 'gd-nivaa-merknad']
    ].forEach(function (t) {
      const boks = u.el('div', 'gd-sjekk-tal ' + t[2]);
      boks.appendChild(u.el('span', 'gd-sjekk-num', String(t[0])));
      boks.appendChild(u.el('span', 'gd-sjekk-lab', t[1]));
      rad.appendChild(boks);
    });
    return rad;
  }

  function gruppe(g, erAvvist) {
    const u = U();
    const n = NIVAA[g.regel.nivaa] || NIVAA.merknad;
    const boks = u.el('div', 'gd-funn ' + n.klasse + (erAvvist ? ' er-avvist' : ''));

    const topp = u.el('div', 'gd-funn-topp');
    topp.appendChild(u.el('span', 'gd-funn-nivaa', n.tittel));
    topp.appendChild(u.el('h4', 'gd-funn-tittel', g.regel.tittel));
    boks.appendChild(topp);

    boks.appendChild(u.el('p', 'gd-funn-tal',
      g.treff.length === 1 ? 'I éin aktivitet:' : 'I ' + g.treff.length + ' aktivitetar:'));

    const liste = u.el('ul', 'gd-funn-liste');
    g.treff.forEach(function (f) {
      const li = u.el('li');
      const knapp = u.el('button', 'gd-funn-lenkje');
      knapp.type = 'button';
      const namn = f.aktivitet.kvaGjeld || f.aktivitet.formaal || 'Utan namn';
      const feltDef = GD.felt.get(f.feltId);
      knapp.textContent = namn + ' — ' + (feltDef ? feltDef.etikett : f.feltId);
      knapp.addEventListener('click', function () {
        GD.state.velg(f.aktivitetId);
        document.querySelector('[data-fane="aktivitetar"]').click();
        const felt = document.getElementById('f_' + f.feltId);
        if (felt) { felt.scrollIntoView({ block: 'center' }); felt.focus(); }
      });
      li.appendChild(knapp);

      /* Predikatet kan gje tilbake kva det fann — til dømes kva forkortingar
         som ikkje var forklarte. Det er meir nyttig enn å berre peike. */
      if (f.treff && Array.isArray(f.treff)) {
        li.appendChild(u.el('span', 'gd-funn-treff', ' (' + f.treff.join(', ') + ')'));
      }

      if (!erAvvist) {
        const avvis = u.el('button', 'btn gd-btn-liten gd-funn-avvis');
        avvis.type = 'button';
        avvis.textContent = 'Ikkje aktuelt';
        avvis.addEventListener('click', function () { spørOmGrunn(f); });
        li.appendChild(avvis);
      } else {
        const angre = u.el('button', 'btn gd-btn-liten');
        angre.type = 'button';
        angre.textContent = 'Ta fram att';
        angre.addEventListener('click', function () {
          GD.state.angreAvvis(f.regel.id, f.aktivitetId);
          teikn();
        });
        li.appendChild(angre);
        const grunn = grunnenFor(f);
        if (grunn) li.appendChild(u.el('p', 'gd-funn-grunn', 'Grunn: ' + grunn));
      }

      liste.appendChild(li);
    });
    boks.appendChild(liste);

    if (!erAvvist) {
      boks.appendChild(u.el('h5', 'gd-funn-merkelapp', 'Kvifor'));
      boks.appendChild(u.el('p', null, g.regel.kvifor));
      boks.appendChild(u.el('h5', 'gd-funn-merkelapp', 'Eit betre svar'));
      boks.appendChild(u.el('p', 'gd-funn-gjer', g.regel.gjer));

      if (g.regel.kjelde && g.regel.kjelde.tekst) {
        const p = u.el('p', 'gd-kjelde');
        p.appendChild(document.createTextNode('Kjelde: '));
        if (g.regel.kjelde.url) {
          const a = u.el('a', null, g.regel.kjelde.tekst);
          a.href = g.regel.kjelde.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          p.appendChild(a);
        } else {
          p.appendChild(document.createTextNode(g.regel.kjelde.tekst));
        }
        boks.appendChild(p);
      }
    }

    return boks;
  }

  function grunnenFor(f) {
    const v = GD.state.data.avviste.filter(function (x) {
      return x.regel === f.regel.id && x.aktivitet === f.aktivitetId;
    })[0];
    return v ? v.grunn : '';
  }

  function spørOmGrunn(f) {
    const u = U();
    const overlegg = document.getElementById('avvisOverlegg');
    const felt = document.getElementById('avvisGrunn');
    const ja = document.getElementById('avvisJa');
    if (!overlegg || !ja) {
      GD.state.avvis(f.regel.id, f.aktivitetId, '');
      teikn();
      return;
    }
    felt.value = '';
    const handter = function () {
      GD.state.avvis(f.regel.id, f.aktivitetId, felt.value.trim());
      u.closeModal(overlegg);
      ja.removeEventListener('click', handter);
      teikn();
    };
    ja.addEventListener('click', handter);
    u.openModal(overlegg);
  }

  root.GD = root.GD || {};
  root.GD.uiSjekk = { teikn: teikn };
})(window);
