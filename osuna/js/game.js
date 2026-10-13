/* game.js — 押すな。の進行
   ・何もしなければ倍率が上がる。画面下の帯から上へスワイプで利確(受け取って終了)
   ・出てくる誘惑を押したら全損。本物のボーナスだけは押すと ×3
   ・ヒビが入ったら数秒以内に利確しないと全損 */
(function () {
  'use strict';
  const W = 360, H = 640, LANE_Y = 584;
  const $ = id => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = n => Math.floor(n).toLocaleString('ja-JP');
  const fmtM = m => m < 100 ? m.toFixed(2) : m < 1000 ? m.toFixed(1) : String(Math.floor(m));
  const MS = [2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];   // 倍率の節目
  const WHO = ['タヌ吉', 'ミケ子', '隣のおっちゃん', 'ナニワの虎', '元カレ'];

  // ---------- 誘惑とルールの一覧 ----------
  const TEMPT = {
    hype:    { name: '煽り', desc: '「今タップで×10!」と急かしてくる。', w: 200, h: 72, life: 2.6, se: 'hype' },
    clear:   { name: 'ニセ大当り', desc: '終わったように見せかける。まだ終わっていない。', w: 260, h: 120, life: 2.4, se: 'fanfare' },
    coin:    { name: '落ちるメダル', desc: '思わず触りたくなる。', w: 48, h: 48, life: 2.4, se: 'coin' },
    bonus:   { name: 'ニセボーナス', desc: '本物そっくり。見分けは「前兆」。', w: 92, h: 92, life: 1.3, se: 'fakeChime' },
    phone:   { name: '着信', desc: '棚の横のケータイが鳴る。出たら負け。', w: 56, h: 100, life: 3.0, se: 'ring' },
    error:   { name: 'ニセ通信エラー', desc: '「再接続」はワナ。ゲームの演出です。', w: 236, h: 118, life: 2.8, se: 'error' },
    notify:  { name: 'あおり通知', desc: '「抜かれた!」に反応しない。', w: 250, h: 60, life: 2.4, se: 'notify' },
    under:   { name: '指の下のボタン', desc: '最後に触った場所に出てくる。', w: 110, h: 50, life: 1.6, se: 'click' },
    capsule: { name: '無料ガチャ', desc: 'タダより高いものはない。', w: 120, h: 166, life: 2.6, se: 'gacha' },
    dice:    { name: 'ゾロ目チャンス', desc: '止めなくていい。', w: 184, h: 92, life: 2.4, se: 'dice' },
    silence: { name: '静寂', desc: '音も絵も止まって画面が白くなる。待てば戻る。' },
    resume:  { name: '再開ボタン', w: 170, h: 44, life: 9 }
  };
  const RULES = {
    A: { name: '前兆', desc: '本物は「チリン」と鳴って窓のネオン「大当り」が光ったすぐあとに、音なしで出る。音と同時に出るのは偽物。' },
    B: { name: '上半分', desc: '本物は画面の上半分(窓のあたり)にしか出ない。' },
    L: { name: '下半分', desc: '今日の本物は画面の下半分にしか出ない。' },
    C: { name: '脈打つ輪', desc: '本物は外側の輪がドクドク脈打つ。' },
    S: { name: '傾き', desc: '今日の本物は少し右に傾いている。' },
    F: { name: '偽の前兆', desc: '前兆のあと、ひと呼吸以上おいて出るのは偽物(出るときにも音が鳴る)。' }
  };
  const BASICS = [
    { k: 'base', name: '待つ', desc: '何もしなければ倍率が上がる。10秒で×2、30秒で×10、60秒で×50。' },
    { k: 'base', name: '利確', desc: '画面下の帯に指を置いて上へスワイプ。その倍率で受け取って終了(パソコンは ↑キー)。' },
    { k: 'base', name: 'ヒビ', desc: 'ヒビが入ったら数秒以内に利確。間に合わないと全損。' },
    { k: 'base', name: '押すな', desc: '出てくるものを押したら全損。ただし本物のボーナスだけは押すと ×3。何もない所は押しても平気。' }
  ];
  const ALLT = ['hype', 'clear', 'coin', 'bonus', 'phone', 'error', 'notify', 'under', 'capsule', 'dice'];
  // ステージ:target=クリアに必要な倍率 grace=ヒビの猶予(秒) haz=ヒビの来やすさ win=本物を押せる時間(秒)
  const STAGES = [
    { target: 2,  types: ['hype', 'clear', 'coin'], rules: ['A'], grace: 3.0, haz: 0.0011, win: 1.15 },
    { target: 3,  types: ['hype', 'clear', 'coin', 'bonus'], rules: ['A'], grace: 3.0, haz: 0.0012, win: 1.05 },
    { target: 4,  types: ['hype', 'clear', 'coin', 'bonus', 'phone'], rules: ['A'], grace: 3.0, haz: 0.0013, win: 1.0, silence: true },
    { target: 5,  types: ['hype', 'clear', 'coin', 'bonus', 'phone', 'error'], rules: ['A', 'B'], grace: 2.8, haz: 0.0013, win: 0.95, silence: true },
    { target: 6,  types: ['hype', 'clear', 'coin', 'bonus', 'phone', 'error', 'notify', 'under'], rules: ['A', 'B'], grace: 2.8, haz: 0.0014, win: 0.9, silence: true },
    { target: 8,  types: ['hype', 'clear', 'coin', 'bonus', 'phone', 'error', 'notify', 'under', 'capsule'], rules: ['A', 'B'], grace: 2.7, haz: 0.0015, win: 0.9, silence: true },
    { target: 10, types: ALLT, rules: ['A', 'B', 'C'], grace: 2.6, haz: 0.0015, win: 0.9, silence: true },
    { target: 12, types: ALLT, rules: ['A', 'B', 'C', 'F'], grace: 2.5, haz: 0.0016, win: 0.85, silence: true },
    { target: 15, types: ALLT, rules: ['A', 'B', 'C', 'F'], grace: 2.3, haz: 0.0017, win: 0.85, silence: true },
    { target: 20, types: ALLT, rules: ['A', 'B', 'C', 'F'], grace: 2.0, haz: 0.0018, win: 0.8, silence: true }
  ];
  function dailyCfg() {
    const r = Ink.rng(todaySeed() * 7 + 3);
    const rule = ['B', 'L', 'C', 'S'][Math.floor(r() * 4)];
    return { target: 0, types: ALLT, rules: ['A', rule, 'F'], grace: 2.5, haz: 0.0015, win: 0.9, silence: true, rule };
  }

  // ---------- セーブ(ブラウザに保存。消えても遊べる) ----------
  const KEY = 'osuna.save.v1';
  const DEF = {
    coins: 500, bet: 50, betAll: false, cleared: 0, rounds: 0,
    rec: { hold: 0, mult: 0, pay: 0, real: 0 },
    daily: { date: '', played: false, best: 0, prac: false },
    set: { sound: true, vib: true, calm: false },
    adFree: false, themes: ['sepia'], theme: 'sepia',
    bonusDate: '', warned: false, offered: false, seen: {}, interAt: 0
  };
  function merge(a, b) {
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  function fresh() { return JSON.parse(JSON.stringify(DEF)); }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return merge(fresh(), JSON.parse(raw)); } catch (e) { /* 保存が使えない環境 */ }
    return fresh();
  }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 無視 */ } }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todaySeed() { return parseInt(today().replace(/-/g, ''), 10); }
  function dailyState() {
    if (S.daily.date !== today()) S.daily = { date: today(), played: false, best: 0, prac: false };
    return S.daily;
  }
  function crand() {
    try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return Math.random(); }
  }
  function vib(p) { if (S.set.vib && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* 非対応 */ } } }

  // ---------- 倍率の伸び方 ----------
  // 10秒で×2、30秒で×10、60秒で×50。その先も同じ勢いで伸びる
  const CURVE = [[0, 0], [10, Math.log(2)], [30, Math.log(10)], [60, Math.log(50)]];
  const SLOPE_END = Math.log(5) / 30;
  function baseM(t) {
    if (t >= 60) return Math.exp(CURVE[3][1] + (t - 60) * SLOPE_END);
    for (let i = 1; i < CURVE.length; i++) {
      if (t <= CURVE[i][0]) {
        const a = CURVE[i - 1], b = CURVE[i];
        return Math.exp(a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]));
      }
    }
    return 1;
  }
  function invBase(m) {
    const l = Math.log(Math.max(1, m));
    if (l >= CURVE[3][1]) return 60 + (l - CURVE[3][1]) / SLOPE_END;
    for (let i = 1; i < CURVE.length; i++) {
      if (l <= CURVE[i][1]) { const a = CURVE[i - 1], b = CURVE[i]; return a[0] + (l - a[1]) / (b[1] - a[1]) * (b[0] - a[0]); }
    }
    return 0;
  }
  function curM() { return Math.min(9999, baseM(R.t) * R.factor); }

  // ---------- 状態 ----------
  let mode = 'menu';         // menu / ready / play / outro / dying
  let R = null;              // いまの勝負
  let clock = 0, last = 0, K = 1, bgs = [];
  let lastPtr = { x: W / 2, y: 470 };
  const ptrs = new Set();
  let selStage = 1, nextHint = false, held = 0, D = null;
  const fx = { parts: [], pops: [], ripples: [], shake: 0, flash: 0, flashRed: false };

  // ---------- 画面の大きさ合わせ ----------
  function fit() {
    const app = $('app'), aw = app.clientWidth, ah = app.clientHeight;
    const s = Math.min(aw / W, ah / H);
    $('stage').style.transform = 'translate(' + ((aw - W * s) / 2) + 'px,' + ((ah - H * s) / 2) + 'px) scale(' + s + ')';
    K = s * Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(W * K); cv.height = Math.round(H * K);
    buildBg();
  }
  function buildBg() {
    bgs = [0, 1, 2].map(v => {
      const c = document.createElement('canvas');
      c.width = cv.width; c.height = cv.height;
      const g = c.getContext('2d');
      g.setTransform(K, 0, 0, K, 0, 0);
      Ink.room(g, v);
      return c;
    });
    Ink.prepare(ctx);
  }
  function applyTheme() {
    Ink.setTheme(S.theme);
    const P = Ink.P, st = document.documentElement.style;
    ['paper', 'wall', 'mid', 'shade', 'ink', 'night', 'glow', 'red'].forEach(k => st.setProperty('--' + k, P[k]));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', P.ink);
  }

  // ---------- 勝負の準備 ----------
  function newRound(kind, stage, bet) {
    const cfg = kind === 'stage' ? STAGES[stage - 1] : dailyCfg();
    // デイリーと練習は日付から作るので、全員同じ配置になる
    const seed = kind === 'stage' ? (crand() * 4294967296) >>> 0 : todaySeed();
    const rp = Ink.rng(seed + 11), rs = Ink.rng(seed + 22), rc = Ink.rng(seed + 33);
    R = {
      kind, stage, cfg, bet, rp, rs,
      t: 0, factor: 1, ms: 0, tk: -1, lastTick: 0, uid: 0, freeze: 0,
      tempters: [], pending: [], reals: [], neonT: -9, nextSpawn: 2.4,
      crack: null, crackAt: 0, nextBeep: 0, sil: null,
      realGot: 0, missed: null, hitTarget: false, swipe: null, paused: false,
      hint: nextHint || (kind === 'stage' && stage === 1 && S.cleared === 0),
      res: null, revived: false, readyT: 0, readyPh: 0, dieT: 0, outT: 0, shown: false
    };
    nextHint = false;
    if (cfg.silence && rp() < 0.7) R.sil = { at: 12 + rp() * 22, dur: 2.6 + rp() * 1.4, on: false, done: false, btn: false };
    // 本物ボーナスの時刻(0〜2回。ステージ1は必ず1回)
    const tut = kind === 'stage' && stage === 1;
    const x = rp(), n = tut ? 1 : (x < 0.2 ? 0 : x < 0.75 ? 1 : 2);
    let tt = tut ? 5 + rp() * 3 : 6 + rp() * 8;
    for (let i = 0; i < n; i++) {
      if (R.sil && tt > R.sil.at - 1.2 && tt < R.sil.at + R.sil.dur + 0.6) tt = R.sil.at + R.sil.dur + 1.5;
      R.reals.push({ pre: tt, app: tt + 0.45, preDone: false, appDone: false });
      tt += 7 + rp() * 10;
    }
    // ヒビの時刻(時間がたつほど来やすい)
    let ca = 5 + Math.sqrt(-2 * Math.log(1 - rc()) / cfg.haz);
    if (R.sil && ca > R.sil.at - 0.5 && ca < R.sil.at + R.sil.dur + 0.8) ca = R.sil.at + R.sil.dur + 0.8;
    R.crackAt = ca;
  }

  async function start(kind, stage, bet) {
    Sound.init();
    if (kind === 'stage') {
      if (S.coins < 10) { show('scr-broke'); return; }
      bet = clamp(bet, 10, S.coins);
    } else bet = 100;
    // 全画面広告:3回の勝負ごとに1回、勝負の外だけ
    if (kind !== 'practice' && !S.adFree && S.rounds >= 3 && S.rounds % 3 === 0 && S.interAt !== S.rounds) {
      S.interAt = S.rounds; save();
      await Monetize.interstitial();
    }
    const key = kind === 'stage' ? 's' + stage : 'daily';
    const intro = introFor(kind, stage);
    if (intro && !S.seen[key]) { await showIntro(intro); S.seen[key] = 1; save(); }
    if (kind === 'stage') { S.coins -= bet; save(); }
    held = 0;
    if (kind === 'daily') { dailyState().played = true; save(); }
    newRound(kind, stage, bet);
    mode = 'ready';
    show(null);
    Sound.music('play');
  }
  function retry() {
    if (!R) return goMenu();
    const k = R.kind, st = R.stage, bet = R.bet;
    if (k === 'stage' && S.coins < 10) { show('scr-broke'); return; }
    start(k, st, Math.min(bet, S.coins));
  }

  // ---------- 誘惑を出す ----------
  function maxActive(t) { return t < 8 ? 1 : t < 22 ? 2 : t < 40 ? 3 : 4; }
  function gap(t) { const r = R.rs(); return t < 8 ? 2.6 + r * 1.6 : t < 22 ? 1.4 + r * 1.2 : t < 40 ? 0.8 + r * 0.8 : 0.5 + r * 0.6; }
  function pickType() {
    const types = R.cfg.types;
    const ws = types.map(k => k === 'bonus' ? (R.t > 8 ? 2.2 : 0.6) : 1);
    let x = R.rs() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < types.length; i++) { x -= ws[i]; if (x <= 0) return types[i]; }
    return types[types.length - 1];
  }
  function spawnRandom() {
    let type = pickType();
    if (type === 'phone' && R.tempters.some(tp => tp.type === 'phone')) type = 'hype';
    if (type === 'bonus' && R.cfg.rules.includes('F') && R.rs() < 0.35) {
      presign();
      R.pending.push({ at: R.t + 1.0 + R.rs() * 0.6 });
      return;
    }
    addTempter(type);
  }
  function bonusPos(rng, zone) {
    const w = 92, h = 92, x = 14 + rng() * (W - 28 - w);
    let y0 = 50, y1 = LANE_Y - 12 - h;
    if (zone === 'top') y1 = 320 - h; else if (zone === 'bottom') y0 = 330;
    return { x, y: y0 + rng() * (y1 - y0) };
  }
  function addTempter(type, o) {
    o = o || {};
    const T = TEMPT[type], rs = R.rs;
    const tp = { id: ++R.uid, type, w: T.w, h: T.h, t0: R.t, life: o.life || T.life, real: !!o.real };
    if (type === 'bonus') {
      const rules = R.cfg.rules;
      let zone = 'any';
      if (rules.includes('B')) zone = tp.real ? 'top' : (rs() < 0.5 ? 'top' : 'bottom');
      if (rules.includes('L')) zone = tp.real ? 'bottom' : (rs() < 0.5 ? 'top' : 'bottom');
      const p = bonusPos(tp.real ? R.rp : rs, zone);
      tp.x = p.x; tp.y = p.y;
      tp.pulse = rules.includes('C') && (tp.real || rs() < 0.45);
      tp.tilt = rules.includes('S') && (tp.real || rs() < 0.45);
      if (tp.real) { tp.win = R.cfg.win; tp.life = R.cfg.win + 0.25; }
    } else if (type === 'phone') { tp.x = 268; tp.y = 362; }
    else if (type === 'coin') { tp.x = W / 2 - 24 + (rs() - 0.5) * 120; tp.y0 = tp.y = 40; tp.vy = 150 + rs() * 70; }
    else if (type === 'under') { tp.x = clamp(lastPtr.x - tp.w / 2, 8, W - 8 - tp.w); tp.y = clamp(lastPtr.y - tp.h / 2, 44, H - tp.h - 4); }
    else if (type === 'notify') { tp.x = (W - tp.w) / 2; tp.y = 44 + rs() * 50; tp.who = WHO[Math.floor(rs() * WHO.length)]; }
    else if (type === 'resume') { tp.x = (W - tp.w) / 2; tp.y = 300; }
    else {
      // 大きい誘惑は倍率の表示(窓の上のほう)をなるべくふさがない
      const y0 = tp.w >= 180 && type !== 'hype' ? 226 : 46;
      tp.x = 10 + rs() * (W - 20 - tp.w); tp.y = y0 + rs() * (LANE_Y - 10 - y0 - tp.h);
    }
    if (o.lane) tp.y = Math.min(H - tp.h * 0.6, LANE_Y - tp.h * 0.35 + rs() * 12);
    if (!tp.real && T.se) Sound.se(T.se);
    R.tempters.push(tp);
    return tp;
  }
  function presign() { R.neonT = R.t; Sound.se('presign'); }

  function makeRays(cx, cy) {
    const rays = [], n = 9 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      let a = i / n * Math.PI * 2 + Math.random() * 0.5, x = cx, y = cy;
      const pts = [[x, y]], steps = Math.round((140 + Math.random() * 320) / 18);
      for (let k = 0; k < steps; k++) {
        a += (Math.random() - 0.5) * 0.5; x += Math.cos(a) * 18; y += Math.sin(a) * 18;
        pts.push([x, y]);
        if (k > 2 && Math.random() < 0.12) {
          let b = a + (Math.random() < 0.5 ? 0.7 : -0.7), bx = x, by = y;
          const br = [[bx, by]];
          for (let q = 0; q < 4; q++) { b += (Math.random() - 0.5) * 0.6; bx += Math.cos(b) * 14; by += Math.sin(b) * 14; br.push([bx, by]); }
          rays.push(br);
        }
      }
      rays.push(pts);
    }
    return rays;
  }
  function startCrack() {
    const x = 60 + Math.random() * 240, y = 120 + Math.random() * 300;
    R.crack = { t0: R.t, x, y, rays: makeRays(x, y), seed: (Math.random() * 1e9) | 0 };
    R.nextBeep = R.t + 0.3;
    Sound.se('crack'); shake(10); flash(0.5); vib([60, 30, 60]);
    popup('ヒビ!', W / 2, 262, 40, true);
    // 山場:利確しようとする指の先(下の帯)に偽物を置く
    if (R.kind !== 'stage' || R.stage >= 2) addTempter('bonus', { lane: true });
    if (R.kind !== 'stage' || R.stage >= 3) addTempter('hype', { lane: true });
  }

  // ---------- 毎フレームの進行 ----------
  function update(dt) {
    clock += dt;
    updateFx(dt);
    if (!R) return;
    if (mode === 'ready') {
      R.readyT += dt;
      if (R.readyPh === 0) { R.readyPh = 1; Sound.se('ready'); }
      if (R.readyPh === 1 && R.readyT > 0.7) { R.readyPh = 2; Sound.se('stamp'); shake(4); }
      if (R.readyT > 1.35) { mode = 'play'; Sound.se('go'); }
    } else if (mode === 'play') {
      if (!R.paused) updatePlay(dt);
    } else if (mode === 'dying') {
      R.dieT += dt;
      if (R.readyPh !== 9 && R.dieT > 0.35) { R.readyPh = 9; Sound.se('stamp'); shake(8); }
      if (!R.shown && R.dieT > 1.7) { R.shown = true; showResult(); }
    } else if (mode === 'outro') {
      R.outT += dt;
      const c = Math.floor(R.outT * 20);
      if (R.outT < 0.9 && c !== R.tk) { R.tk = c; Sound.se('count'); }
      if (!R.shown && R.outT > 1.4) { R.shown = true; showResult(); }
    }
  }

  function updatePlay(dt) {
    if (R.freeze > 0) { R.freeze -= dt; return; }   // ヒットストップ(一瞬止まる)
    R.t += dt;
    const t = R.t, cfg = R.cfg, sl = R.sil;

    // 静寂:全部止まって白くなる。「タップして再開」は罠
    if (sl && !sl.on && !sl.done && t >= sl.at) {
      sl.on = true; R.tempters = []; R.pending = []; Sound.duck(true);
    }
    if (sl && sl.on) {
      if (!sl.btn && t >= sl.at + 1.0) { sl.btn = true; addTempter('resume', { life: sl.dur }); }
      if (t >= sl.at + sl.dur) {
        sl.on = false; sl.done = true;
        R.tempters = R.tempters.filter(tp => tp.type !== 'resume');
        Sound.duck(false); Sound.se('stab'); shake(7); flash(0.35);
        R.nextSpawn = t + 0.6;
        spawnRandom(); spawnRandom();
      }
    }
    const silent = sl && sl.on;

    // 本物:前兆(音とネオン)→ 0.45秒後に音なしで出る
    for (const r of R.reals) {
      if (!r.preDone && t >= r.pre) { r.preDone = true; if (!silent) presign(); }
      if (!r.appDone && t >= r.app) {
        r.appDone = true;
        if (!silent) { const tp = addTempter('bonus', { real: true }); if (R.hint) { tp.hint = true; R.hint = false; } }
      }
    }
    // 偽の前兆のあとの偽ボーナス
    R.pending = R.pending.filter(p => { if (t >= p.at) { if (!silent) addTempter('bonus'); return false; } return true; });

    if (!silent && t >= R.nextSpawn) {
      if (R.tempters.filter(tp => !tp.real).length < maxActive(t)) spawnRandom();
      R.nextSpawn = t + gap(t) * (R.crack ? 0.6 : 1);
    }

    for (const tp of R.tempters) if (tp.type === 'coin') tp.y = tp.y0 + (t - tp.t0) * tp.vy;
    R.tempters = R.tempters.filter(tp => {
      if (t > tp.t0 + tp.life) { if (tp.real && R.missed == null) R.missed = tp.t0; return false; }
      return true;
    });

    // ヒビ
    if (!R.crack && !silent && t >= R.crackAt) startCrack();
    if (R.crack) {
      const left = cfg.grace - (t - R.crack.t0);
      if (t >= R.nextBeep) { Sound.se('beep'); R.nextBeep = t + (left < 1 ? 0.16 : 0.4); }
      if (left <= 0) { lose('collapse'); return; }
    }

    // 節目の演出と、数字が上がるカチカチ音
    const m = curM();
    while (R.ms < MS.length && m >= MS[R.ms]) { milestone(MS[R.ms], R.ms); R.ms++; }
    const step = m < 5 ? 0.1 : m < 20 ? 0.25 : m < 100 ? 1 : 5;
    const k = Math.floor(m / step);
    if (k !== R.tk) { R.tk = k; if (!silent && clock - R.lastTick > 0.05) { R.lastTick = clock; Sound.se('tick', m); } }
    if (R.kind === 'stage' && !R.hitTarget && m >= cfg.target) { R.hitTarget = true; popup('目標達成', W / 2, 300, 22); Sound.se('win'); }
    Sound.intensity(Math.log(m) / Math.log(60));
  }

  function milestone(v, i) {
    R.freeze = Math.max(R.freeze, 0.06 + Math.min(0.08, i * 0.012));
    shake(3 + i); flash(0.12 + i * 0.02); vib(20 + i * 5);
    Sound.se('milestone', i);
    popup('×' + v + '!', W / 2, 262, 30 + i * 2);
  }
  function gotReal(tp) {
    tp.got = true;
    R.tempters = R.tempters.filter(x => x !== tp);
    R.factor *= 3; R.realGot++; S.rec.real++;
    R.freeze = 0.14;
    Sound.se('bonus'); shake(9); flash(0.5); vib([20, 30, 60]);
    const cx = tp.x + tp.w / 2, cy = tp.y + tp.h / 2;
    popup('本物! ×3', cx, cy, 30);
    coinBurst(cx, cy, 18);
  }
  function cashout() {
    if (mode !== 'play' || !R || R.paused) return;
    const m = curM();
    R.res = { win: true, m, pay: Math.floor(R.bet * m), t: R.t };
    mode = 'outro'; R.outT = 0; R.tk = -1; R.swipe = null;
    Sound.duck(false); Sound.music('off'); Sound.se('cashout');
    coinRain(46); flash(0.6); shake(6); vib([15, 30, 15, 30, 80]);
  }
  function lose(reason, tp) {
    R.res = { win: false, reason, tp: tp || null, m: curM(), t: R.t };
    mode = 'dying'; R.dieT = 0; R.swipe = null;
    Sound.duck(false); Sound.music('off'); Sound.se('lose');
    flash(0.7, true); shake(12); vib([80, 40, 160]);
  }

  // ---------- 入力 ----------
  function toLocal(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function hit(tp, x, y) {
    if (tp.type === 'bonus') return Math.hypot(x - (tp.x + tp.w / 2), y - (tp.y + tp.h / 2)) <= 48;
    return x >= tp.x - 4 && x <= tp.x + tp.w + 4 && y >= tp.y - 4 && y <= tp.y + tp.h + 4;
  }
  cv.addEventListener('pointerdown', e => {
    Sound.init();
    const p = toLocal(e);
    lastPtr = p;
    ptrs.add(e.pointerId);
    if (mode !== 'play' || !R || R.paused) return;
    if (ptrs.size > 1) return;                       // 2本指以上は無視(持ちかえで負けないように)
    if (p.x < W * 0.05 || p.x > W * 0.95) return;    // 画面の左右の端は判定なし
    const silent = R.sil && R.sil.on;
    for (let i = R.tempters.length - 1; i >= 0; i--) {
      const tp = R.tempters[i];
      if (silent && tp.type !== 'resume') continue;
      if (!hit(tp, p.x, p.y)) continue;
      if (tp.real) { if (R.t - tp.t0 <= tp.win) gotReal(tp); return; }
      lose('tap', tp);
      return;
    }
    if (p.y >= LANE_Y - 8) { R.swipe = { id: e.pointerId, y0: p.y }; return; }
    fx.ripples.push({ x: p.x, y: p.y, t: 0 });
  });
  cv.addEventListener('pointermove', e => {
    const p = toLocal(e);
    lastPtr = p;
    if (R && R.swipe && R.swipe.id === e.pointerId && R.swipe.y0 - p.y > 40) cashout();
  });
  const up = e => { ptrs.delete(e.pointerId); if (R && R.swipe && R.swipe.id === e.pointerId) R.swipe = null; };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (mode === 'play' && (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ')) { e.preventDefault(); cashout(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'play' && R && !R.paused) {
      R.paused = true; R.swipe = null; ptrs.clear(); Sound.duck(true); show('scr-pause');
    }
  });

  // ---------- 演出(ゆれ・光・コイン・文字) ----------
  function shake(a) { fx.shake = Math.max(fx.shake, a); }
  function flash(a, red) { fx.flash = Math.max(fx.flash, a); fx.flashRed = !!red; }
  function popup(text, x, y, size, red) { fx.pops.push({ text, x, y, size, t: 0, dur: 0.9, red }); }
  function coinBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220;
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, life: 1.6 });
    }
  }
  function coinRain(n) {
    for (let i = 0; i < n; i++) fx.parts.push({ x: Math.random() * W, y: -20 - Math.random() * 260, vx: (Math.random() - 0.5) * 40, vy: 80 + Math.random() * 160, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, life: 3 });
  }
  function updateFx(dt) {
    fx.shake = Math.max(0, fx.shake - dt * 28);
    fx.flash = Math.max(0, fx.flash - dt * 2.2);
    fx.parts = fx.parts.filter(p => {
      p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt;
      return p.life > 0 && p.y < H + 20;
    });
    fx.pops = fx.pops.filter(p => (p.t += dt) < p.dur);
    fx.ripples = fx.ripples.filter(r => (r.t += dt) < 0.3);
  }

  // ---------- 描画 ----------
  function render() {
    const P = Ink.P, calm = S.set.calm;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let ox = 0, oy = 0;
    if (fx.shake > 0.2) { const a = fx.shake * (calm ? 0.3 : 1); ox = (Math.random() - 0.5) * a; oy = (Math.random() - 0.5) * a; }
    if (!calm && Math.random() < 0.08) { ox += (Math.random() - 0.5) * 0.8; oy += (Math.random() - 0.5) * 0.8; }  // 古いフィルムの揺れ
    ctx.fillStyle = P.ink; ctx.fillRect(0, 0, cv.width, cv.height);
    if (bgs.length) ctx.drawImage(bgs[Math.floor(clock * 7) % 3], ox * K, oy * K);
    ctx.setTransform(K, 0, 0, K, ox * K, oy * K);
    Ink.tv(ctx);
    Ink.towerLight(ctx, clock);
    const nl = R && mode !== 'menu' ? Math.max(0, 1 - (R.t - R.neonT) / 0.7) : 0;
    Ink.neon(ctx, nl, clock);
    if (R) drawGame();
    drawFx();
    ctx.setTransform(K, 0, 0, K, 0, 0);
    if (fx.flash > 0) {
      ctx.globalAlpha = Math.min(fx.flash, calm ? 0.12 : 0.8);
      ctx.fillStyle = fx.flashRed ? P.red : P.glow; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    Ink.film(ctx, calm ? 0.05 : 0.09);
  }

  function drawGame() {
    const P = Ink.P, silent = R.sil && R.sil.on;
    drawMeter();
    if (R.crack) Ink.crack(ctx, R.crack, R.t - R.crack.t0);
    for (const tp of R.tempters) {
      if (tp.type === 'resume') continue;
      Ink.tempter(ctx, tp, R.t - tp.t0, clock, S.set.calm);
      if (tp.hint) drawHint(tp);
    }
    drawLane();
    drawHUD();
    if (silent) {
      ctx.globalAlpha = 0.97; ctx.fillStyle = P.paper; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      Ink.txt(ctx, '……', W / 2, 250, 22, { h: true, c: P.shade });
      for (const tp of R.tempters) if (tp.type === 'resume') Ink.tempter(ctx, tp, R.t - tp.t0, clock, true);
    }
    if (mode === 'ready') drawReady();
    else if (mode === 'dying') drawDying();
    else if (mode === 'outro') drawOutro();
  }

  function drawMeter() {
    const P = Ink.P, m = curM(), dying = mode === 'dying';
    Ink.txt(ctx, R.t.toFixed(1) + '秒 耐えた', W / 2, 84, 13, { h: true, c: P.glow });
    const s = fmtM(m), size = s.length > 6 ? 46 : 56;
    const jit = mode === 'play' ? Math.min(2.5, Math.log(m) * 0.6) * (S.set.calm ? 0.3 : 1) : 0;
    ctx.save();
    if (!dying) { ctx.shadowColor = P.glow; ctx.shadowBlur = 14; }
    Ink.txt(ctx, '×' + s, W / 2 + (Math.random() - 0.5) * jit, 132 + (Math.random() - 0.5) * jit, size, { c: dying ? P.red : P.glow });
    ctx.restore();
    Ink.txt(ctx, fmt(R.bet * m) + ' 枚', W / 2, 174, 20, { c: P.glow });
    const label = R.kind === 'stage' ? (R.hitTarget ? '目標クリア ― あとは欲との勝負' : '目標 ×' + R.cfg.target) : (R.kind === 'daily' ? '今日の一発' : '練習');
    Ink.txt(ctx, label, W / 2, 198, 12, { h: true, c: P.glow });
    const nxt = MS[R.ms] || 9999, prv = R.ms ? MS[R.ms - 1] : 1;
    const f = clamp(Math.log(m / prv) / Math.log(nxt / prv), 0, 1);
    Ink.seed(7 + Math.floor(clock * 7), 0.5);
    Ink.rect(ctx, 110, 210, 140, 8, null, 1.2, P.glow);
    ctx.fillStyle = P.glow; ctx.fillRect(112, 212, 136 * f, 4);
    Ink.txt(ctx, '次 ×' + nxt, 256, 214, 11, { h: true, c: P.glow, al: 'left' });
  }

  function drawLane() {
    const P = Ink.P, y = LANE_Y, hot = R.crack && mode === 'play';
    const blink = hot && !S.set.calm && Math.floor(clock * 8) % 2 === 0;
    ctx.globalAlpha = 0.9; ctx.fillStyle = blink ? P.red : P.ink; ctx.fillRect(0, y, W, H - y); ctx.globalAlpha = 1;
    Ink.seed(3 + Math.floor(clock * 7), 0.8);
    Ink.line(ctx, 0, y, W, y, 2, P.glow);
    const k = (clock * 1.4) % 1;
    ctx.globalAlpha = 1 - k;
    [30, W - 30].forEach(ax => {
      const ay = H - 14 - k * 30;
      Ink.line(ctx, ax - 9, ay + 5, ax, ay - 4, 2.2, P.glow);
      Ink.line(ctx, ax, ay - 4, ax + 9, ay + 5, 2.2, P.glow);
    });
    ctx.globalAlpha = 1;
    Ink.txt(ctx, hot ? '今すぐ ↑ 利確!' : '↑ ここから上へスワイプで利確', W / 2, y + 28, hot ? 18 : 14, { h: true, c: P.glow });
    if (hot) {
      const left = Math.max(0, R.cfg.grace - (R.t - R.crack.t0)), cx = W - 40, cy = y - 36;
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 7); ctx.fillStyle = P.ink; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left / R.cfg.grace);
      ctx.lineWidth = 4; ctx.strokeStyle = P.red; ctx.stroke();
      Ink.txt(ctx, left.toFixed(1), cx, cy + 1, 14, { c: P.glow });
    }
  }

  function drawHUD() {
    const P = Ink.P;
    ctx.globalAlpha = 0.85; ctx.fillStyle = P.ink; ctx.fillRect(0, 0, W, 34); ctx.globalAlpha = 1;
    Ink.txt(ctx, '手持ち ' + fmt(S.coins), 10, 18, 12, { h: true, c: P.glow, al: 'left' });
    Ink.txt(ctx, R.kind === 'stage' ? 'STAGE ' + R.stage : (R.kind === 'daily' ? '今日の一発' : '練習'), W / 2, 18, 13, { c: P.glow });
    Ink.txt(ctx, 'BET ' + fmt(R.bet), W - 10, 18, 12, { h: true, c: P.glow, al: 'right' });
  }

  function drawHint(tp) {
    const P = Ink.P, cx = tp.x + tp.w / 2, cy = tp.y + tp.h / 2;
    ctx.save();
    ctx.setLineDash([6, 5]); ctx.strokeStyle = P.red; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 58 + Math.sin(clock * 10) * 3, 0, 7); ctx.stroke();
    ctx.restore();
    Ink.txt(ctx, 'これが本物! 今タップ', cx, cy < 130 ? cy + 72 : cy - 72, 15, { h: true, c: P.glow, sw: 5, sc: P.red });
  }

  function drawReady() {
    const P = Ink.P, t = R.readyT;
    ctx.globalAlpha = 0.35; ctx.fillStyle = P.ink; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    if (t < 0.7) Ink.txt(ctx, 'READY', W / 2, 340, 44, { c: P.glow, sw: 7 });
    else {
      const s = 1 + Math.max(0, 1 - (t - 0.7) / 0.12) * 1.2;
      ctx.save(); ctx.translate(W / 2, 340); ctx.rotate(-0.06); ctx.scale(s, s);
      Ink.txt(ctx, '押すな。', 0, 0, 58, { c: P.glow, sw: 9 });
      ctx.restore();
    }
  }

  function drawDying() {
    const P = Ink.P, a = Math.min(1, R.dieT / 0.5), tp = R.res.tp;
    ctx.globalAlpha = 0.6 * a; ctx.fillStyle = P.ink; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    if (tp) {
      // 押してしまったものを赤丸で囲む
      Ink.tempter(ctx, tp, R.t - tp.t0, clock, true);
      const cx = tp.x + tp.w / 2, cy = tp.y + tp.h / 2, r = Math.max(tp.w, tp.h) * 0.62 + 10;
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, R.dieT / 0.4));
      ctx.lineWidth = 4; ctx.strokeStyle = P.red; ctx.stroke();
    } else if (R.crack) Ink.crack(ctx, R.crack, 1);
    if (R.dieT > 0.35) {
      const s = 1 + Math.max(0, 1 - (R.dieT - 0.35) / 0.12) * 1.3;
      ctx.save(); ctx.translate(W / 2, 330); ctx.rotate(-0.12); ctx.scale(s, s);
      Ink.txt(ctx, R.res.reason === 'collapse' ? '崩れた' : '全損', 0, 0, 78, { c: P.red, sw: 8, sc: P.ink });
      ctx.restore();
    }
  }

  function drawOutro() {
    const P = Ink.P, k = Math.min(1, R.outT / 0.8);
    const s = 1 + Math.max(0, 1 - R.outT / 0.12) * 1.2;
    ctx.save(); ctx.translate(W / 2, 330); ctx.rotate(-0.05); ctx.scale(s, s);
    Ink.txt(ctx, '利確!', 0, 0, 64, { c: P.glow, sw: 9 });
    ctx.restore();
    Ink.txt(ctx, '+' + fmt(R.res.pay * k) + ' 枚', W / 2, 392, 28, { c: P.glow, sw: 6 });
  }

  function drawFx() {
    const P = Ink.P;
    for (const p of fx.parts) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.max(0.2, Math.abs(Math.cos(p.rot))), 1);
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fillStyle = P.glow; ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = P.ink; ctx.stroke();
      ctx.restore();
    }
    for (const r of fx.ripples) {
      ctx.globalAlpha = 1 - r.t / 0.3;
      ctx.beginPath(); ctx.arc(r.x, r.y, 6 + r.t * 70, 0, 7); ctx.lineWidth = 1.5; ctx.strokeStyle = P.ink; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const p of fx.pops) {
      const s = p.t < 0.1 ? 1.6 - p.t * 6 : 1;
      ctx.save();
      ctx.globalAlpha = p.t > p.dur - 0.3 ? (p.dur - p.t) / 0.3 : 1;
      ctx.translate(p.x, p.y - p.t * 24); ctx.scale(s, s);
      Ink.txt(ctx, p.text, 0, 0, p.size, { c: p.red ? P.red : P.glow, sw: 6, sc: P.ink });
      ctx.restore();
    }
  }

  // ---------- 画面(メニュー類) ----------
  function show(id) { document.querySelectorAll('#ui .scr').forEach(s => { s.hidden = s.id !== id; }); }
  let toastT = 0;
  function toast(msg) {
    const el = $('toast');
    el.hidden = true; void el.offsetWidth;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2400);
  }
  function setCoins() { document.querySelectorAll('.v-coins').forEach(e => { e.textContent = fmt(S.coins); }); $('t-coins').textContent = fmt(S.coins); }

  function goTitle() {
    mode = 'menu'; R = null;
    if (S.bonusDate !== today()) {
      const first = !S.bonusDate;
      S.bonusDate = today(); S.coins += 300; save();
      setTimeout(() => toast(first ? 'はじめての配給 +300枚' : '今日の配給 +300枚'), 400);
    }
    const d = dailyState();
    $('t-daily').textContent = d.played ? '(今日は挑戦済み)' : '(未挑戦)';
    setCoins();
    show('scr-title');
    Sound.music('menu');
  }
  function goMenu() {
    mode = 'menu'; R = null; D = null; held = 0;
    renderMenu();
    show('scr-menu');
    Sound.music('menu');
  }
  function curBet() { return S.betAll ? S.coins : Math.min(S.bet, S.coins); }
  function renderMenu() {
    selStage = clamp(selStage, 1, Math.min(10, S.cleared + 1));
    const g = $('stages'); g.innerHTML = '';
    STAGES.forEach((st, i) => {
      const n = i + 1, b = document.createElement('button');
      b.type = 'button';
      b.className = 'stg' + (n === selStage ? ' sel' : '') + (n <= S.cleared ? ' done' : '');
      b.innerHTML = n + '<small>×' + st.target + '</small>';
      b.disabled = n > S.cleared + 1;
      b.setAttribute('aria-label', 'ステージ' + n + ' 目標' + st.target + '倍');
      b.onclick = () => { selStage = n; Sound.se('click'); renderMenu(); };
      g.appendChild(b);
    });
    const st = STAGES[selStage - 1];
    $('m-stage').textContent = 'ステージ' + selStage + ':×' + st.target + ' 以上で利確するとクリア。ヒビの猶予 ' + st.grace.toFixed(1) + '秒。';
    const bx = $('bets'); bx.innerHTML = '';
    [10, 50, 100, 500, 'ALL'].forEach(v => {
      const b = document.createElement('button'), all = v === 'ALL', amt = all ? S.coins : v;
      b.type = 'button';
      b.className = 'chip' + (all ? ' all' : '') + ((all ? S.betAll : (!S.betAll && v === S.bet)) ? ' sel' : '');
      b.textContent = all ? '全部' : v;
      b.disabled = amt < 10 || amt > S.coins;
      b.onclick = () => { S.betAll = all; if (!all) S.bet = v; save(); Sound.se('click'); renderMenu(); };
      bx.appendChild(b);
    });
    const bet = curBet();
    $('m-info').textContent = bet >= 10
      ? 'BET ' + fmt(bet) + '枚 → ×' + st.target + ' で ' + fmt(bet * st.target) + '枚。押したら 0枚。'
      : '手持ちが足りません。';
    $('b-hint').textContent = nextHint ? '次の勝負で本物を1回教えます' : '広告を見て、本物を1回だけ教えてもらう';
    $('b-hint').disabled = nextHint;
    setCoins();
  }

  function introFor(kind, stage) {
    if (kind !== 'stage') {
      const cfg = dailyCfg();
      return { head: '今日の一発', items: [
        { k: 'rule', name: RULES[cfg.rule].name, desc: RULES[cfg.rule].desc },
        { k: 'rule', name: RULES.F.name, desc: RULES.F.desc },
        { k: 'base', name: '全部', desc: 'これまでの誘惑が全部出る。静寂もある。' }
      ] };
    }
    const cur = STAGES[stage - 1], prev = stage > 1 ? STAGES[stage - 2] : { types: [], rules: [], silence: false };
    const items = stage === 1 ? BASICS.slice() : [];
    cur.rules.filter(r => !prev.rules.includes(r)).forEach(r => items.push({ k: 'rule', name: RULES[r].name, desc: RULES[r].desc }));
    cur.types.filter(t => !prev.types.includes(t)).forEach(t => items.push({ k: 't', name: TEMPT[t].name, desc: TEMPT[t].desc }));
    if (cur.silence && !prev.silence) items.push({ k: 't', name: TEMPT.silence.name, desc: TEMPT.silence.desc });
    if (cur.grace < prev.grace) items.push({ k: 'base', name: 'ヒビ', desc: 'ヒビの猶予が ' + cur.grace.toFixed(1) + '秒 に短くなる。' });
    if (!items.length) return null;
    return { head: stage === 1 ? 'あそびかた' : 'ステージ' + stage + ' で増えるもの', items };
  }
  function showIntro(intro) {
    return new Promise(resolve => {
      $('i-head').textContent = intro.head;
      $('i-note').hidden = !intro.items.some(it => it.k === 'rule');
      const ul = $('i-list'); ul.innerHTML = '';
      intro.items.forEach(it => {
        const li = document.createElement('li');
        if (it.k === 'rule') li.className = 'rule';
        const b = document.createElement('b'); b.textContent = it.name;
        const s = document.createElement('span'); s.textContent = it.desc;
        li.appendChild(b); li.appendChild(s); ul.appendChild(li);
      });
      show('scr-intro');
      $('i-ok').onclick = () => { Sound.se('click'); resolve(); };
    });
  }

  // ---------- 結果 ----------
  function addBtn(label, cls, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = label;
    b.onclick = () => fn(b);
    $('r-btns').appendChild(b);
    return b;
  }
  function showResult() {
    const res = R.res, k = R.kind, cfg = R.cfg;
    const notes = $('r-notes'), pay = $('r-pay'), stamp = $('r-stamp');
    notes.innerHTML = ''; $('r-btns').innerHTML = ''; stamp.hidden = true;
    const note = (s, hot) => { const li = document.createElement('li'); li.textContent = s; if (hot) li.className = 'hot'; notes.appendChild(li); };
    if (k !== 'practice') { S.rounds++; S.rec.hold = Math.max(S.rec.hold, res.t); }
    $('r-mult').textContent = '×' + fmtM(res.m);
    $('r-mult').className = 'bigmult' + (res.win ? '' : ' lost');
    if (res.win) {
      $('r-head').textContent = '利確!';
      note(res.t.toFixed(1) + '秒 耐えた');
      if (R.realGot) note('本物を ' + R.realGot + ' 回見抜いた(×3)');
      if (R.missed != null) note(R.missed.toFixed(1) + '秒の本物を見逃した');
      pay.className = 'pay plus';
      if (k === 'stage') {
        S.coins += res.pay; held = res.pay;
        S.rec.mult = Math.max(S.rec.mult, res.m); S.rec.pay = Math.max(S.rec.pay, res.pay);
        pay.textContent = '+' + fmt(res.pay) + ' 枚(賭け金 ' + fmt(R.bet) + ')';
        if (res.m >= cfg.target) {
          stamp.textContent = 'CLEAR'; stamp.hidden = false; Sound.se('stamp');
          if (R.stage > S.cleared) { S.cleared = R.stage; if (R.stage < 10) { selStage = R.stage + 1; note('ステージ' + (R.stage + 1) + ' が開いた'); } else note('全ステージ制覇!'); }
        } else note('目標 ×' + cfg.target + ' に届かず(ステージは未クリア)', true);
        if (held > 0) addBtn('倍プッシュ(丁か半か)', 'btn red', openDouble);
        addBtn('受け取る', 'btn big', goMenu);
        addBtn('もう一回(BET ' + fmt(R.bet) + ')', 'btn', retry);
      } else if (k === 'daily') {
        S.coins += res.pay; dailyState().best = Math.max(S.daily.best, res.m);
        pay.textContent = '+' + fmt(res.pay) + ' 枚';
        addBtn('結果をコピーして自慢する', 'btn', share);
        addBtn('もどる', 'btn big', goDaily);
      } else {
        pay.textContent = '練習なので枚数は動きません';
        addBtn('もう一回 練習', 'btn big', () => start('practice'));
        addBtn('もどる', 'btn', goDaily);
      }
    } else {
      $('r-head').textContent = res.reason === 'collapse' ? '崩れた' : '全損';
      if (res.reason === 'tap') {
        const tp = res.tp;
        if (tp.type === 'resume') note('静寂はワナ。待てば元に戻る', true);
        else if (tp.type === 'bonus') note('それはニセボーナス。本物は「チリン」が先で、絵は音なしで出る', true);
        else note('「' + TEMPT[tp.type].name + '」は誘惑。押したら全損', true);
      } else note('ヒビが入ってから ' + cfg.grace.toFixed(1) + '秒以内に ↑スワイプで利確', true);
      const nx = MS.find(v => v > res.m);
      if (nx) { const need = invBase(nx / R.factor) - res.t; if (need > 0 && need < 30) note('あと ' + need.toFixed(1) + '秒 耐えれば ×' + nx + ' だった'); }
      if (R.missed != null) note('本物は ' + R.missed.toFixed(1) + '秒に出ていた');
      pay.className = 'pay minus';
      if (k === 'stage') {
        pay.textContent = '-' + fmt(R.bet) + ' 枚';
        const back = Math.floor(R.bet * res.m / 2);
        if (back > 0 && !R.revived) {
          addBtn('広告を見て半分回収 +' + fmt(back) + '枚', 'btn red', b => {
            Monetize.rewarded('半分回収').then(ok => {
              if (!ok || R.revived) return;
              R.revived = true; S.coins += back; save(); setCoins();
              Sound.se('cashout'); toast('+' + fmt(back) + '枚 回収した'); b.remove();
            });
          });
        }
        addBtn('もう一回(BET ' + fmt(R.bet) + ')', 'btn big', retry);
        addBtn('ステージ選択へ', 'btn', goMenu);
      } else if (k === 'daily') {
        pay.textContent = '今日の挑戦は終わり';
        addBtn('結果をコピーする', 'btn', share);
        addBtn('もどる', 'btn big', goDaily);
      } else {
        pay.textContent = '練習なので枚数は動きません';
        addBtn('もう一回 練習', 'btn big', () => start('practice'));
        addBtn('もどる', 'btn', goDaily);
      }
    }
    if (S.rounds >= 5 && !S.offered && !S.adFree) {
      S.offered = true;
      addBtn('広告をなくす ' + Monetize.PRODUCTS.noads.price, 'btn sm', buyNoAds);
    }
    save();
    show('scr-result');
    Sound.music('menu');
  }
  function share() {
    const res = R && R.res;
    if (!res) return;
    const where = R.kind === 'daily' ? '今日の一発(' + today() + ')' : 'STAGE ' + R.stage;
    const text = '押すな。' + where + ' ×' + fmtM(res.m) + (res.win ? 'で利確' : 'で全損') + '(' + res.t.toFixed(1) + '秒 耐えた) #押すな';
    try {
      navigator.clipboard.writeText(text).then(() => toast('結果をコピーした'), () => toast(text));
    } catch (e) { toast(text); }
  }

  // ---------- 倍プッシュ(丁半) ----------
  function setDie(el, n) {
    const on = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[n];
    let h = '';
    for (let i = 0; i < 9; i++) h += on.includes(i) ? (n === 1 ? '<i class="r"></i>' : '<i></i>') : '<span></span>';
    el.innerHTML = h;
  }
  function dmsg(html, cls) { const el = $('d-msg'); el.innerHTML = html; el.className = 'dmsg' + (cls ? ' ' + cls : ''); }
  function openDouble() {
    if (held <= 0) return;
    S.coins -= held; save();
    D = { amt: held, step: 0, busy: false, over: false };
    held = 0;
    $('cup').className = 'cup';
    setDie($('die1'), 0); setDie($('die2'), 0);
    dmsg('いま <b>' + fmt(D.amt) + '</b> 枚 → 当たれば <b>' + fmt(D.amt * 2) + '</b> 枚');
    $('d-pick').hidden = false;
    $('d-take').disabled = false;
    $('d-take').textContent = '降りて受け取る(' + fmt(D.amt) + '枚)';
    show('scr-double');
  }
  function choose(even) {
    if (!D || D.busy || D.over) return;
    D.busy = true;
    const cup = $('cup');
    cup.className = 'cup';
    void cup.offsetWidth;
    cup.className = 'cup shaking';
    Sound.se('shake');
    $('d-pick').hidden = true; $('d-take').disabled = true;
    dmsg((even ? '丁' : '半') + 'に賭けた……');
    setTimeout(() => {
      const a = 1 + Math.floor(crand() * 6), b = 1 + Math.floor(crand() * 6), isEven = (a + b) % 2 === 0;
      setDie($('die1'), a); setDie($('die2'), b);
      cup.className = 'cup open';
      Sound.se('stamp');
      setTimeout(() => {
        D.busy = false; $('d-take').disabled = false;
        const lbl = a + '・' + b + 'の' + (isEven ? '丁' : '半');
        if (isEven === even) {
          D.amt *= 2; D.step++;
          Sound.se('win'); vib([20, 40, 20]); flash(0.3);
          S.rec.pay = Math.max(S.rec.pay, D.amt);
          if (D.step >= 3) {
            D.over = true;
            dmsg(lbl + '! 当たり。3連勝で上限 → <b>' + fmt(D.amt) + '</b> 枚', 'win');
            $('d-take').textContent = '受け取る(' + fmt(D.amt) + '枚)';
          } else {
            dmsg(lbl + '! 当たり → <b>' + fmt(D.amt) + '</b> 枚。続ければ <b>' + fmt(D.amt * 2) + '</b> 枚', 'win');
            $('d-pick').hidden = false;
            $('d-take').textContent = '降りて受け取る(' + fmt(D.amt) + '枚)';
          }
        } else {
          D.amt = 0; D.over = true;
          Sound.se('lose'); vib(120); flash(0.4, true);
          dmsg(lbl + '…ハズレ。0枚', 'lose');
          $('d-take').textContent = 'もどる';
        }
        save();
      }, 450);
    }, 900);
  }
  function takeDouble() {
    if (!D || D.busy) return;
    S.coins += D.amt; save();
    if (D.amt > 0) toast('+' + fmt(D.amt) + '枚');
    goMenu();
  }

  // ---------- デイリー・記録・店・設定 ----------
  function goDaily() {
    mode = 'menu'; R = null;
    const d = dailyState(), cfg = dailyCfg();
    $('dy-date').textContent = today();
    $('dy-rule').textContent = RULES[cfg.rule].desc;
    $('dy-best').textContent = d.best ? '×' + fmtM(d.best) : (d.played ? '全損' : '—');
    $('dy-go').disabled = d.played;
    $('dy-go').textContent = d.played ? '今日は挑戦済み(また明日)' : '挑戦する(1日1回)';
    $('dy-practice').textContent = d.prac ? '今日の配置で練習する' : '広告を見て、今日の配置で練習する';
    show('scr-daily');
    Sound.music('menu');
  }
  function showRec() {
    const d = dailyState();
    const rows = [
      ['最長 我慢', S.rec.hold.toFixed(1) + '秒'],
      ['最高 倍率', '×' + fmtM(Math.max(1, S.rec.mult))],
      ['最高 払い戻し', fmt(S.rec.pay) + '枚'],
      ['見抜いた本物', S.rec.real + '回'],
      ['クリアしたステージ', S.cleared + ' / 10'],
      ['勝負した回数', S.rounds + '回'],
      ['今日の一発', d.best ? '×' + fmtM(d.best) : '—']
    ];
    const box = $('rec-list'); box.innerHTML = '';
    rows.forEach(r => {
      const row = document.createElement('div'); row.className = 'recrow';
      const a = document.createElement('span'); a.textContent = r[0];
      const b = document.createElement('b'); b.textContent = r[1];
      row.appendChild(a); row.appendChild(b); box.appendChild(row);
    });
    show('scr-rec');
  }
  function buyNoAds() {
    Monetize.purchase('noads').then(ok => { if (ok) { S.adFree = true; save(); toast('広告をなくしました'); if (!$('scr-shop').hidden) showShop(); } });
  }
  function shopItem(box, name, desc, acts) {
    const it = document.createElement('div'); it.className = 'item';
    const nm = document.createElement('div'); nm.className = 'nm'; nm.innerHTML = name;
    const ds = document.createElement('div'); ds.className = 'ds'; ds.textContent = desc;
    const ac = document.createElement('div'); ac.className = 'acts';
    acts.forEach(a => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'btn' + (a.big ? ' big' : ''); b.textContent = a.label; b.disabled = !!a.disabled;
      if (a.fn) b.onclick = a.fn;
      ac.appendChild(b);
    });
    it.appendChild(nm); it.appendChild(ds); it.appendChild(ac); box.appendChild(it);
  }
  function showShop() {
    const box = $('shop-list'); box.innerHTML = '';
    shopItem(box, '広告をなくす', '3回ごとの全場面広告が出なくなる。ごほうび広告は自分で選んだときだけ。',
      [S.adFree ? { label: '購入済み', disabled: true } : { label: Monetize.PRODUCTS.noads.price, fn: buyNoAds }]);
    Object.keys(Ink.THEMES).forEach(k => {
      const th = Ink.THEMES[k], owned = S.themes.includes(k);
      const sw = ['night', 'wall', 'paper', 'red'].map(c => '<span class="swatch" style="background:' + th[c] + '"></span>').join('');
      const acts = owned
        ? [{ label: S.theme === k ? '使用中' : '使う', disabled: S.theme === k, fn: () => { S.theme = k; save(); applyTheme(); buildBg(); showShop(); } }]
        : [
          { label: '5,000枚', disabled: S.coins < 5000, fn: () => { S.coins -= 5000; S.themes.push(k); S.theme = k; save(); applyTheme(); buildBg(); setCoins(); showShop(); toast('テーマ「' + th.name + '」') } },
          { label: Monetize.PRODUCTS['theme_' + k].price, fn: () => Monetize.purchase('theme_' + k).then(ok => { if (ok) { S.themes.push(k); S.theme = k; save(); applyTheme(); buildBg(); showShop(); } }) }
        ];
      shopItem(box, sw + 'テーマ「' + th.name + '」', k === 'sepia' ? '標準の色。' : '部屋の色あいが丸ごと変わる。ルールは同じ。', acts);
    });
    shopItem(box, 'シーズンパス', '月がわりのテーマ・限定の部屋・今日の一発の報酬2倍(準備中)', [{ label: '準備中', disabled: true }]);
    setCoins();
    show('scr-shop');
  }
  function renderSet() {
    $('set-sound').setAttribute('aria-pressed', String(S.set.sound));
    $('set-vib').setAttribute('aria-pressed', String(S.set.vib));
    $('set-calm').setAttribute('aria-pressed', String(S.set.calm));
    $('set-reset').textContent = 'データを消す';
  }

  // ---------- ボタンの配線 ----------
  document.addEventListener('pointerdown', () => Sound.init(), true);
  document.addEventListener('click', e => {
    Sound.init();
    if (e.target.closest('.btn, .back')) Sound.se('click');
    const g = e.target.closest('[data-go]');
    if (g && g.dataset.go === 'title') goTitle();
  });
  $('warn-ok').onclick = () => { S.warned = true; save(); goTitle(); };
  $('warn-calm').onclick = () => { S.warned = true; S.set.calm = true; save(); goTitle(); };
  $('b-play').onclick = goMenu;
  $('b-daily').onclick = goDaily;
  $('b-rec').onclick = showRec;
  $('b-shop').onclick = showShop;
  $('b-set').onclick = () => { renderSet(); show('scr-set'); };
  $('b-go').onclick = () => start('stage', selStage, curBet());
  $('b-hint').onclick = () => Monetize.rewarded('本物を1回教えてもらう').then(ok => { if (ok) { nextHint = true; toast('次の勝負で、本物を1回だけ教えます'); renderMenu(); } });
  $('d-cho').onclick = () => choose(true);
  $('d-han').onclick = () => choose(false);
  $('d-take').onclick = takeDouble;
  $('dy-go').onclick = () => { if (!dailyState().played) start('daily'); };
  $('dy-practice').onclick = () => {
    if (dailyState().prac) { start('practice'); return; }
    Monetize.rewarded('今日の配置で練習').then(ok => { if (ok) { S.daily.prac = true; save(); start('practice'); } });
  };
  $('bk-ad').onclick = () => Monetize.rewarded('200枚').then(ok => { if (ok) { S.coins += 200; save(); toast('+200枚'); goMenu(); } });
  $('ps-go').onclick = () => { if (!R) return; R.paused = false; show(null); Sound.duck(!!(R.sil && R.sil.on)); };
  $('shop-restore').onclick = () => Monetize.restore().then(list => {
    if (!list) { toast('デモ版では復元するものがありません'); return; }
    if (list.includes('noads')) S.adFree = true;
    ['crt', 'dusk'].forEach(k => { if (list.includes('theme_' + k) && !S.themes.includes(k)) S.themes.push(k); });
    save(); showShop(); toast('購入を復元しました');
  });
  $('set-sound').onclick = () => { S.set.sound = !S.set.sound; Sound.setOn(S.set.sound); save(); renderSet(); };
  $('set-vib').onclick = () => { S.set.vib = !S.set.vib; save(); renderSet(); vib(30); };
  $('set-calm').onclick = () => { S.set.calm = !S.set.calm; save(); renderSet(); };
  $('set-how').onclick = () => showIntro(introFor('stage', 1)).then(() => { renderSet(); show('scr-set'); });
  let resetArm = 0;
  $('set-reset').onclick = () => {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); $('set-reset').textContent = '本当に消す?(もう一度押す)'; return; }
    S = fresh(); S.warned = true; save(); applyTheme(); buildBg(); Sound.setOn(true); goTitle(); toast('データを消しました');
  };

  // ---------- 起動 ----------
  // キャンバスに書く文字のフォントを先に読みこむ(読めなくても代わりのフォントで動く)
  const CANVAS_TEXT = '押すな。大当り穴今タップで×10!!0123456789.BONUS次へ▶電波が途切れたみたい…(このままだと記録が消えます)再接続に抜かれた見に行く★押して着信1回無料ゾロ目で止めろタップして再開秒耐えた枚目標クリアあとは欲との勝負手持ちSTAGE今日の一発練習BET利確全損崩れたヒビREADY本物これが今すぐ↑ここから上へスワイプ……+達成' + WHO.join('');
  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const p = Promise.all([
      document.fonts.load('40px "Dela Gothic One"', CANVAS_TEXT),
      document.fonts.load('20px "Yusei Magic"', CANVAS_TEXT)
    ]).catch(() => {});
    return Promise.race([p, new Promise(r => setTimeout(r, 3000))]);
  }
  function loop(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000));
    last = ts;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  applyTheme();
  fit();
  window.addEventListener('resize', fit);
  loadFonts().then(buildBg);
  Sound.setOn(S.set.sound);
  Sound.music('menu');
  if (!S.warned) show('scr-warn'); else goTitle();
  requestAnimationFrame(ts => { last = ts; requestAnimationFrame(loop); });
})();
