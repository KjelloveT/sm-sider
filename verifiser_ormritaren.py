#!/usr/bin/env python3
"""Verifiser opplæringsmodulane i Ormritaren.

Køyrer alt innhaldet i staden for å lese det. Eit oppgåvesett som ser rett ut
og er gale er verre enn ingen oppgåver: eleven får raudt på ei løysing som er
rett, eller grønt på ei som ikkje er det, og har ingen måte å vite kven som
tek feil.

Skriptet bruker **den same rettemotoren som elevane** — `ormritaren/py/_test.py`
blir importert, ikkje skriven om. Ein kopi ville før eller seinare kome i
utakt, og då hadde vi verifisert noko anna enn det som faktisk køyrer.

Det som blir sjekka:

  * kvar løysing passerer sine eigne testar
  * kvar startkode feilar minst éin test — elles er oppgåva løyst på førehand
  * kvar les-oppgåve har rett fasit, kontrollert mot faktisk utskrift eller
    mot feiltypen koden kastar
  * ingen distraktor i ei les-oppgåve er òg rett
  * oppgåver som bruker `random` blir køyrde fleire gonger, så toleransar som
    er litt for stramme blir oppdaga her og ikkje i eit klasserom
  * kvar leksjon har løype med mål og steg

Køyr:  python verifiser_ormritaren.py
       python verifiser_ormritaren.py sannsyn      (berre éin modul)
"""

import io
import json
import contextlib
import importlib.util
import sys
import types
from pathlib import Path

ROT = Path(__file__).parent
MODULMAPPE = ROT / "ormritaren" / "moduler"
GJENTAK_TILFELDIG = 5          # køyringar per oppgåve som bruker random
TIDSGRENSE_STEG = 2_000_000    # bytecode-steg før vi kallar det ei evig løkke


def legg_inn_attrapper():
    """Attrapper for matplotlib og turtle.

    Elevane køyrer i Pyodide, der begge finst. Lokalt gjer dei det ikkje — og
    utan attrapper kunne vi ikkje verifisert ei einaste oppgåve i modulen om
    grafar, som er nettopp der ein feil er lettast å gjere.

    Oppgåvene måler aldri kva som blir teikna, berre kva koden reknar ut, så
    ein attrapp som ikkje gjer noko er nok. Sjølve teikninga blir kontrollert
    i nettlesaren.
    """
    class Attrapp(types.ModuleType):
        def __getattr__(self, namn):
            if namn.startswith("__"):
                raise AttributeError(namn)
            return lambda *a, **k: None

    for namn in ["matplotlib", "matplotlib.pyplot", "turtle"]:
        sys.modules.setdefault(namn, Attrapp(namn))
    sys.modules["matplotlib"].pyplot = sys.modules["matplotlib.pyplot"]


def hent_rettemotor():
    """Importerer elevane sin eigen _test.py."""
    sti = ROT / "ormritaren" / "py" / "_test.py"
    spec = importlib.util.spec_from_file_location("orm_test", sti)
    motor = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(motor)
    return motor


class Rapport:
    def __init__(self):
        self.feil = []
        self.tal = {"loeysing": 0, "startkode": 0, "les": 0, "loype": 0}

    def klag(self, modul, leksjon, oppgave, kva, detalj=""):
        self.feil.append((modul, leksjon, oppgave, kva, detalj))

    def tel(self, kva):
        self.tal[kva] += 1


def køyr_med_grense(fn):
    """Køyrer fn med ei grense på tal bytecode-steg.

    Ein startkode kan innehalde ei løkke som aldri sluttar — det har hendt, og
    då heng heile verifiseringa utan å seie kvifor. Grensa gjer at vi får ei
    tydeleg melding i staden.
    """
    resultat = {}

    def sporing(ramme, hending, arg):
        sporing.steg += 1
        if sporing.steg > TIDSGRENSE_STEG:
            raise TimeoutError("køyrde for lenge — ei løkke som aldri sluttar?")
        return sporing

    sporing.steg = 0
    sys.settrace(sporing)
    try:
        resultat["verdi"] = fn()
    finally:
        sys.settrace(None)
    return resultat["verdi"]


def sjekk_kode_oppgave(motor, o, rapport, m_id, l_id):
    """skriv og rett: løysinga skal passere, startkoden skal feile."""
    testar_json = json.dumps(o["testar"])
    tilfeldig = "random" in o.get("loeysing", "")
    rundar = GJENTAK_TILFELDIG if tilfeldig else 1

    if "loeysing" in o:
        rapport.tel("loeysing")
        for runde in range(rundar):
            try:
                svar = json.loads(køyr_med_grense(
                    lambda: motor.koyr_testar(o["loeysing"], testar_json)))
            except TimeoutError as e:
                rapport.klag(m_id, l_id, o["id"], "LØYSINGA HENG", str(e))
                break
            daarleg = [r for r in svar if not r["ok"]]
            if daarleg:
                kva = "LØYSINGA FEILAR"
                if tilfeldig and runde > 0:
                    kva = f"LØYSINGA FEILAR AV OG TIL (runde {runde + 1}/{rundar})"
                rapport.klag(m_id, l_id, o["id"], kva,
                             "; ".join(d.get("melding", "") for d in daarleg))
                break

    if "startkode" in o:
        rapport.tel("startkode")
        try:
            svar = json.loads(køyr_med_grense(
                lambda: motor.koyr_testar(o["startkode"], testar_json)))
        except TimeoutError as e:
            rapport.klag(m_id, l_id, o["id"], "STARTKODEN HENG", str(e))
            return
        if all(r["ok"] for r in svar):
            rapport.klag(m_id, l_id, o["id"], "STARTKODEN PASSERER ALT",
                         "oppgåva er løyst på førehand")


