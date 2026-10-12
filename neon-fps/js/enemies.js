// 夜光区 — 敵(暴走したアンドロイドたち)
// 種類ごとに動き方・攻撃・弱点がちがう
(function () {
  var M = NF.M, m4 = M.m4, R = NF.R, S = NF.S, City = NF.City;
  var E = {};

  function P(mesh, x, y, z, sx, sy, sz, col, emi, tag, pivot, rx, ry, rz) {
    return { mesh: mesh, p: [x, y, z], s: [sx, sy, sz], col: col, emi: emi || 0, tag: tag, pivot: pivot, r: [rx || 0, ry || 0, rz || 0] };
  }
  var ARM = [0.62, 0.64, 0.68], DK = [0.12, 0.12, 0.14], MD = [0.3, 0.31, 0.34], JNT = [0.2, 0.2, 0.22];

  // ---------------- 種類 ----------------
  E.TYPES = {
    grunt: {
      name: '警備アンドロイド', hp: 95, speed: 4.2, radius: 0.4, height: 1.85, score: 100, credits: 25,
      hit: [{ p: [0, 1.72, 0], r: 0.17, head: 1 }, { p: [0, 1.28, 0], r: 0.33 }, { p: [0, 0.6, 0], r: 0.26 }],
      build: function (c) {
        return [
          P('cube', 0, 0.95, 0, 0.34, 0.18, 0.22, DK),
          P('cube', 0, 1.3, 0, 0.46, 0.5, 0.28, ARM, 0, 'torso'),
          P('cube', 0, 1.36, -0.145, 0.3, 0.035, 0.01, c, 4, 'torso'),
          P('cube', 0, 1.1, -0.145, 0.18, 0.12, 0.01, DK, 0, 'torso'),
          P('cube', 0, 1.6, 0, 0.12, 0.08, 0.12, JNT, 0, 'torso'),
          P('cube', 0, 1.74, 0, 0.24, 0.26, 0.26, ARM, 0, 'head'),
          P('cube', 0, 1.75, -0.135, 0.21, 0.06, 0.02, c, 5, 'head'),
          P('cube', 0, 0, 0, 0.14, 0.46, 0.16, MD, 0, 'legL', [-0.11, 0.9, 0], 0, 0, 0),
          P('cube', 0, 0, 0, 0.14, 0.46, 0.16, MD, 0, 'legR', [0.11, 0.9, 0]),
          P('cube', 0, 0, 0, 0.12, 0.58, 0.14, ARM, 0, 'armL', [-0.3, 1.5, 0]),
          P('cube', 0, 0, 0, 0.12, 0.58, 0.14, ARM, 0, 'armR', [0.3, 1.5, 0]),
          P('cube', 0.18, 1.28, -0.42, 0.08, 0.13, 0.55, DK, 0, 'gun'),
          P('cube', 0.18, 1.28, -0.7, 0.03, 0.03, 0.02, c, 3, 'muzzle')
        ];
      }
    },
    drone: {
      name: '偵察ドローン', hp: 45, speed: 7, radius: 0.5, height: 0.8, fly: true, score: 80, credits: 20,
      hit: [{ p: [0, 0, -0.32], r: 0.14, head: 1 }, { p: [0, 0, 0], r: 0.45 }],
      build: function (c) {
        return [
          P('sphere', 0, 0, 0, 0.62, 0.5, 0.62, ARM, 0, 'body'),
          P('cyl', 0, 0, 0, 1.15, 0.06, 1.15, DK, 0, 'ring'),
          P('cyl', 0, 0.0, 0, 1.17, 0.025, 1.17, c, 3, 'ring'),
          P('sphere', 0, 0, -0.27, 0.2, 0.2, 0.12, c, 6, 'body'),
          P('cube', 0, -0.32, 0, 0.08, 0.18, 0.08, DK, 0, 'body'),
          P('cube', 0, -0.42, -0.08, 0.06, 0.06, 0.22, MD, 0, 'body')
        ];
      }
    },
    rusher: {
      name: '電脳猟犬', hp: 60, speed: 9.5, radius: 0.45, height: 0.95, score: 90, credits: 22,
      hit: [{ p: [0, 0.78, -0.62], r: 0.2, head: 1 }, { p: [0, 0.62, 0], r: 0.42 }],
      build: function (c) {
        return [
          P('cube', 0, 0.62, 0, 0.42, 0.34, 1.0, MD, 0, 'body'),
          P('cube', 0, 0.82, 0.05, 0.3, 0.06, 0.8, c, 3, 'body'),
          P('cube', 0, 0.78, -0.62, 0.3, 0.26, 0.36, ARM, 0, 'head'),
          P('cube', 0, 0.7, -0.8, 0.22, 0.1, 0.12, DK, 0, 'head'),
          P('cube', -0.08, 0.84, -0.79, 0.06, 0.04, 0.02, [1, 0.2, 0.2], 6, 'head'),
          P('cube', 0.08, 0.84, -0.79, 0.06, 0.04, 0.02, [1, 0.2, 0.2], 6, 'head'),
          P('cube', 0, 0, 0, 0.1, 0.5, 0.1, DK, 0, 'legFL', [-0.17, 0.55, -0.38]),
          P('cube', 0, 0, 0, 0.1, 0.5, 0.1, DK, 0, 'legFR', [0.17, 0.55, -0.38]),
          P('cube', 0, 0, 0, 0.1, 0.5, 0.1, DK, 0, 'legBL', [-0.17, 0.55, 0.38]),
          P('cube', 0, 0, 0, 0.1, 0.5, 0.1, DK, 0, 'legBR', [0.17, 0.55, 0.38]),
          P('cube', 0, 0.75, 0.62, 0.05, 0.05, 0.4, c, 3, 'tail', null, 0.5)
        ];
      }
    },
    sniper: {
      name: '狙撃型', hp: 75, speed: 3.6, radius: 0.4, height: 1.9, score: 140, credits: 35,
      hit: [{ p: [0, 1.76, 0], r: 0.16, head: 1 }, { p: [0, 1.3, 0], r: 0.3 }, { p: [0, 0.6, 0], r: 0.24 }],
      build: function (c) {
        var red = [1, 0.15, 0.25];
        return [
          P('cube', 0, 0.95, 0, 0.3, 0.18, 0.2, DK),
          P('cube', 0, 1.32, 0, 0.38, 0.5, 0.24, [0.18, 0.17, 0.2], 0, 'torso'),
          P('cube', 0, 1.0, 0.0, 0.5, 0.75, 0.3, [0.1, 0.09, 0.11], 0, 'torso'), // 外套
          P('cube', 0, 1.77, 0, 0.22, 0.24, 0.24, [0.25, 0.24, 0.27], 0, 'head'),
          P('sphere', 0.0, 1.78, -0.13, 0.09, 0.09, 0.04, red, 7, 'head'),
          P('cube', 0, 0, 0, 0.12, 0.46, 0.14, DK, 0, 'legL', [-0.1, 0.9, 0]),
          P('cube', 0, 0, 0, 0.12, 0.46, 0.14, DK, 0, 'legR', [0.1, 0.9, 0]),
          P('cube', 0, 0, 0, 0.1, 0.56, 0.12, DK, 0, 'armL', [-0.26, 1.52, 0]),
          P('cube', 0, 0, 0, 0.1, 0.56, 0.12, DK, 0, 'armR', [0.26, 1.52, 0]),
          P('cube', 0.12, 1.42, -0.55, 0.06, 0.1, 1.1, MD, 0, 'gun'),
          P('cube', 0.12, 1.52, -0.4, 0.07, 0.07, 0.2, DK, 0, 'gun'),
          P('cube', 0.12, 1.42, -1.1, 0.03, 0.03, 0.02, red, 4, 'muzzle'),
          P('cube', 0, 1.32, -0.13, 0.04, 0.3, 0.01, c, 3, 'torso')
        ];
      }
    },
    heavy: {
      name: '重装兵', hp: 420, speed: 2.7, radius: 0.75, height: 2.6, score: 300, credits: 80, shieldHp: 320,
      hit: [{ p: [0, 1.25, -0.95], r: 0.85, shield: 1 }, { p: [0, 2.38, 0], r: 0.24, head: 1 }, { p: [0, 1.75, 0], r: 0.55 }, { p: [0, 0.85, 0], r: 0.45 }],
      build: function (c) {
        var A2 = [0.45, 0.42, 0.38];
        return [
          P('cube', 0, 1.25, 0, 0.6, 0.3, 0.4, DK),
          P('cube', 0, 1.8, 0, 0.95, 0.85, 0.6, A2, 0, 'torso'),
          P('cube', 0, 1.95, -0.31, 0.7, 0.06, 0.02, c, 4, 'torso'),
          P('cube', 0, 2.38, -0.05, 0.36, 0.3, 0.36, A2, 0, 'head'),
          P('cube', 0, 2.38, -0.24, 0.3, 0.07, 0.02, c, 5, 'head'),
          P('cube', 0.55, 2.4, 0.1, 0.35, 0.35, 0.8, DK, 0, 'torso'), // 肩のロケット
          P('cyl', 0.55, 2.4, -0.32, 0.22, 0.05, 0.22, c, 2, 'torso', null, Math.PI / 2),
          P('cube', 0, 0, 0, 0.26, 0.75, 0.3, MD, 0, 'legL', [-0.24, 1.2, 0]),
          P('cube', 0, 0, 0, 0.26, 0.75, 0.3, MD, 0, 'legR', [0.24, 1.2, 0]),
          P('cube', 0, 0, 0, 0.22, 0.8, 0.26, A2, 0, 'armR', [0.62, 2.1, 0]),
          P('cube', 0, 0, 0, 0.22, 0.8, 0.26, A2, 0, 'armL', [-0.62, 2.1, 0]),
          // 盾
          P('cube', 0, 1.3, -0.85, 1.25, 1.55, 0.08, [0.25, 0.75, 1.0], 1.2, 'shield'),
          P('cube', 0, 1.3, -0.83, 1.3, 0.06, 0.1, c, 4, 'shield')
        ];
      }
    },
    ninja: {
      name: '電脳忍者', hp: 120, speed: 7.2, radius: 0.4, height: 1.8, score: 180, credits: 45,
      hit: [{ p: [0, 1.68, 0], r: 0.16, head: 1 }, { p: [0, 1.25, 0], r: 0.3 }, { p: [0, 0.6, 0], r: 0.24 }],
      build: function (c) {
        var BL = [0.06, 0.06, 0.08];
        return [
          P('cube', 0, 0.95, 0, 0.3, 0.16, 0.2, BL),
          P('cube', 0, 1.27, 0, 0.36, 0.48, 0.22, BL, 0, 'torso'),
          P('cube', 0, 1.27, -0.115, 0.03, 0.44, 0.01, c, 4, 'torso'),
          P('cube', 0, 1.68, 0, 0.21, 0.24, 0.23, BL, 0, 'head'),
          P('cube', 0, 1.7, -0.12, 0.19, 0.03, 0.01, c, 6, 'head'),
          P('cube', 0, 1.72, 0.15, 0.04, 0.04, 0.4, c, 2, 'scarf', null, -0.4),
          P('cube', 0, 0, 0, 0.12, 0.46, 0.14, BL, 0, 'legL', [-0.1, 0.9, 0]),
          P('cube', 0, 0, 0, 0.12, 0.46, 0.14, BL, 0, 'legR', [0.1, 0.9, 0]),
          P('cube', 0, 0, 0, 0.1, 0.55, 0.12, BL, 0, 'armL', [-0.25, 1.48, 0]),
          P('cube', 0, 0, 0, 0.1, 0.55, 0.12, BL, 0, 'armR', [0.25, 1.48, 0]),
          P('cube', 0.3, 1.1, -0.55, 0.03, 0.05, 0.9, [0.9, 0.95, 1], 0.5, 'blade'),
          P('cube', 0.3, 1.08, -0.55, 0.008, 0.01, 0.9, c, 5, 'blade')
        ];
      }
    },
    boss: {
      name: '鬼神 ONI-零式', hp: 3000, speed: 2.4, radius: 1.8, height: 5.4, score: 3000, credits: 600, boss: true,
      hit: [{ p: [0, 3.7, 1.05], r: 0.55, head: 1, core: 1 }, { p: [0, 4.75, -0.35], r: 0.55, head: 1 }, { p: [0, 3.5, 0], r: 1.35 }, { p: [0, 1.6, 0], r: 0.9 }],
      build: function (c) {
        var A2 = [0.3, 0.29, 0.32], RD = [0.6, 0.12, 0.12];
        return [
          P('cube', 0, 2.4, 0, 1.6, 0.5, 1.1, DK),
          P('cube', 0, 3.55, 0, 2.4, 1.8, 1.6, A2, 0, 'torso'),
          P('cube', 0, 3.75, -0.81, 1.8, 0.1, 0.03, c, 4, 'torso'),
          P('cube', 0, 3.2, -0.81, 0.6, 0.5, 0.03, RD, 1.5, 'torso'),
          P('sphere', 0, 3.7, 0.85, 0.8, 0.8, 0.5, [1, 0.3, 0.2], 5, 'core'),
          P('cube', 0, 4.75, -0.3, 0.9, 0.7, 0.8, RD, 0, 'head'),
          P('cube', 0, 4.8, -0.71, 0.7, 0.12, 0.03, [1, 0.85, 0.3], 6, 'head'),
          P('cone', -0.38, 5.35, -0.3, 0.16, 0.6, 0.16, [0.9, 0.85, 0.7], 0, 'head', null, 0, 0, 0.35),
          P('cone', 0.38, 5.35, -0.3, 0.16, 0.6, 0.16, [0.9, 0.85, 0.7], 0, 'head', null, 0, 0, -0.35),
          P('cube', -1.5, 4.3, 0.1, 0.8, 0.7, 1.2, DK, 0, 'pod'),
          P('cube', -1.5, 4.3, -0.51, 0.6, 0.5, 0.03, c, 3, 'pod'),
          P('cube', 0, 0, 0, 0.6, 2.2, 0.7, A2, 0, 'legL', [-0.65, 2.3, 0]),
          P('cube', 0, 0, 0, 0.6, 2.2, 0.7, A2, 0, 'legR', [0.65, 2.3, 0]),
          P('cube', 0, 0, 0, 0.5, 1.8, 0.55, A2, 0, 'armR', [1.5, 4.0, 0]),
          P('cyl', 1.5, 2.6, -0.6, 0.45, 1.4, 0.45, DK, 0, 'gun', null, Math.PI / 2),
          P('cyl', 1.5, 2.6, -1.32, 0.3, 0.05, 0.3, c, 3, 'gun', null, Math.PI / 2)
        ];
      }
    }
  };

  // ---------------- 強化個体(エリート)の特性 ----------------
  E.AFFIX = {
    armored: { name: '装甲', col: [0.7, 0.8, 1.0] },
    swift: { name: '俊足', col: [0.4, 1.0, 0.6] },
    volatile: { name: '爆裂', col: [1.0, 0.5, 0.15] },
    splitter: { name: '分裂', col: [0.9, 0.4, 1.0] },
    regen: { name: '再生', col: [0.3, 1.0, 0.9] }
  };

  var nextId = 1;
  E.spawn = function (G, type, pos, opt) {
    opt = opt || {};
    var T = E.TYPES[type];
    var lvl = G.run.district;
    var hpMul = (1 + (lvl - 1) * 0.2) * (opt.elite ? 2.2 : 1) * (G.run.mut.armorAll ? 1.3 : 1);
    var col = opt.col || G.neonFor(type);
    var e = {
      id: nextId++, type: type, T: T, p: pos.slice(), v: [0, 0, 0], yaw: Math.random() * 6.28, hp: T.hp * hpMul, maxHp: T.hp * hpMul,
      parts: T.build(col), col: col, state: 'idle', t: 0, atk: 1 + Math.random() * 2, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0,
      onGround: true, animT: Math.random() * 10, flash: 0, alive: true, alert: false, elite: opt.elite || null, shield: T.shieldHp ? T.shieldHp * (1 + (lvl - 1) * 0.15) : 0,
      dmgMul: 1 + (lvl - 1) * 0.1, spd: T.speed * (G.run.mut.fast ? 1.3 : 1), needles: 0, needleT: 0, stun: 0, marked: !!opt.marked,
      hover: 5 + Math.random() * 4, phase: 0, aimT: 0, aimDir: null, laser: 0, chain: 0, spawnT: 0.8, armor: 0, lastHurt: 0, burst: 0
    };
    if (e.elite) {
      if (e.elite === 'armored') e.armor = e.maxHp * 0.6;
      if (e.elite === 'swift') e.spd *= 1.45;
    }
    if (type === 'drone') e.p[1] = Math.max(e.p[1], 4 + Math.random() * 3);
    if (T.fly || type === 'boss') e.snd = S.loop3d(type === 'boss' ? 'boss' : 'drone', e.p);
    G.enemies.push(e);
    G.fx.spawnIn(e);
    return e;
  };

  // ---------------- 行動 ----------------
  var tmpList = [];
  function moveGround(G, e, dir, speed, dt) {
    // 歩く(壁にそって滑る)
    var acc = e.onGround ? 14 : 3;
    e.v[0] = M.damp(e.v[0], dir[0] * speed, acc, dt);
    e.v[2] = M.damp(e.v[2], dir[2] * speed, acc, dt);
  }
  function physics(G, e, dt) {
    var w = G.world, r = e.T.radius, h = e.T.height;
    if (!e.T.fly) e.v[1] -= G.gravity * dt;
    // 敵同士で押し合う
    for (var i = 0; i < G.enemies.length; i++) {
      var o = G.enemies[i]; if (o === e || !o.alive) continue;
      var dx = e.p[0] - o.p[0], dz = e.p[2] - o.p[2], dd = dx * dx + dz * dz, rr = r + o.T.radius;
      if (dd < rr * rr && dd > 0.0001 && Math.abs(e.p[1] - o.p[1]) < 2) { var d = Math.sqrt(dd), push = (rr - d) * 4; e.v[0] += dx / d * push; e.v[2] += dz / d * push; }
    }
    for (var ax = 0; ax < 3; ax++) {
      e.p[ax] += e.v[ax] * dt;
      w.query(e.p[0] - r - 1, e.p[2] - r - 1, e.p[0] + r + 1, e.p[2] + r + 1, tmpList);
      for (var k = 0; k < tmpList.length; k++) {
        var b = w.boxes[tmpList[k]];
        if (e.p[0] + r <= b[0] || e.p[0] - r >= b[3] || e.p[2] + r <= b[2] || e.p[2] - r >= b[5] || e.p[1] + h <= b[1] || e.p[1] >= b[4]) continue;
        if (ax === 1) {
          if (e.v[1] <= 0) { e.p[1] = b[4]; e.v[1] = 0; e.onGround = true; } else { e.p[1] = b[1] - h; e.v[1] = 0; }
        } else {
          // 低い段差は登る
          if (!e.T.fly && b[4] - e.p[1] <= 0.55 && e.onGround) { e.p[1] = b[4]; continue; }
          if (ax === 0) { e.p[0] = e.v[0] > 0 ? b[0] - r : b[3] + r; e.v[0] = 0; e.blocked = 0.5; }
          else { e.p[2] = e.v[2] > 0 ? b[2] - r : b[5] + r; e.v[2] = 0; e.blocked = 0.5; }
        }
      }
    }
    if (!e.T.fly) {
      if (e.p[1] <= 0) { e.p[1] = 0; if (e.v[1] < 0) e.v[1] = 0; e.onGround = true; }
      else if (e.v[1] < -0.5) e.onGround = false;
      var g = City.groundAt(w, e.p[0], e.p[2], e.p[1] + 0.05, r * 0.5);
      if (e.p[1] - g > 0.08 && e.v[1] <= 0) e.onGround = false;
    }
    var H = w.half - 1;
    e.p[0] = M.clamp(e.p[0], -H, H); e.p[2] = M.clamp(e.p[2], -H, H);
  }
  function faceTo(e, tx, tz, k, dt) {
    var want = Math.atan2(-(tx - e.p[0]), -(tz - e.p[2]));
    e.yaw += M.wrapAngle(want - e.yaw) * (1 - Math.exp(-k * dt));
  }
  function eyeOf(e) { return [e.p[0], e.p[1] + e.T.height * 0.85, e.p[2]]; }
  E.eyeOf = eyeOf;
  // 敵から見た向きの点(体のローカル座標 → 世界)
  function local(e, x, y, z) {
    var c = Math.cos(e.yaw), s = Math.sin(e.yaw);
    return [e.p[0] + x * c + z * s, e.p[1] + y, e.p[2] - x * s + z * c];
  }
  E.local = local;

  // 次の攻撃までの時間
  function cd(G, a, b) { return (a + Math.random() * (b - a)) * (G.run.mut.fast ? 0.75 : 1); }

  E.update = function (G, dt) {
    var pl = G.player, peye = G.eyePos();
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (!e.alive) continue;
      e.t += dt; e.flash = Math.max(0, e.flash - dt * 6); e.blocked = Math.max(0, (e.blocked || 0) - dt);
      e.lastHurt += dt;
      if (e.spawnT > 0) { e.spawnT -= dt; continue; }
      if (e.stun > 0) { e.stun -= dt; e.v[0] *= 0.9; e.v[2] *= 0.9; physics(G, e, dt); continue; }
      if (e.elite === 'regen' && e.lastHurt > 2.5) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.06 * dt);
      var eye = eyeOf(e);
      var toP = M.sub(peye, eye), dist = M.len(toP), dist2 = M.dist2(e.p, pl.p);
      // 見えるか(0.25秒ごとに確認)
      e.losT = (e.losT || 0) - dt;
      if (e.losT <= 0) {
        e.losT = 0.2 + Math.random() * 0.15;
        var hit = G.world.raycast(eye, M.norm(toP), dist);
        e.los = !hit;
        if (e.los && !e.alert && dist < 70) { e.alert = true; if (Math.random() < 0.5) S.enemyAlert(e.p, e.type); }
      }
      if (!e.alert && e.t > 2.5) e.alert = true; // 波で呼ばれた敵はすぐ動く
      e.atk -= dt;
      var AI = AIS[e.type] || AIS.grunt;
      AI(G, e, dt, dist, dist2, toP);
      physics(G, e, dt);
      e.animT += dt * M.clamp(Math.hypot(e.v[0], e.v[2]) / 2, 0, 4);
      if (e.snd) e.snd.set(e.p);
      // 落ちた・はまった
      if (e.p[1] < -5) { e.alive = false; if (e.snd) e.snd.stop(); }
    }
  };

  // 地上の敵の基本の動き: 距離をとりつつ横に動く
  function groundMove(G, e, dt, dist2, lo, hi) {
    var pl = G.player, dir;
    var speed = e.spd;
    if (!e.los || dist2 > hi) {
      dir = City.flowDir(G.world, e.p[0], e.p[2]) || M.norm([pl.p[0] - e.p[0], 0, pl.p[2] - e.p[2]]);
    } else {
      var to = M.norm([pl.p[0] - e.p[0], 0, pl.p[2] - e.p[2]]);
      var side = [-to[2] * e.strafe, 0, to[0] * e.strafe];
      e.strafeT -= dt;
      if (e.strafeT <= 0 || e.blocked > 0) { e.strafe = -e.strafe; e.strafeT = 1.2 + Math.random() * 2; }
      var fwd = dist2 < lo ? -0.8 : dist2 > (lo + hi) / 2 ? 0.5 : 0;
      dir = M.norm(M.add(M.mul(side, 0.9), M.mul(to, fwd)));
      speed *= 0.7;
    }
    moveGround(G, e, dir, speed, dt);
    return dir;
  }

  var AIS = {
    grunt: function (G, e, dt, dist, dist2, toP) {
      groundMove(G, e, dt, dist2, 9, 24);
      faceTo(e, G.player.p[0], G.player.p[2], e.los ? 10 : 6, dt);
      if (!e.los) { if (e.atk < 0.4) e.atk = 0.4; return; }
      if (e.atk <= 0 && dist < 55) {
        // 3連射(撃つ前に銃口が光る)
        if (e.burst <= 0) { e.burst = 3; e.charge = 0.35; }
      }
      if (e.burst > 0) {
        e.charge -= dt;
        if (e.charge <= 0) {
          var mz = local(e, 0.18, 1.28, -0.75);
          var lead = M.madd(G.eyePos(), G.player.v, dist / 60 * 0.6);
          lead[1] -= 0.25;
          var dir = NF.W.coneDir(M.norm(M.sub(lead, mz)), (2.2 - Math.min(1.5, G.run.district * 0.1)) * Math.PI / 180);
          G.enemyShot('bolt', mz, dir, 6 * e.dmgMul, e);
          S.shoot('enemy', { pos: mz });
          e.burst--; e.charge = 0.11;
          if (e.burst <= 0) e.atk = cd(G, 1.6, 2.8);
        }
      }
    },
    drone: function (G, e, dt, dist, dist2, toP) {
      var pl = G.player;
      // 目標地点: プレイヤーのまわりを回る
      e.orbit = (e.orbit || Math.random() * 6) + dt * 0.45 * e.strafe;
      var want = 15;
      var tx = pl.p[0] + Math.cos(e.orbit) * want, tz = pl.p[2] + Math.sin(e.orbit) * want;
      var ground = City.groundAt(G.world, e.p[0], e.p[2], 200, 0.5);
      var ty = Math.max(pl.p[1] + e.hover, ground + 3);
      var d = [tx - e.p[0], ty - e.p[1], tz - e.p[2]];
      var L = M.len(d) || 1;
      var sp = Math.min(e.spd, L * 1.5);
      // 前方にビルがあれば上へ
      var mv = M.norm([d[0], 0, d[2]]);
      var ahead = G.world.raycast(e.p, mv, 4);
      if (ahead) { d[1] += 8; e.hover = Math.min(e.hover + dt * 3, 20); }
      e.v[0] = M.damp(e.v[0], d[0] / L * sp, 3, dt);
      e.v[1] = M.damp(e.v[1], d[1] / L * sp + Math.sin(e.t * 2) * 0.6, 3, dt);
      e.v[2] = M.damp(e.v[2], d[2] / L * sp, 3, dt);
      faceTo(e, pl.p[0], pl.p[2], 6, dt);
      if (e.los && e.atk <= 0 && dist < 45) {
        e.atk = cd(G, 1.4, 2.4);
        var mz = local(e, 0, 0, -0.4);
        G.enemyShot('plasma', mz, M.norm(M.sub(M.madd(G.eyePos(), pl.v, dist / 24 * 0.5), mz)), 9 * e.dmgMul, e);
        S.shoot('laser', { pos: mz });
      }
    },
    rusher: function (G, e, dt, dist, dist2, toP) {
      var pl = G.player;
      e.leapCD = (e.leapCD || 0) - dt;
      if (e.state === 'leap') {
        if (!e.didHit && M.dist(M.add(e.p, [0, 0.6, 0]), M.add(pl.p, [0, 0.9, 0])) < 1.3) {
          e.didHit = true; G.damagePlayer(17 * e.dmgMul, e.p, e);
        }
        if (e.onGround && e.t - e.leapStart > 0.25) { e.state = 'run'; e.leapCD = 1.4; }
        return;
      }
      var dir = (!e.los || dist2 > 6) ? (City.flowDir(G.world, e.p[0], e.p[2]) || M.norm([pl.p[0] - e.p[0], 0, pl.p[2] - e.p[2]])) : M.norm([pl.p[0] - e.p[0], 0, pl.p[2] - e.p[2]]);
      // 少し蛇行
      var wob = Math.sin(e.t * 3 + e.id) * 0.35;
      dir = M.norm([dir[0] + dir[2] * wob, 0, dir[2] - dir[0] * wob]);
      moveGround(G, e, dir, e.spd, dt);
      faceTo(e, e.p[0] + e.v[0], e.p[2] + e.v[2], 10, dt);
      if (e.los && dist2 < 8 && dist2 > 2 && e.leapCD <= 0 && e.onGround) {
        var to = M.norm(M.sub(M.add(pl.p, M.mul(pl.v, 0.3)), e.p));
        e.v = [to[0] * 13, 5.5 + Math.max(0, pl.p[1] - e.p[1]) * 1.2, to[2] * 13];
        e.state = 'leap'; e.leapStart = e.t; e.didHit = false; e.onGround = false;
        S.leap(e.p);
      } else if (e.los && dist2 < 1.6 && e.atk <= 0) {
        e.atk = 0.8; G.damagePlayer(10 * e.dmgMul, e.p, e);
      }
    },
    sniper: function (G, e, dt, dist, dist2, toP) {
      var pl = G.player;
      if (e.aimT > 0) {
        // 狙っている: レーザーが少し遅れてついてくる
        e.v[0] *= 0.8; e.v[2] *= 0.8;
        var want = M.norm(M.sub(G.eyePos(), eyeOf(e)));
        e.aimDir = e.aimDir ? M.norm(M.add(M.mul(e.aimDir, 1 - Math.min(1, dt * 3.2)), M.mul(want, Math.min(1, dt * 3.2)))) : want;
        faceTo(e, pl.p[0], pl.p[2], 8, dt);
        e.aimT -= dt;
        if (e.aimT <= 0) {
          var mz = local(e, 0.12, 1.42, -1.12);
          G.enemyRay(mz, e.aimDir, 32 * e.dmgMul, e);
          S.shoot('sniper', { pos: mz });
          e.aimDir = null; e.atk = cd(G, 2.8, 4.2);
        }
        return;
      }
      var dir;
      if (dist2 < 22 && e.los) {
        // 近すぎる: 離れる
        var away = M.norm([e.p[0] - pl.p[0], 0, e.p[2] - pl.p[2]]);
        dir = M.norm([away[0] + away[2] * 0.5 * e.strafe, 0, away[2] - away[0] * 0.5 * e.strafe]);
        moveGround(G, e, dir, e.spd, dt);
      } else groundMove(G, e, dt, dist2, 28, 60);
      faceTo(e, pl.p[0], pl.p[2], 6, dt);
      if (e.los && e.atk <= 0 && dist < 90) { e.aimT = 1.35; S.sniperCharge(e.p); }
    },
    heavy: function (G, e, dt, dist, dist2, toP) {
      var pl = G.player;
      groundMove(G, e, dt, dist2, 7, 16);
      faceTo(e, pl.p[0], pl.p[2], 2.5, dt);
      e.stepT = (e.stepT || 0) + dt * Math.hypot(e.v[0], e.v[2]);
      if (e.stepT > 1.4) { e.stepT = 0; S.stomp(e.p, false); }
      if (dist2 < 4 && e.atk <= 0.5) {
        e.atk = 2.2; G.shockwave(e.p, 6, 20 * e.dmgMul, e); S.stomp(e.p, true);
        return;
      }
      if (e.los && e.atk <= 0 && dist < 50) {
        e.atk = cd(G, 2.6, 3.6);
        var mz = local(e, 0.55, 2.4, -0.4);
        var tgt = M.madd(pl.p, pl.v, dist / 20 * 0.5); tgt[1] += 0.3;
        G.enemyShot('rocket', mz, M.norm(M.sub(tgt, mz)), 22 * e.dmgMul, e);
        S.shoot('rocket', { pos: mz });
      }
    },
    ninja: function (G, e, dt, dist, dist2, toP) {
      var pl = G.player;
      e.tpCD = (e.tpCD || 2 + Math.random() * 2) - dt;
      if (e.state === 'dash') {
        e.dashT -= dt;
        if (e.dashT <= 0) e.state = 'run';
        if (dist2 < 2.4 && e.atk <= 0) { e.atk = 1.0; G.damagePlayer(22 * e.dmgMul, e.p, e); G.fx.slashArc(e); S.slash(false); }
        return;
      }
      var dir = City.flowDir(G.world, e.p[0], e.p[2]) || M.norm([pl.p[0] - e.p[0], 0, pl.p[2] - e.p[2]]);
      if (e.los && dist2 < 14) dir = M.norm([pl.p[0] - e.p[0], 0, pl.p[2] - e.p[2]]);
      moveGround(G, e, dir, e.spd, dt);
      faceTo(e, pl.p[0], pl.p[2], 12, dt);
      if (e.los && e.tpCD <= 0 && dist2 > 6 && dist2 < 30) {
        // 横へ瞬間移動 → 突進
        var to = M.norm([pl.p[0] - e.p[0], 0, pl.p[2] - e.p[2]]);
        var side = [-to[2] * e.strafe, 0, to[0] * e.strafe];
        var target = M.add(pl.p, M.add(M.mul(side, 5), M.mul(to, -3)));
        var test = G.world.raycast([e.p[0], e.p[1] + 1, e.p[2]], M.norm(M.sub(target, e.p)), M.dist(target, e.p));
        if (!test) {
          G.fx.teleport(e.p, e.col); S.teleport(e.p);
          e.p = [target[0], Math.max(pl.p[1] - 0.5, e.p[1]), target[2]];
          G.fx.teleport(e.p, e.col);
          e.state = 'dash'; e.dashT = 0.5;
          var d2 = M.norm([pl.p[0] - e.p[0], 0, pl.p[2] - e.p[2]]);
          e.v = [d2[0] * 15, 2, d2[2] * 15];
        }
        e.tpCD = 3 + Math.random() * 2; e.strafe = -e.strafe;
      } else if (dist2 < 2.2 && e.atk <= 0) {
        e.atk = 1.1; G.damagePlayer(20 * e.dmgMul, e.p, e); G.fx.slashArc(e); S.slash(false);
      }
    },
    boss: function (G, e, dt, dist, dist2, toP) {
      var pl = G.player, hpk = e.hp / e.maxHp;
      var phase = hpk > 0.66 ? 0 : hpk > 0.33 ? 1 : 2;
      if (phase !== e.phase) {
        e.phase = phase; G.ui.banner(phase === 1 ? '鬼神、ミサイル展開' : '鬼神、暴走状態', 'red'); S.alarm();
        if (phase >= 1) { for (var k = 0; k < 2 + phase; k++) G.spawnNear('drone', e.p, 6); }
      }
      var spd = e.spd * (phase === 2 ? 1.5 : 1);
      groundMove(G, e, dt, dist2, 10, 22);
      e.v[0] *= spd / e.spd; e.v[2] *= spd / e.spd;
      faceTo(e, pl.p[0], pl.p[2], 2 + phase, dt);
      e.stepT = (e.stepT || 0) + dt * Math.hypot(e.v[0], e.v[2]);
      if (e.stepT > 2.2) { e.stepT = 0; S.stomp(e.p, true); G.shake(0.15); }
      e.pattern = e.pattern || 0;
      if (e.busy > 0) {
        e.busy -= dt;
        if (e.mode === 'minigun') {
          e.fireT = (e.fireT || 0) - dt;
          if (e.fireT <= 0) {
            e.fireT = phase === 2 ? 0.05 : 0.07;
            var mz = local(e, 1.5, 2.6, -1.4);
            var sweep = Math.sin(e.busy * 2.2) * 0.12;
            var tgt = M.add(G.eyePos(), [Math.cos(e.yaw) * sweep * dist, -0.3, -Math.sin(e.yaw) * sweep * dist]);
            G.enemyShot('bolt', mz, NF.W.coneDir(M.norm(M.sub(tgt, mz)), 0.035), 5 * e.dmgMul, e);
            S.shoot('enemy', { pos: mz, pitch: 0.7 });
          }
        } else if (e.mode === 'beam') {
          e.beamAng += dt * e.beamDir * (phase === 2 ? 1.1 : 0.8);
          var o = local(e, 0, 4.8, -0.8);
          var bd = [-Math.sin(e.yaw + e.beamAng), -0.12, -Math.cos(e.yaw + e.beamAng)];
          bd[1] = (pl.p[1] + 0.8 - o[1]) / 30;
          bd = M.norm(bd);
          e.beam = { o: o, d: bd };
          G.beamHazard(o, bd, 60, 30 * dt * e.dmgMul, e);
        }
        if (e.busy <= 0) { e.mode = null; e.beam = null; }
        return;
      }
      if (dist2 < 7 && e.atk <= 1) {
        e.atk = 2.6; G.shockwave(e.p, 14, 26 * e.dmgMul, e); S.stomp(e.p, true); S.explode(e.p, 1.2); G.shake(0.6); return;
      }
      if (e.atk <= 0 && e.los) {
        var pats = phase === 0 ? ['minigun', 'shock'] : phase === 1 ? ['minigun', 'missiles', 'shock'] : ['beam', 'missiles', 'minigun'];
        var pick = pats[e.pattern++ % pats.length];
        if (pick === 'minigun') { e.mode = 'minigun'; e.busy = 2.4; S.enemyAlert(e.p, 'heavy'); }
        else if (pick === 'missiles') {
          for (var m = 0; m < 4 + phase * 2; m++) {
            (function (m) {
              G.after(m * 0.14, function () {
                if (!e.alive) return;
                var mz = local(e, -1.5, 4.6, -0.5);
                var d = M.norm([Math.sin(m * 1.3) * 0.5, 1, Math.cos(m * 1.3) * 0.5 - 0.3]);
                G.enemyShot('missile', mz, d, 16 * e.dmgMul, e);
                S.missile(mz);
              });
            })(m);
          }
        } else if (pick === 'shock') { G.shockwave(e.p, 16, 24 * e.dmgMul, e); S.stomp(e.p, true); G.shake(0.6); }
        else if (pick === 'beam') {
          e.mode = 'beam'; e.busy = 3.2; e.beamDir = Math.random() < 0.5 ? 1 : -1; e.beamAng = -e.beamDir * 0.9; S.alarm();
        }
        e.atk = cd(G, 2.4, 3.4) * (phase === 2 ? 0.7 : 1);
      }
    }
  };

  // ---------------- 当たり判定 ----------------
  // 光線とすべての敵: 当たった中で一番近いもの(pierce なら全部)
  E.rayHits = function (G, o, d, maxT) {
    var res = [];
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i]; if (!e.alive || e.spawnT > 0.3) continue;
      // 大まかに
      var c = [e.p[0], e.p[1] + e.T.height * 0.5, e.p[2]];
      if (M.raySphere(o, d, c, e.T.height * 0.75 + 1.2, maxT) < 0) continue;
      var best = -1, bh = null;
      for (var k = 0; k < e.T.hit.length; k++) {
        var h = e.T.hit[k];
        if (h.shield && e.shield <= 0) continue;
        var hp = local(e, h.p[0], h.p[1], h.p[2]);
        var t = M.raySphere(o, d, hp, h.r * (h.head ? 1.15 : 1), maxT);
        if (t >= 0 && (best < 0 || t < best)) { best = t; bh = h; }
      }
      if (best >= 0) res.push({ e: e, t: best, h: bh });
    }
    res.sort(function (a, b) { return a.t - b.t; });
    return res;
  };

  // ---------------- 描画 ----------------
  var tA = new Float32Array(16), tB = new Float32Array(16), root = new Float32Array(16);
  var MESH = function (n) { return n === 'cube' ? R.cube : n === 'sphere' ? R.sphere : n === 'cyl' ? R.cyl : R.cone; };
  E.draw = function (G, out, time) {
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i]; if (!e.alive) continue;
      var sp = e.spawnT > 0 ? 1 - e.spawnT / 0.8 : 1;
      var scale = e.type === 'boss' ? 1 : (e.elite ? 1.12 : 1);
      m4.compose(root, e.p[0], e.p[1] + (e.T.fly ? Math.sin(time * 3 + e.id) * 0.1 : 0), e.p[2], 0, e.yaw, 0, scale, scale * sp, scale);
      var spd = Math.hypot(e.v[0], e.v[2]);
      var walk = Math.sin(e.animT * 4.2) * M.clamp(spd / 3, 0, 1);
      var fl = e.flash;
      for (var k = 0; k < e.parts.length; k++) {
        var p = e.parts[k];
        if (p.tag === 'shield' && e.shield <= 0) continue;
        var ax = p.r[0], ay = p.r[1], az = p.r[2];
        var px = p.p[0], py = p.p[1], pz = p.p[2];
        if (p.pivot) {
          var sw = 0;
          if (p.tag === 'legL' || p.tag === 'legFL' || p.tag === 'legBR') sw = walk * 0.7;
          if (p.tag === 'legR' || p.tag === 'legFR' || p.tag === 'legBL') sw = -walk * 0.7;
          if (p.tag === 'armL') sw = -walk * 0.5 + (e.type === 'heavy' ? 1.3 : 0);
          if (p.tag === 'armR') sw = (e.type === 'grunt' || e.type === 'sniper' || e.type === 'boss') ? 1.45 : walk * 0.5;
          if (e.type === 'rusher' && e.state === 'leap') sw = p.tag.indexOf('F') > 0 ? 1.2 : -1.0;
          if (e.type === 'ninja' && p.tag === 'armR') sw = 1.2;
          // 支点で回す: ルート * T(支点) * R * T(-高さ半分)
          m4.compose(tA, p.pivot[0], p.pivot[1], p.pivot[2], sw + ax, ay, az, 1, 1, 1);
          m4.mul(tB, root, tA);
          m4.compose(tA, 0, -p.s[1] / 2, 0, 0, 0, 0, p.s[0], p.s[1], p.s[2]);
        } else {
          if (p.tag === 'ring') { ay = time * 6; }
          if (p.tag === 'head' && e.type === 'grunt') { ay = Math.sin(time * 0.7 + e.id) * 0.2; }
          if (p.tag === 'tail') { ay = Math.sin(time * 8) * 0.4; }
          if (p.tag === 'scarf') { ay = Math.sin(time * 5 + e.id) * 0.3; }
          if (p.tag === 'blade' && e.state === 'dash') { ay = -0.8; }
          tB.set(root);
          m4.compose(tA, px, py, pz, ax, ay, az, p.s[0], p.s[1], p.s[2]);
        }
        var m = new Float32Array(16);
        m4.mul(m, tB, tA);
        var c = p.col, emi = p.emi;
        if (p.tag === 'muzzle' && e.burst > 0) emi = 8;
        if (p.tag === 'shield') { emi = 1.2 + Math.sin(time * 10) * 0.3 + fl * 2; }
        if (p.tag === 'core') emi = 4 + Math.sin(time * 6) * 1.5;
        // 被弾で白く光る
        var tint = [M.lerp(c[0], 1, fl * 0.8), M.lerp(c[1], 1, fl * 0.8), M.lerp(c[2], 1, fl * 0.8), emi + fl * 2.5];
        if (e.elite && !emi) { var ac = E.AFFIX[e.elite].col; tint[0] = M.lerp(tint[0], ac[0], 0.25); tint[1] = M.lerp(tint[1], ac[1], 0.25); tint[2] = M.lerp(tint[2], ac[2], 0.25); tint[3] += 0.12; }
        out.push({ mesh: MESH(p.mesh), m: m, tint: tint });
      }
    }
  };

  NF.E = E;
})();
