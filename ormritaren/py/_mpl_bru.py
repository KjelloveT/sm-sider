"""Koplar matplotlib til grafikkruta i Ormritaren.

Blir køyrd berre når matplotlib faktisk er lasta inn.

matplotlib i nettlesaren har ingen skjerm å teikne på, så vi bruker AGG —
same rasteriseringa som når du lagrar ei fil — og sender PNG-en til
hovudtråden. `plt.show()` blir patcha til å gjere nettopp det, slik at
programma elevane finn i lærebøker og på nettet verkar uendra.
"""

import base64
import io

import matplotlib

matplotlib.use("AGG")

import matplotlib.pyplot as _plt  # noqa: E402 — må kome etter use()

from _ormbru import vis_bilete as _vis_bilete  # noqa: E402


def _show(*a, **k):
    for nummer in _plt.get_fignums():
        figur = _plt.figure(nummer)
        buffer = io.BytesIO()
        # bbox_inches='tight' fjernar den brede kvite ramma som elles gjer
        # figuren liten i ei smal grafikkrute.
        figur.savefig(buffer, format="png", dpi=100, bbox_inches="tight")
        _vis_bilete(base64.b64encode(buffer.getvalue()).decode("ascii"))
    _plt.close("all")


_plt.show = _show
