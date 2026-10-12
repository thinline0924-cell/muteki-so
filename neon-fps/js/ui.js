// 夜光区 — 画面(HUD・メニュー)
// 参考画像のような「こげ茶の線画+クリーム色の紙」の見た目で作る
(function () {
  var M = NF.M, R = NF.R, S = NF.S, W = NF.W;
  var UI = {};
  var G, root, hud, scr;
  function $(s, el) { return (el || document).querySelector(s); }
  function h(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------------- 線画のアイコン ----------------
  var INK = '#2a1f15', PAPER = '#efe6b6', OL = '#a29b67', OL2 = '#78734a', RED = '#c8392b';
  function svg(vb, body, cls) { return '<svg class="icon ' + (cls || '') + '" viewBox="' + vb + '" fill="' + PAPER + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' + body + '</svg>'; }
  UI.WICON = {
    pistol: svg('0 0 120 48', '<path d="M30 13h54v10H30z"/><path d="M36 23h44v5H58l-4 3h-6l-3 12H34l4-15z" fill="' + OL + '"/><path d="M50 28q1 7-6 7" fill="none"/><path d="M36 18h44" stroke="' + OL2 + '"/><path d="M84 15h5v6h-5z" fill="' + OL2 + '"/>'),
    smg: svg('0 0 120 48', '<path d="M24 14h58v13H24z"/><path d="M82 17h18v6H82z" fill="' + OL2 + '"/><path d="M52 27h10l3 17h-9z" fill="' + OL + '"/><path d="M30 27h12l-3 13h-9z" fill="' + OL + '"/><path d="M24 17L8 18v8l16 1" fill="none"/><path d="M40 10h14v4H40z" fill="' + OL2 + '"/><path d="M28 21h50" stroke="' + OL2 + '"/>'),
    rifle: svg('0 0 120 48', '<path d="M22 16h66v11H22z"/><path d="M88 18h26v5H88z" fill="' + OL2 + '"/><path d="M58 27h10q2 10 8 16h-10q-6-6-8-16z" fill="' + OL + '"/><path d="M34 27h11l-3 13h-9z" fill="' + OL + '"/><path d="M22 16L4 18v12l12 2 6-5" fill="' + OL + '"/><path d="M44 8h18v8H44z"/><circle cx="53" cy="12" r="2" fill="' + RED + '" stroke="none"/><path d="M70 21h16" stroke="' + OL2 + '"/>'),
    shotgun: svg('0 0 120 48', '<path d="M30 15h82v7H30z"/><path d="M40 22h60v6H40z" fill="' + OL2 + '"/><path d="M62 21h22v10H62z" fill="' + OL + '"/><path d="M30 15L6 20v12l8 2 22-6z" fill="' + OL + '"/><path d="M36 28l-4 10h8l4-10" fill="' + OL + '"/><path d="M66 24h14M66 27h14" stroke="' + OL2 + '"/>'),
    rail: svg('0 0 120 48', '<path d="M18 16h60v14H18z"/><path d="M78 13h34v5H78zM78 28h34v5H78z" fill="' + OL + '"/><path d="M78 21h32" stroke="' + OL2 + '" stroke-width="3"/><path d="M30 8h28v8H30z" fill="' + OL2 + '"/><circle cx="34" cy="12" r="3" fill="' + PAPER + '"/><path d="M40 30l-3 12h9l3-12" fill="' + OL + '"/><path d="M18 18L4 20v10l14 2" fill="' + OL + '"/><path d="M84 13v20M92 13v20M100 13v20" stroke="' + OL2 + '"/>'),
    arc: svg('0 0 120 48', '<path d="M20 15h46v16H20z"/><circle cx="76" cy="23" r="12" fill="' + OL + '"/><circle cx="76" cy="23" r="5" fill="' + PAPER + '"/><path d="M88 18l18-4M88 28l18 4M90 23h20" fill="none"/><path d="M104 10l4 4-4 4M108 28l-4 4 4 4" fill="none" stroke="' + OL2 + '"/><path d="M30 31l-3 11h9l3-11" fill="' + OL + '"/><path d="M24 9h30v6H24z" fill="' + OL2 + '"/>'),
    rocket: svg('0 0 120 48', '<path d="M10 14h96v14H10z"/><path d="M106 12h8v18h-8z" fill="' + OL2 + '"/><path d="M4 12h8v18H4z" fill="' + OL2 + '"/><path d="M44 28h9l-2 14h-9z" fill="' + OL + '"/><path d="M62 28h9l-2 10h-9z" fill="' + OL + '"/><path d="M50 6h16v8H50z" fill="' + OL + '"/><path d="M18 21h80" stroke="' + OL2 + '" stroke-dasharray="4 4"/>'),
    needle: svg('0 0 120 48', '<path d="M24 20h56v13H24z" fill="' + OL + '"/><ellipse cx="86" cy="26" rx="14" ry="9"/><path d="M36 20l4-14 4 14M48 20l4-16 4 16M60 20l4-14 4 14M72 20l3-10 3 10" fill="' + PAPER + '"/><path d="M34 33l-3 10h9l3-10" fill="' + OL + '"/><path d="M98 26h12" /><path d="M24 22L10 24v8l14 1" fill="' + OL2 + '"/>'),
    katana: svg('0 0 120 48', '<path d="M18 38L94 8l6 2-74 32z" fill="' + PAPER + '"/><path d="M28 32l-6-6 4-2 6 6z" fill="' + OL + '"/><path d="M22 34L6 42" stroke-width="5" stroke="' + INK + '"/>'),
    grenade: svg('0 0 48 48', '<circle cx="24" cy="28" r="13" fill="' + OL + '"/><path d="M18 15h12v6H18z"/><path d="M30 17q10-4 8 8" fill="none"/><path d="M14 28h20M24 18v20" stroke="' + OL2 + '"/>'),
    heart: svg('0 0 32 32', '<path d="M16 27C6 20 3 15 4 10c1-5 8-7 12-1 4-6 11-4 12 1 1 5-2 10-12 17z" fill="' + RED + '"/>'),
    shield: svg('0 0 32 32', '<path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="#a9c6c9"/><path d="M16 8v16" stroke="' + OL2 + '"/>'),
    dash: svg('0 0 32 32', '<path d="M4 10h12M2 16h16M6 22h10" fill="none"/><path d="M18 6l10 10-10 10z" fill="' + OL + '"/>'),
    coin: svg('0 0 32 32', '<circle cx="16" cy="16" r="11" fill="#e8c96a"/><path d="M11 10l5 7 5-7M10 17h12M10 21h12M16 17v9" fill="none"/>'),
    core: svg('0 0 32 32', '<path d="M16 3l11 7v12l-11 7-11-7V10z" fill="' + OL + '"/><path d="M16 9l6 4v6l-6 4-6-4v-6z" fill="' + PAPER + '"/>')
  };
  function chip(kanji, rar) {
    var fill = rar === 2 ? RED : rar === 1 ? OL : PAPER, tc = rar === 2 ? PAPER : INK;
    var pins = '';
    for (var i = 0; i < 4; i++) { pins += '<path d="M' + (18 + i * 9) + ' 6v6M' + (18 + i * 9) + ' 52v6M6 ' + (18 + i * 9) + 'h6M52 ' + (18 + i * 9) + 'h6" fill="none"/>'; }
    return svg('0 0 64 64', pins + '<rect x="12" y="12" width="40" height="40" rx="6" fill="' + fill + '"/><rect x="17" y="17" width="30" height="30" rx="3" fill="none" stroke="' + (rar === 2 ? PAPER : OL2) + '" stroke-dasharray="3 3"/><text x="32" y="41" text-anchor="middle" font-size="24" font-weight="900" fill="' + tc + '" stroke="none" font-family="sans-serif">' + kanji + '</text>', 'uicon');
  }
  var UP_KANJI = { rof: '速', dmg: '威', mag: '弾', reload: '装', hp: '骨', speed: '疾', nades: '榴', magnet: '磁', recoil: '安', jump: '跳', dash: '駆', vamp: '血', armorRegen: '甲', ammoGen: '炉', execute: '処', air: '空', slide: '滑', crit: '運', katana: '刀', momentum: '鎖', emptyReload: '空', overcharge: '電', explodeKill: '爆', ricochet: '跳', slowmo: '時', lastStand: '魂', chain: '雷', buddy: '友' };
  var RAR = ['ふつう', 'めずらしい', '伝説'];

  // ---------------- 初期化 ----------------
  UI.init = function (g) {
    G = g;
    root = document.getElementById('ui');
    root.innerHTML = [
      '<div id="hud" class="off">',
      ' <div id="speedl"></div>',
      ' <div id="scope"><i class="sh"></i><i class="sv"></i><i class="sc"></i><div class="chg"><b></b></div></div>',
      ' <div id="dmgdirs"></div>',
      ' <div id="cross"><i class="ch" style="left:-17px"></i><i class="ch" style="left:8px"></i><i class="cv" style="top:-17px"></i><i class="cv" style="top:8px"></i><i class="dot"></i></div>',
      ' <div id="hitm"><i style="transform:rotate(45deg) translate(9px)"></i><i style="transform:rotate(135deg) translate(9px)"></i><i style="transform:rotate(225deg) translate(9px)"></i><i style="transform:rotate(315deg) translate(9px)"></i></div>',
      ' <div id="radar"><canvas id="radarc" width="168" height="168"></canvas><span class="tag lbl">半径45m</span></div>',
      ' <div id="obj" class="card"><div class="o1"></div><div class="o2"></div><div class="o3"></div><div class="bar obar hidden"><b></b></div></div>',
      ' <div id="muts"></div>',
      ' <div id="contract" class="card"><span class="ct"></span> <b class="cp"></b></div>',
      ' <div id="clickhint"><span class="tag">クリックで操作を開始</span></div>',
      ' <div id="bossbar" class="card hidden"><div class="bn"><span>鬼神 ONI-零式</span><span class="bp"></span></div><div class="bar"><s></s><b></b></div></div>',
      ' <div id="score" class="card"><div class="sc">0</div><div class="cr"></div></div>',
      ' <div id="rank"><div class="rl">D</div><br><span class="rm">×1.0</span><div class="bar"><b></b></div></div>',
      ' <div id="feed"></div>',
      ' <div id="vitals" class="card">',
      '  <div class="vrow">' + UI.WICON.heart.replace('class="icon ', 'class="icon vi ') + '<div class="bar hp"><s></s><b></b></div><div class="vnum hpn">100</div></div>',
      '  <div class="vrow">' + UI.WICON.shield + '<div class="bar ar"><b></b></div><div class="vnum sm arn">50</div></div>',
      '  <div class="abil"><span>ダッシュ</span><span class="dpips"></span><span style="margin-left:auto">手榴弾</span><span class="nades"></span></div>',
      ' </div>',
      ' <div id="weap" class="card"><span class="tag reloadtag hidden">リロード中</span>',
      '  <div class="wtop"><div class="wicon"></div><div><div class="ammo"><span class="mag">0</span><span class="res">/ 0</span></div></div></div>',
      '  <div class="wname"><span class="wn"></span><span class="wl tag"></span></div>',
      '  <div class="bar heat hidden"><b></b></div>',
      '  <div id="slots"></div>',
      ' </div>',
      ' <div id="banner"></div><div id="toast"></div><div id="prompt"></div><div id="count"></div><div id="fps"></div>',
      ' <div id="dnums"></div>',
      '</div>',
      '<div id="screens"></div>',
      '<div id="touch" class="hidden"></div>',
      '<div id="rotate"><div class="card">横向きにすると遊びやすくなります</div></div>'
    ].join('');
    hud = $('#hud'); scr = $('#screens');
    // 部品の数字のための入れ物
    UI.dn = [];
    var dnc = $('#dnums');
    for (var i = 0; i < 28; i++) { var d = document.createElement('div'); d.className = 'dnum'; d.style.display = 'none'; dnc.appendChild(d); UI.dn.push({ el: d, life: 0 }); }
    UI.radarCtx = $('#radarc').getContext('2d');
    setupTouch();
    window.addEventListener('keydown', function (e) {
      if (G.state === 'upgrade' && UI.upPick) { var k = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code]; if (k !== undefined) UI.upPick(k); }
      if (e.code === 'Escape' && UI.back) { UI.back(); }
    });
  };

  // ---------------- 状態ごとの画面 ----------------
  UI.onState = function (s, prev) {
    document.body.classList.toggle('playing', s === 'play');
    if (s !== 'play') { $('#banner').innerHTML = ''; bannerT = 0; }
    hud.classList.toggle('off', !(s === 'play' || s === 'pause' || s === 'upgrade'));
    if (s === 'title') UI.title();
    else if (s === 'pause') UI.pauseScreen();
    else if (s === 'play') { clearScreens(); }
    $('#touch').classList.toggle('hidden', !(G.touch && s === 'play'));
  };
  function clearScreens() { scr.innerHTML = ''; UI.back = null; UI.upPick = null; }
  function screen(html, cls) {
    scr.innerHTML = '<div class="screen ' + (cls || '') + '">' + html + '</div>';
    var el = scr.firstChild;
    el.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('mouseenter', function () { S.init(); S.ui('hover'); });
    });
    return el;
  }
  function on(el, sel, fn) { var x = el.querySelector(sel); if (x) x.addEventListener('click', function (e) { S.init(); fn(e); }); }

  // タイトル
  UI.title = function () {
    S.init();
    var sv = G.save;
    var el = screen([
      '<div class="frame"></div>',
      '<div class="side" id="title">',
      ' <div class="logo"><div class="k">夜光区</div><br><div class="e">NEON DISTRICT</div><div class="sub">雨の止まない電脳市街。暴走したアンドロイドの群れから、区画をひとつずつ取り返せ。</div></div>',
      ' <button class="btn main" id="b-start">出撃する<small>装備: ' + esc(W.DEFS[G.settings.loadout].name) + '</small></button>',
      ' <button class="btn" id="b-daily">今日の街<small>だれでも同じ街・同じしかけ。日替わりの腕くらべ</small></button>',
      ' <button class="btn" id="b-load">装備をえらぶ</button>',
      ' <div style="display:flex;gap:10px"><button class="btn alt" id="b-rec">記録</button><button class="btn alt" id="b-set">設定</button><button class="btn alt" id="b-how">あそびかた</button></div>',
      ' <div class="best card"><span>最高得点<br><b>' + sv.best.toLocaleString() + '</b></span><span>最深到達<br><b>第' + Math.max(1, sv.bestDistrict) + '区</b></span><span>通算撃破<br><b>' + sv.kills + '</b></span></div>',
      '</div>',
      '<div class="titlefoot">WASD 移動 / マウス 視点 / クリックで射撃<br>音が出ます 🔊</div>'
    ].join(''), '');
    el.id = 'title';
    on(el, '#b-start', function () { S.ui('select'); startRun(false); });
    on(el, '#b-daily', function () { S.ui('select'); startRun(true); });
    on(el, '#b-load', function () { S.ui('select'); UI.loadout(); });
    on(el, '#b-rec', function () { S.ui('select'); UI.records(); });
    on(el, '#b-set', function () { S.ui('select'); UI.settings(UI.title); });
    on(el, '#b-how', function () { S.ui('select'); UI.howto(UI.title); });
    S.music(true, 0);
    S.ambience(true, 1);
  };
  function startRun(daily) {
    G.newRun({ daily: daily });
    G.setState('play');
    UI.districtIntro(function () { G.startWave(); });
  }

  // 装備
  UI.loadout = function () {
    var cards = W.ORDER.filter(function (id) { return id !== 'pistol'; }).map(function (id) {
      var d = W.DEFS[id], ok = G.isUnlocked(id), sel = G.settings.loadout === id;
      var u = d.unlock ? G.UNLOCKS[d.unlock] : null;
      var dps = d.kind === 'beam' ? d.dmg : d.dmg * (d.pellets || 1) * (d.rpm || 60) / 60;
      var stats = [['威力', Math.min(1, (d.dmg * (d.pellets || 1)) / 170)], ['連射', Math.min(1, (d.rpm || 900) / 950)], ['DPS', Math.min(1, dps / 260)], ['射程', Math.min(1, d.range / 220)]];
      return '<button class="pick ' + (ok ? '' : 'locked') + (sel ? ' sel' : '') + '" data-id="' + id + '">' +
        '<span class="tag rar">' + esc(d.style) + '</span><div class="wpic">' + UI.WICON[id] + '</div><h3>' + esc(d.name) + '</h3>' +
        '<p>' + (ok ? esc(d.desc) : '🔒 解放条件: ' + esc(u.text)) + '</p>' +
        (ok ? '<div class="stats">' + stats.map(function (s) { return '<span>' + s[0] + '</span><div class="bar"><b style="width:' + Math.round(s[1] * 100) + '%"></b></div>'; }).join('') + '</div>' : '') +
        '</button>';
    }).join('');
    var el = screen('<div class="panel card"><h2>装備をえらぶ</h2><p class="lead">ハンドガン「ハチドリ」はいつも持っていく。もう1つの主武器をえらぼう。店では3つ目の武器も買える。</p><div class="cards">' + cards + '</div><div class="foot"><button class="btn sm" id="b-back">もどる</button></div></div>', 'dim');
    el.querySelectorAll('.pick').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-id');
        if (!G.isUnlocked(id)) { S.ui('deny'); return; }
        G.settings.loadout = id; G.applySettings(); S.ui('select'); UI.loadout();
      });
    });
    on(el, '#b-back', function () { S.ui('back'); UI.title(); });
    UI.back = function () { UI.title(); };
  };

  // 記録
  UI.records = function () {
    var sv = G.save;
    var dk = Object.keys(sv.dailyBest).slice(-5).reverse();
    var unl = Object.keys(G.UNLOCKS).map(function (k) {
      var id = { rail: 'rail', arc: 'arc', rocket: 'rocket', needle: 'needle' }[k];
      var ok = G.isUnlocked(id);
      return '<div>' + (ok ? '✔ ' : '🔒 ') + esc(W.DEFS[id].name) + '<br><span style="font-weight:700">' + esc(G.UNLOCKS[k].text) + '</span></div>';
    }).join('');
    var el = screen('<div class="panel card"><h2>記録</h2><p class="lead">このブラウザに保存されている記録です。</p>' +
      '<div class="kv"><div>最高得点<b>' + sv.best.toLocaleString() + '</b></div><div>最深到達<b>第' + Math.max(1, sv.bestDistrict) + '区</b></div><div>通算撃破<b>' + sv.kills + '</b></div><div>ヘッドショット<b>' + sv.heads + '</b></div><div>出撃回数<b>' + sv.runs + '</b></div><div>鬼神撃破<b>' + sv.bossKills + '</b></div></div>' +
      '<h2 style="font-size:18px;margin-top:18px">武器の解放</h2><div class="kv">' + unl + '</div>' +
      '<h2 style="font-size:18px;margin-top:18px">今日の街の記録</h2><div class="kv">' + (dk.length ? dk.map(function (k) { return '<div>' + esc(k) + '<b>' + sv.dailyBest[k].toLocaleString() + '</b></div>'; }).join('') : '<div>まだありません</div>') + '</div>' +
      '<div class="foot"><button class="btn sm" id="b-back">もどる</button></div></div>', 'dim');
    on(el, '#b-back', function () { S.ui('back'); UI.title(); });
    UI.back = function () { UI.title(); };
  };

  // 設定
  UI.settings = function (backTo) {
    var s = G.settings;
    function row(label, key, min, max, step, fmt) {
      return '<div class="setrow"><span>' + label + '</span><input type="range" data-k="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + s[key] + '"><span class="v" data-v="' + key + '">' + fmt(s[key]) + '</span></div>';
    }
    var f1 = function (v) { return (+v).toFixed(2); }, fp = function (v) { return Math.round(v * 100) + '%'; }, fd = function (v) { return v + '°'; };
    var seg = function (key, opts) { return '<div class="seg" data-seg="' + key + '">' + opts.map(function (o) { return '<button data-val="' + o[0] + '" class="' + (String(s[key]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>'; };
    var el = screen('<div class="panel card" style="width:min(640px,94vw)"><h2>設定</h2><p class="lead">変更はすぐに反映され、保存されます。</p>' +
      row('マウス感度', 'sens', 0.2, 3, 0.05, f1) + row('視野角', 'fov', 70, 110, 1, fd) +
      row('全体の音量', 'master', 0, 1, 0.05, fp) + row('効果音', 'sfx', 0, 1, 0.05, fp) + row('音楽', 'music', 0, 1, 0.05, fp) +
      '<div class="setrow"><span>画質</span>' + seg('quality', [['low', '軽い'], ['mid', 'ふつう'], ['high', 'きれい']]) + '<span></span></div>' +
      '<div class="setrow"><span>イラスト調で遊ぶ</span>' + seg('illust', [[false, 'オフ'], [true, 'オン']]) + '<span></span></div>' +
      '<div class="setrow"><span>上下の反転</span>' + seg('invert', [[false, 'オフ'], [true, 'オン']]) + '<span></span></div>' +
      '<div class="setrow"><span>FPS 表示</span>' + seg('fps', [[false, 'オフ'], [true, 'オン']]) + '<span></span></div>' +
      '<div class="foot"><button class="btn sm" id="b-back">もどる</button></div></div>', 'dim');
    el.querySelectorAll('input[type=range]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var k = inp.getAttribute('data-k'); s[k] = parseFloat(inp.value);
        var fmt = k === 'sens' ? f1 : k === 'fov' ? fd : fp;
        el.querySelector('[data-v="' + k + '"]').textContent = fmt(s[k]);
        G.applySettings();
      });
    });
    el.querySelectorAll('.seg').forEach(function (sg) {
      sg.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = sg.getAttribute('data-seg'), v = b.getAttribute('data-val');
          s[k] = v === 'true' ? true : v === 'false' ? false : v;
          sg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
          G.applySettings(); S.ui('select');
        });
      });
    });
    on(el, '#b-back', function () { S.ui('back'); backTo(); });
    UI.back = backTo;
  };

  // あそびかた
  UI.howto = function (backTo) {
    var k = [['W A S D', '移動'], ['マウス', '視点'], ['左クリック', '撃つ(レールガンはためて離す)'], ['右クリック', '覗く(ズーム)'], ['Shift', '走る'], ['Ctrl / C', 'しゃがむ・走りながらでスライディング'],
      ['Space', 'ジャンプ(改造で二段ジャンプ)'], ['Q', 'ダッシュ(一瞬無敵)'], ['V / F', '刀で斬る・敵の弾を跳ね返す'], ['G', '手榴弾'], ['R', 'リロード'], ['1 2 3 / ホイール', '武器の持ち替え'], ['Esc', '一時停止']];
    var el = screen('<div class="panel card"><h2>あそびかた</h2><p class="lead">区は3つの「波」でできている。波を越えるたびに改造チップを1つ選び、区を制圧すると店で買い物ができる。倒れたら最初から。</p>' +
      '<div class="keys">' + k.map(function (x) { return '<div><kbd>' + x[0] + '</kbd>' + x[1] + '</div>'; }).join('') + '</div>' +
      '<ul class="tips">' +
      '<li><b>評価(D→極)</b>: 続けて倒す・ヘッドショット・空中や滑りながらの撃破で上がる。評価が高いほど得点が増える。被弾すると下がる。</li>' +
      '<li><b>刀で倒すと体力が多く落ちる</b>。危ないときこそ前へ。刀を振ると、飛んでくる弾を跳ね返せる。</li>' +
      '<li><b>重装兵</b>は前に盾を持っている。回りこむか、爆発・電撃で盾を壊そう。<b>狙撃型</b>の赤い光線が見えたら物かげへ。</li>' +
      '<li><b>ジャンプ台</b>で屋上や高架へ。高いところからは街がよく見える。赤黄の<b>樽</b>は撃つと爆発する。</li>' +
      '<li>波の種類: 殲滅 / 制圧(端末のそばにとどまる)/ 回収(印のついた敵がデータコアを落とす)/ 精鋭狩り / ボス戦。</li>' +
      '<li>第2区からは「低重力」「停電」などの<b>しかけ</b>がつく。武器は条件を満たすと解放される。</li>' +
      '</ul><div class="foot"><button class="btn sm" id="b-back">もどる</button></div></div>', 'dim');
    on(el, '#b-back', function () { S.ui('back'); backTo(); });
    UI.back = backTo;
  };

  // 一時停止
  UI.pauseScreen = function () {
    var run = G.run;
    var ups = run ? run.upgrades.map(function (id) { var u = G.UPGRADES.filter(function (x) { return x.id === id; })[0]; return u ? '<span class="tag" style="margin:0 4px 4px 0">' + esc(u.name) + '</span>' : ''; }).join('') : '';
    var el = screen('<div class="frame"></div><div class="panel card" style="width:min(520px,92vw)"><h2>一時停止</h2><p class="lead">第' + run.district + '区 — 波 ' + run.wave + ' / 3 ・ 得点 ' + run.score.toLocaleString() + '</p>' +
      '<button class="btn main" id="b-resume">つづける</button><button class="btn" id="b-set">設定</button><button class="btn" id="b-how">あそびかた</button><button class="btn alt" id="b-quit">タイトルへもどる<small>この出撃は記録されずに終わります</small></button>' +
      (ups ? '<div style="margin-top:8px;font-weight:800;font-size:13px">装着中の改造チップ</div><div style="margin-top:6px">' + ups + '</div>' : '') + '</div>', 'dim');
    on(el, '#b-resume', function () { S.ui('select'); G.resume(); });
    on(el, '#b-set', function () { UI.settings(UI.pauseScreen); });
    on(el, '#b-how', function () { UI.howto(UI.pauseScreen); });
    on(el, '#b-quit', function () { S.ui('back'); G.quitToTitle(); });
    UI.back = null;
  };

  // 改造チップを選ぶ
  UI.showUpgrade = function (list, cb) {
    var el = screen('<div class="panel card" style="width:min(860px,94vw)"><h2>改造チップを1つ選ぶ</h2><p class="lead">波を越えた。体に組みこむチップを選ぼう(キー 1・2・3 でも選べる)。</p><div class="cards upcards">' +
      list.map(function (u, i) {
        var n = G.player.upgrades[u.id] || 0;
        return '<button class="pick" data-i="' + i + '"><span class="tag rar r' + u.rar + '">' + RAR[u.rar] + '</span>' + chip(UP_KANJI[u.id] || '改', u.rar) + '<h3>' + esc(u.name) + '</h3><p>' + esc(u.desc) + '</p><span class="key">[' + (i + 1) + ']' + (u.stack > 1 ? '  所持 ' + n + '/' + u.stack : '') + '</span></button>';
      }).join('') + '</div></div>', 'dim');
    var done = false;
    UI.upPick = function (i) { if (done || !list[i]) return; done = true; UI.upPick = null; cb(list[i]); };
    el.querySelectorAll('.pick').forEach(function (b) { b.addEventListener('click', function () { UI.upPick(+b.getAttribute('data-i')); }); });
  };

  // 店
  UI.showShop = function (news, cb) {
    function render() {
      var run = G.run, pl = G.player;
      var items = G.shopItems();
      var el = screen('<div class="frame"></div><div class="panel card"><h2>闇市 — 第' + run.district + '区 制圧</h2><p class="lead">集めたクレジットで次の区にそなえよう。武器を買うと、今持っている主武器と入れ替わる(枠が空いていれば追加)。</p>' +
        (news && news.length ? '<div class="card" style="padding:8px 12px;margin-bottom:12px;background:var(--paper2)"><b class="red">新しい武器が解放された!</b> ' + news.map(function (k) { return esc(W.DEFS[k].name); }).join('、') + '</div>' : '') +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' + UI.WICON.coin.replace('class="icon ', 'class="icon" style="width:30px" data-x="') + '<span class="money">¥ ' + run.credits.toLocaleString() + '</span><span style="margin-left:auto;font-weight:800;font-size:13px">体力 ' + Math.ceil(pl.hp) + '/' + pl.maxHp + ' ・ 装甲 ' + Math.ceil(pl.armor) + ' ・ 手榴弾 ' + pl.nades + '</span></div>' +
        '<div class="shoplist">' + items.map(function (it, i) {
          var can = it.ok && run.credits >= it.price;
          return '<div class="shopi">' + (it.weapon ? '<div style="width:70px">' + UI.WICON[it.weapon] + '</div>' : '') + '<div class="si"><b>' + esc(it.name) + '</b><span>' + esc(it.desc) + '</span></div><button class="btn" data-i="' + i + '" ' + (can ? '' : 'disabled') + '>¥' + it.price + '</button></div>';
        }).join('') + '</div><div class="foot"><button class="btn main" id="b-next" style="width:auto">次の区へ進む</button></div></div>', 'dim');
      el.querySelectorAll('.shopi .btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var it = items[+b.getAttribute('data-i')];
          if (!it.ok || run.credits < it.price) { S.ui('deny'); return; }
          run.credits -= it.price; it.buy(); S.ui('buy'); render();
        });
      });
      on(el, '#b-next', function () { S.ui('select'); cb(); });
    }
    render();
  };

  // 倒れた
  UI.showDead = function (o) {
    var run = G.run, sv = G.save;
    var el = screen('<div class="frame"></div><div class="panel card" style="width:min(640px,94vw);text-align:center"><div class="deadt">機能停止</div>' +
      '<p class="lead" style="margin-top:10px">第' + run.district + '区・波 ' + run.wave + ' で倒れた' + (run.daily ? '(今日の街 ' + esc(run.daily) + ')' : '') + '</p>' +
      '<div class="kv" style="text-align:left"><div>得点<b>' + run.score.toLocaleString() + (o.best ? ' <span class="red" style="font-size:13px">最高記録!</span>' : '') + '</b></div><div>撃破<b>' + run.kills + '</b></div><div>ヘッドショット<b>' + run.heads + '</b></div><div>生存時間<b>' + Math.floor(run.time / 60) + '分' + Math.floor(run.time % 60) + '秒</b></div></div>' +
      (o.news && o.news.length ? '<p style="font-weight:900;margin-top:14px" class="red">新しい武器が解放された: ' + o.news.map(function (k) { return esc(W.DEFS[k].name); }).join('、') + '</p>' : '') +
      '<div class="foot" style="justify-content:center"><button class="btn main" id="b-again" style="width:auto">もう一度出撃</button><button class="btn alt" id="b-title" style="width:auto">タイトルへ</button></div></div>', 'dim');
    on(el, '#b-again', function () { S.ui('select'); startRun(!!run.daily); });
    on(el, '#b-title', function () { S.ui('back'); G.quitToTitle(); });
    void sv;
  };

  // 区の紹介
  UI.districtIntro = function (cb) {
    var run = G.run, th = G.world.theme;
    var muts = run.mutList.map(function (m) { return '<div class="card"><b>' + esc(m.name) + '</b>' + esc(m.desc) + '</div>'; }).join('');
    var el = h('<div class="intro" style="position:absolute;left:50%;top:40%;transform:translate(-50%,-50%)"><div class="card" style="display:inline-block;padding:10px 30px 14px;transform:rotate(-1deg)"><div class="dn">第 ' + run.district + ' 区' + (run.daily ? ' ・ 今日の街' : '') + '</div><div class="tn">' + esc(th.name) + '</div></div>' + (muts ? '<div class="mt">' + muts + '</div>' : '') + '</div>');
    scr.innerHTML = ''; scr.appendChild(el);
    S.music(true, 1);
    G.after(2.6, function () { if (el.parentNode) el.parentNode.removeChild(el); UI.countdown(cb); });
  };
  UI.countdown = function (cb) {
    var c = $('#count'), n = 3;
    function tick() {
      if (n <= 0) { c.textContent = ''; cb(); return; }
      c.textContent = n; S.beep(null, n === 1); n--;
      G.after(0.65, tick);
    }
    tick();
  };

  UI.waveStart = function (type) {
    var run = G.run;
    UI.banner('波 ' + run.wave + ' / 3 — ' + G.director.waveName[type], type === 'boss' ? 'red' : '', G.director.waveDesc[type]);
  };

  // ---------------- 小さなお知らせ ----------------
  var bannerT = 0, toastT = 0;
  UI.banner = function (text, style, sub) {
    var b = $('#banner');
    b.className = '';
    b.innerHTML = '<div class="bt ' + (style === 'red' ? 'red' : '') + '">' + esc(text) + '</div>' + (sub ? '<div class="bs">' + esc(sub) + '</div>' : '');
    void b.offsetWidth; b.className = 'show';
    bannerT = 2.6;
  };
  UI.toast = function (text) { $('#toast').innerHTML = '<span class="tt">' + esc(text) + '</span>'; toastT = 1.6; };
  var hitT = 0;
  UI.hitmarker = function (kind) { var m = $('#hitm'); m.className = kind; hitT = kind === 'kill' ? 0.35 : 0.18; };
  UI.damageDir = function (ang) {
    var c = $('#dmgdirs');
    var d = document.createElement('div'); d.className = 'dmgdir'; d.style.transform = 'rotate(' + (-ang) + 'rad)';
    c.appendChild(d);
    d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease-in' }).onfinish = function () { d.remove(); };
  };
  UI.styleText = function (label, pts) {
    var f = $('#feed');
    var d = h('<div class="feedi">' + esc(label) + (pts ? ' <b>+' + Math.round(pts * G.styleMult()) + '</b>' : '') + '</div>');
    f.insertBefore(d, f.firstChild);
    while (f.children.length > 6) f.removeChild(f.lastChild);
    setTimeout(function () { d.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(20px)' }], { duration: 300 }).onfinish = function () { d.remove(); }; }, 2200);
  };
  UI.kill = function () { };
  UI.pickup = function (kind) {
    var t = { health: '体力 +15', armor: '装甲 +15', ammo: '弾薬', core: '' }[kind];
    if (t) UI.toast(t);
  };
  UI.dmgNumber = function (p, v, kind) {
    var slot = null;
    for (var i = 0; i < UI.dn.length; i++) if (UI.dn[i].life <= 0) { slot = UI.dn[i]; break; }
    if (!slot) slot = UI.dn[Math.floor(Math.random() * UI.dn.length)];
    slot.p = [p[0] + (Math.random() - 0.5) * 0.4, p[1] + 0.3, p[2] + (Math.random() - 0.5) * 0.4];
    slot.life = 0.8; slot.el.textContent = Math.round(v); slot.el.className = 'dnum ' + kind; slot.el.style.display = 'block';
  };
  UI.dashFx = function () { var s = $('#speedl'); s.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350 }); };
  UI.error = function (err) { if (UI._err) return; UI._err = true; UI.toast('エラー: ' + (err && err.message)); };

  // ---------------- 毎フレームの HUD ----------------
  var cache = {};
  function set(sel, prop, val) {
    var k = sel + prop;
    if (cache[k] === val) return;
    cache[k] = val;
    var el = $(sel); if (!el) return;
    if (prop === 'text') el.textContent = val; else if (prop === 'html') el.innerHTML = val; else if (prop === 'cls') el.className = val; else el.style[prop] = val;
  }
  UI.update = function (dt) {
    bannerT -= dt; toastT -= dt; hitT -= dt;
    if (bannerT <= 0 && $('#banner').innerHTML) $('#banner').innerHTML = '';
    if (toastT <= 0 && $('#toast').innerHTML) $('#toast').innerHTML = '';
    $('#hitm').style.opacity = hitT > 0 ? 1 : 0;
    set('#fps', 'text', G.settings.fps ? G.fps + ' fps' : '');
    if (!G.player || !G.run || hud.classList.contains('off')) return;
    var pl = G.player, run = G.run, w = W.current(pl), d = W.DEFS[w.id], st = W.st;
    // 体力
    var hk = pl.hp / pl.maxHp;
    set('#vitals .hp > b', 'width', (hk * 100).toFixed(1) + '%');
    set('#vitals .hp > s', 'width', (hk * 100).toFixed(1) + '%');
    set('#vitals .hp', 'cls', 'bar hp' + (hk < 0.3 ? ' low' : ''));
    set('#vitals .hpn', 'text', Math.ceil(pl.hp));
    set('#vitals .ar > b', 'width', (pl.armor / pl.maxArmor * 100).toFixed(1) + '%');
    set('#vitals .arn', 'text', Math.ceil(pl.armor));
    var pips = '';
    for (var i = 0; i < pl.maxDashes; i++) {
      var full = i < pl.dashes, part = i === pl.dashes ? Math.min(1, pl.dashRegen / (2.2 * (pl.mods.dashCD || 1))) : 0;
      pips += '<span class="pip ' + (full ? '' : 'empty') + '">' + (!full && part ? '<u style="height:' + Math.round(part * 100) + '%"></u>' : '') + '</span>';
    }
    set('#vitals .dpips', 'html', pips);
    var nd = '';
    for (i = 0; i < pl.maxNades; i++) nd += '<span class="pip ' + (i < pl.nades ? '' : 'empty') + '" style="width:12px;height:12px;margin-left:2px"></span>';
    set('#vitals .nades', 'html', nd);
    // 武器
    set('#weap .wicon', 'html', UI.WICON[w.id]);
    set('#weap .wn', 'text', d.name);
    set('#weap .wl', 'text', w.level ? 'Lv' + (w.level + 1) : d.style);
    if (d.kind === 'beam') {
      set('#weap .mag', 'text', w.overheat > 0 ? '熱' : '∞');
      set('#weap .res', 'text', '');
      set('#weap .heat', 'cls', 'bar heat' + (w.heat > 0.75 || w.overheat > 0 ? ' hot' : ''));
      set('#weap .heat > b', 'width', (w.heat * 100).toFixed(0) + '%');
    } else {
      set('#weap .mag', 'text', w.mag);
      set('#weap .mag', 'cls', 'mag' + (w.mag <= Math.ceil(W.stat(pl, w, 'mag') * 0.25) ? ' low' : ''));
      set('#weap .res', 'text', '/ ' + (w.reserve === Infinity ? '∞' : w.reserve));
      set('#weap .heat', 'cls', 'bar heat hidden');
    }
    set('#weap .reloadtag', 'cls', 'tag reloadtag' + (st.reloadT > 0 ? '' : ' hidden'));
    var sl = pl.weapons.map(function (x, k) { return x ? '<div class="sl ' + (k === pl.slot ? 'on' : '') + '"><em>' + (k + 1) + '</em>' + esc(W.DEFS[x.id].short) + '</div>' : '<div class="sl"><em>' + (k + 1) + '</em>—</div>'; }).join('');
    set('#slots', 'html', sl);
    // 照準の広がり
    var spread = M.lerp(d.spread, d.adsSpread, st.ads) + d.moveSpread * pl.moveFrac + st.spreadBloom + (pl.onGround ? 0 : d.moveSpread * 0.8);
    var px = 6 + spread * 7;
    var ch = $('#cross').children;
    ch[0].style.left = (-px - 9) + 'px'; ch[1].style.left = px + 'px'; ch[2].style.top = (-px - 9) + 'px'; ch[3].style.top = px + 'px';
    var hideX = (w.id === 'rail' && st.ads > 0.5) || pl.sprintAmt > 0.6;
    set('#cross', 'opacity', hideX ? '0' : (st.ads > 0.6 && w.id !== 'shotgun' ? '0.5' : '1'));
    // スコープ
    var sc = w.id === 'rail' ? M.clamp((st.ads - 0.7) / 0.3, 0, 1) : 0;
    set('#scope', 'opacity', sc.toFixed(2));
    set('#scope .chg b', 'width', (st.charge * 100).toFixed(0) + '%');
    // 得点
    set('#score .sc', 'text', run.score.toLocaleString());
    set('#score .cr', 'text', '¥ ' + run.credits.toLocaleString() + '  ・  撃破 ' + run.kills);
    var rk = G.styleRank(), next = G.RANKS[rk + 1];
    set('#rank .rl', 'text', G.RANKS[rk][0]);
    set('#rank .rl', 'cls', 'rl' + (rk >= 4 ? ' hi' : ''));
    set('#rank', 'cls', 'r' + rk);
    set('#rank .rm', 'text', '×' + G.styleMult().toFixed(1));
    var prog = next ? (run.stylePts - G.RANKS[rk][1]) / (next[1] - G.RANKS[rk][1]) : 1;
    set('#rank .bar > b', 'width', (M.clamp(prog, 0, 1) * 100).toFixed(0) + '%');
    // 目的
    var D = G.director;
    set('#obj .o1', 'text', '第' + run.district + '区 ' + G.world.theme.name + ' — 波 ' + run.wave + ' / 3');
    var o2 = '', o3 = '', bar = -1;
    if (!D.active && !D.done) { o2 = '準備中'; o3 = ''; }
    else if (D.done) { o2 = 'クリア'; }
    else if (D.type === 'exterminate' || D.type === 'elite') { o2 = D.waveName[D.type]; o3 = '残り ' + (D.remaining || 0) + ' 体'; bar = 1 - (D.remaining || 0) / Math.max(1, D.total); }
    else if (D.type === 'hold') { o2 = '制圧 — 端末をハッキング'; o3 = D.inside ? (D.contested ? '敵がいる!排除せよ' : 'ハッキング中…') : '光の輪の中へ向かえ'; bar = D.zone.prog / D.zone.need; }
    else if (D.type === 'collect') { o2 = '回収 — データコア'; o3 = D.cores + ' / ' + D.needCores + '(緑の印の敵が持っている)'; bar = D.cores / D.needCores; }
    else if (D.type === 'boss') { o2 = 'ボス戦'; o3 = D.boss ? '鬼神の背中の炉心が弱点' : '何かが近づいてくる…'; }
    set('#obj .o2', 'text', o2); set('#obj .o3', 'text', o3);
    set('#obj .obar', 'cls', 'bar obar' + (bar < 0 ? ' hidden' : ''));
    if (bar >= 0) set('#obj .obar > b', 'width', (M.clamp(bar, 0, 1) * 100).toFixed(1) + '%');
    var ct = run.contract;
    if (ct) { set('#contract .ct', 'text', (ct.done ? '✔ ' : '依頼: ') + ct.label); set('#contract .cp', 'text', ct.done ? '達成' : ct.p + ' / ' + ct.n); set('#contract', 'cls', 'card' + (ct.done ? ' done' : '')); }
    set('#clickhint', 'display', (G.state === 'play' && !G.locked && !G.touch && !NF.still) ? 'block' : 'none');
    set('#muts', 'html', run.mutList.map(function (m) { return '<span class="tag">' + esc(m.name) + '</span>'; }).join(''));
    // ボス
    var boss = D.boss && D.boss.alive ? D.boss : null;
    set('#bossbar', 'cls', 'card' + (boss ? '' : ' hidden'));
    if (boss) { var bk = boss.hp / boss.maxHp; set('#bossbar .bar > b', 'width', (bk * 100).toFixed(1) + '%'); set('#bossbar .bar > s', 'width', (bk * 100).toFixed(1) + '%'); set('#bossbar .bp', 'text', '段階 ' + (boss.phase + 1) + ' / 3'); }
    set('#muts', 'top', boss ? '160px' : '104px');
    // ダメージの数字
    var vp = R.vp, Wc = window.innerWidth, Hc = window.innerHeight;
    UI.dn.forEach(function (n) {
      if (n.life <= 0) return;
      n.life -= dt;
      if (n.life <= 0) { n.el.style.display = 'none'; return; }
      n.p[1] += dt * 0.9;
      var q = NF.M.m4.transformPoint(vp, n.p);
      var x = n.p[0] * vp[3] + n.p[1] * vp[7] + n.p[2] * vp[11] + vp[15];
      if (x <= 0) { n.el.style.display = 'none'; return; }
      n.el.style.display = 'block';
      n.el.style.transform = 'translate(' + ((q[0] + 1) / 2 * Wc).toFixed(1) + 'px,' + ((1 - q[1]) / 2 * Hc).toFixed(1) + 'px) translate(-50%,-50%) scale(' + (0.7 + n.life * 0.5).toFixed(2) + ')';
      n.el.style.opacity = Math.min(1, n.life * 3).toFixed(2);
    });
    drawRadar();
  };

  // ---------------- レーダー(線画)----------------
  var foot = null, footWorld = null;
  function drawRadar() {
    var ctx = UI.radarCtx, pl = G.player, w = G.world;
    if (footWorld !== w) {
      footWorld = w;
      foot = w.boxes.filter(function (b) { return b[6] === 0 && b[4] > 2.5 && b[3] - b[0] < 60 && b[5] - b[2] < 60 && (b[3] - b[0]) * (b[5] - b[2]) > 3; });
    }
    var S2 = 168, c = S2 / 2, range = 45, k = (c - 6) / range;
    ctx.clearRect(0, 0, S2, S2);
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, c - 3, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#e3d79c'; ctx.fillRect(0, 0, S2, S2);
    ctx.translate(c, c);
    ctx.rotate(pl.yaw);
    // 方眼
    ctx.strokeStyle = 'rgba(42,31,21,0.15)'; ctx.lineWidth = 1;
    for (var g = -60; g <= 60; g += 15) { ctx.beginPath(); ctx.moveTo(-90, g * k); ctx.lineTo(90, g * k); ctx.stroke(); ctx.beginPath(); ctx.moveTo(g * k, -90); ctx.lineTo(g * k, 90); ctx.stroke(); }
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#2a1f15';
    var px = pl.p[0], pz = pl.p[2];
    for (var i = 0; i < foot.length; i++) {
      var b = foot[i];
      if (b[3] < px - range - 10 || b[0] > px + range + 10 || b[5] < pz - range - 10 || b[2] > pz + range + 10) continue;
      ctx.fillStyle = b[4] < 9 ? '#c4bb84' : '#a29b67';
      ctx.fillRect((b[0] - px) * k, (b[2] - pz) * k, (b[3] - b[0]) * k, (b[5] - b[2]) * k);
      ctx.strokeRect((b[0] - px) * k, (b[2] - pz) * k, (b[3] - b[0]) * k, (b[5] - b[2]) * k);
    }
    // 制圧ゾーン
    var D = G.director;
    if (D.zone && D.active) { ctx.setLineDash([4, 3]); ctx.strokeStyle = '#2a1f15'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((D.zone.p[0] - px) * k, (D.zone.p[2] - pz) * k, D.zone.r * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    // 拾う物
    G.pickups.forEach(function (p) {
      if (p.kind !== 'core') return;
      ctx.fillStyle = '#b9d7a8'; ctx.beginPath(); ctx.arc((p.p[0] - px) * k, (p.p[2] - pz) * k, 4, 0, 6.3); ctx.fill(); ctx.stroke();
    });
    // 敵
    G.enemies.forEach(function (e) {
      if (!e.alive) return;
      var x = (e.p[0] - px) * k, y = (e.p[2] - pz) * k;
      var r = e.type === 'boss' ? 7 : e.type === 'heavy' ? 5 : 3.5;
      if (Math.hypot(x, y) > c - 6) { var a = Math.atan2(y, x); x = Math.cos(a) * (c - 8); y = Math.sin(a) * (c - 8); r = 2.5; }
      ctx.fillStyle = e.marked ? '#b9d7a8' : '#c8392b';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = '#2a1f15'; ctx.stroke();
      if (Math.abs(e.p[1] - pl.p[1]) > 3) { ctx.beginPath(); ctx.moveTo(x - r - 2, y); ctx.lineTo(x + r + 2, y); ctx.stroke(); }
    });
    ctx.restore();
    // 自分(中央の矢印)
    ctx.fillStyle = '#efe6b6'; ctx.strokeStyle = '#2a1f15'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c, c - 9); ctx.lineTo(c + 6, c + 6); ctx.lineTo(c, c + 2); ctx.lineTo(c - 6, c + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // 視界
    ctx.strokeStyle = 'rgba(42,31,21,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c - 40, c - 60); ctx.moveTo(c, c); ctx.lineTo(c + 40, c - 60); ctx.stroke();
  }

  // ---------------- タッチ操作 ----------------
  function setupTouch() {
    var t = $('#touch'), TI = G.touchIn;
    window.addEventListener('touchstart', function () {
      if (G.touch) return;
      G.touch = true;
      document.body.classList.add('touch');
      $('#touch').classList.toggle('hidden', G.state !== 'play');
    }, { passive: true });
    var btns = [
      ['fire', '撃つ', 'right:92px;bottom:88px', 'big', true], ['jump', '跳ぶ', 'right:16px;bottom:96px', '', false], ['melee', '刀', 'right:16px;bottom:22px', '', false],
      ['dash', '駆ける', 'right:96px;bottom:14px', '', false], ['crouch', '屈む', 'right:176px;bottom:22px', '', true], ['reload', '装填', 'right:184px;bottom:100px', '', false],
      ['ads', '覗く', 'right:16px;bottom:170px', '', 'toggle'], ['swap', '替える', 'right:100px;bottom:182px', '', false], ['nade', '投げる', 'right:184px;bottom:178px', '', false],
      ['sprint', '走る', 'left:178px;bottom:24px', '', 'toggle'], ['pause', 'Ⅱ', 'left:12px;top:112px', 'sm', false]
    ];
    t.innerHTML = '<div id="stick"><b></b></div>' + btns.map(function (b) { return '<div class="tb ' + b[3] + '" data-k="' + b[0] + '" style="' + b[2] + '">' + b[1] + '</div>'; }).join('');
    t.querySelectorAll('.tb').forEach(function (el) {
      var k = el.getAttribute('data-k'), def = btns.filter(function (b) { return b[0] === k; })[0];
      el.addEventListener('touchstart', function (e) {
        e.preventDefault(); e.stopPropagation(); S.init();
        if (k === 'pause') { G.pause(); return; }
        if (def[4] === 'toggle') { var v = k === 'ads' ? (TI.ads = !TI.ads) : (TI.sprintToggle = !TI.sprintToggle); el.classList.toggle('on', v); return; }
        if (def[4]) { TI[k] = true; if (k === 'fire') TI.firePressed = true; if (k === 'crouch') TI.crouchPressed = true; el.classList.add('on'); }
        else TI[k] = true;
        // 撃つボタンでも視点を動かせる
        if (k === 'fire') { var tt = e.changedTouches[0]; lookId = tt.identifier; lx = tt.clientX; ly = tt.clientY; }
      }, { passive: false });
      el.addEventListener('touchend', function (e) {
        e.preventDefault();
        if (def[4] === true) { TI[k] = false; if (k === 'fire') TI.fireReleased = true; el.classList.remove('on'); }
      }, { passive: false });
    });
    // 左: 移動スティック、右: 視点
    var stickId = null, sx = 0, sy = 0, lookId = null, lx = 0, ly = 0;
    var canvas = document.getElementById('view');
    canvas.addEventListener('touchstart', function (e) {
      if (G.state !== 'play') return;
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var tt = e.changedTouches[i];
        if (tt.clientX < window.innerWidth * 0.4 && stickId === null) { stickId = tt.identifier; sx = tt.clientX; sy = tt.clientY; }
        else if (lookId === null) { lookId = tt.identifier; lx = tt.clientX; ly = tt.clientY; }
      }
    }, { passive: false });
    window.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var tt = e.changedTouches[i];
        if (tt.identifier === stickId) {
          var dx = M.clamp((tt.clientX - sx) / 50, -1, 1), dy = M.clamp((tt.clientY - sy) / 50, -1, 1);
          TI.mx = dx; TI.mz = -dy;
          $('#stick b').style.transform = 'translate(' + dx * 40 + 'px,' + dy * 40 + 'px)';
        } else if (tt.identifier === lookId) {
          var s = 0.0042 * G.settings.sens;
          TI.lx += (tt.clientX - lx) * s; TI.ly += (tt.clientY - ly) * s;
          lx = tt.clientX; ly = tt.clientY;
        }
      }
    }, { passive: true });
    function end(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var tt = e.changedTouches[i];
        if (tt.identifier === stickId) { stickId = null; TI.mx = TI.mz = 0; $('#stick b').style.transform = ''; }
        if (tt.identifier === lookId) lookId = null;
      }
    }
    window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
  }

  NF.UI = UI;
})();
