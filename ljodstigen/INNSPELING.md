# Ljodstigen — innspelingsliste

> Generert av `lag_ljodstigen_lydliste.py`. Ikkje rediger for hand —
> endre `ljodstigen/js/letters.js` eller `words.js` og køyr skriptet på nytt.

## Status

| Bank | Treng | Spelt inn | Står att |
|---|---|---|---|
| fonem | 29 | 29 | ingen |
| namn | 29 | 29 | ingen |
| ord | 70 | 70 | ingen |
| ros | 13 | 13 | ingen |

Bygg banken på nytt når nye klipp er på plass:

```
python bygg_ljodstigen_lydbank.py
```

Skriptet tek med det som finst og seier frå om kva som manglar.

## Slik gjer du det

**Éin fil per klipp.** Filnamnet er id-en i tabellane under, med `.wav`
eller `.mp3`. Byggjeskriptet skøyter dei saman til fire lydsprites.

**Legg filene i `_kjelder/ljodstigen-lyd/<bank>/`** — altså `fonem/`,
`namn/`, `ord/` og `ros/`. Mappa er `.gitignore`-a, så råopptaka blir
aldri publiserte. Dei ligg lokalt så banken kan byggjast på nytt seinare.

**Same stemme, same mikrofon, same rom for heile settet.** Byter stemma
midt i eit sett, les elevane det som eit signal om at noko er annleis.

**Snakk roleg og vanleg.** Ikkje overtydeleg barnestemme — elevane skal
kjenne att lydane i vanleg tale.

Du kan spele inn i **Lydskurd** (`/lydskurd/`), som alt finst i Vyrdepil
og eksporterer MP3.

---

## 1. Fonem — bokstavlydane (29 klipp)

Dette er det viktigaste settet, og det einaste der uttalen er kritisk.

**Ingen schwa-hale.** /m/ skal vere ein hald m-lyd, ikkje «mø». Ein
etterhengt vokal øydelegg lyderinga: eleven får «mø-o-rø» i staden for
«mor», og då blir ikkje ordet til noko.

