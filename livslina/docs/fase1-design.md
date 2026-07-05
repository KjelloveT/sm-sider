# Livslina — fase 1: Vidaregåande (detaljert design)

> Status: designdokument, godkjent stilguide ligg i `../stilguide/`. Tal-referansar
> peikar på nøklar i `../data/grunndata.json` — ingen kronebeløp skal hardkodast i spelkoden.

## 1. Mål for fasen

Spelaren styrer ein 16-åring gjennom tre år på vidaregåande (VG1–VG3). Fasen skal
lære bort, utan å preike:

1. **Små faste val har stor sum over tid** (laurdagsjobb, forbruksprofil, sparing).
2. **Buffer avgjer korleis uhell kjenneste** — same hending, heilt ulik konsekvens med og utan sparepengar.
3. **Forsikring og eigenrisiko** i miniformat (mobilforsikring vs. skjermbyte).
4. **Trivsel og energi er òg valuta** — maksimal jobbing gjev pengar, men kostar karakterar og trivsel.
5. **Linjevalet formar moglegheitene** i fase 2 (studiekompetanse vs. fagbrev-veg og læreplass med løn).

## 2. Rundestruktur

Fase 1 har **6 hovudrundar** (skulehalvår) med **sommar-mellomspel** mellom skuleåra:

| # | Runde | Alder | Særhendingar |
|---|-------|-------|--------------|
| 1 | VG1 haust | 16 | Oppstartsval; moped-avgjerd mogleg |
| — | Sommar 1 | 16–17 | Sommarjobb-val |
| 2 | VG1 vår | 17 | |
| 3 | VG2 haust | 17 | Russebuss-avgjerda kjem (påmelding skjer tidleg!) |
| — | Sommar 2 | 17–18 | Sommarjobb-val |
| 4 | VG2 vår | 18 | 18-årsdag: BSU og førarkort blir tilgjengeleg |
| 5 | VG3 haust | 18 | Yrkesfag: søkje læreplass; studiespes: søkje studium |
| 6 | VG3 vår | 19 | Russetid, eksamen → overgang til fase 2 |

**Kvar hovudrunde har fire steg:**

1. **Budsjettkortet** — spelaren ser planlagde inntekter/utgifter for halvåret og justerer dei faste vala (jobb, fritid, forbruksprofil, fast sparetrekk).
2. **Halvåret spelar seg av** — månad for månad tikkar over skjermen i rask animasjon; kontosaldoen oppdaterer seg.
3. **Hendingar** — 0–2 hendingskort avbryt avspelinga og krev val (sjå kap. 7).
4. **Halvårsoppgjeret** — oppsummering: saldo, sparing, trivsel, energi, karaktersnitt, og éi linje «visste du at»-fakta knytt til noko spelaren gjorde.

**Sommar-mellomspelet** er eitt enkelt skjermbilete: vel sommarjobb (0/3/6 veker,
`work.summerJob`), sjå løna kome inn, eitt mogleg hendingskort.

## 3. Oppstartsval (runde 0)

1. **Karakter** — paper doll-tilpassing frå stilguiden (hud, hår, klede). Kjønnsnøytral figur; SIFO-satsar blir midla (`gameValue`-felta).
2. **Familieøkonomi** — trong / vanleg / romsleg (`family.profiles`). Påverkar startkapital, lommepengar/foreldrebidrag og inntektsavhengig stipend. Presenterast som «slik er utgangspunktet ditt» — ikkje eit fritt val å optimalisere, men trekt tilfeldig med mogleg overstyring i innstillingar for klasseromsbruk.
3. **Linjeval** — sjå kap. 4.
4. **Busituasjon** — bu heime eller på hybel. Hybel er berre aktuelt (og gjev bortebuarstipend) om spelaren vel ei linje som ikkje finst i heimkommunen — spelet trekkjer dette ut frå linjevalet, slik at hybel kjennest motivert, ikkje som eit reint økonomival.

## 4. Linjeval og konsekvensar

| Linje | Utstyrsstipend (`grants.equipmentGrantPerYear`) | Hybel-sjanse | Veg i fase 2 |
|---|---|---|---|
| Studiespesialisering | sats 1 | låg | studium (krev karaktersnitt) |
| Helse- og oppvekstfag | sats 3 | middels | læreplass (helsefagarbeidar) |
| Idrettsfag | sats 3 | middels | studium |
| Elektro og datateknologi | sats 5 | middels | læreplass (elektrikar — godt betalt) |
| Bygg- og anleggsteknikk | sats 5 | middels | læreplass |
| Naturbruk | sats 5 | høg (ofte internat) | læreplass/studium |

- Yrkesfaga gjev **VG3 = læretid-start**: hausten i runde 5 handlar om å søkje læreplass. Karaktersnitt og fråvær påverkar sjansen (kompetanse-statistikken).
- Studiespesialisering gjev **studieval** i runde 5 og opnar studielånet i fase 2.
- Alle linjer kan fullførast; det finst ingen «feil» linje. Sluttoppsummeringa i fase 4 skal vise at ulike vegar gjev ulike kurver, ikkje at éi er fasit.

