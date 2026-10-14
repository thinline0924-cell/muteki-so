// Canvas への描画。背景(夜の部屋)は一度だけ別の Canvas に描いて使い回す。
// ネオンの光るペグも、色ごとに一度だけ描いた「スプライト」(使い回し用の小さな絵)を貼る。

import { drawEnemy, makeEnemy } from './Enemies';
import { BOARD, COLORS, FEVER_COMBO, H, LAUNCHER, PEG_COLOR, W, type PegType } from './constants';
import type { Game } from './Game';
import { FONT, fmt, fmtMult } from './JuiceManager';
import type { Ball, Peg } from './Physics';
import { Sketch } from './sketch';

const INK = COLORS.ink;

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

  private pegSprite(type: PegType, r: number, hp: number): HTMLCanvasElement {
    const color = PEG_COLOR[type];
    const size = r + 16;
    return this.sprite(`peg-${type}-${r}-${hp}`, size, (c) => {
      // にじむ光
      const g = c.createRadialGradient(0, 0, r * 0.4, 0, 0, size);
      g.addColorStop(0, hexA(color, 0.55));
      g.addColorStop(0.45, hexA(color, 0.18));
      g.addColorStop(1, hexA(color, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, size, 0, Math.PI * 2);
      c.fill();
      // 本体
      c.shadowColor = color;
      c.shadowBlur = 12;
      const core = c.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.5, color);
      core.addColorStop(1, hexA(color, 0.85));
      c.fillStyle = core;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      c.lineWidth = 1.6;
      c.strokeStyle = 'rgba(29,20,12,0.55)';
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      if (type === 'split') {
        c.moveTo(-r * 0.45, 0);
        c.lineTo(r * 0.45, 0);
        c.moveTo(0, -r * 0.45);
        c.lineTo(0, r * 0.45);
      } else if (type === 'bomb') {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          c.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
          c.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
        }
      } else if (type === 'lightning') {
        c.moveTo(r * 0.15, -r * 0.6);
        c.lineTo(-r * 0.25, r * 0.05);
        c.lineTo(r * 0.2, -r * 0.05);
        c.lineTo(-r * 0.15, r * 0.6);
      }
      c.stroke();
      if (type === 'multi') {
        c.lineWidth = 2.5;
        c.strokeStyle = 'rgba(29,20,12,0.6)';
        c.beginPath();
        c.arc(0, 0, r * 0.72, 0, Math.PI * 2);
        c.stroke();
      }
      // 耐久の輪
      for (let i = 1; i < hp; i++) {
        c.strokeStyle = '#ffb35c';
        c.shadowColor = '#ffb35c';
        c.shadowBlur = 6;
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, 0, r + 3 + (i - 1) * 3.5, 0, Math.PI * 2);
        c.stroke();
      }
    });
  }

  private ballSprite(r: number): HTMLCanvasElement {
    const size = r + 12;
    return this.sprite(`ball-${r.toFixed(1)}`, size, (c) => {
      const g = c.createRadialGradient(0, 0, r * 0.5, 0, 0, size);
      g.addColorStop(0, 'rgba(255,248,226,0.6)');
      g.addColorStop(1, 'rgba(255,248,226,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, size, 0, Math.PI * 2);
      c.fill();
      const core = c.createRadialGradient(-r * 0.35, -r * 0.35, 0, 0, 0, r);
      core.addColorStop(0, '#ffffff');
      core.addColorStop(0.6, COLORS.ball);
      core.addColorStop(1, '#d9cfa6');
      c.fillStyle = core;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(58,42,28,0.7)';
      c.lineWidth = 1.4;
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

    // 壁
    const wall = c.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#b7b37b');
    wall.addColorStop(1, '#a29e65');
    c.fillStyle = wall;
    c.fillRect(0, 0, W, H);
    // 壁の小さな点(紙の質感)
    c.fillStyle = 'rgba(58,42,28,0.06)';
    for (let i = 0; i < 900; i++) c.fillRect(sk.rnd() * W, sk.rnd() * BOARD.top, 1.5, 1.5);

    // 夜の窓(盤面)
    const night = c.createLinearGradient(0, BOARD.top, 0, BOARD.bottom);
    night.addColorStop(0, '#1d130c');
    night.addColorStop(0.7, '#2c1e13');
    night.addColorStop(1, '#3a2819');
    c.fillStyle = night;
    c.fillRect(BOARD.left - 6, BOARD.top, BOARD.right - BOARD.left + 12, BOARD.bottom - BOARD.top);
    // 星
    for (let i = 0; i < 70; i++) {
      c.fillStyle = `rgba(242,234,208,${0.08 + sk.rnd() * 0.25})`;
      const s = sk.rnd() < 0.15 ? 2 : 1.2;
      c.fillRect(BOARD.left + sk.rnd() * (BOARD.right - BOARD.left), BOARD.top + sk.rnd() * 420, s, s);
    }
    // 街の線画(チョークのような線)
    c.save();
    c.strokeStyle = 'rgba(242,234,208,0.22)';
    c.lineWidth = 1.6;
    c.beginPath();
    const base = BOARD.bottom - 2;
    const blds: Array<[number, number, number]> = [
      [30, 70, 120], [70, 50, 190], [118, 64, 140], [176, 40, 230], [214, 46, 160],
      [300, 54, 175], [352, 60, 120], [410, 44, 205], [452, 62, 150], [496, 30, 110],
    ];
    for (const [x, w, h] of blds) {
      sk.rect(c, x, base - h, w, h, 0.8);
      // 窓
      for (let yy = base - h + 14; yy < base - 12; yy += 20) {
        for (let xx = x + 8; xx < x + w - 8; xx += 14) {
          if (sk.rnd() < 0.45) sk.rect(c, xx, yy, 5, 7, 0.3);
        }
      }
    }
    // 電波塔(放射状の光つき)
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
    c.stroke();
    c.strokeStyle = 'rgba(242,234,208,0.34)';
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k - 4.5) * 0.3;
      sk.line(c, tx + Math.cos(a) * 26, top - 22 + Math.sin(a) * 26, tx + Math.cos(a) * 42, top - 22 + Math.sin(a) * 42, 0.3);
    }
    c.stroke();
    c.restore();

    // 窓枠のサッシ(うっすら)
    c.strokeStyle = 'rgba(242,234,208,0.08)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(W / 2, BOARD.top + 70);
    c.lineTo(W / 2, BOARD.bottom);
    c.moveTo(BOARD.left, 590);
    c.lineTo(BOARD.right, 590);
    c.stroke();

    // カーテン(左右の壁)
    this.drawCurtain(c, sk, 0, BOARD.left, false);
    this.drawCurtain(c, sk, BOARD.right, W - BOARD.right, true);

    // カーテンレール
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.beginPath();
    sk.line(c, -4, BOARD.top - 2, W + 4, BOARD.top - 2, 0.6);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    sk.line(c, 0, BOARD.top + 4, W, BOARD.top + 4, 0.6);
    c.stroke();

    // 床(ランプの光が当たっている)
    const floor = c.createLinearGradient(0, BOARD.bottom, 0, H);
    floor.addColorStop(0, '#e6e1a1');
    floor.addColorStop(1, '#cfca88');
    c.fillStyle = floor;
    c.fillRect(0, BOARD.bottom, W, H - BOARD.bottom);
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    c.beginPath();
    sk.line(c, -4, BOARD.bottom, W + 4, BOARD.bottom, 0.8);
    c.stroke();

    // 上の壁:棚・額縁・時計
    // 額縁(Wave 表示)
    c.fillStyle = '#ddd79f';
    c.fillRect(20, 62, 104, 84);
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.beginPath();
    sk.rect(c, 20, 62, 104, 84, 1);
    sk.rect(c, 28, 70, 88, 68, 0.8);
    c.stroke();
    c.lineWidth = 1.5;
    c.beginPath();
    sk.line(c, 72, 50, 32, 62, 0.4);
    sk.line(c, 72, 50, 112, 62, 0.4);
    c.stroke();
    // 時計(攻撃カウントダウン)
    c.fillStyle = '#ece5b5';
    c.beginPath();
    c.arc(468, 112, 46, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 3.5;
    c.beginPath();
    sk.ellipse(c, 468, 112, 46, 46, 1);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.moveTo(468 + Math.cos(a) * 38, 112 + Math.sin(a) * 38);
      c.lineTo(468 + Math.cos(a) * 42, 112 + Math.sin(a) * 42);
    }
    c.stroke();
    // 棚板(敵が立つ場所)
    c.fillStyle = '#c9c48b';
    c.fillRect(150, 192, 240, 12);
    c.lineWidth = 3;
    c.beginPath();
    sk.rect(c, 150, 192, 240, 12, 0.8);
    sk.line(c, 176, 204, 182, 226, 0.5);
    sk.line(c, 364, 204, 358, 226, 0.5);
    c.stroke();
    return cv;
  }

  private drawCurtain(c: CanvasRenderingContext2D, sk: Sketch, x: number, w: number, right: boolean): void {
    c.fillStyle = '#9f9b62';
    c.fillRect(x, BOARD.top, w, BOARD.bottom - BOARD.top);
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.beginPath();
    const edge = right ? x : x + w;
    sk.line(c, edge, BOARD.top, edge, BOARD.bottom, 1.2);
    c.stroke();
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(58,42,28,0.6)';
    c.beginPath();
    for (let i = 1; i < 3; i++) {
      const fx = x + (w * i) / 3;
      sk.line(c, fx, BOARD.top + 10, fx + (sk.rnd() - 0.5) * 4, BOARD.bottom - 6, 1.4);
    }
    c.stroke();
    // タッセル(留め紐)
    c.fillStyle = '#c9c48b';
    c.strokeStyle = INK;
    c.lineWidth = 2.5;
    c.beginPath();
    c.roundRect(x - 2, 520, w + 4, 14, 5);
    c.fill();
    c.stroke();
  }

  // ───────── 毎フレームの描画 ─────────

  draw(g: Game): void {
    const ctx = this.ctx;
    const j = g.juice;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.bg) this.bg = this.buildBackground();
    // シェイクではみ出た部分が見えないよう、まず暗い色で塗る
    ctx.fillStyle = '#1d140c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.scale;
    ctx.setTransform(s, 0, 0, s, j.shakeX * s, j.shakeY * s);
    ctx.drawImage(this.bg, 0, 0, W, H);

    const t = j.time;
    if (j.fever) this.drawFeverBg(ctx, t, j.feverT);

    this.drawHudPanels(g, t);
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
    ctx.globalAlpha = (0.2 + pulse * 0.18) * fade;
    ctx.drawImage(this.glowSprite(hi), BOARD.left - 120, 300, BOARD.right - BOARD.left + 240, 560);
    // 走る光の帯
    ctx.globalAlpha = 0.07 * fade;
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
    ctx.font = `800 13px ${FONT}`;
    ctx.fillText(!e ? 'BEST WAVE' : e.boss ? 'BOSS WAVE' : 'WAVE', 72, 86);
    ctx.font = `900 40px ${FONT}`;
    ctx.fillStyle = e?.boss ? COLORS.blood : INK;
    ctx.fillText(String(e ? g.wave : g.save.data.bestWave), 72, 117);

    if (!e) {
      this.drawTitleRoom(t);
      return;
    }
    // 敵
    drawEnemy(ctx, e, 270, 192, t);

    // 時計:攻撃までの残りショット数
    const cd = e.countdown;
    const danger = cd <= 1;
    const a = -Math.PI / 2 + (1 - cd / e.maxCountdown) * Math.PI * 2;
    ctx.strokeStyle = danger ? COLORS.blood : INK;
    ctx.lineWidth = 3;
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
    ctx.font = `900 34px ${FONT}`;
    ctx.fillText(String(cd), 0, 4);
    ctx.restore();
    ctx.font = `800 12px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText('攻撃まで', 468, 172);

    // 敵の名前と HP バー
    ctx.font = `800 13px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(e.name, 270, 60);
    const bx = 150;
    const bw = 240;
    const by = 208;
    ctx.fillStyle = '#efe9bd';
    ctx.fillRect(bx, by, bw, 16);
    const shown = Math.max(0, e.shownHp / e.maxHp);
    const real = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#fff6d8';
    ctx.fillRect(bx, by, bw * shown, 16);
    ctx.fillStyle = COLORS.blood;
    ctx.fillRect(bx, by, bw * real, 16);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, 16);
    ctx.font = `800 11px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#efe9bd';
    const hpText = `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)}`;
    ctx.strokeText(hpText, 270, by + 8.5);
    ctx.fillText(hpText, 270, by + 8.5);
    // 攻撃力
    ctx.textAlign = 'left';
    ctx.font = `800 11px ${FONT}`;
    ctx.fillText(`ATK ${e.atk}`, 396, 216);
    ctx.textAlign = 'center';
  }

  /** タイトル画面:寝ている怪獣と、今の時刻を指す時計 */
  private drawTitleRoom(t: number): void {
    const ctx = this.ctx;
    drawEnemy(ctx, this.sleeper, 270, 192, t * 0.5, true);
    ctx.save();
    ctx.font = `900 16px ${FONT}`;
    ctx.fillStyle = INK;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.4 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(p * Math.PI);
      ctx.font = `900 ${12 + p * 10}px ${FONT}`;
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
      if (p.type === 'multi') sc *= 1 + Math.sin(t * 4 + p.id) * 0.04;
      const sp = this.pegSprite(p.type, p.r, Math.min(3, p.hp));
      const size = (p.r + 16) * sc;
      ctx.drawImage(sp, p.x - size, p.y - size, size * 2, size * 2);
      if (p.flash > 0) {
        ctx.globalAlpha = p.flash;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * sc, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (p.type === 'multi') {
        ctx.font = `900 12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#2a1c12';
        ctx.fillText('×' + fmtMult(p.mult), p.x, p.y + 1);
      }
    }
  }

  private drawPrediction(g: Game): void {
    const ctx = this.ctx;
    const { pts, hitIndex } = g.prediction!;
    if (g.aim.cancel) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 16px ${FONT}`;
      ctx.fillStyle = '#efe9bd';
      ctx.fillText('ここで離すとキャンセル', W / 2, 318);
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = pts.length / 2;
    for (let i = 1; i < n; i++) {
      const after = hitIndex >= 0 && i * 2 >= hitIndex;
      if (i % 2 && !after) continue;
      const k = 1 - i / n;
      ctx.globalAlpha = (after ? 0.35 : 0.9) * (0.35 + k * 0.65);
      ctx.fillStyle = after ? '#ffe9b0' : '#fff6dc';
      ctx.beginPath();
      ctx.arc(pts[i * 2], pts[i * 2 + 1], after ? 2.6 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hitIndex >= 0) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#fff6dc';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(pts[hitIndex], pts[hitIndex + 1], g.ballRadius(), 0, Math.PI * 2);
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
        ctx.strokeStyle = `hsl(${(key >> 1) * 30},100%,62%)`;
        ctx.globalAlpha = thick ? 0.85 : 0.45;
        ctx.lineWidth = r * (thick ? 1.6 : 0.9);
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
      const size = b.r + 12;
      ctx.drawImage(sp, b.x - size, b.y - size, size * 2, size * 2);
    }
  }

  private drawLauncher(g: Game, t: number): void {
    const ctx = this.ctx;
    const ang = g.aim.angle; // 0 = 真下
    const { x, y } = LAUNCHER;
    const recoil = g.launcherKick;
    // コード
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, BOARD.top + 4);
    ctx.lineTo(x, y - 10);
    ctx.stroke();
    ctx.save();
    ctx.translate(x - Math.sin(ang) * recoil * 6, y - Math.cos(ang) * recoil * 6);
    ctx.rotate(-ang);
    // ランプの光
    const on = g.state === 'aim' || g.state === 'shoot';
    if (on) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(0, 14, 2, 0, 30, 70);
      lg.addColorStop(0, `rgba(255,240,190,${0.45 + Math.sin(t * 5) * 0.08 + recoil * 0.4})`);
      lg.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(-14, 10);
      ctx.lineTo(14, 10);
      ctx.lineTo(54, 90);
      ctx.lineTo(-54, 90);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // かさ
    ctx.fillStyle = '#ece5b5';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(8, -12);
    ctx.lineTo(22, 12);
    ctx.lineTo(-22, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 電球
    ctx.fillStyle = on ? '#fff8e2' : '#d9d2b0';
    ctx.beginPath();
    ctx.arc(0, 14, 6, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawShotHud(g: Game, t: number): void {
    const ctx = this.ctx;
    const j = g.juice;
    ctx.textBaseline = 'middle';
    if (g.state === 'shoot' || g.state === 'resolve') {
      // 総ダメージ
      const dmg = g.shotDamage;
      const pop = 1 + g.dmgPop * 0.35;
      ctx.save();
      ctx.translate(448, 282);
      ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      ctx.font = `800 11px ${FONT}`;
      ctx.fillStyle = '#efe9bd';
      ctx.fillText('SHOT DAMAGE', 0, -18);
      ctx.font = `900 28px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1d140c';
      const txt = fmt(dmg);
      ctx.strokeText(txt, 0, 6);
      ctx.shadowColor = '#ffe14a';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffe14a';
      ctx.fillText(txt, 0, 6);
      ctx.restore();
    }
    if (j.combo > 1) {
      const c = j.combo;
      const fever = j.fever;
      const col = fever ? `hsl(${(t * 300) % 360},100%,65%)` : c >= FEVER_COMBO * 0.6 ? '#ff9bd6' : '#fff0cc';
      ctx.save();
      ctx.translate(92, 282);
      const pop = 1 + Math.max(0, j.comboTimer - 1.3) * 2;
      ctx.scale(pop, pop);
      ctx.textAlign = 'center';
      ctx.font = `900 30px ${FONT}`;
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1d140c';
      ctx.strokeText(String(c), 0, 4);
      ctx.shadowColor = col;
      ctx.shadowBlur = 14;
      ctx.fillStyle = col;
      ctx.fillText(String(c), 0, 4);
      ctx.shadowBlur = 0;
      ctx.font = `800 11px ${FONT}`;
      ctx.fillStyle = '#efe9bd';
      ctx.fillText(fever ? 'FEVER COMBO' : 'COMBO', 0, -18);
      // フィーバーまでのゲージ
      if (!fever) {
        ctx.fillStyle = 'rgba(239,233,189,0.25)';
        ctx.fillRect(-34, 24, 68, 4);
        ctx.fillStyle = '#ff9bd6';
        ctx.fillRect(-34, 24, 68 * Math.min(1, c / FEVER_COMBO), 4);
      }
      ctx.restore();
    }
    if (g.boostArmed && g.state === 'aim') {
      ctx.textAlign = 'center';
      ctx.font = `900 14px ${FONT}`;
      ctx.fillStyle = '#44f2ff';
      ctx.shadowColor = '#44f2ff';
      ctx.shadowBlur = 10;
      ctx.fillText('BOOST ×2 BALL', LAUNCHER.x, LAUNCHER.y + 50);
      ctx.shadowBlur = 0;
    }
    if (g.state === 'aim' && !g.aim.active && g.shotsFired < 2) {
      ctx.textAlign = 'center';
      ctx.font = `800 15px ${FONT}`;
      ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.3;
      ctx.fillStyle = '#fff0cc';
      ctx.fillText('ドラッグで狙って、指を離すと発射', W / 2, 318);
      ctx.globalAlpha = 1;
    }
  }

  private drawResolve(g: Game): void {
    const ctx = this.ctx;
    const r = g.resolveAnim!;
    const p = Math.min(1, r.t / r.dur);
    const e = easeInOut(p);
    const x = 448 + (270 - 448) * e;
    const y = 282 + (130 - 282) * e - Math.sin(p * Math.PI) * 90;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rad = 16 + Math.min(30, Math.log10(r.amount + 1) * 5);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.2);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.3, 'rgba(255,225,74,0.8)');
    gr.addColorStop(1, 'rgba(255,90,60,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(x, y, rad * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBanner(g: Game): void {
    const b = g.juice.banner;
    if (!b) return;
    const ctx = this.ctx;
    const age = b.max - b.life;
    const inT = Math.min(1, age / 0.25);
    const outT = Math.min(1, b.life / 0.3);
    const a = Math.min(inT, outT);
    const y = 560;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(29,20,12,0.82)';
    const hh = 46 * backOut(inT);
    ctx.fillRect(0, y - hh, W, hh * 2);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y - hh);
    ctx.lineTo(W, y - hh);
    ctx.moveTo(0, y + hh);
    ctx.lineTo(W, y + hh);
    ctx.stroke();
    const sc = 0.6 + backOut(inT) * 0.4;
    ctx.translate(W / 2 + (1 - inT) * -80, y);
    ctx.scale(sc, sc);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 46px ${FONT}`;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, 0, b.sub ? -8 : 0);
    ctx.shadowBlur = 0;
    if (b.sub) {
      ctx.font = `800 15px ${FONT}`;
      ctx.fillStyle = '#efe9bd';
      ctx.fillText(b.sub, 0, 28);
    }
    ctx.restore();
  }

  private drawBottom(g: Game): void {
    const ctx = this.ctx;
    // プレイヤーの HP
    const x = 18;
    const y = 926;
    const w = 200;
    const ratio = Math.max(0, g.hp / g.stats.maxHp);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `900 13px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText('あなた', x, y - 1);
    const bx = x + 50;
    ctx.fillStyle = '#efe9bd';
    ctx.fillRect(bx, y - 8, w - 50, 16);
    ctx.fillStyle = ratio < 0.3 ? COLORS.blood : '#7fae5a';
    ctx.fillRect(bx, y - 8, (w - 50) * ratio, 16);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx, y - 8, w - 50, 16);
    ctx.font = `800 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.fillText(`${Math.max(0, Math.ceil(g.hp))} / ${g.stats.maxHp}`, bx + (w - 50) / 2, y + 0.5);
    // ボール数
    ctx.textAlign = 'left';
    ctx.font = `900 14px ${FONT}`;
    const n = g.stats.ballsPerShot * (g.boostArmed ? 2 : 1);
    ctx.fillText(`● ×${n}`, x, y + 22);
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = 'rgba(58,42,28,0.75)';
    const alive = g.state === 'shoot' ? `  場に ${g.balls.length} 個` : '';
    ctx.fillText(`ボール/ショット${alive}`, x + 56, y + 22);
  }

  private drawHurt(t: number): void {
    const ctx = this.ctx;
    ctx.save();
    const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
    gr.addColorStop(0, 'rgba(216,66,58,0)');
    gr.addColorStop(1, `rgba(216,66,58,${0.55 * t})`);
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
