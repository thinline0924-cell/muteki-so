// 遊び方(絵つき・4 ページ)。絵は画像ファイルを使わず、ゲームと同じ描き方で小さな Canvas に描く。
// はじめて遊ぶときに自動で開き、そのあとはタイトルの「遊び方」からいつでも見られる。
// 「次回も開始時に表示する」で、自動表示のオン・オフを切り替えられる。

import { COLORS, FONT, NUM_FONT, PEG_COLOR, type PegType } from '../game/constants';

const PW = 460;
const PH = 250;
const INK = COLORS.ink;
const CREAM = COLORS.cream;

interface Page {
  title: string;
  text: string;
  draw(c: CanvasRenderingContext2D, t: number): void;
}

/** 夜の窓の地 */
function night(c: CanvasRenderingContext2D): void {
  const g = c.createLinearGradient(0, 0, 0, PH);
  g.addColorStop(0, '#15110d');
  g.addColorStop(1, '#2a231a');
  c.fillStyle = g;
  c.fillRect(0, 0, PW, PH);
}

function peg(c: CanvasRenderingContext2D, x: number, y: number, type: PegType, r = 11, hp = 1): void {
  const color = PEG_COLOR[type];
  const glow = c.createRadialGradient(x, y, r * 0.6, x, y, r + 12);
  glow.addColorStop(0, color + '66');
  glow.addColorStop(1, color + '00');
  c.fillStyle = glow;
  c.beginPath();
  c.arc(x, y, r + 12, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.8;
  c.stroke();
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.beginPath();
  if (type === 'split') {
    c.moveTo(x - r * 0.42, y);
    c.lineTo(x + r * 0.42, y);
    c.moveTo(x, y - r * 0.42);
    c.lineTo(x, y + r * 0.42);
  } else if (type === 'bomb') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      c.moveTo(x + Math.cos(a) * r * 0.18, y + Math.sin(a) * r * 0.18);
      c.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    }
  } else if (type === 'lightning') {
    c.moveTo(x + r * 0.15, y - r * 0.58);
    c.lineTo(x - r * 0.22, y + r * 0.05);
    c.lineTo(x + r * 0.18, y - r * 0.05);
    c.lineTo(x - r * 0.15, y + r * 0.58);
  }
  c.stroke();
  if (type === 'multi') {
    c.font = `900 ${Math.round(r * 0.55)}px ${NUM_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = INK;
    c.fillText('×2.0', x, y + 1);
  }
  c.strokeStyle = CREAM;
  c.lineWidth = 1.3;
  c.setLineDash([2.5, 2.5]);
  for (let i = 1; i < hp; i++) {
    c.beginPath();
    c.arc(x, y, r + 3.5 + (i - 1) * 3.5, 0, Math.PI * 2);
    c.stroke();
  }
  c.setLineDash([]);
}

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string = CREAM, weight = 800): void {
  c.font = `${weight} ${size}px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(text, x, y);
}

/** 押している指(線画) */
function finger(c: CanvasRenderingContext2D, x: number, y: number, press: number): void {
  c.save();
  c.translate(x, y);
  // 押したところの波紋
  c.strokeStyle = `rgba(243,237,216,${0.6 * press})`;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, 10 + (1 - press) * 10, 0, Math.PI * 2);
  c.stroke();
  c.rotate(-0.35);
  c.fillStyle = COLORS.paper;
  c.strokeStyle = INK;
  c.lineWidth = 2.2;
  c.beginPath();
  c.roundRect(-8, -4, 16, 46, 8);
  c.fill();
  c.stroke();
  c.beginPath();
  c.roundRect(-11, 30, 34, 36, 10);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(-4, 6);
  c.lineTo(4, 6);
  c.stroke();
  c.restore();
}

const LAMP = { x: 230, y: 34 };

