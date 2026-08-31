#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Byggjer trebiblioteket til bokstavskogen frå Kenney sin Nature Kit.

    python bygg_ljodstigen_skog.py [--liste]

Les    _kjelder/kenney-nature/Models/GLTF format/*.glb
skriv  ljodstigen/skog/planter.bin  +  planter.json

KVIFOR IKKJE BERRE LEVERE GLB-FILENE?

Fordi vi då måtte skrive ein glTF-lastar i nettlesaren. Skogen treng
nøyaktig éin ting av glTF: trekantar med ein farge. Alt det andre i
spesifikasjonen — scenegraf, skinn, animasjonar, PBR, texturar,
samplarar — er kode vi ville drege med oss for å ikkje bruke han.

Her blir geometrien pakka til det skogen faktisk teiknar: eit
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
kan bytte heile fargestemninga i skogen ved å endre seks tal.

Nature Kit er CC0. Sjå _libs/CREDITS.md.
"""
import json
import os
import struct
import sys

ROT = os.path.dirname(os.path.abspath(__file__))
KJELDE = os.path.join(ROT, '_kjelder', 'kenney-nature')
UT = os.path.join(ROT, 'ljodstigen', 'skog')

# ── Artane ───────────────────────────────────────────────────────
#
# Kvar art er seks modellar, éin per boks i den adaptive motoren.
# Steg 0 er ei tom rute; steg 5 er treet fullvakse.
#
# DETTE ER STIGEN ELEVEN SER. Han skal lesast som vekst og ikkje som ei
# utskifting: frøet blir ei spire, spira blir ei lita plante, planta blir
# eit tre. Difor deler artane dei tre første stega — alle byrjar likt —
# og skil lag først når treet blir seg sjølv.

# Alle artane er TRE. Ein tidlegare versjon blanda blomar, buskar, gras
# og sopp, og han var finare å sjå på — men eit tre som veks er den
# tydelegaste vekstkurva vi har: han blir høgare, og han blir det på ein
# måte eit barn kjenner att frå utsida av vindauget.
#
# Prisen er at fleire bokstavar får liknande tre. Kenney har elleve
# lauvtreformer og fem furuformer, kvar i tre fargesett — grønt, mørkt og
# haust — så av femten artar er ingen to heilt like, men nokre er
# søskenbarn. Det er ein pris det er verdt: eleven skal kjenne att SI
# plante, og plasseringa i skogen gjer meir av den jobben enn forma.

SPIRE = ['crops_dirtSingle', 'grass_leafs', 'plant_bushSmall']
STEGNAMN = ['frø', 'spire', 'lita plante', 'lite tre', 'tre', 'stort tre']


def tre(id_, namn, liten, mellom, stor, maks):
    return {'id': id_, 'namn': namn, 'steg': SPIRE + [liten, mellom, stor],
            'maks': maks, 'stegnamn': STEGNAMN}


ARTAR = [
    tre('furu', 'Furu',
        'tree_pineSmallA', 'tree_pineDefaultA', 'tree_pineTallA', 1.95),
    tre('lauvtre', 'Lauvtre',
        'tree_small', 'tree_default', 'tree_tall', 1.95),
    tre('eik', 'Eik',
        'tree_blocks', 'tree_oak', 'tree_detailed', 2.10),
    tre('haustlauv', 'Haustlauv',
        'tree_small_fall', 'tree_default_fall', 'tree_tall_fall', 1.95),
    tre('rundfuru', 'Rundfuru',
        'tree_pineSmallB', 'tree_pineRoundA', 'tree_pineRoundB', 1.95),
    tre('morklauv', 'Mørkt lauvtre',
        'tree_small_dark', 'tree_default_dark', 'tree_tall_dark', 1.95),
    tre('kjegletre', 'Kjegletre',
        'tree_cone', 'tree_plateau', 'tree_thin', 2.00),
    tre('hausteik', 'Hausteik',
        'tree_blocks_fall', 'tree_oak_fall', 'tree_detailed_fall', 2.10),
    tre('palme', 'Palme',
        'tree_palmShort', 'tree_palmDetailedShort', 'tree_palmDetailedTall', 1.85),
    tre('rundtre', 'Rundtre',
        'tree_simple', 'tree_fat', 'tree_detailed', 2.10),
    tre('morkeik', 'Mørk eik',
        'tree_blocks_dark', 'tree_oak_dark', 'tree_detailed_dark', 2.10),
    tre('hogfuru', 'Høgfuru',
        'tree_pineSmallC', 'tree_pineTallB', 'tree_pineTallB_detailed', 1.90),
    tre('morkkjegle', 'Mørkt kjegletre',
        'tree_cone_dark', 'tree_plateau_dark', 'tree_thin_dark', 2.00),
    tre('haustrundtre', 'Haustrundtre',
        'tree_simple_fall', 'tree_fat_fall', 'tree_detailed_fall', 2.10),
    tre('bogepalme', 'Bogepalme',
        'tree_palm', 'tree_palmBend', 'tree_palmTall', 1.85),
]

# Store steinar til bakkanten av øya. Dei står for langt bak til å kome
# i vegen for nokon plante, og dei gjev skogen ein horisont: utan dei
# sluttar han berre.
STORE = [
    'stone_largeA', 'stone_largeB', 'stone_largeC',
    'stone_tallA', 'stone_tallB',
    'rock_largeA', 'rock_largeB', 'rock_tallA',
]

ALFABET = list('abcdefghijklmnopqrstuvwxyzæøå')

# «maks» er kor stort treet står når det er fullvakse, som ein faktor på
# den naturlege storleiken i settet. 1,0 er slik Kenney laga det.
#
# Rundt 2,0 no: eit fullvakse tre blir over tre einingar høgt i ei rute
# på ein og ein halv. Trea skal rage, og kronene skal møtast — det er
# skilnaden på ei samling planter og ein skog.
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
    for m in STORE:
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
        # skogen blei ein haug med kjempestore leirklumpar med bitte små
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
        'app': 'ljodstigen', 'version': 1, 'type': 'trebibliotek',
        'kjelde': 'Kenney Nature Kit 2.1 (CC0)',
        'steg': struct.calcsize('<hhhbbbBxx'),   # byte per hjørne
        'skala': 8192,                   # int16-einingar per verdseining
        'palett': palett,
        'palettNamn': palett_namn,
        'modellar': modellar,
        'artar': ARTAR,
        'store': STORE,
        'bokstavar': {ch: art_for(i) for i, ch in enumerate(ALFABET)},
    }
    with open(os.path.join(UT, 'planter.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(indeks, f, ensure_ascii=False, separators=(',', ':'))

    print('Bokstavskogen:')
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
