# Vyrdepil — Retningslinjer for utvikling og AI-assistert koding

Dette er den sentrale retningslinjen for koding, design og arkitektur for alle prosjekt, minispel og verktøy under paraplyen **Vyrdepil**. Som AI-assistent skal du **alltid** følgje desse reglane når du legg til ny funksjonalitet, opprettar nye sider eller refaktorerer eksisterande kode. Som menneskeleg utviklar skal du bruke den som referanse og oppslagsverk.

## 1. Grunnleggjande prinsipp og arkitektur
- **Vanilla tech stack:** Heile prosjektet er bygd med HTML5, CSS3 og Vanilla JavaScript. Ikkje bruk rammeverk (React, Vue, etc.) med mindre brukaren spesifikt ber om eit unntak.
- **Offline & lokal køyring:** All logikk skal køyre i nettlesaren. Ingen brukardata skal sendast til nokon tenar.
- **Språk:** All brukarvendt tekst på nettsidene skal skrivast på **nynorsk**. Bruk gjerne eldre og konservative variantar av nynorsk-ord der det er mogeleg. Variablar og funksjonsnamn i kode skrivast på engelsk.

## 2. Personvern (Privacy by Design)
- **Ingen cookies:** Det skal ikkje settast eller brukast cookies for sporing eller anna.
- **VyrdepilStorage:** Direkte bruk av `localStorage` er forbode inne i dei individuelle spela.
  - All lagring **må** gå gjennom det felles API-et definert i `js/vyrdepil-storage.js` (t.d. `VyrdepilStorage.saveHighScore()`, `VyrdepilStorage.saveToHistory()`, `VyrdepilStorage.getHighScore()`).
- **Personvern-oversikta på framsida:** Dersom du legg til lagring for eit nytt spel eller verktøy, eller endrar eksisterande, MÅ du samtidig oppdatere informasjonen i trekkspel-menyen (accordion) under "Personvern og datasikkerheit" → "Kva data lagrast?" på `index.html`. Spelet må listast der med informasjon om "Kva" og "Kvifor" det blir lagra. Det er òg ei visning på framsida som let brukaren sjå all informasjon som er lagra i localStorage.
- I overgangen frå gammalt til nytt lagringssystem er det greitt om gamle toppscore blir sletta eller forsvinn. Vi treng ikkje leggje opp til at gammalt innhald i localStorage skal behaldast.

## 3. Design og neobrutalisme
- Vi brukar eit eigenutvikla neobrutalisme-designsystem (`css/neobrutalisme.css`). Alle nye grensesnitt må gjenbruke desse CSS-klassane framfor å skrive ny custom CSS. Lenk til denne fila som standard, og lag ei dedikert CSS-fil for kvar side/verktøy som overstyrer eller utvidar designsystemet.
- Sjå **ALLTID** på `neobrutalisme_test/style-demo.html` for referanse på design-element og når dei skal brukast.

### 3.1 Responsivitet
- **Alt MÅ vere responsivt:** Vyrdepil blir brukt på alt frå små smarttelefonar til nettbrett og store prosjektorskjermar i klasserommet. Bruk `clamp()`-funksjonar (allereie implementert i typografien), `vw`/`vh`, og auto-grids (`minmax()`) framfor faste pixel-storleikar. Gi varsel dersom element er vanskelege å tilpasse til fleire skjermstorleikar og spør om avklaring på korleis problem skal løysast.

### 3.1.1 Full skjermbreidd for redigeringsverktøy
`<main>` har som standard `max-width: 1200px`. Det er rett for innhaldssider: lange tekstlinjer er tunge å lese, og auget mistar staden når det skal tilbake til venstre marg.

**Men i eit redigeringsverktøy er arbeidsflata sjølve innhaldet.** Ei tidslinje, eit lerret eller ei biletflate blir berre betre av meir plass — brukaren har som regel opna programmet nettopp for å sjå meir om gongen. Der breidda gjev reell nytte, skal verktøyet difor bruke heile skjermen:

```html
<main class="main-content main-wide">
```

