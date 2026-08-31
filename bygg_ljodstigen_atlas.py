#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Byggjer teksturatlaset til Bokstavjakta frå Kenney-pakkane.

    python bygg_ljodstigen_atlas.py [--liste]

Les    _kjelder/kenney-scribble/base/PNG/Retina/*.png
og     _kjelder/kenney-scribble/expansion/PNG/Large (2x)/*.png
skriv  ljodstigen/jakta/atlas.png  +  atlas.json

KVIFOR EIT EIGE ATLAS, når pakkane har eit ferdig eitt?

Grunnpakka har eit Starling-XML som Phaser les direkte, men utvidinga har
berre ein tilesheet.png UTAN indeks — vi veit ikkje kva rute som er kva.
Å gjette på alfabetisk rekkjefølgje ville verka heilt til Kenney gjev ut
ein 1.1 med ein ny sprite midt i lista, og då ville halve verda skifta
utsjånad utan at nokon skjøna kvifor.

Ved å byggje frå enkeltfilene får vi namngjevne rammer frå begge pakkane
i éi fil, og vi bestemmer sjølve kva som blir med.

HEILE PAKKANE ER MED. Atlaset hadde ei vrakliste — piggar, sagblad,
kanonar og våpen låg utanfor, med den grunngjevinga at eit atlas som
inneheld eit sverd er ei open dør for at nokon seinare legg eit sverd i
eit lesespel for seksåringar. Læraren som eig spelet bad om dei likevel,
og då er det hans avgjerd.

Dei er framleis berre BILETE. Ingen av dei har kollisjon, ingen av dei
skader nokon, og spelet har framleis ingen måte å tape på. Skal ein pigg
ein dag gjere noko, må nokon skrive den koden med vilje — og då er det
den avgjerda som gjeld, ikkje denne.

Begge pakkane er CC0. Sjå _libs/CREDITS.md.
"""
import json
import os
import re
import sys

try:
    from PIL import Image
except ImportError:
    raise SystemExit('Treng Pillow:  python -m pip install Pillow')

ROT = os.path.dirname(os.path.abspath(__file__))
KJELDE = os.path.join(ROT, '_kjelder', 'kenney-scribble')
UT = os.path.join(ROT, 'ljodstigen', 'jakta')

def finn_mappe(rot, prefiks):
    """Finn ei undermappe som byrjar på `prefiks`.

    Utvidinga si 2x-mappe heiter «Large (2×)» der × er eit ekte gongeteikn
    (U+00D7), ikkje bokstaven x. Hardkodar vi namnet, feilar bygget på ein
    måte som ser ut som ei manglande nedlasting. Vi leitar etter prefikset
    i staden, og toler at Kenney døyper om mappa i neste utgåve.
    """
    if not os.path.isdir(rot):
        return None
    for namn in sorted(os.listdir(rot)):
        sti = os.path.join(rot, namn)
        if os.path.isdir(sti) and namn.lower().startswith(prefiks.lower()):
            return sti
    return None


KJELDER = [
    ('base', finn_mappe(os.path.join(KJELDE, 'base', 'PNG'), 'Retina')),
    ('expansion', finn_mappe(os.path.join(KJELDE, 'expansion', 'PNG'), 'Large')),
]

PADDING = 2          # mot at nabosprites lek inn ved skalering
ATLAS_BREIDD = 2048  # trygt på all maskinvare vi bryr oss om
FARGAR = 192         # kvantisering, jf. AGENTS.md §5.7

# Sprites vi ikkje vil ha i det heile. Regex mot filnamn utan .png.
#
# Lista er tom. Ho stod full av våpen og farar fram til 1.38; sjå
# toppen av fila for kvifor ho blei tømd. Ho står att som ein krok:
# skal noko ut av atlaset seinare, er det her det skjer, og då er det
# éin stad å sjå etter kvifor ein sprite manglar.
VRAK = []


def vraka(namn):
    return any(re.match(p, namn) for p in VRAK)


def samle():
    """Alle sprites vi vil ha, som (namn, sti). Første pakke vinn ved namnelikskap."""
    ute, sett = [], set()
    for pakke, mappe in KJELDER:
        if not mappe or not os.path.isdir(mappe):
            raise SystemExit('Fann ikkje 2x-mappa for "%s". '
                             'Ligg pakkane i _kjelder/kenney-scribble/base/ og /expansion/ ?' % pakke)
        for fil in sorted(os.listdir(mappe)):
            if not fil.lower().endswith('.png'):
                continue
            namn = fil[:-4]
            if vraka(namn):
                continue
            if namn in sett:
                print('  hoppar over duplikat: %s (finst alt frå ein tidlegare pakke)' % namn)
                continue
            sett.add(namn)
            ute.append((namn, os.path.join(mappe, fil)))
    return ute


def pakk(sprites):
    """Enkel radpakking. Sprita er nesten alle like store, så ein smartare
       algoritme ville spart nokre få prosent og kosta lesbarheit."""
    bilete = [(n, Image.open(p).convert('RGBA')) for n, p in sprites]
    # Høgast først, så radene blir jamne.
    bilete.sort(key=lambda t: (-t[1].height, t[0]))

    plassar, x, y, radh = [], PADDING, PADDING, 0
    for namn, im in bilete:
        if x + im.width + PADDING > ATLAS_BREIDD:
            x = PADDING
            y += radh + PADDING
            radh = 0
        plassar.append((namn, im, x, y))
        x += im.width + PADDING
        radh = max(radh, im.height)
    hogd = y + radh + PADDING

    atlas = Image.new('RGBA', (ATLAS_BREIDD, hogd), (0, 0, 0, 0))
    rammer = {}
    for namn, im, px, py in plassar:
        atlas.paste(im, (px, py))
        rammer[namn] = {
            'frame': {'x': px, 'y': py, 'w': im.width, 'h': im.height},
            'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
            'sourceSize': {'w': im.width, 'h': im.height},
        }
    return atlas, rammer


# ── Flisesett til flisekartet ────────────────────────────────────
#
# Terrenget i Bokstavjakta blir teikna med Phaser sitt flisekart og ikkje
# med eitt sprite per flis. Ein bane på 30 skjermar er 4 800 fliser, og
# så mange sprites er uspelbart på ein skule-iPad; eit flisekart teiknar
# berre det kameraet ser.
#
# Eit flisekart legg flisene KANT I KANT. Kenney-flisene har
# konturstreken 3-6 px inn frå kanten, så kant i kant gjev to strekar med
# kvitt imellom — rutenettet ser ut som laushengande øyer. Spelekoden
# løyste det ei stund ved å teikne kvar flis 5 px for stor, men eit
# flisekart har ingen plass til det trikset.
#
# Fiksen høyrer uansett heime her: vi skjer kvar flis frå MIDTEN AV
# KONTUREN på den eine sida til MIDTEN AV KONTUREN på den andre. Då
# bidreg to nabofliser med ei halv strek kvar, og saumen blir éin strek
# utan at spelet treng vite om det.

FLISER = ['tile_grass', 'tile', 'tile_bridge', 'tile_stone', 'tile_brick', 'tile_sand']

# Fliser som IKKJE skal skjerast. tile_bridge er ein planke utan sidestrek
# og med gjennomsikt i nedre halvdel; skjer vi han, blir planken strekt ut
# til å fylle heile ruta.
HEILE = {'tile_bridge'}

# Utdata er 64 px, same som verda si flisstorleik, så flisekartet slepp
# å skalerast — ei skalert flislag gjer kollisjonen usikker. Sjølve
# skjeringa skjer på 128-kjelda, så presisjonen i strekmidten er i behald.
FLIS_PX = 64


def strekmidte(im, fast, vassrett, fraa_start):
    """Midten av den ytste mørke streken langs ei linje."""
    px = im.load()
    w, h = im.size
    treff = []
    for i in range(w if vassrett else h):
        x, y = (i, fast) if vassrett else (fast, i)
        r, g, b, a = px[x, y]
        if a > 60 and max(r, g, b) < 130:
            treff.append(i)
    if not treff:
        return None
    grupper = []
    for v in treff:
        if grupper and v == grupper[-1][-1] + 1:
            grupper[-1].append(v)
        else:
            grupper.append([v])
    g = grupper[0] if fraa_start else grupper[-1]
    return sum(g) / len(g)


def skjer(im, namn):
    """Skjer flisa til strekmidtane, så nabofliser deler kontur."""
    if namn in HEILE:
        return im
    w, h = im.size
    v = strekmidte(im, h // 2, True, True)
    ho = strekmidte(im, h // 2, True, False)
    t = strekmidte(im, w // 2, False, True)
    b = strekmidte(im, w // 2, False, False)
    boks = (int(round(v if v is not None else 0)),
            int(round(t if t is not None else 0)),
            int(round(ho + 1 if ho is not None else w)),
            int(round(b + 1 if b is not None else h)))
    return im.crop(boks).resize((FLIS_PX, FLIS_PX), Image.LANCZOS)


def bygg_flisesett():
    bilete = []
    for namn in FLISER:
        sti = None
        for _, mappe in KJELDER:
            if mappe and os.path.exists(os.path.join(mappe, namn + '.png')):
                sti = os.path.join(mappe, namn + '.png')
                break
        if not sti:
            raise SystemExit('Fann ikkje flisa "%s"' % namn)
        bilete.append(skjer(Image.open(sti).convert('RGBA'), namn))

    ark = Image.new('RGBA', (FLIS_PX * len(bilete), FLIS_PX), (0, 0, 0, 0))
    for i, im in enumerate(bilete):
        ark.paste(im, (i * FLIS_PX, 0))

    os.makedirs(UT, exist_ok=True)
    png = os.path.join(UT, 'flisesett.png')
    ark.quantize(colors=FARGAR, method=Image.FASTOCTREE,
                 dither=Image.FLOYDSTEINBERG).save(png, optimize=True)

    # Teikn -> indeks. Same teikn som i baneformatet, sjå bane.js.
    teikn = {'#': 0, '_': 1, '=': 2, 'S': 3, 'B': 4, 'A': 5}
    with open(os.path.join(UT, 'flisesett.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({
            'app': 'ljodstigen', 'version': 1,
            'flisPx': FLIS_PX, 'tal': len(bilete),
            'namn': FLISER,
            'teikn': teikn,
            '_note': 'Skore til strekmidtane, så nabofliser deler kontur. '
                     'Sjå bygg_ljodstigen_atlas.py. -1 er tom rute i Phaser.'
        }, f, ensure_ascii=False, indent=1)
        f.write('\n')
    return len(bilete), os.path.getsize(png) / 1024


def main():
    sprites = samle()
    if '--liste' in sys.argv:
        for n, _ in sprites:
            print(n)
        print('%d sprites' % len(sprites))
        return

    print('Byggjer atlas frå %d sprites' % len(sprites))
    atlas, rammer = pakk(sprites)

    os.makedirs(UT, exist_ok=True)
    png = os.path.join(UT, 'atlas.png')

    # FASTOCTREE er den einaste kvantiseringa i Pillow som tek vare på
    # alfakanalen — same grunn som for logoane i §5.7.
    atlas.quantize(colors=FARGAR, method=Image.FASTOCTREE,
                   dither=Image.FLOYDSTEINBERG).save(png, optimize=True)

    with open(os.path.join(UT, 'atlas.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({
            'frames': rammer,
            'meta': {
                'app': 'ljodstigen',
                'version': '1',
                'image': 'atlas.png',
                'format': 'RGBA8888',
                'size': {'w': atlas.width, 'h': atlas.height},
                'scale': '1',
                'source': 'Kenney Scribble Platformer + Expansion 1.0 (CC0)',
            },
        }, f, ensure_ascii=False, indent=1)
        f.write('\n')

    kb = os.path.getsize(png) / 1024
    print('  atlas:      %d rammer, %dx%d px, %.0f kB' % (len(rammer), atlas.width, atlas.height, kb))

    n, fkb = bygg_flisesett()
    print('  flisesett:  %d fliser, %.0f kB' % (n, fkb))
    print('  skrive til %s' % UT)


if __name__ == '__main__':
    main()
