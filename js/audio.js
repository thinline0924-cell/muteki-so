/*
 * audio.js — 霧の灯台宿・推理アドベンチャー用サウンドエンジン
 *
 * 音声ファイルは一切使わず、すべて Web Audio API で合成する。
 * (オシレーター、フィルターをかけたノイズ、コードで作った残響インパルスなど)
 *
 * ふつうの <script> として読み込む(モジュールではない)。file:// でも動く。
 * 公開するのは window.Sound だけ。
 *
 *   Sound.unlock()             最初のクリック/キー入力で呼ぶ(何度呼んでもよい)
 *   Sound.bgm(name)            BGM をクロスフェードで切り替え(null / 'none' でフェードアウト)
 *   Sound.ambient(name)        環境音(BGM とは別のレイヤー)
 *   Sound.se(name)             効果音
 *   Sound.setVolume(bus, v)    bus = 'bgm' | 'se' | 'ambient', v = 0..1
 *   Sound.getVolume(bus)
 *   Sound.mute(bool) / Sound.isMuted()
 *   Sound.current              再生中の BGM 名(文字列 or null)
 *
 * 音の流れ:
 *   各バス(bgm / se / ambient)の dry → 音量 → コンプレッサー → マスター → スピーカー
 *   各バスの wet(残響センド)→ 音量 → ConvolverNode(ノイズから作った約2.6秒の残響)→ コンプレッサー
 *
 * BGM は先読みスケジューラー(50ms ごとに setInterval、0.4 秒先までを audioCtx.currentTime で予約)。
 * 曲は小節単位で組み立てるので、ループは継ぎ目なしで続く。
 */