def køyr_og_fang(kode, stdin_svar=None):
    """Køyrer kode og gjev (utskrift, feiltypenamn eller None)."""
    modul = types.ModuleType("__main__")
    modul.__dict__["__name__"] = "__main__"
    att = list(stdin_svar or [])

    def _input(prompt=""):
        svar = att.pop(0) if att else ""
        # Skriv same samtalen som arbeidsflata viser eleven: ledeteksten slik
        # CPython sjølv skriv han, og så svaret, slik eit terminalvindauge
        # ekkar det du tastar. Då er ein fasit kopiert rett frå utskrifta
        # i editoren den same teksten som rettinga samanliknar mot.
        print(f"{prompt}{svar}")
        return svar

    modul.__dict__["input"] = _input

    ut = io.StringIO()
    try:
        with contextlib.redirect_stdout(ut):
            exec(compile(kode, "<program>", "exec"), modul.__dict__)  # noqa: S102
    except BaseException as e:  # noqa: BLE001
        return ut.getvalue(), type(e).__name__
    return ut.getvalue(), None


def normaliser(t):
    return "\n".join(linje.rstrip() for linje in str(t).strip().splitlines())


def passar(kode, fasit, stdin_svar):
    """Stemmer dette alternativet med det koden faktisk gjer?"""
    utskrift, feiltype = køyr_og_fang(kode, stdin_svar)
    if normaliser(utskrift) == normaliser(fasit):
        return True
    # Nokre les-oppgåver spør kva slags feil koden gjev, ikkje kva han skriv ut.
    return bool(feiltype) and normaliser(fasit) == feiltype


def sjekk_les_oppgave(o, rapport, m_id, l_id):
    rapport.tel("les")
    stdin_svar = o.get("stdin")
    fasit = o["alternativ"][o["rett"]]

    if not passar(o["kode"], fasit, stdin_svar):
        utskrift, feiltype = køyr_og_fang(o["kode"], stdin_svar)
        rapport.klag(m_id, l_id, o["id"], "FASITEN STEMMER IKKJE",
                     f"markert «{fasit}», men koden gav "
                     f"«{normaliser(utskrift) or feiltype}»")
        return

    # Ein distraktor som òg er rett gjer oppgåva umogleg å svare rett på.
    for i, alt in enumerate(o["alternativ"]):
        if i == o["rett"]:
            continue
        if passar(o["kode"], alt, stdin_svar):
            rapport.klag(m_id, l_id, o["id"], "TVETYDIG",
                         f"alternativ «{alt}» stemmer òg")


def sjekk_modul(motor, sti, rapport):
    data = json.loads(sti.read_text(encoding="utf-8"))
    m_id = data["id"]

    for leksjon in data["leksjonar"]:
        l_id = leksjon["id"]

        loype = leksjon.get("loype")
        rapport.tel("loype")
        if not loype:
            rapport.klag(m_id, l_id, "", "MANGLAR LØYPE")
        else:
            if not loype.get("maal"):
                rapport.klag(m_id, l_id, "", "LØYPE UTAN MÅL")
            if not loype.get("steg"):
                rapport.klag(m_id, l_id, "", "LØYPE UTAN STEG")

        for o in leksjon.get("oppgaver", []):
            if o["type"] == "les":
                sjekk_les_oppgave(o, rapport, m_id, l_id)
            else:
                sjekk_kode_oppgave(motor, o, rapport, m_id, l_id)

    return len(data["leksjonar"])


def main():
    legg_inn_attrapper()
    motor = hent_rettemotor()
    katalog = json.loads((MODULMAPPE / "index.json").read_text(encoding="utf-8"))

    vil_ha = sys.argv[1:]
    modular = [m for m in katalog["modular"]
               if m.get("klar") is not False
               and (not vil_ha or m["id"] in vil_ha)]

    if not modular:
        print("Fann ingen modular å sjekke.")
        return 1

    rapport = Rapport()
    print()
    for m in modular:
        tal = sjekk_modul(motor, MODULMAPPE / m["fil"], rapport)
        print(f"  {m['tittel']:<22} {tal} leksjonar")

    t = rapport.tal
    print()
    print(f"  {t['loeysing']} løysingar, {t['startkode']} startkodar, "
          f"{t['les']} les-oppgåver, {t['loype']} løyper")
    print()

    if rapport.feil:
        print(f"  {len(rapport.feil)} problem:")
        print()
        for m_id, l_id, o_id, kva, detalj in rapport.feil:
            stad = f"{m_id}/{l_id}" + (f"/{o_id}" if o_id else "")
            print(f"    {stad}")
            print(f"      {kva}" + (f" — {detalj}" if detalj else ""))
        print()
        return 1

    print("  Alt i orden.")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