## 5. Statistikkar

| Stat | Start | Skala | Endrast av |
|---|---|---|---|
| **Konto** | `family.profiles.*.startCapital` | kr | alt økonomisk |
| **Sparekonto/BSU** | 0 | kr | fast sparetrekk, renter (`savings`) |
| **Trivsel** | 60 | 0–100 | fritidsaktivitetar (+), vener/hendingar (±), null fritid (−), pengestress (− når saldo < 0) |
| **Energi** | 70 | 0–100 | jobbtimar (−), aktivitetar (litt −), søvn/roleg halvår (+) |
| **Karaktersnitt** | 3,5 | 1–6 | energi under 40 (−0,3/halvår), jobb 12 t/veke (−0,2), leksefokus-val (+), moped-fråvær-hending (−) |

Trivsel under 25 eller energi under 20 utløyser eit varselkort («Du er sliten.
Noko må vike») som tvingar fram eit justeringsval — spelet skal aldri straffe i det stille.

## 6. Økonomiflyt per månad

**Inntekter**
- Laurdagsjobb: timar/veke × 4,33 × timeløn (`work.hourlyWageUnder18` før 18-årsdagen i runde 4, deretter `work.hourlyWage18plus`)
- Lommepengar (heimebuande) eller foreldrebidrag (hybel): `family.profiles`
- Bortebuarstipend (hybel): `grants.housingGrantPerMonth`, 10 mnd/år
- Inntektsavhengig stipend: `grants.incomeDependentGrantPerMonth` etter familieprofil
- Utstyrsstipend: eingongsutbetaling kvar haust (runde 1, 3, 5)

**Faste utgifter (heimebuande)**
- Klede (`monthlyCosts.clothing`), personleg pleie, leik og mediebruk, mobil — justert med forbruksprofil (sjå under)
- Kollektivkort (`monthlyCosts.publicTransportYouth`) — fell bort med moped
- Valde fritidsaktivitetar (`leisure.*`)

**Faste utgifter (hybel, i tillegg)**
- Husleige (`housing.hybelRent`), mat (`monthlyCosts.food`), hushaldsutgifter (`householdCostsSinglePerson`: dagligvarer + husholdningsartiklar + mediebruk/internett; møblar-posten er med frå månad 2)

**Forbruksprofil** (vel per halvår, gjeld klede + leik/mediebruk):
- Nøysam: 70 % av SIFO-sats, −2 trivsel/mnd
- SIFO-nivå: 100 %
- Raus: 140 %, +2 trivsel/mnd

Poenget som skal fram i ettertanke-loggen: skilnaden mellom nøysam og raus er
~1 100 kr/mnd — over tre år er det over 40 000 kr, men trivselen har òg ein pris.

**Skatt:** summert årsinntekt under `tax.taxFreeCardLimit` → trekkfritt. Over → 25 %
på overskytande (`tax.simplifiedRule`). Frikortet skal visast eksplisitt i UI når
sommarjobb + mykje deltid nærmar seg grensa.

**Sparing:** valfritt fast månadstrekk (0 / 250 / 500 / 1 000 kr). Frå runde 4 (fylt 18)
kan trekket gå til BSU (`savings.bsu`) — spelet forklarer at skattefrådraget ikkje
verkar så lenge ein tener under frikortgrensa, men at renta åleine løner seg.

## 7. Hendingskort

Vekta trekning: kvart halvår blir det trekt 0–2 kort frå bunken av kort som har
vilkåra oppfylte. Kort med `once` kan berre kome éin gong per gjennomspeling.
Positive og negative kort skal blandast om lag 40/60.

