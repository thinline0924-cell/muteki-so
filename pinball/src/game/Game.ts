// ゲームの司令塔。状態遷移とメインループ、ショット中の衝突処理をまとめる。
//
// 遊び方:限られたショット数(夜が明けるまで)で、どこまでスコアを伸ばせるか。
//   スコアが「ライン」(目標点)を越えるたびに、強化カードを 1 枚選べて、ショットも +1。
//   ショットを使い切ると夜明け → 最終スコアを記録して終わり。
//
// 状態(state):
//   title  … タイトル画面
//   aim    … 狙っている(ドラッグで角度を決める)
//   shoot  … ボールが盤面を跳ねている
//   resolve… ショットのスコアを合計に運んでいる
//   busy   … ライン突破・夜明けの演出中(操作できない)
//   cards  … 強化カードの 3 択
//   over   … 夜明けの結果画面

import { AudioEngine } from './AudioEngine';
import { BUMPER_CHARGES, generateBoard } from './BoardGen';
import {
  BALL_R, COLORS, DRAIN_Y, H, LAUNCH_SPEED, LAUNCHER, MAX_BALLS, PEG_COLOR, PEG_R, PHYS_DT, W, lineTarget,
  type PegType,
} from './constants';
import { JuiceManager, fmt } from './JuiceManager';
import { MonetizationManager } from './MonetizationManager';
import { getMode, type ModeDef, type ModeId } from './Modes';
import { todayKey, useSeed } from './rng';
import { PegGrid, makeBall, predictPath, stepBall, type Ball, type Peg, type StepHooks } from './Physics';
import { Renderer } from './Renderer';
import { META, Save } from './Save';
import { baseStats, drawCards, type RunStats, type UpgradeDef } from './Upgrades';
import { UI } from '../ui/UI';

export type State = 'title' | 'aim' | 'shoot' | 'resolve' | 'busy' | 'cards' | 'over';
type HitSource = 'ball' | 'bomb' | 'zap' | 'detonate';
export type DebugAction = 'fire20' | 'convert' | 'coins' | 'skip' | 'shots' | 'resetpass';

interface Timed {
  t: number;
  fn: () => void;
}

/** ペグの種類ごとのスコア倍率(倍率バンパーは足し算ではなく掛け算) */
const TYPE_FACTOR: Record<PegType, number> = { normal: 1, split: 1, bomb: 2, multi: 0, lightning: 1.5 };

export class Game {
  readonly audio: AudioEngine;
  readonly juice: JuiceManager;
  readonly save: Save;
  readonly ui: UI;
  readonly renderer: Renderer;
  readonly money: MonetizationManager;
  readonly frame: HTMLElement;

  state: State = 'title';
  speed = 1;

  stats: RunStats;
  /** いま遊んでいるモード */
  mode: ModeDef = getMode('night');
  /** 九十秒モードの残り秒数(ショット中だけ減る) */
  timeLeft = 0;
  owned = new Map<string, number>();
  /** 合計スコアと、表示用にゆっくり追いかける数字 */
  score = 0;
  shownScore = 0;
  scorePop = 0;
  /** 越えたラインの数 */
  line = 0;
  /** 残りショット数と、使ったショット数 */
  shotsLeft = 10;
  shotsUsed = 0;
  /** 夜の進み具合(0 = 真夜中 → 1 = 夜明け)。空の色に使う。ゆっくり目標に近づく */
  nightP = 0;
  /** ショットごとのスコアの記録(結果画面のグラフ用) */
  shotLog: number[] = [];
  pegs: Peg[] = [];
  readonly grid = new PegGrid();
  balls: Ball[] = [];

  aim = { active: false, angle: 0, cancel: false };
  prediction: { pts: number[]; hitIndex: number } | null = null;
  boostArmed = false;
  shotDamage = 0;
  shotHits = 0;
  shotTime = 0;
  shotsFired = 0;
  dmgPop = 0;
  launcherKick = 0;
  resolveAnim: { t: number; dur: number; amount: number } | null = null;
  runCoins = 0;
  maxShotDamage = 0;

  private launchQueue: Array<{ t: number; angle: number }> = [];
  private shotEvents: Timed[] = [];
  private timers: Timed[] = [];
  private acc = 0;
  private safetyLeft = 0;
  private continued = false;
  private pendingCards = 0;
  /** このランで自己ベストを超えた演出をもう出したか */
  private passedBest = false;
  /** 夜明けの演出中(空を朝にする) */
  private sunrise = false;
  private wallFxT = 0;
  private lastTime = 0;
  private frameEma = 16;
  private pendingSpeed = 0;
  private hooks: StepHooks;

