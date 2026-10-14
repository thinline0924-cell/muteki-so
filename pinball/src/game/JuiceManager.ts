// JuiceManager:爽快感(ゲームジュース)の司令塔。
// 衝突のたびに Game から呼ばれ、音・ヒットストップ・スロー・カメラシェイク・
// 火花・飛び出す文字・フィーバーをまとめて起こす。
//
// 見た目の約束:文字はクリーム白の極太+インクの縁取り。赤は「強調・大事なとき」だけ。

import type { AudioEngine } from './AudioEngine';
import { COLORS, COMBO_TIMEOUT, FEVER_COMBO, FONT, NUM_FONT, W } from './constants';

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

/** pop = 小さな数字 / big = 目立つ文字 / stamp = 赤いハンコのように叩きつける文字 */
type TextKind = 'pop' | 'big' | 'stamp';

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
  kind: TextKind;
  rot: number;
  font: string;
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

/** text = 白い極太文字+紙のタグ / card = 紙のカード / stamp = 赤いハンコ */
export type BannerStyle = 'text' | 'card' | 'stamp';

export interface Banner {
  text: string;
  sub: string;
  color: string;
  life: number;
  max: number;
  style: BannerStyle;
  rot: number;
}

const MAX_PARTICLES = 1100;
const MAX_TEXTS = 50;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const isAscii = (s: string) => /^[\x20-\x7E×→]*$/.test(s);

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

  text(x: number, y: number, text: string, color: string, size = 22, big = false, stamp = false): void {
    const kind: TextKind = stamp ? 'stamp' : big ? 'big' : 'pop';
    // 大きな文字が重なりすぎたら、古いものから消す
    if (kind !== 'pop') {
      let bigCount = 0;
      for (const t of this.texts) if (t.kind !== 'pop') bigCount++;
      if (bigCount >= 9) {
        const i = this.texts.findIndex((t) => t.kind === 'big');
        if (i >= 0) this.texts.splice(i, 1);
      }
    }
    if (this.lowFx && kind === 'pop' && this.texts.length > 20) return;
    if (this.texts.length >= MAX_TEXTS) {
      if (kind === 'pop') return;
      const i = this.texts.findIndex((t) => t.kind === 'pop');
      if (i >= 0) this.texts.splice(i, 1);
      else this.texts.shift();
    }
    const life = kind === 'stamp' ? 1.3 : kind === 'big' ? 1.0 : 0.7;
    this.texts.push({
      x, y,
      vx: kind === 'pop' ? rand(-50, 50) : 0,
      vy: kind === 'stamp' ? 0 : kind === 'big' ? -70 : rand(-210, -150),
      text, color,
      size: Math.round(size),
      life, max: life,
      kind,
      rot: kind === 'stamp' ? rand(-0.2, -0.08) : kind === 'big' ? rand(-0.1, 0.1) : 0,
      font: isAscii(text) ? NUM_FONT : FONT,
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

  showBanner(text: string, sub: string, color: string, life = 1.4, style: BannerStyle = 'text'): void {
    this.banner = { text, sub, color, life, max: life, style, rot: style === 'text' ? 0 : rand(-0.06, -0.02) };
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
      this.text(x, y - 14, `CRIT ${fmt(dmg)}`, COLORS.red, 24, true);
      this.shake(5);
    } else {
      this.text(x, y - 10, `+${fmt(dmg)}`, COLORS.cream, 15 + Math.min(9, c * 0.1));
    }
    this.shake(1.2 + Math.min(6, c * 0.06));
  }

  wall(x: number, y: number, bonus: boolean): void {
    this.burst(x, y, COLORS.cream, 8, 220, 1.8);
    if (bonus) this.text(x + (x < W / 2 ? 34 : -34), y, '+20%', COLORS.cream, 14);
    this.audio.wall((x / W) * 2 - 1);
  }

  split(x: number, y: number, count: number): void {
    this.burst(x, y, COLORS.split, 34, 520, 2.8);
    this.ring(x, y, 70, COLORS.split, 4, 0.4);
    this.text(x, y - 20, count > 2 ? `SPLIT ×${count}` : 'SPLIT', COLORS.cream, 24, true);
    this.audio.split((x / W) * 2 - 1);
    this.shake(4);
  }

  explosion(x: number, y: number, radius: number): void {
    this.burst(x, y, COLORS.bomb, 40, 700, 3.4);
    this.burst(x, y, COLORS.cream, 22, 480, 2.4);
    this.ring(x, y, radius, COLORS.bomb, 8, 0.5);
    this.ring(x, y, radius * 0.6, COLORS.cream, 3, 0.35);
    this.text(x, y - 24, 'BOOM', COLORS.red, 32, true);
    this.flash(COLORS.cream, 0.12);
    this.hitStop(45);
    this.shake(13);
    this.audio.bomb(radius / 90);
  }

  multiplier(x: number, y: number, mult: number): void {
    const big = mult >= 2;
    this.burst(x, y, COLORS.multi, big ? 40 : 28, big ? 640 : 480, 3);
    this.ring(x, y, big ? 110 : 80, COLORS.multi, 6, 0.45);
    this.text(x, y - 30, `×${fmtMult(mult)}!`, COLORS.cream, big ? 46 : 36, true);
    this.audio.multiplier(mult);
    this.shake(big ? 10 : 6);
    if (big) {
      this.hitStop(40);
      this.slowMo(0.35, 260);
      this.flash(COLORS.cream, 0.18);
    } else {
      this.hitStop(30);
    }
  }

  lightning(x: number, y: number): void {
    this.burst(x, y, COLORS.lightning, 24, 480, 2.4);
    this.ring(x, y, 60, COLORS.lightning, 3, 0.3);
    this.text(x, y - 22, 'ZAP', COLORS.cream, 26, true);
    this.audio.zap((x / W) * 2 - 1);
    this.shake(5);
    this.flash(COLORS.cream, 0.06);
  }

  startFever(): void {
    this.fever = true;
    this.feverT = 0;
    this.showBanner('FEVER', `${FEVER_COMBO} COMBO 突破 ・ スコア ×1.5`, COLORS.cream, 1.6, 'text');
    this.flash(COLORS.cream, 0.35);
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
      if (t.kind === 'pop') t.vy += 380 * realDt;
      t.vx *= Math.exp(-3 * realDt);
      t.x += t.vx * realDt;
      t.y += t.vy * realDt;
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
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * a + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
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
        ctx.globalAlpha = a * 0.22;
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
      ctx.lineWidth = 2;
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
        [10, 0.22, b.color],
        [4, 0.6, b.color],
        [1.6, 1, COLORS.cream],
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

  /** 飛び出す文字。インクの縁取り+ずらした影で、印刷物のように見せる */
  drawTexts(ctx: CanvasRenderingContext2D): void {
    if (this.texts.length === 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    let font = '';
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      const age = t.max - t.life;
      let sc = 1;
      if (t.kind === 'stamp') sc = age < 0.12 ? 1.9 - (age / 0.12) * 0.9 : 1;
      else if (t.kind === 'big') sc = age < 0.2 ? 0.5 + elastic(age / 0.2) * 0.5 : 1;
      else sc = age < 0.12 ? 0.6 + (age / 0.12) * 0.4 : 1;
      const f = `900 ${t.size}px ${t.font}`;
      if (f !== font) {
        ctx.font = f;
        font = f;
      }
      ctx.globalAlpha = t.life < 0.25 ? t.life / 0.25 : 1;
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.rot) ctx.rotate(t.rot);
      ctx.scale(sc, sc);
      ctx.strokeStyle = COLORS.ink;
      ctx.fillStyle = COLORS.ink;
      if (t.kind !== 'pop') {
        // ずらした影(版ずれのような厚み)
        const o = t.kind === 'stamp' ? 5 : 3;
        ctx.lineWidth = Math.max(4, t.size * 0.22);
        ctx.strokeText(t.text, o, o);
        ctx.fillText(t.text, o, o);
      }
      ctx.lineWidth = Math.max(3, t.size * (t.kind === 'pop' ? 0.2 : 0.22));
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      // 細い同色の線で太らせる(端末の書体が細くても極太に見える)
      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.kind === 'pop' ? 0.6 : 1.2;
      ctx.strokeText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

}

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
