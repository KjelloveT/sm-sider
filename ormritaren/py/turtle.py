"""turtle for Ormritaren.

Pyodide har ikkje turtle — standardbiblioteket sin versjon krev tkinter, som
ikkje finst i nettlesaren. Denne modulen gjev det same API-et, men i staden
for å teikne sjølv sender han teiknekommandoar ut av workeren. Hovudtråden
spelar dei av på eit canvas.

At kommandoane er ein straum og ikkje eit ferdig bilete er sjølve poenget:
det let eleven sjå forma bli til, steg for steg, i staden for at ho berre
dukkar opp. Det er heile grunnen til at turtle finst i skulen.

Koordinatsystemet er turtle sitt eige: (0, 0) i midten, y oppover, vinkel 0
mot høgre og aukande mot klokka. Omrekninga til canvas skjer i graphics.js.
"""

import math

from _ormbru import teikn as _teikn

_BUFFER = []
_FLUSH_GRENSE = 200          # send i bolkar, elles blir det ei melding per steg


def _send(kommando):
    _BUFFER.append(kommando)
    if len(_BUFFER) >= _FLUSH_GRENSE:
        tøm()


def tøm():
    """Send det som ligg att i bufferen. Blir kalla av køyraren når programmet er ferdig."""
    global _BUFFER
    if _BUFFER:
        _teikn(_BUFFER)
        _BUFFER = []


class Turtle:
    def __init__(self):
        self._x = 0.0
        self._y = 0.0
        self._vinkel = 0.0        # grader, 0 = mot høgre
        self._nede = True
        self._farge = "black"
        self._fyllfarge = "black"
        self._tjukn = 2
        self._fart = 6
        self._synleg = True
        self._fyller = False
        self._fyllpunkt = []
        self._vis()

    # -- interne -------------------------------------------------------

    def _vis(self):
        _send({"k": "skilpadde", "x": self._x, "y": self._y,
               "v": self._vinkel, "synleg": self._synleg, "fart": self._fart})

    def _til(self, x, y):
        if self._nede:
            _send({"k": "linje", "x1": self._x, "y1": self._y, "x2": x, "y2": y,
                   "farge": self._farge, "tjukn": self._tjukn, "fart": self._fart})
        if self._fyller:
            self._fyllpunkt.append((x, y))
        self._x, self._y = x, y
        self._vis()

    # -- rørsle --------------------------------------------------------

    def forward(self, lengd):
        r = math.radians(self._vinkel)
        self._til(self._x + lengd * math.cos(r), self._y + lengd * math.sin(r))

    def backward(self, lengd):
        self.forward(-lengd)

    def right(self, grader):
        self._vinkel = (self._vinkel - grader) % 360
        self._vis()

    def left(self, grader):
        self._vinkel = (self._vinkel + grader) % 360
        self._vis()

    def goto(self, x, y=None):
        if y is None:
            x, y = x
        self._til(float(x), float(y))

    def setx(self, x):
        self._til(float(x), self._y)

    def sety(self, y):
        self._til(self._x, float(y))

    def setheading(self, vinkel):
        self._vinkel = float(vinkel) % 360
        self._vis()

    def home(self):
        self.goto(0, 0)
        self.setheading(0)

    def circle(self, radius, extent=None, steps=None):
        """Teiknar ein boge slik turtle gjer det: sentrum til venstre for skilpadda."""
        if extent is None:
            extent = 360
        if steps is None:
            # Nok segment til at kurva ser mjuk ut, men ikkje fleire enn nødvendig.
            steps = max(4, int(abs(extent) / 6) + 1)
        vinkelsteg = float(extent) / steps
        lengdesteg = 2 * radius * math.sin(math.radians(vinkelsteg) / 2)
        # Halv sving fyrst, så segmenta legg seg symmetrisk kring kurva.
        self.left(vinkelsteg / 2)
        for _ in range(steps):
            self.forward(lengdesteg)
            self.left(vinkelsteg)
        self.right(vinkelsteg / 2)

    def dot(self, storleik=None, farge=None):
        _send({"k": "prikk", "x": self._x, "y": self._y,
               "r": (storleik or max(4, self._tjukn * 2)) / 2,
               "farge": farge or self._farge})

    def write(self, tekst, move=False, align="left", font=("Arial", 12, "normal")):
        _send({"k": "skriv", "x": self._x, "y": self._y, "tekst": str(tekst),
               "farge": self._farge, "storleik": font[1] if len(font) > 1 else 12,
               "justering": align})

    # -- penn ----------------------------------------------------------

    def penup(self):
        self._nede = False

    def pendown(self):
        self._nede = True

    def pensize(self, tjukn=None):
        if tjukn is None:
            return self._tjukn
        self._tjukn = float(tjukn)

    def pencolor(self, *farge):
        if not farge:
            return self._farge
        self._farge = _farge_til_css(farge)

    def fillcolor(self, *farge):
        if not farge:
            return self._fyllfarge
        self._fyllfarge = _farge_til_css(farge)

    def color(self, *farge):
        if not farge:
            return self._farge, self._fyllfarge
        if len(farge) == 2:
            self.pencolor(farge[0])
            self.fillcolor(farge[1])
        else:
            self.pencolor(*farge)
            self.fillcolor(*farge)

    def begin_fill(self):
        self._fyller = True
        self._fyllpunkt = [(self._x, self._y)]

    def end_fill(self):
        if self._fyller and len(self._fyllpunkt) > 2:
            _send({"k": "fyll", "punkt": self._fyllpunkt, "farge": self._fyllfarge})
        self._fyller = False
        self._fyllpunkt = []

    # -- utsjånad ------------------------------------------------------

    def speed(self, fart=None):
        if fart is None:
            return self._fart
        if isinstance(fart, str):
            fart = {"fastest": 0, "fast": 10, "normal": 6, "slow": 3, "slowest": 1}.get(fart, 6)
        self._fart = max(0, min(10, int(fart)))
        self._vis()

    def hideturtle(self):
        self._synleg = False
        self._vis()

    def showturtle(self):
        self._synleg = True
        self._vis()

    def isvisible(self):
        return self._synleg

    def position(self):
        return (self._x, self._y)

    def xcor(self):
        return self._x

    def ycor(self):
        return self._y

    def heading(self):
        return self._vinkel

    def clear(self):
        _send({"k": "tøm"})

    def reset(self):
        self.clear()
        self.__init__()

    # -- kortformer ----------------------------------------------------

    fd = forward
    bk = back = backward
    rt = right
    lt = left
    setpos = setposition = goto
    seth = setheading
    pu = up = penup
    pd = down = pendown
    width = pensize
    ht = hideturtle
    st = showturtle
    pos = position


