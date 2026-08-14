/* Ormritaren — bibliotekkatalogen.
 *
 * Alle hjula ligg sjølv-hosta i _libs/pyodide/. Vi kallar aldri PyPI, og
 * eleven kan ikkje skrive inn eit vilkårleg pakkenamn. Det er eit medvite
 * val: det held nettverket ute av klasserommet, gjer at appen verkar utan
 * internett etter fyrste opning, og hindrar at ein elev dreg inn ein
 * tilfeldig pakke frå nettet i ein skulenettlesar.
 *
 * Skal eit nytt bibliotek inn, må hjulet leggjast i _libs/pyodide/ og førast
 * opp her — altså gjennom ein pull request. Det er ei terskel med vilje.
 */
const OrmPakkar = (function () {

    /* `id` må vere same namnet som i pyodide-lock.json. */
    const KATALOG = [
        {
            id: 'numpy',
            namn: 'numpy',
            storleik: '2,9 MB',
            skildring: 'Tal, tabellar og matriser. Reknar på mange tal om gongen — nyttig til statistikk og simulering.',
            doeme: 'import numpy as np\nprint(np.mean([2, 4, 6, 8]))'
        },
        {
            id: 'matplotlib',
            namn: 'matplotlib',
            storleik: '13 MB med alt han treng',
            skildring: 'Teiknar grafar og diagram. Figuren dukkar opp i grafikkruta når du kallar plt.show().',
            doeme: 'import matplotlib.pyplot as plt\nplt.plot([1, 4, 9, 16])\nplt.show()'
        }
    ];

    /* turtle er ikkje eit hjul — han ligg i sjølve appen — men eleven skal
     * finne han same staden som resten. */
    const INNEBYGD = [
        {
            id: 'turtle',
            namn: 'turtle',
            storleik: 'alltid klar',
            skildring: 'Skilpaddegrafikk. Teiknar strek for strek i grafikkruta, så du ser koden arbeide.',
            doeme: 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.left(90)'
        }
    ];

    let lasta = new Set();
    let container, onSettInn;

    function init(el, settInnDoeme) {
        container = el;
        onSettInn = settInnDoeme;
        teikn();
    }

    function settLasta(liste) {
        lasta = new Set(liste || []);
        teikn();
    }

    function teikn() {
        if (!container) return;
        container.textContent = '';
        [...INNEBYGD, ...KATALOG].forEach(p => container.appendChild(kort(p)));
    }

    function kort(p) {
        const innebygd = INNEBYGD.includes(p);
        const erLasta = innebygd || lasta.has(p.id);

        const boks = document.createElement('div');
        boks.className = 'orm-bibkort' + (erLasta ? ' klar' : '');

        const topp = document.createElement('div');
        topp.className = 'orm-bibtopp';

        const namn = document.createElement('code');
        namn.className = 'orm-bibnamn';
        namn.textContent = p.namn;
        topp.appendChild(namn);

        const merke = document.createElement('span');
        merke.className = 'orm-bibmerke';
        merke.textContent = erLasta ? 'klar' : p.storleik;
        topp.appendChild(merke);
        boks.appendChild(topp);

        const tekst = document.createElement('p');
        tekst.className = 'orm-bibtekst';
        tekst.textContent = p.skildring;
        boks.appendChild(tekst);

        const knapp = document.createElement('button');
        knapp.type = 'button';
        knapp.className = 'btn orm-btn-liten';
        knapp.textContent = 'Sett inn døme';
        knapp.addEventListener('click', () => onSettInn?.(p.doeme));
        boks.appendChild(knapp);

        return boks;
    }

    return { init, settLasta, KATALOG };
})();