`.main-wide` (definert i `css/neobrutalisme.css`) fjernar breiddegrensa og strammar inn sidemargane litt, så flata får mest mogleg plass òg på små skjermar.

Retningslinjer:
- **Bruk han** når flata er ei arbeidsflate: lydredigering (Lydskurd), teikning (Rissverk), biletbehandling, klassekart, tidslinjer og liknande.
- **Bruk han ikkje** på vanlege innhaldssider, framsida, personvernsida, kviss-skjermar eller skjemabaserte verktøy. Der er 1200px rett.
- **Hald tekstblokker lesbare uansett.** Sjølv om flata er brei, skal ingress, hjelpetekst og botntekst ha si eiga breiddegrense (t.d. `max-width: 78ch`). Ei tekstlinje på to tusen pikslar er ikkje betre enn ei på tusen — han er verre.
- Sjekk framleis at det ikkje kjem vassrett skrolling på mobil. `.main-wide` gjer sidemargane mindre, ikkje større, så små skjermar tener òg på han.

### 3.2 Oversikt over komponentar
- **Layout:** Alle hovudsider skal pakkast inn i ein `<div class="page-wrapper">` og deretter `<main class="main-content">`. Redigeringsverktøy legg i tillegg til `.main-wide` — sjå §3.1.1.
- **Global header:** Bruk `<neo-header></neo-header>` øvst på alle sider. Scriptet `js/neo-header.js` tek seg av rendring av den globale menyen med temavelgaren.
- **Headings:** Bruk `.heading1` til `.heading4` for overskrifter. Fargane kan overstyrast med modifikatorar som `.heading1-accent2`. Legg til `.no-mt` for å fjerne top-margin viss overskrifta er det første elementet. (Hugs: Bruk aldri desse klassane inni ferdigfarga element som `.box2-accent` eller `.banner-full` — bruk rene `<h1>` osv. der.)
- **Game hero-header:** Spel og minispel skal bruke ein hero-boks på menyskjermen sin slik at han forsvinn når spelet startar. Struktur:

  ```html
  <div class="box2 hero-box">
    <img src="../_resources/<spel>.png" alt="<Spel>" class="hero-logo">
    <div class="hero-text">
      <h1>Spelnamn</h1>
      <p>Kort beskriving.</p>
    </div>
  </div>
  ```

  `.box2.hero-box`-klassen handterer all stil (layout, padding, aksentbakgrunn, logo-storleik på 120px med drop-shadow) via `neobrutalisme.css`. Skriv ikkje inline-stilar her.

- **Boksar / containers:**
  - `.box1` (enkel, solid dropshadow)
  - `.box2` (asymmetrisk border-radius, skugge)
  - `.box3` (litt rotert design, med "teip"-effekt på toppen)
  - `.box4` (boks med header og innhald, krev inner-element `.box-header` og `.box-body`)
  - `.box5` (boks med tabs, krev `.box-tabs`, `.box-tab`, og `.box-body`)
- **Knappar:** Bruk klassen `.btn`. Kan utvidast med `.active` eller hover-effektar handtert av stilarket.
- **Kontrast på fargar (KRITISK):** Neobrutalisme-temaet har to tekst-på-bakgrunn-variablar med ulike formål:
  - `--text-on-accent` = **kvit** (`#ffffff`) — bruk berre på **mørke** bakgrunnar: `--accent`, `--accent2`, og faste mørke fargar.
  - `--text-on-light-accent` = **mørk** (`#1a1a1a`) — bruk på **lyse pastell-bakgrunnar**: `--accent3`, `--accent4`, `--accent5`, og faste lyse fargar som `#BAFCA2`, `#FFD166`, `#fef08a` osv.
  - Bruk **aldri** `color: var(--text)` eller `color: var(--border)` på element med fast bakgrunn — desse vekslar mellom svart og kvitt avhengig av temaet og kan gje usynleg tekst.
