#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Byggjer lydspritene til Ljodstigen frå råopptaka.

    python bygg_ljodstigen_lydbank.py [bank ...]

Les WAV-filer frå  _kjelder/ljodstigen-lyd/<bank>/<id>.wav
og skriv           ljodstigen/lyd/<bank>.mp3  +  <bank>.json

Éin MP3 per bank i staden for 141 småfiler: fire nettverkskall i staden
for hundrevis, som betyr noko på skule-wifi.

TRE TING SKRIPTET GJER MED LYDEN, OG KVIFOR:

1. TRIMMAR til fast innleiing. Råklippa har frå 0,01 til 0,27 s stille
   framfor lyden. Ulik innleiing gjer at nokre bokstavar «svarar» treigare
   enn andre, og i eit spel som måler responstid er det ikkje greitt.

2. JAMNAR STYRKEN DELVIS. Opptaka er toppnormaliserte til -1 dBFS, men
   topp er ikkje det øyret høyrer: ein kort smell og ein hald vokal med
   same topp har 12 dB skilnad i RMS. I Bokstavropet skal eleven velje
   mellom to lydar, og då kan ikkje «den høgaste» vere eit utilsikta hint.
   Vi flyttar kvart klipp HALVVEGS mot median-RMS, ikkje heilt: /t/ ER
   naturleg svakare enn /m/, og full utjamning høyrest kunstig ut.

3. LEGG 60 ms STILLE mellom klippa. MP3-koding gjev nokre millisekund
   forskyving i begge endar, og utan margin lek naboklippet inn. Marginen
   er òg grunnen til at spriten toler at offseta er nokre få ms unna.

