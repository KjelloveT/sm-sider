/* ══════════════════════════════════════════════
   BLOKKER.JS — Heile biblioteket av byggjeklossar

   Alt Kenney-pakkane har av byggjemateriale, med namn på nynorsk.

   DEI FLESTE GJER INGENTING. Det er med vilje. Dei er pynt: dei blir
   teikna, dei kolliderer ikkje, og eleven kan gå rett gjennom dei. Dei
   ligg her for at læraren skal kunne peike på ein kloss og seie kva han
   ØNSKJER at han skal gjere — «stigen bør kunne klatrast», «bandet bør
   flytte figuren» — i staden for å skildre eit bilete med ord.

   Ein kloss som får ein funksjon flyttar frå pyntelaget til rutenettet
   og får sitt eige teikn i banefila. Sjå bane.js.

   NAMNA ER GRENSESNITTET. Læraren ser namnet, eg ser sprite-nøkkelen,
   og begge står i menyen, så vi snakkar om same kloss.

   Våpen og farar er ikkje med — korkje her eller i atlaset. Sjå
   VRAK-lista i bygg_ljodstigen_atlas.py. Bokstavjakta er eit spel utan
   piggar, sagblad og sverd, og det skal ein ikkje kunne teikne seg bort
   frå heller.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const GRUPPER = [
    {
      id: 'funksjon', namn: 'Med funksjon',
      hint: 'Desse fem gjer noko i spelet. Resten er berre teikna.',
      blokker: [
        { s: 'tile_bridge', n: 'Plattform', f: '=' },
        { s: 'tile_block', n: 'Bokstavsokkel', f: 'P' },
        { s: 'tile_coin', n: 'Mynt', f: 'c' },
        { s: 'tile_door', n: 'Dør', f: 'D' },
        { s: 'background_tree', n: 'Tre', f: 'T' }
      ]
    },
    {
      id: 'grunn', namn: 'Grunn og fliser',
      blokker: [
        { s: 'tile_grass', n: 'Gras' },
        { s: 'tile', n: 'Jord' },
        { s: 'tile_stone', n: 'Stein' },
        { s: 'tile_sand', n: 'Sand' },
        { s: 'tile_brick', n: 'Murstein' },
        { s: 'tile_castle', n: 'Borgmur' },
        { s: 'tile_water', n: 'Vatn' },
        { s: 'tile_top', n: 'Kant øvst' },
        { s: 'tile_border', n: 'Ramme' },
        { s: 'tile_diagonal', n: 'Skrå strek' },
        { s: 'tile_slope', n: 'Skråning' },
        { s: 'tile_roof', n: 'Takflis' },
        { s: 'tile_column', n: 'Søyleflis' },
        { s: 'triangle', n: 'Trekant' },
        { s: 'carpet', n: 'Teppe' }
      ]
    },
    {
      id: 'klossar', namn: 'Klossar og plankar',
      blokker: [
        { s: 'block', n: 'Kloss' },
        { s: 'block_glass', n: 'Glaskloss' },
        { s: 'block_metal', n: 'Metallkloss' },
        { s: 'tile_crate', n: 'Kasse' },
        { s: 'tile_crateSmall', n: 'Lita kasse' },
        { s: 'tile_crateDiagonal', n: 'Kasse på skrå' },
        { s: 'tile_item', n: 'Kloss med utropsteikn' },
        { s: 'tile_blockDoor', n: 'Kloss med dør' },
        { s: 'tile_blockWindow', n: 'Kloss med vindauge' },
        { s: 'plank', n: 'Skilt i tre' },
        { s: 'plank_metal', n: 'Skilt i metall' },
        { s: 'bridge_walkway', n: 'Bjelke' },
        { s: 'bridge_arch', n: 'Bruboge' },
        { s: 'bridge_arch_bottom', n: 'Bruboge, fot' },
        { s: 'bridge_arch_large', n: 'Bruboge, stor' },
        { s: 'bridge_column', n: 'Brusøyle' },
        { s: 'tile_belt', n: 'Transportband' },
        { s: 'tile_ladder', n: 'Stige' },
        { s: 'tile_grab', n: 'Handtak' },
        { s: 'tile_cog', n: 'Tannhjul' }
      ]
    },
    {
      id: 'bygg', namn: 'Bygningar',
      blokker: [
        { s: 'castle', n: 'Borg' },
        { s: 'castle_top', n: 'Borgtinde' },
        { s: 'archway_small', n: 'Portboge' },
        { s: 'archway_small_decorative', n: 'Portboge med pynt' },
        { s: 'tile_arch', n: 'Boge' },
        { s: 'tile_archHalf', n: 'Halv boge' },
        { s: 'tile_archColumn', n: 'Boge med søyle' },
        { s: 'tile_archColumns', n: 'Boge med to søyler' },
        { s: 'column', n: 'Søyle' },
        { s: 'column_bottom', n: 'Søylefot' },
        { s: 'column_middle', n: 'Søyle, midtstykke' },
        { s: 'column_top', n: 'Søyletopp' },
        { s: 'column_wide', n: 'Brei søyle' },
        { s: 'obelisk', n: 'Obelisk' },
        { s: 'doorway_open', n: 'Døropning' },
        { s: 'doorway_closed', n: 'Stengd port' },
        { s: 'window', n: 'Vindauge' },
        { s: 'window_round', n: 'Rundt vindauge' },
        { s: 'window_decorative', n: 'Vindauge med mønster' },
        { s: 'drapes', n: 'Gardin' },
        { s: 'drapes_poles', n: 'Gardin med stong' },
        { s: 'lock', n: 'Hengelås' },
        { s: 'fence', n: 'Rekkverk' },
        { s: 'tile_fence', n: 'Gjerde' },
        { s: 'tile_fenceHigh', n: 'Høgt gjerde' }
      ]
    },
    {
      id: 'tak', namn: 'Tak og tårn',
      blokker: [
        { s: 'roof', n: 'Tak' },
        { s: 'roof_roundA', n: 'Spisstak' },
        { s: 'roof_roundB', n: 'Spir' },
        { s: 'roof_roundC', n: 'Kuppel med vindauge' },
        { s: 'roof_roundD', n: 'Løkkuppel' },
        { s: 'roof_roundE', n: 'Løkkuppel, liten' },
        { s: 'roof_round_half', n: 'Halvt rundtak' },
        { s: 'tower', n: 'Tårn' },
        { s: 'tower_base', n: 'Tårnfot' },
        { s: 'tower_top', n: 'Tårntopp' },
        { s: 'tower_overhang', n: 'Tårn med altan' },
        { s: 'tower_roof_bottom', n: 'Tårntak, nedre' },
        { s: 'tower_roof_top', n: 'Tårntak, spiss' },
        { s: 'tower_window', n: 'Tårnvindauge' }
      ]
    },
    {
      id: 'natur', namn: 'Natur',
      blokker: [
        { s: 'background_treeLarge', n: 'Stort tre' },
        { s: 'tile_tree', n: 'Grantre' },
        { s: 'tile_treeTop', n: 'Trekrone' },
        { s: 'tile_treeTrunk', n: 'Trestamme' },
        { s: 'tile_bush', n: 'Busk' },
        { s: 'tile_bushHalf', n: 'Låg busk' },
        { s: 'cactus', n: 'Kaktus' },
        { s: 'background_cloudA', n: 'Sky' },
        { s: 'background_cloudB', n: 'Sky, brei' },
        { s: 'smoke', n: 'Røyk' },
        { s: 'star', n: 'Stjerne' },
        { s: 'pole', n: 'Utliggjar' },
        { s: 'pole_lantern', n: 'Lykt' }
      ]
    },
    {
      id: 'ting', namn: 'Ting',
      blokker: [
        { s: 'bag', n: 'Sekk' },
        { s: 'pottery', n: 'Krukke' },
        { s: 'pottery_tall', n: 'Høg krukke' },
        { s: 'tile_chest', n: 'Kiste' },
        { s: 'tile_gem', n: 'Edelstein' },
        { s: 'tile_heart', n: 'Hjarte' },
        { s: 'tile_key', n: 'Nøkkel' },
        { s: 'tile_flag', n: 'Vimpel' },
        { s: 'item_pencil', n: 'Blyant' },
        { s: 'item_rod', n: 'Stong' },
        { s: 'item_hat', n: 'Hatt' },
        { s: 'item_hatTop', n: 'Flosshatt' },
        { s: 'effect_trail', n: 'Fartsstripe' }
      ]
    },
    {
      id: 'skilt', namn: 'Skilt og piler',
      blokker: [
        { s: 'tile_arrowUp', n: 'Pil opp' },
        { s: 'tile_arrowDown', n: 'Pil ned' },
        { s: 'tile_arrowLeft', n: 'Pil mot venstre' },
        { s: 'tile_arrowRight', n: 'Pil mot høgre' },
        { s: 'ui_balloon', n: 'Snakkeboble' },
        { s: 'ui_box', n: 'Boks' },
        { s: 'ui_button', n: 'Knapp' },
        { s: 'ui_circle', n: 'Sirkel' },
        { s: 'ui_hand', n: 'Peikefinger' },
        { s: 'ui_select', n: 'Markering' }
      ]
    },
    {
      id: 'tal', namn: 'Tal og teikn',
      blokker: [
        { s: 'ui_num0', n: 'Talet 0' },
        { s: 'ui_num1', n: 'Talet 1' },
        { s: 'ui_num2', n: 'Talet 2' },
        { s: 'ui_num3', n: 'Talet 3' },
        { s: 'ui_num4', n: 'Talet 4' },
        { s: 'ui_num5', n: 'Talet 5' },
        { s: 'ui_num6', n: 'Talet 6' },
        { s: 'ui_num7', n: 'Talet 7' },
        { s: 'ui_num8', n: 'Talet 8' },
        { s: 'ui_num9', n: 'Talet 9' },
        { s: 'ui_numPeriod', n: 'Punktum' },
        { s: 'ui_numPercent', n: 'Prosent' },
        { s: 'ui_numX', n: 'Gongeteikn' },
        { s: 'ui_numXlarge', n: 'Kryss' }
      ]
    },
    {
      id: 'figurar', namn: 'Figurar',
      hint: 'Reine bilete. Ingen av dei kan snakkast med enno.',
      blokker: [
        { s: 'character_roundGreen', n: 'Oval figur, grøn' },
        { s: 'character_roundPurple', n: 'Oval figur, lilla' },
        { s: 'character_roundRed', n: 'Oval figur, raud' },
        { s: 'character_roundYellow', n: 'Oval figur, gul' },
        { s: 'character_round_green', n: 'Rund figur, grøn' },
        { s: 'character_round_purple', n: 'Rund figur, lilla' },
        { s: 'character_round_red', n: 'Rund figur, raud' },
        { s: 'character_round_yellow', n: 'Rund figur, gul' },
        { s: 'character_squareGreen', n: 'Kantete figur, grøn' },
        { s: 'character_squarePurple', n: 'Kantete figur, lilla' },
        { s: 'character_squareRed', n: 'Kantete figur, raud' },
        { s: 'character_squareYellow', n: 'Kantete figur, gul' },
        { s: 'character_rectangle_green', n: 'Avrunda figur, grøn' },
        { s: 'character_rectangle_purple', n: 'Avrunda figur, lilla' },
        { s: 'character_rectangle_red', n: 'Avrunda figur, raud' },
        { s: 'character_rectangle_yellow', n: 'Avrunda figur, gul' }
      ]
    }
  ];

  const ETTER_SPRITE = {};
  GRUPPER.forEach(function (g) {
    g.blokker.forEach(function (b) {
      b.gruppe = g.id;
      ETTER_SPRITE[b.s] = b;
    });
  });

  function hent(sprite) { return ETTER_SPRITE[sprite] || null; }

  function namnFor(sprite) {
    const b = ETTER_SPRITE[sprite];
    return b ? b.n : sprite;
  }

  /** Har klossen ei rolle i spelet, eller er han berre teikna? */
  function erFunksjon(sprite) {
    const b = ETTER_SPRITE[sprite];
    return !!(b && b.f);
  }

  function alle() {
    return Object.keys(ETTER_SPRITE).map(function (s) { return ETTER_SPRITE[s]; });
  }

  root.JaktaBlokker = {
    GRUPPER: GRUPPER,
    hent: hent, namnFor: namnFor, erFunksjon: erFunksjon, alle: alle
  };
})(window);