const PAGES: Page[] = [
  {
    title: '狙って、離す',
    text: '画面を押したまま指を動かすと、ランプがその向きを向きます。点線は跳ね返りの予測。指を離すと発射します。',
    draw(c, t) {
      night(c);
      // ペグ
      const pegs: Array<[number, number, PegType]> = [
        [120, 150, 'normal'], [180, 190, 'normal'], [300, 140, 'normal'], [360, 190, 'split'], [250, 210, 'bomb'], [90, 210, 'normal'],
      ];
      for (const [x, y, k] of pegs) peg(c, x, y, k, 10);
      // 狙う向き(ゆっくり左右に揺れる)
      const phase = (t % 4) / 4;
      const aim = 0.35 + Math.sin(t * 0.9) * 0.12;
      const pts: Array<[number, number]> = [];
      let x = LAMP.x;
      let y = LAMP.y + 14;
      let vx = Math.sin(aim) * 260;
      let vy = Math.cos(aim) * 260;
      for (let i = 0; i < 60; i++) {
        vy += 380 * 0.02;
        x += vx * 0.02;
        y += vy * 0.02;
        if (Math.hypot(x - 300, y - 140) < 18) {
          const nx = (x - 300) / 18;
          const ny = (y - 140) / 18;
          const dot = vx * nx + vy * ny;
          vx -= 1.7 * dot * nx;
          vy -= 1.7 * dot * ny;
        }
        pts.push([x, y]);
        if (y > PH) break;
      }
      c.fillStyle = CREAM;
      pts.forEach(([px, py], i) => {
        if (i % 2) return;
        c.globalAlpha = 1 - i / pts.length;
        c.beginPath();
        c.arc(px, py, 2.6, 0, Math.PI * 2);
        c.fill();
      });
      c.globalAlpha = 1;
      // ランプ
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(LAMP.x, 0);
      c.lineTo(LAMP.x, LAMP.y - 10);
      c.stroke();
      c.save();
      c.translate(LAMP.x, LAMP.y);
      c.rotate(-aim);
      const lg = c.createRadialGradient(0, 14, 2, 0, 30, 70);
      lg.addColorStop(0, 'rgba(243,237,216,0.35)');
      lg.addColorStop(1, 'rgba(243,237,216,0)');
      c.fillStyle = lg;
      c.beginPath();
      c.moveTo(-12, 10);
      c.lineTo(12, 10);
      c.lineTo(50, 90);
      c.lineTo(-50, 90);
      c.closePath();
      c.fill();
      c.fillStyle = COLORS.paper;
      c.beginPath();
      c.moveTo(-7, -11);
      c.lineTo(7, -11);
      c.lineTo(19, 11);
      c.lineTo(-19, 11);
      c.closePath();
      c.fill();
      c.lineWidth = 2.4;
      c.stroke();
      c.restore();
      // 玉が点線をたどる(4 秒のうち後半)
      if (phase > 0.5) {
        const k = Math.floor(((phase - 0.5) / 0.5) * (pts.length - 1));
        const [bx, by] = pts[k];
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(bx, by, 6, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = INK;
        c.lineWidth = 1.2;
        c.stroke();
      }
      // 指
      const press = phase < 0.5 ? 1 : 0;
      const fx = LAMP.x + Math.sin(aim) * 170;
      const fy = LAMP.y + Math.cos(aim) * 150;
      if (phase < 0.55) finger(c, fx, fy, press);
      label(c, phase < 0.5 ? 'ドラッグで狙う' : '離して発射', 380, 26, 13, CREAM, 900);
    },
  },
  {
    title: 'ペグの種類',
    text: '当たると壊れてスコアが入ります。色つきの特殊なペグを巻き込むほど、1 ショットのスコアが大きく伸びます。',
    draw(c) {
      night(c);
      const items: Array<[PegType, string, string, string, number]> = [
        ['normal', '通常', '壊れる。輪は', '数回耐える印', 2],
        ['split', '分裂', '玉が', '増える', 1],
        ['bomb', '爆発', 'まわりを', '巻き込む', 1],
        ['multi', '倍率', 'スコアに', '掛け算', 1],
        ['lightning', '電撃', '近くへ', '連鎖する', 1],
      ];
      items.forEach(([k, name, d1, d2, hp], i) => {
        const x = 50 + i * 90;
        peg(c, x, 92, k, k === 'multi' ? 22 : 14, hp);
        label(c, name, x, 148, 17, CREAM, 900);
        label(c, d1, x, 178, 11.5, 'rgba(243,237,216,0.7)', 700);
        label(c, d2, x, 196, 11.5, 'rgba(243,237,216,0.7)', 700);
      });
      c.fillStyle = 'rgba(243,237,216,0.18)';
      c.fillRect(20, 226, PW - 40, 1);
      label(c, '倍率バンパーは 1 ショット 3 回まで(下の点が残り)', PW / 2, 238, 11, 'rgba(243,237,216,0.6)', 700);
    },
  },
  {
    title: 'スコアとライン',
    text: '全部の玉が落ちると、そのショットのスコアが合計に入ります。合計が「ライン」を越えるたびに、強化カードを 1 枚選べます。',
    draw(c, t) {
      c.fillStyle = '#c9c19c';
      c.fillRect(0, 0, PW, PH);
      // スコア
      const score = 761 + Math.floor(((t * 120) % 440));
      label(c, 'SCORE', PW / 2, 26, 11, INK, 900);
      c.font = `900 40px ${NUM_FONT}`;
      c.textAlign = 'center';
      c.fillStyle = INK;
      c.fillText(score.toLocaleString('en-US'), PW / 2, 64);
      // バー
      const bx = 30;
      const bw = PW - 60;
      const by = 96;
      const ratio = (score - 500) / 700;
      c.fillStyle = COLORS.paper2;
      c.fillRect(bx, by, bw, 28);
      c.fillStyle = INK;
      c.fillRect(bx, by, bw * ratio, 28);
      c.strokeStyle = ratio > 0.85 ? COLORS.blood : INK;
      c.lineWidth = 2.6;
      c.strokeRect(bx, by, bw, 28);
      c.lineJoin = 'round';
      c.lineWidth = 4;
      c.strokeStyle = INK;
      c.font = `800 12px ${FONT}`;
      c.textAlign = 'left';
      c.strokeText('次のライン 1,200', bx + 10, by + 15);
      c.fillStyle = CREAM;
      c.fillText('次のライン 1,200', bx + 10, by + 15);
      c.textAlign = 'right';
      const rt = `あと ${1200 - score}`;
      c.strokeText(rt, bx + bw - 10, by + 15);
      c.fillText(rt, bx + bw - 10, by + 15);
      // 矢印と強化カード 3 枚
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(PW / 2, 134);
      c.lineTo(PW / 2, 150);
      c.moveTo(PW / 2 - 6, 144);
      c.lineTo(PW / 2, 150);
      c.lineTo(PW / 2 + 6, 144);
      c.stroke();
      const cards: Array<[string, string]> = [['✚', '分裂ペグ増設'], ['✸', '爆薬庫'], ['◎', '黄金バンパー']];
      cards.forEach(([icon, name], i) => {
        const x = 40 + i * 134;
        const y = 160;
        c.fillStyle = INK;
        c.fillRect(x + 3, y + 4, 118, 72);
        c.fillStyle = '#efe9d3';
        c.fillRect(x, y, 118, 72);
        c.strokeStyle = INK;
        c.lineWidth = 2;
        c.strokeRect(x, y, 118, 72);
        c.fillStyle = INK;
        c.fillRect(x + 10, y + 10, 26, 26);
        label(c, icon, x + 23, y + 24, 14, CREAM, 900);
        c.textAlign = 'left';
        c.font = `900 12px ${FONT}`;
        c.fillStyle = INK;
        c.fillText(name, x + 10, y + 54);
      });
    },
  },
  {
    title: '夜明けまで',
    text: 'ショットを使い切ると夜が明けて、合計スコアが記録になります。九十秒モードは時間で終わります。自己ベストを目指しましょう。',
    draw(c, t) {
      // 夜から朝へのグラデーション
      const g = c.createLinearGradient(0, 0, PW, 0);
      g.addColorStop(0, '#15110d');
      g.addColorStop(0.55, '#3d2c22');
      g.addColorStop(0.85, '#a0623c');
      g.addColorStop(1, '#cd8c52');
      c.fillStyle = g;
      c.fillRect(0, 0, PW, PH);
      // 月と太陽
      c.fillStyle = CREAM;
      c.beginPath();
      c.arc(60, 70, 16, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#15110d';
      c.beginPath();
      c.arc(67, 64, 15, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#f6d9a2';
      c.beginPath();
      c.arc(PW - 60, 150, 26, 0, Math.PI * 2);
      c.fill();
      // 地平線の街
      c.fillStyle = '#16110c';
      for (let i = 0; i < 18; i++) {
        const h = 30 + ((i * 37) % 50);
        c.fillRect(i * 26, PH - h, 24, h);
      }
      // 時計
      const cx = PW / 2;
      const cy = 100;
      c.fillStyle = COLORS.paper;
      c.beginPath();
      c.arc(cx, cy, 52, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.stroke();
      const n = 12 - (Math.floor(t * 1.2) % 13);
      const a = -Math.PI / 2 + ((12 - n) / 12) * Math.PI * 2;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34);
      c.stroke();
      c.font = `900 34px ${NUM_FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = n <= 1 ? COLORS.blood : INK;
      c.fillText(String(n), cx, cy + 2);
      label(c, n === 0 ? '夜明け' : `夜明けまで ${n}`, cx, cy + 74, 13, CREAM, 900);
    },
  },
];

export interface TutorialHost {
  /** 自動表示の設定(first = まだ一度も見ていない) */
  getAuto(): 'first' | 'on' | 'off';
  setAuto(v: 'on' | 'off'): void;
  click(): void;
}

export class Tutorial {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private host: TutorialHost;
  private page = 0;
  private raf = 0;
  private t0 = 0;
  private onDone: (() => void) | null = null;
  private swipeX: number | null = null;

  constructor(parent: HTMLElement, host: TutorialHost) {
    this.host = host;
    const el = document.createElement('section');
    el.className = 'overlay howto';
    el.hidden = true;
    el.setAttribute('aria-label', '遊び方');
    el.innerHTML = `
      <div class="sheet howto-sheet">
        <div class="howto-head">
          <span class="eyebrow" data-step>1 / 4</span>
          <button class="close" data-howto="close" aria-label="閉じる">閉じる</button>
        </div>
        <canvas class="howto-pic" aria-hidden="true"></canvas>
        <h2 data-title></h2>
        <p class="howto-text" data-text></p>
        <div class="howto-nav">
          <button class="btn bare" data-howto="prev">戻る</button>
          <div class="howto-dots" data-dots></div>
          <button class="btn ink" data-howto="next">次へ</button>
        </div>
        <label class="howto-auto"><input type="checkbox" data-howto-auto> 次回もゲーム開始時に表示する</label>
      </div>`;
    parent.appendChild(el);
    this.el = el;
    this.canvas = el.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-howto]');
      if (!b) {
        if (e.target === el) this.close();
        return;
      }
      this.host.click();
      const a = b.dataset.howto;
      if (a === 'close') this.close();
      if (a === 'prev') this.go(this.page - 1);
      if (a === 'next') {
        if (this.page >= PAGES.length - 1) this.close();
        else this.go(this.page + 1);
      }
    });
    el.querySelector<HTMLInputElement>('[data-howto-auto]')!.addEventListener('change', (e) => {
      this.host.setAuto((e.target as HTMLInputElement).checked ? 'on' : 'off');
    });
    // 左右にスワイプしてもページを送れる
    this.canvas.addEventListener('pointerdown', (e) => (this.swipeX = e.clientX));
    this.canvas.addEventListener('pointerup', (e) => {
      if (this.swipeX === null) return;
      const dx = e.clientX - this.swipeX;
      this.swipeX = null;
      if (Math.abs(dx) > 30) this.go(this.page + (dx < 0 ? 1 : -1));
    });
  }

  isOpen(): boolean {
    return !this.el.hidden;
  }

  /** 開く。onDone は閉じたあとに呼ばれる(はじめての開始のとき、そのままゲームを始めるため) */
  open(onDone: (() => void) | null = null): void {
    this.onDone = onDone;
    const auto = this.host.getAuto();
    this.el.querySelector<HTMLInputElement>('[data-howto-auto]')!.checked = auto === 'on';
    this.el.hidden = false;
    this.resize();
    this.go(0);
    this.t0 = performance.now();
    cancelAnimationFrame(this.raf);
    const loop = (now: number) => {
      if (this.el.hidden) return;
      this.render((now - this.t0) / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    cancelAnimationFrame(this.raf);
    // はじめて見終えたら、以後は自動では出さない(チェックを入れていれば出す)
    if (this.host.getAuto() === 'first') {
      this.host.setAuto(this.el.querySelector<HTMLInputElement>('[data-howto-auto]')!.checked ? 'on' : 'off');
    }
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || PW;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round((w * PH) / PW) * dpr;
  }

  private go(i: number): void {
    this.page = Math.max(0, Math.min(PAGES.length - 1, i));
    const p = PAGES[this.page];
    this.el.querySelector('[data-step]')!.textContent = `${this.page + 1} / ${PAGES.length}`;
    this.el.querySelector('[data-title]')!.textContent = p.title;
    this.el.querySelector('[data-text]')!.textContent = p.text;
    this.el.querySelector<HTMLElement>('[data-dots]')!.innerHTML = PAGES.map((_, k) => `<i class="${k === this.page ? 'on' : ''}"></i>`).join('');
    this.el.querySelector<HTMLButtonElement>('[data-howto="prev"]')!.style.visibility = this.page === 0 ? 'hidden' : 'visible';
    this.el.querySelector('[data-howto="next"]')!.textContent = this.page === PAGES.length - 1 ? (this.onDone ? '遊ぶ' : '閉じる') : '次へ';
  }

  private render(t: number): void {
    const c = this.ctx;
    const k = this.canvas.width / PW;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.lineJoin = 'round';
    PAGES[this.page].draw(c, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
}