- **Modalar:** `.modal1` til `.modal5` i kombinasjon med ein `<div class="modal-overlay">`.
- **Ikon:** Bruk inline SVG-ar frå Lucide Icons. Aldri bruk emoji.
  - **Unntak — Dagsvegen:** Dagsplan-verktøyet `dagsvegen/` har eksplisitt godkjent unntak: emoji brukast som visuell representasjon av fag og innhald (kuratert liste i `dagsvegen/js/emoji.js`, ingen flagg-emoji pga. manglande Windows-støtte). Unntaket gjeld berre faginnhald — UI-chrome (knappar, verktøyrad) brukar framleis Lucide.

### 3.3 Fargetema
Designsystemet støttar fleire fargetema definerte i `css/neobrutalisme.css` under `[data-theme="..."]`-selektorane (autoritativ kjelde). Kvart spel skal setje eit standard lyst tema, eit mørkt tema og eit aktivt tema slik:

```html
<body data-light-theme="classic" data-dark-theme="space" data-theme="classic">
```

## 4. Arbeidsflyt for AI
Når du lagar eller modifiserer kode i dette prosjektet:
1. Sjekk at du ikkje bryt lagringsmønsteret for `localStorage` (bruk `VyrdepilStorage`).
2. Implementer design med komponentar frå `neobrutalisme.css`.
3. Sikre at layout er grid/flex og responsiv. Sjekk at det fungerer på mobil, små og mellomstore nettbrett, og store desktop-skjermar.
4. Pass på at UI og statiske tekstar er skrivne på nynorsk.
5. Oppdater personvern-lista på framsida viss lagringsbruken til eit spel endrar seg.
6. Still spørsmål og få avklaring dersom det er tvil om korleis noko skal løysast.

## 5. Kvalitet og kontroll

### 5.1 JS-arkitektur
Spel og verktøy med meir enn **~400 linjer JavaScript** skal splittast i fleire filer etter ansvarsområde (t.d. `state`, `render`, `input`, `storage`, `game`). Bruk **IIFE-mønster** med eksponerte modular — sjå `heimsank/js/` og `klassekart/js/` som referansar. Ein monolittisk ES6-klasse er greitt for kompakte verktøy under denne grensa.

### 5.2 JSON-eksport
Alle eksporterte data-objekt (lagra spel, quizzar, oppsett, kortsamlingar) skal innehalde to felt på toppnivå:

```json
{
  "app": "<spelnamn>",
  "version": 1,
  "...": "..."
}
```

Dette gjev ein migreringsveg når datastrukturen endrar seg, og let oss skilje filer frå ulike spel når brukarar importerer dei.

### 5.3 XSS / brukargenerert innhald
All tekst som kjem frå brukaren (lagra eller skriven inn no) skal renderast med `textContent` eller via ein `escapeHtml()`-hjelpar. **Ingen direkte `innerHTML` med dynamiske strenger.** Foretrekk DOM-API (`createElement`, `textContent`) når elementet inneheld brukargenerert innhald.

### 5.4 Tilgjenge (a11y)
- Ikon-knappar utan synleg tekst skal ha `aria-label`.
- Modal-overlay skal kunne lukkast med Escape-tasten.
- `:focus-visible`-stilar skal vere definerte for alle interaktive element (knappar, lenker, `input`, `select`, `textarea`).

### 5.5 Filstruktur
Alle spel/verktøy følgjer same struktur:

```
<spelnamn>/
  index.html          # inngangsside
  css/
    style.css         # spel-spesifikk stil (utvidar neobrutalisme.css)
  js/
    <modul>.js        # ein eller fleire JS-modular
```

Felles ressursar (logoar, ikon, lyd) ligg i `_resources/` på rot, eller i spelets eiga mappe når dei er spel-spesifikke.

### 5.6 Eksterne avhengnader
Nye avhengnader (bibliotek, CDN-script, fontar, ikon-pakkar) krev **eksplisitt godkjenning frå brukaren** før dei blir lagt til. **Vi skal aldri bruke eksterne font-bibliotek** — bruk alltid system-fontar med passande fallbackar. Når andre avhengnader er godkjende, skal dei anten:
- **Sjølv-hostast** i `_libs/` på rot (foretrekt for ekte offline-støtte), eller
- **Dokumenterast** i personvernseksjonen på framsida med kjelde og kva data som kan synast (t.d. IP-adresse i CDN-loggar).

