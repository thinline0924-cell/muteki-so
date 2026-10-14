/* =========================================================
   main.js — ゲーム全体の進行
   タイトル → モード → マシン → コース → 読み込み → レース → 結果
   ・物理は 1/120 秒ごと(固定)、描画は画面の速さで
   ・カメラ5種類、ゴースト、ラップ/セクター計測、順位、設定の保存
   ========================================================= */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var TAU = Math.PI * 2;

  // ---------- エラー表示(初心者でも原因が分かるように)----------
  window.addEventListener('error', function (e) {
    var el = $('err'); el.classList.remove('hidden');
    el.innerHTML = 'エラーが起きました。ページを再読み込みしてください。<br><small>' + (e.message || e) + '</small>';
  });

  // ---------- 保存(ブラウザが保存を禁止していても動くように)----------
  function load(key, def) {
    try { var v = JSON.parse(localStorage.getItem(key)); if (v && typeof v === 'object') { for (var k in def) if (!(k in v)) v[k] = def[k]; return v; } } catch (e) {}
    return JSON.parse(JSON.stringify(def));
  }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  var SET = load('musou.settings', { quality: 'high', master: 0.8, engine: 0.9, sfx: 0.8, music: 0.5, tcs: true, abs: true, stab: true, steerAssist: true, auto: true, camera: 0, ghost: true, opp: 5, diff: 1, laps: {} });
  var REC = load('musou.records', {});

  // ---------- 描画の準備 ----------
  var cv = $('gl');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    $('err').classList.remove('hidden');
    $('err').innerHTML = 'このブラウザでは3D(WebGL)が使えません。Chrome / Edge / Safari の最新版で開いてください。';
    return;
  }
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 40000);
  var fxc = $('fx'), fx = fxc.getContext('2d');
  function applyQuality() {
    var dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(SET.quality === 'high' ? Math.min(dpr, 2) : SET.quality === 'mid' ? Math.min(dpr, 1.25) : 0.8);
    renderer.shadowMap.enabled = SET.quality !== 'low';
  }
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    applyQuality();
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    fxc.width = w; fxc.height = h;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- キー入力 ----------
  var keys = {};
  var GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'];
  window.addEventListener('keydown', function (e) {
    RaceAudio.init(); if (state === 'title' || state === 'menu') RaceAudio.startMusic();
    if (GAME_KEYS.indexOf(e.code) >= 0) e.preventDefault();
    var first = !keys[e.code];
    keys[e.code] = true;
    if (first) onKey(e.code, e);
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { keys = {}; if (state === 'race' && session && session.phase !== 'done') setPause(true); });
  document.addEventListener('pointerdown', function () { RaceAudio.init(); if (state === 'title' || state === 'menu') RaceAudio.startMusic(); }, { capture: true });
  function down(a, b) { return !!(keys[a] || (b && keys[b])); }

  // ---------- 状態 ----------
  var state = 'title', overlayStack = [];
  var world = null, track = null, worldTrack = -1;
  var trackCache = {};
  var sel = { car: 0, track: 0, mode: 'race' };
  var session = null;
  var showroom = { models: {}, cur: null, angle: 0, drag: null };
  var camMode = SET.camera | 0;
  var CAM_NAMES = ['CHASE', 'NEAR', 'BONNET', 'COCKPIT', 'TV'];

  function showScreen(id) {
    ['title', 'menu', 'carsel', 'tracksel', 'loading', 'hud', 'pause', 'results'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id && !(id === 'pause' && s === 'hud') && !(id === 'results' && s === 'hud')); });
  }
  function fade(cb) {
    var f = $('fade'); f.classList.add('on');
    setTimeout(function () { cb(); setTimeout(function () { f.classList.remove('on'); }, 60); }, 460);
  }

  // ---------- コースの読み込み ----------
  var TIPS = [
    'ブレーキは「まっすぐのうちに強く」、曲がりながら少しずつ抜くと速い。',
    'ダウンフォースは速度の2乗で増える。高速コーナーほどタイヤは路面に押しつけられる。',
    'タイヤは温まるとグリップが増える。テレメトリー(T キー)で温度が見られる。',
    'ハイブリッド車は全開で電池を使い、ブレーキで充電する。Space で一気に放出。',
    'ターボ車はアクセルを開けてから力が出るまで少し遅れる。早めに踏もう。',
    '前の車のすぐ後ろでは空気抵抗が減る(スリップストリーム)。',
    'マニュアル変速は E / Q。回しすぎるとシフトダウンを断られる。'
  ];
  function ensureWorld(ti, done) {
    if (world && worldTrack === ti) { done(); return; }
    var def = TRACKS[ti];
    showScreen('loading');
    $('load-name').textContent = def.name;
    $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    var fill = $('load-fill'), msg = $('load-msg');
    fill.style.width = '8%'; msg.textContent = 'コースの形を計算しています…';
    setTimeout(function () {
      track = trackCache[def.id] || (trackCache[def.id] = TrackGen.build(def));
      fill.style.width = '35%'; msg.textContent = '地形・木・観客席を置いています…';
      setTimeout(function () {
        if (world) { world.dispose(); world = null; }
        world = World.build(renderer, track, { quality: SET.quality });
        worldTrack = ti;
        renderer.toneMappingExposure = SKIES[def.time].exposure;
        fill.style.width = '85%'; msg.textContent = '光と影を準備しています…';
        setTimeout(function () {
          try { renderer.compile(world.scene, camera); } catch (e) {}
          fill.style.width = '100%';
          setTimeout(done, 120);
        }, 40);
      }, 40);
    }, 60);
  }

  // =========================================================
  //  タイトル / ショールーム
  // =========================================================
  function showroomCar(ci) {
    if (!world) return;
    if (showroom.cur) world.scene.remove(showroom.cur.root);
    var m = showroom.models[ci];
    if (!m || m.worldId !== worldTrack) { m = CarModel.build(CARS[ci]); m.worldId = worldTrack; showroom.models[ci] = m; }
    var p = TrackGen.pointAt(track, -40, 0);
    m.root.position.set(p.x, p.z, -p.y);
    m.root.rotation.set(0, p.th, 0);
    m.update({ speedLong: 0, brakeTemp: [0, 0, 0, 0], lightsOn: TRACKS[worldTrack].time === 'dusk' }, 0);
    world.scene.add(m.root);
    showroom.cur = m;
    RaceAudio.prepare(CARS[ci]);
  }
  function enterTitle() {
    state = 'title';
    showScreen('title');
    ensureWorld(0, function () {
      if (state === 'title') showScreen('title'); else if (state === 'menu') showScreen('menu');
      showroomCar(sel.car);
      world.beams.visible = true;
    });
  }

  // ---------- メニュー共通(上下で選ぶ)----------
  function listNav(listEl, dir) {
    var items = listEl.querySelectorAll('li'), idx = 0;
    items.forEach(function (li, k) { if (li.classList.contains('on')) idx = k; });
    idx = (idx + dir + items.length) % items.length;
    items.forEach(function (li, k) { li.classList.toggle('on', k === idx); });
    RaceAudio.se('click');
    return items[idx];
  }
  function listCurrent(listEl) { return listEl.querySelector('li.on') || listEl.querySelector('li'); }
  function setupList(listEl, handler) {
    listEl.querySelectorAll('li').forEach(function (li, k) {
      if (k === 0) li.classList.add('on');
      li.addEventListener('mouseenter', function () { listEl.querySelectorAll('li').forEach(function (o) { o.classList.toggle('on', o === li); }); });
      li.addEventListener('click', function () { handler(li.dataset.act); });
    });
  }
  setupList($('menu-list'), menuAct);
  setupList($('pause-list'), pauseAct);

  function enterMenu() {
    state = 'menu';
    showScreen('menu');
    if (world) world.beams.visible = true;
    RaceAudio.startMusic();
  }
  function menuAct(act) {
    RaceAudio.se('select');
    if (act === 'timeattack' || act === 'race') { sel.mode = act; enterCarSel(); }
    else if (act === 'settings') openOverlay('settings');
    else if (act === 'help') openOverlay('help');
    else if (act === 'title') enterTitle();
  }

  // ---------- オーバーレイ(設定・操作・クレジット)----------
  function openOverlay(id) {
    if (id === 'settings') buildSettings();
    $(id).classList.remove('hidden');
    overlayStack.push(id);
  }
  function closeOverlay() {
    var id = overlayStack.pop();
    if (id) $(id).classList.add('hidden');
    RaceAudio.se('back');
  }
  ['settings', 'help', 'credits'].forEach(function (id) {
    $(id).addEventListener('click', function (e) { if (e.target.dataset.act === 'close' || e.target === $(id)) closeOverlay(); });
  });
  document.querySelectorAll('#title .pill').forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); RaceAudio.init(); RaceAudio.se('select'); openOverlay(b.dataset.act); });
  });
  $('title').addEventListener('click', function () { if (state === 'title' && !overlayStack.length) startFromTitle(); });
  function startFromTitle() {
    RaceAudio.init(); RaceAudio.startMusic(); RaceAudio.se('start');
    enterMenu();
  }

  function buildSettings() {
    var rows = [
      ['quality', '画質', '次にコースを読み込んだときに反映', [['low', '低'], ['mid', '中'], ['high', '高']]],
      ['auto', '変速', 'MT は E / Q で手動', [[true, 'AT'], [false, 'MT']]],
      ['tcs', 'トラクションコントロール', 'ホイールスピンをおさえる', [[true, 'ON'], [false, 'OFF']]],
      ['abs', 'ABS', 'ブレーキでタイヤをロックさせない', [[true, 'ON'], [false, 'OFF']]],
      ['stab', '姿勢制御', 'スピンしかけたら少し戻す', [[true, 'ON'], [false, 'OFF']]],
      ['steerAssist', 'ステアリング補助', 'いちばん粘る角度までしか切らない', [[true, 'ON'], [false, 'OFF']]],
      ['ghost', 'ゴースト', 'タイムアタックでベストの走りを表示', [[true, 'ON'], [false, 'OFF']]],
      ['camera', 'はじめのカメラ', '走行中は C で切りかえ', [[0, '後方'], [1, '近め'], [2, 'ボンネ'], [3, 'コクピ'], [4, 'TV']]],
      ['master', '全体の音量', '', 'range'], ['engine', 'エンジン音', '', 'range'], ['sfx', '効果音', '', 'range'], ['music', '音楽', '', 'range']
    ];
    var g = $('set-grid'); g.innerHTML = '';
    rows.forEach(function (r) {
      var row = document.createElement('div'); row.className = 'set-row';
      row.innerHTML = '<div>' + r[1] + (r[2] ? '<small>' + r[2] + '</small>' : '') + '</div>';
      if (r[3] === 'range') {
        var inp = document.createElement('input'); inp.type = 'range'; inp.min = 0; inp.max = 1; inp.step = 0.05; inp.value = SET[r[0]];
        inp.addEventListener('input', function () { SET[r[0]] = +inp.value; RaceAudio.setVolume(r[0], +inp.value); save('musou.settings', SET); });
        row.appendChild(inp);
      } else {
        var seg = document.createElement('div'); seg.className = 'seg';
        r[3].forEach(function (o) {
          var b = document.createElement('button'); b.textContent = o[1];
          if (SET[r[0]] === o[0]) b.className = 'on';
          b.addEventListener('click', function () {
            SET[r[0]] = o[0]; save('musou.settings', SET);
            seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
            RaceAudio.se('click');
            if (r[0] === 'quality') resize();
            if (r[0] === 'camera') camMode = o[0];
            if (session) applyAssists(session.player.sim);
          });
          seg.appendChild(b);
        });
        row.appendChild(seg);
      }
      g.appendChild(row);
    });
  }
  function applyAssists(sim) {
    sim.assists = { tcs: SET.tcs, abs: SET.abs, stab: SET.stab, steer: SET.steerAssist, auto: SET.auto };
  }
  ['master', 'engine', 'sfx', 'music'].forEach(function (k) { RaceAudio.vol[k] = SET[k]; });

  // =========================================================
  //  マシン選択
  // =========================================================
  var gaugePrev = $('gauge-prev'), gpx = null, gpSize = null;
  function enterCarSel() {
    state = 'carsel';
    showScreen('carsel');
    fillCar();
  }
  function peakKW(c) { return TrackGen.peakPower(c) / 1000; }
  function fillCar() {
    var c = CARS[sel.car];
    $('car-count').textContent = (sel.car + 1) + ' / ' + CARS.length;
    $('ci-class').textContent = c.cls + ' ・ ' + c.year;
    $('ci-name').textContent = c.name;
    $('ci-jp').textContent = c.jp;
    $('ci-motif').textContent = 'モチーフ:' + c.motif;
    $('ci-desc').textContent = c.desc;
    var kw = peakKW(c), tot = kw + (c.ers ? c.ers.power / 1000 : 0);
    if (c.ers && c.ers.cap) tot = Math.min(tot, c.ers.cap / 1000);
    var tq = 0; c.torque.forEach(function (p) { tq = Math.max(tq, p[1]); });
    var vtop = Math.pow(tot * 1000 * 0.9 / (0.6125 * c.cdA), 1 / 3) * 3.6;
    var rows = [
      ['ENGINE', c.engineLabel],
      ['POWER', Math.round(kw) + ' kW (' + Math.round(kw * 1.36) + ' PS)' + (c.ers ? ' + ERS ' + Math.round(c.ers.power / 1000) + ' kW' : '')],
      ['TORQUE', Math.round(tq) + ' Nm'],
      ['WEIGHT', c.mass + ' kg(ドライバー込み)'],
      ['POWER / WEIGHT', (tot * 1.36 / c.mass * 1000).toFixed(0) + ' PS/t'],
      ['DOWNFORCE @250', Math.round(0.6125 * c.clA * Math.pow(250 / 3.6, 2) / 9.81) + ' kg'],
      ['TOP SPEED (calc.)', Math.round(Math.min(vtop, 400)) + ' km/h'],
      ['GEARBOX', c.gears.ratios.length + '速 ' + (c.gearbox === 'SEQ' ? 'シーケンシャル(パドル)' : 'Hパターン')],
      ['DRIVE', c.ers ? 'MR + 前輪モーター(AWD)' : 'MR(後輪駆動)'],
      ['REDLINE', c.redline + ' rpm']
    ];
    $('ci-spec').innerHTML = rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('');
    var bars = [['POWER', tot / 700], ['GRIP', (c.mu - 1.5) / 0.25], ['AERO', c.clA / 4], ['BRAKE', c.brake / c.mass / 36], ['AGILITY', 1.2 - c.mass / 1400 + (3.1 - c.wheelbase) * 0.6]];
    $('ci-bars').innerHTML = bars.map(function (b) { return '<div class="bar">' + b[0] + '<i><b style="width:' + Math.round(clamp(b[1], 0.08, 1) * 100) + '%"></b></i></div>'; }).join('');
    var G = HUD.GAUGES[c.gauge];
    gpx = HUD.hiDPI(gaugePrev, G.w * 0.8, G.h * 0.8); gpSize = G;
    showroomCar(sel.car);
  }
  function drawGaugePreview(t) {
    if (!gpx || state !== 'carsel') return;
    var c = CARS[sel.car], G = HUD.GAUGES[c.gauge];
    var rpm = c.idle + (Math.sin(t / 900) * 0.5 + 0.5) * (c.redline - c.idle) * 0.9;
    var fake = { rpm: rpm, gear: 3, boostBar: (c.turbo ? c.turbo.maxBar * 0.7 : 0), thr: 1, otActive: false, oilT: 96, waterT: 86, fuel: 70, ersE: c.ers ? c.ers.battery * 0.7 : 0, ersP: 0, harvestP: 0, speed: rpm / c.redline * 70, limiterT: 0 };
    gpx.save(); gpx.scale(0.8, 0.8);
    G.draw(gpx, G.w, G.h, fake, c, rpm / c.redline * 250, { delta: -0.123 });
    gpx.restore();
  }
  $('car-prev').addEventListener('click', function () { carStep(-1); });
  $('car-next').addEventListener('click', function () { carStep(1); });
  function carStep(d) { sel.car = (sel.car + d + CARS.length) % CARS.length; RaceAudio.se('click'); fillCar(); }
  cv.addEventListener('pointerdown', function (e) { if (state === 'carsel' || state === 'title') showroom.drag = { x: e.clientX, a: showroom.angle }; });
  window.addEventListener('pointermove', function (e) { if (showroom.drag) showroom.angle = showroom.drag.a - (e.clientX - showroom.drag.x) * 0.008; });
  window.addEventListener('pointerup', function () { showroom.drag = null; });

  // =========================================================
  //  コース選択
  // =========================================================
  var DIFF = ['やさしい', 'ふつう', 'つよい'];
  function enterTrackSel() {
    state = 'tracksel';
    showScreen('tracksel');
    var ul = $('track-list');
    ul.innerHTML = TRACKS.map(function (t, k) { return '<li data-k="' + k + '"><b>' + t.name + '</b><small>' + t.jp + '</small></li>'; }).join('');
    ul.querySelectorAll('li').forEach(function (li) {
      li.addEventListener('click', function () { if (sel.track === +li.dataset.k) startRace(); else { sel.track = +li.dataset.k; RaceAudio.se('click'); fillTrack(); } });
    });
    $('race-opts').style.display = '';
    fillTrack();
  }
  function lapsFor(ti) { var v = SET.laps[TRACKS[ti].id]; return v || TRACKS[ti].laps; }
  function fillTrack() {
    var def = TRACKS[sel.track];
    $('track-list').querySelectorAll('li').forEach(function (li) { li.classList.toggle('on', +li.dataset.k === sel.track); });
    var tr = trackCache[def.id] || (trackCache[def.id] = TrackGen.build(def));
    $('ti-name').textContent = def.name;
    $('ti-motif').textContent = def.jp + ' ・ モチーフ:' + def.motif;
    $('ti-desc').textContent = def.desc;
    var zmin = Infinity, zmax = -Infinity, corners = 0, inC = false;
    for (var i = 0; i < tr.N; i++) {
      zmin = Math.min(zmin, tr.z[i]); zmax = Math.max(zmax, tr.z[i]);
      var c = Math.abs(tr.k[i]) > 1 / 250;
      if (c && !inC) corners++;
      inC = c;
    }
    var rec = REC[def.id + '/' + CARS[sel.car].id];
    var timeJp = { morning: '朝・霧', overcast: 'くもり・霧', afternoon: '午後・晴れ', dusk: '夕暮れ' }[def.time];
    var rows = [['LENGTH', (tr.length / 1000).toFixed(3) + ' km'], ['CORNERS', corners], ['ELEVATION', (zmax - zmin).toFixed(0) + ' m'], ['WIDTH', def.width + ' m'], ['TIME / WEATHER', timeJp], ['YOUR BEST (' + CARS[sel.car].name + ')', rec ? HUD.fmtTime(rec) : '—']];
    $('ti-spec').innerHTML = rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('');
    $('opt-laps').textContent = sel.mode === 'race' ? lapsFor(sel.track) : '∞';
    $('opt-opp').textContent = sel.mode === 'race' ? SET.opp : '0';
    $('opt-diff').textContent = DIFF[SET.diff];
    // 地図
    var mc = $('track-map'), size = Math.min(300, window.innerWidth * 0.36);
    var mx = HUD.hiDPI(mc, size, size * 0.8);
    var b = tr.bounds, w = b.maxx - b.minx, h = b.maxy - b.miny, sc = Math.min((size - 30) / w, (size * 0.8 - 30) / h);
    var ox = size / 2 - (b.minx + w / 2) * sc, oy = size * 0.4 + (b.miny + h / 2) * sc;
    mx.lineJoin = 'round';
    mx.strokeStyle = 'rgba(27,36,48,0.18)'; mx.lineWidth = 9; path(); mx.stroke();
    mx.strokeStyle = '#1b2430'; mx.lineWidth = 3; path(); mx.stroke();
    var p0 = TrackGen.pointAt(tr, 0, 0);
    mx.fillStyle = '#c4202c'; mx.beginPath(); mx.arc(ox + p0.x * sc, oy - p0.y * sc, 5, 0, TAU); mx.fill();
    // 進む向きの矢印
    var p1 = TrackGen.pointAt(tr, 60, 0);
    mx.strokeStyle = '#c4202c'; mx.lineWidth = 2; mx.beginPath(); mx.moveTo(ox + p0.x * sc, oy - p0.y * sc); mx.lineTo(ox + p1.x * sc, oy - p1.y * sc); mx.stroke();
    function path() { mx.beginPath(); for (var k = 0; k <= tr.N; k += 4) { var q = k % tr.N; var X = ox + tr.x[q] * sc, Y = oy - tr.y[q] * sc; if (k) mx.lineTo(X, Y); else mx.moveTo(X, Y); } mx.closePath(); }
  }
  $('race-opts').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    optStep(b.dataset.k, +b.dataset.d);
  });
  function optStep(k, d) {
    if (sel.mode !== 'race' && k !== 'diff') return;
    if (k === 'laps') { SET.laps[TRACKS[sel.track].id] = clamp(lapsFor(sel.track) + d, 1, 20); }
    if (k === 'opp') SET.opp = clamp(SET.opp + d, 0, 7);
    if (k === 'diff') SET.diff = clamp(SET.diff + d, 0, 2);
    save('musou.settings', SET); RaceAudio.se('click'); fillTrack();
  }

  // =========================================================
  //  レースの準備
  // =========================================================
  var DRIVERS = ['K. ARATA', 'M. LAURENT', 'S. WEBER', 'R. CONTI', 'J. HALE', 'T. MORI', 'A. NOVAK', 'L. SILVA'];
  var ALT_LIVERY = [
    { base: '#d8dde3', a: '#2a62c4', b: '#f2c230', c: '#0e1116' },
    { base: '#1e3a2c', a: '#e8e2d0', b: '#c0242c', c: '#0d0d0d' },
    { base: '#f2f0ea', a: '#7a1f2b', b: '#1d1d1d', c: '#c8a24a' },
    { base: '#2b2f6b', a: '#ffffff', b: '#58b6e8', c: '#0c0c0c' }
  ];
  function variant(def, k) {
    if (k === 0) return def;
    var v = Object.create(def);
    var L = ALT_LIVERY[(k + def.number) % ALT_LIVERY.length];
    v.livery = { base: L.base, a: L.a, b: L.b, c: L.c, glass: def.livery.glass };
    v.number = def.number + 10 * k + 3;
    return v;
  }

  function startRace() {
    RaceAudio.se('select');
    fade(function () {
      RaceAudio.stopMusic();
      ensureWorld(sel.track, function () { beginSession(); });
    });
  }

  function makeEntry(def, isPlayer, gridIdx, name) {
    var sim = new CarSim.Car(def, isPlayer ? null : { tcs: true, abs: true, stab: true, steer: false, auto: true });
    if (isPlayer) applyAssists(sim);
    var model = CarModel.build(def);
    world.scene.add(model.root);
    var gs = World.gridSlots(track, 12)[gridIdx];
    sim.place(track, gs.s, gs.lat);
    var e = {
      def: def, sim: sim, model: model, isPlayer: isPlayer, name: name, grid: gs,
      color: def.livery.base, dist: gs.s, prevS: null, lap: 0, lapStart: null, lastLap: null, bestLap: null, laps: [],
      finished: false, finishTime: null, sector: 0, secStart: 0, secTimes: [null, null, null], bestSec: [null, null, null], lastSecs: [null, null, null],
      topSpeed: 0, hits: 0, skidT: 0
    };
    TrackGen.project(track, sim.x, sim.y, sim.hint, sim.proj);
    e.prevS = sim.proj.s;
    e.dist = sim.proj.s > track.length / 2 ? sim.proj.s - track.length : sim.proj.s;
    return e;
  }

  function beginSession() {
    if (showroom.cur) { world.scene.remove(showroom.cur.root); showroom.cur = null; }
    world.beams.visible = false;
    var def = CARS[sel.car], race = sel.mode === 'race';
    var nOpp = race ? SET.opp : 0;
    var playerGrid = race ? Math.min(nOpp, Math.max(0, Math.floor(nOpp * 0.6))) : 0;
    var s = session = {
      mode: sel.mode, laps: race ? lapsFor(sel.track) : Infinity, cars: [], t: 0, raceT: 0, phase: 'intro', phaseT: 0,
      lightN: 0, goAt: 0, acc: 0, ghostRec: [], ghost: null, ghostModel: null, bestTrace: null, curTrace: [], msgT: 0,
      trail: [], hist: [], shake: 0, finishOrder: [], profileCache: {}
    };
    s.hist.max = 300;
    var gridOrder = [];
    for (var k = 0; k <= nOpp; k++) gridOrder.push(k);
    var oi = 0;
    for (var g = 0; g <= nOpp; g++) {
      if (g === playerGrid) {
        s.player = makeEntry(def, true, g, 'YOU');
        s.cars.push(s.player);
      } else {
        var base = CARS[(sel.car + 1 + oi) % CARS.length];
        var vdef = variant(base, Math.floor((oi + 1) / CARS.length) + (base.id === def.id ? 1 : 0));
        var e = makeEntry(vdef, false, g, DRIVERS[oi % DRIVERS.length]);
        var key = base.id;
        var prof = s.profileCache[key] || (s.profileCache[key] = TrackGen.speedProfile(track, base));
        var skill = [0.9, 0.955, 0.99][SET.diff] - 0.012 + Math.random() * 0.024;
        e.ai = new AIDriver.Driver(e.sim, track, skill, prof);
        s.cars.push(e);
        oi++;
      }
    }
    // ゴースト
    var gk = TRACKS[sel.track].id + '/' + def.id;
    if (!race && SET.ghost) {
      s.ghostModel = CarModel.build(def);
      s.ghostModel.root.traverse(function (o) {
        if (o.material) {
          o.material = (Array.isArray(o.material) ? o.material : [o.material]).map(function (m) { var c = m.clone(); c.transparent = true; c.opacity = 0.28; c.depthWrite = false; return c; });
          if (o.material.length === 1) o.material = o.material[0];
        }
        o.castShadow = false;
      });
      s.ghostModel.root.visible = false;
      world.scene.add(s.ghostModel.root);
    }
    s.recordKey = gk;
    // 音
    if (RaceAudio.ready()) {
      s.rig = RaceAudio.PlayerRig(def);
      s.cars.forEach(function (c) { if (!c.isPlayer) c.voice = RaceAudio.EngineVoice(c.def); });
      RaceAudio.startAmbience(TRACKS[sel.track].scenery);
    }
    camMode = SET.camera | 0;
    cam.init = false;
    state = 'race';
    showScreen('hud');
    $('hud').className = 'intro';
    setTimeout(function () { if ($('hud').className === 'intro') $('hud').className = ''; }, 7000);
    $('h-tele').classList.toggle('hidden', window.innerHeight < 700 || window.innerWidth < 1100);
    $('h-mode').textContent = (race ? 'RACE' : 'TIME ATTACK') + ' ・ ' + TRACKS[sel.track].name;
    $('h-lapn').textContent = race ? '/' + s.laps : '';
    $('h-posn').textContent = '/' + s.cars.length;
    $('h-pos').parentNode.style.visibility = race ? '' : 'hidden';
    $('h-board').style.display = race && s.cars.length > 1 ? '' : 'none';
    var G = HUD.GAUGES[def.gauge];
    s.gx = HUD.hiDPI($('gauge'), G.w, G.h); s.G = G;
    s.gG = HUD.hiDPI($('t-g'), 116, 116);
    s.gT = HUD.hiDPI($('t-tire'), 186, 116);
    s.gTr = HUD.hiDPI($('t-trace'), 306, 70);
    s.map = new HUD.MiniMap($('minimap'), track, window.innerWidth < 860 ? 150 : 190);
    var best = REC[gk];
    $('h-best').textContent = HUD.fmtTime(best);
    s.prevBest = best || null;
    world.setStartLights(0, false);
    showMsg(TRACKS[sel.track].name, TRACKS[sel.track].jp, 2.4);
  }

  // 使い終わった車のモデルのメモリを返す
  function disposeModel(root) {
    root.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (mt) { if (mt.map && mt.map.image && mt.map.image.width === 1024) mt.map.dispose(); mt.dispose(); });
    });
  }
  function endSession() {
    if (!session) return;
    var s = session;
    s.cars.forEach(function (c) { world.scene.remove(c.model.root); disposeModel(c.model.root); if (c.voice) c.voice.stop(); });
    if (s.ghostModel) { world.scene.remove(s.ghostModel.root); disposeModel(s.ghostModel.root); }
    if (s.rig) s.rig.stop();
    RaceAudio.stopAmbience();
    session = null;
  }

  // =========================================================
  //  走行中の処理
  // =========================================================
  var DT = 1 / 120;
  var inputP = { throttle: 0, brake: 0, steer: 0, shiftUp: false, shiftDown: false, boost: false };
  var pendingShift = 0;

  function onKey(code, e) {
    if (overlayStack.length) { if (code === 'Escape' || code === 'Enter' || code === 'Space') closeOverlay(); return; }
    if (state === 'title') { if (code === 'Enter' || code === 'Space') startFromTitle(); return; }
    if (state === 'menu') {
      if (code === 'ArrowUp' || code === 'KeyW') listNav($('menu-list'), -1);
      else if (code === 'ArrowDown' || code === 'KeyS') listNav($('menu-list'), 1);
      else if (code === 'Enter' || code === 'Space') menuAct(listCurrent($('menu-list')).dataset.act);
      else if (code === 'Escape') { RaceAudio.se('back'); enterTitle(); }
      return;
    }
    if (state === 'carsel') {
      if (code === 'ArrowLeft' || code === 'KeyA') carStep(-1);
      else if (code === 'ArrowRight' || code === 'KeyD') carStep(1);
      else if (code === 'Enter' || code === 'Space') { RaceAudio.se('select'); enterTrackSel(); }
      else if (code === 'Escape') { RaceAudio.se('back'); enterMenu(); }
      return;
    }
    if (state === 'tracksel') {
      if (code === 'ArrowUp' || code === 'KeyW') { sel.track = (sel.track - 1 + TRACKS.length) % TRACKS.length; RaceAudio.se('click'); fillTrack(); }
      else if (code === 'ArrowDown' || code === 'KeyS') { sel.track = (sel.track + 1) % TRACKS.length; RaceAudio.se('click'); fillTrack(); }
      else if (code === 'ArrowLeft' || code === 'KeyA') optStep('laps', -1);
      else if (code === 'ArrowRight' || code === 'KeyD') optStep('laps', 1);
      else if (code === 'Enter' || code === 'Space') startRace();
      else if (code === 'Escape') { RaceAudio.se('back'); enterCarSel(); }
      return;
    }
    if (state === 'pause') {
      if (code === 'ArrowUp' || code === 'KeyW') listNav($('pause-list'), -1);
      else if (code === 'ArrowDown' || code === 'KeyS') listNav($('pause-list'), 1);
      else if (code === 'Enter' || code === 'Space') pauseAct(listCurrent($('pause-list')).dataset.act);
      else if (code === 'Escape' || code === 'KeyP') pauseAct('resume');
      return;
    }
    if (state === 'results') {
      if (code === 'Enter' || code === 'Space') resultAct('restart');
      else if (code === 'Escape') resultAct('quit');
      return;
    }
    if (state === 'race' && session) {
      if (code === 'Escape' || code === 'KeyP') setPause(true);
      else if (code === 'KeyC') { camMode = (camMode + 1) % CAM_NAMES.length; cam.init = false; showMsg('', 'CAMERA ・ ' + CAM_NAMES[camMode], 0.9); }
      else if (code === 'KeyT') $('h-tele').classList.toggle('hidden');
      else if (code === 'KeyH') { var h = $('hud'); h.className = h.classList.contains('min') ? 'none' : h.classList.contains('none') ? '' : 'min'; }
      else if (code === 'KeyR') { if (session.phase === 'run') { session.player.sim.recover(track); showMsg('', 'RECOVERED', 0.8); } }
      else if (code === 'KeyM') { RaceAudio.setVolume('master', RaceAudio.vol.master > 0 ? 0 : SET.master); }
      else if (code === 'KeyE') pendingShift = 1;
      else if (code === 'KeyQ') pendingShift = -1;
    }
  }

  function setPause(p) {
    if (!session) return;
    if (p && state === 'race') {
      state = 'pause'; showScreen('pause');
      var items = $('pause-list').querySelectorAll('li'); items.forEach(function (li, k) { li.classList.toggle('on', k === 0); });
    } else if (!p && state === 'pause') { state = 'race'; showScreen('hud'); }
  }
  function pauseAct(act) {
    RaceAudio.se('select');
    if (act === 'resume') setPause(false);
    else if (act === 'restart') { endSession(); beginSession(); }
    else if (act === 'settings') openOverlay('settings');
    else if (act === 'help') openOverlay('help');
    else if (act === 'quit') {
      if (session && session.mode === 'timeattack' && session.player.laps.length) { showResults(); return; }
      endSession(); fade(function () { enterMenu(); showroomCar(sel.car); });
    }
  }
  document.querySelector('#results .res-btns').addEventListener('click', function (e) { var a = e.target.dataset.act; if (a) resultAct(a); });
  function resultAct(a) {
    RaceAudio.se('select');
    if (a === 'restart') { endSession(); state = 'race'; beginSession(); }
    else { endSession(); fade(function () { enterMenu(); showroomCar(sel.car); }); }
  }

  var msgTimer = null;
  function showMsg(big, small, sec) {
    var el = $('h-msg');
    el.innerHTML = (big || '') + (small ? '<small>' + small + '</small>' : '');
    el.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { el.classList.remove('show'); }, (sec || 1.5) * 1000);
  }

  // ---------- 1ステップ(1/120秒)----------
  function stepSession(s, dt) {
    var hold = s.phase === 'intro' || s.phase === 'countdown';
    // プレイヤーの入力
    var p = s.player;
    if (p.ai) {
      var ai = p.ai.update(dt, s.order, p.dist);
      p.sim.step(dt, ai, track);
    } else {
      inputP.throttle = down('ArrowUp', 'KeyW') ? 1 : 0;
      inputP.brake = down('ArrowDown', 'KeyS') ? 1 : 0;
      inputP.steer = (down('ArrowLeft', 'KeyA') ? 1 : 0) - (down('ArrowRight', 'KeyD') ? 1 : 0);
      inputP.boost = down('Space');
      inputP.shiftUp = pendingShift > 0; inputP.shiftDown = pendingShift < 0; pendingShift = 0;
      inputP.steerAbs = null;
      p.sim.step(dt, inputP, track);
    }
    for (var i = 0; i < s.cars.length; i++) {
      var c = s.cars[i];
      if (c.isPlayer) continue;
      var inp = c.ai.update(dt, s.order, c.dist);
      if (hold) { inp = { throttle: s.phase === 'countdown' ? 0.4 + Math.random() * 0.3 : 0, brake: 1, steerAbs: 0 }; }
      c.sim.step(dt, inp, track);
    }
    if (hold) {
      s.cars.forEach(function (c) {
        var sm = c.sim, gp = TrackGen.pointAt(track, c.grid.s, c.grid.lat);
        sm.x = gp.x; sm.y = gp.y; sm.th = gp.th; sm.vx = sm.vy = sm.r = 0;
      });
    }
    // 車どうしの接触
    for (i = 0; i < s.cars.length; i++) for (var j = i + 1; j < s.cars.length; j++) collide(s.cars[i], s.cars[j]);
    // 距離・周回
    for (i = 0; i < s.cars.length; i++) progress(s, s.cars[i], dt);
  }

  var CIRC = [1.55, 0, -1.55];
  function collide(A, B) {
    var a = A.sim, b = B.sim, dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy > 36) return;
    var ca = Math.cos(a.th), sa = Math.sin(a.th), cb = Math.cos(b.th), sb = Math.sin(b.th);
    var best = null, R2 = 1.92;
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
      var ax = a.x + ca * CIRC[i], ay = a.y + sa * CIRC[i], bx = b.x + cb * CIRC[j], by = b.y + sb * CIRC[j];
      var d = Math.hypot(bx - ax, by - ay);
      if (d < R2 && (!best || d < best.d)) best = { d: d, ax: ax, ay: ay, bx: bx, by: by };
    }
    if (!best) return;
    var nx = (best.bx - best.ax) / (best.d || 1), ny = (best.by - best.ay) / (best.d || 1), pen = R2 - best.d;
    var ma = a.m, mb = b.m, tot = ma + mb;
    a.x -= nx * pen * mb / tot; a.y -= ny * pen * mb / tot; b.x += nx * pen * ma / tot; b.y += ny * pen * ma / tot;
    var px = (best.ax + best.bx) / 2, py = (best.ay + best.by) / 2;
    var rax = px - a.x, ray = py - a.y, rbx = px - b.x, rby = py - b.y;
    var vax = a.vx - a.r * ray, vay = a.vy + a.r * rax, vbx = b.vx - b.r * rby, vby = b.vy + b.r * rbx;
    var vrel = (vbx - vax) * nx + (vby - vay) * ny;
    if (vrel >= 0) return;
    var rna = rax * ny - ray * nx, rnb = rbx * ny - rby * nx;
    var jimp = -(1 + 0.25) * vrel / (1 / ma + 1 / mb + rna * rna / a.Izz + rnb * rnb / b.Izz);
    a.vx -= nx * jimp / ma; a.vy -= ny * jimp / ma; b.vx += nx * jimp / mb; b.vy += ny * jimp / mb;
    a.r -= rna * jimp / a.Izz * 0.6; b.r += rnb * jimp / b.Izz * 0.6;
    var k = Math.min(1, -vrel / 12);
    a.events.push({ t: 'hit', k: k, x: px, y: py, car: true });
    b.events.push({ t: 'hit', k: k, x: px, y: py, car: true });
  }

  function progress(s, c, dt) {
    var sim = c.sim, L = track.length, sNow = sim.proj.s;
    if (sNow == null) return;
    var ds = sNow - c.prevS;
    if (ds < -L / 2) ds += L; else if (ds > L / 2) ds -= L;
    var before = c.dist;
    c.dist += ds; c.prevS = sNow;
    c.topSpeed = Math.max(c.topSpeed, sim.speed);
    if (s.phase !== 'run' && s.phase !== 'finish') return;
    // スタートラインを最初に越えた
    if (before < 0 && c.dist >= 0 && c.lapStart == null) { c.lapStart = s.raceT; c.secStart = s.raceT; c.sector = 0; c.lap = 1; if (c.isPlayer) s.curTrace = []; return; }
    if (c.lapStart == null || c.finished) return;
    var lapB = Math.floor(before / L), lapA = Math.floor(c.dist / L);
    var posB = before - lapB * L, posA = c.dist - lapA * L;
    // セクター
    for (var k = 1; k < 3; k++) {
      var sb = track.sectors[k];
      if (lapA === lapB && posB < sb && posA >= sb && c.sector === k - 1) sectorDone(s, c, k - 1);
    }
    if (lapA > lapB && c.dist > 0) {
      sectorDone(s, c, 2);
      var lt = s.raceT - c.lapStart;
      c.lastLap = lt; c.laps.push(lt);
      var isBest = c.bestLap == null || lt < c.bestLap;
      if (isBest) c.bestLap = lt;
      c.lapStart = s.raceT; c.lap++;
      if (c.isPlayer) onPlayerLap(s, c, lt, isBest);
      if (s.mode === 'race' && c.laps.length >= s.laps) {
        c.finished = true; c.finishTime = s.raceT; s.finishOrder.push(c);
        if (c.isPlayer) playerFinished(s);
      }
    }
    // デルタ用の記録(10mごと)
    if (c.isPlayer) {
      var di = Math.floor(posA / 10);
      if (s.curTrace.length <= di) s.curTrace[di] = s.raceT - c.lapStart;
    }
  }
  function sectorDone(s, c, k) {
    var st = s.raceT - c.secStart;
    c.lastSecs[k] = st;
    var pb = c.bestSec[k] == null || st < c.bestSec[k];
    if (pb) c.bestSec[k] = st;
    c.secStart = s.raceT; c.sector = (k + 1) % 3;
    if (c.isPlayer) { s.secFlash = { k: k, t: st, pb: pb, until: s.t + 4 }; }
  }
  function onPlayerLap(s, c, lt, isBest) {
    var rec = REC[s.recordKey];
    var newRec = !rec || lt < rec;
    if (newRec) { REC[s.recordKey] = lt; save('musou.records', REC); }
    if (isBest) { s.bestTrace = s.curTrace.slice(); if (s.ghostModel) s.ghost = s.ghostRec.slice(); }
    s.ghostRec = []; s.curTrace = [];
    RaceAudio.se(newRec ? 'best' : 'lap');
    var lapLabel = s.mode === 'race' ? 'LAP ' + c.laps.length + ' / ' + s.laps : 'LAP ' + c.laps.length;
    showMsg(HUD.fmtTime(lt), lapLabel + (newRec ? ' ・ NEW RECORD' : isBest ? ' ・ BEST' : ''), 2.4);
    if (s.mode === 'race' && c.laps.length === s.laps - 1) setTimeout(function () { if (session === s) showMsg('FINAL LAP', '', 1.6); }, 2500);
  }
  function playerFinished(s) {
    s.phase = 'finish'; s.phaseT = 0;
    var pos = s.finishOrder.indexOf(s.player) + 1;
    showMsg(pos === 1 ? 'WINNER' : 'FINISH', 'P' + pos + ' ・ ' + HUD.fmtTime(s.player.finishTime) + ' ・ Enter で結果へ', 6);
    // 自動運転でクールダウン
    var prof = s.profileCache[s.player.def.id] || TrackGen.speedProfile(track, s.player.def);
    s.player.ai = new AIDriver.Driver(s.player.sim, track, 0.8, prof);
    applyAssists(s.player.sim); s.player.sim.assists.auto = true;
  }

  function showResults() {
    var s = session; if (!s) return;
    state = 'results';
    showScreen('results');
    var race = s.mode === 'race', p = s.player;
    $('res-title').textContent = race ? 'RESULT' : 'TIME ATTACK';
    $('res-sub').textContent = TRACKS[sel.track].name + ' ・ ' + p.def.name;
    var rows;
    if (race) {
      var order = s.finishOrder.slice();
      var rest = s.cars.filter(function (c) { return order.indexOf(c) < 0; }).sort(function (a, b) { return b.dist - a.dist; });
      $('res-sub').textContent += rest.length ? ' ・ * はゴール前の予想タイム' : '';
      order = order.concat(rest);
      var leader = order[0];
      rows = '<tr><th>POS</th><th>DRIVER</th><th>MACHINE</th><th>BEST LAP</th><th>TIME / GAP</th></tr>' + order.map(function (c, k) {
        var gap;
        if (c.finished) gap = k === 0 ? HUD.fmtTime(c.finishTime) : '+' + (c.finishTime - leader.finishTime).toFixed(3);
        else {
          var lapsDown = Math.floor((leader.dist - c.dist) / track.length);
          var avg = c.dist / Math.max(1, s.raceT), est = s.raceT + (s.laps * track.length - c.dist) / Math.max(10, avg);
          gap = lapsDown >= 1 ? '+' + lapsDown + ' LAP' : '+' + (est - leader.finishTime).toFixed(1) + '*';
        }
        return '<tr class="' + (c.isPlayer ? 'me' : '') + '"><td>' + (k + 1) + '</td><td>' + c.name + '</td><td>#' + c.def.number + ' ' + c.def.name + '</td><td class="num">' + HUD.fmtTime(c.bestLap) + '</td><td class="num">' + gap + '</td></tr>';
      }).join('');
    } else {
      rows = '<tr><th>LAP</th><th>TIME</th><th></th></tr>' + p.laps.map(function (t, k) {
        return '<tr class="' + (t === p.bestLap ? 'me' : '') + '"><td>' + (k + 1) + '</td><td class="num">' + HUD.fmtTime(t) + '</td><td>' + (t === p.bestLap ? 'BEST' : '') + '</td></tr>';
      }).join('');
    }
    $('res-table').innerHTML = rows;
    var st = [['BEST LAP', HUD.fmtTime(p.bestLap)], ['TOP SPEED', Math.round(p.topSpeed * 3.6) + ' km/h'], ['CONTACTS', p.hits], ['RECORD', HUD.fmtTime(REC[s.recordKey])]];
    $('res-stats').innerHTML = st.map(function (x) { return '<div>' + x[0] + '<b>' + x[1] + '</b></div>'; }).join('');
  }

  // ---------- 車の見た目・音・粒子の更新(毎フレーム)----------
  var tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  var SMOKE = new THREE.Color(0xe6e9ec), DUST = new THREE.Color(0xb59f7c), GRASSD = new THREE.Color(0x6f8455), SPARK = new THREE.Color(0xffc070);
  function visuals(s, dt) {
    var pc = s.player.sim;
    var camPos = camera.position;
    for (var i = 0; i < s.cars.length; i++) {
      var c = s.cars[i], sim = c.sim, m = c.model;
      m.root.position.set(sim.x, sim.z, -sim.y);
      m.root.rotation.order = 'YZX';
      m.root.rotation.set(0, sim.th, Math.atan(sim.proj.grade * (Math.cos(sim.th) * sim.proj.tx + Math.sin(sim.th) * sim.proj.ty) || 0));
      m.update({ speedLong: sim.u, steer: sim.steer, wheelspin: sim.wheelspin, brakeTemp: sim.brakeT, pitch: sim.pitch, roll: sim.roll, heave: sim.heave, wheelBump: sim.wheelBump, brake: sim.brk, lightsOn: TRACKS[sel.track].time === 'dusk', flame: sim.flame }, dt);
      var dcam = Math.hypot(sim.x - pc.x, sim.y - pc.y);
      // 煙とタイヤ跡
      c.skidT -= dt;
      var slide = Math.max(sim.slideLat, sim.wheelspin * 0.8, sim.lock);
      if (dcam < 250 && sim.speed > 3) {
        var cs = Math.cos(sim.th), sn = Math.sin(sim.th);
        for (var w = 0; w < 4; w++) {
          var surf = sim.surf[w], wx = sim.x + cs * sim.wpx[w] - sn * sim.wpy[w], wy = sim.y + sn * sim.wpx[w] + cs * sim.wpy[w];
          var rear = w >= 2;
          if (surf <= 2 && slide > 0.45 && (rear || sim.lock > 0.3 || sim.slideLat > 0.7)) {
            if (c.skidT <= 0) world.addSkid(wx, wy, sim.z, sim.th, slide);
            if (Math.random() < dt * 40 * Math.min(1.5, slide)) {
              tmpV.set(wx, sim.z + 0.25, -wy);
              tmpV2.set((Math.random() - 0.5) * 2 + sim.vx * 0.15, 0.5 + Math.random(), -(sim.vy * 0.15) + (Math.random() - 0.5) * 2);
              world.smoke.emit(tmpV, tmpV2, 1.6 + Math.random(), 1.2, 3.5, 0.32 * Math.min(1, slide), SMOKE);
            }
          } else if (surf >= 3 && sim.speed > 6 && Math.random() < dt * 30 * Math.min(1, sim.speed / 30)) {
            tmpV.set(wx, sim.z + 0.2, -wy);
            tmpV2.set((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3);
            world.smoke.emit(tmpV, tmpV2, 1.4, 1.0, 3.0, 0.38, surf === 4 ? DUST : GRASSD);
          }
        }
        if (c.skidT <= 0) c.skidT = 0.045;
        // 高速で底をする火花
        if (sim.speed > 65 && sim.down > sim.m * 9.81 * 1.1 && Math.random() < dt * (sim.shake > 0.3 ? 30 : 2.5)) {
          tmpV.set(sim.x, sim.z + 0.05, -sim.y);
          for (var sp = 0; sp < 4; sp++) { tmpV2.set(-Math.cos(sim.th) * (6 + Math.random() * 10) + (Math.random() - 0.5) * 3, Math.random() * 2.5, Math.sin(sim.th) * (6 + Math.random() * 10) + (Math.random() - 0.5) * 3); world.sparks.emit(tmpV, tmpV2, 0.3 + Math.random() * 0.3, 0.12, -0.1, 1, SPARK); }
        }
      }
      // できごと
      for (var k = 0; k < sim.events.length; k++) {
        var ev = sim.events[k];
        if (ev.t === 'hit') {
          if (dcam < 120) {
            tmpV.set(ev.x, sim.z + 0.4, -ev.y);
            for (var n = 0; n < 6 + ev.k * 30; n++) { tmpV2.set((Math.random() - 0.5) * 14, Math.random() * 6, (Math.random() - 0.5) * 14); world.sparks.emit(tmpV, tmpV2, 0.3 + Math.random() * 0.5, 0.14, -0.1, 1, SPARK); }
          }
          if (c.isPlayer) { if (ev.k > 0.12) { RaceAudio.se('hit', clamp(ev.k * 1.4, 0.25, 1)); s.shake = Math.max(s.shake, ev.k); c.hits++; } else RaceAudio.scrape(s.rig, 0.6); }
          else if (dcam < 60 && ev.k > 0.2) RaceAudio.se('hit', ev.k * (1 - dcam / 60) * 0.6);
        } else if (ev.t === 'scrape') {
          if (c.isPlayer) RaceAudio.scrape(s.rig, ev.k);
          if (dcam < 100 && Math.random() < 0.5) { tmpV.set(ev.x, sim.z + 0.3, -ev.y); tmpV2.set((Math.random() - 0.5) * 6, Math.random() * 3, (Math.random() - 0.5) * 6); world.sparks.emit(tmpV, tmpV2, 0.4, 0.12, -0.1, 1, SPARK); }
        } else if (c.isPlayer) {
          if (ev.t === 'shift') RaceAudio.se(c.def.gearbox === 'H' ? 'clunk' : 'shift');
          else if (ev.t === 'blowoff') RaceAudio.se('blowoff', ev.k);
          else if (ev.t === 'pop') RaceAudio.se('pop', ev.k);
          else if (ev.t === 'deny') RaceAudio.se('deny');
        } else if (ev.t === 'pop' && dcam < 50) RaceAudio.se('pop', ev.k * (1 - dcam / 50) * 0.5);
      }
      sim.events.length = 0;
      // ライバルのエンジン音(距離・左右・ドップラー)
      if (c.voice) {
        var dx = sim.x - pc.x, dy = sim.y - pc.y, d = Math.hypot(dx, dy) + 0.01;
        var level = (s.paused ? 0 : 1) * 0.9 / (1 + Math.pow(d / 14, 1.6));
        var vrel = ((sim.vx - pc.vx) * dx + (sim.vy - pc.vy) * dy) / d;
        var dop = clamp(343 / (343 + vrel), 0.7, 1.4);
        c.voice.update(sim.rpm, sim.thr, level, dop);
        // 左右:カメラの向きに対して
        var cfx = Math.cos(cam.yaw), cfy = Math.sin(cam.yaw);
        var side = (dx * -cfy + dy * cfx) / d; // 左が+
        c.voice.setPan(-side);
      }
    }
    // ゴースト
    if (s.ghost && s.ghostModel && s.player.lapStart != null && s.phase === 'run') {
      var tL = s.raceT - s.player.lapStart, g = s.ghost, lo = 0, hi = g.length - 1;
      if (g.length > 1 && tL <= g[hi][0]) {
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (g[mid][0] < tL) lo = mid; else hi = mid; }
        var a = g[lo], b = g[hi], f = clamp((tL - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
        var gth = a[4] + Math.atan2(Math.sin(b[4] - a[4]), Math.cos(b[4] - a[4])) * f;
        s.ghostModel.root.position.set(lerp(a[1], b[1], f), lerp(a[3], b[3], f), -lerp(a[2], b[2], f));
        s.ghostModel.root.rotation.set(0, gth, 0);
        s.ghostModel.root.visible = Math.hypot(lerp(a[1], b[1], f) - pc.x, lerp(a[2], b[2], f) - pc.y) > 3.5;
        s.ghostPos = { x: lerp(a[1], b[1], f), y: lerp(a[2], b[2], f) };
      } else { s.ghostModel.root.visible = false; s.ghostPos = null; }
    }
    if (s.player.lapStart != null && s.phase === 'run') {
      s.ghostRecT = (s.ghostRecT || 0) - dt;
      if (s.ghostRecT <= 0) { s.ghostRec.push([s.raceT - s.player.lapStart, pc.x, pc.y, pc.z, pc.th]); s.ghostRecT = 0.05; }
    }
  }

  // ---------- 順位 ----------
  function rank(s) {
    var arr = s.cars.slice();
    arr.sort(function (a, b) {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1; if (b.finished) return 1;
      return b.dist - a.dist;
    });
    s.ranked = arr;
    s.order = s.cars.map(function (c) { return { car: c.sim, prog: c.dist }; });
    // スリップストリーム
    for (var i = 0; i < s.cars.length; i++) {
      var c = s.cars[i], best = 0;
      for (var j = 0; j < s.cars.length; j++) {
        if (i === j) continue;
        var o = s.cars[j], gap = o.dist - c.dist;
        if (gap > 4 && gap < 45 && Math.abs(o.sim.proj.lat - c.sim.proj.lat) < 2.2 && c.sim.speed > 25) best = Math.max(best, (1 - (gap - 4) / 41));
      }
      c.sim.slip += (best - c.sim.slip) * 0.1;
    }
  }

  // =========================================================
  //  カメラ
  // =========================================================
  var cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false, yaw: 0, fov: 60, tv: null };
  var lv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function updateCamera(dt, t) {
    if (state === 'race' || state === 'pause' || state === 'results') return raceCamera(dt);
    // メニュー:車のまわりをゆっくり回る
    if (!showroom.cur) return;
    var p = showroom.cur.root.position;
    if (!showroom.drag) showroom.angle += dt * (state === 'carsel' ? 0.22 : 0.08);
    var th = showroom.cur.root.rotation.y;
    var a = th + Math.PI * 0.8 + showroom.angle;
    var dist = state === 'carsel' ? 7.8 : state === 'title' ? 9.5 : 11;
    var h = state === 'carsel' ? 1.7 : 2.0;
    var off = state === 'title' ? 0.0 : 0;
    var tp = new THREE.Vector3(p.x + Math.cos(a) * dist, p.y + h, p.z - Math.sin(a) * dist);
    if (!cam.init) { cam.pos.copy(tp); cam.init = true; }
    cam.pos.lerp(tp, 1 - Math.exp(-dt * 3));
    camera.position.copy(cam.pos);
    // タイトルは車を画面の右寄りに
    var right = new THREE.Vector3().subVectors(p, cam.pos).normalize().cross(up).normalize();
    var shift = state === 'title' ? -2.4 : state === 'carsel' ? -1.4 : 0;
    lv.copy(p).addScaledVector(right, shift + off); lv.y += 0.55;
    camera.lookAt(lv);
    camera.fov = state === 'title' ? 42 : 40; camera.updateProjectionMatrix();
    if (world) world.update(dt, p, camera);
  }
  var hood = new THREE.Vector3(), hoodLook = new THREE.Vector3();
  function raceCamera(dt) {
    var s = session; if (!s) return;
    var sim = s.player.sim, m = s.player.model, def = s.player.def;
    var P = m.root.position;
    var hx = Math.cos(sim.th), hz = -Math.sin(sim.th);
    var spd = sim.speed;
    var vx = spd > 4 ? sim.vx / spd : hx, vz = spd > 4 ? -sim.vy / spd : hz;
    var dx = hx * 0.65 + vx * 0.35, dz = hz * 0.65 + vz * 0.35, dl = Math.hypot(dx, dz); dx /= dl; dz /= dl;
    var kmh = spd * 3.6;
    var fov = 58 + clamp((kmh - 80) / 260, 0, 1) * 14 + (sim.otActive ? 3 : 0);
    var back = down('KeyB');
    var mode = camMode;
    if (s.phase === 'intro') {
      // スタート前の紹介:車のまわりを回りこむ
      var tI = clamp(s.phaseT / 2.6, 0, 1), ang = sim.th + Math.PI * (0.25 + 0.75 * tI);
      var dd = lerp(6.5, 8, tI);
      var tp = new THREE.Vector3(P.x + Math.cos(ang) * dd, P.y + lerp(1.2, 2.6, tI), P.z - Math.sin(ang) * dd);
      cam.pos.copy(tp); camera.position.copy(tp); lv.set(P.x, P.y + 0.6, P.z); camera.lookAt(lv);
      camera.fov = 50; camera.updateProjectionMatrix(); cam.init = true; cam.yaw = sim.th;
      world.update(dt, P, camera); return;
    }
    var shake = s.shake * 0.25 + (sim.shake || 0) * 0.025 + clamp((kmh - 250) / 150, 0, 1) * 0.008;
    s.shake *= Math.exp(-dt * 5);
    m.chassis.updateMatrixWorld(true);
    if (mode === 0 || mode === 1 || back) {
      var dist = mode === 1 ? 5.4 : 7.4, h = mode === 1 ? 1.65 : 2.35;
      if (back) { dx = -hx; dz = -hz; dist = 6.5; h = 1.8; }
      var tpos = new THREE.Vector3(P.x - dx * dist, P.y + h, P.z - dz * dist);
      if (!cam.init || back !== cam.wasBack) { cam.pos.copy(tpos); cam.init = true; }
      cam.wasBack = back;
      var k = 1 - Math.exp(-dt * (mode === 1 ? 14 : 10));
      cam.pos.lerp(tpos, k);
      // 地面より下に行かない
      cam.pos.y = Math.max(cam.pos.y, P.y + 0.8);
      camera.position.copy(cam.pos);
      lv.set(P.x + dx * 4, P.y + (mode === 1 ? 0.9 : 1.1), P.z + dz * 4);
      if (back) lv.set(P.x - dx * 10, P.y + 0.8, P.z - dz * 10);
      camera.lookAt(lv);
    } else if (mode === 2 || mode === 3) {
      if (mode === 2) hood.set(0.55, 1.12, 0); else hood.set(def.shape.cockpitX * def.length / 2 - 0.25, 0.97, 0.2);
      hood.applyMatrix4(m.chassis.matrixWorld);
      hoodLook.set(30, mode === 2 ? 0.6 : 0.75, mode === 3 ? 0.2 : 0).applyMatrix4(m.chassis.matrixWorld);
      camera.position.copy(hood);
      camera.up.set(0, 1, 0);
      camera.lookAt(hoodLook);
      cam.pos.copy(hood); cam.init = false;
      fov = (mode === 3 ? 66 : 62) + clamp((kmh - 80) / 260, 0, 1) * 10;
    } else {
      // TV:いちばん近いカメラ
      var best = null, bd = Infinity;
      world.tvCams.forEach(function (tc) { var d = tc.pos.distanceTo(P); if (d < bd) { bd = d; best = tc; } });
      if (best !== cam.tv) { cam.tv = best; }
      camera.position.copy(best.pos);
      lv.set(P.x, P.y + 0.6, P.z);
      camera.lookAt(lv);
      fov = clamp(2 * Math.atan(7 / bd) * 180 / Math.PI, 8, 60);
      cam.init = false;
    }
    if (shake > 0.001) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 4));
    camera.fov = mode === 4 ? fov : cam.fov;
    camera.updateProjectionMatrix();
    cam.yaw = Math.atan2(-(lv.z - camera.position.z), lv.x - camera.position.x);
    // 車体の表示(コクピット視点では車体を残してキャノピーだけ消す)
    world.update(dt, P, camera);
  }

  // =========================================================
  //  HUD
  // =========================================================
  var hudT = 0;
  function updateHUD(s, dt) {
    var p = s.player, c = p.sim, d = p.def, kmh = c.speed * 3.6;
    // メーター
    var delta = null;
    if (s.bestTrace && p.lapStart != null) {
      var pos = ((p.dist % track.length) + track.length) % track.length, di = Math.floor(pos / 10);
      if (s.bestTrace[di] != null) delta = (s.raceT - p.lapStart) - s.bestTrace[di];
    }
    s.G.draw(s.gx, s.G.w, s.G.h, c, d, kmh, { delta: delta });
    $('h-gauge').classList.toggle('cockpit', camMode === 3);
    // テレメトリー
    s.trail.push([c.ayF / 9.81, c.axF / 9.81]); if (s.trail.length > 50) s.trail.shift();
    hudT += dt;
    s.histT = (s.histT || 0) + dt;
    if (s.histT > 1 / 30) { s.histT = 0; s.hist.push([kmh, c.thr, c.brk, c.steerN]); if (s.hist.length > s.hist.max) s.hist.shift(); }
    var teleOn = !$('h-tele').classList.contains('hidden') && !$('hud').classList.contains('min');
    if (teleOn) { HUD.drawG(s.gG, 116, 116, c, s.trail); HUD.drawTires(s.gT, 186, 116, c); HUD.drawTrace(s.gTr, 306, 70, s.hist); }
    s.map.draw(s.cars.map(function (e) { return { sim: e.sim, color: e.color }; }), s.cars.indexOf(p), s.ghostPos);
    $('in-thr').style.height = (c.thr * 100) + '%';
    $('in-brk').style.height = (c.brk * 100) + '%';
    $('in-steer').style.left = (50 - c.steerN * 48) + '%';
    if (hudT < 0.066) return;
    hudT = 0;
    // 文字(1秒に15回)
    var race = s.mode === 'race';
    if (race) {
      var rk = s.ranked.indexOf(p) + 1;
      $('h-pos').textContent = 'P' + rk;
    }
    var lapNo = Math.max(1, Math.min(p.lap || 1, race ? s.laps : 999));
    $('h-lap').textContent = lapNo;
    var lt = p.lapStart != null ? s.raceT - p.lapStart : 0;
    if (p.finished) lt = p.lastLap;
    $('h-time').textContent = HUD.fmtTime(lt);
    var dEl = $('h-delta');
    dEl.textContent = delta == null ? '' : HUD.fmtDelta(delta);
    dEl.className = 'h-delta ' + (delta == null ? '' : delta <= 0 ? 'good' : 'bad');
    var secs = $('h-sectors').children;
    for (var k = 0; k < 3; k++) {
      var cur = p.sector === k && p.lapStart != null && !p.finished;
      var val = cur ? s.raceT - p.secStart : p.lastSecs[k];
      secs[k].querySelector('b').textContent = val == null ? '—' : (cur ? val.toFixed(1) : val.toFixed(3));
      secs[k].className = !cur && s.secFlash && s.secFlash.k === k && s.t < s.secFlash.until ? (s.secFlash.pb ? 'pb' : 'sl') : '';
    }
    $('h-best').textContent = HUD.fmtTime(p.bestLap != null ? p.bestLap : REC[s.recordKey]);
    $('h-last').textContent = HUD.fmtTime(p.lastLap);
    $('h-top').textContent = Math.round(p.topSpeed * 3.6) + ' km/h';
    // 順位表
    if (race && s.cars.length > 1) {
      var leader = s.ranked[0];
      var avg = leader.dist > 50 && s.raceT > 1 ? leader.dist / s.raceT : 50;
      $('h-board').innerHTML = s.ranked.map(function (e, i) {
        var gap = i === 0 ? 'LEADER' : (e.finished && leader.finished ? '+' + (e.finishTime - leader.finishTime).toFixed(1) : '+' + ((leader.dist - e.dist) / Math.max(20, avg)).toFixed(1));
        return '<li class="' + (e.isPlayer ? 'me' : '') + '"><span>' + (i + 1) + '</span><i class="sw" style="background:' + e.color + '"></i><span>' + (e.isPlayer ? 'YOU' : e.name) + '</span><span class="gap">' + gap + '</span></li>';
      }).join('');
    }
    // 運転補助のランプ
    var tcsAct = c.assists.tcs && c.wheelspin > 0.0 && c.thr > 0.5 && c.speed > 2;
    var absAct = c.assists.abs && c.brk > 0.6 && c.speed > 8;
    $('h-assist').innerHTML = [['TCS', c.assists.tcs, tcsAct], ['ABS', c.assists.abs, absAct], ['STAB', c.assists.stab, false], [c.assists.auto ? 'AT' : 'MT', true, false], [CAM_NAMES[camMode], true, false]].map(function (a) {
      return a[1] ? '<span class="' + (a[2] ? 'act' : '') + '">' + a[0] + '</span>' : '';
    }).join('') + (c.slip > 0.25 ? '<span class="act">SLIPSTREAM</span>' : '') + (c.otActive ? '<span class="act">' + (d.overtake ? d.overtake.label : 'BOOST') + '</span>' : '');
    if (teleOn) {
      var soc = d.ers ? Math.round(c.ersE / d.ers.battery * 100) + '%' : '—';
      var beta = Math.atan2(c.v, Math.abs(c.u) + 0.1) * 57.3;
      var nums = [
        ['PWR', Math.round(c.powerKW + c.ersP / 1000) + 'kW'], ['TRQ', Math.round(c.torqueNm) + 'Nm'], ['RPM', Math.round(c.rpm)],
        ['BOOST', d.turbo ? c.boostBar.toFixed(2) + 'b' : 'NA'], ['DOWNF', Math.round(c.down / 9.81) + 'kg'], ['DRAG', Math.round(c.drag) + 'N'],
        ['ERS', d.ers ? Math.round((c.ersP - c.harvestP) / 1000) + 'kW' : '—'], ['SOC', soc], ['FUEL', c.fuel.toFixed(1) + 'L'],
        ['OIL', Math.round(c.oilT) + '°'], ['WATER', Math.round(c.waterT) + '°'], ['STEER', (c.steer * 57.3).toFixed(1) + '°'],
        ['β', beta.toFixed(1) + '°'], ['YAW', (c.r * 57.3).toFixed(0) + '°/s'], ['BIAS', Math.round(d.brakeFront * 100) + '%F'],
        ['G LAT', (c.ayF / 9.81).toFixed(2)], ['G LON', (c.axF / 9.81).toFixed(2)], ['FPS', Math.round(fps)]
      ];
      $('t-nums').innerHTML = nums.map(function (n) { return '<span><em>' + n[0] + '</em>' + n[1] + '</span>'; }).join('');
      $('t-gv').textContent = Math.hypot(c.ayF, c.axF) / 9.81 > 0.05 ? (Math.hypot(c.ayF, c.axF) / 9.81).toFixed(2) + ' G' : '';
    }
  }

  // ---------- スピード感の演出(流れる線)----------
  var lines = [];
  for (var li = 0; li < 70; li++) lines.push({ a: Math.random() * TAU, r: Math.random(), v: 0.5 + Math.random() });
  function drawFX(dt) {
    var w = fxc.width, h = fxc.height;
    fx.clearRect(0, 0, w, h);
    if (state !== 'race' || !session || session.phase === 'intro') return;
    var c = session.player.sim, kmh = c.speed * 3.6;
    var k = clamp((kmh - 210) / 140, 0, 1) * (camMode === 4 ? 0 : 1) + (c.otActive ? 0.25 : 0);
    if (k <= 0.01) return;
    var cx = w / 2, cy = h * 0.46, R = Math.hypot(w, h) / 2;
    fx.lineWidth = 1.2;
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      L.r += dt * L.v * (1.2 + k * 2);
      if (L.r > 1) { L.r = 0.25; L.a = Math.random() * TAU; }
      var r0 = R * (0.35 + L.r * 0.65), r1 = r0 + R * 0.12 * k;
      fx.strokeStyle = 'rgba(255,255,255,' + (0.18 * k * L.r) + ')';
      fx.beginPath(); fx.moveTo(cx + Math.cos(L.a) * r0, cy + Math.sin(L.a) * r0); fx.lineTo(cx + Math.cos(L.a) * r1, cy + Math.sin(L.a) * r1); fx.stroke();
    }
  }

  // =========================================================
  //  メインループ
  // =========================================================
  var last = performance.now(), fps = 60, lightTimer = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
    if (state === 'race' && session) { runRace(session, dt); for (var ff = 0; ff < (window.__musouFast | 0); ff++) runRace(session, 1 / 30, true); }
    else if (session && (state === 'pause')) { if (session.rig) session.rig.update(session.player.sim, dt, true); session.cars.forEach(function (c) { if (c.voice) c.voice.update(c.sim.rpm, 0, 0, 1); }); }
    else if (session && state === 'results') { runRace(session, dt, true); }
    updateCamera(dt, now);
    if (state === 'carsel') drawGaugePreview(now);
    drawFX(dt);
    if (world && !window.__musouNoRender) renderer.render(world.scene, camera);
  }

  function runRace(s, dt, background) {
    s.t += dt; s.phaseT += dt;
    // 段階
    if (s.phase === 'intro' && s.phaseT > 2.8) { s.phase = 'countdown'; s.phaseT = 0; s.lightN = 0; lightTimer = 0; $('h-lights').classList.add('show'); }
    if (s.phase === 'countdown') {
      lightTimer += dt;
      var n = Math.min(5, Math.floor(lightTimer / 0.8));
      if (n !== s.lightN && n > 0 && lightTimer < 4.2) { s.lightN = n; RaceAudio.se('beep'); updateLights(n, false); world.setStartLights(n, false); }
      if (!s.goAt && lightTimer > 4.0) s.goAt = 4.0 + 0.4 + Math.random() * 0.9;
      if (s.goAt && lightTimer >= s.goAt) {
        s.phase = 'run'; s.phaseT = 0; RaceAudio.se('go'); updateLights(0, true); world.setStartLights(0, true);
        showMsg('GO', '', 0.9);
        setTimeout(function () { $('h-lights').classList.remove('show', 'go'); if (world) world.setStartLights(0, false); }, 1200);
      }
    }
    if (s.phase === 'run' || s.phase === 'finish') s.raceT += dt;
    if (s.phase === 'finish' && (s.phaseT > 25 || (s.phaseT > 5 && s.finishOrder.length === s.cars.length) || (s.phaseT > 6 && keys.Enter)) && state === 'race') { showResults(); }
    // 物理(固定ステップ)
    s.acc += dt;
    var steps = 0;
    while (s.acc >= DT && steps < 10) { stepSession(s, DT); s.acc -= DT; steps++; }
    if (steps >= 10) s.acc = 0;
    rank(s);
    visuals(s, dt);
    if (s.rig) s.rig.update(s.player.sim, dt, background);
    if (RaceAudio.ready()) RaceAudio.crowd(s.player.dist < 300 || s.player.dist % track.length > track.length - 400 ? 1 : 0);
    if (!background) updateHUD(s, dt);
  }
  function updateLights(n, go) {
    var el = $('h-lights'); el.classList.toggle('go', !!go);
    el.querySelectorAll('i').forEach(function (i, k) { i.classList.toggle('on', !go && k < n); });
  }

  // ---------- はじめる ----------
  enterTitle();
  requestAnimationFrame(frame);
  // デバッグ・自動テスト用(画面には影響しない)
  window.__musou = {
    get state() { return state; }, get session() { return session; }, sel: sel, keys: keys, onKey: onKey, track: function () { return track; },
    autopilot: function () { if (session) { var p = session.player; p.ai = new AIDriver.Driver(p.sim, track, 0.97, TrackGen.speedProfile(track, p.def)); } },
    setCam: function (m) { camMode = m; cam.init = false; }
  };
})();
