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
