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

KURATERT MED VILJE. Bokstavjakta er eit spel utan farar: ingen piggar,
ingen sagblad, ingen kanonar, ingen våpen. Dei sprita blir ikkje med, og
det er ikkje for å spare kilobyte — eit atlas som inneheld eit sverd er
ei open dør for at nokon seinare legg eit sverd i eit lesespel for
seksåringar.

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
VRAK = [
    r'^item_(arrow|blaster|bow|gun|helmet|helmetModern|shield|shieldRound|spear|sword)$',
    r'^effect_(blast|blastLarge|shot|shotLarge)$',
    r'^(bullet|sawblade|cannon_base|cannon_large|cannon_small)$',
    r'^tile_spikes?$',
]

# Sprites vi vil ha, sjølv om dei liknar noko i VRAK.
# tile_arrow* er vegvisarar som peikar eleven rett veg, ikkje pilskot.
BEHALD = [r'^tile_arrow(Up|Down|Left|Right)$']


def vraka(namn):
    if any(re.match(p, namn) for p in BEHALD):
        return False
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
    print('  %d rammer, %dx%d px, %.0f kB' % (len(rammer), atlas.width, atlas.height, kb))
    print('  skrive til %s' % UT)


if __name__ == '__main__':
    main()