  constructor(root: HTMLElement) {
    this.audio = new AudioEngine();
    this.juice = new JuiceManager(this.audio);
    this.save = new Save();
    this.ui = new UI(root, this);
    this.frame = this.ui.frame;
    this.renderer = new Renderer(this.ui.canvas);
    this.money = new MonetizationManager(this.save, this.audio, this.frame, (m) => this.ui.toast(m));
    this.stats = baseStats(this.save.data.meta, this.mode);
    this.speed = this.save.data.pass ? Math.min(3, Math.max(1, this.save.data.speed)) : 1;
    this.audio.setMuted(this.save.data.muted);
    // 「視差効果を減らす」設定の人には画面の揺れを弱くする
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.juice.motionScale = 0.3;
    } catch {
      /* 判定できなければそのまま */
    }
    this.hooks = {
      onPeg: (b, p) => this.onBallPeg(b, p),
      onWall: (b) => this.onWall(b),
    };
    this.setupInput();
    const resize = () => this.resize();
    window.addEventListener('resize', resize);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(this.frame);
    this.resize();
    this.refreshBoard(false);
    this.ui.showTitle();
  }

  start(): void {
    requestAnimationFrame((t) => {
      this.lastTime = t;
      requestAnimationFrame(this.loop);
    });
  }

  ballRadius(): number {
    return BALL_R * this.stats.ballRadiusMul;
  }

  // ───────── 入力 ─────────

  private setupInput(): void {
    const c = this.ui.canvas;
    const toLogical = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    c.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      if (this.state !== 'aim' || this.isPaused()) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      this.aim.active = true;
      this.updateAim(toLogical(e));
    });
    c.addEventListener('pointermove', (e) => {
      if (!this.aim.active) return;
      this.updateAim(toLogical(e));
    });
    c.addEventListener('pointerup', (e) => {
      if (!this.aim.active) return;
      this.aim.active = false;
      const p = toLogical(e);
      // 発射口より上(壁のあたり)で離したらキャンセル
      if (p.y < LAUNCHER.y - 30 || this.state !== 'aim') {
        this.prediction = null;
        return;
      }
      this.fire(this.aim.angle);
    });
    c.addEventListener('pointercancel', () => {
      this.aim.active = false;
      this.prediction = null;
    });
    // iOS などは「指を離した瞬間」でないと音が鳴らせないことがあるので、いくつかの操作で解錠を試みる
    for (const ev of ['touchend', 'click', 'keydown']) {
      window.addEventListener(ev, () => this.audio.unlock(), { passive: true });
    }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.state === 'aim' && !this.isPaused()) {
        e.preventDefault();
        this.audio.unlock();
        this.fire(this.aim.angle);
      }
    });
  }

  private updateAim(p: { x: number; y: number }): void {
    this.aim.cancel = p.y < LAUNCHER.y - 30;
    const dx = p.x - LAUNCHER.x;
    const dy = Math.max(14, p.y - LAUNCHER.y);
    const ang = Math.max(-1.42, Math.min(1.42, Math.atan2(dx, dy)));
    this.aim.angle = ang;
    const sx = Math.sin(ang);
    const sy = Math.cos(ang);
    this.prediction = predictPath(
      LAUNCHER.x + sx * 20,
      LAUNCHER.y + sy * 20,
      sx * LAUNCH_SPEED,
      sy * LAUNCH_SPEED,
      this.ballRadius(),
      this.grid,
    );
  }

  private resize(): void {
    const r = this.frame.getBoundingClientRect();
    if (r.width < 10) return;
    this.frame.style.setProperty('--u', `${r.width / W}px`);
    this.renderer.resize(r.width, r.height);
  }

  isPaused(): boolean {
    return this.money.busy || this.ui.isShopOpen();
  }

  // ───────── メインループ ─────────

  private loop = (now: number): void => {
    const realDt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    // 重い端末では自動で演出を軽くする(ヒステリシス付き)
    this.frameEma = this.frameEma * 0.95 + realDt * 1000 * 0.05;
    if (this.frameEma > 26) this.juice.lowFx = true;
    else if (this.frameEma < 19) this.juice.lowFx = false;
    if (!this.isPaused()) this.update(realDt);
    this.renderer.draw(this);
    this.ui.sync();
    requestAnimationFrame(this.loop);
  };

  private update(realDt: number): void {
    const ts = this.juice.timeScale(realDt);
    const gdt = realDt * ts * this.speed;
    this.juice.update(gdt, realDt);
    this.runTimers(this.timers, gdt);

    for (const p of this.pegs) {
      if (p.spawn < 1) p.spawn = Math.min(1, p.spawn + realDt * 2.4);
      if (p.flash > 0) p.flash = Math.max(0, p.flash - realDt * 5);
      if (p.cooldown > 0) p.cooldown -= gdt;
    }
    // 空の色:使ったショットの割合で夜が明けていく
    const total = this.shotsUsed + this.shotsLeft;
    const nightTarget =
      this.state === 'title'
        ? 0
        : this.sunrise
          ? 1
          : this.mode.time
            ? 1 - Math.max(0, this.timeLeft) / this.mode.time
            : total > 0
              ? this.shotsUsed / total
              : 0;
    const prevP = this.nightP;
    this.nightP += (nightTarget - this.nightP) * Math.min(1, realDt * 1.2);
    if (Math.abs(this.nightP - prevP) > 0.0005) this.audio.setDawn(this.nightP);
    // 合計スコアはカウンターのように数字を回して追いつく
    if (this.shownScore < this.score) {
      this.shownScore += Math.max(1, (this.score - this.shownScore) * Math.min(1, realDt * 5));
      if (this.score - this.shownScore < 1) this.shownScore = this.score;
    } else {
      this.shownScore = this.score;
    }
    this.scorePop = Math.max(0, this.scorePop - realDt * 3);
    this.dmgPop = Math.max(0, this.dmgPop - realDt * 5);
    this.launcherKick = Math.max(0, this.launcherKick - realDt * 6);
    this.wallFxT -= realDt;

    if (this.state === 'shoot') this.updateShot(gdt);

    if (this.resolveAnim) {
      this.resolveAnim.t += realDt * Math.max(1, this.speed * 0.8);
      if (this.resolveAnim.t >= this.resolveAnim.dur) {
        const amount = this.resolveAnim.amount;
        this.resolveAnim = null;
        this.addScore(amount);
      }
    }

    // 軌跡
    for (const b of this.balls) {
      b.trail.push(b.x, b.y);
      if (b.trail.length > 22) b.trail.splice(0, 2);
    }
  }

  private updateShot(gdt: number): void {
    this.shotTime += gdt;
    if (this.mode.time) this.timeLeft = Math.max(0, this.timeLeft - gdt);
    this.updateRegrow(gdt);
    for (let i = this.launchQueue.length - 1; i >= 0; i--) {
      const q = this.launchQueue[i];
      q.t -= gdt;
      if (q.t <= 0) {
        this.launchQueue.splice(i, 1);
        this.launchBall(q.angle);
      }
    }
    this.runTimers(this.shotEvents, gdt);

    this.acc += gdt;
    const maxSteps = Math.ceil((0.05 * this.speed) / PHYS_DT) + 2;
    let steps = 0;
    while (this.acc >= PHYS_DT && steps < maxSteps) {
      this.physicsStep(PHYS_DT);
      this.acc -= PHYS_DT;
      steps++;
    }
    if (steps >= maxSteps) this.acc = 0;

    let w = 0;
    for (const b of this.balls) if (b.alive) this.balls[w++] = b;
    this.balls.length = w;

    // 何があっても 45 秒で打ち切る(救済の最終手段)
    if (this.shotTime > 45) for (const b of this.balls) b.alive = false;

    if (this.balls.length === 0 && this.launchQueue.length === 0 && this.shotEvents.length === 0) this.endShot();
  }

  /** 壊れた通常ペグが、しばらくすると灯り直す(盤面がからっぽにならないように) */
  private updateRegrow(dt: number): void {
    let changed = false;
    for (const p of this.pegs) {
      if (p.alive || p.regrow <= 0) continue;
      p.regrow -= dt;
      if (p.regrow > 0) continue;
      // ボールが重なっていたら少し待つ
      if (this.balls.some((b) => (b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + p.r + 4) ** 2)) {
        p.regrow = 0.2;
        continue;
      }
      this.revive(p);
      changed = true;
    }
    if (changed) this.grid.rebuild(this.pegs);
  }

  private revive(p: Peg): void {
    p.alive = true;
    p.regrow = 0;
    p.hp = p.maxHp = 1;
    p.spawn = 0;
    p.marked = false;
  }

  private physicsStep(dt: number): void {
    // 長引いたら重力を強めて自然に落とす
    const gm = this.shotTime > 15 ? 1 + (this.shotTime - 15) * 0.3 : 1;
    const n = this.balls.length;
    for (let i = 0; i < n; i++) {
      const b = this.balls[i];
      if (!b.alive) continue;
      b.age += dt;
      stepBall(b, dt, this.grid, this.hooks, gm);
      // スタック(止まって動かない)検出
      const mx = b.x - b.anchorX;
      const my = b.y - b.anchorY;
      if (mx * mx + my * my > 18 * 18) {
        b.anchorX = b.x;
        b.anchorY = b.y;
        b.stillT = 0;
      } else if ((b.stillT += dt) > 1.1) {
        this.rescue(b);
      }
      if (b.y > DRAIN_Y) this.drain(b);
    }
  }

  private runTimers(list: Timed[], dt: number): void {
    if (list.length === 0) return;
    const due: Timed[] = [];
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].t -= dt;
      if (list[i].t <= 0) {
        due.push(list[i]);
        list.splice(i, 1);
      }
    }
    due.sort((a, b) => a.t - b.t);
    for (const d of due) d.fn();
  }

  private after(sec: number, fn: () => void): void {
    this.timers.push({ t: sec, fn });
  }

  private shotEvent(sec: number, fn: () => void): void {
    this.shotEvents.push({ t: sec, fn });
  }

  // ───────── ショット ─────────

  fire(angle: number): void {
    if (this.state !== 'aim') return;
    if (!this.mode.time && this.shotsLeft <= 0) return;
    if (this.mode.time && this.timeLeft <= 0) return;
    const n = this.stats.ballsPerShot * (this.boostArmed ? 2 : 1);
    this.boostArmed = false;
    if (!this.mode.time) this.shotsLeft--;
    this.shotsUsed++;
    this.beginShot();
    const spread = Math.min(0.05, 0.5 / n);
    for (let i = 0; i < n; i++) {
      this.launchQueue.push({ t: i * 0.075, angle: angle + (i - (n - 1) / 2) * spread });
    }
    this.prediction = null;
    this.shotsFired++;
  }

  private beginShot(): void {
    this.state = 'shoot';
    this.shotDamage = 0;
    this.shotHits = 0;
    this.shotTime = 0;
    this.acc = 0;
    this.safetyLeft = this.stats.safetyNets;
    this.juice.combo = 0;
    // 倍率バンパーの回数を満タンに戻す
    for (const p of this.pegs) if (p.type === 'multi') p.charges = BUMPER_CHARGES + this.stats.bumperCharges;
  }

  /** 終盤(ラスト 3 ショット/ラスト 20 秒)か。目覚まし時計の強化が効く */
  private isLate(): boolean {
    return this.mode.time ? this.timeLeft <= 20 : this.shotsLeft < 3;
  }

  private launchBall(angle: number): void {
    if (this.balls.length >= MAX_BALLS) return;
    const sx = Math.sin(angle);
    const sy = Math.cos(angle);
    const b = makeBall(LAUNCHER.x + sx * 20, LAUNCHER.y + sy * 20, sx * LAUNCH_SPEED, sy * LAUNCH_SPEED, this.ballRadius());
    this.balls.push(b);
    this.audio.launch();
    this.launcherKick = 1;
    this.juice.burst(b.x, b.y, COLORS.cream, 8, 260, 2);
  }

  private onBallPeg(b: Ball, p: Peg): void {
    if (p.type === 'multi') {
      if (p.cooldown <= 0) {
        p.cooldown = 0.2;
        this.applyMultiplier(p);
      } else {
        p.flash = Math.max(p.flash, 0.4);
      }
      return;
    }
    if (b.lastPegId === p.id && this.shotTime - b.lastPegT < 0.1) return;
    b.lastPegId = p.id;
    b.lastPegT = this.shotTime;
    this.hitPeg(p, b, 'ball');
  }

  private onWall(b: Ball): void {
    const bonus = this.stats.wallBonus > 0;
    if (bonus) b.dmgMul = Math.min(b.dmgMul + this.stats.wallBonus, 1 + this.stats.wallBonus * 15);
    if (this.wallFxT <= 0) {
      this.wallFxT = 0.06;
      this.juice.wall(b.x, b.y, bonus);
    }
  }

  private addDamage(d: number): void {
    this.shotDamage += d;
    this.dmgPop = 1;
  }

  private hitPeg(p: Peg, ball: Ball | null, source: HitSource): void {
    if (!p.alive) return;
    if (p.type === 'multi') {
      if (p.cooldown <= 0) {
        p.cooldown = 0.25;
        this.applyMultiplier(p);
      }
      return;
    }
    const combo = this.juice.addCombo(p.x);
    this.shotHits++;
    const s = this.stats;
    // コンボの上乗せは 120 コンボで頭打ち(大量のボールで無限に伸びないように)
    let dmg = s.baseDamage * s.damageMul * TYPE_FACTOR[p.type] * (ball ? ball.dmgMul : 1) * (1 + Math.min(combo, 120) * s.comboBonus);
    if (s.lateBoost > 1 && this.isLate()) dmg *= s.lateBoost;
    if (this.juice.fever) dmg *= 1.5;
    const crit = Math.random() < s.critChance;
    if (crit) dmg *= s.critMul;
    this.addDamage(dmg);
    // 爆発は 2 ずつ削る(固いペグは一度では壊れない)。誘爆(コンティニュー)だけは一撃
    if (source === 'detonate') p.hp = 0;
    else p.hp -= source === 'bomb' ? 2 : 1;
    p.flash = 1;
    const destroyed = p.hp <= 0;
    this.juice.pegHit(p.x, p.y, PEG_COLOR[p.type], dmg, crit, destroyed);
    if (!destroyed) return;
    p.alive = false;
    // 通常ペグはショット中でも灯り直す(特殊ペグは灯り直さない)
    if (p.type === 'normal') p.regrow = s.regrowTime * (0.85 + Math.random() * 0.3);
    if (p.type === 'split') this.doSplit(p, ball);
    else if (p.type === 'bomb') this.doBomb(p.x, p.y, s.bombRadius);
    else if (p.type === 'lightning') this.doLightning(p);
    else if (source === 'bomb' && s.chainBomb > 0 && Math.random() < s.chainBomb) {
      this.shotEvent(0.1, () => this.doBomb(p.x, p.y, s.bombRadius * 0.5));
    }
  }

  private applyMultiplier(p: Peg): void {
    if (p.charges <= 0) {
      // 使い切ったバンパーは弾くだけ
      p.flash = Math.max(p.flash, 0.3);
      return;
    }
    p.charges--;
    this.juice.addCombo(p.x);
    this.shotHits++;
    this.shotDamage *= p.mult;
    this.dmgPop = 1;
    p.flash = 1;
    this.juice.multiplier(p.x, p.y, p.mult);
    if (p.mult >= 2) this.buzz(18);
  }

  private doSplit(p: Peg, ball: Ball | null): void {
    const extra = this.stats.splitCount - 1;
    const room = Math.max(0, MAX_BALLS - this.balls.length - this.launchQueue.length);
    const n = Math.min(extra, room);
    const x = ball ? ball.x : p.x;
    const y = ball ? ball.y : p.y;
    const vx = ball ? ball.vx : (Math.random() - 0.5) * 300;
    const vy = ball ? ball.vy : -250;
    const speed = Math.max(430, Math.hypot(vx, vy));
    const base = Math.atan2(vy, vx);
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const a = base + side * (0.42 + Math.floor(i / 2) * 0.3) + (Math.random() - 0.5) * 0.1;
      const nb = makeBall(x, y, Math.cos(a) * speed, Math.sin(a) * speed, this.ballRadius(), ball ? ball.dmgMul : 1);
      nb.lastPegId = p.id;
      nb.lastPegT = this.shotTime;
      this.balls.push(nb);
    }
    if (ball) {
      const a = base - 0.3;
      ball.vx = Math.cos(a) * speed;
      ball.vy = Math.sin(a) * speed;
    }
    if (n < extra) {
      // 上限に達したらボールの代わりにスコアボーナス
      this.addDamage(this.stats.baseDamage * this.stats.damageMul * 5 * (extra - n));
      this.juice.text(p.x, p.y - 30, 'MAX → +SCORE', COLORS.cream, 15);
    }
    this.juice.split(p.x, p.y, n + 1);
  }

  private doBomb(x: number, y: number, radius: number): void {
    this.juice.explosion(x, y, radius);
    this.buzz(14);
    for (const q of this.pegs) {
      if (!q.alive || q.marked) continue;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d > radius) continue;
      q.marked = true;
      this.shotEvent(0.03 + (d / radius) * 0.14, () => {
        q.marked = false;
        this.hitPeg(q, null, 'bomb');
      });
    }
    const rr = radius * 1.3;
    for (const b of this.balls) {
      const dx = b.x - x;
      const dy = b.y - y;
      const d = Math.hypot(dx, dy);
      if (d < rr && d > 0.1) {
        const k = (1 - d / rr) * 650;
        b.vx += (dx / d) * k;
        b.vy += (dy / d) * k;
      }
    }
  }

  private doLightning(p: Peg): void {
    const s = this.stats;
    const count = s.lightningMin + Math.floor(Math.random() * (s.lightningMax - s.lightningMin + 1));
    this.juice.lightning(p.x, p.y);
    let cx = p.x;
    let cy = p.y;
    let delay = 0;
    const visited = new Set<number>([p.id]);
    for (let i = 0; i < count; i++) {
      let best: Peg | null = null;
      let bd = 280 * 280;
      for (const q of this.pegs) {
        if (!q.alive || q.marked || visited.has(q.id)) continue;
        const d = (q.x - cx) ** 2 + (q.y - cy) ** 2;
        if (d < bd) {
          bd = d;
          best = q;
        }
      }
      if (!best) break;
      const target = best;
      visited.add(target.id);
      if (target.type !== 'multi') target.marked = true;
      const fx = cx;
      const fy = cy;
      delay += 0.06;
      this.shotEvent(delay, () => {
        this.juice.bolt(fx, fy, target.x, target.y, COLORS.lightning);
        target.marked = false;
        this.hitPeg(target, null, 'zap');
      });
      cx = target.x;
      cy = target.y;
    }
  }

  private rescue(b: Ball): void {
    b.stillT = 0;
    b.rescues++;
    if (b.rescues <= 2) {
      b.vx += (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 160);
      b.vy = -320;
    } else {
      // 乗っているペグを壊して落とす
      this.grid.forNear(b.x, b.y, (p) => {
        if (p.type !== 'multi' && Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r + 8) this.hitPeg(p, b, 'bomb');
      });
      b.vy = 260;
      b.vx = (Math.random() - 0.5) * 200;
      if (b.rescues > 5) b.alive = false;
    }
    this.juice.text(b.x, b.y - 18, 'RESCUE!', COLORS.cream, 14);
  }

  private drain(b: Ball): void {
    if (this.safetyLeft > 0 && !b.safetyUsed) {
      this.safetyLeft--;
      b.safetyUsed = true;
      b.y = DRAIN_Y - 4;
      b.vy = -1050 - Math.random() * 150;
      b.vx *= 0.6;
      this.juice.text(b.x, DRAIN_Y - 40, 'SAFETY', COLORS.cream, 20, true);
      this.juice.burst(b.x, DRAIN_Y - 10, COLORS.cream, 20, 400);
      this.audio.split();
      return;
    }
    b.alive = false;
  }

  private endShot(): void {
    this.juice.endShot();
    this.state = 'resolve';
    const amount = Math.round(this.shotDamage);
    this.shotDamage = amount;
    this.maxShotDamage = Math.max(this.maxShotDamage, amount);
    this.shotLog.push(amount);
    if (amount > this.save.data.bestDamage) this.save.data.bestDamage = amount;
    if (amount <= 0) {
      this.juice.text(270, 330, 'MISS', COLORS.cream, 30, true);
      this.after(0.5, () => this.nextTurn());
      return;
    }
    this.resolveAnim = { t: 0, dur: 0.5, amount };
  }

  /** ショットのスコアを合計に足し、ラインを越えたか調べる */
  private addScore(amount: number): void {
    this.score += amount;
    this.scorePop = 1;
    const power = Math.log10(amount + 1);
    this.juice.shake(3 + power * 2);
    this.juice.hitStop(35);
    this.juice.burst(270, 104, COLORS.cream, 30, 520, 2.6);
    this.juice.ring(270, 104, 70 + power * 10, COLORS.cream, 5, 0.4);
    this.juice.text(270, 150, `+${fmt(amount)}`, COLORS.cream, 24 + Math.min(16, power * 3), true);
    this.audio.scoreHit(power / 3);
    this.audio.coin();
    this.addCoins(Math.floor(Math.sqrt(amount) * 0.4 * this.stats.coinMul));
    // ランの途中で自己ベストを抜いた瞬間を一度だけ祝う
    const best = this.save.data.bestScore;
    if (!this.passedBest && best > 0 && this.score > best) {
      this.passedBest = true;
      this.juice.text(270, 470, 'ベスト超え!', COLORS.red, 52, false, true);
      this.buzz([20, 40, 20]);
    }
    this.checkLines();
  }

  private checkLines(): void {
    let crossed = 0;
    while (this.score >= lineTarget(this.line)) {
      this.line++;
      crossed++;
    }
    if (crossed === 0) {
      this.after(0.45, () => this.nextTurn());
      return;
    }
    // ショットが増えるのは「何本目かごと」だけ(増えすぎて夜が終わらないのを防ぐ)
    let bonus = 0;
    const every = this.mode.lineShotEvery;
    if (every > 0) for (let k = this.line - crossed + 1; k <= this.line; k++) if (k % every === 0) bonus++;
    this.shotsLeft += bonus;
    this.pendingCards += crossed;
    this.state = 'busy';
    this.juice.burst(270, 104, COLORS.multi, 40, 700, 3.2);
    this.juice.flash(COLORS.cream, 0.3);
    this.juice.shake(12);
    this.audio.fanfare();
    this.buzz([30, 50, 30]);
    const coins = Math.round((20 + this.line * 12) * crossed * this.stats.coinMul);
    this.addCoins(coins);
    this.juice.showBanner(`LINE ${this.line} 突破!`, bonus > 0 ? `ショット +${bonus} ・ 強化を選ぶ` : '強化を選ぶ', COLORS.ink, 1.5, 'card');
    if (this.line > this.save.data.bestLine) this.save.data.bestLine = this.line;
    this.save.write();
    this.after(1.4, () => this.openCards());
  }

  /** 次のショットへ。残りがなければ夜明け */
  private nextTurn(): void {
    if (this.mode.time ? this.timeLeft <= 0 : this.shotsLeft <= 0) {
      this.dawn();
      return;
    }
    this.toAim();
  }

  private toAim(): void {
    // 灯り直し待ちのペグは、次のショットまでに灯る
    let revived = false;
    for (const p of this.pegs) {
      if (!p.alive && p.regrow > 0) {
        this.revive(p);
        revived = true;
      }
    }
    if (revived) this.grid.rebuild(this.pegs);
    // 盤面の入れ替え:通常ペグが減った、または特殊ペグ(分裂・爆発・電撃)が 4 割を切ったとき
    const normals = this.pegs.filter((p) => p.type === 'normal');
    const specials = this.pegs.filter((p) => p.type !== 'normal' && p.type !== 'multi');
    const aliveN = normals.reduce((a, p) => a + (p.alive ? 1 : 0), 0);
    const aliveS = specials.reduce((a, p) => a + (p.alive ? 1 : 0), 0);
    if (aliveN < Math.max(16, normals.length * 0.45) || (specials.length > 0 && aliveS < specials.length * 0.4)) {
      this.refreshBoard(true);
    }
    if (!this.mode.time && this.shotsLeft === 1) this.juice.text(270, 600, 'ラスト 1 球', COLORS.red, 46, false, true);
    this.state = 'aim';
  }

  private boardSpec() {
    const s = this.stats;
    return {
      wave: this.line + 1,
      extraSplit: s.extraSplit,
      extraBomb: s.extraBomb,
      extraLightning: s.extraLightning,
      extraBumpers: s.extraBumpers,
      bumperBonus: s.bumperBonus,
    };
  }

  private refreshBoard(announce: boolean): void {
    this.pegs = generateBoard(this.boardSpec());
    this.grid.rebuild(this.pegs);
    if (announce) {
      this.juice.showBanner('REFRESH', '盤面が入れ替わった', COLORS.cream, 1.0);
      this.audio.card();
    }
  }

  // ───────── 強化カード・夜明け ─────────

  private openCards(): void {
    this.state = 'cards';
    this.balls.length = 0;
    this.launchQueue.length = 0;
    this.shotEvents.length = 0;
    this.ui.showCards(drawCards(this.owned), this.line - this.pendingCards + 1);
  }

  pickCard(def: UpgradeDef): void {
    if (this.state !== 'cards') return;
    const r = def.apply(this.stats);
    this.owned.set(def.id, (this.owned.get(def.id) ?? 0) + 1);
    if (r && r.shots) {
      // 九十秒モードでは、ショットの増減を秒数(1 ショット = 4 秒)に置きかえる
      if (this.mode.time) this.timeLeft = Math.max(5, this.timeLeft + r.shots * 4);
      else this.shotsLeft = Math.max(1, this.shotsLeft + r.shots);
    }
    this.audio.card();
    this.ui.hideCards();
    this.pendingCards--;
    if (this.pendingCards > 0) {
      this.openCards();
      return;
    }
    // 盤面に効く強化(ペグ追加など)をすぐ反映させる
    this.refreshBoard(false);
    this.nextTurn();
  }

  rerollCards(): void {
    if (this.state !== 'cards') return;
    void this.money.showRewardedAd('reroll').then((ok) => {
      if (ok && this.state === 'cards') {
        this.ui.showCards(drawCards(this.owned), this.line - this.pendingCards + 1);
        this.audio.card();
      }
    });
  }

  /** ショットを使い切った:夜明け → 結果 */
  private dawn(): void {
    this.state = 'busy';
    this.sunrise = true;
    const d = this.save.data;
    const key = this.bestKey();
    const prevBest = d.bests[key] ?? 0;
    const newBest = this.score > prevBest;
    if (newBest) {
      d.bests[key] = this.score;
      if (this.mode.id === 'night') d.bestScore = this.score;
      this.juice.text(270, 470, '自己ベスト!', COLORS.red, 56, false, true);
      this.audio.fanfare();
    } else {
      this.audio.dawn();
    }
    d.bestLine = Math.max(d.bestLine, this.line);
    this.save.write();
    this.juice.showBanner(this.mode.time ? '時間切れ' : '夜明け', `SCORE ${fmt(this.score)}`, COLORS.ink, 1.6, 'card');
    this.after(1.7, () => {
      this.state = 'over';
      this.ui.showResult({
        score: this.score,
        best: d.bests[key] ?? 0,
        mode: this.mode,
        newBest,
        line: this.line,
        history: this.shotLog.slice(),
        nextGap: lineTarget(this.line) - this.score,
        maxShot: this.maxShotDamage,
        bestCombo: this.juice.bestCombo,
        coins: this.runCoins,
        canContinue: !this.continued && !!this.mode.extend,
      });
    });
  }

  /** 広告で夜を延長:ショット +3 と、盤面の全ペグ誘爆 */
  continueRun(): void {
    if (this.state !== 'over' || this.continued) return;
    void this.money.showRewardedAd('continue').then((ok) => {
      if (!ok || this.state !== 'over') return;
      this.continued = true;
      this.sunrise = false;
      this.shotsLeft += this.mode.extend?.shots ?? 0;
      this.timeLeft += this.mode.extend?.time ?? 0;
      this.ui.hideResult();
      this.detonateAll();
    });
  }

  /** 盤面のペグを発射口から近い順に全部誘爆させる(ショットは減らない) */
  private detonateAll(): void {
    this.beginShot();
    const ext = this.mode.extend;
    this.juice.showBanner('全ペグ誘爆', ext?.time ? `延長 ・ +${ext.time} 秒` : `延長 ・ ショット +${ext?.shots ?? 0}`, COLORS.red, 1.5, 'stamp');
    this.juice.flash(COLORS.cream, 0.5);
    const list = this.pegs
      .filter((p) => p.alive)
      .sort((a, b) => Math.hypot(a.x - LAUNCHER.x, a.y - LAUNCHER.y) - Math.hypot(b.x - LAUNCHER.x, b.y - LAUNCHER.y));
    list.forEach((p, i) => {
      if (p.type !== 'multi') p.marked = true;
      this.shotEvent(0.35 + i * 0.022, () => {
        p.marked = false;
        this.juice.burst(p.x, p.y, COLORS.bomb, 10, 300);
        this.hitPeg(p, null, 'detonate');
      });
    });
  }

  /** 結果をクリップボードへ */
  resultText(): string {
    const day = this.mode.seeded ? ` ${todayKey().slice(4, 6)}/${todayKey().slice(6)}` : '';
    return `夜窓ピンボール【${this.mode.name}${day}】SCORE ${fmt(this.score)} / LINE ${this.line} / 最大ショット ${fmt(this.maxShotDamage)} / 最大コンボ ${this.juice.bestCombo}`;
  }

  /** モードごとの自己ベストの保存名 */
  bestKey(mode: ModeDef = this.mode): string {
    return mode.seeded ? `daily-${todayKey()}` : mode.id;
  }

  /** タイトルでモードを選んだとき。はじめての人(や表示をオンにした人)には先に遊び方を見せる */
  chooseMode(id: ModeId): void {
    const h = this.save.data.howto ?? 'first';
    if (h === 'off') {
      this.startMode(id);
      return;
    }
    this.ui.openHowto(() => this.startMode(id));
  }

  /** モードを選んで始める */
  startMode(id: ModeId): void {
    this.mode = getMode(id);
    this.newRun();
  }

  newRun(): void {
    // 今夜の一局は日付の種で、盤面とカードを全員そろえる
    useSeed(this.mode.seeded ? Number(todayKey()) * 7919 : null);
    this.stats = baseStats(this.save.data.meta, this.mode);
    this.timeLeft = this.mode.time ?? 0;
    this.owned.clear();
    this.score = 0;
    this.shownScore = 0;
    this.line = 0;
    this.shotsLeft = this.stats.startShots;
    this.shotsUsed = 0;
    this.pendingCards = 0;
    this.continued = false;
    this.passedBest = false;
    this.sunrise = false;
    this.shotLog = [];
    this.runCoins = 0;
    this.maxShotDamage = 0;
    this.shotsFired = 0;
    this.boostArmed = false;
    this.balls.length = 0;
    this.launchQueue.length = 0;
    this.shotEvents.length = 0;
    this.timers.length = 0;
    this.resolveAnim = null;
    this.juice.clearEffects();
    this.juice.endShot();
    this.juice.bestCombo = 0;
    this.refreshBoard(false);
    this.juice.showBanner('READY', this.mode.time ? `${this.mode.time} 秒の勝負` : `${this.mode.name} ・ ${this.shotsLeft} ショット`, COLORS.cream, 1.4);
    this.audio.setCalm(false);
    this.state = 'aim';
    this.ui.hideTitle();
    this.ui.hideResult();
  }

  toTitle(): void {
    this.state = 'title';
    this.sunrise = false;
    useSeed(null);
    this.balls.length = 0;
    this.timers.length = 0;
    this.shotEvents.length = 0;
    this.launchQueue.length = 0;
    this.juice.clearEffects();
    this.refreshBoard(false);
    this.audio.setCalm(true);
    this.ui.hideResult();
    this.ui.showTitle();
  }

  // ───────── 課金・広告・設定 ─────────

  requestBoost(): void {
    if (this.state !== 'aim' || this.boostArmed) return;
    void this.money.showRewardedAd('boost').then((ok) => {
      if (ok && this.state === 'aim') {
        this.boostArmed = true;
        this.juice.text(LAUNCHER.x, LAUNCHER.y + 70, '×2 BALL', COLORS.cream, 30, true);
        this.juice.burst(LAUNCHER.x, LAUNCHER.y + 20, COLORS.cream, 30, 400);
      }
    });
  }

  setSpeed(s: number): void {
    if (s > 1 && !this.money.hasPass) {
      this.pendingSpeed = s;
      this.ui.openShop('pass');
      return;
    }
    this.speed = s;
    this.save.data.speed = s;
    this.save.write();
  }

  buyPass(): Promise<boolean> {
    return this.money.purchasePass().then((ok) => {
      if (ok) {
        if (this.pendingSpeed > 1) {
          this.setSpeed(this.pendingSpeed);
          this.ui.toast(`購入完了!${this.pendingSpeed}x スピードで遊べます`);
        } else {
          this.ui.toast('購入完了!2x / 3x が使えるようになりました');
        }
        this.pendingSpeed = 0;
      }
      return ok;
    });
  }

  buyMeta(key: string): void {
    const def = META.find((m) => m.key === key);
    if (!def) return;
    const lv = this.save.data.meta[def.key];
    if (lv >= def.max) return;
    const cost = def.cost(lv);
    if (this.save.data.coins < cost) {
      this.ui.toast('コインが足りません');
      return;
    }
    this.save.data.coins -= cost;
    this.save.data.meta[def.key] = lv + 1;
    this.save.write();
    this.audio.purchase();
    this.ui.toast(`${def.name} → Lv ${lv + 1}(次のランから反映)`);
  }

  toggleMute(): void {
    this.audio.unlock();
    this.save.data.muted = !this.save.data.muted;
    this.audio.setMuted(this.save.data.muted);
    this.save.write();
  }

  /** スマホを震わせる(対応している端末だけ。音を消しているときは震わせない) */
  private buzz(pattern: number | number[]): void {
    if (this.save.data.muted) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* 使えない環境では何もしない */
    }
  }

  addCoins(n: number): void {
    if (n <= 0) return;
    this.save.data.coins += n;
    this.runCoins += n;
    this.save.write();
  }

  // ───────── 神モード(デバッグ) ─────────

  debug(action: DebugAction): void {
    switch (action) {
      case 'fire20': {
        if (this.state === 'aim') {
          this.beginShot();
          this.shotsFired++;
          this.prediction = null;
        } else if (this.state !== 'shoot') {
          this.ui.toast('狙っている間かショット中に使えます');
          return;
        }
        for (let i = 0; i < 20; i++) {
          this.launchQueue.push({ t: i * 0.025, angle: (Math.random() - 0.5) * 2.4 });
        }
        this.ui.toast('ボール 20 個 発射!');
        break;
      }
      case 'convert': {
        let n = 0;
        for (const p of this.pegs) {
          if (!p.alive || p.type === 'multi') continue;
          p.type = Math.random() < 0.5 ? 'split' : 'bomb';
          p.hp = p.maxHp = 1;
          p.r = PEG_R;
          p.flash = 1;
          n++;
        }
        this.grid.rebuild(this.pegs);
        this.juice.flash(COLORS.cream, 0.3);
        this.ui.toast(`${n} 個のペグを分裂&爆発ペグに変えました`);
        break;
      }
      case 'coins':
        this.addCoins(10000);
        this.audio.coin();
        this.ui.toast('コイン +10,000');
        break;
      case 'skip': {
        if (this.state !== 'aim') {
          this.ui.toast('狙っている間に使えます');
          return;
        }
        this.state = 'resolve';
        this.score = Math.max(this.score, lineTarget(this.line));
        this.scorePop = 1;
        this.checkLines();
        break;
      }
      case 'shots':
        if (this.mode.time) this.timeLeft += 20;
        else this.shotsLeft += 5;
        this.ui.toast(this.mode.time ? '時間 +20 秒' : 'ショット +5');
        break;
      case 'resetpass':
        this.money.resetPurchase();
        this.speed = 1;
        this.save.data.speed = 1;
        this.save.write();
        this.ui.toast('購入状態をリセットしました');
        break;
    }
  }
}
