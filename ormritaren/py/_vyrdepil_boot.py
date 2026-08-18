"""Oppstartskode for Ormritaren.

Køyrer inne i Pyodide-workeren og gjev éin inngang: run_user_code(src).
Poenget er å halde vår eiga rigg heilt utanfor tracebacken eleven ser —
ein elev som får «File "<exec>", line 1, in run_user_code» lærer ingenting.
"""

import builtins
import json
import sys
import traceback
import types

from _ormbru import les_linje as _les_linje

PROGRAM_FILE = "<program>"


def _input(prompt=""):
    """Erstattar builtins.input.

    Vi går utanom stdin i Emscripten med vilje. Å lese frå stdin gjev
    OSError her, og prompten hamnar i ein stdout-buffer som ikkje blir
    tømd før det kjem eit linjeskift — så eleven ser eit tomt vindauge
    utan å vite kva det er spurt om. Denne brua tek prompten med seg.
    """
    return _les_linje(str(prompt))


builtins.input = _input


def _linje(tb_liste):
    """Siste linjenummer i elevens eigen kode, om det finst eit."""
    for ramme in reversed(tb_liste):
        if ramme.filename == PROGRAM_FILE:
            return ramme.lineno
    return None


def _feil(exc):
    """Gjer eit unntak om til ein struktur JS-sida kan omsetje."""
    tb_liste = traceback.extract_tb(exc.__traceback__)
    # Berre rammer frå elevens kode — resten er vår rigg og støyar berre.
    eigne = [r for r in tb_liste if r.filename == PROGRAM_FILE]
    tekst = "".join(
        traceback.format_list(eigne)
        + traceback.format_exception_only(type(exc), exc)
    )
    return {
        "type": type(exc).__name__,
        "melding": str(exc),
        "linje": _linje(tb_liste),
        "traceback": tekst.rstrip(),
    }


def _syntaksfeil(exc):
    return {
        "type": type(exc).__name__,
        "melding": exc.msg or str(exc),
        "linje": exc.lineno,
        "traceback": "".join(
            traceback.format_exception_only(type(exc), exc)
        ).rstrip(),
    }


_SKJUL = {"__name__", "__file__", "__builtins__", "__doc__",
          "__package__", "__loader__", "__spec__"}


def variablar():
    """Verdiane eleven sat att med då programmet var ferdig.

    Modular og funksjonar er utelatne — dei er ikkje det eleven lurer på når
    noko ikkje stemmer, og ei liste med `math` og `print` ville drukna dei tre
    variablane som faktisk betyr noko.
    """
    modul = sys.modules.get("__main__")
    if modul is None:
        return "[]"

    ut = []
    for namn, verdi in modul.__dict__.items():
        if namn.startswith("_") or namn in _SKJUL:
            continue
        if isinstance(verdi, types.ModuleType) or callable(verdi):
            continue
        try:
            tekst = repr(verdi)
        except BaseException:  # noqa: BLE001 — eit __repr__ kan kaste kva som helst
            tekst = "<klarte ikkje vise verdien>"
        if len(tekst) > 300:
            tekst = tekst[:300] + " …"
        ut.append({"namn": namn, "type": type(verdi).__name__, "verdi": tekst})

    return json.dumps(ut)


def run_user_code(src):
    """Køyr elevkode i eit ferskt __main__. Returnerer JSON, eller None ved suksess."""
    modul = types.ModuleType("__main__")
    modul.__dict__["__name__"] = "__main__"
    modul.__dict__["__file__"] = PROGRAM_FILE
    sys.modules["__main__"] = modul

    try:
        kode = compile(src, PROGRAM_FILE, "exec")
    except SyntaxError as exc:
        return json.dumps(_syntaksfeil(exc))
    except ValueError as exc:
        # T.d. null-byte i kjelda.
        return json.dumps({"type": "ValueError", "melding": str(exc),
                           "linje": None, "traceback": str(exc)})

    try:
        exec(kode, modul.__dict__)
    except SystemExit:
        pass
    except KeyboardInterrupt:
        return json.dumps({"type": "KeyboardInterrupt", "melding": "avbrote",
                           "linje": None, "traceback": "Programmet vart stoppa."})
    except BaseException as exc:  # noqa: BLE001 — elevkode kan kaste kva som helst
        return json.dumps(_feil(exc))

    return None


# --- Steg for steg -------------------------------------------------------

MAKS_STEG = 4000


def _variablar_i(ramme):
    """Same filteret som variablar(), men for éi ramme under køyring."""
    ut = []
    for namn, verdi in list(ramme.f_locals.items()):
        if namn.startswith("_") or namn in _SKJUL:
            continue
        if isinstance(verdi, types.ModuleType) or callable(verdi):
            continue
        try:
            tekst = repr(verdi)
        except BaseException:  # noqa: BLE001
            tekst = "<klarte ikkje vise verdien>"
        if len(tekst) > 200:
            tekst = tekst[:200] + " …"
        ut.append({"namn": namn, "type": type(verdi).__name__, "verdi": tekst})
    return ut


def koyr_stegvis(src):
    """Køyrer elevkode ei linje om gongen.

    sys.settrace gjev oss eit varsel rett FØR kvar linje blir køyrd. Vi sender
    linjenummeret og variablane til hovudtråden og blokkerer der til han seier
    frå at vi kan gå vidare — same mekanismen som input() bruker.

    At varselet kjem før linja er nettopp det vi vil ha: eleven ser linja
    lyse opp, trykkjer vidare, og ser så kva ho gjorde.
    """
    from _ormbru import steg as _steg

    modul = types.ModuleType("__main__")
    modul.__dict__["__name__"] = "__main__"
    modul.__dict__["__file__"] = PROGRAM_FILE
    sys.modules["__main__"] = modul

    try:
        kode = compile(src, PROGRAM_FILE, "exec")
    except SyntaxError as exc:
        return json.dumps(_syntaksfeil(exc))

    teljar = [0]

    def sporar(ramme, hending, arg):
        # Berre elevens eigen kode. Utan dette ville vi stoppa inne i
        # biblioteka òg, og eleven hamna i kjeldekoden til random.
        if ramme.f_code.co_filename != PROGRAM_FILE:
            return None
        if hending == "line":
            teljar[0] += 1
            if teljar[0] > MAKS_STEG:
                raise RuntimeError(
                    f"Steg for steg stoppar etter {MAKS_STEG} linjer. "
                    "Programmet ditt gjer for mange steg til å følgjast slik — "
                    "prøv med færre rundar i løkka."
                )
            # Skilpadda samlar strekar i ein buffer og sender dei i bolkar.
            # Under stegvis køyring må teikninga følgje linja, elles ser
            # eleven variablane endre seg utan at noko skjer på lerretet.
            skilpadde = sys.modules.get("turtle")
            if skilpadde is not None:
                try:
                    skilpadde.tøm()
                except BaseException:  # noqa: BLE001
                    pass
            _steg(ramme.f_lineno, json.dumps(_variablar_i(ramme)))
        return sporar

    sys.settrace(sporar)
    try:
        exec(kode, modul.__dict__)  # noqa: S102
    except SystemExit:
        pass
    except BaseException as exc:  # noqa: BLE001
        return json.dumps(_feil(exc))
    finally:
        sys.settrace(None)

    return None
