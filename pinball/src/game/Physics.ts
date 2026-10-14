// 物理演算:ボールとペグ(円)の衝突・反射、壁、重力。
// 「空間グリッド」= 盤面をマス目に区切り、近くのマスにあるペグだけを当たり判定する高速化の仕組み。

import { BOARD, GRAVITY, H, MAX_SPEED, W, type PegType } from './constants';

export interface Peg {
  id: number;
  x: number;
  y: number;
  r: number;
  type: PegType;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** 倍率バンパーの倍率 */
  mult: number;
  /** 当たった瞬間の光(1→0) */
  flash: number;
  /** 出現アニメ(0→1) */
  spawn: number;
  /** バンパーの連続発動を防ぐ待ち時間(秒) */
  cooldown: number;
  /** 連鎖(爆発・電撃)で既に狙われている */
  marked: boolean;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 壁反射レリックなどで増えるダメージ倍率 */
  dmgMul: number;
  alive: boolean;
  /** 軌跡(x,y を交互に並べた配列) */
  trail: number[];
  hue: number;
  lastPegId: number;
  lastPegT: number;
  age: number;
  /** スタック検出用 */
  stillT: number;
  anchorX: number;
  anchorY: number;
  rescues: number;
  /** セーフティネット(底で一度だけ跳ね返る)を使ったか */
  safetyUsed: boolean;
}

export interface StepHooks {
  onPeg(ball: Ball, peg: Peg, impact: number): void;
  onWall(ball: Ball, impact: number): void;
}

const CELL = 48;

export class PegGrid {
  readonly cols = Math.ceil(W / CELL) + 1;
  readonly rows = Math.ceil(H / CELL) + 1;
  cells: Peg[][] = [];

  constructor() {
    for (let i = 0; i < this.cols * this.rows; i++) this.cells.push([]);
  }

  rebuild(pegs: Peg[]): void {
    for (const c of this.cells) c.length = 0;
    for (const p of pegs) {
      if (!p.alive) continue;
      const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(p.x / CELL)));
      const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(p.y / CELL)));
      this.cells[cy * this.cols + cx].push(p);
    }
  }

  /** (x,y) の周囲 3×3 マスにあるペグを順に渡す */
  forNear(x: number, y: number, fn: (p: Peg) => boolean | void): void {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      if (gy < 0 || gy >= this.rows) continue;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (gx < 0 || gx >= this.cols) continue;
        const cell = this.cells[gy * this.cols + gx];
        for (let i = 0; i < cell.length; i++) {
          const p = cell[i];
          if (p.alive && fn(p) === true) return;
        }
      }
    }
  }
}

let ballSeq = 1;

export function makeBall(x: number, y: number, vx: number, vy: number, r: number, dmgMul = 1): Ball {
  return {
    id: ballSeq++,
    x, y, vx, vy, r,
    dmgMul,
    alive: true,
    trail: [],
    hue: Math.random() * 360,
    lastPegId: -1,
    lastPegT: 0,
    age: 0,
    stillT: 0,
    anchorX: x,
    anchorY: y,
    rescues: 0,
    safetyUsed: false,
  };
}

const BUMP_SPEED = 760;

function clampSpeed(b: Ball): void {
  const s2 = b.vx * b.vx + b.vy * b.vy;
  if (s2 > MAX_SPEED * MAX_SPEED) {
    const k = MAX_SPEED / Math.sqrt(s2);
    b.vx *= k;
    b.vy *= k;
  }
}

/** ボール1個を1ステップ進める。hooks が null なら予測線用(何も壊さない) */
export function stepBall(
  b: Ball,
  dt: number,
  grid: PegGrid,
  hooks: StepHooks | null,
  gravityMul = 1,
): boolean {
  b.vy += GRAVITY * gravityMul * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  let hit = false;

  // 左右と天井の壁
  if (b.x < BOARD.left + b.r) {
    b.x = BOARD.left + b.r;
    const imp = Math.abs(b.vx);
    b.vx = imp * 0.86;
    if (hooks && imp > 60) hooks.onWall(b, imp);
  } else if (b.x > BOARD.right - b.r) {
    b.x = BOARD.right - b.r;
    const imp = Math.abs(b.vx);
    b.vx = -imp * 0.86;
    if (hooks && imp > 60) hooks.onWall(b, imp);
  }
  if (b.y < BOARD.top + b.r) {
    b.y = BOARD.top + b.r;
    const imp = Math.abs(b.vy);
    b.vy = imp * 0.8;
    if (hooks && imp > 60) hooks.onWall(b, imp);
  }

  // ペグ
  grid.forNear(b.x, b.y, (p) => {
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const rr = b.r + p.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 0.0001;
    const nx = dx / d;
    const ny = dy / d;
    b.x = p.x + nx * (rr + 0.01);
    b.y = p.y + ny * (rr + 0.01);
    const vn = b.vx * nx + b.vy * ny;
    const impact = Math.max(0, -vn);
    if (vn < 0) {
      const e = p.type === 'multi' ? 0.9 : 0.72;
      b.vx -= (1 + e) * vn * nx;
      b.vy -= (1 + e) * vn * ny;
    }
    if (p.type === 'multi') {
      const out = b.vx * nx + b.vy * ny;
      if (out < BUMP_SPEED) {
        b.vx += (BUMP_SPEED - out) * nx;
        b.vy += (BUMP_SPEED - out) * ny;
      }
    }
    // 真上に積もって止まらないよう、ほんの少し横に揺らす
    if (hooks) b.vx += (Math.random() - 0.5) * 14;
    else b.vx += (nx >= 0 ? 1 : -1) * 2;
    hit = true;
    if (hooks) hooks.onPeg(b, p, impact);
    return true;
  });

  clampSpeed(b);
  return hit;
}

/** 反射予測線:最初にペグに当たってから少し先までの点列を返す */
export function predictPath(
  x: number,
  y: number,
  vx: number,
  vy: number,
  r: number,
  grid: PegGrid,
  maxSteps = 420,
): { pts: number[]; hitIndex: number } {
  const b = makeBall(x, y, vx, vy, r);
  const pts: number[] = [x, y];
  let hitIndex = -1;
  let after = 0;
  for (let i = 0; i < maxSteps; i++) {
    const hit = stepBall(b, 1 / 200, grid, null);
    if (i % 4 === 0) pts.push(b.x, b.y);
    if (hit && hitIndex < 0) {
      hitIndex = pts.length;
      pts.push(b.x, b.y);
    }
    if (hitIndex >= 0 && ++after > 70) break;
    if (b.y > BOARD.bottom) break;
  }
  return { pts, hitIndex };
}
