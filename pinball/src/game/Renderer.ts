// Canvas への描画。背景(夜の部屋)は一度だけ別の Canvas に描いて使い回す。
// ネオンの光るペグも、色ごとに一度だけ描いた「スプライト」(使い回し用の小さな絵)を貼る。

import { drawEnemy, makeEnemy } from './Enemies';
import { BOARD, COLORS, FEVER_COMBO, FONT, H, LAUNCHER, NUM_FONT, PEG_COLOR, W, type PegType } from './constants';
import type { Game } from './Game';
import { fmt, fmtMult } from './JuiceManager';
import type { Ball, Peg } from './Physics';
import { Sketch } from './sketch';

const INK = COLORS.ink;
const CREAM = COLORS.cream;
const PAPER = COLORS.paper;

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** 論理座標 → 実ピクセルの倍率 */
  scale = 1;
  private bg: HTMLCanvasElement | null = null;
  private sprites = new Map<string, HTMLCanvasElement>();
  /** タイトル画面で棚の上で寝ている怪獣 */
  private sleeper = Object.assign(makeEnemy(1), { enterT: 1 });

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  resize(cssW: number, cssH: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.scale = this.canvas.width / W;
    this.bg = null;
    this.sprites.clear();
  }

  // ───────── スプライト ─────────

  private sprite(key: string, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
    let sp = this.sprites.get(key);
    if (sp) return sp;
    sp = document.createElement('canvas');
    const px = Math.ceil(size * 2 * this.scale);
    sp.width = sp.height = px;
    const c = sp.getContext('2d')!;
    c.scale(this.scale, this.scale);
    c.translate(size, size);
    draw(c, size);
    this.sprites.set(key, sp);
    return sp;
  }

  /** ペグ:平らな色の円+インクの縁+左上の小さな光。ぼんやりした光は控えめにする */
  private pegSprite(type: PegType, r: number, hp: number): HTMLCanvasElement {
    const color = PEG_COLOR[type];
    const size = r + 12;
    return this.sprite(`peg-${type}-${r}-${hp}`, size, (c) => {
      const g = c.createRadialGradient(0, 0, r * 0.6, 0, 0, size);
      g.addColorStop(0, hexA(color, 0.42));
      g.addColorStop(1, hexA(color, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, size, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = color;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      // 下半分を少し暗く(紙に刷ったような陰)
      c.fillStyle = 'rgba(34,28,20,0.18)';
      c.beginPath();
      c.arc(0, 0, r, 0.1, Math.PI - 0.1);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.75)';
      c.lineWidth = 1.4;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(0, 0, r * 0.62, Math.PI * 1.08, Math.PI * 1.42);
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 1.8;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
      c.lineJoin = 'round';
      c.beginPath();
      if (type === 'split') {
        c.moveTo(-r * 0.42, 0);
        c.lineTo(r * 0.42, 0);
        c.moveTo(0, -r * 0.42);
        c.lineTo(0, r * 0.42);
      } else if (type === 'bomb') {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          c.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18);
          c.lineTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
        }
      } else if (type === 'lightning') {
        c.moveTo(r * 0.15, -r * 0.58);
        c.lineTo(-r * 0.22, r * 0.05);
        c.lineTo(r * 0.18, -r * 0.05);
        c.lineTo(-r * 0.15, r * 0.58);
      }
      c.lineWidth = 2;
      c.stroke();
      if (type === 'multi') {
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(0, 0, r * 0.74, 0, Math.PI * 2);
        c.stroke();
      }
      // 耐久:外側の点線の輪
      c.strokeStyle = CREAM;
      c.lineWidth = 1.4;
      c.setLineDash([2.5, 2.5]);
      for (let i = 1; i < hp; i++) {
        c.beginPath();
        c.arc(0, 0, r + 3.5 + (i - 1) * 3.5, 0, Math.PI * 2);
        c.stroke();
      }
      c.setLineDash([]);
    });
  }

  private ballSprite(r: number): HTMLCanvasElement {
    const size = r + 14;
    return this.sprite(`ball-${r.toFixed(1)}`, size, (c) => {
      const g = c.createRadialGradient(0, 0, r * 0.6, 0, 0, size);
      g.addColorStop(0, 'rgba(255,253,244,0.85)');
      g.addColorStop(1, 'rgba(255,253,244,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, size, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = COLORS.ball;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
    });
  }

  // ───────── 背景(夜の部屋) ─────────

  private buildBackground(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.canvas.width;
    cv.height = this.canvas.height;
    const c = cv.getContext('2d')!;
    c.scale(this.scale, this.scale);
    const sk = new Sketch(20261014);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // 壁(くすんだカーキ)
    const wall = c.createLinearGradient(0, 0, 0, BOARD.top);
    wall.addColorStop(0, '#cbc39f');
    wall.addColorStop(1, '#b7af8b');
    c.fillStyle = wall;
    c.fillRect(0, 0, W, H);
    // 紙のざらつき
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = sk.rnd() < 0.5 ? 'rgba(34,28,20,0.07)' : 'rgba(255,250,235,0.08)';
      c.fillRect(sk.rnd() * W, 34 + sk.rnd() * (BOARD.top - 34), 1.4, 1.4);
    }

    // 夜の窓(盤面)
    const night = c.createLinearGradient(0, BOARD.top, 0, BOARD.bottom);
    night.addColorStop(0, '#16120e');
    night.addColorStop(0.65, COLORS.night);
    night.addColorStop(1, COLORS.night2);
    c.fillStyle = night;
    c.fillRect(BOARD.left - 6, BOARD.top, BOARD.right - BOARD.left + 12, BOARD.bottom - BOARD.top);
    // 星
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(243,237,216,${0.08 + sk.rnd() * 0.3})`;
      const sz = sk.rnd() < 0.12 ? 2 : 1.2;
      c.fillRect(BOARD.left + sk.rnd() * (BOARD.right - BOARD.left), BOARD.top + sk.rnd() * 380, sz, sz);
    }
    // 三日月
    c.fillStyle = 'rgba(243,237,216,0.85)';
    c.beginPath();
    c.arc(452, 300, 15, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#16120e';
    c.beginPath();
    c.arc(459, 295, 14, 0, Math.PI * 2);
    c.fill();

    // 街の線画(チョークのような白い線)
    c.save();
    c.strokeStyle = 'rgba(243,237,216,0.34)';
    c.lineWidth = 1.7;
    c.beginPath();
    const base = BOARD.bottom - 2;
    const blds: Array<[number, number, number]> = [
      [30, 70, 120], [70, 50, 190], [118, 64, 140], [176, 40, 230], [214, 46, 160],
      [300, 54, 175], [352, 60, 120], [410, 44, 205], [452, 62, 150], [496, 30, 110],
    ];
    for (const [x, w, h] of blds) {
      sk.rect(c, x, base - h, w, h, 0.8);
      for (let yy = base - h + 14; yy < base - 12; yy += 20) {
        for (let xx = x + 8; xx < x + w - 8; xx += 14) {
          if (sk.rnd() < 0.4) sk.rect(c, xx, yy, 5, 7, 0.3);
        }
      }
    }
    // 電波塔
    const tx = 262;
    const top = base - 330;
    sk.line(c, tx - 26, base, tx - 8, top + 40, 0.8);
    sk.line(c, tx + 26, base, tx + 8, top + 40, 0.8);
    for (let k = 0; k < 7; k++) {
      const yy = base - 30 - k * 38;
      const hw = 26 - (k * 18) / 7;
      sk.line(c, tx - hw, yy, tx + hw, yy - 18, 0.5);
      sk.line(c, tx + hw, yy, tx - hw, yy - 18, 0.5);
    }
    sk.rect(c, tx - 16, top + 26, 32, 18, 0.6);
    sk.line(c, tx, top + 26, tx, top - 20, 0.5);
    sk.rect(c, tx - 10, base - 200, 20, 14, 0.4);
    // 縦長の看板
    sk.rect(c, 84, base - 262, 26, 92, 0.6);
    c.stroke();
    c.fillStyle = 'rgba(243,237,216,0.34)';
    c.font = `900 17px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    ['夜', '窓', '館'].forEach((ch, i) => c.fillText(ch, 97, base - 240 + i * 24));
    c.strokeStyle = 'rgba(243,237,216,0.4)';
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k - 4.5) * 0.3;
      sk.line(c, tx + Math.cos(a) * 26, top - 22 + Math.sin(a) * 26, tx + Math.cos(a) * 42, top - 22 + Math.sin(a) * 42, 0.3);
    }
    c.stroke();
    c.restore();

    // 窓枠のサッシ(うっすら)
    c.strokeStyle = 'rgba(243,237,216,0.07)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(W / 2, BOARD.top + 70);
    c.lineTo(W / 2, BOARD.bottom);
    c.moveTo(BOARD.left, 590);
    c.lineTo(BOARD.right, 590);
    c.stroke();

    // カーテン(左右。上のほうは窓にかぶさる)
    this.drawCurtain(c, sk, false);
    this.drawCurtain(c, sk, true);

    // カーテンレール
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.beginPath();
    sk.line(c, -4, BOARD.top - 2, W + 4, BOARD.top - 2, 0.6);
    c.stroke();

    // 上の壁:額縁(Wave)
    c.fillStyle = '#d9d1ae';
    c.fillRect(20, 62, 104, 84);
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.beginPath();
    sk.rect(c, 20, 62, 104, 84, 1);
    sk.rect(c, 28, 70, 88, 68, 0.8);
    c.stroke();
    c.lineWidth = 1.4;
    c.beginPath();
    sk.line(c, 72, 50, 32, 62, 0.4);
    sk.line(c, 72, 50, 112, 62, 0.4);
    c.stroke();
    this.hatch(c, sk, 124, 66, 8, 84);
    // 時計(攻撃カウントダウン)
    c.fillStyle = PAPER;
    c.beginPath();
    c.arc(468, 112, 46, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 3;
    c.beginPath();
    sk.ellipse(c, 468, 112, 46, 46, 1);
    c.stroke();
    c.lineWidth = 1.8;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.moveTo(468 + Math.cos(a) * 37, 112 + Math.sin(a) * 37);
      c.lineTo(468 + Math.cos(a) * 42, 112 + Math.sin(a) * 42);
    }
    c.stroke();
    // 棚板(敵が立つ場所)
    c.fillStyle = '#d1c9a5';
    c.fillRect(150, 192, 240, 12);
    c.lineWidth = 2.6;
    c.beginPath();
    sk.rect(c, 150, 192, 240, 12, 0.8);
    sk.line(c, 176, 204, 182, 226, 0.5);
    sk.line(c, 364, 204, 358, 226, 0.5);
    c.stroke();
    this.hatch(c, sk, 156, 205, 228, 6);

    // 上下の暗い帯(上は DOM のメニュー、下は HP 表示の土台)
    c.fillStyle = '#17130e';
    c.fillRect(0, 0, W, 34);
    c.fillRect(0, BOARD.bottom, W, H - BOARD.bottom);
    c.strokeStyle = 'rgba(243,237,216,0.18)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, 34.5);
    c.lineTo(W, 34.5);
    c.moveTo(0, BOARD.bottom + 0.5);
    c.lineTo(W, BOARD.bottom + 0.5);
    c.stroke();
    return cv;
  }

  /** 斜線の影(ペンで描いたハッチング) */
  private hatch(c: CanvasRenderingContext2D, sk: Sketch, x: number, y: number, w: number, h: number): void {
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.strokeStyle = 'rgba(34,28,20,0.35)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = -h; i < w; i += 5) sk.line(c, x + i, y + h, x + i + h, y, 0.3);
    c.stroke();
    c.restore();
  }

  /** 布のカーテン:上は大きく垂れ、タッセルで絞られて細くなる */
  private drawCurtain(c: CanvasRenderingContext2D, sk: Sketch, right: boolean): void {
    c.save();
    if (right) {
      c.translate(W, 0);
      c.scale(-1, 1);
    }
    const L = BOARD.left;
    const top = BOARD.top;
    c.beginPath();
    c.moveTo(-4, top);
    c.lineTo(82, top);
    c.bezierCurveTo(70, top + 70, 46, top + 150, L + 2, 470);
    c.lineTo(L + 2, BOARD.bottom);
    c.lineTo(-4, BOARD.bottom);
    c.closePath();
    c.fillStyle = '#d2caa6';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
    // ひだ
    c.lineWidth = 1.3;
    c.strokeStyle = 'rgba(34,28,20,0.55)';
    c.beginPath();
    for (const [x0, x1] of [[16, 8], [36, 16], [58, 22]] as Array<[number, number]>) {
      c.moveTo(x0, top + 4);
      c.quadraticCurveTo(x0 * 0.7 + x1 * 0.3, 380, x1, 470);
      c.lineTo(x1 + (sk.rnd() - 0.5) * 3, BOARD.bottom - 4);
    }
    c.stroke();
    // タッセル(留め紐)
    c.fillStyle = PAPER;
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.beginPath();
    c.rect(-2, 466, L + 8, 11);
    c.fill();
    c.stroke();
    c.restore();
  }

  // ───────── 毎フレームの描画 ─────────

  draw(g: Game): void {
    const ctx = this.ctx;
    const j = g.juice;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.bg) this.bg = this.buildBackground();
    // シェイクではみ出た部分が見えないよう、まず暗い色で塗る
    ctx.fillStyle = '#17130e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.scale;
    ctx.setTransform(s, 0, 0, s, j.shakeX * s, j.shakeY * s);
    ctx.drawImage(this.bg, 0, 0, W, H);

    const t = j.time;
    if (j.fever) this.drawFeverBg(ctx, t, j.feverT);

    this.drawHudPanels(g, t);
    this.drawReadout(g);
    this.drawPegs(g.pegs, t);
    if (g.state === 'aim' && g.aim.active && g.prediction) this.drawPrediction(g);
    this.drawBalls(g.balls, j.fever, t);
    this.drawLauncher(g, t);
    j.drawEffects(ctx);
    this.drawShotHud(g, t);
    if (g.resolveAnim) this.drawResolve(g);
    j.drawTexts(ctx);
    this.drawBanner(g);
    if (g.state !== 'title') this.drawBottom(g);

    if (j.flashA > 0) {
      ctx.globalAlpha = j.flashA;
      ctx.fillStyle = j.flashColor;
      ctx.fillRect(-40, -40, W + 80, H + 80);
      ctx.globalAlpha = 1;
    }
    if (g.hurtT > 0) this.drawHurt(g.hurtT);
    j.drawCracks(ctx);
  }

  /** 紙のタグ(ふきだし)。badge を渡すと右上に黒い丸の数字が付く */
  private tag(
    x: number,
    y: number,
    text: string,
    o: { size?: number; rot?: number; dark?: boolean; badge?: string; alpha?: number } = {},
  ): void {
    const ctx = this.ctx;
    const size = o.size ?? 14;
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + size * 1.4;
    const h = size * 2;
    ctx.fillStyle = INK;
    ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
    ctx.fillStyle = o.dark ? INK : PAPER;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = o.dark ? CREAM : INK;
    ctx.lineWidth = o.dark ? 1.2 : 2;
    ctx.strokeRect(-w / 2 + (o.dark ? 3 : 0), -h / 2 + (o.dark ? 3 : 0), w - (o.dark ? 6 : 0), h - (o.dark ? 6 : 0));
    ctx.fillStyle = o.dark ? CREAM : INK;
    ctx.fillText(text, 0, 1);
    if (o.badge) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(w / 2, -h / 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.font = `900 12px ${NUM_FONT}`;
      ctx.fillText(o.badge, w / 2, -h / 2 + 1);
    }
    ctx.restore();
  }

  /** フィーバー用の光(色相 12 段階)。小さく描いて引き伸ばすので軽い */
  private feverGlow: HTMLCanvasElement[] = [];

  private glowSprite(i: number): HTMLCanvasElement {
    let c = this.feverGlow[i];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const hue = i * 30;
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, `hsla(${hue},100%,62%,1)`);
    g.addColorStop(0.55, `hsla(${(hue + 40) % 360},100%,55%,0.45)`);
    g.addColorStop(1, `hsla(${(hue + 80) % 360},100%,50%,0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    this.feverGlow[i] = c;
    return c;
  }

  private drawFeverBg(ctx: CanvasRenderingContext2D, t: number, ft: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(t * 9);
    const fade = Math.min(1, ft * 2);
    const hi = Math.floor(((t * 120) % 360) / 30);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.12 + pulse * 0.12) * fade;
    ctx.drawImage(this.glowSprite(hi), BOARD.left - 120, 300, BOARD.right - BOARD.left + 240, 560);
    // 走る光の帯
    ctx.globalAlpha = 0.05 * fade;
    for (let i = 0; i < 5; i++) {
      const y = BOARD.top + ((t * 260 + i * 140) % (BOARD.bottom - BOARD.top));
      ctx.fillStyle = `hsl(${(hi * 30 + i * 70) % 360},100%,60%)`;
      ctx.fillRect(BOARD.left, y, BOARD.right - BOARD.left, 10);
    }
    ctx.restore();
  }

  private drawHudPanels(g: Game, t: number): void {
    const ctx = this.ctx;
    const e = g.enemy;
    // Wave(額縁の中)。タイトルでは最高記録
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.font = `900 11px ${NUM_FONT}`;
    ctx.fillText(!e ? 'BEST' : e.boss ? 'BOSS' : 'WAVE', 72, 85);
    ctx.font = `900 40px ${NUM_FONT}`;
    ctx.fillStyle = e?.boss ? COLORS.blood : INK;
    ctx.fillText(String(e ? g.wave : g.save.data.bestWave), 72, 116);

    if (!e) {
      this.drawTitleRoom(t);
      return;
    }
    drawEnemy(ctx, e, 270, 192, t);

    // 時計:攻撃までの残りショット数
    const cd = e.countdown;
    const danger = cd <= 1;
    const a = -Math.PI / 2 + (1 - cd / e.maxCountdown) * Math.PI * 2;
    ctx.strokeStyle = danger ? COLORS.blood : INK;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(468, 112);
    ctx.lineTo(468 + Math.cos(a) * 30, 112 + Math.sin(a) * 30);
    ctx.stroke();
    const pulse = danger ? 1 + Math.sin(t * 10) * 0.08 : 1;
    ctx.save();
    ctx.translate(468, 112);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = danger ? COLORS.blood : INK;
    ctx.font = `900 34px ${NUM_FONT}`;
    ctx.fillText(String(cd), 0, 3);
    ctx.restore();
    this.tag(468, 172, danger ? '次で攻撃' : `攻撃まで ${cd}`, { size: 11, dark: danger, rot: 0.03 });

    // 敵の名前(黒いタグ)と HP バー
    this.tag(270, 54, e.name, { size: 12, dark: true });
    const bx = 150;
    const bw = 240;
    const by = 208;
    ctx.fillStyle = COLORS.paper2;
    ctx.fillRect(bx, by, bw, 14);
    const shown = Math.max(0, e.shownHp / e.maxHp);
    const real = Math.max(0, e.hp / e.maxHp);
    // 削られた分は赤く残してから消える
    ctx.fillStyle = COLORS.red;
    ctx.fillRect(bx, by, bw * shown, 14);
    ctx.fillStyle = INK;
    ctx.fillRect(bx, by, bw * real, 14);
    // インクの斜線で質感を出す
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw * real, 14);
    ctx.clip();
    ctx.strokeStyle = 'rgba(243,237,216,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -14; i < bw; i += 5) {
      ctx.moveTo(bx + i, by + 14);
      ctx.lineTo(bx + i + 14, by);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.strokeRect(bx, by, bw, 14);
    // HP の数字はバーの中に(縁取りでどちらの色の上でも読める)
    ctx.font = `900 10px ${NUM_FONT}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    const hpText = `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)}`;
    ctx.strokeText(hpText, 270, by + 7.5);
    ctx.fillStyle = CREAM;
    ctx.fillText(hpText, 270, by + 7.5);
    // 攻撃力は時計の下に
    ctx.fillStyle = INK;
    ctx.fillText(`威力 ${e.atk}`, 468, 197);
  }

  /** タイトル画面:寝ている怪獣と、今の時刻を指す時計 */
  private drawTitleRoom(t: number): void {
    const ctx = this.ctx;
    drawEnemy(ctx, this.sleeper, 270, 192, t * 0.5, true);
    ctx.save();
    ctx.fillStyle = INK;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.4 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI);
      ctx.font = `900 ${12 + p * 10}px ${NUM_FONT}`;
      ctx.fillText('z', 312 + p * 30 + Math.sin(p * 6) * 4, 92 - p * 40);
    }
    ctx.restore();
    const now = new Date();
    const h = (now.getHours() % 12) + now.getMinutes() / 60;
    const m = now.getMinutes() + now.getSeconds() / 60;
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    for (const [len, w, a] of [
      [20, 4, (h / 12) * Math.PI * 2],
      [32, 2.5, (m / 60) * Math.PI * 2],
    ] as Array<[number, number, number]>) {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(468, 112);
      ctx.lineTo(468 + Math.sin(a) * len, 112 - Math.cos(a) * len);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(468, 112, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /** ショット中の大きな数字(窓の空に浮かぶ、光る白い数字)。ペグより奥に描く */
  private drawReadout(g: Game): void {
    if (g.state !== 'shoot' && g.state !== 'resolve') return;
    const ctx = this.ctx;
    const pop = 1 + g.dmgPop * 0.18;
    ctx.save();
    ctx.translate(270, 312);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const txt = fmt(g.shotDamage);
    const size = txt.length > 9 ? 40 : 50;
    ctx.font = `900 ${size}px ${NUM_FONT}`;
    ctx.shadowColor = 'rgba(243,237,216,0.85)';
    ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(243,237,216,0.92)';
    ctx.fillText(txt, 0, 0);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(243,237,216,0.92)';
    ctx.lineWidth = 1.5;
    ctx.strokeText(txt, 0, 0);
    ctx.font = `800 12px ${FONT}`;
    ctx.fillStyle = 'rgba(243,237,216,0.7)';
    ctx.fillText('今回のダメージ', 0, size * 0.62);
    ctx.restore();
  }

  private drawPegs(pegs: Peg[], t: number): void {
    const ctx = this.ctx;
    for (const p of pegs) {
      if (!p.alive) continue;
      let sc = 1;
      if (p.spawn < 1) {
        if (p.spawn <= 0) continue;
        sc = backOut(p.spawn);
      }
      if (p.flash > 0) sc *= 1 + p.flash * 0.35;
      if (p.type === 'multi') sc *= 1 + Math.sin(t * 4 + p.id) * 0.03;
      const sp = this.pegSprite(p.type, p.r, Math.min(3, p.hp));
      const size = (p.r + 12) * sc;
      ctx.drawImage(sp, p.x - size, p.y - size, size * 2, size * 2);
      if (p.flash > 0) {
        ctx.globalAlpha = p.flash;
        ctx.fillStyle = CREAM;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * sc, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (p.type === 'multi') {
        ctx.font = `900 11px ${NUM_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = INK;
        ctx.fillText('×' + fmtMult(p.mult), p.x, p.y + 1);
      }
    }
  }

  private drawPrediction(g: Game): void {
    const ctx = this.ctx;
    const { pts, hitIndex } = g.prediction!;
    if (g.aim.cancel) {
      this.tag(W / 2, 330, 'ここで離すとキャンセル', { size: 13, dark: true });
      return;
    }
    ctx.save();
    const n = pts.length / 2;
    ctx.fillStyle = CREAM;
    for (let i = 1; i < n; i++) {
      const after = hitIndex >= 0 && i * 2 >= hitIndex;
      if (i % 2 && !after) continue;
      const k = 1 - i / n;
      ctx.globalAlpha = (after ? 0.35 : 0.95) * (0.35 + k * 0.65);
      ctx.beginPath();
      ctx.arc(pts[i * 2], pts[i * 2 + 1], after ? 2.2 : 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hitIndex >= 0) {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(pts[hitIndex], pts[hitIndex + 1], g.ballRadius() + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private drawBalls(balls: Ball[], fever: boolean, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (fever) {
      // 虹色の残像:色相を 12 段階・太さを 2 段階にまとめて、まとめて描く
      const buckets = new Map<number, number[]>();
      for (const b of balls) {
        const tr = b.trail;
        const segs = tr.length / 2 - 1;
        for (let i = 0; i < segs; i++) {
          const k = (i + 1) / segs;
          const hue = Math.floor(((b.hue + t * 400 + i * 28) % 360) / 30);
          const key = hue * 2 + (k > 0.5 ? 1 : 0);
          let arr = buckets.get(key);
          if (!arr) buckets.set(key, (arr = []));
          arr.push(tr[i * 2], tr[i * 2 + 1], tr[i * 2 + 2], tr[i * 2 + 3]);
        }
      }
      const r = balls.length ? balls[0].r : 8;
      for (const [key, arr] of buckets) {
        const thick = key % 2 === 1;
        // 虹色でも彩度を落として、セピアの世界から浮かないようにする
        ctx.strokeStyle = `hsl(${(key >> 1) * 30},55%,68%)`;
        ctx.globalAlpha = thick ? 0.5 : 0.25;
        ctx.lineWidth = r * (thick ? 1.2 : 0.7);
        ctx.beginPath();
        for (let i = 0; i < arr.length; i += 4) {
          ctx.moveTo(arr[i], arr[i + 1]);
          ctx.lineTo(arr[i + 2], arr[i + 3]);
        }
        ctx.stroke();
      }
    } else {
      // ふだんの軌跡:全部まとめて 1 回で描く
      ctx.strokeStyle = 'rgba(255,240,204,0.22)';
      ctx.lineWidth = (balls.length ? balls[0].r : 8) * 1.2;
      ctx.beginPath();
      for (const b of balls) {
        const tr = b.trail;
        if (tr.length < 4) continue;
        ctx.moveTo(tr[0], tr[1]);
        for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1]);
      }
      ctx.stroke();
    }
    ctx.restore();
    for (const b of balls) {
      const sp = this.ballSprite(b.r);
      const size = b.r + 14;
      ctx.drawImage(sp, b.x - size, b.y - size, size * 2, size * 2);
    }
  }

  private drawLauncher(g: Game, t: number): void {
    const ctx = this.ctx;
    const ang = g.aim.angle; // 0 = 真下
    const { x, y } = LAUNCHER;
    const recoil = g.launcherKick;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, BOARD.top + 2);
    ctx.lineTo(x, y - 10);
    ctx.stroke();
    ctx.save();
    ctx.translate(x - Math.sin(ang) * recoil * 6, y - Math.cos(ang) * recoil * 6);
    ctx.rotate(-ang);
    const on = g.state === 'aim' || g.state === 'shoot';
    if (on) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(0, 14, 2, 0, 30, 76);
      lg.addColorStop(0, `rgba(243,237,216,${0.32 + Math.sin(t * 5) * 0.05 + recoil * 0.35})`);
      lg.addColorStop(1, 'rgba(243,237,216,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(-14, 10);
      ctx.lineTo(14, 10);
      ctx.lineTo(56, 96);
      ctx.lineTo(-56, 96);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(8, -12);
    ctx.lineTo(22, 12);
    ctx.lineTo(-22, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = on ? COLORS.ball : COLORS.paper2;
    ctx.beginPath();
    ctx.arc(0, 14, 6, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** コンボ表示・ブースト・操作のヒント */
  private drawShotHud(g: Game, t: number): void {
    const ctx = this.ctx;
    const j = g.juice;
    if (j.combo > 1) {
      const c = j.combo;
      ctx.save();
      ctx.translate(96, 262);
      const pop = 1 + Math.max(0, j.comboTimer - 1.3) * 1.6;
      ctx.scale(pop, pop);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `900 26px ${NUM_FONT}`;
      ctx.fillStyle = CREAM;
      ctx.fillText(String(c), 0, 0);
      const w = ctx.measureText(String(c)).width;
      ctx.font = `900 10px ${NUM_FONT}`;
      ctx.fillStyle = 'rgba(243,237,216,0.7)';
      ctx.fillText('COMBO', w + 6, 4);
      if (j.fever) {
        ctx.fillStyle = COLORS.red;
        ctx.fillRect(w + 4, -14, 46, 13);
        ctx.fillStyle = CREAM;
        ctx.fillText('FEVER', w + 8, -7);
      } else {
        // フィーバーまでのゲージ(目盛りつき)
        ctx.fillStyle = 'rgba(243,237,216,0.18)';
        ctx.fillRect(0, 16, 90, 3);
        ctx.fillStyle = CREAM;
        ctx.fillRect(0, 16, 90 * Math.min(1, c / FEVER_COMBO), 3);
        for (let i = 1; i < 5; i++) ctx.fillRect((90 * i) / 5, 14, 1, 7);
      }
      ctx.restore();
    }
    if (g.boostArmed && g.state === 'aim') {
      const n = g.stats.ballsPerShot * 2;
      this.tag(372, 300, '今回 ×2 BALL', { size: 14, rot: -0.06, badge: String(n) });
    }
    if (g.state === 'aim' && !g.aim.active && g.shotsFired < 2) {
      const a = 0.75 + Math.sin(t * 4) * 0.25;
      this.tag(W / 2, 330, 'ドラッグで狙う ・ 離して発射', { size: 13, rot: 0.02, alpha: a });
    }
  }

  private drawResolve(g: Game): void {
    const ctx = this.ctx;
    const r = g.resolveAnim!;
    const p = Math.min(1, r.t / r.dur);
    const e = easeInOut(p);
    const x = 270;
    const y = 312 + (130 - 312) * e - Math.sin(p * Math.PI) * 40;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rad = 14 + Math.min(26, Math.log10(r.amount + 1) * 4);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.2);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.35, 'rgba(243,237,216,0.7)');
    gr.addColorStop(1, 'rgba(243,237,216,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, rad * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 大きな告知:text = 白い極太文字 / card = 紙のカード / stamp = 赤いハンコ */
  private drawBanner(g: Game): void {
    const b = g.juice.banner;
    if (!b) return;
    const ctx = this.ctx;
    const age = b.max - b.life;
    const inT = Math.min(1, age / 0.22);
    const outT = Math.min(1, b.life / 0.3);
    const a = Math.min(inT, outT);
    const y = 540;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const font = /^[\x20-\x7E]*$/.test(b.text) ? NUM_FONT : FONT;
    if (b.style === 'card') {
      const sc = 0.8 + backOut(inT) * 0.2;
      ctx.translate(W / 2, y - (1 - inT) * 40);
      ctx.rotate(b.rot);
      ctx.scale(sc, sc);
      const w = 300;
      const h = 150;
      ctx.fillStyle = INK;
      ctx.fillRect(-w / 2 + 6, -h / 2 + 7, w, h);
      ctx.fillStyle = PAPER;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.lineWidth = 1;
      ctx.strokeRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14);
      ctx.font = `900 54px ${font}`;
      ctx.fillStyle = INK;
      ctx.fillText(b.text, 0, -16);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.strokeText(b.text, 0, -16);
      if (b.sub) {
        ctx.font = `900 13px ${FONT}`;
        const tw = ctx.measureText(b.sub).width + 24;
        ctx.fillStyle = INK;
        ctx.fillRect(w / 2 - tw - 14, h / 2 - 44, tw, 28);
        ctx.fillStyle = CREAM;
        ctx.fillText(b.sub, w / 2 - 14 - tw / 2, h / 2 - 30);
      }
    } else if (b.style === 'stamp') {
      const sc = inT < 1 ? 1.8 - inT * 0.8 : 1;
      ctx.translate(W / 2, y);
      ctx.rotate(b.rot * 2);
      ctx.scale(sc, sc);
      ctx.font = `900 60px ${font}`;
      ctx.lineWidth = 12;
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.strokeText(b.text, 5, 6);
      ctx.fillText(b.text, 5, 6);
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) this.tag(0, 54, b.sub, { size: 13, dark: true });
    } else {
      const sc = 1.25 - easeInOut(inT) * 0.25;
      ctx.translate(W / 2, y);
      ctx.scale(sc, sc);
      ctx.font = `900 70px ${font}`;
      ctx.lineWidth = 12;
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      ctx.strokeText(b.text, 4, 5);
      ctx.fillText(b.text, 4, 5);
      ctx.strokeText(b.text, 0, 0);
      ctx.shadowColor = 'rgba(243,237,216,0.7)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.5;
      ctx.strokeText(b.text, 0, 0);
      if (b.sub) this.tag(0, 60, b.sub, { size: 14, rot: -0.03 });
    }
    ctx.restore();
  }

  /** 下の暗い帯:あなたの HP(目盛り)とボール数 */
  private drawBottom(g: Game): void {
    const ctx = this.ctx;
    const ratio = Math.max(0, g.hp / g.stats.maxHp);
    const y = 928;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `900 11px ${NUM_FONT}`;
    ctx.fillStyle = 'rgba(243,237,216,0.7)';
    ctx.fillText('HP', 16, y);
    const segs = 12;
    const sw = 11;
    const low = ratio < 0.3;
    for (let i = 0; i < segs; i++) {
      const filled = (i + 0.5) / segs <= ratio || (i === 0 && ratio > 0);
      const x = 40 + i * (sw + 2);
      if (filled) {
        ctx.fillStyle = low ? COLORS.red : CREAM;
        ctx.fillRect(x, y - 6, sw, 12);
      } else {
        ctx.strokeStyle = 'rgba(243,237,216,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y - 5.5, sw - 1, 11);
      }
    }
    ctx.font = `900 13px ${NUM_FONT}`;
    ctx.fillStyle = low ? COLORS.red : CREAM;
    ctx.fillText(`${Math.max(0, Math.ceil(g.hp))}`, 40 + segs * (sw + 2) + 6, y);
    const hpW = ctx.measureText(`${Math.max(0, Math.ceil(g.hp))}`).width;
    ctx.font = `900 10px ${NUM_FONT}`;
    ctx.fillStyle = 'rgba(243,237,216,0.5)';
    ctx.fillText(`/ ${g.stats.maxHp}`, 40 + segs * (sw + 2) + 10 + hpW, y + 1);
    const n = g.stats.ballsPerShot * (g.boostArmed ? 2 : 1);
    ctx.font = `800 11px ${FONT}`;
    ctx.fillStyle = 'rgba(243,237,216,0.6)';
    const alive = g.state === 'shoot' ? ` ・ 盤面に ${g.balls.length} 個` : '';
    ctx.fillText(`1 ショット ${n} 球${alive}`, 16, y + 20);
  }

  private drawHurt(t: number): void {
    const ctx = this.ctx;
    ctx.save();
    const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
    gr.addColorStop(0, 'rgba(200,57,43,0)');
    gr.addColorStop(1, `rgba(200,57,43,${0.45 * t})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function backOut(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
