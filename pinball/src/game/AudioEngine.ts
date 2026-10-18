// 効果音と BGM をその場で合成する(音声ファイルは使わない)。
//
// 使う部品(Web Audio API):
//   OscillatorNode … 音の波を作る発振器 / GainNode … 音量 / BiquadFilterNode … 音色を削るフィルター
//   ConvolverNode  … 部屋の響き(リバーブ)。響きのデータもその場でノイズから作る
//   WaveShaperNode … 音をわざと歪ませる(爆発のザラつき)
//
// 質を上げる工夫:
//   - ガラスやベルの音は「FM 合成」(発振器で別の発振器の高さを揺らす)で、澄んだ倍音を作る
//   - 毎回わずかに音量と音程を揺らし、機械的な連打感をなくす
//   - 乾いた音(直接音)と響き(リバーブへ送る量)を音ごとに調整する

const PENTA = [0, 2, 4, 7, 9];

type FilterSpec = { type: BiquadFilterType; freq: number; to?: number; q?: number };

interface VoiceOpts {
  to?: number;
  attack?: number;
  pan?: number;
  filter?: FilterSpec;
  dest?: AudioNode;
  detune?: number;
  /** リバーブへ送る量(0〜1) */
  send?: number;
}

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

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
  private reverbIn!: GainNode;
  private music!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private crunch!: Float32Array<ArrayBuffer>;
  private muted = false;
  private bgmOn = true;
  private sfxOn = true;
  private last = new Map<string, number>();
  private voices = 0;

  private bgmTimer = 0;
  private step = 0;
  private nextTime = 0;
  private fever = false;
  private calm = true;
  /** 夜の進み具合(0 = 真夜中 → 1 = 夜明け)。BGM の明るさと鳥の声に使う */
  private dawnP = 0;

  unlock(): void {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      // 最後に音割れを防ぐコンプレッサー(大きい音を自動で抑える)
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.18;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(comp);

      // 部屋の響き
      const conv = ctx.createConvolver();
      conv.buffer = this.makeImpulse(ctx, 2.4);
      const rvTone = ctx.createBiquadFilter();
      rvTone.type = 'lowpass';
      rvTone.frequency.value = 5200;
      const rvOut = ctx.createGain();
      rvOut.gain.value = 0.55;
      this.reverbIn = ctx.createGain();
      this.reverbIn.connect(conv);
      conv.connect(rvTone);
      rvTone.connect(rvOut);
      rvOut.connect(this.master);

      this.sfx = ctx.createGain();
      this.sfx.gain.value = 0.9;
      this.sfx.connect(this.master);

      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = this.calm ? 1100 : 1800;
      this.musicFilter.Q.value = 0.7;
      this.music = ctx.createGain();
      this.music.gain.value = this.bgmOn ? 0.3 : 0;
      this.musicFilter.connect(this.music);
      this.music.connect(this.master);
      const musicSend = ctx.createGain();
      musicSend.gain.value = 0.18;
      this.music.connect(musicSend);
      musicSend.connect(this.reverbIn);

      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 歪みのカーブ(爆発用)
      this.crunch = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        this.crunch[i] = Math.tanh(x * 3.2);
      }
      this.startCrackle();
      this.startBgm();
      // タブを裏にしたら音を止め、戻ったら再開する
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
  }

  /** リバーブ用の響きデータ:左右で少し違うノイズが、だんだん小さく・こもっていく */
  private makeImpulse(ctx: AudioContext, sec: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // 後ろほど高い音が減る(簡易ローパス)
        const k = 0.5 + t * 0.45;
        lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
        d[i] = lp * Math.pow(1 - t, 3.2) * 2.2;
      }
    }
    return buf;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** BGM だけのオン・オフ(自分の音楽を聴きながら遊びたい人向け) */
  setBgm(on: boolean): void {
    this.bgmOn = on;
    if (this.ctx) this.music.gain.setTargetAtTime(on ? 0.3 : 0, this.ctx.currentTime, 0.1);
  }

  /** 効果音だけのオン・オフ */
  setSfx(on: boolean): void {
    this.sfxOn = on;
  }

  /** フィーバー中は BGM のフィルターを開いて音数を増やす */
  setFever(on: boolean): void {
    this.fever = on;
    this.applyMusicTone();
  }

  /** タイトル画面などでは BGM をこもらせる */
  setCalm(on: boolean): void {
    this.calm = on;
    this.applyMusicTone();
  }

  /** 夜明けが近づくほど BGM を少しずつ明るくする */
  setDawn(p: number): void {
    this.dawnP = Math.max(0, Math.min(1, p));
    this.applyMusicTone();
  }

  private applyMusicTone(): void {
    if (!this.ctx) return;
    const f = this.fever ? 7000 : this.calm ? 1100 : 1700 + this.dawnP * 1600;
    this.musicFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.4);
  }

  // ───────── 部品 ─────────

  private gate(key: string, gap: number): boolean {
    if (!this.ctx || this.muted || !this.sfxOn || this.ctx.state !== 'running') return false;
    const now = this.ctx.currentTime;
    const prev = this.last.get(key) ?? -1;
    if (now - prev < gap) return false;
    this.last.set(key, now);
    return true;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime + 0.005 : 0;
  }

  /** 出口をつなぐ:パン(左右)→ 直接音 + リバーブ送り */
  private route(node: AudioNode, o: VoiceOpts): AudioNode {
    const ctx = this.ctx!;
    let out = node;
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      out.connect(p);
      out = p;
    }
    out.connect(o.dest ?? this.sfx);
    if (o.send && !o.dest) {
      const s = ctx.createGain();
      s.gain.value = o.send;
      out.connect(s);
      s.connect(this.reverbIn);
    }
    return out;
  }

  private tone(type: OscillatorType, freq: number, t0: number, dur: number, vol: number, o: VoiceOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx || (!o.dest && !this.sfxOn)) return;
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
    const out = this.route(g, o);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    this.voices++;
    osc.onended = () => {
      this.voices--;
      out.disconnect();
    };
  }

  /**
   * ベル/ガラスの音(FM 合成)。ratio = 揺らす側の高さの比、index = 揺れの深さ。
   * 叩いた瞬間は倍音が多く、すぐに澄んだ音に落ち着く。
   */
  private bell(freq: number, t0: number, dur: number, vol: number, o: VoiceOpts & { ratio?: number; index?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!o.dest && !this.sfxOn) return;
    const ratio = o.ratio ?? 3.5;
    const index = o.index ?? 1.6;
    const car = ctx.createOscillator();
    car.frequency.setValueAtTime(freq, t0);
    car.detune.value = o.detune ?? 0;
    const car2 = ctx.createOscillator();
    car2.frequency.setValueAtTime(freq * 2.001, t0);
    const mod = ctx.createOscillator();
    mod.frequency.setValueAtTime(freq * ratio, t0);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * index, t0);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.02 + 0.01, t0 + dur * 0.35);
    mod.connect(modGain);
    modGain.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.linearRampToValueAtTime(vol * 0.18, t0 + 0.002);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.4);
    car.connect(g);
    car2.connect(g2);
    g2.connect(g);
    const out = this.route(g, o);
    for (const n of [car, car2, mod]) {
      n.start(t0);
      n.stop(t0 + dur + 0.05);
    }
    this.voices++;
    car.onended = () => {
      this.voices--;
      out.disconnect();
    };
  }

  private noiseHit(t0: number, dur: number, vol: number, filter: FilterSpec, o: VoiceOpts & { shape?: boolean } = {}): void {
    const ctx = this.ctx;
    if (!ctx || (!o.dest && !this.sfxOn)) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rand(0.8, 1.2);
    const f = ctx.createBiquadFilter();
    f.type = filter.type;
    f.frequency.setValueAtTime(filter.freq, t0);
    if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t0 + dur);
    f.Q.value = filter.q ?? 0.8;
    const g = ctx.createGain();
    const atk = o.attack ?? 0.001;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    let node: AudioNode = f;
    if (o.shape) {
      const ws = ctx.createWaveShaper();
      ws.curve = this.crunch;
      node.connect(ws);
      node = ws;
    }
    node.connect(g);
    const out = this.route(g, o);
    src.start(t0, Math.random() * 0.5, dur + 0.05);
    this.voices++;
    src.onended = () => {
      this.voices--;
      out.disconnect();
    };
  }

  // ───────── 効果音 ─────────

  /** コンボ音:ペンタトニックで 1 段ずつ上がるガラスのベル */
  comboNote(step: number, pan = 0): void {
    if (!this.gate('combo', 0.026) || this.voices > 64) return;
    const s = step - 1;
    const idx = s < 15 ? s : 5 + ((s - 15) % 10);
    const semis = PENTA[idx % 5] + 12 * Math.floor(idx / 5);
    const f = 523.25 * Math.pow(2, semis / 12);
    const t = this.now();
    const v = rand(0.85, 1.05);
    this.bell(f, t, 0.9, 0.12 * v, { pan, send: 0.35, ratio: 3.01, index: 1.4, detune: rand(-4, 4) });
    // 叩いた瞬間の「カチッ」
    this.noiseHit(t, 0.025, 0.035 * v, { type: 'highpass', freq: 6500 }, { pan });
    if (step > 15) this.bell(f * 2, t + 0.01, 0.4, 0.03, { pan: -pan, send: 0.5, ratio: 2, index: 0.6 });
  }

  /** 壁:木を軽く叩いた音 */
  wall(pan = 0): void {
    if (!this.gate('wall', 0.05)) return;
    const t = this.now();
    this.noiseHit(t, 0.05, 0.14, { type: 'bandpass', freq: rand(1000, 1400), q: 3 }, { pan, send: 0.1 });
    this.tone('sine', 230, t, 0.09, 0.08, { to: 150, pan });
  }

  /** 発射:空気が抜ける「シュッ」+小さなポン */
  launch(): void {
    if (!this.gate('launch', 0.05)) return;
    const t = this.now();
    this.noiseHit(t, 0.13, 0.11, { type: 'bandpass', freq: 600, to: 3200, q: 1.4 }, { send: 0.12 });
    this.tone('sine', 520, t, 0.07, 0.06, { to: 820 });
  }

  /** 分裂:5 度で重なるベルがきらっと広がる */
  split(pan = 0): void {
    if (!this.gate('split', 0.05)) return;
    const t = this.now();
    this.bell(880, t, 0.6, 0.07, { pan, send: 0.4, ratio: 2, index: 1 });
    this.bell(1318.5, t + 0.04, 0.6, 0.06, { pan: -pan, send: 0.4, ratio: 2, index: 1 });
    this.bell(1760, t + 0.08, 0.5, 0.045, { pan, send: 0.5, ratio: 2, index: 0.8 });
    this.noiseHit(t, 0.25, 0.035, { type: 'highpass', freq: 7000 }, { pan, send: 0.3 });
  }

  /** 爆発:低いドン+歪んだノイズ+響き */
  bomb(power = 1): void {
    if (!this.gate('bomb', 0.06)) return;
    const t = this.now();
    const v = Math.min(1, 0.55 + power * 0.15);
    this.noiseHit(t, 0.03, 0.25 * v, { type: 'highpass', freq: 2500 });
    this.noiseHit(t, 0.9, 0.42 * v, { type: 'lowpass', freq: 4200, to: 110, q: 0.7 }, { shape: true, send: 0.35 });
    this.tone('sine', 120, t, 0.55, 0.6 * v, { to: 32 });
    this.tone('triangle', 62, t, 0.4, 0.22 * v, { to: 30 });
  }

  /** 電撃:ジジッという細かい火花の連打 */
  zap(pan = 0): void {
    if (!this.gate('zap', 0.06) || !this.ctx) return;
    const t = this.now();
    for (let i = 0; i < 6; i++) {
      this.noiseHit(t + i * 0.024 + rand(0, 0.01), 0.022, rand(0.07, 0.13), { type: 'bandpass', freq: rand(2200, 6500), q: 7 }, { pan: pan + rand(-0.3, 0.3), send: 0.25 });
    }
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    for (let i = 0; i < 10; i++) osc.frequency.setValueAtTime(rand(180, 900), t + i * 0.02);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(f);
    f.connect(g);
    const out = this.route(g, { pan, send: 0.2 });
    osc.start(t);
    osc.stop(t + 0.25);
    osc.onended = () => out.disconnect();
  }

  /** 倍率:ベルの上昇アルペジオ */
  multiplier(mult: number): void {
    if (!this.gate('mult', 0.08)) return;
    const t = this.now();
    const n = mult >= 2 ? 6 : 4;
    const steps = [0, 4, 7, 12, 16, 19];
    for (let i = 0; i < n; i++) {
      this.bell(659 * Math.pow(2, steps[i] / 12), t + i * 0.05, 0.7, 0.075, { send: 0.45, ratio: 2, index: 1.2, pan: (i / n) * 1.2 - 0.6 });
    }
    this.noiseHit(t + n * 0.05, 0.4, 0.03, { type: 'highpass', freq: 8000 }, { send: 0.6 });
  }

  /** コイン:高い 2 音のベル */
  coin(): void {
    if (!this.gate('coin', 0.05)) return;
    const t = this.now();
    this.bell(1975.5, t, 0.25, 0.05, { ratio: 2, index: 0.8, send: 0.25 });
    this.bell(2637, t + 0.07, 0.45, 0.05, { ratio: 2, index: 0.8, send: 0.3 });
  }

  /** ボタン:紙をはじく小さなカチッ */
  click(): void {
    if (!this.gate('click', 0.03)) return;
    const t = this.now();
    this.noiseHit(t, 0.02, 0.12, { type: 'bandpass', freq: 3200, q: 2 });
    this.tone('sine', 1700, t, 0.025, 0.025);
  }

  /** カード:紙がすべる音+和音 */
  card(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.noiseHit(t, 0.18, 0.07, { type: 'bandpass', freq: 800, to: 4200, q: 1.2 }, { attack: 0.04 });
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.bell(f, t + 0.03 + i * 0.025, 0.9, 0.04, { ratio: 2, index: 0.7, send: 0.45 }));
  }

  /** スコアが合計に入る:やわらかいドン+ベル */
  scoreHit(power = 1): void {
    if (!this.gate('ehit', 0.05)) return;
    const t = this.now();
    const v = Math.min(1, 0.5 + power * 0.12);
    this.tone('sine', 95, t, 0.3, 0.42 * v, { to: 45 });
    this.noiseHit(t, 0.14, 0.18 * v, { type: 'lowpass', freq: 900 });
    this.bell(1046.5, t + 0.02, 0.8, 0.06, { ratio: 2, index: 1, send: 0.4 });
    this.bell(1568, t + 0.06, 0.8, 0.05, { ratio: 2, index: 1, send: 0.4 });
  }

  /** ライン突破・自己ベストのファンファーレ */
  fanfare(): void {
    if (!this.ctx) return;
    const t = this.now();
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) =>
      this.bell(f, t + i * 0.07, i === 5 ? 1.6 : 0.8, 0.07, { ratio: 2, index: 1.3, send: 0.5, pan: (i / 5) * 1.0 - 0.5 }),
    );
    for (const f of [261.6, 329.6, 392]) this.tone('triangle', f, t + 0.3, 1.6, 0.05, { attack: 0.12, filter: { type: 'lowpass', freq: 1800 }, send: 0.5 });
  }

  /** 夜明け(自己ベストに届かなかったとき):やわらかく開いていく和音+鳥 */
  dawn(): void {
    if (!this.ctx) return;
    const t = this.now();
    for (const f of [261.6, 329.6, 392, 493.9, 587.3]) {
      this.tone('triangle', f, t, 2.8, 0.045, { attack: 0.7, filter: { type: 'lowpass', freq: 500, to: 2600 }, send: 0.6 });
    }
    this.bird(t + 0.9);
    this.bird(t + 1.5);
  }

  /** 鳥のさえずり(夜明けが近いとき) */
  bird(at?: number): void {
    if (!this.ctx || this.muted || !this.sfxOn) return;
    const ctx = this.ctx;
    const t = at ?? this.now();
    const n = 2 + Math.floor(Math.random() * 3);
    const base = rand(2600, 3600);
    const pan = rand(-0.8, 0.8);
    for (let i = 0; i < n; i++) {
      const t0 = t + i * rand(0.09, 0.14);
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.exponentialRampToValueAtTime(base * rand(1.25, 1.5), t0 + 0.04);
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, t0 + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.025, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      osc.connect(g);
      const out = this.route(g, { pan, send: 0.4 });
      osc.start(t0);
      osc.stop(t0 + 0.1);
      osc.onended = () => out.disconnect();
    }
  }

  feverStart(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.noiseHit(t, 0.75, 0.16, { type: 'bandpass', freq: 400, to: 8000, q: 1.5 }, { attack: 0.5, send: 0.4 });
    this.tone('sawtooth', 160, t, 0.75, 0.07, { to: 1800, attack: 0.5, filter: { type: 'lowpass', freq: 600, to: 5000 } });
    [783.99, 987.8, 1174.7, 1568].forEach((f, i) => this.bell(f, t + 0.7 + i * 0.05, 0.9, 0.06, { ratio: 2, index: 1.4, send: 0.5 }));
  }

  purchase(): void {
    if (!this.ctx) return;
    const t = this.now();
    [659.25, 830.6, 987.8, 1318.5, 1661].forEach((f, i) => this.bell(f, t + i * 0.07, 0.9, 0.06, { ratio: 2, index: 1, send: 0.5 }));
  }

  // ───────── BGM(ローファイ風ループ) ─────────

  /** レコードのかすかなパチパチ */
  private startCrackle(): void {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.01;
      if (Math.random() < 0.0004) d[i] = (Math.random() * 2 - 1) * 0.6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.value = 0.12;
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
    // BGM を切っているときは、音を作らない(電池にもやさしい)
    if (!this.bgmOn) {
      this.nextTime = ctx.currentTime + 0.05;
      return;
    }
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
        this.tone('triangle', midi(m), t, s16 * 16, 0.045, { attack: 0.35, dest });
        this.tone('sawtooth', midi(m), t, s16 * 16, 0.01, { attack: 0.5, dest, detune: 9 });
      }
    }
    if (st === 0 || st === 6 || st === 10) this.tone('triangle', midi(ch.bass), t, s16 * 4, 0.2, { attack: 0.01, dest });
    // キック・スネア・ハイハット
    if (st === 0 || st === 7 || st === 10) this.tone('sine', 120, t, 0.18, 0.36, { to: 40, dest });
    if (st === 4 || st === 12) this.noiseHit(t, 0.14, 0.14, { type: 'bandpass', freq: 1700, q: 0.9 }, { dest });
    const hat = this.fever ? st % 2 === 0 : st % 4 === 2;
    if (hat) this.noiseHit(t, 0.035, this.fever ? 0.06 : 0.04, { type: 'highpass', freq: 7500 }, { dest });
    // つま弾きアルペジオ(ベルの音色で)
    const arpSteps = this.fever ? [0, 2, 3, 6, 8, 10, 11, 14] : [0, 3, 6, 11, 14];
    if (arpSteps.includes(st) && !this.calm) {
      const m = ch.pad[(st * 3 + bar) % ch.pad.length] + (this.fever ? 24 : 12);
      this.bell(midi(m), t, 0.6, this.fever ? 0.045 : 0.035, { dest, ratio: 2, index: 0.5 });
    }
    // 夜明けが近いと、ときどき鳥が鳴く
    if (st === 8 && !this.calm && this.dawnP > 0.7 && Math.random() < (this.dawnP - 0.6) * 0.9) this.bird(t);
  }
}
