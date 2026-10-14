/* =========================================================
   audio.js — 音はすべてその場で合成する(音声ファイルなし)
   ・エンジン:排気の「パルス」を1発ずつ描いた波形をループ再生し、
     回転数に合わせて速さを変える(回転数の違う3本をクロスフェード)
   ・ターボの笛・ブローオフ、ハイブリッドのモーター音、ギアの唸り
   ・タイヤのスキール、風、ロードノイズ、縁石、砂利、衝突
   ・メニュー用の環境音楽(リバーブつき)
   ========================================================= */
var RaceAudio = (function () {
  var ctx = null, master, comp, buses = {}, reverb, noiseBuf, brownBuf;
  var cache = {};
  var vol = { master: 0.8, engine: 0.9, sfx: 0.8, music: 0.55 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = vol.master;
    master.connect(comp); comp.connect(ctx.destination);
    ['engine', 'sfx', 'music', 'amb'].forEach(function (k) { var g = ctx.createGain(); g.gain.value = vol[k] != null ? vol[k] : 0.7; g.connect(master); buses[k] = g; });
    // リバーブ(残響)
    reverb = ctx.createConvolver();
    reverb.buffer = makeIR(3.2, 2.6);
    var rg = ctx.createGain(); rg.gain.value = 0.9; reverb.connect(rg); rg.connect(master);
    // ノイズ
    var len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0), r = rng(99);
    for (var i = 0; i < len; i++) d[i] = r() * 2 - 1;
    brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var bd = brownBuf.getChannelData(0), last = 0;
    for (i = 0; i < len; i++) { last = (last + 0.02 * (r() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    return true;
  }
  function makeIR(sec, decay) {
    var sr = ctx.sampleRate, len = Math.floor(sr * sec), b = ctx.createBuffer(2, len, sr), r = rng(7);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < sr * 0.01 ? i / (sr * 0.01) : 1);
    }
    return b;
  }
  function setVolume(k, v) {
    vol[k] = v;
    if (!ctx) return;
    if (k === 'master') master.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    else if (buses[k]) buses[k].gain.setTargetAtTime(v, ctx.currentTime, 0.05);
  }
  function noiseSrc(brown) {
    var s = ctx.createBufferSource(); s.buffer = brown ? brownBuf : noiseBuf; s.loop = true;
    s.loopStart = Math.random(); s.start(0, Math.random() * 1.5);
    return s;
  }
  function biquad(type, f, Q) { var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (Q != null) b.Q.value = Q; return b; }
  function gainNode(v) { var g = ctx.createGain(); g.gain.value = v || 0; return g; }
  function setT(param, v, tc) { param.setTargetAtTime(v, ctx.currentTime, tc || 0.03); }

  // ---------- エンジン音の波形を作る ----------
  function synthEngine(prof, refRpm, onLoad, seed) {
    var sr = ctx.sampleRate;
    var revs = prof.stroke === 4 ? 2 : 1;
    var Tc = 60 / refRpm * revs;
    var nCyc = Math.max(6, Math.round(0.3 / Tc));
    var len = Math.round(nCyc * Tc * sr);
    var T = len / sr / nCyc;
    var data = new Float32Array(len), r = rng(seed);
    var cylAmp = [];
    for (var k = 0; k < prof.pulses; k++) cylAmp.push(1 + (r() - 0.5) * prof.rough * 3);
    // 点火間隔のくせ(V4 は不等間隔ぎみ)
    var pattern = [];
    for (k = 0; k < prof.pulses; k++) {
      var base = k / prof.pulses;
      if (prof.kind === 'v4') base += (k % 2 ? 0.035 : -0.02);
      if (prof.kind === 'flat6') base += (k % 3 === 0 ? 0.012 : 0);
      pattern.push(base);
    }
    var forms = prof.formants;
    for (var cyc = 0; cyc < nCyc; cyc++) {
      for (k = 0; k < prof.pulses; k++) {
        var t0 = (cyc + pattern[k]) * T + (r() - 0.5) * T / prof.pulses * 0.04;
        var amp = cylAmp[k] * (1 + (r() - 0.5) * prof.rough);
        if (!onLoad) { amp *= 0.35 + r() * 0.3; if (r() < 0.06) amp *= 0.2; }
        var start = Math.floor(t0 * sr);
        for (var f = 0; f < forms.length; f++) {
          var fr = forms[f][0] * (onLoad ? 1 : 0.92), tau = forms[f][1] * (onLoad ? 1 : 0.8), A = forms[f][2] * amp * (onLoad ? 1 : (f === 0 ? 0.8 : 0.55));
          var n = Math.floor(tau * 7 * sr), ph = r() * 0.3;
          for (var j = 0; j < n; j++) {
            var tt = j / sr;
            data[(start + j) % len] += A * Math.exp(-tt / tau) * Math.sin(2 * Math.PI * fr * tt + ph);
          }
        }
        // 低い「ドン」
        var nb = Math.floor(0.006 * sr);
        for (j = 0; j < nb; j++) data[(start + j) % len] += amp * 0.6 * Math.exp(-j / sr / 0.0022) * (onLoad ? 1 : 0.5);
        // 排気のザラつき
        var nn = Math.floor(0.004 * sr), nz = prof.noise * (onLoad ? 1 : 1.5);
        for (j = 0; j < nn; j++) data[(start + j) % len] += (r() * 2 - 1) * nz * amp * Math.exp(-j / sr / 0.0014);
      }
    }
    // 直流を除いて正規化
    var mean = 0, i;
    for (i = 0; i < len; i++) mean += data[i];
    mean /= len;
    var pk = 0;
    for (i = 0; i < len; i++) { data[i] -= mean; pk = Math.max(pk, Math.abs(data[i])); }
    var buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
    for (i = 0; i < len; i++) out[i] = data[i] / pk * 0.9;
    return buf;
  }
  function engineSet(car) {
    if (cache[car.id]) return cache[car.id];
    var refs = [0.22, 0.45, 0.7, 0.95].map(function (f, k) {
      var rpm = Math.round(car.redline * f);
      return { rpm: rpm, on: synthEngine(car.sound, rpm, true, 11 + k), off: synthEngine(car.sound, rpm, false, 31 + k) };
    });
    cache[car.id] = refs;
    return refs;
  }
  function shaperCurve(k) {
    var n = 1024, c = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
    return c;
  }

  // ---------- エンジンの声 ----------
  function EngineVoice(car, dest, positional) {
    this.car = car;
    this.refs = engineSet(car);
    this.out = gainNode(0);
    this.pan = positional && ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    this.shaper = ctx.createWaveShaper(); this.shaper.curve = shaperCurve(car.sound.kind === 'rotary' ? 2.2 : 1.6); this.shaper.oversample = '2x';
    this.lp = biquad('lowpass', 3000, 0.7);
    this.body = biquad('peaking', 180, 1.0); this.body.gain.value = 4;
    this.mix = gainNode(1);
    this.mix.connect(this.shaper); this.shaper.connect(this.body); this.body.connect(this.lp); this.lp.connect(this.out);
    if (this.pan) { this.out.connect(this.pan); this.pan.connect(dest); } else this.out.connect(dest);
    var self = this;
    this.srcs = [];
    this.refs.forEach(function (rf) {
      ['on', 'off'].forEach(function (kind) {
        var s = ctx.createBufferSource(); s.buffer = rf[kind]; s.loop = true;
        var g = gainNode(0); s.connect(g); g.connect(self.mix);
        s.start(0, Math.random() * 0.2);
        self.srcs.push({ s: s, g: g, rpm: rf.rpm, kind: kind });
      });
    });
    this.alive = true;
  }
  EngineVoice.prototype.update = function (rpm, load, level, doppler) {
    if (!this.alive) return;
    var refs = this.refs, n = refs.length, lr = Math.log(rpm);
    // 回転数の近い2本を選んでクロスフェード
    var w = [];
    for (var k = 0; k < n; k++) w.push(0);
    if (rpm <= refs[0].rpm) w[0] = 1;
    else if (rpm >= refs[n - 1].rpm) w[n - 1] = 1;
    else for (k = 0; k < n - 1; k++) {
      if (rpm >= refs[k].rpm && rpm < refs[k + 1].rpm) {
        var t = (lr - Math.log(refs[k].rpm)) / (Math.log(refs[k + 1].rpm) - Math.log(refs[k].rpm));
        w[k] = Math.cos(t * Math.PI / 2); w[k + 1] = Math.sin(t * Math.PI / 2);
      }
    }
    var ld = clamp(load, 0, 1), dop = doppler || 1;
    for (var i = 0; i < this.srcs.length; i++) {
      var sObj = this.srcs[i], ri = i >> 1;
      var gl = w[ri] * (sObj.kind === 'on' ? Math.sqrt(ld) : Math.sqrt(1 - ld) * 0.8);
      setT(sObj.g.gain, gl, 0.02);
      sObj.s.playbackRate.setTargetAtTime(rpm / sObj.rpm * dop, ctx.currentTime, 0.012);
    }
    var rn = rpm / this.car.redline;
    setT(this.lp.frequency, 900 + ld * 5200 + rn * 2600, 0.03);
    setT(this.out.gain, level * (0.55 + 0.45 * ld) * (0.7 + rn * 0.4), 0.03);
  };
  EngineVoice.prototype.setPan = function (p) { if (this.pan) setT(this.pan.pan, clamp(p, -1, 1), 0.05); };
  EngineVoice.prototype.stop = function () {
    if (!this.alive) return;
    this.alive = false;
    var t = ctx.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    this.srcs.forEach(function (s) { try { s.s.stop(t + 0.3); } catch (e) {} });
    var o = this.out; setTimeout(function () { try { o.disconnect(); } catch (e) {} }, 600);
  };

  // ---------- 自分の車のまわりの音 ----------
  function PlayerRig(car) {
    var dest = buses.engine, sfx = buses.sfx;
    this.car = car;
    this.engine = new EngineVoice(car, dest, false);
    // 吸気音
    this.intake = noiseSrc(); this.inBp = biquad('bandpass', 600, 1.4); this.inG = gainNode(0);
    this.intake.connect(this.inBp); this.inBp.connect(this.inG); this.inG.connect(dest);
    // ターボの笛
    this.turbo = ctx.createOscillator(); this.turbo.type = 'sine'; this.turbo.frequency.value = 2000;
    this.turbo2 = ctx.createOscillator(); this.turbo2.type = 'triangle'; this.turbo2.frequency.value = 3000;
    this.tG = gainNode(0); this.turbo.connect(this.tG); var t2g = gainNode(0.3); this.turbo2.connect(t2g); t2g.connect(this.tG); this.tG.connect(dest);
    this.turbo.start(); this.turbo2.start();
    // ギアの唸り(ストレートカットギア)
    this.gw = ctx.createOscillator(); this.gw.type = 'triangle'; this.gwG = gainNode(0); this.gw.connect(this.gwG); this.gwG.connect(dest); this.gw.start();
    // ERS のモーター音
    this.ers = ctx.createOscillator(); this.ers.type = 'sawtooth'; this.ersBp = biquad('bandpass', 1000, 6); this.ersG = gainNode(0);
    this.ers.connect(this.ersBp); this.ersBp.connect(this.ersG); this.ersG.connect(dest); this.ers.start();
    this.ers2 = ctx.createOscillator(); this.ers2.type = 'sine'; this.ers2G = gainNode(0); this.ers2.connect(this.ers2G); this.ers2G.connect(dest); this.ers2.start();
    // タイヤのスキール
    this.sq = noiseSrc(); this.sqBp1 = biquad('bandpass', 950, 9); this.sqBp2 = biquad('bandpass', 1650, 12); this.sqG = gainNode(0);
    this.sq.connect(this.sqBp1); this.sq.connect(this.sqBp2); this.sqBp1.connect(this.sqG); this.sqBp2.connect(this.sqG); this.sqG.connect(sfx);
    this.sqLfo = ctx.createOscillator(); this.sqLfo.frequency.value = 7; var lfoG = gainNode(60); this.sqLfo.connect(lfoG); lfoG.connect(this.sqBp1.frequency); this.sqLfo.start();
    // ロック(低めのこすれ)
    this.lk = noiseSrc(); this.lkBp = biquad('bandpass', 520, 2.5); this.lkG = gainNode(0); this.lk.connect(this.lkBp); this.lkBp.connect(this.lkG); this.lkG.connect(sfx);
    // 風
    this.wind = noiseSrc(); this.wBp = biquad('bandpass', 500, 0.6); this.wLp = biquad('lowpass', 2200); this.wG = gainNode(0);
    this.wind.connect(this.wBp); this.wBp.connect(this.wLp); this.wLp.connect(this.wG); this.wG.connect(sfx);
    // ロードノイズ
    this.road = noiseSrc(true); this.rLp = biquad('lowpass', 220, 0.8); this.rG = gainNode(0);
    this.road.connect(this.rLp); this.rLp.connect(this.rG); this.rG.connect(sfx);
    // 縁石のゴトゴト
    this.kb = ctx.createOscillator(); this.kb.type = 'square'; this.kbLp = biquad('lowpass', 160, 2); this.kbG = gainNode(0);
    this.kb.connect(this.kbLp); this.kbLp.connect(this.kbG); this.kbG.connect(sfx); this.kb.start();
    // 砂利・芝
    this.gr = noiseSrc(); this.grBp = biquad('bandpass', 2400, 0.7); this.grG = gainNode(0); this.gr.connect(this.grBp); this.grBp.connect(this.grG); this.grG.connect(sfx);
    this.gs = noiseSrc(true); this.gsLp = biquad('lowpass', 500); this.gsG = gainNode(0); this.gs.connect(this.gsLp); this.gsLp.connect(this.gsG); this.gsG.connect(sfx);
    // 壁にこする音
    this.sc = noiseSrc(); this.scBp = biquad('bandpass', 3200, 1.5); this.scG = gainNode(0); this.sc.connect(this.scBp); this.scBp.connect(this.scG); this.scG.connect(sfx);
    this.nodes = [this.intake, this.turbo, this.turbo2, this.gw, this.ers, this.ers2, this.sq, this.sqLfo, this.lk, this.wind, this.road, this.kb, this.gr, this.gs, this.sc];
    this.gains = [this.inG, this.tG, this.gwG, this.ersG, this.ers2G, this.sqG, this.lkG, this.wG, this.rG, this.kbG, this.grG, this.gsG, this.scG];
    this.scrape = 0;
  }
  PlayerRig.prototype.update = function (c, dt, cut) {
    var d = this.car, s = d.sound, spd = c.speed, rn = c.rpm / d.redline;
    var load = c.thr * (c.limiterT > 0 ? 0.3 : 1) * (c.shiftT > 0 ? 0.35 : 1);
    var lvl = cut ? 0 : 1;
    this.engine.update(c.rpm, load, 0.85 * lvl);
    setT(this.inG.gain, (0.05 + c.thr * 0.16) * rn * lvl, 0.03);
    setT(this.inBp.frequency, 280 + rn * 1900, 0.03);
    if (s.turbo) {
      setT(this.turbo.frequency, 1600 + c.boost * 5200, 0.05);
      setT(this.turbo2.frequency, 2600 + c.boost * 7400, 0.05);
      setT(this.tG.gain, c.boost * c.boost * 0.045 * lvl, 0.06);
    }
    setT(this.gw.frequency, 260 + spd * 21 + (c.gear > 0 ? c.gear * 30 : 0), 0.03);
    setT(this.gwG.gain, (s.gearWhine || 0) * Math.min(1, spd / 50) * (0.3 + c.thr * 0.7) * lvl, 0.05);
    if (s.ersWhine && d.ers) {
      var e = c.ersP / d.ers.power, h = c.harvestP / d.ers.harvest;
      setT(this.ers.frequency, 180 + spd * 38, 0.04); setT(this.ersBp.frequency, 600 + spd * 60, 0.04);
      setT(this.ers2.frequency, 360 + spd * 76, 0.04);
      setT(this.ersG.gain, (e * 0.05 + h * 0.035) * lvl, 0.05); setT(this.ers2G.gain, (e * 0.02 + h * 0.03) * lvl, 0.05);
    }
    // タイヤ
    var onTarmac = c.surf[0] <= 2 || c.surf[2] <= 2;
    var sl = onTarmac ? clamp(c.slideLat * 0.8 + c.wheelspin * 0.6, 0, 1) * Math.min(1, spd / 6) : 0;
    setT(this.sqG.gain, sl * 0.32 * lvl, 0.04);
    setT(this.sqBp1.frequency, 850 + sl * 260 + spd * 2, 0.05);
    setT(this.lkG.gain, (onTarmac ? clamp(c.lock, 0, 1) * Math.min(1, spd / 10) : 0) * 0.35 * lvl, 0.03);
    setT(this.wG.gain, Math.pow(spd / 90, 2) * 0.22 * lvl, 0.1);
    setT(this.wBp.frequency, 380 + spd * 7, 0.1);
    setT(this.rG.gain, Math.min(1, spd / 70) * 0.32 * lvl, 0.08);
    var onKerb = 0, onGr = 0, onGrass = 0;
    for (var i = 0; i < 4; i++) { if (c.surf[i] === 1) onKerb++; if (c.surf[i] === 4) onGr++; if (c.surf[i] === 3) onGrass++; }
    setT(this.kb.frequency, Math.max(8, spd / 1.0), 0.02);
    setT(this.kbG.gain, onKerb / 4 * Math.min(1, spd / 15) * 0.5 * lvl, 0.02);
    setT(this.grG.gain, onGr / 4 * Math.min(1, spd / 10) * 0.35 * lvl, 0.04);
    setT(this.gsG.gain, (onGr + onGrass) / 4 * Math.min(1, spd / 10) * 0.45 * lvl, 0.04);
    this.scrape = Math.max(0, this.scrape - dt * 4);
    setT(this.scG.gain, this.scrape * 0.4 * lvl, 0.03);
  };
  PlayerRig.prototype.stop = function () {
    this.engine.stop();
    var t = ctx.currentTime;
    this.gains.forEach(function (g) { g.gain.setTargetAtTime(0, t, 0.05); });
    this.nodes.forEach(function (n) { try { n.stop(t + 0.3); } catch (e) {} });
  };

  // ---------- 1回だけ鳴る音 ----------
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0.0001, t + a, dec); }
  function burst(dest, f, Q, type, peak, dec, dur, fEnd) {
    var t = ctx.currentTime, n = ctx.createBufferSource(); n.buffer = noiseBuf;
    var b = biquad(type || 'bandpass', f, Q), g = gainNode(0);
    if (fEnd) b.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    n.connect(b); b.connect(g); g.connect(dest);
    env(g, t, 0.003, peak, dec);
    n.start(t, Math.random()); n.stop(t + dur + dec * 5);
  }
  function tone(dest, f, type, peak, dec, dur, fEnd, delay) {
    var t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = gainNode(0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    o.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.005); g.gain.setTargetAtTime(0.0001, t + Math.max(0.005, dur - dec), dec);
    o.start(t); o.stop(t + dur + dec * 6);
  }
  function se(name, k) {
    if (!ctx) return;
    var sfx = buses.sfx; k = k == null ? 1 : k;
    switch (name) {
      case 'shift': burst(sfx, 1800, 1, 'bandpass', 0.18, 0.012, 0.03); tone(sfx, 90, 'sine', 0.25, 0.04, 0.06, 50); break;
      case 'clunk': burst(sfx, 700, 1, 'bandpass', 0.2, 0.02, 0.05); tone(sfx, 70, 'triangle', 0.3, 0.05, 0.08, 45); break;
      case 'pop': burst(buses.engine, 600 + Math.random() * 900, 0.8, 'lowpass', 0.35 + k * 0.4, 0.03 + Math.random() * 0.04, 0.12); tone(buses.engine, 70 + Math.random() * 40, 'sine', 0.3 * k + 0.1, 0.03, 0.05, 40); break;
      case 'blowoff': burst(sfx, 3200, 1.6, 'bandpass', 0.22 * k, 0.12, 0.45, 900); break;
      case 'hit':
        tone(sfx, 58, 'sine', 0.9 * k, 0.12, 0.3, 32);
        burst(sfx, 900, 0.7, 'lowpass', 0.8 * k, 0.12, 0.35);
        [420, 1130, 2370, 3410].forEach(function (f, i) { tone(sfx, f * (0.95 + Math.random() * 0.1), 'sine', 0.12 * k / (i + 1), 0.25, 0.3); });
        break;
      case 'beep': tone(sfx, 880, 'sine', 0.3, 0.06, 0.2); break;
      case 'go': tone(sfx, 1320, 'sine', 0.35, 0.2, 0.6); tone(sfx, 660, 'sine', 0.2, 0.2, 0.6); break;
      case 'click': tone(sfx, 1700, 'sine', 0.12, 0.015, 0.03); tone(sfx, 3400, 'sine', 0.04, 0.01, 0.02); break;
      case 'select': tone(sfx, 990, 'sine', 0.14, 0.06, 0.08); tone(sfx, 1480, 'sine', 0.1, 0.08, 0.1, null, 0.06); break;
      case 'back': tone(sfx, 880, 'sine', 0.12, 0.05, 0.06, 600); break;
      case 'deny': tone(sfx, 300, 'square', 0.06, 0.04, 0.08); tone(sfx, 220, 'square', 0.06, 0.05, 0.1, null, 0.1); break;
      case 'lap': [1047, 1319, 1568].forEach(function (f, i) { tone(sfx, f, 'sine', 0.18, 0.3, 0.4, null, i * 0.08); }); break;
      case 'best': [1047, 1319, 1568, 2093].forEach(function (f, i) { tone(sfx, f, 'triangle', 0.16, 0.35, 0.5, null, i * 0.07); }); break;
      case 'start': tone(sfx, 220, 'sine', 0.3, 0.8, 1.6, 880); burst(sfx, 4000, 0.5, 'highpass', 0.08, 0.6, 1.5); break;
    }
  }
  function scrape(rig, k) { if (rig) rig.scrape = Math.max(rig.scrape, k); }

  // ---------- 環境音楽(タイトル・メニュー)----------
  var music = null;
  function startMusic() {
    if (!ctx || music) return;
    var out = gainNode(0); out.connect(buses.music);
    var send = gainNode(0.6); out.connect(send); send.connect(reverb);
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
    var chords = [[57, 64, 67, 71, 74], [53, 60, 64, 67, 72], [48, 55, 59, 64, 67], [52, 59, 62, 67, 71]];
    var scale = [69, 72, 74, 76, 79, 81, 84, 86, 88];
    var step = 0, nextT = ctx.currentTime + 0.1, voices = [], timer;
    var lp = biquad('lowpass', 900, 0.6); lp.connect(out);
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; var lg = gainNode(500); lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    var windN = noiseSrc(); var wb = biquad('bandpass', 420, 0.5), wg = gainNode(0.05); windN.connect(wb); wb.connect(wg); wg.connect(out);
    var wl = ctx.createOscillator(); wl.frequency.value = 0.11; var wlg = gainNode(240); wl.connect(wlg); wlg.connect(wb.frequency); wl.start();
    function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function schedule() {
      while (nextT < ctx.currentTime + 1.0) {
        var ch = chords[step % chords.length], dur = 8;
        ch.forEach(function (n, i) {
          [-1, 1].forEach(function (det) {
            var o = ctx.createOscillator(); o.type = i === 0 ? 'triangle' : 'sawtooth';
            o.frequency.value = mtof(n - (i === 0 ? 12 : 0)); o.detune.value = det * 7;
            var g = gainNode(0); o.connect(g); g.connect(lp);
            var pk = (i === 0 ? 0.07 : 0.028);
            g.gain.setValueAtTime(0, nextT); g.gain.linearRampToValueAtTime(pk, nextT + 2.6); g.gain.setValueAtTime(pk, nextT + dur - 1); g.gain.linearRampToValueAtTime(0, nextT + dur + 2.5);
            o.start(nextT); o.stop(nextT + dur + 3);
          });
        });
        // きらめく単音
        for (var k = 0; k < 5; k++) {
          var tt = nextT + 0.6 + k * 1.5 + Math.random() * 0.5, f = mtof(scale[Math.floor(Math.random() * scale.length)]);
          var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f;
          var g2 = gainNode(0); o2.connect(g2); g2.connect(send);
          var g3 = gainNode(0.4); g2.connect(g3); g3.connect(out);
          g2.gain.setValueAtTime(0, tt); g2.gain.linearRampToValueAtTime(0.05, tt + 0.01); g2.gain.setTargetAtTime(0, tt + 0.02, 0.6);
          o2.start(tt); o2.stop(tt + 4);
        }
        nextT += dur; step++;
      }
    }
    schedule();
    timer = setInterval(schedule, 400);
    music = { out: out, stop: function () { clearInterval(timer); out.gain.setTargetAtTime(0, ctx.currentTime, 0.8); var o = out; setTimeout(function () { try { lfo.stop(); wl.stop(); windN.stop(); o.disconnect(); } catch (e) {} }, 4000); } };
  }
  function stopMusic() { if (music) { music.stop(); music = null; } }

  // 観客のざわめき・遠くのアナウンス風の環境音
  var amb = null;
  function startAmbience(kind) {
    if (!ctx) return;
    stopAmbience();
    var n = noiseSrc(), bp = biquad('bandpass', 900, 0.5), g = gainNode(0);
    n.connect(bp); bp.connect(g); g.connect(buses.amb);
    var n2 = noiseSrc(true), lp = biquad('lowpass', 300), g2 = gainNode(0);
    n2.connect(lp); lp.connect(g2); g2.connect(buses.amb);
    amb = { n: n, n2: n2, g: g, g2: g2, base: kind === 'forest' ? 0.02 : 0.035 };
    g2.gain.setTargetAtTime(0.06, ctx.currentTime, 1);
  }
  function crowd(level) { if (amb) setT(amb.g.gain, amb.base + level * 0.12, 0.3); }
  function stopAmbience() { if (amb) { var a = amb; a.g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); a.g2.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(function () { try { a.n.stop(); a.n2.stop(); } catch (e) {} }, 1500); amb = null; } }

  function pause(p) { if (!ctx) return; if (p) ctx.suspend(); else ctx.resume(); }

  return {
    init: init, ready: function () { return !!ctx; }, ctx: function () { return ctx; },
    EngineVoice: function (car) { return new EngineVoice(car, buses.engine, true); },
    PlayerRig: function (car) { return new PlayerRig(car); },
    prepare: function (car) { if (ctx) engineSet(car); },
    se: se, scrape: scrape, setVolume: setVolume, vol: vol,
    startMusic: startMusic, stopMusic: stopMusic, startAmbience: startAmbience, stopAmbience: stopAmbience, crowd: crowd, pause: pause
  };
})();
