// JuiceManager:爽快感(ゲームジュース)の司令塔。
// 衝突のたびに Game から呼ばれ、音・ヒットストップ・スロー・カメラシェイク・
// ネオン火花・飛び出す文字・フィーバーをまとめて起こす。

import type { AudioEngine } from './AudioEngine';
import { COMBO_TIMEOUT, FEVER_COMBO, W } from './constants';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  drag: number;
  grav: number;
}

interface FloatText {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
  big: boolean;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface Bolt {
  pts: number[];
  life: number;
  max: number;
  color: string;
}

interface Banner {
  text: string;
  sub: string;
  color: string;
  life: number;
  max: number;
}

const MAX_PARTICLES = 1100;
const MAX_TEXTS = 50;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class JuiceManager {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  rings: Ring[] = [];
  bolts: Bolt[] = [];
  banner: Banner | null = null;

  combo = 0;
  comboTimer = 0;
  bestCombo = 0;
  fever = false;
  feverT = 0;
  /** 画面全体のフラッシュ */
  flashColor = '#fff';
  flashA = 0;

  private hitStopMs = 0;
  private slowFactor = 1;
  private slowMs = 0;
  private shakeAmp = 0;
  private shakeT = 0;
  private shakeAng = 0;
  shakeX = 0;
  shakeY = 0;
  time = 0;
  /** 端末が重いとき true(パーティクルや文字を減らす)。Game がフレーム時間を見て切り替える */
  lowFx = false;

  private audio: AudioEngine;

  constructor(audio: AudioEngine) {
    this.audio = audio;
  }

  // ───────── 時間の流れ ─────────

  hitStop(ms: number): void {
    this.hitStopMs = Math.max(this.hitStopMs, Math.min(50, ms));
  }

  slowMo(factor: number, ms: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowMs = Math.max(this.slowMs, ms);
  }

  /** 実時間 dt(秒)からゲーム時間の倍率を返す(ヒットストップ中は 0) */
  timeScale(realDt: number): number {
    if (this.hitStopMs > 0) {
      this.hitStopMs -= realDt * 1000;
      return 0;
    }
    if (this.slowMs > 0) {
      this.slowMs -= realDt * 1000;
      if (this.slowMs <= 0) this.slowFactor = 1;
      return this.slowFactor;
    }
    return 1;
  }

  shake(power: number): void {
    this.shakeAmp = Math.min(34, this.shakeAmp + power);
    this.shakeAng = Math.random() * Math.PI * 2;
  }

  flash(color: string, a: number): void {
    // 連続で光っても画面が真っ白にならないよう、上限を決める
    if (this.flashA > 0.12 && a < 0.3) return;
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a);
  }

  // ───────── 生成 ─────────

