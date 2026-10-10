/* pixel.js — 霧笛荘 (Muteki-so) procedural pixel-art renderer.
 * Plain classic script. Exposes window.Pixel.
 * All art is drawn with integer-aligned fillRects at 320x180.
 */
(function () {
  'use strict';

  var W = 320, H = 180;
  var PAL = {
    k: '#1f2725', d: '#33403d', m: '#4a5753', b: '#5f6f6a', l: '#7d8c86',
    p: '#a3b0aa', w: '#e9eee8', r: '#e0141b', r2: '#8e0f14', y: '#e8d9a0'
  };
  var MAPC = { k: PAL.k, d: PAL.d, m: PAL.m, b: PAL.b, l: PAL.l, p: PAL.p, w: PAL.w, r: PAL.r, R: PAL.r2, y: PAL.y };
  var ORDER = ['k', 'd', 'm', 'b', 'l', 'p', 'w'];

  /* ------------------------------------------------------------------ */
  /* low level helpers                                                   */
  /* ------------------------------------------------------------------ */
  var G = null; // current 2D context

  function mk(w, h) {
    if (typeof document !== 'undefined' && document.createElement) {
      var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    return null;
  }
  function cc(c) { return (typeof c === 'string') ? (PAL[c] || MAPC[c] || c) : c; }
  function sh(c, n) { var i = ORDER.indexOf(c); if (i < 0) return c; i = Math.max(0, Math.min(6, i + n)); return ORDER[i]; }
  function hs(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function vn(x) { var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f); return hs(i) * (1 - f) + hs(i + 1) * f; }
  var rd = Math.round;

  function R(x, y, w, h, c) {
    var x0 = rd(x), y0 = rd(y), x1 = rd(x + w), y1 = rd(y + h);
    if (x1 <= x0 || y1 <= y0) return;
    G.fillStyle = cc(c); G.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  function P(x, y, c) { G.fillStyle = cc(c); G.fillRect(rd(x), rd(y), 1, 1); }

  // Bayer-dither patterns: level 0..16
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var PATS = {};
  function D(c, lvl) {
    lvl = Math.max(0, Math.min(16, lvl | 0));
    if (lvl >= 16) return cc(c);
    var key = c + ':' + lvl;
    if (PATS[key]) return PATS[key];
    var cv = mk(4, 4); if (!cv) return cc(c);
    var g = cv.getContext('2d'); g.fillStyle = cc(c);
    for (var i = 0; i < 16; i++) if (BAYER[i] < lvl) g.fillRect(i % 4, (i / 4) | 0, 1, 1);
    var p = G.createPattern(cv, 'repeat');
    PATS[key] = p; return p;
  }
  function DR(x, y, w, h, c, lvl) { if (lvl <= 0) return; R(x, y, w, h, D(c, lvl)); }

  function L(x0, y0, x1, y1, c) {
    x0 = rd(x0); y0 = rd(y0); x1 = rd(x1); y1 = rd(y1);
    G.fillStyle = cc(c);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy, n = 0;
    while (n++ < 2000) {
      G.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function LT(x0, y0, x1, y1, c, w) { // thick line
    var n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; n = Math.max(1, n);
    for (var i = 0; i <= n; i++) R(x0 + (x1 - x0) * i / n - (w >> 1), y0 + (y1 - y0) * i / n - (w >> 1), w, w, c);
  }
  function EL(cx, cy, rx, ry, c) { // filled ellipse
    G.fillStyle = cc(c); cx = rd(cx); cy = rd(cy);
    for (var dy = -ry; dy <= ry; dy++) {
      var t = dy / (ry + 0.5);
      var hw = rd(rx * Math.sqrt(Math.max(0, 1 - t * t)));
      G.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }
  function ELO(cx, cy, rx, ry, c) { // ellipse outline
    G.fillStyle = cc(c); cx = rd(cx); cy = rd(cy);
    var hws = [], dy, i;
    for (dy = -ry; dy <= ry; dy++) { var t = dy / (ry + 0.5); hws.push(rd(rx * Math.sqrt(Math.max(0, 1 - t * t)))); }
    for (i = 0; i < hws.length; i++) {
      var hw = hws[i], y = cy - ry + i;
      var a = i > 0 ? hws[i - 1] : -1, b = i < hws.length - 1 ? hws[i + 1] : -1;
      var inner = Math.min(a, b);
      if (inner < 0) { G.fillRect(cx - hw, y, hw * 2 + 1, 1); continue; }
      var w = Math.max(1, hw - inner);
      G.fillRect(cx - hw, y, w, 1); G.fillRect(cx + hw - w + 1, y, w, 1);
    }
  }
  function POLY(pts, c) { // scanline polygon fill, pts flat
    G.fillStyle = cc(c);
    var n = pts.length / 2, miny = 1e9, maxy = -1e9, i;
    for (i = 0; i < n; i++) { miny = Math.min(miny, pts[i * 2 + 1]); maxy = Math.max(maxy, pts[i * 2 + 1]); }
    for (var y = Math.floor(miny); y < Math.ceil(maxy); y++) {
      var sy = y + 0.5, xs = [];
      for (i = 0; i < n; i++) {
        var j = (i + 1) % n, x1 = pts[i * 2], y1 = pts[i * 2 + 1], x2 = pts[j * 2], y2 = pts[j * 2 + 1];
        if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + (sy - y1) / (y2 - y1) * (x2 - x1));
      }
      xs.sort(function (a, b) { return a - b; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var a0 = rd(xs[k]), b0 = rd(xs[k + 1]);
        if (b0 > a0) G.fillRect(a0, y, b0 - a0, 1);
      }
    }
  }
  function PO(pts, c, o) { POLY(pts, c); if (o) { var n = pts.length / 2; for (var i = 0; i < n; i++) { var j = (i + 1) % n; L(pts[i * 2], pts[i * 2 + 1], pts[j * 2], pts[j * 2 + 1], o); } } }

  // 3x5 digit font
  var FONT = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111', '-': '000000111000000', '.': '000000000000010'
  };
  function TXT(s, x, y, c) {
    s = String(s);
    for (var i = 0; i < s.length; i++) {
      var g = FONT[s[i]];
      if (g) for (var j = 0; j < 15; j++) if (g[j] === '1') P(x + (j % 3), y + ((j / 3) | 0), c);
      x += 4;
    }
  }

  /* ------------------------------------------------------------------ */
  /* atmosphere helpers                                                  */
  /* ------------------------------------------------------------------ */
  function fogBand(t, x0, x1, y, h, c, lvl, speed, seed) {
    var step = 4, pa = D(c, lvl), pb = D(c, Math.min(16, lvl + 3));
    for (var x = x0; x < x1; x += step) {
      var u = (x + t * speed) / 46 + seed;
      var n = vn(u) * 0.7 + vn(u * 2.7 + 5) * 0.3;
      var top = y + (1 - n) * h * 0.55;
      var bot = y + h - vn(u * 1.3 + 9) * h * 0.35;
      var ww = Math.min(step, x1 - x);
      if (bot > top) {
        R(x, top, ww, bot - top, pa);
        if (n > 0.5) R(x, top + (bot - top) * 0.35, ww, (bot - top) * 0.35, pb);
      }
    }
  }
  var RAIN = [];
  for (var ri = 0; ri < 220; ri++) RAIN.push([hs(ri * 1.37 + 0.1), hs(ri * 2.11 + 0.7), 0.7 + hs(ri * 3.3 + 1.9) * 0.6]);
  function rain(t, n, c, x0, y0, w, h, speed, slant) {
    speed = speed || 160; slant = slant === undefined ? 0.25 : slant;
    G.fillStyle = cc(c);
    for (var i = 0; i < n && i < RAIN.length; i++) {
      var d = RAIN[i], sp = speed * d[2];
      var yy = ((d[1] * h + t * sp) % h + h) % h;
      var xx = ((d[0] * w + yy * slant + t * sp * slant * 0.2) % w + w) % w;
      var X = rd(x0 + xx), Y = rd(y0 + yy);
      G.fillRect(X, Y, 1, 2);
      if (slant > 0.1) G.fillRect(X + 1, Y + 2, 1, 2); else G.fillRect(X, Y + 2, 1, 1);
    }
  }
  function flash(t) {
    var per = 8.5, i = Math.floor(t / per), ph = t - i * per;
    var at = 2 + hs(i * 7.1 + 3) * 4.5, d = ph - at;
    if (d < 0 || d > 0.42) return 0;
    if (d < 0.06) return 2;
    if (d < 0.13) return 0;
    if (d < 0.24) return 1;
    if (d < 0.3) return 0;
    return d < 0.36 ? 1 : 0;
  }
  function flashIndex(t) { return Math.floor(t / 8.5); }
  function bolt(t, x, y0, y1) {
    var i = flashIndex(t), cx = x + (hs(i * 3.1) - 0.5) * 60, py = y0, seg = 0;
    while (py < y1 && seg++ < 40) {
      var nx = cx + (hs(i * 13 + seg) - 0.5) * 10, ny = py + 4 + hs(i * 5 + seg) * 5;
      L(cx, py, nx, ny, 'w');
      if (hs(i + seg * 1.7) > 0.8) L(nx, ny, nx + (hs(seg) - 0.5) * 16, ny + 8, 'p');
      cx = nx; py = ny;
    }
  }
  function vignette(s) {
    s = s || 1;
    DR(0, 0, W, 3, 'k', 10 * s); DR(0, 3, W, 4, 'k', 5 * s);
    DR(0, H - 4, W, 4, 'k', 10 * s); DR(0, H - 9, W, 5, 'k', 5 * s);
    DR(0, 0, 4, H, 'k', 10 * s); DR(4, 0, 5, H, 'k', 5 * s);
    DR(W - 4, 0, 4, H, 'k', 10 * s); DR(W - 9, 0, 5, H, 'k', 5 * s);
  }
  function glow(cx, cy, r, c, lvl) { // dithered radial glow
    lvl = Math.max(1, lvl);
    EL(cx, cy, r, r * 0.8, D('l', lvl));
    EL(cx, cy, r * 0.62, r * 0.5, D('p', lvl + 1));
    EL(cx, cy, r * 0.32, r * 0.26, D(c, lvl + 2));
  }

  /* ------------------------------------------------------------------ */
  /* shared scenery pieces                                               */
  /* ------------------------------------------------------------------ */
  function bricks(x, y, w, h, base, mortar, bw, bh, seed) {
    R(x, y, w, h, mortar);
    for (var r = 0; r * bh < h; r++) {
      var off = (r % 2) * (bw >> 1);
      for (var cx = -off; cx < w; cx += bw) {
        var bx = x + Math.max(cx, 0), ex = Math.min(x + cx + bw - 1, x + w);
        var by = y + r * bh, eh = Math.min(bh - 1, y + h - by);
        if (ex <= bx || eh <= 0) continue;
        var v = hs(seed + r * 31.7 + cx * 7.3);
        var c = v < 0.18 ? sh(base, -1) : (v > 0.86 ? sh(base, 1) : base);
        R(bx, by, ex - bx, eh, c);
        if (v > 0.55) R(bx, by, ex - bx, 1, sh(c, 1));
      }
    }
  }
  function floorPlanks(y0, c, line) {
    R(0, y0, W, H - y0, c);
    var y = y0, gap = 3, row = 0;
    while (y < H) {
      R(0, y, W, 1, line);
      var off = hs(row * 9.1) * 40;
      for (var x = off; x < W; x += 46 + row * 4) R(x, y, 1, gap, line);
      R(0, y + 1, W, 1, D(sh(c, 1), 4));
      y += gap; gap += 1.6; row++;
    }
  }
  function interior(o) {
    var fy = o.floorY || 132, wall = o.wall || 'm';
    R(0, 0, W, H, wall);
    // wallpaper stripes + motif
    for (var x = 2; x < W; x += 12) DR(x, 14, 5, fy - 14, sh(wall, -1), o.stripe || 5);
    for (x = 8; x < W; x += 12) for (var y = 22; y < fy - 38; y += 12) P(x, y + (((x / 12) | 0) % 2 ? 6 : 0), sh(wall, 1));
    // ceiling + molding
    R(0, 0, W, 12, 'd'); DR(0, 0, W, 7, 'k', 9);
    R(0, 12, W, 2, 'k'); R(0, 14, W, 1, sh(wall, 1));
    for (x = 0; x < W; x += 6) P(x, 13, sh(wall, -1));
    // wainscot
    if (o.wains !== false) {
      var wy = fy - 32;
      R(0, wy, W, 32, 'd'); R(0, wy, W, 2, 'k'); R(0, wy + 2, W, 1, 'b');
      for (x = 5; x < W; x += 26) {
        R(x, wy + 7, 20, 19, 'k'); R(x + 1, wy + 8, 19, 18, 'd');
        R(x + 1, wy + 8, 19, 1, 'm'); R(x + 1, wy + 8, 1, 18, 'm');
      }
    }
    R(0, fy - 4, W, 4, 'k'); R(0, fy - 4, W, 1, 'm');
    floorPlanks(fy, o.floor || 'd', 'k');
    DR(0, fy, W, 10, 'k', 5);
  }
  // window: back part (recess); glass anim; front frame
  function winBack(x, y, w, h) { R(x - 3, y - 3, w + 6, h + 6, 'k'); R(x, y, w, h, 'k'); }
  function winGlass(t, x, y, w, h, seed) {
    seed = seed || 0;
    R(x, y, w, h, 'k'); DR(x, y, w, h, 'd', 7);
    // distant horizon / sea line
    var hy = y + (h * 0.62) | 0;
    DR(x, hy, w, h - (hy - y), 'd', 12);
    for (var i = 0; i < 5; i++) {
      var wx = x + ((hs(seed + i) * w + t * 6 * (i % 2 ? 1 : -1)) % w + w) % w;
      R(wx, hy + 3 + i * 3, 4, 1, 'm');
    }
    fogBand(t, x, x + w, y + h * 0.3, h * 0.5, 'm', 6, 8, seed + 1);
    fogBand(t, x, x + w, y + h * 0.55, h * 0.4, 'l', 2, -5, seed + 4);
    var f = flash(t);
    if (f) { DR(x, y, w, h * 0.6, 'p', f === 2 ? 10 : 5); }
    // drops on glass
    G.fillStyle = cc('l');
    for (i = 0; i < Math.max(4, (w * h) / 90); i++) {
      var dx = x + rd(hs(seed * 3 + i * 1.3) * (w - 1));
      var sp = 6 + hs(i * 2.7) * 14;
      var dy = y + ((hs(i * 5.1 + seed) * h + t * sp) % h);
      G.fillRect(dx, rd(dy), 1, 2);
      P(dx, rd(dy) - 2, D('l', 8));
    }
  }
  function winFront(x, y, w, h, o) {
    o = o || {};
    // frame
    R(x - 3, y - 3, w + 6, 3, 'b'); R(x - 3, y - 3, 3, h + 6, 'b'); R(x + w, y - 3, 3, h + 6, 'm'); R(x - 3, y - 4, w + 6, 1, 'p');
    var mx = x + (w >> 1) - 1;
    R(mx, y, 2, h, 'm'); R(mx, y, 1, h, 'b');
    var bars = o.bars || 1;
    for (var i = 1; i <= bars; i++) { var by = y + rd(h * i / (bars + 1)); R(x, by, w, 2, 'm'); R(x, by, w, 1, 'b'); }
    // sill
    R(x - 6, y + h + 2, w + 12, 4, 'l'); R(x - 6, y + h + 2, w + 12, 1, 'p'); R(x - 6, y + h + 6, w + 12, 1, 'k');
    if (o.curtain !== false) {
      var cc2 = o.curtain || 'l';
      PO([x - 10, y - 6, x + 6, y - 6, x + 3, y + h * 0.5, x + 7, y + h + 6, x - 10, y + h + 6], cc2, 'k');
      PO([x + w + 10, y - 6, x + w - 6, y - 6, x + w - 3, y + h * 0.5, x + w - 7, y + h + 6, x + w + 10, y + h + 6], cc2, 'k');
      for (var k = 0; k < 3; k++) {
        L(x - 7 + k * 4, y - 5, x - 7 + k * 4 + (k === 2 ? 2 : 0), y + h + 5, sh(cc2, -1));
        L(x + w + 7 - k * 4, y - 5, x + w + 7 - k * 4 - (k === 2 ? 2 : 0), y + h + 5, sh(cc2, -1));
      }
      R(x - 12, y - 8, w + 24, 2, 'k'); R(x - 12, y - 8, w + 24, 1, 'l');
    }
  }
  function cornerShadow() { DR(0, 14, 10, 120, 'k', 5); DR(W - 10, 14, 10, 120, 'k', 5); }

  /* ------------------------------------------------------------------ */
  /* figures (pixel maps, 16 wide)                                       */
  /* ------------------------------------------------------------------ */
  var FIG = {
    karasuma: { hair: 'd', hat: 6, head: 10, rows: [
      '......kkkk......',
      '.....kddmdk.....',
      '.....kddddk.....',
      '....kkkkkkkk....',
      '...kddddddddk...',
      '....kkkkkkkkk...',
      '.....kllllmk....',
      '.....kpkppkk....',
      '.....kppppmk....',
      '......kpplk.....',
      '.....kwkllkwk...',
      '...kkwwwkwwlkk..',
      '..kwwwwwkwwwllk.',
      '..kwwkwwkwwkllk.',
      '..kwwkwwdwwklwk.',
      '..kwwkwwkwwklwk.',
      '..kwwkwwdwwklwk.',
      '..kwwkwwkwwklwk.',
      '..kwwkkkkkkklwk.',
      '..kwwkwwkwwklwk.',
      '..kwwkwwkwwklwk.',
      '..kppkwwkwwklpk.',
      '..kpkkwwkwwkkpk.',
      '...k.kwwkwwlk.k.',
      '.....kwwkwwlk...',
      '.....kwwkwwlk...',
      '....kwwwkwwllk..',
      '....kwwwkwwllk..',
      '....kwwwkwwllk..',
      '....kwwwkwwllk..',
      '....kwwwkwwllk..',
      '....kkkkkkkkkk..',
      '.....kdk.kdk....',
      '.....kdk.kdk....',
      '.....kdk.kdk....',
      '.....kdk.kdk....',
      '.....kdk.kdk....',
      '.....kdk.kdk....',
      '....kkkk.kkkk...',
      '....kkkk.kkkk...'
    ] },
    fuyuko: { hair: 'k', hat: 0, head: 10, rows: [
      '......kkkk......',
      '.....kddddk.....',
      '....kdddmddk....',
      '....kdpppddk....',
      '....kdkpkpdk....',
      '....kdpppddkk...',
      '.....kpplkkddk..',
      '......kplkkddk..',
      '.....kkplkkkk...',
      '....kmmwwwmmk...',
      '...kmmmkwkmmmk..',
      '..kmmlmwwwmmdmk.',
      '..kmlmkpppkmdmk.',
      '..kmlmkpppkmdmk.',
      '..kmlmkkkkkmdmk.',
      '..kmlkdpppppkdmk',
      '..kpkdpppppldkpk',
      '...kkdppppplddk.',
      '....kdppppplddk.',
      '....kdppppplddk.',
      '....kdppppplddk.',
      '....kdppppplddk.',
      '...kddppppplddk.',
      '...kddppppplddk.',
      '...kddppppplddk.',
      '...kdddppplddddk',
      '...kdddddddddddk',
      '...kdddddddddmdk',
      '..kddddddddddmdk',
      '..kddddddddddmdk',
      '..kddddddddddmdk',
      '..kkkkkkkkkkkkkk',
      '.....kdk.kdk....',
      '.....kdk.kdk....',
      '....kkkk.kkkk...',
      '....kkkk.kkkk...'
    ] },
    shibasaki: { hair: 'p', hat: 0, head: 10, rows: [
      '......kkkkk.....',
      '.....kpppllk....',
      '....kpplllldk...',
      '....kplpppppk...',
      '....kpppppplk...',
      '....kkwkkwkplk..',
      '....kppppppk....',
      '.....kpmmplk....',
      '......kpplk.....',
      '.....kkwdwkk....',
      '...kkmmwdwmmkk..',
      '..kmmmmwdwmmmdk.',
      '..kmlmmwdwmmmdk.',
      '..kmlmmkdkmmmdk.',
      '..kmlmmmpmmmmdk.',
      '..kmlmmmkmmmmdk.',
      '..kmlmmmpmmmmdk.',
      '..kmlmmmkmmmmdk.',
      '..kmmmmmpmmmmdk.',
      '..kmkkkkkkkkkmk.',
      '..kpkddddmdddkpk',
      '...kkddddmdddkk.',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '....kdddkmddk...',
      '...kkkkk.kkkkk..',
      '...kkkkk.kkkkk..'
    ] },
    chikage: { hair: 'k', hat: 5, head: 10, rows: [
      '........k.......',
      '.....kkkkkk.....',
      '...kkddddddkk...',
      '...kddmmddddk...',
      '....kkkkkkkk....',
      '....kkkkkkkk....',
      '....kkdppdkk....',
      '....kkppppkk....',
      '....kkppmpkk....',
      '....kkkpplkk....',
      '....klllllllk...',
      '...kllpllpllk...',
      '..kddllllllddk..',
      '..kmdkllpkdddk..',
      '..kmdkllpkdddk..',
      '..kmddkllkdddk..',
      '..kmdddklkdddk..',
      '..kmdddkkkdddk..',
      '..kmkkkkkkkkdk..',
      '..kmdddkdddddk..',
      '..kpkddkdddkpk..',
      '..kkkddkdddkkk..',
      '...kmddkddddk...',
      '...kmddkddddk...',
      '...kmddkddddk...',
      '...kmddkddddk...',
      '...kmddkddddk...',
      '...kkkkkkkkkk...',
      '.....kk..kk.....',
      '.....kk..kk.....',
      '.....kk..kk.....',
      '.....kk..kk.....',
      '.....kk..kk.....',
      '....kkk..kkk....',
      '....kkk..kkk....'
    ] },
    naruse: { hair: 'k', hat: 0, head: 10, rows: [
      '................',
      '.....kkkkkk.....',
      '....kkwkkkkk....',
      '....kwkkkkkk....',
      '....kpppppkk....',
      '....kpkppkpk....',
      '....kppppplk....',
      '....kpkkkkpk....',
      '.....kpppplkwp..',
      '......kpplk.....',
      '.....kkwdwkk....',
      '...kklpwwwplkk..',
      '..klllpwdwplllk.',
      '..klpllpdplllmk.',
      '..klplpkdkplmlk.',
      '..klplkllklkmlk.',
      '..klpllllllkmlk.',
      '..klplkllklkmlk.',
      '..klpllllllllmk.',
      '..klplllllllmlk.',
      '..kpkllllllllkpk',
      '...kkllllllllkk.',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '....klllkllmk...',
      '...kkkkk.kkkkk..',
      '...kwwkk.kwwkk..'
    ] },
    kuga: { hair: 'p', hat: 0, head: 10, rows: [
      '................',
      '................',
      '................',
      '.......kkkk.....',
      '......kpwppk....',
      '.....kwppppplk..',
      '.....kkkpkkplk..',
      '.....kpppppplk..',
      '.....kwlwlwwk...',
      '......kwwwwk....',
      '....kklllllkk...',
      '...kllplpllllk..',
      '..kldddlplddddk.',
      '..kldddlpldddlk.',
      '..kldddlplddddk.',
      '..kldkdlpldkdlk.',
      '..kldddlplddddk.',
      '..kldddlplddddk.',
      '..kldddlplddddk.',
      '..kpkddlplddkpk.',
      '..kpkkkkkkkkkpk.',
      '...kkmmmkmmmkk..',
      '....kmmmkmmmk...',
      '....kmmmkmmmk...',
      '....kmmmkmmmk...',
      '....kmmmkmmmk...',
      '....kmmmkmmmk...',
      '....kmmmkmmmk...',
      '....kmmmkmmmk...',
      '....kmmmkmmmk...',
      '....kmmmkmmmk...',
      '....kmmmkmmmk...',
      '...kkkkkkkkkkk..',
      '...kkkkk.kkkkk..'
    ] },
    haitani: { hair: 'p', hat: 0, head: 10, rows: [
      '................',
      '......kkkkk.....',
      '.....kpwwwpk....',
      '....kwpppppwk...',
      '....kwpppppwk...',
      '....kpkppkpk....',
      '....kppppppk....',
      '....kwwwwwwk....',
      '.....kpppplk....',
      '......kpplk.....',
      '....kkkpppkkk...',
      '...kmmmmmmmmmk..',
      '..kmmlmlmlmmdmk.',
      '..kmlmlmlmlmdmk.',
      '..kmmlmlmlmmdmk.',
      '..kmlmlmlmlmdmk.',
      '..kmmlmlmlmmdmk.',
      '..kmlmlmlmlmdmk.',
      '..kmmlmlmlmmdmk.',
      '..kpkmmmmmmmkpk.',
      '..kpkkkkkkkkkpk.',
      '...kkdddkdddkk..',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '....kdddkddmk...',
      '...kkkkk.kkkkk..',
      '...kkkkk.kkkkk..'
    ] }
  };
  function backRows(def) {
    var out = [];
    for (var r = 0; r < def.rows.length; r++) {
      var row = def.rows[r].split('');
      var a = -1, b = -1;
      for (var i = 0; i < row.length; i++) if (row[i] !== '.') { if (a < 0) a = i; b = i; }
      if (r >= def.hat && r < def.head && a >= 0) {
        for (i = a + 1; i < b; i++) row[i] = (i === b - 1) ? sh(def.hair, -1) : def.hair;
      } else if (r >= def.head) {
        var kc = 0; for (i = 0; i < row.length; i++) if (row[i] === 'k') kc++;
        if (kc < 8) for (i = 6; i <= 9; i++) if ((row[i] === 'd' || row[i] === 'k' || row[i] === 'p' || row[i] === 'w') && row[i - 1] !== '.' && row[i + 1] !== '.' && row[i - 1] !== 'k') row[i] = row[i - 1];
        if (kc < 8 && r < def.head + 14) for (i = 3; i <= 12; i++) if (row[i] === 'k' && row[i - 1] !== '.' && row[i + 1] !== '.' && row[i - 1] !== 'k' && row[i + 1] !== 'k') row[i] = 'l';
      }
      out.push(row.join(''));
    }
    return out;
  }
  var FIGC = {};
  function figCanvas(id, mode) {
    var key = id + ':' + mode;
    if (FIGC[key]) return FIGC[key];
    var def = FIG[id] || FIG.karasuma;
    var rows = mode === 'back' ? backRows(def) : def.rows;
    var h = rows.length, cv = mk(16, h);
    if (!cv) return null;
    var g = cv.getContext('2d');
    for (var y = 0; y < h; y++) {
      var row = rows[y];
      for (var x = 0; x < 16; x++) {
        var ch = row[x] || '.';
        if (ch === '.') continue;
        var col = ch;
        if (mode === 'sil') {
          var lft = x === 0 || (row[x - 1] || '.') === '.';
          var rgt = x === 15 || (row[x + 1] || '.') === '.';
          var up = y === 0 || (rows[y - 1][x] || '.') === '.';
          var lum = ORDER.indexOf(ch);
          col = lum >= 5 ? 'm' : (lum >= 3 ? 'd' : 'k');
          if (rgt) col = 'r'; else if (lft || up) col = 'l';
        }
        g.fillStyle = MAPC[col] || PAL[col]; g.fillRect(x, y, 1, 1);
      }
    }
    FIGC[key] = cv; return cv;
  }
  function figure(ctx, id, x, y, opts) {
    opts = opts || {};
    var cv = figCanvas(id, opts.sil ? 'sil' : (opts.back ? 'back' : 'n'));
    if (!cv) return;
    var s = opts.scale || 1, w = cv.width * s, h = cv.height * s;
    var dx = rd(x - w / 2), dy = rd(y - h);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (opts.shadow !== false && !opts.lying) {
      var g0 = G; G = ctx; R(x - 6 * s, y - s, 12 * s, s * 2, D('k', 6)); R(x - 4 * s, y - s, 8 * s, s * 2, D('k', 12)); G = g0;
    }
    if (opts.lying) { // rotate -90deg: head to the left, pixel exact
      ctx.translate(rd(x), rd(y)); ctx.rotate(-Math.PI / 2);
      ctx.drawImage(cv, 0, 0, w, h);
    } else if (opts.flip) {
      ctx.translate(dx + w, dy); ctx.scale(-1, 1); ctx.drawImage(cv, 0, 0, w, h);
    } else ctx.drawImage(cv, dx, dy, w, h);
    ctx.restore();
    // small extras
    var g1 = G; G = ctx;
    if (!opts.lying && !opts.sil && !opts.back) {
      var fx = function (v) { return opts.flip ? (dx + w - (v + 1) * s) : dx + v * s; };
      if (id === 'shibasaki') { // doctor's bag in right hand
        var bx = fx(opts.flip ? 1 : 12), by = dy + 21 * s;
        R(bx - s, by, 5 * s, 5 * s, 'k'); R(bx, by + s, 3 * s, 3 * s, 'd'); R(bx, by + s, 3 * s, s, 'm'); R(bx + s, by - s, s, s, 'k');
      }
      if (id === 'naruse' && opts.t !== undefined) { // cigarette smoke
        for (var i = 0; i < 4; i++) {
          var sy = ((opts.t * 6 + i * 3) % 12);
          P(fx(13) + rd(Math.sin(opts.t * 2 + i) * 1.2) * s, dy + (7 - sy) * s, D('p', 10 - i * 2));
        }
      }
    }
    G = g1;
  }

  /* ------------------------------------------------------------------ */
  /* scene definitions                                                   */
  /* ------------------------------------------------------------------ */
  var SC = {};
  var HS = {};

  function brackets(r, t) {
    var on = (Math.floor(t * 3) % 2) === 0, c = on ? 'w' : 'p';
    var x = r[0] - 1, y = r[1] - 1, w = r[2] + 2, h = r[3] + 2, l = Math.max(3, Math.min(6, (w / 3) | 0, (h / 3) | 0));
    function br(o, col) {
      R(x + o, y + o, l, 1, col); R(x + o, y + o, 1, l, col);
      R(x + w - l + o, y + o, l, 1, col); R(x + w - 1 + o, y + o, 1, l, col);
      R(x + o, y + h - 1 + o, l, 1, col); R(x + o, y + h - l + o, 1, l, col);
      R(x + w - l + o, y + h - 1 + o, l, 1, col); R(x + w - 1 + o, y + h - l + o, 1, l, col);
    }
    br(1, 'k'); br(0, c);
    if (on) DR(r[0], r[1], r[2], r[3], 'w', 1);
  }

  /* ---------------- weapons ---------------- */
  // (x,y) = bottom-centre on the floor
  function weaponFloor(kind, x, y) {
    x = rd(x); y = rd(y);
    EL(x, y, 10, 2, D('k', 9));
    if (kind === 'spanner') {
      LT(x - 9, y - 2, x + 5, y - 6, 'k', 3); LT(x - 9, y - 3, x + 5, y - 7, 'p', 1); L(x - 8, y - 2, x + 4, y - 5, 'l');
      EL(x + 7, y - 7, 4, 3, 'k'); EL(x + 7, y - 7, 3, 2, 'p'); R(x + 8, y - 9, 3, 2, 'k'); P(x + 6, y - 9, 'w');
      EL(x - 10, y - 2, 3, 2, 'k'); EL(x - 10, y - 2, 2, 1, 'l'); P(x - 10, y - 2, 'k');
      R(x + 6, y - 6, 3, 2, 'r'); P(x + 9, y - 5, 'r2'); EL(x + 11, y, 3, 1, 'r2');
    } else if (kind === 'ashtray') {
      EL(x, y - 2, 9, 3, 'k'); EL(x, y - 3, 8, 2, 'p'); EL(x, y - 3, 5, 1, 'l');
      R(x - 7, y - 4, 2, 1, 'w'); R(x + 3, y - 5, 3, 1, 'w');
      P(x - 9, y - 3, 'k'); P(x + 9, y - 3, 'k'); P(x, y - 5, 'k');
      R(x + 5, y - 3, 3, 1, 'r'); P(x + 7, y - 2, 'r2'); EL(x + 10, y, 3, 1, 'r2');
    } else if (kind === 'bar') {
      LT(x - 11, y - 2, x + 9, y - 5, 'k', 3); L(x - 11, y - 3, x + 9, y - 6, 'l'); L(x - 10, y - 3, x, y - 5, 'p'); P(x - 6, y - 4, 'w');
      R(x + 7, y - 6, 3, 2, 'r'); P(x + 10, y - 5, 'r2'); EL(x + 11, y, 4, 1, 'r2'); P(x + 10, y, 'r');
    } else if (kind === 'bottle') {
      R(x - 8, y - 7, 13, 7, 'k'); R(x - 7, y - 6, 11, 5, 'l'); R(x - 7, y - 6, 11, 1, 'p'); R(x - 6, y - 5, 4, 1, 'w');
      R(x + 5, y - 5, 5, 3, 'k'); R(x + 5, y - 4, 4, 1, 'l'); R(x + 10, y - 6, 2, 5, 'k');
      R(x - 8, y - 7, 2, 7, 'k'); R(x - 7, y - 3, 3, 2, 'r'); P(x - 9, y - 1, 'r2'); EL(x - 11, y, 3, 1, 'r2');
    } else { // paperweight: brass lighthouse model
      PO([x - 6, y - 2, x - 4, y - 12, x + 4, y - 12, x + 6, y - 2], 'l', 'k');
      R(x - 3, y - 11, 2, 9, 'p'); R(x - 4, y - 8, 10, 1, 'm'); R(x - 5, y - 5, 11, 1, 'm');
      PO([x - 4, y - 12, x - 3, y - 18, x + 3, y - 18, x + 4, y - 12], 'k'); R(x - 2, y - 17, 4, 4, 'p'); P(x - 2, y - 17, 'w');
      R(x - 3, y - 19, 6, 1, 'k'); R(x - 1, y - 21, 2, 2, 'k');
      R(x - 8, y - 2, 16, 2, 'k'); R(x - 7, y - 2, 14, 1, 'm');
      R(x + 2, y - 16, 3, 5, 'r'); R(x + 3, y - 11, 2, 4, 'r2'); EL(x + 10, y, 4, 1, 'r2'); P(x + 9, y, 'r');
    }
  }
  // part of the weapon sticking out of sand; (x,y) = sand surface centre
  function weaponStick(kind, x, y) {
    if (kind === 'spanner') {
      R(x - 1, y - 12, 3, 12, 'k'); R(x, y - 12, 1, 12, 'l');
      EL(x, y - 14, 3, 3, 'k'); EL(x, y - 14, 2, 2, 'l'); R(x - 1, y - 17, 3, 2, 'k'); R(x - 1, y - 15, 2, 2, 'r');
    } else if (kind === 'ashtray') {
      PO([x - 6, y, x - 5, y - 5, x + 5, y - 7, x + 6, y - 1], 'p', 'k'); L(x - 4, y - 3, x + 4, y - 5, 'w'); P(x + 3, y - 4, 'r');
    } else if (kind === 'bar') {
      R(x - 1, y - 14, 3, 14, 'k'); R(x, y - 14, 1, 14, 'm'); R(x - 1, y - 15, 3, 3, 'r'); P(x + 1, y - 12, 'r2');
    } else if (kind === 'bottle') {
      R(x - 3, y - 6, 7, 6, 'k'); R(x - 2, y - 6, 5, 6, 'm'); R(x - 2, y - 6, 1, 6, 'p');
      R(x - 1, y - 11, 3, 5, 'k'); R(x, y - 11, 1, 5, 'l'); R(x - 2, y - 12, 5, 1, 'k'); P(x + 2, y - 5, 'r');
    } else {
      PO([x - 3, y, x - 2, y - 8, x + 2, y - 8, x + 3, y], 'l', 'k'); R(x - 1, y - 7, 1, 7, 'p');
      R(x - 2, y - 12, 4, 4, 'k'); R(x - 1, y - 11, 2, 2, 'p'); R(x - 1, y - 14, 2, 2, 'k'); R(x + 1, y - 7, 2, 3, 'r');
    }
  }
  function weaponHere(fl, place) {
    if (fl.weapon_taken) return false;
    if (fl.weapon_at === undefined) return place === 'gallery';
    return fl.weapon_at === place;
  }

  /* ---------------- title ---------------- */
  var TL = { x: 57, y: 30 }; // lamp centre
  SC.title = { L: [
    ['s', function () {
      R(0, 0, W, H, 'm');
      DR(0, 0, W, 30, 'd', 12); DR(0, 30, W, 24, 'd', 7); DR(0, 54, W, 24, 'd', 3);
      DR(0, 78, W, 30, 'b', 3);
      DR(176, 0, 144, 108, 'd', 6); DR(250, 0, 70, 108, 'd', 4);
      // low clouds, mostly on the left / centre
      for (var i = 0; i < 14; i++) {
        var cx = hs(i * 3.7) * 240 - 20, cy = 52 + hs(i * 1.9) * 34, rx = 20 + hs(i * 5.3) * 34;
        EL(cx, cy, rx, Math.max(2, rx * 0.16), D('b', 4 + (i % 3) * 3));
        EL(cx - 4, cy - 1, rx * 0.6, Math.max(1, rx * 0.08), D('l', 3));
      }
      // sea
      R(0, 108, W, 72, 'd'); DR(0, 140, W, 40, 'k', 6); R(0, 108, W, 1, 'b');
      DR(0, 109, 170, 8, 'm', 6);
      // cliff
      POLY([0, 96, 22, 91, 52, 89, 84, 90, 104, 94, 114, 104, 120, 118, 130, 128, 126, 146, 138, 162, 134, 180, 0, 180], 'k');
      for (i = 0; i < 18; i++) {
        var rx2 = hs(i * 2.3) * 120, ry2 = 100 + hs(i * 4.1) * 78;
        if (rx2 > 118 - (ry2 - 100) * 0.1) continue;
        POLY([rx2, ry2, rx2 + 7, ry2 - 3, rx2 + 11, ry2 + 2, rx2 + 3, ry2 + 4], 'd');
        R(rx2 + 1, ry2 - 1, 5, 1, 'm');
      }
      L(0, 96, 22, 91, 'm'); L(22, 91, 52, 89, 'm'); L(52, 89, 84, 90, 'm');
      L(84, 90, 104, 94, 'm'); L(104, 94, 114, 104, 'd'); L(114, 104, 120, 118, 'd');
      for (var x = 0; x < 100; x += 3) R(x, 89 + (hs(x * 1.3) * 3 | 0), 1, 3, 'd');
      // small western house beside the tower
      POLY([64, 92, 64, 72, 80, 60, 98, 72, 98, 92], 'm'); POLY([62, 73, 80, 59, 100, 73, 97, 74, 80, 62, 65, 74], 'k');
      L(62, 73, 80, 59, 'm'); L(80, 59, 100, 73, 'k');
      R(88, 58, 4, 9, 'd'); R(88, 58, 1, 9, 'm');
      R(70, 77, 4, 6, 'y'); R(71, 77, 1, 6, 'w'); R(71, 80, 3, 1, 'k');
      R(84, 77, 4, 6, 'k'); R(84, 77, 4, 1, 'm');
      R(70, 85, 4, 5, 'k'); R(84, 85, 4, 5, 'k'); R(77, 84, 4, 8, 'k');
      DR(64, 72, 34, 20, 'k', 4);
      // lighthouse tower
      POLY([49, 93, 52, 40, 62, 40, 65, 93], 'l');
      R(51, 42, 2, 50, 'p'); R(53, 42, 1, 50, D('w', 6)); DR(58, 40, 7, 53, 'm', 10);
      for (var y = 50; y < 92; y += 10) R(50, y, 14, 1, D('d', 8));
      R(56, 60, 2, 4, 'k'); R(56, 76, 2, 4, 'k');
      // gallery + lamp room + dome
      R(46, 38, 22, 2, 'k'); R(46, 38, 22, 1, 'l');
      for (x = 47; x <= 67; x += 3) R(x, 34, 1, 4, 'k');
      R(47, 34, 21, 1, 'm');
      R(52, 26, 10, 9, 'k');
      EL(57, 25, 6, 3, 'k'); R(56, 17, 2, 6, 'k'); P(56, 16, 'm');
    }],
    ['a', function (t) {
      // rotating beam: horizontal sweep seen from the side
      var a = t * 0.42, c = Math.cos(a), sn = Math.sin(a), ac = Math.abs(c), dir = c >= 0 ? 1 : -1;
      var len = 30 + ac * 260, spread = 9 + (1 - ac) * 16 + Math.max(0, sn) * 10;
      var ex = TL.x + dir * len, ey = TL.y + 7;
      var mx = TL.x + dir * len * 0.45, my = TL.y + 3, ms = spread * 0.5;
      var lv = 3 + rd(Math.max(0, sn) * 3);
      POLY([TL.x, TL.y - 1, mx, my - ms, mx, my + ms, TL.x, TL.y + 1], D('p', lv + 2));
      POLY([mx, my - ms, ex, ey - spread, ex, ey + spread, mx, my + ms], D('p', lv - 1));
      POLY([TL.x, TL.y - 1, mx, my - 3, mx, my + 3, TL.x, TL.y + 1], D('w', lv + 2)); POLY([mx, my - 3, ex, ey - spread * 0.3, ex, ey + spread * 0.3, mx, my + 3], D('w', lv - 1));
      if (sn > 0.6 && ac < 0.6) glow(TL.x, TL.y, 12 + (sn - 0.6) * 30, 'w', 2);
      // lamp
      R(53, 27, 8, 7, 'p'); R(55, 28, 4, 5, 'y'); P(56, 29, 'w');
      R(57, 27, 1, 7, 'k');
      // drifting fog bands over the sea, lit where the beam passes
      fogBand(t, 0, W, 86, 26, 'm', 5, 6, 3);
      fogBand(t, 0, W, 102, 22, 'l', 2, -4, 7);
      var bx0 = Math.min(TL.x, ex), bx1 = Math.max(TL.x, ex);
      if (bx1 - bx0 > 20) fogBand(t, Math.max(0, bx0), Math.min(W, bx1), TL.y + 2, spread * 1.6, 'p', 2, 6, 11);
      // sea glints, sparse; brighter under the beam
      for (var row = 0; row < 14; row++) {
        var y = 111 + row * 5 + (row > 6 ? row - 6 : 0);
        if (y > 178) break;
        for (var i = 0; i < 3 + (row >> 1); i++) {
          var wx = ((hs(row * 9.1 + i) * W + t * (row % 2 ? 3 : -3) * (1 + row * 0.25)) % W + W) % W;
          if (wx < 124 + row * 2) continue;
          var lit = (wx - bx0) * (wx - bx1) < 0 && row < 5;
          R(wx, y, 2 + (row >> 2), 1, lit ? 'p' : (row < 6 ? 'd' : 'm'));
        }
      }
      // surf on the rocks
      for (i = 0; i < 4; i++) { var s2 = Math.sin(t * 1.3 + i * 1.7); EL(126 + i * 4, 132 + i * 12, 5 + s2 * 2, 1, D('l', 5 + rd(s2 * 3))); }
      // the single red accent: a small warning light on the gallery
      var blink = (t % 3.2) < 2.6;
      if (blink) { P(66, 36, 'r'); P(66, 37, 'r2'); } else P(66, 36, 'r2');
      rain(t, 46, 'm', 0, 0, W, H, 150, 0.3);
      rain(t, 10, 'l', 0, 0, 170, H, 190, 0.3);
      vignette(1);
    }]
  ] };
  HS.title = {};

  /* ---------------- exterior ---------------- */
  function towerShape(x0, x1, y0, y1, taper) {
    POLY([x0 + taper, y0, x1 - taper, y0, x1, y1, x0, y1], 'l');
  }
  SC.exterior = { L: [
    ['s', function () {
      // sky
      R(0, 0, W, H, 'd');
      DR(0, 0, W, 30, 'k', 10); DR(0, 30, W, 24, 'k', 5); DR(0, 54, W, 20, 'k', 2);
      // cloud banks
      for (var i = 0; i < 16; i++) {
        var cx = hs(i * 3.7) * 340 - 10, cy = 8 + hs(i * 1.9) * 46, rx = 18 + hs(i * 5.3) * 26;
        EL(cx, cy, rx, rx * 0.28, D('m', 6 + ((i % 3) * 3)));
        EL(cx - 3, cy - 2, rx * 0.7, rx * 0.16, D('b', 4));
      }
      // distant headland
      POLY([180, 112, 230, 100, 262, 98, 300, 104, 320, 102, 320, 113, 180, 113], 'm');
      DR(180, 100, 140, 13, 'b', 3);
      // sea
      R(0, 112, W, 68, 'k'); DR(0, 112, W, 30, 'd', 9); R(0, 112, W, 1, 'm');
      // cliff
      var cl = [44, 138, 38, 146, 44, 154, 32, 164, 38, 172, 30, 180, 320, 180, 320, 138];
      POLY(cl, 'k');
      for (i = 0; i < 26; i++) {
        var rx2 = 36 + hs(i * 2.3) * 280, ry2 = 142 + hs(i * 4.1) * 36;
        POLY([rx2, ry2, rx2 + 8, ry2 - 3, rx2 + 12, ry2 + 2, rx2 + 3, ry2 + 4], 'd');
        R(rx2 + 1, ry2 - 1, 6, 1, 'm');
      }
      R(42, 137, 278, 2, 'd'); for (var x = 44; x < W; x += 3) R(x, 135 + (hs(x) * 3 | 0), 1, 3, 'm');
      // path
      POLY([196, 139, 230, 139, 250, 180, 176, 180], 'd'); DR(196, 139, 34, 41, 'm', 4);
      // ---- main house
      var hx0 = 150, hx1 = 292;
      R(hx0, 64, hx1 - hx0, 74, 'b');
      for (var y = 66; y < 138; y += 3) R(hx0, y, hx1 - hx0, 1, 'm');
      DR(hx1 - 14, 64, 14, 74, 'k', 5); R(hx0, 64, 2, 74, 'l');
      // roof
      PO([hx0 - 7, 66, 221, 38, hx1 + 7, 66], 'k', 'k');
      for (y = 44; y < 66; y += 3) { var hw = (y - 38) * 2.75; R(221 - hw, y, hw * 2, 1, 'd'); }
      L(hx0 - 7, 66, 221, 38, 'l'); L(221, 38, hx1 + 7, 66, 'm');
      R(hx0 - 8, 66, hx1 - hx0 + 16, 2, 'd'); R(hx0 - 8, 66, hx1 - hx0 + 16, 1, 'l');
      // attic round window
      EL(221, 54, 4, 4, 'k'); ELO(221, 54, 5, 5, 'l'); R(221, 50, 1, 9, 'm'); R(217, 54, 9, 1, 'm');
      // chimney
      R(262, 40, 9, 20, 'm'); R(262, 40, 2, 20, 'l'); R(261, 38, 11, 3, 'd'); R(261, 38, 11, 1, 'l');
      // windows: lit / dark
      var wins = [[160, 74, 1], [184, 74, 0], [246, 74, 1], [270, 74, 0], [160, 104, 1], [184, 104, 1], [246, 104, 0], [270, 104, 1]];
      for (i = 0; i < wins.length; i++) {
        var wx = wins[i][0], wy = wins[i][1];
        R(wx - 2, wy - 2, 16, 21, 'k'); R(wx - 3, wy - 3, 18, 1, 'l');
        if (wins[i][2]) {
          R(wx, wy, 12, 17, 'y'); DR(wx, wy + 10, 12, 7, 'p', 6);
          R(wx, wy, 3, 17, 'p'); R(wx + 9, wy, 3, 17, 'p');
        } else { R(wx, wy, 12, 17, 'd'); DR(wx, wy, 12, 8, 'm', 4); }
        R(wx + 5, wy, 2, 17, 'k'); R(wx, wy + 7, 12, 2, 'k');
        R(wx - 3, wy + 17, 18, 2, 'l');
      }
      // porch + door
      R(198, 102, 30, 3, 'k'); R(198, 102, 30, 1, 'l'); R(200, 105, 2, 33, 'm'); R(224, 105, 2, 33, 'm');
      R(205, 110, 16, 28, 'k'); R(206, 111, 14, 27, 'd'); R(207, 112, 5, 11, 'm'); R(214, 112, 5, 11, 'm');
      R(207, 125, 5, 11, 'm'); R(214, 125, 5, 11, 'm'); P(218, 124, 'p');
      R(202, 136, 22, 2, 'l'); R(200, 138, 26, 2, 'm');
      // ---- annex (2F wing, flat roof)
      R(96, 84, 56, 54, 'm');
      for (y = 86; y < 138; y += 3) R(96, y, 56, 1, 'd');
      R(94, 82, 60, 3, 'k'); R(94, 82, 60, 1, 'p');
      DR(140, 84, 12, 54, 'k', 4);
      for (i = 0; i < 2; i++) {
        var ax = 106 + i * 22;
        R(ax - 2, 92, 14, 16, 'k'); R(ax, 94, 10, 12, 'd'); DR(ax, 94, 10, 6, 'b', 3);
        R(ax + 4, 94, 2, 12, 'k'); R(ax, 99, 10, 2, 'k'); R(ax - 3, 107, 16, 2, 'l');
      }
      R(104, 116, 14, 14, 'k'); R(106, 118, 10, 10, i ? 'y' : 'y'); R(110, 118, 2, 10, 'k'); R(106, 122, 10, 2, 'k');
      R(130, 116, 14, 14, 'k'); R(132, 118, 10, 10, 'd'); R(136, 118, 2, 10, 'k');
      // ---- lighthouse tower
      towerShape(66, 102, 42, 138, 3);
      DR(88, 42, 14, 96, 'm', 6); DR(95, 42, 7, 96, 'm', 12);
      R(67, 50, 2, 86, 'p'); R(69, 50, 1, 86, D('w', 6));
      for (y = 52; y < 136; y += 12) R(68, y, 32, 1, D('m', 8));
      // slit windows
      R(82, 60, 3, 8, 'k'); R(82, 90, 3, 8, 'k'); R(83, 61, 1, 2, 'm');
      // gallery deck
      R(58, 40, 52, 3, 'k'); R(58, 40, 52, 1, 'l');
      POLY([60, 43, 108, 43, 104, 47, 64, 47], 'd');
      // lamp room
      R(72, 18, 24, 22, 'k');
      R(74, 20, 20, 18, 'd');
      for (x = 74; x < 94; x += 5) R(x, 20, 1, 18, 'k');
      R(74, 28, 20, 1, 'k');
      // dome + spire
      EL(84, 18, 14, 6, 'k'); EL(84, 17, 12, 5, 'd'); R(74, 18, 21, 2, 'k'); R(76, 13, 6, 1, 'm');
      R(83, 6, 2, 8, 'k'); EL(84, 6, 2, 2, 'd'); P(83, 5, 'l'); R(84, 0, 1, 5, 'm');
      // ---- iron ladder from gallery to annex roof
      R(97, 43, 1, 40, 'k'); R(102, 43, 1, 40, 'k');
      for (y = 46; y < 82; y += 4) { R(98, y, 4, 1, 'R'); }
      R(96, 43, 1, 40, D('l', 4));
      // ground near house
      DR(140, 136, 170, 4, 'k', 6);
    }],
    ['a', function (t) {
      // lamp room faint glow (kerosene inside)
      var fl = 0.5 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
      R(82, 31, 4, 6, 'y'); DR(77, 30, 14, 8, 'y', 2 + rd(fl * 3)); P(83, 32, 'w');
      // gallery railing (over glow)
      R(60, 33, 48, 1, 'm');
      for (var x = 60; x <= 108; x += 4) R(x, 33, 1, 7, 'k');
      R(60, 36, 48, 1, 'k');
      // sea waves
      for (var row = 0; row < 18; row++) {
        var y = 114 + row * 3 + (row > 8 ? row - 8 : 0);
        if (y > 179) break;
        var sp = (row % 2 ? 1 : -1) * (4 + row);
        for (var i = 0; i < 7 + row; i++) {
          var wx = ((hs(row * 9.1 + i) * W + t * sp) % W + W) % W;
          var ln = 3 + (row >> 2);
          R(wx, y, ln, 1, row < 6 ? 'm' : 'b');
          if (row > 8 && hs(i + row) > 0.6) P(wx + 1, y - 1, 'l');
        }
      }
      // surf at cliff base
      for (i = 0; i < 6; i++) {
        var s = Math.sin(t * 1.4 + i * 1.3);
        var fx = 20 + i * 5, fy = 150 + i * 5;
        EL(fx, fy, 6 + s * 2, 2, D('p', 6 + rd(s * 4)));
        P(fx + rd(s * 3), fy - 2, 'w');
      }
      // lightning
      var f = flash(t);
      if (f) {
        DR(0, 0, W, 112, 'p', f === 2 ? 6 : 3);
        if (f === 2) bolt(t, 250, 0, 60);
      }
    }],
    ['p'],
    ['a', function (t) {
      fogBand(t, 0, W, 108, 30, 'l', 2, 7, 1);
      fogBand(t, 0, W, 140, 30, 'p', 1, -5, 6);
      fogBand(t, 0, W, 60, 22, 'l', 1, 4, 11);
      rain(t, 110, 'l', 0, 0, W, H, 170, 0.3);
      rain(t, 30, 'p', 0, 0, W, H, 220, 0.3);
      vignette(1);
    }]
  ] };
  HS.exterior = { tower: [58, 0, 54, 48], ladder: [93, 42, 13, 44], annex: [96, 78, 58, 34], sea: [0, 112, 56, 60], frontdoor: [198, 100, 30, 40] };

  /* ---------------- lamproom ---------------- */
  var LR_X = [0, 22, 54, 92, 136, 184, 228, 266, 298, 320];
  SC.lamproom = { L: [
    ['s', function () {
      R(0, 0, W, H, 'k');
      R(0, 12, W, 90, 'd');
    }],
    ['a', function (t) {
      // outside through the glass
      R(0, 12, W, 90, 'k'); DR(0, 12, W, 90, 'd', 8);
      fogBand(t, 0, W, 30, 50, 'l', 3, 9, 3);
      fogBand(t, 0, W, 54, 46, 'm', 8, -6, 7);
      var f = flash(t);
      if (f) { DR(0, 12, W, 90, 'p', f === 2 ? 9 : 4); if (f === 2) bolt(t, 60, 12, 70); }
      rain(t, 70, 'l', 0, 12, W, 90, 120, 0.1);
    }],
    ['s', function (fl) {
      // mullions (cylindrical)
      for (var i = 0; i < LR_X.length; i++) { var x = LR_X[i]; R(x - 2, 12, 4, 92, 'k'); R(x - 1, 12, 1, 92, 'm'); }
      R(0, 54, W, 3, 'k'); R(0, 54, W, 1, 'm');
      // dome ceiling
      R(0, 0, W, 13, 'k');
      for (i = 0; i < LR_X.length; i++) L(160 + (LR_X[i] - 160) * 0.3, 0, LR_X[i], 12, 'd');
      R(0, 11, W, 2, 'm'); R(0, 11, W, 1, 'l');
      // low wall
      R(0, 102, W, 24, 'm'); R(0, 102, W, 2, 'l'); R(0, 104, W, 1, 'k');
      for (var x = 6; x < W; x += 14) P(x, 108, 'k'), P(x, 120, 'k');
      DR(0, 112, W, 14, 'd', 6);
      // floor
      R(0, 126, W, 54, 'd');
      ELO(160, 152, 150, 24, 'k'); ELO(160, 152, 112, 17, 'k'); ELO(160, 152, 70, 10, 'k');
      for (x = 0; x < W; x += 22) L(160, 152, x, 180, D('k', 8));
      DR(0, 160, W, 20, 'k', 6); R(0, 126, W, 1, 'k');
      // ---- gallery door (open)
      R(14, 32, 44, 96, 'k'); R(16, 34, 40, 92, 'd');
      // doorway shows outside - drawn in fx layer; frame:
      R(14, 32, 3, 96, 'm'); R(55, 32, 3, 96, 'm'); R(14, 30, 44, 3, 'm'); R(14, 30, 44, 1, 'l');
      // swung door panel (opened outward to the left)
      PO([2, 36, 13, 32, 13, 128, 2, 122], 'm', 'k');
      PO([4, 40, 11, 37, 11, 76, 4, 78], 'k'); DR(4, 40, 7, 38, 'p', 3);
      PO([4, 84, 11, 82, 11, 120, 4, 117], 'k'); DR(4, 84, 7, 34, 'p', 2);
      L(5, 42, 9, 40, 'w'); R(12, 76, 1, 6, 'p');
      // wet puddle
      EL(40, 136, 26, 4, 'm'); EL(40, 136, 20, 2, D('l', 8)); R(30, 135, 6, 1, 'p');
      // ---- inner stair door (right)
      R(250, 40, 46, 88, 'k'); R(254, 44, 38, 84, 'm');
      for (var y = 48; y < 124; y += 9) { for (x = 257; x < 290; x += 8) P(x, y, 'k'), P(x, y - 1, 'l'); }
      R(254, 44, 2, 84, 'l'); R(288, 44, 4, 84, 'd');
      R(286, 56, 4, 6, 'k'); R(286, 108, 4, 6, 'k');
      // bolt: keeper on frame (bent), sliding bar on door
      R(246, 78, 6, 12, 'k'); R(247, 79, 4, 2, 'l'); L(246, 90, 243, 95, 'k'); L(247, 90, 244, 96, 'l');
      R(256, 80, 18, 6, 'k'); R(258, 81, 14, 4, 'l'); R(258, 81, 14, 1, 'p');
      // bent bar sticking out
      LT(256, 83, 248, 88, 'k', 2); LT(256, 82, 249, 86, 'p', 1);
      R(266, 85, 2, 5, 'k'); R(266, 85, 1, 4, 'p');
      // splintered frame
      L(250, 72, 246, 70, 'p'); L(250, 94, 245, 98, 'p'); P(244, 99, 'w'); P(247, 70, 'w');
      // knob
      R(260, 96, 4, 4, 'k'); P(260, 96, 'p');
      // ---- desk with radio and tin cup
      R(198, 100, 44, 4, 'l'); R(198, 100, 44, 1, 'p'); R(198, 104, 44, 2, 'k');
      R(200, 106, 3, 24, 'k'); R(237, 106, 3, 24, 'k'); R(201, 106, 1, 22, 'm');
      R(204, 106, 32, 8, 'd'); R(218, 109, 4, 1, 'l');
      // radio
      R(204, 88, 22, 12, 'k'); R(205, 89, 20, 10, 'm'); R(205, 89, 20, 1, 'l');
      for (y = 91; y < 98; y += 2) for (x = 207; x < 216; x += 2) P(x, y, 'k');
      R(218, 91, 6, 3, 'p'); P(220, 91, 'k'); EL(221, 96, 2, 1, 'k');
      L(224, 88, 234, 74, 'l'); P(234, 74, 'w');
      // tin cup
      R(229, 93, 7, 7, 'k'); R(230, 94, 5, 6, 'l'); R(230, 94, 1, 6, 'w'); R(230, 93, 5, 1, 'p'); R(236, 95, 2, 3, 'k');
      // ---- foghorn lever box + rope
      R(94, 94, 28, 32, 'k'); R(96, 96, 24, 30, 'm'); R(96, 96, 24, 1, 'l'); R(96, 96, 1, 30, 'l');
      R(100, 104, 16, 12, 'd'); TXT('7', 106, 107, 'l');
      ELO(108, 96, 6, 4, 'k'); ELO(108, 96, 5, 3, 'l');
      LT(108, 96, 98, 60, 'k', 3); LT(108, 95, 98, 60, 'l', 1);
      R(94, 54, 8, 7, 'k'); R(95, 55, 6, 5, 'p'); R(95, 55, 2, 2, 'w');
      // rope from ceiling
      for (y = 12; y < 92; y++) P(118 + rd(Math.sin(y * 0.2) * 0.6), y, (y % 4 < 2) ? 'p' : 'l');
      R(116, 92, 5, 3, 'p'); R(117, 95, 3, 6, 'l');
      // ---- lens
      var cx = 160;
      R(140, 112, 40, 18, 'k'); R(142, 113, 36, 2, 'm'); R(144, 118, 32, 1, 'l');
      for (x = 146; x < 176; x += 6) R(x, 120, 3, 3, 'd');
      for (y = 22; y < 112; y++) {
        var u = (y - 67) / 46, hw = rd(30 * Math.sqrt(Math.max(0, 1 - u * u * 0.75)) * (u < 0 ? 0.9 : 1));
        var band = Math.floor((y - 22) / 4) % 3;
        var c = band === 0 ? 'p' : (band === 1 ? 'l' : 'm');
        R(cx - hw - 1, y, hw * 2 + 3, 1, 'k');
        R(cx - hw, y, hw * 2 + 1, 1, c);
        if ((y - 22) % 4 === 0) { R(cx - hw, y, hw, 1, 'w'); }
        R(cx + hw - 6, y, 6, 1, D('k', 6));
      }
      // bullseye
      EL(cx, 67, 13, 15, 'l'); ELO(cx, 67, 13, 15, 'k');
      ELO(cx, 67, 9, 11, 'p'); ELO(cx, 67, 5, 7, 'w'); EL(cx, 67, 2, 3, 'w');
      // frame bars
      R(cx - 18, 22, 2, 90, 'k'); R(cx + 17, 22, 2, 90, 'k');
      R(cx - 30, 66, 60, 1, 'k');
      // brass cap
      EL(cx, 21, 22, 3, 'k'); EL(cx, 20, 20, 2, 'm'); R(cx - 3, 13, 6, 8, 'k');
      // crack
      var cr = [146, 34, 152, 42, 150, 50, 158, 58, 163, 66, 170, 72, 168, 82, 175, 92, 172, 104];
      for (var i2 = 0; i2 + 3 < cr.length; i2 += 2) { L(cr[i2], cr[i2 + 1], cr[i2 + 2], cr[i2 + 3], 'k'); L(cr[i2] + 1, cr[i2 + 1], cr[i2 + 2] + 1, cr[i2 + 3], 'w'); }
      L(163, 66, 176, 62, 'k'); L(158, 58, 148, 62, 'k');
      PO([166, 74, 174, 72, 176, 80, 170, 82], 'k'); P(171, 76, 'd');
      // shards on floor
      var sh2 = [[136, 134, 4], [184, 136, 3], [150, 140, 2], [176, 132, 3], [126, 142, 2], [194, 142, 2], [166, 146, 3]];
      for (i2 = 0; i2 < sh2.length; i2++) {
        var s = sh2[i2];
        PO([s[0], s[1], s[0] + s[2] * 2, s[1] - s[2], s[0] + s[2], s[1] + 1], 'p', 'k'); P(s[0] + 1, s[1] - 1, 'w');
      }
      // ---- canvas tarp draped over a crate
      R(64, 104, 22, 24, 'k');
      PO([60, 128, 61, 108, 66, 98, 76, 95, 84, 97, 89, 104, 90, 128], 'b', 'k');
      L(66, 100, 64, 126, 'm'); L(74, 97, 72, 126, 'm'); L(82, 98, 84, 126, 'm');
      L(67, 99, 75, 96, 'l'); R(61, 110, 2, 16, 'l'); DR(60, 116, 30, 12, 'd', 6);
      PO([84, 120, 90, 118, 94, 128, 86, 128], 'm', 'k');
      R(70, 112, 6, 1, 'k');
      // ---- oil lamp hanging
      R(72, 12, 1, 40, 'k');
      R(68, 52, 9, 3, 'k'); R(69, 52, 7, 1, 'l');
      R(68, 55, 9, 14, 'k'); R(69, 56, 7, 12, 'p'); R(70, 57, 1, 10, 'w');
      R(66, 69, 13, 6, 'k'); R(67, 70, 11, 4, 'm'); R(67, 70, 11, 1, 'l');
      // ---- body
      if (fl.sheet) {
        PO([62, 146, 66, 136, 82, 133, 98, 135, 116, 134, 126, 138, 128, 148, 110, 151, 86, 152, 66, 151], 'w', 'k');
        L(70, 140, 82, 146, 'p'); L(96, 137, 104, 148, 'p'); L(112, 138, 118, 148, 'p'); R(66, 148, 60, 2, 'p');
        EL(70, 142, 5, 4, 'p'); EL(70, 141, 4, 3, 'w');
        R(64, 146, 6, 3, 'r2'); P(66, 145, 'r'); P(63, 148, 'r2');
        EL(58, 150, 6, 2, 'r2');
      } else {
        EL(70, 147, 15, 4, 'r2'); EL(68, 146, 12, 3, 'r'); R(58, 146, 4, 1, 'r'); P(76, 145, 'w');
        figure(G, 'haitani', 72, 152, { lying: true, back: true });
        R(68, 140, 2, 1, 'r');
        // the arm reaching out
        R(84, 152, 6, 2, 'm'); R(90, 152, 3, 2, 'p');
      }
      if (weaponHere(fl, 'lamproom')) weaponFloor(fl.weapon, 144, 151);
    }],
    ['a', function (t) {
      // lamp flame + glow flicker
      var fl = 0.6 + 0.4 * Math.sin(t * 9.1) * Math.sin(t * 4.3 + 1);
      glow(72, 62, 26 + fl * 4, 'y', 1 + rd(fl * 1.5));
      R(71, 59, 3, 6, 'y'); R(72, 60 + rd(fl), 1, 3, 'w');
      // lens shimmer
      var gx = 136 + ((t * 18) % 50);
      R(gx, 30 + rd(Math.sin(t) * 2), 2, 1, 'w');
      P(160 + rd(Math.sin(t * 1.7) * 3), 63, 'w');
      // outside fog in doorway + seeping in
      R(17, 35, 38, 91, 'd');
      fogBand(t, 17, 55, 40, 80, 'l', 5, 10, 1);
      fogBand(t, 17, 55, 70, 50, 'p', 3, -7, 4);
      var f = flash(t); if (f) DR(17, 35, 38, 50, 'w', f === 2 ? 8 : 4);
      rain(t, 26, 'p', 18, 35, 36, 90, 150, 0.2);
      // repaint door frame edges over fog
      R(14, 32, 3, 96, 'm'); R(55, 32, 3, 96, 'm');
      for (var i = 0; i < 3; i++) {
        var u = ((t * 10 + i * 40) % 120);
        EL(36 + u, 132 + i * 6 + Math.sin(t + i) * 2, 16 + i * 4, 3, D('l', 3));
      }
    }],
    ['p'],
    ['a', function () { vignette(1); }]
  ] };
  HS.lamproom = { tarp: [58, 92, 32, 38], weapon: [132, 130, 26, 24], body: [58, 128, 72, 28], lens: [126, 12, 68, 102], bolt_door: [242, 38, 56, 92], gallery_door: [2, 28, 58, 102], desk: [196, 72, 48, 60], foghorn: [88, 50, 36, 78], oillamp: [62, 46, 22, 32] };

  /* ---------------- gallery ---------------- */
  SC.gallery = { L: [
    ['s', function () { R(0, 0, W, H, 'k'); }],
    ['a', function (t) {
      // sky + far sea
      R(0, 0, W, 76, 'd'); DR(0, 0, W, 30, 'k', 9);
      R(0, 76, W, 60, 'k'); DR(0, 76, W, 20, 'd', 8); R(0, 76, W, 1, 'm');
      for (var row = 0; row < 12; row++) {
        var y = 79 + row * 4;
        for (var i = 0; i < 5 + row; i++) {
          var wx = ((hs(row * 7.3 + i) * W + t * (row % 2 ? 3 : -3) * (1 + row * 0.3)) % W + W) % W;
          R(wx, y, 2 + (row >> 2), 1, row < 5 ? 'd' : 'm');
        }
      }
      fogBand(t, 0, W, 40, 40, 'm', 6, 6, 2);
      fogBand(t, 0, W, 66, 40, 'l', 4, -8, 5);
      fogBand(t, 0, W, 92, 36, 'p', 2, 5, 9);
      var f = flash(t);
      if (f) { DR(0, 0, W, 80, 'p', f === 2 ? 8 : 4); if (f === 2) bolt(t, 220, 0, 72); }
    }],
    ['s', function (fl) {
      // lamp-room glass wall on left (curving away)
      PO([0, 0, 118, 6, 116, 128, 0, 136], 'k');
      R(4, 10, 106, 112, 'd');
      // interior: the lens visible through glass + warm faint lamp
      EL(64, 64, 22, 40, 'm'); for (var y = 26; y < 104; y += 4) { var u = (y - 64) / 40, hw = rd(22 * Math.sqrt(Math.max(0, 1 - u * u))); R(64 - hw, y, hw * 2, 1, 'l'); }
      EL(64, 64, 8, 10, 'p'); EL(64, 64, 3, 4, 'w');
      EL(64, 104, 16, 8, D('l', 4)); R(61, 98, 6, 8, 'k'); R(62, 99, 4, 6, 'y'); P(63, 100, 'w');
      // reflections + mullions
      var mx = [4, 36, 74, 110];
      for (var i = 0; i < mx.length; i++) { R(mx[i] - 2, 4, 4, 124, 'k'); R(mx[i] - 1, 4, 1, 124, 'l'); }
      R(0, 62, 116, 3, 'k'); R(0, 62, 116, 1, 'l');
      L(10, 20, 30, 50, D('w', 6)); L(14, 20, 34, 50, D('w', 4)); L(80, 70, 100, 100, D('w', 5));
      // base wall
      PO([0, 128, 116, 122, 118, 140, 0, 150], 'm', 'k'); R(0, 129, 116, 1, 'l');
      // floor grating, perspective
      PO([0, 150, 118, 136, W, 132, W, H, 0, H], 'd');
      for (var x = -80; x < W + 80; x += 14) L(x, H, 120 + (x - 120) * 0.45, 134, 'k');
      var ys = [138, 142, 147, 153, 160, 168, 177];
      for (i = 0; i < ys.length; i++) R(0, ys[i], W, 1, 'k');
      DR(0, 160, W, 20, 'k', 6);
      // railing
      var rl = function (x) { return 98 + (x - 118) * 0.02; };
      R(118, 132, 202, 2, 'k'); R(118, 131, 202, 1, 'l');
      for (x = 124; x < W; x += 16) { R(x, 96, 3, 36, 'k'); R(x, 96, 1, 36, 'm'); }
      R(118, 96, 202, 3, 'k'); R(118, 96, 202, 1, 'p');
      R(118, 113, 202, 2, 'k'); R(118, 113, 202, 1, 'l');
      // ladder top (beyond railing at a gap)
      R(258, 92, 3, 44, 'k'); R(280, 92, 3, 44, 'k'); R(258, 92, 1, 44, 'l'); R(280, 92, 1, 44, 'l');
      // hoop tops
      R(256, 86, 7, 2, 'k'); R(278, 86, 7, 2, 'k'); R(258, 88, 3, 4, 'k'); R(280, 88, 3, 4, 'k');
      // red rungs, freshly painted
      for (y = 100; y < 136; y += 7) { R(261, y, 19, 2, 'r'); R(261, y + 2, 19, 1, 'r2'); P(263, y, 'w'); }
      // smear marks on railing + deck
      R(262, 96, 8, 2, 'r'); R(270, 96, 2, 1, 'r2'); R(252, 114, 4, 1, 'r');
      POLY([238, 146, 252, 142, 260, 144, 248, 148], 'r2'); R(243, 145, 8, 1, 'r');
      POLY([224, 156, 236, 152, 240, 154, 228, 158], 'r2');
      if (weaponHere(fl, 'gallery')) weaponFloor(fl.weapon, 166, 152);
    }],
    ['p'],
    ['a', function (t) {
      rain(t, 130, 'l', 0, 0, W, H, 180, 0.35);
      fogBand(t, 0, W, 130, 46, 'l', 2, 12, 13);
      vignette(1);
    }]
  ] };
  HS.gallery = { weapon: [150, 128, 32, 28], ladder: [252, 82, 36, 56], railing: [120, 90, 128, 46], window: [2, 4, 112, 122] };

  /* ---------------- hall ---------------- */
  SC.hall = { L: [
    ['s', function (fl) {
      interior({ floorY: 142, wall: 'm' });
      cornerShadow();
      // coat rack
      R(28, 46, 3, 94, 'k'); R(29, 46, 1, 94, 'l');
      R(22, 138, 15, 3, 'k'); R(19, 140, 21, 2, 'k');
      EL(29, 44, 3, 2, 'k'); L(29, 50, 20, 46, 'k'); L(29, 50, 38, 46, 'k');
      // long coat
      PO([17, 50, 23, 48, 26, 70, 25, 104, 12, 106, 13, 70], 'l', 'k'); L(19, 52, 19, 104, 'm'); R(14, 72, 3, 30, 'p');
      // dark coat
      PO([33, 50, 40, 48, 46, 72, 45, 96, 32, 98, 32, 70], 'd', 'k'); L(39, 52, 40, 96, 'k'); R(42, 60, 2, 30, 'm');
      // hat
      R(22, 41, 14, 2, 'k'); R(25, 37, 8, 4, 'd'); R(25, 37, 8, 1, 'm');
      // umbrella
      L(36, 112, 40, 138, 'k'); L(37, 112, 41, 138, 'k'); R(35, 109, 2, 4, 'k');
      // phone stand
      R(58, 108, 26, 3, 'l'); R(58, 108, 26, 1, 'p'); R(58, 111, 26, 4, 'k');
      R(60, 115, 2, 25, 'k'); R(80, 115, 2, 25, 'k'); R(62, 126, 18, 2, 'd');
      // black dial telephone
      PO([61, 107, 64, 98, 78, 98, 81, 107], 'k'); R(64, 99, 14, 1, 'm');
      EL(71, 102, 4, 3, 'd'); ELO(71, 102, 4, 3, 'l'); P(71, 102, 'p');
      R(60, 94, 22, 3, 'k'); R(59, 93, 4, 3, 'k'); R(79, 93, 4, 3, 'k'); R(61, 94, 20, 1, 'm');
      L(81, 106, 86, 112, 'k'); L(86, 112, 84, 118, 'k');
      // notepad
      R(67, 105, 0, 0, 'w');
      // grandfather clock
      R(98, 34, 28, 106, 'k');
      R(100, 46, 24, 92, 'd'); R(100, 46, 2, 92, 'm');
      PO([98, 38, 112, 30, 126, 38], 'k'); R(100, 38, 24, 8, 'd'); R(100, 38, 24, 1, 'l');
      EL(112, 54, 9, 9, 'k'); EL(112, 54, 8, 8, 'p'); ELO(112, 54, 8, 8, 'l');
      for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; P(112 + Math.cos(a) * 6, 54 + Math.sin(a) * 6, 'k'); }
      L(112, 54, 112, 49, 'k'); L(112, 54, 116, 56, 'k');
      R(103, 68, 18, 52, 'k'); R(104, 69, 16, 50, D('m', 6)); R(104, 69, 1, 50, 'l');
      R(102, 122, 20, 14, 'd'); R(104, 124, 16, 10, 'k'); R(105, 125, 14, 8, 'm');
      R(97, 136, 30, 4, 'k');
      // tower door
      R(146, 52, 48, 90, 'k');
      PO([150, 140, 150, 68, 160, 58, 170, 55, 180, 58, 190, 68, 190, 140], 'm');
      for (var x = 154; x < 190; x += 7) R(x, 62, 1, 78, 'd');
      R(150, 78, 40, 4, 'k'); R(150, 118, 40, 4, 'k'); R(150, 78, 40, 1, 'l'); R(150, 118, 40, 1, 'l');
      for (x = 154; x < 190; x += 6) { P(x, 80, 'p'); P(x, 120, 'p'); }
      R(181, 96, 5, 6, 'k'); P(183, 98, 'p'); R(160, 99, 12, 3, 'k'); R(160, 99, 12, 1, 'l');
      R(158, 64, 24, 6, 'k'); R(159, 65, 22, 4, 'p'); R(162, 66, 16, 1, 'm');
      PO([146, 140, 194, 140, 196, 144, 144, 144], 'l');
      // red fire sand bucket by the tower door
      EL(137, 141, 8, 1, D('k', 8));
      L(130, 124, 132, 116, 'k'); L(132, 116, 142, 116, 'k'); L(142, 116, 144, 124, 'k');
      PO([129, 124, 145, 124, 143, 141, 131, 141], 'r', 'k');
      R(139, 125, 4, 16, 'r2'); R(130, 124, 15, 2, 'k'); R(131, 124, 13, 1, 'l');
      R(133, 130, 8, 4, 'w'); R(134, 131, 2, 2, 'k'); R(137, 131, 3, 1, 'k'); R(137, 133, 3, 1, 'k');
      R(131, 126, 12, 1, D('p', 10));
      if (fl.weapon_at === 'hall' && !fl.weapon_taken) weaponStick(fl.weapon, 137, 126);
      // wall lamp bracket
      R(208, 72, 6, 3, 'k'); R(209, 62, 4, 10, 'k'); R(210, 63, 2, 8, 'y');
      // stairs going up to the right
      var sx = 226;
      PO([sx, 142, sx + 6, 142, W, 34, W, 142], 'd');
      for (i = 0; i < 12; i++) {
        var stx = sx + 6 + i * 8, sty = 142 - i * 9;
        R(stx, sty - 9, W - stx, 9, i % 2 ? 'm' : 'b');
        R(stx, sty - 9, W - stx, 1, 'p'); R(stx, sty - 1, W - stx, 1, 'k');
      }
      DR(sx + 30, 34, W - sx - 30, 108, 'k', 4);
      // banister
      L(sx + 2, 108, W, 6, 'k'); L(sx + 2, 107, W, 5, 'l'); L(sx + 2, 109, W, 7, 'k');
      for (i = 0; i < 12; i++) { var bx = sx + 4 + i * 8; var by = 108 - i * 9.2; R(bx, by + 2, 2, 142 - i * 9 - by - 11, 'k'); R(bx, by + 2, 1, 142 - i * 9 - by - 11, 'm'); }
      R(sx, 100, 5, 42, 'k'); R(sx + 1, 100, 1, 42, 'l'); R(sx - 1, 96, 7, 4, 'k'); R(sx, 96, 5, 1, 'p');
      // runner rug
      PO([20, 168, 300, 168, 288, 152, 32, 152], 'm'); R(32, 153, 256, 1, 'l'); R(24, 165, 272, 1, 'l');
      for (x = 40; x < 280; x += 8) P(x, 160, 'b');
    }],
    ['a', function (t) {
      // pendulum
      var a = Math.sin(t * 3.14) * 0.22;
      var px = 112 + Math.sin(a) * 36, py = 72 + Math.cos(a) * 36;
      L(112, 72, px, py, 'k'); EL(px, py, 3, 3, 'l'); P(px - 1, py - 1, 'w');
      // wall lamp glow
      var fl = 0.7 + 0.3 * Math.sin(t * 5.3) * Math.sin(t * 2.1);
      glow(211, 66, 22, 'y', 1 + rd(fl));
      R(210, 63, 2, 8, 'y'); P(210, 64, 'w');
    }],
    ['p'],
    ['a', function () { vignette(1); }]
  ] };
  HS.hall = { bucket: [127, 108, 20, 36], phone: [56, 90, 32, 50], clock: [96, 28, 32, 112], coatrack: [10, 34, 40, 108], towerdoor: [144, 50, 52, 94], stairs: [226, 24, 94, 120] };

  /* ---------------- lounge ---------------- */
  SC.lounge = { L: [
    ['s', function () {
      interior({ floorY: 138, wall: 'm' });
      cornerShadow();
      winBack(102, 26, 68, 66);
    }],
    ['a', function (t) { winGlass(t, 102, 26, 68, 66, 21); }],
    ['s', function (fl) {
      winFront(102, 26, 68, 66, { bars: 1 });
      // painting
      R(196, 34, 30, 22, 'k'); R(198, 36, 26, 18, 'd'); POLY([198, 54, 206, 44, 212, 48, 224, 40, 224, 54], 'm'); R(198, 36, 26, 1, 'l');
      // stove + pipe
      R(30, 14, 6, 62, 'k'); R(31, 14, 1, 62, 'm'); R(28, 40, 10, 3, 'k');
      PO([16, 76, 50, 76, 54, 82, 12, 82], 'k'); R(14, 82, 38, 4, 'm'); R(14, 82, 38, 1, 'l');
      R(16, 86, 34, 40, 'k'); R(18, 88, 30, 36, 'd'); R(18, 88, 1, 36, 'm');
      R(23, 96, 20, 16, 'k');
      R(16, 126, 34, 4, 'k'); R(18, 130, 3, 8, 'k'); R(45, 130, 3, 8, 'k');
      PO([8, 138, 58, 138, 62, 144, 4, 144], 'm'); R(8, 138, 50, 1, 'l');
      // wood pile
      for (var i = 0; i < 4; i++) { EL(62 + (i % 2) * 6, 132 - ((i / 2) | 0) * 5, 3, 2, 'd'); ELO(62 + (i % 2) * 6, 132 - ((i / 2) | 0) * 5, 3, 2, 'k'); P(62 + (i % 2) * 6, 132 - ((i / 2) | 0) * 5, 'l'); }
      // sofa
      PO([66, 112, 70, 102, 150, 102, 154, 112], 'd', 'k');
      R(66, 112, 88, 18, 'm'); R(66, 112, 88, 1, 'l');
      R(62, 108, 10, 24, 'd'); R(148, 108, 10, 24, 'd'); R(62, 108, 10, 1, 'l'); R(148, 108, 10, 1, 'l');
      R(110, 113, 1, 17, 'd'); R(72, 118, 76, 1, 'd');
      R(64, 130, 92, 3, 'k'); R(66, 133, 3, 6, 'k'); R(151, 133, 3, 6, 'k');
      PO([76, 106, 88, 104, 90, 113, 78, 114], 'p', 'k');
      // low table with shogi
      R(158, 140, 46, 3, 'l'); R(158, 140, 46, 1, 'p'); R(160, 143, 3, 8, 'k'); R(199, 143, 3, 8, 'k'); R(158, 143, 46, 1, 'k');
      PO([164, 140, 166, 128, 196, 128, 198, 140], 'p', 'k');
      for (i = 1; i < 5; i++) { L(164 + i * 6.8, 140, 166 + i * 6, 128, 'l'); }
      for (i = 1; i < 4; i++) { var yy = 128 + i * 3; R(166 - i * 0.5, yy, 30 + i, 1, 'l'); }
      var pcs = [[168, 130], [174, 131], [186, 129], [190, 134], [172, 137], [180, 135], [192, 138], [178, 131]];
      for (i = 0; i < pcs.length; i++) { R(pcs[i][0], pcs[i][1], 3, 2, 'k'); P(pcs[i][0] + 1, pcs[i][1], i % 3 ? 'w' : 'l'); }
      R(162, 152, 8, 2, 'k'); P(203, 136, 'w');
      // record player cabinet
      R(200, 106, 44, 26, 'k'); R(202, 108, 40, 22, 'd'); R(202, 108, 40, 1, 'm'); R(221, 108, 1, 22, 'k');
      R(206, 132, 3, 6, 'k'); R(235, 132, 3, 6, 'k');
      R(200, 100, 44, 6, 'm'); R(200, 100, 44, 1, 'l');
      PO([200, 100, 204, 84, 240, 84, 244, 100], D('p', 4)); L(204, 84, 240, 84, 'l'); L(200, 100, 204, 84, 'l'); L(240, 84, 244, 100, 'l');
      EL(216, 102, 12, 2, 'k'); P(216, 102, 'p');
      L(236, 100, 228, 103, 'p'); R(236, 99, 3, 2, 'l');
      // records
      for (i = 0; i < 6; i++) R(204 + i * 3, 112, 2, 16, i % 2 ? 'l' : 'p');
      // bookshelf
      R(258, 20, 54, 120, 'k'); R(260, 22, 50, 116, 'd');
      for (var s = 0; s < 5; s++) {
        var sy = 24 + s * 23;
        R(260, sy + 20, 50, 3, 'm'); R(260, sy + 20, 50, 1, 'l');
        var x = 262;
        while (x < 306) {
          var bw = 3 + ((hs(s * 17 + x) * 4) | 0), bh = 12 + ((hs(x * 3 + s) * 7) | 0);
          var bc = ['l', 'm', 'b', 'p', 'd'][(hs(x + s * 7) * 5) | 0];
          if (hs(x * 1.3 + s) > 0.9) { PO([x, sy + 20, x + 2, sy + 20 - bh, x + 2 + bw, sy + 20 - bh + 1, x + bw, sy + 20], bc, 'k'); x += bw + 3; continue; }
          R(x, sy + 20 - bh, bw, bh, bc); R(x, sy + 20 - bh, 1, bh, sh(bc, 1)); R(x + bw - 1, sy + 20 - bh, 1, bh, 'k');
          if (bh > 14) R(x, sy + 22 - bh, bw, 1, 'k');
          x += bw;
        }
      }
      R(258, 20, 54, 2, 'm');
      // rug
      EL(150, 158, 90, 12, 'm'); ELO(150, 158, 90, 12, 'l'); ELO(150, 158, 82, 10, 'b');
    }],
    ['a', function (t, fl) {
      if (!fl.stove_out) {
        var f1 = Math.sin(t * 11) * Math.sin(t * 5.7 + 2), f2 = Math.sin(t * 8.3 + 1);
        R(24, 97, 18, 14, 'k');
        R(25, 104 - rd(f1), 16, 7 + rd(f1), 'r2');
        for (var i = 0; i < 5; i++) {
          var h = 5 + rd((Math.sin(t * 9 + i * 1.7) + 1) * 2.5);
          R(26 + i * 3, 111 - h, 2, h, 'y');
          P(26 + i * 3, 111 - h - 1, 'w');
        }
        R(25, 108, 16, 3, 'y'); R(28, 109, 10, 2, 'w');
        glow(33, 112, 34 + f2 * 3, 'y', 1);
        EL(33, 141, 22, 3, D('y', 3));
        for (i = 0; i < 4; i++) R(24, 98 + i * 4, 18, 1, 'k');
      } else {
        R(24, 97, 18, 14, 'k');
        for (i = 0; i < 4; i++) R(26 + i * 4, 106 + (i % 2), 3, 2, 'd');
        P(30, 107, 'm'); P(35, 106, 'm');
        for (i = 0; i < 4; i++) R(24, 98 + i * 4, 18, 1, 'k');
      }
      // turntable spin highlight
      var a = t * 3.5;
      P(216 + rd(Math.cos(a) * 9), 102 + rd(Math.sin(a) * 1.5), 'l');
    }],
    ['p'],
    ['a', function () { vignette(1); }]
  ] };
  HS.lounge = { stove: [8, 30, 56, 114], shogi: [158, 124, 46, 32], sofa: [60, 98, 98, 42], record: [198, 82, 48, 56], bookshelf: [256, 18, 58, 124], window: [94, 18, 84, 78] };

  /* ---------------- study ---------------- */
  SC.study = { L: [
    ['s', function () {
      interior({ floorY: 140, wall: 'm', stripe: 6 });
      cornerShadow();
      winBack(18, 26, 42, 64);
    }],
    ['a', function (t) { winGlass(t, 18, 26, 42, 64, 31); }],
    ['s', function () {
      winFront(18, 26, 42, 64, { bars: 2, curtain: 'b' });
      // framed photo of a fishing ship
      R(74, 28, 48, 36, 'k'); R(76, 30, 44, 32, 'l'); R(76, 30, 44, 1, 'p');
      R(79, 33, 38, 26, 'p'); DR(79, 33, 38, 26, 'l', 4);
      R(79, 50, 38, 9, 'l'); R(79, 50, 38, 1, 'm');
      PO([84, 48, 112, 48, 108, 53, 87, 53], 'd'); R(94, 40, 2, 8, 'd'); R(102, 36, 1, 12, 'd'); L(96, 40, 102, 36, 'd'); R(90, 43, 4, 5, 'm'); L(102, 36, 110, 48, 'm');
      R(96, 64, 4, 1, 'k'); L(98, 24, 86, 28, 'k'); L(98, 24, 110, 28, 'k');
      // barometer
      R(137, 30, 2, 6, 'k'); EL(138, 46, 10, 10, 'k'); EL(138, 46, 9, 9, 'l'); EL(138, 46, 7, 7, 'p'); ELO(138, 46, 9, 9, 'm');
      for (var i = 0; i < 9; i++) { var a = Math.PI * (0.8 + i * 0.175); P(138 + Math.cos(a) * 6, 46 + Math.sin(a) * 6, 'k'); }
      L(138, 46, 134, 42, 'k'); P(138, 46, 'k'); P(135, 42, 'w');
      // shelf of scrapbooks
      R(234, 18, 80, 122, 'k'); R(236, 20, 76, 118, 'd');
      for (var s = 0; s < 4; s++) {
        var sy = 22 + s * 29;
        R(236, sy + 26, 76, 3, 'm'); R(236, sy + 26, 76, 1, 'l');
        var x = 238;
        while (x < 308) {
          var bw = 5 + ((hs(s * 7 + x) * 4) | 0), bh = 18 + ((hs(x + s) * 6) | 0);
          var c = hs(x * 2.1 + s) > 0.5 ? 'l' : 'b';
          if (s === 2 && x > 270 && x < 290) { // stacked newspapers lying flat
            for (var k = 0; k < 5; k++) { R(x, sy + 24 - k * 3, 22, 3, k % 2 ? 'p' : 'l'); R(x, sy + 24 - k * 3, 22, 1, 'w'); }
            x += 24; continue;
          }
          R(x, sy + 26 - bh, bw, bh, c); R(x, sy + 26 - bh, 1, bh, sh(c, 1)); R(x + bw - 1, sy + 26 - bh, 1, bh, 'k');
          R(x + 1, sy + 30 - bh, bw - 2, 2, 'k'); R(x + 1, sy + 20, bw - 2, 1, 'm');
          x += bw;
        }
      }
      // desk chair behind desk
      R(152, 84, 26, 18, 'k'); R(154, 86, 22, 14, 'd'); R(154, 86, 22, 1, 'm');
      // desk
      R(104, 100, 116, 5, 'l'); R(104, 100, 116, 1, 'p'); R(104, 105, 116, 2, 'k');
      R(108, 107, 34, 38, 'k'); R(110, 109, 30, 34, 'd');
      R(182, 107, 34, 38, 'k'); R(184, 109, 30, 34, 'd');
      R(142, 107, 40, 10, 'k'); R(144, 108, 36, 7, 'd'); R(160, 111, 4, 1, 'l');
      for (i = 0; i < 3; i++) {
        R(111, 110 + i * 11, 28, 10, 'm'); R(111, 110 + i * 11, 28, 1, 'l'); R(123, 114 + i * 11, 4, 1, 'p');
        R(185, 110 + i * 11, 28, 10, 'm'); R(185, 110 + i * 11, 28, 1, 'l');
        if (i) R(197, 114 + i * 11, 4, 1, 'p');
      }
      // the locked drawer: keyhole
      R(196, 112, 6, 5, 'p'); P(198, 113, 'k'); R(198, 114, 1, 2, 'k'); R(197, 112, 4, 1, 'w');
      R(104, 145, 116, 2, 'k');
      // desk lamp
      R(112, 98, 10, 2, 'k'); R(116, 86, 2, 12, 'k'); PO([110, 88, 114, 80, 122, 80, 126, 88], 'd', 'k'); R(113, 88, 10, 1, 'y');
      // papers
      for (i = 0; i < 6; i++) { R(138 + (i % 2), 98 - i * 2, 30, 2, i % 2 ? 'p' : 'w'); }
      R(138, 88, 30, 1, 'k'); R(140, 90, 18, 1, 'l'); R(140, 92, 22, 1, 'l');
      PO([150, 86, 168, 84, 170, 87, 152, 89], 'w', 'p');
      // ink + pen
      R(204, 94, 6, 6, 'k'); R(205, 93, 4, 1, 'm'); L(198, 99, 212, 95, 'k');
      // ledger open
      R(176, 96, 22, 4, 'w'); R(186, 96, 1, 4, 'l');
    }],
    ['a', function (t) {
      var fl = 0.7 + 0.3 * Math.sin(t * 4.7) * Math.sin(t * 2.3);
      EL(118, 100, 14, 3, D('y', 2 + rd(fl * 2)));
      DR(110, 89, 16, 10, 'y', 1);
    }],
    ['p'],
    ['a', function () { vignette(1); }]
  ] };
  HS.study = { desk: [104, 98, 78, 50], drawer: [182, 106, 36, 18], scrapbook: [232, 16, 82, 126], photo: [72, 22, 52, 44], papers: [134, 82, 38, 18], window: [6, 18, 66, 82] };

  /* ---------------- corridor2 ---------------- */
  var CV = { x0: 128, x1: 192, y0: 52, y1: 112 };
  function cyc(x) { return CV.y0 * x / CV.x0; }
  function cyf(x) { return H - (H - CV.y1) * x / CV.x0; }
  function doorPts(xa, xb, side) {
    var f = function (x) { return side > 0 ? W - x : x; };
    var ta = cyf(xa) - 0.66 * (cyf(xa) - cyc(xa)), tb = cyf(xb) - 0.66 * (cyf(xb) - cyc(xb));
    return [f(xa), ta, f(xb), tb, f(xb), cyf(xb) - 1, f(xa), cyf(xa) - 1];
  }
  function bbox(pts, pad) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (var i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    return [rd(x0 - pad), rd(y0 - pad), rd(x1 - x0 + pad * 2), rd(y1 - y0 + pad * 2)];
  }
  var DOORS = { door3: doorPts(24, 60, -1), door4: doorPts(88, 108, -1), door5: doorPts(58, 92, 1) };
  function drawDoor(pts, num, side) {
    PO(pts, 'k');
    var inset = []; var cx = 0, cy = 0, i;
    for (i = 0; i < 8; i += 2) { cx += pts[i] / 4; cy += pts[i + 1] / 4; }
    for (i = 0; i < 8; i += 2) inset.push(cx + (pts[i] - cx) * 0.86, cy + (pts[i + 1] - cy) * 0.93);
    POLY(inset, 'd');
    var in2 = []; for (i = 0; i < 8; i += 2) in2.push(cx + (inset[i] - cx) * 0.7, cy + (inset[i + 1] - cy) * 0.75 - 4);
    PO(in2, 'm', 'k');
    L(inset[0], inset[1], inset[2], inset[3], 'l');
    // knob
    var kx = side < 0 ? inset[2] - 3 : inset[2] + 3, ky = (inset[3] + inset[5]) / 2 + 4;
    R(kx - 1, ky, 3, 2, 'p'); P(kx - 1, ky, 'w');
    // plate
    var pw = Math.abs(inset[2] - inset[0]) * 0.36, px = cx - pw / 2, py = cy - (cy - inset[1]) * 0.55;
    R(px - 1, py - 1, Math.max(7, pw) + 2, 9, 'k'); R(px, py, Math.max(7, pw), 7, 'p'); R(px, py, Math.max(7, pw), 1, 'w');
    TXT(num, rd(px + Math.max(7, pw) / 2 - 1), rd(py + 1), 'k');
  }
  SC.corridor2 = { L: [
    ['s', function () {
      R(0, 0, W, H, 'm');
      // ceiling
      POLY([0, 0, W, 0, CV.x1, CV.y0, CV.x0, CV.y0], 'd'); DR(0, 0, W, 20, 'k', 8);
      for (var i = 1; i < 6; i++) { var t = i / 6; var y = CV.y0 * t * t; L(CV.x0 * t * t, y, W - CV.x0 * t * t, y, 'k'); }
      // walls with wallpaper stripes converging
      POLY([0, 0, CV.x0, CV.y0, CV.x0, CV.y1, 0, H], 'm');
      POLY([W, 0, CV.x1, CV.y0, CV.x1, CV.y1, W, H], 'b');
      for (i = 0; i < 18; i++) {
        var x = CV.x0 * (1 - Math.pow(1 - i / 18, 1.8));
        L(x, cyc(x) + 2, x, cyf(x) - 2, D('d', 8));
        L(W - x, cyc(x) + 2, W - x, cyf(x) - 2, D('m', 8));
      }
      // wainscot lines
      var wl = function (x, f) { return cyf(x) - (cyf(x) - cyc(x)) * f; };
      POLY([0, wl(0, 0.3), CV.x0, wl(CV.x0, 0.3), CV.x0, CV.y1, 0, H], 'd');
      POLY([W, wl(0, 0.3), CV.x1, wl(CV.x0, 0.3), CV.x1, CV.y1, W, H], 'm');
      L(0, wl(0, 0.3), CV.x0, wl(CV.x0, 0.3), 'k'); L(W, wl(0, 0.3), CV.x1, wl(CV.x0, 0.3), 'k');
      L(0, wl(0, 0.3) + 1, CV.x0, wl(CV.x0, 0.3) + 1, 'l'); L(W, wl(0, 0.3) + 1, CV.x1, wl(CV.x0, 0.3) + 1, 'p');
      // end wall
      R(CV.x0, CV.y0, CV.x1 - CV.x0, CV.y1 - CV.y0, 'd');
      R(CV.x0, CV.y1 - 18, CV.x1 - CV.x0, 18, 'k'); R(CV.x0, CV.y1 - 18, CV.x1 - CV.x0, 1, 'm');
      // floor
      POLY([0, H, CV.x0, CV.y1, CV.x1, CV.y1, W, H], 'd');
      for (i = 0; i < 16; i++) { var fx = -200 + i * 48; L(fx, H, 160 + (fx - 160) * 0.2, CV.y1, D('k', 10)); }
      // runner carpet
      POLY([96, H, 146, CV.y1, 174, CV.y1, 224, H], 'm');
      L(96, H, 146, CV.y1, 'l'); L(224, H, 174, CV.y1, 'l');
      L(104, H, 148, CV.y1, 'b'); L(216, H, 172, CV.y1, 'b');
      for (i = 0; i < 8; i++) { var yy = CV.y1 + (H - CV.y1) * Math.pow(i / 8, 1.7); var hw = 14 + (yy - CV.y1) * 0.94; R(160 - hw * 0.6, yy, hw * 1.2, 1, D('b', 8)); }
      // corner edges
      L(0, 0, CV.x0, CV.y0, 'k'); L(W, 0, CV.x1, CV.y0, 'k'); L(0, H, CV.x0, CV.y1, 'k'); L(W, H, CV.x1, CV.y1, 'k');
      L(CV.x0, CV.y0, CV.x0, CV.y1, 'k'); L(CV.x1, CV.y0, CV.x1, CV.y1, 'k');
      // end window recess
      R(146, 58, 28, 36, 'k');
      DR(0, 0, CV.x0 * 0.5, H, 'k', 2);
    }],
    ['a', function (t) { winGlass(t, 148, 60, 24, 32, 41); }],
    ['s', function () {
      R(159, 60, 2, 32, 'm'); R(148, 75, 24, 2, 'm'); R(144, 92, 32, 3, 'l'); R(144, 92, 32, 1, 'p');
      R(144, 56, 32, 2, 'm');
      drawDoor(DOORS.door3, '3', -1);
      drawDoor(DOORS.door4, '4', -1);
      drawDoor(DOORS.door5, '5', 1);
      // sconces (brackets)
      var sc = [[74, 62, 5], [116, 64, 3], [262, 58, 5], [204, 64, 3]];
      for (var i = 0; i < sc.length; i++) {
        var s = sc[i]; R(s[0] - 1, s[1], 3, s[2] + 2, 'k'); R(s[0] - s[2], s[1] + s[2] + 1, s[2] * 2 + 1, 2, 'k');
        R(s[0], s[1] - s[2], 1, s[2], 'y');
      }
      // small console table + vase on right wall near
      PO([300, 112, 320, 108, 320, 118, 300, 120], 'l', 'k'); R(304, 120, 2, 18, 'k'); R(316, 118, 2, 22, 'k');
      R(308, 100, 5, 9, 'p'); R(308, 100, 1, 9, 'w'); L(310, 100, 306, 92, 'm'); L(311, 100, 314, 90, 'm');
    }],
    ['a', function (t) {
      var sc = [[74, 62, 5], [116, 64, 3], [262, 58, 5], [204, 64, 3]];
      for (var i = 0; i < sc.length; i++) {
        var s = sc[i], fl = 0.7 + 0.3 * Math.sin(t * 5 + i * 2.1) * Math.sin(t * 2.3 + i);
        glow(s[0], s[1] - s[2] + 2, s[2] * 4 + fl * 2, 'y', 1 + rd(fl));
        R(s[0], s[1] - s[2], 1, s[2], 'y'); P(s[0], s[1] - s[2], 'w');
      }
    }],
    ['p'],
    ['a', function () { vignette(1); }]
  ] };
  HS.corridor2 = { door3: bbox(DOORS.door3, 2), door4: bbox(DOORS.door4, 2), door5: bbox(DOORS.door5, 2), endwindow: [140, 52, 40, 46] };

  /* ---------------- guest rooms common ---------------- */
  function bed(x, y, w, side) { // side: -1 headboard on left
    var hx = side < 0 ? x : x + w - 8;
    R(hx, y - 22, 8, 46, 'k'); R(hx + 1, y - 21, 6, 44, 'd'); R(hx + 1, y - 21, 6, 1, 'l');
    EL(hx + 4, y - 22, 4, 2, 'k');
    var bx = side < 0 ? x + 8 : x;
    R(bx, y, w - 8, 18, 'k'); R(bx, y, w - 8, 14, 'p'); R(bx, y, w - 8, 2, 'w');
    for (var i = 0; i < 4; i++) L(bx + 10 + i * 18, y + 3, bx + 4 + i * 18, y + 13, 'l');
    R(bx, y + 14, w - 8, 4, 'l'); DR(bx, y + 14, w - 8, 4, 'm', 8);
    var px = side < 0 ? bx + 2 : bx + w - 28;
    EL(px + 10, y - 1, 10, 4, 'k'); EL(px + 10, y - 2, 9, 3, 'w'); R(px + 3, y - 1, 14, 1, 'p');
    var fx = side < 0 ? bx + 26 : bx + w - 40;
    R(fx, y + 1, 4, 13, 'l'); R(fx, y + 1, 1, 13, 'w');
    R(side < 0 ? x + w - 2 : x, y + 2, 2, 22, 'k');
    R(bx, y + 18, 3, 6, 'k'); R(bx + w - 11, y + 18, 3, 6, 'k');
  }
  function smallDesk(x, y, w) {
    R(x, y, w, 4, 'l'); R(x, y, w, 1, 'p'); R(x, y + 4, w, 2, 'k');
    R(x + 2, y + 6, 3, 34, 'k'); R(x + w - 5, y + 6, 3, 34, 'k'); R(x + 3, y + 6, 1, 32, 'm');
    R(x + 6, y + 6, w - 12, 8, 'd'); R(x + 6, y + 6, w - 12, 1, 'm'); R(x + w / 2 - 2, y + 9, 4, 1, 'p');
  }
  function chair(x, y, c) {
    c = c || 'd';
    R(x, y - 26, 4, 46, 'k'); R(x + 1, y - 25, 2, 24, 'm');
    R(x, y, 28, 4, 'k'); R(x + 1, y, 26, 2, c); R(x + 1, y, 26, 1, 'l');
    R(x + 24, y + 4, 3, 16, 'k'); R(x + 2, y + 4, 3, 16, 'k');
  }

  /* ---------------- occupation rooms (room3/4/5) ---------------- */
  function sideTable(x0, x1, ty, fy) {
    R(x0, ty, x1 - x0, 3, 'l'); R(x0, ty, x1 - x0, 1, 'p'); R(x0, ty + 3, x1 - x0, 1, 'k');
    R(x0 + 2, ty + 4, 2, fy - ty - 4, 'k'); R(x1 - 4, ty + 4, 2, fy - ty - 4, 'k'); R(x0 + 4, fy - 8, x1 - x0 - 8, 1, 'k');
  }
  function drawItem(occ, x, y, w, h) {
    var cx = rd(x + w / 2), fy = y + h - 2, i;
    if (occ === 'painter') {
      var top = y + 4, ch = Math.min(38, rd(h * 0.46)), cw = Math.min(34, w - 10);
      L(cx - 13, fy, cx - 3, top, 'k'); L(cx - 12, fy, cx - 2, top, 'k');
      L(cx + 13, fy, cx + 3, top, 'k'); L(cx + 12, fy, cx + 2, top, 'k'); L(cx, fy - 2, cx, top + ch, 'k');
      var cy = top + 4, x0 = cx - (cw >> 1);
      R(x0 - 2, cy - 2, cw + 4, ch + 4, 'k'); R(x0, cy, cw, ch, 'w');
      R(x0, cy, cw, rd(ch * 0.55), 'l'); DR(x0, cy, cw, rd(ch * 0.3), 'm', 6);
      R(x0, cy + rd(ch * 0.55), cw, ch - rd(ch * 0.55), 'm');
      POLY([x0, cy + ch * 0.7, x0 + cw * 0.45, cy + ch * 0.6, x0 + cw, cy + ch * 0.66, x0 + cw, cy + ch, x0, cy + ch], 'd');
      var lx = x0 + rd(cw * 0.42);
      R(lx, cy + rd(ch * 0.25), 4, rd(ch * 0.4), 'w'); R(lx - 1, cy + rd(ch * 0.2), 6, 2, 'k'); R(lx, cy + rd(ch * 0.14), 4, 3, 'p');
      L(lx + 5, cy + rd(ch * 0.18), x0 + cw - 1, cy + rd(ch * 0.1), D('p', 10));
      R(cx - 18, cy + ch + 2, 36, 2, 'k'); R(cx - 18, cy + ch + 2, 36, 1, 'l');
      // paint box on the floor
      var bx = x + w - 16;
      R(bx, fy - 6, 15, 6, 'k'); R(bx + 1, fy - 5, 13, 4, 'm');
      R(bx + 2, fy - 5, 2, 2, 'w'); R(bx + 5, fy - 5, 2, 2, 'p'); R(bx + 8, fy - 5, 2, 2, 'l'); R(bx + 11, fy - 5, 2, 2, 'd');
      PO([bx, fy - 6, bx + 2, fy - 12, bx + 15, fy - 12, bx + 15, fy - 6], 'd', 'k');
      L(bx - 6, fy - 1, bx - 1, fy - 3, 'l');
    } else if (occ === 'developer') {
      // briefcase standing + papers and a rolled plan
      var bw = 32, bh = 22, bx2 = cx - 18, by = fy - bh;
      R(bx2, by, bw, bh, 'k'); R(bx2 + 2, by + 2, bw - 4, bh - 3, 'm'); R(bx2 + 2, by + 2, bw - 4, 2, 'l'); R(bx2 + 2, by + 4, bw - 4, 1, 'p');
      R(bx2 + 10, by - 5, 12, 2, 'k'); R(bx2 + 10, by - 5, 2, 6, 'k'); R(bx2 + 20, by - 5, 2, 6, 'k');
      R(bx2 + 5, by + 6, 3, 3, 'p'); R(bx2 + bw - 8, by + 6, 3, 3, 'p'); P(bx2 + 5, by + 6, 'w');
      R(bx2 + 2, by + 13, bw - 4, 1, 'k');
      for (i = 0; i < 5; i++) { R(cx + 15, fy - 2 - i * 2, 12, 2, i % 2 ? 'p' : 'w'); }
      R(cx + 15, fy - 10, 12, 1, 'k'); R(cx + 17, fy - 7, 8, 1, 'l');
      PO([bx2 - 2, fy - 2, bx2 + 4, fy - 30, bx2 + 8, fy - 30, bx2 + 4, fy - 2], 'w', 'k');
      L(bx2 + 4, fy - 26, bx2 + 2, fy - 8, 'l'); R(bx2 + 3, fy - 31, 5, 2, 'p');
    } else if (occ === 'writer') {
      var ty = fy - 24;
      sideTable(x + 4, x + w - 4, ty, fy);
      // typewriter
      PO([cx - 13, ty, cx - 11, ty - 9, cx + 11, ty - 9, cx + 13, ty], 'k');
      R(cx - 10, ty - 8, 20, 6, 'm'); R(cx - 10, ty - 8, 20, 1, 'l');
      for (i = 0; i < 9; i++) { P(cx - 9 + i * 2, ty - 5, 'p'); P(cx - 8 + i * 2, ty - 3, 'l'); }
      R(cx - 13, ty - 12, 26, 3, 'k'); R(cx - 12, ty - 11, 24, 1, 'd'); R(cx - 15, ty - 12, 2, 3, 'p'); R(cx + 13, ty - 12, 2, 3, 'p');
      R(cx - 7, ty - 22, 14, 10, 'w'); R(cx - 5, ty - 19, 10, 1, 'l'); R(cx - 5, ty - 17, 8, 1, 'l'); R(cx - 5, ty - 15, 9, 1, 'l');
      L(cx + 12, ty - 12, cx + 16, ty - 15, 'p');
      // manuscript stack
      for (i = 0; i < 7; i++) R(x + 6, ty - 1 - i, 11, 1, i % 2 ? 'p' : 'w');
      R(x + 6, ty - 8, 11, 1, 'k');
      // crumpled pages on the floor
      EL(x + w - 10, fy - 2, 3, 2, 'w'); P(x + w - 11, fy - 3, 'l'); EL(x + 9, fy - 1, 2, 1, 'p');
    } else if (occ === 'reporter') {
      var ty2 = fy - 22;
      sideTable(x + 6, x + w - 6, ty2, fy);
      // camera with strap hanging over the edge
      R(cx - 9, ty2 - 9, 16, 9, 'k'); R(cx - 8, ty2 - 8, 14, 7, 'd'); R(cx - 8, ty2 - 8, 14, 1, 'l');
      R(cx - 6, ty2 - 11, 6, 3, 'k'); P(cx + 4, ty2 - 10, 'p');
      EL(cx - 1, ty2 - 4, 3, 3, 'k'); ELO(cx - 1, ty2 - 4, 3, 3, 'm'); P(cx - 2, ty2 - 5, 'w');
      L(cx - 9, ty2 - 6, cx - 13, ty2 + 8, 'd'); L(cx - 13, ty2 + 8, cx - 8, ty2 + 12, 'd'); L(cx - 8, ty2 + 12, cx - 6, ty2 + 3, 'd');
      // notebook + pencil
      R(cx + 9, ty2 - 3, 9, 3, 'k'); R(cx + 10, ty2 - 3, 7, 2, 'p'); R(cx + 10, ty2 - 3, 7, 1, 'w');
      L(cx + 9, ty2 - 5, cx + 17, ty2 - 6, 'l');
      // newspapers on the floor
      for (i = 0; i < 4; i++) { R(x + 2 + (i % 2) * 2, fy - 3 - i * 3, 22, 3, i % 2 ? 'l' : 'p'); R(x + 4 + (i % 2) * 2, fy - 2 - i * 3, 8, 1, 'k'); }
      PO([x + w - 22, fy, x + w - 18, fy - 6, x + w - 2, fy - 4, x + w - 6, fy + 1], 'w', 'l');
      R(x + w - 16, fy - 4, 6, 1, 'k'); R(x + w - 16, fy - 2, 8, 1, 'm');
    } else { // doctor (default): chair + leather medical bag
      var sy = fy - 20;
      chair(cx - 14, sy, 'd');
      PO([cx - 12, sy, cx - 10, sy - 12, cx + 12, sy - 12, cx + 14, sy], 'k');
      R(cx - 10, sy - 10, 20, 9, 'm'); R(cx - 10, sy - 10, 20, 1, 'p'); R(cx - 10, sy - 9, 1, 8, 'l'); R(cx - 10, sy - 6, 20, 1, 'k'); R(cx + 6, sy - 9, 3, 8, D('k', 8));
      R(cx - 4, sy - 16, 8, 2, 'k'); R(cx - 4, sy - 16, 2, 5, 'k'); R(cx + 2, sy - 16, 2, 5, 'k');
      R(cx - 1, sy - 5, 3, 2, 'p'); P(cx - 1, sy - 5, 'w');
      // stethoscope coiled on seat
      ELO(cx + 9, sy - 1, 3, 1, 'l');
    }
  }
  function travelBag(x, y, w, h) {
    var fy = y + h;
    R(x, fy - 16, w, 16, 'k'); R(x + 1, fy - 15, w - 2, 14, 'b'); R(x + 1, fy - 15, w - 2, 2, 'l'); R(x + 1, fy - 15, w - 2, 1, 'p'); R(x + 1, fy - 6, w - 2, 5, D('m', 10));
    R(x + 5, fy - 15, 2, 14, 'l'); R(x + w - 7, fy - 15, 2, 14, 'l');
    R(x + (w >> 1) - 5, fy - 19, 10, 2, 'k'); R(x + (w >> 1) - 5, fy - 19, 2, 4, 'k'); R(x + (w >> 1) + 3, fy - 19, 2, 4, 'k');
    R(x + 1, fy - 15, 2, 2, 'p'); R(x + w - 3, fy - 15, 2, 2, 'p'); R(x + 1, fy - 3, 2, 2, 'p'); R(x + w - 3, fy - 3, 2, 2, 'p');
    R(x + (w >> 1) - 1, fy - 9, 3, 2, 'p');
    EL(x + (w >> 1), fy, w >> 1, 1, D('k', 8));
  }
  function coatProp(type, x) {
    if (type === 'hook') {
      R(x - 1, 30, 2, 3, 'k'); L(x - 8, 38, x, 33, 'k'); L(x, 33, x + 8, 38, 'k'); R(x - 8, 38, 17, 1, 'k');
      PO([x - 10, 40, x - 6, 38, x + 6, 38, x + 11, 40, x + 14, 70, x + 8, 72, x + 7, 84, x - 7, 84, x - 8, 72, x - 14, 70], 'l', 'k');
      R(x - 1, 40, 2, 44, 'm'); for (var y = 44; y < 82; y += 3) { R(x - 6, y, 4, 1, 'm'); R(x + 2, y, 4, 1, 'm'); }
      R(x - 4, 50, 1, 1, 'p'); R(x - 4, 60, 1, 1, 'p'); R(x - 4, 70, 1, 1, 'p');
      DR(x - 10, 62, 22, 22, 'd', 4);
    } else if (type === 'stand') {
      R(x - 1, 40, 3, 100, 'k'); R(x, 40, 1, 100, 'l'); R(x - 7, 138, 15, 3, 'k');
      EL(x, 38, 3, 2, 'k'); L(x, 44, x - 7, 40, 'k'); L(x, 44, x + 7, 40, 'k');
      PO([x - 9, 46, x - 3, 44, x + 3, 44, x + 9, 46, x + 12, 76, x + 10, 104, x - 10, 104, x - 12, 76], 'm', 'k');
      L(x, 48, x, 104, 'd'); R(x - 9, 60, 2, 40, 'l'); L(x - 3, 46, x - 1, 60, 'l'); L(x + 3, 46, x + 1, 60, 'd');
      R(x - 8, 82, 16, 2, 'd');
      R(x - 7, 35, 14, 2, 'k'); R(x - 4, 31, 8, 4, 'd'); R(x - 4, 31, 8, 1, 'l');
    } else { // over a chair
      chair(x + 4, 118, 'd');
      PO([x - 4, 84, x + 10, 80, x + 26, 84, x + 34, 120, x + 40, 140, x + 24, 142, x + 20, 122, x + 8, 124, x + 2, 140, x - 8, 138, x - 2, 118], 'm', 'k');
      R(x + 8, 84, 2, 38, 'd'); R(x - 2, 92, 2, 40, 'l'); L(x + 12, 90, x + 18, 120, 'd');
      DR(x - 4, 112, 42, 30, 'k', 3);
      R(x + 12, 86, 8, 4, 'l'); R(x + 12, 86, 8, 1, 'p');
    }
  }
  function deskProp(kind, x, y, w) {
    if (kind === 'big') {
      R(x, y, w, 4, 'l'); R(x, y, w, 1, 'p'); R(x, y + 4, w, 2, 'k');
      R(x + 2, y + 6, 3, 36, 'k'); R(x + w - 5, y + 6, 3, 36, 'k'); R(x + w - 30, y + 6, 26, 20, 'k');
      R(x + w - 28, y + 8, 22, 7, 'd'); R(x + w - 28, y + 16, 22, 8, 'd'); R(x + w - 19, y + 11, 4, 1, 'p'); R(x + w - 19, y + 19, 4, 1, 'p');
      // ashtray, glass, lamp
      EL(x + 18, y - 2, 8, 2, 'k'); EL(x + 18, y - 3, 7, 1, 'l'); R(x + 14, y - 5, 3, 1, 'w'); R(x + 19, y - 5, 4, 1, 'w');
      R(x + 44, y - 8, 6, 8, 'k'); R(x + 45, y - 7, 4, 7, 'l'); R(x + 45, y - 4, 4, 4, 'p'); R(x + 45, y - 7, 1, 7, 'w');
      R(x + w - 18, y - 2, 10, 2, 'k'); R(x + w - 14, y - 14, 2, 12, 'k'); PO([x + w - 20, y - 12, x + w - 16, y - 20, x + w - 8, y - 20, x + w - 4, y - 12], 'd', 'k'); R(x + w - 17, y - 12, 10, 1, 'y');
      R(x + 26, y + 12, 22, 3, 'k'); R(x + 28, y + 15, 2, 26, 'k'); R(x + 44, y + 15, 2, 26, 'k');
    } else {
      smallDesk(x, y, w);
      R(x + 6, y - 2, 8, 2, 'k'); R(x + 9, y - 12, 2, 10, 'k'); PO([x + 4, y - 10, x + 7, y - 16, x + 13, y - 16, x + 16, y - 10], 'd', 'k'); R(x + 7, y - 10, 7, 1, 'y');
      R(x + w - 12, y - 6, 6, 6, 'k'); R(x + w - 11, y - 5, 4, 5, 'l'); R(x + w - 11, y - 5, 1, 5, 'w'); R(x + w - 6, y - 4, 2, 3, 'k');
      R(x + w / 2 - 6, y - 2, 12, 2, 'p'); R(x + w / 2 - 6, y - 2, 12, 1, 'w');
    }
  }
  var ROOMS = {
    room3: { wall: 'm', stripe: 5, win: [122, 26, 48, 56], curtain: 'l', bed: [8, 112, 98, -1], nightstand: 108, desk: ['small', 260, 100, 50], coat: ['hook', 194], bag: [122, 118, 36, 24], item: [204, 76, 52, 66] },
    room4: { wall: 'b', stripe: 5, win: [134, 26, 44, 56], curtain: 'p', bed: [246, 112, 70, 1], desk: ['small', 76, 100, 46], coat: ['chair', 194], bag: [148, 118, 38, 24], item: [14, 60, 56, 82] },
    room5: { wall: 'm', stripe: 7, win: [44, 26, 44, 54], curtain: 'd', bed: [206, 112, 108, 1], desk: ['big', 98, 98, 82], coat: ['stand', 192], bag: [70, 118, 24, 24], item: [12, 86, 56, 56] }
  };
  function makeRoom(id) {
    var c = ROOMS[id], wv = c.win;
    return { L: [
      ['s', function () { interior({ floorY: 140, wall: c.wall, stripe: c.stripe }); cornerShadow(); winBack(wv[0], wv[1], wv[2], wv[3]); }],
      ['a', function (t) { winGlass(t, wv[0], wv[1], wv[2], wv[3], wv[0] * 0.37); }],
      ['s', function (fl) {
        winFront(wv[0], wv[1], wv[2], wv[3], { bars: 1, curtain: c.curtain });
        if (fl.room_mark) { R(wv[0] + (wv[2] >> 1) + 6, wv[1] + wv[3] + 3, 2, 1, 'r2'); }
        bed(c.bed[0], c.bed[1], c.bed[2], c.bed[3]);
        if (c.nightstand) { R(c.nightstand, 118, 12, 22, 'k'); R(c.nightstand + 1, 119, 10, 20, 'd'); R(c.nightstand + 1, 119, 10, 1, 'l'); }
        deskProp(c.desk[0], c.desk[1], c.desk[2], c.desk[3]);
        coatProp(c.coat[0], c.coat[1]);
        travelBag(c.bag[0], c.bag[1], c.bag[2], c.bag[3]);
        var it = c.item; drawItem(fl.occ || ({ room3: 'doctor', room4: 'painter', room5: 'developer' })[id], it[0], it[1], it[2], it[3]);
      }],
      ['p'],
      ['a', function () { vignette(1); }]
    ] };
  }
  SC.room3 = makeRoom('room3');
  SC.room4 = makeRoom('room4');
  SC.room5 = makeRoom('room5');
  HS.room3 = { item: [204, 76, 52, 66], bag: [120, 112, 40, 30], coat: [178, 28, 34, 58], window: [110, 16, 72, 74], desk: [258, 86, 56, 56], bed: [6, 88, 104, 56] };
  HS.room4 = { item: [14, 60, 56, 82], bag: [146, 112, 42, 30], coat: [188, 76, 54, 68], window: [122, 16, 68, 74], desk: [74, 86, 50, 56], bed: [244, 88, 74, 58] };
  HS.room5 = { item: [12, 86, 56, 56], bag: [68, 112, 28, 30], coat: [180, 30, 26, 112], window: [32, 16, 68, 70], desk: [96, 76, 84, 66], bed: [204, 88, 112, 56] };

  /* ---------------- boiler room ---------------- */
  SC.boiler = { L: [
    ['s', function (fl) {
      R(0, 0, W, H, 'd');
      bricks(0, 0, W, 136, 'm', 'd', 14, 7, 9);
      DR(0, 0, W, 136, 'k', 6);
      R(0, 0, W, 10, 'k');
      // ceiling pipes
      R(0, 12, W, 5, 'k'); R(0, 13, W, 2, 'l'); R(0, 13, W, 1, 'p');
      for (var x = 20; x < W; x += 50) R(x, 11, 4, 7, 'k');
      R(0, 22, 110, 3, 'k'); R(0, 23, 110, 1, 'l');
      // floor concrete
      R(0, 136, W, 44, 'd'); R(0, 136, W, 1, 'k'); DR(0, 137, W, 43, 'm', 3); DR(0, 160, W, 20, 'k', 6);
      for (var i = 0; i < 6; i++) L(30 + i * 52, 136, 10 + i * 64, H, D('k', 8));
      // tool rack
      R(14, 38, 72, 58, 'k'); R(16, 40, 68, 54, 'm');
      for (var y = 44; y < 92; y += 6) for (x = 20; x < 82; x += 6) P(x, y, 'd');
      // wrench
      LT(24, 46, 24, 80, 'k', 3); R(23, 46, 3, 34, 'p'); PO([20, 42, 28, 42, 30, 48, 26, 48, 25, 45, 23, 45, 22, 48, 18, 48], 'p', 'k');
      // saw
      PO([34, 48, 48, 48, 48, 86, 38, 86], 'p', 'k'); for (y = 50; y < 86; y += 2) P(48, y, 'k');
      R(36, 42, 8, 7, 'd'); R(36, 42, 8, 1, 'l');
      // hammer
      R(58, 52, 3, 34, 'l'); R(54, 46, 12, 6, 'k'); R(55, 47, 10, 4, 'p'); R(55, 47, 10, 1, 'w');
      // pliers + coil rope
      L(70, 48, 74, 78, 'k'); L(76, 48, 72, 78, 'k'); ELO(76, 84, 6, 5, 'p'); ELO(76, 84, 4, 3, 'l');
      // shelf with paint cans
      R(18, 104, 64, 3, 'l'); R(18, 104, 64, 1, 'p'); R(20, 107, 2, 6, 'k'); R(78, 107, 2, 6, 'k');
      // boiler
      R(108, 28, 74, 108, 'k');
      R(110, 30, 70, 104, 'm');
      R(110, 30, 8, 104, 'l'); R(112, 30, 2, 104, 'p'); R(162, 30, 18, 104, 'd'); DR(150, 30, 12, 104, 'd', 8);
      EL(145, 30, 35, 6, 'k'); EL(145, 29, 33, 5, 'm'); R(120, 27, 30, 1, 'l');
      for (y = 40; y < 130; y += 18) { R(110, y, 70, 2, 'k'); for (x = 114; x < 178; x += 6) P(x, y - 2, 'p'); }
      // firebox door
      R(126, 98, 36, 26, 'k'); R(128, 100, 32, 22, 'd'); R(128, 100, 32, 1, 'l');
      R(132, 106, 24, 10, 'k');
      R(156, 108, 6, 3, 'p');
      // gauge
      EL(146, 62, 11, 11, 'k'); EL(146, 62, 9, 9, 'w'); ELO(146, 62, 10, 10, 'l');
      for (i = 0; i < 9; i++) { var a = Math.PI * (0.75 + i * 0.1875); P(146 + Math.cos(a) * 7, 62 + Math.sin(a) * 7, 'k'); }
      P(152, 58, 'r'); P(153, 59, 'r');
      // pipes rising
      R(118, 0, 6, 28, 'k'); R(119, 0, 2, 28, 'l'); R(166, 0, 8, 28, 'k'); R(167, 0, 2, 28, 'l');
      R(180, 50, 50, 5, 'k'); R(180, 51, 50, 2, 'l'); R(228, 18, 5, 37, 'k'); R(229, 18, 2, 37, 'l');
      EL(206, 52, 4, 5, 'k'); EL(206, 52, 2, 3, 'l'); R(205, 45, 3, 3, 'k');
      R(102, 132, 86, 4, 'k');
      // old faded photo pinned on wall
      R(248, 52, 24, 20, 'k'); R(249, 53, 22, 18, 'p'); R(251, 55, 18, 13, 'l');
      DR(251, 55, 18, 13, 'p', 6); R(251, 63, 18, 5, 'b');
      R(254, 57, 3, 6, 'm'); R(259, 56, 3, 7, 'm'); R(264, 58, 3, 5, 'm'); EL(255, 56, 1, 1, 'm'); EL(260, 55, 1, 1, 'm'); EL(265, 57, 1, 1, 'm');
      R(259, 50, 2, 3, 'k'); P(259, 50, 'r2');
      PO([268, 68, 272, 68, 272, 72], 'd');
      // cot
      R(222, 120, 92, 4, 'k'); R(224, 116, 88, 6, 'l'); R(224, 116, 88, 1, 'p');
      PO([240, 114, 300, 114, 304, 122, 236, 122], 'b', 'k'); for (x = 244; x < 300; x += 8) L(x, 115, x - 2, 121, 'm');
      EL(230, 114, 6, 3, 'p'); EL(230, 113, 5, 2, 'w');
      R(224, 124, 2, 14, 'k'); R(310, 124, 2, 14, 'k'); L(226, 124, 310, 136, 'k'); L(226, 136, 310, 124, 'k');
      // sake bottle (isshobin) + cup
      R(203, 120, 12, 18, 'k'); R(204, 122, 10, 16, 'd'); R(205, 122, 2, 16, 'l');
      R(206, 112, 6, 10, 'k'); R(207, 113, 3, 9, 'm'); R(206, 110, 6, 2, 'k');
      R(205, 126, 8, 7, 'p'); R(206, 128, 6, 1, 'k'); R(207, 130, 4, 1, 'k');
      R(217, 133, 5, 4, 'w'); R(217, 133, 5, 1, 'p');
      // bare bulb socket
      R(160, 10, 1, 8, 'k');
    }],
    ['a', function (t, fl) {
      // bare bulb glow
      var f = 0.7 + 0.3 * Math.sin(t * 13) * Math.sin(t * 3.7);
      if (Math.sin(t * 1.9) * Math.sin(t * 7.3) > 0.85) f = 0.1;
      glow(160, 22, 30 + f * 6, 'y', rd(1 + f));
      R(158, 18, 5, 6, f > 0.3 ? 'y' : 'p'); P(159, 19, 'w');
      // fire through firebox grate
      R(132, 106, 24, 10, 'k');
      for (var i = 0; i < 6; i++) { var h = 3 + rd((Math.sin(t * 10 + i * 2) + 1) * 2.5); R(133 + i * 4, 116 - h, 3, h, i % 2 ? 'y' : 'r2'); }
      for (i = 0; i < 4; i++) R(132, 107 + i * 2, 24, 1, 'k');
      DR(124, 124, 40, 12, 'y', 1);
      // gauge needle jitter
      EL(146, 62, 8, 8, 'w');
      for (i = 0; i < 9; i++) { var a = Math.PI * (0.75 + i * 0.1875); P(146 + Math.cos(a) * 7, 62 + Math.sin(a) * 7, 'k'); }
      var na = Math.PI * 1.55 + Math.sin(t * 6) * 0.05 + Math.sin(t * 17) * 0.02;
      L(146, 62, 146 + Math.cos(na) * 7, 62 + Math.sin(na) * 7, 'k'); R(145, 61, 3, 3, 'k');
      // dripping pipe
      var ph = (t * 0.6) % 1;
      P(206, 58 + ph * 78, 'p'); EL(206, 137, 3, 1, D('l', 6));
    }],
    ['s', function (fl) {
      // paint cans (foreground)
      var cans = [[30, 130, 0], [44, 128, 1], [58, 131, 0]];
      for (var i = 0; i < cans.length; i++) {
        var x = cans[i][0], y = cans[i][1];
        R(x, y, 12, 14, 'k'); R(x + 1, y + 1, 10, 13, 'l'); R(x + 1, y + 1, 2, 13, 'p');
        R(x + 2, y + 5, 8, 5, 'r'); R(x + 2, y + 5, 8, 1, 'r2'); R(x + 1, y + 1, 10, 1, 'k');
        EL(x + 6, y + 1, 5, 1, cans[i][2] ? 'r' : 'm');
        if (cans[i][2]) { R(x + 2, y, 8, 1, 'r2'); R(x + 9, y + 2, 1, 4, 'r'); }
      }
      // lid on floor + brush with red paint
      EL(74, 142, 6, 2, 'k'); EL(74, 141, 5, 1, 'm'); P(72, 141, 'r');
      LT(50, 124, 62, 116, 'k', 2); R(46, 124, 6, 4, 'k'); R(46, 126, 6, 3, 'r'); P(47, 129, 'r2');
      R(26, 143, 10, 1, 'r2'); P(38, 144, 'r');
      // more cans on shelf
      for (i = 0; i < 4; i++) { R(22 + i * 15, 94, 10, 10, 'k'); R(23 + i * 15, 95, 8, 9, i === 1 ? 'b' : 'm'); R(24 + i * 15, 98, 6, 3, i % 2 ? 'r2' : 'p'); }
    }],
    ['p'],
    ['a', function () { vignette(1.2); }]
  ] };
  HS.boiler = { paint: [24, 112, 58, 34], tools: [12, 36, 76, 62], sake: [200, 106, 24, 34], photo: [244, 46, 32, 30], boiler: [104, 22, 82, 116] };

  /* ---------------- kitchen ---------------- */
  SC.kitchen = { L: [
    ['s', function () {
      interior({ floorY: 142, wall: 'b', stripe: 4 });
      cornerShadow();
      // tiles behind sink
      for (var y = 70; y < 110; y += 5) for (var x = 226; x < 298; x += 6) { R(x, y, 5, 4, 'l'); P(x, y, 'p'); }
      // back door frame + window recess
      R(182, 46, 40, 96, 'k'); R(184, 48, 36, 94, 'd');
      R(190, 54, 24, 30, 'k');
    }],
    ['a', function (t) { winGlass(t, 191, 55, 22, 28, 81); rain(t, 18, 'p', 191, 55, 22, 28, 140, 0.15); }],
    ['s', function () {
      R(201, 55, 2, 28, 'm'); R(191, 68, 22, 2, 'm');
      R(186, 88, 32, 2, 'm'); R(186, 112, 32, 2, 'm'); R(186, 88, 1, 52, 'm');
      R(212, 104, 4, 6, 'k'); P(214, 106, 'p');
      R(196, 132, 12, 0, 'k');
      // calendar
      R(116, 30, 34, 42, 'k'); R(117, 31, 32, 40, 'w'); R(117, 31, 32, 9, 'l');
      TXT('1978', 119, 33, 'k'); TXT('11', 139, 33, 'k');
      for (var r = 0; r < 5; r++) for (var c = 0; c < 7; c++) { var n = r * 7 + c - 2; if (n >= 1 && n <= 30) R(119 + c * 4, 43 + r * 5, 2, 2, c === 0 ? 'm' : 'l'); }
      // the 14th circled in red
      var cx = 119 + 2 * 4, cy = 43 + 2 * 5;
      ELO(cx + 1, cy + 1, 3, 2, 'r');
      R(132, 28, 2, 3, 'k');
      // shelf with dishes
      R(20, 40, 80, 3, 'l'); R(20, 40, 80, 1, 'p'); R(24, 43, 2, 6, 'k'); R(94, 43, 2, 6, 'k');
      for (var i = 0; i < 6; i++) { EL(28 + i * 12, 34, 5, 5, 'p'); ELO(28 + i * 12, 34, 5, 5, 'k'); EL(28 + i * 12, 34, 2, 2, 'l'); }
      // hanging pots
      R(232, 34, 60, 2, 'k');
      for (i = 0; i < 4; i++) { var px = 238 + i * 14; R(px + 2, 36, 1, 6, 'k'); EL(px + 2, 48, 5, 5, 'k'); EL(px + 2, 47, 4, 4, i % 2 ? 'm' : 'l'); P(px, 45, 'p'); }
      // sink counter
      R(226, 108, 70, 4, 'l'); R(226, 108, 70, 1, 'w'); R(226, 112, 70, 30, 'k'); R(228, 114, 66, 26, 'd');
      R(228, 114, 32, 26, 'm'); R(262, 114, 32, 26, 'm'); R(228, 114, 32, 1, 'l'); R(262, 114, 32, 1, 'l');
      R(256, 124, 4, 1, 'p'); R(264, 124, 4, 1, 'p');
      R(238, 106, 34, 3, 'k'); R(240, 106, 30, 2, 'm');
      // faucet
      R(254, 92, 2, 14, 'k'); R(254, 92, 10, 2, 'k'); R(262, 94, 2, 4, 'k'); R(255, 92, 1, 12, 'p');
      R(250, 98, 3, 2, 'k'); R(257, 98, 3, 2, 'k');
      // dish rack
      R(278, 98, 14, 10, 'k'); for (i = 0; i < 4; i++) R(280 + i * 3, 94, 2, 12, 'p');
      // long dining table
      R(16, 112, 160, 5, 'l'); R(16, 112, 160, 1, 'w'); R(16, 117, 160, 3, 'k');
      R(20, 120, 4, 22, 'k'); R(168, 120, 4, 22, 'k'); R(21, 120, 1, 20, 'm');
      DR(16, 112, 160, 5, 'p', 3);
      // chairs behind table
      for (i = 0; i < 5; i++) { var chx = 26 + i * 30; R(chx, 92, 3, 20, 'k'); R(chx + 16, 92, 3, 20, 'k'); R(chx, 92, 19, 3, 'k'); R(chx + 1, 93, 17, 1, 'm'); R(chx + 3, 98, 13, 2, 'd'); }
      // plates with leftovers
      var pl = [[34, 110], [64, 109], [94, 110], [124, 109], [152, 110]];
      for (i = 0; i < pl.length; i++) {
        EL(pl[i][0], pl[i][1], 8, 2, 'k'); EL(pl[i][0], pl[i][1] - 1, 7, 2, 'w'); EL(pl[i][0], pl[i][1] - 1, 4, 1, 'p');
        if (i % 2 === 0) { R(pl[i][0] - 2, pl[i][1] - 3, 5, 2, 'm'); P(pl[i][0] - 1, pl[i][1] - 3, 'l'); }
        else { R(pl[i][0] - 4, pl[i][1] - 2, 3, 1, 'd'); R(pl[i][0] + 1, pl[i][1] - 3, 4, 1, 'b'); }
        L(pl[i][0] + 9, pl[i][1] - 3, pl[i][0] + 10, pl[i][1] + 1, 'k');
      }
      // tea pot + bottles
      EL(80, 104, 5, 4, 'k'); EL(80, 104, 4, 3, 'm'); R(84, 102, 3, 1, 'k'); R(79, 99, 3, 2, 'k');
      R(108, 98, 4, 12, 'k'); R(109, 100, 2, 10, 'l'); R(109, 96, 2, 3, 'k');
      R(140, 102, 5, 8, 'k'); R(141, 103, 3, 6, 'p');
      // trash bin
      EL(306, 142, 9, 1, D('k', 8));
      PO([299, 126, 313, 126, 312, 142, 300, 142], 'm', 'k');
      for (var tb = 302; tb < 311; tb += 3) R(tb, 128, 1, 13, 'd');
      R(298, 124, 16, 3, 'k'); R(299, 124, 14, 1, 'l');
      EL(304, 123, 3, 2, 'w'); P(303, 122, 'p'); R(308, 121, 4, 3, 'p'); P(309, 121, 'w');
      // ceiling lamp over table
      R(95, 0, 1, 18, 'k'); PO([84, 26, 90, 18, 101, 18, 107, 26], 'd', 'k'); R(88, 26, 16, 1, 'y');
    }],
    ['a', function (t) {
      var fl = 0.7 + 0.3 * Math.sin(t * 3.7) * Math.sin(t * 6.1);
      glow(95, 30, 36 + fl * 4, 'y', 1);
      DR(30, 108, 130, 6, 'y', 1 + rd(fl));
      R(88, 26, 16, 1, 'y'); R(92, 27, 8, 1, 'w');
      // faucet drip
      var ph = (t * 0.9) % 1; P(263, 98 + ph * 10, 'p');
    }],
    ['p'],
    ['a', function () { vignette(1); }]
  ] };
  HS.kitchen = { trash: [296, 116, 22, 28], table: [14, 98, 164, 46], sink: [226, 86, 70, 56], backdoor: [180, 44, 44, 98], calendar: [114, 26, 38, 48] };

  /* ---------------- cliff ---------------- */
  SC.cliff = { L: [
    ['s', function () { R(0, 0, W, H, 'd'); }],
    ['a', function (t) {
      R(0, 0, W, 96, 'd'); DR(0, 0, W, 34, 'k', 9); DR(0, 34, W, 20, 'k', 4);
      for (var i = 0; i < 10; i++) { var cx = ((hs(i * 3.1) * 380 + t * 2) % 380) - 30, cy = 6 + hs(i * 1.7) * 36; EL(cx, cy, 24 + hs(i) * 20, 5, D('m', 5 + (i % 3) * 3)); }
      // sea
      R(0, 86, W, 50, 'k'); DR(0, 86, W, 16, 'd', 8); R(0, 86, W, 1, 'm');
      for (var row = 0; row < 10; row++) {
        var y = 88 + row * 4;
        for (i = 0; i < 6 + row; i++) {
          var wx = ((hs(row * 5.7 + i) * W + t * (row % 2 ? 4 : -4)) % W + W) % W;
          R(wx, y, 2 + (row >> 2), 1, row < 4 ? 'd' : 'm');
        }
      }
      var f = flash(t); if (f) { DR(0, 0, W, 88, 'p', f === 2 ? 7 : 3); if (f === 2) bolt(t, 80, 0, 60); }
    }],
    ['s', function () {
      // headland across the cove with tower
      POLY([100, 96, 130, 86, 150, 84, 176, 86, 200, 92, 220, 98, 100, 98], 'k');
      DR(100, 88, 120, 10, 'd', 4);
      // tower silhouette
      POLY([152, 86, 154, 42, 166, 42, 168, 86], 'm');
      R(154, 44, 2, 40, 'b'); DR(162, 42, 6, 44, 'd', 8);
      R(148, 40, 24, 2, 'k'); R(148, 36, 24, 1, 'd'); for (var x = 148; x <= 172; x += 3) R(x, 36, 1, 4, 'k');
      R(155, 28, 10, 8, 'k'); EL(160, 28, 6, 3, 'k'); R(159, 22, 2, 4, 'k');
      // house silhouette next to tower
      POLY([166, 86, 166, 62, 178, 54, 192, 62, 192, 86], 'd'); R(170, 68, 3, 4, 'y'); R(184, 72, 3, 3, 'm');
      // near cliff ground
      POLY([0, 112, 40, 108, 90, 112, 140, 120, 200, 116, 260, 104, 320, 100, W, H, 0, H], 'm');
      DR(0, 108, W, 72, 'd', 6);
      R(0, 112, 40, 1, 'l');
      // muddy path
      POLY([96, H, 120, 128, 160, 122, 200, 124, 230, H], 'd');
      DR(110, 126, 110, 54, 'k', 4);
      for (var i = 0; i < 12; i++) { var px = 104 + hs(i * 2.3) * 120, py = 132 + hs(i * 4.7) * 44; R(px, py, 6, 1, 'l'); P(px + 2, py - 1, 'p'); }
      // footprints
      var fp = [[132, 168], [146, 160], [138, 152], [152, 146], [148, 140], [162, 136], [176, 162], [184, 152], [178, 144]];
      for (i = 0; i < fp.length; i++) {
        var s = fp[i][1] > 155 ? 1 : 0;
        EL(fp[i][0], fp[i][1], 2 + s, 3 + s, 'k'); EL(fp[i][0], fp[i][1] - 3 - s, 1 + s, 1, 'k');
        P(fp[i][0] - 1, fp[i][1] - 1, 'm'); R(fp[i][0] - 2 - s, fp[i][1] + 2 + s, 4 + s * 2, 1, 'l');
      }
      // grass tufts
      for (i = 0; i < 40; i++) { var gx = hs(i * 1.9) * W, gy = 108 + hs(i * 3.3) * 60; if (gx > 100 && gx < 230 && gy > 124) continue; L(gx, gy, gx - 1, gy - 4, 'b'); L(gx + 1, gy, gx + 2, gy - 3, 'l'); }
      // bench
      R(28, 116, 56, 4, 'l'); R(28, 116, 56, 1, 'p'); R(28, 120, 56, 1, 'k');
      R(30, 104, 52, 3, 'm'); R(30, 104, 52, 1, 'l'); R(30, 109, 52, 3, 'm'); R(30, 109, 52, 1, 'l');
      R(32, 104, 2, 30, 'k'); R(78, 104, 2, 30, 'k'); R(36, 121, 2, 12, 'k'); R(74, 121, 2, 12, 'k');
      EL(56, 134, 30, 2, D('k', 8));
      // fence along cliff edge
      var fx = [206, 222, 240, 260, 282, 304, 322];
      for (i = 0; i < fx.length; i++) { var fy = 140 - (fx[i] - 206) * 0.28; R(fx[i], fy - 30, 3, 32, 'k'); R(fx[i], fy - 30, 1, 32, 'l'); }
      L(206, 116, 320, 84, 'k'); L(206, 117, 320, 85, 'l'); L(206, 126, 320, 94, 'k'); L(206, 127, 320, 95, 'p');
      // broken rail piece
      L(260, 101, 270, 112, 'p'); L(261, 101, 271, 112, 'k');
    }],
    ['a', function (t) {
      var fl = 0.5 + 0.5 * Math.sin(t * 5.9) * Math.sin(t * 2.2);
      R(156, 30, 8, 5, 'y'); DR(150, 26, 20, 12, 'y', 1 + rd(fl * 2)); R(155, 28, 10, 2, 'k');
    }],
    ['p'],
    ['a', function (t) {
      fogBand(t, 0, W, 76, 30, 'l', 4, 8, 3);
      fogBand(t, 0, W, 120, 40, 'l', 2, -6, 8);
      rain(t, 140, 'l', 0, 0, W, H, 170, 0.35);
      vignette(1);
    }]
  ] };
  HS.cliff = { bench: [24, 100, 64, 36], tower: [140, 18, 40, 72], footprints: [122, 128, 70, 46], fence: [202, 80, 118, 64] };

  /* ---------------- deduction ---------------- */
  SC.deduction = { L: [
    ['s', function () {
      R(0, 0, W, H, 'k');
      for (var x = 0; x < W; x += 16) R(x, 0, 1, H, D('d', 8));
      for (var y = 0; y < H; y += 16) R(0, y, W, 1, D('d', 8));
      // pins and threads
      var pins = [[40, 30], [96, 52], [62, 112], [150, 28], [210, 70], [270, 36], [250, 130], [130, 140], [292, 96]];
      var links = [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [4, 6], [2, 7], [7, 6], [6, 8], [5, 8]];
      for (var i = 0; i < links.length; i++) { var a = pins[links[i][0]], b = pins[links[i][1]]; L(a[0], a[1], b[0], b[1], i === 3 ? 'r2' : 'm'); }
      for (i = 0; i < pins.length; i++) {
        var p = pins[i];
        R(p[0] - 8, p[1] + 2, 16, 11, 'd'); R(p[0] - 7, p[1] + 3, 14, 1, 'm'); R(p[0] - 6, p[1] + 6, 10, 1, 'm');
        R(p[0] - 1, p[1] - 1, 3, 3, i === 4 ? 'r' : 'p'); P(p[0] - 1, p[1] - 1, 'w');
      }
    }],
    ['a', function (t) {
      // rotating lighthouse beam from bottom-right tower
      var ox = 262, oy = 120, ang = -Math.PI / 2 + Math.sin(t * 0.35) * 1.5 - 0.3;
      var a1 = ang - 0.13, a2 = ang + 0.13;
      POLY([ox, oy, ox + Math.cos(a1) * 420, oy + Math.sin(a1) * 420, ox + Math.cos(a2) * 420, oy + Math.sin(a2) * 420], D('p', 3));
      POLY([ox, oy, ox + Math.cos(ang - 0.05) * 420, oy + Math.sin(ang - 0.05) * 420, ox + Math.cos(ang + 0.05) * 420, oy + Math.sin(ang + 0.05) * 420], D('w', 2));
      // tower silhouette
      POLY([254, H, 258, 124, 266, 124, 270, H], 'k'); R(255, 122, 14, 2, 'k'); R(259, 116, 6, 6, 'p'); R(260, 112, 4, 4, 'k');
      fogBand(t, 0, W, 110, 50, 'm', 4, 10, 2);
      fogBand(t, 0, W, 20, 40, 'd', 5, -7, 6);
      fogBand(t, 0, W, 140, 40, 'm', 6, 5, 9);
      vignette(1.3);
    }]
  ] };
  HS.deduction = {};

  /* ---------------- confront ---------------- */
  SC.confront = { L: [
    ['s', function () { R(0, 0, W, H, 'k'); }],
    ['a', function (t, fl, o) {
      // speed lines
      for (var i = 0; i < 46; i++) {
        var y0 = ((hs(i * 2.7) * 260 + t * (60 + hs(i) * 80)) % 260) - 60;
        var len = 40 + hs(i * 5.1) * 90, x0 = hs(i * 1.3) * 340 - 20;
        L(x0, y0, x0 + len, y0 + len * 0.45, i % 5 === 0 ? 'm' : 'd');
      }
      // red pulsing slashes
      var pulse = 0.5 + 0.5 * Math.sin(t * 4);
      POLY([0, 20, 150, 0, 170, 0, 0, 44], D('r2', 4 + rd(pulse * 6)));
      POLY([0, 150, 200, 110, 230, 110, 0, 170], D('r2', 3 + rd(pulse * 4)));
      R(0, 30, 120, 1, D('r', 6 + rd(pulse * 8)));
      // spotlight on the culprit area
      EL(250, 172, 52, 7, D('m', 6));
      POLY([226, 0, 274, 0, 300, 172, 200, 172], D('d', 6));
      var ppl = (o && o.people) || [];
      if (ppl.length) {
        var id = ppl[0];
        figure(G, id, 250, 178, { scale: 3, sil: true, shadow: false });
      } else {
        figure(G, 'karasuma', 250, 178, { scale: 3, sil: true, shadow: false });
      }
      R(0, 0, W, 2, 'r'); R(0, H - 2, W, 2, 'r');
      vignette(1);
    }]
  ] };
  HS.confront = {};

  /* ---------------- dawn ---------------- */
  SC.dawn = { L: [
    ['s', function () {
      R(0, 0, W, H, 'l');
      DR(0, 0, W, 30, 'b', 10); DR(0, 30, W, 20, 'b', 4);
      R(0, 60, W, 40, 'p'); DR(0, 50, W, 10, 'p', 8);
      DR(0, 84, W, 18, 'w', 6);
      EL(236, 100, 30, 6, 'w'); EL(236, 100, 50, 10, D('w', 8));
      // sun disk partly behind horizon
      EL(236, 100, 9, 9, 'w');
      // sea
      R(0, 100, W, 80, 'b'); DR(0, 100, W, 16, 'l', 8);
      // headland + lighthouse silhouette
      POLY([0, 108, 40, 96, 80, 94, 110, 102, 130, 112, 150, 118, 0, 120], 'm');
      POLY([52, 96, 54, 46, 64, 46, 66, 96], 'd'); R(54, 48, 2, 46, 'm');
      R(49, 44, 20, 2, 'd'); for (var x = 49; x <= 69; x += 3) R(x, 40, 1, 4, 'd'); R(49, 40, 20, 1, 'd');
      R(55, 32, 8, 8, 'd'); EL(59, 31, 5, 3, 'd'); R(58, 25, 2, 4, 'd');
      POLY([66, 96, 66, 76, 78, 68, 92, 76, 92, 98], 'd');
      R(0, 119, 150, 1, 'l');
    }],
    ['a', function (t) {
      // shimmer path of light on sea
      for (var row = 0; row < 18; row++) {
        var y = 102 + row * 4, n = 4 + row;
        for (var i = 0; i < n; i++) {
          var wx = ((hs(row * 3.3 + i) * W + t * (row % 2 ? 3 : -3) * (1 + row * 0.2)) % W + W) % W;
          var near = Math.abs(wx - 236) < 20 + row * 3;
          R(wx, y, 2 + (row >> 2), 1, near ? 'w' : (row < 6 ? 'l' : 'm'));
        }
      }
      fogBand(t, 0, W, 90, 30, 'w', 3, 5, 3);
      fogBand(t, 0, W, 130, 40, 'p', 2, -4, 7);
      // gulls
      for (i = 0; i < 4; i++) {
        var gx = ((hs(i * 7.7) * 360 + t * (8 + i * 2)) % 380) - 30, gy = 30 + hs(i * 2.9) * 40 + Math.sin(t * 0.7 + i) * 4;
        var flap = Math.sin(t * 6 + i * 1.7) > 0 ? 1 : 0;
        P(gx, gy, 'd'); P(gx - 1, gy - flap, 'd'); P(gx + 1, gy - flap, 'd'); P(gx - 2, gy - flap * 2 + (1 - flap), 'd'); P(gx + 2, gy - flap * 2 + (1 - flap), 'd'); P(gx - 3, gy - flap + (1 - flap), 'd'); P(gx + 3, gy - flap + (1 - flap), 'd');
      }
    }],
    ['s', function () {
      POLY([0, 150, 30, 144, 60, 150, 100, 160, 130, 172, 150, H, 0, H], 'd'); R(0, 150, 30, 1, 'm'); for (var q = 0; q < 8; q++) { POLY([10 + q * 14, 158 + (q % 3) * 3, 18 + q * 14, 152 + (q % 2) * 4, 24 + q * 14, 160 + (q % 3) * 2], 'm'); }
    }],
    ['p']
  ] };
  HS.dawn = {};

  SC.black = { L: [['s', function () { R(0, 0, W, H, 'k'); }]] };
  HS.black = {};

  /* ------------------------------------------------------------------ */
  /* people placement                                                    */
  /* ------------------------------------------------------------------ */
  var POS = {
    exterior: [[186, 146], [234, 146], [128, 144]],
    lamproom: [[148, 172], [226, 166], [196, 176]],
    gallery: [[210, 168], [124, 172], [300, 176]],
    hall: [[132, 160], [214, 158], [88, 164]],
    lounge: [[124, 162], [234, 158], [96, 168]],
    study: [[90, 162], [230, 160], [60, 168]],
    corridor2: [[160, 150], [196, 160], [124, 158]],
    room3: [[158, 162], [124, 166], [250, 166]],
    room4: [[160, 162], [132, 168], [232, 164]],
    room5: [[190, 162], [92, 166], [236, 168]],
    boiler: [[204, 166], [92, 162], [254, 162]],
    kitchen: [[200, 164], [150, 166], [262, 162]],
    cliff: [[98, 162], [62, 168], [232, 166]],
    dawn: [[120, 166], [150, 170], [180, 168]],
    title: [], deduction: [], black: [], confront: []
  };
  function personSpots(sceneId, people) {
    var out = {}, pos = POS[sceneId] || [];
    people = people || [];
    if (sceneId === 'confront') {
      if (people.length) out[people[0]] = [226, 58, 48, 120];
      return out;
    }
    for (var i = 0; i < people.length && i < pos.length; i++) {
      var id = people[i], def = FIG[id] || FIG.karasuma, h = def.rows.length;
      // skip empty top rows
      var top = 0; while (top < h && def.rows[top].replace(/\./g, '') === '') top++;
      out[id] = [pos[i][0] - 8, pos[i][1] - h + top, 16, h - top];
    }
    return out;
  }
  function drawPeople(id, people, t) {
    var pos = POS[id] || [];
    for (var i = 0; i < people.length && i < pos.length; i++) {
      var p = people[i];
      if (!FIG[p]) continue;
      var flip = pos[i][0] > 170;
      figure(G, p, pos[i][0], pos[i][1], { flip: flip, t: t });
    }
  }

  /* ------------------------------------------------------------------ */
  /* main draw                                                           */
  /* ------------------------------------------------------------------ */
  var DEADPOS = {
    boiler: [140, 166], lounge: [150, 170], kitchen: [70, 168], study: [134, 168], hall: [90, 170],
    room3: [146, 168], room4: [96, 170], room5: [118, 170], corridor2: [142, 162], lamproom: [190, 172],
    gallery: [196, 170], exterior: [176, 156], cliff: [140, 170], dawn: [110, 170]
  };
  function deadId(sceneId, f) {
    if (f.dead && FIG[f.dead]) return f.dead;
    if (sceneId === 'boiler' && f.kuga_dead) return 'kuga';
    return null;
  }
  function deadSpot(sceneId, flags) {
    var id = deadId(sceneId, flags || {}); if (!id) return {};
    var p = DEADPOS[sceneId] || [140, 166], h = FIG[id].rows.length, o = {};
    o[id] = [p[0] - 4, p[1] - 17, h + 6, 19];
    return o;
  }
  function drawDead(sceneId, f) {
    var id = deadId(sceneId, f); if (!id) return;
    var p = DEADPOS[sceneId] || [140, 166], x = p[0], y = p[1];
    EL(x + 2, y - 6, 14, 4, 'r2'); EL(x, y - 7, 10, 3, 'r'); R(x - 12, y - 6, 6, 1, 'r'); P(x + 6, y - 9, 'w');
    figure(G, id, x, y, { lying: true });
    R(x + 4, y - 3, 3, 1, 'r');
  }
  var CACHE = {};
  function flagKey(f) {
    var ks = Object.keys(f || {}).sort(), s = '';
    for (var i = 0; i < ks.length; i++) if (f[ks[i]]) s += ks[i] + '=' + f[ks[i]] + ',';
    return s;
  }
  function cached(id, idx, fk, fn, f, o) {
    var key = id + '#' + idx + '#' + fk;
    if (CACHE[key]) return CACHE[key];
    var cv = mk(W, H); if (!cv) return null;
    var g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    var g0 = G; G = g; fn(f, o); G = g0;
    CACHE[key] = cv; return cv;
  }
  function draw(ctx, sceneId, t, opts) {
    opts = opts || {}; t = t || 0;
    var sc = SC[sceneId] || SC.black, f = opts.flags || {}, fk = flagKey(f);
    var ppl = (opts.people || []).slice(0, 3);
    var g0 = G; G = ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    R(0, 0, W, H, 'k');
    for (var i = 0; i < sc.L.length; i++) {
      var e = sc.L[i];
      if (e[0] === 's') {
        var cv = cached(sceneId, i, fk, e[1], f, opts);
        if (cv) ctx.drawImage(cv, 0, 0); else e[1](f, opts);
      } else if (e[0] === 'a') e[1](t, f, opts);
      else if (e[0] === 'p' && sceneId !== 'confront') { drawDead(sceneId, f); drawPeople(sceneId, ppl, t); }
    }
    if (opts.hover) {
      var r = (HS[sceneId] || {})[opts.hover] || personSpots(sceneId, ppl)[opts.hover] || deadSpot(sceneId, f)[opts.hover];
      if (r) brackets(r, t);
    }
    ctx.restore();
    G = g0;
  }

  /* ------------------------------------------------------------------ */
  /* portraits (96x96)                                                   */
  /* ------------------------------------------------------------------ */
  var PS = {
    karasuma: { rx: 14, ry: 19, cy: 46 },
    fuyuko: { rx: 15, ry: 18, cy: 46 },
    shibasaki: { rx: 16, ry: 19, cy: 46 },
    chikage: { rx: 14, ry: 17, cy: 47 },
    naruse: { rx: 16, ry: 18, cy: 46 },
    kuga: { rx: 16, ry: 18, cy: 48 },
    haitani: { rx: 16, ry: 19, cy: 46 }
  };
  function shoulders(fill, out, top) {
    top = top || 70;
    PO([2, 96, 8, top + 10, 24, top, 40, top - 4, 56, top - 4, 72, top, 88, top + 10, 94, 96], fill, out);
  }
  function eyes(id, expr, cx, ey, t) {
    var ex = [cx - 7, cx + 6];
    var blink = ((t || 0) % 4.3) < 0.12 && expr !== 'shock';
    for (var i = 0; i < 2; i++) {
      var x = ex[i], s = i ? 1 : -1;
      if (blink) { R(x - 2, ey + 1, 5, 1, 'k'); continue; }
      if (expr === 'shock') {
        R(x - 2, ey - 1, 5, 4, 'w'); R(x - 3, ey - 2, 7, 1, 'k'); R(x - 3, ey + 3, 7, 1, 'k'); R(x - 3, ey - 1, 1, 4, 'k'); R(x + 3, ey - 1, 1, 4, 'k');
        P(x, ey, 'k'); P(x, ey + 1, 'k');
      } else if (expr === 'smile') {
        R(x - 2, ey, 5, 1, 'k'); P(x - 3, ey + 1, 'k'); P(x + 3, ey + 1, 'k');
      } else if (expr === 'sad') {
        R(x - 2, ey, 5, 2, 'k'); R(x - 2, ey, 5, 1, 'd'); P(x + (s < 0 ? 0 : 0), ey + 1, 'w');
        R(x - 2, ey + 3, 5, 1, 'l');
      } else {
        var narrow = expr === 'angry' || id === 'chikage' || id === 'naruse';
        R(x - 3, ey - 1, 7, 1, 'k');
        R(x - 2, ey, 5, narrow ? 1 : 2, 'k');
        P(x - (s < 0 ? 0 : 1), ey, 'w');
        if (id === 'chikage' || id === 'fuyuko') P(x + s * 4, ey - 2, 'k');
        if (id === 'fuyuko') R(x - 2, ey + 3, 4, 1, 'l');
      }
    }
    // brows
    var bc = (id === 'kuga' || id === 'haitani') ? 'w' : (id === 'shibasaki' ? 'l' : 'k');
    var bt = (id === 'kuga' || id === 'haitani') ? 2 : 1;
    for (i = 0; i < 2; i++) {
      var bx = ex[i], sg = i ? 1 : -1, by = ey - 5;
      if (expr === 'angry') { L(bx + 3 * sg, by - 1, bx - 2 * sg, by + 2, bc); if (bt > 1) L(bx + 3 * sg, by - 2, bx - 2 * sg, by + 1, bc); }
      else if (expr === 'sad') { L(bx + 3 * sg, by + 1, bx - 2 * sg, by - 2, bc); if (bt > 1) L(bx + 3 * sg, by, bx - 2 * sg, by - 3, bc); }
      else if (expr === 'shock') { R(bx - 3, by - 3, 7, bt, bc); P(bx - 3 * -sg, by - 2, bc); }
      else { R(bx - 3, by, 7, bt, bc); P(bx + 3 * sg, by + 1, bc); }
    }
  }
  function mouth(id, expr, cx, my) {
    var mc = 'k';
    if (expr === 'smile') { R(cx - 3, my, 7, 1, mc); P(cx - 4, my - 1, mc); P(cx + 4, my - 1, mc); R(cx - 2, my + 1, 5, 1, 'l'); }
    else if (expr === 'angry') { R(cx - 3, my, 7, 1, mc); P(cx - 4, my + 1, mc); P(cx + 4, my + 1, mc); }
    else if (expr === 'sad') { R(cx - 2, my, 5, 1, mc); P(cx - 3, my + 1, mc); P(cx + 3, my + 1, mc); }
    else if (expr === 'shock') { EL(cx, my + 1, 2, 3, 'k'); R(cx - 1, my + 3, 3, 1, 'm'); }
    else { R(cx - 3, my, 6, 1, 'm'); P(cx - 3, my, 'k'); }
  }
  function extras(expr, cx, cy, rx, t) {
    if (expr === 'shock') { // sweat drop
      var sx = cx + rx - 1, sy = cy - 10 + rd(((t || 0) * 4) % 3);
      PO([sx, sy, sx - 3, sy + 5, sx, sy + 8, sx + 3, sy + 5], 'w', 'k'); P(sx - 1, sy + 4, 'p');
    }
    if (expr === 'sad') { // tears
      var ph = ((t || 0) * 0.8) % 1;
      R(cx - 8, cy + 5, 1, 6, 'w'); R(cx - 8, cy + 5 + rd(ph * 8), 2, 2, 'w');
      R(cx + 7, cy + 5, 1, 4, 'p');
    }
    if (expr === 'angry') { // tension lines
      L(cx + rx + 3, cy - 18, cx + rx + 6, cy - 22, 'p'); L(cx + rx + 5, cy - 16, cx + rx + 9, cy - 18, 'p');
    }
  }
  function face(id, s, expr, t) {
    var cx = 48, cy = s.cy, rx = s.rx, ry = s.ry;
    // neck
    R(cx - 6, cy + ry - 6, 12, 16, 'l'); R(cx + 2, cy + ry - 6, 4, 16, 'm');
    // ears
    EL(cx - rx, cy + 2, 3, 5, 'k'); EL(cx - rx, cy + 2, 2, 4, 'p');
    EL(cx + rx, cy + 2, 3, 5, 'k'); EL(cx + rx, cy + 2, 2, 4, 'l');
    // head
    EL(cx, cy, rx + 1, ry + 1, 'k');
    EL(cx, cy, rx, ry, 'l');
    EL(cx - 2, cy - 1, rx - 2, ry - 1, 'p');
    // jaw shading + cheek
    R(cx + rx - 5, cy + 2, 3, 8, D('l', 8));
    // nose
    P(cx + 1, cy + 5, 'l'); R(cx, cy + 7, 3, 1, 'l'); P(cx + 2, cy + 6, 'm');
    eyes(id, expr, cx, cy + 1, t);
    mouth(id, expr, cx, cy + 12);
  }
  function portrait(ctx, charId, expr, t) {
    expr = expr || 'normal'; t = t || 0;
    var g0 = G; G = ctx;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 96, 96);
    var s = PS[charId] || PS.karasuma, cx = 48, cy = s.cy, rx = s.rx, ry = s.ry;
    // background
    R(0, 0, 96, 96, 'd');
    EL(48, 44, 40, 40, D('m', 4));
    DR(0, 0, 96, 4, 'k', 10); DR(0, 92, 96, 4, 'k', 10); DR(0, 0, 4, 96, 'k', 10); DR(92, 0, 4, 96, 'k', 10);
    DR(4, 4, 88, 4, 'k', 4); DR(4, 88, 88, 4, 'k', 4); DR(4, 4, 4, 88, 'k', 4); DR(88, 4, 4, 88, 'k', 4);

    if (charId === 'karasuma') {
      shoulders('w', 'k', 72);
      POLY([62, 74, 72, 72, 88, 82, 94, 96, 64, 96], 'p');
      // shirt + tie
      POLY([38, 68, 58, 68, 48, 96], 'p'); POLY([45, 70, 51, 70, 50, 96, 46, 96], 'k'); R(46, 70, 4, 3, 'd');
      // turned-up collar
      PO([22, 76, 34, 58, 42, 68, 40, 92], 'w', 'k'); PO([74, 76, 62, 58, 54, 68, 56, 92], 'p', 'k');
      L(35, 62, 40, 88, 'l'); L(61, 62, 57, 88, 'l');
      R(26, 84, 2, 10, 'l'); P(70, 86, 'k');
      face(charId, s, expr, t);
      // stubble
      DR(cx - 10, cy + 9, 20, 10, 'l', 3);
      // hair at sides under hat
      R(cx - rx - 1, cy - 12, 4, 12, 'k'); R(cx + rx - 2, cy - 12, 4, 12, 'k');
      // brim shadow on face
      R(cx - rx + 1, cy - 14, rx * 2 - 2, 4, D('m', 10));
      // fedora
      PO([24, 31, 72, 31, 76, 35, 20, 35], 'd', 'k');
      PO([30, 31, 33, 14, 40, 9, 48, 12, 56, 9, 63, 14, 66, 31], 'd', 'k');
      L(48, 12, 48, 20, 'k');
      R(31, 24, 35, 5, 'k'); R(31, 24, 35, 1, 'm');
      R(21, 34, 54, 1, 'p'); L(33, 15, 31, 24, 'l'); P(40, 10, 'l'); R(24, 31, 20, 1, 'l');
    } else if (charId === 'fuyuko') {
      // back hair + bun
      EL(cx, cy - 2, rx + 4, ry + 3, 'k');
      EL(cx - 15, cy + 18, 8, 7, 'k'); EL(cx - 16, cy + 17, 6, 5, 'd'); L(cx - 20, cy + 15, cx - 13, cy + 13, 'm');
      shoulders('m', 'k', 72);
      for (var y = 76; y < 96; y += 3) for (var x = 10 + (y % 2) * 2; x < 88; x += 4) P(x, y, 'd');
      // blouse + collar
      POLY([36, 68, 60, 68, 54, 96, 42, 96], 'w'); R(47, 72, 2, 24, 'p');
      PO([36, 67, 47, 68, 44, 76], 'w', 'k'); PO([60, 67, 49, 68, 52, 76], 'w', 'k');
      P(48, 80, 'l'); P(48, 86, 'l'); P(48, 92, 'l');
      // cardigan edges + apron strap
      L(36, 70, 30, 96, 'k'); L(60, 70, 66, 96, 'k'); L(37, 70, 31, 96, 'l');
      R(20, 74, 4, 22, 'p'); R(74, 74, 4, 22, 'p');
      face(charId, s, expr, t);
      // front hair: center part
      PO([cx, cy - 19, cx - 5, cy - 19, cx - rx - 2, cy - 10, cx - rx - 3, cy + 6, cx - rx + 1, cy + 4, cx - rx + 4, cy - 7, cx - 6, cy - 14, cx - 1, cy - 16], 'k');
      PO([cx, cy - 19, cx + 5, cy - 19, cx + rx + 2, cy - 10, cx + rx + 3, cy + 6, cx + rx - 1, cy + 4, cx + rx - 4, cy - 7, cx + 6, cy - 14, cx + 1, cy - 16], 'k');
      L(cx - 4, cy - 18, cx - 12, cy - 12, 'm'); L(cx + 4, cy - 18, cx + 12, cy - 12, 'd');
      // loose strand
      L(cx - rx + 3, cy - 5, cx - rx + 5, cy + 8, 'k'); L(cx - rx + 5, cy + 8, cx - rx + 3, cy + 14, 'k');
      // earring
      P(cx - rx, cy + 8, 'w');
    } else if (charId === 'shibasaki') {
      shoulders('m', 'k', 72);
      for (y = 75; y < 96; y += 2) for (x = 8 + (y % 4); x < 90; x += 4) P(x, y, 'd');
      POLY([36, 68, 60, 68, 48, 92], 'w'); POLY([45, 72, 51, 72, 50, 92, 48, 94, 46, 92], 'd');
      R(46, 76, 4, 1, 'l'); R(46, 82, 4, 1, 'l'); R(46, 88, 3, 1, 'l');
      L(36, 68, 48, 94, 'k'); L(60, 68, 48, 94, 'k');
      PO([36, 67, 46, 70, 40, 74], 'w', 'k'); PO([60, 67, 50, 70, 56, 74], 'w', 'k');
      P(42, 86, 'p'); P(43, 92, 'p');
      face(charId, s, expr, t);
      // smile lines
      L(cx - 7, cy + 9, cx - 6, cy + 13, 'l'); L(cx + 7, cy + 9, cx + 6, cy + 13, 'l');
      // grey combed hair, side part
      PO([cx - rx - 2, cy - 2, cx - rx - 2, cy - 12, cx - 10, cy - 20, cx + 2, cy - 22, cx + 12, cy - 19, cx + rx + 2, cy - 10, cx + rx + 2, cy - 1, cx + rx - 2, cy - 8, cx + 4, cy - 13, cx - 8, cy - 12, cx - rx + 1, cy - 6], 'p', 'k');
      for (var i = 0; i < 5; i++) L(cx - 8 + i * 4, cy - 19, cx - 2 + i * 5, cy - 12, 'l');
      L(cx - 9, cy - 20, cx - 8, cy - 12, 'm');
      R(cx - rx - 1, cy - 4, 2, 8, 'l'); R(cx + rx - 1, cy - 4, 2, 8, 'l');
      // round glasses
      var gx = [cx - 7, cx + 6], gy = cy + 2;
      for (i = 0; i < 2; i++) { ELO(gx[i], gy, 5, 4, 'k'); P(gx[i] - 2, gy - 2, 'w'); P(gx[i] - 3, gy - 1, 'w'); }
      R(cx - 2, gy - 1, 3, 1, 'k'); L(cx - 12, gy - 1, cx - rx, gy - 2, 'k'); L(cx + 11, gy - 1, cx + rx, gy - 2, 'k');
    } else if (charId === 'chikage') {
      // back hair bob
      EL(cx, cy - 2, rx + 5, ry + 1, 'k');
      R(cx - rx - 5, cy - 2, rx * 2 + 10, 16, 'k');
      shoulders('d', 'k', 74);
      L(34, 80, 26, 96, 'm'); L(62, 80, 70, 96, 'm');
      // scarf
      PO([28, 72, 40, 64, 56, 64, 68, 72, 66, 82, 48, 86, 30, 82], 'l', 'k');
      L(34, 72, 62, 74, 'p'); L(32, 78, 64, 79, 'm');
      PO([52, 80, 62, 82, 60, 96, 50, 96], 'l', 'k'); L(55, 84, 54, 96, 'p');
      face(charId, s, expr, t);
      // bangs straight
      PO([cx - rx - 2, cy - 4, cx - rx - 1, cy - 14, cx - 6, cy - 20, cx + 8, cy - 20, cx + rx + 1, cy - 14, cx + rx + 2, cy - 4, cx + rx - 1, cy - 4, cx + rx - 1, cy - 6, cx - rx + 1, cy - 6, cx - rx + 1, cy - 4], 'k');
      R(cx - rx - 5, cy - 6, 5, 22, 'k'); R(cx + rx, cy - 6, 5, 22, 'k');
      R(cx - rx - 5, cy + 15, 6, 1, 'd'); R(cx + rx - 1, cy + 15, 6, 1, 'd');
      L(cx - 6, cy - 16, cx + 4, cy - 16, 'm');
      // lips subtle
      R(cx - 2, cy + 13, 4, 1, 'l');
      // beret, tilted
      PO([cx - rx - 6, cy - 14, cx - rx, cy - 24, cx - 2, cy - 29, cx + 14, cy - 28, cx + rx + 8, cy - 20, cx + rx + 6, cy - 15, cx + 4, cy - 16], 'd', 'k');
      L(cx - rx - 2, cy - 18, cx + rx + 4, cy - 18, 'm');
      L(cx - 4, cy - 27, cx + 10, cy - 26, 'l');
      R(cx + 4, cy - 32, 2, 3, 'k');
    } else if (charId === 'naruse') {
      shoulders('l', 'k', 72);
      for (x = 12; x < 88; x += 5) L(x, 80, x - 1, 96, D('m', 8));
      // shirt dark + light tie
      POLY([38, 68, 58, 68, 48, 96], 'd'); POLY([45, 70, 51, 70, 52, 96, 44, 96], 'w'); R(45, 70, 6, 3, 'p'); L(46, 76, 50, 84, 'p'); L(46, 86, 50, 94, 'p');
      // wide lapels
      PO([32, 70, 38, 66, 46, 96, 36, 96, 28, 82], 'p', 'k');
      PO([64, 70, 58, 66, 50, 96, 60, 96, 68, 82], 'l', 'k');
      R(70, 82, 7, 3, 'w'); R(70, 82, 7, 1, 'p');
      R(36, 90, 2, 2, 'k'); R(58, 90, 2, 2, 'k'); R(36, 94, 2, 2, 'k'); R(58, 94, 2, 2, 'k');
      face(charId, s, expr, t);
      // heavy lids
      R(cx - 10, cy - 1, 7, 1, 'm'); R(cx + 3, cy - 1, 7, 1, 'm');
      // slicked back hair
      PO([cx - rx - 1, cy - 2, cx - rx - 2, cy - 12, cx - 8, cy - 21, cx + 6, cy - 22, cx + rx + 2, cy - 13, cx + rx + 1, cy - 2, cx + rx - 1, cy - 8, cx + 4, cy - 14, cx, cy - 12, cx - 4, cy - 14, cx - rx + 1, cy - 8], 'k');
      L(cx - 8, cy - 18, cx + 8, cy - 20, 'w'); L(cx - 10, cy - 15, cx + 2, cy - 18, 'l'); L(cx + 4, cy - 17, cx + 12, cy - 16, 'm');
      // thin mustache
      R(cx - 5, cy + 10, 4, 1, 'k'); R(cx + 2, cy + 10, 4, 1, 'k'); P(cx - 6, cy + 11, 'k'); P(cx + 6, cy + 11, 'k');
      // cigarette
      if (expr !== 'shock') {
        R(cx + 4, cy + 12, 10, 2, 'w'); R(cx + 4, cy + 13, 10, 1, 'p'); R(cx + 14, cy + 12, 2, 2, 'l');
        for (i = 0; i < 5; i++) {
          var u = (t * 6 + i * 4) % 20;
          P(cx + 16 + rd(Math.sin(t * 2 + u * 0.4) * 2), cy + 11 - u, D('p', 14 - u * 0.6));
        }
      }
    } else if (charId === 'kuga') {
      shoulders('d', 'k', 76);
      // turtleneck ribbed
      PO([30, 96, 32, 74, 40, 68, 56, 68, 64, 74, 66, 96], 'l', 'k');
      for (x = 34; x < 64; x += 3) R(x, 76, 1, 20, 'p');
      // vest
      PO([10, 96, 14, 82, 28, 76, 34, 96], 'd', 'k'); PO([86, 96, 82, 82, 68, 76, 62, 96], 'd', 'k');
      R(18, 86, 6, 3, 'm');
      face(charId, s, expr, t);
      // collar roll over neck
      PO([36, 62, 60, 62, 64, 72, 32, 72], 'l', 'k');
      for (x = 37; x < 62; x += 3) R(x, 63, 1, 9, 'p');
      // bald shine + wrinkles
      R(cx - 9, cy - 15, 6, 1, 'w'); R(cx - 10, cy - 14, 2, 2, 'w');
      L(cx - 7, cy - 9, cx + 6, cy - 9, 'l'); L(cx - 6, cy - 7, cx + 5, cy - 7, 'l');
      L(cx - rx + 2, cy + 6, cx - rx + 4, cy + 10, 'l');
      // side hair white
      R(cx - rx - 1, cy - 4, 3, 8, D('w', 10)); R(cx + rx - 2, cy - 4, 3, 8, D('w', 10));
      // stubble beard
      DR(cx - rx + 2, cy + 6, rx * 2 - 4, 12, 'w', 6);
      EL(cx, cy + 15, 9, 4, D('w', 8));
      R(cx - 4, cy + 10, 8, 1, D('w', 10));
    } else if (charId === 'haitani') {
      shoulders('m', 'k', 72);
      for (x = 14; x < 86; x += 8) for (y = 76; y < 96; y += 4) { P(x, y, 'l'); P(x + 1, y + 1, 'l'); P(x, y + 2, 'l'); }
      PO([36, 62, 60, 62, 64, 72, 32, 72], 'm', 'k');
      R(40, 64, 16, 2, 'p');
      face(charId, s, expr, t);
      // receding white hair
      PO([cx - rx - 2, cy + 2, cx - rx - 2, cy - 12, cx - 10, cy - 18, cx - 6, cy - 14, cx - rx + 2, cy - 6, cx - rx + 2, cy + 2], 'w', 'k');
      PO([cx + rx + 2, cy + 2, cx + rx + 2, cy - 12, cx + 10, cy - 18, cx + 6, cy - 14, cx + rx - 2, cy - 6, cx + rx - 2, cy + 2], 'p', 'k');
      L(cx - 6, cy - 19, cx + 6, cy - 19, 'p'); L(cx - 9, cy - 16, cx - 4, cy - 18, 'w');
      L(cx - 6, cy - 10, cx + 6, cy - 10, 'l');
      // thick white mustache
      PO([cx - 9, cy + 12, cx - 5, cy + 8, cx, cy + 9, cx + 5, cy + 8, cx + 9, cy + 12, cx + 4, cy + 11, cx, cy + 12, cx - 4, cy + 11], 'w', 'k');
    }
    extras(expr, cx, cy, rx, t);
    ctx.restore();
    G = g0;
  }

  /* ------------------------------------------------------------------ */
  var Pixel = {
    W: W, H: H, PAL: PAL,
    draw: draw,
    hotspots: HS,
    portrait: portrait,
    figure: figure,
    personSpots: personSpots,
    deadSpot: deadSpot,
    deadPos: DEADPOS,
    scenes: Object.keys(SC),
    characters: Object.keys(FIG)
  };
  if (typeof window !== 'undefined') window.Pixel = Pixel;
  else if (typeof globalThis !== 'undefined') globalThis.Pixel = Pixel;
})();
