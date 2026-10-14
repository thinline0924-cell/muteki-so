// 効果音と BGM をその場で合成する(音声ファイルは使わない)。
// OscillatorNode = 音の波を作る発振器 / GainNode = 音量 / BiquadFilterNode = 音色を削るフィルター。

const PENTA = [0, 2, 4, 7, 9];

type FilterSpec = { type: BiquadFilterType; freq: number; to?: number; q?: number };

interface ToneOpts {
  to?: number;
  attack?: number;
  pan?: number;
  filter?: FilterSpec;
  dest?: AudioNode;
  detune?: number;
}

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ローファイな 4 和音ループ(Am7 → Fmaj7 → Cmaj7 → G6)
const CHORDS = [
  { pad: [57, 60, 64, 67], bass: 45 },
  { pad: [53, 57, 60, 64], bass: 41 },
  { pad: [55, 59, 60, 64], bass: 48 },
  { pad: [55, 59, 62, 64], bass: 43 },
];

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private muted = false;
  private last = new Map<string, number>();
  private voices = 0;

  private bgmTimer = 0;
  private step = 0;
  private nextTime = 0;
  private fever = false;
  private calm = true;

  unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(comp);
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = this.calm ? 1100 : 1800;
      this.musicFilter.Q.value = 0.7;
      this.music = ctx.createGain();
      this.music.gain.value = 0.32;
      this.musicFilter.connect(this.music);
      this.music.connect(this.master);

      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startCrackle();
      this.startBgm();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  /** フィーバー中は BGM のフィルターを開いて音数を増やす */
  setFever(on: boolean): void {
    this.fever = on;
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(on ? 7000 : this.calm ? 1100 : 1800, this.ctx.currentTime, 0.25);
  }

  /** タイトル画面などでは BGM をこもらせる */
  setCalm(on: boolean): void {
    this.calm = on;
    this.setFever(this.fever);
  }

  // ───────── 部品 ─────────

  private gate(key: string, gap: number): boolean {
    if (!this.ctx || this.muted) return false;
    const now = this.ctx.currentTime;
    const prev = this.last.get(key) ?? -1;
    if (now - prev < gap) return false;
    this.last.set(key, now);
    return true;
  }

  private tone(type: OscillatorType, freq: number, t0: number, dur: number, vol: number, o: ToneOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const atk = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(atk + 0.01, dur));
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.setValueAtTime(o.filter.freq, t0);
      if (o.filter.to) f.frequency.exponentialRampToValueAtTime(o.filter.to, t0 + dur);
      f.Q.value = o.filter.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    let out: AudioNode = g;
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      out = p;
    }
    out.connect(o.dest ?? this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    this.voices++;
    osc.onended = () => {
      this.voices--;
      out.disconnect();
    };
  }

  private noiseHit(t0: number, dur: number, vol: number, filter: FilterSpec, dest?: AudioNode, pan?: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.freq, t0);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur);
    f.Q.value = filter.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    let out: AudioNode = g;
    if (pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    out.connect(dest ?? this.sfx);
    const offset = Math.random() * 0.5;
    src.start(t0, offset, dur + 0.05);
    this.voices++;
    src.onended = () => {
      this.voices--;
      out.disconnect();
    };
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime + 0.005 : 0;
  }

  // ───────── 効果音 ─────────

  /** コンボ音:ペンタトニックで 1 段ずつ上がるクリスタル音 */
  comboNote(step: number, pan = 0): void {
    if (!this.gate('combo', 0.026) || this.voices > 70) return;
    const s = step - 1;
    const idx = s < 15 ? s : 5 + ((s - 15) % 10);
    const semis = PENTA[idx % 5] + 12 * Math.floor(idx / 5);
    const f = 523.25 * Math.pow(2, semis / 12);
    const t = this.now();
    this.tone('sine', f, t, 0.55, 0.16, { pan });
    this.tone('sine', f * 2, t, 0.25, 0.05, { pan });
    this.tone('triangle', f * 2.76, t, 0.16, 0.035, { pan });
    this.noiseHit(t, 0.03, 0.05, { type: 'highpass', freq: 7000 }, undefined, pan);
  }

  peg(pan = 0): void {
    if (!this.gate('peg', 0.04)) return;
    this.tone('triangle', 220, this.now(), 0.06, 0.05, { to: 160, pan });
  }

  wall(pan = 0): void {
    if (!this.gate('wall', 0.05)) return;
    this.tone('sine', 170, this.now(), 0.08, 0.13, { to: 100, pan });
  }

  launch(): void {
    if (!this.gate('launch', 0.05)) return;
    const t = this.now();
    this.tone('square', 240, t, 0.1, 0.06, { to: 720, filter: { type: 'lowpass', freq: 2200 } });
    this.noiseHit(t, 0.05, 0.08, { type: 'bandpass', freq: 3000 });
  }

  split(pan = 0): void {
    if (!this.gate('split', 0.05)) return;
    const t = this.now();
    this.tone('square', 520, t, 0.14, 0.05, { to: 1300, pan, filter: { type: 'lowpass', freq: 3000 } });
    this.tone('sine', 1318, t + 0.04, 0.18, 0.08, { pan: -pan });
    this.tone('sine', 1975, t + 0.08, 0.2, 0.06, { pan });
  }

  bomb(power = 1): void {
    if (!this.gate('bomb', 0.06)) return;
    const t = this.now();
    const v = Math.min(1, 0.55 + power * 0.15);
    this.noiseHit(t, 0.75, 0.55 * v, { type: 'lowpass', freq: 3200, to: 140, q: 0.6 });
    this.tone('sine', 150, t, 0.45, 0.65 * v, { to: 34 });
    this.tone('triangle', 75, t, 0.35, 0.3 * v, { to: 30 });
  }

  zap(pan = 0): void {
    if (!this.gate('zap', 0.06) || !this.ctx) return;
    const ctx = this.ctx;
    const t = this.now();
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    for (let i = 0; i < 12; i++) osc.frequency.setValueAtTime(300 + Math.random() * 1400, t + i * 0.02);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    osc.start(t);
    osc.stop(t + 0.3);
    osc.onended = () => g.disconnect();
    this.noiseHit(t, 0.18, 0.12, { type: 'highpass', freq: 3500 }, undefined, pan);
  }

  multiplier(mult: number): void {
    if (!this.gate('mult', 0.08)) return;
    const t = this.now();
    const n = mult >= 2 ? 6 : 4;
    const steps = [0, 4, 7, 12, 16, 19];
    for (let i = 0; i < n; i++) {
      this.tone('triangle', 659 * Math.pow(2, steps[i] / 12), t + i * 0.045, 0.3, 0.1);
    }
    this.tone('sine', 2637, t + n * 0.045, 0.5, 0.05);
  }

  coin(): void {
    if (!this.gate('coin', 0.05)) return;
    const t = this.now();
    this.tone('square', 1568, t, 0.07, 0.04, { filter: { type: 'lowpass', freq: 4000 } });
    this.tone('square', 2093, t + 0.07, 0.18, 0.04, { filter: { type: 'lowpass', freq: 4000 } });
  }

  click(): void {
    if (!this.gate('click', 0.03)) return;
    this.tone('triangle', 900, this.now(), 0.04, 0.07, { to: 700 });
  }

  card(): void {
    const t = this.now();
    if (!this.ctx) return;
    [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, t + i * 0.03, 0.6, 0.07));
  }

  /** スコアが合計に入るときのドスン */
  scoreHit(power = 1): void {
    if (!this.gate('ehit', 0.05)) return;
    const t = this.now();
    const v = Math.min(1, 0.5 + power * 0.12);
    this.noiseHit(t, 0.3, 0.45 * v, { type: 'lowpass', freq: 1600, to: 300 });
    this.tone('square', 120, t, 0.25, 0.18 * v, { to: 50, filter: { type: 'lowpass', freq: 900 } });
    this.tone('sine', 60, t, 0.35, 0.4 * v, { to: 30 });
  }

  /** ライン突破・自己ベストのファンファーレ */
  fanfare(): void {
    const t = this.now();
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      this.tone('square', f, t + i * 0.085, i === 4 ? 0.7 : 0.16, 0.06, { filter: { type: 'lowpass', freq: 3200 } }),
    );
    this.tone('triangle', 261, t + 0.34, 0.8, 0.12);
  }

  /** 夜明け(自己ベストに届かなかったとき) */
  dawn(): void {
    const t = this.now();
    [392, 349, 311, 262, 196].forEach((f, i) => this.tone('triangle', f, t + i * 0.2, 0.5, 0.13));
  }

  feverStart(): void {
    const t = this.now();
    this.tone('sawtooth', 180, t, 0.7, 0.12, { to: 2200, filter: { type: 'bandpass', freq: 900, to: 5000, q: 2 } });
    this.noiseHit(t, 0.7, 0.18, { type: 'bandpass', freq: 600, to: 8000, q: 1.5 });
    [784, 988, 1175, 1568].forEach((f, i) => this.tone('square', f, t + 0.45 + i * 0.06, 0.25, 0.05, { filter: { type: 'lowpass', freq: 4000 } }));
  }

  purchase(): void {
    const t = this.now();
    [659, 831, 988, 1318, 1661].forEach((f, i) => this.tone('triangle', f, t + i * 0.07, 0.5, 0.08));
  }

  // ───────── BGM(ローファイ風ループ) ─────────

  private startCrackle(): void {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.015;
      if (Math.random() < 0.0006) d[i] = (Math.random() * 2 - 1) * 0.7;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.value = 0.18;
    src.connect(f);
    f.connect(g);
    g.connect(this.music);
    src.start();
  }

  private startBgm(): void {
    const ctx = this.ctx!;
    this.nextTime = ctx.currentTime + 0.1;
    this.bgmTimer = window.setInterval(() => this.schedule(), 40);
  }

  stopBgm(): void {
    window.clearInterval(this.bgmTimer);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const sixteenth = 60 / (this.fever ? 100 : 86) / 4;
    // タブが裏にいた間の遅れは取り戻さない(音がまとめて鳴るのを防ぐ)
    if (this.nextTime < ctx.currentTime - 0.1) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.2) {
      const swing = this.step % 2 ? sixteenth * 0.18 : 0;
      this.playStep(this.step, this.nextTime + swing, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
    }
  }

  private playStep(step: number, t: number, s16: number): void {
    const bar = Math.floor(step / 16) % CHORDS.length;
    const st = step % 16;
    const ch = CHORDS[bar];
    const dest = this.musicFilter;
    if (st === 0) {
      for (const m of ch.pad) {
        this.tone('triangle', midi(m), t, s16 * 16, 0.05, { attack: 0.35, dest });
        this.tone('sawtooth', midi(m), t, s16 * 16, 0.012, { attack: 0.5, dest, detune: 9 });
      }
    }
    if (st === 0 || st === 6 || st === 10) this.tone('triangle', midi(ch.bass), t, s16 * 4, 0.22, { attack: 0.01, dest });
    // キック・スネア・ハイハット
    if (st === 0 || st === 7 || st === 10) this.tone('sine', 120, t, 0.18, 0.4, { to: 40, dest });
    if (st === 4 || st === 12) this.noiseHit(t, 0.14, 0.16, { type: 'bandpass', freq: 1700, q: 0.9 }, dest);
    const hat = this.fever ? st % 2 === 0 : st % 4 === 2;
    if (hat) this.noiseHit(t, 0.04, this.fever ? 0.07 : 0.045, { type: 'highpass', freq: 7000 }, dest);
    // つま弾きアルペジオ
    const arpSteps = this.fever ? [0, 2, 3, 6, 8, 10, 11, 14] : [0, 3, 6, 11, 14];
    if (arpSteps.includes(st) && !this.calm) {
      const m = ch.pad[(st * 3 + bar) % ch.pad.length] + (this.fever ? 24 : 12);
      this.tone('sine', midi(m), t, 0.35, this.fever ? 0.06 : 0.045, { dest });
    }
  }
}
