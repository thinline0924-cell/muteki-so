// 夜光区 — ゲームの中心(進行・プレイヤー・戦闘・波・描画)
(function () {
  var M = NF.M, m4 = M.m4, R = NF.R, S = NF.S, City = NF.City, W = NF.W, E = NF.E, FX = NF.FX;
  var G = { state: 'boot', time: 0, gravity: 22, enemies: [], projs: [], pickups: [], barrels: [], world: null };
  NF.G = G;
  G.fx = FX;
  var canvas = document.getElementById('view');
  var D2R = Math.PI / 180;

  // ---------------- 保存(ブラウザに記録)----------------
  var SAVE_KEY = 'yakoku-save-v1';
  G.save = { best: 0, bestDistrict: 0, kills: 0, heads: 0, runs: 0, bossKills: 0, dailyBest: {}, unlocked: {}, settings: {} };
  try { var sv = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (sv) Object.assign(G.save, sv); } catch (e) { }
  G.writeSave = function () { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { } };
  G.settings = Object.assign({ sens: 1.0, fov: 90, master: 0.8, sfx: 0.9, music: 0.55, quality: 'mid', illust: false, invert: false, fps: false, loadout: 'rifle' }, G.save.settings);
  G.applySettings = function () {
    var s = G.settings;
    S.vol.master = s.master; S.vol.sfx = s.sfx; S.vol.music = s.music; S.setVolumes();
    var q = { low: [0.55, false, 10, 500], mid: [0.8, true, 16, 1100], high: [1.0, true, 24, 1800] }[s.quality] || [0.8, true, 16, 1100];
    R.scale = q[0]; R.ssr = q[1]; R.maxLights = q[2]; FX.initRain(q[3]);
    R.W = 0; R.resize();
    G.save.settings = s; G.writeSave();
  };

  // 武器の解放条件
  G.UNLOCKS = {
    rail: { text: '第2区に到達', test: function (s) { return s.bestDistrict >= 2; } },
    arc: { text: '通算150体撃破', test: function (s) { return s.kills >= 150; } },
    rocket: { text: '第3区に到達', test: function (s) { return s.bestDistrict >= 3; } },
    needle: { text: '通算40ヘッドショット', test: function (s) { return s.heads >= 40; } }
  };
  G.isUnlocked = function (id) { var u = W.DEFS[id].unlock; return !u || G.save.unlocked[u] || G.UNLOCKS[u].test(G.save); };
  G.checkUnlocks = function () {
    var news = [];
    Object.keys(G.UNLOCKS).forEach(function (k) {
      if (!G.save.unlocked[k] && G.UNLOCKS[k].test(G.save)) { G.save.unlocked[k] = true; news.push(k); }
    });
    if (news.length) G.writeSave();
    return news;
  };

  // ---------------- 入力 ----------------
  var keys = {}, mouse = { dx: 0, dy: 0, l: false, r: false, lp: false, lr: false, wheel: 0 };
  var pressed = {};
  G.keys = keys;
  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    keys[e.code] = true; pressed[e.code] = true;
    if (G.state === 'play' && ['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'KeyQ'].indexOf(e.code) >= 0) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') G.pause(); }
    S.init();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  canvas.addEventListener('mousedown', function (e) {
    S.init();
    if (G.state === 'play' && !G.locked && !G.touch) { G.lock(); return; }
    if (e.button === 0) { mouse.l = true; mouse.lp = true; }
    if (e.button === 2) mouse.r = true;
  });
  window.addEventListener('mouseup', function (e) {
    if (e.button === 0) { if (mouse.l) mouse.lr = true; mouse.l = false; }
    if (e.button === 2) mouse.r = false;
  });
  window.addEventListener('mousemove', function (e) {
    if (G.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
  window.addEventListener('wheel', function (e) { if (G.state === 'play') mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  G.lock = function () { if (canvas.requestPointerLock) { try { var r = canvas.requestPointerLock(); if (r && r.catch) r.catch(function () { }); } catch (e) { } } };
  document.addEventListener('pointerlockchange', function () {
    G.locked = document.pointerLockElement === canvas;
    if (!G.locked && G.state === 'play' && !G.touch) G.pause();
  });
  window.addEventListener('blur', function () { keys = G.keys = {}; mouse.l = mouse.r = false; if (G.state === 'play' && !G.touch) G.pause(); });
  // タッチ操作は ui.js が G.touchIn に書きこむ
  G.touchIn = { mx: 0, mz: 0, lx: 0, ly: 0, fire: false, ads: false, jump: false, crouch: false, dash: false, reload: false, melee: false, nade: false, swap: false, sprint: false };

  // ---------------- プレイヤー ----------------
  function newPlayer(loadout) {
    return {
      p: [0, 0, 0], v: [0, 0, 0], yaw: 0, pitch: 0, onGround: true, crouch: 0, sliding: false, slideT: 0, sprinting: false, sprintAmt: 0, slideAmt: 0,
      hp: 100, maxHp: 100, armor: 50, maxArmor: 100, dashes: 2, maxDashes: 2, dashT: 0, dashRegen: 0, jumps: 0, airJumps: 0,
      weapons: [W.make('pistol'), W.make(loadout || 'rifle'), null], slot: 1, nades: 3, maxNades: 4, bobT: 0, bobAmt: 0, moveFrac: 0,
      eyeH: 1.62, landDip: 0, hurtT: 0, lastHurt: 99, alive: true, stepDist: 0, deathSaved: false, coyote: 0,
      mods: { dmgMul: 1, rofMul: 1, magMul: 1, reloadMul: 1, speedMul: 1, recoilMul: 1, magnet: 1 }, upgrades: {}
    };
  }
  G.newPlayer = newPlayer;

  G.eyePos = function () { var p = G.player; return [p.p[0], p.p[1] + p.eyeH, p.p[2]]; };
  G.aimDir = function () { var p = G.player; return M.dirFromYawPitch(p.yaw, p.pitch); };

  var tmpB = [];
  function playerPhysics(dt, inp) {
    var pl = G.player, w = G.world, mods = pl.mods;
    var r = 0.38;
    // 入力の向き
    var fx = -Math.sin(pl.yaw), fz = -Math.cos(pl.yaw), rx = Math.cos(pl.yaw), rz = -Math.sin(pl.yaw);
    var wish = [fx * inp.mz + rx * inp.mx, 0, fz * inp.mz + rz * inp.mx];
    var wl = Math.hypot(wish[0], wish[2]);
    if (wl > 1) { wish[0] /= wl; wish[2] /= wl; wl = 1; }
    pl.sprinting = inp.sprint && inp.mz > 0.3 && !pl.sliding && pl.crouch < 0.5 && W.st.ads < 0.3;
    var speed = (pl.sprinting ? 10.4 : 6.6) * mods.speedMul * (pl.crouch > 0.5 && !pl.sliding ? 0.55 : 1);
    if (G.run && G.run.mut.lowgrav) speed *= 1.05;
    // しゃがみ・スライディング
    if (inp.crouchPressed && pl.onGround && Math.hypot(pl.v[0], pl.v[2]) > 7.5 && !pl.sliding) {
      pl.sliding = true; pl.slideT = 0.95;
      var hv = Math.hypot(pl.v[0], pl.v[2]), boost = Math.max(hv + 2.5, 13);
      pl.v[0] = pl.v[0] / hv * boost; pl.v[2] = pl.v[2] / hv * boost;
      S.slide(true); G.shake(0.05);
    }
    if (pl.sliding) {
      pl.slideT -= dt;
      if (pl.slideT <= 0 || !inp.crouch || Math.hypot(pl.v[0], pl.v[2]) < 4) { pl.sliding = false; S.slide(false); }
    }
    pl.crouch = M.damp(pl.crouch, (inp.crouch || pl.sliding) ? 1 : 0, 14, dt);
    pl.slideAmt = M.damp(pl.slideAmt, pl.sliding ? 1 : 0, 10, dt);
    pl.sprintAmt = M.damp(pl.sprintAmt, pl.sprinting && wl > 0.1 ? 1 : 0, 8, dt);
    // ダッシュ
    pl.dashRegen += dt;
    if (pl.dashes < pl.maxDashes && pl.dashRegen > 2.2 * (mods.dashCD || 1)) { pl.dashes++; pl.dashRegen = 0; }
    if (inp.dash && pl.dashes > 0 && pl.dashT <= 0) {
      var dd = wl > 0.1 ? [wish[0] / wl, 0, wish[2] / wl] : [fx, 0, fz];
      pl.v[0] = dd[0] * 24; pl.v[2] = dd[2] * 24; pl.v[1] = Math.max(pl.v[1], 1.5);
      pl.dashT = 0.17; pl.dashes--; pl.dashRegen = 0;
      S.dash(); G.fovKick = 8; G.ui.dashFx();
    }
    var grav = G.gravity * (G.run && G.run.mut.lowgrav ? 0.55 : 1);
    if (pl.dashT > 0) {
      pl.dashT -= dt;
      if (pl.dashT <= 0) { var hv2 = Math.hypot(pl.v[0], pl.v[2]); if (hv2 > 11) { pl.v[0] *= 11 / hv2; pl.v[2] *= 11 / hv2; } }
    } else if (pl.onGround) {
      // 地上: 加速と摩擦
      var fr = pl.sliding ? 0.6 : 10;
      var hv3 = Math.hypot(pl.v[0], pl.v[2]);
      if (hv3 > 0) { var drop = hv3 * fr * dt; var ns = Math.max(0, hv3 - drop) / hv3; pl.v[0] *= ns; pl.v[2] *= ns; }
      if (!pl.sliding) {
        var cur = pl.v[0] * wish[0] + pl.v[2] * wish[2];
        var add = speed * wl - cur;
        if (add > 0) { var acc = Math.min(add, 80 * speed * wl * dt * 0.12 + 0.0); pl.v[0] += wish[0] * acc * 1.3; pl.v[2] += wish[2] * acc * 1.3; }
      } else {
        // 滑りながら少し曲がれる
        pl.v[0] += wish[0] * 4 * dt; pl.v[2] += wish[2] * 4 * dt;
      }
    } else {
      // 空中: 少しだけ操作できる
      var cur2 = pl.v[0] * wish[0] + pl.v[2] * wish[2];
      var add2 = Math.max(speed, 7) * wl - cur2;
      if (add2 > 0) { var acc2 = Math.min(add2, 22 * dt * Math.max(speed, 7) * 0.25); pl.v[0] += wish[0] * acc2; pl.v[2] += wish[2] * acc2; }
      pl.v[1] -= grav * dt;
    }
    // ジャンプ
    pl.coyote -= dt;
    if (pl.onGround) { pl.coyote = 0.1; pl.airJumps = mods.airJumps || 0; }
    if (inp.jump) {
      if (pl.coyote > 0) {
        pl.v[1] = 7.6 * (G.run && G.run.mut.lowgrav ? 0.85 : 1); pl.onGround = false; pl.coyote = 0; S.jump();
        if (pl.sliding) { pl.sliding = false; S.slide(false); } // スライドジャンプは勢いが残る
      } else if (pl.airJumps > 0) {
        pl.airJumps--; pl.v[1] = 7.2; S.jump(); FX.ring([pl.p[0], pl.p[1], pl.p[2]], 0.2, 1.4, 0.3, [0.6, 0.9, 1]);
        if (wl > 0.1) { pl.v[0] = M.lerp(pl.v[0], wish[0] * Math.max(speed, Math.hypot(pl.v[0], pl.v[2])), 0.7); pl.v[2] = M.lerp(pl.v[2], wish[2] * Math.max(speed, Math.hypot(pl.v[0], pl.v[2])), 0.7); }
      }
    }
    // 外からの押し(爆風・ショットガン)
    if (G.pushV) { pl.v = M.add(pl.v, G.pushV); G.pushV = null; pl.onGround = false; }
    // 動かして当たり判定
    var h = M.lerp(1.78, 1.15, pl.crouch);
    var wasGround = pl.onGround, fallV = pl.v[1];
    pl.onGround = false;
    var surface = 'asphalt';
    for (var ax = 0; ax < 3; ax++) {
      var move = pl.v[ax] * dt;
      // 速いときは分割
      var n = Math.ceil(Math.abs(move) / 0.3) || 1;
      for (var s = 0; s < n; s++) {
        pl.p[ax] += move / n;
        w.query(pl.p[0] - r - 0.5, pl.p[2] - r - 0.5, pl.p[0] + r + 0.5, pl.p[2] + r + 0.5, tmpB);
        for (var k = 0; k < tmpB.length; k++) {
          var b = w.boxes[tmpB[k]];
          if (pl.p[0] + r <= b[0] || pl.p[0] - r >= b[3] || pl.p[2] + r <= b[2] || pl.p[2] - r >= b[5] || pl.p[1] + h <= b[1] || pl.p[1] >= b[4]) continue;
          if (ax === 1) {
            if (pl.v[1] <= 0) { pl.p[1] = b[4]; pl.v[1] = 0; pl.onGround = true; if (b[6] !== 1 && w.boxes[tmpB[k]][4] > 0.5) surface = 'metal'; }
            else { pl.p[1] = b[1] - h; pl.v[1] = Math.min(0, pl.v[1]); }
          } else {
            var step = b[4] - pl.p[1];
            if (step <= 0.55 && (wasGround || pl.v[1] <= 0)) { pl.p[1] = b[4]; continue; }
            if (ax === 0) { pl.p[0] = pl.v[0] > 0 ? b[0] - r - 0.0001 : b[3] + r + 0.0001; pl.v[0] = 0; }
            else { pl.p[2] = pl.v[2] > 0 ? b[2] - r - 0.0001 : b[5] + r + 0.0001; pl.v[2] = 0; }
          }
        }
      }
    }
    if (pl.p[1] <= 0) { pl.p[1] = 0; pl.v[1] = Math.max(0, pl.v[1]); pl.onGround = true; }
    // 足もとの確認(坂がないので、少し下に床があれば接地)
    if (!pl.onGround && pl.v[1] <= 0) {
      var g = City.groundAt(w, pl.p[0], pl.p[2], pl.p[1] + 0.01, r * 0.7);
      if (pl.p[1] - g < 0.06) { pl.p[1] = g; pl.onGround = true; pl.v[1] = 0; }
    }
    if (pl.onGround && !wasGround && fallV < -6) {
      S.land(-fallV); pl.landDip = Math.min(0.25, -fallV * 0.012); if (fallV < -14) G.shake(0.12);
    }
    // ジャンプ台
    if (pl.onGround) {
      for (var j = 0; j < w.pads.length; j++) {
        var pd = w.pads[j];
        if (Math.abs(pl.p[0] - pd.x) < 1.25 && Math.abs(pl.p[2] - pd.z) < 1.25 && Math.abs(pl.p[1] - pd.y) < 0.15) {
          pl.v[1] = pd.power * (G.run && G.run.mut.lowgrav ? 0.8 : 1); pl.v[0] += pd.push[0]; pl.v[2] += pd.push[1]; pl.onGround = false;
          S.pad(); FX.ring([pd.x, pd.y + 0.05, pd.z], 0.5, 3, 0.4, pd.col); FX.light([pd.x, pd.y + 1, pd.z], pd.col, 10, 4, 0.4);
          G.fovKick = 10; G.style(0, 'ジャンプ台');
        }
      }
    }
    // 歩く揺れ・足音
    var hs = Math.hypot(pl.v[0], pl.v[2]);
    pl.moveFrac = M.clamp(hs / 10, 0, 1);
    if (pl.onGround && !pl.sliding) {
      pl.bobT += hs * dt * 1.15;
      pl.bobAmt = M.damp(pl.bobAmt, M.clamp(hs / 7, 0, 1.4), 8, dt);
      pl.stepDist += hs * dt;
      var stride = pl.sprinting ? 2.9 : 2.2;
      if (pl.stepDist > stride) { pl.stepDist = 0; S.step(surface, pl.sprinting); }
    } else pl.bobAmt = M.damp(pl.bobAmt, 0, 6, dt);
    pl.eyeH = M.damp(pl.eyeH, M.lerp(1.62, 1.0, pl.crouch), 18, dt);
    pl.landDip = M.damp(pl.landDip, 0, 8, dt);
    var H = w.half - 0.5;
    pl.p[0] = M.clamp(pl.p[0], -H, H); pl.p[2] = M.clamp(pl.p[2], -H, H);
    if (pl.p[1] < -10) { pl.p = w.start.slice(); pl.v = [0, 0, 0]; }
    pl.surface = surface;
  }

  // ゲーム内の時間で動くタイマー(一時停止中は止まる)
  G.timers = [];
  G.after = function (sec, fn) { G.timers.push({ t: sec, fn: fn }); };
  function updateTimers(dt) {
    for (var i = G.timers.length - 1; i >= 0; i--) {
      var tm = G.timers[i]; tm.t -= dt;
      if (tm.t <= 0) { G.timers.splice(i, 1); try { tm.fn(); } catch (e) { console.error(e); } }
    }
  }

  G.pushPlayer = function (v) { G.pushV = G.pushV ? M.add(G.pushV, v) : v; };

  // ---------------- 演出 ----------------
  G.shakeAmt = 0; G.fovKick = 0; G.hitstopT = 0; G.slowmoT = 0;
  G.shake = function (a) { G.shakeAmt = Math.min(1.2, G.shakeAmt + a); };
  G.hitstop = function (t) { G.hitstopT = Math.max(G.hitstopT, t); };
  G.neonFor = function (type) {
    var th = G.world ? G.world.theme.neon : ['#ff2fa0'];
    var idx = { grunt: 0, drone: 1, rusher: 3, sniper: 2, heavy: 4, ninja: 2, boss: 0 }[type] || 0;
    var h = th[idx % th.length], n = parseInt(h.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };

  // ---------------- 戦闘: 撃つ ----------------
  // 光線を撃つ(銃)。壁で止まり、途中の敵に当たる
  G.fireRay = function (o, d, dmg, opt) {
    var maxT = opt.range || 150;
    var wh = G.world.raycast(o, d, maxT);
    var wallT = wh ? wh.t : maxT;
    var hits = E.rayHits(G, o, d, wallT);
    var endT = wallT, hitEnemy = false;
    // 爆発する樽
    var bt = barrelRay(o, d, wallT);
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      if (bt && bt.t < h.t && !opt.pierce) { break; }
      var hp = M.madd(o, d, h.t);
      damageEnemy(h.e, dmg, { head: h.h.head ? opt.head : 0, shieldPart: h.h.shield, core: h.h.core, point: hp, dir: d, weapon: opt.weapon, push: opt.push });
      hitEnemy = true;
      if (!opt.pierce) { endT = h.t; break; }
      dmg *= 0.85;
    }
    if (bt && (!hitEnemy || opt.pierce || bt.t < endT)) { if (bt.t <= endT) { hitBarrel(bt.b, dmg); endT = Math.min(endT, bt.t); } }
    var end = M.madd(o, d, endT);
    if (!hitEnemy && wh && endT === wallT) {
      FX.impact(end, wh.n, opt.rail ? [0.4, 0.9, 1] : null, false);
      if (Math.random() < 0.6) S.impact(end, wh.n[1] < 0.5);
      if (Math.random() < 0.25) S.ricochet(end);
      // 跳弾(改造)
      if (G.player.mods.ricochet && !opt.bounced) {
        var rd = M.sub(d, M.mul(wh.n, 2 * M.dot(d, wh.n)));
        // 近い敵へ向ける
        var tgt = nearestEnemy(end, 25, true);
        if (tgt) rd = M.norm(M.sub([tgt.p[0], tgt.p[1] + tgt.T.height * 0.6, tgt.p[2]], end));
        G.fireRay(M.madd(end, wh.n, 0.05), rd, dmg * 0.7, Object.assign({}, opt, { bounced: true, range: 30 }));
      }
    }
    // 弾道の光
    var muzzle = W.muzzleWorld || o;
    if (opt.rail) {
      FX.tracer(muzzle, end, [0.4, 0.85, 1], 0.12 * (0.5 + opt.charge), 0.5);
      FX.tracer(muzzle, end, [1, 1, 1], 0.03, 0.3);
      for (var k = 0; k < 20; k++) { var tp = M.add(M.mul(muzzle, 1 - k / 20), M.mul(end, k / 20)); FX.smoke(tp, 1, 0.25, [0.4, 0.7, 0.9, 0.18], 0.3); }
      FX.light(muzzle, [0.4, 0.8, 1], 10, 5, 0.25);
      G.shake(0.2);
    } else if (!opt.pellet || Math.random() < 0.5) {
      FX.tracer(opt.bounced ? o : M.madd(muzzle, d, 0.6), end, opt.tracer || [1, 0.8, 0.5], opt.pellet ? 0.02 : 0.035, 0.06);
    }
    return end;
  };

  function nearestEnemy(p, maxD, needLos) {
    var best = null, bd = maxD;
    G.enemies.forEach(function (e) {
      if (!e.alive || e.spawnT > 0) return;
      var c = [e.p[0], e.p[1] + e.T.height * 0.6, e.p[2]], d = M.dist(c, p);
      if (d < bd && (!needLos || !G.world.raycast(p, M.norm(M.sub(c, p)), d))) { bd = d; best = e; }
    });
    return best;
  }
  G.nearestEnemy = nearestEnemy;

  // アークガン: 前方の敵へ稲妻、さらに近くの敵へ飛び移る
  G.beamTick = function (dmg, d) {
    var o = G.eyePos(), f = G.aimDir(), mz = W.muzzleWorld || o;
    var best = null, bs = 0;
    G.enemies.forEach(function (e) {
      if (!e.alive || e.spawnT > 0) return;
      var c = [e.p[0], e.p[1] + e.T.height * 0.6, e.p[2]];
      var v = M.sub(c, o), dist = M.len(v);
      if (dist > d.range) return;
      var cosA = M.dot(v, f) / dist;
      var need = Math.cos(Math.max(0.05, Math.atan(1.4 / dist)));
      if (cosA < need) return;
      if (G.world.raycast(o, M.norm(v), dist)) return;
      var score = cosA * 2 - dist / d.range;
      if (!best || score > bs) { best = e; bs = score; }
    });
    var col = d.neon;
    if (!best) {
      var wh = G.world.raycast(o, f, d.range);
      var end = M.madd(o, f, wh ? wh.t : d.range * 0.6);
      FX.bolt(mz, end, col, 0.04);
      if (wh) { FX.sparks(end, 2, col, 5); hitBarrelAt(end, dmg); }
      FX.light(mz, col, 6, 2, 0.08);
      return;
    }
    var chain = [best], cur = best, n = d.chain + (G.player.mods.chainExtra || 0);
    for (var i = 0; i < n; i++) {
      var nx = null, nd = d.chainRange;
      G.enemies.forEach(function (e) {
        if (!e.alive || chain.indexOf(e) >= 0 || e.spawnT > 0) return;
        var dd = M.dist(e.p, cur.p); if (dd < nd) { nd = dd; nx = e; }
      });
      if (!nx) break;
      chain.push(nx); cur = nx;
    }
    var prev = mz;
    chain.forEach(function (e, idx) {
      var c = [e.p[0], e.p[1] + e.T.height * 0.6, e.p[2]];
      FX.bolt(prev, c, col, idx ? 0.035 : 0.05);
      FX.sparks(c, 2, col, 5);
      damageEnemy(e, dmg * (idx ? 0.6 : 1), { point: c, dir: M.norm(M.sub(c, prev)), weapon: 'arc', head: 0, quiet: true });
      e.stun = Math.max(e.stun, idx ? 0.05 : 0.08);
      prev = c;
    });
    FX.light(mz, col, 8, 3, 0.08);
    FX.light(prev, col, 8, 2, 0.08);
  };

  // ロケット・ニードル
  G.firePlayerProj = function (kind, o, d, dmg, def) {
    var mz = W.muzzleWorld || o;
    // 照準と銃口のずれを直す
    var aimHit = G.world.raycast(o, d, 200);
    var target = M.madd(o, d, aimHit ? aimHit.t : 200);
    var dir = M.norm(M.sub(target, mz));
    if (aimHit && aimHit.t < 2) dir = d;
    var p = {
      kind: kind, owner: 'player', p: mz.slice(), v: M.mul(dir, def.speed), dmg: dmg, life: kind === 'rocket' ? 6 : 3, r: kind === 'rocket' ? 0.2 : 0.08,
      splash: def.splash, col: def.neon, home: kind === 'needle' ? 1 : 0
    };
    if (kind === 'rocket') { p.snd = S.loop3d('rocket', p.p); }
    G.projs.push(p);
    if (kind === 'rocket') { FX.smoke(mz, 4, 0.5, [0.2, 0.2, 0.22, 0.5], 0.5); }
  };

  // 近接(刀): 前の敵を斬る・弾を跳ね返す
  G.melee = function () {
    var pl = G.player, o = G.eyePos(), f = G.aimDir();
    S.swing();
    var range = 3.2 * (pl.mods.katana ? 1.4 : 1);
    var hitAny = false;
    // 近くの敵に飛びこむ(最大 7m)
    var lunge = null, ld = 7;
    G.enemies.forEach(function (e) {
      if (!e.alive || e.spawnT > 0) return;
      var c = [e.p[0], e.p[1] + e.T.height * 0.5, e.p[2]], v = M.sub(c, o), dist = M.len(v);
      if (dist > ld) return;
      if (M.dot(v, f) / dist < 0.82) return;
      if (G.world.raycast(o, M.norm(v), dist)) return;
      ld = dist; lunge = e;
    });
    if (lunge && ld > range * 0.8) {
      var to = M.norm([lunge.p[0] - pl.p[0], 0, lunge.p[2] - pl.p[2]]);
      pl.v[0] = to[0] * Math.min(26, ld * 5.5); pl.v[2] = to[2] * Math.min(26, ld * 5.5);
      G.fovKick = 6;
      G.after(0.11, meleeHit);
    } else meleeHit();
    function meleeHit() {
      var o2 = G.eyePos(), f2 = G.aimDir();
      G.enemies.forEach(function (e) {
        if (!e.alive || e.spawnT > 0) return;
        var c = [e.p[0], e.p[1] + e.T.height * 0.5, e.p[2]], v = M.sub(c, o2), dist = M.len(v) - e.T.radius;
        if (dist > range) return;
        if (M.dot(v, f2) / (M.len(v) || 1) < 0.45) return;
        var dmg = 75 * (pl.mods.katana ? 2 : 1) * pl.mods.dmgMul;
        damageEnemy(e, dmg, { point: c, dir: f2, weapon: 'katana', head: 0, melee: true, push: 6 });
        FX.sparks(c, 14, [1, 0.4, 0.7], 10, f2);
        hitAny = true;
      });
      // 弾を跳ね返す
      var refl = 0;
      G.projs.forEach(function (p) {
        if (p.owner !== 'enemy' || p.dead) return;
        var v = M.sub(p.p, o2), dist = M.len(v);
        if (dist > range * (pl.mods.katana ? 1.6 : 1.2) + 1 || M.dot(v, f2) / dist < 0.2) return;
        p.owner = 'player'; p.dmg *= 3; p.life = 3; p.home = 0;
        var spd = Math.max(30, M.len(p.v) * 1.5);
        var tgt = nearestEnemy(p.p, 60, true);
        var dir = tgt ? M.norm(M.sub([tgt.p[0], tgt.p[1] + tgt.T.height * 0.6, tgt.p[2]], p.p)) : f2;
        p.v = M.mul(dir, spd); p.col = [1, 0.4, 0.75];
        refl++;
      });
      if (refl) { S.slash(true); G.style(60 * refl, '弾き返し'); G.hitstop(0.05); FX.sparks(M.madd(o2, f2, 1), 10, [1, 0.9, 0.6], 8); }
      if (hitAny) { S.slash(false); G.hitstop(0.06); G.shake(0.15); }
      hitBarrelAt(M.madd(o2, f2, 1.5), 80);
    }
  };

  // 手榴弾
  G.throwNade = function () {
    var o = G.eyePos(), f = G.aimDir();
    var v = M.add(M.mul(f, 19), [0, 4, 0]);
    v = M.add(v, M.mul(G.player.v, 0.5));
    G.projs.push({ kind: 'nade', owner: 'player', p: M.madd(o, f, 0.5), v: v, dmg: 160 * G.player.mods.dmgMul, life: 1.8, r: 0.12, splash: 6.5, col: [1, 0.85, 0.3], bounce: true, nade: true });
    S.throwNade();
  };

  // ---------------- 敵へのダメージ ----------------
  function damageEnemy(e, dmg, o) {
    if (!e.alive) return;
    var pl = G.player, mods = pl.mods;
    var crit = false;
    // 盾
    if (o.shieldPart && e.shield > 0) {
      var sd = dmg * (o.weapon === 'arc' ? 2 : 1) * (o.explosive ? 1.5 : 1);
      e.shield -= sd; e.flash = 0.5;
      S.shieldHit(o.point); FX.sparks(o.point, 6, [0.4, 0.8, 1], 6, M.mul(o.dir, -1));
      G.ui.hitmarker('shield');
      G.ui.dmgNumber(o.point, sd, 'shield');
      if (e.shield <= 0) { S.shieldBreak(); FX.explosion(o.point, 0.5, [0.4, 0.8, 1]); G.style(80, '盾破壊'); }
      return;
    }
    if (o.head) { dmg *= o.head * (G.run.mut.headhunter ? 1.5 : 1) * (o.core ? 1.5 : 1); }
    else if (G.run.mut.headhunter) dmg *= 0.7;
    if (mods.crit && Math.random() < mods.crit) { dmg *= 2; crit = true; }
    if (mods.execute && e.hp / e.maxHp < 0.3) dmg *= 1.4;
    if (mods.airDmg && !pl.onGround) dmg *= 1.25;
    if (mods.slideAcc && pl.sliding) dmg *= 1.2;
    if (mods.momentum) dmg *= 1 + Math.min(5, G.run.momentum) * 0.05;
    if (e.armor > 0 && !o.explosive) { var ab = Math.min(e.armor, dmg * 0.6); e.armor -= ab; dmg -= ab; if (e.armor <= 0) G.ui.toast('装甲を破壊!'); }
    if (e.type === 'boss' && !o.head) dmg *= 0.85;
    e.hp -= dmg; e.flash = 1; e.lastHurt = 0; e.alert = true;
    if (o.push && e.type !== 'boss' && e.type !== 'heavy') { e.v = M.madd(e.v, [o.dir[0], 0.2, o.dir[2]], o.push * (o.melee ? 1.5 : 0.5)); }
    if (!o.quiet || Math.random() < 0.3) FX.impact(o.point, M.mul(o.dir, -1), o.head ? [1, 0.3, 0.3] : [0.5, 0.9, 1], true);
    // 過充電(連鎖の電撃)
    if (mods.overcharge && !o.chained && Math.random() < mods.overcharge) {
      var nb = null, nd = 9;
      G.enemies.forEach(function (x) { if (x !== e && x.alive) { var dd = M.dist(x.p, e.p); if (dd < nd) { nd = dd; nb = x; } } });
      if (nb) { FX.bolt(o.point, [nb.p[0], nb.p[1] + 1, nb.p[2]], [0.6, 0.9, 1], 0.05); damageEnemy(nb, dmg * 0.5, { point: [nb.p[0], nb.p[1] + 1, nb.p[2]], dir: o.dir, weapon: 'arc', chained: true, quiet: true }); }
    }
    var kill = e.hp <= 0;
    if (!o.quiet || kill) { S.hit(!!o.head, kill); G.ui.hitmarker(kill ? 'kill' : o.head ? 'head' : 'hit'); }
    G.ui.dmgNumber(o.point, dmg, o.head ? 'head' : crit ? 'crit' : 'n');
    if (o.head && mods.vamp) { pl.hp = Math.min(pl.maxHp, pl.hp + mods.vamp); }
    if (kill) killEnemy(e, o);
  }
  G.damageEnemy = damageEnemy;

  function killEnemy(e, o) {
    e.alive = false;
    if (e.snd) e.snd.stop();
    var pl = G.player, run = G.run;
    var big = e.type === 'heavy' || e.type === 'boss';
    S.enemyDie(e.p, big);
    FX.debris(e, big ? 2 : 1, o.dir);
    FX.sparks([e.p[0], e.p[1] + e.T.height * 0.6, e.p[2]], 20, [0.5, 0.9, 1], 8);
    FX.smoke([e.p[0], e.p[1] + e.T.height * 0.5, e.p[2]], 4, 0.8, [0.1, 0.1, 0.12, 0.6], 1);
    FX.light([e.p[0], e.p[1] + 1, e.p[2]], e.col, 8, 3, 0.4);
    if (e.type === 'boss') { FX.explosion([e.p[0], e.p[1] + 3, e.p[2]], 2.5); S.explode(e.p, 2.5); G.shake(1); G.slowmoT = 1.5; G.save.bossKills++; }
    // スタイル
    var pts = e.T.score, label = e.T.name;
    var tags = [];
    if (o.head) { pts += 50; tags.push('ヘッドショット'); run.heads++; G.save.heads++; }
    if (o.melee) { pts += 80; tags.push('一閃'); }
    if (!pl.onGround) { pts += 50; tags.push('空中撃破'); }
    if (pl.sliding) { pts += 40; tags.push('滑り撃ち'); }
    if (o.explosive) { pts += 40; tags.push('爆破'); }
    if (o.reflected) { pts += 100; tags.push('返し討ち'); }
    if (e.elite) { pts += 150; tags.push('精鋭撃破'); }
    if (o.weapon === 'needle' && o.super) { pts += 60; tags.push('結晶爆発'); }
    // 連続撃破
    run.multiT = run.multiT > 0 ? run.multiT : 0;
    run.multi = run.multiT > 0 ? run.multi + 1 : 1;
    run.multiT = 1.6;
    if (run.multi >= 2) { pts += run.multi * 60; tags.push(['', '', 'ダブル', 'トリプル', 'クアドラ', 'ペンタ'][Math.min(run.multi, 5)] + 'キル'); S.multikill(run.multi); }
    run.kills++; G.save.kills++;
    run.momentum = Math.min(5, (run.momentum || 0) + 1); run.momentumT = 5;
    G.style(pts, tags.length ? tags.join(' / ') : '撃破');
    run.cleanStreak = (run.cleanStreak || 0) + 1;
    G.contractProgress(tags, run.multi);
    var mult = G.styleMult();
    run.score += Math.round(pts * mult);
    var cr = Math.round(e.T.credits * (run.mut.fast ? 1.3 : 1) * (1 + run.district * 0.05));
    run.credits += cr;
    G.ui.kill(e, o, tags);
    // 落とし物
    var c = [e.p[0], e.p[1] + 0.8, e.p[2]];
    if (o.melee) { for (var i = 0; i < 3; i++) dropPickup('health', c); }
    else if (Math.random() < (pl.hp < 50 ? 0.4 : 0.2)) dropPickup('health', c);
    if (o.head || Math.random() < 0.3) dropPickup('ammo', c);
    if (Math.random() < 0.15) dropPickup('armor', c);
    if (e.marked) dropPickup('core', c);
    if (big) { dropPickup('ammo', c); dropPickup('armor', c); dropPickup('health', c); }
    // 改造の効果
    if (pl.mods.explodeKill) { G.explode(c, 3.5, 40 * pl.mods.dmgMul, 'player', 0.6); }
    if (pl.mods.slowmo && o.head) { G.slowmoT = Math.max(G.slowmoT, 0.8); }
    // エリートの特性
    if (e.elite === 'volatile') { G.after(0.35, function () { G.explode(c, 5, 35, 'enemy', 1); }); FX.ring(c, 0.3, 5, 0.35, [1, 0.5, 0.1]); }
    if (e.elite === 'splitter') { G.spawnNear('drone', e.p, 2); G.spawnNear('drone', e.p, 2); }
    G.director.onKill(e);
  }

  // ---------------- 爆発 ----------------
  G.explode = function (p, radius, dmg, owner, size, src) {
    FX.explosion(p, size || 1);
    S.explode(p, size || 1);
    var pd = M.dist(G.eyePos(), p);
    G.shake(M.clamp(1.2 - pd / 25, 0, 0.8) * (size || 1));
    G.enemies.forEach(function (e) {
      if (!e.alive) return;
      var c = [e.p[0], e.p[1] + e.T.height * 0.5, e.p[2]], d = M.dist(c, p) - e.T.radius;
      if (d > radius) return;
      if (G.world.raycast(p, M.norm(M.sub(c, p)), Math.max(0.1, M.dist(c, p) - 0.3))) return;
      var k = 1 - Math.max(0, d) / radius * 0.6;
      var dir = M.norm(M.sub(c, p));
      if (e.shield > 0 && e.type === 'heavy') { var front = [-Math.sin(e.yaw), 0, -Math.cos(e.yaw)]; if (M.dot(front, M.mul(dir, -1)) > 0.3) { damageEnemy(e, dmg * k, { shieldPart: true, point: c, dir: dir, explosive: true }); return; } }
      damageEnemy(e, dmg * k * (owner === 'enemy' ? 0.5 : 1), { point: c, dir: dir, explosive: true, weapon: 'rocket', push: 8, reflected: src && src.reflected });
      if (e.alive && e.type !== 'boss') { e.v = M.add(e.v, M.mul(dir, 6 * k)); e.v[1] += 4 * k; e.onGround = false; }
    });
    // 自分
    var pc = [G.player.p[0], G.player.p[1] + 0.9, G.player.p[2]];
    var dp = M.dist(pc, p);
    if (dp < radius) {
      var kk = 1 - dp / radius;
      var dir2 = M.norm(M.sub(pc, p));
      if (owner === 'player') {
        // ロケットジャンプ(少しだけ痛い)
        G.pushPlayer(M.mul(dir2, 16 * kk + 4));
        if (dp < radius * 0.8) G.damagePlayer(dmg * 0.12 * kk, p, null, true);
      } else {
        G.damagePlayer(dmg * kk, p);
        G.pushPlayer(M.mul(dir2, 8 * kk));
      }
    }
    // 樽の連鎖
    G.barrels.forEach(function (b) { if (!b.dead && M.dist(b.p, p) < radius) hitBarrel(b, 999, 0.15 + Math.random() * 0.2); });
  };

  // 樽
  function barrelRay(o, d, maxT) {
    var best = null;
    G.barrels.forEach(function (b) {
      if (b.dead) return;
      var t = M.raySphere(o, d, [b.p[0], b.p[1] + 0.6, b.p[2]], 0.5, maxT);
      if (t >= 0 && (!best || t < best.t)) best = { t: t, b: b };
    });
    return best;
  }
  function hitBarrel(b, dmg, delay) {
    if (b.dead || b.fuse > 0) return;
    b.hp -= dmg;
    FX.sparks([b.p[0], b.p[1] + 0.6, b.p[2]], 3, [1, 0.6, 0.2], 4);
    if (b.hp <= 0) { b.fuse = delay || 0.05; }
  }
  function hitBarrelAt(p, dmg) { G.barrels.forEach(function (b) { if (!b.dead && M.dist([b.p[0], b.p[1] + 0.6, b.p[2]], p) < 1.2) hitBarrel(b, dmg); }); }

  // ---------------- 敵の攻撃 ----------------
  G.enemyShot = function (kind, o, d, dmg, src) {
    var spd = { bolt: 62, plasma: 24, rocket: 21, missile: 16 }[kind];
    var col = kind === 'bolt' ? [1, 0.3, 0.35] : kind === 'plasma' ? (src ? src.col : [1, 0.4, 0.8]) : [1, 0.55, 0.2];
    var p = { kind: kind, owner: 'enemy', p: o.slice(), v: M.mul(d, spd), dmg: dmg, life: kind === 'missile' ? 7 : 4, r: kind === 'bolt' ? 0.1 : kind === 'plasma' ? 0.22 : 0.25, col: col, splash: kind === 'rocket' ? 3.8 : kind === 'missile' ? 3.2 : 0, home: kind === 'missile' ? 2.5 : 0, src: src };
    if (kind === 'missile') p.delay = 0.45;
    G.projs.push(p);
    FX.light(o, col, 6, 2, 0.08);
  };
  // 狙撃(即着弾)
  G.enemyRay = function (o, d, dmg, src) {
    var wh = G.world.raycast(o, d, 120);
    var maxT = wh ? wh.t : 120;
    var pc = [G.player.p[0], G.player.p[1] + 1.0, G.player.p[2]];
    var t = M.raySphere(o, d, pc, 0.75, maxT);
    var end = M.madd(o, d, t >= 0 ? t : maxT);
    FX.tracer(o, end, [1, 0.2, 0.3], 0.1, 0.4);
    FX.tracer(o, end, [1, 1, 1], 0.025, 0.2);
    if (t >= 0) G.damagePlayer(dmg, o, src);
    else if (wh) FX.impact(end, wh.n, [1, 0.3, 0.3], false);
  };
  // 衝撃波(ジャンプでよけられる)
  G.shockwave = function (p, radius, dmg, src) {
    G.waves = G.waves || [];
    G.waves.push({ p: [p[0], p[1] + 0.1, p[2]], r: 0.5, max: radius, dmg: dmg, hit: false, src: src });
    FX.ring([p[0], p[1] + 0.08, p[2]], 0.5, radius, radius / 18, [1, 0.45, 0.2]);
    FX.smoke(p, 8, 1.5, [0.2, 0.18, 0.2, 0.5], 0.6);
  };
  // ボスの光線(なぎ払い)
  G.beamHazard = function (o, d, len, dmg, src) {
    var wh = G.world.raycast(o, d, len);
    var L = wh ? wh.t : len;
    var pc = [G.player.p[0], G.player.p[1] + 0.9, G.player.p[2]];
    var dd = M.segPointDist(o, M.madd(o, d, L), pc);
    if (dd < 0.9) G.damagePlayer(dmg, o, src, false, true);
    src.beamLen = L;
    if (wh) { FX.sparks(M.madd(o, d, L), 2, [1, 0.3, 0.2], 6); }
  };
  G.spawnNear = function (type, p, r) {
    var a = Math.random() * 6.28;
    var pos = [p[0] + Math.cos(a) * r, Math.max(p[1], 0) + (type === 'drone' ? 4 : 0.2), p[2] + Math.sin(a) * r];
    return E.spawn(G, type, pos, {});
  };

  // ---------------- 自分へのダメージ ----------------
  G.damagePlayer = function (dmg, from, src, self, quiet) {
    var pl = G.player;
    if (!pl.alive || G.state !== 'play') return;
    if (pl.dashT > 0 && !self) return; // ダッシュ中は無敵
    if (G.godMode) return;
    var a = Math.min(pl.armor, dmg * 0.7);
    pl.armor -= a; dmg -= a;
    pl.hp -= dmg;
    pl.lastHurt = 0;
    if (!quiet || Math.random() < 0.1) S.hurt(dmg + a);
    R.post.damage = Math.min(1, R.post.damage + (dmg + a) / 30);
    if (from && !self) {
      var to = M.sub(from, pl.p);
      var ang = Math.atan2(-to[0], -to[2]) - pl.yaw;
      G.ui.damageDir(ang);
    }
    if (!self) { G.run.stylePts *= 0.75; G.shake(0.12); G.run.cleanStreak = 0; }
    if (pl.hp <= 0) {
      if (pl.mods.lastStand && !pl.deathSaved) {
        pl.deathSaved = true; pl.hp = 30; G.slowmoT = 1.2; G.ui.banner('不屈 — 致命傷を耐えた', 'red'); S.shieldBreak();
        return;
      }
      pl.hp = 0; G.die();
    }
  };

  // ---------------- 拾う物 ----------------
  function dropPickup(kind, p) {
    var a = Math.random() * 6.28;
    G.pickups.push({ kind: kind, p: p.slice(), v: [Math.cos(a) * 2.5, 4 + Math.random() * 2, Math.sin(a) * 2.5], t: 0, life: kind === 'core' ? 999 : 22 });
  }
  G.dropPickup = dropPickup;
  var PICK_COL = { health: [1, 0.3, 0.3], ammo: [1, 0.8, 0.3], armor: [0.4, 0.8, 1], core: [0.6, 1, 0.7] };
  function updatePickups(dt) {
    var pl = G.player, pc = [pl.p[0], pl.p[1] + 0.9, pl.p[2]];
    for (var i = G.pickups.length - 1; i >= 0; i--) {
      var k = G.pickups[i];
      k.t += dt; k.life -= dt;
      if (k.life <= 0) { G.pickups.splice(i, 1); continue; }
      var d = M.dist(k.p, pc);
      var mag = (k.kind === 'core' ? 3 : 4.5) * pl.mods.magnet;
      var useful = !(k.kind === 'health' && pl.hp >= pl.maxHp) && !(k.kind === 'armor' && pl.armor >= pl.maxArmor);
      if (d < mag && k.t > 0.4 && useful) {
        var dir = M.norm(M.sub(pc, k.p));
        k.v = M.add(M.mul(k.v, 0.85), M.mul(dir, 30 * dt * 8));
      } else {
        k.v[1] -= 15 * dt;
        k.v[0] *= 0.97; k.v[2] *= 0.97;
      }
      k.p = M.madd(k.p, k.v, dt);
      var g = City.groundAt(G.world, k.p[0], k.p[2], k.p[1] + 0.2, 0) + 0.35;
      if (k.p[1] < g) { k.p[1] = g; k.v[1] = Math.abs(k.v[1]) * 0.3; }
      if (d < 1.0 && k.t > 0.25) {
        var ok = true;
        if (k.kind === 'health') { if (pl.hp >= pl.maxHp) ok = k.t > 6 && false; else pl.hp = Math.min(pl.maxHp, pl.hp + 15); }
        else if (k.kind === 'armor') { if (pl.armor >= pl.maxArmor) ok = false; else pl.armor = Math.min(pl.maxArmor, pl.armor + 15); }
        else if (k.kind === 'ammo') {
          pl.weapons.forEach(function (w) { if (w && W.DEFS[w.id].reserve !== Infinity && W.DEFS[w.id].reserve) w.reserve = Math.min(W.DEFS[w.id].reserve * 1.5, w.reserve + Math.ceil(W.DEFS[w.id].mag * 0.6)); });
          if (pl.nades < pl.maxNades && Math.random() < 0.15) pl.nades++;
        } else if (k.kind === 'core') { G.director.onCore(); }
        if (ok) { S.pickup(k.kind); G.ui.pickup(k.kind); G.pickups.splice(i, 1); }
      }
    }
  }

  // ---------------- 弾の移動 ----------------
  function updateProjs(dt) {
    var pl = G.player, pc = [pl.p[0], pl.p[1] + 0.9, pl.p[2]];
    for (var i = G.projs.length - 1; i >= 0; i--) {
      var p = G.projs[i];
      if (p.dead) { G.projs.splice(i, 1); continue; }
      p.life -= dt;
      if (p.delay > 0) { p.delay -= dt; p.v[1] -= 10 * dt; p.v = M.mul(p.v, 0.97); }
      else if (p.home) {
        var tgt = null;
        if (p.owner === 'enemy') tgt = pc;
        else {
          var en = p.stuckTo ? null : nearestInCone(p.p, M.norm(p.v), 40, 0.6);
          if (en) tgt = [en.p[0], en.p[1] + en.T.height * 0.6, en.p[2]];
        }
        if (tgt) {
          var want = M.mul(M.norm(M.sub(tgt, p.p)), M.len(p.v));
          var k = Math.min(1, dt * p.home * (p.owner === 'enemy' ? 1 : 4));
          p.v = M.add(M.mul(p.v, 1 - k), M.mul(want, k));
          if (p.kind === 'missile') p.v = M.mul(M.norm(p.v), Math.min(28, M.len(p.v) + dt * 6));
        }
      }
      if (p.stuckTo) {
        // ニードルが刺さっている
        var e = p.stuckTo;
        p.p = E.local(e, p.off[0], p.off[1], p.off[2]);
        p.fuse -= dt;
        if (!e.alive || p.fuse <= 0) {
          if (e.alive) {
            var n = G.projs.filter(function (q) { return q.stuckTo === e && !q.dead; }).length;
            if (n >= 6) {
              G.projs.forEach(function (q) { if (q.stuckTo === e) q.dead = true; });
              FX.explosion(p.p, 0.8, [1, 0.35, 0.9]); S.explode(p.p, 0.6); S.pickup('core');
              damageEnemy(e, 110 * pl.mods.dmgMul, { point: p.p, dir: [0, 1, 0], weapon: 'needle', explosive: true, super: true });
              continue;
            }
            damageEnemy(e, p.dmg * 1.4, { point: p.p, dir: [0, 1, 0], weapon: 'needle', quiet: true });
            FX.sparks(p.p, 6, p.col, 5);
          }
          p.dead = true;
        }
        continue;
      }
      if (p.kind === 'nade') { p.v[1] -= 20 * dt; }
      if (p.kind === 'rocket' && p.owner === 'enemy') p.v[1] -= 1.5 * dt;
      var step = M.mul(p.v, dt), sl = M.len(step), dir = M.norm(step);
      var hitWall = G.world.raycast(p.p, dir, sl + p.r);
      var exploded = false;
      // 敵・自分への当たり
      if (p.owner === 'player') {
        var hs = E.rayHits(G, p.p, dir, (hitWall ? hitWall.t : sl) + p.r);
        if (hs.length && !p.nade) {
          var h = hs[0], hp = M.madd(p.p, dir, h.t);
          if (p.kind === 'needle') {
            if (h.h.shield && h.e.shield > 0) { damageEnemy(h.e, p.dmg, { shieldPart: true, point: hp, dir: dir }); p.dead = true; continue; }
            p.stuckTo = h.e; p.fuse = 0.7;
            var c = Math.cos(-h.e.yaw), s = Math.sin(-h.e.yaw), lx = hp[0] - h.e.p[0], lz = hp[2] - h.e.p[2];
            p.off = [lx * c + lz * s, hp[1] - h.e.p[1], -lx * s + lz * c];
            damageEnemy(h.e, p.dmg, { point: hp, dir: dir, head: h.h.head ? 1.3 : 0, weapon: 'needle', quiet: true });
            S.hit(false, false);
            continue;
          }
          if (p.splash) { p.p = hp; G.explode(hp, p.splash, p.dmg, 'player', p.kind === 'rocket' ? 1.1 : 0.8, p); exploded = true; }
          else { damageEnemy(h.e, p.dmg, { point: hp, dir: dir, head: h.h.head ? 2 : 0, reflected: true, shieldPart: h.h.shield }); }
          p.dead = true;
        }
        // 樽
        var bt = barrelRay(p.p, dir, sl + p.r);
        if (!p.dead && bt && !p.nade) { hitBarrel(bt.b, 999); if (p.splash) { G.explode(M.madd(p.p, dir, bt.t), p.splash, p.dmg, 'player', 1, p); } p.dead = true; }
      } else {
        var t = M.raySphere(p.p, dir, pc, 0.55 + p.r, sl);
        if (t >= 0 && !(hitWall && hitWall.t < t)) {
          if (p.splash) G.explode(M.madd(p.p, dir, t), p.splash, p.dmg, 'enemy', 0.7);
          else { G.damagePlayer(p.dmg, p.src ? p.src.p : p.p, p.src); FX.sparks(M.madd(p.p, dir, t), 5, p.col, 5); }
          p.dead = true;
        }
        // 弾どうし(撃ち落とせる: ロケット・ミサイル)
      }
      if (p.dead) { if (p.snd) p.snd.stop(); continue; }
      if (hitWall) {
        var hp2 = M.madd(p.p, dir, hitWall.t);
        if (p.bounce) {
          // 手榴弾ははねる
          var n2 = hitWall.n, vn = M.dot(p.v, n2);
          p.v = M.mul(M.sub(p.v, M.mul(n2, 2 * vn)), 0.45);
          p.p = M.madd(hp2, n2, p.r + 0.01);
          if (Math.abs(vn) > 2) S.bounce(p.p);
        } else {
          if (p.splash) G.explode(M.madd(hp2, hitWall.n, 0.2), p.splash, p.dmg, p.owner, p.owner === 'player' ? (p.kind === 'rocket' ? 1.1 : 0.8) : 0.7, p);
          else if (p.kind === 'needle') { FX.sparks(hp2, 4, p.col, 4); }
          else { FX.impact(hp2, hitWall.n, p.col, false); }
          p.dead = true; if (p.snd) p.snd.stop();
          continue;
        }
      } else p.p = M.add(p.p, step);
      if (p.snd) p.snd.set(p.p);
      // 煙の尾
      if (p.kind === 'rocket' || p.kind === 'missile') { if (Math.random() < 0.7) FX.smoke(p.p, 1, 0.35, [0.25, 0.25, 0.27, 0.45], 0.2); }
      if (p.life <= 0) {
        if (p.nade || p.splash) G.explode(p.p, p.splash, p.dmg, p.owner, p.nade ? 1.2 : 0.8, p);
        p.dead = true; if (p.snd) p.snd.stop();
      }
    }
    // 衝撃波
    if (G.waves) for (var w = G.waves.length - 1; w >= 0; w--) {
      var sw = G.waves[w];
      sw.r += dt * 18;
      var dd = M.dist2(sw.p, pl.p);
      if (!sw.hit && Math.abs(dd - sw.r) < 1.0 && pl.p[1] - sw.p[1] < 0.6) { sw.hit = true; G.damagePlayer(sw.dmg, sw.p, sw.src); G.pushPlayer(M.add(M.mul(M.norm([pl.p[0] - sw.p[0], 0, pl.p[2] - sw.p[2]]), 9), [0, 5, 0])); }
      if (sw.r > sw.max) G.waves.splice(w, 1);
    }
  }
  function nearestInCone(p, f, maxD, cosMin) {
    var best = null, bs = -1;
    G.enemies.forEach(function (e) {
      if (!e.alive || e.spawnT > 0) return;
      var c = [e.p[0], e.p[1] + e.T.height * 0.6, e.p[2]], v = M.sub(c, p), d = M.len(v);
      if (d > maxD) return;
      var cs = M.dot(v, f) / d;
      if (cs < cosMin) return;
      var sc = cs - d / maxD * 0.5;
      if (sc > bs) { bs = sc; best = e; }
    });
    return best;
  }

  // 樽の更新
  function updateBarrels(dt) {
    G.barrels.forEach(function (b) {
      if (b.dead || !(b.fuse > 0)) return;
      b.fuse -= dt;
      if (b.fuse <= 0) { b.dead = true; G.explode([b.p[0], b.p[1] + 0.6, b.p[2]], 6, 150, 'player', 1.2); G.style(40, '誘爆'); }
    });
  }

  // ---------------- スタイル(連続技の評価)----------------
  G.RANKS = [['D', 0], ['C', 300], ['B', 700], ['A', 1300], ['S', 2200], ['SS', 3400], ['極', 5000]];
  G.style = function (pts, label) {
    var run = G.run; if (!run) return;
    run.stylePts = Math.min(7000, run.stylePts + pts);
    run.styleIdle = 0;
    if (label) G.ui.styleText(label, pts);
  };
  G.styleRank = function () {
    var p = G.run ? G.run.stylePts : 0, r = 0;
    for (var i = 0; i < G.RANKS.length; i++) if (p >= G.RANKS[i][1]) r = i;
    return r;
  };
  G.styleMult = function () { return 1 + G.styleRank() * 0.5; };

  // ---------------- 撃ったとき ----------------
  G.onPlayerFire = function (w, d) {
    var mz = W.muzzleWorld || G.eyePos();
    G.muzzleT = 0.05;
    if (d.kind !== 'beam') FX.light(mz, d.neon && d.kind !== 'hitscan' ? d.neon : [1, 0.75, 0.4], 9, d.kind === 'rail' ? 6 : 3.5, 0.06);
    G.fovKick = Math.max(G.fovKick, d.kick * 12);
    if (d.kind === 'hitscan' && w.id !== 'pistol') G.shake(d.kick * 0.5);
    // 薬莢
    if (d.kind === 'hitscan') {
      var right = R.camRight;
      FX.sparks(M.madd(mz, right, 0.05), 1, [1, 0.7, 0.3], 2, right);
    }
    // 近くの敵が気づく
    G.enemies.forEach(function (e) { if (M.dist(e.p, G.player.p) < 40) e.alert = true; });
  };

  // ---------------- ルートと進行 ----------------
  G.MUTATORS = [
    { id: 'lowgrav', name: '低重力', desc: '体が軽い。高く跳べるが着地に注意。' },
    { id: 'storm', name: '豪雨', desc: '雨と霧が濃い。敵も見えにくい。' },
    { id: 'fast', name: '狂騒', desc: '敵が速く攻撃的。報酬 +30%。' },
    { id: 'armorAll', name: '装甲化', desc: '敵の耐久 +30%。' },
    { id: 'headhunter', name: '首狩り', desc: '頭への傷 ×1.5、体への傷 ×0.7。' },
    { id: 'blackout', name: '停電', desc: '街灯が消え、ネオンだけが頼り。' },
    { id: 'barrels', name: '爆発祭り', desc: '爆発する樽が倍増。' }
  ];

  // 区ごとの依頼(おまけの目標)
  G.CONTRACTS = [
    { id: 'heads', text: 'ヘッドショットで{n}体倒す', n: 10, tag: 'ヘッドショット' },
    { id: 'melee', text: '刀で{n}体斬る', n: 5, tag: '一閃' },
    { id: 'air', text: '空中で{n}体倒す', n: 5, tag: '空中撃破' },
    { id: 'boom', text: '爆発で{n}体倒す', n: 6, tag: '爆破' },
    { id: 'slide', text: 'スライディング中に{n}体倒す', n: 4, tag: '滑り撃ち' },
    { id: 'multi', text: '連続撃破(ダブル以上)を{n}回', n: 4, tag: 'multi' },
    { id: 'rankS', text: '評価 S に到達する', n: 1, tag: 'rankS' },
    { id: 'clean', text: '被弾せずに{n}体続けて倒す', n: 12, tag: 'clean' }
  ];
  G.contractProgress = function (tags, multi) {
    var c = G.run && G.run.contract; if (!c || c.done) return;
    if (c.tag === 'multi') { if (multi >= 2) c.p++; }
    else if (c.tag === 'clean') { c.p = G.run.cleanStreak; }
    else if (c.tag !== 'rankS' && tags.indexOf(c.tag) >= 0) c.p++;
    if (c.tag === 'rankS' && G.styleRank() >= 4) c.p = 1;
    if (c.p >= c.n) {
      c.done = true; c.p = c.n;
      var reward = 200 + G.run.district * 80;
      G.run.credits += reward; G.run.score += reward * 5;
      G.ui.banner('依頼達成 — ¥' + reward, '', c.label); S.ui('upgrade');
    }
  };

  // 敵・弾を片付ける(鳴っている音も止める)
  function clearEntities() {
    G.enemies.forEach(function (e) { if (e.snd) e.snd.stop(); });
    G.projs.forEach(function (p) { if (p.snd) p.snd.stop(); });
    G.enemies.length = 0; G.projs.length = 0; G.pickups.length = 0;
    G.timers.length = 0; G.waves = []; G.buddies.length = 0;
    W.stopLoops(); S.slide(false);
  }
  G.clearEntities = clearEntities;

  G.newRun = function (opt) {
    opt = opt || {};
    var today = new Date();
    var dkey = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var seed = opt.daily ? M.hashStr('yakoku' + dkey) % 100000 : Math.floor(Math.random() * 100000);
    G.run = {
      seed: seed, daily: opt.daily ? dkey : null, district: 0, wave: 0, score: 0, credits: 150, kills: 0, heads: 0, stylePts: 0, styleIdle: 0,
      multi: 0, multiT: 0, momentum: 0, momentumT: 0, mut: {}, mutList: [], time: 0, rng: M.rng(seed + 77), upgrades: []
    };
    G.player = newPlayer(opt.loadout || G.settings.loadout);
    G.save.runs++; G.writeSave();
    G.loadDistrict(1);
  };

  G.loadDistrict = function (n) {
    var run = G.run;
    run.district = n; run.wave = 0;
    // 区のしかけ
    run.mut = {}; run.mutList = [];
    if (n >= 2) {
      var pool = G.MUTATORS.slice(), rr = M.rng(run.seed + n * 31);
      var cnt = n >= 5 ? 2 : 1;
      for (var i = 0; i < cnt; i++) { var m = pool.splice(Math.floor(rr() * pool.length), 1)[0]; run.mut[m.id] = true; run.mutList.push(m); }
    }
    var theme = (run.seed + n * 3) % City.THEMES.length;
    G.setWorld(City.generate(run.seed + n * 1013, theme));
    var pl = G.player;
    pl.p = G.world.start.slice(); pl.v = [0, 0, 0]; pl.yaw = Math.PI; pl.pitch = 0;
    pl.deathSaved = false;
    clearEntities(); FX.reset();
    G.director.reset();
    S.ambience(true, run.mut.storm ? 2.2 : 1);
    S.musicKey([0, 3, -2, 5, 1][n % 5], 104 + Math.min(24, n * 4));
    var cr = M.rng(run.seed + n * 57), ct = G.CONTRACTS[Math.floor(cr() * G.CONTRACTS.length)];
    var cn = ct.n + (ct.n > 1 ? Math.floor((n - 1) * ct.n * 0.25) : 0);
    run.contract = { id: ct.id, tag: ct.tag, n: cn, p: 0, done: false, label: ct.text.replace('{n}', cn) };
    run.cleanStreak = 0;
  };

  G.setWorld = function (world) {
    if (G.world) G.world.meshes.forEach(R.freeMesh);
    G.world = world;
    Object.assign(R.env, world.theme.env);
    R.env.fogDen = 0.011;
    var run = G.run;
    if (run && run.mut.storm) { R.env.fogDen = 0.02; FX.rainAmt = 2.2; } else FX.rainAmt = 1;
    // 停電: 街灯を消す
    world.lights = world.lightsAll.slice();
    if (run && run.mut.blackout) {
      world.lights = world.lights.filter(function (L) { return !(L.c[0] > 0.5 && L.c[1] > 0.7 && L.c[2] > 0.9) || Math.random() < 0.15; });
      world.lights.forEach(function (L) { L.flicker = Math.max(L.flicker, 0.4); });
      R.env.ambTop = R.env.ambTop.map(function (x) { return x * 0.5; });
    }
    // 樽
    G.barrels = world.barrels.map(function (b) { return { p: b.p.slice(), hp: 30, dead: false, fuse: 0 }; });
    if (run && run.mut.barrels) {
      for (var i = 0; i < 14; i++) { var sp = world.spawns[Math.floor(Math.random() * world.spawns.length)]; G.barrels.push({ p: [sp[0], 0.16, sp[2]], hp: 30, dead: false, fuse: 0 }); }
    }
    // 空飛ぶ車
    G.cars = [];
    var rr = M.rng(world.seed + 5);
    for (var c = 0; c < 14; c++) {
      var alongX = rr() < 0.5, lane = (rr() - 0.5) * 220, y = 30 + rr() * 45, sp2 = (rr() < 0.5 ? -1 : 1) * (14 + rr() * 16);
      G.cars.push({ alongX: alongX, lane: lane, y: y, sp: sp2, t: (rr() - 0.5) * 400, col: world.theme.neon[c % world.theme.neon.length] });
    }
    G.flowT = 0;
  };

  // ---------------- 波の管理(ディレクター)----------------
  var DIR = G.director = {};
  DIR.reset = function () { DIR.active = false; DIR.queue = 0; DIR.spawnT = 0; DIR.done = false; DIR.zone = null; DIR.cores = 0; DIR.needCores = 0; DIR.boss = null; DIR.clearT = 0; };
  DIR.waveName = { exterminate: '殲滅', hold: '制圧', collect: '回収', elite: '精鋭狩り', boss: 'ボス戦' };
  DIR.waveDesc = {
    exterminate: '区画の敵をすべて倒せ',
    hold: '端末のそばにとどまり、ハッキングを完了させろ',
    collect: '印のついた敵が持つデータコアを集めろ',
    elite: '精鋭部隊を倒せ',
    boss: '鬼神 ONI-零式 を破壊せよ'
  };
  G.startWave = function () {
    var run = G.run;
    run.wave++;
    var n = run.district, k = run.wave, rr = M.rng(run.seed + n * 97 + k * 13);
    var type;
    if (k === 3) type = n % 2 === 0 ? 'boss' : 'elite';
    else if (k === 1 && n === 1) type = 'exterminate';
    else type = ['exterminate', 'hold', 'collect'][Math.floor(rr() * 3)];
    DIR.reset();
    DIR.active = true; DIR.type = type;
    DIR.total = DIR.queue = Math.round(9 + n * 4 + k * 3);
    DIR.maxAlive = Math.min(16, 6 + n * 2);
    DIR.spawnT = 1.5; DIR.killed = 0;
    if (type === 'hold') {
      var tp = G.world.terminals[0] || [0, 0.3, 0];
      // 端末がない場合は広い道の交差点
      DIR.zone = { p: tp.slice(), r: 6.5, prog: 0, need: 28 + n * 2 };
      DIR.queue = 999;
    } else if (type === 'collect') {
      DIR.needCores = 5; DIR.cores = 0; DIR.marked = 0; DIR.queue = 999;
    } else if (type === 'boss') {
      DIR.queue = 999; DIR.maxAlive = 6;
      G.after(2.5, function () {
        if (G.state === 'dead' || !G.run || G.run !== run) return;
        var sp = pickSpawn(30, 50, false);
        DIR.boss = E.spawn(G, 'boss', sp, {});
        G.ui.banner('警告 — 鬼神 ONI-零式 接近', 'red'); S.alarm(); G.shake(0.5);
      });
    } else if (type === 'elite') {
      DIR.total = DIR.queue = Math.round(10 + n * 3);
      DIR.elites = 2 + Math.floor(n / 2);
    }
    G.ui.waveStart(type);
    S.horn();
    S.music(true, type === 'boss' ? 3 : 2);
  };

  function pickSpawn(minD, maxD, needHidden) {
    var pl = G.player, sp = G.world.spawns, eye = G.eyePos();
    var best = null;
    for (var tries = 0; tries < 40; tries++) {
      var c = sp[Math.floor(Math.random() * sp.length)];
      var d = M.dist2(c, pl.p);
      if (d < minD || d > maxD) continue;
      if (needHidden) {
        var tgt = [c[0], 1.2, c[2]];
        var vis = !G.world.raycast(eye, M.norm(M.sub(tgt, eye)), M.dist(tgt, eye));
        if (vis && tries < 30) continue;
      }
      best = c; break;
    }
    return (best || sp[Math.floor(Math.random() * sp.length)]).slice();
  }

  function pickType(n) {
    var pool = [['grunt', 5], ['drone', 3], ['rusher', 2.5]];
    if (n >= 2) { pool.push(['sniper', 1.5]); pool.push(['heavy', 0.8]); }
    if (n >= 3) { pool.push(['ninja', 1.8]); pool.push(['heavy', 0.6]); }
    if (n >= 4) { pool.push(['sniper', 1]); pool.push(['ninja', 1]); }
    var tot = pool.reduce(function (a, b) { return a + b[1]; }, 0), r = Math.random() * tot;
    for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return 'grunt';
  }
  var AFFIXES = ['armored', 'swift', 'volatile', 'splitter', 'regen'];

  DIR.update = function (dt) {
    if (!DIR.active) return;
    var run = G.run, n = run.district;
    var alive = G.enemies.filter(function (e) { return e.alive; }).length;
    DIR.alive = alive;
    // 出現
    DIR.spawnT -= dt;
    if (DIR.spawnT <= 0 && DIR.queue > 0 && alive < DIR.maxAlive && !DIR.done) {
      var group = Math.min(DIR.queue, 1 + Math.floor(Math.random() * (2 + n * 0.5)));
      var base = pickSpawn(24, 62, true);
      for (var i = 0; i < group; i++) {
        var type = pickType(n);
        var pos = [base[0] + (Math.random() - 0.5) * 4, 0.2, base[2] + (Math.random() - 0.5) * 4];
        if (type === 'drone') pos[1] = 6 + Math.random() * 4;
        var opt = {};
        var eliteChance = Math.min(0.35, 0.04 + n * 0.05);
        if (DIR.type === 'elite' && DIR.elites > 0 && Math.random() < 0.5) { opt.elite = AFFIXES[Math.floor(Math.random() * AFFIXES.length)]; DIR.elites--; }
        else if (Math.random() < eliteChance && n >= 2) opt.elite = AFFIXES[Math.floor(Math.random() * AFFIXES.length)];
        if (DIR.type === 'collect' && DIR.marked < DIR.needCores + 2 && Math.random() < 0.4) { opt.marked = true; DIR.marked++; }
        if (opt.elite === 'swift' && type === 'heavy') opt.elite = 'armored';
        E.spawn(G, type, pos, opt);
        if (DIR.queue < 900) DIR.queue--;
      }
      DIR.spawnT = M.lerp(3.5, 1.6, Math.min(1, n / 6)) * (DIR.type === 'hold' ? 0.8 : 1);
    }
    // 目的
    if (DIR.type === 'exterminate' || DIR.type === 'elite') {
      DIR.remaining = DIR.queue + alive;
      if (DIR.queue <= 0 && alive === 0) G.waveComplete();
    } else if (DIR.type === 'hold') {
      var z = DIR.zone, pl = G.player;
      var inside = M.dist2(z.p, pl.p) < z.r && Math.abs(pl.p[1] - z.p[1]) < 3;
      DIR.inside = inside;
      if (inside) {
        var contested = G.enemies.some(function (e) { return e.alive && M.dist2(e.p, z.p) < z.r; });
        DIR.contested = contested;
        if (!contested) z.prog += dt;
        DIR.beepT = (DIR.beepT || 0) - dt;
        if (DIR.beepT <= 0) { DIR.beepT = contested ? 0.6 : 1; S.beep(null, !contested); }
      }
      if (z.prog >= z.need) G.waveComplete(true);
    } else if (DIR.type === 'collect') {
      if (DIR.cores >= DIR.needCores) G.waveComplete(true);
      // 印つきの敵がいなければ補充
      var marked = G.enemies.some(function (e) { return e.alive && e.marked; }) || G.pickups.some(function (p) { return p.kind === 'core'; });
      if (!marked && DIR.marked >= DIR.needCores + 2) DIR.marked = DIR.cores; // 足りなければまた出す
    } else if (DIR.type === 'boss') {
      if (DIR.boss && !DIR.boss.alive) G.waveComplete(true);
      // 取り巻き
      if (DIR.boss && DIR.boss.alive && alive < 4 && DIR.spawnT <= 0) DIR.spawnT = 6;
    }
  };
  DIR.onKill = function (e) { DIR.killed = (DIR.killed || 0) + 1; };
  DIR.onCore = function () { DIR.cores++; G.ui.toast('データコア ' + DIR.cores + ' / ' + DIR.needCores); G.style(120, 'コア回収'); };

  G.waveComplete = function (shutdown) {
    if (DIR.done) return;
    DIR.done = true; DIR.active = false;
    var run = G.run;
    // 残りの敵は機能停止
    if (shutdown) {
      G.enemies.forEach(function (e) {
        if (!e.alive) return;
        e.alive = false; if (e.snd) e.snd.stop();
        FX.debris(e, 0.6); FX.sparks([e.p[0], e.p[1] + 1, e.p[2]], 10, [0.5, 0.9, 1], 5);
        S.enemyDie(e.p, false);
      });
    }
    G.projs.forEach(function (p) { if (p.owner === 'enemy') { p.dead = true; if (p.snd) p.snd.stop(); } });
    var bonus = 250 * run.district + run.wave * 100;
    run.score += bonus; run.credits += 60 + run.district * 20;
    S.clear(); S.music(true, 1);
    G.ui.banner(run.wave >= 3 ? '第' + run.district + '区 制圧完了' : '波 ' + run.wave + ' クリア  +' + bonus, 'clear');
    G.player.armor = Math.min(G.player.maxArmor, G.player.armor + 25);
    G.after(2.6, function () {
      if (G.run !== run || !G.player.alive) return;
      G.pickups.forEach(function (k) { if (k.kind !== 'core') { k.t = 1; k.life = Math.min(k.life, 1.2); } });
      G.openUpgrade();
    });
  };

  // ---------------- 改造チップ(アップグレード)----------------
  G.UPGRADES = [
    { id: 'rof', name: '速射モジュール', desc: '連射速度 +12%', rar: 0, stack: 5, apply: function (p) { p.mods.rofMul *= 1.12; } },
    { id: 'dmg', name: '高密度弾芯', desc: '与えるダメージ +12%', rar: 0, stack: 5, apply: function (p) { p.mods.dmgMul *= 1.12; } },
    { id: 'mag', name: '拡張マガジン', desc: '装弾数 +25%', rar: 0, stack: 3, apply: function (p) { p.mods.magMul *= 1.25; } },
    { id: 'reload', name: '高速装填', desc: 'リロード時間 -20%', rar: 0, stack: 3, apply: function (p) { p.mods.reloadMul *= 0.8; } },
    { id: 'hp', name: '強化骨格', desc: '最大体力 +25(全回復)', rar: 0, stack: 4, apply: function (p) { p.maxHp += 25; p.hp = p.maxHp; } },
    { id: 'speed', name: '疾風アクチュエータ', desc: '移動速度 +10%', rar: 0, stack: 3, apply: function (p) { p.mods.speedMul *= 1.1; } },
    { id: 'nades', name: '手榴弾ポーチ', desc: '手榴弾 +2(最大 +2)', rar: 0, stack: 3, apply: function (p) { p.maxNades += 2; p.nades = p.maxNades; } },
    { id: 'magnet', name: '磁力回収', desc: '回収範囲 ×2.5', rar: 0, stack: 1, apply: function (p) { p.mods.magnet = 2.5; } },
    { id: 'recoil', name: 'ジャイロ安定化', desc: '反動 -35%', rar: 0, stack: 2, apply: function (p) { p.mods.recoilMul *= 0.65; } },
    { id: 'jump', name: '二段跳躍', desc: '空中でもう一度ジャンプできる', rar: 1, stack: 2, apply: function (p) { p.mods.airJumps = (p.mods.airJumps || 0) + 1; } },
    { id: 'dash', name: 'ダッシュ増設', desc: 'ダッシュ回数 +1・回復 -20%', rar: 1, stack: 2, apply: function (p) { p.maxDashes++; p.dashes = p.maxDashes; p.mods.dashCD = (p.mods.dashCD || 1) * 0.8; } },
    { id: 'vamp', name: '吸血回路', desc: 'ヘッドショットで体力 +4', rar: 1, stack: 3, apply: function (p) { p.mods.vamp = (p.mods.vamp || 0) + 4; } },
    { id: 'armorRegen', name: '装甲再生', desc: '3秒被弾しないと装甲が回復', rar: 1, stack: 1, apply: function (p) { p.mods.armorRegen = true; } },
    { id: 'ammoGen', name: '弾薬生成炉', desc: '6秒ごとに予備弾を少し作る', rar: 1, stack: 1, apply: function (p) { p.mods.ammoGen = true; } },
    { id: 'execute', name: '処刑人', desc: '体力30%以下の敵へ ダメージ +40%', rar: 1, stack: 1, apply: function (p) { p.mods.execute = true; } },
    { id: 'air', name: '空中殺法', desc: '空中にいるとき ダメージ +25%', rar: 1, stack: 1, apply: function (p) { p.mods.airDmg = true; } },
    { id: 'slide', name: '滑り撃ち', desc: 'スライディング中は精度最大・ダメージ +20%', rar: 1, stack: 1, apply: function (p) { p.mods.slideAcc = true; } },
    { id: 'crit', name: '幸運回路', desc: '10% の確率で会心(ダメージ×2)', rar: 1, stack: 3, apply: function (p) { p.mods.crit = (p.mods.crit || 0) + 0.1; } },
    { id: 'katana', name: '刀の極意', desc: '近接ダメージ ×2・弾き返しの範囲拡大', rar: 1, stack: 1, apply: function (p) { p.mods.katana = true; } },
    { id: 'momentum', name: '連鎖反応', desc: '撃破ごとに5秒間 ダメージ +5%(最大5)', rar: 1, stack: 1, apply: function (p) { p.mods.momentum = true; } },
    { id: 'emptyReload', name: '空打ち装填', desc: '弾切れからのリロードが 40% 速い', rar: 0, stack: 1, apply: function (p) { p.mods.emptyReload = true; } },
    { id: 'overcharge', name: '過充電弾', desc: '15% の確率で近くの敵へ電撃が飛ぶ', rar: 2, stack: 2, apply: function (p) { p.mods.overcharge = (p.mods.overcharge || 0) + 0.15; } },
    { id: 'explodeKill', name: '爆裂弾頭', desc: '敵を倒すと小さく爆発する', rar: 2, stack: 1, apply: function (p) { p.mods.explodeKill = true; } },
    { id: 'ricochet', name: '跳弾計算機', desc: '壁に当たった弾が近くの敵へはね返る', rar: 2, stack: 1, apply: function (p) { p.mods.ricochet = true; } },
    { id: 'slowmo', name: '反射神経ブースト', desc: 'ヘッドショットで倒すと時間がゆっくりに', rar: 2, stack: 1, apply: function (p) { p.mods.slowmo = true; } },
    { id: 'lastStand', name: '不屈', desc: '区ごとに一度、致命傷を耐える', rar: 2, stack: 1, apply: function (p) { p.mods.lastStand = true; } },
    { id: 'chain', name: 'アーク増幅', desc: '電撃の飛び移り +2', rar: 2, stack: 1, apply: function (p) { p.mods.chainExtra = 2; } },
    { id: 'buddy', name: '相棒ドローン', desc: '小さなドローンが一緒に戦う', rar: 2, stack: 2, apply: function (p) { p.mods.buddy = (p.mods.buddy || 0) + 1; } }
  ];
  G.rollUpgrades = function () {
    var pl = G.player, rr = Math.random;
    var avail = G.UPGRADES.filter(function (u) { return (pl.upgrades[u.id] || 0) < u.stack; });
    var picks = [];
    var wantRare = rr() < 0.35 + G.run.district * 0.05;
    while (picks.length < 3 && avail.length) {
      var weights = avail.map(function (u) { return u.rar === 0 ? 5 : u.rar === 1 ? (wantRare ? 4 : 2.5) : (wantRare ? 2 : 0.8); });
      var tot = weights.reduce(function (a, b) { return a + b; }, 0), r = rr() * tot, idx = 0;
      for (var i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { idx = i; break; } }
      picks.push(avail.splice(idx, 1)[0]);
    }
    return picks;
  };
  G.applyUpgrade = function (u) {
    var pl = G.player;
    pl.upgrades[u.id] = (pl.upgrades[u.id] || 0) + 1;
    u.apply(pl);
    G.run.upgrades.push(u.id);
    S.ui('upgrade');
  };
  G.openUpgrade = function () {
    G.setState('upgrade');
    G.ui.showUpgrade(G.rollUpgrades(), function (u) {
      G.applyUpgrade(u);
      if (G.run.wave >= 3) G.openShop();
      else { G.setState('play'); G.ui.countdown(function () { G.startWave(); }); }
    });
  };
  // 店(区と区のあいだ)
  G.openShop = function () {
    G.setState('shop');
    // 区のクリアで記録
    G.save.bestDistrict = Math.max(G.save.bestDistrict, G.run.district + 1);
    var news = G.checkUnlocks();
    G.writeSave();
    G.ui.showShop(news, function () {
      G.loadDistrict(G.run.district + 1);
      G.setState('play');
      G.ui.districtIntro(function () { G.startWave(); });
    });
  };
  G.shopItems = function () {
    var pl = G.player, items = [];
    items.push({ id: 'heal', name: '修理キット', desc: '体力を全回復', price: 120, ok: pl.hp < pl.maxHp, buy: function () { pl.hp = pl.maxHp; } });
    items.push({ id: 'armor', name: '装甲プレート', desc: '装甲を満タンに', price: 150, ok: pl.armor < pl.maxArmor, buy: function () { pl.armor = pl.maxArmor; } });
    items.push({ id: 'ammo', name: '弾薬箱', desc: 'すべての武器の予備弾を満タンに', price: 100, ok: true, buy: function () { pl.weapons.forEach(function (w) { if (w && W.DEFS[w.id].reserve !== Infinity) { w.reserve = W.DEFS[w.id].reserve * 1.5; w.mag = W.stat(pl, w, 'mag'); } }); } });
    items.push({ id: 'nade', name: '手榴弾 ×2', desc: '手榴弾を2つ補充', price: 90, ok: pl.nades < pl.maxNades, buy: function () { pl.nades = Math.min(pl.maxNades, pl.nades + 2); } });
    items.push({ id: 'maxhp', name: '人工心臓', desc: '最大体力 +15', price: 400, ok: true, buy: function () { pl.maxHp += 15; pl.hp += 15; } });
    pl.weapons.forEach(function (w, i) {
      if (!w) return;
      var price = 350 * (w.level + 1);
      items.push({ id: 'lv' + i, name: W.DEFS[w.id].short + ' 強化 Lv' + (w.level + 1) + '→' + (w.level + 2), desc: 'ダメージ +15%・連射 +5%・装弾 +10%', price: price, ok: w.level < 4, weapon: w.id, buy: function () { w.level++; w.mag = W.stat(pl, w, 'mag'); } });
    });
    W.ORDER.forEach(function (id) {
      if (id === 'pistol' || !G.isUnlocked(id) || pl.weapons.some(function (w) { return w && w.id === id; })) return;
      var d = W.DEFS[id];
      items.push({ id: 'w_' + id, name: d.name, desc: d.desc + '(' + (pl.weapons[2] ? '今の武器と交換' : '3つ目の枠へ') + ')', price: d.price, ok: true, weapon: id, isWeapon: true,
        buy: function () { var slot = pl.weapons[2] ? pl.slot === 0 ? 1 : pl.slot : 2; pl.weapons[slot] = W.make(id); pl.slot = slot; W.clearCache(); } });
    });
    return items;
  };

  // ---------------- 状態 ----------------
  G.setState = function (s) {
    var prev = G.state;
    G.state = s;
    if (s !== 'play') { W.stopLoops(); S.slide(false); if (document.pointerLockElement) document.exitPointerLock(); }
    if (s === 'play' && !G.touch) G.lock();
    G.ui.onState(s, prev);
  };
  G.pause = function () { if (G.state !== 'play') return; G.setState('pause'); };
  G.resume = function () { G.setState('play'); };
  G.die = function () {
    var pl = G.player, run = G.run;
    pl.alive = false;
    S.music(false); S.slide(false);
    G.slowmoT = 1.5;
    G.deathT = 1.6;
    S.hurt(60);
    // 記録
    var best = run.score > G.save.best;
    G.save.best = Math.max(G.save.best, run.score);
    G.save.bestDistrict = Math.max(G.save.bestDistrict, run.district);
    if (run.daily) { G.save.dailyBest[run.daily] = Math.max(G.save.dailyBest[run.daily] || 0, run.score); }
    var news = G.checkUnlocks();
    G.writeSave();
    G.after(1.6, function () { G.setState('dead'); G.ui.showDead({ best: best, news: news }); });
  };
  G.quitToTitle = function () {
    clearEntities(); G.run = null; G.player = null;
    S.music(true, 0);
    G.titleWorld();
    G.setState('title');
  };
  G.titleWorld = function () {
    var seed = Math.floor(Math.random() * 1000);
    G.setWorld(City.generate(seed, seed % City.THEMES.length));
    G.titleCam = { t: 0 };
    clearEntities(); FX.reset();
  };

  // ---------------- 毎フレーム ----------------
  var last = 0, fpsAcc = 0, fpsN = 0;
  G.fps = 0;
  function readInput() {
    var t = G.touchIn;
    var inp = {
      mx: (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + t.mx,
      mz: (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + t.mz,
      sprint: keys.ShiftLeft || keys.ShiftRight || t.sprint,
      crouch: keys.ControlLeft || keys.KeyC || t.crouch,
      crouchPressed: pressed.ControlLeft || pressed.KeyC || t.crouchPressed,
      jump: pressed.Space || t.jump,
      dash: pressed.KeyQ || pressed.AltLeft || t.dash,
      fire: mouse.l || t.fire,
      firePressed: mouse.lp || t.firePressed,
      fireReleased: mouse.lr || t.fireReleased,
      ads: mouse.r || t.ads,
      reload: pressed.KeyR || t.reload,
      melee: pressed.KeyV || pressed.KeyF || t.melee,
      nade: pressed.KeyG || t.nade,
      slot: pressed.Digit1 ? 0 : pressed.Digit2 ? 1 : pressed.Digit3 ? 2 : -1,
      swap: mouse.wheel !== 0 ? Math.sign(mouse.wheel) : (pressed.KeyX || t.swap ? 1 : 0)
    };
    if (t.sprintToggle) inp.sprint = true;
    t.jump = t.dash = t.reload = t.melee = t.nade = t.swap = t.firePressed = t.fireReleased = t.crouchPressed = false;
    return inp;
  }

  function update(dt, rdt) {
    var pl = G.player, run = G.run;
    var inp = readInput();
    // 視点
    var sens = 0.0022 * G.settings.sens * (1 - W.st.ads * (1 - 1 / W.DEFS[W.current(pl).id].zoom) * 0.85);
    pl.yaw -= mouse.dx * sens + G.touchIn.lx;
    pl.pitch -= mouse.dy * sens * (G.settings.invert ? -1 : 1) + G.touchIn.ly;
    G.touchIn.lx = G.touchIn.ly = 0;
    W.st.swayX = M.damp(W.st.swayX, M.clamp(-mouse.dx * 0.0004, -0.03, 0.03), 10, rdt);
    W.st.swayY = M.damp(W.st.swayY, M.clamp(mouse.dy * 0.0004, -0.03, 0.03), 10, rdt);
    mouse.dx = mouse.dy = 0;
    pl.pitch = M.clamp(pl.pitch, -1.5, 1.5);
    if (pl.alive) {
      // 武器の切り替え
      if (inp.slot >= 0 && pl.weapons[inp.slot]) W.equip(pl, inp.slot);
      if (inp.swap) { var s = pl.slot; for (var i = 0; i < 3; i++) { s = (s + inp.swap + 3) % 3; if (pl.weapons[s]) break; } W.equip(pl, s); }
      playerPhysics(dt, inp);
      W.update(dt, pl, inp, G);
    }
    mouse.lp = mouse.lr = false; mouse.wheel = 0;
    for (var k in pressed) pressed[k] = false;

    updateTimers(dt);
    E.update(G, dt);
    updateProjs(dt);
    updatePickups(dt);
    updateBarrels(dt);
    updateBuddies(dt);
    DIR.update(dt);
    // 敵の通り道(0.4秒ごと)
    G.flowT -= dt;
    if (G.flowT <= 0) { G.flowT = 0.4; City.flowField(G.world, pl.p[0], pl.p[2]); }
    // 消えた敵を片付け
    for (i = G.enemies.length - 1; i >= 0; i--) if (!G.enemies[i].alive) G.enemies.splice(i, 1);
    // スタイルの減衰
    run.styleIdle += dt;
    if (run.styleIdle > 2.5) run.stylePts = Math.max(0, run.stylePts - dt * (120 + run.stylePts * 0.12));
    run.multiT -= dt; run.momentumT -= dt; if (run.momentumT <= 0) run.momentum = 0;
    run.time += dt;
    // 改造の継続効果
    pl.lastHurt += dt;
    if (pl.mods.armorRegen && pl.lastHurt > 3 && pl.armor < pl.maxArmor) pl.armor = Math.min(pl.maxArmor, pl.armor + 12 * dt);
    if (pl.mods.ammoGen) { pl.ammoGenT = (pl.ammoGenT || 0) + dt; if (pl.ammoGenT > 6) { pl.ammoGenT = 0; pl.weapons.forEach(function (w) { if (w && W.DEFS[w.id].mag && w.reserve !== Infinity) w.reserve += Math.ceil(W.DEFS[w.id].mag * 0.15); }); } }
    // 低体力
    var low = pl.hp / pl.maxHp < 0.3 && pl.alive;
    R.post.low = M.damp(R.post.low, low ? 1 : 0, 3, rdt);
    if (low) S.heartbeat(0.55 + pl.hp / pl.maxHp * 2);
  }

  // 相棒ドローン(改造)
  G.buddies = [];
  function updateBuddies(dt) {
    var pl = G.player, n = pl.mods.buddy || 0;
    while (G.buddies.length < n) G.buddies.push({ p: G.eyePos(), cd: 1, a: Math.random() * 6 });
    G.buddies.forEach(function (b, i) {
      b.a += dt * 1.2;
      var tgt = M.add(G.eyePos(), [Math.cos(b.a + i * 3) * 1.6, 0.9 + Math.sin(b.a * 2) * 0.2, Math.sin(b.a + i * 3) * 1.6]);
      b.p = M.add(M.mul(b.p, 0.9), M.mul(tgt, 0.1));
      b.cd -= dt;
      if (b.cd <= 0) {
        var e = nearestEnemy(b.p, 35, true);
        if (e) {
          b.cd = 0.55;
          var c = [e.p[0], e.p[1] + e.T.height * 0.6, e.p[2]], d = M.norm(M.sub(c, b.p));
          FX.tracer(b.p, c, [0.5, 1, 0.8], 0.03, 0.08);
          damageEnemy(e, 14 * pl.mods.dmgMul, { point: c, dir: d, weapon: 'buddy', quiet: true });
          S.shoot('needle');
        } else b.cd = 0.3;
      }
    });
  }

  // ---------------- 描画のまとめ ----------------
  var lightScratch = [];
  function gatherLights(cam) {
    var w = G.world, t = G.time;
    lightScratch.length = 0;
    var dyn = FX.lights();
    for (var i = 0; i < dyn.length; i++) { var L = dyn[i], k = L.life / L.max; lightScratch.push({ p: L.p, c: L.c, r: L.r, i: L.i * k, d: -1 }); }
    G.projs.forEach(function (p) { if (lightScratch.length < 40 && p.kind !== 'needle') lightScratch.push({ p: p.p, c: p.col, r: p.kind === 'bolt' ? 4 : 6, i: 1.5, d: 0 }); });
    var cx = cam[0], cy = cam[1], cz = cam[2];
    var statics = [];
    for (i = 0; i < w.lights.length; i++) {
      var s = w.lights[i];
      var dx = s.p[0] - cx, dy = s.p[1] - cy, dz = s.p[2] - cz;
      var d = dx * dx + dy * dy + dz * dz;
      if (d > 3600) continue;
      var it = s.base;
      if (s.flicker) { var f = Math.sin(t * 23 + s.ph * 7) + Math.sin(t * 7.3 + s.ph); it *= f > 1.2 * (1 - s.flicker * 0.5) ? 0.15 : 1; }
      statics.push({ p: s.p, c: s.c, r: s.r, i: it, d: d });
    }
    statics.sort(function (a, b) { return a.d - b.d; });
    // 遠いものはだんだん弱く(ポップを目立たなくする)
    var room = R.maxLights - Math.min(lightScratch.length, 8);
    for (i = 0; i < statics.length && i < room; i++) {
      var fade = M.clamp((room - i) / 4, 0, 1);
      statics[i].i *= fade;
      lightScratch.push(statics[i]);
    }
    return lightScratch;
  }

  var PICK_MESH = { health: 'cube', ammo: 'cube', armor: 'sphere', core: 'sphere' };
  function drawWorldObjects(parts, time) {
    // 樽
    G.barrels.forEach(function (b) {
      if (b.dead) return;
      var m = new Float32Array(16);
      m4.compose(m, b.p[0], b.p[1] + 0.6, b.p[2], 0, 0, 0, 0.7, 1.2, 0.7);
      parts.push({ mesh: R.cyl, m: m, tint: [0.7, 0.12, 0.08, b.fuse > 0 ? 3 : 0] });
      var m2 = new Float32Array(16);
      m4.compose(m2, b.p[0], b.p[1] + 0.8, b.p[2], 0, 0, 0, 0.72, 0.12, 0.72);
      parts.push({ mesh: R.cyl, m: m2, tint: [1, 0.75, 0.1, 2 + Math.sin(time * 6) * 0.8] });
    });
    // 拾う物
    G.pickups.forEach(function (k) {
      var c = PICK_COL[k.kind], m = new Float32Array(16), sz = k.kind === 'core' ? 0.45 : 0.3;
      var bob = Math.sin(k.t * 4) * 0.08;
      m4.compose(m, k.p[0], k.p[1] + bob, k.p[2], k.t * 2, k.t * 3, 0, sz, sz, sz);
      var blink = k.life < 4 ? (Math.sin(k.t * 20) > 0 ? 1 : 0.2) : 1;
      parts.push({ mesh: R[PICK_MESH[k.kind]], m: m, tint: [c[0], c[1], c[2], 3 * blink] });
    });
    // 弾(ロケット・手榴弾)
    G.projs.forEach(function (p) {
      if (p.kind === 'rocket' || p.kind === 'missile' || p.kind === 'nade') {
        var m = new Float32Array(16), d = M.norm(p.v);
        var yaw = Math.atan2(-d[0], -d[2]), pitch = Math.asin(M.clamp(d[1], -1, 1));
        if (p.kind === 'nade') m4.compose(m, p.p[0], p.p[1], p.p[2], time * 10, time * 7, 0, 0.18, 0.24, 0.18);
        else m4.compose(m, p.p[0], p.p[1], p.p[2], pitch - Math.PI / 2, yaw, 0, 0.16, 0.6, 0.16);
        parts.push({ mesh: p.kind === 'nade' ? R.sphere : R.cyl, m: m, tint: p.kind === 'nade' ? [0.3, 0.32, 0.28, 0] : [0.35, 0.35, 0.38, 0] });
      }
    });
    // 広場のホログラム(回る鯉)
    G.world.holos.forEach(function (h) {
      for (var i = 0; i < 3; i++) {
        var m = new Float32Array(16), a = time * 0.6 + i * 2.09;
        m4.compose(m, h.p[0] + Math.cos(a) * 1.6, h.p[1] + 2.6 + Math.sin(time * 1.3 + i) * 0.4, h.p[2] + Math.sin(a) * 1.6, 0, -a, 0, 0.35, 0.35, 1.1);
        parts.push({ mesh: R.sphere, m: m, tint: [h.col[0], h.col[1], h.col[2], 3.5] });
        var mt = new Float32Array(16);
        m4.compose(mt, h.p[0] + Math.cos(a - 0.35) * 1.6, h.p[1] + 2.6 + Math.sin(time * 1.3 + i) * 0.4, h.p[2] + Math.sin(a - 0.35) * 1.6, 0, -a + Math.sin(time * 6) * 0.4, 0, 0.05, 0.35, 0.4);
        parts.push({ mesh: R.cube, m: mt, tint: [h.col[0], h.col[1], h.col[2], 3.5] });
      }
      var mr = new Float32Array(16);
      m4.compose(mr, h.p[0], h.p[1] + 0.2, h.p[2], 0, time, 0, 3.6, 0.03, 3.6);
      parts.push({ mesh: R.cyl, m: mr, tint: [h.col[0], h.col[1], h.col[2], 2] });
    });
    // 空飛ぶ車
    (G.cars || []).forEach(function (c) {
      var x = c.alongX ? ((c.t + time * c.sp) % 500 + 750) % 500 - 250 : c.lane;
      var z = c.alongX ? c.lane : ((c.t + time * c.sp) % 500 + 750) % 500 - 250;
      c.pos = [x, c.y, z];
      var m = new Float32Array(16);
      m4.compose(m, x, c.y, z, 0, c.alongX ? Math.PI / 2 : 0, 0, 1.6, 0.6, 3.6);
      parts.push({ mesh: R.cube, m: m, tint: [0.2, 0.2, 0.25, 0.2] });
    });
    // 相棒
    G.buddies.forEach(function (b) {
      var m = new Float32Array(16);
      m4.compose(m, b.p[0], b.p[1], b.p[2], 0, time * 3, 0, 0.25, 0.18, 0.25);
      parts.push({ mesh: R.sphere, m: m, tint: [0.4, 1, 0.8, 2.5] });
    });
  }

  function drawFx(fxAdd, fxAlpha, fxView, time) {
    FX.draw(fxAdd, fxAlpha, G, time);
    // 弾の光
    G.projs.forEach(function (p) {
      var c = p.col;
      if (p.kind === 'bolt') fxAdd.streak(p.p, M.madd(p.p, p.v, -0.035), 0.12, [c[0], c[1], c[2], 3]);
      else if (p.kind === 'plasma') { fxAdd.sprite(p.p, 0.7, [c[0], c[1], c[2], 2.5], 0); fxAdd.sprite(p.p, 0.25, [1, 1, 1, 2], 0); }
      else if (p.kind === 'needle') { fxAdd.streak(p.p, M.madd(p.p, M.norm(p.v), -0.4), 0.07, [c[0], c[1], c[2], 3]); fxAdd.sprite(p.p, 0.25, [c[0], c[1], c[2], 1.5], 0); }
      else if (p.kind === 'rocket' || p.kind === 'missile') { var b = M.madd(p.p, M.norm(p.v), -0.4); fxAdd.sprite(b, 0.7, [1, 0.6, 0.25, 2.5], 0); fxAdd.sprite(b, 0.25, [1, 1, 0.8, 3], 0); }
      else if (p.kind === 'nade') { fxAdd.sprite(p.p, 0.3 + (Math.sin(time * 20) > 0 ? 0.2 : 0), [1, 0.3, 0.2, 2], 0); }
    });
    // 狙撃のレーザー
    G.enemies.forEach(function (e) {
      if (!e.alive) return;
      if (e.aimT > 0 && e.aimDir) {
        var o = E.local(e, 0.12, 1.42, -1.12);
        var wh = G.world.raycast(o, e.aimDir, 120);
        var end = M.madd(o, e.aimDir, wh ? wh.t : 120);
        var k = 1 - e.aimT / 1.35;
        fxAdd.streak(o, end, 0.025 + k * 0.03, [1, 0.1, 0.2, 1.5 + k * 3]);
        fxAdd.sprite(o, 0.4 + k * 0.6, [1, 0.2, 0.3, 2], 0);
      }
      if (e.beam) {
        var L = e.beamLen || 60, en = M.madd(e.beam.o, e.beam.d, L);
        fxAdd.streak(e.beam.o, en, 0.6, [1, 0.25, 0.15, 2.5]);
        fxAdd.streak(e.beam.o, en, 0.15, [1, 0.9, 0.7, 4]);
        fxAdd.sprite(en, 2, [1, 0.4, 0.2, 2], 0);
      }
      if (e.marked) { var mp = [e.p[0], e.p[1] + e.T.height + 0.6 + Math.sin(time * 4) * 0.1, e.p[2]]; fxAdd.sprite(mp, 0.5, [0.6, 1, 0.7, 2.5], 4, time * 2); }
      if (e.elite) { fxAdd.decal([e.p[0], e.p[1] + 0.05, e.p[2]], [0, 1, 0], 2.2, [E.AFFIX[e.elite].col[0], E.AFFIX[e.elite].col[1], E.AFFIX[e.elite].col[2], 1.5], 2); }
      if (e.T.fly) { fxAdd.decal([e.p[0], City.groundAt(G.world, e.p[0], e.p[2], e.p[1], 0) + 0.04, e.p[2]], [0, 1, 0], 1.6, [e.col[0], e.col[1], e.col[2], 0.25], 0); }
    });
    // 拾う物のかがやき
    G.pickups.forEach(function (k) { var c = PICK_COL[k.kind]; fxAdd.sprite(k.p, k.kind === 'core' ? 1.6 : 0.9, [c[0], c[1], c[2], 0.9], 0); });
    // ビルのてっぺんの赤い灯
    var blink = Math.sin(time * 2) > 0.3 ? 1 : 0.1;
    G.world.beacons.forEach(function (b) { fxAdd.sprite(b, 1.6, [1, 0.15, 0.1, 2 * blink], 0); });
    // 空飛ぶ車のライト
    (G.cars || []).forEach(function (c) {
      if (!c.pos) return;
      var f = c.alongX ? [Math.sign(c.sp), 0, 0] : [0, 0, Math.sign(c.sp)];
      fxAdd.sprite(M.madd(c.pos, f, 1.9), 2, [1, 0.95, 0.8, 1.6], 0);
      fxAdd.sprite(M.madd(c.pos, f, -1.9), 1.4, [1, 0.15, 0.2, 1.6], 0);
      var nc = parseInt(c.col.slice(1), 16);
      fxAdd.sprite([c.pos[0], c.pos[1] - 0.5, c.pos[2]], 3, [(nc >> 16 & 255) / 255, (nc >> 8 & 255) / 255, (nc & 255) / 255, 0.7], 0);
    });
    // 煙の出る穴
    if (Math.random() < 0.3) G.world.vents.forEach(function (v) { if (Math.random() < 0.3) FX.smoke(v, 1, 1.2, [0.5, 0.45, 0.55, 0.12], 1.2); });
    // 制圧ゾーン
    if (DIR.zone && DIR.active) {
      var z = DIR.zone, kz = z.prog / z.need;
      var zc = DIR.contested ? [1, 0.3, 0.2] : [0.5, 1, 0.8];
      fxAdd.decal([z.p[0], z.p[1] + 0.05, z.p[2]], [0, 1, 0], z.r * 2, [zc[0], zc[1], zc[2], 1.2 + Math.sin(time * 4) * 0.3], 2);
      fxAdd.decal([z.p[0], z.p[1] + 0.06, z.p[2]], [0, 1, 0], z.r * 2 * kz, [zc[0], zc[1], zc[2], 0.35], 0);
      for (var i = 0; i < 12; i++) {
        var a = i / 12 * Math.PI * 2 + time * 0.5;
        var bp = [z.p[0] + Math.cos(a) * z.r, z.p[1], z.p[2] + Math.sin(a) * z.r];
        fxAdd.streak(bp, [bp[0], bp[1] + 3 + kz * 4, bp[2]], 0.08, [zc[0], zc[1], zc[2], 0.8]);
      }
    }
    // 衝撃波(地面を走る輪は FX.ring)
    // 銃口の光(手前)
    if (!G.player) return;
    if (G.muzzleT > 0 && W.muzzleWorld) {
      var w = W.current(G.player), d = W.DEFS[w.id];
      var mc = d.kind === 'hitscan' ? [1, 0.75, 0.4] : d.neon;
      var mz = W.muzzleWorld;
      fxView.sprite(mz, w.id === 'shotgun' ? 0.22 : 0.14, [mc[0], mc[1], mc[2], 2.5], 0, Math.random() * 3);
      fxView.sprite(mz, 0.05, [1, 1, 1, 3], 0);
      for (var s = 0; s < 4; s++) { var ang = Math.random() * 6.28; fxView.streak(mz, M.add(mz, M.add(M.mul(R.camRight, Math.cos(ang) * 0.09), M.mul(R.camUp, Math.sin(ang) * 0.09))), 0.015, [mc[0], mc[1], mc[2], 2.5]); }
    }
    if (W.st.charge > 0 && W.muzzleWorld) { var ch = W.st.charge; fxView.sprite(W.muzzleWorld, 0.08 + ch * 0.18, [0.4, 0.85, 1, 1 + ch * 3], 0, time * 5); }
    if (W.current(G.player).id === 'arc' && W.st.beamSnd && W.muzzleWorld) fxView.sprite(W.muzzleWorld, 0.2, [0.6, 1, 0.5, 3], 0, time * 9);
  }

  function frame(now) {
    var rdt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    fpsAcc += rdt; fpsN++;
    if (fpsAcc > 0.5) { G.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    try { step(rdt); } catch (err) { console.error(err); if (G.ui && G.ui.error) G.ui.error(err); }
    if (!NF.still) requestAnimationFrame(frame);
  }
  G.frame = frame;

  function step(rdt) {
    R.resize();
    var ts = 1;
    if (G.slowmoT > 0) { G.slowmoT -= rdt; ts = 0.35; }
    R.post.slowmo = M.damp(R.post.slowmo, G.slowmoT > 0 ? 1 : 0, 6, rdt);
    if (G.hitstopT > 0) { G.hitstopT -= rdt; ts = 0.05; }
    var dt = rdt * ts;
    var playing = G.state === 'play' && G.player;
    if (playing) { G.time += dt; update(dt, rdt); }
    if (G.deathT > 0) { G.deathT -= rdt; }
    if (G.state === 'play' || G.state === 'dead' || G.state === 'title' || G.state === 'pause' || G.state === 'upgrade' || G.state === 'shop') FX.update(G.state === 'play' ? dt : G.state === 'title' ? rdt : rdt * 0.3, G);
    if (G.state === 'title') G.time += rdt;
    G.muzzleT = (G.muzzleT || 0) - rdt;
    if (!G.noRender) render(rdt);
    if (G.ui) G.ui.update(rdt);
  }

  function render(rdt) {
    if (!G.world) return;
    var cam, yaw, pitch, roll = 0, fov = G.settings.fov * D2R;
    if (G.state === 'title' || !G.player) {
      var tc = G.titleCam || (G.titleCam = { t: 0 });
      tc.t += rdt * 0.06;
      var rr = 15, pc = G.world.plaza || [0, 0, 0];
      cam = [pc[0] + Math.cos(tc.t) * rr, 8 + Math.sin(tc.t * 1.7) * 1.5, pc[2] + Math.sin(tc.t) * rr];
      yaw = Math.atan2(cam[0] - pc[0], cam[2] - pc[2]) + 0.55; pitch = 0.02; fov = 95 * D2R;
    } else {
      var pl = G.player;
      cam = G.eyePos();
      cam[1] -= pl.landDip;
      // 揺れ
      var sh = G.shakeAmt;
      G.shakeAmt = Math.max(0, G.shakeAmt - rdt * 2.5);
      var t = G.time;
      yaw = pl.yaw + Math.sin(t * 47) * sh * 0.02;
      pitch = pl.pitch + Math.sin(t * 59) * sh * 0.02;
      // 横移動・スライドで傾く
      var side = pl.v[0] * Math.cos(pl.yaw) - pl.v[2] * Math.sin(pl.yaw);
      G.rollS = M.damp(G.rollS || 0, -side * 0.004 + pl.slideAmt * 0.06, 8, rdt);
      roll = G.rollS + Math.sin(t * 37) * sh * 0.01;
      if (!pl.alive) { var dk = M.clamp(1 - (G.deathT || 0) / 1.6, 0, 1); cam[1] -= dk * 1.2; roll += dk * 0.6; }
      // 視野角
      var d = W.DEFS[W.current(pl).id];
      var zoom = M.lerp(1, d.zoom, W.st.ads);
      G.fovKick = M.damp(G.fovKick, 0, 6, rdt);
      fov = 2 * Math.atan(Math.tan(fov / 2) / zoom) + (pl.sprintAmt * 6 + G.fovKick + pl.slideAmt * 6) * D2R * (1 - W.st.ads);
    }
    // 設定の視野角は「横」。縦に直す
    var asp = R.W / R.H;
    var fovV = 2 * Math.atan(Math.tan(fov / 2) / Math.max(1, asp) * (asp < 1 ? 1 : 1));
    if (asp < 1) fovV = 2 * Math.atan(Math.tan(fov / 2) * 1.0);
    fov = fovV;
    G.camYaw = yaw; G.camPitch = pitch; G.camRoll = roll;
    R.setCamera(cam, yaw, pitch, roll, fov, 0.06, 600);
    R.setViewCamera(2 * Math.atan(Math.tan(41 * D2R) / Math.max(1, R.W / R.H)));
    R.setLights(gatherLights(cam));
    S.listener(cam, R.camFwd, R.camUp);
    var parts = [], viewParts = [];
    E.draw(G, parts, G.time);
    FX.drawDebris(parts);
    drawWorldObjects(parts, G.time);
    var showGun = G.player && G.player.alive && (G.state === 'play' || G.state === 'pause' || G.state === 'upgrade');
    if (showGun) W.draw(G.player, G, viewParts, G.time);
    // ポストエフェクト
    var target = (G.state === 'title' || G.state === 'pause' || G.state === 'upgrade' || G.state === 'shop' || G.state === 'dead') ? 1 : (G.settings.illust ? 1 : 0);
    R.post.sepia = M.damp(R.post.sepia, target, 5, rdt);
    R.post.damage = Math.max(0, R.post.damage - rdt * 1.5);
    G.thunderT = Math.max(0, (G.thunderT || 0) - rdt);
    R.post.flash = G.thunderT > 0 ? (Math.sin(G.thunderT * 60) > 0 ? 0.12 : 0.03) * (G.thunderT / 0.35) : 0;
    R.post.flashCol = [0.7, 0.75, 1];
    R.render({
      statics: G.world.meshes, parts: parts, viewParts: viewParts, time: G.time,
      fxHook: function (a, b, v) { drawFx(a, b, v, G.time); }
    });
  }
  G.render = render;

  // ---------------- 起動 ----------------
  S.onThunder = function () { G.thunderT = 0.35; };

  G.boot = function () {
    if (!R.init(canvas)) { document.getElementById('ui').innerHTML = '<div class="fatal">このブラウザは WebGL2 に対応していません。<br>Chrome / Edge / Firefox / Safari の新しい版でお試しください。</div>'; return; }
    R.setTextures(NF.T.build());
    G.applySettings();
    G.ui = NF.UI;
    NF.UI.init(G);
    G.titleWorld();
    G.setState('title');
    window.addEventListener('resize', function () { R.resize(); });
    NF.still = /still/.test(location.search);
    if (!NF.still) requestAnimationFrame(frame);
  };

  // テスト用: 描かずに時間だけ進める
  NF.sim = function (sec, dt) {
    dt = dt || 1 / 60; G.noRender = true;
    for (var t = 0; t < sec; t += dt) step(dt);
    G.noRender = false;
    return 'sim ' + sec;
  };
  // テスト用: 1フレームだけ描いて画像にする
  NF.snap = function (n, dt) {
    for (var i = 0; i < (n || 1); i++) step(dt || 1 / 60);
    var img = document.getElementById('snapimg') || new Image();
    img.id = 'snapimg';
    img.src = canvas.toDataURL();
    img.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none';
    if (!img.parentNode) document.body.insertBefore(img, document.getElementById('ui'));
    return 'ok';
  };
})();
