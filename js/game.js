/* 霧笛荘事件 — ゲームの進行(文章表示・選択肢・調べる/話す/移動・時間・推理・対決・セーブ) */
(function () {
  'use strict';

  var S = null; // 事件ごとに Scenario.generate で作る
  var $ = function (id) { return document.getElementById(id); };
  var screen = $('screen'), cv = $('cv'), ctx = cv.getContext('2d');
  var pcv = $('pcv'), pctx = pcv.getContext('2d');
  ctx.imageSmoothingEnabled = false; pctx.imageSmoothingEnabled = false;

  var Snd = window.Sound || { unlock: function () {}, bgm: function () {}, ambient: function () {}, se: function () {}, setVolume: function () {}, getVolume: function () { return 1; } };
  var Px = window.Pixel || null;

  // ===== 保存 =====
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できなくても続ける */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* 無視 */ } }
  };
  var SAVE_KEY = 'muteki_save_v2', END_KEY = 'muteki_endings_v2', SET_KEY = 'muteki_settings_v1';
  var settings = store.get(SET_KEY, { bgm: 70, se: 80, ambient: 60, speed: 3 });

  // ===== 状態 =====
  var st = null;
  function newState() {
    return { time: S.START, loc: 'lamproom', flags: {}, clues: {}, clueOrder: [], kws: {}, done: {}, examined: {},
             trust: 0, fired: {}, lastHour: Math.floor(S.START / 60), mode: 'prologue' };
  }
  var view = { scene: 'title', people: [] };
  var busy = false;
  var hover = null;

  // ===== 条件 =====
  function check(c) {
    if (c == null) return true;
    if (typeof c === 'function') return !!c(st);
    if (Array.isArray(c)) return c.every(check);
    var neg = c[0] === '!'; if (neg) c = c.slice(1);
    var kind = c.slice(0, 1), id = c.slice(2), r;
    if (kind === 'c') r = !!st.clues[id];
    else if (kind === 'k') r = !!st.kws[id];
    else if (kind === 'f') r = !!st.flags[id];
    else if (kind === 'd') r = !!st.done[id];
    else r = false;
    return neg ? !r : r;
  }

  // ===== 時刻の表示 =====
  function fmtTime(t) {
    var h = Math.floor(t / 60) % 24, m = t % 60;
    var ampm = h < 12 ? '午前' : '午後';
    var hh = h % 12; if (h === 12) hh = 12;
    return ampm + hh + '時' + (m < 10 ? '0' : '') + m + '分';
  }
  function fmtTimeShort(t) {
    var h = Math.floor(t / 60) % 24, m = t % 60;
    return h + ':' + (m < 10 ? '0' : '') + m;
  }
  function hud() {
    if (!st) return;
    var day = st.time >= 24 * 60 ? '11/15' : '11/14';
    $('hud-time').textContent = day + '  ' + fmtTime(st.time);
    $('hud-time').classList.toggle('warn', st.time >= S.T(29, 0));
    var loc = S.LOCS[st.loc];
    var ppl = peopleAt(st.loc).map(function (id) { return S.CHARS[id].short; });
    $('hud-place').textContent = (loc ? loc.name : '') + (ppl.length ? ' — ' + ppl.join('・') : '');
  }
  function peopleAt(loc) {
    if (!st) return [];
    return S.SUSPECTS.filter(function (id) { return S.whereIs(id, st) === loc; });
  }

  // ===== 描画 =====
  var t0 = performance.now();
  function sceneFlags() {
    if (!st || !S) return {};
    var f = S.sceneFlags(st, view.scene);
    f.stove_out = false;
    return f;
  }
  var lastDraw = 0;
  function frame(now) {
    // ドット絵は 30fps で十分。描く回数を減らして、音の処理に余裕を残す
    if (now - lastDraw < 30) { requestAnimationFrame(frame); return; }
    lastDraw = now;
    var t = (now - t0) / 1000;
    if (Px) {
      try { Px.draw(ctx, view.scene, t, { people: view.people || [], flags: sceneFlags(), hover: hover }); }
      catch (e) { fallbackDraw(); }
    } else fallbackDraw();
    if (curPortrait && Px) {
      try { Px.portrait(pctx, curPortrait.id, curPortrait.expr, t); } catch (e) { /* 無視 */ }
    }
    requestAnimationFrame(frame);
  }
  function fallbackDraw() {
    ctx.fillStyle = '#5f6f6a'; ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#e9eee8'; ctx.font = '10px monospace'; ctx.fillText(view.scene, 8, 16);
  }
  function setView(scene, people) { view = { scene: scene, people: people || [] }; }
  function locView() { setView(st.loc, peopleAt(st.loc)); }

  // ===== 演出 =====
  function fx(kind) {
    var fl = $('flash');
    if (kind === 'red' || kind === 'white') {
      fl.className = ''; void fl.offsetWidth; fl.className = kind;
    } else if (kind === 'shake') {
      screen.classList.remove('shake'); void screen.offsetWidth; screen.classList.add('shake');
    }
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function fadeOut() { $('fade').classList.add('on'); return sleep(500); }
  function fadeIn() { $('fade').classList.remove('on'); return sleep(400); }

  function toast(text, cls) {
    var d = document.createElement('div');
    d.className = 'toast ' + (cls || '');
    d.textContent = text;
    $('toasts').appendChild(d);
    setTimeout(function () { d.remove(); }, 3500);
  }

  // ===== 文章 =====
  var curPortrait = null;
  var waiter = null; // クリック待ちの解決関数
  var typing = null;
  var SPEEDS = [14, 24, 38, 65, 400];

  function parseLine(line) {
    var m = /^@(\w+)(?::(\w+))?\s+([\s\S]*)$/.exec(line);
    if (m) return { who: m[1], expr: m[2] || 'normal', text: m[3] };
    return { who: null, expr: null, text: line };
  }
  function segs(text) {
    // 【】は赤、( )で始まる行は心の声
    var out = [], cls = '';
    var thought = /^[(（]/.test(text);
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '【') { cls = 'em'; continue; }
      if (ch === '】') { cls = ''; continue; }
      out.push({ ch: ch, cls: cls || (thought ? 'thought' : '') });
    }
    return out;
  }
  function showText(line) {
    var p = parseLine(line.replace(/\{time\}/g, st ? fmtTime(st.time) : ''));
    var msg = $('msg'), nameEl = $('msg-name'), textEl = $('msg-text');
    msg.classList.remove('hidden', 'done');
    if (p.who && S.CHARS[p.who]) {
      var c = S.CHARS[p.who];
      nameEl.textContent = p.who === 'me' ? c.short : c.name;
      nameEl.classList.remove('hidden');
      curPortrait = { id: c.portrait, expr: p.expr };
      $('portrait').classList.remove('hidden');
      msg.classList.add('with-portrait');
    } else {
      nameEl.classList.add('hidden');
      curPortrait = null;
      $('portrait').classList.add('hidden');
      msg.classList.remove('with-portrait');
    }
    var list = segs(p.text);
    textEl.innerHTML = '';
    var spans = list.map(function (s) {
      var sp = document.createElement('span');
      sp.textContent = s.ch; if (s.cls) sp.className = s.cls;
      sp.style.visibility = 'hidden';
      textEl.appendChild(sp);
      return sp;
    });
    return new Promise(function (resolve) {
      var i = 0, cps = SPEEDS[(settings.speed || 3) - 1], last = performance.now(), acc = 0, done = false;
      function finish() {
        if (done) return;
        done = true;
        spans.forEach(function (s) { s.style.visibility = 'visible'; });
        if (typing === me) typing = null;
        msg.classList.add('done');
        waiter = function () { waiter = null; resolve(); };
      }
      var me = { skip: finish };
      typing = me;
      function step(now) {
        if (done || typing !== me) return;
        acc += (now - last) / 1000 * cps; last = now;
        var n = Math.floor(acc);
        if (n > 0) {
          acc -= n;
          for (var k = 0; k < n && i < spans.length; k++, i++) {
            spans[i].style.visibility = 'visible';
            if (i % 2 === 0 && list[i].ch.trim() && cps < 300) Snd.se('blip');
          }
        }
        if (i >= spans.length) finish(); else requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  function hideText() {
    $('msg').classList.add('hidden');
    $('portrait').classList.add('hidden');
    curPortrait = null;
  }
  function advance() {
    if (typing) { typing.skip(); return; }
    if (waiter) { Snd.se('cursor'); waiter(); }
  }

  // ===== 選択肢 =====
  function choose(opts) {
    var box = $('choices');
    box.innerHTML = '';
    box.classList.remove('hidden');
    return new Promise(function (resolve) {
      opts.forEach(function (o, i) {
        var b = document.createElement('button');
        b.className = 'choice' + (o.danger ? ' danger' : '');
        b.textContent = o.t;
        b.addEventListener('mouseenter', function () { Snd.se('cursor'); });
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          Snd.se('select');
          box.classList.add('hidden');
          resolve(i);
        });
        box.appendChild(b);
      });
    });
  }

  // ===== 書類 =====
  function showPaper(p) {
    var el = $('paper'), inner = $('paper-inner');
    inner.className = p.cls || '';
    inner.innerHTML = '';
    if (p.title) { var t = document.createElement('span'); t.className = 'ptitle'; t.textContent = p.title; inner.appendChild(t); }
    var body = document.createElement('div');
    // <span class="red"> だけ許可(台本は自前なので安全)
    body.innerHTML = String(p.text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/&lt;span class="red"&gt;/g, '<span class="red">').replace(/&lt;\/span&gt;/g, '</span>');
    inner.appendChild(body);
    inner.scrollTop = 0;
    el.classList.remove('hidden');
    hideText();
    Snd.se('page');
    return new Promise(function (resolve) {
      function close(e) { if (e) e.stopPropagation(); el.removeEventListener('click', close); el.classList.add('hidden'); Snd.se('cancel'); paperClose = null; resolve(); }
      paperClose = close;
      setTimeout(function () { el.addEventListener('click', close); }, 250);
    });
  }
  var paperClose = null;

  function showChapter(c) {
    var el = $('chapter');
    $('chapter-main').textContent = c.main;
    $('chapter-sub').textContent = c.sub || '';
    hideText();
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    Snd.se('clock');
    return sleep(3200).then(function () { el.classList.add('hidden'); });
  }

  // ===== 手がかり =====
  function giveClue(id) {
    if (st.clues[id]) return;
    var c = S.CLUES[id]; if (!c) return;
    st.clues[id] = true; st.clueOrder.push(id);
    Snd.se('clue');
    toast('手帳に記録:「' + c.name + '」', 'clue');
    if (c.kw) giveKw(c.kw, true);
  }
  function giveKw(id, quiet) {
    if (st.kws[id]) return;
    st.kws[id] = true;
    if (!quiet) Snd.se('keyword');
    setTimeout(function () { toast('キーワード:' + S.KW[id].name, 'kw'); }, quiet ? 450 : 0);
  }

  // ===== 台本の実行 =====
  async function run(script) {
    if (typeof script === 'function') script = script(st);
    if (!script) return;
    for (var i = 0; i < script.length; i++) {
      await exec(script[i]);
      if (st && st.ended) return;
    }
  }
  async function exec(L) {
    if (typeof L === 'string') { await showText(L); return; }
    if (typeof L === 'function') { await run(L(st)); return; }
    if (L.bg !== undefined) {
      if (L.bg === '@loc') locView(); else setView(L.bg, L.people);
    }
    if (L.back) locView();
    if (L.goto) { st.loc = L.goto; locView(); applyAmbient(); hud(); }
    if (L.bgm !== undefined) { if (L.bgm === '@resume') resumeBgm(); else Snd.bgm(L.bgm); }
    if (L.amb !== undefined) Snd.ambient(L.amb);
    if (L.se) Snd.se(L.se);
    if (L.fx) fx(L.fx);
    if (L.clue) giveClue(L.clue);
    if (L.kw) giveKw(L.kw);
    if (L.flag) st.flags[L.flag] = true;
    if (L.trust) st.trust += L.trust;
    if (L.trustOf) { var tk = 'trust_' + L.trustOf[0]; st.flags[tk] = (st.flags[tk] || 0) + L.trustOf[1]; }
    if (L.time) { st.time += L.time; hud(); }
    if (L.wait) await sleep(L.wait);
    if (L.paper) await showPaper(L.paper);
    if (L.chapter) await showChapter(L.chapter);
    if (L.run) await run(S.SNIPPETS[L.run]);
    if (L.if !== undefined) await run(check(L.if) ? L.then : L.else);
    if (L.choice) {
      var opts = L.choice.filter(function (o) { return check(o.cond); });
      var keep = curPortrait;
      var i = await choose(opts);
      curPortrait = keep;
      await run(opts[i].s);
    }
  }

  // ===== BGM・環境音 =====
  function locBgm() {
    if (!st) return 'title';
    if (st.time >= S.T(25, 0)) return 'night';
    return 'investigate';
  }
  function resumeBgm() { Snd.bgm(locBgm()); }
  function applyAmbient() { var l = S.LOCS[st.loc]; Snd.ambient(l ? l.amb : 'indoor'); }

  // ===== 捜査パート =====
  function setBusy(b) {
    busy = b;
    Array.prototype.forEach.call(document.querySelectorAll('.cmd'), function (btn) { btn.disabled = b; });
    if (!b) { hideText(); hud(); }
  }
  function save() { if (st && st.mode === 'investigate') store.set(SAVE_KEY, st); }

  async function act(fn) {
    if (busy) return;
    closePanels();
    setBusy(true);
    try {
      await fn();
      await checkEvents();
      if (st.ended) return;
      if (st.time >= S.POLICE && st.mode === 'investigate') { await policeArrive(); return; }
    } finally {
      if (!st.ended && st.mode === 'investigate') { locView(); save(); setBusy(false); }
    }
  }

  function spend(min) {
    st.time = Math.min(S.POLICE, st.time + min);
    hud();
  }

  async function checkEvents() {
    // 毎時の柱時計
    var hr = Math.floor(st.time / 60);
    if (hr > st.lastHour) {
      st.lastHour = hr;
      Snd.se('clock');
      var hh = hr % 24; if (hh === 0) hh = 12; else if (hh > 12) hh -= 12;
      toast('柱時計が' + ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'][hh] + '時を打った', 'time');
    }
    var evs = S.EVENTS.slice().sort(function (a, b) { return (a.at || a.win[0]) - (b.at || b.win[0]); });
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (st.fired[e.id]) continue;
      var go = false;
      if (e.at != null && st.time >= e.at && check(e.cond)) go = true;
      if (e.win && st.loc === e.loc && st.time >= e.win[0] && st.time < e.win[1] && check(e.cond)) go = true;
      if (!go) continue;
      st.fired[e.id] = true;
      await run(e.s);
      locView(); hud();
    }
  }

  async function examine(objId) {
    var ex = (S.EXAMINE[st.loc] || {})[objId];
    if (!ex) return;
    if (ex.move) { await moveTo(ex.move); return; }
    await act(async function () {
      var key = st.loc + '.' + objId;
      var first = !st.examined[key];
      Snd.se('select');
      if (first) spend(S.COST.look);
      st.examined[key] = true;
      await run(first || !ex.again ? ex.s : ex.again);
    });
  }

  async function moveTo(loc) {
    if (loc === st.loc) return;
    await act(async function () {
      var from = st.loc;
      var tower = function (l) { return l === 'lamproom' || l === 'gallery'; };
      var outside = function (l) { return l === 'exterior' || l === 'cliff'; };
      if (tower(from) !== tower(loc) || loc === 'boiler' || from === 'boiler') Snd.se('stairs');
      else if (outside(from) !== outside(loc)) Snd.se('door');
      else Snd.se('footsteps');
      await fadeOut();
      st.loc = loc;
      spend(S.COST.move);
      locView(); applyAmbient(); hud();
      await fadeIn();
      if (loc === 'room4' && st.flags.confined && !st.flags.room4_key) {
        st.flags.room4_key = true;
        await run(['4号室には外から鍵がかけられている。冬子さんから合鍵を借りて、扉を開けた。']);
      }
    });
  }

  async function talkTo(id) {
    if (busy) return;
    var list = (S.TOPICS[id] || []).filter(function (tp) { return check(tp.req); });
    var c = S.CHARS[id];
    openList(c.name + 'に聞く', list.map(function (tp) {
      var isNew = !st.done[tp.id];
      return { label: tp.t, tag: isNew ? '新・' + S.COST.talk + '分' : '済', tagNew: isNew, face: c.portrait,
        onClick: function () { talkTopic(id, tp); } };
    }));
  }
  async function talkTopic(id, tp) {
    var fired = false;
    await act(async function () {
      var first = !st.done[tp.id];
      if (first) spend(S.COST.talk);
      st.done[tp.id] = true;
      setView(st.loc, peopleAt(st.loc));
      var before = Object.keys(st.fired).length;
      await run(tp.s);
      // 話の途中で時刻の出来事が起きたかどうか
      fired = (Object.keys(st.fired).length !== before);
    });
    // 続けて同じ人に話す(その人がまだ同じ場所にいれば)
    if (!st.ended && st.mode === 'investigate' && S.whereIs(id, st) === st.loc) talkTo(id);
  }

  // ===== 一覧パネル =====
  function openList(title, items) {
    var panel = $('panel');
    $('panel-title').textContent = title;
    var list = $('panel-list');
    list.innerHTML = '';
    if (!items.length) {
      var d = document.createElement('div'); d.className = 'item'; d.textContent = '(なし)'; list.appendChild(d);
    }
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.className = 'item' + (it.sub ? ' sub' : '');
      var lhs = document.createElement('span'); lhs.className = 'lhs';
      if (it.face && Px) { var fc = faceCanvas(it.face); fc.className = 'face'; lhs.appendChild(fc); }
      var lb = document.createElement('span'); lb.textContent = it.label; lhs.appendChild(lb);
      b.appendChild(lhs);
      if (it.tag) { var tg = document.createElement('span'); tg.className = 'tag' + (it.tagNew ? ' new' : ''); tg.textContent = it.tag; b.appendChild(tg); }
      b.addEventListener('mouseenter', function () { Snd.se('cursor'); if (it.hover) hover = it.hover; });
      b.addEventListener('mouseleave', function () { if (it.hover) hover = null; });
      b.addEventListener('click', function (e) { e.stopPropagation(); hover = null; it.onClick(); });
      list.appendChild(b);
    });
    panel.classList.remove('hidden');
    Snd.se('open');
  }
  function faceCanvas(id) {
    var c = document.createElement('canvas'); c.width = 96; c.height = 96;
    try { Px.portrait(c.getContext('2d'), id, 'normal', 0); } catch (e) { /* 無視 */ }
    return c;
  }
  function closePanels() {
    ['panel', 'map', 'notebook', 'settings'].forEach(function (id) { $(id).classList.add('hidden'); });
    hover = null;
  }

  function cmdLook() {
    var ex = S.EXAMINE[st.loc] || {};
    openList(S.LOCS[st.loc].name + 'を調べる', Object.keys(ex).map(function (k) {
      var key = st.loc + '.' + k, o = ex[k];
      return { label: o.name, tag: o.move ? '入る・' + S.COST.move + '分' : (st.examined[key] ? '済' : S.COST.look + '分'), tagNew: !o.move && !st.examined[key], hover: k,
        onClick: function () { examine(k); } };
    }));
  }
  function cmdTalk() {
    var ppl = peopleAt(st.loc);
    if (ppl.length === 1) { talkTo(ppl[0]); return; }
    openList('誰に話を聞く?', ppl.map(function (id) {
      var c = S.CHARS[id];
      var n = (S.TOPICS[id] || []).filter(function (tp) { return check(tp.req) && !st.done[tp.id]; }).length;
      return { label: c.name, tag: n ? '新しい話題 ' + n : '', tagNew: n > 0, face: c.portrait, onClick: function () { talkTo(id); } };
    }));
  }
  function cmdMove() {
    var grid = $('map-grid');
    grid.innerHTML = '';
    S.FLOORS.forEach(function (fl) {
      var f = document.createElement('div'); f.className = 'floor'; f.textContent = fl; grid.appendChild(f);
      var rooms = document.createElement('div'); rooms.className = 'rooms';
      Object.keys(S.LOCS).forEach(function (id) {
        var l = S.LOCS[id]; if (l.floor !== fl) return;
        var b = document.createElement('button');
        b.className = 'room' + (id === st.loc ? ' here' : '');
        var ppl = peopleAt(id).map(function (p) { return S.CHARS[p].short; });
        b.innerHTML = '';
        b.appendChild(document.createTextNode(l.name + (l.who ? '(' + l.who + ')' : '')));
        var sm = document.createElement('small'); sm.textContent = id === st.loc ? 'いまここ' : (ppl.length ? ppl.join('・') : '—');
        b.appendChild(sm);
        b.addEventListener('mouseenter', function () { Snd.se('cursor'); });
        b.addEventListener('click', function (e) { e.stopPropagation(); moveTo(id); });
        rooms.appendChild(b);
      });
      grid.appendChild(rooms);
    });
    $('map').classList.remove('hidden');
    Snd.se('open');
  }

  // ===== 手帳 =====
  var nbTab = 'clues', nbPick = null, nbClaim = '';
  function openNotebook(pickMode, claim) {
    nbPick = pickMode || null;
    nbClaim = claim || '';
    $('notebook').classList.remove('hidden');
    $('nb-close').textContent = nbPick ? '証拠が足りない…' : '閉じる';
    Snd.se('open');
    renderNotebook(nbPick ? 'clues' : nbTab);
  }
  function renderNotebook(tab) {
    nbTab = tab;
    Array.prototype.forEach.call(document.querySelectorAll('.nb-tab[data-tab]'), function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
      b.disabled = !!nbPick && b.dataset.tab !== 'clues' && b.dataset.tab !== 'people';
    });
    var list = $('nb-list'), det = $('nb-detail'), foot = $('nb-foot');
    list.innerHTML = ''; det.innerHTML = '';
    foot.className = nbPick ? 'pick' : '';
    var items = [];
    if (tab === 'clues') {
      var total = Object.keys(S.CLUES).length;
      foot.textContent = nbPick ? (nbClaim ? nbClaim + ' ― つきつける証拠を選ぶ' : 'つきつける証拠を選んでください') : '集めた証拠品 ' + st.clueOrder.length + ' / ' + total;
      items = st.clueOrder.slice().reverse().map(function (id) {
        var c = S.CLUES[id];
        return { label: c.name, show: function () {
          var h = document.createElement('h3'); h.textContent = c.name; det.appendChild(h);
          det.appendChild(document.createTextNode(c.desc));
          if (nbPick) {
            var b = document.createElement('button'); b.className = 'pbtn'; b.style.marginTop = '1em'; b.style.display = 'block';
            b.textContent = '▶ これをつきつける';
            b.addEventListener('click', function (e) { e.stopPropagation(); var f = nbPick; nbPick = null; $('notebook').classList.add('hidden'); f(id); });
            det.appendChild(b);
          }
        } };
      });
    } else if (tab === 'people') {
      foot.textContent = '霧笛荘の人びと';
      items = ['haitani'].concat(S.SUSPECTS).map(function (id) {
        var c = S.CHARS[id];
        return { label: c.name, face: c.portrait, show: function () {
          if (Px) { var fc = faceCanvas(c.portrait); fc.className = 'face'; det.appendChild(fc); }
          var h = document.createElement('h3'); h.textContent = c.name; det.appendChild(h);
          var txt = c.prof;
          (c.more || []).forEach(function (m) { if (check(m[0])) txt += '\n\n・' + m[1]; });
          det.appendChild(document.createTextNode(txt));
          var loc = S.whereIs(id, st);
          if (id !== 'haitani' && st.mode === 'investigate') {
            var w = document.createElement('div'); w.className = 'src';
            w.textContent = '\n今いる場所:' + (loc ? S.LOCS[loc].name : (st.flags['dead_' + id] ? '——' : '分からない'));
            det.appendChild(w);
          }
        } };
      });
    } else if (tab === 'words') {
      var owned = Object.keys(S.KW).filter(function (k) { return st.kws[k] && !S.KW[k].decoy; });
      foot.textContent = '推理で使うキーワード ' + owned.length;
      items = owned.map(function (k) {
        return { label: S.KW[k].name, show: function () {
          var h = document.createElement('h3'); h.textContent = S.KW[k].name; det.appendChild(h);
          det.appendChild(document.createTextNode('推理のときに使えることば。'));
        } };
      });
    } else if (tab === 'timeline') {
      foot.textContent = '分かっている出来事';
      list.style.display = 'none';
      var rows = S.TIMELINE.filter(function (r) { return check(r.req); });
      var txt = rows.map(function (r) { return r.t + '  ' + r.s; }).join('\n');
      det.style.gridColumn = '1 / -1';
      det.textContent = txt;
      return;
    }
    list.style.display = ''; det.style.gridColumn = '';
    if (!items.length) det.textContent = '(まだ何もない)';
    items.forEach(function (it, i) {
      var b = document.createElement('button'); b.className = 'item';
      var lhs = document.createElement('span'); lhs.className = 'lhs';
      if (it.face && Px) { var fc = faceCanvas(it.face); fc.className = 'face'; lhs.appendChild(fc); }
      var lb = document.createElement('span'); lb.textContent = it.label; lhs.appendChild(lb);
      b.appendChild(lhs);
      b.addEventListener('click', function (e) {
        e.stopPropagation(); Snd.se('page');
        Array.prototype.forEach.call(list.children, function (x) { x.classList.remove('sel'); });
        b.classList.add('sel'); det.innerHTML = ''; it.show();
      });
      list.appendChild(b);
      if (i === 0) { b.classList.add('sel'); it.show(); }
    });
  }

  // ===== 推理パート =====
  async function cmdSolve() {
    if (busy) return;
    closePanels();
    setBusy(true);
    var i = await choose([
      { t: '推理を始める(捜査は終わりになる)', danger: true },
      { t: 'まだ調べる' }
    ]);
    if (i === 0) { await startFinale(false); return; }
    setBusy(false);
  }

  async function policeArrive() {
    await run([
      { se: 'clock' },
      '柱時計が、六時を打った。',
      { se: 'knock' },
      '玄関で、駐在の巡査の声がした。峠の道が、ようやく通れるようになったらしい。',
      '(時間切れだ。……今、ここで、つかんだものをすべて示すしかない)'
    ]);
    await startFinale(true);
  }

  async function startFinale() {
    st.mode = 'final';
    closePanels();
    $('cmdbar').classList.add('hidden');
    hideText();
    var gaps = 0;
    await run([
      { bgm: null },
      { chapter: { main: '第二章 推理', sub: 'ばらばらの手がかりを、ひとつに' } },
      { bg: 'deduction' }, { amb: null }, { bgm: 'deduction' },
      '(ここまでに集めた手がかりを、ひとつずつ組み立てよう)',
      '【あそびかた】文の空欄に入ることばを選んでください。手がかりが足りないと、推理に「穴」があきます。'
    ]);
    $('hud').classList.add('hidden');
    for (var q = 0; q < S.DEDUCTION.length; q++) {
      var r = await deduceQuestion(S.DEDUCTION[q], q);
      if (r === 'gap') gaps++;
    }
    $('deduce').classList.add('hidden');

    // 全員を集める
    var alive = S.SUSPECTS.filter(function (id) { return !st.flags['dead_' + id]; });
    var dead = S.SUSPECTS.filter(function (id) { return st.flags['dead_' + id]; });
    await run([
      { bgm: null },
      { bg: 'lounge', people: alive.slice(0, 3) }, { amb: 'indoor' },
      '私は、屋敷にいる全員をラウンジに集めた。'
    ].concat(dead.map(function (id) { return '……' + S.CHARS[id].name + 'の姿は、もうない。'; }), [
      '@me ' + S.CHARS.haitani.name + 'さんを殺した犯人が、分かりました。',
      { se: 'heartbeat' },
      '@me 犯人は——'
    ]));
    var names = alive.map(function (id) { return { t: S.CHARS[id].name, id: id }; });
    var pick = await choose(names);
    var who = names[pick].id;
    if (who !== S.CULPRIT) {
      await run([{ bg: 'lounge', people: [who] }].concat(S.WRONG[who], S.BAD_WRONG_TAIL));
      return finishEnding('bad_wrong');
    }
    await run([{ bg: 'lounge', people: [S.CULPRIT] }].concat(S.accuseRight, [
      { chapter: { main: '最終章 対決', sub: '霧の中の、ただひとつの真実' } },
      { bg: 'confront', people: [S.CULPRIT] }, { bgm: 'confront' },
      '【あそびかた】相手の言い分をくずす証拠を、手帳から選んでつきつけてください。まちがえると気力(♥)が減り、なくなると負けです。'
    ]));
    st.hearts = Math.max(1, S.HEARTS - gaps);
    st.maxHearts = S.HEARTS;
    showHearts();
    if (gaps) await run(['(推理に、' + gaps + 'つ穴がある。……そのぶん、気力で押し切るしかない)']);
    for (var k = 0; k < S.CONFRONT.length; k++) {
      var ok = await confrontRound(S.CONFRONT[k]);
      if (!ok) {
        $('hud-hearts').classList.add('hidden');
        await run(S.BAD_FAIL);
        return finishEnding('bad_fail');
      }
    }
    $('hud-hearts').classList.add('hidden');
    var res = S.afterConfront(st);
    await run(res.script);
    return finishEnding(res.id);
  }

  function showHearts() {
    var h = $('hud-hearts');
    h.classList.remove('hidden');
    $('hud').classList.remove('hidden');
    $('hud-time').style.visibility = 'hidden'; $('hud-place').style.visibility = 'hidden';
    h.textContent = '気力 ' + '♥'.repeat(Math.max(0, st.hearts)) + '♡'.repeat(Math.max(0, (st.maxHearts || 5) - st.hearts));
  }

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function deduceQuestion(q, idx) {
    return new Promise(function (resolve) {
      hideText();
      var box = $('deduce'), qEl = $('deduce-q'), opts = $('deduce-opts');
      $('deduce-head').textContent = '推理 ' + (idx + 1) + ' / ' + S.DEDUCTION.length;
      var parts = q.q.split('【＿】');
      qEl.innerHTML = '';
      qEl.appendChild(document.createTextNode(parts[0]));
      var blank = document.createElement('span'); blank.className = 'blank'; blank.textContent = '？'; qEl.appendChild(blank);
      qEl.appendChild(document.createTextNode(parts[1] || ''));
      opts.innerHTML = '';
      var answers = [].concat(q.a);
      var owned = answers.filter(function (a) { return st.kws[a]; });
      var have = owned.length > 0;
      var pool = Object.keys(S.KW).filter(function (k) { return answers.indexOf(k) < 0 && (S.KW[k].decoy || st.kws[k]); });
      var list = shuffle(pool).slice(0, have ? 8 - owned.length : 8);
      list = list.concat(owned);
      list = shuffle(list);
      box.classList.remove('hidden');
      var doneFlag = false;
      list.forEach(function (k) {
        var b = document.createElement('button'); b.className = 'opt'; b.textContent = S.KW[k].name;
        b.addEventListener('mouseenter', function () { Snd.se('cursor'); });
        b.addEventListener('click', async function (e) {
          e.stopPropagation(); if (doneFlag) return;
          if (answers.indexOf(k) >= 0) {
            doneFlag = true;
            Snd.se('correct'); fx('white');
            blank.textContent = S.KW[k].name;
            await sleep(900);
            box.classList.add('hidden');
            await run(q.ok);
            resolve('ok');
          } else {
            Snd.se('wrong'); fx('shake');
            b.classList.add('missed');
          }
        });
        opts.appendChild(b);
      });
      if (!have) {
        var g = document.createElement('button'); g.className = 'opt unknown'; g.textContent = '(……手がかりが足りない)';
        g.addEventListener('click', async function (e) {
          e.stopPropagation(); if (doneFlag) return; doneFlag = true;
          Snd.se('damage'); fx('red');
          blank.textContent = '……';
          await sleep(700);
          box.classList.add('hidden');
          await run(['(……決め手が足りない。この推理には、穴がある)']);
          resolve('gap');
        });
        opts.appendChild(g);
      }
    });
  }

  async function confrontRound(r) {
    if (r.climax) Snd.bgm('climax');
    await run(r.claim);
    while (true) {
      var picked = await new Promise(function (resolve) {
        var last = S.CHARS[S.CULPRIT].short + '「' + r.claim[r.claim.length - 1].replace(/^@\w+(:\w+)?\s+/, '') + '」';
        openNotebook(function (id) { resolve(id); }, last);
        // 「証拠が足りない」ボタン
        $('nb-close').onclick = function (e) { e.stopPropagation(); if (!nbPick) return; nbPick = null; $('notebook').classList.add('hidden'); resolve(null); };
      });
      $('nb-close').onclick = null;
      if (picked && r.a.indexOf(picked) >= 0) {
        Snd.se('present'); fx('shake');
        await run(['@me ' + 'これを見てください。——「' + S.CLUES[picked].name + '」']);
        Snd.se('objection'); fx('white');
        var ok = Array.isArray(r.ok) ? r.ok : (r.ok[picked] || []);
        await run(ok);
        if (r.after) await run(r.after);
        return true;
      }
      st.hearts--;
      Snd.se('damage'); fx('red'); fx('shake');
      showHearts();
      if (picked === null) {
        await run(['(……決め手がない。だが、ここで引くわけにはいかない)']);
        if (st.hearts <= 0) return false;
        await run(S.gapLines);
        if (r.after) await run(r.after);
        return true;
      }
      await run([S.rebuttals[Math.floor(Math.random() * S.rebuttals.length)]]);
      if (st.hearts <= 0) return false;
      await run(['(ちがう。……ほかの証拠だ)']);
    }
  }

  // ===== エンディング =====
  var ENDING_KINDS = [
    ['true', 'TRUE END', 'すべての真相にたどりついた'],
    ['normal_dead', 'NORMAL END', '犯人は捕まえたが、第二の犠牲が出た'],
    ['normal_alive', 'NORMAL END', '犯人は捕まえたが、過去の真相は霧の中'],
    ['bad_wrong', 'BAD END', '犯人をまちがえた'],
    ['bad_fail', 'BAD END', '犯人に言い逃れられた']
  ];
  async function finishEnding(id) {
    st.ended = true;
    hideText();
    var got = store.get(END_KEY, { kinds: {}, cases: 0, solved: 0 });
    got.kinds[id] = (got.kinds[id] || 0) + 1;
    got.cases++; if (id.indexOf('bad') !== 0) got.solved++;
    store.set(END_KEY, got);
    var e = S.ENDINGS[id];
    var card = document.createElement('div');
    card.id = 'endcard';
    var total = Object.keys(S.CLUES).length;
    card.innerHTML = '<div class="ek"></div><div class="en"></div><div class="es"></div><div class="eb"></div>';
    card.querySelector('.ek').textContent = '事件番号 ' + S.caseNo + ' ・ ' + e.kind;
    card.querySelector('.en').textContent = '「' + e.name + '」';
    card.querySelector('.es').textContent =
      '集めた証拠品 ' + st.clueOrder.length + ' / ' + total + '\n' +
      '推理を始めた時刻 ' + fmtTime(Math.min(st.time, S.POLICE)) + '\n' +
      'これまでに解いた事件 ' + got.solved + ' / ' + got.cases +
      (id.indexOf('bad') === 0 ? '\n\n「つづきから」で、推理の直前からやり直せます。' : '');
    function btn(label, fn) {
      var b = document.createElement('button'); b.className = 'pbtn'; b.textContent = label;
      b.addEventListener('click', function (ev) { ev.stopPropagation(); Snd.se('select'); fn(); });
      card.querySelector('.eb').appendChild(b);
    }
    btn('事件の真相を見る', function () {
      showPaper({ title: '事件番号 ' + S.caseNo + ' の真相', text: S.summary.join('\n\n'), cls: 'clip' });
    });
    btn('タイトルへ', function () { card.remove(); toTitle(); });
    screen.appendChild(card);
    Snd.se(id.indexOf('bad') === 0 ? 'wrong' : 'clue');
  }

  // ===== タイトル =====
  function toTitle() {
    closePanels(); hideText();
    $('cmdbar').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('hud-hearts').classList.add('hidden');
    $('hud-time').style.visibility = ''; $('hud-place').style.visibility = '';
    $('deduce').classList.add('hidden');
    $('choices').classList.add('hidden');
    st = null; busy = false;
    setView('title', []);
    $('title').classList.remove('hidden');
    $('title-press').classList.add('hidden');
    $('title-menu').classList.remove('hidden');
    $('t-cont').disabled = !store.get(SAVE_KEY, null);
    Snd.bgm('title'); Snd.ambient('rain');
  }

  function applyLooks() {
    if (!Px || !Px.setLook || !S.LOOKS) return;
    Object.keys(S.LOOKS).forEach(function (id) { try { Px.setLook(id, S.LOOKS[id]); } catch (e) { /* 無視 */ } });
  }
  async function newGame(cfg) {
    S = window.Scenario.generate(cfg);
    applyLooks();
    st = newState();
    st.cfg = cfg;
    store.del(SAVE_KEY);
    $('title').classList.add('hidden');
    $('setup').classList.add('hidden');
    $('cmdbar').classList.add('hidden');
    setBusy(true);
    await run(S.PROLOGUE);
    st.mode = 'investigate';
    beginInvestigation();
  }
  function beginInvestigation() {
    $('hud').classList.remove('hidden');
    $('cmdbar').classList.remove('hidden');
    Array.prototype.forEach.call(document.querySelectorAll('.cmd'), function (b) {
      var i = b.querySelector('i'), c = b.dataset.cmd;
      if (c === 'look') i.textContent = S.COST.look + '分';
      if (c === 'talk') i.textContent = S.COST.talk + '分';
      if (c === 'move') i.textContent = S.COST.move + '分';
    });
    $('map-title').querySelector('span').textContent = '(1回 ' + S.COST.move + '分)';
    locView(); applyAmbient(); resumeBgm(); hud(); save();
    setBusy(false);
  }
  function continueGame() {
    var s = store.get(SAVE_KEY, null);
    if (!s || !s.cfg) return;
    S = window.Scenario.generate(s.cfg);
    applyLooks();
    st = s; st.ended = false;
    $('title').classList.add('hidden');
    beginInvestigation();
    toast('つづきから:事件番号 ' + S.caseNo + '・' + fmtTime(st.time), 'time');
  }
  function showEndings() {
    var got = store.get(END_KEY, { kinds: {}, cases: 0, solved: 0 });
    var items = ENDING_KINDS.map(function (k) {
      var n = got.kinds[k[0]] || 0;
      return { label: n ? k[1] + ' ― ' + k[2] : '??????', tag: n ? n + '回' : '', onClick: function () {} };
    });
    items.push({ label: 'これまでに解いた事件 ' + got.solved + ' / ' + got.cases, tag: '', onClick: function () {} });
    openList('エンディングの記録', items);
  }

  // ===== 事件の準備(人物設定) =====
  var SC = window.Scenario;
  var setupCfg = null;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function input(val, onInput, cls) {
    var i = el('input', cls || 'su-in'); i.type = 'text'; i.value = val; i.maxLength = 6;
    i.addEventListener('input', function () { onInput(i.value.trim()); });
    i.addEventListener('keydown', function (e) { e.stopPropagation(); });
    return i;
  }
  function select(opts, val, onChange) {
    var sl = el('select', 'su-sel');
    opts.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; if (o[0] === val) op.selected = true; sl.appendChild(op); });
    sl.addEventListener('change', function () { onChange(sl.value); });
    return sl;
  }
  function openSetup() {
    setupCfg = SC.defaults();
    renderSetup();
    $('title').classList.add('hidden');
    $('setup').classList.remove('hidden');
    $('setup-body').scrollTop = 0;
    Snd.se('open');
  }
  function renderSetup() {
    var c = setupCfg, body = $('setup-body');
    body.innerHTML = '';
    // 事件
    var sec = el('div', 'su-sec');
    sec.appendChild(el('div', 'su-h', '事件'));
    var row = el('div', 'su-row');
    row.appendChild(el('label', null, '事件番号'));
    var seedIn = input(String(c.seed), function (v) { var n = parseInt(v.replace(/\D/g, ''), 10); if (n) c.seed = n; }, 'su-in seed');
    seedIn.maxLength = 9; seedIn.inputMode = 'numeric';
    row.appendChild(seedIn);
    var dice = el('button', 'su-dice', '🎲'); dice.title = '別の事件番号';
    dice.addEventListener('click', function () { c.seed = Math.floor(Math.random() * 900000) + 100000; seedIn.value = c.seed; Snd.se('cursor'); });
    row.appendChild(dice);
    sec.appendChild(row);
    row = el('div', 'su-row');
    row.appendChild(el('label', null, '難しさ'));
    row.appendChild(select(Object.keys(SC.DIFF).map(function (k) { return [k, SC.DIFF[k].name + '(気力' + SC.DIFF[k].hearts + '・話す' + SC.DIFF[k].cost.talk + '分)']; }), c.diff, function (v) { c.diff = v; }));
    sec.appendChild(row);
    row = el('div', 'su-row');
    row.appendChild(el('label', null, '第二の事件'));
    row.appendChild(select([['1', 'あり(夜中に、もうひとり狙われる)'], ['0', 'なし']], c.second ? '1' : '0', function (v) { c.second = v === '1'; }));
    sec.appendChild(row);
    sec.appendChild(el('p', 'su-note', '犯人・動機・トリック・目撃者・夜の出来事は、事件番号から自動で組み立てられます。同じ番号なら同じ事件、ちがう番号ならちがう事件になります。犯人は、あなたにも分かりません。'));
    body.appendChild(sec);

    // 探偵と被害者
    sec = el('div', 'su-sec');
    sec.appendChild(el('div', 'su-h', '探偵と依頼人'));
    row = el('div', 'su-row');
    row.appendChild(el('label', null, '探偵(あなた)'));
    row.appendChild(input(c.det.sei, function (v) { c.det.sei = v || '烏丸'; }));
    row.appendChild(input(c.det.mei, function (v) { c.det.mei = v || '透'; }));
    row.appendChild(select([['M', '男性'], ['F', '女性']], c.det.gender || 'M', function (v) { c.det.gender = v; }));
    var dAge = input(String(c.det.age || 38), function (v) { var n = parseInt(v.replace(/\D/g, ''), 10); if (n) c.det.age = Math.max(20, Math.min(80, n)); }, 'su-in age');
    dAge.inputMode = 'numeric'; dAge.maxLength = 2;
    row.appendChild(dAge); row.appendChild(el('span', 'su-fixed', '歳'));
    sec.appendChild(row);
    row = el('div', 'su-row');
    row.appendChild(el('label', null, '依頼人(被害者)'));
    var vSei = input(c.victim.sei, function (v) { c.victim.sei = v || '灰谷'; c.cast.fuyuko.sei = c.victim.sei; famSei.value = c.victim.sei; });
    row.appendChild(vSei);
    row.appendChild(input(c.victim.mei, function (v) { c.victim.mei = v || '宗一郎'; }));
    sec.appendChild(row);
    body.appendChild(sec);

    // 5人
    sec = el('div', 'su-sec');
    sec.appendChild(el('div', 'su-h', '霧笛荘の人びと'));
    var grid = el('div', 'su-cards');
    var famSei = null;
    SC.IDS.forEach(function (id) {
      var L = SC.LOOKS[id], p = c.cast[id];
      var card = el('div', 'su-card');
      var face = document.createElement('canvas'); face.width = 96; face.height = 96; face.className = 'su-face';
      function redraw() {
        try { if (Px.setLook) Px.setLook(id, { gender: p.gender, age: p.age }); Px.portrait(face.getContext('2d'), id, 'normal', 0); } catch (e) { /* 無視 */ }
      }
      redraw();
      card.appendChild(face);
      var info = el('div', 'su-info');
      info.appendChild(el('div', 'su-look', L.label + ' ・ ' + L.look));
      var nm = el('div', 'su-name');
      var seiIn = input(p.sei, function (v) { p.sei = v || p.sei; });
      if (id === 'fuyuko') { seiIn.disabled = true; seiIn.title = '依頼人と同じ名字'; famSei = seiIn; }
      var meiIn = input(p.mei, function (v) { p.mei = v || p.mei; });
      nm.appendChild(seiIn); nm.appendChild(meiIn);
      var rnd = el('button', 'su-dice', '🎲'); rnd.title = '名前をランダムに';
      rnd.addEventListener('click', function () {
        var n = SC.randomName(p.gender, null, p.age);
        if (id !== 'fuyuko') { p.sei = n.sei; seiIn.value = n.sei; }
        p.mei = n.mei; meiIn.value = n.mei; Snd.se('cursor');
      });
      nm.appendChild(rnd);
      info.appendChild(nm);
      // 性別と年齢
      var r1 = el('div', 'su-row2');
      r1.appendChild(select([['M', '男性'], ['F', '女性']], p.gender, function (v) {
        p.gender = v;
        if (L.role === 'family' && (!SC.RELS[p.rel] || SC.RELS[p.rel].g !== v)) p.rel = SC.relsFor(v)[0];
        p.age = SC.clampAge(id, p.age, L.role === 'family' ? p.rel : null);
        renderSetup();
      }));
      var ageIn = input(String(p.age), function (v) { var n = parseInt(v.replace(/\D/g, ''), 10); if (n) { p.age = n; } }, 'su-in age');
      ageIn.inputMode = 'numeric'; ageIn.maxLength = 2;
      ageIn.addEventListener('change', function () {
        p.age = SC.clampAge(id, p.age, L.role === 'family' ? p.rel : null);
        ageIn.value = p.age; redraw();
      });
      r1.appendChild(ageIn);
      r1.appendChild(el('span', 'su-fixed', '歳(' + L.minAge + '〜' + L.maxAge + ')'));
      info.appendChild(r1);
      var r2 = el('div', 'su-row2');
      if (L.role === 'guest') {
        r2.appendChild(select(Object.keys(SC.OCC).map(function (k) { return [k, SC.OCC[k].name]; }), p.occ, function (v) {
          // 職業はかぶらないようにする(かぶったら入れかえ)
          var other = SC.IDS.filter(function (x) { return x !== id && c.cast[x].occ === v; })[0];
          if (other) c.cast[other].occ = p.occ;
          p.occ = v;
          renderSetup();
        }));
      } else if (L.role === 'family') {
        r2.appendChild(select(SC.relsFor(p.gender).map(function (k) { var R = SC.RELS[k]; return [k, '依頼人の' + R.name + '(' + R.min + '〜' + R.max + '歳)']; }), p.rel, function (v) {
          p.rel = v; p.age = SC.clampAge(id, p.age, v); renderSetup();
        }));
      } else {
        r2.appendChild(el('span', 'su-fixed', '元灯台守の下働き'));
      }
      r2.appendChild(select(Object.keys(SC.PERS).map(function (k) { return [k, '性格:' + SC.PERS[k].name]; }), p.pers, function (v) { p.pers = v; }));
      info.appendChild(r2);
      card.appendChild(info);
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    sec.appendChild(el('p', 'su-note', '性格で話し方が変わります(穏やか・神経質=ていねい、気さく・気難しい=くだけた話し方)。職業によって、持ち物や部屋の様子、事件にかかわる手がかりが変わります。'));
    body.appendChild(sec);
  }
  $('setup-back').addEventListener('click', function (e) { e.stopPropagation(); Snd.se('cancel'); $('setup').classList.add('hidden'); $('title').classList.remove('hidden'); });
  $('setup-random').addEventListener('click', function (e) { e.stopPropagation(); Snd.se('select'); setupCfg = SC.defaults(); var keep = setupCfg; keep.cast.shibasaki.occ = 'doctor';
    // おまかせ:職業と性格もランダムにする
    var occs = Object.keys(SC.OCC).sort(function () { return Math.random() - 0.5; });
    ['shibasaki', 'chikage', 'naruse'].forEach(function (g, i) { keep.cast[g].occ = occs[i]; });
    SC.IDS.forEach(function (id) { var ks = Object.keys(SC.PERS); keep.cast[id].pers = ks[Math.floor(Math.random() * ks.length)]; });
    SC.IDS.forEach(function (id) {
      var L = SC.LOOKS[id], p = keep.cast[id];
      if (Math.random() < 0.35) p.gender = p.gender === 'M' ? 'F' : 'M';
      p.age = L.minAge + Math.floor(Math.random() * (L.maxAge - L.minAge + 1));
      if (id === 'fuyuko') { var rs = SC.relsFor(p.gender); p.rel = rs[Math.floor(Math.random() * rs.length)]; }
      p.age = SC.clampAge(id, p.age, id === 'fuyuko' ? p.rel : null);
      var n = SC.randomName(p.gender, null, p.age);
      if (id !== 'fuyuko') p.sei = n.sei;
      p.mei = n.mei;
    });
    renderSetup(); });
  $('setup-go').addEventListener('click', function (e) { e.stopPropagation(); Snd.se('select'); newGame(setupCfg); });

  // ===== 設定 =====
  function openSettings() {
    ['bgm', 'se', 'ambient'].forEach(function (k) { $('vol-' + k).value = settings[k]; });
    $('text-speed').value = settings.speed;
    $('set-title').classList.toggle('hidden', !st);
    $('settings').classList.remove('hidden');
    Snd.se('open');
  }
  function applySettings() {
    ['bgm', 'se', 'ambient'].forEach(function (k) { Snd.setVolume(k, settings[k] / 100); });
  }
  ['bgm', 'se', 'ambient'].forEach(function (k) {
    $('vol-' + k).addEventListener('input', function (e) { settings[k] = +e.target.value; applySettings(); store.set(SET_KEY, settings); });
  });
  $('vol-se').addEventListener('change', function () { Snd.se('select'); });
  $('text-speed').addEventListener('input', function (e) { settings.speed = +e.target.value; store.set(SET_KEY, settings); });
  $('set-close').addEventListener('click', function (e) { e.stopPropagation(); $('settings').classList.add('hidden'); Snd.se('cancel'); });
  $('set-title').addEventListener('click', function (e) {
    e.stopPropagation(); $('settings').classList.add('hidden');
    if (st && st.mode === 'investigate') save();
    var card = $('endcard'); if (card) card.remove();
    toTitle();
  });

  // ===== 入力 =====
  function canvasPos(e) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * 320, y: (e.clientY - r.top) / r.height * 180 };
  }
  function spotAt(p) {
    if (!Px || !st || st.mode !== 'investigate') return null;
    var spots = (Px.hotspots || {})[st.loc] || {};
    var ex = S.EXAMINE[st.loc] || {};
    var people = Px.personSpots ? Px.personSpots(st.loc, peopleAt(st.loc)) : {};
    var hit = null;
    Object.keys(people).forEach(function (id) {
      var s = people[id]; if (p.x >= s[0] && p.x < s[0] + s[2] && p.y >= s[1] && p.y < s[1] + s[3]) hit = { person: id };
    });
    if (hit) return hit;
    Object.keys(spots).forEach(function (id) {
      if (!ex[id]) return;
      var s = spots[id]; if (p.x >= s[0] && p.x < s[0] + s[2] && p.y >= s[1] && p.y < s[1] + s[3]) {
        if (!hit || s[2] * s[3] < hit.area) hit = { obj: id, area: s[2] * s[3] };
      }
    });
    return hit;
  }
  cv.addEventListener('mousemove', function (e) {
    if (busy || !st || st.mode !== 'investigate' || !$('panel').classList.contains('hidden')) { cv.classList.remove('pointer'); return; }
    var h = spotAt(canvasPos(e));
    var nh = h ? (h.obj || null) : null;
    if (nh !== hover && nh) Snd.se('cursor');
    hover = nh;
    cv.classList.toggle('pointer', !!h);
  });
  cv.addEventListener('mouseleave', function () { if (!busy) hover = null; });

  screen.addEventListener('click', function (e) {
    Snd.unlock();
    if (!$('settings').classList.contains('hidden')) return;
    if (paperClose) return;
    if (!$('msg').classList.contains('hidden') && (typing || waiter)) { advance(); return; }
    if (e.target === cv && st && st.mode === 'investigate' && !busy) {
      if (!$('panel').classList.contains('hidden') || !$('map').classList.contains('hidden') || !$('notebook').classList.contains('hidden')) { closePanels(); return; }
      var h = spotAt(canvasPos(e));
      if (h && h.person) talkTo(h.person);
      else if (h && h.obj) examine(h.obj);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') {
      if (paperClose) { paperClose(); e.preventDefault(); return; }
      if (!$('msg').classList.contains('hidden')) { advance(); e.preventDefault(); }
    } else if (e.key === 'Escape') {
      if (!busy) { closePanels(); }
    }
  });

  $('panel-close').addEventListener('click', function (e) { e.stopPropagation(); closePanels(); Snd.se('cancel'); });
  $('map-close').addEventListener('click', function (e) { e.stopPropagation(); closePanels(); Snd.se('cancel'); });
  Array.prototype.forEach.call(document.querySelectorAll('.nb-tab[data-tab]'), function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); Snd.se('page'); renderNotebook(b.dataset.tab); });
  });
  $('nb-close').addEventListener('click', function (e) {
    e.stopPropagation();
    if (nbPick) return; // 対決中は別の処理(confrontRound が上書き)
    $('notebook').classList.add('hidden'); Snd.se('cancel');
  });

  Array.prototype.forEach.call(document.querySelectorAll('.cmd'), function (b) {
    b.addEventListener('mouseenter', function () { if (!b.disabled) Snd.se('cursor'); });
    b.addEventListener('click', function (e) {
      e.stopPropagation(); Snd.unlock();
      var c = b.dataset.cmd;
      if (c === 'settings') { openSettings(); return; }
      if (busy || !st) return;
      var wasOpen = { look: !$('panel').classList.contains('hidden') && lastCmd === 'look', talk: !$('panel').classList.contains('hidden') && lastCmd === 'talk', move: !$('map').classList.contains('hidden'), note: !$('notebook').classList.contains('hidden') };
      closePanels();
      if (wasOpen[c]) { Snd.se('cancel'); return; }
      lastCmd = c;
      if (c === 'look') cmdLook();
      else if (c === 'talk') { if (peopleAt(st.loc).length) cmdTalk(); else toast('ここには誰もいない', 'time'); }
      else if (c === 'move') cmdMove();
      else if (c === 'note') openNotebook();
      else if (c === 'solve') cmdSolve();
    });
  });
  var lastCmd = null;

  // タイトル
  $('title').addEventListener('click', function (e) {
    Snd.unlock();
    if (!$('title-menu').classList.contains('hidden')) return;
    e.stopPropagation();
    Snd.se('select');
    applySettings();
    Snd.bgm('title'); Snd.ambient('rain');
    $('title-press').classList.add('hidden');
    $('title-menu').classList.remove('hidden');
    $('t-cont').disabled = !store.get(SAVE_KEY, null);
  });
  $('t-new').addEventListener('click', function (e) { e.stopPropagation(); Snd.se('select'); openSetup(); });
  $('t-cont').addEventListener('click', function (e) { e.stopPropagation(); Snd.se('select'); continueGame(); });
  $('t-end').addEventListener('click', function (e) { e.stopPropagation(); showEndings(); });
  $('t-quick').addEventListener('click', function (e) { e.stopPropagation(); Snd.se('select'); setupCfg = SC.defaults(); $('setup-random').click(); newGame(setupCfg); });
  $('t-set').addEventListener('click', function (e) { e.stopPropagation(); openSettings(); });
  ['t-new', 't-quick', 't-cont', 't-end', 't-set'].forEach(function (id) { $(id).addEventListener('mouseenter', function () { Snd.se('cursor'); }); });

  // 開始
  applySettings();
  setView('title', []);
  requestAnimationFrame(frame);

  // テスト用(ブラウザのコンソールから状態を見る)
  window.__game = { get st() { return st; }, get S() { return S; }, newGame: newGame, talkTopic: talkTopic, run: run, startFinale: startFinale, moveTo: moveTo, examine: examine };
})();
