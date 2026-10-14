// 手描き風の線(少しだけ揺れて、角が少しはみ出す線)を引く小道具。
// 背景は一度だけ描いて使い回すので、揺れは種(seed)つき乱数で毎回同じ形にする。

export class Sketch {
  private s: number;

  constructor(seed = 7) {
    this.s = seed >>> 0;
  }

  rnd(): number {
    // mulberry32
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private j(w: number): number {
    return (this.rnd() - 0.5) * 2 * w;
  }

  /** パスに手描き風の線を足す(stroke は呼び出し側) */
  line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, wob = 1.2, move = true): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const n = Math.max(1, Math.round(len / 70));
    if (move) ctx.moveTo(x1 + this.j(wob * 0.5), y1 + this.j(wob * 0.5));
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const tm = (t0 + t1) / 2;
      const off = this.j(wob);
      ctx.quadraticCurveTo(
        x1 + dx * tm + px * off,
        y1 + dy * tm + py * off,
        x1 + dx * t1 + this.j(wob * 0.3),
        y1 + dy * t1 + this.j(wob * 0.3),
      );
    }
  }

  /** 角が少しはみ出す四角 */
  rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wob = 1.2): void {
    const o = 2.5;
    this.line(ctx, x - o, y, x + w + o, y, wob);
    this.line(ctx, x + w, y - o, x + w, y + h + o, wob);
    this.line(ctx, x + w + o, y + h, x - o, y + h, wob);
    this.line(ctx, x, y + h + o, x, y - o, wob);
  }

  ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, wob = 1): void {
    const n = Math.max(14, Math.round((rx + ry) / 3));
    const a0 = this.rnd() * Math.PI * 2;
    for (let i = 0; i <= n + 1; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const k = 1 + this.j(wob / Math.max(rx, ry));
      const x = cx + Math.cos(a) * rx * k;
      const y = cy + Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
}
