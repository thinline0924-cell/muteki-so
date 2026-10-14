// 敵:部屋の小物が夜な夜な動き出した、という設定。線画(こげ茶の線+クリーム色の塗り)で描く。

import { COLORS } from './constants';

export type EnemyKind = 'dino' | 'trash' | 'plant' | 'laptop' | 'hanger' | 'beanbag';

export interface Enemy {
  kind: EnemyKind;
  name: string;
  wave: number;
  boss: boolean;
  maxHp: number;
  hp: number;
  /** HP バーの「遅れて減る白い部分」 */
  shownHp: number;
  atk: number;
  countdown: number;
  maxCountdown: number;
  hitT: number;
  attackT: number;
  deathT: number;
  enterT: number;
}

const NAMES: Record<EnemyKind, string> = {
  dino: 'ソフビ怪獣ガオ',
  trash: 'ゴミ箱ミミック',
  plant: '観葉ゴーレム',
  laptop: '深夜のノートPC',
  hanger: 'ハンガー亡霊',
  beanbag: 'ビーズクッション大王',
};

const ROTATION: EnemyKind[] = ['dino', 'trash', 'plant', 'laptop', 'hanger'];

export function makeEnemy(wave: number): Enemy {
  const boss = wave % 5 === 0;
  const kind: EnemyKind = boss ? 'beanbag' : ROTATION[(wave - 1 - Math.floor(wave / 5)) % ROTATION.length];
  const lap = Math.floor((wave - 1) / 5);
  const hp = Math.round(300 * Math.pow(1.5, wave - 1) * (boss ? 2.6 : 1));
  const cd = 3;
  return {
    kind,
    name: NAMES[kind] + (lap > 0 ? ` Lv${lap + 1}` : ''),
    wave,
    boss,
    maxHp: hp,
    hp,
    shownHp: hp,
    atk: Math.round((12 + wave * 3) * (boss ? 1.5 : 1)),
    countdown: cd,
    maxCountdown: cd,
    hitT: 0,
    attackT: 0,
    deathT: 0,
    enterT: 0,
  };
}

const INK = COLORS.ink;

function fs(ctx: CanvasRenderingContext2D, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
}

