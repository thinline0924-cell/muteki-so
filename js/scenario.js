/* 霧笛荘事件 — 事件ジェネレーター
 *
 * 事件番号(seed)と人物設定から、毎回ちがう事件を組み立てる。
 * 変わるもの:
 *   犯人(5人のだれか) / 動機(復讐・金・口封じ…) / 時刻のトリック(霧笛の仕掛け・検死の偽り・なし)
 *   脱出のトリック(外梯子・閂の糸・灯室に隠れる) / 凶器と捨て場所 / 手袋や糸の持ち主
 *   目撃者と、その人の隠しごと / 外から灯室を見ていた人 / 脅迫状を書いた人
 *   第二の事件(だれが・何時に) / ストーブに薪をくべる時刻 / 書斎に忍び込む時刻
 *   二十年前の夜の真相 / エンディング
 * 出力は game.js が読む window.STORY と同じ形。
 *
 * 台本の書き方は game.js と同じ:
 *   '@id:表情 せりふ' / '地の文' / '(心の声)' / 【赤い強調】 / { cmd }
 * せりふの中の 〔ていねい|くだけた〕 は、話す人の性格で選ばれる。
 */
(function () {
  'use strict';

  var T = function (h, m) { return h * 60 + (m || 0); };

  // ===== 乱数(事件番号から毎回同じ事件を作れる) =====
  var rnd = Math.random;
  function seeded(seed) {
    // 近い番号でも似た事件にならないよう、番号をよくかき混ぜてから使う
    var h = 1779033703 ^ String(seed).length;
    String(seed).split('').forEach(function (ch) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); });
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    var s = h >>> 0;
    var f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (var i = 0; i < 10; i++) f();
    return f;
  }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function chance(p) { return rnd() < p; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function weighted(list) { // [[value, weight], ...]
    var sum = 0; list.forEach(function (x) { sum += x[1]; });
    var r = rnd() * sum;
    for (var i = 0; i < list.length; i++) { r -= list[i][1]; if (r < 0) return list[i][0]; }
    return list[list.length - 1][0];
  }

  // ===== 名前 =====
  var SEI = ['柴崎', '浅葱', '鳴海', '久我', '霧島', '真柴', '早瀬', '野々宮', '桐生', '葛西', '白石', '志摩', '千早', '御厨', '高遠', '宇佐美',
    '篠原', '一ノ瀬', '鷹野', '藤堂', '有馬', '槙村', '冴島', '古賀', '東雲', '綾瀬', '氷室', '水城', '鶴見', '波多野', '黒江', '橘', '朝比奈', '芹沢'];
  var VSEI = ['灰谷', '岬', '汐見', '海老原', '灯野', '磯崎', '霧生', '岩城'];
  var MEI = {
    M: ['恭介', '修司', '慎吾', '達也', '謙治', '英明', '隆', '正雄', '和夫', '啓介', '宗佑', '洋平', '徹', '昭', '伸一', '克彦', '秀樹', '亮'],
    F: ['冬子', '千景', '葉子', '静香', '小夜子', '由紀', '美冬', '律子', '薫', '朋子', '弥生', '霞', '志乃', '早苗', '汐里', '絹代'],
    OLD: ['源三', '喜一', '辰雄', '耕作', '留吉', '権六', '茂', '与平'],
    VIC: ['宗一郎', '総司', '辰之助', '清十郎', '隆三', '幸太郎', '重蔵'],
    DET: ['透', '圭', '朔', '湊', '遥', '玲', '暁']
  };
  var CREW_MEI = ['晴彦', '勇', '浩二', '清', '誠', '正', '修', '進', '光男', '一夫'];

  // ===== 見た目(5人の枠)=====
  var LOOKS = {
    fuyuko:    { gender: 'F', age: 34, role: 'family',  pers: 'calm',   label: '宿の女主人' },
    shibasaki: { gender: 'M', age: 50, role: 'guest',   pers: 'calm',   occ: 'doctor',    label: '眼鏡の紳士' },
    chikage:   { gender: 'F', age: 27, role: 'guest',   pers: 'gruff',  occ: 'painter',   label: 'ベレー帽の女性' },
    naruse:    { gender: 'M', age: 41, role: 'guest',   pers: 'frank',  occ: 'developer', label: '口ひげの男' },
    kuga:      { gender: 'M', age: 72, role: 'servant', pers: 'gruff',  label: '老いた下働き' }
  };
  var IDS = ['fuyuko', 'shibasaki', 'chikage', 'naruse', 'kuga'];
  var GUESTS = ['shibasaki', 'chikage', 'naruse'];

  var OCC = {
    doctor:    { name: '医者',       intro: '町の診療所の医者' },
    painter:   { name: '画家',       intro: '絵描き' },
    developer: { name: '不動産業者', intro: '東京の不動産会社の社長' },
    writer:    { name: '作家',       intro: '小説を書いている者' },
    reporter:  { name: '新聞記者',   intro: '新聞記者' }
  };
  var PERS = {
    calm:    { name: '穏やか',   reg: 'p' },
    nervous: { name: '神経質',   reg: 'p' },
    frank:   { name: '気さく',   reg: 'c' },
    gruff:   { name: '気難しい', reg: 'r' }
  };
  var RELS = {
    daughter: { name: '娘', call: '父' },
    wife:     { name: '妻', call: '夫' },
    niece:    { name: '姪', call: '叔父' }
  };
  var DIFF = {
    easy:   { name: 'やさしい', cost: { look: 3, move: 3, talk: 6 }, hearts: 7 },
    normal: { name: 'ふつう',   cost: { look: 5, move: 5, talk: 10 }, hearts: 5 },
    hard:   { name: 'むずかしい', cost: { look: 5, move: 5, talk: 15 }, hearts: 3 }
  };

  function randomName(gender, kind) {
    var mei = kind === 'old' ? MEI.OLD : kind === 'vic' ? MEI.VIC : kind === 'det' ? MEI.DET : MEI[gender];
    return { sei: pick(kind === 'vic' ? VSEI : SEI), mei: pick(mei) };
  }

  // 設定の初期値(名前はランダム)
  function defaults(seed) {
    rnd = seed != null ? seeded(seed) : Math.random;
    var usedSei = {};
    function uniq(gender, kind) {
      for (var i = 0; i < 40; i++) { var n = randomName(gender, kind); if (!usedSei[n.sei]) { usedSei[n.sei] = 1; return n; } }
      return randomName(gender, kind);
    }
    var vic = uniq('M', 'vic');
    var cfg = {
      seed: Math.floor(Math.random() * 900000) + 100000,
      det: { sei: '烏丸', mei: '透' },
      victim: vic,
      cast: {},
      diff: 'normal',
      second: true
    };
    IDS.forEach(function (id) {
      var L = LOOKS[id];
      var n = id === 'fuyuko' ? { sei: vic.sei, mei: pick(MEI.F) } : uniq(L.gender, id === 'kuga' ? 'old' : null);
      cfg.cast[id] = { sei: n.sei, mei: n.mei, pers: L.pers, occ: L.occ || null, rel: id === 'fuyuko' ? 'daughter' : null };
    });
    rnd = Math.random;
    return cfg;
  }

  // =====================================================================
  //  事件を組み立てる
  // =====================================================================
  function generate(cfg) {
    rnd = seeded(cfg.seed);
    var DF = DIFF[cfg.diff] || DIFF.normal;

    // ---------- 人物 ----------
    var P = {};
    IDS.forEach(function (id) {
      var c = cfg.cast[id], L = LOOKS[id];
      P[id] = {
        id: id, sei: c.sei, mei: c.mei, full: c.sei + c.mei,
        gender: L.gender, age: L.age, role: L.role,
        occ: L.role === 'guest' ? (c.occ || L.occ) : null,
        pers: c.pers || L.pers,
        rel: L.role === 'family' ? (c.rel || 'daughter') : null
      };
      P[id].reg = PERS[P[id].pers].reg;
      P[id].short = id === 'fuyuko' ? c.mei : c.sei;
    });
    var V = { sei: cfg.victim.sei, mei: cfg.victim.mei, full: cfg.victim.sei + cfg.victim.mei };
    var DET = { sei: cfg.det.sei, mei: cfg.det.mei, full: cfg.det.sei + cfg.det.mei };
    var fam = P.fuyuko, srv = P.kuga;
    var famRel = RELS[fam.rel];
    var doctorId = GUESTS.filter(function (g) { return P[g].occ === 'doctor'; })[0] || null;

    // ---------- 犯人・動機・トリック ----------
    var culprit = pick(IDS);
    var cp = P[culprit];

    var motives = [];
    if (cp.role === 'family') motives = [['inherit', 2], ['embezzle', 2]];
    else if (cp.role === 'servant') motives = [['wreck_silence', 3], ['revenge', 1]];
    else {
      motives = [['revenge', 3]];
      if (cp.occ === 'developer') motives.push(['forgery', 3]);
    }
    var motive = weighted(motives);

    var Aopts = [['timer', 3], ['none', 2]];
    if (cp.occ === 'doctor') Aopts.push(['falsetod', 4]);
    var A = weighted(Aopts);

    // 出迎える人(探偵と一緒にいるのでアリバイがある)
    var houseNonCulprit = ['fuyuko', 'kuga'].filter(function (x) { return x !== culprit; });
    var greeter;
    if (A === 'timer' && (culprit === 'fuyuko' || culprit === 'kuga') && chance(0.5)) greeter = culprit;
    else greeter = houseNonCulprit.length === 2 ? (chance(0.7) ? 'fuyuko' : 'kuga') : houseNonCulprit[0];
    // 扉を破るのを手伝う人
    var helperPool = IDS.filter(function (x) { return x !== culprit && x !== greeter; });
    var helper = helperPool.indexOf('kuga') >= 0 ? 'kuga' : (helperPool.filter(function (x) { return P[x].gender === 'M'; })[0] || helperPool[0]);

    var Eopts = [['ladder', 3], ['thread', 3]];
    if (A !== 'timer' && culprit !== greeter && culprit !== helper) Eopts.push(['hide', 3]);
    var E = weighted(Eopts);

    var WEAPONS = {
      paperweight: { name: '真鍮の文鎮', desc: '灯台の形をした真鍮の文鎮。ずっしりと重い', from: '灯室の机の上にあったもの' },
      spanner:     { name: '大きなスパナ', desc: '油じみた大きなスパナ', from: 'ボイラー室の工具棚のもの' },
      ashtray:     { name: 'ガラスの灰皿', desc: '分厚いガラスの灰皿', from: 'ラウンジにあったもの' },
      bar:         { name: '短い鉄の棒', desc: '霧笛の機械の、予備の鉄の棒', from: '灯室の道具箱にあったもの' },
      bottle:      { name: '分厚い酒瓶', desc: '中身の入った、分厚いガラスの一升瓶', from: '地下の酒の棚にあったもの' }
    };
    var weaponKey = pick(Object.keys(WEAPONS));
    var W = WEAPONS[weaponKey];
    var weaponAt = E === 'ladder' ? 'gallery' : E === 'thread' ? 'hall' : 'lamproom';

    // 手袋(外梯子のとき)と糸(閂のとき)
    var GLOVES = {
      doctor:    { name: 'ゴム手袋', place: 'item', origin: '往診鞄のゴム手袋の箱。「十双入」で、残りは八双。検死で使った一双のほかに、もう一双が消えている。', kw: '往診鞄の手袋の箱' },
      painter:   { name: '布の作業手袋', place: 'item', origin: '画材箱の、いつも布手袋をしまっている仕切りが空っぽだ。', kw: '画材箱の空の仕切り' },
      developer: { name: '黒い革手袋', place: 'coat', origin: 'コートのポケットに、革手袋の替えを入れていた布袋だけが残っている。中身がない。', kw: 'コートの手袋の袋' },
      writer:    { name: '毛糸の手袋', place: 'bag', origin: '旅行鞄に、毛糸の手袋が片方だけ入っている。もう片方が見当たらない。', kw: '片方だけの毛糸の手袋' },
      reporter:  { name: '軍手', place: 'item', origin: 'カメラバッグの底に、軍手を入れていた跡がある。中身がない。', kw: 'カメラバッグの空の底' },
      family:    { name: '台所のゴム手袋', place: 'kitchen.sink', origin: '流し台の、いつもゴム手袋を掛けている釘が空いている。', kw: '台所の空の釘' },
      servant:   { name: '軍手', place: 'boiler.tools', origin: '工具棚の、軍手を束ねて置く場所から一組だけ消えている。', kw: '工具棚の軍手' }
    };
    var THREADS = {
      doctor:    { name: '縫合糸', desc: '細くて恐ろしく丈夫な、手術用の縫合糸のように見える', place: 'item', origin: '往診鞄の縫合糸の束。一本が、途中ではさみで切られている。', kw: '切られた縫合糸' },
      painter:   { name: '麻糸', desc: 'キャンバスを張るときに使うような、ざらついた麻糸', place: 'item', origin: '画材箱の麻糸の巻き。切り口が新しい。', kw: '画材箱の麻糸' },
      developer: { name: '綴じ紐', desc: '書類を綴じるための、黒くて細い紐', place: 'item', origin: '書類鞄の綴じ紐の束。一本だけ、長さが足りない。', kw: '書類鞄の綴じ紐' },
      writer:    { name: '木綿の綴じ糸', desc: '原稿を綴じるのに使う、白い木綿糸', place: 'item', origin: '原稿用紙のわきの、綴じ糸の巻き。ずいぶん減っている。', kw: '原稿の綴じ糸' },
      reporter:  { name: '釣り糸', desc: '透明で、指に食い込むほど丈夫な釣り糸', place: 'bag', origin: '鞄の中の、趣味の釣り道具。糸巻きの糸が、ごっそり減っている。', kw: '鞄の釣り道具' },
      family:    { name: '木綿糸', desc: '裁縫に使うような、白い木綿糸', place: 'kitchen.table', origin: '食堂の棚の裁縫箱。白い木綿糸の糸巻きが、新しく切られている。', kw: '裁縫箱の木綿糸' },
      servant:   { name: '釣り糸', desc: '透明で、指に食い込むほど丈夫な釣り糸', place: 'boiler.tools', origin: '工具棚の釣り道具。糸巻きの糸が、ごっそり減っている。', kw: '工具棚の釣り糸' }
    };
    function roleKey(id) { return P[id].role === 'guest' ? P[id].occ : P[id].role; }
    var glove = GLOVES[roleKey(culprit)];
    var thread = THREADS[roleKey(culprit)];
    var disposal = pick(['stove', 'trash', 'cliff', 'own']);

    // 部屋割り
    var rooms = shuffle(['room3', 'room4', 'room5']);
    var roomOf = {}; GUESTS.forEach(function (g, i) { roomOf[g] = rooms[i]; });
    var occOfRoom = {}; GUESTS.forEach(function (g) { occOfRoom[roomOf[g]] = P[g].occ; });
    var ownerOfRoom = {}; GUESTS.forEach(function (g) { ownerOfRoom[roomOf[g]] = g; });
    function placeOf(id) { return P[id].role === 'guest' ? roomOf[id] : id === 'fuyuko' ? 'kitchen' : 'boiler'; }
    // 外梯子で戻ったとき、どの窓から入ったか
    var entry = (E === 'ladder') ? ((roomOf[culprit] === 'room3' || roomOf[culprit] === 'room4') ? roomOf[culprit] : 'corridor2') : null;

    // ---------- 目撃者・隠しごと ----------
    var nonC = IDS.filter(function (x) { return x !== culprit; });
    var witness = pick(nonC.filter(function (x) { return x !== greeter; }));
    var obsPool = nonC.filter(function (x) { return x !== greeter && x !== witness && P[x].role === 'guest'; });
    if (!obsPool.length) obsPool = nonC.filter(function (x) { return x !== greeter && x !== witness; });
    var observer = obsPool.length && chance(0.85) ? pick(obsPool) : null;
    var writerPool = IDS.filter(function (x) { return x !== 'fuyuko' && x !== culprit; });
    var letterWriter = (motive === 'revenge' && chance(0.45)) ? culprit : pick(writerPool);
    var crewRel = {}; // id -> {mei, rel}
    function addCrew(id) {
      var rel = P[id].age >= 60 ? pick(['息子', '弟']) : P[id].age >= 45 ? pick(['弟', '兄']) : pick(['父', '兄']);
      var mei = pick(CREW_MEI.filter(function (m) { return !Object.keys(crewRel).some(function (k) { return crewRel[k].mei === m; }); }));
      var age = rel === '父' ? 38 + Math.floor(rnd() * 10) : rel === '息子' ? 17 + Math.floor(rnd() * 6) : 19 + Math.floor(rnd() * 10);
      crewRel[id] = { mei: mei, rel: rel, full: P[id].sei + mei, age: age, role: rel === '父' ? '船長' : pick(['甲板員', '機関員', '漁労長']) };
      if (rel === '父') crewRel[id].role = '船長';
    }
    if (motive === 'revenge') addCrew(culprit);
    if (!crewRel[letterWriter]) addCrew(letterWriter);
    var quarrel = pick(nonC.filter(function (x) { return x !== witness && x !== letterWriter; }).concat([null]));

    var wreckTruth = motive === 'wreck_silence' ? 'servant' : (chance(0.5) ? 'victim' : 'servant');

    // ---------- 時刻 ----------
    var M = A === 'timer' ? T(21, 8 + Math.floor(rnd() * 8)) : T(21, 36 + Math.floor(rnd() * 12));
    var STOKE = pick([T(25, 0), T(25, 30), T(26, 0), T(26, 30)]);
    var ATT = cfg.second ? pick([T(25, 30), T(26, 0), T(26, 30), T(27, 0), T(27, 30)]) : null;
    var CATCH = pick([T(23, 0), T(23, 30), T(24, 0)]);
    var CONF = T(24, 30);
    var target = cfg.second ? witness : null;
    var loungeUntil = {}; GUESTS.forEach(function (g) { loungeUntil[g] = pick([T(23, 0), T(23, 30), T(24, 0), T(24, 30)]); });

    function hm(t) { var h = Math.floor(t / 60) % 24, m = t % 60; return h + ':' + (m < 10 ? '0' : '') + m; }
    function kanjiTime(t) { // 九時三十六分
      var K = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
      var h = Math.floor(t / 60) % 24; if (h > 12) h -= 12; if (h === 0) h = 12;
      var m = t % 60, ms = '';
      if (m) { var tens = Math.floor(m / 10), ones = m % 10; ms = (tens ? (tens > 1 ? K[tens] : '') + '十' : '') + (ones ? K[ones] : '') + '分'; }
      return K[h] + '時' + ms;
    }

    // ---------- 文の部品 ----------
    function reg(sp) { return sp && P[sp] ? P[sp].reg : 'p'; }
    function pron(sp) {
      var p = P[sp]; if (!p) return '私';
      if (p.reg === 'p') return '私';
      if (p.reg === 'c') return p.gender === 'M' ? '僕' : '私';
      return p.gender === 'M' ? '俺' : 'あたし';
    }
    function callV(sp) {
      if (sp === 'fuyuko') return famRel.call;
      if (sp === 'kuga') return '旦那';
      if (sp === 'me') return V.sei + 'さん';
      return V.sei + 'さん';
    }
    function fmt(sp, s) {
      return String(s)
        .replace(/〔([^|〕]*)\|([^〕]*)〕/g, function (m, a, b) { return reg(sp) === 'p' ? a : b; })
        .replace(/\{(\w+)(?::(\w+))?\}/g, function (m, k, a) {
          switch (k) {
            case 'I': return pron(sp);
            case 'V': return callV(sp);
            case 'VN': return V.full;
            case 'VS': return V.sei;
            case 'D': return DET.full;
            case 'DS': return DET.sei;
            case 'n': return P[a].full;
            case 's': return P[a].short;
            case 'occ': return P[a].occ ? OCC[P[a].occ].name : (a === 'fuyuko' ? famRel.name : '下働き');
            case 'W': return W.name;
            case 'na': return P[sp] && P[sp].gender === 'F' ? 'ね' : 'な';
            case 'nai': return P[sp] && P[sp].id === 'kuga' && P[sp].reg === 'r' ? 'ねえ' : 'ない';
          }
          return m;
        });
    }
    function S(sp, expr, s) { return '@' + sp + (expr ? ':' + expr : '') + ' ' + fmt(sp, s); }
    function N(s) { return fmt(null, s); }
    function ME(s) { return '@me ' + fmt('me', s); }
    function names(list) { return list.map(function (x) { return P[x].full; }).join('、'); }
    function shortOf(x) { return P[x].short; }
    var cN = cp.full;

    // =================================================================
    //  証拠品とキーワード
    // =================================================================
    var CLUES = {}, KW = {};
    function clue(id, name, desc, kw) { CLUES[id] = { name: name, desc: desc, kw: kw || null }; }
    function kw(id, name, decoy) { KW[id] = { name: name, decoy: !!decoy }; }

    clue('letter', V.sei + 'からの手紙', '「二十年目の霧の夜、灯を消した者に報いを」という差出人不明の手紙が届いている。十一月十四日の夜に来てほしい、話さねばならないことがある——という依頼の手紙。');
    if (A === 'timer') {
      clue('horn', '九時半の霧笛', '霧笛荘に着いてすぐ、玄関ホールで九時半の霧笛を聞いた。長い音が一度きり。節回しはなかった。', 'k_single');
      kw('k_single', '一度きりの長い霧笛');
    } else {
      clue('horn', '九時半の霧笛', '霧笛荘に着いてすぐ、玄関ホールで九時半の霧笛を聞いた。長く、短く、長く——不思議な節回しだった。', 'k_horn');
      kw('k_horn', '九時半の霧笛');
    }
    clue('pattern', '長・短・長の合図', V.sei + 'だけの霧笛の鳴らし方。灯台守のころからの「異常なし」の合図で、ほかの誰も真似しない。', 'k_pattern');
    kw('k_pattern', '長・短・長の合図');
    clue('bolt', '灯室の閂', '灯室の扉(階段側)は、内側から閂がかかっていた。');
    clue('cups', '二つのカップ', '灯室の机に、カップが二つ。一つにはコーヒーが残り、もう一つは空だが内側が濡れていた。' + V.sei + 'は誰かを灯室に招き、一緒にコーヒーを飲んだ。顔見知りの犯行だ。');
    clue('watchkey', '懐中時計の鍵', V.sei + 'の懐中時計の鎖についていた、小さな真鍮の鍵。');
    clue('weapon', W.name, W.desc + '。血がついている。' + W.from + 'だ。凶器と見て間違いない。');
    clue('phone_dead', '不通の電話', '玄関ホールの電話は、夕方から不通。');
    clue('letters', '脅迫状', '書斎の机にあった封筒の束。「二十年目の霧の夜、灯を消した者に報いを」。');
    clue('scrapbook', '第三清丸の記事', '昭和三十三年十一月十五日の新聞。漁船・第三清丸が岬の岩に乗り上げ、乗組員七名が死亡。「灯台の灯は正常に点灯していた」と灯台守の' + V.sei + 'は証言した。');
    var crewNames = Object.keys(crewRel).map(function (k) { return crewRel[k].role + '・' + crewRel[k].full + '(' + crewRel[k].age + ')'; });
    clue('crewlist', '第三清丸の乗組員', '亡くなった七人の名前。' + crewNames.join('、') + 'ほか。', null);
    clue('draft', V.sei + 'の告白書', '');
    if (E === 'ladder' && A !== 'timer' && culprit !== greeter && culprit !== helper) clue('wet_hair', shortOf(culprit) + 'の濡れた髪', '遺体の発見直後、灯室にあらわれた' + cN + 'の髪は、しっとりと濡れていた。');

    // 検死
    var todText = '';
    if (doctorId) {
      var dTrue = (A === 'timer') ? '九時から九時四十分の間' : '九時半から十時の間';
      if (doctorId === culprit && A === 'falsetod') todText = '九時五分から二十分の間';
      else if (doctorId === culprit) todText = '九時半から十時の間';
      else todText = dTrue;
      clue('tod', shortOf(doctorId) + 'の検死', '後頭部を一撃。死亡は「' + todText + '」と' + P[doctorId].full + 'は言った。');
    } else {
      clue('tod', '遺体の見立て', '医者はいない。体のぬくもりから見て、亡くなってまだ一時間はたっていない——私の見立てでは、それ以上は分からない。');
    }

    // 時刻のトリック
    if (A === 'timer') {
      clue('device', 'レバーの仕掛け', '霧笛のレバーの根元に、溶けたろうの跡と、焼け切れた紐の端。床に砂袋。ろうそくが紐を焼き切ると、砂袋が落ちてレバーが引かれる仕掛けだ。', 'k_device');
      kw('k_device', 'ろうそくの仕掛け');
    }
    // 脱出のトリック
    if (E === 'ladder') {
      clue('ladder', '回廊の外梯子', '回廊の手すりの切れ目から、細い鉄梯子が塔の外壁にそって別館の屋根まで下りている。', 'k_ladder');
      clue('paint', '乾かない赤い塗料', '外梯子の段には、二日前に塗った赤い錆止めが雨で乾かずに残っている。段に、最近だれかが下りた擦れ跡がある。', 'k_paint');
      clue('annex', '梯子の行き先', '外梯子が下りている別館の屋根に面した窓は、3号室と4号室、それに二階の廊下の突き当たりの窓だけ。', 'k_annex');
      clue('trace', '赤く染まった' + glove.name, '塗料で真っ赤に染まった' + glove.name + '。' + ({ stove: 'ラウンジの薪ストーブの灰の中から出てきた。', trash: '食堂のごみ箱の底から出てきた。', cliff: '崖の柵にひっかかっていた。海に投げ捨てようとしたのだろう。', own: '持ち主の荷物の中に、丸めて押しこまれていた。' })[disposal], 'k_trace');
      clue('origin', glove.kw, glove.origin, 'k_origin');
      clue('mark', entry === 'corridor2' ? '廊下の窓の赤い跡' : P[ownerOfRoom[entry]].short + 'の部屋の窓の赤い跡', (entry === 'corridor2' ? '二階の廊下の突き当たりの窓' : entry.replace('room', '') + '号室の窓') + 'の窓枠に、拭き取りきれなかった赤い跡。外梯子の塗料と同じ色。', 'k_mark');
      kw('k_ladder', '回廊の外梯子'); kw('k_paint', '乾かない赤い塗料'); kw('k_annex', '別館の屋根の窓');
      kw('k_trace', glove.name); kw('k_origin', cN + '——' + glove.kw); kw('k_mark', CLUES.mark.name);
      clue('hands', 'みんなの手', '手を見せてもらった人のうち、赤い塗料のついた人はいなかった。犯人は手袋をしていたのだ。');
    } else if (E === 'thread') {
      clue('thread_trick', '閂の糸くず', '閂の頭に、細い糸の切れはしがからみついていた。受け金には新しいこすれ傷。扉の下には、糸を通せる隙間がある。外から糸で閂を引いたのだ。', 'k_thread');
      clue('thread_origin', thread.kw, thread.origin + ' 閂の糸くずと同じものだ。', 'k_torigin');
      kw('k_thread', '閂の糸くず'); kw('k_torigin', cN + '——' + thread.kw); kw('k_threadkind', thread.name);
      CLUES.thread_trick.kw = 'k_thread';
      clue('bucket', '砂バケツの凶器', '玄関ホールの、灯台の扉のわきの消火用の砂バケツに、凶器が突っこまれていた。犯人は階段から下りてきたのだ。', 'k_bucket');
      kw('k_bucket', '砂バケツの凶器');
    } else {
      clue('tarp', 'レンズの陰の防水布', 'レンズのわきの防水布の裾がめくれ、内側の床に靴の跡。誰かがここに潜んでいた。', 'k_tarp');
      clue('powder', 'こぼれた磨き粉', 'レンズの台座のわきで、磨き粉の缶が倒れ、白い粉がこぼれていた。防水布の陰まで、点々とつづいている。', 'k_powder');
      clue('behind', 'いつの間にか後ろにいた人', '扉を破った直後、' + cN + 'が私たちのすぐ後ろに立っていた。階段を上がってくる足音は、聞こえなかった。', 'k_behind');
      clue('powder_on', shortOf(culprit) + 'の服の白い粉', cN + 'の服の袖と裾に、レンズの磨き粉と同じ白い粉がついていた。', 'k_powderon');
      kw('k_tarp', 'レンズの陰の防水布'); kw('k_powder', '白い磨き粉'); kw('k_behind', '後ろに立っていた人'); kw('k_powderon', cN + 'の服の白い粉');
    }

    // 目撃者
    var witnessT = A === 'timer' ? M + 6 : E === 'ladder' ? M + 10 : E === 'thread' ? M + 8 : M - 6;
    var witnessSaw = (function () {
      var wt;
      if (A === 'timer') {
        wt = kanjiTime(M + 6);
        if (E === 'ladder') return { time: wt, text: wt + 'ごろ、二階の廊下で' + cN + 'とすれ違った。髪も肩もずぶ濡れで、手を後ろに隠していた' };
        return { time: wt, text: wt + 'ごろ、灯台の扉から' + cN + 'が出てきて、そっと扉を閉めるのを見た' };
      }
      if (E === 'ladder') { wt = kanjiTime(M + 10); return { time: wt, text: wt + 'ごろ、二階の廊下で' + cN + 'とすれ違った。髪がずぶ濡れだった' }; }
      if (E === 'thread') { wt = kanjiTime(M + 8); return { time: wt, text: wt + 'ごろ、灯台の扉から' + cN + 'が出てきて、そっと扉を閉めるのを見た' }; }
      wt = kanjiTime(M - 6); return { time: wt, text: wt + 'ごろ、' + cN + 'が灯台の扉を開けて、階段を上がっていくのを見た。そのあと、下りてくるのは見なかった' };
    })();
    clue('testi', P[witness].short + 'の証言', witnessSaw.text + '。(' + P[witness].full + ')', 'k_gap');
    kw('k_gap', P[witness].full + 'の証言');
    // 忍び込みの証拠(目撃者の隠しごと)
    var sneakWhat = (function () {
      var w = P[witness];
      if (w.occ === 'developer') return { thing: '土地の権利書', ev: '鞄の中の売買契約書。売主の欄の' + V.sei + 'の署名は、筆跡がまるで違う。偽造だ。', evName: '偽の契約書', place: 'bag' };
      if (w.role === 'family') return { thing: '遺言状', ev: '食堂の引き出しに、書斎の机の鍵穴に合わせて曲げた針金と、「遺言状 書斎の右」と書いたメモ。', evName: '曲げた針金とメモ', place: 'kitchen.table' };
      if (w.role === 'servant') return { thing: '昔の借用証文', ev: '工具棚に、書斎の鍵穴に合わせて曲げた針金。', evName: '曲げた針金', place: 'boiler.tools' };
      if (w.occ === 'doctor') return { thing: '昔の診療記録', ev: '往診鞄に、書斎の鍵穴に合わせて曲げた針金。医者の持ち物とは思えない。', evName: '曲げた針金', place: 'item' };
      return { thing: '二十年前の日誌', ev: '鞄の中に、書斎の鍵穴に合わせて曲げた針金と、「昭和三十三年の日誌」と書いたメモ。', evName: '曲げた針金とメモ', place: 'bag' };
    })();
    clue('sneak_ev', sneakWhat.evName, sneakWhat.ev + '(' + P[witness].full + 'の持ち物)');

    // 外から見ていた人
    var obsRecord = null;
    if (observer) {
      var o = P[observer];
      var kind = o.occ === 'painter' ? 'sketch' : (o.occ === 'reporter' || o.occ === 'writer') ? 'memo' : 'word';
      var seen;
      if (A === 'timer') seen = '九時半、霧笛が鳴ったとき、灯った灯室の窓に、人影はひとつもなかった。レバーのそばには、誰もいなかった';
      else if (E === 'ladder') seen = kanjiTime(M - 3) + '、灯室の中に人影が二つ。そのすぐあと、塔の外壁を、黒い影が這い下りていった';
      else seen = kanjiTime(M - 3) + '、灯室の中に人影が二つ。レバーのそばに立つ人と、その背後にもうひとり';
      obsRecord = { kind: kind, seen: seen, name: kind === 'sketch' ? '崖の上のスケッチ' : kind === 'memo' ? '崖の上のメモ' : P[observer].short + 'の見たもの' };
      clue('obs', obsRecord.name, seen + '。(' + o.full + 'が崖の上から見ていた)', 'k_obs');
      kw('k_obs', obsRecord.name);
      clue('coat_' + observer, o.short + 'の濡れたコート', o.full + 'のコートはぐっしょり濡れ、裾に泥がはねていた。今夜、雨の中を外に出ていた。');
      clue('footprints', '崖の足跡', '崖の小道のぬかるみに、' + (o.gender === 'F' ? '女物のブーツ' : '男物の革靴') + 'の跡。屋敷の裏口のほうへつづいている。');
    }

    // 脅迫状の主
    var lw = P[letterWriter];
    var PAPER = {
      painter: ['厚手の画用紙', 'スケッチブックの最後の数枚が、切り取られている。紙は脅迫状と同じ厚手の画用紙。', 'item'],
      writer: ['原稿用紙の裏', '原稿用紙の束。脅迫状と同じ、うすい升目が裏にすけている。', 'item'],
      reporter: ['新聞社の便箋', '新聞社の名前入りの便箋。透かしの模様が、脅迫状の紙と同じだ。', 'item'],
      doctor: ['処方箋の用紙', '往診鞄の処方箋の綴り。脅迫状の紙は、この用紙の裏だったのだ。', 'item'],
      developer: ['会社の便箋', '会社の便箋。頭の社名を切り落とせば、脅迫状の紙と同じものになる。', 'item'],
      servant: ['灯台の業務日誌の紙', '工具棚の古い業務日誌。最後の数枚が破り取られている。紙は脅迫状と同じだ。', 'boiler.tools']
    }[roleKey(letterWriter)];
    CLUES.letters.desc += '紙は' + PAPER[0] + 'のようだ。';
    clue('paper_match', '脅迫状の紙', PAPER[1] + '(' + lw.full + 'の持ち物)');
    clue('keep_' + letterWriter, lw.short + 'の古い写真', '古い写真。漁船の前で笑う男と、若いころの' + lw.full + '。裏に「' + crewRel[letterWriter].full + '」。');
    if (motive === 'revenge' && letterWriter !== culprit) {
      clue('keep_' + culprit, cp.short + 'の古い写真', '古い写真。漁船の前で笑う若い男と、' + cN + '。裏に「' + crewRel[culprit].full + '」。');
    }

    // 動機
    var MOT = {};
    if (motive === 'revenge') {
      var cr = crewRel[culprit];
      MOT = { kwName: cr.full, clues: ['crewlist', 'keep_' + culprit],
        q: '第三清丸で死んだ' + cr.role + '・【＿】。' + cN + 'の' + cr.rel + 'だ。',
        claim: [S(culprit, 'angry', 'なぜ{I}が、{VS}さんを殺さねばならない〔のです|んだ〕。理由がない〔でしょう|だろう〕。')],
        ok: [ME('二十年前の今夜。漁船、第三清丸が岬で沈んだ。亡くなった七人の中に——' + cr.role + '、' + cr.full + 'さんがいた。'), ME('あなたの、' + cr.rel + 'さんですね。')] };
      kw('k_motive', cr.full);
    } else if (motive === 'inherit') {
      clue('will', '遺言書の下書き', '書斎の書類の山にあった遺言書の下書き。「明日、全財産を灯台保存会に寄付する」。' + fam.full + 'には何も残らない。日付は明日。');
      clue('debts', '督促状の束', '食堂の棚に隠された督促状の束。宿の借金は、とうに返せる額ではなくなっていた。宛名は' + fam.full + '。');
      MOT = { kwName: '書き換えられる遺言', clues: ['will', 'debts'], q: 'そして、' + V.sei + 'は明日、【＿】を作るつもりだった。',
        claim: [S(culprit, 'angry', '{I}が{V}を? ……そんな理由、どこにある〔のですか|の〕。')],
        ok: [ME('書斎に、遺言書の下書きがありました。明日、全財産を灯台の保存会に寄付する、と。'), ME('宿の借金は、もう返せる額じゃなかった。今夜を過ぎれば、あなたには何も残らなかった。')] };
      kw('k_motive', '書き換えられる遺言');
    } else if (motive === 'embezzle') {
      clue('ledger', '帳簿の穴', '書斎の書類の山にあった宿の帳簿。三年にわたって、毎月の売上の一部が消えている。余白に' + V.sei + 'の字で「' + fam.mei + 'と話す。明朝、警察へ」。');
      MOT = { kwName: '帳簿の穴', clues: ['ledger'], q: V.sei + 'は、宿の【＿】に気づいていた。',
        claim: [S(culprit, 'angry', '{I}が{V}を殺す理由なんて、どこにもない〔でしょう|じゃない〕。')],
        ok: [ME('書斎の帳簿。三年にわたって、売上の一部が消えている。余白に、宗一郎さんの字で——'.replace('宗一郎', V.sei)), ME('「' + fam.mei + 'と話す。明朝、警察へ」。あなたは、明日の朝が来る前に口をふさいだ。')] };
      kw('k_motive', '帳簿の穴');
    } else if (motive === 'forgery') {
      clue('lawyer', '弁護士への手紙', '書斎の机にあった、' + V.sei + 'から弁護士への手紙の下書き。「' + cN + '氏による契約書の偽造について、明朝、警察に届け出る」。');
      clue('forged', '偽の契約書', cN + 'の鞄の中の売買契約書。売主の欄の' + V.sei + 'の署名は、筆跡がまるで違う。');
      MOT = { kwName: '弁護士への手紙', clues: ['lawyer', 'forged'], q: V.sei + 'は、偽の契約書を見抜いていた。書斎には【＿】があった。',
        claim: [S(culprit, 'angry', '{I}が{VS}さんを殺して、何の得がある〔んです|んだ〕。')],
        ok: [ME('書斎に、弁護士への手紙の下書きがありました。あなたによる契約書の偽造を、明朝、警察に届け出る、と。')] };
      kw('k_motive', '弁護士への手紙');
    } else { // wreck_silence
      MOT = { kwName: V.sei + 'の告白書', clues: ['draft'], q: V.sei + 'は今夜、二十年前の真実を明かすつもりだった。【＿】に、その名が書かれていた。',
        claim: [S(culprit, 'angry', '{I}が旦那を殺す? 四十年も一緒にやってきた{I}が、なんで〔です|だ〕。')],
        ok: [ME('書斎の引き出しに、' + V.sei + 'さんの書きかけの告白書がありました。'), ME('「灯を消したのは、' + srv.mei + 'です」。……今夜、すべてを話すつもりだったんです。')] };
      kw('k_motive', V.sei + 'の告白書');
    }
    CLUES.draft.kw = motive === 'wreck_silence' ? 'k_motive' : null;
    if (motive === 'revenge') { CLUES.crewlist.kw = 'k_motive'; CLUES['keep_' + culprit].kw = 'k_motive'; }
    if (motive === 'inherit') { CLUES.will.kw = 'k_motive'; CLUES.debts.kw = 'k_motive'; }
    if (motive === 'embezzle') CLUES.ledger.kw = 'k_motive';
    if (motive === 'forgery') { CLUES.lawyer.kw = 'k_motive'; CLUES.forged.kw = 'k_motive'; }

    // 告白書の文面
    var draftText;
    if (wreckTruth === 'victim') {
      draftText = '昭和三十三年十一月十四日の夜。この灯台の灯は、四十分のあいだ消えておりました。\n\n灯を消したのは、私です。\n当直の夜に酒を飲み、眠りこんでしまったのです。目をさましたときには、岬で船が——。\n\n私は「灯は点いていた」と嘘をつき、七人の命と、船長の名誉を踏みにじったまま、二十年を生きてまいりました。\n\n今夜、' + DET.sei + '様にすべてをお話しし、夜が明けたら警察にも名乗り出るつもりです。脅迫状の主が誰であれ、その方の言うとおりなのです。';
      CLUES.draft.desc = '書斎の鍵のかかった引き出しにあった書きかけの手紙。「灯を消したのは、私です」。二十年前の夜の真相と、今夜すべてを明かすつもりだったことが書かれている。';
    } else if (motive === 'wreck_silence') {
      draftText = '昭和三十三年十一月十四日の夜。この灯台の灯は、四十分のあいだ消えておりました。\n\n灯を消したのは、' + srv.mei + 'です。当直の夜に酒を飲み、眠りこんでしまった。\nけれども私は、友をかばって「灯は点いていた」と嘘をつき、二十年のあいだ口をつぐんでまいりました。\n\n今夜、' + DET.sei + '様にすべてをお話しします。' + srv.mei + 'にも、自分の口で話すよう勧めました。あの男は、ひどく取り乱しておりましたが——';
      CLUES.draft.desc = '書斎の鍵のかかった引き出しにあった書きかけの手紙。「灯を消したのは、' + srv.mei + 'です」。今夜すべてを明かすつもりだったことが書かれている。';
    } else {
      draftText = '昭和三十三年十一月十四日の夜。この灯台の灯は、四十分のあいだ消えておりました。\n\n灯を消したのは、私ではありません。\nけれども私は、それを知りながら、二十年のあいだ口をつぐんでまいりました。あの男をかばうことが、友への情けだと思っておりました。\n\n黙っていた私の罪は、灯を消した者の罪よりも、重いのかもしれません。\n\n今夜、私は';
      CLUES.draft.desc = '書斎の鍵のかかった引き出しにあった書きかけの手紙。「灯を消したのは、私ではない。私はある男をかばって、二十年口をつぐんできた」。';
    }

    // まぎらわしいキーワード(使われなかったトリックの部品など)
    var DECOYS = ['螺旋階段', '灯室の合鍵', '霧笛のロープ', '濡れたコート', '割れたレンズ', '止まった時計', '裏口の足跡', '二階の物音', '検死の時刻', '不通の電話'];
    if (E !== 'ladder') DECOYS.push('回廊の外梯子', '乾かない赤い塗料', 'ゴム手袋');
    if (E !== 'thread') DECOYS.push('閂の糸くず', '釣り糸');
    if (E !== 'hide') DECOYS.push('レンズの陰の防水布', '白い磨き粉');
    if (A !== 'timer') DECOYS.push('ろうそくの仕掛け', '一度きりの長い霧笛');
    nonC.forEach(function (x) { DECOYS.push(P[x].full + 'の持ち物'); });
    IDS.filter(function (x) { return x !== witness; }).forEach(function (x) { DECOYS.push(P[x].full + 'の証言'); });
    DECOYS.push('脅迫状', '第三清丸の船長');
    shuffle(DECOYS).slice(0, 14).forEach(function (d, i) { kw('d' + i, d, true); });

    // =================================================================
    //  人物の紹介文
    // =================================================================
    var CHARS = {
      me: { name: DET.full, short: DET.sei, portrait: 'karasuma' },
      haitani: { name: V.full, short: V.sei, portrait: 'haitani', prof: '68歳。霧笛荘の主人で、元灯台守。十一月十四日の夜、灯室で殺された。', more: [['c:draft', '二十年前の夜の秘密を、今夜明かすつもりだった。']] }
    };
    IDS.forEach(function (id) {
      var p = P[id];
      var prof = p.age + '歳。';
      if (p.role === 'family') prof += '霧笛荘の女主人で、' + V.sei + 'の' + famRel.name + '。赤字続きの宿を切り盛りしている。';
      else if (p.role === 'servant') prof += V.sei + 'と若いころから一緒に灯台を守ってきた男。今は地下に住み、屋敷の雑用をしている。';
      else prof += OCC[p.occ].intro + '。' + roomOf[id].replace('room', '') + '号室に泊まっている。';
      prof += '(性格:' + PERS[p.pers].name + ')';
      var more = [];
      if (crewRel[id]) {
        var F = p.gender === 'F';
        var me2 = ({ '父': F ? '娘' : '息子', '兄': F ? '妹' : '弟', '弟': F ? '姉' : '兄', '息子': F ? '母' : '父' })[crewRel[id].rel];
        more.push(['c:keep_' + id, '第三清丸で死んだ' + crewRel[id].full + 'の' + me2 + 'にあたる。']);
      }
      if (id === letterWriter) more.push(['f:letters_' + id, '脅迫状を書いたことを認めた。']);
      if (id === witness) more.push(['c:testi', '今夜のことで嘘をついていた。']);
      if (id === observer) more.push(['f:out_' + id, '事件のころ、崖の上にいた。']);
      if (target === id) more.push(['f:dead_' + id, '午前' + kanjiTime(ATT).replace('時', '時') + 'すぎ、殺された。']);
      CHARS[id] = { name: p.full, short: p.short, portrait: id, prof: prof, more: more };
    });

    // =================================================================
    //  居場所
    // =================================================================
    function whereIs(id, st) {
      var t = st.time, f = st.flags;
      if (f['dead_' + id]) return null;
      if (id === culprit && ATT && !f.attack_done && t >= ATT - 15 && t < ATT) return null; // 犯人が姿を消す
      if (id === witness && !f.caught && t >= CATCH && t < CATCH + 40) return 'study';
      if (id === 'fuyuko') return t < T(24, 30) ? 'kitchen' : 'lounge';
      if (id === 'kuga') return (t >= STOKE - 20 && t < STOKE + 10) ? 'lounge' : 'boiler';
      return t < loungeUntil[id] ? 'lounge' : roomOf[id];
    }

    // =================================================================
    //  調べる
    // =================================================================
    var EX = {};
    function ex(loc, id, name, s, again) { (EX[loc] = EX[loc] || {})[id] = { name: name, s: s, again: again }; }
    // 物の置き場所(手袋の持ち主など)に台本を差しこむ
    var EXTRA = {}; // 'room3.item' -> [script...]
    function extraAt(placeKey, ownerId, lines) {
      var key = placeKey.indexOf('.') >= 0 ? placeKey : roomOf[ownerId] + '.' + placeKey;
      (EXTRA[key] = EXTRA[key] || []).push(lines);
    }
    function withExtra(key, base) {
      return function (st) {
        var s = typeof base === 'function' ? base(st) : base.slice();
        (EXTRA[key] || []).forEach(function (L) { s = s.concat(typeof L === 'function' ? L(st) : L); });
        return s;
      };
    }

    // ---- 灯室 ----
    ex('lamproom', 'body', V.sei + 'の遺体', [
      V.full + '、六十八歳。うつぶせに倒れ、後頭部に深い傷がある。',
      '背後から、ためらいなく一撃。……正面から殴りかかられたのなら、こうはならない。',
      '(' + V.sei + 'は、犯人に背中を見せていた。気を許していた相手だ)',
      'ズボンのポケットに懐中時計。鎖の先に、小さな真鍮の鍵がついている。',
      { clue: 'watchkey' },
      { flag: 'sheet' },
      '私は、白い布をそっと遺体にかけた。'
    ], ['白い布の下で、' + V.sei + 'が眠っている。']);
    ex('lamproom', 'weapon', '遺体のそばの床', weaponAt === 'lamproom' ? [
      '遺体のすぐそばに、' + W.name + 'が転がっていた。',
      W.desc + '。血がべっとりとついている。' + W.from + 'だ。',
      { se: 'heartbeat' },
      '(犯人は、これを持ち去らなかった。……持ち去る必要がなかったのか。それとも、持って出られなかったのか)',
      { clue: 'weapon' }, { flag: 'weapon_taken' }
    ] : ['床には、ガラスの破片が散っているだけだ。'], ['凶器のあった場所。']);
    ex('lamproom', 'lens', '大きなレンズ', E === 'hide' ? [
      'フレネルレンズ。いくつものガラスの輪を重ねた、灯台の「目」だ。',
      '台座のわきで、レンズの磨き粉の缶が倒れ、白い粉がこぼれている。',
      '粉は点々と、レンズの陰の防水布のほうへつづいていた。',
      { clue: 'powder' },
      '(誰かが、ここを踏んで歩いた)'
    ] : [
      'フレネルレンズ。いくつものガラスの輪を重ねた、灯台の「目」だ。',
      'ところどころひびが入っている。十年前に灯台が役目を終えてから、手入れされていないのだろう。',
      '台座のわきに、レンズの磨き粉の缶。きちんとふたが閉まっている。'
    ]);
    ex('lamproom', 'tarp', '防水布', E === 'hide' ? [
      'レンズのわきに垂れ下がった、大きな防水布。',
      '裾がめくれあがっている。めくってみると——内側の床に、靴の跡と、白い粉。',
      { se: 'heartbeat' },
      '(人ひとりが、じゅうぶん隠れられる)',
      { clue: 'tarp' },
      '(扉を破ったとき、犯人はまだここにいたのか……?)'
    ] : ['埃をかぶった防水布。裾には埃が積もったままで、長いこと動かされた様子はない。']);
    ex('lamproom', 'bolt_door', '階段側の扉', E === 'thread' ? [
      '階段へつづく鉄の扉。内側に、太い閂がついている。',
      '私たちが扉を破ったとき、閂は確かに受け金に差しこまれていた。',
      '……閂の頭に、何かがからみついている。',
      '細い糸の切れはしだ。' + thread.desc + '。',
      '受け金には新しいこすれ傷。扉の下には、糸を通せるほどの隙間がある。',
      { clue: 'thread_trick' }, { clue: 'bolt' },
      '(犯人は階段から出ていき、扉の下から糸で閂を引いたのだ!)'
    ] : [
      '階段へつづく鉄の扉。内側に、太い閂がついている。',
      '私たちが扉を破ったとき、閂は確かに受け金に差しこまれていた。金具ごとはじけ飛んだのがその証拠だ。',
      '外から閂を動かすような細工の跡はない。',
      { clue: 'bolt' },
      '(犯人は、この扉から出ていったのではない)'
    ]);
    ex('lamproom', 'gallery_door', '回廊へのガラス戸', E === 'ladder' ? [
      '回廊へ出るガラス戸は、開け放たれていた。吹きこむ雨で、戸口の床が濡れている。',
      '戸の取っ手に、何か赤いものがついている。血ではない。もっとあざやかな、塗料のような【赤】だ。',
      '(回廊を調べてみる必要がありそうだ)'
    ] : [
      '回廊へ出るガラス戸。閉じていて、掛け金は内側からかかっている。',
      '(回廊から出入りした者はいない。……犯人は、どこから消えた?)'
    ]);
    ex('lamproom', 'desk', '小さな机', [
      '小さな机に、トランジスタラジオと魔法瓶、カップが二つ。',
      '一つにはコーヒーが半分ほど残っている。もう一つは空だが、内側が濡れている。',
      { clue: 'cups' },
      '(' + V.sei + 'は、ここで誰かと一緒にコーヒーを飲んだ。自分から、その人物を灯室に招き入れたのだ)'
    ]);
    ex('lamproom', 'foghorn', '霧笛のレバー', A === 'timer' ? [
      '霧笛を鳴らすための大きなレバー。体重をかけなければ動かないほど重い。',
      '……レバーの根元に、白いものがこびりついている。溶けた、ろうだ。',
      'そばに焼け切れた紐の端。床には、重たい砂袋がひとつ転がっている。',
      { se: 'heartbeat' },
      { clue: 'device' },
      '(ろうそくが紐を焼き切れば、砂袋が落ちて、レバーが引かれる。……人がいなくても、霧笛は鳴る!)'
    ] : [
      '霧笛を鳴らすための大きなレバー。体重をかけなければ動かないほど重い。',
      '握りには、すりきれた革が巻いてある。何十年も、同じ手が握ってきたのだろう。',
      '(九時半の霧笛を鳴らしたのは、誰だ?)'
    ]);
    ex('lamproom', 'oillamp', '石油ランプ', [
      '古い石油ランプが、静かに揺れている。今夜、' + V.sei + 'が灯したものだ。',
      '毎年この夜だけ、ここに灯をともしていたという。',
      '(二十年前の今夜。……この灯台で、何があったのか)'
    ]);

    // ---- 回廊 ----
    ex('gallery', 'weapon', '回廊の床', weaponAt === 'gallery' ? [
      W.name + 'が、回廊の床に落ちていた。',
      W.desc + '。底のほうに、べっとりと血がついている。' + W.from + 'だ。',
      { se: 'heartbeat' },
      '(犯人は殴ったあと、これを持ったまま回廊に出て、ここで手放した。……逃げるのに、両手が必要だったからだ)',
      { clue: 'weapon' }, { flag: 'weapon_taken' }
    ] : ['雨に濡れた床。何も落ちていない。'], ['凶器のあった場所。雨が血のあとを洗い流していく。']);
    ex('gallery', 'ladder', '外梯子', E === 'ladder' ? [
      '手すりの切れ目から、細い鉄梯子が塔の外壁にそって下へのびている。下は別館の平らな屋根だ。',
      { clue: 'ladder' },
      '段には、真新しい赤い塗料。指で触れると——',
      { fx: 'red' }, { se: 'heartbeat' },
      '……べったりと、指先が【赤く】染まった。乾いていない。',
      '段のあちこちに、何かでこすったような跡。最近、誰かがここを下りたのだ。',
      { clue: 'paint' },
      '(犯人はこの梯子で逃げた。……その手は、真っ赤に染まったはずだ)'
    ] : [
      '手すりの切れ目から、細い鉄梯子が塔の外壁にそって下へのびている。',
      '段には赤い塗料。指で触れると、まだ乾いていない。',
      'だが、塗料の面はなめらかなままだ。誰かが手をかけた跡はどこにもない。',
      { flag: 'ladder_clean' },
      '(この梯子は使われていない)'
    ]);
    ex('gallery', 'railing', '手すり', ['濡れた鉄の手すり。その向こうは断崖だ。', { se: 'wave' }, '黒い海が、岩に当たって白く砕けている。', '(二十年前、この海で七人が死んだ……)']);
    ex('gallery', 'window', '灯室の窓', ['回廊からは、ガラス越しに灯室の中がよく見える。', '外から灯室を見れば、ランプに照らされた人影は丸見えだったはずだ。', '(今夜、外から灯室を見ていた者はいないだろうか)']);

    // ---- 前庭 ----
    ex('exterior', 'tower', '灯台', ['霧の中に、灯室がぼんやりと浮かんでいる。', '誰もいなくなった灯室で、石油ランプだけが揺れている。']);
    ex('exterior', 'ladder', '塔の外梯子', ['塔の外壁を、細い鉄梯子が這い下りている。上は回廊、下は別館の屋根だ。']);
    ex('exterior', 'annex', '別館の屋根', [
      '二階建ての別館の、平らな屋根。外梯子はここに下りている。',
      '屋根に面した窓は、3号室と4号室、それに二階の廊下の突き当たりの窓。',
      E === 'ladder' ? { clue: 'annex' } : { flag: 'saw_annex' },
      '(3号室は' + P[ownerOfRoom.room3].full + '、4号室は' + P[ownerOfRoom.room4].full + 'の部屋だ)'
    ]);
    ex('exterior', 'sea', '海', [{ se: 'wave' }, '霧の向こうで、波が岩を打つ音だけが聞こえる。']);
    ex('exterior', 'frontdoor', '玄関', ['霧笛荘の玄関。ここに着いたのは、九時二十五分だった。']);

    // ---- 玄関ホール ----
    ex('hall', 'phone', '電話', ['黒いダイヤル式の電話。受話器を耳にあてても、何の音もしない。', { clue: 'phone_dead' }, '(完全に不通だ)']);
    ex('hall', 'clock', '柱時計', ['大きな柱時計。振り子が重々しく揺れている。', '今は【{time}】。朝の六時には、町の駐在がやって来る。'], ['今は【{time}】。']);
    ex('hall', 'coatrack', 'コート掛け', ['コート掛けに、家の者や客のコートが並んでいる。', 'どれも乾いている。']);
    ex('hall', 'towerdoor', '灯台への扉', ['灯台の螺旋階段へつづく、重い木の扉。', '(私が着く前なら、誰にも見られずにここから灯台に上がれた)']);
    ex('hall', 'stairs', '二階への階段', ['二階への階段。客室は二階にある。', '一段目が、ぎしりと鳴った。']);
    ex('hall', 'bucket', '砂バケツ', weaponAt === 'hall' ? [
      '灯台の扉のわきの、赤い消火用の砂バケツ。',
      '……砂の中から、何かの端がのぞいている。',
      '引き抜くと——' + W.name + 'だった。べっとりと血がついている。',
      { fx: 'red' }, { se: 'heartbeat' },
      { clue: 'weapon' }, { clue: 'bucket' }, { flag: 'weapon_taken' },
      '(犯人は、灯台の階段を下りてきて、ここに凶器を隠した!)'
    ] : ['灯台の扉のわきの、赤い消火用の砂バケツ。砂が入っているだけだ。']);

    // ---- ラウンジ ----
    ex('lounge', 'stove', '薪ストーブ', function (st) {
      if (E === 'ladder' && disposal === 'stove' && !st.clues.trace) {
        if (st.flags.stove_stoked) return ['ストーブは赤々と燃えている。誰かが薪をくべ直したらしい。', '火かき棒で灰をさぐったが、何も残っていない。', { if: 'f:heard_stove', then: ['(薪をくべ直す前に調べるべきだった……)'] }];
        return ['鋳物の薪ストーブ。火はほとんど消えかけて、熾き火がくすぶっている。', '……灰の中に、何か黒いものがのぞいている。', { choice: [
          { t: '火かき棒で灰をかき出す', s: [{ se: 'match' }, '火かき棒で、そっと灰をかき出すと——', '燃え残った' + glove.name + 'が出てきた。指先に、あざやかな【赤い塗料】がこびりついている。', { fx: 'red' }, { se: 'heartbeat' }, { clue: 'trace' }, '(梯子の塗料だ! 犯人は手袋をはめて梯子を下り、ここで燃やそうとした)'] },
          { t: 'やめておく', s: ['(……気のせいか)'] }
        ] }];
      }
      return st.flags.stove_stoked ? ['ストーブは赤々と燃えている。'] : ['鋳物の薪ストーブ。火はほとんど消えかけている。'];
    }, function (st) { return EX.lounge.stove.s(st); });
    ex('lounge', 'shogi', '将棋盤', ['将棋盤。駒は対局の途中で止まっている。', '盤の横に、冷めた湯呑みとウイスキーのグラス。']);
    ex('lounge', 'sofa', 'ソファ', ['古い革のソファ。座面がすり切れている。']);
    ex('lounge', 'record', 'レコードプレーヤー', ['古いジャズのレコードがのっている。', V.sei + 'の趣味だろうか。……針を落とす気には、なれなかった。']);
    ex('lounge', 'bookshelf', '本棚', ['灯台の技術書、海図、古い航海日誌。', '日誌は年ごとに一冊ずつ。……「昭和三十三年」の一冊だけが、抜き取られている。', '(第三清丸の事故があった年だ)']);
    ex('lounge', 'window', '窓', [{ se: 'thunder' }, { fx: 'white' }, '窓の外は、真っ白な霧。', '稲光が、一瞬だけ灯台の影を浮かび上がらせた。']);

    // ---- 食堂 ----
    ex('kitchen', 'table', '食卓', ['夕食の皿が六人分、まだ片付けられずに残っている。', '夕食は七時。宿の全員がそろっていたという。']);
    ex('kitchen', 'sink', '流し台', ['洗いかけの食器。']);
    ex('kitchen', 'backdoor', '裏口', observer ? ['裏口の戸。外は崖の小道につづいている。', '戸口の床に、泥のついた靴の跡が点々とつづいている。', '(今夜、誰かがこの裏口から出入りした)'] : ['裏口の戸。外は崖の小道につづいている。', '戸口はきれいに掃かれている。']);
    ex('kitchen', 'calendar', 'カレンダー', ['壁のカレンダー。昭和五十三年十一月。', '十四日に赤い丸。その下に、' + V.sei + 'の字で小さく「第三清丸」。', '(第三清丸……船の名前か?)']);
    ex('kitchen', 'trash', 'ごみ箱', function (st) {
      if (E === 'ladder' && disposal === 'trash' && !st.clues.trace) return ['台所のごみ箱。野菜くずの下に、何か押しこまれている。', '引っぱり出すと——' + glove.name + 'だ。【赤い塗料】で真っ赤に染まっている。', { fx: 'red' }, { se: 'heartbeat' }, { clue: 'trace' }, '(梯子の塗料……! 犯人が捨てたのだ)'];
      return ['台所のごみ箱。野菜くずと、割れた皿が一枚。'];
    });

    // ---- 書斎 ----
    ex('study', 'desk', '机', [
      V.sei + 'の書斎机。一番上の引き出しから、封筒の束が出てきた。',
      { se: 'paper' },
      { paper: { title: '脅迫状', text: '二十年目の霧の夜\n灯を消した者に\n報いを', cls: 'clip' } },
      'どれも同じ文句。几帳面な手書きの文字だ。紙は' + PAPER[0] + 'のように見える。',
      { clue: 'letters' }
    ].concat(motive === 'forgery' ? ['机の上に、書きかけの手紙が一枚。弁護士あてだ。', { paper: { title: '下書き', text: '前略\n' + cN + '氏による売買契約書の偽造について、明朝、警察に届け出るつもりです。\n証拠の写しを同封いたします。' } }, { clue: 'lawyer' }] : []));
    ex('study', 'drawer', '鍵のかかった引き出し', function (st) {
      if (!st.clues.watchkey) return ['机のいちばん下の引き出しには、鍵がかかっている。小さな鍵穴がある。', '(鍵はどこだ?)'];
      return ['懐中時計の鍵を差しこむと、カチリと音がした。', { se: 'open' }, '中には、古い航海日誌——背に「昭和三十三年」——と、便箋の束。', { paper: { title: DET.full + '様', text: draftText } }, '手紙は、そこで途切れていた。', { clue: 'draft' }];
    }, function (st) { return st.clues.draft ? ['引き出しの中には、昭和三十三年の航海日誌が残っている。'] : EX.study.drawer.s(st); });
    ex('study', 'scrapbook', 'スクラップブック', [
      '新聞の切り抜きを綴じた、分厚いスクラップブック。',
      { se: 'page' },
      { paper: { title: '第三清丸 岬で座礁 乗組員七名死亡', text: '(昭和三十三年十一月十五日)\n\n十四日夜、濃霧の鴎ヶ崎沖で、漁船第三清丸が岬の岩礁に乗り上げ沈没した。乗組員七名全員が死亡。\n\n当夜の灯台の灯は正常に点灯していたと、灯台守の' + V.full + '氏は証言している。\n\n亡くなった方\n' + Object.keys(crewRel).map(function (k) { return crewRel[k].role + ' ' + crewRel[k].full + '(' + crewRel[k].age + ')'; }).join('\n') + '\n……', cls: 'clip' } },
      { clue: 'scrapbook' }, { clue: 'crewlist' },
      '(' + Object.keys(crewRel).map(function (k) { return P[k].sei; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).join('……') + '……? この屋敷にいる人間と、同じ名字だ)'
    ]);
    ex('study', 'photo', '船の写真', ['額に入った漁船の写真。船名は「第三清丸」。', '船の前で、若い' + V.sei + 'ともう一人、がっしりした男が肩を組んでいる。', '(若いころの' + srv.full + 'か)']);
    ex('study', 'papers', '書類の山', function () {
      if (motive === 'inherit') return ['書類の山の中に、遺言書の下書きがあった。', { paper: { title: '遺言書(下書き)', text: '私、' + V.full + 'の全財産を、鴎ヶ崎灯台保存会に寄付する。\n\n昭和五十三年十一月十五日' } }, '日付は、明日だ。', { clue: 'will' }, '(' + fam.full + 'には、何も残らない……)'];
      if (motive === 'embezzle') return ['宿の帳簿。めくっていくと、毎月の売上の数字が合わない。三年にわたって、少しずつ金が消えている。', '余白に、' + V.sei + 'の字で「' + fam.mei + 'と話す。明朝、警察へ」。', { clue: 'ledger' }];
      return ['土地の測量図と、売買契約書の下書き。売主の欄は空白だ。', V.sei + 'は、判を押していない。'];
    });
    ex('study', 'window', '窓', ['窓の掛け金は内側からかかっている。', 'ガラスの向こうは、霧と雨ばかりだ。']);

    // ---- 二階の廊下 ----
    ex('corridor2', 'door3', '3号室(' + P[ownerOfRoom.room3].short + ')', null); EX.corridor2.door3.move = 'room3';
    ex('corridor2', 'door4', '4号室(' + P[ownerOfRoom.room4].short + ')', null); EX.corridor2.door4.move = 'room4';
    ex('corridor2', 'door5', '5号室(' + P[ownerOfRoom.room5].short + ')', null); EX.corridor2.door5.move = 'room5';
    ex('corridor2', 'endwindow', '突き当たりの窓', entry === 'corridor2' ? [
      '廊下の突き当たりの窓。外は別館の平らな屋根だ。',
      '掛け金は外れている。窓枠の木を調べると——ごく小さな【赤い跡】。拭き取ったように、かすれている。',
      { fx: 'red' }, { clue: 'mark' },
      '(外梯子の塗料だ。犯人は屋根を伝って、ここから屋敷に戻った)'
    ] : ['廊下の突き当たりの窓。外は別館の平らな屋根だ。', '掛け金はしっかりかかっている。窓枠にも、何の跡もない。']);

    // ---- 客室 ----
    var OCC_ITEM = {
      doctor: '使いこまれた革の往診鞄。聴診器、注射器、薬瓶、ゴム手袋の箱、縫合糸……',
      painter: 'イーゼルに描きかけの灯台の絵。画材箱には、絵の具と筆、麻糸、布手袋の仕切り。',
      developer: '革の書類鞄。測量図や契約書の束、綴じ紐。',
      writer: '机の上のタイプライターと、原稿の束。白い綴じ糸の巻き。',
      reporter: '首から下げるカメラと取材ノート。カメラバッグの中は、フィルムと雑多な道具。'
    };
    GUESTS.forEach(function (g) {
      var r = roomOf[g], p = P[g], here = function (st) { return whereIs(g, st) === r; };
      ex(r, 'item', OCC[p.occ].name + 'の道具', withExtra(r + '.item', function (st) {
        var s = [];
        if (here(st)) s.push(S(g, '', '……どうぞ、ご自由に〔お調べください|見てくれ〕。やましいものはない〔ですから|からな〕。'));
        s.push(OCC_ITEM[p.occ]);
        return s;
      }));
      ex(r, 'bag', '旅行鞄', withExtra(r + '.bag', ['着替えの詰まった旅行鞄。']));
      ex(r, 'coat', 'コート', withExtra(r + '.coat', function (st) {
        if (g === observer) return ['椅子の背のコートは、ぐっしょり濡れて、裾に泥がはねている。', { clue: 'coat_' + g }, '(今夜、外に出ていたのだ。この雨の中を)'];
        if (g === culprit && E === 'ladder' && A !== 'timer') return ['ハンガーのカーディガンの肩口が、ぐっしょり濡れている。', '(雨の中に、上着も着ずに出ていたのか?)', { flag: 'wet_cardigan' }];
        return ['ハンガーにかかったコート。乾いている。'];
      }));
      ex(r, 'window', '窓', withExtra(r + '.window', (entry === r) ? [
        '窓のすぐ外は、別館の平らな屋根だ。梯子の下りてくる場所から、ほんの数歩。',
        '窓枠の木を、目を近づけて調べると——ごく小さな、【赤い点】。拭き取った跡のように、かすれている。',
        { fx: 'red' }, { clue: 'mark' }, '(外梯子の、あの赤だ)'
      ] : (r === 'room5' ? ['窓の外は、崖と海。別館の屋根には面していない。'] : ['窓の外は別館の屋根。外梯子の下りてくる場所が見える。', '窓枠にも、窓の下の床にも、何の跡もない。'])));
      ex(r, 'desk', '机', withExtra(r + '.desk', ['机の上には、水差しとコップ。']));
      ex(r, 'bed', 'ベッド', withExtra(r + '.bed', ['きちんと整えられたベッド。今夜はまだ使われていない。']));
    });

    // ---- ボイラー室 ----
    ex('boiler', 'paint', '塗料の缶', ['赤い錆止め塗料の缶。ふたの上に刷毛。', 'ラベルには「鉛丹 錆止め — 乾燥:晴天にて二日」。', '(外梯子の塗料だ。この雨続きでは、まだ乾いていない)']);
    ex('boiler', 'tools', '工具棚', withExtra('boiler.tools', ['スパナ、金槌、ロープ、釣り道具……きちんと手入れされた工具が並んでいる。']));
    ex('boiler', 'sake', '一升瓶', ['一升瓶。半分以上が空いている。']);
    ex('boiler', 'photo', '古い写真', ['色あせた写真。若い灯台守が二人、灯台の前で肩を組んで笑っている。', '裏に「' + V.mei + 'と' + srv.mei + ' 昭和二十八年」。']);
    ex('boiler', 'boiler', 'ボイラー', ['ボイラーが低くうなっている。この屋敷の心臓だ。']);

    // ---- 崖の小道 ----
    ex('cliff', 'bench', 'ベンチ', observer ? ['雨に濡れた木のベンチ。', 'ベンチの下に、' + (obsRecord.kind === 'sketch' ? '鉛筆の削りかす' : obsRecord.kind === 'memo' ? 'ちぎれたメモ用紙の端' : '吸い殻がいくつか') + 'が散らばっている。', '(誰かが、ここに長いこと座っていた)'] : ['雨に濡れた木のベンチ。']);
    ex('cliff', 'tower', '灯台', ['入り江の向こうに、灯台がよく見える。灯室の窓、回廊、外の梯子まで。', '(ここにいた人物は、灯室の様子を見ていたかもしれない)']);
    ex('cliff', 'footprints', '足跡', observer ? ['ぬかるみに、靴の跡。屋敷の裏口のほうへ点々とつづいている。', { clue: 'footprints' }] : ['ぬかるみには、雨に打たれた跡しかない。']);
    ex('cliff', 'fence', '柵', function (st) {
      if (E === 'ladder' && disposal === 'cliff' && !st.clues.trace) return ['木の柵の向こうは断崖。', '……柵の杭に、何かがひっかかって、風にはためいている。', glove.name + 'だ。【赤い塗料】で真っ赤に染まっている。', { fx: 'red' }, { se: 'heartbeat' }, { clue: 'trace' }, '(海に投げ捨てようとして、風に戻されたのだ)'];
      return ['木の柵の向こうは断崖。', { se: 'wave' }, '下で、波が砕ける音がした。'];
    });

    // ---- 置き場所に証拠を配る ----
    if (E === 'ladder') {
      extraAt(glove.place, culprit, [glove.origin.replace(/。$/, '。'), { clue: 'origin' }, '(梯子を下りるのに使った手袋は、ここから持ち出されたのか)']);
      if (disposal === 'own') extraAt(P[culprit].role === 'guest' ? 'bag' : (culprit === 'fuyuko' ? 'kitchen.sink' : 'boiler.tools'), culprit, function (st) {
        return st.clues.trace ? [] : ['……奥のほうに、何か丸めて押しこまれている。', '引っぱり出すと——' + glove.name + 'だ。【赤い塗料】で真っ赤に染まっている。', { fx: 'red' }, { se: 'heartbeat' }, { clue: 'trace' }];
      });
    }
    if (E === 'thread') extraAt(thread.place, culprit, ['……' + thread.origin, { clue: 'thread_origin' }]);
    extraAt(sneakWhat.place, witness, ['……' + sneakWhat.ev.replace(/。$/, '。'), { clue: 'sneak_ev' }]);
    extraAt(PAPER[2], letterWriter, ['……' + PAPER[1], { clue: 'paper_match' }]);
    Object.keys(crewRel).forEach(function (k) {
      var pl = P[k].role === 'guest' ? 'bag' : (k === 'kuga' ? 'boiler.photo' : 'kitchen.calendar');
      extraAt(pl, k, ['……古い写真が一枚、はさまっていた。漁船の前で笑う男と、若いころの' + P[k].full + '。', '裏に「' + crewRel[k].full + '」。', { clue: 'keep_' + k }, { if: 'c:crewlist', then: ['(' + crewRel[k].full + '……第三清丸の' + crewRel[k].role + 'だ!)'] }]);
    });
    if (motive === 'inherit') extraAt('kitchen.sink', 'fuyuko', ['流しの下の棚に、督促状の束が隠されていた。', { clue: 'debts' }]);
    if (motive === 'forgery') extraAt('item', culprit, ['書類の中に、売買契約書。売主の欄に' + V.sei + 'の署名と判。……筆跡が、まるで違う。', { clue: 'forged' }]);
    // 合成(客室と工具棚は最初から withExtra で包んであるので除く)
    GUESTS.forEach(function (g) { ['item', 'bag', 'coat', 'window', 'desk', 'bed'].forEach(function (o) { EX[roomOf[g]][o]._wrapped = true; }); });
    EX.boiler.tools._wrapped = true;
    Object.keys(EXTRA).forEach(function (key) {
      var parts = key.split('.'), loc = parts[0], obj = parts[1];
      if (!EX[loc] || !EX[loc][obj]) return;
      var e = EX[loc][obj];
      if (e.s && !e._wrapped) { e.s = withExtra(key, e.s); e._wrapped = true; e.again = null; }
    });

    // =================================================================
    //  話す
    // =================================================================
    var TOP = {};
    IDS.forEach(function (id) { TOP[id] = []; });
    function topic(id, tid, label, req, s, once) { TOP[id].push({ id: tid, t: label, req: req, s: s, once: once }); }

    // 自己紹介
    IDS.forEach(function (id) {
      var p = P[id], s;
      if (p.role === 'family') s = [S(id, '', '{VN}の' + famRel.name + 'の、' + p.mei + '〔です|よ〕。この宿を切り盛りして〔います|る〕。'), S(id, 'sad', '{V}は……三十年、あの灯台の灯台守〔でした|だった〕。灯台が閉まってからも、灯台のそばを離れられない人で。')];
      else if (p.role === 'servant') s = [S(id, '', p.full + '〔です|だ〕。旦那とは、若えころから一緒に灯台を守ってきた。四十年〔です|だ〕。'.replace('若えころ', p.reg === 'p' ? '若いころ' : '若えころ')), S(id, 'sad', '……旦那が、あんな死に方をする〔なんて|なんてよ〕。')];
      else s = [S(id, '', p.full + '〔です|だ〕。' + OCC[p.occ].intro + '〔です|さ〕。'), S(id, '', ({ doctor: '診療所の改装のあいだ、こちらに泊まって〔います|る〕。', painter: '灯台を描きに来た〔んです|の〕。毎日、崖の上から。', developer: 'この崖一帯に、ホテルを建てる計画があって〔ね|{na}〕。{VS}さんは首を縦に振らなかった〔けれど|がね〕。', writer: '灯台を舞台にした小説を書いて〔いまして|てさ〕。取材〔です|だよ〕。', reporter: '昔の海難事故を調べて〔いまして|てね〕。記事にするつもり〔です|さ〕。' })[p.occ])];
      if (p.pers === 'nervous') s.push(S(id, 'shock', '……こ、こんなことになるなんて。眠れそうに〔ありません|ない〕。'));
      topic(id, 'who_' + id, 'あなたは?', null, s);
    });

    // 九時から何を?(アリバイ)
    function alibiLines(id) {
      var p = P[id];
      if (id === greeter) return [S(id, '', '九時からは……ひとりで' + (id === 'fuyuko' ? '食堂で洗い物' : '地下で片付け') + 'を〔していました|してた〕。九時二十五分に{DS}さんがいらしてからは、ずっとご一緒〔でした|だった〕〔ね|{na}〕。')].concat(id === culprit ? [{ clue: 'alibi_c' }] : []);
      if (id === culprit) {
        if (A === 'falsetod') return [S(id, '', '九時から、ラウンジで将棋を〔指していました|指してた〕。九時半の霧笛を潮に席を立って、部屋で本を〔読んでいました|読んでた〕。'), { clue: 'alibi_c' }];
        if (A === 'timer') return [S(id, '', '九時二十分ごろから、ずっと' + (id === 'fuyuko' ? '玄関の近く' : id === 'kuga' ? '地下' : 'ラウンジ') + 'に〔いました|いた〕。九時半の霧笛も、そこで聞いた〔んです|よ〕。'), { clue: 'alibi_c' }];
        return [S(id, '', '九時半から十時までは、ずっと' + (P[id].role === 'guest' ? '自分の部屋' : id === 'fuyuko' ? '食堂' : '地下') + 'に〔いました|いた〕。ひとりで〔ね|{na}〕。'), { clue: 'alibi_c' }];
      }
      if (id === witness) return [S(id, '', '九時から十時まで? ずっと' + (P[id].role === 'guest' ? 'ラウンジ' : id === 'fuyuko' ? '食堂' : '地下') + 'に〔いました|いたよ〕。……本当〔です|だ〕。'), '(目が、わずかに泳いだ)'];
      if (id === observer) return [S(id, '', 'ずっと、部屋に〔いました|いた〕。……何か?')];
      if (id === 'kuga') return [S(id, '', '地下で飲んで〔ました|た〕。ひとりで〔ね|{na}〕。')];
      if (id === 'fuyuko') return [S(id, '', '食堂で、ひとりで洗い物を〔していました|してた〕。')];
      return [S(id, '', 'ラウンジで、新聞を読んだり、煙草を吸ったり〔していました|してた〕。')];
    }
    var alibiC = alibiLines(culprit).filter(function (x) { return typeof x === 'string'; }).map(function (x) { return x.replace(/^@\w+(:\w+)?\s+/, ''); }).join('');
    clue('alibi_c', shortOf(culprit) + 'の話', '「' + alibiC + '」');
    IDS.forEach(function (id) { topic(id, 'alibi_' + id, '九時から何を?', null, alibiLines(id)); });

    // 霧笛の鳴らし方(家の者)
    ['fuyuko', 'kuga'].forEach(function (id) {
      if (id === culprit) return;
      topic(id, 'pattern_' + id, '霧笛の鳴らし方', 'c:horn', [
        S(id, '', '{V}の霧笛は、長く、短く、長く。灯台守のころからの「異常なし」の合図〔なんです|だ〕。'),
        S(id, '', 'ほかの誰も、あんなふうには〔鳴らしません|鳴らさない〕。'),
        { clue: 'pattern' },
        A === 'timer' ? S(id, 'shock', '……九時半の霧笛が、一度きりの長い音だった? そんなはず〔ありません|{nai}〕。{V}なら、必ず三つに分けて鳴らすの〔に|によ〕。') : S(id, 'sad', '九時半の霧笛も、いつものとおり〔でした|だった〕……。'),
        A === 'timer' ? '(九時半の霧笛は、宗一郎が鳴らしたものではない……?)'.replace('宗一郎', V.sei) : '(九時半、' + V.sei + 'は確かに生きていた)'
      ]);
    });
    // 梯子の塗料のこと
    var painter2 = culprit === 'kuga' ? 'fuyuko' : 'kuga';
    topic(painter2, 'paint_' + painter2, '外の梯子', null, [
      painter2 === 'kuga' ? S('kuga', '', '二日前に錆止めを塗り直したん〔です|だ〕。鉛丹ってのは、晴れてても乾くのに二日はかかる。この雨じゃ、今触ったら手が真っ赤になる〔でしょう|ぜ〕。')
        : S('fuyuko', '', '二日前に、' + srv.mei + 'さんが外の梯子の錆止めを塗り直して〔くれたんです|くれたの〕。この雨で、まだ乾かないって〔ぼやいていました|ぼやいてた〕。'),
      { flag: 'heard_paint' }
    ]);
    // ストーブのこと
    (function () {
      var sp = culprit === 'fuyuko' ? 'kuga' : 'fuyuko';
      topic(sp, 'stove_info', '夜のストーブ', null, [
        sp === 'kuga' ? S('kuga', '', 'ラウンジのストーブには、毎晩' + kanjiTime(STOKE) + 'ごろ、{I}が薪をくべ直して〔います|る〕。')
          : S('fuyuko', '', 'ラウンジのストーブは、毎晩' + kanjiTime(STOKE) + 'ごろ、' + srv.mei + 'さんが薪をくべ直して〔くれるんです|くれるの〕。'),
        { flag: 'heard_stove' }
      ]);
    })();
    // 検死(医者・正直)
    if (doctorId) {
      topic(doctorId, 'tod_' + doctorId, '検死の所見', null, [
        S(doctorId, '', '後頭部を、重く硬いもので一撃。ほぼ即死〔でしょう|だろう〕。'),
        S(doctorId, '', '死亡は、' + todText + '。体温と血の固まり具合からみて、まず間違い〔ありません|ない〕。'),
        { clue: 'tod' }
      ]);
    }
    // 脅迫状
    if (lw) {
      topic(letterWriter, 'letters_' + letterWriter, '脅迫状のこと', ['c:letters', 'c:paper_match'], [
        ME('宗' .replace('宗', '') + V.sei + 'さんに届いていた脅迫状。あの紙は、あなたの' + PAPER[0] + 'ですね。'),
        S(letterWriter, 'shock', '……!'),
        { choice: [
          { t: '「あなたが脅していたんですね」と問い詰める', s: [S(letterWriter, 'angry', '……ええ、書いたのは{I}〔です|だ〕。でも、殺してなんかいない。'), '(それきり、口を閉ざしてしまった)', { trustOf: [letterWriter, -1] }, { flag: 'letters_' + letterWriter }] },
          { t: '「なぜ、あんな手紙を?」と静かに聞く', s: [
            S(letterWriter, 'sad', '……第三清丸に、{I}の' + crewRel[letterWriter].rel + 'が乗って〔いました|いた〕。' + crewRel[letterWriter].full + '〔です|だ〕。'),
            S(letterWriter, '', '{VS}さんは「灯は点いていた」と証言した。……だから、誰も責任を取らなかった。'),
            S(letterWriter, 'angry', '{I}は、本当のことが知りたかっただけ〔です|だ〕。あの人に、自分の口で言わせたかった。'),
            letterWriter === culprit ? S(letterWriter, 'sad', '……それだけ〔です|だ〕。') : S(letterWriter, 'sad', '死なれたら……もう、誰も本当のことを言ってくれない〔じゃないですか|じゃないか〕。'),
            { trustOf: [letterWriter, 1] }, { flag: 'letters_' + letterWriter }, { clue: 'keep_' + letterWriter }
          ] }
        ] }
      ]);
    }
    // 目撃者:隠しごとと証言
    var testimonyScript = [
      S(witness, 'sad', '……分かった。話〔します|す〕。九時からのことは、嘘〔でした|だ〕。'),
      S(witness, '', '{I}は、書斎に忍びこんで' + sneakWhat.thing + 'を探そうとして〔いました|た〕。……でも、鍵がかかっていて入れなかった。'),
      S(witness, 'shock', 'その途中で、見たん〔です|だ〕。' + witnessSaw.text + '。'),
      { se: 'heartbeat' }, { clue: 'testi' },
      S(witness, 'sad', '黙っていたのは、自分のしていたことを知られたくなかったから〔です|だ〕。……すまない。'.replace('すまない', P[witness].reg === 'p' ? '申し訳ありません' : 'すまない'))
    ];
    topic(witness, 'sneak_' + witness, '忍びこもうとしたもの', ['c:sneak_ev', '!c:testi'], [ME('あなたの持ち物から、これが出てきました。……書斎に忍びこもうとしましたね。'), S(witness, 'shock', '……!')].concat(testimonyScript));
    if (target) {
      topic(witness, 'warn_' + witness, '今夜は気をつけて', ['c:testi', '!f:attack_done', '!f:warned'], [
        ME('今夜は、部屋に鍵をかけてください。誰が来ても、私の声でなければ開けないで。'),
        ME('あなたは、犯人の姿を見ている。……犯人も、それに気づいているかもしれない。'),
        S(witness, 'shock', '……!'),
        S(witness, 'sad', '……分かった。言うとおりに〔します|する〕。'),
        { flag: 'warned' }
      ]);
    }
    // 外から見ていた人
    if (observer) {
      var ob = observer;
      topic(ob, 'coat_' + ob, '濡れたコート', ['c:coat_' + ob, 'd:alibi_' + ob], [
        ME('ずっと部屋にいたにしては、コートがずいぶん濡れていますね。'),
        S(ob, 'angry', '……。'),
        { choice: [
          { t: '「嘘をついていましたね」と問い詰める', s: [S(ob, 'angry', '……ええ、外に出て〔いました|た〕。崖の上に。それが何か? 人殺しよりは、ましな嘘〔でしょう|だろ〕。'), { flag: 'out_' + ob }, { trustOf: [ob, -1] }] },
          { t: '「外で、何かあったんですか」と静かに聞く', s: [S(ob, 'sad', '……嘘をつきました。崖の上に〔いました|いた〕。九時二十分ごろから、十時少し前まで。'), S(ob, '', ({ sketch: '灯台を描いて〔いたんです|た〕。', memo: '灯台を見ながら、メモを〔取っていたんです|取ってた〕。', word: 'ひとりで、灯台を眺めて〔いたんです|た〕。' })[obsRecord.kind]), { flag: 'out_' + ob }, { trustOf: [ob, 1] }] }
        ] }
      ]);
      topic(ob, 'saw_' + ob, '崖の上で何を見た?', 'f:out_' + ob, function (st) {
        if (st.clues.obs) return [S(ob, '', 'あれが、役に立つといい〔のですが|けど〕。')];
        if ((st.flags['trust_' + ob] || 0) >= 1) return [
          ME('崖の上から、灯室が見えたはずです。……何を見ました?'),
          S(ob, 'sad', '……あなたなら、信じてもいい〔のかもしれません|のかもな〕。'),
          obsRecord.kind === 'sketch' ? '彼女は、胸に抱えていた小さなスケッチブックを開いた。'.replace('彼女', P[ob].gender === 'F' ? '彼女' : '彼') : obsRecord.kind === 'memo' ? '手帳の一頁を、黙って差し出された。' : S(ob, '', '見たものを、そのまま話〔します|す〕。'),
          { se: 'page' },
          { paper: { title: obsRecord.name, text: obsRecord.seen.replace(/。/g, '。\n') + '\n\n(' + P[ob].full + ')', cls: 'clip' } },
          { clue: 'obs' }
        ];
        return [ME('崖の上から、灯室が見えたはずです。……何を見ました?'), S(ob, 'angry', '……何も。霧で、何も見えなかった〔わ|よ〕。'.replace('〔わ|よ〕', P[ob].gender === 'F' ? '〔わ|わ〕' : '〔です|よ〕')), '(何かを隠している。……まだ、信用されていないのだ)'];
      }, false);
    }
    // 手/服を見せてもらう(全員に聞ける=犯人だけに出る話題にしない)
    IDS.forEach(function (id) {
      if (E === 'ladder') topic(id, 'hands_' + id, '手を見せてほしい', 'c:paint', [
        ME('失礼ですが、両手を見せていただけますか。'),
        S(id, 'angry', '……疑って〔いるんですね|るのか〕。'),
        '黙って、両手がさし出された。爪の間まで見たが……赤い塗料は、どこにもない。',
        { clue: 'hands' },
        '(この人ではない……? いや、手袋をしていれば、手は汚れない)'
      ]);
      if (E === 'hide') topic(id, 'sleeve_' + id, '服を見せてほしい', 'c:powder', id === culprit ? [
        ME('失礼ですが、服の袖と裾を見せていただけますか。'),
        S(id, 'angry', '……なぜ〔です|だ〕。'),
        '渋々さし出された袖口に——白い粉が、うっすらとついていた。裾にも。',
        { fx: 'white' }, { se: 'heartbeat' },
        S(id, 'shock', 'こ、これは……検死のときに、ついたん〔でしょう|だろ〕。'.replace('検死のときに', '灯室に上がったときに')),
        { clue: 'powder_on' },
        '(灯室に上がった者は他にもいる。だが、白い粉がついていたのは、この人だけだ)'
      ] : [
        ME('失礼ですが、服の袖と裾を見せていただけますか。'),
        S(id, 'angry', '……疑って〔いるんですね|るのか〕。'),
        '袖口も、裾も、きれいなものだった。白い粉は、どこにもない。',
        { flag: 'sleeve_ok_' + id }
      ]);
    });
    // 第三清丸のこと(記事を読んだあと)
    IDS.forEach(function (id) {
      var s;
      if (crewRel[id]) s = [S(id, 'shock', '……!'), S(id, 'sad', '……第三清丸には、{I}の' + crewRel[id].rel + 'が乗って〔いました|いた〕。'), S(id, '', 'それ以上は、話したくない〔です|{na}〕。')];
      else if (id === 'kuga') s = [S(id, 'shock', '……その名前を、どこで。'), '老人は一升瓶をつかむと、湯呑みにどぼどぼと注いだ。手が震えている。', S(id, 'sad', 'あの晩のことは……話せ〔ません|{nai}〕。旦那との約束〔です|だ〕。'), { flag: 'kuga_shaken' }];
      else if (id === 'fuyuko') s = [S(id, 'sad', '……その名前は、この家では口にしてはいけないもの〔でした|だった〕。'), S(id, '', 'あの夜のあと、{V}はひどくやつれて、笑わなくなった。' + srv.mei + 'さんは反対に、お酒を手放さなくなった〔んです|の〕。')];
      else s = [S(id, '', '二十年前の海難事故〔ですか|か〕。町の人間なら誰でも知って〔いますよ|るさ〕。')];
      topic(id, 'wreck_' + id, '第三清丸のこと', 'c:scrapbook', s);
    });
    // 言い争い(赤いにしん)
    if (quarrel) {
      topic(quarrel, 'quarrel_' + quarrel, V.sei + 'との言い争い', 'f:heard_quarrel', [
        S(quarrel, 'angry', '……聞いたん〔ですか|だな〕。ええ、夕食のあと、{V}と言い争いを〔しました|した〕。'),
        S(quarrel, 'sad', quarrel === 'fuyuko' ? '宿を売る話〔です|よ〕。もう続けられないって、何度も言ったのに。' : quarrel === 'kuga' ? '酒のことで〔すね|{na}〕。旦那に、もうやめろと言われた。' : '金を貸してほしいと頼んで〔断られたんです|断られた〕。それだけ〔です|だ〕。'),
        S(quarrel, '', 'でも、九時からは——' + (quarrel === greeter ? '{DS}さんとご一緒〔でした|だった〕〔よね|{na}〕。' : 'さっき話したとおり〔です|だ〕。'))
      ]);
    }
    // 言い争いのうわさ(だれかが教える)
    if (quarrel) {
      var teller = pick(IDS.filter(function (x) { return x !== quarrel; }));
      topic(teller, 'rumor_' + teller, 'ほかの人たちのこと', null, [
        S(teller, '', '夕食のあと、' + P[quarrel].short + (P[quarrel].role === 'family' ? 'さん' : 'さん') + 'が{V}と〔言い争っていました|言い争ってた〕〔よ|ぜ〕。ずいぶん大きな声で。'),
        { flag: 'heard_quarrel' }
      ]);
    }
    // 犯人にだけ深く聞ける話題(どの人にも同じ形の話題を出しているので、これだけで犯人は分からない)
    if (motive === 'forgery') topic(culprit, 'forged_' + culprit, '偽の契約書', 'c:forged', [ME('鞄の契約書。' + V.sei + 'さんの署名は、偽物ですね。'), S(culprit, 'angry', '……人の鞄を勝手に。署名? ' + V.sei + 'さんが書いたものですよ。'), '(声が、わずかに硬くなった)']);
    if (motive === 'inherit') topic(culprit, 'will_' + culprit, '遺言書のこと', 'c:will', [ME('遺言書の下書きを見ました。明日、全財産を寄付する、と。'), S(culprit, 'sad', '……知りま〔せんでした|せんでした〕。{V}は、何も。'), '(本当に、知らなかったのだろうか)']);
    // 久我への打ち明け話(二十年前の真相)
    if (culprit !== 'kuga') {
      topic('kuga', 'kuga_doctor', '二十年前の、あの晩', ['f:kuga_shaken', 'c:draft'], [
        ME('書斎の引き出しに、' + V.sei + 'さんの書きかけの手紙がありました。'),
        S('kuga', 'sad', '……旦那が、そんなものを。'),
        S('kuga', 'sad', '……夜が明けたら、全部話〔します|す〕。それまで、待ってくれ〔ませんか|ないか〕。'),
        { flag: 'kuga_promise' }
      ]);
    }

    // =================================================================
    //  時刻の出来事
    // =================================================================
    var EVENTS = [];
    var accuser = pick(IDS.filter(function (x) { return x !== letterWriter && P[x].reg !== 'p'; }).concat(IDS.filter(function (x) { return x !== letterWriter; })));
    var calmer = pick(IDS.filter(function (x) { return x !== letterWriter && x !== accuser; }));
    EVENTS.push({ id: 'catch', win: [CATCH, CATCH + 40], loc: 'study', cond: ['!c:testi', '!f:caught'], s: [
      { bgm: 'tension' }, { se: 'door' }, { bg: 'study', people: [witness] },
      '書斎の机の引き出しを、誰かがひっかき回していた。',
      S(witness, 'shock', 'うわっ! ……た、{DS}さん。'),
      ME('こんな時間に、亡くなった方の書斎で何を?'),
      { choice: [
        { t: '「見逃してもいい。本当のことを話すなら」', s: [ME('今夜のことです。あなたは嘘をついていますね。')] },
        { t: '「こんな時に。人殺しの疑いもかかりますよ」', s: [S(witness, 'shock', 'ま、待ってくれ! {I}はやってない!'.replace('待ってくれ', P[witness].reg === 'p' ? '待ってください' : '待ってくれ')), ME('では、今夜のことを正直に話してください。')] }
      ] }
    ].concat(testimonyScript, [{ flag: 'caught' }, { clue: 'sneak_ev' }, { bgm: '@resume' }]) });

    EVENTS.push({ id: 'confine', at: CONF, s: [
      { bgm: 'tension' }, 'ラウンジのほうから、言い争う声が聞こえてきた。', { se: 'footsteps' },
      { bg: 'lounge', people: [accuser, calmer] },
      S(accuser, 'angry', 'だから言って〔いるんです|るんだ〕! ' + lw.full + 'を、部屋に閉じこめておくべきだって!'),
      S(calmer, 'sad', 'でも……'),
      S(accuser, 'angry', '見たん〔です|だ〕よ。あの人の' + PAPER[0] + '。{VS}さんのところに来てた脅迫状と同じ紙〔です|だ〕!'),
      S(accuser, '', '{DS}さん、あなたもそう思う〔でしょう|だろう〕? 人殺しと一つ屋根の下で、朝まで眠れるもん〔ですか|か〕。'),
      { choice: [
        { t: '「証拠もなく人を閉じこめるのには反対だ」', s: [ME('脅迫状を書くことと、人を殺すことは違う。証拠もなしに閉じこめるのは、私が許さない。'), S(accuser, 'angry', '……勝手に〔してください|しろ〕。'), { trustOf: [letterWriter, 1] }, { flag: 'defended' }] },
        { t: '「……今夜だけなら、仕方ない」', s: [ME('……朝までのことです。部屋から出ないようにしてもらいましょう。'), lw.full + 'は、部屋に閉じこめられることになった。', '(本当に、これでよかったのか……)', { trustOf: [letterWriter, -1] }, { flag: 'confined' }] }
      ] },
      { flag: 'confine_done' }, { back: true }, { bgm: '@resume' }
    ] });

    EVENTS.push({ id: 'stove', at: STOKE, s: function (st) {
      st.flags.stove_stoked = true;
      if (st.loc === 'lounge') return [S('kuga', '', 'どれ、薪をくべる〔か|か〕。'), { se: 'match' }, srv.full + 'がストーブの扉を開け、灰をかき回して、太い薪を放りこんだ。', 'ストーブは、たちまち赤々と燃え上がった。'];
      return [];
    } });

    if (target) {
      var tLoc = function (st) { var tmp = { time: ATT - 1, flags: st.flags }; return whereIs(target, tmp) || placeOf(target); };
      EVENTS.push({ id: 'attack', at: ATT, s: function (st) {
        st.flags.attack_done = true;
        if (st.flags['dead_' + target]) return [];
        var loc = tLoc(st);
        var tn = P[target].full;
        if (st.flags.warned) return [
          { bgm: 'tension' }, kanjiTime(ATT) + '。',
          { se: 'bolt' }, { fx: 'shake' },
          'どこかで、重いものが扉にぶつかるような音がした。', { se: 'footsteps' },
          { bg: loc, people: [target] },
          ME(P[target].short + 'さん!'),
          S(target, 'shock', '……{DS}さん。誰かが、扉をこじ開けようと〔しました|した〕。'),
          S(target, '', '言われたとおり、鍵をかけておいてよかった。声はかけてこなかった。足音は、すぐに遠ざかって……'),
          { flag: 'target_saved' },
          '(犯人は、まだこの屋敷の中にいる。……そして、' + tn + 'を狙った)',
          { goto: loc }, { bgm: '@resume' }
        ];
        if (st.loc === loc) return [
          { bgm: 'tension' }, kanjiTime(ATT) + '。',
          'ふっと、戸口に人影が立った。明かりを背にしていて、顔が見えない。手に、何か重そうなものを提げている。',
          ME('誰だ!'), { se: 'footsteps' },
          '人影は身をひるがえし、闇の中に消えた。',
          S(target, 'shock', 'な、なんだ今のは……'.replace('なんだ', P[target].reg === 'p' ? 'なんですか' : 'なんだ')),
          ME('……あなたを狙って来たんです。'),
          { flag: 'target_saved' }, { bgm: '@resume' }
        ];
        st.flags['dead_' + target] = true;
        return [
          kanjiTime(ATT) + 'を少しまわったころ——', { se: 'scream' },
          'どこかで、短い叫び声が聞こえた。', { bgm: 'tension' }, { se: 'stairs' },
          { bg: loc, people: [] }, { se: 'shock' }, { fx: 'red' },
          ME(P[target].short + 'さん!'),
          tn + 'が、床に倒れていた。頭から、血を流して。', { bgm: 'tragedy' },
          '(後ろから、一撃。' + V.sei + 'と同じだ……)',
          '(犯人は、まだこの屋敷の中にいる。……私が、もっと早く気づいていれば)',
          { goto: loc }, { bgm: '@resume' }
        ];
      } });
    }
    EVENTS.push({ id: 'dawn', at: T(29, 0), s: [{ se: 'clockwarn' }, '窓の外が、わずかに白みはじめた。', '(五時。警察が来るまで、あと一時間……)'] });

    // =================================================================
    //  プロローグ
    // =================================================================
    var others = IDS.filter(function (x) { return x !== greeter && x !== helper && !(E === 'hide' && x === culprit); });
    var g = greeter;
    var PRO = [
      { bg: 'black' }, { amb: 'storm' }, { bgm: 'title' },
      '昭和五十三年、十一月十四日。',
      'その夜、鴎ヶ崎(かもめがさき)の海は、深い霧と雨に閉ざされていた。',
      { bg: 'exterior' },
      '崖の上に建つ、古い洋館——霧笛荘。そのわきに、十年前に役目を終えた灯台が黒くそびえている。',
      ME('……ここか。'),
      N('私は{D}。東京の片隅で、しがない探偵事務所を営んでいる。'),
      'ここへ来たのは、一通の手紙のためだった。',
      { se: 'paper' },
      { paper: { title: DET.full + '様', text: '突然のお便り、ご無礼をお許しください。\n私は鴎ヶ崎で霧笛荘という宿を営んでおります、' + V.full + 'と申します。\n\nこの一月ほど、差出人の分からぬ手紙が届いております。\n「二十年目の霧の夜、灯を消した者に報いを」\n\n警察に届けるつもりはございません。ただ、お話ししなければならないことがあるのです。\n十一月十四日の夜、霧笛荘においでいただけませんでしょうか。\n\n' + V.full } },
      { clue: 'letter' },
      '腕時計の針は、九時二十五分。約束の時刻を、少し過ぎてしまった。',
      { se: 'knock' }, { wait: 600 }, { se: 'door' },
      { bg: 'hall', people: [g] }, { amb: 'indoor' },
      g === 'fuyuko' ? S(g, '', 'いらっしゃいませ……{DS}さま、でいらっしゃいますか。') : S(g, '', '……あんたが、東京の探偵さんか。'.replace('あんたが', P[g].reg === 'p' ? 'あなたが' : 'あんたが').replace('探偵さんか', P[g].reg === 'p' ? '探偵さんですか' : '探偵さんか')),
      ME('ええ。' + V.full + 'さんに呼ばれて来ました。'),
      g === 'fuyuko' ? S(g, '', '{VS}の' + famRel.name + 'の' + fam.mei + '〔です|よ〕。{V}から伺って〔おります|る〕。どうぞ、お上がりください。') : S(g, '', srv.full + '〔です|だ〕。この家の雑用をして〔います|る〕。旦那から聞いて〔ます|るよ〕。'),
      ME(V.sei + 'さんは?'),
      S(g, '', '{V}は九時に灯台へ上がり〔ました|た〕。毎年、この夜だけは昔の灯室に上がるん〔です|だ〕。'),
      S(g, '', '霧の晩は、三十分ごとに霧笛を鳴らすのが、灯台守だったころからの習いで〔……|{na}〕。'),
      { bgm: null }, { wait: 400 }
    ];
    if (A === 'timer') {
      PRO.push({ se: 'foghorn' }, { wait: 2800 },
        'ボォォォォ————……',
        '建物の芯をふるわせるような、低く長い音が一度だけ、霧の向こうから響いてきた。',
        S(g, '', '……九時半。{V}の霧笛〔です|だ〕。'));
      if (g !== culprit) PRO.push(S(g, '', '……今夜は、ずいぶん短く切り上げた〔のね|{na}〕。'));
    } else {
      PRO.push({ se: 'foghorn' }, { wait: 2600 }, { se: 'foghorn' }, { wait: 2600 },
        'ボォォ——……ボッ……ボォォ——……',
        '建物の芯をふるわせるような、低く長い音。長く、短く、長く。不思議な節回しの霧笛だった。',
        S(g, '', '……九時半。{V}の霧笛〔です|だ〕。'));
    }
    PRO.push('柱時計の針は、確かに九時半を指していた。', { clue: 'horn' },
      S(g, '', '十時になったら一度下りてくると〔申しておりました|言ってた〕。それまで、食堂で温かいものでも。'),
      { se: 'footsteps' }, { bg: 'kitchen', people: [g] }, { bgm: 'night' },
      '食堂のテーブルには、夕食の皿がまだ片付けられずに残っていた。',
      S(g, '', '今夜はお客さまが三人〔いらして|いてな〕……' + GUESTS.map(function (x) { return OCC[P[x].occ].name + 'の' + P[x].full + (P[g].reg === 'p' ? 'さま' : ''); }).join('、') + '。' + (g === 'fuyuko' ? 'それと地下には、昔から{V}と一緒にいる' + srv.full + 'さんが。' : 'それに、旦那の' + famRel.name + 'の' + fam.mei + 'さん〔です|だ〕。')),
      '温かいほうじ茶をすすりながら、私は壁の時計の針を眺めていた。',
      { se: 'clock' }, { wait: 1800 },
      '時計が、十時を打った。',
      S(g, '', '……おかしい〔ですね|{na}〕。霧笛が、鳴ら〔ない|{nai}〕。'),
      S(g, 'shock', '{V}は、一度だって欠かしたことがない〔のに|のによ〕。'),
      { bgm: 'tension' },
      { bg: 'black' }, { se: 'stairs' },
      '私たちは灯台の螺旋階段を駆け上がった。鉄の段が、靴音を不気味に反響させる。',
      '灯室の扉は、びくともしなかった。',
      { se: 'knock' },
      S(g, 'shock', '{V}! 開けて〔ください|くれ〕!'),
      ME('内側から、閂がかかっている……。'),
      '下から、足音がのぼってきた。',
      S(helper, '', 'どうした〔んですか|んだ〕!'),
      ME('扉が開かない。手を貸してください!'),
      '私たちは、肩から扉にぶつかった。一度、二度——',
      { se: 'bolt' }, { fx: 'shake' },
      '三度目で、古い閂の金具がはじけ飛んだ。',
      { bg: 'lamproom' }, { amb: 'storm' }, { se: 'shock' }, { fx: 'red' }, { bgm: 'tragedy' },
      E === 'ladder' ? '冷たい霧が、開け放たれた回廊のガラス戸から流れこんでいた。' : '灯室の中は、石油ランプの灯りだけが揺れていた。回廊へのガラス戸は、閉じている。',
      '巨大なレンズのかたわらに、' + V.full + 'が倒れていた。',
      '後頭部から流れ出た血が、床の上に、赤黒い水たまりをつくっていた。',
      S(g, 'shock', '——いやあっ!'.replace('いやあっ', P[g].gender === 'F' ? 'いやあっ' : 'だ、旦那ぁっ')),
      ME('触らないで!')
    );
    if (E === 'hide') PRO.push('……気がつくと、' + cN + 'が私たちのすぐ後ろに立っていた。', '(いつの間に……。階段を上がってくる足音は、聞こえなかったが)', { clue: 'behind' });
    if (others.length) PRO.push('物音を聞きつけて、' + names(others.filter(function (x) { return !(E === 'hide' && x === culprit); })) + 'が階段を上がってきた。');
    if (E === 'ladder' && A !== 'timer' && culprit !== greeter && culprit !== helper) PRO.push('(' + cN + 'の髪が、しっとりと濡れている……?)', { clue: 'wet_hair' });
    if (doctorId) {
      PRO.push({ bg: 'lamproom', people: [doctorId] },
        S(doctorId, '', '医者〔です|だ〕。通して〔ください|くれ〕。'),
        P[doctorId].full + 'は鞄からゴム手袋を出してはめると、手早く遺体を調べた。',
        S(doctorId, '', '……亡くなって〔います|る〕。後頭部を一撃。ほぼ即死〔でしょう|だな〕。'),
        S(doctorId, '', '死亡は……' + todText + '、といったところ〔ですね|だ〕。'),
        { clue: 'tod' });
      if (A === 'falsetod') PRO.push('(' + todText.replace('の間', '') + '……? だが、九時半には霧笛が——)');
      if (A === 'timer') PRO.push('(九時半の霧笛を聞いてから、まだ三十分あまり……)');
    } else {
      PRO.push('私は遺体のそばにかがみこんだ。体は、まだかすかに温かい。', '(亡くなって、一時間とたっていない。……医者がいれば、もう少し正確に分かるのだが)', { clue: 'tod' });
    }
    PRO.push(
      S(g, 'sad', '電話は、夕方から通じない〔んです|んだ〕。この雨で線が……。それに、峠の道も。'),
      '町の駐在が来られるのは、早くて朝の六時だろう。',
      '私は懐中時計を見た。十時十五分。夜明けまで、およそ八時間。',
      ME('この事件、私に調べさせてください。' + V.sei + 'さんは、私に助けを求めた。……間に合わなかった。せめて、真相だけは。'),
      S(g, 'sad', '……〔お願いします|頼む〕。'),
      { clue: 'bolt' },
      { chapter: { main: '第一章 霧の夜', sub: '事件番号 ' + cfg.seed + ' ・ 午後十時十五分' } },
      { bg: '@loc' }, { bgm: 'investigate' },
      '皆は、ひとまず階下へ下りていった。灯室には、私ひとりが残った。',
      '【あそびかた】画面の中の気になる所をクリックすると「調べる」ことができます。下のボタンからも選べます。',
      '【あそびかた】「話す」で、その場にいる人に話を聞けます。手がかりが増えると、聞ける話題も増えます。',
      '【あそびかた】調べる・移動・話すたびに時間が進みます。人は時刻によって居場所を変え、出来事も起こります。',
      '【あそびかた】朝の六時に警察が来ます。それまでに手がかりを集め、「推理する」で真相を示してください。'
    );

    // =================================================================
    //  推理(穴うめ)
    // =================================================================
    var DED = [];
    if (A === 'timer') {
      DED.push({ q: '九時半の霧笛は、【＿】だった。', a: ['k_single'], ok: ['(私自身が、玄関ホールで聞いた)'] });
      DED.push({ q: 'だが、' + V.sei + 'の霧笛はいつも【＿】だった。', a: ['k_pattern'], ok: ['(あれは、' + V.sei + 'が鳴らした霧笛ではない)'] });
      DED.push({ q: '人のいない灯室で霧笛を鳴らしたのは、【＿】だ。', a: ['k_device', 'k_obs'], ok: ['(' + V.sei + 'は、九時半にはもう死んでいた。犯行は九時の霧笛のあと、九時半より前だ)'] });
    } else {
      DED.push({ q: (A === 'falsetod' ? '検死では「' + todText + 'に死亡」。だが、' : '') + '九時半には【＿】が鳴っていた。', a: ['k_horn'], ok: ['(私自身が、玄関ホールで聞いた)'] });
      DED.push({ q: 'あれは犯人の偽装ではない。' + V.sei + 'だけの【＿】だった。', a: ['k_pattern', 'k_obs'], ok: [A === 'falsetod' ? '(' + V.sei + 'は九時半まで生きていた。検死の時刻は、偽りだ)' : '(' + V.sei + 'は九時半まで生きていた。犯行は九時半から十時の間だ)'] });
    }
    if (E === 'ladder') {
      DED.push({ q: '灯室の扉には内側から閂。犯人が逃げた道は【＿】だ。', a: ['k_ladder'], ok: ['(凶器は回廊に捨てられていた。両手で梯子をつかむためだ)'] });
      DED.push({ q: '梯子の段には【＿】が塗られていた。素手で下りれば、手は真っ赤に染まる。', a: ['k_paint'], ok: ['(だが、誰の手にも塗料はなかった)'] });
      DED.push({ q: '犯人は手を汚さないために【＿】をはめていた。', a: ['k_trace', 'k_origin'], ok: ['(そして、それを始末しようとした)'] });
      DED.push({ q: '梯子の先、犯人が屋敷に戻った窓には、【＿】が残っていた。', a: ['k_mark', 'k_annex'], ok: ['(犯人は屋根を伝って、ここから戻った)'] });
      DED.push({ q: '手袋の持ち主は——【＿】。', a: ['k_origin', 'k_gap'], ok: ['(糸が、ひとりの人物につながった)'] });
    } else if (E === 'thread') {
      DED.push({ q: '灯室の扉には内側から閂。だが閂には【＿】がからんでいた。', a: ['k_thread'], ok: ['(犯人は階段から出ていき、扉の下の隙間から糸で閂を引いた)'] });
      DED.push({ q: '犯人は階段を下りた。凶器は【＿】に隠されていた。', a: ['k_bucket', 'k_thread'], ok: ['(灯台の扉のすぐそばだ)'] });
      DED.push({ q: '閂の糸と同じものを持っていたのは——【＿】。', a: ['k_torigin'], ok: ['(糸が、ひとりの人物につながった)'] });
    } else {
      DED.push({ q: '扉を破ったとき、犯人はまだ灯室の中にいた。隠れていたのは【＿】だ。', a: ['k_tarp', 'k_powder'], ok: ['(犯人は、私たちが遺体に気をとられているすきに、出てきたのだ)'] });
      DED.push({ q: '階段を上がってくる足音もなく、【＿】がいた。', a: ['k_behind'], ok: ['(上がってきたのではない。最初から、そこにいたのだ)'] });
      DED.push({ q: '隠れ場所の白い粉は、犯人の服に残った。【＿】。', a: ['k_powderon', 'k_behind'], ok: ['(糸が、ひとりの人物につながった)'] });
    }
    DED.push({ q: '犯行のころ、姿を見られていた人物がいる。決め手は【＿】だ。', a: ['k_gap', 'k_origin', 'k_torigin', 'k_powderon'], ok: ['(そうだ。あの人は、そこにいなかった)'] });
    DED.push({ q: MOT.q, a: ['k_motive'], ok: ['(すべての糸が、ひとつにつながった)'] });

    // =================================================================
    //  対決
    // =================================================================
    var CON = [];
    var claimPlace = A === 'falsetod' ? 'ラウンジで将棋を' : '';
    if (A === 'timer') {
      CON.push({ claim: [S(culprit, '', '{I}が{V}を? ……ばかばかしい。九時半の霧笛が鳴ったとき、{I}は' + (culprit === greeter ? '{DS}さん、あなたと一緒に' : 'ほかの人たちと一緒に') + 'いた〔んですよ|んだ〕。')],
        a: ['horn', 'device', 'obs'],
        ok: { horn: [ME('あの霧笛は、長い音が一度きりだった。' + V.sei + 'さんのいつもの鳴らし方とは、まるで違う。')], device: [ME('霧笛のレバーに、ろうそくと紐と砂袋の仕掛けの跡が残っていた。あの霧笛は、人のいない灯室で鳴ったんです。')], obs: [ME('崖の上から灯室を見ていた人がいる。九時半、霧笛が鳴ったとき、レバーのそばには誰もいなかった。')] },
        after: [S(culprit, 'angry', '……仕掛け? そんなもの、誰にだって作れる〔でしょう|だろう〕。')] });
      CON.push({ claim: [S(culprit, '', '九時半に{V}が生きていなかったという、たしかな証拠でもある〔んですか|のか〕。')],
        a: ['pattern', 'device', 'obs'],
        ok: [ME(V.sei + 'さんの霧笛は、いつも長・短・長。灯台守の合図だ。九時半の霧笛は、それとは違った。'), ME(V.sei + 'さんは、九時半にはもう亡くなっていた。犯行は九時の霧笛のあと、九時半より前。……そのとき、あなたにはアリバイがない。')],
        after: [S(culprit, '', '……。')] });
    } else {
      CON.push({ claim: A === 'falsetod' ? [S(culprit, '', '{I}が{VS}さんを? ばかばかしい。検死の結果をお忘れ〔ですか|か〕。死亡は' + todText + '。その時刻、{I}はラウンジで将棋を指して〔いました|いた〕。')]
          : [S(culprit, '', '{I}が{V}を? ばかばかしい。いつ殺されたのかも分からないのに、よく言える〔ものですね|もんだ〕。')],
        a: ['horn'],
        ok: [ME('九時半、灯台の霧笛が鳴った。私自身が、玄関ホールでこの耳で聞いています。')],
        after: [S(culprit, '', '霧笛なら、誰にでも鳴らせる〔でしょう|だろう〕。犯人が鳴らしたのかもしれない。')] });
      CON.push({ claim: [S(culprit, '', '九時半まで{V}が生きていた証拠には、ならない〔ですね|{na}〕。')],
        a: ['pattern', 'obs'],
        ok: { pattern: [ME('長く、短く、長く。あれは' + V.sei + 'さんだけの合図だ。ほかの誰も真似しなかった。'), ME('犯行は九時半から十時の間だ。' + (A === 'falsetod' ? '……検死の時刻は、偽りだったんです。' : ''))] },
        after: [S(culprit, '', '……。')] });
      if (!obsRecord) CON[CON.length - 1].a = ['pattern'];
      else CON[CON.length - 1].ok.obs = [ME('崖の上から灯室を見ていた人がいる。' + obsRecord.seen + '。')];
    }
    if (E === 'ladder') {
      CON.push({ claim: [S(culprit, '', '灯室の扉には内側から閂がかかって〔いました|いた〕。犯人は、煙のように消えたとでも?')],
        a: ['ladder', 'paint', 'annex'],
        ok: [ME('回廊のガラス戸は開いていた。そして回廊からは、塔の外壁にそって鉄梯子が下りている。段には、乾かない塗料と、誰かが下りた跡。')],
        after: [S(culprit, 'angry', '梯子? その先には、ほかの部屋もある〔でしょう|だろう〕。それに、{I}の手を見て〔ください|みろ〕。塗料なんてついていない。')] });
      CON.push({ claim: [S(culprit, '', '{I}の手のどこに、赤い塗料がある〔んです|んだ〕。')],
        a: ['trace', 'origin'],
        ok: { trace: [ME('犯人は手袋をはめていた。そして、それを始末しようとした。……これです。赤く染まった' + glove.name + '。')], origin: [ME(glove.origin)] },
        after: [S(culprit, 'shock', '……!'), S(culprit, 'angry', 'そ、そんなもの、誰にだって持ち出せる〔でしょう|だろう〕。')], climax: true });
      CON.push({ claim: [S(culprit, '', '梯子を下りた者がどこから屋敷に入ったかなど、分かりはし〔ません|ない〕。')],
        a: ['mark', 'testi', 'wet_hair'],
        ok: { mark: [ME(CLUES.mark.desc)], testi: [ME(P[witness].full + 'さんが見ています。' + witnessSaw.text + '。')], wet_hair: [ME('遺体の発見のあと、灯室に来たあなたの髪は濡れていた。雨の中にいたんだ。')] },
        after: [S(culprit, '', '……。')] });
    } else if (E === 'thread') {
      CON.push({ claim: [S(culprit, '', '灯室の扉には内側から閂がかかって〔いました|いた〕。犯人は、煙のように消えたとでも?')],
        a: ['thread_trick', 'bucket'],
        ok: { thread_trick: [ME('閂に、糸の切れはしがからんでいた。扉の下には糸を通せる隙間。犯人は階段から出ていき、外から糸で閂を引いたんです。')], bucket: [ME('凶器は、灯台の扉のわきの砂バケツに隠されていた。犯人は階段を下りてきたんです。閂は、糸で外から引いた。')] },
        after: [S(culprit, 'angry', '糸? そんなもの、どこにでもある〔でしょう|だろう〕。')] });
      CON.push({ claim: [S(culprit, '', 'その糸が{I}のものだという証拠でもある〔んですか|のか〕。')],
        a: ['thread_origin'],
        ok: [ME(thread.origin), ME('閂の糸くずと、同じものです。')],
        after: [S(culprit, 'shock', '……!')], climax: true });
      CON.push({ claim: [S(culprit, '', '{I}はあのとき、' + (A === 'timer' ? 'ずっとほかの人と一緒だった' : '自分の部屋にいた') + '。灯台になど近づいていない〔です|ぞ〕。')],
        a: ['testi'],
        ok: [ME(P[witness].full + 'さんが見ています。' + witnessSaw.text + '。')],
        after: [S(culprit, '', '……。')] });
    } else {
      CON.push({ claim: [S(culprit, '', '{I}は、皆さんのあとから階段を上がって〔いきました|いった〕。それだけ〔です|だ〕。')],
        a: ['behind', 'testi'],
        ok: { behind: [ME('扉を破った直後、あなたは私たちのすぐ後ろにいた。だが、階段を上がってくる足音は、誰も聞いていない。')], testi: [ME(P[witness].full + 'さんが見ています。' + witnessSaw.text + '。')] },
        after: [S(culprit, 'angry', 'では、{I}がどこにいたというん〔です|だ〕。')] });
      CON.push({ claim: [S(culprit, '', '{I}が灯室の中にいたとでも? 閂のかかった灯室の、どこに。')],
        a: ['tarp', 'powder'],
        ok: [ME('レンズのわきの防水布の陰です。めくると、靴の跡と、こぼれた磨き粉があった。')],
        after: [S(culprit, 'angry', '……防水布の陰なら、誰でも隠れられる〔でしょう|だろう〕。')], climax: true });
      CON.push({ claim: [S(culprit, '', 'それが{I}だという証拠は?')],
        a: ['powder_on'],
        ok: [ME('あなたの服の袖と裾に、白い粉がついていた。レンズの磨き粉と、同じものです。')],
        after: [S(culprit, 'shock', '……!')] });
    }
    CON.push({ claim: MOT.claim, a: MOT.clues, ok: MOT.ok });

    // =================================================================
    //  結末
    // =================================================================
    var BREAK = [{ se: 'objection' }, { fx: 'shake' }, { fx: 'red' }, S(culprit, 'shock', '……。'), { se: 'breakdown' }, { bgm: null }, cN + 'は、長いあいだ黙っていた。', { bgm: 'truth' }];
    if (motive === 'revenge') {
      var cr2 = crewRel[culprit];
      BREAK.push(S(culprit, 'sad', crewRel[culprit].rel + 'の' + cr2.mei + 'は……' + cr2.age + '〔でした|だった〕。'),
        S(culprit, 'sad', '二十年間、{I}は、' + cr2.mei + 'が船長の誤りで死んだのだと信じてきた。灯台の灯は、点いていたと。'),
        S(culprit, 'angry', 'でも、本当は灯は消えていた。{VS}さんは、それを知っていて口をぬぐって生きてきた。'),
        S(culprit, 'sad', '今夜、灯室で、{VS}さんに' + cr2.mei + 'の名前を言った〔んです|んだ〕。そうしたら……「すまない」と。'),
        S(culprit, 'sad', '……気がついたら、' + W.name + 'を握って〔いました|いた〕。'));
    } else if (motive === 'inherit') {
      BREAK.push(S(culprit, 'sad', '……宿の借金は、もう、どうにもならなかった〔んです|の〕。'), S(culprit, 'angry', 'それなのに{V}は、全部を灯台の保存会に寄付するって。二十年前の罪ほろぼしだって。'), S(culprit, 'sad', '{I}の人生は……{V}の罪ほろぼしの、おまけだった〔んです|のよ〕。'));
    } else if (motive === 'embezzle') {
      BREAK.push(S(culprit, 'sad', '……少しずつ、宿のお金を〔使っていました|使ってた〕。返すつもりだった〔んです|の〕。'), S(culprit, 'angry', '{V}は、明日の朝、警察に行くって。実の' + famRel.name + 'を、警察に。'), S(culprit, 'sad', '灯台に上がって、頼んだ〔んです|の〕。黙っていてって。……{V}は、首を横に振った。'));
    } else if (motive === 'forgery') {
      BREAK.push(S(culprit, 'sad', '……会社が、もうもたなかった〔んです|んだ〕。この土地が手に入らなければ、{I}はおしまいだった。'), S(culprit, 'angry', '{VS}さんは、偽の契約書に気づいて、明日の朝、警察に届けると言った。'), S(culprit, 'sad', '灯室で頭を下げた〔んです|んだ〕。それでも……「明日の朝だ」と。'));
    } else {
      BREAK.push(S(culprit, 'sad', '……あの晩、灯を消したのは、{I}〔です|だ〕。酒を飲んで、眠りこんじまった。'), S(culprit, 'sad', '旦那は、{I}をかばって、二十年嘘をつきとおしてくれた。'), S(culprit, 'angry', 'それが今夜、全部話すと言い出した。……{I}は、怖かった〔んです|んだ〕。'), S(culprit, 'sad', '四十年……四十年、一緒にいたのに。'));
    }
    if (target) BREAK.push({ if: 'f:dead_' + target, then: [S(culprit, 'sad', P[target].short + 'さんに……見られていたから〔です|だ〕。')] });

    function deep(st) {
      if (!st.clues.draft) return false;
      if (target && st.flags['dead_' + target]) return false;
      return true;
    }
    var TRUTH = [];
    if (wreckTruth === 'servant' && culprit !== 'kuga') {
      TRUTH = [
        '沈黙をやぶったのは、' + srv.full + 'だった。',
        S('kuga', 'sad', '……違う〔んです|んだ〕。灯を消したのは、旦那〔ではありません|じゃ{nai}〕。……{I}〔です|だ〕。'),
        S('kuga', 'sad', 'あの晩、当直は{I}だった。酒を飲んで眠っちまって、ランプの油が切れた。旦那が飛んできて灯をともしたときには、もう……。'),
        S('kuga', 'sad', '旦那は、{I}をかばった。「灯は点いていた」と、たったひとりで嘘をついた。'),
        '私は、書斎の引き出しから見つけた手紙を、皆の前に置いた。',
        { paper: { title: V.sei + 'の告白書(書きかけ)', text: draftText } },
        ME(V.sei + 'さんは今夜、すべてを話すつもりだった。私を呼んだのは、そのためです。')
      ];
      if (motive === 'revenge') TRUTH.push(S(culprit, 'shock', '……では、{I}は。'), S(culprit, 'sad', '二十年も罪を背負ってきた人を……真実を話そうとしていた人を……'));
    } else if (wreckTruth === 'victim') {
      TRUTH = [
        '私は、書斎の引き出しから見つけた手紙を、皆の前に置いた。',
        { paper: { title: V.sei + 'の告白書(書きかけ)', text: draftText } },
        ME(V.sei + 'さんは今夜、自分の罪をすべて話すつもりだった。私を呼んだのは、そのためです。'),
        ME('夜が明けたら、警察にも名乗り出るつもりだった。……あと、数時間だったんです。')
      ];
      if (motive === 'revenge') TRUTH.push(S(culprit, 'sad', '……あと、数時間。'), cN + 'は、両手で顔をおおった。');
    } else {
      TRUTH = ['私は、書斎の引き出しから見つけた手紙を、皆の前に置いた。', { paper: { title: V.sei + 'の告白書(書きかけ)', text: draftText } }, ME(V.sei + 'さんは今夜、すべてを話すつもりだった。')];
    }
    var crewIds = Object.keys(crewRel).filter(function (k) { return k !== culprit; });
    function epilogue(st, endId) {
      var s = [{ bg: 'dawn' }, { amb: 'sea' }, { bgm: 'ending' }, '午前六時。', '霧が、少しずつ晴れていった。', '駐在の巡査に付き添われて、' + cN + 'は霧笛荘を出ていった。一度も、振り返らなかった。'];
      if (endId === 'true' && wreckTruth === 'servant' && culprit !== 'kuga') s.push(srv.full + 'も、自分から巡査に名乗り出た。二十年前の夜のことを、すべて話すと言って。', S('kuga', '', '旦那に、やっと顔向けができる〔……|よ〕。'));
      if (endId === 'normal_dead') s.push(P[target].full + 'には、白い布がかけられた。', '(私が、もっと早く気づいていれば。……その思いは、きっと一生消えないだろう)');
      if (endId === 'normal_alive') s.push('(二十年前の夜の真実は、まだ霧の中にある。……' + V.sei + 'が、何を話そうとしていたのかも)');
      crewIds.forEach(function (k) {
        if (st.flags['dead_' + k]) return;
        if ((st.flags['trust_' + k] || 0) >= 1) s.push({ bg: 'dawn', people: [k] }, '崖の上の小道で、' + P[k].full + 'が海を見ていた。', S(k, '', '{DS}さん。……ありがとう。あの夜、{I}を信じてくれて。'), S(k, 'smile', crewRel[k].mei + 'のこと、やっと、まっすぐに思い出せそう〔です|だ〕。'));
        else s.push(P[k].full + 'は、誰とも言葉をかわさずに、朝いちばんのバスで町を去っていった。');
      });
      if (observer && observer !== culprit && !st.flags['dead_' + observer] && st.clues.obs && crewIds.indexOf(observer) < 0) s.push({ bg: 'dawn', people: [observer] }, P[observer].full + 'が、' + obsRecord.name + 'の一枚を、黙って私に差し出した。', '霧の晴れた海と、灯台。灯室に、小さな灯がひとつ、ともっていた。');
      if (culprit !== 'fuyuko' && !st.flags.dead_fuyuko) s.push({ bg: 'dawn', people: ['fuyuko'] }, S('fuyuko', '', '{DS}さん。……{V}の灯台、残すことに〔します|する〕。'), S('fuyuko', 'smile', '毎年十一月十四日には、{I}が灯をともし〔ます|ます〕。七人の方と……{V}のために。'));
      s.push({ se: 'foghorn' }, 'どこか遠くで、新しい灯台の霧笛が鳴った。', '長く、短く、長く——と、私には聞こえた。');
      return s;
    }

    var END_NAMES = {
      true: pick(['霧笛のやむ朝', '灯をともす人', '二十年目の灯', '夜明けの灯台']),
      normal_dead: pick(['鎮魂の霧笛', '消えた灯', '冷たい夜明け']),
      normal_alive: pick(['晴れない霧', '残された灯', '語られぬ夜']),
      bad_wrong: pick(['霧の中の冤罪', 'まちがえた灯', '迷い霧']),
      bad_fail: pick(['言い逃れ', '霧に消えた真実', '届かぬ灯'])
    };
    var ENDINGS = {
      true: { name: END_NAMES.true, kind: 'TRUE END' },
      normal_dead: { name: END_NAMES.normal_dead, kind: 'NORMAL END' },
      normal_alive: { name: END_NAMES.normal_alive, kind: 'NORMAL END' },
      bad_wrong: { name: END_NAMES.bad_wrong, kind: 'BAD END' },
      bad_fail: { name: END_NAMES.bad_fail, kind: 'BAD END' }
    };

    function afterConfront(st) {
      var s = BREAK.slice();
      var id;
      if (target && st.flags['dead_' + target]) { id = 'normal_dead'; s = s.concat(st.clues.draft ? TRUTH.slice(0, 3) : []); }
      else if (deep(st)) { id = 'true'; s = s.concat(TRUTH); }
      else { id = 'normal_alive'; s = s.concat(['(' + cN + 'は罪を認めた。だが、' + V.sei + 'が今夜、私に何を話そうとしていたのか。それは、まだ分からない)']); }
      return { id: id, script: s.concat(epilogue(st, id)) };
    }

    var WRONG = {};
    IDS.forEach(function (id) {
      if (id === culprit) return;
      var lines = [ME(P[id].full + 'さん。……あなたです。'), S(id, 'shock', 'え……?')];
      if (id === greeter) lines.push(S(id, 'sad', '{I}は、九時二十五分からずっと、{DS}さんと一緒〔でした|だった〕〔よね|{na}〕。'));
      else if (id === letterWriter) lines.push(S(id, 'angry', '脅迫状を書いたのは{I}〔です|だ〕。でも、殺してなんかいない。……あなたも、ほかの人と同じ〔ね|だな〕。'));
      else if (id === witness) lines.push(S(id, 'angry', '{I}は書斎に忍びこもうとしただけ〔です|だ〕! 人殺しなんか!'));
      else lines.push(S(id, 'angry', 'ば、ばかなことを〔言わないでください|言うな〕! {I}が{V}を殺す理由が、どこにある〔んです|んだ〕!'));
      lines.push('(……違う。この人ではない。私は、どこかで推理をまちがえたのだ)');
      WRONG[id] = lines;
    });
    var BAD_WRONG_TAIL = [{ bgm: 'badend' }, { bg: 'dawn' }, { amb: 'sea' }, '午前六時。駐在の巡査が到着し、私の推理を手帳に書きとめていった。', 'けれど、その推理には、霧のように大きな穴があいていた。', '真犯人は、穏やかな顔のまま、私たちの中にまぎれていた。', '(私は、どこで道をまちがえたのか……)'];
    var BAD_FAIL = [{ bgm: 'badend' }, S(culprit, '', '{DS}さん。あなたの話は、想像ばかり〔です|だ〕。証拠もなしに、人を人殺し呼ばわりする〔んですか|のか〕。'), '私には、返す言葉がなかった。', { bg: 'dawn' }, { amb: 'sea' }, '午前六時。駐在の巡査は、脅迫状を書いた' + lw.full + 'を、署へ連れていった。', cN + 'は、いつもの顔で霧笛荘を出ていった。', '(私は、何をつかみそこねたのだろう。……霧は、まだ晴れない)'];
    if (letterWriter === culprit) BAD_FAIL[5] = '午前六時。巡査は話を聞いてまわったが、誰を連れていくこともなかった。';

    var TIMELINE = [
      { t: '19:00', s: '夕食。宿の六人全員がそろう' },
      { t: '21:00', s: V.sei + '、灯台へ上がる。九時の霧笛' },
      { t: '21:25', s: DET.sei + '、霧笛荘に着く。' + P[greeter].short + 'が出迎える' },
      { t: '21:30', s: A === 'timer' ? '霧笛が一度きり鳴る(長い音)' : '霧笛が鳴る(長・短・長)' },
      { t: '21:30〜', s: '崖の上から灯室を見ていた人がいる', req: 'c:obs' },
      { t: hm(witnessT), s: P[witness].short + 'が見たもの:' + witnessSaw.text, req: 'c:testi' },
      { t: '22:00', s: '十時の霧笛が鳴らない' },
      { t: '22:05', s: '灯室の扉を破る。' + V.sei + 'の遺体を発見' },
      { t: hm(CATCH), s: P[witness].short + '、書斎に忍びこむ', req: 'f:caught' },
      { t: '00:30', s: '脅迫状の主を閉じこめるかで言い争い', req: 'f:confine_done' },
      { t: hm(STOKE), s: 'ストーブに薪がくべ直される', req: 'f:stove_stoked' }
    ];
    if (target) TIMELINE.push({ t: hm(ATT), s: P[target].short + 'が襲われる', req: 'f:attack_done' });

    function sceneFlags(st, scene) {
      var f = { sheet: !!st.flags.sheet, weapon: weaponKey, weapon_at: weaponAt, weapon_taken: !!st.flags.weapon_taken };
      if (scene === 'room3' || scene === 'room4' || scene === 'room5') { f.occ = occOfRoom[scene]; f.room_mark = entry === scene; }
      if (target && st.flags['dead_' + target] && scene === (function () { return whereIs(target, { time: ATT - 1, flags: {} }) || placeOf(target); })()) f.dead = target;
      return f;
    }

    var LOCS = {
      lamproom: { name: '灯室', floor: '灯台', amb: 'storm' },
      gallery: { name: '回廊', floor: '灯台', amb: 'storm' },
      corridor2: { name: '二階の廊下', floor: '二階', amb: 'indoor' },
      room3: { name: '3号室', floor: '二階', amb: 'indoor', who: P[ownerOfRoom.room3].short },
      room4: { name: '4号室', floor: '二階', amb: 'indoor', who: P[ownerOfRoom.room4].short },
      room5: { name: '5号室', floor: '二階', amb: 'indoor', who: P[ownerOfRoom.room5].short },
      hall: { name: '玄関ホール', floor: '一階', amb: 'indoor' },
      lounge: { name: 'ラウンジ', floor: '一階', amb: 'indoor' },
      kitchen: { name: '食堂', floor: '一階', amb: 'indoor' },
      study: { name: '書斎', floor: '一階', amb: 'indoor' },
      boiler: { name: 'ボイラー室', floor: '地下', amb: 'boiler' },
      exterior: { name: '前庭', floor: '屋外', amb: 'storm' },
      cliff: { name: '崖の小道', floor: '屋外', amb: 'sea' }
    };

    DED.forEach(function (q) { q.a = q.a.filter(function (a) { return KW[a]; }); });
    CON.forEach(function (r) { r.a = r.a.filter(function (a) { return CLUES[a]; }); });
    var story = {
      CHARS: CHARS, LOCS: LOCS, FLOORS: ['灯台', '二階', '一階', '地下', '屋外'], START: T(22, 15), POLICE: T(30, 0), T: T,
      whereIs: whereIs, CLUES: CLUES, KW: KW, TIMELINE: TIMELINE, EXAMINE: EX, TOPICS: TOP, EVENTS: EVENTS, SNIPPETS: {},
      PROLOGUE: PRO, DEDUCTION: DED, CONFRONT: CON, WRONG: WRONG, ENDINGS: ENDINGS, BAD_FAIL: BAD_FAIL, BAD_WRONG_TAIL: BAD_WRONG_TAIL,
      CULPRIT: culprit, SUSPECTS: IDS.slice(), COST: DF.cost, HEARTS: DF.hearts,
      afterConfront: afterConfront, sceneFlags: sceneFlags,
      accuseRight: [ME(cN + 'さん。……あなたです。'), { se: 'shock' }, { fx: 'shake' }, S(culprit, '', '……{I}、〔ですか|か〕。')],
      rebuttals: [S(culprit, '', 'それが、何の証拠になる〔のです|んだ〕?'), S(culprit, '', '話にならない〔ですね|{na}〕、{DS}さん。'), S(culprit, '', '……的はずれ〔ですよ|だ〕。'), S(culprit, 'angry', 'いいかげんにして〔いただきたい|くれ〕。')],
      gapLines: [ME('……とにかく、あなたの言い分には無理がある。'), S(culprit, '', '……ふん。')],
      caseNo: cfg.seed,
      // 解決後に見られる「事件の真相」
      summary: [
        '犯人:' + cN + '(' + (P[culprit].occ ? OCC[P[culprit].occ].name : P[culprit].role === 'family' ? V.sei + 'の' + famRel.name : '下働き') + ')',
        '動機:' + ({ revenge: '第三清丸で死んだ' + (crewRel[culprit] ? crewRel[culprit].rel + '・' + crewRel[culprit].full : '') + 'の復讐', inherit: '遺産(全財産の寄付を止めるため)', embezzle: '使いこみを隠すため', forgery: '契約書の偽造を隠すため', wreck_silence: '二十年前の罪を隠すため' })[motive],
        '時刻:' + ({ timer: 'ろうそくの仕掛けで九時半に霧笛を鳴らし、死亡時刻を遅く見せた(本当の犯行は' + kanjiTime(M) + 'ごろ)', falsetod: '検死で死亡時刻を早く告げ、将棋のアリバイの時間に見せた(本当の犯行は' + kanjiTime(M) + 'ごろ)', none: '時刻の細工はなし(犯行は' + kanjiTime(M) + 'ごろ)' })[A],
        '脱出:' + (E === 'ladder' ? '回廊の外梯子を' + glove.name + 'をはめて下り、' + (entry === 'corridor2' ? '廊下の窓' : entry.replace('room', '') + '号室の窓') + 'から戻った' : E === 'thread' ? thread.name + 'で扉の外から閂を引き、凶器を砂バケツに隠した' : 'レンズの陰の防水布に隠れ、扉が破られたあと何食わぬ顔でまぎれこんだ'),
        '凶器:' + W.name,
        '目撃者:' + P[witness].full + (observer ? ' / 崖の上:' + P[observer].full : ''),
        '脅迫状:' + lw.full,
        '二十年前、灯を消したのは:' + (wreckTruth === 'victim' ? V.full : srv.full)
      ]
    };
    rnd = Math.random;
    return story;
  }

  window.Scenario = {
    generate: generate, defaults: defaults, randomName: randomName,
    LOOKS: LOOKS, OCC: OCC, PERS: PERS, RELS: RELS, DIFF: DIFF, IDS: IDS
  };
})();