MP3 er valt framfor Opus fordi iPad er utbreidd i norske klasserom og
Safari sin Opus-støtte er for fersk. 64 kbps mono: desse klippa er
læremateriell der det å skilje /f/ frå /v/ er sjølve poenget, og heile
banken er nokre hundre kilobyte uansett.
"""
import array
import io
import json
import math
import os
import sys
import wave

ROT = os.path.dirname(os.path.abspath(__file__))
KJELDE = os.path.join(ROT, '_kjelder', 'ljodstigen-lyd')
UT = os.path.join(ROT, 'ljodstigen', 'lyd')
MANIFEST = os.path.join(UT, 'manifest.json')

BANKS = ('fonem', 'namn', 'ord', 'ros')

LEAD_MS = 20        # stille framfor kvart klipp, likt for alle
TAIL_MS = 40        # naturleg utklang vi lèt stå
GAP_MS = 60         # stille mellom klipp i spriten
HEAD_MS = 80        # stille heilt i starten, tek unna kodeforsinking
FADE_MS = 5         # mot klikk i skøytane
SILENCE_DB = -30    # terskel under toppen for «her byrjar lyden»
PEAK_CEIL = 0.891   # -1 dBFS
ALIGN = 0.5         # kor langt mot median-RMS vi flyttar (0 = ikkje, 1 = heilt)
BITRATE = 64


# ── WAV inn ──────────────────────────────────────────────────────

def read_wav(path):
    w = wave.open(path, 'rb')
    if w.getsampwidth() != 2:
        raise SystemExit('%s: berre 16-bits WAV er støtta' % path)
    n, fr, ch = w.getnframes(), w.getframerate(), w.getnchannels()
    a = array.array('h')
    a.frombytes(w.readframes(n))
    w.close()
    if ch == 2:                       # mikse ned om nokon leverer stereo
        a = array.array('h', [(a[i] + a[i + 1]) // 2 for i in range(0, len(a) - 1, 2)])
    return a, fr


def rms(a):
    if not len(a):
        return 0.0
    return math.sqrt(sum(v * v for v in a) / len(a)) / 32768.0


def peak(a):
    return (max(abs(v) for v in a) / 32768.0) if len(a) else 0.0


def find_sound(a, fr, win_ms=5, hold_ms=25):
    """Første og siste sample der det faktisk er lyd.

    Terskelen åleine held ikkje. Fleire av råklippa har eit einsleg blaff
    på kring -40 dB tidleg — ein munnlyd, eit klikk frå stolen — og ein
    detektor som ser på eitt vindauge om gongen trur lyden byrjar der.
    Resultatet var 160 ms daud luft framfor /y/, som eleven ventar på i
    ei oppgåve som måler responstid.

    Difor: vi krev at nivået HELD SEG oppe. Snittet over dei neste
    hold_ms må vere over terskelen. Ein tikk fell tilbake med ein gong og
    dreg ikkje snittet opp; ein ekte taleoppstart gjer det.
    """
    win = max(1, int(fr * win_ms / 1000))
    levels = []
    for i in range(0, len(a) - win + 1, win):
        levels.append(rms(a[i:i + win]))
    if not levels:
        return 0, len(a)
    top = max(levels)
    if top <= 0:
        return 0, len(a)
    thr = top * (10 ** (SILENCE_DB / 20.0))
    hold = max(1, int(hold_ms / win_ms))

    def sustained(i, step):
        """Snittnivå over hold vindauge frå i og utover i retning step."""
        idx = [i + k * step for k in range(hold)]
        idx = [j for j in idx if 0 <= j < len(levels)]
        return (sum(levels[j] for j in idx) / len(idx)) if idx else 0.0

    start = next((i for i in range(len(levels)) if sustained(i, 1) > thr), None)
    if start is None:                       # ingenting over terskel: bruk alt
        return 0, len(a)
    end = next((i for i in range(len(levels) - 1, -1, -1) if sustained(i, -1) > thr), start)
    return start * win, min(len(a), (end + 1) * win)


def trim(a, fr):
    s, e = find_sound(a, fr)
    lead = int(fr * LEAD_MS / 1000)
    tail = int(fr * TAIL_MS / 1000)
    s = max(0, s - lead)
    e = min(len(a), e + tail)
    return a[s:e]


def fade(a, fr):
    n = min(int(fr * FADE_MS / 1000), len(a) // 2)
    for i in range(n):
        g = i / n
        a[i] = int(a[i] * g)
        a[-1 - i] = int(a[-1 - i] * g)
    return a


def gain(a, g):
    out = array.array('h', bytes(len(a) * 2))
    for i, v in enumerate(a):
        x = int(v * g)
        out[i] = 32767 if x > 32767 else (-32768 if x < -32768 else x)
    return out


def silence(fr, ms):
    return array.array('h', bytes(int(fr * ms / 1000) * 2))


# ── Bygg éin bank ────────────────────────────────────────────────

def build(bank, manifest, verbose=True):
    src = os.path.join(KJELDE, bank)
    if not os.path.isdir(src):
        return None, 'mappa finst ikkje'

    ids = sorted(manifest.get(bank, {}))
    have = {f[:-4] for f in os.listdir(src) if f.lower().endswith('.wav')}
    missing = [i for i in ids if i not in have]
    extra = sorted(have - set(ids))
    ids = [i for i in ids if i in have]
    if not ids:
        return None, 'ingen wav-filer som står i manifestet'

    clips, rate = [], None
    for cid in ids:
        a, fr = read_wav(os.path.join(src, cid + '.wav'))
        if rate is None:
            rate = fr
        elif fr != rate:
            raise SystemExit('%s har %d Hz, resten har %d Hz' % (cid, fr, rate))
        clips.append([cid, fade(trim(a, fr), fr)])

    # Delvis styrkejamning mot medianen.
    levels = sorted(rms(c[1]) for c in clips)
    median = levels[len(levels) // 2]
    adjusted = 0
    for c in clips:
        r = rms(c[1])
        if r <= 0:
            continue
        g = (median / r) ** ALIGN
        # Aldri over taket: heller for svak enn forvrengd.
        p = peak(c[1])
        if p * g > PEAK_CEIL:
            g = PEAK_CEIL / p
        if abs(20 * math.log10(g)) > 0.3:
            c[1] = gain(c[1], g)
            adjusted += 1

    # Skøyt saman og noter kvar kvart klipp ligg.
    out = silence(rate, HEAD_MS)
    gap = silence(rate, GAP_MS)
    offsets = {}
    for cid, a in clips:
        start = len(out) / rate
        out.extend(a)
        offsets[cid] = [round(start, 4), round(len(a) / rate, 4)]
        out.extend(gap)

    mp3 = encode(out, rate)

    os.makedirs(UT, exist_ok=True)
    with open(os.path.join(UT, bank + '.mp3'), 'wb') as f:
        f.write(mp3)
    with open(os.path.join(UT, bank + '.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'app': 'ljodstigen', 'version': 1, 'bank': bank,
                   'rate': rate, 'gapMs': GAP_MS, 'clips': offsets},
                  f, ensure_ascii=False, indent=1)
        f.write('\n')

    if verbose:
        print('  %-6s %2d klipp  %5.1f s  %6.1f kB  (%d justerte i styrke)'
              % (bank, len(clips), len(out) / rate, len(mp3) / 1024, adjusted))
        if missing:
            print('         manglar enno: %s' % ', '.join(missing))
        if extra:
            print('         ligg i mappa men ikkje i manifestet: %s' % ', '.join(extra))
    return len(clips), None


def encode(samples, rate):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)              # 2 = høg kvalitet, treg koding. 21 s totalt.
    data = enc.encode(samples.tobytes())
    data += enc.flush()
    return bytes(data)


def main():
    if not os.path.exists(MANIFEST):
        raise SystemExit('Manifestet manglar. Køyr lag_ljodstigen_lydliste.py først.')
    manifest = json.load(open(MANIFEST, encoding='utf-8'))['banks']

    want = sys.argv[1:] or BANKS
    print('Byggjer lydbank frå %s' % KJELDE)
    total = 0
    for bank in want:
        if bank not in BANKS:
            print('  ukjend bank: %s' % bank)
            continue
        n, err = build(bank, manifest)
        if err:
            print('  %-6s hoppa over — %s' % (bank, err))
        else:
            total += n
    print('%d klipp bygde.' % total)


if __name__ == '__main__':
    main()