**Hugs CSP-allowlista:** all ekstern ressurs (script, bilete, fontar, API/WebSocket) blir blokkert i produksjon om han ikkje står i `Content-Security-Policy` under `globalHeaders` i `staticwebapp.config.json`. Legg origin-en i rett direktiv (`script-src`, `img-src`, `connect-src` osv.). Vér særleg merksam på **redirect-kjeder**: Wikimedia-bilete går t.d. via `commons.wikimedia.org/wiki/Special:FilePath/…` som redirectar til `upload.wikimedia.org`, og **begge** origin-ane må stå i `img-src` fordi nettlesaren sjekkar CSP på kvart ledd. NB: ein `Content-Security-Policy-Report-Only`-header *rapporterer* berre brot — han *blokkerer* ikkje, så ei side kan sjå ut til å fungere i report-only og likevel knuse når CSP-en blir handheva. Test difor alltid mot den handheva headeren før du konkluderer.

### 5.7 Logoar og bilete
Ein logo blir vist lite. Kortet på framsida er 160px høgt, hero-boksen på ei spelside 120px, og oppføringa i toppmenyen 30px. Ei fil på 512px dekkjer alt dette med god margin på ein 2×-skjerm — men eksportar frå teikneprogram kjem gjerne på 2400px og fleire hundre kilobyte, og då dreg vi på oss megabyte som ingen får sjå. Difor:

- **Komprimer alltid ein ny logo før han blir teken i bruk.** Maks **384px** på lengste side, og lagra som PNG med **paletten redusert til 128 fargar**. Det gjev typisk 10–30 kB per logo mot 100–650 kB rått. I Pillow:

  ```python
  im = Image.open(src).convert("RGBA")
  r = 384 / max(im.size)
  if r < 1:
      im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
  # FASTOCTREE er den einaste kvantiseringa i Pillow som tek vare på alfakanalen
  im.quantize(colors=128, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(dst, optimize=True)
  ```

- **Legg originalen i `_kjelder/logoar/`.** Mappa er `.gitignore`-a, så originalane blir korkje publiserte eller drege med i repoet — dei ligg lokalt så vi kan lage større utgåver seinare om eit bruksområde krev det. Mappa finst difor ikkje på ein frisk klone; det er meint slik, og ingenting i koden skal peike på henne.

- **Éin storleik per logo.** Vi lagar ikkje eigne miniatyrar til menyen. Eit sett på 64px ville spart kring 390 kB på første opning av menyen, men kosta 26 ekstra filer som må haldast i takt for hand i eit prosjekt utan byggesteg. Gevinsten er ikkje verdt vedlikehaldet.

- Sprite-ark (t.d. `_resources/vyrde.png`) følgjer same tanken: skaler ned til det største visingsbehovet og kvantiser.

### 5.8 Compliance-pass
Ved endringar i denne fila (`AGENTS.md`) skal det gjerast eit kontroll-pass gjennom alle eksisterande spel og verktøy for å sikre at dei framleis følgjer reglane. Spel som ikkje gjer det skal merkast for oppgradering (t.d. i `CHANGELOG.md` eller som GitHub-issue).

## 6. Workflow

### 6.1 Commit-meldingar
Commit-meldingar skal skrivast på **nynorsk**. Eksempel:
- `Fiks emoji i footer på framsida`
- `Legg til responsiv Jeopardy-grid i Frødebrett`
- `Oppdater personvern-info for Heimsank`

### 6.2 CHANGELOG.md
Ein `CHANGELOG.md` på rot skal vedlikehaldast med eit fast format per versjon:

```
## [0.3] — 2026-MM-DD
### Lagt til
- ...
### Endra
- ...
### Fiksa
- ...
```

Oppdater CHANGELOG når du legg til nye spel/verktøy, gjer brytande endringar eller fiksar feil som påverkar brukaropplevinga.

