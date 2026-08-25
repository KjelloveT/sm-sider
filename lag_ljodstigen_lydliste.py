#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Lagar innspelingslista til Ljodstigen ut frå datalaget i js/.

Lista blir GENERERT, ikkje skriven for hand. Bokstavane og orda ligg i
ljodstigen/js/letters.js og words.js, og ei handskriven liste ville før
eller seinare kome ut av takt med dei — og då manglar det ei lydfil som
ingen oppdagar før ein elev sit framfor ei stum oppgåve.

    python lag_ljodstigen_lydliste.py

Skriv:
    ljodstigen/INNSPELING.md        lista til den som skal lese inn
    ljodstigen/lyd/manifest.json    id -> tekst, for byggjeskriptet

Begge blir commita. Sjølve råopptaka gjer det ikkje: dei ligg i
_kjelder/ljodstigen-lyd/, som er gitignore-a.
"""
import json
import re
import io
import os

ROT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROT, 'ljodstigen')
JS = os.path.join(APP, 'js')

# ── Les datalaget ────────────────────────────────────────────────

def les(fil):
    return io.open(os.path.join(JS, fil), encoding='utf-8').read()


def bokstavsteg():
    """STEPS-tabellen frå letters.js."""
    kjelde = les('letters.js')
    blokk = re.search(r'const STEPS = \[(.*?)\];', kjelde, re.S).group(1)
    steg = []
    for rad in re.findall(r'\[(.*?)\]', blokk, re.S):
        steg.append(re.findall(r"'(.)'", rad))
    return steg


def ord_liste():
    """RAW-tabellen frå words.js: (ord, trøblete bokstavar)."""
    kjelde = les('words.js')
    blokk = re.search(r'const RAW = \[(.*?)\n  \];', kjelde, re.S).group(1)
    ut = []
    for tekst, tricky in re.findall(r"\['([^']+)',\s*\[([^\]]*)\]\]", blokk):
        ut.append((tekst, re.findall(r"'(.)'", tricky)))
    return ut


def ros_ider():
    """PRAISE og NUDGE frå render.js."""
    kjelde = les('render.js')
    ros = re.findall(r"'(r_[a-zæøå]+)'", kjelde)
    # behald rekkjefølgja, fjern duplikat
    sett, ut = set(), []
    for i in ros:
        if i not in sett:
            sett.add(i)
            ut.append(i)
    return ut


# ── Tekstane som skal lesast ─────────────────────────────────────

# Instruksjonar og ros. Nøklane må stemme med render.js og main.js.
ROS_TEKST = {
    'r_bra':        'Bra!',
    'r_rett':       'Rett!',
    'r_flott':      'Flott!',
    'r_gjort':      'Godt gjort!',
    'r_derja':      'Der, ja!',
    'r_nettopp':    'Nettopp!',
    'r_klarte':     'Du klarte det!',
    'r_flink':      'Så flink du er!',
    'r_prov':       'Prøv ein gong til.',
    'r_nesten':     'Nesten. Høyr ein gong til.',
    'r_saman':      'Ikkje heilt. Vi tek han saman.',
    'r_vanskeleg':  'Den var vanskeleg. Sjå her.',
    'r_okt':        'Økta er ferdig. Godt jobba!',
}

# Bokstavnamn: slik bokstaven HEITER, ikkje lyden han lagar.
NAMN = {
    'a': 'a', 'b': 'be', 'c': 'se', 'd': 'de', 'e': 'e', 'f': 'eff',
    'g': 'ge', 'h': 'hå', 'i': 'i', 'j': 'je', 'k': 'kå', 'l': 'ell',
    'm': 'emm', 'n': 'enn', 'o': 'o', 'p': 'pe', 'q': 'ku', 'r': 'err',
    's': 'ess', 't': 'te', 'u': 'u', 'v': 've', 'w': 'dobbel-ve',
    'x': 'eks', 'y': 'y', 'z': 'sett', 'æ': 'æ', 'ø': 'ø', 'å': 'å',
}

VOKALAR = set('aeiouyæøå')
LUKKE = set('ptkbdg')


def lydtype(ch):
    if ch in VOKALAR:
        return 'vokal'
    if ch in LUKKE:
        return 'lukkelyd'
    return 'haldlyd'


RAAD = {
    'vokal':     'Hald 0,5–0,7 s. Rein vokal, ikkje dra mot ein diftong.',
    'haldlyd':   'Hald 0,6–0,8 s. INGEN vokal på slutten.',
    'lukkelyd':  'Så kort som råd. Ikkje «be» eller «bø» — berre sjølve smellen.',
}


def main():
    steg = bokstavsteg()
    ord = ord_liste()
    ros = ros_ider() + ['r_okt']

    steg_for = {}
    for i, sett in enumerate(steg, 1):
        for ch in sett:
            steg_for[ch] = i
    alfabet = sorted(steg_for, key=lambda c: (steg_for[c], c))

    manifest = {'fonem': {}, 'namn': {}, 'ord': {}, 'ros': {}}
    L = []
    A = L.append

    A('# Ljodstigen — innspelingsliste\n')
    A('> Generert av `_kjelder/lag_innspelingsliste.py`. Ikkje rediger for hand —')
    A('> endre `ljodstigen/js/letters.js` eller `words.js` og køyr skriptet på nytt.\n')

    A('## Slik gjer du det\n')
    A('**Éin fil per klipp.** Filnamnet er id-en i tabellane under, med `.wav`')
    A('eller `.mp3`. Byggjeskriptet skøyter dei saman til fire lydsprites.\n')
    A('**Legg filene i `_kjelder/ljodstigen-lyd/<bank>/`** — altså `fonem/`,')
    A('`namn/`, `ord/` og `ros/`. Mappa er `.gitignore`-a, så råopptaka blir')
    A('aldri publiserte. Dei ligg lokalt så banken kan byggjast på nytt seinare.\n')
    A('**Same stemme, same mikrofon, same rom for heile settet.** Byter stemma')
    A('midt i eit sett, les elevane det som eit signal om at noko er annleis.\n')
    A('**Snakk roleg og vanleg.** Ikkje overtydeleg barnestemme — elevane skal')
    A('kjenne att lydane i vanleg tale.\n')
    A('Du kan spele inn i **Lydskurd** (`/lydskurd/`), som alt finst i Vyrdepil')
    A('og eksporterer MP3.\n')

    A('---\n')
    A('## 1. Fonem — bokstavlydane (%d klipp)\n' % len(alfabet))
    A('Dette er det viktigaste settet, og det einaste der uttalen er kritisk.\n')
    A('**Ingen schwa-hale.** /m/ skal vere ein hald m-lyd, ikkje «mø». Ein')
    A('etterhengt vokal øydelegg lyderinga: eleven får «mø-o-rø» i staden for')
    A('«mor», og då blir ikkje ordet til noko.\n')
    A('| Id | Bokstav | Type | Slik les du han |')
    A('|---|---|---|---|')
    for ch in alfabet:
        t = lydtype(ch)
        manifest['fonem']['f_' + ch] = ch
        A('| `f_%s` | **%s** | %s | %s |' % (ch, ch, t, RAAD[t]))
    A('')
    A('> `c`, `q`, `w`, `x` og `z` er med for at alfabetet skal vere heilt.')
    A('> Les dei som dei blir uttalte i norske lånord: /s/ eller /k/ for `c`,')
    A('> /k/ for `q`, /v/ for `w`, /ks/ for `x`, /s/ for `z`.\n')

    A('---\n')
    A('## 2. Bokstavnamn (%d klipp)\n' % len(alfabet))
    A('Slik bokstaven **heiter**, ikkje lyden han lagar. Brukt når appen skal')
    A('snakke om ein bokstav i staden for å lyde han.\n')
    A('| Id | Bokstav | Du seier |')
    A('|---|---|---|')
    for ch in alfabet:
        manifest['namn']['n_' + ch] = NAMN[ch]
        A('| `n_%s` | **%s** | «%s» |' % (ch, ch, NAMN[ch]))
    A('')

    A('---\n')
    A('## 3. Ord (%d klipp)\n' % len(ord))
    A('Les ordet **naturleg og heilt** — ikkje lydert, ikkje stava. Appen lyder')
    A('sjølv ordet ved å spele fonema etter kvarandre; dette klippet er fasiten')
    A('eleven skal kjenne att.\n')
    A('Kolonnen **NB** merkjer ord der ein bokstav ikkje seier den kanoniske')
    A('lyden sin — nesten alltid `o`, som er /u/ i *sol*, *mor*, *bok*, *god*.')
    A('Det er ikkje ein feil i lista, det er norsk rettskriving, og appen held')
    A('desse orda att til eleven har bygd nokre heilt regelrette ord først.')
    A('**Sjå gjerne over desse — du kjenner uttalen betre enn lista gjer.**\n')
    A('| Id | Ord | Steg | NB |')
    A('|---|---|---|---|')
    for tekst, tricky in ord:
        s = max(steg_for.get(c, 1) for c in tekst)
        manifest['ord']['o_' + tekst] = tekst
        A('| `o_%s` | **%s** | %d | %s |' % (
            tekst, tekst, s,
            ('`%s` = annan lyd' % ', '.join(tricky)) if tricky else ''))
    A('')

    A('---\n')
    A('## 4. Ros og instruksjonar (%d klipp)\n' % len(ros))
    A('Varier tonefallet mellom rosklippa — dei blir spelte hundrevis av gonger,')
    A('og eit identisk «Bra!» kvar gong blir fort tomt.\n')
    A('Dei fire nedst er **oppmuntring ved feil svar**. Dei skal vere vennlege')
    A('og heilt utan skuffelse i stemma. Ein elev som høyrer at han skuffa')
    A('nokon, sluttar å prøve.\n')
    A('| Id | Du seier |')
    A('|---|---|')
    for i in ros:
        t = ROS_TEKST.get(i, '')
        manifest['ros'][i] = t
        A('| `%s` | «%s» |' % (i, t))
    A('')

    total = sum(len(b) for b in manifest.values())
    A('---\n')
    A('## Samla\n')
    A('| Bank | Klipp |')
    A('|---|---|')
    for b in ('fonem', 'namn', 'ord', 'ros'):
        A('| %s | %d |' % (b, len(manifest[b])))
    A('| **I alt** | **%d** |' % total)
    A('')
    A('Rekna som ~0,8 s i snitt og 48 kbps mono blir det kring **%d kB** ferdig'
      % int(total * 0.8 * 6))
    A('pakka — godt innanfor det repoet toler.\n')

    md = os.path.join(APP, 'INNSPELING.md')
    io.open(md, 'w', encoding='utf-8', newline='\n').write('\n'.join(L))

    mf = os.path.join(APP, 'lyd', 'manifest.json')
    io.open(mf, 'w', encoding='utf-8', newline='\n').write(
        json.dumps({'app': 'ljodstigen', 'version': 1, 'banks': manifest},
                   ensure_ascii=False, indent=2) + '\n')

    print('Skreiv %s (%d klipp)' % (md, total))
    print('Skreiv %s' % mf)


if __name__ == '__main__':
    main()