  burst(x: number, y: number, color: string, count: number, speed = 420, size = 2.4): void {
    const room = MAX_PARTICLES - this.particles.length;
    if (room <= 0) return;
    // 画面がパーティクルで埋まってきたら数を減らす
    const load = this.particles.length / MAX_PARTICLES;
    const k = (load > 0.6 ? (1 - load) * 2.2 : 1) * (this.lowFx ? 0.4 : 1);
    const n = Math.min(room, Math.max(4, Math.round(count * k)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.25 + Math.random() * 0.9);
      const life = rand(0.35, 0.8);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.15,
        life, max: life,
        color,
        size: size * rand(0.6, 1.4),
        drag: 2.6,
        grav: 700,
      });
    }
  }

  text(x: number, y: number, text: string, color: string, size = 22, big = false): void {
    // 大きな文字が重なりすぎたら、古いものから消す
    if (big) {
      let bigCount = 0;
      for (const t of this.texts) if (t.big) bigCount++;
      if (bigCount >= 10) {
        const i = this.texts.findIndex((t) => t.big);
        if (i >= 0) this.texts.splice(i, 1);
      }
    }
    if (this.lowFx && !big && this.texts.length > 20) return;
    if (this.texts.length >= MAX_TEXTS) {
      if (!big) return;
      const i = this.texts.findIndex((t) => !t.big);
      if (i >= 0) this.texts.splice(i, 1);
      else this.texts.shift();
    }
    const life = big ? 1.1 : 0.75;
    this.texts.push({
      x, y,
      vx: rand(-60, 60),
      vy: big ? -120 : rand(-230, -160),
      text, color,
      size: Math.round(size),
      life, max: life,
      big,
    });
  }

  ring(x: number, y: number, maxR: number, color: string, width = 6, life = 0.45): void {
    this.rings.push({ x, y, r: 4, maxR, life, max: life, color, width });
  }

  bolt(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const pts: number[] = [x1, y1];
    const n = 7;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const off = (Math.random() - 0.5) * Math.min(38, len * 0.3);
      pts.push(x1 + dx * t + px * off, y1 + dy * t + py * off);
    }
    pts.push(x2, y2);
    this.bolts.push({ pts, life: 0.28, max: 0.28, color });
  }

  showBanner(text: string, sub: string, color: string, life = 1.4): void {
    this.banner = { text, sub, color, life, max: life };
  }

  // ───────── 衝突イベント ─────────

  /** コンボを 1 つ進める。音階が 1 段上がる */
  addCombo(x: number): number {
    this.combo++;
    this.comboTimer = COMBO_TIMEOUT;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.audio.comboNote(this.combo, (x / W) * 2 - 1);
    if (!this.fever && this.combo >= FEVER_COMBO) this.startFever();
    return this.combo;
  }

  pegHit(x: number, y: number, color: string, dmg: number, crit: boolean, destroyed: boolean): void {
    const c = this.combo;
    this.burst(x, y, color, destroyed ? rand(20, 40) : 12, destroyed ? 430 : 300);
    if (crit) {
      this.text(x, y - 14, `CRIT ${fmt(dmg)}!`, '#ff6b6b', 26, true);
      this.shake(5);
    } else {
      this.text(x, y - 10, `+${fmt(dmg)}`, color, 17 + Math.min(10, c * 0.12));
    }
    this.shake(1.2 + Math.min(6, c * 0.06));
  }

  wall(x: number, y: number, bonus: boolean): void {
    this.burst(x, y, '#f2ead0', 8, 220, 1.8);
    if (bonus) this.text(x + (x < W / 2 ? 30 : -30), y, 'WALL +20%', '#9dffcf', 15);
    this.audio.wall((x / W) * 2 - 1);
  }

  split(x: number, y: number, count: number): void {
    this.burst(x, y, '#44f2ff', 34, 520, 2.8);
    this.ring(x, y, 70, '#44f2ff', 5, 0.4);
    this.text(x, y - 20, count > 2 ? `SPLIT ×${count}!` : 'SPLIT!', '#44f2ff', 26, true);
    this.audio.split((x / W) * 2 - 1);
    this.shake(4);
  }

  explosion(x: number, y: number, radius: number): void {
    this.burst(x, y, '#ff3b4e', 40, 700, 3.4);
    this.burst(x, y, '#ffb347', 26, 480, 2.6);
    this.ring(x, y, radius, '#ff3b4e', 10, 0.5);
    this.ring(x, y, radius * 0.6, '#ffd36b', 5, 0.35);
    this.text(x, y - 24, 'BOOM!', '#ff3b4e', 34, true);
    this.flash('#ff6a4d', 0.14);
    this.hitStop(45);
    this.shake(13);
    this.audio.bomb(radius / 90);
  }

  multiplier(x: number, y: number, mult: number): void {
    const big = mult >= 2;
    this.burst(x, y, '#ffe14a', big ? 40 : 28, big ? 640 : 480, 3);
    this.ring(x, y, big ? 110 : 80, '#ffe14a', 8, 0.45);
    this.text(x, y - 30, `×${fmtMult(mult)}!`, '#ffe14a', big ? 44 : 36, true);
    this.audio.multiplier(mult);
    this.shake(big ? 10 : 6);
    if (big) {
      this.hitStop(40);
      this.slowMo(0.35, 260);
      this.flash('#ffe14a', 0.18);
    } else {
      this.hitStop(30);
    }
  }

  lightning(x: number, y: number): void {
    this.burst(x, y, '#b86bff', 24, 480, 2.4);
    this.ring(x, y, 60, '#d6a8ff', 4, 0.3);
    this.text(x, y - 22, 'ZAP!', '#c993ff', 28, true);
    this.audio.zap((x / W) * 2 - 1);
    this.shake(5);
    this.flash('#b86bff', 0.08);
  }

  startFever(): void {
    this.fever = true;
    this.feverT = 0;
    this.showBanner('FEVER!!', `${FEVER_COMBO} COMBO 突破 — ダメージ ×1.5`, '#ff6bd6', 1.6);
    this.flash('#ffffff', 0.35);
    this.shake(12);
    this.audio.feverStart();
    this.audio.setFever(true);
  }

  endShot(): void {
    this.combo = 0;
    this.comboTimer = 0;
    if (this.fever) {
      this.fever = false;
      this.audio.setFever(false);
    }
  }

  // ───────── 更新と描画 ─────────

  /** gameDt = スロー/倍速を反映した時間、realDt = 実時間 */
  update(gameDt: number, realDt: number): void {
    this.time += realDt;
    if (this.fever) this.feverT += gameDt;

    if (this.combo > 0) {
      this.comboTimer -= gameDt;
      if (this.comboTimer <= 0) this.combo = 0; // 途切れたら音階もリセット
    }

    // 減衰振動のカメラシェイク
    this.shakeT += realDt;
    this.shakeAmp *= Math.exp(-realDt * 7.5);
    if (this.shakeAmp < 0.05) this.shakeAmp = 0;
    const s = this.shakeAmp;
    this.shakeX = s * (Math.sin(this.shakeT * 61) * Math.cos(this.shakeAng) + (Math.random() - 0.5) * 0.4);
    this.shakeY = s * (Math.cos(this.shakeT * 53) * Math.sin(this.shakeAng) + (Math.random() - 0.5) * 0.4);

    this.flashA = Math.max(0, this.flashA - realDt * 1.8);

    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= gameDt;
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      const k = Math.exp(-p.drag * gameDt);
      p.vx *= k;
      p.vy = p.vy * k + p.grav * gameDt;
      p.x += p.vx * gameDt;
      p.y += p.vy * gameDt;
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= realDt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.vy += 380 * realDt;
      t.vx *= Math.exp(-3 * realDt);
      t.x += t.vx * realDt;
      t.y += t.vy * realDt * (t.big ? 0.5 : 1);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= gameDt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.max;
      r.r = r.maxR * (1 - Math.pow(1 - t, 3));
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= gameDt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }

    if (this.banner) {
      this.banner.life -= realDt;
      if (this.banner.life <= 0) this.banner = null;
    }
  }

  clearEffects(): void {
    this.particles.length = 0;
    this.texts.length = 0;
    this.rings.length = 0;
    this.bolts.length = 0;
  }

  /** パーティクル・リング・稲妻(加算合成で光らせる) */
  drawEffects(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    for (const r of this.rings) {
      const a = r.life / r.max;
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * a + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.25;
      ctx.lineWidth = r.width * 3 * a + 2;
      ctx.stroke();
    }

    // 火花:色と透明度ごとにまとめて 1 回で描く(速い)
    const buckets = new Map<string, Particle[]>();
    for (const p of this.particles) {
      const lv = Math.ceil((p.life / p.max) * 3);
      const key = p.color + '|' + lv;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = []));
      b.push(p);
    }
    for (const [key, list] of buckets) {
      const [color, lvs] = key.split('|');
      const a = Number(lvs) / 3;
      ctx.strokeStyle = color;
      // にじみ(数が多いときは省略して軽くする)
      if (this.particles.length < 600 && !this.lowFx) {
        ctx.globalAlpha = a * 0.28;
        ctx.lineWidth = 5;
        ctx.beginPath();
        for (const p of list) {
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        }
        ctx.stroke();
      }
      // 芯
      ctx.globalAlpha = a;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (const p of list) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
      }
      ctx.stroke();
    }

    for (const b of this.bolts) {
      const a = b.life / b.max;
      for (const [w, al, col] of [
        [12, 0.25, b.color],
        [5, 0.6, b.color],
        [2, 1, '#ffffff'],
      ] as Array<[number, number, string]>) {
        ctx.globalAlpha = a * al;
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(b.pts[0], b.pts[1]);
        for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** 飛び出す文字。フォント指定は大きさごとに 1 回だけにして、拡大は変形(scale)で行う(速い) */
  drawTexts(ctx: CanvasRenderingContext2D): void {
    if (this.texts.length === 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1d140c';
    // 新しい大きな文字だけ光らせる(影ぼかしは重いので数を絞る)
    let glowLeft = 4;
    let font = '';
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      const age = 1 - t.life / t.max;
      const pop = age < 0.25 ? 0.4 + elastic(age / 0.25) * 0.6 : 1;
      const f = `900 ${t.size}px ${FONT}`;
      if (f !== font) {
        ctx.font = f;
        font = f;
      }
      ctx.globalAlpha = t.life < 0.25 ? t.life / 0.25 : 1;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(pop, pop);
      ctx.lineWidth = Math.max(3, t.size * 0.2);
      ctx.strokeText(t.text, 0, 0);
      const glow = t.big && glowLeft > 0;
      if (glow) {
        glowLeft--;
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      if (glow) ctx.shadowBlur = 0;
      ctx.restore();
    }
    ctx.restore();
  }
}

export const FONT = `"Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", "Rounded Mplus 1c", "Yu Gothic UI", "Meiryo", system-ui, sans-serif`;

function elastic(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * (2 * Math.PI)) / 3) + 1;
}

/** 倍率の表示:2 → "2.0"、2.25 → "2.25" */
export function fmtMult(m: number): string {
  return Math.abs(m * 10 - Math.round(m * 10)) < 1e-6 ? m.toFixed(1) : m.toFixed(2);
}

export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 1e7) return Math.round(n).toLocaleString('en-US');
  // 小さい単位から試し、四捨五入で 1000 に届いたら次の単位へ(「1000.0M」を防ぐ)
  const tiers: Array<[number, string, number]> = [[1e6, 'M', 1], [1e9, 'B', 2], [1e12, 'T', 2]];
  for (const [base, unit, digits] of tiers) {
    const v = (n / base).toFixed(digits);
    if (Number(v) < 1000) return v + unit;
  }
  return n.toExponential(2).replace('+', '');
}
