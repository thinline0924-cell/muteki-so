// 夜光区 — 光と粒の演出
// 火花・爆発・煙・雨・弾道・弾痕・飛び散る部品・ホログラム
(function () {
  var M = NF.M, m4 = M.m4, R = NF.R;
  var F = {};
  var parts = [], tracers = [], decals = [], debris = [], lights = [], rings = [], arcs = [];
  var rain = [], splashes = [];
  F.rainAmt = 1;

  F.reset = function () { parts.length = tracers.length = decals.length = debris.length = lights.length = rings.length = arcs.length = 0; splashes.length = 0; };

  function add(o) { if (parts.length < 3000) parts.push(o); return o; }
  F.light = function (p, c, r, i, life) { lights.push({ p: p.slice(), c: c, r: r, i: i, life: life, max: life }); };

  // 火花
  F.sparks = function (p, n, col, speed, dir) {
    for (var i = 0; i < n; i++) {
      var v = [Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5];
      v = M.mul(M.norm(dir ? M.add(M.mul(M.norm(v), 0.7), dir) : v), (speed || 8) * (0.3 + Math.random()));
      add({ p: p.slice(), v: v, life: 0.25 + Math.random() * 0.35, max: 0.6, size: 0.05 + Math.random() * 0.05, col: col || [1, 0.75, 0.35], shape: 1, grav: 14, drag: 1.5, add: true, streak: true });
    }
  };
  // 煙
  F.smoke = function (p, n, size, col, rise) {
    for (var i = 0; i < n; i++) {
      add({ p: M.add(p, [(Math.random() - 0.5) * size, (Math.random() - 0.5) * size * 0.5, (Math.random() - 0.5) * size]), v: [(Math.random() - 0.5) * 1.5, (rise || 1) * (0.5 + Math.random()), (Math.random() - 0.5) * 1.5],
        life: 1.2 + Math.random() * 1.5, max: 2.7, size: size * (0.6 + Math.random() * 0.6), grow: size * 0.8, col: col || [0.12, 0.11, 0.13, 0.55], shape: 3, grav: -0.3, drag: 1.2, add: false, rot: Math.random() * 6 });
    }
  };
  // 着弾
  F.impact = function (p, n, col, enemy) {
    F.sparks(p, enemy ? 7 : 5, col || [1, 0.8, 0.4], 7, n);
    add({ p: M.madd(p, n, 0.05), v: [0, 0, 0], life: 0.08, max: 0.08, size: enemy ? 0.7 : 0.45, col: col || [1, 0.8, 0.5], shape: 0, add: true });
    if (!enemy) {
      F.smoke(M.madd(p, n, 0.1), 1, 0.35, [0.3, 0.3, 0.32, 0.35], 0.5);
      decals.push({ p: p.slice(), n: n.slice(), size: 0.14 + Math.random() * 0.06, life: 14, max: 14, glow: 0.6 });
      if (decals.length > 160) decals.shift();
    } else {
      // 冷却液(青いしぶき)
      for (var i = 0; i < 4; i++) add({ p: p.slice(), v: M.mul(M.add(n, [Math.random() - 0.5, Math.random(), Math.random() - 0.5]), 3), life: 0.5, max: 0.5, size: 0.08, col: [0.2, 0.8, 1, 0.9], shape: 3, grav: 12, drag: 1, add: false });
    }
  };
  // 爆発
  F.explosion = function (p, size, col) {
    size = size || 1; col = col || [1, 0.55, 0.2];
    add({ p: p.slice(), v: [0, 0, 0], life: 0.12, max: 0.12, size: 6 * size, col: [1, 0.9, 0.7], shape: 0, add: true });
    for (var i = 0; i < 26 * size; i++) {
      var d = M.norm([Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5]);
      add({ p: M.madd(p, d, 0.3), v: M.mul(d, 6 + Math.random() * 6 * size), life: 0.35 + Math.random() * 0.35, max: 0.7, size: (0.8 + Math.random() * 1.2) * size, grow: 1.5 * size, col: [col[0], col[1] * (0.6 + Math.random() * 0.5), col[2]], shape: 0, grav: -2, drag: 4, add: true });
    }
    F.sparks(p, 30 * size, [1, 0.7, 0.3], 16 * size);
    F.smoke(p, 10 * size, 2.2 * size, [0.09, 0.08, 0.1, 0.7], 2);
    rings.push({ p: [p[0], Math.max(0.05, p[1] - 0.5), p[2]], r: 0.5, max: 6 * size, life: 0.45, maxLife: 0.45, col: col });
    F.light(p, [1, 0.6, 0.3], 14 * size, 6, 0.45);
    decals.push({ p: [p[0], 0.02, p[2]], n: [0, 1, 0], size: 3 * size, life: 20, max: 20, glow: 0, scorch: true });
  };
  // 敵が出てくる光
  F.spawnIn = function (e) {
    var p = [e.p[0], e.p[1] + e.T.height / 2, e.p[2]];
    rings.push({ p: [e.p[0], e.p[1] + 0.05, e.p[2]], r: 2.5, max: 0.2, life: 0.8, maxLife: 0.8, col: e.col, shrink: true });
    for (var i = 0; i < 18; i++) add({ p: [p[0] + (Math.random() - 0.5) * 1.2, e.p[1] + Math.random() * e.T.height, p[2] + (Math.random() - 0.5) * 1.2], v: [0, 2 + Math.random() * 3, 0], life: 0.7, max: 0.7, size: 0.12, col: e.col, shape: 1, streak: true, add: true });
    F.light(p, e.col, 8, 2.5, 0.8);
  };
  F.teleport = function (p, col) {
    for (var i = 0; i < 24; i++) add({ p: [p[0] + (Math.random() - 0.5), p[1] + Math.random() * 1.8, p[2] + (Math.random() - 0.5)], v: [(Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4], life: 0.4, max: 0.4, size: 0.12, col: col, shape: 4, add: true });
    F.light([p[0], p[1] + 1, p[2]], col, 6, 3, 0.3);
  };
  F.slashArc = function (e) {
    var c = NF.E.local(e, 0, 1.2, -1.2);
    rings.push({ p: c, r: 0.6, max: 1.8, life: 0.2, maxLife: 0.2, col: e.col, vertical: true });
  };
  // 光の筋(弾道)
  F.tracer = function (a, b, col, w, life) { tracers.push({ a: a.slice(), b: b.slice(), col: col, w: w || 0.04, life: life || 0.07, max: life || 0.07 }); };
  // 稲妻(アークガン)
  F.bolt = function (a, b, col, w) {
    var pts = [a.slice()], n = Math.max(3, Math.floor(M.dist(a, b) / 1.2));
    for (var i = 1; i < n; i++) {
      var t = i / n, p = M.add(M.mul(a, 1 - t), M.mul(b, t));
      var j = 0.35 * Math.sin(t * Math.PI);
      pts.push([p[0] + (Math.random() - 0.5) * j, p[1] + (Math.random() - 0.5) * j, p[2] + (Math.random() - 0.5) * j]);
    }
    pts.push(b.slice());
    arcs.push({ pts: pts, col: col, w: w || 0.06, life: 0.08 });
  };
  // 輪(衝撃波)
  F.ring = function (p, r0, r1, life, col) { rings.push({ p: p.slice(), r: r0, max: r1, life: life, maxLife: life, col: col }); };
  // 部品が飛び散る(敵の撃破)
  F.debris = function (e, force, dir) {
    var root = new Float32Array(16);
    m4.compose(root, e.p[0], e.p[1], e.p[2], 0, e.yaw, 0, 1, 1, 1);
    for (var k = 0; k < e.parts.length; k++) {
      var p = e.parts[k];
      if (p.s[0] * p.s[1] * p.s[2] < 0.0002 && Math.random() < 0.5) continue;
      var lp = p.pivot ? [p.pivot[0], p.pivot[1] - p.s[1] / 2, p.pivot[2]] : p.p;
      var wp = m4.transformPoint(root, lp);
      var out = M.norm(M.sub(wp, [e.p[0], e.p[1] + e.T.height * 0.4, e.p[2]]));
      var v = M.add(M.mul(out, 3 + Math.random() * 4 * force), [0, 2 + Math.random() * 4, 0]);
      if (dir) v = M.madd(v, dir, 4 * force);
      debris.push({ mesh: p.mesh, p: wp, v: v, rot: [p.r[0], e.yaw + p.r[1], p.r[2]], rv: [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12],
        s: p.s, col: p.col, emi: p.emi, life: 3.5 + Math.random() * 1.5, max: 5 });
    }
    if (debris.length > 400) debris.splice(0, debris.length - 400);
  };
  // 拾える物のきらめき
  F.glint = function (p, col) { add({ p: p.slice(), v: [0, 1.5, 0], life: 0.4, max: 0.4, size: 0.15, col: col, shape: 4, add: true }); };

  // 雨
  F.initRain = function (n) {
    rain.length = 0;
    for (var i = 0; i < n; i++) rain.push([(Math.random() - 0.5) * 40, Math.random() * 25, (Math.random() - 0.5) * 40, 0.6 + Math.random() * 0.4]);
  };

  // ---------------- 更新 ----------------
  F.update = function (dt, G) {
    var i, p;
    for (i = parts.length - 1; i >= 0; i--) {
      p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.v[1] -= (p.grav || 0) * dt;
      var dr = Math.exp(-(p.drag || 0) * dt);
      p.v[0] *= dr; p.v[1] *= dr; p.v[2] *= dr;
      p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt;
      if (p.p[1] < 0.02 && p.v[1] < 0) { p.p[1] = 0.02; p.v[1] *= -0.3; p.v[0] *= 0.6; p.v[2] *= 0.6; }
      if (p.grow) p.size += p.grow * dt;
    }
    for (i = tracers.length - 1; i >= 0; i--) { tracers[i].life -= dt; if (tracers[i].life <= 0) tracers.splice(i, 1); }
    for (i = arcs.length - 1; i >= 0; i--) { arcs[i].life -= dt; if (arcs[i].life <= 0) arcs.splice(i, 1); }
    for (i = decals.length - 1; i >= 0; i--) { decals[i].life -= dt; if (decals[i].life <= 0) decals.splice(i, 1); }
    for (i = rings.length - 1; i >= 0; i--) { var rg = rings[i]; rg.life -= dt; if (rg.life <= 0) rings.splice(i, 1); }
    for (i = lights.length - 1; i >= 0; i--) { lights[i].life -= dt; if (lights[i].life <= 0) lights.splice(i, 1); }
    for (i = debris.length - 1; i >= 0; i--) {
      var d = debris[i];
      d.life -= dt;
      if (d.life <= 0) { debris.splice(i, 1); continue; }
      d.v[1] -= 18 * dt;
      d.p = M.madd(d.p, d.v, dt);
      d.rot = M.madd(d.rot, d.rv, dt);
      var gy = NF.City.groundAt(G.world, d.p[0], d.p[2], d.p[1] + 0.3, 0) + Math.min(d.s[1], d.s[0]) * 0.5;
      if (d.p[1] < gy) {
        d.p[1] = gy;
        if (d.v[1] < -2) { d.v[1] *= -0.35; if (Math.random() < 0.3) F.sparks(d.p, 2, [1, 0.7, 0.3], 3); }
        else d.v[1] = 0;
        d.v[0] *= 0.7; d.v[2] *= 0.7; d.rv = M.mul(d.rv, 0.7);
      }
    }
    // 雨
    var cam = R.camPos, wind = 0.18;
    for (i = 0; i < rain.length; i++) {
      var r = rain[i];
      r[1] -= dt * 22 * r[3];
      r[0] += dt * 22 * wind * r[3];
      var wx = cam[0] + r[0], wz = cam[2] + r[2];
      if (r[1] < -2 || r[1] + cam[1] < 0) {
        if (r[1] + cam[1] < 0.2 && Math.random() < 0.3 && splashes.length < 200) splashes.push({ p: [wx, 0.03, wz], life: 0.25 });
        r[1] = 18 + Math.random() * 6; r[0] = (Math.random() - 0.5) * 40 - wind * 10; r[2] = (Math.random() - 0.5) * 40;
      }
    }
    for (i = splashes.length - 1; i >= 0; i--) { splashes[i].life -= dt; if (splashes[i].life <= 0) splashes.splice(i, 1); }
  };

  // ---------------- 描画 ----------------
  F.draw = function (fxAdd, fxAlpha, G, time) {
    var i, p;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      var k = M.clamp(p.life / (p.max || 1), 0, 1);
      var c = p.col;
      if (p.add) {
        var col = [c[0], c[1], c[2], (c[3] !== undefined ? c[3] : 1) * Math.min(1, k * 2.5) * 2.2];
        if (p.streak) fxAdd.streak(p.p, M.madd(p.p, p.v, -0.025), p.size, col);
        else fxAdd.sprite(p.p, p.size, col, p.shape, p.rot || 0);
      } else {
        fxAlpha.sprite(p.p, p.size, [c[0], c[1], c[2], (c[3] !== undefined ? c[3] : 1) * Math.min(1, k * 1.5)], p.shape, (p.rot || 0) + time * 0.3);
      }
    }
    for (i = 0; i < tracers.length; i++) {
      var t = tracers[i], kk = t.life / t.max;
      fxAdd.streak(t.a, t.b, t.w * (0.5 + kk * 0.5), [t.col[0], t.col[1], t.col[2], 2.5 * kk]);
    }
    for (i = 0; i < arcs.length; i++) {
      var a = arcs[i];
      for (var j = 0; j < a.pts.length - 1; j++) {
        fxAdd.streak(a.pts[j], a.pts[j + 1], a.w, [a.col[0], a.col[1], a.col[2], 3]);
        fxAdd.streak(a.pts[j], a.pts[j + 1], a.w * 4, [a.col[0], a.col[1], a.col[2], 0.35]);
      }
    }
    for (i = 0; i < decals.length; i++) {
      var d = decals[i], dk = Math.min(1, d.life / 2);
      if (d.scorch) fxAlpha.decal(d.p, d.n, d.size, [0.02, 0.02, 0.02, 0.75 * dk], 3);
      else {
        fxAlpha.decal(d.p, d.n, d.size, [0.02, 0.02, 0.03, 0.85 * dk], 5);
        var gl = Math.max(0, (d.life - (d.max - 1.2)) / 1.2) * d.glow;
        if (gl > 0) fxAdd.decal(d.p, d.n, d.size * 0.8, [1, 0.5, 0.15, gl * 2], 0);
      }
    }
    for (i = 0; i < rings.length; i++) {
      var rg = rings[i], rk = 1 - rg.life / rg.maxLife;
      var rad = rg.shrink ? M.lerp(rg.r, rg.max, rk) : M.lerp(rg.r, rg.max, Math.sqrt(rk));
      if (rg.vertical) fxAdd.sprite(rg.p, rad * 2, [rg.col[0], rg.col[1], rg.col[2], 2 * (1 - rk)], 2);
      else fxAdd.decal(rg.p, [0, 1, 0], rad * 2, [rg.col[0], rg.col[1], rg.col[2], 2.5 * (1 - rk)], 2);
    }
    // 雨(カメラのまわり)
    var cam = R.camPos;
    var rc = [0.55, 0.6, 0.75, 0.22 * F.rainAmt];
    var n = Math.floor(rain.length * Math.min(1, F.rainAmt));
    for (i = 0; i < n; i++) {
      var r = rain[i];
      var a0 = [cam[0] + r[0], cam[1] + r[1], cam[2] + r[2]];
      if (a0[1] < 0) continue;
      fxAdd.streak(a0, [a0[0] - 0.12, a0[1] + 0.65 * r[3], a0[2]], 0.012, rc);
    }
    for (i = 0; i < splashes.length; i++) {
      var s = splashes[i];
      fxAdd.decal(s.p, [0, 1, 0], 0.1 + (0.25 - s.life) * 1.2, [0.6, 0.65, 0.8, s.life * 2 * F.rainAmt], 2);
    }
  };
  // 飛び散る部品(メッシュ)
  F.drawDebris = function (out) {
    for (var i = 0; i < debris.length; i++) {
      var d = debris[i];
      var m = new Float32Array(16);
      var sc = Math.min(1, d.life / 0.5);
      m4.compose(m, d.p[0], d.p[1], d.p[2], d.rot[0], d.rot[1], d.rot[2], d.s[0] * sc, d.s[1] * sc, d.s[2] * sc);
      var mesh = d.mesh === 'cube' ? R.cube : d.mesh === 'sphere' ? R.sphere : d.mesh === 'cyl' ? R.cyl : R.cone;
      out.push({ mesh: mesh, m: m, tint: [d.col[0] * 0.6, d.col[1] * 0.6, d.col[2] * 0.6, d.emi * Math.min(1, d.life / 2) * 0.6] });
    }
  };
  F.lights = function () { return lights; };

  NF.FX = F;
})();
