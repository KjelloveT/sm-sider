/**
 * vyrde-quotes.js
 * Tilfeldige snakkebobler frå maskoten Vyrde på oppsett-skjermen i Ordaklok.
 *
 * Set tekst i #vyrdeBubble til ei tilfeldig setning frå QUOTES når sida lastar,
 * og ny setning kvar gong brukaren kjem attende til oppsett-skjermen
 * (Avbryt under spel, eller "Endre oppsett" frå resultatskjermen).
 */
(function () {
  'use strict';

  const QUOTES = [
    // Frå filmens og eventyrets verd
    'Mot uendelegheita – og forbi!',
    'Må Krafta vera med deg.',
    'Berre symja vidare, berre symja vidare…',
    'Hakuna Matata! Det tyder inga bekymring.',
    'Eg kjem attende!',
    'Livet er som ei øskje med sjokolade, du veit aldri kva du får.',
    'Det er ingen stad som heime.',
    'Houston, me har eit problem… eller, vent, det var berre litt lasting.',
    'Me kjem til å trenga ein større båt… eller ein raskare skjerm.',
    'Slepp det laus, slepp det laus!',
    'Eg er kongen i verda!',
    'Gulle mitt…',
    'Ver vår gjest, ver vår gjest, her er venting ingen fest!',
    'Supercalifragilisticexpialidocious… prøv å seia det baklengs medan me ventar!',
    'Viss du fokuserer på det du har forlate, vil du aldri sjå kva som ligg framfor deg.',
    'Å, ja, fortida kan gjera vondt. Men slik eg ser det, kan du anten rymma frå henne, eller læra av henne.',
    'Ein må aldri sjå seg attende, daling, det avleier merksemda frå notida.',
    'Lagnaden vår ligg inni oss. Du må berre vera modig nok til å sjå han.',
    'Du er ein trollmann, Harry!',
    'Her kjem sola, og eg seier: Det er heilt i orden.',
    'Alt som trengst er litt tru, tillit og alvestøv.',
    'No skal me ut på eventyr!',
    'Er me framme snart?',
    'Eg trur eg kan fly!',
    'Sjå på denne dingsen, er han ikkje fin?',

    // Gamle visdomsord i ny drakt
    'Den som ventar på noko godt, ventar ikkje forgjeves… håpar eg.',
    'Alle vegar fører til… startknappen!',
    'Betre seint enn aldri, seier no eg.',
    'Det finst ikkje dårleg vêr, berre dårlege tålmodskrefter.',
    'Morgonstund har gull i munn – eller kanskje ein god kjeks?',
    'Smid medan jarnet er varmt, eller medan skjermen lastar.',
    'Eitt skritt om gongen, sa snigelen då han gjekk løp.',
    'Tålmod er ei dyd, men eg har gløymt kvar eg la henne.',
    'Det er ikkje gull alt som glitrar, somme tider er det berre ein refleks i skjermen.',
    'Den som ler sist, har truleg ikkje skjønt vitsen enno.',
    'Liten, men herleg og lynskarp!',
    'Rom vart ikkje bygd på éin dag, og dette spelet startar tydelegvis ikkje på éitt sekund.',
    'Ein skal ikkje skoda hunden på håra, eller maskoten på fargen.',
    'Sjølv den lengste reisa byrjar med eit enkelt tastetrykk.',
    'Æra vera den som ventar muntert.',
    'Dropen holar ut steinen – og ventetida prøver å hola ut tålmodet mitt.',
    'Kast ikkje perler for svin, spar dei heller til høgste poengsum!',
    'Etter regn kjem solskinn, etter lasting kjem moro.',
    'Gjer mot andre slik du vil at datamaskinen skal gjera mot deg.',
    'Eple fell ikkje langt frå stammen, og eg fell snart ned av spenning.',
    'Blind høne kan òg finna eit korn, berre ho leitar lenge nok på skjermen.',
    'Kven veit kva morgondagen bringar? Ikkje eg, eg ventar berre på i dag.',
    'Ingen er så vis at han ikkje kan læra noko nytt medan han ventar.',
    'Den tid, den sorg – no er det berre ein herleg ventefest.',
    'Kunnskap er makt, men tålmod er ei superkraft!',

    // Maskoten sine eigne ventetankar
    'Er det nokon her som har ein vits? Ein skikkeleg tørr ein?',
    'Viss eg blinkar no, går eg glipp av starten då? Eg tør ikkje prøva.',
    '*Kremt*… Hallo? Er det straum på denne dingsen?',
    'Eg prøvde å telja pikslane på skjermen, men eg mista talet på fire tusen og tre.',
    'Hei du! Ja, du som ser på meg. Fine auge du har!',
    'Høyrde eg eit startskot, eller var det berre magen min som rumla?',
    'Om eg står på eitt bein, trur du det går fortare då? Eg prøver!',
    'Eg lurer på kva som skjer viss eg trykkjer på… Å nei, best å ikkje røyva noko.',
    'Dette er den perfekte tida til å øva på å rulla med augone. Sjå her!',
    'Viss du kjeder deg, kan du prøva å røre nasetippen med tunga di så lenge.',
    'Laster han enno? Kanskje datamaskinen tek ein liten middagskvil?',
    'Eg har funne ut at venting er femti prosent ståing og femti prosent tenking.',
    'Skal me kasta krone og mynt om kva som skjer fyrst, du eller eg?',
    '*Gjesp*… Å, unnskuld, eg berre lufta tennene mine litt.',
    'Kan du høyra den susinga? Det er hjernen min som jobbar på høgspenn!',
    'Tikketakk, tikketakk… klokka går, men eg står på staden kvile.',
    'Eg skulle ynskja eg hadde teke med meg ei niste. Ei vaffel med brunost hadde vore noko.',
    'Halla! Er det liv i deg der på andre sida av glasset?',
    'Viss du ser kjempe-nøye etter, kan du sjå at eg dansar ein mikroskopisk dans akkurat no.',
    'Tenk at verda snurrar kjempefort rundt akkurat no, medan me berre sit her.',
    'Eg vurderer sterkt å byrja med tå-gymnastikk. Det ser proft ut.',
    'Venting gjer meg filosofisk. Kvifor heiter det eigentleg grunnskule? Er det fordi ein lærer alt frå grunnen av?',
    'Hallo? Sentralen? Me treng litt meir fart på sakene her, takk!',
    'Viss dette tek lengre tid, gror eg vel mose på ryggen min.',
    'Er det lov å syngja ein song medan me ventar? Bæ, bæ, lille lam…',

    // Sprøe og livlege gullkorn
    'Eitt, to, tre… no må det vel skje noko snart?',
    'Eg veddar på at eg kan stirra på skjermen lenger enn deg utan å blinke. Klar, ferdig… gå!',
    'Du og eg, me er eit godt team. Du sit der, og eg står her og trippar.',
    'Har du hugsa å drikka vatn i dag? Berre eit lite tips frå ein maskot som bryr seg.',
    'Tenk om alt dette berre er ein draum, og me eigentleg sit på ein romstasjon?',
    'Er det berre eg, eller vart bakgrunnen plutseleg litt meir fargerik?',
    'Du er kjempeflink til å venta! Du burde faktisk ha fått ein gullmedalje i tålmod.',
    'Hopp opp og ned tre gonger! Det hjelper ikkje på lastetida, men du verknar vaken!',
    'Eg lurer på kva favorittfargen din er. Min er sjølvsagt… alt som glitrar!',
    'Sjå, ein sky der ute som liknar på ein pannekake! Å, no vart eg svolten igjen.',
    'Trommevirvel, takk! Badum-tss!',
    'Viss ein robot ventar, heiter det då standby eller berre ein god, gamal pause?',
    'Eg trur eg såg eit stjerneskott på skjermen akkurat no. Ynsk deg noko kjapt!',
    'Smil til verda, så smilar verda til deg – eller i det minste smilar eg til deg!',
    'Det er femtito kort i ein kortstokk, men eg har berre éitt ess i ermet: Nemleg deg!',
    'Er du klar til å verta super-hyper-mega-klar?',
    'Eg driv og øver på telepati no. Kan du høyra kva eg tenkjer på akkurat no?',
    'Pust inn… pust ut… og gjer deg klar til maks innsats!',
    'Nokre sneglar kan sova i tre år. Godt me ikkje må venta så lenge, kva?',
    'Viss du hadde hatt superkrefter akkurat no, kva ville du ha trulla fram?',
    'Eg kveikjer spenningen i rommet no, kjenner du det gnistrar i lufta?',
    'Det er ingenting som slår ein god start, bortsett frå ein heilt fantastisk start!',
    'Hald deg fast i nasehåra, no byrjar det like før!',
    'Siste sjanse til å strekkja på beina før me set i gang for fullt!',
    'Tre, to, éin… no fyk me endeleg av garde!'
  ];

  let lastIndex = -1;

  function pickQuote() {
    if (QUOTES.length <= 1) return QUOTES[0] || '';
    let i;
    do {
      i = Math.floor(Math.random() * QUOTES.length);
    } while (i === lastIndex);
    lastIndex = i;
    return QUOTES[i];
  }

  /* Uttrykk som kler ein oppspelt replikk på oppsett-skjermen. Vyrde byter
     andlet saman med replikken, så ho ikkje står med same mine kvar gong. */
  const SETUP_MOODS = ['wave', 'happy', 'think', 'surprised', 'wink', 'cool'];
  let lastMood = -1;

  function refreshMood() {
    const el = document.getElementById('setupVyrde');
    if (!el || !window.Vyrde) return;
    let i;
    do {
      i = Math.floor(Math.random() * SETUP_MOODS.length);
    } while (i === lastMood && SETUP_MOODS.length > 1);
    lastMood = i;
    Vyrde.setMood(el, SETUP_MOODS[i]);
  }

  function refreshBubble() {
    const bubble = document.getElementById('vyrdeBubble');
    if (!bubble) return;
    bubble.textContent = pickQuote();
    refreshMood();
  }

  function init() {
    refreshBubble();

    // Ny replikk kvar gong oppsett-skjermen vert vist att.
    const quitBtn = document.getElementById('quitBtn');
    const changeSetupBtn = document.getElementById('changeSetupBtn');
    if (quitBtn) quitBtn.addEventListener('click', () => setTimeout(refreshBubble, 0));
    if (changeSetupBtn) changeSetupBtn.addEventListener('click', () => setTimeout(refreshBubble, 0));

    // Klikk på sjølve bobla gjev òg ny replikk – fin liten easter egg.
    const bubble = document.getElementById('vyrdeBubble');
    if (bubble) {
      bubble.style.cursor = 'pointer';
      bubble.title = 'Klikk for ny replikk';
      bubble.addEventListener('click', refreshBubble);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
