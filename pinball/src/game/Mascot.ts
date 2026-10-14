// 棚の上のソフビ怪獣。敵ではなく応援役:スコアが入ると跳ね、ラインを越えると万歳する。
// タイトル画面では寝ている。線画(こげ茶の線+クリーム色の塗り)で描く。

import { COLORS } from './constants';

export interface Mascot {
  /** スコアが入ったときのぴょん(1→0) */
  hop: number;
  /** ライン突破の万歳(1→0) */
  cheer: number;
}

export function makeMascot(): Mascot {
  return { hop: 0, cheer: 0 };
}

export function updateMascot(m: Mascot, dt: number): void {
  m.hop = Math.max(0, m.hop - dt * 2.5);
  m.cheer = Math.max(0, m.cheer - dt * 0.8);
}

const INK = COLORS.ink;

function fs(ctx: CanvasRenderingContext2D, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

/** (x, y) を足もとの中心として描く。sleep = 寝顔、scale = 大きさ */
export function drawMascot(
  ctx: CanvasRenderingContext2D,
  m: Mascot,
  x: number,
  y: number,
  t: number,
  sleep = false,
  scale = 1,
): void {
  ctx.save();
  const bob = Math.sin(t * (sleep ? 1.2 : 2.4));
  const hop = Math.sin(m.hop * Math.PI) * 22 + Math.abs(Math.sin(t * 14)) * m.cheer * 16;
  ctx.translate(x, y - hop * scale);
  ctx.scale(scale * (1 - bob * 0.018), scale * (1 + bob * 0.018));
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  const paper = '#e6dfc3';
  const shade = '#cbc29e';

  // 影(跳ねると小さくなる)
  ctx.fillStyle = 'rgba(40,28,18,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 2 + hop, 46 - hop, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // しっぽ
  ctx.beginPath();
  ctx.moveTo(26, -10);
  ctx.quadraticCurveTo(64, -6, 70, -30);
  ctx.quadraticCurveTo(58, -18, 30, -30);
  ctx.closePath();
  fs(ctx, shade);
  // 背中のトゲ
  for (let i = 0; i < 4; i++) {
    const by = -30 - i * 18;
    const bx = -34 + i * 3;
    ctx.beginPath();
    ctx.moveTo(bx + 6, by + 10);
    ctx.lineTo(bx - 14, by - 2);
    ctx.lineTo(bx + 4, by - 8);
    ctx.closePath();
    fs(ctx, shade);
  }
  // 体
  ctx.beginPath();
  ctx.ellipse(0, -42, 36, 42, 0, 0, Math.PI * 2);
  fs(ctx, paper);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(-8, -18 - i * 13);
    ctx.quadraticCurveTo(10, -14 - i * 13, 26, -20 - i * 13);
  }
  ctx.stroke();
  // 足
  ctx.beginPath();
  ctx.roundRect(-30, -8, 22, 10, 5);
  fs(ctx, paper);
  ctx.beginPath();
  ctx.roundRect(8, -8, 22, 10, 5);
  fs(ctx, paper);
  // 頭
  ctx.beginPath();
  ctx.ellipse(4, -90, 27, 24, 0, 0, Math.PI * 2);
  fs(ctx, paper);
  ctx.beginPath();
  ctx.ellipse(26, -82, 17, 13, 0.1, 0, Math.PI * 2);
  fs(ctx, paper);
  // 口(喜ぶと開く)
  ctx.beginPath();
  if (m.cheer > 0 || m.hop > 0.3) {
    ctx.moveTo(14, -78);
    ctx.quadraticCurveTo(28, -62, 40, -78);
    ctx.closePath();
    fs(ctx, '#2a1c12');
  } else {
    ctx.moveTo(12, -76);
    ctx.quadraticCurveTo(28, -70, 40, -78);
    ctx.stroke();
  }
  // 腕(万歳のときは上に)
  ctx.beginPath();
  if (m.cheer > 0) ctx.ellipse(30, -70, 10, 6, -1.4, 0, Math.PI * 2);
  else ctx.ellipse(28, -48, 10, 6, -0.6, 0, Math.PI * 2);
  fs(ctx, paper);
  // 目
  if (sleep) {
    ctx.beginPath();
    ctx.arc(10, -97, 4.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else if (m.cheer > 0) {
    // うれしい目(への字)
    ctx.beginPath();
    ctx.moveTo(5, -94);
    ctx.lineTo(10, -100);
    ctx.lineTo(15, -94);
    ctx.stroke();
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(10, -96, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.arc(8.8, -97.8, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(216,66,58,0.35)';
  ctx.beginPath();
  ctx.ellipse(-6, -84, 6, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
