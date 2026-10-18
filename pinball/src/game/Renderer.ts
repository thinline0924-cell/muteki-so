// Canvas への描画。背景(夜の部屋)は一度だけ別の Canvas に描いて使い回す。
// ネオンの光るペグも、色ごとに一度だけ描いた「スプライト」(使い回し用の小さな絵)を貼る。

import { BOARD, COLORS, FEVER_COMBO, FONT, H, LAUNCHER, NUM_FONT, PEG_COLOR, W, lineTarget, type PegType } from './constants';
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
  /** 窓の外の絵(星・街の線・明かり・影)。夜明けに合わせて重ね方を変える */
  private sky: {
    stars: HTMLCanvasElement;
    far: HTMLCanvasElement;
    city: HTMLCanvasElement;
    shadow: HTMLCanvasElement;
    lightsA: HTMLCanvasElement;
    lightsB: HTMLCanvasElement;
    clouds: HTMLCanvasElement[];
  } | null = null;
  private skyGrad: { key: number; g: CanvasGradient } | null = null;
  private sprites = new Map<string, HTMLCanvasElement>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  /** 省電力:解像度を 1 倍に落とす */
  lowRes = false;

  resize(cssW: number, cssH: number): void {
    const dpr = this.lowRes ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.scale = this.canvas.width / W;
    this.bg = null;
    this.sky = null;
    this.skyGrad = null;
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
    const size = r + 12 + Math.max(0, hp - 3) * 3.5;
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

    // 窓の中(空と街)は毎フレーム別に描くので、ここでは透明にしておく
    c.clearRect(BOARD.left - 6, BOARD.top, BOARD.right - BOARD.left + 12, BOARD.bottom - BOARD.top);

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

    // 上の壁:額縁(越えたライン数)
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
    // 上下の暗い帯(上は DOM のメニュー、下は残りショット表示の土台)
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

  private layer(): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const cv = document.createElement('canvas');
    cv.width = this.canvas.width;
    cv.height = this.canvas.height;
    const c = cv.getContext('2d')!;
    c.scale(this.scale, this.scale);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    return [cv, c];
  }

  /**
   * 窓の外の絵を、重ねる順に別々の透明な絵として作る。
   * 奥の街(低くて薄い)と手前の街(チョークの線画)の 2 層。屋上に給水塔・アンテナ・空の看板枠などの変化をつける。
   */
  private buildSky(): NonNullable<Renderer['sky']> {
    const sk = new Sketch(9031);
    const [stars, sc] = this.layer();
    for (let i = 0; i < 90; i++) {
      const big = sk.rnd() < 0.1;
      sc.fillStyle = `rgba(243,237,216,${0.06 + sk.rnd() * (big ? 0.5 : 0.28)})`;
      const sz = big ? 2 : 1.1;
      sc.fillRect(BOARD.left + sk.rnd() * (BOARD.right - BOARD.left), BOARD.top + sk.rnd() * 420, sz, sz);
    }

    const [far, fc] = this.layer();
    const [city, c] = this.layer();
    const [shadow, hc] = this.layer();
    const [lightsA, la] = this.layer();
    const [lightsB, lb] = this.layer();
    const base = BOARD.bottom - 2;
    const warm = 'rgba(240,214,150,0.55)';

    la.fillStyle = warm;
    lb.fillStyle = warm;
    // ── 奥の街:低い建物がぎっしり。塗りは空より少し暗く、上の縁だけ薄い線
    fc.fillStyle = 'rgba(14,11,8,0.55)';
    fc.strokeStyle = 'rgba(243,237,216,0.13)';
    fc.lineWidth = 1.2;
    let x = BOARD.left - 6;
    while (x < BOARD.right + 6) {
      const w = 16 + sk.rnd() * 30;
      const h = 60 + sk.rnd() * 110;
      fc.fillRect(x, base - h, w, h + 4);
      fc.beginPath();
      fc.moveTo(x, base - h);
      fc.lineTo(x + w, base - h);
      fc.stroke();
      // 遠くの小さな明かり
      for (let yy = base - h + 8; yy < base - 6; yy += 9) {
        for (let xx = x + 3; xx < x + w - 3; xx += 6) {
          const r = sk.rnd();
          if (r < 0.1) la.fillRect(xx, yy, 2, 2.5);
          else if (r < 0.16) lb.fillRect(xx, yy, 2, 2.5);
        }
      }
      x += w + 1 + sk.rnd() * 3;
    }

    // ── 手前の街:チョークの線画+屋上の変化。影(夜明け用)も同じ形で塗る
    const blds: Array<[number, number, number]> = [
      [30, 70, 120], [70, 50, 190], [118, 64, 140], [176, 40, 230], [214, 46, 160],
      [300, 54, 175], [352, 60, 120], [410, 44, 205], [452, 62, 150], [496, 30, 110],
    ];
    const tx = 262;
    const top = base - 330;
    c.strokeStyle = 'rgba(243,237,216,0.34)';
    c.lineWidth = 1.7;
    hc.fillStyle = '#16110c';
    hc.strokeStyle = '#16110c';
    hc.lineWidth = 2;
    c.beginPath();
    hc.beginPath();
    blds.forEach(([bx, w, h], i) => {
      const y0 = base - h;
      // 屋根の形:0 平ら / 1 段々 / 2 斜め
      const roof = i % 3;
      if (roof === 1) {
        sk.rect(c, bx, y0, w, h, 0.8);
        sk.rect(c, bx + w * 0.2, y0 - 16, w * 0.6, 16, 0.6);
        hc.rect(bx, y0, w, h + 4);
        hc.rect(bx + w * 0.2, y0 - 16, w * 0.6, 16);
      } else if (roof === 2) {
        sk.line(c, bx, base, bx, y0, 0.8);
        sk.line(c, bx, y0, bx + w, y0 - 14, 0.8);
        sk.line(c, bx + w, y0 - 14, bx + w, base, 0.8);
        hc.moveTo(bx, base + 4);
        hc.lineTo(bx, y0);
        hc.lineTo(bx + w, y0 - 14);
        hc.lineTo(bx + w, base + 4);
        hc.closePath();
      } else {
        sk.rect(c, bx, y0, w, h, 0.8);
        hc.rect(bx, y0, w, h + 4);
      }
      // 屋上の小物:給水塔 / アンテナ / 空の看板枠(文字は入れない)
      const prop = (i * 7) % 4;
      const ry = roof === 1 ? y0 - 16 : roof === 2 ? y0 - 7 : y0;
      if (prop === 0) {
        const cx = bx + w * 0.7;
        sk.rect(c, cx - 7, ry - 22, 14, 12, 0.4);
        sk.line(c, cx - 5, ry - 10, cx - 6, ry, 0.3);
        sk.line(c, cx + 5, ry - 10, cx + 6, ry, 0.3);
        hc.rect(cx - 7, ry - 22, 14, 22);
      } else if (prop === 1) {
        const cx = bx + w * 0.3;
        sk.line(c, cx, ry, cx, ry - 30, 0.3);
        sk.line(c, cx - 6, ry - 22, cx + 6, ry - 22, 0.3);
        hc.rect(cx - 1, ry - 30, 2, 30);
      } else if (prop === 2 && w > 45) {
        sk.rect(c, bx + 6, ry - 20, w - 12, 14, 0.5);
        sk.line(c, bx + 12, ry - 6, bx + 12, ry, 0.3);
        sk.line(c, bx + w - 12, ry - 6, bx + w - 12, ry, 0.3);
        hc.rect(bx + 6, ry - 20, w - 12, 14);
      }
      // 窓
      for (let yy = y0 + 14; yy < base - 12; yy += 20) {
        for (let xx = bx + 8; xx < bx + w - 8; xx += 14) {
          if (sk.rnd() < 0.4) {
            sk.rect(c, xx, yy, 5, 7, 0.3);
            const r = sk.rnd();
            if (r < 0.35) la.fillRect(xx, yy, 5, 7);
            else if (r < 0.6) lb.fillRect(xx, yy, 5, 7);
          }
        }
      }
    });
    // 電波塔
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
    // 電線(建物のあいだをたるんで渡る)
    for (const [x1, y1, x2, y2] of [[48, base - 96, 140, base - 110], [372, base - 100, 470, base - 118]]) {
      c.moveTo(x1, y1);
      c.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + 16, x2, y2);
    }
    c.stroke();
    hc.fill();
    hc.beginPath();
    hc.moveTo(tx - 26, base);
    hc.lineTo(tx - 8, top + 40);
    hc.lineTo(tx - 16, top + 40);
    hc.lineTo(tx - 16, top + 26);
    hc.lineTo(tx + 16, top + 26);
    hc.lineTo(tx + 16, top + 40);
    hc.lineTo(tx + 8, top + 40);
    hc.lineTo(tx + 26, base);
    hc.closePath();
    hc.fill();
    hc.fillRect(tx - 1, top - 20, 2, 46);

    // 雲(やわらかい楕円を重ねたもの)。横に流して使う
    const clouds: HTMLCanvasElement[] = [];
    for (let k = 0; k < 3; k++) {
      const cv = document.createElement('canvas');
      cv.width = 200;
      cv.height = 60;
      const x2 = cv.getContext('2d')!;
      for (let i = 0; i < 7; i++) {
        const cx = 30 + sk.rnd() * 140;
        const cy = 28 + (sk.rnd() - 0.5) * 14;
        const rx = 22 + sk.rnd() * 30;
        const g = x2.createRadialGradient(cx, cy, 2, cx, cy, rx);
        g.addColorStop(0, 'rgba(243,237,216,0.12)');
        g.addColorStop(1, 'rgba(243,237,216,0)');
        x2.fillStyle = g;
        x2.beginPath();
        x2.ellipse(cx, cy, rx * 1.3, rx * 0.26, 0, 0, Math.PI * 2);
        x2.fill();
      }
      clouds.push(cv);
    }
    return { stars, far, city, shadow, lightsA, lightsB, clouds };
  }

  /**
   * 空:夜の進み具合 p(0 = 真夜中 → 1 = 夜明け)で色が変わる。
   * 地平線から温かい光がにじみ、星と月が消え、街の窓の明かりが順に消え、最後に太陽が昇る。
   * 薄い雲が流れ、塔の赤い灯が点滅し、夜はときどき流れ星、夜明けには鳥が飛ぶ。
   * ペグが読めるよう、明るくなりすぎないセピアの範囲にとどめる。
   */
  private drawSky(p: number, t: number): void {
    const ctx = this.ctx;
    if (!this.sky) this.sky = this.buildSky();
    const L = BOARD.left - 6;
    const R = BOARD.right + 6;
    const T = BOARD.top;
    const B = BOARD.bottom;
    const key = Math.round(p * 120);
    if (!this.skyGrad || this.skyGrad.key !== key) {
      const top = mixStops(SKY_TOP, p);
      const bot = mixStops(SKY_BOTTOM, p);
      const g = ctx.createLinearGradient(0, T, 0, B);
      g.addColorStop(0, rgb(top));
      g.addColorStop(0.55, rgb(mix(top, bot, 0.3)));
      g.addColorStop(1, rgb(bot));
      this.skyGrad = { key, g };
    }
    ctx.fillStyle = this.skyGrad.g;
    ctx.fillRect(L, T, R - L, B - T);

    const sky = this.sky;
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T, R - L, B - T);
    ctx.clip();
    // 星(またたき)
    const starA = clamp01(1 - p * 1.4);
    if (starA > 0) {
      ctx.globalAlpha = starA * (0.85 + Math.sin(t * 1.3) * 0.15);
      ctx.drawImage(sky.stars, 0, 0, W, H);
    }
    // 流れ星:9 秒ごとに、半分くらいの確率で 1 本
    if (p < 0.55) {
      const k = Math.floor(t / 9);
      const h = hash(k);
      const local = t - k * 9 - h * 6;
      if (h < 0.55 && local > 0 && local < 0.7) {
        const sx = 120 + hash(k + 1) * 300;
        const sy = 270 + hash(k + 2) * 120;
        const q = local / 0.7;
        const hx = sx + q * 150;
        const hy = sy + q * 60;
        const lg = ctx.createLinearGradient(hx - 60, hy - 24, hx, hy);
        lg.addColorStop(0, 'rgba(243,237,216,0)');
        lg.addColorStop(1, `rgba(243,237,216,${0.8 * (1 - q) * (1 - p)})`);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(hx - 60, hy - 24);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }
    }
    const moonA = clamp01(1 - p * 1.15);
    if (moonA > 0) {
      const mx = 452 + p * 40;
      const my = 300 + p * 150;
      // 月のまわりのかすかな光
      const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 70);
      mg.addColorStop(0, `rgba(243,237,216,${0.1 * moonA})`);
      mg.addColorStop(1, 'rgba(243,237,216,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = mg;
      ctx.fillRect(mx - 70, my - 70, 140, 140);
      // 三日月:丸から、ずらした丸の部分を切り抜く
      ctx.save();
      ctx.beginPath();
      ctx.rect(mx - 20, my - 20, 40, 40);
      ctx.arc(mx + 7, my - 5, 14, 0, Math.PI * 2);
      ctx.clip('evenodd');
      ctx.globalAlpha = moonA * 0.9;
      ctx.fillStyle = COLORS.cream;
      ctx.beginPath();
      ctx.arc(mx, my, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 太陽:最後の 3 割で地平線から顔を出す
    if (p > 0.7) {
      const k = clamp01((p - 0.7) / 0.35);
      const sy = B - 30 - k * 150;
      ctx.globalAlpha = k;
      const g = ctx.createRadialGradient(330, sy, 10, 330, sy, 190);
      g.addColorStop(0, 'rgba(255,214,150,0.55)');
      g.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(L, T, R - L, B - T);
      ctx.fillStyle = '#f6d9a2';
      ctx.beginPath();
      ctx.arc(330, sy, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    // 流れる雲(夜明けには少し濃く、温かい色に見える)
    const cloudA = 0.55 + p * 0.6;
    for (let i = 0; i < sky.clouds.length; i++) {
      const span = R - L + 260;
      const cx = L - 200 + ((t * (5 + i * 3) + i * 230) % span);
      const cy = 300 + i * 70;
      ctx.globalAlpha = cloudA;
      ctx.drawImage(sky.clouds[i], cx, cy - 30, 200, 60);
    }
    // 夜明けの鳥:7 秒ごとに 2〜3 羽が横切る
    if (p > 0.7) {
      const k = Math.floor(t / 7);
      const local = (t - k * 7) / 7;
      const n = 2 + Math.floor(hash(k) * 2);
      ctx.globalAlpha = clamp01((p - 0.7) * 4);
      ctx.strokeStyle = '#1a140e';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const bx = L - 20 + local * (R - L + 40) + i * 18;
        const by = 340 + hash(k + 3) * 120 + i * 9 + Math.sin(t * 3 + i) * 3;
        const f = Math.sin(t * 12 + i * 2) * 3;
        ctx.moveTo(bx - 6, by - f);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + 6, by - f);
      }
      ctx.stroke();
    }
    // 奥の街 → 光を背にした手前の建物の影 → 手前の線画 → 窓の明かり(半分ずつ消えていく)
    ctx.globalAlpha = 1;
    ctx.drawImage(sky.far, 0, 0, W, H);
    const shadowA = clamp01((p - 0.2) * 1.2);
    if (shadowA > 0) {
      ctx.globalAlpha = shadowA * 0.92;
      ctx.drawImage(sky.shadow, 0, 0, W, H);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(sky.city, 0, 0, W, H);
    const la = clamp01(1 - (p - 0.25) / 0.4);
    const lb = clamp01(1 - (p - 0.55) / 0.4);
    if (la > 0) {
      ctx.globalAlpha = la;
      ctx.drawImage(sky.lightsA, 0, 0, W, H);
    }
    if (lb > 0) {
      ctx.globalAlpha = lb;
      ctx.drawImage(sky.lightsB, 0, 0, W, H);
    }
    // 塔のてっぺんの赤い灯(ゆっくり点滅。朝には消える)
    const beacon = clamp01(1 - p * 1.3) * (Math.sin(t * 2.2) > 0.2 ? 1 : 0.15);
    if (beacon > 0) {
      const by = BOARD.bottom - 2 - 330 - 22;
      ctx.globalAlpha = beacon;
      const bg = ctx.createRadialGradient(262, by, 1, 262, by, 12);
      bg.addColorStop(0, 'rgba(217,68,47,0.9)');
      bg.addColorStop(1, 'rgba(217,68,47,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(250, by - 12, 24, 24);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
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
    this.drawSky(g.nightP, j.time);
    ctx.drawImage(this.bg, 0, 0, W, H);
    // 夜明けが近づくと、部屋の壁にも朝の光が差す
    if (g.nightP > 0.4) {
      ctx.fillStyle = `rgba(255,196,130,${(g.nightP - 0.4) * 0.16})`;
      ctx.fillRect(0, 34, W, BOARD.top - 34);
    }

    const t = j.time;
    if (j.fever) this.drawFeverBg(ctx, t, j.feverT);

    this.drawHudPanels(g, t);
    // タイトルでは盤面を描かない(夜の窓だけを見せて、タイトルを読みやすく)
    const title = g.state === 'title';
    this.drawReadout(g);
    if (!title) this.drawPegs(g.pegs, t);
    if (g.state === 'aim' && g.aim.active && g.prediction) this.drawPrediction(g);
    this.drawBalls(g.balls, j.fever, t);
    if (!title) this.drawLauncher(g, t);
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
    const title = g.state === 'title';
    // 額縁:越えたライン数(タイトルでは最高記録)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.font = `900 11px ${NUM_FONT}`;
    ctx.fillText(title ? 'BEST LINE' : 'LINE', 72, 85);
    ctx.font = `900 40px ${NUM_FONT}`;
    ctx.fillText(String(title ? g.save.data.bestLine : g.line), 72, 116);

    if (title) {
      this.drawTitleRoom();
      return;
    }

    // 合計スコア(壁の真ん中)
    const best = g.save.data.bestScore;
    this.tag(270, 54, 'SCORE', { size: 11, dark: true });
    const txt = fmt(g.shownScore);
    ctx.save();
    ctx.translate(262, 100);
    ctx.font = `900 46px ${NUM_FONT}`;
    const w = ctx.measureText(txt).width;
    const fit = Math.min(1, 200 / w);
    const pop = 1 + g.scorePop * 0.15;
    ctx.scale(fit * pop, fit * pop);
    ctx.fillStyle = 'rgba(34,28,20,0.25)';
    ctx.fillText(txt, 3, 4);
    ctx.fillStyle = INK;
    ctx.fillText(txt, 0, 0);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeText(txt, 0, 0);
    ctx.restore();
    ctx.font = `900 11px ${NUM_FONT}`;
    if (best > 0 && g.score > best) {
      ctx.fillStyle = COLORS.red;
      ctx.fillText('自己ベスト更新中', 262, 140);
    } else {
      ctx.fillStyle = 'rgba(34,28,20,0.6)';
      ctx.fillText(`BEST ${fmt(best)}`, 262, 140);
    }


    // 時計:夜明けまでの残りショット
    const timed = !!g.mode.time;
    const left = timed ? Math.ceil(g.timeLeft) : g.shotsLeft;
    const danger = timed ? g.timeLeft <= 10 : left <= 1;
    const a = -Math.PI / 2 + Math.min(1, g.nightP) * Math.PI * 2;
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
    ctx.font = `900 ${left >= 100 ? 26 : 34}px ${NUM_FONT}`;
    ctx.fillText(String(left), 0, 3);
    ctx.restore();
    const label = timed
      ? left <= 0 ? '時間切れ' : `残り ${left} 秒`
      : danger ? (left === 1 ? 'ラスト 1 球' : '夜明け') : `夜明けまで ${left}`;
    this.tag(468, 172, label, { size: 11, dark: danger, rot: 0.03 });

    // 次のラインまでのバー(壁いっぱいの太いバー。中に「次のライン」と「あと いくつ」)
    const prev = g.line > 0 ? lineTarget(g.line - 1) : 0;
    const next = lineTarget(g.line);
    const ratio = Math.max(0, Math.min(1, (g.shownScore - prev) / (next - prev)));
    const remain = Math.max(0, next - g.shownScore);
    const close = ratio >= 0.85;
    const bx = 24;
    const bw = W - 48;
    const by = 192;
    const bh = 30;
    // ずらしたインクの影
    ctx.fillStyle = 'rgba(34,28,20,0.35)';
    ctx.fillRect(bx + 3, by + 4, bw, bh);
    ctx.fillStyle = COLORS.paper2;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = INK;
    ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw * ratio, bh);
    ctx.clip();
    ctx.strokeStyle = 'rgba(243,237,216,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -bh; i < bw; i += 6) {
      ctx.moveTo(bx + i, by + bh);
      ctx.lineTo(bx + i + bh, by);
    }
    ctx.stroke();
    ctx.restore();
    // 4 分の 1 ごとの目盛り
    ctx.strokeStyle = 'rgba(34,28,20,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const x = bx + (bw * i) / 4;
      ctx.moveTo(x, by + bh - 6);
      ctx.lineTo(x, by + bh);
    }
    ctx.stroke();
    // 枠(もうすぐ届くときは赤く脈打つ)
    const barPulse = close ? 0.5 + 0.5 * Math.sin(t * 8) : 0;
    ctx.strokeStyle = close ? `rgba(200,57,43,${0.6 + barPulse * 0.4})` : INK;
    ctx.lineWidth = close ? 3 + barPulse : 2.6;
    ctx.strokeRect(bx, by, bw, bh);
    // 文字:左に目標、右に残り。どちらの色の上でも読めるよう縁取り
    const cy = by + bh / 2 + 1;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.textAlign = 'left';
    ctx.font = `800 12px ${FONT}`;
    const nextLabel = '次のライン';
    ctx.strokeText(nextLabel, bx + 12, cy);
    ctx.fillStyle = CREAM;
    ctx.fillText(nextLabel, bx + 12, cy);
    const lw = ctx.measureText(nextLabel).width;
    ctx.font = `900 16px ${NUM_FONT}`;
    ctx.strokeText(fmt(next), bx + 20 + lw, cy);
    ctx.fillText(fmt(next), bx + 20 + lw, cy);
    ctx.textAlign = 'right';
    const rt = fmt(remain);
    ctx.font = `900 16px ${NUM_FONT}`;
    ctx.strokeText(rt, bx + bw - 12, cy);
    ctx.fillStyle = close ? '#ff8a76' : CREAM;
    ctx.fillText(rt, bx + bw - 12, cy);
    const rw = ctx.measureText(rt).width;
    ctx.font = `800 12px ${FONT}`;
    ctx.strokeText('あと', bx + bw - 18 - rw, cy);
    ctx.fillStyle = CREAM;
    ctx.fillText('あと', bx + bw - 18 - rw, cy);
    ctx.textAlign = 'center';
  }

  /** タイトル画面:今の時刻を指す時計 */
  private drawTitleRoom(): void {
    const ctx = this.ctx;
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
    ctx.fillText('今回のスコア', 0, size * 0.62);
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
      const hpShown = Math.min(5, p.hp);
      const sp = this.pegSprite(p.type, p.r, hpShown);
      const size = (p.r + 12 + Math.max(0, hpShown - 3) * 3.5) * sc;
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
        // 使い切ったバンパーは暗く。残り回数は下の点で
        if (p.charges <= 0) {
          ctx.fillStyle = 'rgba(20,15,10,0.6)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * sc + 1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.font = `900 11px ${NUM_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = p.charges > 0 ? INK : 'rgba(230,194,90,0.6)';
        ctx.fillText('×' + fmtMult(p.mult), p.x, p.y + 1);
        ctx.fillStyle = CREAM;
        const n = Math.min(p.charges, 6);
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.32;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * (p.r + 6), p.y + Math.sin(a) * (p.r + 6), 2, 0, Math.PI * 2);
          ctx.fill();
        }
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
    // 長いショットの早送り中は、小さな札で知らせる
    if (g.state === 'shoot' && g.ff > 1.05) {
      this.tag(W - 70, 252, `早送り ×${g.ff.toFixed(1)}`, { size: 12, dark: true });
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
    const y = 312 + (100 - 312) * e - Math.sin(p * Math.PI) * 40;
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
      // 長い見出しはカードに収まるよう縮める
      const fit = Math.min(1, (w - 44) / ctx.measureText(b.text).width);
      ctx.font = `900 ${Math.floor(54 * fit)}px ${font}`;
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

  /** 下の暗い帯:残りショット(目盛り)とボール数 */
  private drawBottom(g: Game): void {
    const ctx = this.ctx;
    const y = 928;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `900 11px ${NUM_FONT}`;
    ctx.fillStyle = 'rgba(243,237,216,0.7)';
    if (g.mode.time) {
      // 九十秒:残り時間のバー
      ctx.fillText('TIME', 16, y);
      const k = Math.max(0, Math.min(1, g.timeLeft / g.mode.time));
      const low = g.timeLeft <= 10;
      ctx.strokeStyle = 'rgba(243,237,216,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(58.5, y - 5.5, 160, 11);
      ctx.fillStyle = low ? COLORS.red : CREAM;
      ctx.fillRect(58, y - 6, 160 * k, 12);
      ctx.font = `900 13px ${NUM_FONT}`;
      ctx.fillText(`${Math.ceil(g.timeLeft)} 秒`, 226, y);
    } else {
      this.drawShotPips(g, y);
    }
    const n = g.stats.ballsPerShot * (g.boostArmed ? 2 : 1);
    ctx.font = `800 11px ${FONT}`;
    ctx.fillStyle = 'rgba(243,237,216,0.6)';
    const alive = g.state === 'shoot' ? ` ・ 盤面に ${g.balls.length} 個` : '';
    ctx.fillText(`1 ショット ${n} 球${alive}`, 16, y + 20);
  }

  private drawShotPips(g: Game, y: number): void {
    const ctx = this.ctx;
    const left = g.shotsLeft;
    ctx.fillText('SHOT', 16, y);
    const low = left <= 2;
    const shown = Math.min(left, 16);
    for (let i = 0; i < 16; i++) {
      const x = 58 + i * 10;
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, Math.PI * 2);
      if (i < shown) {
        ctx.fillStyle = low ? COLORS.red : CREAM;
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(243,237,216,0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.font = `900 13px ${NUM_FONT}`;
    ctx.fillStyle = low ? COLORS.red : CREAM;
    ctx.fillText(left > 16 ? `${left} (+${left - 16})` : String(left), 58 + 16 * 10 + 2, y);
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

type RGB = [number, number, number];

/** 空の色の段階(p = 0, 0.45, 0.75, 0.9, 1)。上は空のてっぺん、下は地平線 */
const SKY_TOP: Array<[number, RGB]> = [
  [0, [18, 15, 12]], [0.45, [26, 21, 20]], [0.75, [43, 34, 36]], [0.9, [61, 48, 46]], [1, [86, 68, 58]],
];
const SKY_BOTTOM: Array<[number, RGB]> = [
  [0, [42, 35, 26]], [0.45, [64, 45, 34]], [0.75, [118, 72, 48]], [0.9, [164, 100, 62]], [1, [205, 140, 82]],
];

function mix(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function mixStops(stops: Array<[number, RGB]>, p: number): RGB {
  const q = clamp01(p);
  for (let i = 1; i < stops.length; i++) {
    if (q <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      return mix(c0, c1, (q - p0) / (p1 - p0));
    }
  }
  return stops[stops.length - 1][1];
}

function rgb(c: RGB): string {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 時刻の区切り番号から、0〜1 の決まった値を作る(流れ星や鳥の出方に使う) */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
