/* ink.js — 手描き風の「少し震える線」で絵を描く。画像ファイルは使わない。
   論理サイズは 360×640(縦長)。呼び出し側で ctx に倍率をかけてから使う。 */
const Ink = (function () {
  'use strict';
  const W = 360, H = 640;

  // 配色(テーマ)。セピアが標準。ほかはショップで解放する見た目ちがい
  const THEMES = {
    sepia: { name: 'セピア', paper: '#eee3ae', wall: '#b7ae82', mid: '#948e66', shade: '#6c6748', ink: '#2a2016', night: '#3a2a1b', glow: '#fbf3c8', red: '#c43f2a' },
    crt:   { name: '夜光',   paper: '#d3ecc2', wall: '#86a383', mid: '#668463', shade: '#445c45', ink: '#0e1a11', night: '#13251a', glow: '#eaffd9', red: '#e2573b' },
    dusk:  { name: '夕焼け', paper: '#f2d6bd', wall: '#c39886', mid: '#9e7568', shade: '#73504b', ink: '#281316', night: '#3b1c22', glow: '#ffecd8', red: '#d8392a' }
  };
  let P = THEMES.sepia;

  const FD = '"Dela Gothic One","Hiragino Sans","Yu Gothic",sans-serif';      // 見出し・数字
  const FH = '"Yusei Magic","Hiragino Maru Gothic ProN","Yu Gothic",sans-serif'; // 手書き風の文字

  // ---------- 乱数(同じ種なら同じ並び) ----------
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- 震える線の道具 ----------
  let jr = rng(1), AMP = 0.9;
  function seed(s, amp) { jr = rng(s); AMP = (amp == null ? 0.9 : amp); }
  function j() { return (jr() - 0.5) * 2 * AMP; }

  // 点の列を、少しずつずらしながらなぞる(手描きの線になる)
  function trace(g, pts, closed) {
    g.beginPath();
    const n = pts.length, segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.round(len / 16));
      if (i === 0) g.moveTo(a[0] + j(), a[1] + j());
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        g.lineTo(a[0] + (b[0] - a[0]) * t + j(), a[1] + (b[1] - a[1]) * t + j());
      }
    }
    if (closed) g.closePath();
  }
  function shape(g, pts, fill, lw, col) {
    trace(g, pts, true);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw) { g.lineWidth = lw; g.strokeStyle = col || P.ink; g.stroke(); }
  }
  function rect(g, x, y, w, h, fill, lw, col) { shape(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, lw, col); }
  function line(g, x1, y1, x2, y2, lw, col) {
    trace(g, [[x1, y1], [x2, y2]], false);
    g.lineWidth = lw || 1.5; g.strokeStyle = col || P.ink; g.stroke();
  }
  function ellipse(g, cx, cy, rx, ry, fill, lw, col) {
    const pts = [], n = Math.max(12, Math.round((rx + ry) / 3));
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    shape(g, pts, fill, lw, col);
  }
  function txt(g, s, x, y, size, o) {
    o = o || {};
    g.font = size + 'px ' + (o.h ? FH : FD);
    g.textAlign = o.al || 'center';
    g.textBaseline = o.bl || 'middle';
    if (o.sw) { g.lineWidth = o.sw; g.strokeStyle = o.sc || P.ink; g.lineJoin = 'round'; g.strokeText(s, x, y); }
    g.fillStyle = o.c || P.ink;
    g.fillText(s, x, y);
  }

  // ---------- 部屋(背景) ----------
  // v = 揺れのちがい(0〜2)。3枚を順に見せると線が「ふるえて」生きて見える
  function room(g, v) {
    const R = rng(42);           // 配置は毎回同じ
    seed(1000 + v * 77, 0.85);   // 線の揺れだけ変える
    g.lineJoin = 'round'; g.lineCap = 'round';

    // 壁
    g.fillStyle = P.wall; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.13;
    for (let i = 0; i < 30; i++) { const x = R() * W; line(g, x, 8 + R() * 30, x + 1, 436 - R() * 70, 1, P.shade); }
    g.globalAlpha = 1;

    // 窓(夜の街)
    rect(g, 34, 64, 292, 256, P.night, 2.6);
    g.save();
    g.beginPath(); g.rect(36, 66, 288, 252); g.clip();
    skyline(g, R);
    g.restore();
    // 窓わく(引き違い窓のまんなかの縦わく)
    line(g, 180, 64, 180, 320, 5, P.paper);
    line(g, 177, 64, 177, 320, 1.2);
    line(g, 183, 64, 183, 320, 1.2);
    rect(g, 34, 64, 292, 256, null, 2.6);

    // カーテンレール(カーテン本体は揺れるので毎フレーム描く:curtains)
    line(g, 8, 58, 352, 58, 3);

    // 床
    shape(g, [[-4, 440], [364, 440], [364, 644], [-4, 644]], P.mid, 0);
    line(g, -2, 440, 362, 440, 2);
    line(g, -2, 448, 362, 448, 1.1);
    g.globalAlpha = 0.28;
    for (let i = -5; i <= 5; i++) line(g, 180 + i * 34, 450, 180 + i * 92, 644, 1, P.shade);
    g.globalAlpha = 1;
    // 右からさしこむ光(床)
    g.globalAlpha = 0.42;
    shape(g, [[364, 448], [364, 644], [150, 644], [236, 448]], P.paper, 0);
    g.globalAlpha = 1;

    // 左:棚とブラウン管テレビ
    rect(g, -4, 382, 108, 92, P.paper, 2.2);
    line(g, 50, 382, 50, 474, 1.6);
    line(g, -4, 426, 104, 426, 1.6);
    for (let i = 0; i < 5; i++) line(g, 6 + i * 7, 432, 6 + i * 7, 468, 1.3);
    line(g, 58, 440, 96, 466, 1.3); line(g, 58, 452, 84, 470, 1.3);
    ellipse(g, 44, 404, 2, 2, P.ink, 0);
    rect(g, 12, 322, 76, 60, P.shade, 2.2);
    rect(g, 20, 330, 50, 44, P.night, 1.8);
    ellipse(g, 79, 340, 4, 4, P.paper, 1.3);
    ellipse(g, 79, 356, 4, 4, P.paper, 1.3);
    line(g, 44, 322, 28, 290, 1.4); line(g, 54, 322, 72, 292, 1.4);

    // 右:鉢植え(影の木)
    shape(g, [[296, 420], [336, 420], [330, 468], [302, 468]], P.paper, 2);
    line(g, 316, 420, 316, 372, 2.2);
    const leaves = [[316, 344, 22, 16], [298, 360, 14, 11], [334, 360, 15, 11], [308, 330, 12, 10], [326, 332, 12, 10], [316, 362, 13, 9]];
    leaves.forEach(L => ellipse(g, L[0], L[1], L[2], L[3], P.ink, 0));

    // 床の小物:丸めた紙、閉じたケータイ
    ellipse(g, 28, 486, 8, 6, P.paper, 1.5);
    line(g, 24, 484, 31, 489, 1); line(g, 27, 481, 30, 490, 1);
    shape(g, [[288, 456], [312, 452], [316, 462], [292, 467]], P.shade, 1.6);

    // ちゃぶ台(手前)
    g.globalAlpha = 0.3; ellipse(g, 186, 590, 156, 22, P.ink, 0); g.globalAlpha = 1;
    rect(g, 66, 540, 12, 60, P.shade, 1.8);
    rect(g, 284, 540, 12, 60, P.shade, 1.8);
    ellipse(g, 180, 532, 162, 44, P.shade, 2.2);
    ellipse(g, 180, 522, 162, 42, P.paper, 2.4);
    // 台の上:壺(つぼ)とサイコロ、メダル、缶、馬券
    shape(g, [[86, 516], [94, 494], [112, 486], [130, 494], [138, 516]], P.shade, 2);
    ellipse(g, 112, 516, 26, 6, P.shade, 2);
    die(g, 150, 514, 12, 3); die(g, 166, 522, 12, 5);
    [[208, 508], [222, 514], [214, 524], [64, 528], [250, 540], [236, 534]].forEach(c => {
      ellipse(g, c[0], c[1], 7, 3.4, P.glow, 1.4);
    });
    g.save(); g.translate(262, 510); g.rotate(-0.25);
    rect(g, -9, -18, 18, 34, P.mid, 1.8); ellipse(g, 0, -18, 9, 3, P.paper, 1.4);
    txt(g, '★', 0, 0, 10, { c: P.ink });
    g.restore();
    g.globalAlpha = 0.35; ellipse(g, 282, 530, 22, 6, P.shade, 0); g.globalAlpha = 1;
    g.save(); g.translate(184, 540); g.rotate(0.12);
    rect(g, -20, -9, 40, 18, P.glow, 1.4);
    line(g, -14, -3, 12, -3, 1); line(g, -14, 3, 6, 3, 1);
    g.restore();

    // 全体に右からの光と、左の影
    g.globalAlpha = 0.16;
    shape(g, [[364, 60], [364, 644], [240, 644], [300, 60]], P.glow, 0);
    g.globalAlpha = 0.18;
    shape(g, [[-4, 0], [40, 0], [16, 644], [-4, 644]], P.ink, 0);
    g.globalAlpha = 1;
  }

  function curtain(g, x0, x1, left, sw) {
    // sw = すそがゆれる量
    const pts = left
      ? [[x0, 56], [x1, 56], [x1 + 4 + sw * 0.5, 210], [x1 - 2 + sw, 334], [x0 - 2 + sw, 338], [x0 + 2 + sw * 0.4, 200]]
      : [[x0, 56], [x1, 56], [x1 - 2 - sw * 0.4, 200], [x1 + 2 - sw, 338], [x0 + 2 - sw, 334], [x0 - 4 - sw * 0.5, 210]];
    shape(g, pts, P.paper, 2);
    for (let i = 1; i < 4; i++) {
      const x = x0 + (x1 - x0) * i / 4;
      line(g, x, 60, x + (left ? sw + 2 : -sw - 2), 330, 1.1, P.shade);
    }
  }

  function skyline(g, R) {
    // 星
    g.fillStyle = P.glow;
    for (let i = 0; i < 24; i++) { g.globalAlpha = 0.25 + R() * 0.5; g.fillRect(40 + R() * 280, 70 + R() * 120, 1.4, 1.4); }
    g.globalAlpha = 1;
    // 三日月
    ellipse(g, 300, 92, 11, 11, P.glow, 0);
    ellipse(g, 305, 88, 10, 10, P.night, 0);
    // ビル群(線だけで描く)
    let x = 36;
    while (x < 326) {
      const w = 16 + R() * 26, h = 34 + R() * 84, top = 300 - h;
      g.globalAlpha = 0.85;
      shape(g, [[x, 304], [x, top], [x + w, top], [x + w, 304]], P.night, 1.2, P.glow);
      if (R() < 0.3) { line(g, x + w * 0.3, top, x + w * 0.3, top - 8, 1, P.glow); }
      g.fillStyle = P.glow;
      for (let yy = top + 6; yy < 296; yy += 9)
        for (let xx = x + 4; xx < x + w - 4; xx += 7)
          if (R() < 0.26) { g.globalAlpha = 0.3 + R() * 0.5; g.fillRect(xx, yy, 3, 4); }
      g.globalAlpha = 1;
      x += w + R() * 5;
    }
    // ネオン看板のビル
    shape(g, [[58, 304], [58, 182], [100, 182], [100, 304]], P.night, 1.4, P.glow);
    // 電波塔
    g.globalAlpha = 0.9;
    const tx = 286;
    line(g, tx - 16, 304, tx - 4, 150, 1.4, P.glow);
    line(g, tx + 16, 304, tx + 4, 150, 1.4, P.glow);
    for (let yy = 300; yy > 160; yy -= 18) {
      const k = (304 - yy) / 154, hw = 16 - 12 * k, hw2 = 16 - 12 * ((304 - yy + 18) / 154);
      line(g, tx - hw, yy, tx + hw2, yy - 18, 0.9, P.glow);
      line(g, tx + hw, yy, tx - hw2, yy - 18, 0.9, P.glow);
    }
    rect(g, tx - 11, 136, 22, 14, P.night, 1.3, P.glow);
    line(g, tx, 136, tx, 104, 1.3, P.glow);
    g.globalAlpha = 1;
    // ベランダの手すり
    rect(g, 36, 292, 288, 30, P.night, 0);
    line(g, 36, 290, 324, 290, 2, P.glow);
    line(g, 36, 296, 324, 296, 1, P.glow);
    g.globalAlpha = 0.6;
    for (let xx = 44; xx < 324; xx += 12) line(g, xx, 296, xx, 320, 0.9, P.glow);
    g.globalAlpha = 1;
  }

  function die(g, x, y, s, n) {
    rect(g, x - s / 2, y - s / 2, s, s, P.glow, 1.4);
    pips(g, x, y, s, n);
  }
  function pips(g, x, y, s, n) {
    const o = s * 0.27, P2 = {
      1: [[0, 0]], 2: [[-o, -o], [o, o]], 3: [[-o, -o], [0, 0], [o, o]],
      4: [[-o, -o], [o, -o], [-o, o], [o, o]], 5: [[-o, -o], [o, -o], [0, 0], [-o, o], [o, o]],
      6: [[-o, -o], [o, -o], [-o, 0], [o, 0], [-o, o], [o, o]]
    }[n];
    g.fillStyle = n === 1 ? P.red : P.ink;
    P2.forEach(p => { g.beginPath(); g.arc(x + p[0], y + p[1], s * 0.09 + (n === 1 ? 0.8 : 0), 0, Math.PI * 2); g.fill(); });
  }

  // ---------- 毎フレーム描く部屋の動く部分 ----------
  // ネオン「大当り」:lv=0 は消えかけ、1 は全開(本物ボーナスの前兆)
  function neon(g, lv, clock) {
    const x = 68, y = 192, w = 22, h = 98;
    const flick = lv > 0.05 ? 1 : (Math.sin(clock * 17) > 0.97 ? 0.5 : 0.18);
    const a = Math.max(flick, lv);
    g.save();
    rect(g, x, y, w, h, P.night, 1.3, P.glow);
    if (a > 0.3) { g.shadowColor = P.glow; g.shadowBlur = 6 + 14 * a; }
    g.globalAlpha = 0.25 + 0.75 * a;
    ['大', '当', 'り'].forEach((c, i) => txt(g, c, x + w / 2, y + 18 + i * 30, 17, { c: P.glow }));
    g.restore();
  }
  // ブラウン管:競馬中継と砂嵐をくり返す
  function tv(g, clock) {
    g.save();
    g.beginPath(); g.rect(21, 331, 48, 42); g.clip();
    g.fillStyle = P.night; g.fillRect(21, 331, 48, 42);
    const ph = clock % 10;
    if (ph < 6.5) {
      g.fillStyle = P.glow; g.globalAlpha = 0.5; g.fillRect(21, 362, 48, 1);
      for (let i = 0; i < 3; i++) {
        const hx = 76 - ((clock * (14 + i * 3) + i * 17) % 70), hy = 350 + i * 4, st = Math.floor(clock * 10 + i) % 2;
        g.globalAlpha = 0.85;
        g.beginPath(); g.ellipse(hx, hy, 6, 3, 0, 0, 7); g.fill();
        g.beginPath(); g.ellipse(hx - 6, hy - 3, 2.6, 1.8, -0.5, 0, 7); g.fill();
        g.fillRect(hx - 4 + st * 2, hy + 2, 1, 4); g.fillRect(hx + 3 - st * 2, hy + 2, 1, 4);
      }
      g.globalAlpha = 0.25; g.fillRect(21, 331 + (clock * 30) % 42, 48, 2);
    } else {
      g.fillStyle = P.glow;
      for (let i = 0; i < 70; i++) { g.globalAlpha = Math.random() * 0.6; g.fillRect(21 + Math.random() * 48, 331 + Math.random() * 42, 2 + Math.random() * 3, 1); }
    }
    g.restore();
  }
  function towerLight(g, clock) {
    if (Math.sin(clock * 3) > 0.2) { g.fillStyle = P.red; g.globalAlpha = 0.9; g.beginPath(); g.arc(286, 104, 2.2, 0, 7); g.fill(); g.globalAlpha = 1; }
  }

  // ---------- 動く背景 ----------
  const LIFE = (function () {
    const R = rng(77), wins = [], clouds = [];
    for (let i = 0; i < 46; i++) wins.push({ x: 40 + R() * 280, y: 196 + R() * 88, ph: R() * 50, sp: 0.15 + R() * 0.6 });
    for (let i = 0; i < 3; i++) clouds.push({ y: 78 + R() * 50, w: 50 + R() * 40, sp: 4 + R() * 6, ph: R() * 420 });
    return { wins, clouds };
  })();
  // 窓の外:サーチライト・雲・飛行機・またたく窓明かり・電車・車
  function cityLife(g, clock, hot) {
    g.save();
    g.beginPath(); g.rect(36, 66, 288, 224); g.clip();
    g.fillStyle = P.glow;
    for (let i = 0; i < 2; i++) {
      const a = -Math.PI / 2 + Math.sin(clock * (0.25 + i * 0.13) + i * 2) * 0.7, bx = i ? 250 : 110, by = 300;
      g.globalAlpha = hot ? 0.17 : 0.08;
      g.beginPath(); g.moveTo(bx, by);
      g.lineTo(bx + Math.cos(a - 0.06) * 330, by + Math.sin(a - 0.06) * 330);
      g.lineTo(bx + Math.cos(a + 0.06) * 330, by + Math.sin(a + 0.06) * 330);
      g.closePath(); g.fill();
    }
    g.globalAlpha = 0.16;
    LIFE.clouds.forEach(c => {
      const x = ((clock * c.sp + c.ph) % 420) - 60;
      g.beginPath(); g.ellipse(x, c.y, c.w / 2, 7, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x + c.w * 0.22, c.y - 5, c.w / 3, 6, 0, 0, 7); g.fill();
    });
    const ax = ((clock * 14) % 520) - 80;
    if (Math.floor(clock * 2) % 2) { g.globalAlpha = 0.9; g.fillStyle = P.red; g.fillRect(ax, 98 + ax * 0.04, 2, 2); }
    g.fillStyle = P.glow;
    LIFE.wins.forEach(w => { const v = Math.sin(clock * w.sp + w.ph); if (v > 0.2) { g.globalAlpha = 0.2 + 0.55 * v; g.fillRect(w.x, w.y, 3, 4); } });
    g.globalAlpha = 0.5;
    g.fillRect(36, 271, 288, 1.4);
    const tt = clock % 16;
    if (tt < 4) {
      const x = -260 + tt / 4 * 640;
      g.globalAlpha = 1;
      for (let c = 0; c < 4; c++) {
        const cx = x + c * 62;
        g.fillStyle = P.night; g.fillRect(cx, 254, 58, 16);
        g.strokeStyle = P.glow; g.lineWidth = 1.2; g.strokeRect(cx, 254, 58, 16);
        g.fillStyle = P.glow;
        for (let k = 0; k < 5; k++) g.fillRect(cx + 5 + k * 11, 258, 6, 5);
      }
    }
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 ? 1 : -1, sp = 26 + i * 9;
      let x = (clock * sp + i * 97) % 380 - 10;
      if (dir < 0) x = 360 - x;
      g.globalAlpha = 0.9; g.fillStyle = dir > 0 ? P.glow : P.red;
      g.fillRect(x, 286 - (i % 2) * 2, 3, 2); g.fillRect(x + 6 * dir, 286 - (i % 2) * 2, 3, 2);
    }
    g.restore();
  }
  // 部屋:カーテンのゆれ・光の中のほこり・灰皿の煙
  function roomLife(g, clock, calm, hot) {
    const sw = calm ? 0 : Math.sin(clock * 0.9) * 3 + Math.sin(clock * 2.3) * (hot ? 2.4 : 1);
    seed(500 + Math.floor(clock * 7), 0.85);
    curtain(g, 12, 50, true, sw);
    curtain(g, 310, 348, false, sw);
    g.fillStyle = P.glow;
    for (let i = 0; i < 18; i++) {
      const ph = i * 37.7;
      const x = 246 + (Math.sin(clock * 0.3 + ph) * 30 + i * 6 + 40) % 110;
      const y = 80 + (clock * (5 + i % 5) + ph * 13) % 460;
      g.globalAlpha = 0.25 + 0.25 * Math.sin(clock * 2 + ph);
      g.fillRect(x, y, 1.7, 1.7);
    }
    g.globalAlpha = 1;
    ellipse(g, 300, 552, 13, 4, P.shade, 1.6);
    line(g, 296, 549, 312, 545, 2.4, P.glow);
    g.globalAlpha = 0.28; g.strokeStyle = P.glow; g.lineWidth = 2;
    g.beginPath();
    for (let k = 0; k < 24; k++) {
      const yy = 543 - k * 6, xx = 313 + Math.sin(clock * 1.6 - k * 0.45) * (2 + k * 0.5);
      if (k === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.stroke();
    g.globalAlpha = 1;
  }

  // ---------- 運命スロット ----------
  const SLOT = { x: 92, y: 324, w: 176, h: 118 };
  const STRIP = ['seven', 'cherry', 'bell', 'blank', 'bar', 'skull', 'cherry', 'bell', 'blank', 'bar', 'cherry', 'skull'];
  function symbol(g, nm, cx, cy, s) {
    g.save(); g.translate(cx, cy); g.scale(s, s);
    if (nm === 'seven') txt(g, '7', 0, 2, 38, { c: P.red, sw: 4, sc: P.ink });
    else if (nm === 'bar') { rect(g, -17, -10, 34, 20, P.ink, 0); txt(g, 'BAR', 0, 1, 11, { c: P.glow }); }
    else if (nm === 'bell') {
      shape(g, [[-4, -15], [4, -15], [11, -4], [14, 9], [-14, 9], [-11, -4]], P.mid, 2);
      line(g, -15, 9, 15, 9, 2.5); ellipse(g, 0, 13, 3, 3, P.ink, 0);
    } else if (nm === 'cherry') {
      line(g, -6, 2, 2, -14, 1.6); line(g, 8, 4, 2, -14, 1.6);
      ellipse(g, 7, -14, 6, 3, P.mid, 1.2);
      ellipse(g, -6, 6, 7, 7, P.ink, 0); ellipse(g, 8, 8, 7, 7, P.ink, 0);
      g.fillStyle = P.glow; g.fillRect(-9, 3, 2, 2); g.fillRect(5, 5, 2, 2);
    } else if (nm === 'skull') {
      ellipse(g, 0, -3, 14, 13, P.paper, 2.2, P.red);
      ellipse(g, -5, -4, 4, 4, P.ink, 0); ellipse(g, 5, -4, 4, 4, P.ink, 0);
      shape(g, [[0, 1], [-2, 5], [2, 5]], P.ink, 0);
      rect(g, -7, 8, 14, 7, P.paper, 1.6, P.red);
      line(g, -2, 8, -2, 15, 1); line(g, 2, 8, 2, 15, 1);
    } else line(g, -8, 0, 8, 0, 2, P.shade);
    g.restore();
  }
  // st = { reels: [{ spin, sym, off, stopC }], lights: idle/spin/reach/win/fever/dead, cracks, reachIdx, line }
  function slot(g, st, clock) {
    const { x, y, w, h } = SLOT;
    seed(900 + Math.floor(clock * 7), 0.7);
    rect(g, x, y, w, h, P.shade, 2.6);
    rect(g, x + 8, y + 8, w - 16, h - 16, P.night, 1.4);
    // 電球(ふだんは追いかけっこ、当たりで全部点滅、リーチで赤)
    const bulbs = [];
    for (let bx = x + 8; bx <= x + w - 8; bx += 14) { bulbs.push([bx, y + 4]); bulbs.push([bx, y + h - 4]); }
    for (let by = y + 18; by <= y + h - 18; by += 14) { bulbs.push([x + 4, by]); bulbs.push([x + w - 4, by]); }
    bulbs.forEach((b, i) => {
      let on, col = P.glow;
      if (st.lights === 'dead') on = false;
      else if (st.lights === 'reach') { on = Math.floor(clock * 10) % 2 === 0; col = P.red; }
      else if (st.lights === 'win' || st.lights === 'fever') on = Math.floor(clock * 14) % 2 === i % 2;
      else on = (i + Math.floor(clock * (st.lights === 'spin' ? 9 : 4))) % 4 === 0;
      g.beginPath(); g.arc(b[0], b[1], 2.6, 0, 7);
      g.fillStyle = on ? col : P.mid; g.fill();
    });
    rect(g, x + 50, y + 10, 76, 13, P.ink, 0);
    txt(g, '運命スロット', x + w / 2, y + 17, 9, { c: P.glow });
    for (let i = 0; i < 3; i++) {
      const rx = x + 22 + i * 46, ry = y + 27, rw = 40, rh = 56, r = st.reels[i], cx = rx + rw / 2, cy = ry + rh / 2;
      rect(g, rx, ry, rw, rh, P.glow, 1.6);
      g.save();
      g.beginPath(); g.rect(rx + 1, ry + 1, rw - 2, rh - 2); g.clip();
      if (r.spin) {
        const base = Math.floor(r.off), fr = r.off - base, L = STRIP.length;
        for (let k = -1; k <= 1; k++) symbol(g, STRIP[(((base - k) % L) + L) % L], cx, cy + (k + fr) * 46, 0.9);
      } else {
        const age = clock - r.stopC;
        const b = age < 0.22 ? Math.sin(age / 0.22 * Math.PI) * 6 * (1 - age / 0.22) : 0;
        symbol(g, r.sym, cx, cy + b, 1);
      }
      g.restore();
      if (st.reachIdx === i) {
        g.lineWidth = 3; g.strokeStyle = P.red; g.globalAlpha = 0.5 + 0.5 * Math.sin(clock * 18);
        g.strokeRect(rx - 2, ry - 2, rw + 4, rh + 4); g.globalAlpha = 1;
      }
    }
    if (st.line) { g.fillStyle = P.red; g.globalAlpha = 0.85; g.fillRect(x + 16, y + 54, w - 32, 2.5); g.globalAlpha = 1; }
    txt(g, 'ヒビ', x + 34, y + h - 17, 10, { c: P.glow });
    for (let k = 0; k < 3; k++) {
      g.globalAlpha = k < st.cracks ? 1 : 0.25;
      symbol(g, 'skull', x + 72 + k * 26, y + h - 17, 0.42);
    }
    g.globalAlpha = 1;
  }

  // ---------- 誘惑(押したら全損)と本物ボーナス ----------
  function easeBack(t) { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

  function tempter(g, tp, age, clock, calm) {
    const cx = tp.x + tp.w / 2, cy = tp.y + tp.h / 2;
    let s = age < 0.14 ? Math.max(0.01, easeBack(age / 0.14)) : 1;
    const left = tp.life - age;
    g.save();
    if (left < 0.15) g.globalAlpha = Math.max(0, left / 0.15);
    g.translate(cx, cy);
    if (tp.type === 'phone') g.translate(Math.sin(clock * 60) * 1.6, 0);
    if (tp.type === 'under') s *= 1 + Math.sin(age * 12) * 0.05;
    if (tp.tilt) g.rotate(0.22);
    g.scale(s, s);
    seed(tp.id * 31 + Math.floor(clock * 8), 0.75);
    const fn = DRAW[tp.type];
    if (fn) fn(g, tp, age, clock, calm);
    g.restore();
  }

  const DRAW = {
    hype(g, tp, age, clock, calm) {
      const w = tp.w, h = tp.h;
      const on = calm ? true : Math.floor(age * 8) % 2 === 0;
      shape(g, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2 - 12, 0], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2 + 12, 0]], on ? P.glow : P.paper, 2.6);
      txt(g, '今タップで', 0, -14, 15, { h: true });
      txt(g, '×10!!', 0, 14, 26, { c: P.ink });
      const n = Math.max(1, 3 - Math.floor(age));
      ellipse(g, w / 2 - 4, -h / 2 - 2, 15, 15, P.ink, 0);
      txt(g, String(n), w / 2 - 4, -h / 2 - 1, 16, { c: P.glow });
      for (let i = 0; i < 4; i++) line(g, -w / 2 - 4 - i * 2, -16 + i * 10, -w / 2 - 14 - i * 2, -20 + i * 12, 1.6);
    },
    bonus(g, tp, age, clock) {
      g.save(); g.rotate(clock * 0.8);
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        line(g, Math.cos(a) * 42, Math.sin(a) * 42, Math.cos(a) * 52, Math.sin(a) * 52, 2);
      }
      g.restore();
      if (tp.pulse) {
        const r = 40 + Math.sin(age * 16) * 3.5;
        ellipse(g, 0, 0, r, r, null, 3.4);
      }
      ellipse(g, 0, 0, 38, 38, P.glow, 3);
      ellipse(g, 0, 0, 31, 31, null, 1.4);
      txt(g, 'BONUS', 0, -10, 12);
      txt(g, '×3', 0, 12, 24);
    },
    clear(g, tp, age) {
      const w = tp.w, h = tp.h;
      rect(g, -w / 2, -h / 2, w, h, P.paper, 3);
      rect(g, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, null, 1.2);
      txt(g, '大当り!', 0, -16, 38, { c: P.ink });
      rect(g, w / 2 - 112, h / 2 - 40, 96, 28, P.ink, 0);
      txt(g, '次へ ▶', w / 2 - 64, h / 2 - 26, 15, { h: true, c: P.glow });
      const R = rng(tp.id);
      for (let i = 0; i < 12; i++) {
        const x = (R() - 0.5) * (w + 30), y = (R() - 0.5) * (h + 30) + (age * 30 % 20);
        g.fillStyle = i % 3 ? P.ink : P.red; g.fillRect(x, y, 4, 7);
      }
    },
    error(g, tp) {
      const w = tp.w, h = tp.h;
      g.rotate(-0.04);
      rect(g, -w / 2, -h / 2, w, h, P.paper, 2);
      g.globalAlpha *= 0.7; rect(g, -w / 2 - 6, -h / 2 - 6, 30, 12, P.wall, 0); rect(g, w / 2 - 24, -h / 2 - 6, 30, 12, P.wall, 0); g.globalAlpha /= 0.7;
      txt(g, '電波が途切れたみたい…', 0, -22, 15, { h: true });
      txt(g, '(このままだと記録が消えます)', 0, 0, 11, { h: true, c: P.shade });
      rect(g, -52, 18, 104, 30, P.glow, 2.2);
      txt(g, '再接続', 0, 33, 16, { h: true });
    },
    notify(g, tp) {
      const w = tp.w, h = tp.h;
      shape(g, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2 + 50, h / 2], [-w / 2 + 36, h / 2 + 14], [-w / 2 + 36, h / 2], [-w / 2, h / 2]], P.glow, 2.2);
      // タヌキの顔
      const ax = -w / 2 + 26;
      shape(g, [[ax - 14, -12], [ax - 10, -24], [ax - 4, -14]], P.shade, 1.4);
      shape(g, [[ax + 14, -12], [ax + 10, -24], [ax + 4, -14]], P.shade, 1.4);
      ellipse(g, ax, 0, 16, 15, P.mid, 1.8);
      ellipse(g, ax - 6, -2, 6, 4, P.ink, 0); ellipse(g, ax + 6, -2, 6, 4, P.ink, 0);
      g.fillStyle = P.glow; g.fillRect(ax - 7, -3, 2, 2); g.fillRect(ax + 5, -3, 2, 2);
      ellipse(g, ax, 7, 3, 2, P.ink, 0);
      txt(g, tp.who + 'に抜かれた!', ax + 22, -8, 14, { h: true, al: 'left' });
      txt(g, '見に行く ▶', ax + 22, 13, 12, { h: true, al: 'left', c: P.shade });
    },
    coin(g, tp, age) {
      const sx = Math.max(0.15, Math.abs(Math.cos(age * 7)));
      g.scale(sx, 1);
      ellipse(g, 0, 0, 22, 22, P.glow, 2.6);
      ellipse(g, 0, 0, 16, 16, null, 1.3);
      txt(g, '★', 0, 1, 16);
    },
    under(g, tp) {
      const w = tp.w, h = tp.h;
      rect(g, -w / 2, -h / 2, w, h, P.ink, 0);
      rect(g, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, null, 1.2, P.glow);
      txt(g, '押して!', 0, 1, 20, { h: true, c: P.glow });
    },
    phone(g, tp, age) {
      // 開いたガラケー
      rect(g, -18, -42, 36, 40, P.shade, 2);
      rect(g, -13, -37, 26, 24, P.glow, 1.4);
      txt(g, '着信', 0, -25, 10, { h: true });
      rect(g, -18, 0, 36, 42, P.mid, 2);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rect(g, -12 + c * 9, 8 + r * 10, 6, 6, P.paper, 1);
      line(g, 14, -42, 18, -56, 2);
      for (let i = 1; i <= 2; i++) {
        const r = 26 + i * 8 + (age * 30 % 8);
        g.beginPath(); g.arc(0, -20, r, -0.6, 0.6); g.lineWidth = 1.6; g.strokeStyle = P.ink; g.stroke();
        g.beginPath(); g.arc(0, -20, r, Math.PI - 0.6, Math.PI + 0.6); g.stroke();
      }
    },
    capsule(g, tp) {
      const h = tp.h;
      ellipse(g, 0, -h / 2 + 46, 44, 42, P.glow, 2.4);
      [[-18, -40], [6, -46], [20, -30], [-6, -24], [-24, -20], [14, -14]].forEach((c, i) => ellipse(g, c[0], c[1] - h / 2 + 76, 9, 9, i % 2 ? P.paper : P.mid, 1.3));
      rect(g, -40, -h / 2 + 84, 80, 70, P.shade, 2.4);
      ellipse(g, 0, -h / 2 + 112, 12, 12, P.paper, 2);
      line(g, -8, -h / 2 + 112, 8, -h / 2 + 112, 2);
      rect(g, -46, -h / 2 + 136, 92, 24, P.ink, 0);
      txt(g, '1回 無料!', 0, -h / 2 + 148, 14, { h: true, c: P.glow });
    },
    dice(g, tp, age) {
      const w = tp.w, h = tp.h;
      rect(g, -w / 2, -h / 2, w, h, P.paper, 2.4);
      const f = Math.floor(age * 14);
      die(g, -54, -4, 30, (f % 6) + 1);
      die(g, -16, -4, 30, ((f * 5 + 2) % 6) + 1);
      txt(g, 'ゾロ目で×10', 42, -14, 14, { h: true });
      txt(g, '止めろ!', 42, 10, 20, { h: true });
    },
    resume(g, tp) {
      const w = tp.w, h = tp.h;
      g.globalAlpha *= 0.75;
      rect(g, -w / 2, -h / 2, w, h, null, 1.4, P.shade);
      txt(g, 'タップして再開', 0, 1, 15, { h: true, c: P.shade });
    }
  };

  // ---------- ヒビ ----------
  function crack(g, cr, age) {
    const p = Math.min(1, age / 0.25);
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    cr.rays.forEach(ray => {
      const n = Math.max(2, Math.floor(ray.length * p));
      g.beginPath(); g.moveTo(ray[0][0], ray[0][1]);
      for (let i = 1; i < n; i++) g.lineTo(ray[i][0], ray[i][1]);
      g.lineWidth = 3.4; g.strokeStyle = P.ink; g.stroke();
      g.lineWidth = 1; g.strokeStyle = P.glow; g.globalAlpha = 0.85; g.stroke(); g.globalAlpha = 1;
    });
    g.globalAlpha = 0.9;
    seed(cr.seed, 1.6);
    ellipse(g, cr.x, cr.y, 14, 12, null, 2.4);
    g.restore();
  }

  // ---------- 画面全体のフィルム効果 ----------
  let grainPat = null, vign = null;
  function prepare(g) {
    const n = document.createElement('canvas'); n.width = n.height = 128;
    const c = n.getContext('2d'), d = c.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = Math.random() * 70;
    }
    c.putImageData(d, 0, 0);
    grainPat = g.createPattern(n, 'repeat');
    vign = g.createRadialGradient(180, 300, 170, 180, 320, 470);
    vign.addColorStop(0, 'rgba(0,0,0,0)');
    vign.addColorStop(1, 'rgba(20,12,4,0.62)');
  }
  function film(g, amount) {
    if (vign) { g.fillStyle = vign; g.fillRect(0, 0, W, H); }
    if (grainPat) {
      g.save();
      g.globalAlpha = amount;
      g.translate(-Math.random() * 128, -Math.random() * 128);
      g.fillStyle = grainPat; g.fillRect(0, 0, W + 128, H + 128);
      g.restore();
    }
  }

  return {
    W, H, THEMES, FD, FH, rng, seed, trace, shape, rect, line, ellipse, txt, die,
    room, neon, tv, towerLight, tempter, crack, prepare, film,
    cityLife, roomLife, slot, symbol, SLOT, STRIP,
    get P() { return P; },
    setTheme(k) { P = THEMES[k] || THEMES.sepia; }
  };
})();
