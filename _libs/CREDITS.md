# Sjølv-hosta tredjepartsbibliotek

Alle bibliotek her blir lasta frå vår eigen tenar. Ingen av dei gjer kall ut
på nettet, og ingen brukardata forlèt nettlesaren fordi dei er i bruk.

Jf. `AGENTS.md` §5.6: nye avhengnader krev eksplisitt godkjenning frå
brukaren og skal sjølv-hostast her.

## lamejs 1.2.1 — `lamejs.min.js`

MP3-enkodar i rein JavaScript, brukt av **Lydskurd** til å lagre miksen som
mp3. Utan han kan vi berre skrive WAV, som blir fem–ti gonger så stort.

| | |
|---|---|
| Prosjekt | [lamejs](https://github.com/zhuker/lamejs) av Alex Zhukov |
| Bygd på | [LAME](https://lame.sourceforge.net/) |
| Lisens | LGPL-3.0 — sjå `lamejs-LICENSE.txt` |
| Versjon | 1.2.1 |
| Henta frå | npm-registeret (`npm pack lamejs`), 2026-07-30 |
| Storleik | 156 043 byte |
| SHA-256 | `15d285e2587b3bdbfd18a68de6ce07cc074f7480a82c3815da2dc1c348ec6df4` |
| Endra av oss | Nei — fila ligg slik ho kom frå pakka |

LGPL-vilkåra frå LAME er oppfylte slik: biblioteket ligg som ei sjølvstendig
fil som blir lenka inn, ikkje bakt inn i vår eigen kode; LAME er kreditert
her og i personvernoversikta; og vi har ikkje gjort endringar som må
leverast tilbake. Gjer vi endringar seinare, må dei publiserast under LGPL.

Godkjend av brukaren under planlegginga av Lydskurd.

## Pyodide 314.0.4 — `pyodide/`

CPython 3.14 kompilert til WebAssembly. Sjølve Python-motoren i
**Ormritaren**. Køyrer heilt i nettlesaren, så elevkode blir aldri send
nokon stad.

| | |
|---|---|
| Prosjekt | [Pyodide](https://pyodide.org/) |
| Lisens | MPL-2.0 (Pyodide) og PSF-lisensen (CPython og standardbiblioteket) |
| Versjon | 314.0.4 (versjonstalet følgjer CPython — 314 = Python 3.14) |
| Henta frå | `https://cdn.jsdelivr.net/pyodide/v314.0.4/full/`, 2026-08-14 |
| Endra av oss | Nei |

| Fil | Byte | SHA-256 |
|---|---|---|
| `pyodide.mjs` | 17 931 | `c75dd73bb0c70674135f9f4ab746c9b5316e9fe027cafacb2be445e658f04c92` |
| `pyodide.asm.mjs` | 1 249 500 | `fd7a3cefa122ff6463dcf2997961eb341250e4cc4ed60281448390f0a767cca2` |
| `pyodide.asm.wasm` | 9 596 386 | `6c8986a8ee583401069aa403e76ee79d4633a1478ab11cea76030bc299aded9f` |
| `python_stdlib.zip` | 2 545 198 | `b5ca2308e9fa72eda319889a1ddf086389e9f1234ced279cc71267fe9ba56e54` |
| `pyodide-lock.json` | 113 804 | `c963d22858f6bcb8f41586a2142f03905ab370c88ea22a86a2736e95fac2a8f3` |

### Ferdigbygde hjul i same mappa

Ormritaren lèt eleven bruke eit **kuratert** sett bibliotek. Hjula ligg her,
og Pyodide hentar dei frå vår eigen tenar når koden importerer dei. Vi kallar
aldri PyPI, og eleven kan ikkje skrive inn eit vilkårleg pakkenamn — skal eit
nytt bibliotek inn, må hjulet leggjast her og førast opp i
`ormritaren/js/packages.js`, altså gjennom ein pull request.

Hjula er henta frå same distribusjonen som kjernen og har lisensane sine frå
oppstraums (BSD-3-Clause for numpy, matplotlib, contourpy, cycler, kiwisolver,
python-dateutil, six og pytz; MIT for fonttools, pyparsing og packaging;
MIT-CMU for pillow).

| Pakke | Versjon | Storleik |
|---|---|---|
| numpy | 2.4.3 | 2,92 MB |
| matplotlib | 3.10.8 | 6,97 MB |
| fonttools | 4.62.1 | 1,15 MB |
| pillow | 12.2.0 | 1,04 MB |
| pytz | 2026.1.post1 | 0,51 MB |
| python-dateutil | 2.9.0.post0 | 0,23 MB |
| contourpy | 1.3.3 | 0,12 MB |
| pyparsing | 3.3.2 | 0,12 MB |
| packaging | 26.1 | 0,10 MB |
| kiwisolver | 1.5.0 | 0,04 MB |
| cycler | 0.12.1 | 0,01 MB |
| six | 1.17.0 | 0,01 MB |

Samla 13,2 MB. Alt utanom numpy er der fordi matplotlib treng det —
avhengnadene er løyste ut frå `pyodide-lock.json`, som Pyodide bruker til å
hente rett sett når eleven skriv `import matplotlib`.

`turtle` står ikkje her: Pyodide har han ikkje (stdlib-versjonen krev tkinter),
så han er skriven av oss i `ormritaren/py/turtle.py`.

**Versjonen er pinna med vilje.** Repoet har ikkje Git LFS, så kvar
oppgradering legg ~13 MB nye blobbar i historikka for alltid. Oppgrader
berre når det er ein reell grunn — ikkje for å liggje på siste versjon.
Byter du versjon, må `Cache-Control: immutable` på `/_libs/pyodide/*` i
`staticwebapp.config.json` framleis stemme: filnamna er dei same, så gamle
elevmaskiner kan sitje att med gammal wasm til cachen går ut. Skift då
mappenamn (t.d. `_libs/pyodide-315/`) i staden for å byte innhald.

Godkjend av brukaren under planlegginga av Ormritaren.

## CodeMirror 5.65.21 — `codemirror/`

Kodeeditoren i **Ormritaren**: syntaksfarging, linjenummer, innrykk og
parentesmatching.

Vi bruker versjon 5, ikkje 6, fordi CodeMirror 6 er distribuert som
ESM-modular som må bundlast — og Vyrdepil har ikkje noko byggesteg.
Versjon 5 er éi UMD-fil som kan lenkast inn direkte.

| | |
|---|---|
| Prosjekt | [CodeMirror 5](https://codemirror.net/5/) av Marijn Haverbeke m.fl. |
| Lisens | MIT |
| Versjon | 5.65.21 |
| Henta frå | `https://cdn.jsdelivr.net/npm/codemirror@5.65.21/`, 2026-08-14 |
| Endra av oss | Nei — temafargane ligg i `ormritaren/css/style.css`, ikkje i biblioteket |

| Fil | Byte | SHA-256 |
|---|---|---|
| `codemirror.js` | 402 055 | `e98aac5ffa07bae58acd4ff07c4293059f8921c0ae0eba506929d8c6f41c9288` |
| `codemirror.css` | 8 720 | `eb494ea972d2661ef86f7f6ac656dd6786d721e49c9c1b46e1eb967e4b6f9bf3` |
| `mode/python/python.js` | 14 984 | `19a59ca387addb04e95002c9adbe2b8c231427ce49369ac537107e3088a6947c` |
| `addon/edit/matchbrackets.js` | 6 815 | `9d23a177f1e4d07e3acc37c210ffbe4c1c2eb4d55bbe54c16d3e7ad3d04d0401` |
| `addon/edit/closebrackets.js` | 7 123 | `143c3014c29254f3531cc30be6d90205084bcfc36cffa6f9b2a46fd42a40be20` |
| `addon/comment/comment.js` | 9 230 | `a65c038258c6541658a0e9f24c56c78255e0e20d4cf06aa9ad83342069a589be` |
| `addon/selection/active-line.js` | 2 509 | `3afbcf78835c9bdc342e3992c53d9b74286722613bb1a8adc9d140edc8737ee8` |
| `addon/hint/show-hint.js` | 19 792 | `6d940e45a07c13abd1e872802ba20f91f809d4b583afcd58a8058e25c7f0cfce` |
| `addon/hint/show-hint.css` | 649 | `9058c1c14fcdae199b490bb6214f36a216b9ce84d7df2084830ebb6a60337651` |

`show-hint` er berre sjølve nedtrekkslista. CodeMirror 5 har ingen
Python-hjelpar, så forslaga kjem frå vår eigen `ormritaren/js/autocomplete.js`
— ei kuratert liste med forklaringar på nynorsk.

Godkjend av brukaren under planlegginga av Ormritaren.
