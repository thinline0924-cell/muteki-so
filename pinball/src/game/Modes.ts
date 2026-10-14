// プレイモード。どのモードも「ライン(目標点)を越えるたびに強化カード」は共通で、
// 何で夜が終わるか(ショット数か時間か)と、永続強化を使うかが違う。

export type ModeId = 'night' | 'daily' | 'rush' | 'three';

export interface ModeDef {
  id: ModeId;
  name: string;
  /** タイトルのボタンに出す一行説明 */
  desc: string;
  /** はじめのショット数(null = 時間制) */
  shots: number | null;
  /** 時間制のときの秒数(ショット中だけ減る) */
  time?: number;
  /** 毎ショットのボールに足す数 */
  extraBalls: number;
  /** 何本目のラインごとにショット +1 するか(0 = なし) */
  lineShotEvery: number;
  /** 永続強化(コインで育てたもの)を使うか */
  useMeta: boolean;
  /** 日付の種で、盤面とカードを全員そろえるか */
  seeded: boolean;
  /** 広告で延長したときのおまけ */
  extend: { shots?: number; time?: number } | null;
}

export const MODES: ModeDef[] = [
  {
    id: 'night', name: '一晩', desc: '12 ショットで夜明けまで。じっくり育てる基本のモード',
    shots: 12, extraBalls: 0, lineShotEvery: 3, useMeta: true, seeded: false, extend: { shots: 3 },
  },
  {
    id: 'daily', name: '今夜の一局', desc: '毎日かわる盤面とカード。永続強化なしの真剣勝負',
    shots: 12, extraBalls: 0, lineShotEvery: 3, useMeta: false, seeded: true, extend: null,
  },
  {
    id: 'rush', name: '九十秒', desc: '玉が動いている間だけ時間が減る。手早く撃ち続けろ',
    shots: null, time: 90, extraBalls: 0, lineShotEvery: 0, useMeta: true, seeded: false, extend: { time: 20 },
  },
  {
    id: 'three', name: '三球勝負', desc: 'ボール 5 個を 3 回だけ。すき間時間の一発勝負',
    shots: 3, extraBalls: 4, lineShotEvery: 0, useMeta: true, seeded: false, extend: { shots: 1 },
  },
];

export function getMode(id: ModeId): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}
