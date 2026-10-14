// ローグライトの強化カード。RunStats は「このラン(1 回の挑戦)の間だけ有効な能力値」。

import type { ModeDef } from './Modes';
import { cardRand } from './rng';

export interface RunStats {
  ballsPerShot: number;
  baseDamage: number;
  damageMul: number;
  /** 分裂ペグで何個に増えるか(元のボールを含む) */
  splitCount: number;
  bombRadius: number;
  lightningMin: number;
  lightningMax: number;
  /** 壁反射 1 回ごとのスコア上昇 */
  wallBonus: number;
  /** コンボ 1 つごとのスコア上昇 */
  comboBonus: number;
  critChance: number;
  critMul: number;
  bumperBonus: number;
  ballRadiusMul: number;
  extraSplit: number;
  extraBomb: number;
  extraLightning: number;
  extraBumpers: number;
  /** 1 回の挑戦で撃てるショット数(はじめの数) */
  startShots: number;
  safetyNets: number;
  chainBomb: number;
  coinMul: number;
  /** 終盤(ラスト 3 ショット/ラスト 20 秒)のスコア倍率 */
  lateBoost: number;
  /** 倍率バンパーの 1 ショットあたりの回数の追加 */
  bumperCharges: number;
  /** 壊れた通常ペグが灯り直すまでの秒数 */
  regrowTime: number;
}

/** 永続強化の上限(これを超えて育てていた分は、Save が読み込み時にコインで返す) */
export const META_CAP = { atk: 10, balls: 2, hp: 5, coin: 10 } as const;

export function baseStats(meta: { atk: number; balls: number; hp: number; coin: number }, mode: ModeDef): RunStats {
  const m = mode.useMeta
    ? {
        atk: Math.min(meta.atk, META_CAP.atk),
        balls: Math.min(meta.balls, META_CAP.balls),
        hp: Math.min(meta.hp, META_CAP.hp),
        coin: Math.min(meta.coin, META_CAP.coin),
      }
    : { atk: 0, balls: 0, hp: 0, coin: 0 };
  return {
    ballsPerShot: 1 + m.balls + mode.extraBalls,
    baseDamage: 10 * (1 + m.atk * 0.25),
    damageMul: 1,
    splitCount: 2,
    bombRadius: 92,
    lightningMin: 3,
    lightningMax: 5,
    wallBonus: 0,
    comboBonus: 0.02,
    critChance: 0.05,
    critMul: 3,
    bumperBonus: 0,
    ballRadiusMul: 1,
    extraSplit: 0,
    extraBomb: 0,
    extraLightning: 0,
    extraBumpers: 0,
    // 「夜の長さ UP」は一晩モードだけに効く
    startShots: (mode.shots ?? 0) + (mode.id === 'night' ? m.hp : 0),
    safetyNets: 0,
    chainBomb: 0,
    coinMul: 1 + m.coin * 0.25,
    lateBoost: 1,
    bumperCharges: 0,
    regrowTime: 3.2,
  };
}

