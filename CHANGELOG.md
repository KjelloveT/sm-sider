# Endringslogg — Vyrdepil

Alle merkbare endringar i prosjektet blir dokumenterte her.
Format: [Keep a Changelog](https://keepachangelog.com/), datoar i ISO 8601.

## [Ikkje publisert]

### Endra
- **Fontar** — fjerna all bruk av Google Fonts. Heimsank og Vidfaren brukar no system-font-stablar (Arial Black/Impact, system-ui, Courier New m.m.) i staden for Archivo Black, Space Grotesk, Caveat, Bangers og DM Mono, slik at ingen fontfiler blir lasta frå eksterne tenarar. Google Fonts-rada er fjerna frå personvernsida, og `AGENTS.md` slår fast at vi aldri skal bruke eksterne font-bibliotek.
- **Frødekapp** — oppgradert til vyrdepil-designsystemet, det siste verktøyet som stod att.
  - Alle fem sidene (framside, vert, delta, solo, editor) brukar no `neobrutalisme.css`, global `<neo-header>` med temaveljar og standard `page-wrapper`/`main-content`-layout. Alle skjermane følgjer den same lys/mørk-tema-vekslaren.
  - Kahoot-svarknappane er mappa til tema-accentane (skiftar med temaet) med rett tekstkontrast i staden for faste fargar.
  - All lagring (lokalt quiz-bibliotek, editor-utkast, sist brukte kallenamn) går no via felles `VyrdepilStorage` i staden for direkte `localStorage`.
  - All emoji og ASCII-symbol bytt ut med inline Lucide-ikon; ikon-knappar har fått `aria-label`, modalar lukkast med Escape, og dynamiske felt har `aria-live`.
  - Eksporterte quiz-ar får `app`/`version`-felt på toppnivå (JSON-migreringsveg).
  - Internt: ny delt `quiz-runner.js` (eitt-spelar-motor brukt av soloøvinga), eige `storage.js`- og `icons.js`-lag, og DOM-bygd rendering utan `innerHTML` på brukartekst. Retta òg knappe-bindingar i editoren som var brotne.
- **BiletFlett** — bygd heilt om frå den gamle `fotocollage/fotocollage.html`-monolitten til vyrdepil-standard.
  - Flytta til `biletflett/` med `index.html`, `css/style.css` og IIFE-modular (`icons`, `templates`, `decor`, `collage`, `app`). Brukar `neobrutalisme.css`, global `<neo-header>` med temaveljar og `page-wrapper`/`main-content`-layout. Emoji bytt ut med inline Lucide-ikon.
  - **Retta koordinat-feil:** treff-deteksjon (dra, zoom, skjering) skalerer no rett mellom lerretsoppløysing og vist storleik, så han fungerer òg på smale skjermar.
  - Nytt data-drive mal-system: 8 reine standard-oppsett + **20 sprek tema-malar** (tur, dagsoppsummering, strand, fjell, gard, fleire bursdagsmalar, karneval, skulestart, skuleåret, klassen vår, tema-prosjekt, årstider og høgtider, minnebok) med **redigerbar tittel/bilettekst**.
  - All pynt (konfetti, vimplar, ballongar, løv, snø, rammer m.m.) er teikna med Canvas 2D — ingen emoji og ingen eksterne bilete. Render i A4-oppløysing (~150 dpi) for skarp utskrift; eksport som PNG.
  - Tilstandslaus (ingen `localStorage`); modalar lukkast med Escape og interaktive element har `:focus-visible` og `aria-label`.

### Fiksa
- **Global header** — `neo-header.js` reknar no ut rett basissti for sider som ligg meir enn eitt mappenivå ned (t.d. `livslina/stilguide/`), slik at meny og lenkjer fungerer der òg.
- **Framsida** — kategori-titlane byggjast no trygt med `textContent` i staden for `innerHTML` (ikon-SVG i eige `<span>`), i tråd med resten av `home.js`.
- **Heimsank** — tilt-/foil-effekten på samlekort og i kort-modalen er `requestAnimationFrame`-throttla, så hovring ikkje lenger gjev unødig layout-arbeid kvar mus-piksel.
- **Handsam bilete** — viser no ein kort notis når filer som ikkje er bilete (eller som ikkje lét seg lese) blir hoppa over ved opplasting, i staden for å avvise dei utan tilbakemelding.

### Lagt til
- **Ordkryss** — nytt verktøy for å lage kryssord (`ordkryss/`, lenka frå framsida under Verktøy).
  - Skriv inn ord og forklaringar i skjema, lim inn ei heil liste (`ord; forklaring`) eller importer ei JSON-fil. Validering fangar for korte ord, ugyldige teikn og duplikat.
  - Flettealgoritme som køyrer mange randomiserte forsøk og vel oppsettet med flest kryss og minst areal. Reglane hindrar utilsikta ord ved sida av kvarandre. «Prøv på nytt» gjev eit nytt oppsett, og ord kan låsast så dei står stille medan resten blir flettet om.
  - Ord som ikkje kryssar noko blir varsla om, med val om å fjerne dei eller ta dei med frittståande.
  - Utskrift på A4 med tittel, namnefelt og nummererte forklaringar, fasit på eiga side, og eitt ferdig namngjeve ark per elev — namna kan hentast frå Flokkdeilar eller Klassekart (eingongskopi), limast inn, eller sløyfast.
  - Nedlasting som PNG og SVG (teikna lokalt, ingen bibliotek), lokalt bibliotek via `VyrdepilStorage` og JSON-eksport/-import med `app`/`version`-felt. Personvernerklæringa er oppdatert med Ordkryss-rad.
- **Livslina (under arbeid)** — økonomisk livssimulator, fase 1: vidaregåande (16–19 år). Spelbar på `livslina/index.html`, men enno ikkje lenka frå framsida.
  - Full spelløkke: karakterskapar (paper doll), trekt familieøkonomi, val blant alle 15 utdanningsprogram (vilbli.no) i to fargekategoriar med ikon, busituasjon (heime/hybel), budsjettkort per halvår (jobb, forbruksprofil, aktivitetar, sparing), månadsvis avspeling, hendingskort (19 kort med vilkår og vekting), sommar-mellomspel, 18-årsdag (BSU + høgare timeløn), diorama som endrar seg etter kjøp (seng, gaming-oppsett, moped m/lovleg-eller-trimma-val, førarkort), og sluttrapport med formuekurve, vendepunkt med kontrafaktisk sum, vegen vidare og 8 merke.
  - Lagring via `VyrdepilStorage` (éi aktiv gjennomspeling + historikk over fullførte løp) med JSON-eksport/-import. Personvernerklæringa er oppdatert med Livslina-rad.
  - Stilguide i `livslina/stilguide/` (stilreglar, livsverd-palett, prøve-SVG-ar), fase 1-design i `livslina/docs/fase1-design.md`, datagrunnlag med ekte satsar (SIFO 2025, Lånekassen 2025–26, frikortgrensa 2026, tariff-timeløn, forenkla forelegg) i `livslina/data/grunndata.json` — kvar post merkt med kjelde og om han er offisiell sats eller anslag.
- **Listesmia** (wikidata-tester) — bygd om frå rein SPARQL-tester til ein veivisar som finn kortlister til Heimsank utan at ein treng kunne SPARQL.
  - Steg-for-steg: søk etter emne med vanlege ord (Wikidata-søke-API på norsk), snøggval-chips (hunderasar, fjell, vulkanar m.fl.), krav (må ha bilete / Wikipedia-artikkel), filter (t.d. avgrens til eit land) og val av ekstra kolonnar.
  - Artikkel-lenkja vel beste tilgjengelege Wikipedia-utgåve: nynorsk → bokmål → engelsk.
  - Verktøyet undersøkjer automatisk kva opplysningar som faktisk finst for det valde emnet (stikkprøve på 200 element) og føreslår dei som kolonnar og filter.
  - Eksport tilpassa Heimsank: CSV, ferdig `categories.json`-utdrag (med rett statType/statField) og generert rarity-fil med justerbar prosentfordeling.
  - Duplikatrader blir fjerna automatisk, og element utan namn (berre Q-kode) kan hoppast over.
  - Talverdiar (areal, høgd, masse o.l.) blir henta som normaliserte SI-verdiar slik at sortering og samanlikning blir rett sjølv når Wikidata blandar einingar (km² mot m²).
  - Vel ein eit statistikk-felt, blir sorteringa automatisk sett til det feltet — namnesortering på store emne gjev vilkårlege treff fordi Wikidata fyller inn namn først etter LIMIT (A–Å blir difor sortert lokalt).
  - Den genererte SPARQL-spørjinga ligg open under «Avansert» og kan redigerast og køyrast direkte (gamal funksjonalitet er altså bevart).
  - Hentar data frå Wikidata/Wikipedia (eksternt API) — godkjent unntak; ingen brukardata blir sende, og ingenting blir lagra lokalt.
- **Heimsank** — tre nye kortkategoriar laga med Listesmia: matrettar, grunnstoff og videospel.
- **Heimsank** — progresjonssystem og nye kategori-forsider.
  - Kvar kategori i menyen blir no vist som eit lite samlekort (ramme + bilete, utan tekst) i staden for eit ikon. Forsida er eit fast, deterministisk døme-kort (det sjeldnaste tilgjengelege). Låste kategoriar viser ei kort-bakside med hengelås.
  - **Poeng som valuta:** du tener poeng for kvart kort du vinn (meir for sjeldnare kort — vanleg 1 → gudebore 30, foil doblar). Berre **Land** er open frå start; dei andre kategoriane låsast opp éin etter éin ved å bruke poeng (fritt val, 20–230 poeng).
  - **Merke (29 stk.)** i eit eige galleri: kort-milepælar (1, 25, 100, 1000 kort), sjeldsemd (segngjeten, gudebore, foil), rett-svar-stige (10/20/30/40/50/75/100/200/500), «Vrien»-stige for rette svar på middels/vanskeleg (100–500), opplåsing (Oppdagar, Heile verda) og fullt hus — både generelt og eitt per sjeldsemd (vanleg/sjeldgjevt/segngjeten/gudebore) og foil.
  - Toast-varsel for tente poeng, nye merke og opplåste kategoriar.
  - Eksisterande spelarar får eit eingongs retro-påslag av poeng for kort dei alt har samla, og kategoriar dei alt har kort i blir opna automatisk.
  - Framgang (poeng, opne kategoriar, merke) lagrast lokalt via `VyrdepilStorage` — ingen data forlèt nettlesaren.
  - Internt: delt `carddata.js` fjernar duplisert CSV-lasting (showcase, samling, spelstart og forsider deler no éin mellomlagra lastar).
- **Dagsvegen** — ny dagsplan-skjerm for klasserommet.
  - Dagsplan med fag, friminutt og notat — tidsstyrt slik at aktiv økt blir utheva automatisk, med progresjonsstrek og stor datolinje («måndag 11. juni — veke 24»).
  - Plan for timen: aktivitetar med varigheit, tidsline med no-markør og nedteljing til neste byte. +5/−5-knappar per aktivitet: meirtid blir henta frå fleksible buffer-aktivitetar slik at slutten står fast; rest blir vist som raud overtid inn i friminuttet. Diskret «X min att»-varsel før kvart byte.
  - Forhandsdefinert fagliste med emoji (redigerbar) og eigenbygd emoji-veljar med ~150 kuraterte, skulerelevante emoji i seks kategoriar. (Dagsvegen har eksplisitt unntak frå emoji-forbodet — gjeld berre faginnhald, UI-et brukar Lucide.)
  - Widgetar: nedteljar med fargeskifte grøn→gul→raud og blink ved null (ingen lyd), stoppeklokke med rundetider, trafikklys for arbeidsro, analog+digital hjørneklokke (gjenbrukar TidvisClock), ro-modus med pustesirkel og hjernepause-trekk (10 redigerbare aktivitetar).
  - Touch-teiknelag over heile skjermen med fargeval, tre pennebreidder og viskelêr — flyktig, blir aldri lagra.
  - Plasserbare tekstboksar i tre stilar: vanleg, huskelapp (post-it med handskrift-font) og bursdagsbanner.
  - Vekemalar (éin per vekedag), namngjevne planar og JSON-eksport/-import (`app: "dagsvegen"`, `version: 1`) via `VyrdepilStorage`.
  - Dev-parameter `?testTime=HH:MM` for å teste tidsstyringa.
- **Ordskodde** — ny ordsky-generator.
  - Lim inn ein tekst og få ei ordsky der dei mest brukte orda er størst (kvadratrot-skalering).
  - Automatisk filtrering av høgfrekvente småord på nynorsk, bokmål og engelsk — kvart ord kan slåast av/på i ordlista etterpå.
  - Tre former (sirkel, firkant, hjarte) og seks forhandsdefinerte tema (Klassisk, Nordlys, Krit, Solnedgang, Skrivemaskin, Godteri) som kan justerast fritt: skrifttype (systemfontar), fem ordfargar, bakgrunn, tal på ord og loddrette ord.
  - Eigenutvikla utleggingsalgoritme i vanilla JS: arkimedisk spiral med kollisjonsgrid og formmasker. Seeded PRNG gjer at lagra skyer alltid blir teikna likt.
  - Eksport som PNG (med eller utan bakgrunn), SVG og utskrift. Lagra namngjevne skyer med JSON-eksport/-import (`app: "ordskodde"`, `version: 1`) via `VyrdepilStorage`.
  - Innebygd eksempeltekst: utdrag frå Wikipedia-artikkelen om taco på nynorsk (CC BY-SA 4.0, med kjeldetilvising).
- **Tidvis** — nytt klokkespel for å øve på å lese tid.
  - Tre representasjonar: analog urskive (SVG), digital (HH:MM) og tekst på nynorsk (t.d. «kvart på ti», «fem på halv ti»).
  - Fire vanskegrader: heile & halve, kvart, fem & ti, alle minutt.
  - Spelmodusar: «Les av» (fleirval), «Still visarane» (dra dei analoge visarane), «Para» (match tid på tvers av representasjonar) og «Snøggstart» (60 sek blanda).
  - Modusveljar i starten med valbar retning (t.d. Analog→Tekst, Digital→Analog, Bland alt).
  - Poeng med combo-bonus og tidsbonus, streak, XP/nivå-progresjon og åtte merke (m.a. Kvartkongen, Lynrask, Minuttmeister, Nattugle, Hundreklubben).
  - Eige neobrutalistisk uttrykk under `.tv`-namespace (sanksjonert avvik), med eigne tokens og system-fontar. Synkar tema med den globale temaveljaren.
  - All framgang (toppscore, nivå/XP, merke, lagra oppsett) lagra lokalt via `VyrdepilStorage`.
- **Flokkdeilar** — nytt verktøy for tilfeldige elevgrupper.
  - Lag og lagra fleire klasselister lokalt.
  - Vel mellom «gruppestorleik» og «tal grupper»; storleiksvising viser t.d. «8 grupper med 3–4 elevar».
  - Tilfeldig storskjerm-trekk med animasjon, kuraterte gruppenamn frå seks kategoriar (nynorsk), tilfeldige fargar og Lucide-ikon.
  - Lås enkeltgrupper og trekk resten på nytt.
  - Marker fråverande elevar direkte i trekke-skjermen.
  - Valfri «Utvida administrasjon» med PIN (SHA-256 + salt): ja/kanskje/aldri-relasjonar mellom elevar. «Aldri»-par hamnar aldri i same gruppe.
  - «Fjern tilleggsinfo» beheld elevnamn men slettar relasjonar og PIN.
  - Eksport og import av JSON. Toveis import-snarveg frå Klassekart.
- **Ordaklok** — nytt verktøy for gloseøving (inspirert av glosepus.no).
  - Fire spelmodusar: skriv svar (med tjuvtitt og bokstavbokser), multiple choice, flashcard (sjølv-vurdering) og matching.
  - Liste-editor med CRUD, masseinnliming (fleire format), JSON-import og JSON-eksport.
  - Deling av lister via URL — heile lista pakka i lenkja med `CompressionStream('gzip')` der det er mogeleg.
  - Leitner spaced repetition (5 bokser) for å prioritere ord eleven strevar med.
  - Toppscore per liste og modus, lagra i `VyrdepilStorage`.
  - Innebygd dømeliste (10 engelsk-norske ord) for rask oppstart.

### Endra
- **Dagsvegen** — ombygd layout etter tilbakemeldingar frå klasserommet.
  - Verktøyrada øvst er bytt ut med ein samanleggbar venstremeny (berre ikon samanlagd, ikon + namn utvida). Toppen har no berre datolinja, og sida nyttar heile skjermbreidda.
  - Dagsplanen og «Plan for timen» er no to frittståande, flyttbare panel (som widgetane) som kan dragast dit ein vil og slåast av/på frå menyen — av gjev blank tavle. Posisjon og av/på blir hugsa.
  - Hero-boksen kan lukkast med ✕ og held seg lukka. Ny rettleiing «Slik brukar du Dagsvegen» i menyen og i tom-tilstanden.
  - Tekstboksane kan no skalerast i både breidde og høgde (eige handtak som òg verkar på touch), og tekststorleiken kan justerast med A−/A+. Alt blir lagra per boks.
  - «Ingen plan for i dag enno»-boksen kan lukkast med ✕ — då står skjermen blank og kan fyllast fritt med teikning, tekstboksar og widgetar. Valet blir hugsa.
  - Ny **Snøggøkt** i menyen: start éi enkel økt no utan å lage dagsplan — med fag, varigheit og same aktivitetsplan (fleksibel tid, +5/−5) som i dagsplanen. Står det noko anna på planen akkurat då, blir det avslutta og snøggøkta tek over.
- **Frødesams** — full migrering til neobrutalisme-designet og vyrdepil-reglane.
  - Bytt eigen `css/style.css` og eigen `<header>` ut med `neobrutalisme.css`, `<neo-header>` og temastøtte (lyst/mørkt, alle 21 tema). `css/style.css` er no berre spel-spesifikke utvidingar (svar-brett, strike-display, display-modus) oppå designsystemet.
  - Flytta lagring frå rå `localStorage`-nøklar til felles `VyrdepilStorage` under nøkkelen `frodesams`. Eksportformatet har no `app: "frodesams"` og `version: 1`.
  - Splitta monolittisk kode i IIFE-modular: `state.js`, `storage.js`, `sync.js`, `game.js`, `editor.js`, `saved.js`, `app.js`, `display.js`.
  - Slå saman `index.html` og `controller.html` — `index.html` er quiz-master, `display.html` er storskjerm. `controller.html` er fjerna.
  - UX-forbetringar: tydelege stryk-merke (✕, raud farge), bekreft/angre-steg ved poenggjeving (UX2), flip-animasjon ved avsløring (UX3), tastaturnavigasjon (taltastar 1–9 for svar, mellomrom for neste) og «eksporter alle» med korrekt `app`/`version`-konvolutt.
  - `index.html` (rota): lagt til personvern-accordion-innslag for Frødesams.
- **Frødebrett** — full migrering til neobrutalisme-designet og vyrdepil-reglane.
  - Bytt eige `css/style.css` (1163 liner) og eigen `<header>` ut med `neobrutalisme.css`, `<neo-header>` og temastøtte (lyst/mørkt, alle 21 tema). `css/style.css` er no berre spel-spesifikke utvidingar (jeopardy-grid, podium, daglegdobbel) oppå designsystemet.
  - Flytta lagring frå rå `localStorage`-nøklar (`frodebrett_*`) til felles `VyrdepilStorage`. Eksportformatet har no `app: "frodebrett"` og `version: 1`.
  - Splitta den monolittiske `app.js` (1253 liner) i IIFE-modular: `state.js`, `storage.js`, `board.js`, `editor.js`, `saved.js`, `app.js`.
  - UX-forbetringar: tydeleg «Dagens dobbel!»-banner med animasjon, bekreft/angre-steg ved poenggjeving, tastaturnavigasjon (pilar, taltastar 1–6 for lag), «eksporter alle frøder» og synleg/klikkbart neste lag på tur.
  - `index.html` (rota): oppdatert personvern-accordion for Frødebrett (lagring under `VyrdepilStorage`).
- `js/neo-header.js`: lagt til Tidvis under «Spel» i dropdown-menyen og mobilnavigasjonen.
- `index.html` (rota): lagt til kort for Tidvis under «Spel» og personverninfo om kva som blir lagra.
- `js/neo-header.js`: lagt til Ordaklok i dropdown-menyen og mobilnavigasjonen.
- `index.html` (rota): lagt til kort for Ordaklok og personverninfo om kva som blir lagra.
- **Ordaklok**: tilfeldige replikkar frå Vyrde i oppsett-skjermen (100 setningar).
- **Ordaklok — Tevling**: stipla skiljelinje mellom venstre og høgre side, Vyrde står i ein tydeleg sirkel i midten over chips-laget.

### Fiksa
- **Dagsvegen**: økter byter ikkje lenger plass medan ein framleis skriv i starttid-feltet — sorteringa skjer først når feltet mistar fokus. Varigheits-felt byggjer heller ikkje om skjemaet midt i skrivinga (minutt-summen blir oppdatert direkte).
- **Frødebrett**: brukarinnhald (quiz-titlar, lagnamn) blir no rendra trygt med `textContent`/`createElement` i staden for `innerHTML` (XSS-vern, viktig for importerte `.json`-frøder). Lagt til `aria-label` på ikon-knappar, Escape lukkar alle modalar og `:focus-visible` frå designsystemet.
- **Ordaklok — Tevling**: chips «blinka» tilbake til opphavleg posisjon ved rett match etter smash-animasjonen. Dei ligg no usynlege når dei først er smasha.
- **Ordaklok — alle modus**: lange begrep og setningar (t.d. naturfag-definisjonar) sprengde boksane. Innført lengde-basert font-skalering og ordbryting i alle fire modus. I Skriv-modus byter vi automatisk til vanleg input når svaret inneheld mellomrom eller er over 20 teikn (bokstavboksar er framleis default for korte ord). Tevling-chips wrappar no til fleire liner i staden for å bli kutta.
