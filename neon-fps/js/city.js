// 夜光区 — 街の自動生成
// 区画番号(seed)から、道・ビル・看板・高架・屋台・ジャンプ台・敵の通り道 を作る
(function () {
  var M = NF.M, R = NF.R;
  var C = {};

  function hex(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

  // 区の色合い(テーマ)
  C.THEMES = [
    { name: '桃電通り', neon: ['#ff2fa0', '#2fe8ff', '#b45cff', '#ff5a5a', '#ffe14d'],
      env: { fogCol: [0.11, 0.06, 0.15], skyHor: [0.20, 0.06, 0.22], skyGlow: [0.60, 0.12, 0.40], skyTop: [0.01, 0.01, 0.04], ambTop: [0.17, 0.14, 0.26], ambBot: [0.08, 0.05, 0.09], beam: [0.35, 0.3, 0.6], skyRefl: [0.40, 0.14, 0.42] } },
    { name: '琥珀横丁', neon: ['#ff9a2f', '#2fffd2', '#ff4d4d', '#ffe14d', '#6aa8ff'],
      env: { fogCol: [0.13, 0.08, 0.06], skyHor: [0.24, 0.10, 0.06], skyGlow: [0.70, 0.30, 0.10], skyTop: [0.02, 0.02, 0.04], ambTop: [0.22, 0.17, 0.14], ambBot: [0.09, 0.06, 0.05], beam: [0.6, 0.45, 0.25], skyRefl: [0.45, 0.25, 0.12] } },
    { name: '翠光埠頭', neon: ['#b8ff2f', '#a52fff', '#2fffb0', '#ff2f6a', '#2f8bff'],
      env: { fogCol: [0.05, 0.10, 0.10], skyHor: [0.05, 0.16, 0.16], skyGlow: [0.12, 0.50, 0.40], skyTop: [0.01, 0.02, 0.03], ambTop: [0.13, 0.19, 0.20], ambBot: [0.05, 0.08, 0.07], beam: [0.25, 0.6, 0.5], skyRefl: [0.12, 0.40, 0.35] } },
    { name: '蒼雨区', neon: ['#3fa0ff', '#ff3f7a', '#7affff', '#ffd23f', '#c06bff'],
      env: { fogCol: [0.06, 0.08, 0.15], skyHor: [0.06, 0.10, 0.25], skyGlow: [0.15, 0.30, 0.70], skyTop: [0.01, 0.01, 0.05], ambTop: [0.13, 0.16, 0.27], ambBot: [0.05, 0.06, 0.10], beam: [0.3, 0.45, 0.8], skyRefl: [0.15, 0.25, 0.50] } }
  ];

  C.generate = function (seed, themeIdx) {
    var rnd = M.rng(seed * 7919 + 13);
    var TL = NF.T.L;
    var theme = C.THEMES[themeIdx % C.THEMES.length];
    var neon = theme.neon.map(hex);
    var B = new R.Builder();
    var world = {
      seed: seed, theme: theme, boxes: [], lights: [], pads: [], barrels: [], vents: [], spawns: [], terminals: [],
      holos: [], beacons: [], half: 72
    };
    var H = world.half;

    // ---- 当たり判定つきの箱 ----
    function solid(x0, y0, z0, x1, y1, z1, o, kind) {
      B.box(x0, y0, z0, x1, y1, z1, o);
      world.boxes.push([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), kind || 0]);
    }
    function addCollider(x0, y0, z0, x1, y1, z1, kind) {
      world.boxes.push([x0, y0, z0, x1, y1, z1, kind || 0]);
    }
    function light(p, c, r, i, fl) { world.lights.push({ p: p, c: c, r: r, i: i, base: i, flicker: fl || 0, ph: rnd() * 10 }); }
    function pickNeon() { return neon[Math.floor(rnd() * neon.length)]; }

    // ---- 地面 ----
    // 道路の中心線
    var roads = [-36, 0, 36], RW = 5.5, SW = 3; // 道路の半幅、歩道の幅
    // 区画(ブロック)の範囲
    var spans = [[-H, -36 + RW + SW], [-36 - RW - SW, 0 - RW - SW], [0 + RW + SW, 36 - RW - SW], [36 + RW + SW, H]];
    spans[1] = [-36 + RW + SW, -RW - SW]; spans[0] = [-H, -36 - RW - SW];
    spans[2] = [RW + SW, 36 - RW - SW]; spans[3] = [36 + RW + SW, H];
    // アスファルト全面
    B.floor(-H - 2, -H - 2, H + 2, H + 2, 0, { layer: TL.asphalt, uv: 9, wet: 1, col: [0.9, 0.9, 0.95] });
    addCollider(-H - 40, -2, -H - 40, H + 40, 0, H + 40, 1);
    // 中央線・横断歩道
    roads.forEach(function (rc) {
      for (var t = -H; t < H; t += 6) {
        var near = roads.some(function (q) { return Math.abs(t + 1.5 - q) < RW + SW + 1; });
        if (near) continue;
        B.floor(rc - 0.12, t, rc + 0.12, t + 3, 0.012, { layer: TL.white, col: [0.75, 0.72, 0.5] });
        B.floor(t, rc - 0.12, t + 3, rc + 0.12, 0.012, { layer: TL.white, col: [0.75, 0.72, 0.5] });
      }
      roads.forEach(function (q) { // 交差点の横断歩道
        for (var k = -4; k <= 4; k++) {
          B.floor(rc + k * 1.1 - 0.35, q - RW - 1.6, rc + k * 1.1 + 0.35, q - RW - 0.2, 0.012, { layer: TL.white, col: [0.6, 0.6, 0.62], wet: 0.6 });
          B.floor(rc + k * 1.1 - 0.35, q + RW + 0.2, rc + k * 1.1 + 0.35, q + RW + 1.6, 0.012, { layer: TL.white, col: [0.6, 0.6, 0.62], wet: 0.6 });
          B.floor(q - RW - 1.6, rc + k * 1.1 - 0.35, q - RW - 0.2, rc + k * 1.1 + 0.35, 0.012, { layer: TL.white, col: [0.6, 0.6, 0.62], wet: 0.6 });
          B.floor(q + RW + 0.2, rc + k * 1.1 - 0.35, q + RW + 1.6, rc + k * 1.1 + 0.35, 0.012, { layer: TL.white, col: [0.6, 0.6, 0.62], wet: 0.6 });
        }
      });
    });

    // ---- ブロックごとに中身を決める ----
    var types = ['tower', 'cluster', 'cluster', 'plaza', 'lowrise', 'lowrise', 'market', 'construction'];
    var blocks = [];
    for (var bx = 0; bx < 4; bx++) for (var bz = 0; bz < 4; bz++) {
      blocks.push({ x0: spans[bx][0], x1: spans[bx][1], z0: spans[bz][0], z1: spans[bz][1], ix: bx, iz: bz });
    }
    // 中央寄りの4ブロックのうち1つは広場にする(戦いやすさ)
    var centerIds = [5, 6, 9, 10];
    var plazaId = centerIds[Math.floor(rnd() * 4)];
    blocks.forEach(function (b, i) {
      b.type = i === plazaId ? 'plaza' : types[Math.floor(rnd() * types.length)];
      // 外周のブロックは背の高いビルを多めに
      var edge = b.ix === 0 || b.ix === 3 || b.iz === 0 || b.iz === 3;
      if (edge && b.type === 'plaza' && i !== plazaId) b.type = 'cluster';
    });

    // 歩道(各ブロックのまわり)
    blocks.forEach(function (b) {
      var x0 = b.x0 - SW, x1 = b.x1 + SW, z0 = b.z0 - SW, z1 = b.z1 + SW;
      if (b.ix === 0) x0 = b.x0; if (b.ix === 3) x1 = b.x1; if (b.iz === 0) z0 = b.z0; if (b.iz === 3) z1 = b.z1;
      solid(x0, 0, z0, x1, 0.16, z1, { layer: TL.sidewalk, uv: 4, wet: 0.45, col: [0.95, 0.95, 1], skip: ['ny'] }, 1);
      b.sx0 = x0; b.sx1 = x1; b.sz0 = z0; b.sz1 = z1;
    });

    var facades = [TL.facade0, TL.facade1, TL.facade2, TL.facade3, TL.facade4, TL.facade5];
    var facadeTile = [[12.8, 14], [20, 21], [12, 14], [19, 30], [16, 17.5], [19, 28]];

    // ---- ビル1棟 ----
    function building(x0, z0, x1, z1, h, o) {
      o = o || {};
      var fi = o.facade !== undefined ? o.facade : Math.floor(rnd() * facades.length);
      var ft = facadeTile[fi];
      var tint = 0.75 + rnd() * 0.3;
      var col = [tint, tint * (0.95 + rnd() * 0.1), tint * (0.95 + rnd() * 0.12)];
      var y0 = o.y0 || 0.16;
      solid(x0, y0, z0, x1, h, z1, {
        layer: facades[fi], uv: ft[0], uvH: ft[1], col: col, emi: 1, uvOff: [rnd(), 0],
        faces: { py: { layer: TL.concrete, uv: 8, uvH: 8, emi: 0, col: [0.8, 0.8, 0.85] } }, skip: ['ny']
      });
      var bb = { x0: x0, z0: z0, x1: x1, z1: z1, h: h };
      // 屋上の手すり壁(低いビルだけ)
      if (h < 16 && o.parapet !== false) {
        var t = 0.35, ph = 1.0;
        solid(x0, h, z0, x1, h + ph, z0 + t, { layer: TL.concrete, uv: 4, col: [0.7, 0.7, 0.75] });
        solid(x0, h, z1 - t, x1, h + ph, z1, { layer: TL.concrete, uv: 4, col: [0.7, 0.7, 0.75] });
        solid(x0, h, z0 + t, x0 + t, h + ph, z1 - t, { layer: TL.concrete, uv: 4, col: [0.7, 0.7, 0.75] });
        solid(x1 - t, h, z0 + t, x1, h + ph, z1 - t, { layer: TL.concrete, uv: 4, col: [0.7, 0.7, 0.75] });
        // 手すりのネオン
        var nc = pickNeon();
        B.box(x0 - 0.02, h + ph, z0 - 0.02, x1 + 0.02, h + ph + 0.08, z0 + 0.08, { layer: TL.glow, col: nc, emi: 2.5 });
        B.box(x0 - 0.02, h + ph, z1 - 0.08, x1 + 0.02, h + ph + 0.08, z1 + 0.02, { layer: TL.glow, col: nc, emi: 2.5 });
      } else {
        // 高いビルの屋上の縁にネオン線
        var nc2 = pickNeon();
        if (rnd() < 0.7) {
          B.box(x0 - 0.1, h - 0.4, z0 - 0.1, x1 + 0.1, h - 0.2, z0, { layer: TL.glow, col: nc2, emi: 3 });
          B.box(x0 - 0.1, h - 0.4, z1, x1 + 0.1, h - 0.2, z1 + 0.1, { layer: TL.glow, col: nc2, emi: 3 });
          B.box(x0 - 0.1, h - 0.4, z0, x0, h - 0.2, z1, { layer: TL.glow, col: nc2, emi: 3 });
          B.box(x1, h - 0.4, z0, x1 + 0.1, h - 0.2, z1, { layer: TL.glow, col: nc2, emi: 3 });
        }
        // アンテナと赤い点滅灯
        if (rnd() < 0.6) {
          var ax = M.lerp(x0, x1, 0.3 + rnd() * 0.4), az = M.lerp(z0, z1, 0.3 + rnd() * 0.4), ah = 4 + rnd() * 8;
          B.box(ax - 0.12, h, az - 0.12, ax + 0.12, h + ah, az + 0.12, { layer: TL.metal, uv: 2, col: [0.6, 0.6, 0.65] });
          world.beacons.push([ax, h + ah + 0.3, az]);
        }
      }
      // 屋上の室外機・給水タンク
      if (h < 16) {
        var n = 1 + Math.floor(rnd() * 3);
        for (var i = 0; i < n; i++) {
          var w = 1.4 + rnd() * 1.2, d = 1.2 + rnd(), hx = M.lerp(x0 + 1.5, x1 - 1.5 - w, rnd()), hz = M.lerp(z0 + 1.5, z1 - 1.5 - d, rnd());
          if (x1 - x0 < 5 || z1 - z0 < 5) break;
          solid(hx, h, hz, hx + w, h + 1.1 + rnd() * 0.6, hz + d, { layer: TL.metal, uv: 3, col: [0.75, 0.78, 0.8] });
        }
      }
      // 側面の装飾(道に面した面)
      decorateSides(bb, o);
      return bb;
    }

    // 面に看板・店・ネオン線をつける
    function decorateSides(bb, o) {
      var sides = [
        { n: [0, 0, 1], a: [bb.x0, bb.z1], b: [bb.x1, bb.z1] },
        { n: [0, 0, -1], a: [bb.x1, bb.z0], b: [bb.x0, bb.z0] },
        { n: [1, 0, 0], a: [bb.x1, bb.z1], b: [bb.x1, bb.z0] },
        { n: [-1, 0, 0], a: [bb.x0, bb.z0], b: [bb.x0, bb.z1] }
      ];
      sides.forEach(function (s) {
        var len = Math.abs(s.b[0] - s.a[0]) + Math.abs(s.b[1] - s.a[1]);
        var dir = [(s.b[0] - s.a[0]) / len, 0, (s.b[1] - s.a[1]) / len];
        // 道に面しているか(外周の外向きは装飾しない)
        var mx = (s.a[0] + s.b[0]) / 2 + s.n[0] * 2, mz = (s.a[1] + s.b[1]) / 2 + s.n[2] * 2;
        if (Math.abs(mx) > H - 0.5 || Math.abs(mz) > H - 0.5) return;
        var at = function (t, y, out) { return [s.a[0] + dir[0] * t + s.n[0] * out, y, s.a[1] + dir[2] * t + s.n[2] * out]; };
        // 1階の店
        if (o.shops !== false && bb.h > 4) {
          var t = 1 + rnd() * 2;
          while (t < len - 4) {
            var w = 3.5 + rnd() * 2.5;
            if (t + w > len - 1) break;
            var kind = rnd();
            var layer = kind < 0.45 ? TL.shopfront : kind < 0.75 ? TL.shutter : TL.vending;
            if (layer === TL.vending) {
              // 自販機を並べる
              var vn = 1 + Math.floor(rnd() * 3);
              for (var v = 0; v < vn; v++) {
                var vc = at(t + 0.6 + v * 1.1, 0.16, 0.45);
                var vx0 = Math.min(vc[0] - dir[0] * 0.5 - s.n[0] * 0.45, vc[0] + dir[0] * 0.5 + s.n[0] * 0.45);
                var vx1 = Math.max(vc[0] - dir[0] * 0.5 - s.n[0] * 0.45, vc[0] + dir[0] * 0.5 + s.n[0] * 0.45);
                var vz0 = Math.min(vc[2] - dir[2] * 0.5 - s.n[2] * 0.45, vc[2] + dir[2] * 0.5 + s.n[2] * 0.45);
                var vz1 = Math.max(vc[2] - dir[2] * 0.5 - s.n[2] * 0.45, vc[2] + dir[2] * 0.5 + s.n[2] * 0.45);
                var faces = {};
                var fname = s.n[0] > 0.5 ? 'px' : s.n[0] < -0.5 ? 'nx' : s.n[2] > 0.5 ? 'pz' : 'nz';
                faces[fname] = { layer: TL.vending, emi: 0.75, uvRect: [0, 1, 1, 0], col: [0.85, 0.85, 0.85] };
                solid(vx0, 0.16, vz0, vx1, 2.1, vz1, { layer: TL.white, col: [0.32, 0.34, 0.4], faces: faces });
                if (v === 0) light(at(t + 0.6 + v * 1.1, 1.4, 1.4), [0.75, 0.9, 1.0], 6, 0.6);
              }
              t += vn * 1.1 + 1.5;
              continue;
            }
            var c = at(t + w / 2, 1.9, 0.03);
            B.panel(c, w, 3.4, s.n, { layer: layer, uvRect: [0, 1, 1, 0], emi: layer === TL.shopfront ? 0.6 : 0, col: [0.85, 0.85, 0.85] });
            if (layer === TL.shopfront) light(at(t + w / 2, 2.2, 1.6), [1.0, 0.75, 0.5], 7, 0.9);
            // ひさし
            if (rnd() < 0.5) {
              var a0 = at(t, 3.6, 0), a1 = at(t + w, 3.6, 1.4);
              B.box(Math.min(a0[0], a1[0]), 3.55, Math.min(a0[2], a1[2]), Math.max(a0[0], a1[0]), 3.7, Math.max(a0[2], a1[2]), { layer: TL.awning, uv: 2, col: [1, 1, 1] });
            }
            // 横看板
            if (rnd() < 0.75) {
              var sg = NF.T.signs[Math.floor(rnd() * 16)];
              var sc = pickNeon();
              var sw = Math.min(w, 4.4);
              B.panel(at(t + w / 2, 4.5, 0.08), sw, sw / 4, s.n, { layer: sg.layer, uvRect: [sg.rect[0], sg.rect[3], sg.rect[2], sg.rect[1]], emi: 3.2, col: sc });
              light(at(t + w / 2, 4.3, 1.8), sc, 10, 1.6, rnd() < 0.15 ? 1 : 0);
            }
            t += w + 0.6 + rnd() * 2;
          }
        }
        // 縦看板(壁から突き出す)
        var nv = Math.floor(len / 9);
        for (var k = 0; k < nv; k++) {
          if (rnd() < 0.45 || bb.h < 9) continue;
          var tt = 2 + rnd() * (len - 4);
          var sv = NF.T.signs[16 + Math.floor(rnd() * 16)];
          var vcol = pickNeon();
          var hgt = 4 + rnd() * 3;
          var y0 = 5 + rnd() * Math.max(0.1, Math.min(bb.h - hgt - 6, 10));
          var base = at(tt, y0 + hgt / 2, 0.7);
          var hw = 0.6, thick = 0.1;
          var p0 = [base[0] - s.n[0] * 0.6 - dir[0] * thick, base[2] - s.n[2] * 0.6 - dir[2] * thick];
          var p1 = [base[0] + s.n[0] * 0.6 + dir[0] * thick, base[2] + s.n[2] * 0.6 + dir[2] * thick];
          solid(Math.min(p0[0], p1[0]), y0, Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), y0 + hgt, Math.max(p0[1], p1[1]), { layer: TL.white, col: [0.05, 0.05, 0.07] });
          B.panel([base[0] + dir[0] * (thick + 0.01), base[1], base[2] + dir[2] * (thick + 0.01)], hw * 2, hgt, dir,
            { layer: sv.layer, uvRect: [sv.rect[0], sv.rect[3], sv.rect[2], sv.rect[1]], emi: 3.2, col: vcol });
          B.panel([base[0] - dir[0] * (thick + 0.01), base[1], base[2] - dir[2] * (thick + 0.01)], hw * 2, hgt, [-dir[0], 0, -dir[2]],
            { layer: sv.layer, uvRect: [sv.rect[0], sv.rect[3], sv.rect[2], sv.rect[1]], emi: 3.2, col: vcol });
          light(at(tt, y0 + hgt / 2, 1.4), vcol, 12, 1.8, rnd() < 0.2 ? 1 : 0);
        }
        // 壁の縦ネオン線
        if (bb.h > 10 && rnd() < 0.35) {
          var lt = 0.6 + rnd() * (len - 1.2), lc = pickNeon();
          var q0 = at(lt, 4.5, 0.05);
          B.box(q0[0] - 0.07, 4.5, q0[2] - 0.07, q0[0] + 0.07, Math.min(bb.h - 1, 4.5 + 6 + rnd() * 20), q0[2] + 0.07, { layer: TL.glow, col: lc, emi: 3 });
        }
        // 大型ホログラム広告
        if (bb.h > 26 && rnd() < 0.3 && len > 12) {
          var top = rnd() < 0.5;
          var bc = at(len / 2, bb.h - 9, 0.15);
          B.panel(bc, 14, 7, s.n, { layer: TL.billboard, uvRect: top ? [0, 0.5, 1, 0] : [0, 1, 1, 0.5], emi: 1.6, col: [1, 1, 1] });
          light(at(len / 2, bb.h - 9, 4), top ? [1, 0.4, 0.8] : [0.3, 1, 0.9], 22, 1.6);
        }
      });
    }

    // ---- 階段(箱を積む)----
    function stairs(x, z, dirx, dirz, height, width, rot) {
      var steps = Math.ceil(height / 0.45), stepH = height / steps, run = 0.55;
      for (var i = 0; i < steps; i++) {
        var y1 = stepH * (i + 1);
        var a = i * run, b2 = (i + 1) * run;
        var cx0, cz0, cx1, cz1;
        if (dirx) { cx0 = x + dirx * a; cx1 = x + dirx * b2; cz0 = z - width / 2; cz1 = z + width / 2; }
        else { cz0 = z + dirz * a; cz1 = z + dirz * b2; cx0 = x - width / 2; cx1 = x + width / 2; }
        solid(Math.min(cx0, cx1), 0.16, Math.min(cz0, cz1), Math.max(cx0, cx1), y1, Math.max(cz0, cz1), { layer: TL.grate, uv: 1.5, col: [0.8, 0.82, 0.85] });
      }
      void rot;
      return steps * run;
    }
    function pad(x, z, y, power, col, push) {
      solid(x - 1.2, y, z - 1.2, x + 1.2, y + 0.25, z + 1.2, { layer: TL.metal, uv: 2.4, col: [0.5, 0.5, 0.55], faces: { py: { layer: TL.jumppad, uvRect: [0, 0, 1, 1], emi: 3, col: col } } });
      world.pads.push({ x: x, z: z, y: y + 0.25, power: power, col: col, push: push || [0, 0] });
      light([x, y + 1.2, z], col, 8, 2.2);
    }
    function crate(x, z, s, y) {
      y = y || 0.16;
      solid(x - s / 2, y, z - s / 2, x + s / 2, y + s, z + s / 2, { layer: TL.metal, uv: s, col: [0.55 + rnd() * 0.3, 0.5 + rnd() * 0.2, 0.42 + rnd() * 0.2] });
    }
    function barrel(x, z) { world.barrels.push({ p: [x, 0.16, z] }); }

    // ---- ブロックの中身 ----
    blocks.forEach(function (b) {
      var x0 = b.x0, x1 = b.x1, z0 = b.z0, z1 = b.z1, w = x1 - x0, d = z1 - z0;
      var edge = b.ix === 0 || b.ix === 3 || b.iz === 0 || b.iz === 3;
      var minH = edge ? 18 : 8;
      if (b.type === 'tower') {
        building(x0, z0, x1, z1, 30 + rnd() * 40);
      } else if (b.type === 'cluster') {
        // 2〜4棟に分けて路地を作る
        var alley = 2.8 + rnd() * 1.4;
        var splitX = rnd() < 0.5;
        var cut = M.lerp(0.35, 0.65, rnd());
        if (splitX) {
          var cx = x0 + w * cut;
          building(x0, z0, cx - alley / 2, z1, minH + rnd() * 26);
          if (rnd() < 0.5) {
            var cz = z0 + d * M.lerp(0.35, 0.65, rnd());
            building(cx + alley / 2, z0, x1, cz - alley / 2, minH + rnd() * 26);
            building(cx + alley / 2, cz + alley / 2, x1, z1, minH + rnd() * 26);
          } else building(cx + alley / 2, z0, x1, z1, minH + rnd() * 26);
          alleyProps(cx, z0, z1, true);
        } else {
          var cz2 = z0 + d * cut;
          building(x0, z0, x1, cz2 - alley / 2, minH + rnd() * 26);
          building(x0, cz2 + alley / 2, x1, z1, minH + rnd() * 26);
          alleyProps(cz2, x0, x1, false);
        }
      } else if (b.type === 'lowrise') {
        // 低いビル+階段+屋上
        var hh = 4.5 + rnd() * 3.5;
        var inset = 3.6;
        var left = b.ix !== 0; // 階段を左側(-x)に置くか
        var bx0 = left ? x0 + inset : x0, bx1 = left ? (b.ix === 3 ? x1 : x1 - 1) : x1 - inset;
        building(bx0, z0 + 1, bx1, z1 - 1, hh, { shops: true });
        // 屋上へ上がる階段(壁ぞいに)。最上段は手すりの高さ
        var sxc = left ? bx0 - 1.4 : bx1 + 1.4;
        stairs(sxc, z0 + 1.2, 0, 1, hh + 1.0, 2.2);
        crate(sxc, z1 - 2.5, 1.3);
        barrel(sxc + (left ? -0.9 : 0.9), z1 - 5);
      } else if (b.type === 'plaza') {
        plaza(x0, z0, x1, z1);
      } else if (b.type === 'market') {
        market(x0, z0, x1, z1);
      } else {
        construction(x0, z0, x1, z1);
      }
    });

    function alleyProps(c, a0, a1, alongZ) {
      var n = 2 + Math.floor(rnd() * 3);
      for (var i = 0; i < n; i++) {
        var t = M.lerp(a0 + 4, a1 - 4, rnd());
        var off = (rnd() - 0.5) * 1.2;
        if (alongZ) { if (rnd() < 0.5) crate(c + off, t, 1 + rnd() * 0.4); else barrel(c + off, t); }
        else { if (rnd() < 0.5) crate(t, c + off, 1 + rnd() * 0.4); else barrel(t, c + off); }
      }
      // 路地のちょうちん・ネオン
      var lc = pickNeon();
      for (var k = 0; k < 3; k++) {
        var tt = M.lerp(a0 + 3, a1 - 3, (k + 0.5) / 3);
        var p = alongZ ? [c, 3.6, tt] : [tt, 3.6, c];
        B.box(p[0] - 0.3, 3.2, p[2] - 0.3, p[0] + 0.3, 3.9, p[2] + 0.3, { layer: TL.lantern, uvRect: [0, 1, 1, 0], emi: 1.8, col: [1, 1, 1] });
        light(p, [1, 0.45, 0.25], 6, 1.2, 0.3);
      }
      var q = alongZ ? [c, 6.5, (a0 + a1) / 2] : [(a0 + a1) / 2, 6.5, c];
      light(q, lc, 12, 1.2);
      world.vents.push([alongZ ? c : M.lerp(a0, a1, 0.3), 0.2, alongZ ? M.lerp(a0, a1, 0.3) : c]);
    }

    function plaza(x0, z0, x1, z1) {
      var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // 床
      solid(x0 + 1, 0.16, z0 + 1, x1 - 1, 0.3, z1 - 1, { layer: TL.sidewalk, uv: 3, wet: 0.5, col: [0.8, 0.85, 0.9], skip: ['ny'] }, 1);
      // 中央の台座とホログラム
      solid(cx - 2.5, 0.3, cz - 2.5, cx + 2.5, 1.2, cz + 2.5, { layer: TL.concrete, uv: 3, col: [0.6, 0.6, 0.65] });
      B.box(cx - 2.6, 1.15, cz - 2.6, cx + 2.6, 1.25, cz + 2.6, { layer: TL.glow, col: neon[1], emi: 3 });
      world.holos.push({ p: [cx, 1.2, cz], col: neon[0] });
      light([cx, 4, cz], neon[0], 16, 2.2);
      // 囲みの遮蔽物(コの字の低い壁・木箱)
      var spots = [[-0.32, -0.3], [0.32, -0.3], [-0.32, 0.3], [0.32, 0.3], [0, -0.4], [0, 0.4], [-0.42, 0], [0.42, 0]];
      spots.forEach(function (s) {
        var px = cx + s[0] * (x1 - x0), pz = cz + s[1] * (z1 - z0);
        var r = rnd();
        if (r < 0.35) {
          var horiz = Math.abs(s[1]) > Math.abs(s[0]);
          if (horiz) solid(px - 2, 0.3, pz - 0.3, px + 2, 1.3, pz + 0.3, { layer: TL.concrete, uv: 2, col: [0.65, 0.65, 0.7] });
          else solid(px - 0.3, 0.3, pz - 2, px + 0.3, 1.3, pz + 2, { layer: TL.concrete, uv: 2, col: [0.65, 0.65, 0.7] });
        } else if (r < 0.75) {
          crate(px, pz, 1.3, 0.3); if (rnd() < 0.5) crate(px + 1.2, pz + 0.2, 1.1, 0.3); if (rnd() < 0.3) crate(px + 0.1, pz, 1.0, 1.6);
        } else barrel(px, pz);
      });
      // ジャンプ台(四隅)
      pad(x0 + 3, z0 + 3, 0.3, 19, neon[1], [-3, -3]);
      pad(x1 - 3, z1 - 3, 0.3, 19, neon[1], [3, 3]);
      // 端末(制圧ポイント)
      world.terminals.push([cx, 0.3, cz]);
    }

    function market(x0, z0, x1, z1) {
      solid(x0 + 0.5, 0.16, z0 + 0.5, x1 - 0.5, 0.26, z1 - 0.5, { layer: TL.concrete, uv: 4, wet: 0.6, col: [0.6, 0.58, 0.55], skip: ['ny'] }, 1);
      var cols = Math.max(2, Math.floor((x1 - x0) / 7)), rows = Math.max(2, Math.floor((z1 - z0) / 7));
      for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
        if (rnd() < 0.25) continue;
        var cx = M.lerp(x0 + 3.5, x1 - 3.5, (i + 0.5) / cols), cz = M.lerp(z0 + 3.5, z1 - 3.5, (j + 0.5) / rows);
        // 屋台: カウンター+柱+屋根
        solid(cx - 1.4, 0.26, cz - 0.9, cx + 1.4, 1.1, cz + 0.9, { layer: TL.metal, uv: 2, col: [0.7, 0.45, 0.3] });
        B.box(cx - 1.5, 2.5, cz - 1.2, cx + 1.5, 2.65, cz + 1.2, { layer: TL.awning, uv: 2.5, col: [1, 1, 1] });
        addCollider(cx - 1.5, 2.5, cz - 1.2, cx + 1.5, 2.65, cz + 1.2);
        [[-1.4, -1.1], [1.4, -1.1], [-1.4, 1.1], [1.4, 1.1]].forEach(function (q) {
          B.box(cx + q[0] - 0.05, 1.1, cz + q[1] - 0.05, cx + q[0] + 0.05, 2.5, cz + q[1] + 0.05, { layer: TL.white, col: [0.3, 0.3, 0.3] });
        });
        B.box(cx - 0.25, 1.9, cz + 1.1, cx + 0.25, 2.45, cz + 1.4, { layer: TL.lantern, uvRect: [0, 1, 1, 0], emi: 1.8, col: [1, 1, 1] });
        light([cx, 2.0, cz + 1.6], [1, 0.5, 0.25], 7, 1.1, 0.25);
      }
      // 上を渡るちょうちんの列
      for (var k = 0; k < 6; k++) {
        var lx = M.lerp(x0 + 2, x1 - 2, k / 5);
        B.box(lx - 0.25, 4.0, (z0 + z1) / 2 - 0.25, lx + 0.25, 4.6, (z0 + z1) / 2 + 0.25, { layer: TL.lantern, uvRect: [0, 1, 1, 0], emi: 1.8, col: [1, 1, 1] });
      }
      B.box(x0 + 2, 4.6, (z0 + z1) / 2 - 0.02, x1 - 2, 4.64, (z0 + z1) / 2 + 0.02, { layer: TL.white, col: [0.1, 0.1, 0.1] });
      light([(x0 + x1) / 2, 4.3, (z0 + z1) / 2], [1, 0.5, 0.3], 14, 1.4);
      barrel(x0 + 1.5, z0 + 1.5); barrel(x1 - 1.5, z1 - 1.5);
    }

    function construction(x0, z0, x1, z1) {
      // 足場(3段)+コンテナ
      var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      var levels = [3.2, 6.4];
      var px0 = x0 + 2, px1 = x1 - 2, pz0 = z0 + 2, pz1 = cz + 2;
      levels.forEach(function (y, li) {
        var shrink = li * 2;
        solid(px0 + shrink, y, pz0, px1 - shrink, y + 0.3, pz1 - shrink, { layer: TL.grate, uv: 1.6, col: [0.75, 0.7, 0.55] });
        // 支柱
        [[px0 + shrink, pz0], [px1 - shrink, pz0], [px0 + shrink, pz1 - shrink], [px1 - shrink, pz1 - shrink]].forEach(function (q) {
          solid(q[0] - 0.15, 0.16, q[1] - 0.15, q[0] + 0.15, y, q[1] + 0.15, { layer: TL.metal, uv: 1, col: [0.85, 0.6, 0.2] });
        });
        // 黄色の警告ライト
        B.box(px0 + shrink, y + 0.3, pz0 - 0.05, px1 - shrink, y + 0.38, pz0 + 0.05, { layer: TL.glow, col: [1, 0.7, 0.1], emi: 2.5 });
        light([cx, y + 1, pz0], [1, 0.65, 0.2], 10, 1.0);
      });
      // 階段
      stairs(px0 + 0.8, pz1 + Math.ceil(3.5 / 0.45) * 0.55, 0, -1, 3.5, 1.6);
      // 1段目→2段目は階段の代わりにジャンプ台
      pad(px1 - 4, pz0 + 2.5, 3.5, 13, neon[2]);
      // コンテナ
      var ccol = [[0.7, 0.2, 0.15], [0.15, 0.35, 0.6], [0.2, 0.5, 0.3], [0.8, 0.55, 0.15]];
      for (var i = 0; i < 3; i++) {
        var hx = M.lerp(x0 + 2, x1 - 9, rnd()), hz = M.lerp(cz + 4, z1 - 4, i / 3 + 0.1);
        var col = ccol[Math.floor(rnd() * 4)];
        solid(hx, 0.16, hz, hx + 7, 2.7, hz + 2.6, { layer: TL.metal, uv: 2.6, col: col });
        if (rnd() < 0.4) solid(hx + 0.5, 2.7, hz, hx + 7.5, 5.24, hz + 2.6, { layer: TL.metal, uv: 2.6, col: ccol[Math.floor(rnd() * 4)] });
      }
      barrel(x1 - 2, z1 - 2); barrel(x0 + 2, z1 - 2);
    }

    // ---- 高架(道路の上の歩道橋レール)----
    (function () {
      var alongX = rnd() < 0.5, rc = roads[Math.floor(rnd() * 3)];
      var y = 7.6, half = 2.6;
      var run = Math.ceil((y + 0.6) / 0.45) * 0.55;
      var a = -H + 1 + run, b = H - 1 - run;
      var col = [0.55, 0.55, 0.6];
      if (alongX) {
        solid(a, y, rc - half, b, y + 0.6, rc + half, { layer: TL.concrete, uv: 4, col: col, faces: { py: { layer: TL.grate, uv: 1.8, col: [0.7, 0.72, 0.75] } } });
        solid(a, y + 0.6, rc - half, b, y + 1.6, rc - half + 0.2, { layer: TL.grate, uv: 1.2, col: [0.6, 0.6, 0.65] });
        solid(a, y + 0.6, rc + half - 0.2, b, y + 1.6, rc + half, { layer: TL.grate, uv: 1.2, col: [0.6, 0.6, 0.65] });
        B.box(a, y - 0.12, rc - half - 0.05, b, y, rc - half + 0.05, { layer: TL.glow, col: neon[1], emi: 3 });
        B.box(a, y - 0.12, rc + half - 0.05, b, y, rc + half + 0.05, { layer: TL.glow, col: neon[0], emi: 3 });
        for (var x = a + 6; x < b; x += 14) {
          solid(x - 0.5, 0, rc - 0.5, x + 0.5, y, rc + 0.5, { layer: TL.concrete, uv: 3, col: col });
          light([x, y - 1, rc], neon[(x / 14 | 0) % 2 ? 0 : 1], 11, 1.3);
        }
        stairs(a - run, rc, 1, 0, y + 0.6, 2.4);
        stairs(b + run, rc, -1, 0, y + 0.6, 2.4);
        world.rail = { alongX: true, c: rc, y: y + 0.6 };
      } else {
        solid(rc - half, y, a, rc + half, y + 0.6, b, { layer: TL.concrete, uv: 4, col: col, faces: { py: { layer: TL.grate, uv: 1.8, col: [0.7, 0.72, 0.75] } } });
        solid(rc - half, y + 0.6, a, rc - half + 0.2, y + 1.6, b, { layer: TL.grate, uv: 1.2, col: [0.6, 0.6, 0.65] });
        solid(rc + half - 0.2, y + 0.6, a, rc + half, y + 1.6, b, { layer: TL.grate, uv: 1.2, col: [0.6, 0.6, 0.65] });
        B.box(rc - half - 0.05, y - 0.12, a, rc - half + 0.05, y, b, { layer: TL.glow, col: neon[1], emi: 3 });
        B.box(rc + half - 0.05, y - 0.12, a, rc + half + 0.05, y, b, { layer: TL.glow, col: neon[0], emi: 3 });
        for (var z = a + 6; z < b; z += 14) {
          solid(rc - 0.5, 0, z - 0.5, rc + 0.5, y, z + 0.5, { layer: TL.concrete, uv: 3, col: col });
          light([rc, y - 1, z], neon[(z / 14 | 0) % 2 ? 0 : 1], 11, 1.3);
        }
        stairs(rc, a - run, 0, 1, y + 0.6, 2.4);
        stairs(rc, b + run, 0, -1, y + 0.6, 2.4);
        world.rail = { alongX: false, c: rc, y: y + 0.6 };
      }
      // 高架へのジャンプ台(交差点)
      roads.forEach(function (q) {
        if (rnd() < 0.5) return;
        var px = alongX ? q + 7 : rc + 4.4, pz = alongX ? rc + 4.4 : q + 7;
        pad(px, pz, 0, 21, neon[2], alongX ? [0, -3.2] : [-3.2, 0]);
      });
    })();

    // ---- 街灯 ----
    roads.forEach(function (rc) {
      for (var t = -H + 8; t < H - 4; t += 16) {
        if (roads.some(function (q) { return Math.abs(t - q) < 8; })) continue;
        [[rc - RW - 0.8, t], [rc + RW + 0.8, t + 8], [t, rc - RW - 0.8], [t + 8, rc + RW + 0.8]].forEach(function (q, k) {
          if (Math.abs(q[0]) > H - 2 || Math.abs(q[1]) > H - 2) return;
          solid(q[0] - 0.1, 0.16, q[1] - 0.1, q[0] + 0.1, 5.2, q[1] + 0.1, { layer: TL.metal, uv: 1, col: [0.35, 0.36, 0.4] });
          var ox = k === 0 ? 0.9 : k === 1 ? -0.9 : 0, oz = k === 2 ? 0.9 : k === 3 ? -0.9 : 0;
          B.box(q[0] + ox - 0.35, 5.0, q[1] + oz - 0.35, q[0] + ox + 0.35, 5.15, q[1] + oz + 0.35, { layer: TL.glow, col: [0.75, 0.95, 1.0], emi: 2.5 });
          light([q[0] + ox, 4.8, q[1] + oz], [0.55, 0.75, 1.0], 11, 1.1, rnd() < 0.1 ? 1 : 0);
        });
      }
    });

    // ---- 外周の壁(道の行き止まり)と遠景のビル群 ----
    roads.forEach(function (rc) {
      [-1, 1].forEach(function (sgn) {
        var e = sgn * (H + 0.5);
        // バリケード(ネオン付き)
        solid(rc - RW - SW, 0, e - 0.5, rc + RW + SW, 4, e + 0.5, { layer: TL.shutter, uv: 4, col: [0.8, 0.8, 0.85], skip: ['ny'] });
        solid(e - 0.5, 0, rc - RW - SW, e + 0.5, 4, rc + RW + SW, { layer: TL.shutter, uv: 4, col: [0.8, 0.8, 0.85], skip: ['ny'] });
        B.box(rc - RW - SW, 4, e - 0.55, rc + RW + SW, 4.15, e + 0.55, { layer: TL.glow, col: [1, 0.25, 0.2], emi: 3 });
        B.box(e - 0.55, 4, rc - RW - SW, e + 0.55, 4.15, rc + RW + SW, { layer: TL.glow, col: [1, 0.25, 0.2], emi: 3 });
        // 封鎖された道の先に高い壁(見えない壁の代わり)
        addCollider(rc - RW - SW, 0, sgn > 0 ? e : e - 30, rc + RW + SW, 60, sgn > 0 ? e + 30 : e, 0);
        addCollider(sgn > 0 ? e : e - 30, 0, rc - RW - SW, sgn > 0 ? e + 30 : e, 60, rc + RW + SW, 0);
      });
    });
    // 外周の見えない壁
    addCollider(-H - 50, 0, -H - 50, H + 50, 80, -H - 0.2, 0);
    addCollider(-H - 50, 0, H + 0.2, H + 50, 80, H + 50, 0);
    addCollider(-H - 50, 0, -H - 50, -H - 0.2, 80, H + 50, 0);
    addCollider(H + 0.2, 0, -H - 50, H + 50, 80, H + 50, 0);

    // 遠景(当たり判定なし)
    var far = new R.Builder();
    for (var ring = 0; ring < 3; ring++) {
      var rr = 95 + ring * 45;
      var count = 26 + ring * 10;
      for (var i = 0; i < count; i++) {
        var ang = i / count * Math.PI * 2 + rnd() * 0.1;
        var cxf = Math.cos(ang) * rr, czf = Math.sin(ang) * rr;
        var ww = 14 + rnd() * 18, hh = 35 + rnd() * (60 + ring * 40);
        var fi = Math.floor(rnd() * 6), ft = facadeTile[fi];
        far.box(cxf - ww / 2, 0, czf - ww / 2, cxf + ww / 2, hh, czf + ww / 2, { layer: facades[fi], uv: ft[0], uvH: ft[1], emi: 1.2, col: [0.8, 0.8, 0.9], uvOff: [rnd(), 0], skip: ['ny', 'py'] });
        if (rnd() < 0.35) {
          var sv = NF.T.signs[16 + Math.floor(rnd() * 16)];
          var nrm = M.norm([-cxf, 0, -czf]);
          var sp = [cxf + nrm[0] * (ww / 2 + 0.3), hh * (0.4 + rnd() * 0.4), czf + nrm[2] * (ww / 2 + 0.3)];
          far.panel(sp, 4, 14, nrm, { layer: sv.layer, uvRect: [sv.rect[0], sv.rect[3], sv.rect[2], sv.rect[1]], emi: 4, col: pickNeon() });
        }
        if (rnd() < 0.25) {
          var nrm2 = M.norm([-cxf, 0, -czf]);
          far.panel([cxf + nrm2[0] * (ww / 2 + 0.3), hh * 0.75, czf + nrm2[2] * (ww / 2 + 0.3)], ww * 0.9, ww * 0.45, nrm2, { layer: TL.billboard, uvRect: rnd() < 0.5 ? [0, 0.5, 1, 0] : [0, 1, 1, 0.5], emi: 2.2, col: [1, 1, 1] });
        }
        if (rnd() < 0.5) world.beacons.push([cxf, hh + 1, czf]);
      }
    }
    // 外周ブロック外側の地面
    far.floor(-260, -260, 260, 260, -0.02, { layer: TL.asphalt, uv: 12, wet: 0.6, col: [0.5, 0.5, 0.55] });

    world.meshes = [B.build(), far.build()];
    world.lightsAll = world.lights.slice();

    // ---- 当たり判定の検索用(8m 格子)----
    var CELL = 8, GN = Math.ceil((H * 2 + 120) / CELL), GOFF = H + 60;
    world.grid = new Array(GN * GN);
    world.boxes.forEach(function (b, idx) {
      var cx0 = Math.max(0, Math.floor((b[0] + GOFF) / CELL)), cx1 = Math.min(GN - 1, Math.floor((b[3] + GOFF) / CELL));
      var cz0 = Math.max(0, Math.floor((b[2] + GOFF) / CELL)), cz1 = Math.min(GN - 1, Math.floor((b[5] + GOFF) / CELL));
      for (var gx = cx0; gx <= cx1; gx++) for (var gz = cz0; gz <= cz1; gz++) {
        var k = gx * GN + gz;
        (world.grid[k] || (world.grid[k] = [])).push(idx);
      }
    });
    world.cellOf = function (x, z) {
      var gx = Math.floor((x + GOFF) / CELL), gz = Math.floor((z + GOFF) / CELL);
      if (gx < 0 || gz < 0 || gx >= GN || gz >= GN) return null;
      return world.grid[gx * GN + gz] || null;
    };
    // 範囲内の箱を集める
    var stamp = 1, marks = new Int32Array(world.boxes.length);
    world.query = function (x0, z0, x1, z1, out) {
      stamp++;
      out.length = 0;
      var gx0 = Math.max(0, Math.floor((x0 + GOFF) / CELL)), gx1 = Math.min(GN - 1, Math.floor((x1 + GOFF) / CELL));
      var gz0 = Math.max(0, Math.floor((z0 + GOFF) / CELL)), gz1 = Math.min(GN - 1, Math.floor((z1 + GOFF) / CELL));
      for (var gx = gx0; gx <= gx1; gx++) for (var gz = gz0; gz <= gz1; gz++) {
        var l = world.grid[gx * GN + gz]; if (!l) continue;
        for (var i = 0; i < l.length; i++) { var id = l[i]; if (marks[id] !== stamp) { marks[id] = stamp; out.push(id); } }
      }
      return out;
    };
    // 光線を街に当てる(格子をたどる)
    world.raycast = function (o, d, maxT) {
      var best = maxT, bn = null, bid = -1;
      var x = o[0], z = o[2];
      var steps = Math.ceil(maxT / (CELL * 0.5)) + 1;
      stamp++;
      var stepLen = CELL * 0.5;
      for (var s = 0; s <= steps; s++) {
        var t0 = s * stepLen;
        if (t0 > best + CELL) break;
        var px = x + d[0] * t0, pz = z + d[2] * t0;
        // そのまわり 2x2 セル
        var gx0 = Math.floor((px - CELL * 0.5 + GOFF) / CELL), gz0 = Math.floor((pz - CELL * 0.5 + GOFF) / CELL);
        for (var ix = 0; ix < 2; ix++) for (var iz = 0; iz < 2; iz++) {
          var gx = gx0 + ix, gz = gz0 + iz;
          if (gx < 0 || gz < 0 || gx >= GN || gz >= GN) continue;
          var l = world.grid[gx * GN + gz]; if (!l) continue;
          for (var i = 0; i < l.length; i++) {
            var id = l[i]; if (marks[id] === stamp) continue; marks[id] = stamp;
            var t = M.rayBox(o, d, world.boxes[id], best);
            if (t >= 0 && t < best) { best = t; bn = M._hitN.slice(); bid = id; }
          }
        }
      }
      // 地面
      if (d[1] < 0) { var tg = -o[1] / d[1]; if (tg >= 0 && tg < best) { best = tg; bn = [0, 1, 0]; bid = 0; } }
      return bn ? { t: best, n: bn, id: bid } : null;
    };

    // ---- 敵の通り道(2m 格子の地図)----
    var NC = 2, NN = Math.ceil(H * 2 / NC);
    var nav = new Uint8Array(NN * NN);
    for (var gx = 0; gx < NN; gx++) for (var gz = 0; gz < NN; gz++) {
      var wx = -H + (gx + 0.5) * NC, wz = -H + (gz + 0.5) * NC;
      var l = world.cellOf(wx, wz) || [];
      var blocked = 0;
      for (var k = 0; k < l.length; k++) {
        var bb = world.boxes[l[k]];
        if (bb[6] === 1) continue; // 床
        if (bb[4] < 0.6) continue;  // 低い段差は通れる
        if (bb[1] > 2.0) continue;  // 頭の上
        // セルの中心付近 ±0.7m にかかるか
        if (wx + 0.7 > bb[0] && wx - 0.7 < bb[3] && wz + 0.7 > bb[2] && wz - 0.7 < bb[5]) { blocked = 1; break; }
      }
      nav[gx * NN + gz] = blocked;
    }
    world.nav = { cell: NC, n: NN, grid: nav, dist: new Float32Array(NN * NN) };
    // 出現場所の候補
    for (gx = 1; gx < NN - 1; gx += 2) for (gz = 1; gz < NN - 1; gz += 2) {
      if (!nav[gx * NN + gz]) world.spawns.push([-H + (gx + 0.5) * NC, 0.2, -H + (gz + 0.5) * NC]);
    }
    // 自分のスタート位置: 広場の近く
    var pb = blocks[plazaId];
    world.start = [(pb.x0 + pb.x1) / 2, 0.4, pb.z1 + SW + 2.5];
    world.plaza = [(pb.x0 + pb.x1) / 2, 0, (pb.z0 + pb.z1) / 2];
    world.startYaw = 0;
    world.blocks = blocks;
    world.roads = roads;
    return world;
  };

  // 足もとの高さ(x,z の位置で、y 以下にある一番高い床)
  C.groundAt = function (world, x, z, y, r) {
    var best = 0, tmp = C._tmp || (C._tmp = []);
    r = r || 0;
    world.query(x - r, z - r, x + r, z + r, tmp);
    for (var i = 0; i < tmp.length; i++) {
      var b = world.boxes[tmp[i]];
      if (x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5] && b[4] <= y + 0.01 && b[4] > best) best = b[4];
    }
    return best;
  };

  // 敵の通り道: 目標地点からの距離を広げていく(幅優先探索)
  C.flowField = function (world, tx, tz) {
    var N = world.nav, n = N.n, g = N.grid, d = N.dist, H = world.half;
    d.fill(1e9);
    var sx = M.clamp(Math.floor((tx + H) / N.cell), 0, n - 1), sz = M.clamp(Math.floor((tz + H) / N.cell), 0, n - 1);
    var q = C._q || (C._q = new Int32Array(n * n)), qh = 0, qt = 0;
    // 目標が壁の中なら近くの空きマスから
    var starts = [];
    for (var r = 0; r < 6 && !starts.length; r++) {
      for (var ix = -r; ix <= r; ix++) for (var iz = -r; iz <= r; iz++) {
        var x = sx + ix, z = sz + iz;
        if (x < 0 || z < 0 || x >= n || z >= n) continue;
        if (!g[x * n + z]) starts.push(x * n + z);
      }
    }
    starts.forEach(function (s) { d[s] = 0; q[qt++] = s; });
    var dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (qh < qt) {
      var c = q[qh++], cx = (c / n) | 0, cz = c - cx * n, cd = d[c];
      for (var k = 0; k < 8; k++) {
        var nx = cx + dirs[k][0], nz = cz + dirs[k][1];
        if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
        var ni = nx * n + nz;
        if (g[ni]) continue;
        if (k >= 4 && (g[(cx + dirs[k][0]) * n + cz] || g[cx * n + cz + dirs[k][1]])) continue; // 角をすり抜けない
        var nd = cd + dirs[k][2];
        if (nd < d[ni]) { d[ni] = nd; q[qt++] = ni; if (qt >= q.length) qt = q.length - 1; }
      }
    }
  };
  // 通り道にそって進む向き
  C.flowDir = function (world, x, z) {
    var N = world.nav, n = N.n, H = world.half, d = N.dist;
    var cx = Math.floor((x + H) / N.cell), cz = Math.floor((z + H) / N.cell);
    if (cx < 0 || cz < 0 || cx >= n || cz >= n) return [-x, 0, -z];
    var best = d[cx * n + cz], bx = 0, bz = 0;
    for (var ix = -1; ix <= 1; ix++) for (var iz = -1; iz <= 1; iz++) {
      var nx = cx + ix, nz = cz + iz;
      if (nx < 0 || nz < 0 || nx >= n || nz >= n || (!ix && !iz)) continue;
      var v = d[nx * n + nz];
      if (v < best) { best = v; bx = ix; bz = iz; }
    }
    if (!bx && !bz) return null;
    // 目標マスの中心へ
    var tx = -H + (cx + bx + 0.5) * N.cell, tz = -H + (cz + bz + 0.5) * N.cell;
    return M.norm([tx - x, 0, tz - z]);
  };
  C.navDist = function (world, x, z) {
    var N = world.nav, n = N.n, H = world.half;
    var cx = Math.floor((x + H) / N.cell), cz = Math.floor((z + H) / N.cell);
    if (cx < 0 || cz < 0 || cx >= n || cz >= n) return 1e9;
    return N.dist[cx * n + cz];
  };

  NF.City = C;
})();