export type Rarity = 'common' | 'rare' | 'epic';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  rarity: Rarity;
  max?: number;
  /** stats を書き換える。shots は残りショットを増減したいときに返す量 */
  apply(s: RunStats): { shots?: number } | void;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'split_add', name: '分裂ペグ増設', desc: '盤面に分裂ペグを 3 個追加', icon: '✚', color: '#44f2ff', rarity: 'common',
    apply: (s) => { s.extraSplit += 3; },
  },
  {
    id: 'bomb_add', name: '爆薬庫', desc: '盤面に爆発ペグを 2 個追加', icon: '✸', color: '#ff3b4e', rarity: 'common',
    apply: (s) => { s.extraBomb += 2; },
  },
  {
    id: 'zap_add', name: '避雷針', desc: '盤面に電撃ペグを 2 個追加', icon: 'ϟ', color: '#b86bff', rarity: 'common',
    apply: (s) => { s.extraLightning += 2; },
  },
  {
    id: 'bumper_add', name: '黄金バンパー', desc: '倍率バンパーを 1 個追加', icon: '◎', color: '#ffe14a', rarity: 'rare', max: 3,
    apply: (s) => { s.extraBumpers += 1; },
  },
  {
    id: 'blast', name: '大爆発', desc: '爆発範囲 +35%', icon: '✺', color: '#ff7a4d', rarity: 'rare', max: 3,
    apply: (s) => { s.bombRadius *= 1.35; },
  },
  {
    id: 'multishot', name: 'マルチショット', desc: '初期発射ボール数 +1', icon: '●●', color: '#fff0cc', rarity: 'rare', max: 3,
    apply: (s) => { s.ballsPerShot += 1; },
  },
  {
    id: 'wall_relic', name: '反射の護符', desc: '【レリック】壁で反射するたび、そのボールのスコア +20%', icon: '⟲', color: '#9dffcf', rarity: 'rare',
    apply: (s) => { s.wallBonus += 0.2; },
  },
  {
    id: 'sharp', name: '研いだ釘', desc: 'すべてのスコア +40%', icon: '▲', color: '#fff0cc', rarity: 'common',
    apply: (s) => { s.damageMul += 0.4; },
  },
  {
    id: 'chain_zap', name: '連鎖雷', desc: '電撃の連鎖数 +2', icon: 'ϟϟ', color: '#d6a8ff', rarity: 'common',
    apply: (s) => { s.lightningMin += 2; s.lightningMax += 2; },
  },
  {
    id: 'mitosis', name: '増殖細胞', desc: '分裂で生まれるボール +1', icon: '⁂', color: '#44f2ff', rarity: 'epic', max: 2,
    apply: (s) => { s.splitCount += 1; },
  },
  {
    id: 'combo', name: 'コンボマスター', desc: 'コンボ 1 つごとのスコア上昇 +2%', icon: '♪', color: '#ff9bd6', rarity: 'rare',
    apply: (s) => { s.comboBonus += 0.02; },
  },
  {
    id: 'crit', name: '会心の一撃', desc: 'クリティカル率 +10%(スコア ×3)', icon: '✦', color: '#ff6b6b', rarity: 'common', max: 6,
    apply: (s) => { s.critChance += 0.1; },
  },
  {
    id: 'bumper_power', name: '倍率チューニング', desc: '倍率バンパーの倍率 +0.25', icon: '×', color: '#ffe14a', rarity: 'rare',
    apply: (s) => { s.bumperBonus += 0.25; },
  },
  {
    id: 'heavy', name: '鉄球', desc: 'ボールが 20% 大きくなり、スコア +25%', icon: '⬤', color: '#d9d2b0', rarity: 'common', max: 2,
    apply: (s) => { s.ballRadiusMul *= 1.2; s.damageMul += 0.25; },
  },
  {
    id: 'vitality', name: '夜ふかし', desc: '残りショット +2(九十秒では +8 秒)', icon: '☾', color: '#ff8a7a', rarity: 'rare', max: 2,
    apply: () => ({ shots: 2 }),
  },
  {
    id: 'safety', name: 'セーフティネット', desc: 'ショットごとに 1 回、落ちたボールを打ち上げる', icon: '☂', color: '#9dffcf', rarity: 'rare', max: 3,
    apply: (s) => { s.safetyNets += 1; },
  },
  {
    id: 'chain_bomb', name: '誘爆', desc: '爆発で壊れたペグの 25% が小爆発する', icon: '☄', color: '#ff7a4d', rarity: 'epic', max: 3,
    apply: (s) => { s.chainBomb += 0.25; },
  },
  {
    id: 'coin', name: '招き猫', desc: '獲得コイン +50%', icon: '¥', color: '#ffe14a', rarity: 'common',
    apply: (s) => { s.coinMul += 0.5; },
  },
  {
    id: 'regen', name: '目覚まし時計', desc: 'ラスト 3 ショット(九十秒はラスト 20 秒)のスコア ×1.5', icon: '❀', color: '#9dffcf', rarity: 'rare', max: 2,
    apply: (s) => { s.lateBoost *= 1.5; },
  },
  {
    id: 'glass', name: 'ガラスの大砲', desc: 'すべてのスコア ×2、ただし残りショット -2(九十秒は -8 秒)', icon: '◇', color: '#c8f7ff', rarity: 'epic', max: 2,
    apply: (s) => { s.damageMul *= 2; return { shots: -2 }; },
  },
  {
    id: 'charge', name: '蓄電バンパー', desc: '倍率バンパーが 1 ショットで掛け算できる回数 +1', icon: '⚇', color: '#ffe14a', rarity: 'epic', max: 2,
    apply: (s) => { s.bumperCharges += 1; },
  },
  {
    id: 'relight', name: '灯り直し', desc: '壊れたペグが灯り直すまでの時間 -30%', icon: '☼', color: '#fff0cc', rarity: 'common', max: 3,
    apply: (s) => { s.regrowTime *= 0.7; },
  },
];

const WEIGHT: Record<Rarity, number> = { common: 60, rare: 30, epic: 12 };

/** 取得回数の上限を守りつつ、レア度の重みで 3 枚選ぶ */
export function drawCards(owned: Map<string, number>, n = 3): UpgradeDef[] {
  const pool = UPGRADES.filter((u) => u.max === undefined || (owned.get(u.id) ?? 0) < u.max);
  const out: UpgradeDef[] = [];
  while (out.length < n && pool.length > 0) {
    const total = pool.reduce((a, u) => a + WEIGHT[u.rarity], 0);
    let r = cardRand() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= WEIGHT[pool[i].rarity];
      if (r <= 0) break;
    }
    out.push(pool[i]);
    pool.splice(i, 1);
  }
  return out;
}

export const RARITY_LABEL: Record<Rarity, string> = { common: 'コモン', rare: 'レア', epic: 'エピック' };
