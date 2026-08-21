/* Bolkestokk — skilpadda.
 *
 * Rein tilstand og rein geometri: ingen DOM, ingen canvas. Skilpadda samlar
 * opp ei liste med strek, og `lerret.js` teiknar henne. Same skiljet som
 * tidvis/js/sheet.js har mot print.js — og det er det som gjer at
 * rettemotoren kan køyre ei teikning utan at det finst ei side å teikne på.
 *
 * Retning: 0 grader peikar OPP, og «snu høgre» aukar vinkelen. Det er slik
 * Scratch gjer det, og det er den einaste varianten ein sjetteklassing
 * gjettar rett på fyrste forsøk. (Python sin turtle startar mot høgre — det
 * er ein av tinga python.js må omsetje, ikkje noko vi arvar.)
 *
 * Koordinatar er matematiske: x mot høgre, y OPPOVER, (0,0) i midten.
 * Lerretet snur y sjølv.
 */
function BolkSkilpadde() {

    const strek = [];
    let x = 0, y = 0, vinkel = 0;
    let nede = true, farge = 'vanleg', tjukn = 3;

    const rad = (g) => g * Math.PI / 180;

    function gaa(lengd) {
        const d = Number(lengd) || 0;
        const nx = x + d * Math.sin(rad(vinkel));
        const ny = y + d * Math.cos(rad(vinkel));
        if (nede && d !== 0) strek.push({ x1: x, y1: y, x2: nx, y2: ny, farge, tjukn });
        x = nx; y = ny;
    }

    function snu(grader) {
        vinkel = (vinkel + (Number(grader) || 0)) % 360;
        if (vinkel < 0) vinkel += 360;
    }

    function tilStart() { x = 0; y = 0; vinkel = 0; }

    /* Tjukn under 1 ville gjeve ein strek som forsvinn heilt på nokre
     * skjermar, og over 40 dekkjer han figuren sin eigen. */
    function setTjukn(t) { tjukn = Math.min(40, Math.max(1, Number(t) || 1)); }

    function setFarge(f) { farge = f || 'vanleg'; }
    function penn(pa) { nede = !!pa; }

    /** Ytterkantane av teikninga. null når ingenting er teikna. */
    function omfang() {
        if (!strek.length) return null;
        let vx1 = Infinity, vy1 = Infinity, vx2 = -Infinity, vy2 = -Infinity;
        strek.forEach(s => {
            vx1 = Math.min(vx1, s.x1, s.x2); vx2 = Math.max(vx2, s.x1, s.x2);
            vy1 = Math.min(vy1, s.y1, s.y2); vy2 = Math.max(vy2, s.y1, s.y2);
        });
        return { x1: vx1, y1: vy1, x2: vx2, y2: vy2 };
    }

    return {
        gaa, snu, tilStart, setTjukn, setFarge, penn, omfang,
        get strek() { return strek; },
        get tilstand() { return { x, y, vinkel, nede, farge, tjukn }; }
    };
}

/* Samanlikning av to teikningar — grunnlaget for testtypen «teikning».
 *
 * Vi samanliknar strek for strek i den rekkjefølgja dei vart teikna, ikkje
 * som mengder. To figurar som ser like ut men er teikna i ulik rekkjefølgje
 * er *ikkje* same program, og eleven har som regel gjort noko anna enn
 * oppgåva ba om når det skjer.
 *
 * Slingringa er nødvendig: 360/7 gjev ein vinkel som ikkje går opp, og då
 * skil elevens sjukant og fasiten sin seg med brøkdelar av ein piksel etter
 * sju sider. Farge og tjukn blir ikkje samanlikna — dei er pynt, og ei
 * oppgåve som krev ein bestemt farge seier det med ein `brukar`-test.
 */
BolkSkilpadde.likeStrek = function (a, b, slingring) {
    const s = slingring === undefined ? 1.5 : slingring;
    if (a.length !== b.length) return false;
    return a.every((p, i) => {
        const q = b[i];
        return Math.abs(p.x1 - q.x1) <= s && Math.abs(p.y1 - q.y1) <= s
            && Math.abs(p.x2 - q.x2) <= s && Math.abs(p.y2 - q.y2) <= s;
    });
};
