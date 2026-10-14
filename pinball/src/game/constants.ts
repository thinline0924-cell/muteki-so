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

// 色:セピアの紙とインク+差し色の赤。ペグの色も彩度を落として同じ世界に置く
export const COLORS = {
  wall: '#c4bc98',
  wallDark: '#aaa27e',
  paper: '#e6dfc3',
  paper2: '#d6ceac',
  ink: '#221c14',
  inkSoft: 'rgba(34,28,20,0.55)',
  night: '#1c1813',
  night2: '#2a231a',
  cream: '#f3edd8',
  blood: '#c8392b',
  red: '#d9442f',
  normal: '#d8cfae',
  split: '#8fd6cf',
  bomb: '#de5440',
  multi: '#e6c25a',
  lightning: '#ab95d6',
  ball: '#ffffff',
} as const;

/** 文字:角ばった極太ゴシック(各端末に入っている書体だけを使う) */
export const FONT = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", "Meiryo", sans-serif`;
/** 数字:幅の広い極太体 */
export const NUM_FONT = `"Arial Black", "Helvetica Neue", "Roboto", "Hiragino Sans", "Noto Sans JP", sans-serif`;

export type PegType = 'normal' | 'split' | 'bomb' | 'multi' | 'lightning';

export const PEG_COLOR: Record<PegType, string> = {
  normal: COLORS.normal,
  split: COLORS.split,
  bomb: COLORS.bomb,
  multi: COLORS.multi,
  lightning: COLORS.lightning,
};
