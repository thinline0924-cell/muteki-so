// 盤面(ペグの配置)を作る。ライン突破後・盤面リフレッシュごとに呼ばれる。

import { BUMPER_R, PEG_R, type PegType } from './constants';
import type { Peg } from './Physics';
import { boardRand } from './rng';

export interface BoardSpec {
  /** 難しさ(越えたライン数+1)。耐久ペグの割合に効く */
  wave: number;
  extraSplit: number;
  extraBomb: number;
  extraLightning: number;
  extraBumpers: number;
  bumperBonus: number;
}

const AREA = { left: 58, right: 482, top: 336, bottom: 862 };

let pegSeq = 1;

/** 倍率バンパーが 1 ショットで掛け算できる回数(強化で増える) */
export const BUMPER_CHARGES = 3;

export function makePeg(x: number, y: number, type: PegType = 'normal', hp = 1): Peg {
  return {
    id: pegSeq++,
    x, y,
    r: type === 'multi' ? BUMPER_R : PEG_R,
    type,
    hp,
    maxHp: hp,
    alive: true,
    mult: 1.5,
    flash: 0,
    spawn: 0,
    cooldown: 0,
    marked: false,
    charges: BUMPER_CHARGES,
    regrow: 0,
  };
}

const inArea = (x: number, y: number) =>
  x >= AREA.left && x <= AREA.right && y >= AREA.top && y <= AREA.bottom;

type Pattern = () => Array<[number, number]>;

const patterns: Pattern[] = [
  // 互い違いの格子
  () => {
    const pts: Array<[number, number]> = [];
    let row = 0;
    for (let y = AREA.top + 4; y <= AREA.bottom; y += 46, row++) {
      const off = row % 2 ? 27 : 0;
      for (let x = AREA.left + off; x <= AREA.right; x += 54) pts.push([x, y]);
    }
    return pts;
  },
  // 同心円
  () => {
    const pts: Array<[number, number]> = [];
    const cx = 270;
    const cy = 600;
    for (const r of [0, 64, 124, 184, 244, 300]) {
      if (r === 0) {
        pts.push([cx, cy]);
        continue;
      }
      const n = Math.round((Math.PI * 2 * r) / 50);
      const a0 = boardRand() * Math.PI;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.95]);
      }
    }
    return pts;
  },
  // V 字(シェブロン)
  () => {
    const pts: Array<[number, number]> = [];
    let row = 0;
    for (let y = AREA.top + 10; y <= AREA.bottom - 20; y += 50, row++) {
      const dir = row % 2 ? 1 : -1;
      for (let x = AREA.left + (row % 2 ? 0 : 26); x <= AREA.right; x += 52) {
        pts.push([x, y + dir * Math.abs(x - 270) * 0.16]);
      }
    }
    return pts;
  },
  // 波
  () => {
    const pts: Array<[number, number]> = [];
    let row = 0;
    const ph = boardRand() * 6;
    for (let y = AREA.top + 6; y <= AREA.bottom - 10; y += 48, row++) {
      for (let x = AREA.left + (row % 2 ? 26 : 0); x <= AREA.right; x += 52) {
        pts.push([x, y + Math.sin(x / 55 + row * 0.9 + ph) * 13]);
      }
    }
    return pts;
  },
  // ばらまき(最低距離を守るランダム配置)
  () => {
    const pts: Array<[number, number]> = [];
    for (let tries = 0; tries < 2600 && pts.length < 105; tries++) {
      const x = AREA.left + boardRand() * (AREA.right - AREA.left);
      const y = AREA.top + boardRand() * (AREA.bottom - AREA.top);
      if (pts.every(([px, py]) => (px - x) ** 2 + (py - y) ** 2 > 46 * 46)) pts.push([x, y]);
    }
    return pts;
  },
  // ひし形のかたまり
  () => {
    const pts: Array<[number, number]> = [];
    const centers: Array<[number, number]> = [
      [150, 420], [390, 420], [270, 560], [150, 700], [390, 700], [270, 820],
    ];
    for (const [cx, cy] of centers) {
      for (let dy = -2; dy <= 2; dy++) {
        const n = 3 - Math.abs(dy);
        for (let i = -n + 1; i <= n - 1; i += 1) {
          if ((i + dy) % 2 !== 0) continue;
          pts.push([cx + i * 26, cy + dy * 26]);
        }
      }
    }
    // すき間を埋める外周
    for (let y = AREA.top + 30; y <= AREA.bottom; y += 92) {
      pts.push([AREA.left, y], [AREA.right, y + 46]);
    }
    return pts;
  },
];

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(boardRand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateBoard(spec: BoardSpec): Peg[] {
  const pattern = patterns[(spec.wave - 1 + Math.floor(boardRand() * 2)) % patterns.length];
  const raw = pattern().filter(([x, y]) => inArea(x, y));
  // 少し間引いて隙間を作る
  const kept = raw.filter(() => boardRand() > 0.08);

  // 先のラインほど、何度も当てないと壊れないペグが増える(盤面がすぐ空にならないように)
  const L = spec.wave;
  const p5 = Math.min(0.12, Math.max(0, (L - 12) * 0.012));
  const p4 = Math.min(0.18, Math.max(0, (L - 7) * 0.015));
  const p3 = Math.min(0.25, Math.max(0, (L - 3) * 0.02));
  const p2 = Math.min(0.4, 0.08 + L * 0.02);
  let pegs = kept.map(([x, y]) => {
    let r = boardRand();
    let hp = 1;
    for (const [pp, h] of [[p5, 5], [p4, 4], [p3, 3], [p2, 2]] as Array<[number, number]>) {
      if (r < pp) {
        hp = h;
        break;
      }
      r -= pp;
    }
    return makePeg(x, y, 'normal', hp);
  });

  // 倍率バンパー:内側に置き、周りのペグをどける
  const bumperCount = Math.min(6, 2 + spec.extraBumpers);
  const bumpers: Peg[] = [];
  const candidates = shuffle(pegs.filter((p) => p.x > 120 && p.x < 420 && p.y > 420 && p.y < 810));
  for (const c of candidates) {
    if (bumpers.length >= bumperCount) break;
    if (bumpers.some((b) => (b.x - c.x) ** 2 + (b.y - c.y) ** 2 < 125 * 125)) continue;
    const b = makePeg(c.x, c.y, 'multi', 1);
    b.mult = (boardRand() < 0.3 ? 2.0 : 1.5) + spec.bumperBonus;
    bumpers.push(b);
  }
  pegs = pegs.filter((p) => bumpers.every((b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 > 50 * 50));

  // 特殊ペグ
  const normals = shuffle(pegs.slice());
  const want: Array<[PegType, number]> = [
    ['split', 2 + spec.extraSplit],
    ['bomb', 2 + spec.extraBomb],
    ['lightning', 2 + spec.extraLightning],
  ];
  const maxSpecial = Math.floor(pegs.length * 0.55);
  let used = 0;
  let idx = 0;
  // 種類ごとに 1 個ずつ順番に割り当てて、偏らないようにする
  for (let round = 0; round < 40 && used < maxSpecial; round++) {
    let any = false;
    for (const w of want) {
      if (w[1] <= 0 || idx >= normals.length || used >= maxSpecial) continue;
      const p = normals[idx++];
      p.type = w[0];
      p.hp = p.maxHp = 1;
      w[1]--;
      used++;
      any = true;
    }
    if (!any) break;
  }

  const all = pegs.concat(bumpers);
  for (const p of all) p.spawn = -((p.y - AREA.top) / (AREA.bottom - AREA.top)) * 0.5 - boardRand() * 0.1;
  return all;
}