| Id | Bokstav | Type | Slik les du han |
|---|---|---|---|
| `f_a` | **a** | vokal | Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong. |
| `f_e` | **e** | vokal | Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong. |
| `f_l` | **l** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_m` | **m** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_o` | **o** | vokal | Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong. |
| `f_r` | **r** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_s` | **s** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_i` | **i** | vokal | Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong. |
| `f_k` | **k** | lukkelyd | Så kort som råd. Ikkje «be» eller «bø» — berre sjølve smellen. |
| `f_n` | **n** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_t` | **t** | lukkelyd | Så kort som råd. Ikkje «be» eller «bø» — berre sjølve smellen. |
| `f_v` | **v** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_d` | **d** | lukkelyd | Så kort som råd. Ikkje «be» eller «bø» — berre sjølve smellen. |
| `f_f` | **f** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_g` | **g** | lukkelyd | Så kort som råd. Ikkje «be» eller «bø» — berre sjølve smellen. |
| `f_u` | **u** | vokal | Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong. |
| `f_å` | **å** | vokal | Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong. |
| `f_b` | **b** | lukkelyd | Så kort som råd. Ikkje «be» eller «bø» — berre sjølve smellen. |
| `f_h` | **h** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_p` | **p** | lukkelyd | Så kort som råd. Ikkje «be» eller «bø» — berre sjølve smellen. |
| `f_y` | **y** | vokal | Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong. |
| `f_ø` | **ø** | vokal | Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong. |
| `f_c` | **c** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_j` | **j** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_q` | **q** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_w` | **w** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_x` | **x** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_z` | **z** | haldlyd | Hald 0,6–0,8 s. INGEN vokal på slutten. |
| `f_æ` | **æ** | vokal | Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong. |

> `c`, `q`, `w`, `x` og `z` er med for at alfabetet skal vere heilt.
> Les dei som dei blir uttalte i norske lånord: /s/ eller /k/ for `c`,
> /k/ for `q`, /v/ for `w`, /ks/ for `x`, /s/ for `z`.

---

## 2. Bokstavnamn (29 klipp)

Slik bokstaven **heiter**, ikkje lyden han lagar. Brukt når appen skal
snakke om ein bokstav i staden for å lyde han.

| Id | Bokstav | Du seier |
|---|---|---|
| `n_a` | **a** | «a» |
| `n_e` | **e** | «e» |
| `n_l` | **l** | «ell» |
| `n_m` | **m** | «emm» |
| `n_o` | **o** | «o» |
| `n_r` | **r** | «err» |
| `n_s` | **s** | «ess» |
| `n_i` | **i** | «i» |
| `n_k` | **k** | «kå» |
| `n_n` | **n** | «enn» |
| `n_t` | **t** | «te» |
| `n_v` | **v** | «ve» |
| `n_d` | **d** | «de» |
| `n_f` | **f** | «eff» |
| `n_g` | **g** | «ge» |
| `n_u` | **u** | «u» |
| `n_å` | **å** | «å» |
| `n_b` | **b** | «be» |
| `n_h` | **h** | «hå» |
| `n_p` | **p** | «pe» |
| `n_y` | **y** | «y» |
| `n_ø` | **ø** | «ø» |
| `n_c` | **c** | «se» |
| `n_j` | **j** | «je» |
| `n_q` | **q** | «ku» |
| `n_w` | **w** | «dobbel-ve» |
| `n_x` | **x** | «eks» |
| `n_z` | **z** | «sett» |
| `n_æ` | **æ** | «æ» |

---

## 3. Ord (70 klipp)

Les ordet **naturleg og heilt** — ikkje lydert, ikkje stava. Appen lyder
sjølv ordet ved å spele fonema etter kvarandre; dette klippet er fasiten
eleven skal kjenne att.

Kolonnen **NB** merkjer ord der ein bokstav ikkje seier den kanoniske
lyden sin — nesten alltid `o`, som er /u/ i *sol*, *mor*, *bok*, *god*.
Det er ikkje ein feil i lista, det er norsk rettskriving, og appen held
desse orda att til eleven har bygd nokre heilt regelrette ord først.
**Sjå gjerne over desse — du kjenner uttalen betre enn lista gjer.**

| Id | Ord | Steg | NB |
|---|---|---|---|
| `o_sol` | **sol** | 1 | `o` = annan lyd |
| `o_mor` | **mor** | 1 | `o` = annan lyd |
| `o_ler` | **ler** | 1 |  |
| `o_sal` | **sal** | 1 |  |
| `o_mas` | **mas** | 1 |  |
| `o_ras` | **ras** | 1 |  |
| `o_lam` | **lam** | 1 |  |
| `o_mel` | **mel** | 1 |  |
| `o_sel` | **sel** | 1 |  |
| `o_rom` | **rom** | 1 | `o` = annan lyd |
| `o_ros` | **ros** | 1 | `o` = annan lyd |
| `o_rose` | **rose** | 1 |  |
| `o_mose` | **mose** | 1 |  |
| `o_is` | **is** | 2 |  |
| `o_ti` | **ti** | 2 |  |
| `o_til` | **til** | 2 |  |
| `o_vin` | **vin** | 2 |  |
| `o_vil` | **vil** | 2 |  |
| `o_min` | **min** | 2 |  |
| `o_kan` | **kan** | 2 |  |
| `o_kam` | **kam** | 2 |  |
| `o_tak` | **tak** | 2 |  |
| `o_nase` | **nase** | 2 |  |
| `o_vase` | **vase** | 2 |  |
| `o_kake` | **kake** | 2 |  |
| `o_vise` | **vise** | 2 |  |
| `o_ost` | **ost** | 2 | `o` = annan lyd |
| `o_sint` | **sint** | 2 |  |
| `o_salt` | **salt** | 2 |  |
| `o_stol` | **stol** | 2 | `o` = annan lyd |
| `o_tre` | **tre** | 2 |  |
| `o_far` | **far** | 3 |  |
| `o_fem` | **fem** | 3 |  |
| `o_fin` | **fin** | 3 |  |
| `o_fot` | **fot** | 3 | `o` = annan lyd |
| `o_gul` | **gul** | 3 |  |
| `o_gås` | **gås** | 3 |  |
| `o_god` | **god** | 3 | `o` = annan lyd |
| `o_dag` | **dag** | 3 |  |
| `o_dal` | **dal** | 3 |  |
| `o_due` | **due** | 3 |  |
| `o_uke` | **uke** | 3 |  |
| `o_gate` | **gate** | 3 |  |
| `o_måne` | **måne** | 3 |  |
| `o_sofa` | **sofa** | 3 | `o` = annan lyd |
| `o_mus` | **mus** | 3 |  |
| `o_sur` | **sur** | 3 |  |
| `o_gris` | **gris** | 3 |  |
| `o_drage` | **drage** | 3 |  |
| `o_bil` | **bil** | 4 |  |
| `o_bok` | **bok** | 4 | `o` = annan lyd |
| `o_pil` | **pil** | 4 |  |
| `o_pose` | **pose** | 4 |  |
| `o_hus` | **hus** | 4 |  |
| `o_hår` | **hår** | 4 |  |
| `o_hest` | **hest** | 4 |  |
| `o_lys` | **lys** | 4 |  |
| `o_by` | **by** | 4 |  |
| `o_fly` | **fly** | 4 |  |
| `o_øre` | **øre** | 4 |  |
| `o_søt` | **søt** | 4 |  |
| `o_høne` | **høne** | 4 |  |
| `o_pen` | **pen** | 4 |  |
| `o_hale` | **hale** | 4 |  |
| `o_bål` | **bål** | 4 |  |
| `o_jul` | **jul** | 5 |  |
| `o_ja` | **ja** | 5 |  |
| `o_jente` | **jente** | 5 |  |
| `o_hær` | **hær** | 5 |  |
| `o_lære` | **lære** | 5 |  |

---

## 4. Ros og instruksjonar (13 klipp)

Varier tonefallet mellom rosklippa — dei blir spelte hundrevis av gonger,
og eit identisk «Bra!» kvar gong blir fort tomt.

Dei fire nedst er **oppmuntring ved feil svar**. Dei skal vere vennlege
og heilt utan skuffelse i stemma. Ein elev som høyrer at han skuffa
nokon, sluttar å prøve.

| Id | Du seier |
|---|---|
| `r_bra` | «Bra!» |
| `r_rett` | «Rett!» |
| `r_flott` | «Flott!» |
| `r_gjort` | «Godt gjort!» |
| `r_derja` | «Der, ja!» |
| `r_nettopp` | «Nettopp!» |
| `r_klarte` | «Du klarte det!» |
| `r_flink` | «Så flink du er!» |
| `r_prov` | «Prøv ein gong til.» |
| `r_nesten` | «Nesten. Høyr ein gong til.» |
| `r_saman` | «Ikkje heilt. Vi tek han saman.» |
| `r_vanskeleg` | «Den var vanskeleg. Sjå her.» |
| `r_okt` | «Økta er ferdig. Godt jobba!» |

---

## Samla

| Bank | Klipp |
|---|---|
| fonem | 29 |
| namn | 29 |
| ord | 70 |
| ros | 13 |
| **I alt** | **141** |

Rekna som ~0,8 s i snitt og 48 kbps mono blir det kring **676 kB** ferdig
pakka — godt innanfor det repoet toler.
