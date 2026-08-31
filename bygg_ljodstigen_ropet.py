#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Byggjer leirplassen og figuren til Bokstavropet i 3D.

    python bygg_ljodstigen_ropet.py [--liste]

Les    _kjelder/kenney-nature/Models/GLTF format/*.glb     (telt, bål, tre)
og     _kjelder/kenney-mini/Models/GLB format/*.glb        (figuren)
skriv  ljodstigen/ropet/leir.bin  +  leir.json

TO SLAGS GEOMETRI I SAME FILA.

Telta og kubbane står stille og treng berre posisjon, normal og farge —
tolv byte per hjørne, same format som skogen brukar. Figuren har eit
skjelett, og kvart hjørne må dessutan vite kva ledd det heng i og kor
mykje: fire leddindeksar og fire vekter til, tjue byte i alt.

Dei ligg etter kvarandre i same fila med kvar sin startadresse. Éi
henting i staden for to, og ingen av dei to formata må bøye seg for det
andre.

FARGEN BLIR PLUKKA FRÅ FARGEKARTET HER.

Kenney sine figurar er teksturerte, men teksturen er eit rutenett av
flate fargefelt — ingen mønster, ingen forløp. Vi slår difor opp éin
gong per hjørne under bygginga og skriv fargen rett inn i geometrien.
Då slepp nettlesaren å laste ein tekstur på 512 x 512, shaderen slepp
eit oppslag per piksel, og resultatet er nøyaktig det same biletet.

SJU LEDD, OG DET ER HEILE GRUNNEN TIL AT DETTE GÅR.

Ein figur med eit fullt menneskeskjelett ville kravd eit
animasjonsbibliotek. Denne har root, to bein, ein torso, to armar og eit
hovud. Sju leddmatriser per bilete er ei løkke på sju, og då kan spelet
rekne dei sjølv utan å dra inn 600 kB three.js.

Begge pakkane er CC0. Sjå _libs/CREDITS.md.
"""
import json
import math
import os
import struct
import sys

ROT = os.path.dirname(os.path.abspath(__file__))
UT = os.path.join(ROT, 'ljodstigen', 'ropet')

FIGUR = 'character-male-a'

# Telta er det eleven vel mellom; resten er staden dei står på.
TELT = ['tent_detailedOpen', 'tent_detailedClosed', 'tent_smallOpen', 'tent_smallClosed']
LEIR = ['campfire_stones', 'campfire_logs', 'log', 'log_stack',
        'stone_smallA', 'stone_smallB', 'rock_smallA',
        'tree_pineDefaultA', 'tree_default', 'tree_small', 'plant_bush',
        'grass', 'grass_large', 'flower_redA', 'flower_yellowA', 'mushroom_red']

# Klippa vi treng. Kvilepositur ligg i nodane sine eigne TRS frå før og
# treng ikkje noko klipp.
# «sprint» blir brukt til flygeturen: armar og bein i full fart ser ut
# som spreling når figuren ikkje har bakke under seg.
KLIPP = ['idle', 'walk', 'sprint', 'jump', 'emote-yes', 'emote-no']

SKALA = 8192          # int16-einingar per verdseining

# Fjorten byte for eit stille hjørne, tjue for eit som heng i eit
# skjelett. Begge er partal med vilje: posisjonane er int16, og eit
# ujamt steg ville lagt annakvart hjørne på ei ulik adresse.
STATISK_FMT = '<hhhbbbBBBxx'
FIGUR_FMT = '<hhhbbb' + 'B' * 11

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


def finn_mappe(*kandidatar):
    for k in kandidatar:
        if os.path.isdir(k):
            return k
    raise SystemExit('Fann ikkje nokon av:\n  ' + '\n  '.join(kandidatar))


def flatnormal(a, b, c):
    ux, uy, uz = (b[j] - a[j] for j in range(3))
    vx, vy, vz = (c[j] - a[j] for j in range(3))
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    nl = math.sqrt(nx * nx + ny * ny + nz * nz) or 1e-9
    return [max(-127, min(127, int(round(v / nl * 127)))) for v in (nx, ny, nz)]


def kvant(v):
    return max(-32767, min(32767, int(round(v * SKALA))))


# ── Statiske modellar ────────────────────────────────────────────

def statisk(mappe, namn, biter, hjornetal):
    g = Glb(os.path.join(mappe, namn + '.glb'))
    fargar = {}
    for m in g.g.get('materials', []):
        c = m.get('pbrMetallicRoughness', {}).get('baseColorFactor', [.8, .8, .8, 1])
        fargar[m.get('name', '?')] = [max(0, min(255, int(round(v * 255)))) for v in c[:3]]

    tris = []
    for node in g.g['nodes']:
        if 'mesh' not in node:
            continue
        t = node.get('translation', [0, 0, 0])
        s = node.get('scale', [1, 1, 1])
        for pr in g.g['meshes'][node['mesh']].get('primitives', []):
            pos = [(p[0] * s[0] + t[0], p[1] * s[1] + t[1], p[2] * s[2] + t[2])
                   for p in g.les(pr['attributes']['POSITION'])]
            idx = ([i[0] for i in g.les(pr['indices'])] if 'indices' in pr
                   else list(range(len(pos))))
            mi = pr.get('material')
            farge = [200, 200, 200]
            if mi is not None:
                farge = fargar.get(g.g['materials'][mi].get('name', '?'), farge)
            for k in range(0, len(idx) - 2, 3):
                tris.append((pos[idx[k]], pos[idx[k + 1]], pos[idx[k + 2]], farge))

    if not tris:
        raise SystemExit('%s har ingen trekantar' % namn)

    xs = [p[0] for t in tris for p in t[:3]]
    ys = [p[1] for t in tris for p in t[:3]]
    zs = [p[2] for t in tris for p in t[:3]]
    cx, cz, by = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2, min(ys)

    start = hjornetal
    for a, b, c, farge in tris:
        p = [(v[0] - cx, v[1] - by, v[2] - cz) for v in (a, b, c)]
        n8 = flatnormal(*p)
        for v in p:
            biter.append(struct.pack(STATISK_FMT,
                                     kvant(v[0]), kvant(v[1]), kvant(v[2]),
                                     n8[0], n8[1], n8[2],
                                     farge[0], farge[1], farge[2]))
            hjornetal += 1
    return ({'start': start, 'tal': hjornetal - start,
             'hogd': round(max(ys) - by, 4),
             'vidd': round(max(max(xs) - min(xs), max(zs) - min(zs)), 4)},
            hjornetal)


# ── Figuren, med skjelett ────────────────────────────────────────

def figur(mappe, tekstur, biter, hjornetal):
    from PIL import Image
    g = Glb(os.path.join(mappe, FIGUR + '.glb'))
    bilete = Image.open(tekstur).convert('RGB')
    tb, th = bilete.size
    piksel = bilete.load()

    nodar = g.g['nodes']
    skinn = g.g['skins'][0]
    joints = skinn['joints']
    ibm = g.les(skinn['inverseBindMatrices'])
    plass = {n: i for i, n in enumerate(joints)}

    start = hjornetal
    for node in nodar:
        if 'mesh' not in node or 'skin' not in node:
            continue
        for pr in g.g['meshes'][node['mesh']].get('primitives', []):
            att = pr['attributes']
            pos = g.les(att['POSITION'])
            uv = g.les(att['TEXCOORD_0'])
            jo = g.les(att['JOINTS_0'])
            we = g.les(att['WEIGHTS_0'])
            idx = [i[0] for i in g.les(pr['indices'])]

            for k in range(0, len(idx) - 2, 3):
                tre = [idx[k], idx[k + 1], idx[k + 2]]
                n8 = flatnormal(*[pos[i] for i in tre])
                for i in tre:
                    u, v = uv[i]
                    # Fargekartet er flate felt; nærmaste piksel er rett
                    # farge, og ingen interpolering å blande med naboen.
                    px = min(tb - 1, max(0, int(u * tb)))
                    py = min(th - 1, max(0, int(v * th)))
                    r, gg, b = piksel[px, py]

                    w = list(we[i]) + [0, 0, 0, 0]
                    j = list(jo[i]) + [0, 0, 0, 0]
                    sum_w = sum(w[:4]) or 1.0
                    w8 = [max(0, min(255, int(round(x / sum_w * 255)))) for x in w[:4]]
                    # Avrundinga kan gjere summen 254 eller 256; skyv
                    # avviket inn i den tyngste vekta, så figuren ikkje
                    # krympar eller veks litt for kvart hjørne.
                    tyngst = w8.index(max(w8))
                    w8[tyngst] += 255 - sum(w8)

                    # JOINTS_0 er ALT indeksar inn i skin.joints, ikkje
                    # nodeindeksar. Å slå dei opp i node-tabellen ville
                    # gjeve ledd 0 til alt som ikkje tilfeldigvis fanst
                    # der, og figuren ville hengt saman i rota.
                    lj = [min(len(joints) - 1, max(0, int(x))) for x in j[:4]]
                    biter.append(struct.pack(FIGUR_FMT,
                                             kvant(pos[i][0]), kvant(pos[i][1]), kvant(pos[i][2]),
                                             n8[0], n8[1], n8[2],
                                             r, gg, b,
                                             lj[0], lj[1], lj[2], lj[3],
                                             w8[0], w8[1], w8[2], w8[3]))
                    hjornetal += 1

    # ── Skjelettet ──
    ledd = []
    for i, ni in enumerate(joints):
        n = nodar[ni]
        forelder = -1
        for j, nj in enumerate(joints):
            if ni in (nodar[nj].get('children') or []):
                forelder = j
                break
        ledd.append({
            'namn': n.get('name', 'ledd%d' % i),
            'forelder': forelder,
            'bind': [round(v, 6) for v in ibm[i]],
            't': [round(v, 6) for v in n.get('translation', [0, 0, 0])],
            'r': [round(v, 6) for v in n.get('rotation', [0, 0, 0, 1])],
            's': [round(v, 6) for v in n.get('scale', [1, 1, 1])],
        })

    # ── Klippa ──
    klipp = {}
    for a in g.g.get('animations', []):
        namn = a.get('name')
        if namn not in KLIPP:
            continue
        spor = []
        lengd = 0
        for c in a['channels']:
            ni = c['target']['node']
            if ni not in plass:
                continue
            s = a['samplers'][c['sampler']]
            tider = [t[0] for t in g.les(s['input'])]
            verdiar = [list(v) for v in g.les(s['output'])]
            lengd = max(lengd, tider[-1] if tider else 0)
            spor.append({
                'ledd': plass[ni],
                'kva': c['target']['path'],
                'tid': [round(t, 4) for t in tider],
                'verdi': [[round(x, 5) for x in v] for v in verdiar]
            })
        klipp[namn] = {'lengd': round(lengd, 4), 'spor': spor}

    return ({'start': start, 'tal': hjornetal - start,
             'ledd': ledd, 'klipp': klipp}, hjornetal)


# ── Bygging ──────────────────────────────────────────────────────

def bygg():
    natur = finn_mappe(
        os.path.join(ROT, '_kjelder', 'kenney-nature', 'Models', 'GLTF format'))
    mini = finn_mappe(
        os.path.join(ROT, '_kjelder', 'kenney-mini', 'Models', 'GLB format'))
    tekstur = os.path.join(mini, 'Textures', 'colormap.png')
    if not os.path.isfile(tekstur):
        tekstur = os.path.join(os.path.dirname(mini), 'Textures', 'colormap.png')
    if not os.path.isfile(tekstur):
        raise SystemExit('Fann ikkje colormap.png til figuren')

    biter, hjornetal = [], 0
    modellar = {}
    for namn in TELT + LEIR:
        modellar[namn], hjornetal = statisk(natur, namn, biter, hjornetal)

    statiskBytes = len(b''.join(biter))
    fig, hjornetal = figur(mini, tekstur, biter, hjornetal)

    data = b''.join(biter)
    os.makedirs(UT, exist_ok=True)
    with open(os.path.join(UT, 'leir.bin'), 'wb') as f:
        f.write(data)

    indeks = {
        'app': 'ljodstigen', 'version': 1, 'type': 'leirplass',
        'kjelde': 'Kenney Nature Kit 2.1 og Mini Characters 1.0 (CC0)',
        'skala': SKALA,
        'stegStatisk': struct.calcsize(STATISK_FMT),
        'stegFigur': struct.calcsize(FIGUR_FMT),
        'figurStart': statiskBytes,
        'modellar': modellar,
        'telt': TELT,
        'figur': fig,
    }
    with open(os.path.join(UT, 'leir.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(indeks, f, ensure_ascii=False, separators=(',', ':'))

    print('Bokstavropet:')
    print('  %d statiske modellar, figur med %d ledd og %d klipp'
          % (len(modellar), len(fig['ledd']), len(fig['klipp'])))
    print('  statisk: %d hjørne (%d trekantar)'
          % (statiskBytes // struct.calcsize(STATISK_FMT),
             statiskBytes // struct.calcsize(STATISK_FMT) // 3))
    print('  figur:   %d hjørne (%d trekantar)' % (fig['tal'], fig['tal'] // 3))
    print('  leir.bin   %6.1f kB' % (len(data) / 1024))
    print('  leir.json  %6.1f kB'
          % (os.path.getsize(os.path.join(UT, 'leir.json')) / 1024))
    print('  skrive til %s' % UT)


def liste():
    print('Telt eleven vel mellom:')
    for t in TELT:
        print('  ' + t)
    print('Leirplassen elles:')
    for t in LEIR:
        print('  ' + t)
    print('Figur: %s, klipp: %s' % (FIGUR, ', '.join(KLIPP)))


if __name__ == '__main__':
    if '--liste' in sys.argv:
        liste()
    else:
        bygg()