| Id | Vilkår | Tekst (stikkord) | Val og konsekvens |
|---|---|---|---|
| `mobil-knust` | alltid | Mobilen i asfalten | Byt skjerm (`events.phoneScreenRepair`) / brukt mobil (`events.phoneReplacementUsed`) / lev med sprekken (−3 trivsel/mnd resten av året). Har spelaren mobilforsikring: eigendel 500 kr |
| `mobilforsikring-tilbod` | runde 1–2, once | Butikken tilbyr skjermforsikring | Teikn (`events.phoneInsurancePerMonth`) / takk nei. Reint sannsynsval — kortet lærer omgrepet eigenrisiko |
| `sykkel-stolen` | ikkje moped | Sykkelen borte frå stativet | Kjøp brukt (`events.stolenBike`) / gå og buss (kollektivkort-kostnad, −2 trivsel) |
| `klassetur` | runde 2 eller 3, once | Eigendel klassetur | Betal (`events.classTripContribution`) / stå over (−6 trivsel) |
| `pc-uhell` | alltid | Kaffi i tastaturet | Reparer (`events.brokenLaptop`) / lån skulens reserve-PC (−0,1 karakter i halvåret) |
| `fartsbot` | har moped | Kontroll ved skulen | Bot (`events.speedingFineMoped`), −2 trivsel. Vekta opp om spelaren valde «trimma moped» i moped-kortet |
| `trimma-moped` | kjøper moped, once | Seljaren tilbyr trimma variant billegare | Takk ja (−2 000 kr på kjøpet, men opnar `trimma-avslort`-kortet) / takk nei |
| `trimma-avslort` | valde trimma | Politikontroll avslører trimminga | `events.trimmedMopedFine` + mister førarbeviset i 3 mnd (kollektivkort igjen) |
| `venegjeng-konsert` | alltid | Alle skal på konsert | Bli med (`leisure.concertTicket`, +6 trivsel) / stå over (−4 trivsel) |
| `sommarjobb-tips` | sommar 1, once | Naboen tipsar om ekstravakter | Ta vaktene (+40 t × timeløn, −10 energi) / nei |
| `ekstravakter-jul` | runde 1/3/5 (haust) | Butikken treng julehjelp | +25 t × timeløn, −8 energi / nei |
| `stipend-purring` | hybel, once | Du gløymde å søkje stipend i tide | Første stipendutbetaling forseinka éin månad — bufferen avgjer om det svir (reint informasjonskort om saldo) |
| `hybel-depositum` | flyttar på hybel, once | Utleigar krev depositum | −6 000 kr låst (kjem att i fase 2); familie hjelper ved trong økonomi-profil med lån som skal betalast attende |
| `russebuss-paamelding` | runde 3, once, studiespes/idrett | Gjengen planlegg buss | Bli med (`leisure.russBus` fordelt over 4 halvår) / rimeleg russetid seinare (`leisure.russMinimal` i runde 6) / droppe (−5 trivsel no, +5 i runde 6 om økonomien er god) |
| `russebuss-sprekk` | valde buss | Bussprosjektet sprekk på budsjett | +8 000 kr ekstra andel (ingen exit — lærdom: forpliktingar bind) |
| `bestemor-bursdag` | alltid | Pengegåve til bursdagen | +1 000 kr, +2 trivsel |
| `skatt-att` | tente over frikort i fjor | Skatteoppgjeret | Får att for mykje trekt skatt (+beløp) — kortet forklarer skattemelding |
| `tannlege-19` | runde 6 (fylt 19) | Første tannlegerekning | `events.dentistYoungAdult` — kortet fortel at gratis-ordninga tek slutt |
| `laereplass-intervju` | yrkesfag, runde 5 | Intervju til læreplass | Førebu deg (−5 energi, +sjanse) / ta det på sparket. Utfallet avgjer lærlingløn-nivået i fase 2 |
| `eksamenstrekk` | runde 6 | Trekt ut i munnleg | Les heile helga (−8 energi, +0,2 karakter) / satse på flaks (50/50 ±0,2) |

## 8. Moped-avgjerda (runde 1–2)

Eige avgjerdskort, ikkje tilfeldig — dukkar opp når saldoen først passerer ~15 000 kr
eller ved starten av runde 2:

- **Kostnad:** kjøp (`transport.usedMoped`) + førarbevis (`transport.mopedLicenseCourse`) + utstyr (`transport.helmetAndGear`) + forsikring (`transport.mopedInsurancePerYear`) + drift (`transport.mopedFuelPerMonth`)
- **Gevinst:** +8 trivsel eingong, +2 trivsel/mnd, sparer kollektivkortet, opnar nokre hendingskort (fartsbot, trimming) 
- **Ettertanke-poeng:** total moped-kostnad over to år ≈ 30 000 kr — sluttrapporten viser kva sparesaldoen hadde vore utan.

## 9. Overgang til fase 2

Ved slutten av runde 6 blir dette med vidare (og logga til ettertanke-rapporten):

- Konto + sparekonto/BSU-saldo, total inntekt og totalforbruk per kategori
- Linje, karaktersnitt, fullført/ikkje fullført, ev. læreplass og lønsnivå
- Trivsels- og energihistorikk (kurve per halvår)
- Liste over dei 5 vala med størst økonomisk konsekvens («vendepunkt»), med kontrafaktisk sum («utan bussprosjektet hadde du hatt 68 000 kr på konto»)

## 10. Kva som IKKJE er med i fase 1 (medvite)

- Kredittkort og forbrukslån (kjem i fase 2, der dei er realistisk tilgjengelege frå 18 år — men 18-årsdagen i runde 4 kan så eit frø med eit «førehandsgodkjend kreditt»-brev spelaren kan takke nei til)
- Aksjar/fond (fase 2)
- Kjærast/familie-hendingar utover venegjengen (fase 2–3)
- Val av bustad utover heime/hybel

## 11. Teknisk minimum (berre det som bind designet)

- All talhenting frå `livslina/data/grunndata.json`; spel-logikken refererer nøklar, aldri kronebeløp
- Lagring via `VyrdepilStorage` (éi lagra gjennomspeling + innstillingar); eksport med `app`/`version`-felt
- Personvern-lista på framsida må oppdaterast når spelet får lagring
- Kjelde og prisår (`priceLevelNote`) skal vere synleg i spelet, t.d. i info-modal: «Tala byggjer på SIFOs referansebudsjett 2025, Lånekassen 2025–2026 og Skatteetaten 2026»
