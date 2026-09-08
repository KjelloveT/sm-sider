/* ══════════════════════════════════════════════
   UI-LISTE.JS — Behandlingsaktivitetane

   Ei liste over aktivitetane i protokollen, med eit statusmerke som seier kor
   mange av dei lovpålagde felta som er fylte.

   KVIFOR STATUSMERKE OG IKKJE EIN PROSENT: ein protokoll er ikkje ferdig når
   han er 100 % utfylt — han er ferdig når han er sann. Merket tel difor berre
   dei ni felta artikkel 30 nr. 1 faktisk krev, og seier «3 av 9 felt att», ikkje
   «67 % ferdig». Eit tal som ser ut som ein karakter inviterer til å fylle
   felta med noko for å få det opp, og det er nettopp den åtferda som gjev dei
   vage svara eit tilsyn slår ned på.

   DUPLISER ER DEN VIKTIGASTE KNAPPEN. Ei verksemd har sjeldan éi behandling per
   funksjonsområde: personal og løn har rekruttering, personalmappe, fråvær og
   sjukemelding, alle med same system og same sikringstiltak og ulikt formål.
   Å kopiere og endre eitt felt er den arbeidsmåten protokollen faktisk krev.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const U = function () { return GD.util; };
  let vert = null;

  function init(hostId) {
    vert = document.getElementById(hostId);
    if (!vert) return;
    GD.state.onChange(function (emne) {
      if (emne === 'liste' || emne === 'val' || emne === 'load' || emne === 'aktivitet') teikn();
    });
    teikn();
  }

  /* Kor mange av dei lovpålagde felta som står tomme. */
  function manglar(aktivitet) {
    return GD.felt.obligatoriske().filter(function (f) {
      return U().tom(aktivitet[f.id]);
    }).length;
  }

  function statusmerke(aktivitet) {
    const u = U();
    const att = manglar(aktivitet);
    const alle = GD.felt.obligatoriske().length;
    if (att === 0) return u.el('span', 'gd-status gd-status-heil', 'Alle art. 30-felt fylte');
    if (att === alle) return u.el('span', 'gd-status gd-status-tom', 'Ikkje påbyrja');
    return u.el('span', 'gd-status gd-status-delvis', att + ' av ' + alle + ' felt att');
  }

  function teikn() {
    if (!vert) return;
    const u = U();
    vert.textContent = '';

    const liste = GD.state.aktivitetar();

    if (!liste.length) {
      const tom = u.el('div', 'gd-tom-liste');
      tom.appendChild(u.el('p', null,
        'Ingen behandlingsaktivitetar enno. Ein god start er å ta eitt funksjonsområde om gongen — personal og løn, kundeforhold, marknadsføring.'));
      vert.appendChild(tom);
      return;
    }

    const boks = u.el('div', 'gd-liste');
    liste.forEach(function (a, i) {
      boks.appendChild(rad(a, i, liste.length));
    });
    vert.appendChild(boks);
  }

  function rad(a, i, tal) {
    const u = U();
    const rot = u.el('div', 'gd-rad' + (a.id === GD.state.aktivId() ? ' is-aktiv' : ''));

    /* Sjølve raden er ein knapp for skjermlesar òg, ikkje berre for musa. */
    const opne = u.el('button', 'gd-rad-knapp');
    opne.type = 'button';
    opne.style.all = 'unset';
    opne.style.cursor = 'pointer';
    opne.style.display = 'block';

    const tittel = a.kvaGjeld || a.formaal || 'Utan namn';
    opne.appendChild(u.el('div', 'gd-rad-tittel', tittel));

    const under = u.el('div', 'gd-rad-under');
    const delar = [];
    if (a.funksjonsomraade) delar.push(a.funksjonsomraade);
    if (a.registrerte) delar.push(a.registrerte);
    under.textContent = delar.join(' · ');
    opne.appendChild(under);
    opne.appendChild(statusmerke(a));

    opne.addEventListener('click', function () { GD.state.velg(a.id); });
    rot.appendChild(opne);

    const styring = u.el('div', 'gd-rad-styring');

    const opp = u.ikonknapp('chevronUp', null, 'btn gd-ikonknapp');
    opp.setAttribute('aria-label', 'Flytt opp');
    opp.disabled = i === 0;
    opp.addEventListener('click', function () { GD.state.flytt(a.id, -1); });

    const ned = u.ikonknapp('chevronDown', null, 'btn gd-ikonknapp');
    ned.setAttribute('aria-label', 'Flytt ned');
    ned.disabled = i === tal - 1;
    ned.addEventListener('click', function () { GD.state.flytt(a.id, 1); });

    const kopi = u.ikonknapp('copy', null, 'btn gd-ikonknapp');
    kopi.setAttribute('aria-label', 'Lag ein kopi av denne aktiviteten');
    kopi.addEventListener('click', function () {
      GD.state.dupliser(a.id);
      u.toast('Kopi laga. Endre formålet, så har du nummer to.');
    });

    const slett = u.ikonknapp('trash', null, 'btn gd-ikonknapp gd-fare');
    slett.setAttribute('aria-label', 'Slett denne aktiviteten');
    slett.addEventListener('click', function () {
      GD.uiListe.bekreftSlett(a);
    });

    [opp, ned, kopi, slett].forEach(function (b) { styring.appendChild(b); });
    rot.appendChild(styring);
    return rot;
  }

  /* Sletting er ikkje til å angre på, og ein behandlingsaktivitet kan vere
     ein halvtimes arbeid. Difor eit steg imellom. */
  function bekreftSlett(a) {
    const u = U();
    const overlegg = document.getElementById('slettOverlegg');
    const tekst = document.getElementById('slettTekst');
    const ja = document.getElementById('slettJa');
    if (!overlegg || !ja) {
      GD.state.slett(a.id);
      return;
    }
    tekst.textContent = 'Slett «' + (a.kvaGjeld || a.formaal || 'Utan namn') +
      '»? Dette kan ikkje angrast.';
    const handter = function () {
      GD.state.slett(a.id);
      u.closeModal(overlegg);
      ja.removeEventListener('click', handter);
      u.toast('Aktiviteten er sletta.');
    };
    ja.addEventListener('click', handter);
    u.openModal(overlegg);
  }

  root.GD = root.GD || {};
  root.GD.uiListe = { init: init, teikn: teikn, bekreftSlett: bekreftSlett, manglar: manglar };
})(window);