let sleeping = false;

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angry: boolean, dir: number): void {
  if (sleeping) {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.9, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffbe8';
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.35, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  if (angry) {
    ctx.beginPath();
    ctx.moveTo(x - r * 1.3 * dir, y - r * 1.9);
    ctx.lineTo(x + r * 1.1 * dir, y - r * 1.2);
    ctx.stroke();
  }
}

/** (x, y) を足もとの中心として敵を描く。sleep = タイトル画面用の寝顔 */
export function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, t: number, sleep = false): void {
  sleeping = sleep;
  ctx.save();
  let ox = 0;
  let oy = Math.sin(t * 2.4) * 2.2;
  let sx = 1 - Math.sin(t * 2.4) * 0.018;
  let sy = 1 + Math.sin(t * 2.4) * 0.018;
  let alpha = 1;
  let rot = 0;
  if (e.kind === 'hanger') oy += Math.sin(t * 1.7) * 5 - 6;
  if (e.enterT < 1) {
    const k = 1 - e.enterT;
    oy -= k * k * 150;
    sy *= 1 + k * 0.2;
    sx *= 1 - k * 0.15;
  }
  if (e.hitT > 0) {
    ox += Math.sin(t * 90) * e.hitT * 12;
    sx *= 1 + e.hitT * 0.14;
    sy *= 1 - e.hitT * 0.14;
  }
  if (e.attackT > 0) {
    const p = 1 - e.attackT; // 0→1
    const lunge = Math.sin(Math.min(1, p * 1.4) * Math.PI);
    oy += lunge * 34;
    sx *= 1 + lunge * 0.25;
    sy *= 1 + lunge * 0.25;
  }
  if (e.deathT > 0) {
    alpha = Math.max(0, 1 - e.deathT);
    rot = e.deathT * 0.6;
    oy += e.deathT * e.deathT * 120;
    sx *= 1 + e.deathT * 0.3;
  }
  ctx.globalAlpha = alpha;
  ctx.translate(x + ox, y + oy);
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  const flash = e.hitT > 0.55;
  const paper = flash ? '#ffffff' : '#e6dfc3';
  const shade = flash ? '#ffffff' : '#cbc29e';
  const angry = e.countdown <= 1 && e.deathT <= 0;

  // 影
  ctx.fillStyle = 'rgba(40,28,18,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 54, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  switch (e.kind) {
    case 'dino': {
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
      // おなかのしま
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
      // 口と歯
      ctx.beginPath();
      ctx.moveTo(12, -76);
      ctx.quadraticCurveTo(28, -70, 40, -78);
      ctx.stroke();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      ctx.moveTo(20, -74);
      ctx.lineTo(23, -68);
      ctx.lineTo(26, -73);
      ctx.moveTo(30, -74);
      ctx.lineTo(33, -68);
      ctx.lineTo(35, -75);
      ctx.fill();
      ctx.stroke();
      // 腕
      ctx.beginPath();
      ctx.ellipse(28, -48, 10, 6, -0.6, 0, Math.PI * 2);
      fs(ctx, paper);
      eye(ctx, 10, -96, 5, angry, 1);
      ctx.fillStyle = 'rgba(216,66,58,0.35)';
      ctx.beginPath();
      ctx.ellipse(-6, -84, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'trash': {
      // 丸めた紙
      ctx.beginPath();
      ctx.moveTo(52, 0);
      ctx.lineTo(44, -8);
      ctx.lineTo(48, -18);
      ctx.lineTo(60, -20);
      ctx.lineTo(68, -12);
      ctx.lineTo(64, -1);
      ctx.closePath();
      fs(ctx, '#f6f1d2');
      ctx.beginPath();
      ctx.moveTo(50, -12);
      ctx.lineTo(58, -10);
      ctx.lineTo(62, -16);
      ctx.stroke();
      // 本体
      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.lineTo(34, 0);
      ctx.lineTo(42, -88);
      ctx.lineTo(-42, -88);
      ctx.closePath();
      fs(ctx, paper);
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(i * 13, -8);
        ctx.lineTo(i * 15.5, -78);
      }
      ctx.globalAlpha *= 0.5;
      ctx.stroke();
      ctx.globalAlpha = alpha;
      // 口の中(暗い)
      ctx.beginPath();
      ctx.ellipse(0, -88, 42, 9, 0, 0, Math.PI * 2);
      fs(ctx, '#2a1c12');
      // 光る目
      ctx.fillStyle = angry ? COLORS.blood : COLORS.cream;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(-12, -89, 3.5, 0, Math.PI * 2);
      ctx.arc(12, -89, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // ふた(パカッと開く)
      const open = 0.35 + Math.sin(t * 3) * 0.08 + (e.attackT > 0 ? 0.3 : 0);
      ctx.save();
      ctx.translate(-42, -92);
      ctx.rotate(-open);
      ctx.beginPath();
      ctx.ellipse(42, -2, 46, 9, 0, 0, Math.PI * 2);
      fs(ctx, paper);
      // 歯
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const tx = 10 + i * 13;
        ctx.moveTo(tx, 6);
        ctx.lineTo(tx + 5, 15);
        ctx.lineTo(tx + 10, 6);
      }
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(32, -14, 20, 7, 3);
      fs(ctx, shade);
      ctx.restore();
      break;
    }
    case 'plant': {
      // 葉(こげ茶のシルエット)
      ctx.beginPath();
      ctx.moveTo(0, -56);
      ctx.lineTo(0, -96);
      ctx.moveTo(0, -78);
      ctx.lineTo(-18, -96);
      ctx.moveTo(0, -84);
      ctx.lineTo(16, -104);
      ctx.stroke();
      const leaves: Array<[number, number, number]> = [
        [-28, -104, -0.5], [-10, -122, -0.1], [14, -120, 0.3], [30, -102, 0.7],
        [-34, -86, -1.0], [36, -84, 1.1], [0, -106, 0], [-20, -112, -0.3], [22, -110, 0.5],
      ];
      for (const [lx, ly, lr] of leaves) {
        ctx.save();
        ctx.translate(lx, ly + Math.sin(t * 2 + lx) * 1.5);
        ctx.rotate(lr);
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 16, 0, 0, Math.PI * 2);
        ctx.fillStyle = flash ? '#fff' : INK;
        ctx.fill();
        ctx.strokeStyle = 'rgba(239,233,189,0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(0, 12);
        ctx.stroke();
        ctx.restore();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.2;
      // 鉢
      ctx.beginPath();
      ctx.moveTo(-32, 0);
      ctx.lineTo(32, 0);
      ctx.lineTo(40, -52);
      ctx.lineTo(-40, -52);
      ctx.closePath();
      fs(ctx, paper);
      ctx.beginPath();
      ctx.roundRect(-46, -64, 92, 14, 4);
      fs(ctx, shade);
      eye(ctx, -13, -32, 5, angry, -1);
      eye(ctx, 13, -32, 5, angry, 1);
      ctx.beginPath();
      ctx.moveTo(-8, -16);
      ctx.quadraticCurveTo(0, angry ? -22 : -10, 8, -16);
      ctx.stroke();
      break;
    }
    case 'laptop': {
      // 画面
      ctx.beginPath();
      ctx.roundRect(-50, -108, 100, 92, 8);
      fs(ctx, paper);
      ctx.beginPath();
      ctx.roundRect(-42, -100, 84, 74, 4);
      fs(ctx, COLORS.night);
      // 画面の中の顔(ネオン)
      const c = angry ? COLORS.blood : COLORS.cream;
      ctx.save();
      ctx.strokeStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-26, -78);
      ctx.lineTo(-10, -72);
      ctx.moveTo(26, -78);
      ctx.lineTo(10, -72);
      ctx.moveTo(-18, -46);
      for (let i = 0; i < 6; i++) ctx.lineTo(-18 + (i + 1) * 6, i % 2 ? -46 : -52);
      ctx.stroke();
      ctx.restore();
      // キーボード
      ctx.beginPath();
      ctx.moveTo(-62, 0);
      ctx.lineTo(62, 0);
      ctx.lineTo(52, -16);
      ctx.lineTo(-52, -16);
      ctx.closePath();
      fs(ctx, shade);
      ctx.fillStyle = INK;
      for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) ctx.fillRect(-44 + i * 10 - r * 3, -12 + r * 6, 5, 2);
      break;
    }
    case 'hanger': {
      // フック
      ctx.beginPath();
      ctx.arc(0, -120, 8, Math.PI * 0.9, Math.PI * 2.2);
      ctx.moveTo(0, -112);
      ctx.lineTo(0, -106);
      ctx.moveTo(0, -106);
      ctx.lineTo(-48, -88);
      ctx.lineTo(48, -88);
      ctx.closePath();
      ctx.stroke();
      // コート(おばけ)
      ctx.beginPath();
      ctx.moveTo(-46, -88);
      ctx.lineTo(46, -88);
      ctx.lineTo(40, -12);
      for (let i = 0; i < 5; i++) {
        const xx = 40 - (i + 1) * 16;
        ctx.quadraticCurveTo(xx + 8, -2 + Math.sin(t * 5 + i) * 4, xx, -12);
      }
      ctx.closePath();
      fs(ctx, paper);
      // そで
      ctx.beginPath();
      ctx.moveTo(-46, -88);
      ctx.lineTo(-60, -40 + Math.sin(t * 3) * 4);
      ctx.lineTo(-48, -36 + Math.sin(t * 3) * 4);
      ctx.lineTo(-40, -70);
      ctx.moveTo(46, -88);
      ctx.lineTo(60, -40 - Math.sin(t * 3) * 4);
      ctx.lineTo(48, -36 - Math.sin(t * 3) * 4);
      ctx.lineTo(40, -70);
      ctx.fillStyle = shade;
      ctx.fill();
      ctx.stroke();
      // えり
      ctx.beginPath();
      ctx.moveTo(-16, -88);
      ctx.lineTo(0, -66);
      ctx.lineTo(16, -88);
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(-14, -52, 6, 8, 0, 0, Math.PI * 2);
      ctx.ellipse(14, -52, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -32, 5, angry ? 3 : 6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'beanbag': {
      // 本体(ビーズクッション)
      ctx.beginPath();
      ctx.moveTo(-70, -6);
      ctx.bezierCurveTo(-82, -60, -40, -100, 0, -98);
      ctx.bezierCurveTo(46, -96, 82, -58, 70, -6);
      ctx.quadraticCurveTo(0, 8, -70, -6);
      ctx.closePath();
      fs(ctx, paper);
      ctx.beginPath();
      ctx.moveTo(-20, -84);
      ctx.quadraticCurveTo(6, -70, 36, -74);
      ctx.moveTo(30, -88);
      ctx.quadraticCurveTo(44, -80, 46, -66);
      ctx.stroke();
      // 王冠(ネオン)
      ctx.save();
      ctx.strokeStyle = COLORS.multi;
      ctx.shadowColor = COLORS.multi;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-22, -96);
      ctx.lineTo(-26, -118);
      ctx.lineTo(-11, -106);
      ctx.lineTo(0, -124);
      ctx.lineTo(11, -106);
      ctx.lineTo(26, -118);
      ctx.lineTo(22, -96);
      ctx.stroke();
      ctx.restore();
      eye(ctx, -22, -50, 7, true, -1);
      eye(ctx, 22, -50, 7, true, 1);
      ctx.beginPath();
      ctx.moveTo(-18, -26);
      ctx.quadraticCurveTo(0, -36, 18, -26);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
