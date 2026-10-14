// 画面・盤面・物理の定数。座標はすべて論理座標(540×960)で扱い、描画時に拡大する。

export const W = 540;
export const H = 960;

/** 盤面(夜の窓)の範囲。左右と上は壁として反射する */
export const BOARD = { left: 28, right: 512, top: 234, bottom: 912 };
/** ボールがここより下に落ちたら回収(ドレイン) */
export const DRAIN_Y = 930;
/** 発射口(ペンダントライト)の位置 */
export const LAUNCHER = { x: 270, y: 262 };

/** 物理の固定ステップ(秒)。速度倍率はこのステップを回す回数で表現する */
export const PHYS_DT = 1 / 200;
export const GRAVITY = 1250;
export const MAX_SPEED = 1450;
export const LAUNCH_SPEED = 920;
export const BALL_R = 8;
export const PEG_R = 9;
export const BUMPER_R = 21;
export const MAX_BALLS = 320;

export const FEVER_COMBO = 50;
export const COMBO_TIMEOUT = 1.5;

export const COLORS = {
  wall: '#b0ab72',
  wallDark: '#9b9760',
  wallLight: '#c9c48b',
  light: '#e9e4a6',
  paper: '#efe9bd',
  ink: '#3a2a1c',
  inkSoft: 'rgba(58,42,28,0.55)',
  night: '#24180f',
  night2: '#3a2819',
  chalk: '#f2ead0',
  blood: '#d8423a',
  normal: '#fff0cc',
  split: '#44f2ff',
  bomb: '#ff3b4e',
  multi: '#ffe14a',
  lightning: '#b86bff',
  ball: '#fff8e2',
} as const;

export type PegType = 'normal' | 'split' | 'bomb' | 'multi' | 'lightning';

export const PEG_COLOR: Record<PegType, string> = {
  normal: COLORS.normal,
  split: COLORS.split,
  bomb: COLORS.bomb,
  multi: COLORS.multi,
  lightning: COLORS.lightning,
};
