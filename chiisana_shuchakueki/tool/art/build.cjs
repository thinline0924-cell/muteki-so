// すべての絵を assets/images/ に書き出す(開発用)。
//   NODE_PATH=$(npm root -g) node tool/art/build.cjs [名前の一部]
'use strict';
const path = require('path');
const { renderAll } = require('./render.cjs');
const fs = require('fs');
const B = require('./board.cjs');
const T = require('./trains.cjs');
const I = require('./items.cjs');
const SC = require('./scenes.cjs');
const U = require('./ui.cjs');

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'data', 'catalog.json'), 'utf8'));
const trains = catalog.items.filter((i) => i.type === 'train');

const out = path.join(__dirname, '..', '..', 'assets', 'images');
const filter = process.argv[2];

const jobs = [
  { name: 'board/wood', svg: B.wood(), w: B.S, h: B.S },
  { name: 'board/grass_a', svg: B.grass(3, 0), w: B.S, h: B.S },
  { name: 'board/grass_b', svg: B.grass(17, -0.04), w: B.S, h: B.S },
  { name: 'board/plate', svg: B.plate(), w: B.S, h: B.S },
  { name: 'board/plate_fixed', svg: B.plateFixed(), w: B.S, h: B.S },
  { name: 'board/track_straight', svg: B.track(B.STRAIGHT), w: B.S, h: B.S },
  { name: 'board/track_curve', svg: B.track(B.CURVE), w: B.S, h: B.S },
  { name: 'board/track_tee', svg: B.track(B.TEE), w: B.S, h: B.S },
  { name: 'board/track_cross', svg: B.track(B.CROSS), w: B.S, h: B.S },
  { name: 'board/station_start', svg: B.station(false), w: B.S, h: B.S },
  { name: 'board/station_goal', svg: B.station(true), w: B.S, h: B.S },
  { name: 'board/tree', svg: B.tree(3), w: B.S, h: B.S },
  { name: 'board/rock', svg: B.rock(), w: B.S, h: B.S },
  { name: 'board/pond', svg: B.pond(), w: B.S, h: B.S },
  ...[1, 2, 3, 4].map((i) => ({ name: `board/flowers_${i}`, svg: B.flowers(i * 37), w: B.S, h: B.S })),
  ...trains.flatMap((t) => [
    { name: `trains/${t.id}_loco`, svg: T.trainTop(t.colors.body, t.colors.accent, true), w: T.TOP_W, h: T.TOP_H },
    { name: `trains/${t.id}_coach`, svg: T.trainTop(t.colors.body, t.colors.accent, false), w: T.TOP_W, h: T.TOP_H },
    { name: `items/${t.id}`, svg: T.trainSide(t.colors.body, t.colors.accent), w: T.SIDE_W, h: T.SIDE_H },
  ]),
  ...Object.entries(I.items).map(([id, f]) => ({ name: `items/${id}`, svg: f(), w: I.S, h: I.S })),
  ...Object.entries(I.residents).map(([id, f]) => ({ name: `items/${id}`, svg: f(), w: I.S, h: I.S })),
  ...catalog.items
    .filter((i) => i.type === 'station')
    .map((i) => ({ name: `items/${i.id}`, svg: I.stationBuilding(i.colors.roof, i.colors.wall), w: 360, h: 240 })),
  { name: 'town/background', svg: SC.townBackground(), w: 360, h: 480, scale: 3, jpeg: true },
  { name: 'ui/title', svg: SC.titleScene(), w: 1080, h: 1920, jpeg: true },
  ...[1, 2, 3, 4, 5].map((n) => ({ name: `ui/world_${n}`, svg: SC.worldBanner(n), w: 600, h: 200, jpeg: true })),
  { name: 'ui/star', svg: U.star(true), w: 128, h: 128 },
  { name: 'ui/star_off', svg: U.star(false), w: 128, h: 128 },
  { name: 'ui/coin', svg: U.coin(), w: 128, h: 128 },
  { name: 'ui/lock', svg: U.lock(), w: 128, h: 128 },
  { name: 'ui/gift', svg: U.gift(), w: 128, h: 128 },
  { name: 'ui/hand', svg: U.hand(), w: 128, h: 128 },
  { name: 'ui/ribbon', svg: U.ribbon(), w: 640, h: 170 },
  { name: 'ui/rays', svg: U.rays(), w: 512, h: 512 },
  { name: 'ui/paper', svg: U.paper(), w: 256, h: 256 },
  { name: 'ui/navy', svg: U.navyPattern(), w: 256, h: 256 },
];

renderAll(filter ? jobs.filter((j) => j.name.includes(filter)) : jobs, { outDir: out });
