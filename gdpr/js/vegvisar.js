/* ══════════════════════════════════════════════
   VEGVISAR.JS — «Må vi føre protokoll?»

   Artikkel 30 nr. 5 blir lese feil oftare enn noko anna i artikkelen. Ordlyden
   ser ut som ein generell fritak for små verksemder — «gjeld ikkje eit foretak
   med færre enn 250 tilsette» — og mange stoppar å lese der.

   Resten av setninga snur han. Unntaket gjeld IKKJE dersom behandlinga:
     a) sannsynlegvis vil medføre ein risiko for dei registrerte,
     b) ikkje skjer leilegheitsvis, eller
     c) omfattar særlege kategoriar etter artikkel 9 eller straffedomar
        etter artikkel 10.

   DEI TRE ER ALTERNATIVE. Artikkel 29-gruppa slo det fast i posisjonsdokumentet
   sitt frå 19. april 2018, som EDPB seinare har stadfesta: «or» tyder at eitt av
   dei er nok. Og «ikkje leilegheitsvis» er det som tek dei fleste — har
   verksemda tilsette, behandlar ho lønsopplysningar kvar månad, og det er ikkje
   leilegheitsvis. Datatilsynet skriv det rett ut: «i praksis og nesten uten
   unntak, skal derfor alle virksomheter føre protokoller».

   VEGVISAREN LYG DIFOR IKKJE OM UTFALLET. Han endar nesten alltid med ja, og
   det er meininga — men han viser kva som utløyste svaret, så brukaren lærer
   regelen i staden for berre å få ein konklusjon.

   EIT SISTE POENG som er lett å gå glipp av: unntaket gjeld PER BEHANDLING,
   ikkje for heile verksemda. Det irske datatilsynet er tydeleg på det. Ei lita
   verksemd som slepp unna for éi behandling, må framleis føre protokoll for dei
   andre.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const U = function () { return GD.util; };

  const SPORSMAAL = [
    { id: 'tilsette',
      tekst: 'Har verksemda 250 tilsette eller fleire?',
      hjelp: 'Terskelen står i artikkel 30 nr. 5.',
      jaGjevPlikt: true,
      jaGrunn: 'Verksemder med 250 tilsette eller fleire er omfatta av plikta uansett. Unntaket i artikkel 30 nr. 5 gjeld berre under denne terskelen.' },

    { id: 'jamleg',
      tekst: 'Behandlar de personopplysningar jamleg — ikkje berre no og då?',
      hjelp: 'Har de tilsette, behandlar de lønsopplysningar kvar månad. Har de kundar eller elevar, behandlar de opplysningar om dei heile tida.',
      jaGjevPlikt: true,
      jaGrunn: 'Behandlinga skjer ikkje leilegheitsvis. Det er eitt av dei tre vilkåra som set unntaket til side — og det som gjeld flest. Løn og personaladministrasjon er dei vanlegaste døma.' },

    { id: 'saerlege',
      tekst: 'Behandlar de helseopplysningar, fagforeiningsmedlemskap, religion, etnisitet, biometri, opplysningar om seksuelle forhold — eller opplysningar om straffedomar?',
      hjelp: 'Sjukemeldingar og trekk til fagforeining i lønssystemet tel. Det same gjer politiattestar.',
      jaGjevPlikt: true,
      jaGrunn: 'Behandlinga omfattar særlege kategoriar etter artikkel 9 eller opplysningar etter artikkel 10. Det er eitt av dei tre vilkåra som set unntaket til side.' },

    { id: 'risiko',
      tekst: 'Kan behandlinga innebere ein risiko for dei registrerte sine rettar og fridomar?',
      hjelp: 'Merk at det held med «ein risiko» her — ikkje «høg risiko», som er terskelen for DPIA etter artikkel 35. Overvaking, profilering og opplysningar om born er typiske døme.',
      jaGjevPlikt: true,
      jaGrunn: 'Behandlinga vil sannsynlegvis medføre ein risiko for dei registrerte. Det er eitt av dei tre vilkåra som set unntaket til side. Terskelen er «ein risiko», ikkje «høg risiko».' }
  ];

  let svar = {};

  function init(hostId) {
    const vert = document.getElementById(hostId);
    if (!vert) return;
    teikn(vert);
  }

  function teikn(vert) {
    const u = U();
    vert.textContent = '';

    SPORSMAAL.forEach(function (sp) {
      const boks = u.el('div', 'gd-vegvisar-sporsmaal');
      boks.appendChild(u.el('p', 'gd-vegvisar-tekst', sp.tekst));
      if (sp.hjelp) boks.appendChild(u.el('p', 'gd-hjelp', sp.hjelp));

      const rad = u.el('div', 'gd-knapperad');
      [['ja', 'Ja'], ['nei', 'Nei'], ['veit', 'Veit ikkje']].forEach(function (par) {
        const b = u.el('button', 'btn gd-btn-liten' + (svar[sp.id] === par[0] ? ' active' : ''));
        b.type = 'button';
        b.textContent = par[1];
        b.addEventListener('click', function () {
          svar[sp.id] = par[0];
          teikn(vert);
        });
        rad.appendChild(b);
      });
      boks.appendChild(rad);
      vert.appendChild(boks);
    });

    vert.appendChild(svaret());
  }

  function svaret() {
    const u = U();
    const utloysande = SPORSMAAL.filter(function (sp) {
      return sp.jaGjevPlikt && svar[sp.id] === 'ja';
    });
    const usikre = SPORSMAAL.filter(function (sp) { return svar[sp.id] === 'veit'; });
    const svarte = SPORSMAAL.filter(function (sp) { return svar[sp.id]; }).length;

    const boks = u.el('div', 'gd-vegvisar-svar');

    if (!svarte) {
      boks.appendChild(u.el('p', 'gd-muted', 'Svar på spørsmåla over, så seier vi kva som gjeld.'));
      return boks;
    }

    if (utloysande.length) {
      boks.appendChild(u.el('h3', 'heading4 no-mt', 'Ja — de skal føre protokoll'));
      const ul = u.el('ul');
      utloysande.forEach(function (sp) { ul.appendChild(u.el('li', null, sp.jaGrunn)); });
      boks.appendChild(ul);
      if (utloysande.length > 1) {
        boks.appendChild(u.el('p', 'gd-hjelp',
          'Dei tre vilkåra i artikkel 30 nr. 5 er alternative. Eitt av dei hadde vore nok; her er det ' +
          utloysande.length + '.'));
      }
      return boks;
    }

    if (usikre.length || svarte < SPORSMAAL.length) {
      boks.appendChild(u.el('h3', 'heading4 no-mt', 'Uavklart enno'));
      boks.appendChild(u.el('p', null,
        'Svar på alle spørsmåla. Er du usikker på eit av dei, er svaret i praksis ja: ' +
        'unntaket er så snevert at Datatilsynet skriv at «i praksis og nesten uten unntak, ' +
        'skal derfor alle virksomheter føre protokoller».'));
      return boks;
    }

    /* Alle svar er nei. Det er mogleg, men sjeldan — og det fritek uansett
       ikkje frå alt. */
    boks.appendChild(u.el('h3', 'heading4 no-mt', 'Kanskje ikkje — men les vidare'));
    boks.appendChild(u.el('p', null,
      'Ut frå svara dine kan unntaket i artikkel 30 nr. 5 gjelde. Tre atterhald:'));
    const ul = u.el('ul');
    ul.appendChild(u.el('li', null,
      'Unntaket gjeld per behandling, ikkje for heile verksemda. Har de éi behandling som fell utanfor, skal ho førast opp.'));
    ul.appendChild(u.el('li', null,
      'Har de tilsette, behandlar de som regel lønsopplysningar jamleg. Sjå ein gong til på spørsmål to.'));
    ul.appendChild(u.el('li', null,
      'Ansvarlegheitsprinsippet i artikkel 5 nr. 2 krev at de kan vise at de følgjer reglane. Ei oversikt over kva de behandlar er den enklaste måten, òg når ho ikkje er påbode.'));
    boks.appendChild(ul);
    return boks;
  }

  root.GD = root.GD || {};
  root.GD.vegvisar = { init: init, SPORSMAAL: SPORSMAAL };
})(window);
