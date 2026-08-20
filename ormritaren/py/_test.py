"""Retting av oppgåver i Ormritaren.

Køyrer elevens kode og sjekkar resultatet mot testane frå oppgåvefila.

Kvar test køyrer koden **på nytt i ein fersk modul**. Det er med vilje: elles
kunne ein variabel frå test 1 gjere at test 2 gjekk gjennom utan at koden
eigentleg var rett — og då rettar vi feil svar til grønt, som er verre enn å
ikkje rette i det heile.
"""

import contextlib
import io
import json
import sys
import traceback
import types

PROGRAM_FILE = "<program>"


def _ferskt_program(src, stdin_svar):
    """Lagar ein ny __main__ og køyrer koden i han. Returnerer (modul, utskrift)."""
    modul = types.ModuleType("__main__")
    modul.__dict__["__name__"] = "__main__"
    modul.__dict__["__file__"] = PROGRAM_FILE
    sys.modules["__main__"] = modul

    # Ingen kan svare på input() under retting, så vi matar inn på førehand.
    # Eit namn i modulen sin eigen ordbok skuggar for builtins.
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
    with contextlib.redirect_stdout(ut):
        exec(compile(src, PROGRAM_FILE, "exec"), modul.__dict__)  # noqa: S102

    return modul, ut.getvalue()


def _normaliser(tekst):
    """Samanlikning av utskrift skal ikkje stå og falle på mellomrom på slutten."""
    linjer = [linje.rstrip() for linje in str(tekst).strip().splitlines()]
    return "\n".join(linjer)


def _kall(fn, args):
    """Kallar elevens funksjon og held utskrifta hans for seg sjølv.

    Sjølve programmet blir køyrt med omdirigert stdout, men kallet skjedde
    utanfor — så ein funksjon med `print` inni sende teksten rett i
    utskriftsruta medan oppgåva vart retta. Eleven fekk då tilfeldige tal i
    ruta som ikkje kom frå hans eiga køyring.
    """
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*args)


def _hent_funksjon(modul, namn):
    fn = modul.__dict__.get(namn)
    if fn is None:
        return None, f"Fann ingen funksjon som heiter {namn}. Har du stava namnet likt?"
    if not callable(fn):
        return None, f"{namn} finst, men er ikkje ein funksjon."
    return fn, None


def _ein_test(src, test):
    typ = test.get("type")

    # Sjekk av framgangsmåte — treng ikkje køyre koden.
    if typ == "inneheld":
        if test["vent"] in src:
            return {"ok": True}
        return {"ok": False,
                "melding": test.get("grunn", f"Koden må innehalde «{test['vent']}»")}

    modul, utskrift = _ferskt_program(src, test.get("stdin"))

    if typ == "koyrer":
        # Ingen fasit — vi sjekkar berre at koden går gjennom utan å kaste.
        # Redigeringsverktøyet bruker denne på løypestega, der det ikkje finst
        # noko rett svar, berre eit krav om at koden faktisk køyrer.
        return {"ok": True}

    if typ == "utskrift":
        fekk = _normaliser(utskrift)
        vente = _normaliser(test["vent"])
        if fekk == vente:
            return {"ok": True}
        return {"ok": False, "melding": "Utskrifta stemmer ikkje.",
                "fekk": fekk, "vente": vente}

    if typ == "kall":
        # Merk: `vent` kjem frå JSON, og der er nøklane i eit objekt alltid
        # tekst. Ei venta ordbok med talnøklar kan difor aldri bli lik det
        # elevkoden returnerer. Skal ei oppgåve sjekke ei ordbok med tal som
        # nøklar, må ho heller returnere eit tal eller ei liste — eller
        # samanliknast som utskrift.
        fn, feil = _hent_funksjon(modul, test["fn"])
        if feil:
            return {"ok": False, "melding": feil}
        fekk = _kall(fn, test.get("args", []))
        if fekk == test["vent"]:
            return {"ok": True}
        kall = f"{test['fn']}({', '.join(repr(a) for a in test.get('args', []))})"
        return {"ok": False, "melding": f"{kall} gav feil svar.",
                "fekk": repr(fekk), "vente": repr(test["vent"])}

    if typ == "naer":
        # For simulering: svaret er tilfeldig, så vi godtek eit intervall.
        # Å låse random.seed() i staden ville gjeve eksakt fasit, men då får
        # eleven same «tilfeldige» resultat kvar gong — og då er det ikkje
        # lenger ei simulering.
        slingring = test.get("slingring", 0.05)
        if "fn" in test:
            fn, feil = _hent_funksjon(modul, test["fn"])
            if feil:
                return {"ok": False, "melding": feil}
            fekk = _kall(fn, test.get("args", []))
        else:
            namn = test["variabel"]
            if namn not in modul.__dict__:
                return {"ok": False, "melding": f"Fann ingen variabel som heiter {namn}."}
            fekk = modul.__dict__[namn]
        try:
            avvik = abs(float(fekk) - float(test["vent"]))
        except (TypeError, ValueError):
            return {"ok": False, "melding": "Svaret er ikkje eit tal.",
                    "fekk": repr(fekk), "vente": repr(test["vent"])}
        if avvik <= slingring:
            return {"ok": True}
        return {"ok": False,
                "melding": f"Svaret skal liggje nær {test['vent']} (± {slingring}).",
                "fekk": repr(fekk), "vente": f"{test['vent']} ± {slingring}"}

    return {"ok": False, "melding": f"Ukjend testtype: {typ}"}


def koyr_testar(src, testar_json):
    """Køyrer alle testane. Returnerer JSON med eitt resultat per test."""
    testar = json.loads(testar_json)
    resultat = []

    for test in testar:
        try:
            resultat.append(_ein_test(src, test))
        except SyntaxError as exc:
            resultat.append({
                "ok": False, "type": type(exc).__name__,
                "melding": f"Koden har ein syntaksfeil på linje {exc.lineno}: {exc.msg}",
                "stopp": True,
            })
        except BaseException as exc:  # noqa: BLE001 — elevkode kan kaste kva som helst
            eigne = [r for r in traceback.extract_tb(exc.__traceback__)
                     if r.filename == PROGRAM_FILE]
            linje = eigne[-1].lineno if eigne else None
            resultat.append({
                "ok": False, "type": type(exc).__name__,
                "melding": f"{type(exc).__name__}: {exc}",
                "linje": linje,
            })

    return json.dumps(resultat)