(function (global) {
  'use strict';

  var AC = global.AudioContext || global.webkitAudioContext;

  // ---------------------------------------------------------------------------
  // 状態
  // ---------------------------------------------------------------------------
  var ctx = null, comp = null, master = null, conv = null, revOut = null;
  var BUS = {}, SED = null;
  var WHITE = null, BROWN = null, SHAPE = null;
  var vols = { bgm: 0.7, se: 0.8, ambient: 0.6 };
  var muted = false;
  var curName = null;          // 再生中(または unlock 待ち)の BGM 名
  var curAmbName = null;
  var curT = null, curA = null;
  var tracksLive = [], ambLive = [];
  var timer = null;
  var LOOKAHEAD = 0.4;         // 何秒先まで予約するか(短いと、画面の処理が重い瞬間に音が抜ける)
  var XFADE = 1.2;             // クロスフェード時間
  var lastSe = {};

  // ---------------------------------------------------------------------------
  // 小道具
  // ---------------------------------------------------------------------------
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function chance(p) { return Math.random() < p; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function warn(e) { try { if (global.console) console.warn('[Sound]', e); } catch (_) {} }

  function G(v) { var g = ctx.createGain(); g.gain.value = v == null ? 1 : v; return g; }

  // 汎用エンベロープ:attack → (tc で sus へ減衰) → hold の時点から rel で 0 へ
  function env(p, t, peak, a, tc, sus, hold, rel) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (tc > 0) p.setTargetAtTime(peak * sus, t + a, tc);
    var r = t + Math.max(hold, a + 0.002);
    p.setTargetAtTime(0, r, rel);
  }

  // ---------------------------------------------------------------------------
  // 1音ぶんのノードをまとめて作り、鳴り終わったら disconnect する入れ物
  // ---------------------------------------------------------------------------
  function Voice(t, end) { this.t = t; this.end = end; this.nodes = []; this.last = null; this.tail = 0; }
  Voice.prototype.osc = function (type, f, det) {
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, this.t);
    if (det) o.detune.setValueAtTime(det, this.t);
    o.start(this.t); o.stop(this.end);
    this.nodes.push(o); this.last = o;
    return o;
  };
  Voice.prototype.noise = function (buf) {
    var s = ctx.createBufferSource();
    s.buffer = buf || WHITE; s.loop = true;
    s.start(this.t, Math.random() * (s.buffer.duration - 0.25)); s.stop(this.end);
    this.nodes.push(s); this.last = s;
    return s;
  };
  Voice.prototype.gain = function (v) { var g = G(v); this.nodes.push(g); return g; };
  Voice.prototype.filter = function (type, f, q) {
    var b = ctx.createBiquadFilter(); b.type = type;
    b.frequency.setValueAtTime(f, this.t);
    if (q != null) b.Q.setValueAtTime(q, this.t);
    this.nodes.push(b);
    return b;
  };
  Voice.prototype.out = function (node, d, wet, pan) {
    var n = node;
    if (pan && ctx.createStereoPanner) {
      var p = ctx.createStereoPanner();
      p.pan.setValueAtTime(clamp(pan, -1, 1), this.t);
      n.connect(p); n = p; this.nodes.push(p);
    }
    n.connect(d.dry);
    if (wet > 0) { var w = this.gain(wet); n.connect(w); w.connect(d.wet); }
    var nodes = this.nodes, tail = this.tail;
    function kill() { for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) {} } }
    if (this.last) this.last.onended = function () { if (tail > 0) setTimeout(kill, tail * 1000); else kill(); };
  };

  // 鳴りっぱなしのレイヤー(環境音・持続音)。stop(t) で止める
  function Layer(t) { this.t = t; this.nodes = []; this.srcs = []; }
  Layer.prototype.osc = function (type, f, det) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, this.t);
    if (det) o.detune.setValueAtTime(det, this.t);
    o.start(this.t); this.nodes.push(o); this.srcs.push(o); return o;
  };
  Layer.prototype.noise = function (buf) {
    var s = ctx.createBufferSource(); s.buffer = buf || WHITE; s.loop = true;
    s.start(this.t, Math.random() * (s.buffer.duration - 0.25));
    this.nodes.push(s); this.srcs.push(s); return s;
  };
  Layer.prototype.gain = function (v) { var g = G(v); this.nodes.push(g); return g; };
  Layer.prototype.filter = function (type, f, q) {
    var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
    if (q != null) b.Q.value = q; this.nodes.push(b); return b;
  };
  Layer.prototype.lfo = function (rate, depth, target) {
    var o = this.osc('sine', rate), g = this.gain(depth); o.connect(g); g.connect(target); return o;
  };
  Layer.prototype.stop = function (t) {
    var nodes = this.nodes;
    for (var i = 0; i < this.srcs.length; i++) { try { this.srcs[i].stop(t); } catch (e) {} }
    if (this.srcs[0]) this.srcs[0].onended = function () {
      for (var j = 0; j < nodes.length; j++) { try { nodes[j].disconnect(); } catch (e) {} }
    };
  };

  // ---------------------------------------------------------------------------
  // 汎用の音源:tone(オシレーター1つ)/ nz(ノイズ)
  //   o: type f f2 gl det vib:[rate,cents] / a tc sus hold rel peak / hp bp lp q lq fseq:[[dt,f]...]
  //      shape(ひずみ) wet pan tail brown
  // ---------------------------------------------------------------------------
  function finish(V, src, d, t, o, a, tc, sus, hold, rel) {
    var n = src, main = null;
    if (o.shape) { var ws = ctx.createWaveShaper(); ws.curve = SHAPE; V.nodes.push(ws); n.connect(ws); n = ws; }
    if (o.hp) { var h = V.filter('highpass', o.hp, 0.7); n.connect(h); n = h; }
    if (o.bp) { main = V.filter('bandpass', o.bp, o.q != null ? o.q : 1); n.connect(main); n = main; }
    if (o.lp) { var l = V.filter('lowpass', o.lp, o.lq != null ? o.lq : 0.7); n.connect(l); n = l; if (!main) main = l; }
    if (main && o.fseq) {
      for (var i = 0; i < o.fseq.length; i++) main.frequency.exponentialRampToValueAtTime(o.fseq[i][1], t + o.fseq[i][0]);
    }
    var g = V.gain(0);
    env(g.gain, t, o.peak || 0.2, a, tc, sus, hold, rel);
    n.connect(g);
    V.out(g, d, o.wet || 0, o.pan);
    return V;
  }
  function envTimes(o) {
    var a = o.a || 0.004, tc = o.tc || 0, sus = o.sus || 0, rel = o.rel || 0.04;
    var hold = o.hold != null ? o.hold : ((sus > 0 || !tc) ? 0.25 : a + tc * 5);
    return [a, tc, sus, hold, rel];
  }
  function tone(d, t, o) {
    var e = envTimes(o);
    var V = new Voice(t, t + e[3] + e[4] * 7 + 0.03);
    V.tail = o.tail || 0;
    var s = V.osc(o.type || 'sine', o.f, o.det || 0);
    if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + (o.gl || 0.1));
    if (o.vib) { var l = V.osc('sine', o.vib[0]), lg = V.gain(o.vib[1]); l.connect(lg); lg.connect(s.detune); }
    return finish(V, s, d, t, o, e[0], e[1], e[2], e[3], e[4]);
  }
  function nz(d, t, o) {
    var e = envTimes(o);
    var V = new Voice(t, t + e[3] + e[4] * 7 + 0.03);
    V.tail = o.tail || 0;
    var s = V.noise(o.brown ? BROWN : WHITE);
    return finish(V, s, d, t, o, e[0], e[1], e[2], e[3], e[4]);
  }

  // ---------------------------------------------------------------------------
  // 楽器(すべて inst(dest, time, midi, durSec, vel, opts) の形)
  // ---------------------------------------------------------------------------

  // ローズ風エレピ:FM(1:1)+ 4倍音の「チーン」という打鍵音
  function I_epiano(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), rel = 0.12, V = new Voice(t, t + dur + rel * 7);
    var mod = V.osc('sine', f), mg = V.gain(0), car = V.osc('sine', f);
    mg.gain.setValueAtTime(f * (1.5 * v + 0.35), t);
    mg.gain.setTargetAtTime(f * 0.16, t, 0.2);
    mod.connect(mg); mg.connect(car.frequency);
    var amp = V.gain(0);
    env(amp.gain, t, 0.2 * v, 0.004, 0.6 + Math.min(1.6, 220 / f), 0, dur, rel);
    car.connect(amp);
    var tine = V.osc('sine', f * 4.01), tg = V.gain(0);
    env(tg.gain, t, 0.03 * v, 0.002, 0.03, 0, 0.2, 0.02);
    tine.connect(tg);
    var lp = V.filter('lowpass', 3000, 0.5);
    amp.connect(lp); tg.connect(lp);
    V.out(lp, d, o.wet != null ? o.wet : 0.22, o.pan);
  }

  // ピアノ:三角波2本(わずかにずらす)+2倍音、ローパスが閉じていく
  function I_piano(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), rel = 0.2, V = new Voice(t, t + dur + rel * 7);
    var o1 = V.osc('triangle', f), o2 = V.osc('triangle', f, 5), o3 = V.osc('sine', f * 2);
    var g3 = V.gain(0.28), mix = V.gain(1);
    o1.connect(mix); o2.connect(mix); o3.connect(g3); g3.connect(mix);
    var lp = V.filter('lowpass', Math.min(f * 9, 9000), 0.6);
    lp.frequency.setTargetAtTime(f * 2 + 300, t, 0.3);
    var amp = V.gain(0);
    env(amp.gain, t, 0.19 * v, 0.003, 0.45 + Math.min(2.0, 330 / f), 0, dur, rel);
    mix.connect(lp); lp.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.3, o.pan);
  }

  // 倍音を並べた鐘系(チェレスタ、オルゴール、ベル、時計のゴング)
  function partials(d, t, f, parts, base, dur, wet, pan) {
    var maxTc = 0;
    for (var i = 0; i < parts.length; i++) maxTc = Math.max(maxTc, parts[i][2]);
    var end = t + Math.min(maxTc * 6, dur + 2.1) + 0.03;
    var V = new Voice(t, end), mix = V.gain(1);
    for (var k = 0; k < parts.length; k++) {
      var p = parts[k], ff = f * p[0];
      if (ff > 16000) continue;
      var o = V.osc('sine', ff, k ? rnd(-3, 3) : 0), g = V.gain(0);
      env(g.gain, t, base * p[1], 0.002, p[2], 0, dur, 0.3);
      o.connect(g); g.connect(mix);
    }
    V.out(mix, d, wet, pan);
  }
  var P_CELESTA = [[1, 1, 0.7], [2, 0.15, 0.3], [4, 0.22, 0.06]];
  var P_MUSICBOX = [[1, 1, 1.1], [2, 0.25, 0.45], [5.4, 0.1, 0.05]];
  var P_BELL = [[1, 1, 1.4], [2.76, 0.45, 0.7], [5.4, 0.28, 0.3], [8.93, 0.12, 0.12]];
  var P_GONG = [[0.5, 0.55, 3], [1, 1, 2.2], [1.19, 0.4, 1.6], [1.5, 0.3, 1.2], [2, 0.35, 1.0], [2.74, 0.22, 0.6], [3.76, 0.1, 0.35]];
  function I_celesta(d, t, m, dur, v, o) { o = o || {}; partials(d, t, mtof(m), P_CELESTA, 0.13 * v, Math.max(dur, 0.6), o.wet != null ? o.wet : 0.45, o.pan); }
  function I_musicbox(d, t, m, dur, v, o) { o = o || {}; partials(d, t, mtof(m), P_MUSICBOX, 0.12 * v, Math.max(dur, 0.8), o.wet != null ? o.wet : 0.45, o.pan); }
  function I_bell(d, t, m, dur, v, o) { o = o || {}; partials(d, t, mtof(m), P_BELL, 0.1 * v, Math.max(dur, 1), o.wet != null ? o.wet : 0.5, o.pan); }

  // ウッドベース:三角波+サイン、指で弾いたような立ち上がりとこもったローパス
  function I_bass(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), rel = 0.06, V = new Voice(t, t + dur + rel * 7);
    var o1 = V.osc('triangle', f * 1.015), o2 = V.osc('sine', f);
    o1.frequency.setTargetAtTime(f, t, 0.015);
    var lp = V.filter('lowpass', 1100, 0.9);
    lp.frequency.setTargetAtTime(330, t, 0.1);
    var amp = V.gain(0);
    env(amp.gain, t, 0.38 * v, 0.006, 0.35, 0.28, dur, rel);
    o1.connect(lp); o2.connect(lp); lp.connect(amp);
    // 指が弦に当たる小さなノイズ
    var nzs = V.noise(), nb = V.filter('bandpass', 900, 1.2), ng = V.gain(0);
    env(ng.gain, t, 0.05 * v, 0.002, 0.012, 0, 0.05, 0.01);
    nzs.connect(nb); nb.connect(ng); ng.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.06, o.pan);
  }

  // シンセベース(対決曲など):ノコギリ+矩形+サブのサイン
  function I_sbass(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), rel = 0.04, V = new Voice(t, t + dur + rel * 7);
    var a = V.osc('sawtooth', f), b = V.osc('square', f, -5), s = V.osc('sine', f), sg = V.gain(1.4);
    var lp = V.filter('lowpass', o.cut || 1400, 3);
    lp.frequency.setTargetAtTime((o.cut || 1400) * 0.3, t, 0.08);
    var amp = V.gain(0);
    env(amp.gain, t, 0.14 * v, 0.004, 0.2, 0.55, dur, rel);
    a.connect(lp); b.connect(lp); s.connect(sg); sg.connect(lp); lp.connect(amp);
    V.out(amp, d, o.wet || 0.05, o.pan);
  }

  // パッド:ずらしたノコギリ3本をローパスでやわらかく
  function I_pad(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), att = o.att || 1.0, rel = o.rel || 0.5, cut = o.cut || 900;
    var V = new Voice(t, t + dur + rel * 7);
    var lp = V.filter('lowpass', cut * 0.6, 0.5);
    lp.frequency.linearRampToValueAtTime(cut, t + att);
    var dets = [-9, 0, 9];
    for (var i = 0; i < 3; i++) V.osc('sawtooth', f, dets[i] + rnd(-2, 2)).connect(lp);
    var amp = V.gain(0);
    env(amp.gain, t, 0.04 * v, att, 0, 1, dur, rel);
    lp.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.5, o.pan);
  }

  // 弦:ノコギリ2本+ビブラート
  function I_strings(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), att = o.att || 0.35, rel = o.rel || 0.3, cut = o.cut || 2400;
    var V = new Voice(t, t + dur + rel * 7);
    var s1 = V.osc('sawtooth', f, -6), s2 = V.osc('sawtooth', f, 7);
    var lfo = V.osc('sine', rnd(4.8, 5.6)), lg = V.gain(8);
    lfo.connect(lg); lg.connect(s1.detune); lg.connect(s2.detune);
    var hp = V.filter('highpass', 140, 0.5), lp = V.filter('lowpass', cut, 0.6);
    var amp = V.gain(0);
    env(amp.gain, t, 0.05 * v, att, 0, 1, dur, rel);
    s1.connect(hp); s2.connect(hp); hp.connect(lp); lp.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.45, o.pan);
  }

  // ミュート・トランペット風:ノコギリをバンドパスで鼻にかかった音に、遅れてかかるビブラート
  function I_trumpet(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), rel = 0.07, V = new Voice(t, t + dur + rel * 7);
    var s = V.osc('sawtooth', f * 0.965);
    s.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    var lfo = V.osc('sine', 5.3), lg = V.gain(0);
    var a1 = t + Math.min(0.25, dur * 0.4);
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, a1); lg.gain.linearRampToValueAtTime(16, a1 + 0.35);
    lfo.connect(lg); lg.connect(s.detune);
    var bp = V.filter('bandpass', 1250, 1.3), lp = V.filter('lowpass', 3200, 0.7);
    var amp = V.gain(0);
    env(amp.gain, t, 0.3 * v, 0.045, 0.5, 0.75, dur, rel);
    s.connect(bp); bp.connect(lp); lp.connect(amp);
    var br = V.noise(), bb = V.filter('bandpass', 1500, 1), bg = V.gain(0);
    env(bg.gain, t, 0.025 * v, 0.01, 0.05, 0, 0.12, 0.02);
    br.connect(bb); bb.connect(bg); bg.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.3, o.pan);
  }

  // アルペジオ用シンセ(矩形/三角)
  function I_lead(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), cut = o.cut || 1500, rel = 0.04, V = new Voice(t, t + dur + rel * 7);
    var s = V.osc(o.type || 'square', f);
    var lp = V.filter('lowpass', cut * 2.2, 2);
    lp.frequency.setTargetAtTime(cut, t, 0.06);
    var amp = V.gain(0);
    env(amp.gain, t, 0.055 * v, 0.003, 0.12, 0.35, dur, rel);
    s.connect(lp); lp.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.25, o.pan);
  }

  // ブラスのスタブ:ずらしたノコギリ+フィルターエンベロープ
  function I_brass(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), rel = 0.08, br = o.bright || 2600, V = new Voice(t, t + dur + rel * 7);
    var lp = V.filter('lowpass', 300, 2.5);
    lp.frequency.linearRampToValueAtTime(br, t + 0.035);
    lp.frequency.setTargetAtTime(br * 0.35, t + 0.035, 0.18);
    V.osc('sawtooth', f, -11).connect(lp);
    V.osc('sawtooth', f, 1).connect(lp);
    V.osc('sawtooth', f, 12).connect(lp);
    var sub = V.osc('sawtooth', f * 0.5), sg = V.gain(0.5); sub.connect(sg); sg.connect(lp);
    var amp = V.gain(0);
    env(amp.gain, t, 0.06 * v, 0.012, 0.25, 0.55, dur, rel);
    lp.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.35, o.pan);
  }

  // ブラスのリード(旋律用)
  function I_blead(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), rel = 0.07, V = new Voice(t, t + dur + rel * 7);
    var s1 = V.osc('sawtooth', f, -7), s2 = V.osc('sawtooth', f, 7), sq = V.osc('square', f * 0.5), sqg = V.gain(0.3);
    var lfo = V.osc('sine', 5.6), lg = V.gain(0);
    var a1 = t + Math.min(0.2, dur * 0.4);
    lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, a1); lg.gain.linearRampToValueAtTime(12, a1 + 0.3);
    lfo.connect(lg); lg.connect(s1.detune); lg.connect(s2.detune);
    var lp = V.filter('lowpass', 500, 1.5);
    lp.frequency.linearRampToValueAtTime(o.bright || 2600, t + 0.06);
    lp.frequency.setTargetAtTime((o.bright || 2600) * 0.6, t + 0.06, 0.3);
    var amp = V.gain(0);
    env(amp.gain, t, 0.075 * v, 0.03, 0.4, 0.8, dur, rel);
    s1.connect(lp); s2.connect(lp); sq.connect(sqg); sqg.connect(lp); lp.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.35, o.pan);
  }

  // 低いホルン(タイトルの霧笛モチーフ)
  function I_horn(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), rel = 0.5, V = new Voice(t, t + dur + rel * 7);
    var s = V.osc('sawtooth', f), q = V.osc('square', f, 4), qg = V.gain(0.5);
    var lp = V.filter('lowpass', 90, 4);
    lp.frequency.linearRampToValueAtTime(380, t + 1.2);
    lp.frequency.linearRampToValueAtTime(200, t + dur);
    var amp = V.gain(0);
    env(amp.gain, t, 0.13 * v, 1.0, 0, 1, dur, rel);
    s.connect(lp); q.connect(qg); qg.connect(lp); lp.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.85, o.pan);
  }

  // 低い刻み(サスペンスのオスティナート)
  function I_pulse(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), rel = 0.03, V = new Voice(t, t + dur + rel * 7);
    var s = V.osc('sawtooth', f), lp = V.filter('lowpass', 900, 3);
    lp.frequency.setTargetAtTime(220, t, 0.06);
    var amp = V.gain(0);
    env(amp.gain, t, 0.2 * v, 0.004, 0.12, 0, dur, rel);
    s.connect(lp); lp.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.15, o.pan);
  }

  // 低いドローン:フィルターがゆっくり開閉する
  function I_drone(d, t, m, dur, v, o) {
    o = o || {};
    var f = mtof(m), att = o.att || 2.5, rel = o.rel || 1.0, V = new Voice(t, t + dur + rel * 7);
    var lp = V.filter('lowpass', 200, 2);
    var a = V.osc('sawtooth', f), b = V.osc('sawtooth', f, 7), s = V.osc('sine', f * 0.5), sg = V.gain(1.5);
    var lfo = V.osc('sine', 0.11), lg = V.gain(90); lfo.connect(lg); lg.connect(lp.frequency);
    a.connect(lp); b.connect(lp); s.connect(sg); sg.connect(lp);
    var amp = V.gain(0);
    env(amp.gain, t, 0.09 * v, att, 0, 1, dur, rel);
    lp.connect(amp);
    V.out(amp, d, o.wet != null ? o.wet : 0.4, o.pan);
  }

  // ---------------------------------------------------------------------------
  // 打楽器
  // ---------------------------------------------------------------------------
  function d_kick(d, t, v, w) {
    v = v == null ? 1 : v;
    tone(d, t, { f: 160, f2: 42, gl: 0.13, a: 0.002, tc: 0.1, peak: 0.85 * v, wet: w || 0.05 });
    nz(d, t, { hp: 3000, a: 0.001, tc: 0.004, peak: 0.12 * v });
  }
  function d_snare(d, t, v, w) {
    v = v == null ? 1 : v;
    nz(d, t, { bp: 1900, q: 0.7, a: 0.001, tc: 0.06, peak: 0.42 * v, wet: w || 0.15 });
    tone(d, t, { type: 'triangle', f: 200, f2: 150, gl: 0.05, a: 0.001, tc: 0.04, peak: 0.28 * v });
  }
  function d_brush(d, t, v) { nz(d, t, { bp: 3500, q: 0.5, a: 0.006, tc: 0.07, peak: 0.15 * (v == null ? 1 : v), wet: 0.12 }); }
  function d_swish(d, t, v) { nz(d, t, { bp: 2800, q: 0.4, a: 0.12, tc: 0.1, peak: 0.05 * (v == null ? 1 : v), wet: 0.1 }); }
  function d_ride(d, t, v) {
    v = v == null ? 1 : v;
    nz(d, t, { hp: 6500, a: 0.001, tc: 0.2, peak: 0.065 * v, wet: 0.15, pan: 0.3 });
    tone(d, t, { f: 3700, a: 0.001, tc: 0.3, peak: 0.01 * v, pan: 0.3 });
  }
  function d_hat(d, t, v, open) { nz(d, t, { hp: 8000, a: 0.001, tc: open ? 0.12 : 0.025, peak: 0.11 * (v == null ? 1 : v), pan: -0.2 }); }
  function d_tick(d, t, v, hi) {
    v = v == null ? 1 : v;
    nz(d, t, { bp: hi ? 3800 : 2900, q: 3, a: 0.001, tc: 0.01, peak: 0.24 * v, pan: hi ? 0.25 : -0.25, wet: 0.1 });
    tone(d, t, { f: hi ? 2400 : 1800, a: 0.001, tc: 0.015, peak: 0.045 * v, pan: hi ? 0.25 : -0.25 });
  }
  function d_crash(d, t, v) {
    v = v == null ? 1 : v;
    nz(d, t, { hp: 4500, a: 0.002, tc: 0.55, peak: 0.13 * v, wet: 0.4 });
    nz(d, t, { bp: 7000, q: 0.8, a: 0.002, tc: 0.9, peak: 0.05 * v, wet: 0.3 });
  }
  function d_tom(d, t, v, f) {
    v = v == null ? 1 : v; f = f || 120;
    tone(d, t, { f: f, f2: f * 0.6, gl: 0.2, a: 0.002, tc: 0.15, peak: 0.5 * v, wet: 0.25 });
    nz(d, t, { bp: f * 4, q: 1, a: 0.001, tc: 0.03, peak: 0.1 * v });
  }
  function d_heart(d, t, v) {
    v = v == null ? 1 : v;
    tone(d, t, { f: 68, f2: 40, gl: 0.1, a: 0.004, tc: 0.09, peak: 0.75 * v, lp: 220 });
    tone(d, t, { f: 130, f2: 70, gl: 0.05, a: 0.002, tc: 0.03, peak: 0.18 * v, lp: 400 });
  }
  function d_boom(d, t, v) {
    v = v == null ? 1 : v;
    tone(d, t, { f: 58, f2: 28, gl: 1.0, a: 0.004, tc: 0.6, peak: 0.8 * v, wet: 0.4 });
    nz(d, t, { brown: true, lp: 220, a: 0.01, tc: 0.5, peak: 0.55 * v, wet: 0.5 });
  }

  // ---------------------------------------------------------------------------
  // 小節を組み立てる道具
  // ---------------------------------------------------------------------------
  function Bar() { this.ev = []; }
  Bar.prototype.at = function (b, fn) { this.ev.push({ b: b, fn: fn }); };
  Bar.prototype.n = function (inst, b, m, len, v, o) {
    this.ev.push({ b: b, fn: function (t, spb, dd) { inst(dd, t, m, len * spb, v, o || {}); } });
  };
  Bar.prototype.ch = function (inst, b, ms, len, v, o, strum) {
    for (var i = 0; i < ms.length; i++) this.n(inst, b + i * (strum || 0), ms[i], len, v, o);
  };
  Bar.prototype.d = function (fn, b, v, x) {
    this.ev.push({ b: b, fn: function (t, spb, dd) { fn(dd, t, v, x); } });
  };
  // 旋律 [拍, 半音(基準から), 長さ(拍)] を並べる。ts は時間の伸縮(3/4 拍子用など)
  Bar.prototype.mel = function (inst, notes, base, v, o, ts, hum) {
    ts = ts || 1;
    for (var i = 0; i < notes.length; i++) {
      var nn = notes[i];
      this.n(inst, nn[0] * ts + (hum ? rnd(0, hum) : 0), base + nn[1], nn[2] * ts * 0.98, v * (nn[0] === 0 ? 1 : 0.88), o);
    }
  };

  // スウィング:裏の8分を後ろへずらす(s = 0.5 でイーブン、0.66 で3連)
  function swingB(b, s) {
    var fl = Math.floor(b), f = b - fl;
    if (f <= 0.5) return fl + f * (s / 0.5);
    return fl + s + (f - 0.5) * ((1 - s) / 0.5);
  }

  // 自然的短音階(主音からの半音)
  var MINOR = [0, 2, 3, 5, 7, 8, 10];
  function scaleUp(s) {
    var pc = ((s % 12) + 12) % 12, oct = s - pc;
    for (var i = 0; i < MINOR.length; i++) if (MINOR[i] > pc) return oct + MINOR[i];
    return oct + 12;
  }
  // 旋律の変奏:音をつなげる(タイ)/上からの装飾音を入れる
  function vary(notes, p) {
    var out = [];
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i].slice();
      if (i > 0 && out.length && chance(p * 0.5)) { out[out.length - 1][2] += n[2]; continue; }
      if (n[0] >= 0.25 && chance(p * 0.5)) {
        out.push([n[0] - 0.25, scaleUp(n[1]), 0.25]);
      }
      out.push(n);
    }
    return out;
  }
  // 長調化(短3度・短6度・短7度を半音上げる)
  function toMajor(notes) {
    return notes.map(function (n) {
      var pc = ((n[1] % 12) + 12) % 12;
      return [n[0], n[1] + ((pc === 3 || pc === 8 || pc === 10) ? 1 : 0), n[2]];
    });
  }

  function C(r, v, t) { return { r: r, v: v, t: t || [0, 3, 7, 10] }; }
  // 小節内の和音(1つ or 前半・後半の2つ)から、ある拍の和音を返す
  function chAt(chs, beat, beats) { beats = beats || 4; return chs[Math.min(chs.length - 1, Math.floor(beat / (beats / chs.length)))]; }

  // ---------------------------------------------------------------------------
  // メインテーマ(ニ短調、8小節)— ゲーム全体の「テーマ」
  //   [拍, D4(62)からの半音, 長さ]
  // ---------------------------------------------------------------------------
  var THEME = [
    [[0, 7, 1.5], [1.5, 5, 0.5], [2, 3, 1], [3, 2, 1]],        // A G F E     | Dm
    [[0, 3, 1.5], [1.5, 2, 0.5], [2, 0, 1], [3, -2, 1]],       // F E D C     | B♭
    [[0, -2, 1], [1, 0, 0.5], [1.5, 3, 0.5], [2, 8, 2]],       // C D F B♭    | Gm
    [[0, 7, 2], [2, 11, 1], [3, 14, 1]],                       // A  C# E     | A7
    [[0, 15, 1.5], [1.5, 14, 0.5], [2, 12, 1], [3, 10, 1]],    // F E D C     | Dm
    [[0, 7, 1.5], [1.5, 10, 0.5], [2, 15, 1], [3, 14, 1]],     // A C F E     | F
    [[0, 12, 1], [1, 10, 1], [2, 8, 1], [3, 7, 1]],            // D C B♭ A    | Gm  A7
    [[0, 2, 1], [1, 0, 3]]                                     // E D         | Dm
  ];
  var cDm = C(38, [57, 62, 65]), cBb = C(34, [58, 62, 65], [0, 4, 7, 11]), cGm = C(43, [55, 58, 62]),
      cA7 = C(45, [55, 61, 64], [0, 4, 7, 10]), cF = C(41, [57, 60, 65], [0, 4, 7, 11]);
  var TCH = [[cDm], [cBb], [cGm], [cA7], [cDm], [cF], [cGm, cA7], [cDm]];

  // ---------------------------------------------------------------------------
  // BGM
  //   bar(i, loop, B, st) が 1小節ぶんの音を B に積む。i = 小節番号、loop = 何周目か
  // ---------------------------------------------------------------------------
  var TRACKS = {};

  /* 'title' — タイトル。63BPM、ニ短調。遠くで鳴るようなピアノの分散和音とやわらかいパッド。
     1〜8小節目はピアノでメインテーマ、9〜16小節目はチェレスタが1オクターブ上で(少しずつ変奏して)
     テーマを歌う。冒頭と、ときどき低く長い「霧笛」のホルンが響く。16小節ループ。 */
  TRACKS.title = {
    bpm: 63, beats: 4, bars: 16, vol: 1.3,
    bar: function (i, L, B) {
      var th = i % 8, chs = TCH[th], pass = (i / 8) | 0;
      for (var h = 0; h < chs.length; h++) {
        var len = 4 / chs.length, c = chs[h];
        B.ch(I_pad, h * len, c.v, len, 0.8, { att: 1.4, rel: 0.5, cut: 850, wet: 0.5 });
        B.n(I_piano, h * len, c.r, len, 0.42, { wet: 0.4 });
      }
      for (var k = 0; k < 8; k++) {
        var cc = chAt(chs, k * 0.5);
        var seq = [cc.r + 12, cc.v[0], cc.v[1], cc.v[2], cc.v[0] + 12, cc.v[2], cc.v[1], cc.v[0]];
        B.n(I_piano, k * 0.5 + rnd(0, 0.015), seq[k], 1.5, k === 0 ? 0.32 : rnd(0.2, 0.27), { wet: 0.45, pan: (k % 4 - 1.5) * 0.12 });
      }
      if (pass === 0) {
        if (L % 2 === 0 || th >= 4) B.mel(I_piano, L > 0 ? vary(THEME[th], 0.12) : THEME[th], 62 + 12, 0.5, { wet: 0.45 }, 1, 0.02);
      } else {
        B.mel(I_celesta, vary(THEME[th], 0.2), 74, 0.62, { wet: 0.55, pan: 0.15 }, 1, 0.015);
        if (L % 2 === 1) B.mel(I_piano, THEME[th], 62, 0.28, { wet: 0.4 });
      }
      if (i === 0 || (i === 10 && L % 2 === 1)) B.n(I_horn, 0.5, 38, 6, 0.9, { wet: 0.9 });
    }
  };

  /* 'investigate' — 捜査(メインの探索曲)。92BPM のスウィングするノワール・ジャズ、ハ短調。
     AABA 32小節(A: Cm7-Fm7-Dm7♭5-G7♭9、B: Fm7-B♭7-E♭maj7-A♭maj7…)。
     ウォーキングベース(毎回組み立て直す)、ブラシのスネア(2・4拍)、ライドのスウィング・パターン、
     ローズのコンピング(リズムは毎小節ランダムに選ぶ/たまに休む)、ミュート・トランペットの旋律。
     旋律は周回ごとに A1 と最後の A3 のどちらで吹くかが入れ替わり、毎回少しずつ変奏される。 */
  var JZ = {
    Cm7: C(36, [58, 62, 63, 67]), Fm7: C(41, [56, 60, 63, 67]), Dh: C(38, [56, 60, 62, 65], [0, 3, 6, 10]),
    G7b: C(43, [53, 56, 59, 63], [0, 4, 7, 10]), Bb7: C(34, [56, 60, 62, 67], [0, 4, 7, 10]),
    Ebj: C(39, [55, 58, 62, 65], [0, 4, 7, 11]), Abj: C(44, [55, 58, 60, 63], [0, 4, 7, 11]),
    G7: C(43, [53, 57, 59, 64], [0, 4, 7, 10])
  };
  var JA = [['Cm7'], ['Cm7'], ['Fm7'], ['Fm7'], ['Dh'], ['G7b'], ['Cm7'], ['Dh', 'G7b']];
  var JB = [['Fm7'], ['Bb7'], ['Ebj'], ['Abj'], ['Dh'], ['G7b'], ['Cm7'], ['G7']];
  var JFORM = JA.concat(JA, JB, JA);
  var MEL_A = [
    [[0.5, 3, 0.5], [1, 7, 1], [2, 10, 1.5], [3.5, 8, 0.5]],
    [[0, 7, 2.5]],
    [[0.5, 5, 0.5], [1, 8, 1], [2, 12, 1.5], [3.5, 10, 0.5]],
    [[0, 8, 3]],
    [[0, 12, 1], [1, 8, 1], [2, 5, 1], [3, 2, 1]],
    [[0, -1, 1.5], [1.5, 2, 0.5], [2, 5, 1], [3, 8, 1]],
    [[0, 7, 3]],
    [[3, 3, 0.5], [3.5, 5, 0.5]]
  ];
  var MEL_B = [
    [[0, 12, 1.5], [1.5, 15, 0.5], [2, 12, 1], [3, 8, 1]],
    [[0, 10, 2], [2.5, 8, 0.5], [3, 5, 1]],
    [[0, 7, 3], [3.5, 10, 0.5]],
    [[0, 12, 2], [2, 15, 1], [3, 12, 1]],
    [[0, 14, 1.5], [1.5, 12, 0.5], [2, 8, 1], [3, 5, 1]],
    [[0, 11, 2], [2, 8, 1], [3, 7, 1]],
    [[0, 3, 1], [1, 2, 1], [2, 0, 2]],
    []
  ];
  function perBeat(names, tbl) {
    var a = tbl[names[0]], b = tbl[names[names.length - 1]];
    return names.length === 1 ? [a, a, a, a] : [a, a, b, b];
  }
  function nearOct(r, p) {
    var best = r, cands = [r - 12, r, r + 12];
    for (var i = 0; i < 3; i++) if (cands[i] >= 31 && cands[i] <= 52 && Math.abs(cands[i] - p) < Math.abs(best - p)) best = cands[i];
    return best;
  }
  // ウォーキングベース:和音の頭は根音、その間は和音の音、次の和音の直前は半音/全音で近づく
  function walkLine(chs, nextR, prev) {
    var out = [], p = prev;
    for (var k = 0; k < 4; k++) {
      var c = chs[k], n;
      var isNew = (k === 0 || c !== chs[k - 1]);
      var appr = (k === 3) ? nextR : (chs[k + 1] !== c ? chs[k + 1].r : null);
      if (isNew) {
        n = nearOct(c.r, p);
      } else if (appr != null) {
        var tg = nearOct(appr, p), dir = p < tg ? -1 : 1;
        n = tg + dir * (chance(0.65) ? 1 : 2);
      } else {
        var cand = [];
        for (var j = 0; j < c.t.length; j++) {
          var y1 = c.r + c.t[j], y2 = y1 + 12;
          if (y1 !== p && y1 >= 31 && y1 <= 52) cand.push(y1);
          if (y2 !== p && y2 >= 31 && y2 <= 52) cand.push(y2);
        }
        cand.sort(function (a, b) { return Math.abs(a - p) - Math.abs(b - p); });
        n = cand.length ? cand[chance(0.65) ? 0 : Math.min(1, cand.length - 1)] : c.r;
      }
      out.push(n); p = n;
    }
    return out;
  }
  var COMP1 = [[[0, 1.4]], [[1.5, 0.6], [3, 1]], [[0, 0.5], [2.5, 1.4]], [[0.5, 1], [2.5, 0.5]],
               [[1, 0.5], [2.5, 1.5]], [[0, 2.5]], [[3.5, 0.5]], [[1.5, 2]]];
  var COMP2 = [[[0, 1.8], [2, 1.8]], [[0, 1], [2.5, 1.4]], [[0.5, 1.2], [2, 1.8]]];
  TRACKS.investigate = {
    bpm: 92, beats: 4, bars: 32, swing: 0.64, vol: 0.62,
    bar: function (i, L, B, st) {
      var names = JFORM[i], chs = perBeat(names, JZ), nxt = JZ[JFORM[(i + 1) % 32][0]];
      var sec = (i / 8) | 0, si = i % 8;
      // ベース
      var line = walkLine(chs, nxt.r, st.pb || 36); st.pb = line[3];
      for (var k = 0; k < 4; k++) B.n(I_bass, k + rnd(0, 0.02), line[k], 0.92, k === 0 ? 0.95 : rnd(0.72, 0.85));
      if (chance(0.22)) B.n(I_bass, 2.5, line[2], 0.3, 0.35);
      // ライド・シンバル(スウィング)
      var RP = [[0, 0.5], [1, 0.75], [1.5, 0.35], [2, 0.5], [3, 0.75], [3.5, 0.35]];
      for (var r = 0; r < RP.length; r++) B.d(d_ride, RP[r][0], RP[r][1] * rnd(0.85, 1.05));
      // ブラシとハイハット(2・4拍)、足でそっと踏むキック
      B.d(d_brush, 1, 0.7); B.d(d_brush, 3, 0.75);
      B.d(d_swish, 0, 0.8); B.d(d_swish, 2, 0.8);
      B.d(d_hat, 1, 0.45); B.d(d_hat, 3, 0.45);
      B.d(d_kick, 0, 0.15); B.d(d_kick, 2, 0.12);
      if (si === 7) { B.d(d_brush, 2.5, 0.45); B.d(d_brush, 3.5, 0.6); if (chance(0.5)) B.d(d_snare, 3.5, 0.2); }
      if (si === 0 && i > 0) B.d(d_crash, 0, 0.18);
      // ローズのコンピング
      if (!chance(0.12)) {
        var pat = names.length > 1 ? pick(COMP2) : pick(COMP1);
        for (var p = 0; p < pat.length; p++) {
          var cc = chs[Math.min(3, Math.floor(pat[p][0]))];
          B.ch(I_epiano, pat[p][0], cc.v, pat[p][1], rnd(0.4, 0.55), { wet: 0.25, pan: -0.15 }, 0.012);
        }
      }
      // ミュート・トランペット
      var play = (sec === 0 && L % 2 === 0) || sec === 1 || sec === 2 || (sec === 3 && L % 2 === 1);
      if (play) {
        var src = sec === 2 ? MEL_B[si] : MEL_A[si];
        var notes = (sec === 0 && L === 0) ? src : vary(src, sec === 1 || sec === 3 ? 0.3 : 0.15);
        B.mel(I_trumpet, notes, 60, 0.85, { wet: 0.32, pan: 0.18 });
      } else if (si % 2 === 1 && chance(0.5)) {
        // トランペットがいない所では、ローズが高い音でぽつりと応える
        B.n(I_epiano, 2.5, chs[2].v[3] + 12, 1.2, 0.35, { wet: 0.4, pan: 0.2 });
      }
    }
  };

  /* 'night' — 夜更け。72BPM、軽いスウィング。ニ短調のマイナー9th の響き。
     ベースとやわらかいローズだけで、ときどきチェレスタがテーマの断片を遠くで鳴らす。16小節。 */
  var nDm = C(38, [53, 57, 60, 64]), nGm = C(43, [53, 57, 58, 62]), nBb = C(34, [57, 60, 62, 65], [0, 4, 7, 11]),
      nA = C(45, [55, 58, 61, 65], [0, 4, 7, 10]), nEb = C(39, [55, 58, 62], [0, 4, 7, 11]);
  var NSEQ = [nDm, nDm, nGm, nGm, nBb, nA, nDm, nA, nDm, nDm, nGm, nEb, nBb, nA, nDm, nDm];
  TRACKS.night = {
    bpm: 72, beats: 4, bars: 16, swing: 0.6, vol: 0.8,
    bar: function (i, L, B) {
      var c = NSEQ[i], nx = NSEQ[(i + 1) % 16];
      B.n(I_bass, 0, c.r, 1.8, 0.8);
      if (chance(0.3)) {
        B.n(I_bass, 2, c.r + 7, 0.9, 0.6); B.n(I_bass, 3, nx.r + (chance(0.5) ? 1 : -1), 0.9, 0.55);
      } else {
        B.n(I_bass, 2, chance(0.5) ? c.r + 7 : c.r + 12, 1.8, 0.6);
      }
      B.ch(I_epiano, rnd(0, 0.05), c.v, 3.6, rnd(0.3, 0.38), { wet: 0.35, pan: -0.1 }, 0.03);
      if (chance(0.3)) B.ch(I_epiano, 2.5, c.v.slice(1), 1.3, 0.22, { wet: 0.35 }, 0.02);
      var th = i % 8;
      if (((i >= 8 && L % 2 === 0) || (i < 8 && L % 2 === 1)) && [0, 1, 2, 4, 6].indexOf(th) >= 0) {
        var notes = THEME[th].filter(function () { return chance(0.75); });
        B.mel(I_celesta, notes, 74, 0.45, { wet: 0.65, pan: 0.25 });
      }
      if (chance(0.35)) B.d(d_swish, 1, 0.5);
    }
  };

  /* 'tension' — 緊迫。96BPM。低いドローン、ニ音の8分音符の刻み(ときどき半音上の E♭ へずれる)、
     短2度でぶつかる弦のクラスターが膨らんでは消え、心臓の鼓動のようなキック。旋律はない。
     後半4小節は鼓動が倍になる。16小節。 */
  var TROOT = [38, 38, 38, 38, 39, 39, 38, 38, 38, 38, 38, 38, 39, 39, 37, 38];
  var CLUS = [[62, 63], [57, 58], [63, 64], [56, 57, 62]];
  TRACKS.tension = {
    bpm: 96, beats: 4, bars: 16, vol: 0.85,
    bar: function (i, L, B) {
      var r = TROOT[i], ACC = [1, 0.45, 0.6, 0.45, 0.85, 0.45, 0.6, 0.5];
      if (i % 4 === 0) { B.n(I_drone, 0, 38, 16, 1, { att: 2.5, rel: 0.8 }); B.n(I_drone, 0, 26, 16, 0.7, { att: 3, rel: 0.8 }); }
      for (var k = 0; k < 8; k++) B.n(I_pulse, k * 0.5, r, 0.4, ACC[k], { pan: k % 2 ? 0.15 : -0.15 });
      if (i % 4 === 1) {
        var cl = CLUS[((i / 4) | 0) % 4];
        B.ch(I_strings, 0, cl, 10, 0.6, { att: 3, rel: 0.6, cut: 1600, wet: 0.6 });
        if (L % 2 === 1) B.ch(I_strings, 1, cl.map(function (x) { return x + 12; }), 8, 0.35, { att: 3, rel: 0.6, cut: 2400, wet: 0.7 });
      }
      B.d(d_heart, 0, 0.9); B.d(d_heart, 0.32, 0.6);
      B.d(d_heart, 2, 0.85); B.d(d_heart, 2.32, 0.55);
      if (i >= 12) { B.d(d_heart, 1, 0.7); B.d(d_heart, 1.32, 0.5); B.d(d_heart, 3, 0.75); B.d(d_heart, 3.32, 0.5); }
      if (chance(0.2)) B.n(I_celesta, pick([1, 1.5, 2.5, 3]), pick([80, 75, 86, 87]), 2, 0.4, { wet: 0.85, pan: rnd(-0.5, 0.5) });
    }
  };

  /* 'tragedy' — 悲劇(遺体の発見など)。54BPM。弦のパッドがテーマの和音をゆっくり運び、
     低弦が根音を支える。前半はピアノのソロでテーマ(少しためを効かせて)、
     後半はチェレスタ+ピアノが1オクターブ上でもう一度。16小節。 */
  TRACKS.tragedy = {
    bpm: 54, beats: 4, bars: 16, vol: 1.6,
    bar: function (i, L, B) {
      var th = i % 8, chs = TCH[th], pass = (i / 8) | 0;
      for (var h = 0; h < chs.length; h++) {
        var len = 4 / chs.length, c = chs[h];
        B.ch(I_strings, h * len, c.v, len + 0.1, 0.65, { att: 0.9, rel: 0.4, cut: 1800, wet: 0.55 });
        B.n(I_strings, h * len, c.r, len + 0.1, 0.85, { att: 0.6, cut: 900, wet: 0.4 });
      }
      for (var k = 0; k < 4; k++) {
        var cc = chAt(chs, k);
        var seq = [cc.r + 12, cc.v[0], cc.v[1], cc.v[2]];
        B.n(I_piano, k + rnd(0, 0.03), seq[k], 2, 0.22, { wet: 0.45 });
      }
      if (pass === 0) {
        B.mel(I_piano, L > 0 ? vary(THEME[th], 0.15) : THEME[th], 74, 0.55, { wet: 0.5 }, 1, 0.06);
      } else {
        var n2 = vary(THEME[th], 0.25);
        B.mel(I_celesta, n2, 74 + 12, 0.45, { wet: 0.6, pan: 0.2 }, 1, 0.03);
        B.mel(I_piano, n2, 74, 0.38, { wet: 0.5 }, 1, 0.03);
      }
    }
  };

  /* 'deduction' — 推理。116BPM、イ短調。時計のようなチクタク(8分で高低交互)、
     16分音符の矩形波アルペジオ(小節が進むほどフィルターが開く)、ベースの脈動。
     5小節目からキック、9小節目からパッドとベルの上声が加わって盛り上がる。
     周回ごとにアルペジオの音色(矩形/三角)が入れ替わる。16小節。 */
  var dAm = C(45, [57, 60, 64]), dF = C(41, [57, 60, 65]), dDm = C(38, [57, 62, 65]), dE = C(40, [56, 59, 64]), dG = C(43, [55, 59, 62]);
  var DSEQ = [dAm, dAm, dF, dF, dDm, dDm, dE, dE, dAm, dAm, dF, dG, dDm, dE, dAm, dE];
  var DPAT = [0, 1, 2, 3, 2, 1, 2, 0, 1, 2, 3, 2, 3, 1, 2, 1];
  TRACKS.deduction = {
    bpm: 116, beats: 4, bars: 16, vol: 0.9,
    bar: function (i, L, B) {
      var c = DSEQ[i], prog = i / 15;
      for (var k = 0; k < 8; k++) B.d(d_tick, k * 0.5, k % 2 === 0 ? 0.5 : 0.32, k % 2 === 0);
      var notes = [c.v[0], c.v[1], c.v[2], c.v[0] + 12];
      for (var s = 0; s < 16; s++) {
        B.n(I_lead, s * 0.25, notes[DPAT[s]] + 12, 0.22, s % 4 === 0 ? 0.9 : 0.6,
          { cut: 700 + prog * 1800 + (L % 2) * 300, type: L % 2 ? 'triangle' : 'square', wet: 0.25, pan: s % 2 ? 0.25 : -0.25 });
      }
      for (var b = 0; b < 8; b++) {
        if (i < 4 && b % 2 === 1) continue;
        B.n(I_sbass, b * 0.5, c.r - 12 + (b % 4 === 3 ? 12 : 0), 0.4, b % 2 ? 0.55 : 0.8, { cut: 900 });
      }
      if (i >= 4) { B.d(d_kick, 0, 0.6); B.d(d_kick, 2, 0.55); }
      if (i >= 8) {
        B.d(d_kick, 2.5, 0.35);
        B.d(d_hat, 1.5, 0.5, true); B.d(d_hat, 3.5, 0.5, true);
        B.ch(I_pad, 0, c.v, 4, 0.7, { att: 0.6, cut: 1300, wet: 0.4 });
        B.n(I_celesta, 0, c.v[2] + 12, 2, 0.5, { wet: 0.4 });
        if (chance(0.6)) B.n(I_celesta, 2.5, c.v[1] + 12, 1.5, 0.35, { wet: 0.4 });
      }
      if (i === 15) { B.d(d_snare, 3, 0.3); B.d(d_snare, 3.25, 0.4); B.d(d_snare, 3.5, 0.5); B.d(d_snare, 3.75, 0.6); }
    }
  };

  /* 'confront' — 対決。140BPM、ニ短調(テーマと同じ和声)。8分音符で押すシンセベースのオスティナート、
     ピッチが落ちるサインのキックとノイズのスネア、ブラスのスタブ。24小節:
     1〜8小節目はリフだけ、9〜16小節目はブラスのリードがテーマを勇ましく、
     17〜24小節目は1オクターブ上でテーマを、弦が重なる。 */
  var CB_PAT = [0, 0, 12, 0, 0, 12, 0, 7];
  TRACKS.confront = {
    bpm: 140, beats: 4, bars: 24, vol: 0.72,
    bar: function (i, L, B) {
      var th = i % 8, sec = (i / 8) | 0, chs = TCH[th];
      for (var k = 0; k < 8; k++) {
        var c = chAt(chs, k * 0.5);
        B.n(I_sbass, k * 0.5, c.r + CB_PAT[k], 0.42, k % 4 === 0 ? 1 : 0.7);
      }
      B.d(d_kick, 0, 1); B.d(d_kick, 2, 0.9); B.d(d_kick, 2.5, 0.7);
      B.d(d_snare, 1, 0.8); B.d(d_snare, 3, 0.85);
      for (var h = 0; h < 8; h++) B.d(d_hat, h * 0.5, h % 2 ? 0.35 : 0.6, h === 7 && chance(0.4));
      if (th === 7) { B.d(d_snare, 3.25, 0.5); B.d(d_snare, 3.5, 0.6); B.d(d_snare, 3.75, 0.75); B.d(d_tom, 2.5, 0.6, 140); }
      if (th === 0) B.d(d_crash, 0, sec === 0 ? 0.7 : 1);
      var c0 = chs[0], c1 = chs[chs.length - 1];
      if (sec === 0) {
        B.ch(I_brass, 0, c0.v, 0.35, 0.9); B.ch(I_brass, 1.5, c0.v, 0.3, 0.75);
        if (chance(0.5)) B.ch(I_brass, 3.5, c1.v, 0.25, 0.7);
        if (th % 4 === 0) B.d(d_tom, 0, 0.8, 80);
      } else {
        B.ch(I_brass, 0, c0.v, 0.3, 0.7); B.ch(I_brass, 2.5, c1.v, 0.3, 0.6);
        for (var hh = 0; hh < chs.length; hh++) {
          var len = 4 / chs.length;
          B.ch(I_strings, hh * len, chs[hh].v.map(function (x) { return x + 12; }), len, 0.45, { att: 0.15, cut: 3000, wet: 0.35 });
        }
        var mel = sec === 1 ? THEME[th] : vary(THEME[th], 0.15);
        B.mel(I_blead, mel, sec === 1 ? 62 : 74, sec === 1 ? 0.9 : 0.8, { wet: 0.35 });
      }
    }
  };

  /* 'climax' — 最終局面。156BPM。リフが4小節ごとに半音ずつせり上がる(Dm → E♭m → Em)、
     B♭ を経て A7 の属音ペダルへ。最後の2小節は弦が半音階で上り、スネアのロールでループの頭へ戻る。
     旋律はテーマの頭の動機を各調で繰り返す。16小節。 */
  var CL_RIFF = [0, 0, 12, 0, 10, 0, 12, 7];
  TRACKS.climax = {
    bpm: 156, beats: 4, bars: 16, vol: 0.66,
    bar: function (i, L, B) {
      var blk = (i / 4) | 0, tr = blk < 3 ? blk : 0, c, b4 = i % 4;
      if (i < 12) c = C(38 + tr, [57 + tr, 62 + tr, 65 + tr]);
      else if (i < 14) c = cBb; else c = cA7;
      for (var k = 0; k < 8; k++) {
        var n = i >= 14 ? c.r - 12 + (k % 2 ? 12 : 0) : c.r + CL_RIFF[k];
        B.n(I_sbass, k * 0.5, n, 0.4, k % 4 === 0 ? 1 : 0.75, { cut: 1700 });
      }
      for (var q = 0; q < 4; q++) B.d(d_kick, q, 0.95);
      B.d(d_snare, 1, 0.85); B.d(d_snare, 3, 0.9);
      for (var h = 0; h < 8; h++) B.d(d_hat, h * 0.5 + 0.25, 0.35);
      for (var h2 = 0; h2 < 4; h2++) B.d(d_hat, h2, 0.55);
      if (b4 === 0) B.d(d_crash, 0, 1);
      B.ch(I_strings, 0, c.v.map(function (x) { return x + 12; }), 4, 0.5, { att: 0.1, cut: 3200, wet: 0.35 });
      if (i < 14) {
        B.ch(I_brass, 0, c.v, 0.3, 0.9, { bright: 3200 });
        B.ch(I_brass, 0.75, c.v, 0.25, 0.7, { bright: 3000 });
        B.ch(I_brass, 2.5, c.v, 0.3, 0.75, { bright: 3000 });
      }
      if (i < 12) {
        var idx = [0, 1, 0, 4][b4];
        B.mel(I_blead, THEME[idx], 62 + tr + (b4 === 2 ? 12 : 0), 0.85, { wet: 0.3, bright: 3200 });
      } else if (i < 14) {
        B.mel(I_blead, THEME[i === 12 ? 1 : 2], 74, 0.85, { wet: 0.3, bright: 3200 });
      } else {
        // 半音階で上る弦+毎拍のブラス
        for (var s = 0; s < 4; s++) {
          var m = 69 + (i - 14) * 4 + s;
          B.n(I_strings, s, m, 1, 0.9, { att: 0.05, cut: 4000, wet: 0.3 });
          B.n(I_blead, s, m, 0.9, 0.6, { wet: 0.3 });
          B.ch(I_brass, s, c.v, 0.2, 0.6 + s * 0.08);
        }
        if (i === 15) for (var r = 0; r < 8; r++) B.d(d_snare, 2 + r * 0.25, 0.3 + r * 0.08);
        else B.d(d_tom, 3, 0.7, 110);
      }
    }
  };

  /* 'truth' — 隠された過去。66BPM の3/4拍子。ニ短調とヘ長調のあいだを揺れる和声
     (Dm9 - B♭maj7 - Gm9 - A7 - Fmaj7 - F/C - Gm7 C7 - F6 / 2周目は Dm で終わる)。
     ピアノのワルツ伴奏と弦。前半はピアノ、後半は弦がテーマを3拍子に変えて歌う。16小節。 */
  var TRS = [[C(38, [53, 57, 60, 64])], [C(34, [53, 57, 58, 62])], [C(43, [53, 57, 58, 62])], [C(45, [55, 61, 64])],
             [C(41, [52, 57, 60])], [C(36, [52, 57, 60])], [C(43, [53, 58, 62]), C(36, [52, 58, 62])], [C(41, [50, 57, 60])]];
  var TRS_END2 = [C(38, [53, 57, 62])];
  TRACKS.truth = {
    bpm: 66, beats: 3, bars: 16, vol: 1.4,
    bar: function (i, L, B) {
      var th = i % 8, pass = (i / 8) | 0;
      var chs = (i === 15) ? TRS_END2 : TRS[th];
      if (chs.length === 1) {
        var c = chs[0];
        B.n(I_piano, 0, c.r, 3, 0.45, { wet: 0.4 });
        B.ch(I_piano, 1, c.v, 0.9, 0.2, { wet: 0.4 }, 0.01);
        B.ch(I_piano, 2, c.v, 0.9, 0.17, { wet: 0.4 }, 0.01);
        B.ch(I_strings, 0, c.v, 3.05, pass ? 0.6 : 0.42, { att: 0.8, rel: 0.4, cut: 1700, wet: 0.55 });
        if (pass) B.n(I_strings, 0, c.r + 12, 3.05, 0.5, { att: 0.6, cut: 900 });
      } else {
        for (var h = 0; h < 2; h++) {
          var cc = chs[h];
          B.n(I_piano, h * 1.5, cc.r, 1.5, 0.42, { wet: 0.4 });
          B.ch(I_piano, h * 1.5 + 0.75, cc.v, 0.7, 0.19, { wet: 0.4 }, 0.01);
          B.ch(I_strings, h * 1.5, cc.v, 1.55, pass ? 0.6 : 0.42, { att: 0.5, rel: 0.4, cut: 1700, wet: 0.55 });
        }
      }
      if (pass === 0) {
        B.mel(I_piano, L > 0 ? vary(THEME[th], 0.1) : THEME[th], 74, 0.52, { wet: 0.5 }, 0.75, 0.03);
      } else {
        B.mel(I_strings, THEME[th], 74, 0.95, { att: 0.12, rel: 0.25, cut: 3200, wet: 0.5, pan: 0.1 }, 0.75);
        var top = chs[0].v[chs[0].v.length - 1] + 24;
        if (chance(0.5)) B.n(I_celesta, 1.5, top, 1.5, 0.3, { wet: 0.6 });
      }
    }
  };

  /* 'ending' — 夜明けのエピローグ。60BPM、ニ長調に変えたメインテーマ
     (D - Bm7 - Gmaj7 - A7 - Dmaj7 - F#m7 - G A7 - D)。前半はオルゴール、後半はピアノが旋律、
     パッドとやわらかい低音、オルゴールの高い粒がきらめく。最後は静かにループへ戻る。16小節。 */
  var EN = [[C(38, [57, 62, 66])], [C(35, [57, 62, 66])], [C(43, [54, 59, 62])], [C(45, [55, 61, 64])],
            [C(38, [54, 57, 61])], [C(42, [52, 57, 61])], [C(43, [55, 59, 62]), C(45, [55, 61, 64])], [C(38, [54, 57, 62])]];
  var THEME_MAJ = THEME.map(toMajor);
  TRACKS.ending = {
    bpm: 60, beats: 4, bars: 16, vol: 1.6,
    bar: function (i, L, B) {
      var th = i % 8, pass = (i / 8) | 0, chs = EN[th];
      for (var h = 0; h < chs.length; h++) {
        var len = 4 / chs.length, c = chs[h];
        B.ch(I_pad, h * len, c.v, len, 0.65, { att: 1.2, rel: 0.6, cut: 1200, wet: 0.55 });
        B.n(I_piano, h * len, c.r, len, 0.32, { wet: 0.45 });
        if (len === 4) B.n(I_piano, 2, c.r + 7, 2, 0.2, { wet: 0.45 });
      }
      if (pass === 0) {
        B.mel(I_musicbox, THEME_MAJ[th], 74, 0.6, { wet: 0.5 }, 1, 0.01);
        for (var k = 0; k < 4; k++) {
          var cc = chAt(chs, k);
          B.n(I_piano, k + 0.5, cc.v[k % 3], 1.2, 0.16, { wet: 0.5 });
        }
      } else {
        B.mel(I_piano, THEME_MAJ[th], 74, 0.45, { wet: 0.5 }, 1, 0.03);
        for (var s = 0; s < 8; s++) {
          if (!chance(0.45)) continue;
          var c2 = chAt(chs, s * 0.5);
          B.n(I_musicbox, s * 0.5, c2.v[s % 3] + 24, 1, 0.25, { wet: 0.6, pan: rnd(-0.4, 0.4) });
        }
      }
      if (i === 15) B.n(I_musicbox, 2, 86, 3, 0.4, { wet: 0.7 });
    }
  };

  /* 'badend' — バッドエンド。50BPM。風の音と、低くうなる2つの音のうなり(D と E♭)。
     不協和な音域からまばらに落ちるピアノの単音、ときどき短2度の弦。8小節。 */
  var BADN = [38, 39, 44, 45, 50, 51, 56, 62, 63, 68, 74, 75];
  TRACKS.badend = {
    bpm: 50, beats: 4, bars: 8, vol: 1.4,
    start: function (d, t) {
      var w = windLayer(d, t, 0.9);
      var Ld = new Layer(t), lp = Ld.filter('lowpass', 260, 0.7), g = Ld.gain(0.05);
      Ld.osc('sine', mtof(38)).connect(lp); Ld.osc('sine', mtof(39)).connect(lp);
      Ld.osc('triangle', mtof(26)).connect(lp);
      Ld.lfo(0.07, 0.025, g.gain);
      lp.connect(g); g.connect(d.dry);
      return [w, Ld];
    },
    bar: function (i, L, B) {
      if (i === 0) B.ch(I_piano, 0, [26, 27, 33], 8, 0.5, { wet: 0.7 });
      var n = 1 + (chance(0.5) ? 1 : 0);
      for (var k = 0; k < n; k++) B.n(I_piano, pick([0, 1, 1.5, 2, 3]), pick(BADN), 4, rnd(0.25, 0.42), { wet: 0.75, pan: rnd(-0.4, 0.4) });
      if (i === 4) B.ch(I_strings, 0, [62, 63], 8, 0.35, { att: 3, rel: 0.8, cut: 1400, wet: 0.7 });
      if (i === 6 && L % 2 === 1) B.n(I_celesta, 1, 87, 3, 0.3, { wet: 0.9 });
    }
  };

  // ---------------------------------------------------------------------------
  // 環境音のレイヤー
  // ---------------------------------------------------------------------------
  function rainLayer(d, t, lvl, muffled) {
    var L = new Layer(t);
    var hp = L.filter('highpass', 600, 0.5), lp = L.filter('lowpass', muffled ? 1100 : 6500, 0.5);
    var g = L.gain(0.09 * lvl);
    L.noise().connect(hp); hp.connect(lp); lp.connect(g);
    var blp = L.filter('lowpass', muffled ? 500 : 900, 0.5), bg = L.gain(0.12 * lvl);
    L.noise(BROWN).connect(blp); blp.connect(bg);
    var sum = L.gain(1);
    g.connect(sum); bg.connect(sum);
    L.lfo(0.05, 0.2, sum.gain);
    sum.connect(d.dry);
    var w = L.gain(0.25); sum.connect(w); w.connect(d.wet);
    return L;
  }
  function seaLayer(d, t, lvl) {
    var L = new Layer(t);
    var lp = L.filter('lowpass', 420, 0.6), amp = L.gain(0.38 * lvl);
    L.noise(BROWN).connect(lp); lp.connect(amp);
    var o1 = L.osc('sine', 0.125), o2 = L.osc('sine', 0.047);
    var f1 = L.gain(320), f2 = L.gain(120), a1 = L.gain(0.26 * lvl), a2 = L.gain(0.08 * lvl);
    o1.connect(f1); f1.connect(lp.frequency); o2.connect(f2); f2.connect(lp.frequency);
    o1.connect(a1); a1.connect(amp.gain); o2.connect(a2); a2.connect(amp.gain);
    var hp = L.filter('highpass', 2500, 0.5), foam = L.gain(0.012 * lvl), fm = L.gain(0.012 * lvl);
    L.noise().connect(hp); hp.connect(foam); o1.connect(fm); fm.connect(foam.gain);
    amp.connect(d.dry); foam.connect(d.dry);
    var w = L.gain(0.3); amp.connect(w); w.connect(d.wet);
    return L;
  }
  function windLayer(d, t, lvl) {
    var L = new Layer(t);
    var bp = L.filter('bandpass', 450, 0.9), amp = L.gain(0.07 * lvl);
    L.noise().connect(bp); bp.connect(amp);
    L.lfo(0.07, 220, bp.frequency);
    L.lfo(0.11, 0.035 * lvl, amp.gain);
    var wh = L.filter('bandpass', 1200, 7), wg = L.gain(0.03 * lvl);
    L.noise().connect(wh); wh.connect(wg);
    L.lfo(0.09, 350, wh.frequency);
    L.lfo(0.05, 0.02 * lvl, wg.gain);
    amp.connect(d.dry); wg.connect(d.dry);
    var w = L.gain(0.4); amp.connect(w); wg.connect(w); w.connect(d.wet);
    return L;
  }
  function roomLayer(d, t) {
    var L = new Layer(t), lp = L.filter('lowpass', 170, 0.5), g = L.gain(0.12);
    L.noise(BROWN).connect(lp); lp.connect(g); g.connect(d.dry);
    return L;
  }
  function boilerLayer(d, t) {
    var L = new Layer(t);
    var lp = L.filter('lowpass', 150, 1), g = L.gain(0.11);
    L.osc('sawtooth', 50).connect(lp);
    var s = L.osc('sine', 100), sg = L.gain(0.5); s.connect(sg); sg.connect(lp);
    lp.connect(g);
    var blp = L.filter('lowpass', 110, 0.7), bg = L.gain(0.35);
    L.noise(BROWN).connect(blp); blp.connect(bg);
    var sum = L.gain(1); g.connect(sum); bg.connect(sum);
    L.lfo(0.25, 0.12, sum.gain);
    sum.connect(d.dry);
    return L;
  }
  function drop(d, t, v) {
    nz(d, t, { bp: rnd(2500, 7000), q: 1.5, a: 0.001, tc: 0.004, peak: rnd(0.02, 0.07) * v, pan: rnd(-0.8, 0.8) });
  }
  function metalTick(d, t, v) {
    var f = rnd(1800, 2600);
    tone(d, t, { f: f, a: 0.001, tc: rnd(0.04, 0.12), peak: 0.05 * v, wet: 0.4, pan: rnd(-0.5, 0.5) });
    tone(d, t, { f: f * 2.31, a: 0.001, tc: 0.04, peak: 0.025 * v, wet: 0.4 });
    nz(d, t, { hp: 3000, a: 0.001, tc: 0.006, peak: 0.08 * v });
  }
  // 次の発生時刻を管理して、先読み範囲に入ったものだけ鳴らす
  function every(st, key, now, ahead, mn, mx, fn) {
    if (st.nx[key] == null) st.nx[key] = now + rnd(mn, mx) * 0.5;
    var g = 0;
    while (st.nx[key] < ahead && g++ < 1000) {
      if (st.nx[key] >= now - 0.05) { try { fn(st.nx[key]); } catch (e) { warn(e); } }
      st.nx[key] += rnd(mn, mx);
    }
  }

  var AMB = {
    // 雨:雨音のザー+ぽつぽつ+ときどき遠雷
    rain: {
      vol: 1.5,
      start: function (d, t) { return [rainLayer(d, t, 1.0, false)]; },
      tick: function (d, st, now, ahead) {
        every(st, 'drop', now, ahead, 0.04, 0.14, function (tt) { drop(d, tt, 0.8); });
        every(st, 'thunder', now, ahead, 18, 40, function (tt) { thunder(d, tt, rnd(0.25, 0.5)); });
      }
    },
    // 海:約8秒周期でゆっくり寄せては返す波+かすかな風、ごくまれに遠くのブイの鐘
    sea: {
      vol: 1.0,
      start: function (d, t) { return [seaLayer(d, t, 1.0), windLayer(d, t, 0.35)]; },
      tick: function (d, st, now, ahead) {
        every(st, 'buoy', now, ahead, 25, 55, function (tt) { I_bell(d, tt, 69, 3, 0.12, { wet: 1.0, pan: -0.4 }); });
      }
    },
    // 嵐:雨・風・波をすべて強く、雷も多め
    storm: {
      vol: 1.0,
      start: function (d, t) { return [rainLayer(d, t, 1.4, false), windLayer(d, t, 1.3), seaLayer(d, t, 1.3)]; },
      tick: function (d, st, now, ahead) {
        every(st, 'drop', now, ahead, 0.02, 0.07, function (tt) { drop(d, tt, 1.0); });
        every(st, 'thunder', now, ahead, 8, 20, function (tt) { thunder(d, tt, rnd(0.45, 0.85)); });
        every(st, 'gust', now, ahead, 10, 22, function (tt) { rainHit(d, tt, 0.6); });
      }
    },
    // 室内:ごく小さな部屋鳴り+ゆっくりした時計のチクタク+窓の向こうのこもった雨
    indoor: {
      vol: 1.0,
      start: function (d, t, st) { st.tk = 0; return [roomLayer(d, t), rainLayer(d, t, 0.35, true)]; },
      tick: function (d, st, now, ahead) {
        every(st, 'clock', now, ahead, 1.0, 1.0, function (tt) { st.tk ^= 1; d_tick(d, tt, 0.22, st.tk === 1); });
      }
    },
    // ボイラー室:低いうなり+ときどき金属がチンと鳴る
    boiler: {
      vol: 1.0,
      start: function (d, t) { return [boilerLayer(d, t)]; },
      tick: function (d, st, now, ahead) {
        every(st, 'tick', now, ahead, 2.5, 8, function (tt) { metalTick(d, tt, rnd(0.5, 1)); });
        every(st, 'knock', now, ahead, 9, 20, function (tt) { tone(d, tt, { f: 70, f2: 45, gl: 0.1, a: 0.003, tc: 0.08, peak: 0.25, lp: 300, wet: 0.3 }); });
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 効果音
  // ---------------------------------------------------------------------------
  function thunder(d, t, s) {
    s = s == null ? 1 : s;
    if (s > 0.55) nz(d, t, { lp: 3500, fseq: [[0.3, 400]], a: 0.004, tc: 0.15, peak: 0.4 * s, wet: 0.5 });
    var V = new Voice(t, t + 6), src = V.noise(BROWN), lp = V.filter('lowpass', 120 + 120 * s, 0.7), g = V.gain(0);
    var dl = 1 - s; // 遠いほど遅れて、ゆっくりふくらむ
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.75 * s, t + 0.25 + dl * 0.5);
    for (var k = 1; k <= 6; k++) g.gain.setTargetAtTime(rnd(0.25, 0.75) * s * (1 - k / 8), t + 0.3 + dl * 0.5 + k * 0.35, 0.15);
    g.gain.setTargetAtTime(0, t + 2.6 + dl, 0.5);
    src.connect(lp); lp.connect(g);
    V.out(g, d, 0.6);
  }
  function rainHit(d, t, s) {
    s = s == null ? 1 : s;
    nz(d, t, { hp: 900, lp: 7000, a: 0.08, tc: 0.45, peak: 0.25 * s, wet: 0.25 });
    for (var k = 0; k < 30; k++) drop(d, t + rnd(0, 0.9), 1.4 * s);
  }
  function fogHorn(d, t, s) {
    s = s == null ? 1 : s;
    var f = 92, len = 2.6, V = new Voice(t, t + len + 0.4);
    V.tail = 3.5;
    var defs = [['sawtooth', f, -6, 0.5], ['sawtooth', f, 5, 0.5], ['square', f * 0.5, 0, 0.35], ['sawtooth', f * 2, 3, 0.1]];
    var lp = V.filter('lowpass', 110, 3.5);
    for (var i = 0; i < defs.length; i++) {
      var fb = defs[i][1], o = V.osc(defs[i][0], fb, defs[i][2]), g = V.gain(defs[i][3]);
      o.frequency.setValueAtTime(fb * 0.96, t);
      o.frequency.linearRampToValueAtTime(fb, t + 0.45);
      o.frequency.setValueAtTime(fb, t + len - 0.45);
      o.frequency.exponentialRampToValueAtTime(fb * 0.86, t + len + 0.1); // 最後に「ブォ」と下がる
      o.connect(g); g.connect(lp);
    }
    lp.frequency.linearRampToValueAtTime(700, t + 0.6);
    lp.frequency.linearRampToValueAtTime(520, t + len - 0.4);
    lp.frequency.linearRampToValueAtTime(140, t + len + 0.15);
    var amp = V.gain(0);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.34 * s, t + 0.55);
    amp.gain.linearRampToValueAtTime(0.3 * s, t + len - 0.3);
    amp.gain.linearRampToValueAtTime(0, t + len + 0.2);
    lp.connect(amp);
    // 崖にはね返るこだま
    var dl = ctx.createDelay(2), fb2 = V.gain(0.3), elp = V.filter('lowpass', 480, 0.7), eo = V.gain(0.45);
    dl.delayTime.value = 0.9; V.nodes.push(dl);
    amp.connect(dl); dl.connect(elp); elp.connect(fb2); fb2.connect(dl); elp.connect(eo);
    eo.connect(d.wet); var eo2 = V.gain(0.3); eo.connect(eo2); eo2.connect(d.dry);
    V.out(amp, d, 0.9);
  }
  function creak(d, t, len, v) {
    var V = new Voice(t, t + len + 0.2), s = V.osc('sawtooth', 40);
    var n = 14, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) curve[i] = 28 + 40 * Math.abs(Math.sin(i * 0.9 + rnd(0, 0.8))) + rnd(-5, 5);
    s.frequency.setValueCurveAtTime(curve, t + 0.001, len);
    var b1 = V.filter('bandpass', 1100, 6), b2 = V.filter('bandpass', 2300, 8), b3 = V.filter('bandpass', 650, 5);
    var mix = V.gain(1);
    s.connect(b1); s.connect(b2); s.connect(b3); b1.connect(mix); b2.connect(mix); b3.connect(mix);
    var g = V.gain(0);
    env(g.gain, t, 0.5 * v, 0.08, 0, 1, len, 0.04);
    mix.connect(g);
    V.out(g, d, 0.3);
  }

  var SE = {
    blip: function (d, t) {
      nz(d, t, { bp: rnd(2600, 3600), q: 1.5, a: 0.001, tc: 0.006, peak: 0.07 });
      tone(d, t, { type: 'triangle', f: rnd(1150, 1350), a: 0.001, tc: 0.012, peak: 0.02 });
    },
    cursor: function (d, t) {
      tone(d, t, { f: 1480, a: 0.002, tc: 0.03, peak: 0.08 });
      tone(d, t, { f: 2960, a: 0.001, tc: 0.015, peak: 0.02 });
    },
    select: function (d, t) {
      tone(d, t, { type: 'triangle', f: 988, a: 0.002, tc: 0.05, peak: 0.1, wet: 0.15 });
      tone(d, t + 0.06, { type: 'triangle', f: 1319, a: 0.002, tc: 0.12, peak: 0.12, wet: 0.25 });
      tone(d, t + 0.06, { f: 2638, a: 0.002, tc: 0.06, peak: 0.03, wet: 0.25 });
    },
    cancel: function (d, t) {
      tone(d, t, { type: 'triangle', f: 700, f2: 420, gl: 0.12, a: 0.002, tc: 0.07, peak: 0.12, lp: 2000, wet: 0.1 });
    },
    open: function (d, t) {
      nz(d, t, { bp: 900, fseq: [[0.12, 3500]], q: 0.9, a: 0.03, tc: 0.06, peak: 0.22, wet: 0.15 });
      tone(d, t, { f: 140, f2: 90, gl: 0.08, a: 0.003, tc: 0.05, peak: 0.15 });
      nz(d, t + 0.1, { bp: 2500, q: 1.2, a: 0.004, tc: 0.04, peak: 0.08 });
    },
    page: function (d, t) {
      nz(d, t, { bp: 600, fseq: [[0.22, 4200]], q: 1.2, a: 0.12, tc: 0.08, peak: 0.2, wet: 0.12 });
      nz(d, t + 0.2, { hp: 3000, a: 0.002, tc: 0.03, peak: 0.1 });
    },
    clue: function (d, t) {
      var notes = [74, 77, 81];
      for (var i = 0; i < 3; i++) I_celesta(d, t + i * 0.085, notes[i], 0.5, 0.9, { wet: 0.4 });
      var fin = [86, 81, 76];
      for (var k = 0; k < 3; k++) I_bell(d, t + 0.3 + k * 0.012, fin[k], 1.2, k ? 0.6 : 1, { wet: 0.5, pan: (k - 1) * 0.3 });
      I_celesta(d, t + 0.3, 93, 1.0, 0.5, { wet: 0.6 });
      for (var j = 0; j < 3; j++) I_pad(d, t + 0.25, [62, 69, 76][j], 0.7, 0.9, { att: 0.08, rel: 0.25, cut: 1800, wet: 0.5 });
      nz(d, t + 0.3, { hp: 7000, a: 0.2, tc: 0.3, peak: 0.03, wet: 0.5 });
      I_piano(d, t + 0.3, 50, 1.2, 0.5, { wet: 0.4 });
    },
    keyword: function (d, t) {
      I_bell(d, t, 88, 0.6, 0.8, { wet: 0.45, pan: -0.2 });
      I_bell(d, t + 0.09, 93, 0.9, 0.9, { wet: 0.5, pan: 0.2 });
      I_celesta(d, t + 0.09, 100, 0.6, 0.4, { wet: 0.5 });
      nz(d, t + 0.05, { hp: 8000, a: 0.08, tc: 0.15, peak: 0.03, wet: 0.4 });
    },
    door: function (d, t) {
      creak(d, t, 0.7, 1);
      tone(d, t + 0.76, { f: 85, f2: 50, gl: 0.15, a: 0.003, tc: 0.1, peak: 0.55, wet: 0.35 });
      nz(d, t + 0.76, { lp: 500, a: 0.002, tc: 0.06, peak: 0.35, wet: 0.35 });
      nz(d, t + 0.79, { bp: 3000, q: 2, a: 0.001, tc: 0.01, peak: 0.15 });
    },
    knock: function (d, t) {
      var ts = [0, 0.17, 0.34];
      for (var i = 0; i < ts.length; i++) {
        var v = i === 1 ? 0.85 : 1;
        tone(d, t + ts[i], { f: 200, f2: 120, gl: 0.05, a: 0.002, tc: 0.035, peak: 0.42 * v, wet: 0.25 });
        nz(d, t + ts[i], { bp: 800, q: 1.2, a: 0.001, tc: 0.02, peak: 0.25 * v, wet: 0.25 });
      }
    },
    footsteps: function (d, t) {
      for (var i = 0; i < 4; i++) {
        var tt = t + i * 0.48 + rnd(-0.02, 0.02), v = rnd(0.75, 1), pan = i % 2 ? 0.15 : -0.15;
        tone(d, tt, { f: 95, f2: 60, gl: 0.06, a: 0.003, tc: 0.05, peak: 0.36 * v, wet: 0.2, pan: pan });
        nz(d, tt, { lp: 700, a: 0.002, tc: 0.035, peak: 0.25 * v, wet: 0.2, pan: pan });
        if (chance(0.45)) nz(d, tt + 0.05, { bp: rnd(900, 1400), q: 6, a: 0.02, tc: 0.05, peak: 0.08, wet: 0.2 });
      }
    },
    stairs: function (d, t) {
      for (var i = 0; i < 6; i++) {
        var tt = t + i * 0.33 + rnd(-0.02, 0.02), f = rnd(380, 450) * (1 + i * 0.015), v = rnd(0.7, 1);
        var pan = i % 2 ? 0.2 : -0.2;
        tone(d, tt, { f: f, a: 0.001, tc: 0.25, peak: 0.06 * v, wet: 0.45, pan: pan });
        tone(d, tt, { f: f * 2.71, a: 0.001, tc: 0.12, peak: 0.04 * v, wet: 0.45, pan: pan });
        tone(d, tt, { f: f * 4.53, a: 0.001, tc: 0.06, peak: 0.025 * v, wet: 0.45, pan: pan });
        tone(d, tt, { type: 'triangle', f: 120, f2: 80, gl: 0.05, a: 0.002, tc: 0.04, peak: 0.3 * v, wet: 0.3 });
        nz(d, tt, { hp: 2000, a: 0.001, tc: 0.02, peak: 0.1 * v, wet: 0.3 });
      }
    },
    move: function (d, t) {
      nz(d, t, { bp: 300, fseq: [[0.25, 1800], [0.5, 450]], q: 1.2, a: 0.22, tc: 0.1, peak: 0.2, wet: 0.3 });
    },
    foghorn: function (d, t) { fogHorn(d, t, 1); },
    thunder: function (d, t) { thunder(d, t, 1); },
    glass: function (d, t) {
      nz(d, t, { hp: 2500, a: 0.001, tc: 0.08, peak: 0.35, wet: 0.3 });
      nz(d, t, { bp: 5000, q: 0.8, a: 0.001, tc: 0.25, peak: 0.1, wet: 0.35 });
      tone(d, t, { f: 120, f2: 70, gl: 0.06, a: 0.002, tc: 0.04, peak: 0.2 });
      for (var k = 0; k < 16; k++) {
        tone(d, t + 0.02 + Math.pow(Math.random(), 1.6) * 0.6, { f: rnd(2500, 7000), a: 0.001, tc: rnd(0.04, 0.15), peak: rnd(0.03, 0.08), pan: rnd(-0.6, 0.6), wet: 0.35 });
      }
    },
    bolt: function (d, t) {
      nz(d, t, { bp: 1800, fseq: [[0.35, 2600]], q: 4, a: 0.05, sus: 0.8, tc: 0.1, hold: 0.35, rel: 0.03, peak: 0.16, wet: 0.2 });
      tone(d, t, { type: 'sawtooth', f: 130, f2: 165, gl: 0.35, bp: 900, q: 5, a: 0.04, sus: 0.8, tc: 0.1, hold: 0.35, rel: 0.03, peak: 0.12 });
      var tb = t + 0.42;
      tone(d, tb, { f: 70, f2: 40, gl: 0.15, a: 0.002, tc: 0.15, peak: 0.75, wet: 0.45 });
      nz(d, tb, { lp: 1800, a: 0.001, tc: 0.08, peak: 0.45, wet: 0.45 });
      var mp = [[210, 0.4], [517, 0.3], [893, 0.2], [1460, 0.12]];
      for (var i = 0; i < mp.length; i++) tone(d, tb, { f: mp[i][0], a: 0.001, tc: mp[i][1], peak: 0.06, wet: 0.5 });
    },
    shock: function (d, t) {
      var cl = [50, 51, 56, 57, 62, 63];
      for (var i = 0; i < cl.length; i++) I_brass(d, t, cl[i], 1.2, 0.9, { bright: 4000, wet: 0.7 });
      for (var j = 0; j < 4; j++) I_strings(d, t, [62, 63, 68, 74][j], 1.4, 1.0, { att: 0.02, rel: 0.5, cut: 3500, wet: 0.7 });
      tone(d, t, { f: 65, f2: 32, gl: 1.2, a: 0.004, tc: 0.5, peak: 0.85, wet: 0.5 });
      nz(d, t, { lp: 2500, fseq: [[0.5, 300]], a: 0.002, tc: 0.3, peak: 0.3, wet: 0.6 });
      d_crash(d, t, 0.8);
      d_tom(d, t, 1, 70);
    },
    scream: function (d, t) {
      var len = 0.95, V = new Voice(t, t + len + 0.6);
      var s = V.osc('sawtooth', 650);
      s.frequency.exponentialRampToValueAtTime(1050, t + 0.12);
      s.frequency.exponentialRampToValueAtTime(980, t + 0.5);
      s.frequency.exponentialRampToValueAtTime(520, t + len);
      var lfo = V.osc('sine', 6), lg = V.gain(30); lfo.connect(lg); lg.connect(s.detune);
      var fm = [[850, 8, 0.7], [1200, 10, 0.5], [2800, 12, 0.25]], mix = V.gain(1);
      for (var i = 0; i < 3; i++) { var b = V.filter('bandpass', fm[i][0], fm[i][1]), g = V.gain(fm[i][2] * 4); s.connect(b); b.connect(g); g.connect(mix); }
      var br = V.noise(), bb = V.filter('bandpass', 1500, 1), bg = V.gain(0.15); br.connect(bb); bb.connect(bg); bg.connect(mix);
      var lp = V.filter('lowpass', 1600, 0.7), amp = V.gain(0);
      env(amp.gain, t, 0.13, 0.08, 0, 1, 0.75, 0.12);
      mix.connect(lp); lp.connect(amp);
      V.out(amp, d, 0.9, -0.3);
    },
    heartbeat: function (d, t) { d_heart(d, t, 1.1); d_heart(d, t + 0.26, 0.8); },
    clock: function (d, t) {
      for (var i = 0; i < 3; i++) {
        partials(d, t + i * 1.7, 262, P_GONG, 0.07, 3, 0.55);
        nz(d, t + i * 1.7, { bp: 2000, q: 1, a: 0.001, tc: 0.01, peak: 0.12, wet: 0.3 });
      }
    },
    tick: function (d, t) {
      nz(d, t, { bp: 3200, q: 2, a: 0.001, tc: 0.008, peak: 0.2, wet: 0.1 });
      tone(d, t, { f: 1900, a: 0.001, tc: 0.012, peak: 0.06 });
    },
    correct: function (d, t) {
      I_brass(d, t, 62, 0.5, 1, { bright: 4000, wet: 0.4 });
      I_brass(d, t, 66, 0.5, 0.9, { bright: 4000, wet: 0.4 });
      I_brass(d, t, 69, 0.5, 0.9, { bright: 4000, wet: 0.4 });
      I_brass(d, t, 74, 0.5, 0.9, { bright: 4000, wet: 0.4 });
      var b = [86, 90, 93];
      for (var i = 0; i < 3; i++) I_bell(d, t + 0.02 + i * 0.03, b[i], 1, 0.8, { wet: 0.5 });
      d_kick(d, t, 1); d_crash(d, t, 0.7);
    },
    wrong: function (d, t) {
      tone(d, t, { type: 'square', f: 98, lp: 700, a: 0.005, sus: 0.9, tc: 0.1, hold: 0.32, rel: 0.04, peak: 0.12 });
      tone(d, t, { type: 'square', f: 104, lp: 700, a: 0.005, sus: 0.9, tc: 0.1, hold: 0.32, rel: 0.04, peak: 0.12 });
      tone(d, t, { f: 80, f2: 45, gl: 0.1, a: 0.003, tc: 0.1, peak: 0.5 });
    },
    present: function (d, t) {
      nz(d, t, { bp: 400, fseq: [[0.08, 2500]], q: 1, a: 0.07, tc: 0.03, peak: 0.15 });
      var ts = t + 0.08;
      d_kick(d, ts, 1.1);
      tone(d, ts, { f: 110, f2: 45, gl: 0.2, a: 0.002, tc: 0.15, peak: 0.6, wet: 0.5 });
      nz(d, ts, { lp: 2500, fseq: [[0.2, 500]], a: 0.001, tc: 0.07, peak: 0.5, wet: 0.55 });
      nz(d, ts, { hp: 4000, a: 0.001, tc: 0.2, peak: 0.08, wet: 0.5 });
    },
    objection: function (d, t) {
      d_kick(d, t, 0.9);
      nz(d, t, { lp: 3000, a: 0.001, tc: 0.06, peak: 0.35, wet: 0.4 });
      var a = [50, 57, 62];
      for (var i = 0; i < a.length; i++) I_brass(d, t, a[i], 0.12, 0.9, { bright: 3500 });
      var tb = t + 0.14;
      tone(d, tb, { f: 70, f2: 30, gl: 0.8, a: 0.003, tc: 0.4, peak: 0.6, wet: 0.6 });
      var b = [62, 69, 74, 77, 81];
      for (var k = 0; k < b.length; k++) I_brass(d, tb, b[k], 0.7, 0.8, { bright: 4200, wet: 0.8 });
      for (var j = 0; j < 3; j++) I_strings(d, tb, [74, 81, 86][j], 0.8, 1, { att: 0.02, rel: 0.4, cut: 4000, wet: 0.8 });
      d_crash(d, tb, 1.0); d_snare(d, tb, 0.9, 0.6); d_kick(d, tb, 0.8);
      nz(d, tb, { lp: 4000, fseq: [[0.6, 300]], a: 0.002, tc: 0.2, peak: 0.4, wet: 0.8 });
    },
    damage: function (d, t) {
      tone(d, t, { type: 'sawtooth', f: 90, f2: 40, gl: 0.3, shape: true, lp: 1200, a: 0.002, tc: 0.12, peak: 0.3, wet: 0.2 });
      nz(d, t, { shape: true, lp: 1500, a: 0.001, tc: 0.08, peak: 0.45, wet: 0.2 });
      tone(d, t, { f: 60, f2: 35, gl: 0.2, a: 0.002, tc: 0.15, peak: 0.6 });
    },
    breakdown: function (d, t) {
      var fs = [880, 932, 1175, 1245];
      for (var i = 0; i < fs.length; i++) {
        tone(d, t, { type: 'sawtooth', f: fs[i], f2: fs[i] / 12, gl: 1.8, det: rnd(-8, 8), vib: [5 + i, 25], lp: 3500, fseq: [[1.8, 400]],
          a: 0.05, sus: 0.8, tc: 0.4, hold: 1.7, rel: 0.12, peak: 0.07, wet: 0.6 });
      }
      var tb = t + 1.75;
      tone(d, tb, { f: 60, f2: 28, gl: 1.5, a: 0.004, tc: 0.7, peak: 0.9, wet: 0.6 });
      nz(d, tb, { brown: true, lp: 300, a: 0.005, tc: 0.6, peak: 0.5, wet: 0.6 });
      d_crash(d, tb, 0.9);
      I_piano(d, tb, 26, 3, 0.9, { wet: 0.7 }); I_piano(d, tb, 27, 3, 0.8, { wet: 0.7 }); I_piano(d, tb, 33, 3, 0.7, { wet: 0.7 });
    },
    save: function (d, t) {
      I_bell(d, t, 81, 0.8, 0.7, { wet: 0.4 });
      I_bell(d, t + 0.12, 88, 1, 0.8, { wet: 0.45 });
      I_pad(d, t, 69, 0.6, 0.6, { att: 0.05, rel: 0.25, cut: 1600, wet: 0.4 });
      I_pad(d, t, 76, 0.6, 0.6, { att: 0.05, rel: 0.25, cut: 1600, wet: 0.4 });
    },
    clockwarn: function (d, t) {
      tone(d, t, { type: 'triangle', f: 880, a: 0.01, tc: 0.25, peak: 0.12, lp: 3000, wet: 0.35 });
      tone(d, t, { f: 440, a: 0.01, tc: 0.2, peak: 0.04, wet: 0.35 });
      tone(d, t + 0.35, { type: 'triangle', f: 659, a: 0.01, tc: 0.3, peak: 0.12, lp: 3000, wet: 0.35 });
      tone(d, t + 0.35, { f: 330, a: 0.01, tc: 0.25, peak: 0.04, wet: 0.35 });
    },
    match: function (d, t) {
      nz(d, t, { bp: 3000, q: 1, a: 0.005, sus: 0.8, tc: 0.05, hold: 0.1, rel: 0.03, peak: 0.25 });
      nz(d, t + 0.1, { bp: 600, fseq: [[0.25, 1400]], q: 0.8, a: 0.06, tc: 0.25, peak: 0.2, wet: 0.15 });
      for (var k = 0; k < 18; k++) {
        nz(d, t + 0.2 + rnd(0, 1.4), { bp: rnd(1500, 5000), q: 2, a: 0.001, tc: 0.004, peak: rnd(0.05, 0.2), pan: rnd(-0.4, 0.4) });
      }
      nz(d, t + 0.25, { brown: true, lp: 400, a: 0.4, sus: 0.7, tc: 0.6, hold: 0.8, rel: 0.3, peak: 0.25, wet: 0.1 });
    },
    paper: function (d, t) {
      for (var k = 0; k < 14; k++) {
        nz(d, t + rnd(0, 0.6), { bp: rnd(1200, 5200), q: rnd(0.8, 2), a: 0.003, tc: rnd(0.01, 0.04), peak: rnd(0.05, 0.15), pan: rnd(-0.3, 0.3) });
      }
      nz(d, t, { lp: 1200, a: 0.1, sus: 0.6, tc: 0.2, hold: 0.5, rel: 0.08, peak: 0.05 });
    },
    rain_hit: function (d, t) { rainHit(d, t, 1); },
    wave: function (d, t) {
      nz(d, t, { lp: 300, fseq: [[0.9, 2200], [3.0, 500]], a: 0.8, tc: 0.9, peak: 0.3, wet: 0.4 });
      nz(d, t, { brown: true, lp: 400, a: 0.6, tc: 1, peak: 0.45, wet: 0.4 });
      nz(d, t + 0.75, { hp: 2500, a: 0.05, tc: 0.5, peak: 0.05, wet: 0.4 });
    }
  };

  // ---------------------------------------------------------------------------
  // 音の通り道(グラフ)を作る
  // ---------------------------------------------------------------------------
  function makeNoise() {
    var sr = ctx.sampleRate, len = sr * 3, n = Math.floor(sr * 0.05), i;
    WHITE = ctx.createBuffer(1, len, sr);
    var w = WHITE.getChannelData(0);
    for (i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
    // ブラウンノイズ(低音寄り)。ループの継ぎ目でプツッとならないよう、頭と尻を重ねる
    var raw = new Float32Array(len + n), last = 0;
    for (i = 0; i < len + n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; raw[i] = last * 3.5; }
    BROWN = ctx.createBuffer(1, len, sr);
    var b = BROWN.getChannelData(0);
    for (i = 0; i < len; i++) b[i] = i < n ? raw[i] * (i / n) + raw[len + i] * (1 - i / n) : raw[i];
    SHAPE = new Float32Array(1024);
    for (i = 0; i < 1024; i++) { var x = i / 511.5 - 1; SHAPE[i] = Math.tanh(3 * x); }
  }
  function makeImpulse(sec) {
    var sr = ctx.sampleRate, len = Math.floor(sr * sec), buf = ctx.createBuffer(2, len, sr), pre = Math.floor(sr * 0.02);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        if (i < pre) { data[i] = 0; continue; }
        var x = (i - pre) / (len - pre);
        var a = 0.85 - 0.7 * x; // 時間がたつほど高音が先に消える
        lp += a * ((Math.random() * 2 - 1) - lp);
        data[i] = lp * Math.pow(1 - x, 2.2) * Math.exp(-x * 2) * (1.2 - a * 0.5);
      }
      // 初期反射
      for (var r = 0; r < 6; r++) { var idx = pre + Math.floor(rnd(0.005, 0.08) * sr); if (idx < len) data[idx] += rnd(-0.5, 0.5); }
    }
    return buf;
  }
  function build() {
    if (!WHITE || WHITE.sampleRate !== ctx.sampleRate) makeNoise();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3;
    comp.attack.value = 0.006; comp.release.value = 0.25;
    master = G(muted ? 0 : 0.9);
    comp.connect(master); master.connect(ctx.destination);
    conv = ctx.createConvolver(); conv.buffer = makeImpulse(2.6);
    revOut = G(0.85); conv.connect(revOut); revOut.connect(comp);
    BUS = {};
    ['bgm', 'se', 'ambient'].forEach(function (k) {
      var dry = G(1), wet = G(1), v = G(vols[k]), wv = G(vols[k]);
      dry.connect(v); v.connect(comp); wet.connect(wv); wv.connect(conv);
      BUS[k] = { dry: dry, wet: wet, v: v, wv: wv };
    });
    SED = { dry: BUS.se.dry, wet: BUS.se.wet };
  }

  // ---------------------------------------------------------------------------
  // BGM / 環境音の開始・停止とスケジューラー
  // ---------------------------------------------------------------------------
  function fadeGain(g, to, t, dur) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(to, t + dur);
  }
  function startTrack(name) {
    var def = TRACKS[name], t = ctx.currentTime;
    var dry = G(0), wet = G(0);
    dry.connect(BUS.bgm.dry); wet.connect(BUS.bgm.wet);
    fadeGain(dry, def.vol || 1, t, XFADE); fadeGain(wet, def.vol || 1, t, XFADE);
    var tr = { name: name, def: def, d: { dry: dry, wet: wet }, bar: 0, loop: 0, next: t + 0.08, q: [], qi: 0, st: {}, layers: [], stopped: false };
    if (def.start) { try { tr.layers = def.start(tr.d, t + 0.05) || []; } catch (e) { warn(e); } }
    tracksLive.push(tr);
    return tr;
  }
  function stopLive(x, list) {
    if (!x || x.stopped) return;
    x.stopped = true;
    var t = ctx.currentTime;
    fadeGain(x.d.dry, 0, t, XFADE); fadeGain(x.d.wet, 0, t, XFADE);
    for (var i = 0; i < x.layers.length; i++) { try { x.layers[i].stop(t + XFADE + 0.1); } catch (e) {} }
    setTimeout(function () {
      try { x.d.dry.disconnect(); x.d.wet.disconnect(); } catch (e) {}
      var k = list.indexOf(x); if (k >= 0) list.splice(k, 1);
    }, (XFADE + 0.6) * 1000);
  }
  function buildBar(tr, now) {
    var def = tr.def, spb = 60 / def.bpm;
    if (tr.next < now - 0.5) tr.next = now + 0.05; // タブが裏にあった等で遅れたら、今から再開
    var B = new Bar();
    try { def.bar(tr.bar, tr.loop, B, tr.st); } catch (e) { warn(e); }
    var t0 = tr.next, q = [];
    for (var i = 0; i < B.ev.length; i++) {
      var b = B.ev[i].b;
      if (def.swing) b = swingB(b, def.swing);
      q.push({ t: t0 + Math.max(0, b) * spb, fn: B.ev[i].fn });
    }
    q.sort(function (a, b2) { return a.t - b2.t; });
    tr.q = q; tr.qi = 0;
    tr.next = t0 + def.beats * spb;
    tr.bar++;
    if (tr.bar >= def.bars) { tr.bar = 0; tr.loop++; }
  }
  function pump(tr, now, ahead) {
    var spb = 60 / tr.def.bpm, guard = 0;
    while (guard++ < 100000) {
      if (tr.qi < tr.q.length) {
        var e = tr.q[tr.qi];
        if (e.t >= ahead) break;
        tr.qi++;
        if (e.t < now - 0.3) continue; // 大きく遅れた音だけ捨てる(少しの遅れなら鳴らす)
        try { e.fn(Math.max(e.t, now + 0.005), spb, tr.d); } catch (err) { warn(err); }
      } else {
        if (tr.next >= ahead) break;
        buildBar(tr, now);
      }
    }
  }
  function startAmb(name) {
    var def = AMB[name], t = ctx.currentTime;
    var dry = G(0), wet = G(0);
    dry.connect(BUS.ambient.dry); wet.connect(BUS.ambient.wet);
    fadeGain(dry, def.vol || 1, t, XFADE * 1.5); fadeGain(wet, def.vol || 1, t, XFADE * 1.5);
    var st = { name: name, def: def, d: { dry: dry, wet: wet }, nx: {}, layers: [], stopped: false };
    try { st.layers = def.start(st.d, t + 0.02, st) || []; } catch (e) { warn(e); }
    ambLive.push(st);
    return st;
  }
  function tick() {
    if (!ctx) return;
    var now = ctx.currentTime;
    var hidden = false;
    try { hidden = !!(global.document && global.document.hidden); } catch (e) {}
    var ahead = now + (hidden ? 1.5 : LOOKAHEAD);
    for (var i = 0; i < tracksLive.length; i++) if (!tracksLive[i].stopped) pump(tracksLive[i], now, ahead);
    for (var j = 0; j < ambLive.length; j++) {
      var st = ambLive[j];
      if (!st.stopped && st.def.tick) { try { st.def.tick(st.d, st, now, ahead); } catch (e) { warn(e); } }
    }
  }

  // ---------------------------------------------------------------------------
  // 公開 API
  // ---------------------------------------------------------------------------
  function unlock() {
    if (!AC) return;
    try {
      if (!ctx) {
        // 'playback' = 遅れより途切れないことを優先する(スマホで数秒おきにプツッと切れるのを防ぐ)
        try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
        build();
        timer = setInterval(tick, 50);
        if (curName && TRACKS[curName]) curT = startTrack(curName);
        if (curAmbName && AMB[curAmbName]) curA = startAmb(curAmbName);
      }
      if (ctx.state === 'suspended' && ctx.resume) { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { warn(e); }
  }
  function bgm(name) {
    if (name === 'none' || name === undefined || name === '') name = null;
    if (name !== null && !TRACKS[name]) return;
    if (!ctx) { curName = name; return; }
    if (name === curName && (curT || name === null)) return;
    curName = name;
    if (curT) stopLive(curT, tracksLive);
    curT = name ? startTrack(name) : null;
  }
  function ambient(name) {
    if (name === 'none' || name === undefined || name === '') name = null;
    if (name !== null && !AMB[name]) return;
    if (!ctx) { curAmbName = name; return; }
    if (name === curAmbName && (curA || name === null)) return;
    curAmbName = name;
    if (curA) stopLive(curA, ambLive);
    curA = name ? startAmb(name) : null;
  }
  function se(name) {
    if (!ctx || !SE.hasOwnProperty(name)) return;
    var now = ctx.currentTime, gap = name === 'blip' ? 0.035 : 0.03;
    if (lastSe[name] != null && now - lastSe[name] < gap && now >= lastSe[name]) return;
    lastSe[name] = now;
    try { SE[name](SED, now + 0.01); } catch (e) { warn(e); }
  }
  function setVolume(bus, v) {
    if (!vols.hasOwnProperty(bus)) return;
    v = clamp(Number(v) || 0, 0, 1);
    vols[bus] = v;
    if (ctx && BUS[bus]) {
      var t = ctx.currentTime;
      fadeGain(BUS[bus].v, v, t, 0.05); fadeGain(BUS[bus].wv, v, t, 0.05);
    }
  }
  function getVolume(bus) { return vols.hasOwnProperty(bus) ? vols[bus] : 0; }
  function mute(b) {
    muted = (b === undefined) ? true : !!b;
    if (ctx && master) fadeGain(master, muted ? 0 : 0.9, ctx.currentTime, 0.08);
  }

  // テスト用:OfflineAudioContext で曲・環境音・効果音を書き出し、ピークと RMS を返す(ゲームでは使わない)
  function renderDebug(kind, name, secs) {
    var OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error('no OfflineAudioContext'));
    secs = secs || 10;
    var saved = [ctx, comp, master, conv, revOut, BUS, SED, tracksLive, ambLive];
    var off;
    try {
      ctx = off = new OAC(2, Math.floor(44100 * secs), 44100);
      tracksLive = []; ambLive = [];
      build();
      if (kind === 'bgm') pump(startTrack(name), 0, secs);
      else if (kind === 'ambient') { var st = startAmb(name); st.def.tick && st.def.tick(st.d, st, 0, secs); }
      else SE[name](SED, 0.05);
    } finally {
      ctx = saved[0]; comp = saved[1]; master = saved[2]; conv = saved[3]; revOut = saved[4];
      BUS = saved[5]; SED = saved[6]; tracksLive = saved[7]; ambLive = saved[8];
    }
    return off.startRendering().then(function (buf) {
      var peak = 0, sum = 0, n = 0;
      for (var c = 0; c < buf.numberOfChannels; c++) {
        var d = buf.getChannelData(c);
        for (var i = 0; i < d.length; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; }
      }
      return { peak: peak, rms: Math.sqrt(sum / n) };
    });
  }

  var Sound = {
    unlock: unlock,
    bgm: bgm,
    ambient: ambient,
    se: se,
    setVolume: setVolume,
    getVolume: getVolume,
    mute: mute,
    isMuted: function () { return muted; },
    list: { bgm: Object.keys(TRACKS), ambient: Object.keys(AMB), se: Object.keys(SE) },
    _render: renderDebug
  };
  Object.defineProperty(Sound, 'current', { get: function () { return curName; }, enumerable: true });

  // 念のため、最初のクリック/キー入力でも自動で unlock する(ゲーム側が呼び忘れても鳴るように)
  try {
    if (global.document && global.document.addEventListener) {
      var auto = function () {
        unlock();
        if (ctx && ctx.state === 'running') {
          ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { global.document.removeEventListener(ev, auto, true); });
        }
      };
      ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { global.document.addEventListener(ev, auto, true); });
    }
  } catch (e) {}

  global.Sound = Sound;
})(typeof window !== 'undefined' ? window : this);
