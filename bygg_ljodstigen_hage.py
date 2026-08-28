#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Byggjer plantebiblioteket til bokstavhagen frå Kenney sin Nature Kit.

    python bygg_ljodstigen_hage.py [--liste]

Les    _kjelder/kenney-nature/Models/GLTF format/*.glb
skriv  ljodstigen/hage/planter.bin  +  planter.json

KVIFOR IKKJE BERRE LEVERE GLB-FILENE?

Fordi vi då måtte skrive ein glTF-lastar i nettlesaren. Hagen treng
nøyaktig éin ting av glTF: trekantar med ein farge. Alt det andre i
spesifikasjonen — scenegraf, skinn, animasjonar, PBR, texturar,
samplarar — er kode vi ville drege med oss for å ikkje bruke han.

Her blir geometrien pakka til det hagen faktisk teiknar: eit
posisjonsfelt, ein normal og ein palettindeks per hjørne. Femti modellar
blir éi fil som nettlesaren kan sende rett til GPU-en utan å tolke noko.

FLATE NORMALAR BLIR REKNA UT HER. Kenney-modellane har normalar frå
Unity-eksporten, men vi vil ha den fasetterte sjåtten uansett, og då er
det billegare å rekne flatenormalen enn å ta med dei originale: kvart
hjørne i ein trekant får same normal, og då kan heile lyssetjinga vere
tre linjer i ein shader.

PALETTEN ER FELLES. Kenney brukar dei same materialnamna på tvers av
heile settet — «grass», «woodBark», «colorRed». Dei blir samla i éin
palett, og kvart hjørne ber ein indeks inn i han i staden for tre
fargebyte. Det er ikkje for å spare plass; det er for at ein seinare
kan bytte heile fargestemninga i hagen ved å endre seks tal.

Nature Kit er CC0. Sjå _libs/CREDITS.md.
"""
import json
import os
import struct
import sys

ROT = os.path.dirname(os.path.abspath(__file__))
KJELDE = os.path.join(ROT, '_kjelder', 'kenney-nature')
UT = os.path.join(ROT, 'ljodstigen', 'hage')

# ── Artane ───────────────────────────────────────────────────────
#
# Kvar art er seks modellar, éin per boks i den adaptive motoren.
# Steg 0 er ei tom seng; steg 5 er planta fullvaksen.
#
# DETTE ER STIGEN ELEVEN SER. Han skal lesast som vekst og ikkje som
# ei utskifting: frøet blir ei spire, spira får blad, bladet får ein
# knopp. Difor deler artane innleiinga — alle byrjar i same jord med
# same spire — og skil lag først når planta blir seg sjølv.
#
# Blomane er den einaste staden Kenney gjev oss ein ekte knopp-til-blom:
# flower_*A er ein lukka knopp, B er open, C er heilt utsprungen.

SPIRE = ['crops_dirtSingle', 'grass_leafs']

ARTAR = [
    {'id': 'blome-raud', 'namn': 'Raud blome',
     'steg': SPIRE + ['crops_leafsStageA', 'flower_redA', 'flower_redB', 'flower_redC'],
     'klynge': [1, 1, 1, 1, 2, 3],
     'maks': 1.35,
     'stegnamn': ['frø', 'spire', 'blad', 'knopp', 'blome', 'full blom']},
    {'id': 'furu', 'namn': 'Furu',
     'steg': SPIRE + ['plant_bushSmall', 'tree_pineSmallA', 'tree_pineRoundA', 'tree_pineDefaultA'],
     'maks': 0.52,
     'stegnamn': ['frø', 'spire', 'liten busk', 'lite tre', 'tre', 'stort tre']},
    {'id': 'busk', 'namn': 'Busk',
     'steg': SPIRE + ['plant_bushSmall', 'plant_bush', 'plant_bushDetailed', 'plant_bushLarge'],
     'klynge': [1, 1, 1, 1, 2, 2],
     'maks': 1.45,
     'stegnamn': ['frø', 'spire', 'liten busk', 'busk', 'tett busk', 'stor busk']},
    {'id': 'blome-lilla', 'namn': 'Lilla blome',
     'steg': SPIRE + ['crops_leafsStageA', 'flower_purpleA', 'flower_purpleB', 'flower_purpleC'],
     'klynge': [1, 1, 1, 1, 2, 3],
     'maks': 1.5,
     'stegnamn': ['frø', 'spire', 'blad', 'knopp', 'blome', 'full blom']},
    {'id': 'lauvtre', 'namn': 'Lauvtre',
     'steg': SPIRE + ['plant_bushSmall', 'tree_small', 'tree_default', 'tree_tall'],
     'maks': 0.5,
     'stegnamn': ['frø', 'spire', 'liten busk', 'lite tre', 'tre', 'stort tre']},
    {'id': 'gras', 'namn': 'Gras',
     'steg': SPIRE + ['grass_leafsLarge', 'grass', 'grass_large', 'grass_large'],
     'klynge': [1, 1, 2, 2, 3, 3],
     'maks': 1.3,
     'stegnamn': ['frø', 'spire', 'blad', 'gras', 'tett gras', 'stort gras']},
    {'id': 'blome-gul', 'namn': 'Gul blome',
     'steg': SPIRE + ['crops_leafsStageA', 'flower_yellowA', 'flower_yellowB', 'flower_yellowC'],
     'klynge': [1, 1, 1, 1, 2, 3],
     'maks': 1.7,
     'stegnamn': ['frø', 'spire', 'blad', 'knopp', 'blome', 'full blom']},
    {'id': 'eik', 'namn': 'Eik',
     'steg': SPIRE + ['plant_bushSmall', 'tree_blocks', 'tree_oak', 'tree_detailed'],
     'maks': 0.52,
     'stegnamn': ['frø', 'spire', 'liten busk', 'lite tre', 'tre', 'stort tre']},
    {'id': 'sopp', 'namn': 'Sopp',
     'steg': SPIRE + ['mushroom_tan', 'mushroom_tanTall', 'mushroom_red', 'mushroom_redGroup'],
     'klynge': [1, 1, 1, 2, 2, 3],
     'maks': 1.3,
     'stegnamn': ['frø', 'spire', 'liten sopp', 'sopp', 'raud sopp', 'soppring']},
    {'id': 'busk-spiss', 'namn': 'Spiss busk',
     'steg': SPIRE + ['plant_bushSmall', 'plant_bushTriangle', 'plant_flatShort', 'plant_flatTall'],
     'klynge': [1, 1, 1, 1, 2, 2],
     'maks': 1.4,
     'stegnamn': ['frø', 'spire', 'liten busk', 'busk', 'brei busk', 'stor busk']},
    {'id': 'korn', 'namn': 'Korn',
     'steg': ['crops_dirtSingle', 'crops_cornStageA', 'crops_cornStageB', 'crops_cornStageC',
              'crops_cornStageD', 'crops_cornStageD'],
     'klynge': [1, 1, 2, 2, 3, 3],
     'maks': 0.58,
     'stegnamn': ['frø', 'spire', 'strå', 'høgt strå', 'kolbe', 'moden kolbe']},
    {'id': 'palme', 'namn': 'Palme',
     'steg': SPIRE + ['plant_bushSmall', 'tree_palmShort', 'tree_palmDetailedShort', 'tree_palmDetailedTall'],
     'maks': 0.46,
     'stegnamn': ['frø', 'spire', 'liten busk', 'lita palme', 'palme', 'høg palme']},
    {'id': 'kaktus', 'namn': 'Kaktus',
     'steg': SPIRE + ['plant_bushSmall', 'cactus_short', 'cactus_tall', 'cactus_tall'],
     'klynge': [1, 1, 1, 1, 1, 2],
     'maks': 0.78,
     'stegnamn': ['frø', 'spire', 'liten busk', 'liten kaktus', 'kaktus', 'stor kaktus']},
    {'id': 'kjegletre', 'namn': 'Kjegletre',
     'steg': SPIRE + ['plant_bushSmall', 'tree_cone', 'tree_plateau', 'tree_thin'],
     'maks': 0.5,
     'stegnamn': ['frø', 'spire', 'liten busk', 'lite tre', 'tre', 'stort tre']},
    {'id': 'rundtre', 'namn': 'Rundtre',
     'steg': SPIRE + ['plant_bushSmall', 'tree_simple', 'tree_fat', 'tree_detailed'],
     'maks': 0.52,
     'stegnamn': ['frø', 'spire', 'liten busk', 'lite tre', 'tre', 'stort tre']},
]

# ── Pynt ─────────────────────────────────────────────────────────
#
# Steinar, stubbar og gras som blir strødde utover øya mellom bedene.
# Dei har ingen funksjon og høyrer ingen bokstav til; dei er der fordi
# ei flate med tjueni planter i eit rutenett og ingenting elles ser ut
# som ein utstillingsmontér og ikkje som ein hage.
#
# Plasseringa blir rekna ut i nettlesaren frå eit fast frø, så hagen ser
# lik ut kvar gong utan at vi lagrar ei liste over kvar stein.
# «stone_tallA» og resten av dei høge steinane er med vilje utelatne:
# dei er ein meter høge og ville stått som bautaer over ein hage der den
# største planta er åtti centimeter.
PYNT = [
    'rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallFlatA',
    'stone_smallA', 'stone_smallB',
    'log', 'stump_round',
    'grass', 'grass_leafs', 'plant_bushSmall', 'mushroom_tan',
    'flower_redA', 'flower_yellowA',
]

ALFABET = list('abcdefghijklmnopqrstuvwxyzæøå')

# «klynge» er kor mange eksemplar som står i bedet på kvart steg. Ein
# blome er éin stilk, og éin stilk midt i eit bed ser ut som ein blome
# nokon gløymde. Tre stilkar er ein plante. Trea står åleine — eit tre
# er stort nok til å vere eit bed i seg sjølv.

# «maks» er kor stor planta står når ho er fullvaksen, som ein faktor på
# den naturlege storleiken i settet. 1,0 er slik Kenney laga henne.
# Blomane blir forstørra litt fordi dei elles blir borte ved sida av eit
# tre; trea blir krympa litt fordi eit tre på 1,7 einingar i ei rute på
# 1,0 skuggar for naboen.

# Kvar bokstav får arten sin av posisjonen i alfabetet. Fast for alltid:
# eleven skal kjenne att si eiga s-plante frå gong til gong, og ei
# tilfeldig tildeling ville gjeve han ei ny plante på ein ny maskin.
def art_for(i):
    return ARTAR[i % len(ARTAR)]['id']


# ── Lesing av glTF ───────────────────────────────────────────────

CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2),
      5125: ('I', 4), 5126: ('f', 4)}
NKOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Glb:
    def __init__(self, sti):
        d = open(sti, 'rb').read()
        if d[:4] != b'glTF':
            raise SystemExit('%s er ikkje ei GLB-fil' % sti)
        off, ch = 12, []
        while off < len(d):
            cl, ct = struct.unpack('<I4s', d[off:off + 8])
            ch.append((ct, cl, off + 8))
            off += 8 + cl
        self.g = json.loads(d[ch[0][2]:ch[0][2] + ch[0][1]].decode('utf-8'))
        self.bin = d[ch[1][2]:ch[1][2] + ch[1][1]]

    def les(self, i):
        a = self.g['accessors'][i]
        bv = self.g['bufferViews'][a['bufferView']]
        fmt, sz = CT[a['componentType']]
        n = NKOMP[a['type']]
        start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride') or (sz * n)
        return [struct.unpack_from('<' + fmt * n, self.bin, start + k * stride)
                for k in range(a['count'])]

    def trekantar(self):
        """[(p0, p1, p2, materialnamn)] for heile fila, i lokale koordinatar."""
        ut = []
        for node in self.g['nodes']:
            if 'mesh' not in node:
                continue
            t = node.get('translation', [0, 0, 0])
            s = node.get('scale', [1, 1, 1])
            for pr in self.g['meshes'][node['mesh']].get('primitives', []):
                pos = [(p[0] * s[0] + t[0], p[1] * s[1] + t[1], p[2] * s[2] + t[2])
                       for p in self.les(pr['attributes']['POSITION'])]
                idx = ([i[0] for i in self.les(pr['indices'])] if 'indices' in pr
                       else list(range(len(pos))))
                mi = pr.get('material')
                mnamn = (self.g['materials'][mi].get('name', 'ukjend')
                         if mi is not None else 'ukjend')
                for k in range(0, len(idx) - 2, 3):
                    ut.append((pos[idx[k]], pos[idx[k + 1]], pos[idx[k + 2]], mnamn))
        return ut

    def materialfargar(self):
        ut = {}
        for m in self.g.get('materials', []):
            c = m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [0.8, 0.8, 0.8, 1])
            ut[m.get('name', 'ukjend')] = [max(0, min(255, int(round(v * 255)))) for v in c[:3]]
        return ut


# ── Pakking ──────────────────────────────────────────────────────

def finn_mappe():
    for stamme in (KJELDE, os.path.join(ROT, '_kjelder', 'kenney_nature-kit')):
        m = os.path.join(stamme, 'Models', 'GLTF format')
        if os.path.isdir(m):
            return m
    raise SystemExit('Fann ikkje "Models/GLTF format". '
                     'Ligg Nature Kit i _kjelder/kenney-nature/ ?')


def bygg():
    mappe = finn_mappe()
    namn = []
    for a in ARTAR:
        a.setdefault('klynge', [1] * 6)
        for m in a['steg']:
            if m not in namn:
                namn.append(m)
    for m in PYNT:
        if m not in namn:
            namn.append(m)

    palett_namn, palett = [], []
    modellar = {}
    hjornetal = 0
    biter = []

    for m in namn:
        sti = os.path.join(mappe, m + '.glb')
        if not os.path.isfile(sti):
            raise SystemExit('Manglar modell: %s' % sti)
        g = Glb(sti)
        fargar = g.materialfargar()
        tris = g.trekantar()
        if not tris:
            raise SystemExit('%s har ingen trekantar' % m)

        # Midtstill i x/z og sett botnen i y=0 — men RØR IKKJE SKALAEN.
        #
        # Kenney-settet er modellert i éin felles målestokk der ei rute er
        # 1,0: ein busk er 0,24 høg, eit tre er 1,7. Den målestokken er
        # heile grunnen til at eit sett heng saman, og han skal vi arve.
        #
        # Første utgåva normaliserte kvar modell til høgd 1. Det gjorde
        # jordflisa — som er 0,10 høg og 1,0 brei — ti gonger for brei, og
        # hagen blei ein haug med kjempestore leirklumpar med bitte små
        # planter oppå.
        xs = [p[0] for t in tris for p in t[:3]]
        ys = [p[1] for t in tris for p in t[:3]]
        zs = [p[2] for t in tris for p in t[:3]]
        cx, cz, by = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2, min(ys)
        naturleg = max(ys) - by
        vidd = max(max(xs) - min(xs), max(zs) - min(zs))

        start = hjornetal
        for a, b, c, mn in tris:
            if mn not in palett_namn:
                palett_namn.append(mn)
                palett.append(fargar.get(mn, [200, 200, 200]))
            pi = palett_namn.index(mn)

            p = [(v[0] - cx, v[1] - by, v[2] - cz) for v in (a, b, c)]
            ux, uy, uz = (p[1][j] - p[0][j] for j in range(3))
            vx, vy, vz = (p[2][j] - p[0][j] for j in range(3))
            nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
            nl = (nx * nx + ny * ny + nz * nz) ** 0.5 or 1e-9
            n8 = [max(-127, min(127, int(round(v / nl * 127)))) for v in (nx, ny, nz)]

            for v in p:
                # Posisjon som int16 i 1/8192 einingar. Den høgaste planta
                # er under 2 einingar, så vi brukar ikkje ein tidel av
                # området — og oppløysinga er langt under det auget ser.
                q = [max(-32767, min(32767, int(round(v[j] * 8192)))) for j in range(3)]
                # 12 byte per hjørne, ikkje 11: to fyllbyte til slutt.
                # Posisjonane blir då liggjande på partal-adresser, og
                # steget i JSON-en er eit tal ein kan stole på.
                biter.append(struct.pack('<hhhbbbBxx', q[0], q[1], q[2],
                                         n8[0], n8[1], n8[2], pi))
                hjornetal += 1

        modellar[m] = {
            'start': start, 'tal': hjornetal - start,
            # Naturleg storleik, så JS kan skalere ei plante til ei rute
            # utan å laste geometrien for å måle henne.
            'hogd': round(naturleg, 4), 'vidd': round(vidd, 4)
        }

    data = b''.join(biter)
    os.makedirs(UT, exist_ok=True)
    with open(os.path.join(UT, 'planter.bin'), 'wb') as f:
        f.write(data)

    indeks = {
        'app': 'ljodstigen', 'version': 1, 'type': 'plantebibliotek',
        'kjelde': 'Kenney Nature Kit 2.1 (CC0)',
        'steg': struct.calcsize('<hhhbbbBxx'),   # byte per hjørne
        'skala': 8192,                   # int16-einingar per verdseining
        'palett': palett,
        'palettNamn': palett_namn,
        'modellar': modellar,
        'artar': ARTAR,
        'pynt': PYNT,
        'bokstavar': {ch: art_for(i) for i, ch in enumerate(ALFABET)},
    }
    with open(os.path.join(UT, 'planter.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(indeks, f, ensure_ascii=False, separators=(',', ':'))

    print('Bokstavhagen:')
    print('  %d modellar, %d artar, %d bokstavar' % (len(namn), len(ARTAR), len(ALFABET)))
    print('  %d hjørne (%d trekantar), %d fargar i paletten'
          % (hjornetal, hjornetal // 3, len(palett)))
    print('  planter.bin   %6.1f kB' % (len(data) / 1024))
    print('  planter.json  %6.1f kB'
          % (os.path.getsize(os.path.join(UT, 'planter.json')) / 1024))
    print('  skrive til %s' % UT)


def liste():
    for i, ch in enumerate(ALFABET):
        a = [x for x in ARTAR if x['id'] == art_for(i)][0]
        print('%s  %-12s %s' % (ch, a['id'], ' -> '.join(a['steg'])))


if __name__ == '__main__':
    if '--liste' in sys.argv:
        liste()
    else:
        bygg()
