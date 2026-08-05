/* ══════════════════════════════════════
   GENERATOR.JS — Trekke-algoritme
   Fisher-Yates shuffle + aldri/kanskje-constraints
   ══════════════════════════════════════ */

const Generator = (() => {
    const ATTEMPTS = 300;

    /* Reknar ut gruppestorleikar (jamne, maks ±1) */
    function calcGroupSizes(total, mode, value) {
        let numGroups;
        if (mode === 'size') {
            numGroups = Math.max(1, Math.ceil(total / Math.max(1, parseInt(value))));
        } else {
            numGroups = Math.max(1, parseInt(value));
        }
        const baseSize = Math.floor(total / numGroups);
        const sizes = Array(numGroups).fill(baseSize);
        const remainder = total - baseSize * numGroups;
        for (let i = 0; i < remainder; i++) sizes[i]++;
        return sizes;
    }

    /* Forklaring av storleik for brukar, t.d. "8 grupper med 3–4 elevar" */
    function sizeLabel(total, mode, value, excluded) {
        const active = total - excluded;
        const sizes = calcGroupSizes(active, mode, value);
        const min = Math.min(...sizes);
        const max = Math.max(...sizes);
        const n = sizes.length;
        const sizeStr = min === max ? `${min}` : `${min}–${max}`;
        return `${n} ${n === 1 ? 'gruppe' : 'grupper'} med ${sizeStr} ${sizeStr === '1' ? 'elev' : 'elevar'}`;
    }

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function score(groups, relations) {
        let s = 0;
        for (const g of groups) {
            for (let i = 0; i < g.length; i++) {
                for (let j = i + 1; j < g.length; j++) {
                    const key = [g[i].id, g[j].id].sort().join('|');
                    const rel = relations[key] || 'ja';
                    if (rel === 'never') return Infinity;
                    if (rel === 'maybe') s += 1;
                }
            }
        }
        return s;
    }

    function partition(students, sizes) {
        const shuffled = shuffle(students);
        const groups = [];
        let idx = 0;
        for (const sz of sizes) {
            groups.push(shuffled.slice(idx, idx + sz));
            idx += sz;
        }
        return groups;
    }

    /*
     * Hovud-funksjon
     * students: [{id, name}]
     * relations: { "idA|idB": "never"|"maybe" }
     * mode: "size"|"groups"
     * value: tal
     * nameCategory: strengt
     * lockedGroups: [{ name, color, icon, members }] (gruppene som er låste)
     *
     * Returnerer { groups, warning }
     * groups: [{ name, color, icon, members: [{id,name}] }]
     */
    function generate(students, relations, mode, value, nameCategory, lockedGroups) {
        lockedGroups = lockedGroups || [];
        const lockedIds = new Set(lockedGroups.flatMap(g => g.members.map(m => m.id)));
        const free = students.filter(s => !lockedIds.has(s.id));

        const sizes = calcGroupSizes(free.length, mode, value);

        let best = null;
        let bestScore = Infinity;
        let allInfeasible = true;

        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
            const groups = partition(free, sizes);
            const s = score(groups, relations);
            if (s < Infinity) allInfeasible = false;
            if (s < bestScore) {
                bestScore = s;
                best = groups;
            }
            if (bestScore === 0) break;
        }

        if (!best) best = partition(free, sizes);

        const COLORS = [
            '#FFD6E0','#FFE5B4','#D4F1C0','#C7E9FB','#E0D4FB',
            '#FFF3CC','#C8F7F3','#FFDAB9','#D6EAF8','#F0E6FF',
            '#D5F5E3','#FDEBD0'
        ];

        const usedColors = new Set(lockedGroups.map(g => g.color));
        const availableColors = COLORS.filter(c => !usedColors.has(c));
        let colorIdx = 0;

        const names = Names.pickNames(nameCategory, best.length);
        /* Unike ikon — og aldri same ikon som ei låst gruppe alt har */
        const icons = Icons.pickGroupIcons(best.length, lockedGroups.map(g => g.icon));

        const newGroups = best.map((members, i) => {
            let color;
            if (availableColors.length > 0) {
                color = availableColors[colorIdx % availableColors.length];
                colorIdx++;
            } else {
                color = COLORS[i % COLORS.length];
            }
            return {
                name: names[i],
                color,
                icon: icons[i],
                members
            };
        });

        return {
            groups: [...lockedGroups, ...newGroups],
            warning: allInfeasible && free.length > 0
                ? 'Klarte ikkje å halde alle «aldri»-grensene. Prøv større grupper.'
                : null
        };
    }

    return { generate, calcGroupSizes, sizeLabel };
})();