def _farge_til_css(farge):
    """Godtek 'red', '#ff0000' og (r, g, b) med verdiar 0–255 eller 0–1."""
    if len(farge) == 1:
        f = farge[0]
        if isinstance(f, (tuple, list)):
            return _farge_til_css(tuple(f))
        return str(f)
    if len(farge) == 3:
        r, g, b = farge
        if all(isinstance(v, float) and v <= 1 for v in (r, g, b)):
            r, g, b = (int(v * 255) for v in (r, g, b))
        return "rgb(%d,%d,%d)" % (int(r), int(g), int(b))
    return "black"


# --- modulnivå: éi standard-skilpadde, slik turtle plar fungere ---------

_standard = None


def _skilpadde():
    global _standard
    if _standard is None:
        _standard = Turtle()
    return _standard


def _lag_modulfunksjon(namn):
    def f(*a, **k):
        return getattr(_skilpadde(), namn)(*a, **k)
    f.__name__ = namn
    return f


for _n in ("forward fd backward bk back right rt left lt goto setpos setposition "
           "setx sety setheading seth home circle dot write penup pu up pendown pd "
           "down pensize width pencolor fillcolor color begin_fill end_fill speed "
           "hideturtle ht showturtle st isvisible position pos xcor ycor heading "
           "clear reset").split():
    globals()[_n] = _lag_modulfunksjon(_n)


def bgcolor(farge=None):
    if farge is None:
        return "white"
    _send({"k": "bakgrunn", "farge": _farge_til_css((farge,))})


def done(*a, **k):
    """Finst berre så program som avsluttar med turtle.done() ikkje ryk."""
    tøm()


mainloop = exitonclick = done


class Screen:
    """Minimal Screen, nok til at vanlege skuleprogram går gjennom."""

    def bgcolor(self, *a):
        return bgcolor(*a)

    def title(self, *a):
        pass

    def setup(self, *a, **k):
        pass

    def tracer(self, *a, **k):
        pass

    def update(self):
        tøm()

    def exitonclick(self):
        tøm()

    def mainloop(self):
        tøm()


def getscreen():
    return Screen()
