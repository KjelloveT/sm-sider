#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Finn HTML-sider som endar opp med `Cache-Control: immutable`.

    python sjekk_cache_rutar.py

Ei side som blir cacha immutable kan ikkje oppdaterast. Nettlesaren
hentar henne ikkje på nytt på eit år, uansett kva som blir deploya, og
ei vanleg omlasting hjelper ikkje — brukaren må tømme cachen for hand.
Deployen ser vellykka ut heile tida.

FELLA: Azure Static Web Apps fjernar `.html` frå URL-ar, så
`/ljodstigen/jakta.html` blir servert som `/ljodstigen/jakta`. Har du ei
cache-rute for ei ressursmappe med same namn — `/ljodstigen/jakta/*` for
eit teksturatlas — matchar ho sida òg. Det skjedde her, og resultatet var
ei spelside som sat fast i ein versjon der eit script mangla.

Skriptet tek omsyn til at rutene blir evaluerte i REKKJEFØLGJE og at
første treff vinn, slik Azure gjer. Ei meir spesifikk rute lenger oppe
med kort cache er difor ein gyldig fiks, og blir ikkje rapportert.

Køyr han når du legg til ei cache-rute. Han seier ifrå med exit-kode 1,
så han kan brukast i CI seinare.
"""
import fnmatch
import json
import os
import sys

ROT = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(ROT, 'staticwebapp.config.json')

HOPP_OVER = ('/.git', '_kjelder', 'node_modules', '/_libs/pyodide')


def html_sider():
    ut = []
    for rot, dirs, filer in os.walk(ROT):
        n = rot.replace('\\', '/')
        if any(h in n for h in HOPP_OVER):
            dirs[:] = []
            continue
        for f in filer:
            if f.endswith('.html'):
                rel = os.path.relpath(os.path.join(rot, f), ROT).replace('\\', '/')
                ut.append('/' + rel)
    return sorted(ut)


def urlar_for(side):
    """Alle URL-ane same fila kan bli servert på."""
    utan = side[:-5]
    ut = [side, utan]
    if utan.endswith('/index'):
        mappe = utan[:-6]
        ut += [mappe or '/', (mappe + '/') if mappe else '/']
    return ut


def matchar(url, monster):
    """Azure si mønstermatching, ikkje Python si.

    Skilnaden som betyr noko: `/x/*` matchar `/x` HOS AZURE, men ikkje i
    fnmatch, som krev skråstreken. Det var nettopp den skilnaden som lét
    ei ressursrute for `/ljodstigen/jakta/*` gje sjølve spelsida
    `/ljodstigen/jakta` eitt års immutable cache. Modellerer vakta berre
    fnmatch, ser ho ikkje feilen ho finst for å finne.
    """
    if fnmatch.fnmatch(url, monster):
        return True
    if monster.endswith('/*') and url == monster[:-2]:
        return True
    return False


def forste_treff(rutar, url):
    """Same logikk som Azure: første rute som matchar vinn."""
    for r in rutar:
        m = r.get('route')
        if m and matchar(url, m):
            return r
    return None


def main():
    d = json.load(open(CONFIG, encoding='utf-8'))
    rutar = d.get('routes', [])
    sider = html_sider()

    feil = []
    for side in sider:
        for url in urlar_for(side):
            r = forste_treff(rutar, url)
            if not r:
                continue
            cc = str(r.get('headers', {}).get('Cache-Control', ''))
            if 'immutable' in cc:
                feil.append((side, url, r['route'], cc))

    print('%d HTML-sider kontrollerte mot %d rutar.' % (len(sider), len(rutar)))
    if not feil:
        print('Ingen sider blir cacha immutable.')
        return 0

    print()
    for side, url, rute, cc in feil:
        print('  FEIL  %s' % side)
        print('        blir servert på %s' % url)
        print('        og treffer ruta %s  (%s)' % (rute, cc))
        print('        Legg ei meir spesifikk rute for sida FØRE denne.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
