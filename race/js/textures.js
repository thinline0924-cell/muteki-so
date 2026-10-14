/* =========================================================
   textures.js — 画像ファイルを使わず、キャンバスに描いて質感を作る
   (アスファルト・縁石・芝・グラベル・壁・観客・マシンの塗装 など)
   ========================================================= */
var Tex = (function () {
  // 決まった種から同じ乱数列を出す(毎回同じ模様になる)
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function toTex(c, rx, ry, srgb) {
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = Tex.aniso || 4;
    if (srgb !== false) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  // 値ノイズ(なめらかなムラ)
  function valueNoise(w, h, cell, seed) {
    var r = rng(seed), gw = Math.ceil(w / cell) + 1, gh = Math.ceil(h / cell) + 1, g = [];
    for (var i = 0; i < gw * gh; i++) g.push(r());
    // 端をつなげる(タイル状にくり返せるように)
    for (var y = 0; y < gh; y++) g[y * gw + gw - 1] = g[y * gw];
    for (var x = 0; x < gw; x++) g[(gh - 1) * gw + x] = g[x];
    return function (px, py) {
      var fx = px / cell, fy = py / cell, ix = Math.floor(fx), iy = Math.floor(fy);
      var tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
  }
  function noiseFill(ctx, w, h, base, amp, seed, cells) {
    var img = ctx.getImageData(0, 0, w, h), d = img.data, r = rng(seed);
    var ns = (cells || [64, 16]).map(function (c, k) { return valueNoise(w, h, c, seed + k * 7); });
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var n = 0;
      for (var k = 0; k < ns.length; k++) n += (ns[k](x, y) - 0.5) / (k + 1);
      var gr = (r() - 0.5) * amp[1];
      var i = (y * w + x) * 4;
      d[i] = base[0] + n * amp[0] + gr; d[i + 1] = base[1] + n * amp[0] + gr; d[i + 2] = base[2] + n * amp[0] + gr; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- アスファルト(白線入り)----
  function asphalt() {
    var w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, [62, 64, 68], [26, 22], 11, [128, 32, 8]);
    var r = rng(5);
    // 骨材のつぶ
    for (var i = 0; i < 9000; i++) {
      var v = 40 + r() * 70;
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 4) + ',' + (0.35 + r() * 0.4) + ')';
      x.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    // 補修跡のパッチ
    for (i = 0; i < 4; i++) {
      x.fillStyle = 'rgba(30,32,36,0.18)';
      x.fillRect(80 + r() * 300, r() * h, 40 + r() * 90, 60 + r() * 160);
    }
    // 走行ライン付近のタイヤかす(中央寄りの暗い帯)
    var gd = x.createLinearGradient(0, 0, w, 0);
    gd.addColorStop(0.0, 'rgba(0,0,0,0)'); gd.addColorStop(0.3, 'rgba(10,10,12,0.12)');
    gd.addColorStop(0.5, 'rgba(10,10,12,0.05)'); gd.addColorStop(0.7, 'rgba(10,10,12,0.12)'); gd.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gd; x.fillRect(0, 0, w, h);
    // 白線(両端)
    x.fillStyle = '#e9ebec';
    x.fillRect(4, 0, 9, h); x.fillRect(w - 13, 0, 9, h);
    for (i = 0; i < 400; i++) { x.fillStyle = 'rgba(60,62,66,0.5)'; x.fillRect(4 + r() * 9, r() * h, 2, 2); x.fillRect(w - 13 + r() * 9, r() * h, 2, 2); }
    return toTex(c);
  }
  function asphaltRough() {
    var w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, [215, 215, 215], [40, 50], 21, [64, 8]);
    var gd = x.createLinearGradient(0, 0, w, 0);
    gd.addColorStop(0.0, 'rgba(0,0,0,0)'); gd.addColorStop(0.32, 'rgba(0,0,0,0.25)'); gd.addColorStop(0.5, 'rgba(0,0,0,0.1)'); gd.addColorStop(0.68, 'rgba(0,0,0,0.25)'); gd.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gd; x.fillRect(0, 0, w, h);
    return toTex(c, 1, 1, false);
  }
  // ---- 縁石(赤白)----
  function kerb() {
    var w = 64, h = 256, c = canvas(w, h), x = c.getContext('2d');
    for (var i = 0; i < 4; i++) {
      x.fillStyle = i % 2 ? '#e8e6e2' : '#b81d25';
      x.fillRect(0, i * 64, w, 64);
    }
    var r = rng(9);
    for (i = 0; i < 1500; i++) { x.fillStyle = 'rgba(0,0,0,' + r() * 0.12 + ')'; x.fillRect(r() * w, r() * h, 2, 2); }
    // 段差の影
    var gd = x.createLinearGradient(0, 0, w, 0);
    gd.addColorStop(0, 'rgba(0,0,0,0.25)'); gd.addColorStop(0.2, 'rgba(0,0,0,0)'); gd.addColorStop(1, 'rgba(0,0,0,0.1)');
    x.fillStyle = gd; x.fillRect(0, 0, w, h);
    return toTex(c);
  }
  function grass(tint) {
    var w = 512, h = 512, c = canvas(w, h), x = c.getContext('2d');
    var b = tint || [78, 104, 62];
    noiseFill(x, w, h, b, [40, 26], 31, [128, 32, 6]);
    var r = rng(3);
    for (var i = 0; i < 14000; i++) {
      var g = b[1] + (r() - 0.4) * 60;
      x.fillStyle = 'rgba(' + (b[0] + (r() - 0.5) * 30) + ',' + g + ',' + (b[2] + (r() - 0.5) * 20) + ',0.6)';
      x.fillRect(r() * w, r() * h, 1, 2 + r() * 3);
    }
    return toTex(c);
  }
  function mowStripes(tint) {
    var w = 256, h = 512, c = canvas(w, h), x = c.getContext('2d');
    var b = tint || [86, 112, 66];
    noiseFill(x, w, h, b, [24, 22], 41, [64, 6]);
    for (var i = 0; i < 4; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; x.fillRect(0, i * 128, w, 128); }
    return toTex(c);
  }
  function gravel() {
    var w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, [168, 152, 124], [24, 40], 51, [32, 8]);
    var r = rng(7);
    for (var i = 0; i < 5000; i++) { var v = 110 + r() * 110; x.fillStyle = 'rgb(' + v + ',' + (v * 0.92) + ',' + (v * 0.78) + ')'; x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    return toTex(c);
  }
  function concrete(label) {
    var w = 512, h = 64, c = canvas(w, h), x = c.getContext('2d');
    noiseFill(x, w, h, [190, 192, 190], [30, 18], 61, [64, 8]);
    x.fillStyle = 'rgba(0,0,0,0.15)'; for (var i = 0; i < w; i += 128) x.fillRect(i, 0, 2, h);
    // 赤白のライン
    x.fillStyle = '#c0242c'; x.fillRect(0, h - 10, w, 6);
    if (label) {
      x.fillStyle = 'rgba(30,40,52,0.85)'; x.font = '600 26px "Rajdhani", sans-serif'; x.textBaseline = 'middle';
      x.fillText(label, 24, 26); x.fillText(label, 280, 26);
    }
    return toTex(c);
  }
  function adPanel(text, bg, fg, accent) {
    var w = 512, h = 96, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = accent; x.fillRect(0, h - 10, w, 10);
    x.fillStyle = fg; x.font = '700 50px "Rajdhani", sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'center';
    x.fillText(text, w / 2, h / 2 - 4);
    return toTex(c, 1, 1);
  }
  function crowd() {
    var w = 512, h = 128, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#3a3f46'; x.fillRect(0, 0, w, h);
    var r = rng(77), cols = ['#e8e4dc', '#c42a2a', '#2c4c8c', '#f0c040', '#ffffff', '#20262e', '#8aa0b4', '#d06a2a'];
    for (var row = 0; row < 8; row++) for (var i = 0; i < 64; i++) {
      if (r() < 0.18) continue;
      x.fillStyle = cols[Math.floor(r() * cols.length)];
      x.beginPath(); x.arc(i * 8 + 4 + (r() - 0.5) * 2, row * 16 + 6, 3, 0, 7); x.fill();
      x.fillStyle = '#d9b89a'; x.beginPath(); x.arc(i * 8 + 4, row * 16 + 2, 2, 0, 7); x.fill();
    }
    return toTex(c);
  }
  function windows() {
    var w = 256, h = 128, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#d8dde2'; x.fillRect(0, 0, w, h);
    for (var i = 0; i < 8; i++) {
      var gd = x.createLinearGradient(0, 0, 0, 50);
      gd.addColorStop(0, '#3b5068'); gd.addColorStop(1, '#8aa5bd');
      x.fillStyle = gd; x.fillRect(i * 32 + 3, 12, 26, 40);
      x.fillStyle = '#6a7680'; x.fillRect(i * 32 + 2, 70, 28, 50);
      x.fillStyle = '#c0242c'; x.fillRect(i * 32 + 2, 64, 28, 4);
    }
    return toTex(c);
  }
  function checker() {
    var w = 128, h = 32, c = canvas(w, h), x = c.getContext('2d');
    for (var i = 0; i < 16; i++) for (var j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#f2f2f2'; x.fillRect(i * 8, j * 8, 8, 8); }
    return toTex(c);
  }
  function board(text) {
    var w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#c0242c'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10);
    x.fillStyle = '#111'; x.font = '700 64px "Rajdhani", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 4);
    return toTex(c);
  }
  function soft(color) {
    var s = 64, c = canvas(s, s), x = c.getContext('2d');
    var g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, color || 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    var t = new THREE.CanvasTexture(c); return t;
  }
  function shadowBlob() {
    var s = 128, c = canvas(s, s), x = c.getContext('2d');
    var g = x.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.6, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }
  // ---- ホイール(スポーク)----
  function rim(style) {
    var s = 256, c = canvas(s, s), x = c.getContext('2d'), cx = s / 2;
    x.fillStyle = '#16181b'; x.fillRect(0, 0, s, s);
    var g = x.createRadialGradient(cx, cx, 10, cx, cx, cx);
    g.addColorStop(0, '#d9dde2'); g.addColorStop(0.75, '#8d949c'); g.addColorStop(0.9, '#c9ced4'); g.addColorStop(1, '#2a2d31');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cx, cx - 2, 0, 7); x.fill();
    x.fillStyle = '#15171a';
    var n = style === 'mesh' ? 12 : (style === 'turbine' ? 18 : 7);
    for (var i = 0; i < n; i++) {
      x.save(); x.translate(cx, cx); x.rotate(i / n * Math.PI * 2);
      x.beginPath();
      if (style === 'turbine') { x.moveTo(22, -4); x.quadraticCurveTo(70, -20, 108, -10); x.lineTo(108, 6); x.quadraticCurveTo(70, -2, 22, 6); }
      else { x.moveTo(26, -7); x.lineTo(108, -14 * (7 / n) - 4); x.lineTo(108, 14 * (7 / n) + 4); x.lineTo(26, 7); }
      x.closePath(); x.fill(); x.restore();
    }
    x.fillStyle = '#c0242c'; x.beginPath(); x.arc(cx, cx, 16, 0, 7); x.fill();
    x.fillStyle = '#2a2d31'; x.beginPath(); x.arc(cx, cx, 9, 0, 7); x.fill();
    return toTex(c);
  }
  function tireSide() {
    var s = 256, c = canvas(s, s), x = c.getContext('2d'), cx = s / 2;
    x.fillStyle = '#141516'; x.fillRect(0, 0, s, s);
    x.fillStyle = '#9a9ea3'; x.font = '700 15px "Rajdhani", sans-serif'; x.textAlign = 'center';
    ['MUSOU RACING', 'SLICK  305/680 R18'].forEach(function (t, k) {
      for (var i = 0; i < t.length; i++) {
        x.save(); x.translate(cx, cx); x.rotate((i - t.length / 2) * 0.075 + k * Math.PI);
        x.fillText(t[i], 0, -108); x.restore();
      }
    });
    return toTex(c);
  }

  // ---- 金網フェンス(透ける)----
  function fence() {
    var w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
    x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(70,76,82,0.9)'; x.lineWidth = 1.4;
    for (var i = -h; i < w + h; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); x.beginPath(); x.moveTo(i, h); x.lineTo(i + h, 0); x.stroke(); }
    x.fillStyle = 'rgba(60,64,70,1)'; x.fillRect(0, 0, w, 4); x.fillRect(0, 0, 4, h);
    return toTex(c);
  }

  // ---- カーボン(綾織り)----
  function carbon() {
    var s = 128, c = canvas(s, s), x = c.getContext('2d');
    x.fillStyle = '#16181b'; x.fillRect(0, 0, s, s);
    for (var j = 0; j < 16; j++) for (var i = 0; i < 16; i++) {
      var on = ((i + j) >> 1) % 2 === 0;
      var g = x.createLinearGradient(i * 8, j * 8, i * 8 + (on ? 8 : 0), j * 8 + (on ? 0 : 8));
      g.addColorStop(0, '#1d2024'); g.addColorStop(0.5, on ? '#3a3f46' : '#2a2e33'); g.addColorStop(1, '#1d2024');
      x.fillStyle = g; x.fillRect(i * 8 + 0.5, j * 8 + 0.5, 7, 7);
    }
    return toTex(c, 6, 6);
  }

  // ---- マシンの塗装(上=左側面, 中央=上面, 下=右側面)----
  function livery(car) {
    var W = 1024, H = 1024, c = canvas(W, H), x = c.getContext('2d'), L = car.livery;
    x.fillStyle = L.base; x.fillRect(0, 0, W, H);
    var leftY0 = 0, leftY1 = 307, topY0 = 307, topY1 = 717, rightY0 = 717, rightY1 = 1024;
    function sideBand(y0, y1, mirror, draw) {
      x.save(); x.beginPath(); x.rect(0, y0, W, y1 - y0); x.clip();
      x.translate(0, y0);
      if (mirror) { x.translate(W, 0); x.scale(-1, 1); }
      draw(y1 - y0, mirror); x.restore();
    }
    // 側面:z(高さ)は上ほど高い → キャンバスでは上ほど高い
    function sideArt(h, mirror) {
      // x: キャンバス左端=車の後ろ (mirror時は前後逆)
      if (car.id === 'kestrel') {
        x.fillStyle = L.a; x.fillRect(0, h * 0.52, W, h * 0.16);
        x.fillStyle = L.b; x.fillRect(0, h * 0.70, W, h * 0.05);
        x.fillStyle = L.c; x.fillRect(0, h * 0.77, W, h * 0.03);
      } else if (car.id === 'rotary') {
        x.fillStyle = L.a;
        x.beginPath(); x.moveTo(0, h * 0.35); x.lineTo(W * 0.45, h * 0.35); x.lineTo(W * 0.62, h); x.lineTo(0, h); x.fill();
        x.fillStyle = L.c; x.fillRect(0, h * 0.86, W, h * 0.14);
        x.fillStyle = L.b; x.beginPath(); x.moveTo(W * 0.45, h * 0.35); x.lineTo(W * 0.5, h * 0.35); x.lineTo(W * 0.67, h); x.lineTo(W * 0.62, h); x.fill();
      } else if (car.id === 'aurora') {
        x.fillStyle = L.a; x.fillRect(0, h * 0.62, W, h * 0.38);
        x.fillStyle = L.b; x.beginPath(); x.moveTo(W * 0.15, h * 0.62); x.lineTo(W * 0.85, h * 0.62); x.lineTo(W * 0.82, h * 0.56); x.lineTo(W * 0.18, h * 0.56); x.fill();
        x.fillStyle = L.c; x.fillRect(0, h * 0.5, W, h * 0.02);
      } else {
        x.fillStyle = L.a;
        x.beginPath(); x.moveTo(W * 0.05, h); x.lineTo(W * 0.42, h * 0.38); x.lineTo(W * 0.52, h * 0.38); x.lineTo(W * 0.2, h); x.fill();
        x.fillStyle = L.b; x.beginPath(); x.moveTo(W * 0.55, h); x.lineTo(W * 0.78, h * 0.42); x.lineTo(W * 0.82, h * 0.42); x.lineTo(W * 0.6, h); x.fill();
        x.fillStyle = L.c; x.fillRect(0, h * 0.9, W, h * 0.1);
      }
      // ゼッケン
      var nx = W * 0.5, ny = h * 0.42, r = h * 0.17;
      x.save(); x.translate(nx, ny);
      x.fillStyle = car.id === 'solstice' ? '#f2f2ee' : '#ffffff';
      x.beginPath(); x.ellipse(0, 0, r * 1.35, r, 0, 0, 7); x.fill();
      x.strokeStyle = L.c; x.lineWidth = 4; x.stroke();
      x.fillStyle = '#121212'; x.font = '700 ' + Math.round(r * 1.5) + 'px "Rajdhani", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(car.number), 0, r * 0.08);
      x.restore();
      // 架空のスポンサー
      x.save(); x.translate(W * 0.24, h * 0.42);
      x.fillStyle = car.id === 'solstice' || car.id === 'rotary' ? '#f2f2ee' : '#1a1d22';
      x.font = '700 30px "Rajdhani", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('MUSOU', 0, 0);
      x.restore();
      x.save(); x.translate(W * 0.76, h * 0.30);
      x.fillStyle = L.c; x.font = '600 22px "Rajdhani", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(car.name, 0, 0);
      x.restore();
    }
    sideBand(leftY0, leftY1, true, sideArt);
    sideBand(rightY0, rightY1, false, sideArt);
    // 上面:キャンバス上=車の左
    x.save(); x.beginPath(); x.rect(0, topY0, W, topY1 - topY0); x.clip(); x.translate(0, topY0);
    var th = topY1 - topY0;
    if (car.id === 'kestrel') {
      x.fillStyle = L.a; x.fillRect(0, th * 0.42, W, th * 0.16);
      x.fillStyle = L.b; x.fillRect(0, th * 0.38, W, th * 0.03); x.fillRect(0, th * 0.59, W, th * 0.03);
    } else if (car.id === 'rotary') {
      x.fillStyle = L.a; x.beginPath(); x.moveTo(0, 0); x.lineTo(W * 0.5, 0); x.lineTo(W * 0.3, th); x.lineTo(0, th); x.fill();
      x.fillStyle = L.b; x.beginPath(); x.moveTo(W * 0.5, 0); x.lineTo(W * 0.54, 0); x.lineTo(W * 0.34, th); x.lineTo(W * 0.3, th); x.fill();
    } else if (car.id === 'aurora') {
      x.fillStyle = L.a; x.fillRect(0, th * 0.44, W * 0.6, th * 0.12);
      x.fillStyle = L.b; x.fillRect(W * 0.6, th * 0.47, W * 0.4, th * 0.06);
    } else {
      x.fillStyle = L.a; x.fillRect(0, th * 0.45, W, th * 0.1);
      x.fillStyle = L.b; x.fillRect(0, th * 0.43, W, th * 0.015); x.fillRect(0, th * 0.565, W, th * 0.015);
    }
    // ノーズのゼッケン
    x.save(); x.translate(W * 0.83, th * 0.5); x.rotate(Math.PI / 2);
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, 50, 36, 0, 0, 7); x.fill();
    x.fillStyle = '#111'; x.font = '700 56px "Rajdhani", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(car.number), 0, 3); x.restore();
    x.restore();
    // 細かいヨゴレ・パネルライン
    var r = rng(car.number * 31);
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1.5;
    for (var i = 0; i < 6; i++) { var px = 120 + r() * 800; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke(); }
    return toTex(c);
  }

  return {
    rng: rng, asphalt: asphalt, asphaltRough: asphaltRough, kerb: kerb, grass: grass, mowStripes: mowStripes, gravel: gravel,
    concrete: concrete, adPanel: adPanel, crowd: crowd, windows: windows, checker: checker, board: board,
    fence: fence, carbon: carbon, soft: soft, shadowBlob: shadowBlob, rim: rim, tireSide: tireSide, livery: livery, valueNoise: valueNoise
  };
})();
