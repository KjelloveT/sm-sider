# Duldord — datagrunnlag

Skripta her blei køyrde **éin gong**, 2026-08-04, for å lage `../data/ord.js` og
`../data/gjettbare.json`. Dei ligg i repoet for at det skal gå an å sjå kvar
dataen kjem frå, ikkje fordi dei skal køyrast på nytt i vanleg drift.

## Åtvaring: ikkje regenerer `ord.js`

`gen-duldord.mjs` stokkar dei 365 fasitorda med eit fast frø. Køyrer du skriptet
på nytt med ei anna ordliste, eit anna frø eller ein annan `MIN_GAP`, får **alle
dagar nye ord** — òg dei som ligg bak i tid. Alle som har spelt får då eit arkiv
som ikkje stemmer med det dei faktisk løyste, og lagra resultat peikar på feil
ord. Skal det lagast ein ny årgang, lag ei **ny fil** og eit nytt startpunkt i
staden for å skrive over denne.

`gjettbare.json` er derimot trygg å byggje om: ho inneheld berre kva som blir
godteke som gjett, og påverkar ikkje kva ordet for ein gitt dag er.

## Kjelde

**Norsk Ordbank**, Språkbanken ved Nasjonalbiblioteket, lisens CC BY 4.0:

- Nynorsk 2012 — <https://www.nb.no/sprakbanken/ressurskatalog/oai-nb-no-sbr-41/>
- Bokmål 2005 — <https://www.nb.no/sprakbanken/ressurskatalog/oai-nb-no-sbr-5/>

Arkiva som blei brukte (utgåva frå 2022-02-01):

```
https://www.nb.no/sbfil/leksikalske_databaser/ordbank/20220201_norsk_ordbank_nno_2012.tar.gz
https://www.nb.no/sbfil/leksikalske_databaser/ordbank/20220201_norsk_ordbank_nob_2005.tar.gz
```

Sjølve arkiva ligg ikkje i repoet — berre dei ferdig filtrerte listene.

## Slik blei det gjort

1. Pakk ut begge arkiva ved sida av `bygg-ordlister.ps1`, i mappene `nno/` og `nob/`.
   Fila `fullformer_2012.txt` (nynorsk) og `fullformsliste.txt` (bokmål) er
   tabseparerte og **Latin-1-koda**; kolonne 3 er ordforma, kolonne 4 er ordklassetagg.
2. Køyr `bygg-ordlister.ps1`. Han skriv to filer:
   - `duldord-gjettbare.json` — nynorske ord på nøyaktig fem teikn → `../data/gjettbare.json`
   - `ordsmia-ordliste.json` — nynorsk + bokmål, 2–9 teikn → `../../ordsmia/norsk_ordliste.json`
3. Køyr `gen-duldord.mjs` (Node) for å stokke og obfuskere fasitorda og slå
   saman gjettelista med dei 365 orda.

### Fella som øydela den førre lista

Den gamle `ordsmia/norsk_ordliste.json` mangla **alle** ord med æ, ø og å.
Årsaka er verdt å hugse: Windows PowerShell 5.1 les ei `.ps1`-fil utan BOM som
ANSI, så eit filter skrive som `'^[a-zæøå]+$'` blir mojibake når skriptet blir
lasta, og kastar bort nettopp dei orda det skulle sleppe gjennom. `bygg-ordlister.ps1`
byggjer difor teiknklassen frå teiknkodar (`[char]0xE6` osv.) i staden for
literalar. Endrar du skriptet, hald deg til det — eller lagre fila med BOM.
