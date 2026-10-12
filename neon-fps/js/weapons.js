// 夜光区 — 武器
// それぞれ戦い方が違う 8 種の銃 + 刀 + 手榴弾
(function () {
  var M = NF.M, m4 = M.m4, R = NF.R, S = NF.S;
  var W = {};
  var D2R = Math.PI / 180;

  // ---------------- 武器のデータ ----------------
  // spread: ばらつき(度) / recoil: [上, 左右] / zoom: 覗いたときの倍率
  W.DEFS = {
    pistol: {
      name: 'P-9 ハチドリ', short: 'ハンドガン', kind: 'hitscan', auto: false, dmg: 30, rpm: 380, mag: 12, reserve: Infinity,
      reload: 1.05, spread: 0.35, adsSpread: 0.08, moveSpread: 1.4, recoil: [1.5, 0.5], kick: 0.06, zoom: 1.3, head: 2.3, range: 160,
      sound: 'pistol', tracer: [1, 0.8, 0.45], neon: [0.2, 0.95, 1.0], price: 0,
      desc: '弾数無限の相棒。速く正確で、頭を狙えば十分に強い。', style: '精密'
    },
    smg: {
      name: 'SMG スズメバチ', short: 'サブマシンガン', kind: 'hitscan', auto: true, dmg: 13, rpm: 950, mag: 40, reserve: 240,
      reload: 1.5, spread: 1.9, adsSpread: 0.9, moveSpread: 0.6, recoil: [0.55, 0.45], kick: 0.025, zoom: 1.2, head: 1.7, range: 70,
      sound: 'smg', tracer: [1, 0.9, 0.4], neon: [1, 0.85, 0.2], price: 600,
      desc: '腰だめでも当たる連射。走り回りながら近距離を制圧。', style: '機動'
    },
    rifle: {
      name: 'AR カラス', short: 'アサルトライフル', kind: 'hitscan', auto: true, dmg: 25, rpm: 620, mag: 30, reserve: 180,
      reload: 1.9, spread: 1.4, adsSpread: 0.18, moveSpread: 1.2, recoil: [0.9, 0.35], kick: 0.035, zoom: 1.6, head: 2.0, range: 200,
      sound: 'rifle', tracer: [1, 0.55, 0.3], neon: [1, 0.3, 0.5], price: 800,
      desc: '覗けば遠くまで届く万能銃。指切りで反動を抑えよう。', style: '万能'
    },
    shotgun: {
      name: 'SG イノシシ', short: 'ショットガン', kind: 'hitscan', auto: false, dmg: 13, pellets: 10, rpm: 75, mag: 6, reserve: 36,
      reload: 0.5, shellReload: true, spread: 6.5, adsSpread: 4.5, moveSpread: 0, recoil: [5, 1.2], kick: 0.16, zoom: 1.15, head: 1.5, range: 45,
      sound: 'shotgun', tracer: [1, 0.7, 0.3], neon: [1, 0.45, 0.15], push: 6, price: 700,
      desc: '至近距離で一撃。スライディングで飛びこめ。', style: '突撃'
    },
    rail: {
      name: 'レールガン サギ', short: 'レールガン', kind: 'rail', auto: false, dmg: 170, rpm: 70, mag: 4, reserve: 20,
      reload: 2.3, spread: 0.0, adsSpread: 0, moveSpread: 3.5, recoil: [6, 0.8], kick: 0.2, zoom: 3.4, head: 2.5, range: 400, charge: 0.55,
      sound: 'rail', tracer: [0.4, 0.9, 1], neon: [0.35, 0.8, 1.0], price: 1400, unlock: 'rail',
      desc: 'ためて撃つ電磁砲。並んだ敵をまとめて貫く。', style: '狙撃'
    },
    arc: {
      name: 'アークガン ホタル', short: 'アークガン', kind: 'beam', auto: true, dmg: 95, mag: 0, reserve: 0, heatRate: 0.28, coolRate: 0.45,
      range: 24, chain: 2, chainRange: 9, spread: 0, adsSpread: 0, moveSpread: 0, recoil: [0.05, 0.05], kick: 0.01, zoom: 1.15, head: 1.3,
      sound: 'arc', neon: [0.6, 1.0, 0.45], price: 1200, unlock: 'arc',
      desc: '弾切れなしの電撃。近くの敵へ次々と飛び移る。熱に注意。', style: '連鎖'
    },
    rocket: {
      name: 'ロケット タイホウ', short: 'ロケットランチャー', kind: 'proj', auto: false, dmg: 150, splash: 5.5, rpm: 70, mag: 2, reserve: 14,
      reload: 1.8, spread: 0, adsSpread: 0, moveSpread: 0, recoil: [4, 0.5], kick: 0.18, zoom: 1.2, head: 1, speed: 42, range: 300,
      sound: 'rocket', neon: [1, 0.3, 0.2], price: 1500, unlock: 'rocket',
      desc: '爆風で一網打尽。足もとに撃てばロケットジャンプ。', style: '爆破'
    },
    needle: {
      name: 'ニードラー ヤモリ', short: 'ニードラー', kind: 'needle', auto: true, dmg: 8, rpm: 520, mag: 24, reserve: 168,
      reload: 1.7, spread: 1.2, adsSpread: 0.6, moveSpread: 0.4, recoil: [0.3, 0.3], kick: 0.02, zoom: 1.3, head: 1, speed: 55, range: 120,
      sound: 'needle', neon: [1, 0.35, 0.9], price: 1300, unlock: 'needle',
      desc: '敵を追う結晶の針。6本刺さると大爆発。', style: '追尾'
    }
  };
  W.ORDER = ['pistol', 'smg', 'rifle', 'shotgun', 'rail', 'arc', 'rocket', 'needle'];

  // ---------------- 見た目(手に持った武器)----------------
  var DARK = [0.13, 0.13, 0.15], MID = [0.28, 0.29, 0.32], LIGHT = [0.5, 0.52, 0.56], GLOVE = [0.09, 0.08, 0.08], SLEEVE = [0.16, 0.14, 0.2], SKIN = [0.6, 0.45, 0.38];
  function P(mesh, x, y, z, sx, sy, sz, col, emi, rx, ry, rz, tag) {
    return { mesh: mesh, p: [x, y, z], s: [sx, sy, sz], r: [rx || 0, ry || 0, rz || 0], col: col, emi: emi || 0, tag: tag };
  }
  function hands(twoHand, fx, fz) {
    var a = [
      P('cube', 0.0, -0.075, 0.035, 0.062, 0.08, 0.08, GLOVE, 0, -0.25),
      P('cube', 0.03, -0.15, 0.13, 0.075, 0.075, 0.16, SLEEVE, 0, 0.6, 0, 0),
      P('cube', 0.03, -0.12, 0.07, 0.08, 0.012, 0.012, [1, 0.3, 0.6], 2.5, 0.6),
      P('cube', 0.0, -0.035, 0.035, 0.03, 0.025, 0.06, SKIN, 0, -0.3) // 指
    ];
    if (twoHand) {
      a.push(P('cube', fx || -0.01, -0.06, fz || -0.22, 0.065, 0.065, 0.085, GLOVE, 0, 0, 0, 0.3));
      a.push(P('cube', (fx || -0.01) - 0.07, -0.12, (fz || -0.22) + 0.08, 0.07, 0.07, 0.16, SLEEVE, 0, 0.5, 0.7, 0));
    }
    return a;
  }
  W.MODELS = {
    pistol: function (n) {
      return hands(false).concat([
        P('cube', 0, 0.0, -0.08, 0.042, 0.048, 0.2, DARK),
        P('cube', 0, 0.042, -0.09, 0.05, 0.042, 0.23, MID, 0, 0, 0, 0, 'slide'),
        P('cube', 0.026, 0.042, -0.09, 0.004, 0.008, 0.2, n, 3, 0, 0, 0, 'slide'),
        P('cube', -0.026, 0.042, -0.09, 0.004, 0.008, 0.2, n, 3, 0, 0, 0, 'slide'),
        P('cube', 0, -0.075, 0.01, 0.04, 0.12, 0.065, DARK, 0, -0.25),
        P('cube', 0, 0.07, -0.19, 0.01, 0.012, 0.01, n, 4, 0, 0, 0, 'slide'),
        P('cube', 0, 0.07, -0.0, 0.03, 0.012, 0.01, DARK, 0, 0, 0, 0, 'slide'),
        P('cube', 0, -0.035, -0.12, 0.03, 0.03, 0.03, LIGHT),
        P('cube', 0, -0.13, 0.02, 0.034, 0.03, 0.05, n, 1.5, -0.25, 0, 0, 'mag')
      ]);
    },
    smg: function (n) {
      return hands(true, -0.0, -0.2).concat([
        P('cube', 0, 0.01, -0.1, 0.055, 0.075, 0.32, DARK),
        P('cube', 0, 0.06, -0.12, 0.04, 0.03, 0.26, MID),
        P('cube', 0, 0.02, -0.3, 0.035, 0.035, 0.08, LIGHT),
        P('cyl', 0, 0.025, -0.36, 0.03, 0.06, 0.03, DARK, 0, Math.PI / 2),
        P('cube', 0, -0.09, -0.08, 0.035, 0.16, 0.05, MID, 0, 0.1, 0, 0, 'mag'),
        P('cube', 0.029, -0.09, -0.08, 0.004, 0.12, 0.03, n, 3, 0.1, 0, 0, 'mag'),
        P('cube', 0, -0.06, 0.02, 0.04, 0.1, 0.05, DARK, 0, -0.3),
        P('cube', 0, 0.09, -0.1, 0.012, 0.02, 0.05, n, 3),
        P('cube', 0.03, 0.01, -0.12, 0.004, 0.012, 0.26, n, 3),
        P('cube', 0, 0.02, 0.07, 0.03, 0.05, 0.08, MID)
      ]);
    },
    rifle: function (n) {
      return hands(true, -0.0, -0.27).concat([
        P('cube', 0, 0.0, -0.12, 0.055, 0.08, 0.42, DARK),
        P('cube', 0, 0.055, -0.12, 0.045, 0.03, 0.38, MID),
        P('cube', 0, 0.0, -0.4, 0.045, 0.05, 0.16, MID),
        P('cyl', 0, 0.01, -0.53, 0.024, 0.14, 0.024, DARK, 0, Math.PI / 2),
        P('cube', 0, -0.1, -0.13, 0.04, 0.15, 0.07, MID, 0, 0.25, 0, 0, 'mag'),
        P('cube', 0, -0.07, 0.0, 0.04, 0.11, 0.05, DARK, 0, -0.3),
        P('cube', 0, -0.005, 0.1, 0.045, 0.085, 0.12, DARK),
        // ドットサイト
        P('cube', 0, 0.1, -0.1, 0.05, 0.05, 0.09, DARK),
        P('cube', 0, 0.1, -0.145, 0.04, 0.04, 0.005, [0.15, 0.25, 0.3], 0.4),
        P('cube', 0, 0.1, -0.1, 0.006, 0.006, 0.006, [1, 0.2, 0.3], 6),
        P('cube', 0.03, 0.0, -0.25, 0.004, 0.015, 0.3, n, 3),
        P('cube', -0.03, 0.0, -0.25, 0.004, 0.015, 0.3, n, 3)
      ]);
    },
    shotgun: function (n) {
      return hands(true, 0, -0.28).concat([
        P('cube', 0, 0.02, -0.15, 0.06, 0.075, 0.38, DARK),
        P('cyl', 0, 0.045, -0.42, 0.045, 0.3, 0.045, MID, 0, Math.PI / 2),
        P('cyl', 0, -0.01, -0.38, 0.04, 0.26, 0.04, DARK, 0, Math.PI / 2),
        P('cube', 0, -0.03, -0.3, 0.065, 0.06, 0.14, LIGHT, 0, 0, 0, 0, 'pump'),
        P('cube', 0.034, -0.03, -0.3, 0.004, 0.04, 0.12, n, 3, 0, 0, 0, 'pump'),
        P('cube', 0, -0.07, 0.0, 0.045, 0.11, 0.055, DARK, 0, -0.3),
        P('cube', 0, -0.01, 0.1, 0.05, 0.09, 0.12, [0.25, 0.15, 0.1]),
        P('cube', 0, 0.075, -0.2, 0.01, 0.015, 0.02, n, 4),
        P('cube', 0.033, 0.03, -0.1, 0.004, 0.025, 0.2, [0.9, 0.7, 0.2], 1)
      ]);
    },
    rail: function (n) {
      return hands(true, 0, -0.3).concat([
        P('cube', 0, 0.0, -0.15, 0.07, 0.09, 0.5, DARK),
        P('cube', 0.045, 0.0, -0.45, 0.018, 0.05, 0.45, MID),
        P('cube', -0.045, 0.0, -0.45, 0.018, 0.05, 0.45, MID),
        P('cube', 0, 0.0, -0.45, 0.02, 0.02, 0.42, n, 4, 0, 0, 0, 'core'),
        P('cube', 0, -0.03, -0.45, 0.06, 0.012, 0.42, DARK),
        P('cyl', 0, 0.105, -0.12, 0.042, 0.2, 0.042, DARK, 0, Math.PI / 2),
        P('cube', 0, 0.075, -0.12, 0.02, 0.03, 0.06, MID),
        P('cyl', 0, 0.105, -0.222, 0.036, 0.005, 0.036, [0.2, 0.6, 0.8], 1.5, Math.PI / 2),
        P('cube', 0, -0.1, -0.05, 0.05, 0.1, 0.08, MID, 0, 0, 0, 0, 'mag'),
        P('cube', 0, -0.1, -0.05, 0.052, 0.02, 0.06, n, 3, 0, 0, 0, 'mag'),
        P('cube', 0, -0.07, 0.05, 0.045, 0.11, 0.055, DARK, 0, -0.3),
        P('cube', 0, 0.0, 0.12, 0.05, 0.09, 0.1, MID)
      ]);
    },
    arc: function (n) {
      return hands(true, 0, -0.24).concat([
        P('cube', 0, 0.0, -0.1, 0.08, 0.1, 0.34, DARK),
        P('sphere', 0, 0.02, -0.3, 0.12, 0.12, 0.12, n, 2.5, 0, 0, 0, 'core'),
        P('cyl', 0, 0.02, -0.3, 0.14, 0.03, 0.14, MID, 0, Math.PI / 2),
        P('cyl', 0, 0.02, -0.4, 0.03, 0.12, 0.03, LIGHT, 0, Math.PI / 2),
        P('cube', 0.06, 0.02, -0.45, 0.01, 0.01, 0.12, n, 4),
        P('cube', -0.06, 0.02, -0.45, 0.01, 0.01, 0.12, n, 4),
        P('cyl', 0, 0.1, 0.0, 0.06, 0.2, 0.06, [0.2, 0.2, 0.22], 0, Math.PI / 2),
        P('cube', 0, 0.1, 0.0, 0.065, 0.02, 0.15, n, 2, 0, 0, 0, 'heat'),
        P('cube', 0, -0.07, 0.02, 0.045, 0.11, 0.055, DARK, 0, -0.3)
      ]);
    },
    rocket: function (n) {
      return hands(true, -0.02, -0.25).concat([
        P('cyl', 0, 0.06, -0.12, 0.15, 0.7, 0.15, [0.25, 0.27, 0.22], 0, Math.PI / 2),
        P('cyl', 0, 0.06, -0.46, 0.17, 0.05, 0.17, DARK, 0, Math.PI / 2),
        P('cyl', 0, 0.06, -0.46, 0.11, 0.06, 0.11, n, 1.5, Math.PI / 2, 0, 0, 'mag'),
        P('cube', 0, 0.16, -0.05, 0.03, 0.06, 0.12, DARK),
        P('cube', 0.08, 0.06, -0.1, 0.005, 0.02, 0.5, n, 3),
        P('cube', 0, -0.07, 0.0, 0.045, 0.11, 0.055, DARK, 0, -0.3),
        P('cube', 0, 0.06, 0.24, 0.16, 0.16, 0.03, DARK)
      ]);
    },
    needle: function (n) {
      var a = hands(true, 0, -0.2).concat([
        P('cube', 0, 0.0, -0.1, 0.07, 0.08, 0.3, [0.3, 0.12, 0.3]),
        P('sphere', 0, 0.0, -0.27, 0.11, 0.09, 0.14, [0.35, 0.1, 0.35]),
        P('cube', 0, -0.07, 0.02, 0.045, 0.11, 0.055, DARK, 0, -0.3)
      ]);
      for (var i = 0; i < 7; i++) {
        var ang = -0.9 + i * 0.3;
        a.push(P('cone', Math.sin(ang) * 0.04, 0.05 + Math.cos(ang) * 0.02, -0.12 + (i % 2) * 0.05, 0.022, 0.09, 0.022, n, 4, -0.5, 0, ang * 0.8, 'needles'));
      }
      return a;
    }
  };
  // 刀(Vキー)
  W.KATANA = function () {
    return [
      P('cube', 0, 0, 0, 0.03, 0.03, 0.22, [0.15, 0.1, 0.1]),
      P('cube', 0, 0, -0.12, 0.08, 0.012, 0.03, [0.7, 0.6, 0.3]),
      P('cube', 0, 0, -0.55, 0.012, 0.035, 0.8, [0.85, 0.9, 0.95], 0.3),
      P('cube', 0, -0.018, -0.55, 0.004, 0.006, 0.8, [1, 0.25, 0.5], 4),
      P('cube', 0.0, -0.0, 0.02, 0.065, 0.08, 0.085, GLOVE)
    ];
  };
  // ADS で照準が画面中央に来る高さ
  W.SIGHT = { pistol: 0.072, smg: 0.1, rifle: 0.1, shotgun: 0.075, rail: 0.105, arc: 0.1, rocket: 0.18, needle: 0.06 };
  W.MUZZLE = { pistol: [0, 0.045, -0.22], smg: [0, 0.025, -0.4], rifle: [0, 0.01, -0.61], shotgun: [0, 0.045, -0.58], rail: [0, 0.0, -0.68], arc: [0, 0.02, -0.52], rocket: [0, 0.06, -0.47], needle: [0, 0.0, -0.36] };

  // ---------------- 武器の状態 ----------------
  W.make = function (id, level) {
    var d = W.DEFS[id];
    return { id: id, mag: d.mag, reserve: d.reserve, level: level || 0, heat: 0, overheat: 0 };
  };

  // 武器操作の状態
  var st = {
    switchT: 0, switching: false, nextFire: 0, reloadT: 0, reloadDur: 0, reloadSteps: null, charge: 0, chargeSnd: null, beamSnd: null,
    ads: 0, recoilP: 0, recoilY: 0, kickBack: 0, kickRot: 0, slide: 0, pump: 0, bobT: 0, swayX: 0, swayY: 0, melee: 0, meleeDir: 1,
    meleeCD: 0, nadeCD: 0, flash: 0, beamTargets: [], beamT: 0, lastShot: 0, burst: 0, spreadBloom: 0
  };
  W.st = st;

  function cur(pl) { return pl.weapons[pl.slot]; }
  W.current = cur;

  // ステータスへの改造(アップグレード)の反映
  function stat(pl, w, key) {
    var d = W.DEFS[w.id], v = d[key], m = pl.mods, lv = w.level;
    if (key === 'dmg') v *= (1 + lv * 0.15) * m.dmgMul;
    if (key === 'rpm') v *= m.rofMul * (1 + lv * 0.05);
    if (key === 'mag') v = d.mag ? Math.round(d.mag * m.magMul * (1 + lv * 0.1)) : 0;
    if (key === 'reload') v *= m.reloadMul;
    return v;
  }
  W.stat = stat;

  W.equip = function (pl, slot) {
    if (slot === pl.slot || !pl.weapons[slot]) return;
    W.stopLoops();
    pl.slot = slot;
    st.switchT = 0.32; st.reloadT = 0; st.reloadSteps = null; st.charge = 0;
    S.reloadStep('equip');
  };
  W.stopLoops = function () {
    if (st.chargeSnd) { st.chargeSnd.stop(); st.chargeSnd = null; }
    if (st.beamSnd) { st.beamSnd.stop(); st.beamSnd = null; }
    st.charge = 0; st.beamTargets = [];
  };

  W.startReload = function (pl) {
    var w = cur(pl), d = W.DEFS[w.id];
    if (!d.mag || st.reloadT > 0 || st.switchT > 0) return;
    var mag = stat(pl, w, 'mag');
    if (w.mag >= mag || w.reserve <= 0) return;
    W.stopLoops();
    var dur = stat(pl, w, 'reload');
    if (pl.mods.emptyReload && w.mag === 0) dur *= 0.6;
    st.reloadDur = st.reloadT = d.shellReload ? dur : dur;
    // 音を鳴らす時刻(0〜1)
    if (d.shellReload) st.reloadSteps = [[0.45, 'shell']];
    else if (w.id === 'rail' || w.id === 'arc') st.reloadSteps = [[0.15, 'out'], [0.55, 'cell'], [0.85, 'bolt']];
    else if (w.id === 'rocket') st.reloadSteps = [[0.2, 'out'], [0.65, 'in'], [0.9, 'bolt']];
    else st.reloadSteps = [[0.18, 'out'], [0.55, 'in'], [0.82, 'bolt']];
    st.reloadSteps.forEach(function (s) { s[2] = false; });
  };

  // 毎フレーム
  // input: {fire, firePressed, fireReleased, ads, reload, melee, nade, slot}
  W.update = function (dt, pl, input, G) {
    var w = cur(pl), d = W.DEFS[w.id];
    st.flash = Math.max(0, st.flash - dt * 12);
    st.kickBack = M.damp(st.kickBack, 0, 14, dt);
    st.kickRot = M.damp(st.kickRot, 0, 12, dt);
    st.slide = M.damp(st.slide, 0, 18, dt);
    st.pump = Math.max(0, st.pump - dt * 2.2);
    st.spreadBloom = Math.max(0, st.spreadBloom - dt * 3.5);
    st.meleeCD -= dt; st.nadeCD -= dt;
    if (st.melee > 0) st.melee = Math.max(0, st.melee - dt * 3.2);
    // 反動はもとに戻る
    var rec = st.lastShot > 0.15 ? 9 : 2.5;
    st.lastShot += dt;
    var rp = st.recoilP * (1 - Math.exp(-rec * dt)), ry = st.recoilY * (1 - Math.exp(-rec * dt));
    st.recoilP -= rp; st.recoilY -= ry;
    pl.pitch -= rp * (pl.mods.recoilMul || 1) * 0.7; pl.yaw -= ry * 0.7;

    // 冷却(アークガン)
    pl.weapons.forEach(function (x) {
      if (!x) return;
      if (x.id === 'arc') {
        if (x.overheat > 0) { x.overheat -= dt; x.heat = Math.max(0, x.heat - dt * 0.4); }
        else if (!(st.beamSnd && x === w)) x.heat = Math.max(0, x.heat - dt * W.DEFS.arc.coolRate);
      }
    });

    // 持ち替え中
    if (st.switchT > 0) { st.switchT -= dt; st.ads = M.damp(st.ads, 0, 10, dt); return; }

    // 近接(刀)
    if (input.melee && st.meleeCD <= 0) { W.stopLoops(); st.reloadT = 0; G.melee(); st.melee = 1; st.meleeDir = -st.meleeDir; st.meleeCD = 0.62 * (pl.mods.meleeSpeed || 1); }
    if (st.melee > 0.15) { st.ads = M.damp(st.ads, 0, 12, dt); return; }
    // 手榴弾
    if (input.nade && st.nadeCD <= 0 && pl.nades > 0) { G.throwNade(); pl.nades--; st.nadeCD = 0.7; st.kickRot = -0.3; }

    // 覗く
    var wantAds = input.ads && st.reloadT <= 0 && !pl.sprinting;
    st.ads = M.damp(st.ads, wantAds ? 1 : 0, 14, dt);

    // リロード
    if (st.reloadT > 0) {
      st.reloadT -= dt;
      var k = 1 - st.reloadT / st.reloadDur;
      if (st.reloadSteps) st.reloadSteps.forEach(function (s) { if (!s[2] && k >= s[0]) { s[2] = true; S.reloadStep(s[1], w.id); } });
      if (st.reloadT <= 0) {
        var mag = stat(pl, w, 'mag');
        if (d.shellReload) {
          w.mag++; if (w.reserve !== Infinity) w.reserve--;
          if (w.mag < mag && w.reserve > 0 && !input.fire) { st.reloadT = st.reloadDur; st.reloadSteps.forEach(function (s) { s[2] = false; }); }
          else { S.reloadStep('bolt'); st.pump = 1; }
        } else {
          var need = mag - w.mag, take = Math.min(need, w.reserve);
          w.mag += take; if (w.reserve !== Infinity) w.reserve -= take;
        }
      }
      if (d.shellReload && input.firePressed && w.mag > 0) st.reloadT = 0; // 弾込め中でも撃てる
      else return;
    }
    if (input.reload) { W.startReload(pl); if (st.reloadT > 0) return; }
    if (pl.sprinting && !pl.sliding) { W.stopLoops(); return; }

    var t = G.time;
    // ---- 種類ごとの射撃 ----
    if (d.kind === 'beam') {
      if (input.fire && w.overheat <= 0) {
        if (!st.beamSnd) st.beamSnd = S.beam();
        w.heat += dt * d.heatRate;
        st.beamSnd.set(w.heat);
        st.beamT -= dt;
        if (st.beamT <= 0) { st.beamT = 0.07; G.beamTick(stat(pl, w, 'dmg') * 0.07, d); }
        st.kickBack = 0.012 + Math.random() * 0.01;
        st.flash = 0.6;
        if (w.heat >= 1) { w.overheat = 2.2; W.stopLoops(); S.shieldBreak(); G.ui.toast('オーバーヒート!'); }
      } else if (st.beamSnd) { W.stopLoops(); }
      return;
    }
    if (d.kind === 'rail') {
      if (input.fire && w.mag > 0 && t >= st.nextFire) {
        if (!st.chargeSnd) st.chargeSnd = S.charge();
        st.charge = Math.min(1, st.charge + dt / (d.charge * (pl.mods.chargeMul || 1)));
        st.chargeSnd.set(st.charge);
      }
      if ((input.fireReleased || (!input.fire && st.charge > 0)) && st.charge > 0) {
        var c = st.charge;
        W.stopLoops();
        if (c > 0.25) { fire(pl, w, d, G, c); st.nextFire = t + 60 / stat(pl, w, 'rpm'); }
      }
      if (w.mag <= 0 && input.firePressed) { S.dry(); W.startReload(pl); }
      return;
    }
    var canFire = d.auto ? input.fire : input.firePressed;
    if (canFire && t >= st.nextFire) {
      if (w.mag <= 0) {
        if (input.firePressed) S.dry();
        if (w.reserve > 0) W.startReload(pl);
        st.nextFire = t + 0.25;
        return;
      }
      fire(pl, w, d, G, 1);
      st.nextFire = t + 60 / stat(pl, w, 'rpm');
      if (w.mag <= 0 && w.reserve > 0) G.after(0.22, function () { if (cur(pl) === w && w.mag === 0) W.startReload(pl); });
    }
  };

  function fire(pl, w, d, G, charge) {
    w.mag--;
    st.lastShot = 0;
    var spreadDeg = M.lerp(d.spread, d.adsSpread, st.ads) + d.moveSpread * pl.moveFrac + st.spreadBloom;
    if (pl.sliding && pl.mods.slideAcc) spreadDeg *= 0.3;
    if (!pl.onGround) spreadDeg += d.moveSpread * 0.8;
    var dmg = stat(pl, w, 'dmg') * charge;
    // 反動
    var rk = (d.recoil[0] + Math.random() * d.recoil[0] * 0.3) * D2R * (1 - st.ads * 0.35);
    st.recoilP += rk; st.recoilY += (Math.random() - 0.5) * d.recoil[1] * 2 * D2R;
    st.kickBack = Math.min(0.09, st.kickBack + d.kick * 0.35); st.kickRot = Math.min(0.35, st.kickRot + d.kick * 1.4); st.slide = 1; st.flash = 1;
    st.spreadBloom = Math.min(d.kind === 'hitscan' && d.auto ? 2.2 : 1, st.spreadBloom + (d.auto ? 0.18 : 0.4));
    if (d.pump || w.id === 'shotgun') st.pump = 1.4;
    G.onPlayerFire(w, d);
    S.shoot(d.sound);
    var origin = G.eyePos(), fwd = G.aimDir();
    if (d.kind === 'hitscan' || d.kind === 'rail') {
      var n = d.pellets || 1;
      for (var i = 0; i < n; i++) {
        var dir = coneDir(fwd, spreadDeg * D2R * (n > 1 ? (0.4 + Math.random() * 0.6) : Math.sqrt(Math.random())));
        G.fireRay(origin, dir, dmg, { weapon: w.id, head: d.head, range: d.range, pierce: d.kind === 'rail', tracer: d.tracer, rail: d.kind === 'rail', pellet: n > 1, push: d.push || 0, charge: charge });
      }
      if (d.push && !pl.onGround) G.pushPlayer(M.mul(fwd, -d.push * 0.9));
    } else if (d.kind === 'proj') {
      G.firePlayerProj('rocket', origin, coneDir(fwd, spreadDeg * D2R), dmg, d);
    } else if (d.kind === 'needle') {
      G.firePlayerProj('needle', origin, coneDir(fwd, spreadDeg * D2R * Math.sqrt(Math.random())), dmg, d);
    }
  }
  // 円すいの中でランダムな向き
  function coneDir(f, ang) {
    if (ang <= 0) return f.slice();
    var up = Math.abs(f[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    var r = M.norm(M.cross(f, up)), u = M.cross(r, f);
    var a = Math.random() * Math.PI * 2, s = Math.tan(ang);
    return M.norm(M.add(f, M.add(M.mul(r, Math.cos(a) * s), M.mul(u, Math.sin(a) * s))));
  }
  W.coneDir = coneDir;

  // ---------------- 手もとの描画 ----------------
  var tmpA = new Float32Array(16), tmpB = new Float32Array(16), tmpC = new Float32Array(16), camW = new Float32Array(16);
  var cache = {};
  function model(id) {
    if (!cache[id]) {
      var n = id === 'katana' ? null : W.DEFS[id].neon;
      cache[id] = id === 'katana' ? W.KATANA() : W.MODELS[id](n);
    }
    return cache[id];
  }
  W.clearCache = function () { cache = {}; };
  var MESH = function (n) { return n === 'cube' ? R.cube : n === 'sphere' ? R.sphere : n === 'cyl' ? R.cyl : R.cone; };

  W.draw = function (pl, G, out, time) {
    var w = cur(pl), id = w.id;
    var sight = W.SIGHT[id];
    // 揺れ(歩き)
    var bobA = pl.bobAmt, bt = pl.bobT;
    var bx = Math.sin(bt) * 0.012 * bobA, by = -Math.abs(Math.cos(bt)) * 0.014 * bobA;
    var ads = st.ads;
    var hip = [0.16, -0.19, -0.56], aim = [0, -sight, -0.36];
    if (id === 'rocket') { hip = [0.2, -0.22, -0.45]; aim = [0.0, -sight - 0.01, -0.34]; }
    var px = M.lerp(hip[0], aim[0], ads) + bx * (1 - ads * 0.85) + st.swayX * (1 - ads * 0.8);
    var py = M.lerp(hip[1], aim[1], ads) + by * (1 - ads * 0.85) + st.swayY * (1 - ads * 0.8);
    var pz = M.lerp(hip[2], aim[2], ads) + st.kickBack;
    var rx = st.kickRot * (1 - ads * 0.6), ry = 0, rz = 0;
    // 走っているときは傾ける
    var spr = pl.sprintAmt;
    px += spr * 0.03; py -= spr * 0.04; rx -= spr * 0.25; ry += spr * 0.5; rz += spr * 0.1;
    // 滑り込み
    rz += pl.slideAmt * 0.35;
    // 持ち替え・リロード
    var sw = st.switchT > 0 ? st.switchT / 0.32 : 0;
    py -= sw * 0.3; rx -= sw * 0.6;
    var rl = 0;
    if (st.reloadT > 0) {
      var k = 1 - st.reloadT / st.reloadDur;
      rl = Math.sin(Math.min(1, k) * Math.PI);
      var dd = W.DEFS[id];
      if (dd.shellReload) { rz += 0.25 * rl; py -= 0.02 * rl; }
      else { rz += 0.5 * rl; rx += 0.15 * rl; py -= 0.06 * rl; }
    }
    // 刀を振る
    var mel = st.melee;
    if (mel > 0) { py -= Math.sin(mel * Math.PI) * 0.35; }
    // カメラの世界行列
    m4.compose(camW, R.camPos[0], R.camPos[1], R.camPos[2], G.camPitch, G.camYaw, G.camRoll, 1, 1, 1);
    m4.compose(tmpA, px, py, pz, rx, ry, rz, 1, 1, 1);
    m4.mul(tmpB, camW, tmpA);
    var parts = model(id);
    var d = W.DEFS[id];
    var heat = w.heat || 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var ox = p.p[0], oy = p.p[1], oz = p.p[2], e = p.emi, col = p.col;
      if (p.tag === 'slide') oz += st.slide * 0.035;
      if (p.tag === 'pump') oz += Math.sin(Math.min(1, st.pump) * Math.PI) * 0.08 * (st.pump < 1.0 ? 1 : 0);
      if (p.tag === 'mag' && st.reloadT > 0 && !d.shellReload) { var kk = 1 - st.reloadT / st.reloadDur; var off = kk < 0.25 ? kk / 0.25 : kk < 0.5 ? 1 : kk < 0.65 ? 1 - (kk - 0.5) / 0.15 : 0; oy -= off * 0.25; }
      if (p.tag === 'core') { e = p.emi * (1 + st.charge * 3 + st.flash * 2 + Math.sin(time * 8) * 0.2); }
      if (p.tag === 'heat') { col = [M.lerp(0.4, 1, heat), M.lerp(1, 0.25, heat), M.lerp(0.4, 0.1, heat)]; e = 1.5 + heat * 4 + (w.overheat > 0 ? Math.sin(time * 30) * 2 : 0); }
      if (p.tag === 'needles') { var vis = w.mag / Math.max(1, stat(pl, w, 'mag')); if (i % 7 / 7 > vis) continue; }
      m4.compose(tmpA, ox, oy, oz, p.r[0], p.r[1], p.r[2], p.s[0], p.s[1], p.s[2]);
      var mm = new Float32Array(16);
      m4.mul(mm, tmpB, tmpA);
      out.push({ mesh: MESH(p.mesh), m: mm, tint: [col[0], col[1], col[2], e] });
    }
    // 刀
    if (mel > 0) {
      var ph = 1 - mel; // 0→1
      var sweep = M.lerp(1.4, -1.6, M.smooth(ph * 1.4)) * st.meleeDir;
      m4.compose(tmpA, 0.05 + sweep * 0.12, -0.1 + Math.sin(ph * Math.PI) * 0.08, -0.3, -0.2, sweep * 0.9, -sweep * 0.6 + 1.3 * st.meleeDir, 1, 1, 1);
      m4.mul(tmpC, camW, tmpA);
      var kp = model('katana');
      for (i = 0; i < kp.length; i++) {
        var q = kp[i];
        m4.compose(tmpA, q.p[0], q.p[1], q.p[2], q.r[0], q.r[1], q.r[2], q.s[0], q.s[1], q.s[2]);
        var m2 = new Float32Array(16);
        m4.mul(m2, tmpC, tmpA);
        out.push({ mesh: MESH(q.mesh), m: m2, tint: [q.col[0], q.col[1], q.col[2], q.emi] });
      }
    }
    // 銃口の位置(世界座標)
    var mz = W.MUZZLE[id];
    W.muzzleWorld = m4.transformPoint(tmpB, mz);
    return W.muzzleWorld;
  };

  NF.W = W;
})();
