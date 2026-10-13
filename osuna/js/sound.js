/* sound.js — Web Audio でその場で音を作る(音声ファイルは使わない)
   Sound.init()      : 最初のタップで呼ぶ(ブラウザは操作のあとでないと音を出せない)
   Sound.music(mode) : 'menu'(ローファイの和音) / 'play'(心音と低いうなり) / 'off'
   Sound.se(name)    : 効果音
   Sound.intensity(x): 0〜1。勝負中の緊張度(心音が速くなる)
   Sound.duck(true)  : 「静寂」の演出で全部の音を消す
   曲ファイル js/bgm-data.js があれば、合成の曲のかわりにその曲を流す(下の「曲ファイル」)。 */
const Sound = (function () {
  'use strict';
  let ac = null, master = null, mus = null, sfx = null, noiseBuf = null;
  let on = true, ducked = false, want = 'off', mode = 'off';
  let nextBar = 0, barNo = 0, nextBeat = 0, inten = 0, drone = null;
  const BAR = 4 * 60 / 76;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { ac = null; return; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = level();
    master.connect(comp); comp.connect(ac.destination);
    mus = ac.createGain(); mus.gain.value = 0.55; mus.connect(master);
    sfx = ac.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    crackle();
    loadSong();
    setInterval(tick, 60);
    applyMusic();
  }
  function level() { return on && !ducked ? 0.9 : 0.0001; }
  function now() { return ac ? ac.currentTime : 0; }

  function tone(f, dur, o) {
    if (!ac) return;
    o = o || {};
    const t = o.at || ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ac.createGain();
    const v = o.vol == null ? 0.2 : o.vol, a = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); node = fl; }
    node.connect(g); g.connect(o.bus || sfx);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o) {
    if (!ac) return;
    o = o || {};
    const t = o.at || ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = o.ft || 'bandpass'; fl.frequency.setValueAtTime(o.f || 1000, t); fl.Q.value = o.q || 1;
    if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = ac.createGain(), v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(o.bus || sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  // レコードのプチプチ音(ずっと小さく鳴っている)
  function crackle() {
    const len = ac.sampleRate * 3, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() < 0.0005 ? (Math.random() - 0.5) * 1.4 : 0) + (Math.random() - 0.5) * 0.012;
    const src = ac.createBufferSource(); src.buffer = b; src.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const g = ac.createGain(); g.gain.value = 0.14;
    src.connect(hp); hp.connect(g); g.connect(master); src.start();
  }

  // ---------- 効果音 ----------
  const SE = {
    click() { tone(1200, 0.05, { type: 'square', vol: 0.05 }); },
    tick(m) { tone(1700 + Math.min(1800, m * 14), 0.03, { type: 'square', vol: 0.03 }); },
    milestone(i) {
      const f = 523 * Math.pow(2, i / 5);
      tone(f, 0.8, { vol: 0.22 }); tone(f * 2.01, 0.5, { vol: 0.08 }); tone(f * 3.02, 0.3, { vol: 0.04 });
    },
    // 本物の前兆「チリン」
    presign() { const t = now(); tone(1568, 0.55, { vol: 0.22, at: t }); tone(2093, 0.65, { vol: 0.17, at: t + 0.07 }); tone(3136, 0.4, { vol: 0.05, at: t + 0.07 }); },
    // 偽物の「チリン」(ほんの少し低い)
    fakeChime() { const t = now(); tone(1510, 0.55, { vol: 0.22, at: t }); tone(2020, 0.65, { vol: 0.17, at: t + 0.07 }); },
    hype() { const t = now(); for (let i = 0; i < 4; i++) tone(i % 2 ? 1175 : 880, 0.07, { type: 'square', vol: 0.06, at: t + i * 0.09 }); },
    fanfare() { const t = now(); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'square', vol: 0.06, at: t + i * 0.08 })); },
    error() { const t = now(); tone(220, 0.18, { type: 'sawtooth', vol: 0.07, lp: 900, at: t }); tone(185, 0.26, { type: 'sawtooth', vol: 0.07, lp: 900, at: t + 0.2 }); },
    notify() { tone(980, 0.14, { to: 560, vol: 0.15 }); },
    coin() { const t = now(); tone(988, 0.08, { type: 'square', vol: 0.06, at: t }); tone(1319, 0.28, { type: 'square', vol: 0.06, at: t + 0.08 }); },
    ring() { const t = now(); for (let i = 0; i < 10; i++) tone(i % 2 ? 1320 : 1040, 0.06, { type: 'square', vol: 0.045, at: t + i * 0.06 }); },
    gacha() { const t = now(); for (let i = 0; i < 6; i++) noise(0.03, { f: 2600, q: 3, vol: 0.14, at: t + i * 0.07 }); },
    dice() { const t = now(); for (let i = 0; i < 7; i++) noise(0.025, { f: 1800, q: 2, vol: 0.12, at: t + i * 0.05 + Math.random() * 0.02 }); },
    bonus() {
      const t = now();
      [784, 988, 1175, 1568, 1976, 2637].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.13, at: t + i * 0.045 }));
      noise(0.7, { ft: 'highpass', f: 6000, vol: 0.06 });
      tone(196, 0.5, { vol: 0.3, to: 98 });
    },
    crack() {
      const t = now();
      noise(0.4, { ft: 'highpass', f: 2500, vol: 0.35 }); noise(0.25, { ft: 'lowpass', f: 300, vol: 0.5 });
      tone(90, 0.45, { vol: 0.45, to: 38 });
      for (let i = 0; i < 6; i++) tone(3000 + Math.random() * 3000, 0.08, { vol: 0.04, at: t + 0.05 + i * 0.04 });
    },
    beep() { tone(1760, 0.07, { type: 'square', vol: 0.06 }); },
    cashout() {
      const t = now();
      noise(0.09, { f: 3500, q: 2, vol: 0.3 });
      [1319, 1760, 2637].forEach((f, i) => tone(f, 0.6, { vol: 0.14, at: t + 0.05 + i * 0.06 }));
      for (let i = 0; i < 14; i++) tone(1800 + Math.random() * 1400, 0.05, { type: 'square', vol: 0.03, at: t + 0.25 + i * 0.05 });
      tone(130, 0.45, { vol: 0.3, to: 65 });
    },
    lose() {
      tone(330, 1.1, { type: 'sawtooth', vol: 0.12, to: 40, lp: 1200 });
      noise(0.7, { ft: 'lowpass', f: 700, vol: 0.45, to: 90 });
      tone(70, 0.7, { vol: 0.5, to: 28 });
    },
    stamp() { noise(0.08, { ft: 'lowpass', f: 420, vol: 0.5 }); tone(110, 0.16, { vol: 0.4, to: 60 }); },
    count() { tone(2400, 0.02, { type: 'square', vol: 0.025 }); },
    shake() { const t = now(); for (let i = 0; i < 10; i++) noise(0.035, { f: 1100 + Math.random() * 900, q: 1.5, vol: 0.12, at: t + i * 0.08 }); },
    win() { const t = now(); [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.06, at: t + i * 0.07 })); },
    stab() {
      [110, 165, 220, 277, 330].forEach(f => tone(f, 1.0, { type: 'sawtooth', vol: 0.06, lp: 1600 }));
      noise(0.35, { ft: 'lowpass', f: 220, vol: 0.45 });
    },
    ready() { tone(660, 0.1, { type: 'square', vol: 0.06 }); },
    go() { tone(1320, 0.28, { type: 'square', vol: 0.07 }); }
  };

  // ---------- 音楽 ----------
  const CHORDS = [
    { b: 38, n: [62, 65, 69, 72] },  // Dm7
    { b: 43, n: [62, 65, 67, 71] },  // G7
    { b: 36, n: [60, 64, 67, 71] },  // Cmaj7
    { b: 45, n: [61, 64, 67, 70] }   // A7(b9)
  ];
  const MEL = [74, 76, 79, 81, 84, 86];
  function playBar(t, i) {
    const c = CHORDS[i % 4], beat = BAR / 4;
    tone(mtof(c.b), beat * 1.6, { vol: 0.2, at: t, attack: 0.02, bus: mus });
    tone(mtof(c.b), beat * 1.2, { vol: 0.14, at: t + beat * 2.5, attack: 0.02, bus: mus });
    c.n.forEach(n => tone(mtof(n), BAR * 0.95, { type: 'triangle', vol: 0.03, at: t, attack: 0.35, lp: 1300, detune: (Math.random() - 0.5) * 16, bus: mus }));
    for (let k = 0; k < 4; k++) {
      noise(0.04, { ft: 'highpass', f: 7000, vol: 0.025, at: t + beat * (k + 0.5), bus: mus });
      if (k % 2) noise(0.12, { f: 1700, q: 0.8, vol: 0.035, at: t + beat * k, bus: mus });
    }
    if (Math.random() < 0.7) {
      const n = MEL[Math.floor(Math.random() * MEL.length)];
      tone(mtof(n), 0.6, { type: 'triangle', vol: 0.045, at: t + beat * (1 + Math.floor(Math.random() * 3)) + 0.05, bus: mus });
    }
  }
  function heartbeat(t) {
    tone(58, 0.2, { vol: 0.5, to: 40, at: t, bus: mus });
    tone(52, 0.18, { vol: 0.32, to: 38, at: t + 0.17, bus: mus });
  }
  function startDrone() {
    const t = ac.currentTime;
    const o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 880;
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 220;
    const g1 = ac.createGain(); g1.gain.setValueAtTime(0.0001, t); g1.gain.exponentialRampToValueAtTime(0.05, t + 1);
    const g2 = ac.createGain(); g2.gain.value = 0;
    o1.connect(fl); fl.connect(g1); g1.connect(mus);
    o2.connect(g2); g2.connect(mus);
    o1.start(); o2.start();
    drone = { o1, o2, fl, g1, g2 };
  }
  function stopDrone() {
    if (!drone) return;
    const t = ac.currentTime, d = drone; drone = null;
    d.g1.gain.setTargetAtTime(0.0001, t, 0.1); d.g2.gain.setTargetAtTime(0, t, 0.05);
    d.o1.stop(t + 0.6); d.o2.stop(t + 0.6);
  }
  // ---------- 曲ファイル(js/bgm-data.js があるとき) ----------
  // bgm-data.js は window.OSUNA_BGM = { data: mp3をbase64にした文字, loopStart: 秒, loopEnd: 秒 } を置くだけのファイル。
  // 文字にして JS に入れておくと、index.html をダブルクリックで開いた時(file://)でも読める。
  // 前奏を1回流したあと、loopStart〜loopEnd をつなぎ目なしでくり返す(AudioBufferSourceNode の loop)。
  // 勝負中は曲をこもらせて小さくし、その上に心音を重ねる。
  let song = null;
  const SONG_MIX = { menu: { vol: 0.75, lp: 18000 }, play: { vol: 0.32, lp: 650 }, off: { vol: 0.1, lp: 900 } };
  function loadSong() {
    const B = window.OSUNA_BGM;
    if (!B || song) return;
    song = { buf: null, src: null, gain: null, lp: null, played: false };
    let failed = false;
    const ng = () => { if (failed) return; failed = true; song = null; mode = 'off'; applyMusic(); };  // 読めなければ合成の曲にもどす
    let bytes;
    try {
      const bin = atob(B.data);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch (e) { ng(); return; }
    try {
      const p = ac.decodeAudioData(bytes.buffer, buf => { if (song) { song.buf = buf; mixSong(); } }, ng);
      if (p && p.catch) p.catch(ng);
    } catch (e) { ng(); }
  }
  function mixSong() {
    if (!song || !song.buf) return;
    const t = ac.currentTime, mx = SONG_MIX[want] || SONG_MIX.menu;
    if (!song.src) {
      const B = window.OSUNA_BGM, d = song.buf.duration;
      const src = ac.createBufferSource();
      src.buffer = song.buf;
      src.loop = true;
      src.loopStart = Math.max(0, Math.min(B.loopStart, d - 1));
      src.loopEnd = Math.max(src.loopStart + 0.5, Math.min(B.loopEnd, d));
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = mx.lp; lp.Q.value = 0.5;
      const gain = ac.createGain(); gain.gain.setValueAtTime(0.0001, t);
      src.connect(lp); lp.connect(gain); gain.connect(master);
      // 2回目からは前奏をとばして、ループの頭から
      src.start(t + 0.05, song.played ? src.loopStart : 0);
      song.played = true;
      Object.assign(song, { src, lp, gain });
    }
    song.gain.gain.setTargetAtTime(mx.vol, t, want === 'off' ? 0.08 : 0.6);
    song.lp.frequency.setTargetAtTime(mx.lp, t, 0.25);
  }

  function applyMusic() {
    if (song) mixSong();
    if (!ac || want === mode) return;
    if (mode === 'play') stopDrone();
    mode = want;
    const t = ac.currentTime + 0.08;
    nextBar = t; nextBeat = t; barNo = 0;
    if (mode === 'play') startDrone();
  }
  function tick() {
    if (!ac) return;
    applyMusic();
    const ahead = ac.currentTime + 0.25;
    if (mode === 'menu') {
      if (song) nextBar = ahead;   // 曲ファイルがあるときは合成の曲を鳴らさない
      while (nextBar < ahead) { playBar(nextBar, barNo++); nextBar += BAR; }
    } else if (mode === 'play') {
      while (nextBeat < ahead) { heartbeat(nextBeat); nextBeat += 60 / (56 + inten * 96); }
      if (drone) {
        const t = ac.currentTime;
        drone.fl.frequency.setTargetAtTime(200 + inten * 1500, t, 0.3);
        drone.o2.frequency.setTargetAtTime(880 + inten * 500, t, 0.3);
        drone.g2.gain.setTargetAtTime(inten * inten * 0.018, t, 0.3);
      }
    }
  }

  return {
    init,
    se(name, arg) { if (ac && on && SE[name]) SE[name](arg); },
    music(m) { want = m; applyMusic(); },
    intensity(x) { inten = Math.max(0, Math.min(1, x)); },
    duck(b) { ducked = b; if (master) master.gain.setTargetAtTime(level(), ac.currentTime, 0.03); },
    setOn(b) { on = b; if (master) master.gain.setTargetAtTime(level(), ac.currentTime, 0.05); }
  };
})();
