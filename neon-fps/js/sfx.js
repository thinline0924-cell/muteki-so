// 夜光区 — 音(Web Audio でその場で合成)
// ・銃声は「アタック(カチッ)+胴(ノイズ)+低音のドン+メカ音+残響」を重ねて作る
// ・ビルの谷間の反響(短いエコー)と、3D の位置(左右・距離)をつける
// ・BGM は戦いの激しさに合わせて楽器が増えるシンセウェーブ
(function () {
  var M = NF.M;
  var S = { ready: false, vol: { master: 0.8, sfx: 0.9, music: 0.55 } };
  var ac, master, sfxBus, musicBus, ambBus, reverb, revSend, echo, echoSend, comp, muffle, noiseBuf, pinkBuf;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  S.init = function () {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    S.ac = ac;
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    muffle = ac.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000; muffle.Q.value = 0.5;
    master = ac.createGain(); master.gain.value = S.vol.master;
    muffle.connect(comp); comp.connect(master); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = S.vol.sfx; sfxBus.connect(muffle);
    musicBus = ac.createGain(); musicBus.gain.value = S.vol.music; musicBus.connect(comp);
    ambBus = ac.createGain(); ambBus.gain.value = 0.7; ambBus.connect(muffle);
    // 雑音の素
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pinkBuf = ac.createBuffer(2, ac.sampleRate * 4, ac.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var p = pinkBuf.getChannelData(ch), b0 = 0, b1 = 0, b2 = 0;
      for (i = 0; i < p.length; i++) {
        var w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056;
        p[i] = (b0 + b1 + b2 + w * 0.05) * 1.8;
      }
    }
    // 残響(街路の響き)
    reverb = ac.createConvolver();
    var len = ac.sampleRate * 2.2, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (ch = 0; ch < 2; ch++) {
      var r = ir.getChannelData(ch);
      for (i = 0; i < len; i++) {
        var t = i / ac.sampleRate;
        // 初期反射(ビルの壁)+ 減衰する響き
        var er = (Math.abs(t - 0.023 - ch * 0.007) < 0.002 || Math.abs(t - 0.061 + ch * 0.01) < 0.002 || Math.abs(t - 0.117) < 0.003) ? 0.6 : 0;
        r[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t / 2.2, 3.2) * 0.5 + er * (Math.random() - 0.5)) * (t < 0.01 ? t / 0.01 : 1);
      }
    }
    reverb.buffer = ir;
    revSend = ac.createGain(); revSend.gain.value = 0.32;
    revSend.connect(reverb); reverb.connect(muffle);
    // ビルの谷間のこだま
    echo = ac.createDelay(1); echo.delayTime.value = 0.19;
    var fb = ac.createGain(); fb.gain.value = 0.28;
    var ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 2400;
    echo.connect(ef); ef.connect(fb); fb.connect(echo); ef.connect(muffle);
    echoSend = ac.createGain(); echoSend.gain.value = 0.22; echoSend.connect(echo);
    S.ready = true;
    S.setVolumes();
  };
  S.setVolumes = function () {
    if (!ac) return;
    master.gain.value = S.vol.master; sfxBus.gain.value = S.vol.sfx; musicBus.gain.value = S.vol.music;
  };

  // ---------------- 部品 ----------------
  function now() { return ac.currentTime; }
  function out(o) {
    // o: {pos:[x,y,z]} なら 3D、なければ画面中央
    var g = ac.createGain();
    if (o && o.pos) {
      var p = ac.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = o.ref || 4; p.maxDistance = 200; p.rolloffFactor = o.roll || 1.2;
      if (p.positionX) { p.positionX.value = o.pos[0]; p.positionY.value = o.pos[1]; p.positionZ.value = o.pos[2]; }
      else p.setPosition(o.pos[0], o.pos[1], o.pos[2]);
      g.connect(p); p.connect(sfxBus);
      if (o.rev !== 0) { var rs = ac.createGain(); rs.gain.value = (o.rev || 1) * 0.8; p.connect(rs); rs.connect(revSend); }
    } else {
      g.connect(sfxBus);
      if (o && o.rev) { var rs2 = ac.createGain(); rs2.gain.value = o.rev; g.connect(rs2); rs2.connect(revSend); }
      if (o && o.echo) { var es = ac.createGain(); es.gain.value = o.echo; g.connect(es); es.connect(echoSend); }
    }
    return g;
  }
  function env(g, t, a, peak, dec, sustain) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + dec);
  }
  function noise(dest, t, dur, type, freq, q, peak, attack, rate) {
    attack = attack || 0.001;
    var s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rate || 1;
    var f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1;
    var g = ac.createGain(); env(g, t, attack, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + attack + 0.05);
    return { src: s, f: f, g: g };
  }
  function tone(dest, t, type, f0, f1, dur, peak, attack) {
    attack = attack || 0.002;
    var o = ac.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    var g = ac.createGain(); env(g, t, attack, peak, dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + attack + 0.05);
    return { o: o, g: g };
  }
  // 歪み(爆発・ショットガンの迫力)
  var curveCache = {};
  function shaper(amount) {
    if (!curveCache[amount]) {
      var n = 1024, c = new Float32Array(n);
      for (var i = 0; i < n; i++) { var x = i / n * 2 - 1; c[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); }
      curveCache[amount] = c;
    }
    var w = ac.createWaveShaper(); w.curve = curveCache[amount]; w.oversample = '2x';
    return w;
  }

  // ---------------- 銃声 ----------------
  // p: {click, body, bodyQ, bodyDur, thump, thumpDur, mech, tail, gain, dist}
  function gunshot(p, opt) {
    var t = now() + 0.005, pit = rnd(0.94, 1.06) * (opt && opt.pitch || 1);
    var o = out(opt && opt.pos ? { pos: opt.pos, ref: 6, roll: 1 } : { rev: p.tail || 0.6, echo: p.echo || 0.5 });
    o.gain.value = p.gain || 1;
    var dist = shaper(p.drive || 3);
    dist.connect(o);
    // カチッ(火薬の破裂の最初の一瞬)
    noise(o, t, 0.012, 'highpass', 3500 * pit, 0.7, 0.9);
    // 胴
    noise(dist, t, (p.bodyDur || 0.12) * pit, 'bandpass', (p.body || 1500) * pit, p.bodyQ || 0.9, 0.9);
    noise(dist, t, (p.bodyDur || 0.12) * 1.8, 'lowpass', (p.body || 1500) * 0.6 * pit, 0.5, 0.45, 0.004);
    // ドン(低音)
    tone(dist, t, 'sine', (p.thump || 140) * pit, 38, p.thumpDur || 0.14, p.thumpGain || 0.9);
    tone(o, t, 'triangle', (p.thump || 140) * 2.1 * pit, 60, 0.05, 0.3);
    // メカ音(遊底が動くカチャ)
    if (p.mech) {
      tone(o, t + 0.035, 'square', 2300 * pit, 1800, 0.012, 0.06);
      noise(o, t + 0.04, 0.025, 'bandpass', 4200, 4, 0.15);
    }
    // 薬莢が落ちる音(少し遅れて地面で鳴る)
    if (p.shell && Math.random() < 0.7) {
      var tt = t + rnd(0.35, 0.55);
      for (var k = 0; k < 2; k++) tone(o, tt + k * rnd(0.05, 0.09), 'sine', rnd(5200, 6800), rnd(4800, 6000), 0.06, 0.035 / (k + 1));
    }
  }

  var GUNS = {
    pistol: { body: 1900, bodyDur: 0.09, thump: 150, thumpDur: 0.12, mech: 1, shell: 1, tail: 0.55, echo: 0.45, gain: 0.75, drive: 3 },
    smg: { body: 2600, bodyDur: 0.06, thump: 170, thumpDur: 0.08, mech: 1, shell: 1, tail: 0.35, echo: 0.3, gain: 0.55, drive: 2.5 },
    rifle: { body: 1250, bodyDur: 0.13, thump: 120, thumpDur: 0.16, mech: 1, shell: 1, tail: 0.65, echo: 0.55, gain: 0.8, drive: 4 },
    shotgun: { body: 750, bodyDur: 0.24, bodyQ: 0.6, thump: 85, thumpDur: 0.28, thumpGain: 1.2, tail: 1, echo: 0.8, gain: 1, drive: 7 },
    enemy: { body: 2200, bodyDur: 0.07, thump: 160, thumpDur: 0.08, tail: 0.6, gain: 0.5, drive: 2 }
  };
  S.shoot = function (kind, opt) {
    if (!S.ready) return;
    if (GUNS[kind]) gunshot(GUNS[kind], opt);
    var t = now() + 0.005, o;
    if (kind === 'shotgun') {
      // ポンプ: 引いて戻す
      o = out({ rev: 0.2 });
      noise(o, t + 0.32, 0.05, 'bandpass', 1400, 3, 0.35);
      tone(o, t + 0.32, 'square', 900, 500, 0.03, 0.06);
      noise(o, t + 0.46, 0.04, 'bandpass', 2200, 3, 0.4);
      tone(o, t + 0.46, 'square', 1300, 900, 0.025, 0.07);
    } else if (kind === 'rail') {
      o = out({ rev: 1.2, echo: 0.8 }); o.gain.value = 0.9;
      noise(o, t, 0.03, 'highpass', 5000, 0.7, 1);
      var z = tone(o, t, 'sawtooth', 3200, 90, 0.55, 0.35);
      var bp = ac.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 6000; z.o.disconnect(); z.o.connect(bp); bp.connect(z.g);
      tone(o, t, 'sine', 90, 30, 0.6, 1.0);
      tone(o, t, 'sine', 1760, 1700, 1.2, 0.12, 0.01);
      tone(o, t, 'sine', 2637, 2600, 0.9, 0.07, 0.01);
      noise(o, t + 0.02, 0.6, 'bandpass', 900, 2, 0.25);
    } else if (kind === 'rocket') {
      o = out({ rev: 0.8, echo: 0.6 }); o.gain.value = 0.9;
      var n = noise(o, t, 0.5, 'lowpass', 900, 0.8, 0.8, 0.03);
      n.f.frequency.setValueAtTime(400, t); n.f.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
      tone(o, t, 'sine', 120, 45, 0.25, 0.9);
      noise(o, t, 0.03, 'highpass', 3000, 0.7, 0.5);
    } else if (kind === 'needle') {
      o = out({ rev: 0.5 }); o.gain.value = 0.45;
      tone(o, t, 'sine', rnd(1900, 2300), 700, 0.09, 0.4);
      tone(o, t, 'triangle', rnd(3800, 4300), 2000, 0.05, 0.15);
      noise(o, t, 0.03, 'highpass', 6000, 1, 0.3);
    } else if (kind === 'laser') { // 敵のプラズマ弾
      o = out(opt && opt.pos ? { pos: opt.pos, ref: 5 } : {}); o.gain.value = 0.5;
      tone(o, t, 'sawtooth', rnd(1300, 1500), 220, 0.16, 0.25);
      tone(o, t, 'square', rnd(650, 700), 120, 0.12, 0.08);
    } else if (kind === 'sniper') {
      gunshot({ body: 1000, bodyDur: 0.2, thump: 100, thumpDur: 0.25, tail: 1.2, gain: 1.0, drive: 5 }, opt);
      o = out(opt && opt.pos ? { pos: opt.pos, ref: 20, roll: 0.6 } : {});
      tone(o, t, 'sawtooth', 2400, 200, 0.3, 0.2);
    }
  };
  S.dry = function () {
    if (!S.ready) return; var t = now(); var o = out({});
    tone(o, t, 'square', 1800, 1500, 0.015, 0.12); noise(o, t, 0.02, 'bandpass', 3500, 5, 0.2);
  };

  // レールガンのため(チャージ音)。戻り値の stop() で止める
  S.charge = function () {
    if (!S.ready) return { stop: function () {}, set: function () {} };
    var t = now(), o = out({ rev: 0.2 });
    var osc = ac.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, t);
    var osc2 = ac.createOscillator(); osc2.type = 'sine'; osc2.frequency.setValueAtTime(360, t);
    var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6; f.frequency.setValueAtTime(400, t);
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.1);
    var lfo = ac.createOscillator(); lfo.frequency.value = 28; var lg = ac.createGain(); lg.gain.value = 0.08; lfo.connect(lg); lg.connect(g.gain);
    osc.connect(f); osc2.connect(f); f.connect(g); g.connect(o);
    osc.start(t); osc2.start(t); lfo.start(t);
    return {
      set: function (k) { var tt = now(); osc.frequency.setTargetAtTime(180 + k * 1400, tt, 0.03); osc2.frequency.setTargetAtTime(360 + k * 2600, tt, 0.03); f.frequency.setTargetAtTime(400 + k * 4000, tt, 0.03); lfo.frequency.setTargetAtTime(28 + k * 40, tt, 0.05); },
      stop: function () { var tt = now(); g.gain.cancelScheduledValues(tt); g.gain.setTargetAtTime(0.0001, tt, 0.02); osc.stop(tt + 0.2); osc2.stop(tt + 0.2); lfo.stop(tt + 0.2); }
    };
  };
  // アークガン(撃っている間ずっと鳴る)
  S.beam = function () {
    if (!S.ready) return { stop: function () {}, set: function () {} };
    var t = now(), o = out({ rev: 0.3 });
    var a = ac.createOscillator(); a.type = 'sawtooth'; a.frequency.value = 110;
    var b = ac.createOscillator(); b.type = 'square'; b.frequency.value = 55.7;
    var fm = ac.createOscillator(); fm.frequency.value = 37; var fmg = ac.createGain(); fmg.gain.value = 60; fm.connect(fmg); fmg.connect(a.frequency);
    var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.5;
    var n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    var nf = ac.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 4000;
    var ng = ac.createGain(); ng.gain.value = 0.18;
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.05);
    var ds = shaper(5);
    a.connect(ds); b.connect(ds); ds.connect(f); f.connect(g); n.connect(nf); nf.connect(ng); ng.connect(g); g.connect(o);
    a.start(t); b.start(t); fm.start(t); n.start(t);
    var iv = setInterval(function () { // パチパチ
      if (!ac) return; var tt = now();
      f.frequency.setTargetAtTime(900 + Math.random() * 2600, tt, 0.01);
      ng.gain.setTargetAtTime(0.05 + Math.random() * 0.3, tt, 0.005);
    }, 45);
    return {
      set: function (k) { a.frequency.setTargetAtTime(110 + k * 60, now(), 0.05); },
      stop: function () { clearInterval(iv); var tt = now(); g.gain.cancelScheduledValues(tt); g.gain.setTargetAtTime(0.0001, tt, 0.03); [a, b, fm, n].forEach(function (x) { x.stop(tt + 0.25); }); tone(out({}), tt, 'sine', 400, 80, 0.15, 0.15); }
    };
  };

  // ---------------- リロード・持ち替え ----------------
  S.reloadStep = function (step, kind) {
    if (!S.ready) return; var t = now(), o = out({ rev: 0.15 });
    var heavy = kind === 'shotgun' || kind === 'rocket' || kind === 'rail';
    if (step === 'out') { // マガジンを抜く
      tone(o, t, 'square', 700, 400, 0.02, 0.12); noise(o, t, 0.06, 'bandpass', 1600, 2, 0.35);
      noise(o, t + 0.03, 0.12, 'bandpass', 3000, 1, 0.12, 0.02);
    } else if (step === 'in') { // 差しこむ
      noise(o, t, 0.05, 'lowpass', 900, 1, 0.5); tone(o, t, 'sine', heavy ? 160 : 220, 90, 0.07, 0.5);
      tone(o, t + 0.02, 'square', 2400, 2000, 0.015, 0.1);
    } else if (step === 'bolt') { // 引いて戻す
      noise(o, t, 0.035, 'bandpass', 2600, 3, 0.4); tone(o, t, 'square', 1500, 1100, 0.02, 0.1);
      noise(o, t + 0.11, 0.03, 'bandpass', 3400, 3, 0.45); tone(o, t + 0.11, 'square', 1900, 1600, 0.02, 0.12);
    } else if (step === 'shell') { // ショットガンの弾込め
      noise(o, t, 0.04, 'bandpass', 1900, 2, 0.35); tone(o, t + 0.015, 'sine', 500, 300, 0.05, 0.3);
    } else if (step === 'cell') { // エネルギーセル
      tone(o, t, 'sine', 300, 1200, 0.18, 0.18); tone(o, t + 0.16, 'sine', 1200, 1250, 0.2, 0.1);
      noise(o, t, 0.05, 'lowpass', 800, 1, 0.4);
    } else if (step === 'equip') {
      noise(o, t, 0.12, 'bandpass', 1200, 0.8, 0.2, 0.03); tone(o, t + 0.1, 'square', 1700, 1400, 0.02, 0.1);
      noise(o, t + 0.12, 0.03, 'bandpass', 3000, 3, 0.25);
    }
  };

  // ---------------- 当たり・撃破 ----------------
  S.hit = function (head, kill) {
    if (!S.ready) return; var t = now(), o = out({});
    if (head) { // カーン
      tone(o, t, 'sine', 1870, 1860, 0.28, 0.22); tone(o, t, 'sine', 2805, 2790, 0.2, 0.1); tone(o, t, 'triangle', 3740, 3700, 0.08, 0.05);
    } else {
      tone(o, t, 'sine', 2300, 1900, 0.035, 0.16); noise(o, t, 0.02, 'highpass', 5000, 1, 0.12);
    }
    if (kill) {
      tone(o, t + 0.02, 'sine', 140, 60, 0.12, 0.5);
      noise(o, t + 0.02, 0.06, 'lowpass', 1200, 1, 0.3);
      tone(o, t + 0.04, 'triangle', head ? 1318 : 988, head ? 1318 : 988, 0.18, 0.12);
    }
  };
  S.multikill = function (n) {
    if (!S.ready) return; var t = now(), o = out({ rev: 0.4 });
    var scale = [523, 659, 784, 1046, 1318, 1568];
    for (var i = 0; i < Math.min(n, 6); i++) tone(o, t + i * 0.05, 'triangle', scale[i], scale[i], 0.25, 0.1);
  };
  S.shieldHit = function (pos) {
    if (!S.ready) return; var t = now(), o = out({ pos: pos });
    tone(o, t, 'sine', 900, 400, 0.12, 0.3); tone(o, t, 'square', 3100, 2500, 0.05, 0.05); noise(o, t, 0.08, 'bandpass', 5000, 3, 0.2);
  };
  S.ricochet = function (pos) {
    if (!S.ready || Math.random() < 0.5) return; var t = now(), o = out({ pos: pos, ref: 3 });
    tone(o, t, 'sine', rnd(3000, 4500), rnd(1200, 2000), rnd(0.12, 0.3), 0.08);
  };
  S.impact = function (pos, metal) {
    if (!S.ready) return; var t = now(), o = out({ pos: pos, ref: 3, rev: 0.4 });
    if (metal) { tone(o, t, 'square', rnd(1800, 2600), 1400, 0.03, 0.06); noise(o, t, 0.04, 'bandpass', 4000, 3, 0.25); }
    else { noise(o, t, 0.05, 'bandpass', rnd(900, 1500), 1, 0.3); noise(o, t + 0.01, 0.12, 'highpass', 2500, 1, 0.06); }
  };
  // 敵のやられ(電気がはじけて、止まる)
  S.enemyDie = function (pos, big) {
    if (!S.ready) return; var t = now(), o = out({ pos: pos, ref: big ? 10 : 5, rev: 1 });
    for (var i = 0; i < 6; i++) noise(o, t + i * rnd(0.02, 0.06), 0.03, 'bandpass', rnd(2000, 7000), 4, 0.35);
    tone(o, t, 'sawtooth', big ? 300 : 600, 40, big ? 1.2 : 0.6, 0.18);
    tone(o, t, 'sine', 100, 30, 0.3, big ? 0.9 : 0.5);
    noise(o, t, big ? 0.6 : 0.25, 'lowpass', 800, 1, big ? 0.7 : 0.4);
  };

  // ---------------- 爆発 ----------------
  S.explode = function (pos, size) {
    if (!S.ready) return; size = size || 1;
    var t = now(), o = out({ pos: pos, ref: 10 * size, roll: 0.8, rev: 1.6 }); o.gain.value = Math.min(1.4, 0.8 * size);
    var ds = shaper(8); ds.connect(o);
    var n = noise(ds, t, 1.4 * size, 'lowpass', 2400, 0.7, 1.0, 0.003);
    n.f.frequency.setValueAtTime(3000, t); n.f.frequency.exponentialRampToValueAtTime(160, t + 1.2 * size);
    tone(ds, t, 'sine', 70, 25, 0.9 * size, 1.2);
    tone(o, t, 'sine', 45, 20, 1.4 * size, 0.6, 0.01);
    noise(o, t, 0.02, 'highpass', 2000, 0.7, 1);
    for (var i = 0; i < 8; i++) noise(o, t + 0.15 + Math.random() * 0.8, 0.05, 'bandpass', rnd(1500, 5000), 3, 0.08); // 破片
    // こだま
    var e = out({ echo: 0.9 }); e.gain.value = 0.4;
    noise(e, t, 0.4, 'lowpass', 600, 0.7, 0.6);
  };

  // ---------------- 動き ----------------
  S.step = function (surface, sprint) {
    if (!S.ready) return; var t = now(), o = out({}); o.gain.value = sprint ? 0.5 : 0.35;
    if (surface === 'metal') {
      tone(o, t, 'triangle', rnd(240, 320), 150, 0.08, 0.25); noise(o, t, 0.05, 'bandpass', rnd(900, 1300), 3, 0.3);
      tone(o, t, 'sine', rnd(1700, 2100), 1600, 0.1, 0.03);
    } else {
      noise(o, t, 0.06, 'lowpass', rnd(500, 700), 1, 0.5);
      noise(o, t + 0.005, 0.09, 'bandpass', rnd(3000, 4500), 1.2, 0.22); // 水のはね
      noise(o, t + 0.03, 0.06, 'highpass', 6000, 1, 0.05);
    }
  };
  S.jump = function () { if (!S.ready) return; var t = now(), o = out({}); noise(o, t, 0.1, 'bandpass', 900, 1, 0.15, 0.02); };
  S.land = function (v) {
    if (!S.ready) return; var t = now(), o = out({}); var k = M.clamp(v / 18, 0.2, 1.2);
    noise(o, t, 0.12, 'lowpass', 400, 1, 0.6 * k); tone(o, t, 'sine', 90, 45, 0.12, 0.6 * k);
    noise(o, t, 0.15, 'bandpass', 3500, 1, 0.2 * k);
  };
  S.dash = function () {
    if (!S.ready) return; var t = now(), o = out({ rev: 0.3 });
    var n = noise(o, t, 0.28, 'bandpass', 600, 1.5, 0.6, 0.02);
    n.f.frequency.setValueAtTime(400, t); n.f.frequency.exponentialRampToValueAtTime(4000, t + 0.2);
    tone(o, t, 'sawtooth', 180, 900, 0.15, 0.08);
    tone(o, t, 'sine', 2000, 3500, 0.08, 0.05);
  };
  S.pad = function () {
    if (!S.ready) return; var t = now(), o = out({ rev: 0.6 });
    tone(o, t, 'sine', 180, 900, 0.35, 0.4); tone(o, t, 'square', 90, 450, 0.25, 0.06);
    var n = noise(o, t, 0.5, 'bandpass', 500, 1, 0.4, 0.03); n.f.frequency.exponentialRampToValueAtTime(3000, t + 0.4);
  };
  var slideNode = null;
  S.slide = function (on) {
    if (!S.ready) return;
    if (on && !slideNode) {
      var t = now(), s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
      var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.05);
      s.connect(f); f.connect(g); g.connect(out({})); s.start(t);
      slideNode = { s: s, g: g };
    } else if (!on && slideNode) {
      var tt = now(); slideNode.g.gain.setTargetAtTime(0.0001, tt, 0.05); slideNode.s.stop(tt + 0.3); slideNode = null;
    }
  };

  // ---------------- 刀 ----------------
  S.swing = function () {
    if (!S.ready) return; var t = now(), o = out({ rev: 0.3 });
    var n = noise(o, t, 0.22, 'bandpass', 700, 2.5, 0.7, 0.03);
    n.f.frequency.setValueAtTime(500, t); n.f.frequency.exponentialRampToValueAtTime(3500, t + 0.15);
  };
  S.slash = function (deflect) {
    if (!S.ready) return; var t = now(), o = out({ rev: 0.8 });
    // 金属が鳴る(倍音がずれた音)
    [1, 2.76, 5.4, 8.9].forEach(function (k, i) { tone(o, t, 'sine', 980 * k * (deflect ? 1.3 : 1), 980 * k, 0.5 / (i + 1), 0.12 / (i + 1)); });
    noise(o, t, 0.05, 'highpass', 4000, 1, 0.4);
    if (!deflect) { tone(o, t, 'sine', 120, 50, 0.15, 0.5); }
  };

  // ---------------- 自分 ----------------
  S.hurt = function (amount) {
    if (!S.ready) return; var t = now(), o = out({});
    tone(o, t, 'sine', 110, 50, 0.2, M.clamp(amount / 25, 0.2, 0.8));
    noise(o, t, 0.1, 'lowpass', 700, 1, 0.4);
    // 一瞬こもる
    muffle.frequency.cancelScheduledValues(t);
    muffle.frequency.setValueAtTime(Math.max(500, 2500 - amount * 50), t);
    muffle.frequency.setTargetAtTime(20000, t + 0.12, 0.25);
  };
  S.shieldBreak = function () { if (!S.ready) return; var t = now(), o = out({}); tone(o, t, 'square', 800, 100, 0.3, 0.15); noise(o, t, 0.3, 'highpass', 3000, 1, 0.3); };
  var hb = 0;
  S.heartbeat = function (rate) {
    if (!S.ready) return; var t = now();
    if (t < hb) return; hb = t + rate;
    var o = out({}); o.gain.value = 0.7;
    tone(o, t, 'sine', 60, 40, 0.12, 0.7); tone(o, t + 0.16, 'sine', 55, 38, 0.14, 0.5);
  };
  S.pickup = function (kind) {
    if (!S.ready) return; var t = now(), o = out({});
    if (kind === 'health') { tone(o, t, 'sine', 660, 660, 0.1, 0.15); tone(o, t + 0.07, 'sine', 990, 990, 0.15, 0.15); }
    else if (kind === 'ammo') { noise(o, t, 0.05, 'bandpass', 2000, 2, 0.3); tone(o, t + 0.03, 'square', 1200, 1100, 0.03, 0.06); }
    else if (kind === 'core') { [784, 988, 1175, 1568].forEach(function (f, i) { tone(o, t + i * 0.06, 'triangle', f, f, 0.2, 0.12); }); }
    else { tone(o, t, 'sine', 1400, 1800, 0.08, 0.1); tone(o, t + 0.05, 'sine', 2100, 2100, 0.1, 0.06); }
  };
  S.throwNade = function () { if (!S.ready) return; var t = now(), o = out({}); var n = noise(o, t, 0.2, 'bandpass', 800, 1.5, 0.3, 0.03); n.f.frequency.exponentialRampToValueAtTime(2000, t + 0.15); tone(o, t, 'square', 2600, 2400, 0.02, 0.06); };
  S.bounce = function (pos) { if (!S.ready) return; var t = now(), o = out({ pos: pos, ref: 3 }); tone(o, t, 'triangle', rnd(700, 900), 500, 0.06, 0.25); };
  S.beep = function (pos, hi) { if (!S.ready) return; var t = now(), o = out(pos ? { pos: pos, ref: 4 } : {}); tone(o, t, 'square', hi ? 1760 : 1320, hi ? 1760 : 1320, 0.05, 0.08); };

  // 敵の声・予兆
  S.enemyAlert = function (pos, type) {
    if (!S.ready) return; var t = now(), o = out({ pos: pos, ref: 6 });
    if (type === 'rusher') { var n = noise(o, t, 0.5, 'bandpass', 300, 3, 0.5, 0.05); var l = ac.createOscillator(); l.frequency.value = 30; var lg = ac.createGain(); lg.gain.value = 200; l.connect(lg); lg.connect(n.f.frequency); l.start(t); l.stop(t + 0.6); }
    else if (type === 'heavy') { tone(o, t, 'sawtooth', 80, 70, 0.6, 0.25); tone(o, t, 'square', 120, 110, 0.6, 0.06); }
    else { tone(o, t, 'square', 880, 880, 0.06, 0.08); tone(o, t + 0.08, 'square', 1175, 1175, 0.08, 0.08); }
  };
  S.sniperCharge = function (pos) {
    if (!S.ready) return; var t = now(), o = out({ pos: pos, ref: 25, roll: 0.5 });
    tone(o, t, 'sine', 400, 2400, 1.3, 0.25, 0.05);
    tone(o, t, 'square', 200, 1200, 1.3, 0.03, 0.05);
  };
  S.leap = function (pos) { if (!S.ready) return; var t = now(), o = out({ pos: pos, ref: 5 }); var n = noise(o, t, 0.3, 'bandpass', 500, 2, 0.6, 0.02); n.f.frequency.exponentialRampToValueAtTime(2500, t + 0.25); };
  S.stomp = function (pos, big) { if (!S.ready) return; var t = now(), o = out({ pos: pos, ref: big ? 14 : 6 }); tone(o, t, 'sine', big ? 55 : 80, 30, big ? 0.5 : 0.18, big ? 1 : 0.5); noise(o, t, 0.1, 'lowpass', 300, 1, 0.4); };
  S.teleport = function (pos) { if (!S.ready) return; var t = now(), o = out({ pos: pos, ref: 6 }); tone(o, t, 'sine', 2000, 200, 0.25, 0.25); noise(o, t, 0.2, 'highpass', 4000, 1, 0.2); };
  S.missile = function (pos) { if (!S.ready) return; var t = now(), o = out({ pos: pos, ref: 8 }); var n = noise(o, t, 0.6, 'lowpass', 1200, 1, 0.5, 0.05); n.f.frequency.exponentialRampToValueAtTime(400, t + 0.6); tone(o, t, 'sawtooth', 300, 120, 0.4, 0.06); };

  // 移動する音(ドローンのうなり・ロケットの飛ぶ音)
  S.loop3d = function (kind, pos) {
    if (!S.ready) return null;
    var t = now(), p = ac.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = kind === 'boss' ? 12 : 3; p.rolloffFactor = 1.4;
    var g = ac.createGain(); g.gain.value = 0;
    g.connect(p); p.connect(sfxBus);
    var nodes = [];
    if (kind === 'drone') {
      var a = ac.createOscillator(); a.type = 'sawtooth'; a.frequency.value = rnd(170, 210);
      var b = ac.createOscillator(); b.type = 'sawtooth'; b.frequency.value = a.frequency.value * 1.007;
      var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      var lfo = ac.createOscillator(); lfo.frequency.value = rnd(5, 8); var lg = ac.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(f.frequency);
      a.connect(f); b.connect(f); f.connect(g); nodes.push(a, b, lfo);
      g.gain.setTargetAtTime(0.06, t, 0.2);
    } else if (kind === 'rocket') {
      var n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      var f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 900; f2.Q.value = 0.8;
      n.connect(f2); f2.connect(g); nodes.push(n);
      g.gain.setTargetAtTime(0.5, t, 0.02);
    } else if (kind === 'boss') {
      var o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 48;
      var o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = 72.3;
      var f3 = ac.createBiquadFilter(); f3.type = 'lowpass'; f3.frequency.value = 300;
      o1.connect(f3); o2.connect(f3); f3.connect(g); nodes.push(o1, o2);
      g.gain.setTargetAtTime(0.3, t, 0.5);
    }
    nodes.forEach(function (x) { x.start(t); });
    return {
      set: function (pos) { if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; } else p.setPosition(pos[0], pos[1], pos[2]); },
      stop: function () { var tt = now(); g.gain.setTargetAtTime(0.0001, tt, 0.05); nodes.forEach(function (x) { try { x.stop(tt + 0.3); } catch (e) { } }); }
    };
  };

  // 聞く位置(カメラ)
  S.listener = function (pos, fwd, up) {
    if (!S.ready) return; var L = ac.listener;
    if (L.positionX) {
      L.positionX.value = pos[0]; L.positionY.value = pos[1]; L.positionZ.value = pos[2];
      L.forwardX.value = fwd[0]; L.forwardY.value = fwd[1]; L.forwardZ.value = fwd[2];
      L.upX.value = up[0]; L.upY.value = up[1]; L.upZ.value = up[2];
    } else { L.setPosition(pos[0], pos[1], pos[2]); L.setOrientation(fwd[0], fwd[1], fwd[2], up[0], up[1], up[2]); }
  };

  // ---------------- 画面の音 ----------------
  S.ui = function (kind) {
    if (!S.ready) return; var t = now(), o = out({});
    if (kind === 'hover') tone(o, t, 'sine', 1800, 1800, 0.03, 0.05);
    else if (kind === 'select') { tone(o, t, 'triangle', 880, 880, 0.08, 0.15); tone(o, t + 0.06, 'triangle', 1318, 1318, 0.12, 0.12); }
    else if (kind === 'back') { tone(o, t, 'triangle', 660, 440, 0.1, 0.12); }
    else if (kind === 'buy') { tone(o, t, 'square', 1568, 1568, 0.05, 0.06); tone(o, t + 0.06, 'square', 2093, 2093, 0.12, 0.06); noise(o, t, 0.08, 'bandpass', 5000, 3, 0.15); }
    else if (kind === 'deny') { tone(o, t, 'square', 220, 200, 0.15, 0.1); }
    else if (kind === 'upgrade') { [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(o, t + i * 0.04, 'sine', f, f, 0.3, 0.1); }); }
  };
  // 波の始まり: ホーン
  S.horn = function () {
    if (!S.ready) return; var t = now(), o = out({ rev: 1.2 }); o.gain.value = 0.6;
    [110, 165, 220, 277].forEach(function (f) {
      var x = tone(o, t, 'sawtooth', f, f * 0.98, 1.4, 0.15, 0.08);
      var fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(300, t); fl.frequency.linearRampToValueAtTime(2200, t + 0.3); fl.frequency.exponentialRampToValueAtTime(400, t + 1.4);
      x.o.disconnect(); x.o.connect(fl); fl.connect(x.g);
    });
    tone(o, t, 'sine', 55, 50, 1.5, 0.6, 0.05);
  };
  S.clear = function () {
    if (!S.ready) return; var t = now(), o = out({ rev: 0.8 });
    [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.3], [784, 0.45], [1046, 0.55]].forEach(function (n) { tone(o, t + n[1], 'triangle', n[0], n[0], 0.35, 0.14); });
  };
  S.alarm = function () {
    if (!S.ready) return; var t = now(), o = out({ rev: 0.8 });
    for (var i = 0; i < 3; i++) { tone(o, t + i * 0.5, 'sawtooth', 600, 900, 0.25, 0.12); tone(o, t + i * 0.5 + 0.25, 'sawtooth', 900, 600, 0.25, 0.12); }
  };

  // ---------------- 環境音 ----------------
  var amb = null;
  S.ambience = function (on, rain) {
    if (!S.ready) return;
    if (amb) { var tt = now(); amb.g.gain.setTargetAtTime(0.0001, tt, 0.5); var old = amb; setTimeout(function () { old.nodes.forEach(function (x) { try { x.stop(); } catch (e) { } }); }, 2500); clearInterval(old.iv); amb = null; }
    if (!on) return;
    var t = now(), g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 2); g.connect(ambBus);
    var nodes = [];
    // 雨(左右で違う雑音)
    var r = ac.createBufferSource(); r.buffer = pinkBuf; r.loop = true;
    var rf = ac.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 500;
    var rf2 = ac.createBiquadFilter(); rf2.type = 'peaking'; rf2.frequency.value = 3500; rf2.gain.value = 6;
    var rg = ac.createGain(); rg.gain.value = 0.22 * (rain || 1);
    r.connect(rf); rf.connect(rf2); rf2.connect(rg); rg.connect(g); nodes.push(r);
    // 街のうなり
    var h = ac.createOscillator(); h.type = 'sawtooth'; h.frequency.value = 55;
    var hf = ac.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 160;
    var hg = ac.createGain(); hg.gain.value = 0.05;
    h.connect(hf); hf.connect(hg); hg.connect(g); nodes.push(h);
    var rum = ac.createBufferSource(); rum.buffer = pinkBuf; rum.loop = true; rum.playbackRate.value = 0.25;
    var rumf = ac.createBiquadFilter(); rumf.type = 'lowpass'; rumf.frequency.value = 120;
    var rumg = ac.createGain(); rumg.gain.value = 0.35;
    rum.connect(rumf); rumf.connect(rumg); rumg.connect(g); nodes.push(rum);
    nodes.forEach(function (x) { x.start(t); });
    // ときどき: 遠くのサイレン・雷・空飛ぶ車
    var iv = setInterval(function () {
      if (!ac || !S.ambOn) return;
      var tt = now(), x = Math.random();
      if (x < 0.25) { // サイレン
        var o = out({ pos: [rnd(-200, 200), 20, rnd(-200, 200)], ref: 60, rev: 1.5 }); o.gain.value = 0.25;
        var s = ac.createOscillator(); s.type = 'triangle';
        for (var k = 0; k < 6; k++) { s.frequency.setValueAtTime(700, tt + k * 0.6); s.frequency.linearRampToValueAtTime(1000, tt + k * 0.6 + 0.3); s.frequency.linearRampToValueAtTime(700, tt + k * 0.6 + 0.6); }
        var sg = ac.createGain(); sg.gain.setValueAtTime(0.0001, tt); sg.gain.linearRampToValueAtTime(0.3, tt + 1); sg.gain.linearRampToValueAtTime(0.0001, tt + 3.6);
        s.connect(sg); sg.connect(o); s.start(tt); s.stop(tt + 3.7);
      } else if (x < 0.4) { // 雷
        var o2 = out({ rev: 2 }); o2.gain.value = 0.5;
        var n = noise(o2, tt, 3, 'lowpass', 200, 0.7, 0.8, 0.2); n.f.frequency.exponentialRampToValueAtTime(60, tt + 3);
        if (S.onThunder) S.onThunder();
      } else if (x < 0.8) { // 空飛ぶ車
        var o3 = ac.createGain(); var p = ac.createPanner(); p.panningModel = 'HRTF'; p.refDistance = 20; p.rolloffFactor = 1;
        o3.connect(p); p.connect(ambBus);
        var sx = rnd(-1, 1) > 0 ? -150 : 150, sz = rnd(-100, 100), y = rnd(30, 60);
        if (p.positionX) { p.positionX.setValueAtTime(sx, tt); p.positionX.linearRampToValueAtTime(-sx, tt + 5); p.positionY.value = y; p.positionZ.value = sz; }
        var c = ac.createBufferSource(); c.buffer = noiseBuf; c.loop = true;
        var cf = ac.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.setValueAtTime(700, tt); cf.frequency.linearRampToValueAtTime(400, tt + 5); cf.Q.value = 1.5;
        var co = ac.createOscillator(); co.type = 'sawtooth'; co.frequency.setValueAtTime(260, tt); co.frequency.linearRampToValueAtTime(180, tt + 5);
        var cog = ac.createGain(); cog.gain.value = 0.04;
        var cg = ac.createGain(); cg.gain.setValueAtTime(0.0001, tt); cg.gain.linearRampToValueAtTime(0.6, tt + 2.5); cg.gain.linearRampToValueAtTime(0.0001, tt + 5);
        c.connect(cf); cf.connect(cg); co.connect(cog); cog.connect(cg); cg.connect(o3);
        c.start(tt); co.start(tt); c.stop(tt + 5.1); co.stop(tt + 5.1);
      }
    }, 7000);
    amb = { g: g, nodes: nodes, iv: iv };
    S.ambOn = true;
  };

  // ---------------- 音楽 ----------------
  // 4小節の和音進行(短調)。強さ 0〜3 で楽器が増える
  var mus = { on: false, intensity: 0, step: 0, next: 0, bpm: 108, timer: null, key: 0 };
  var PROG = [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]]; // i - VI - III - VII(ラ短調ふう)
  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function mtone(t, type, f, dur, peak, cutoff, q) {
    var o = ac.createOscillator(); o.type = type; o.frequency.value = f;
    var fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff || 2000, t); fl.Q.value = q || 1;
    if (cutoff) fl.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.25), t + dur);
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(t, kind, v) {
    var g, s, f;
    if (kind === 'kick') {
      var o = ac.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g = ac.createGain(); g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.4);
    } else if (kind === 'snare') {
      s = ac.createBufferSource(); s.buffer = noiseBuf; f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
      g = ac.createGain(); g.gain.setValueAtTime(0.45 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.25);
      var rs = ac.createGain(); rs.gain.value = 0.4; g.connect(rs); rs.connect(revSend);
      mtone(t, 'triangle', 190, 0.08, 0.25 * v);
    } else if (kind === 'hat') {
      s = ac.createBufferSource(); s.buffer = noiseBuf; f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      g = ac.createGain(); g.gain.setValueAtTime(0.13 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.06);
    }
  }
  function schedule() {
    if (!ac || !mus.on) return;
    var spb = 60 / mus.bpm / 4; // 16分音符
    while (mus.next < now() + 0.15) {
      var t = mus.next, st = mus.step % 16, bar = Math.floor(mus.step / 16) % 4;
      var ch = PROG[bar], root = 45 + mus.key, I = mus.intensity;
      // ベース(8分)
      if (st % 2 === 0) {
        var bn = root + ch[0] + (st % 8 === 6 ? 12 : 0);
        mtone(t, 'sawtooth', midi(bn - 12), spb * 1.8, I > 0 ? 0.16 : 0.1, I > 1 ? 900 : 500, 6);
      }
      // パッド(小節の頭)
      if (st === 0) {
        ch.forEach(function (n) {
          [-0.08, 0.08].forEach(function (det) {
            var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(root + 12 + n + det);
            var fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900 + I * 300;
            var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + spb * 16);
            o.connect(fl); fl.connect(g); g.connect(musicBus); var rs = ac.createGain(); rs.gain.value = 0.5; g.connect(rs); rs.connect(revSend);
            o.start(t); o.stop(t + spb * 16 + 0.1);
          });
        });
      }
      // ドラム
      if (I >= 1) {
        if (st % 4 === 0) drum(t, 'kick', 1);
        if (I >= 2 && st % 8 === 4) drum(t, 'snare', 1);
        if (st % 2 === 1 || I >= 3) drum(t, 'hat', st % 4 === 2 ? 1 : 0.6);
        if (I >= 3 && st === 14) drum(t, 'kick', 0.7);
      }
      // アルペジオ
      if (I >= 2) {
        var arp = [0, 1, 2, 1, 0, 2, 1, 2][st % 8];
        var an = root + 24 + ch[arp] + (st >= 8 && I >= 3 ? 12 : 0);
        mtone(t, 'square', midi(an), spb * 0.9, 0.035, 3000, 2);
      }
      mus.next += spb; mus.step++;
    }
  }
  S.music = function (on, intensity) {
    if (!S.ready) return;
    if (intensity !== undefined) mus.intensity = intensity;
    if (on && !mus.on) {
      mus.on = true; mus.next = now() + 0.1; mus.step = 0;
      mus.timer = setInterval(schedule, 30);
    } else if (!on && mus.on) {
      mus.on = false; clearInterval(mus.timer);
    }
  };
  S.musicKey = function (k, bpm) { mus.key = k; if (bpm) mus.bpm = bpm; };

  NF.S = S;
})();