### 6.3 Nettlesartesting
Verifiser i **Chrome** før merge til `main`. Sjekk:
- Sida lastar utan konsollfeil
- Hovudfunksjonalitet fungerer (start spel, lagre, navigere)
- Lyst og mørkt tema viser lesbar tekst overalt
- Responsivt på mobilbreidde (devtools)

Sjekklista skal køyrast på **preview-URL-en** frå pull requesten (§6.4), ikkje berre på `localhost`. Det er berre der `staticwebapp.config.json` — rutar, tryggingsheadarar og CSP — faktisk er i spel.

### 6.4 Branch- og deploy-flyt
Vyrdepil blir brukt i klasserom i skuletida. Ein utesta endring på `main` går rett i produksjon og kan velte ei undervisningsøkt. Difor:

**Ingen commits direkte på `main`.** Branchen er verna på GitHub, så direkte push blir avvist. Alt går gjennom pull request.

Branch-namn: `feat/<app>-<kort-skildring>` eller `fix/<app>-<kort-skildring>`, til dømes `feat/ordaklok-nye-lydar`.

```
lokalt (serve.ps1)  →  branch + PR  →  Azure preview-URL  →  merge  →  produksjon
```

1. **Lokalt:** `git checkout main; git pull; git checkout -b feat/…`, og køyr `serve.ps1` på `http://localhost:8081` medan du jobbar.
2. **Opne PR:** `git push -u origin HEAD` og `gh pr create --fill`.
3. **Preview:** Azure byggjer PR-en. URL-en står i loggen til deploy-jobben («Visit your site at: …») og har formatet `https://icy-water-0487ac303-<PR-nummer>.westeurope.2.azurestaticapps.net/`. Køyr sjekklista i §6.3 der, og opne URL-en på telefon eller nettbrett.
4. **Merge:** `gh pr merge --squash`. Produksjon (`https://icy-water-0487ac303.2.azurestaticapps.net/`) oppdaterer seg på eit par minutt, og preview-miljøet blir rydda bort av `close_pull_request_job`.
5. **Slett branchen etterpå:** `git push origin --delete <branch>`, når oppryddingsjobben har gått grønt. Ikkje bruk `--delete-branch` på merge-kommandoen — sjå under.

CHANGELOG-oppdateringa (§6.2) høyrer heime i **same PR** som endringa ho skildrar.

**Vit dette om preview-miljøa:**
- `localStorage` er per origin. Preview har eit anna domene enn produksjon, så du startar alltid med blanke ark. Det er bra for å teste førstegongsopplevinga, men det tyder at endringar i datastrukturen (`version`-feltet, §5.2) **ikkje** kan migreringstestast der — det må gjerast lokalt med kopiert `localStorage`.
- Preview-URL-ar er opne for den som har lenka. Uproblematisk her, men ikkje del dei som om dei var private.
- Gratisplanen tillèt tre samtidige preview-miljø. Blir kvota full, feilar deployen med «maximum number of staging environments» og PR-en får ingen URL.
- **Ikkje slett branchen i same operasjon som mergen.** `gh pr merge --delete-branch` fjernar branchen med det same, og då feilar `close_pull_request_job` med eit nake «BadRequest» frå Azure — miljøet blir liggjande att og et opp kvota. Merge først, sjekk at oppryddingsjobben er grøn, slett branchen etterpå.
- Eit ferskt preview-miljø gir sporadiske 404-ar dei første minutta før CDN-en er varm. Får du 404 på ei side du veit finst, last på nytt før du feilsøkjer.

**Rydde miljø for hand.** Ressursen heiter `Kjellovetestside` i ressursgruppa `Tetsressurser` — `icy-water-0487ac303` er berre det autogenererte vertsnamnet. Med Azure CLI (`az login`):

```bash
az staticwebapp environment list --name Kjellovetestside --resource-group Tetsressurser --output table
az staticwebapp environment delete --name Kjellovetestside --resource-group Tetsressurser --environment-name <PR-nummer> --yes
```

Miljøet `default` er produksjon og skal aldri slettast.
