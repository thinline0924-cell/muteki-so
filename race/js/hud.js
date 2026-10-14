/* =========================================================
   hud.js — 走行中の表示
   ・車ごとにちがうメーター(4種類)をキャンバスに描く
     analog  : 白文字盤の針メーター(80年代グループC)
     bargraph: 緑と琥珀のLEDバーグラフ(90年代初頭)
     lmp1    : ステアリングの液晶+シフトライト(LMP1ハイブリッド)
     hyper   : 弧を描くセグメント式タコ+エネルギー表示(ハイパーカー)
   ・テレメトリー:Gメーター、タイヤ4本、入力の履歴グラフ、ミニマップ
   ========================================================= */
var HUD = (function () {
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmtTime(t) {
    if (t == null || !isFinite(t)) return '-:--.---';
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3);
  }
  function fmtDelta(d) { if (d == null || !isFinite(d)) return '±0.000'; return (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(3); }
  function hiDPI(cv, w, h) {
    var r = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * r); cv.height = Math.round(h * r);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    var x = cv.getContext('2d'); x.setTransform(r, 0, 0, r, 0, 0); return x;
  }
  var FONT = '"Rajdhani", "Segoe UI", sans-serif';
  var MONO = '"Share Tech Mono", "Consolas", monospace';
  var SERIF = '"Cormorant Garamond", "Shippori Mincho B1", serif';

  // ================= メーター =================
  function arcText(x, txt, cx, cy, r, ang, size, color, font) {
    x.save(); x.fillStyle = color; x.font = size + 'px ' + (font || FONT); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(txt, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); x.restore();
  }

  // --- 1. アナログ(白文字盤)---
  function drawAnalog(x, W, H, c, d, kmh) {
    x.clearRect(0, 0, W, H);
    // 計器板(黒い革のような板)
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(20,22,26,0.88)'); g.addColorStop(1, 'rgba(8,9,11,0.92)');
    x.fillStyle = g; roundRect(x, 4, 18, W - 8, H - 22, 26); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 1; x.stroke();
    function dial(cx, cy, r, min, max, val, step, labelEvery, red, title, unit, big) {
      // ベゼル
      var bz = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r * 1.08);
      bz.addColorStop(0, '#d9dde2'); bz.addColorStop(0.7, '#6b7178'); bz.addColorStop(1, '#202326');
      x.fillStyle = bz; x.beginPath(); x.arc(cx, cy, r * 1.08, 0, TAU); x.fill();
      var face = x.createRadialGradient(cx, cy - r * 0.4, r * 0.1, cx, cy, r);
      face.addColorStop(0, '#fbfbf8'); face.addColorStop(1, '#dedfd9');
      x.fillStyle = face; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
      var a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      var ang = function (v) { return a0 + (v - min) / (max - min) * (a1 - a0); };
      if (red) { x.strokeStyle = '#c4161f'; x.lineWidth = r * 0.09; x.beginPath(); x.arc(cx, cy, r * 0.86, ang(red), ang(max)); x.stroke(); }
      for (var v = min; v <= max + 1e-6; v += step) {
        var a = ang(v), major = Math.abs((v - min) / labelEvery - Math.round((v - min) / labelEvery)) < 1e-6;
        x.strokeStyle = '#141414'; x.lineWidth = major ? 2.4 : 1.1;
        x.beginPath(); x.moveTo(cx + Math.cos(a) * r * (major ? 0.76 : 0.83), cy + Math.sin(a) * r * (major ? 0.76 : 0.83)); x.lineTo(cx + Math.cos(a) * r * 0.93, cy + Math.sin(a) * r * 0.93); x.stroke();
        if (major) arcText(x, String(Math.round(v / (big ? 1000 : 1))), cx, cy, r * 0.6, a, Math.round(r * (big ? 0.2 : 0.15)), '#141414');
      }
      x.fillStyle = '#333'; x.font = '600 ' + Math.round(r * 0.11) + 'px ' + FONT; x.textAlign = 'center';
      x.fillText(title, cx, cy - r * 0.34);
      x.fillStyle = '#777'; x.font = Math.round(r * 0.09) + 'px ' + FONT; x.fillText(unit, cx, cy + r * 0.62);
      // 針
      var na = ang(clamp(val, min - (max - min) * 0.02, max * 1.02));
      x.save(); x.translate(cx, cy); x.rotate(na);
      x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 4; x.shadowOffsetY = 2;
      x.fillStyle = '#e8501a';
      x.beginPath(); x.moveTo(-r * 0.16, -r * 0.03); x.lineTo(r * 0.9, -1); x.lineTo(r * 0.9, 1); x.lineTo(-r * 0.16, r * 0.03); x.closePath(); x.fill();
      x.restore();
      x.fillStyle = '#1b1b1b'; x.beginPath(); x.arc(cx, cy, r * 0.09, 0, TAU); x.fill();
      // ガラスの反射
      var gl = x.createLinearGradient(cx - r, cy - r, cx + r * 0.2, cy + r * 0.3);
      gl.addColorStop(0, 'rgba(255,255,255,0.35)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)');
      x.fillStyle = gl; x.beginPath(); x.arc(cx, cy, r, Math.PI * 1.0, Math.PI * 1.75); x.fill();
    }
    var cy = H * 0.58;
    dial(W * 0.5, cy, H * 0.4, 0, 9000, c.rpm, 250, 1000, d.redline, 'RPM ×1000', d.engineLabel, true);
    dial(W * 0.2, cy + 6, H * 0.27, 0, 400, kmh, 10, 50, 0, 'km/h', '', false);
    // ブースト計
    var bx = W * 0.8, br = H * 0.27;
    dial(bx, cy + 6, br, -1, 2, (c.boostBar || 0) - (c.thr < 0.1 ? 0.6 : 0), 0.25, 1, 1.5, 'BOOST', 'bar', false);
    // ギア(文字盤の中の小窓)
    x.fillStyle = '#111'; roundRect(x, W * 0.5 - 18, cy + H * 0.12, 36, 30, 4); x.fill();
    x.fillStyle = '#ffb347'; x.font = '700 26px ' + MONO; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(c.gear === -1 ? 'R' : String(c.gear), W * 0.5, cy + H * 0.12 + 16);
    // 警告灯
    lamp(x, W * 0.36, 34, c.rpm > d.redline * 0.96, '#ff3b30', 'SHIFT');
    lamp(x, W * 0.5, 34, c.otActive, '#ffcc00', 'SCRMB');
    lamp(x, W * 0.64, 34, c.oilT > 112, '#ff9500', 'OIL');
    x.textBaseline = 'alphabetic';
  }
  function lamp(x, cx, cy, on, color, label) {
    x.fillStyle = on ? color : 'rgba(80,80,80,0.6)';
    if (on) { x.shadowColor = color; x.shadowBlur = 12; }
    x.beginPath(); x.arc(cx, cy, 6, 0, TAU); x.fill(); x.shadowBlur = 0;
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '600 10px ' + FONT; x.textAlign = 'center'; x.fillText(label, cx, cy + 18);
  }

  // --- 2. LEDバーグラフ ---
  function drawBargraph(x, W, H, c, d, kmh) {
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(14,16,14,0.92)'; roundRect(x, 4, 10, W - 8, H - 14, 10); x.fill();
    x.strokeStyle = 'rgba(160,190,160,0.25)'; x.lineWidth = 1; x.stroke();
    // 回転のバー(緑→琥珀→赤)
    var n = 48, bx = 22, bw = W - 44, y0 = 22, bh = 28, seg = bw / n;
    var lit = Math.floor(clamp(c.rpm / d.limiter, 0, 1) * n);
    for (var i = 0; i < n; i++) {
      var f = i / n, colr = f < 0.7 ? [70, 255, 120] : f < 0.88 ? [255, 190, 40] : [255, 50, 40];
      var on = i < lit;
      x.fillStyle = 'rgba(' + colr.join(',') + ',' + (on ? 1 : 0.1) + ')';
      if (on) { x.shadowColor = 'rgba(' + colr.join(',') + ',0.9)'; x.shadowBlur = 8; }
      var hh = bh * (0.45 + 0.55 * f);
      x.fillRect(bx + i * seg + 1, y0 + bh - hh, seg - 2.5, hh);
      x.shadowBlur = 0;
    }
    x.fillStyle = 'rgba(140,200,150,0.6)'; x.font = '10px ' + MONO; x.textAlign = 'center';
    for (var k = 0; k <= Math.floor(d.limiter / 1000); k++) x.fillText(String(k), bx + (k * 1000 / d.limiter) * bw, y0 + bh + 11);
    // 7セグ風の数字
    x.textAlign = 'left';
    seg7(x, String(Math.round(kmh)).padStart(3, ' '), 26, H - 22, 44, '#56ff8a');
    x.fillStyle = 'rgba(140,200,150,0.7)'; x.font = '11px ' + MONO; x.fillText('KM/H', 26, H - 8);
    seg7(x, c.gear === -1 ? 'R' : String(c.gear), W / 2 - 30, H - 22, 52, '#ffbf3a');
    x.fillStyle = 'rgba(255,190,60,0.7)'; x.fillText('GEAR', W / 2 - 30, H - 8);
    // 水温・油温・燃料(小さなバー)
    var meters = [['WATER', c.waterT, 60, 120, '°C'], ['OIL', c.oilT, 60, 140, '°C'], ['FUEL', c.fuel, 0, 100, 'L']];
    meters.forEach(function (m, j) {
      var mx = W - 178, my = H - 76 + j * 20;
      x.fillStyle = 'rgba(140,200,150,0.7)'; x.font = '10px ' + MONO; x.fillText(m[0], mx, my + 8);
      for (var s = 0; s < 12; s++) {
        var on = s / 12 < (m[1] - m[2]) / (m[3] - m[2]);
        x.fillStyle = on ? (s > 9 && j < 2 ? '#ff5040' : '#56ff8a') : 'rgba(86,255,138,0.1)';
        x.fillRect(mx + 44 + s * 6, my, 4, 9);
      }
      x.fillStyle = '#bfe8c8'; x.fillText(Math.round(m[1]) + m[4], mx + 122, my + 8);
    });
    if (c.rpm > d.redline * 0.97) { x.fillStyle = 'rgba(255,60,40,' + (0.5 + 0.5 * Math.sin(performance.now() / 40)) + ')'; x.fillRect(bx, 12, bw, 5); }
  }
  // 7セグメント
  var SEG = { '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcfgd', 'R': 'efab', ' ': '', '-': 'g', 'N': 'ceba' };
  function seg7(x, str, X, Y, h, color) {
    var w = h * 0.55, t = h * 0.12;
    for (var k = 0; k < str.length; k++) {
      var on = SEG[str[k]] || '', ox = X + k * (w + t * 2.2);
      var segs = { a: [ox + t, Y - h, w - 2 * t, t], b: [ox + w - t, Y - h + t, t, h / 2 - t * 1.5], c: [ox + w - t, Y - h / 2 + t / 2, t, h / 2 - t * 1.5], d: [ox + t, Y - t, w - 2 * t, t], e: [ox, Y - h / 2 + t / 2, t, h / 2 - t * 1.5], f: [ox, Y - h + t, t, h / 2 - t * 1.5], g: [ox + t, Y - h / 2 - t / 2, w - 2 * t, t] };
      for (var s in segs) {
        var r = segs[s], lit = on.indexOf(s) >= 0;
        x.fillStyle = lit ? color : 'rgba(255,255,255,0.05)';
        if (lit) { x.shadowColor = color; x.shadowBlur = 10; }
        x.fillRect(r[0], r[1], r[2], r[3]); x.shadowBlur = 0;
      }
    }
  }

  // --- 3. LMP1 のハンドル液晶 ---
  function drawLMP1(x, W, H, c, d, kmh, info) {
    x.clearRect(0, 0, W, H);
    // ハンドルの形
    x.fillStyle = 'rgba(18,19,22,0.94)';
    x.beginPath();
    x.moveTo(30, 30); x.lineTo(W - 30, 30); x.quadraticCurveTo(W - 4, 32, W - 8, 70); x.lineTo(W - 22, H - 10); x.lineTo(22, H - 10); x.lineTo(8, 70); x.quadraticCurveTo(4, 32, 30, 30);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.1)'; x.stroke();
    // シフトライト(緑→赤→青)
    var n = 15, lx = 50, lw = W - 100, frac = clamp((c.rpm - d.redline * 0.62) / (d.redline * 0.38), 0, 1);
    var lit = Math.round(frac * n), flash = c.rpm > d.redline * 0.985 && (Math.floor(performance.now() / 70) % 2 === 0);
    for (var i = 0; i < n; i++) {
      var colr = i < 5 ? '#3cff6e' : i < 10 ? '#ff2a2a' : '#3a8bff';
      var on = flash || i < lit;
      x.fillStyle = on ? (flash ? '#3a8bff' : colr) : 'rgba(255,255,255,0.08)';
      if (on) { x.shadowColor = x.fillStyle; x.shadowBlur = 10; }
      x.beginPath(); x.arc(lx + (i + 0.5) * lw / n, 16, 5.5, 0, TAU); x.fill(); x.shadowBlur = 0;
    }
    // 画面
    var sx = 60, sy = 40, sw = W - 120, sh = H - 62;
    x.fillStyle = '#05070a'; roundRect(x, sx, sy, sw, sh, 6); x.fill();
    x.strokeStyle = '#2a3038'; x.lineWidth = 2; x.stroke();
    // ギア(中央大)
    x.fillStyle = '#ffffff'; x.font = '700 64px ' + FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(c.gear === -1 ? 'R' : String(c.gear), sx + sw / 2, sy + sh * 0.48);
    // 速度
    x.font = '600 26px ' + FONT; x.textAlign = 'left'; x.fillStyle = '#e8eef4';
    x.fillText(String(Math.round(kmh)), sx + 12, sy + 26);
    x.font = '10px ' + FONT; x.fillStyle = '#7d8a99'; x.fillText('KM/H', sx + 12, sy + 46);
    // デルタ
    x.textAlign = 'right'; x.font = '600 22px ' + FONT;
    var dl = info.delta;
    x.fillStyle = dl == null ? '#7d8a99' : dl <= 0 ? '#3cff6e' : '#ff4a4a';
    x.fillText(fmtDelta(dl), sx + sw - 10, sy + 26);
    x.font = '10px ' + FONT; x.fillStyle = '#7d8a99'; x.fillText('DELTA', sx + sw - 10, sy + 46);
    // 電池と展開
    var soc = d.ers ? c.ersE / d.ers.battery : 0;
    var by = sy + sh - 22;
    x.fillStyle = '#7d8a99'; x.font = '10px ' + FONT; x.textAlign = 'left'; x.fillText('SOC', sx + 12, by - 6);
    x.fillStyle = '#1a2230'; x.fillRect(sx + 12, by, 90, 10);
    x.fillStyle = soc > 0.25 ? '#3a8bff' : '#ff4a4a'; x.fillRect(sx + 12, by, 90 * soc, 10);
    x.fillStyle = '#c8d4e0'; x.fillText(Math.round(soc * 100) + '%', sx + 106, by + 9);
    x.textAlign = 'right'; x.fillStyle = '#7d8a99'; x.fillText('ERS kW', sx + sw - 12, by - 6);
    var dep = c.ersP / 1000, hv = c.harvestP / 1000;
    x.fillStyle = dep > 0 ? '#ffd23a' : hv > 0 ? '#3cff6e' : '#c8d4e0';
    x.font = '600 14px ' + FONT;
    x.fillText(dep > 0 ? '+' + Math.round(dep) : hv > 0 ? '−' + Math.round(hv) : '0', sx + sw - 12, by + 10);
    // ボタン類(飾り)
    [['TC', '#2b6cff'], ['BB', '#ff8a00'], ['PIT', '#ffffff'], ['OT', c.otActive ? '#ffd23a' : '#444']].forEach(function (bt, k) {
      var bx = k < 2 ? 26 : W - 26, byy = 58 + (k % 2) * 34;
      x.fillStyle = bt[1]; x.beginPath(); x.arc(bx, byy, 10, 0, TAU); x.fill();
      x.fillStyle = '#000'; x.font = '700 8px ' + FONT; x.textAlign = 'center'; x.fillText(bt[0], bx, byy + 3);
    });
    x.textBaseline = 'alphabetic';
  }

  // --- 4. ハイパーカー:弧のセグメント ---
  function drawHyper(x, W, H, c, d, kmh, info) {
    x.clearRect(0, 0, W, H);
    var cx = W / 2, cy = H * 0.86, r = Math.min(W * 0.46, H * 0.8);
    // 背景
    var bg = x.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 1.15);
    bg.addColorStop(0, 'rgba(8,10,14,0.85)'); bg.addColorStop(1, 'rgba(8,10,14,0)');
    x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, r * 1.15, Math.PI, TAU); x.fill();
    var a0 = Math.PI * 1.02, a1 = Math.PI * 1.98, n = 60;
    var frac = clamp(c.rpm / d.limiter, 0, 1);
    for (var i = 0; i < n; i++) {
      var f = i / n, a = a0 + f * (a1 - a0), aa = a + (a1 - a0) / n * 0.75;
      var on = f < frac, red = f > d.redline / d.limiter - 0.04;
      x.strokeStyle = on ? (red ? '#ff2a3a' : 'rgba(240,244,248,' + (0.55 + f * 0.45) + ')') : 'rgba(255,255,255,0.08)';
      x.lineWidth = 14 + f * 8;
      if (on && red) { x.shadowColor = '#ff2a3a'; x.shadowBlur = 14; }
      x.beginPath(); x.arc(cx, cy, r * 0.9, a, aa); x.stroke(); x.shadowBlur = 0;
    }
    // 数字
    for (var k = 0; k <= Math.floor(d.limiter / 1000); k++) {
      var ak = a0 + (k * 1000 / d.limiter) * (a1 - a0);
      arcText(x, String(k), cx, cy, r * 0.72, ak, 12, k * 1000 >= d.redline ? '#ff5060' : 'rgba(230,236,242,0.7)');
    }
    // エネルギーの輪(内側の細い弧)
    var soc = d.ers ? c.ersE / d.ers.battery : 0;
    x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, r * 0.6, a0, a1); x.stroke();
    x.strokeStyle = c.ersP > 0 ? '#ffd23a' : '#46c8ff'; x.beginPath(); x.arc(cx, cy, r * 0.6, a0, a0 + soc * (a1 - a0)); x.stroke();
    // 速度・ギア
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#ffffff'; x.font = '300 58px ' + FONT;
    x.fillText(String(Math.round(kmh)), cx, cy - r * 0.2);
    x.font = '500 12px ' + FONT; x.fillStyle = 'rgba(220,228,236,0.7)'; x.fillText('KM/H', cx, cy - r * 0.2 + 16);
    x.fillStyle = '#ff2a3a'; x.font = '700 30px ' + FONT;
    x.fillText(c.gear === -1 ? 'R' : String(c.gear), cx, cy - 4);
    // ハイブリッドの状態
    var st = c.ersP > 0 ? 'DEPLOY' : c.harvestP > 0 ? 'HARVEST' : (c.speed * 3.6 < 160 ? 'MGU < 160' : 'READY');
    x.font = '600 11px ' + FONT; x.fillStyle = c.ersP > 0 ? '#ffd23a' : '#46c8ff';
    x.textAlign = 'left'; x.fillText('HYBRID ' + st, 14, H - 10);
    x.textAlign = 'right'; x.fillStyle = 'rgba(220,228,236,0.8)';
    x.fillText('BOOST ' + (c.boostBar || 0).toFixed(2) + ' bar', W - 14, H - 10);
  }

  function roundRect(x, X, Y, w, h, r) {
    x.beginPath(); x.moveTo(X + r, Y); x.lineTo(X + w - r, Y); x.quadraticCurveTo(X + w, Y, X + w, Y + r);
    x.lineTo(X + w, Y + h - r); x.quadraticCurveTo(X + w, Y + h, X + w - r, Y + h); x.lineTo(X + r, Y + h);
    x.quadraticCurveTo(X, Y + h, X, Y + h - r); x.lineTo(X, Y + r); x.quadraticCurveTo(X, Y, X + r, Y); x.closePath();
  }

  var GAUGES = { analog: { w: 440, h: 210, draw: drawAnalog }, bargraph: { w: 440, h: 140, draw: drawBargraph }, lmp1: { w: 380, h: 200, draw: drawLMP1 }, hyper: { w: 400, h: 220, draw: drawHyper } };

  // ================= テレメトリー =================
  function drawG(x, W, H, c, trail) {
    x.clearRect(0, 0, W, H);
    var cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 8, sc = r / 3.5;
    x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 1;
    for (var k = 1; k <= 3; k++) { x.beginPath(); x.arc(cx, cy, k * sc, 0, TAU); x.stroke(); }
    x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.5)'; x.font = '9px ' + FONT; x.textAlign = 'left';
    for (k = 1; k <= 3; k++) x.fillText(k + 'G', cx + k * sc + 2, cy - 2);
    // 軌跡
    x.strokeStyle = 'rgba(255,90,90,0.5)'; x.lineWidth = 1.5; x.beginPath();
    for (var i = 0; i < trail.length; i++) { var p = trail[i]; var px = cx - p[0] * sc, py = cy - p[1] * sc; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
    x.stroke();
    var gx = -c.ayF / 9.81, gy = c.axF / 9.81;
    x.fillStyle = '#ff3b3b'; x.shadowColor = '#ff3b3b'; x.shadowBlur = 8;
    x.beginPath(); x.arc(cx + gx * sc, cy - gy * sc, 5, 0, TAU); x.fill(); x.shadowBlur = 0;
  }
  function tireColor(t) {
    var f = clamp((t - 50) / 70, 0, 1);
    if (f < 0.5) { var k = f / 0.5; return 'rgb(' + Math.round(70 + k * 30) + ',' + Math.round(140 + k * 80) + ',' + Math.round(255 - k * 120) + ')'; }
    var k2 = (f - 0.5) / 0.5; return 'rgb(' + Math.round(100 + k2 * 155) + ',' + Math.round(220 - k2 * 170) + ',' + Math.round(135 - k2 * 95) + ')';
  }
  function drawTires(x, W, H, c) {
    x.clearRect(0, 0, W, H);
    var pos = [[0.27, 0.22], [0.73, 0.22], [0.27, 0.72], [0.73, 0.72]];
    // 上から見た車体
    x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 1;
    roundRect(x, W * 0.38, H * 0.08, W * 0.24, H * 0.84, 10); x.stroke();
    var idx = [0, 1, 2, 3]; // FL FR RL RR(physics は FL=0, FR=1)
    for (var k = 0; k < 4; k++) {
      var i = idx[k], p = pos[k], tx = W * p[0] - 13, ty = H * p[1] - 22;
      x.fillStyle = tireColor(c.tireT[i]);
      roundRect(x, tx, ty, 26, 44, 5); x.fill();
      // 負荷のバー
      var load = clamp(c.Fz[i] / (c.m * 9.81 / 4) / 3, 0, 1);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(tx + 3, ty + 44 - 40 * load - 2, 4, 40 * load);
      x.fillStyle = '#fff'; x.font = '600 11px ' + FONT; x.textAlign = k % 2 ? 'left' : 'right';
      var lx = k % 2 ? tx + 32 : tx - 6;
      x.fillText(Math.round(c.tireT[i]) + '°C', lx, ty + 12);
      x.fillStyle = 'rgba(255,255,255,0.65)'; x.font = '10px ' + FONT;
      x.fillText('α ' + (c.alpha[i] * 57.3).toFixed(1) + '°', lx, ty + 25);
      x.fillText(Math.round(c.Fz[i] / 9.81) + 'kg', lx, ty + 37);
      // ブレーキ温度
      var bt = clamp((c.brakeT[i] - 150) / 800, 0, 1);
      x.fillStyle = 'rgba(' + Math.round(120 + bt * 135) + ',' + Math.round(120 - bt * 60) + ',' + Math.round(120 - bt * 100) + ',0.9)';
      x.fillRect(k % 2 ? tx - 6 : tx + 28, ty + 10, 4, 24);
    }
  }
  function drawTrace(x, W, H, hist) {
    x.clearRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,0.1)'; x.lineWidth = 1;
    for (var k = 1; k < 4; k++) { x.beginPath(); x.moveTo(0, H * k / 4); x.lineTo(W, H * k / 4); x.stroke(); }
    var n = hist.length; if (n < 2) return;
    function line(idx, color, scale, lw) {
      x.strokeStyle = color; x.lineWidth = lw || 1.5; x.beginPath();
      for (var i = 0; i < n; i++) { var px = i / (hist.max - 1) * W, py = H - 2 - clamp(hist[i][idx] * scale, 0, 1) * (H - 4); if (i) x.lineTo(px, py); else x.moveTo(px, py); }
      x.stroke();
    }
    line(1, 'rgba(80,220,120,0.9)', 1); line(2, 'rgba(255,70,70,0.9)', 1);
    // ステア(中央線から)
    x.strokeStyle = 'rgba(120,180,255,0.8)'; x.lineWidth = 1; x.beginPath();
    for (var i = 0; i < n; i++) { var px = i / (hist.max - 1) * W, py = H / 2 - hist[i][3] * H * 0.45; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
    x.stroke();
    line(0, '#ffffff', 1 / 360, 2);
  }

  // ミニマップ
  function MiniMap(cv, tr, size) {
    this.cv = cv; this.tr = tr; this.size = size;
    this.x = hiDPI(cv, size, size);
    var b = tr.bounds, w = b.maxx - b.minx, h = b.maxy - b.miny;
    this.sc = (size - 24) / Math.max(w, h);
    this.ox = size / 2 - (b.minx + w / 2) * this.sc; this.oy = size / 2 + (b.miny + h / 2) * this.sc;
    // 背景を先に描いておく
    var off = document.createElement('canvas'); var ox = hiDPI(off, size, size);
    ox.lineJoin = 'round'; ox.lineCap = 'round';
    ox.strokeStyle = 'rgba(10,20,30,0.45)'; ox.lineWidth = 7; this.path(ox); ox.stroke();
    ox.strokeStyle = 'rgba(255,255,255,0.92)'; ox.lineWidth = 3; this.path(ox); ox.stroke();
    // セクター境界
    var self = this;
    tr.sectors.forEach(function (s, k) {
      var p = TrackGen.pointAt(tr, s, 0);
      ox.fillStyle = k === 0 ? '#c0242c' : 'rgba(30,40,52,0.9)';
      ox.beginPath(); ox.arc(self.mx(p.x), self.my(p.y), k === 0 ? 4.5 : 3, 0, TAU); ox.fill();
    });
    this.bg = off;
  }
  MiniMap.prototype.mx = function (x) { return this.ox + x * this.sc; };
  MiniMap.prototype.my = function (y) { return this.oy - y * this.sc; };
  MiniMap.prototype.path = function (x) {
    var tr = this.tr; x.beginPath();
    for (var i = 0; i <= tr.N; i += 3) { var k = i % tr.N; if (i) x.lineTo(this.mx(tr.x[k]), this.my(tr.y[k])); else x.moveTo(this.mx(tr.x[k]), this.my(tr.y[k])); }
    x.closePath();
  };
  MiniMap.prototype.draw = function (cars, playerIdx, ghost) {
    var x = this.x, s = this.size;
    x.clearRect(0, 0, s, s);
    x.drawImage(this.bg, 0, 0, s, s);
    if (ghost) { x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.arc(this.mx(ghost.x), this.my(ghost.y), 3.5, 0, TAU); x.fill(); }
    for (var k = cars.length - 1; k >= 0; k--) {
      var c = cars[k], me = k === playerIdx;
      x.fillStyle = me ? '#ff2a36' : c.color || '#1d2b3a';
      x.strokeStyle = '#fff'; x.lineWidth = me ? 2 : 1;
      x.beginPath(); x.arc(this.mx(c.sim.x), this.my(c.sim.y), me ? 5.5 : 4, 0, TAU); x.fill(); x.stroke();
    }
  };

  return {
    GAUGES: GAUGES, hiDPI: hiDPI, fmtTime: fmtTime, fmtDelta: fmtDelta,
    drawG: drawG, drawTires: drawTires, drawTrace: drawTrace, MiniMap: MiniMap, tireColor: tireColor, roundRect: roundRect
  };
})();
