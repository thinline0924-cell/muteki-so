/* =========================================================
   data.js — マシンとサーキットの設定
   ・数字はすべて「メートル・キログラム・秒」で書いています
   ・実在のマシン/サーキットを「モチーフ」にした架空のもの
   ========================================================= */

// ギア比をまとめて作るヘルパー(最高速と回転数から逆算)
// vTop: 最高速(km/h) / redline: 最高回転 / n: 段数 / r: タイヤ半径 / spread: 1速と最終段の比
function makeGears(vTop, redline, n, r, spread) {
  var final = 3.2;
  var topTotal = (redline / 60) * 2 * Math.PI * r / (vTop / 3.6); // 最終段でのトータル比
  var top = topTotal / final;
  var first = top * spread;
  var g = [];
  for (var i = 0; i < n; i++) {
    // 段が上がるほどギャップが詰まる(実車らしい並び)
    var t = i / (n - 1);
    var k = Math.pow(t, 0.82);
    g.push(+(first * Math.pow(top / first, k)).toFixed(3));
  }
  return { ratios: g, final: final };
}

var CARS = [
  {
    id: 'kestrel',
    name: 'KESTREL 962C',
    jp: 'ケストレル 962C',
    motif: 'Porsche 962C(1986)',
    cls: 'GROUP C', year: 1986, number: 17,
    desc: '水平対向6気筒ツインターボ。ターボが効き始めると一気に背中を押される。ラグに気をつけて早めにアクセルを。',
    engineLabel: '3.0L 水平対向6 ツインターボ',
    mass: 920, wheelbase: 2.77, weightFront: 0.40, cgH: 0.34, trackW: 1.62, radius: 0.33,
    length: 4.78, width: 2.0,
    torque: [[1000, 170], [2000, 240], [3000, 330], [4000, 520], [5000, 640], [6000, 660], [7000, 640], [7800, 600], [8400, 520]],
    idle: 1100, redline: 8200, limiter: 8400,
    turbo: { base: 0.55, lag: 0.85, spool: 3600, maxBar: 1.4 },
    gears: makeGears(358, 8200, 5, 0.33, 2.6), shiftTime: 0.16, gearbox: 'H',
    cdA: 0.76, clA: 2.7, aeroFront: 0.42,
    mu: 1.62, brake: 26000, brakeFront: 0.60,
    ers: null, overtake: { kind: 'scramble', label: 'SCRAMBLE BOOST', torque: 0.14, capacity: 30 },
    sound: { kind: 'flat6', pulses: 6, stroke: 4, formants: [[150, 0.006, 1], [520, 0.0025, 0.55], [1700, 0.0008, 0.25]], rough: 0.10, turbo: true, noise: 0.20, gearWhine: 0.04 },
    gauge: 'analog',
    livery: { base: '#f4f4f0', a: '#1d2b55', b: '#c8a24a', c: '#c0202a', glass: '#1a2028' },
    shape: { nose: 0.30, deck: 0.62, fender: 0.84, cockpitX: 0.05, cockpitL: 1.75, cockpitH: 1.03, tail: 0.86, wing: 'high', fin: false, lights: 'round' }
  },
  {
    id: 'rotary',
    name: 'RV-4R 787',
    jp: 'RV-4R 787',
    motif: 'Mazda 787B(1991)',
    cls: 'GROUP C', year: 1991, number: 55,
    desc: '4ローターの自然吸気。9000回転まで一直線に吹け上がる甲高い音。軽くて素直、ブレーキで勝負できる。',
    engineLabel: '2.6L 4ローター 自然吸気',
    mass: 890, wheelbase: 2.66, weightFront: 0.43, cgH: 0.33, trackW: 1.60, radius: 0.33,
    length: 4.78, width: 1.99,
    torque: [[1500, 210], [3000, 340], [4500, 460], [6000, 560], [6500, 600], [7500, 595], [8500, 565], [9000, 545], [9500, 470]],
    idle: 1500, redline: 9000, limiter: 9500,
    turbo: null,
    gears: makeGears(345, 9000, 5, 0.33, 2.5), shiftTime: 0.14, gearbox: 'H',
    cdA: 0.80, clA: 2.85, aeroFront: 0.44,
    mu: 1.64, brake: 26500, brakeFront: 0.58,
    ers: null, overtake: null,
    sound: { kind: 'rotary', pulses: 4, stroke: 2, formants: [[260, 0.003, 0.9], [900, 0.0016, 0.75], [2600, 0.0006, 0.45]], rough: 0.05, turbo: false, noise: 0.28, gearWhine: 0.05 },
    gauge: 'bargraph',
    livery: { base: '#ee6a1c', a: '#14935a', b: '#f2efe6', c: '#141414', glass: '#141a20' },
    shape: { nose: 0.30, deck: 0.60, fender: 0.84, cockpitX: 0.0, cockpitL: 1.7, cockpitH: 1.02, tail: 0.84, wing: 'high', fin: false, lights: 'round' }
  },
  {
    id: 'aurora',
    name: 'AURORA 919H',
    jp: 'オーロラ 919H',
    motif: 'Porsche 919 Hybrid(2017)',
    cls: 'LMP1-H', year: 2017, number: 1,
    desc: 'V4ターボ+前輪モーター。全開で前輪にもモーターが加わり、4輪で路面を蹴る。最速だが、電池の管理が鍵。',
    engineLabel: '2.0L V4 ターボ + ERS 300kW',
    mass: 950, wheelbase: 3.0, weightFront: 0.46, cgH: 0.30, trackW: 1.62, radius: 0.34,
    length: 4.65, width: 1.9,
    torque: [[2000, 250], [3000, 330], [4000, 430], [5000, 470], [6000, 485], [7000, 475], [8000, 445], [9000, 390], [9300, 360]],
    idle: 1800, redline: 9000, limiter: 9300,
    turbo: { base: 0.6, lag: 0.35, spool: 3200, maxBar: 2.6 },
    gears: makeGears(340, 9000, 7, 0.34, 2.9), shiftTime: 0.05, gearbox: 'SEQ',
    cdA: 0.78, clA: 3.7, aeroFront: 0.45,
    mu: 1.70, brake: 31000, brakeFront: 0.56,
    ers: { power: 300000, battery: 2400000, harvest: 180000, minSpeed: 0, front: true },
    overtake: { kind: 'ers', label: 'ERS BOOST' },
    sound: { kind: 'v4', pulses: 4, stroke: 4, formants: [[190, 0.004, 1], [700, 0.0018, 0.6], [2200, 0.0006, 0.3]], rough: 0.08, turbo: true, noise: 0.24, gearWhine: 0.08, ersWhine: true },
    gauge: 'lmp1',
    livery: { base: '#f6f6f4', a: '#111418', b: '#c41e2c', c: '#8a96a8', glass: '#10161e' },
    shape: { nose: 0.24, deck: 0.58, fender: 0.88, cockpitX: 0.12, cockpitL: 1.55, cockpitH: 1.05, tail: 0.80, wing: 'low', fin: true, lights: 'strip' }
  },
  {
    id: 'solstice',
    name: 'SOLSTICE 040',
    jp: 'ソルスティス 040',
    motif: 'LMH ハイパーカー(GR010 / 499P 世代)',
    cls: 'HYPERCAR', year: 2023, number: 8,
    desc: 'V6ツインターボ+前輪モーター。重く安定していて、160km/hを越えると前輪にも力がかかる。耐久王者の落ち着き。',
    engineLabel: '3.5L V6 ツインターボ + 前輪MGU 200kW',
    mass: 1100, wheelbase: 3.05, weightFront: 0.45, cgH: 0.33, trackW: 1.64, radius: 0.35,
    length: 5.0, width: 2.0,
    torque: [[2000, 390], [3000, 560], [4000, 690], [5000, 720], [6000, 700], [7000, 655], [7800, 590], [8200, 540]],
    idle: 1500, redline: 7800, limiter: 8200,
    turbo: { base: 0.62, lag: 0.45, spool: 2800, maxBar: 2.2 },
    gears: makeGears(330, 7800, 7, 0.35, 2.8), shiftTime: 0.06, gearbox: 'SEQ',
    cdA: 0.92, clA: 3.1, aeroFront: 0.46,
    mu: 1.66, brake: 33000, brakeFront: 0.55,
    ers: { power: 200000, battery: 1800000, harvest: 200000, minSpeed: 160 / 3.6, front: true, cap: 520000 },
    overtake: { kind: 'ers', label: 'HYBRID BOOST' },
    sound: { kind: 'v6', pulses: 6, stroke: 4, formants: [[140, 0.006, 1], [480, 0.0024, 0.55], [1500, 0.0008, 0.28]], rough: 0.07, turbo: true, noise: 0.22, gearWhine: 0.07, ersWhine: true },
    gauge: 'hyper',
    livery: { base: '#121316', a: '#d0202e', b: '#eeeeea', c: '#6c7480', glass: '#0d1218' },
    shape: { nose: 0.28, deck: 0.64, fender: 0.92, cockpitX: 0.1, cockpitL: 1.65, cockpitH: 1.08, tail: 0.88, wing: 'swan', fin: true, lights: 'bar' }
  }
];

/* ---------------------------------------------------------
   コース:「直線 S(長さ, 高低差)」「左 L / 右 R(半径, 角度, 高低差)」を
   順番につないで作る。最後に自動でぴったり閉じるように直線の長さを微調整する。
   --------------------------------------------------------- */
var TRACKS = [
  {
    id: 'fuji',
    name: 'MT. FUJI SPEEDWAY',
    jp: '富士スピードウェイ風',
    motif: '富士スピードウェイ(静岡)',
    desc: '1.5kmのメインストレートから一気に下る1コーナー。最終セクターは上りのテクニカル区間。背後には霧の富士。',
    width: 15, scale: 1.22,
    time: 'morning',
    scenery: 'fuji',
    laps: 3,
    segs: [
      ['S', 1000, -5],
      ['R', 42, 172, -6],   // TGRコーナー
      ['S', 70, -3],
      ['L', 75, 70, -3],    // コカ・コーラコーナー
      ['S', 160, -4],
      ['R', 115, 178, -6],  // 100R
      ['S', 90, -2],
      ['L', 28, 160, -1],   // アドバンコーナー(ヘアピン)
      ['S', 140, 0],
      ['R', 280, 75, 1],    // 300R
      ['S', 420, -2],
      ['R', 28, 100, 0],    // ダンロップ
      ['L', 34, 75, 2],
      ['S', 180, 6],
      ['L', 80, 55, 6],     // 13コーナー
      ['R', 48, 90, 5],     // 14コーナー
      ['S', 70, 3],
      ['L', 55, 45, 3],     // 15コーナー
      ['R', 38, 132, 3],    // パナソニックコーナー
      ['S', 480, 4]
    ]
  },
  {
    id: 'spa',
    name: 'ARDENNES CIRCUIT',
    jp: 'スパ・フランコルシャン風',
    motif: 'スパ・フランコルシャン(ベルギー)',
    desc: 'ラ・ソース・ヘアピンから谷へ駆け下り、オー・ルージュの急坂を全開で駆け上がる。森と霧に包まれた高速コース。',
    width: 14,
    time: 'overcast',
    scenery: 'forest',
    laps: 2,
    segs: [
      ['S', 250, 0],
      ['R', 26, 160, -2],   // ラ・ソース
      ['S', 320, -16],
      ['L', 90, 45, -5],    // オー・ルージュ
      ['R', 70, 60, 12],    // ラディオン
      ['L', 150, 75, 10],
      ['S', 1250, 12],      // ケメル・ストレート
      ['R', 55, 70, 0],     // レ・コーム
      ['L', 55, 60, -2],
      ['S', 120, -4],
      ['R', 60, 60, -5],    // マルメディ
      ['S', 260, -10],
      ['R', 30, 125, -6],   // ブリュッセル
      ['S', 150, -6],
      ['L', 70, 75, -6],
      ['S', 350, -14],
      ['L', 110, 100, -12], // プーオン
      ['S', 250, -4],
      ['R', 70, 50, -2],    // ファーニュ
      ['L', 70, 40, -1],
      ['S', 200, -2],
      ['R', 60, 150, -3],   // スタヴロ
      ['S', 350, 6],
      ['R', 250, 50, 6],    // ポール・フレール
      ['S', 400, 10],
      ['L', 300, 30, 10],   // ブランシモン
      ['S', 600, 12],
      ['R', 28, 100, 4],    // バスストップ
      ['L', 28, 40, 2],
      ['S', 200, 0]
    ]
  },
  {
    id: 'monza',
    name: 'PARCO VELOCE',
    jp: 'モンツァ風',
    motif: 'モンツァ・サーキット(イタリア)',
    desc: '「速度の神殿」。長い直線をシケインでつなぐ超高速コース。ダウンフォースを削った最高速勝負と、パラボリカの立ち上がり。',
    width: 14,
    time: 'afternoon',
    scenery: 'park',
    laps: 3,
    segs: [
      ['S', 700, 0],
      ['R', 22, 90, 0],     // レッティフィーロ
      ['L', 24, 78, 0],
      ['S', 150, 0],
      ['R', 330, 88, 0],    // クルバ・グランデ
      ['S', 400, 0],
      ['L', 30, 55, 0],     // ロッジア
      ['R', 30, 55, 0],
      ['S', 280, 1],
      ['R', 55, 75, 1],     // レズモ1
      ['S', 180, 0],
      ['R', 70, 25, -1],    // レズモ2
      ['S', 650, -2],       // セラリオ
      ['L', 70, 35, 0],     // アスカリ
      ['R', 80, 60, 0],
      ['L', 110, 30, 0],
      ['S', 1000, 1],
      ['R', 120, 165, 0],   // パラボリカ
      ['S', 400, 0]
    ]
  },
  {
    id: 'sarthe',
    name: 'CIRCUIT DE LA BRUME',
    jp: 'ル・マン(サルト)風',
    motif: 'サルト・サーキット(フランス・ル・マン)',
    desc: '夕暮れの公道コース。シケイン付きの長大なユノディエール、ミュルサンヌ、インディアナポリス、ポルシェ・カーブ。1周約9km。',
    width: 13,
    time: 'dusk',
    scenery: 'countryside',
    laps: 2,
    segs: [
      ['S', 400, 0],
      ['R', 140, 50, 4],    // ダンロップ・カーブ
      ['S', 60, 2],
      ['L', 30, 50, 1],     // ダンロップ・シケイン
      ['R', 30, 50, 0],
      ['S', 150, -3],
      ['L', 90, 30, -4],    // エス
      ['R', 80, 45, -3],
      ['L', 90, 25, -2],
      ['S', 120, -1],
      ['R', 45, 85, 0],     // テルトル・ルージュ
      ['S', 1300, -2],      // ユノディエール
      ['R', 30, 45, 0],     // 第1シケイン
      ['L', 30, 45, 0],
      ['S', 1200, 2],
      ['L', 30, 45, 0],     // 第2シケイン
      ['R', 30, 45, 0],
      ['S', 900, -1],
      ['R', 400, 12, 0],    // キンク
      ['S', 300, 0],
      ['R', 25, 110, 0],    // ミュルサンヌ
      ['S', 900, 1],
      ['L', 250, 18, 0],
      ['S', 700, 0],
      ['L', 120, 25, 0],
      ['R', 40, 85, -2],    // インディアナポリス
      ['S', 350, -1],
      ['R', 25, 70, 0],     // アルナージュ
      ['S', 900, 2],
      ['R', 110, 50, 2],    // ポルシェ・カーブ
      ['L', 120, 70, 1],
      ['R', 100, 55, 1],
      ['L', 140, 50, 0],
      ['S', 400, 0],
      ['L', 30, 55, 0],     // フォード・シケイン
      ['R', 30, 55, 0],
      ['R', 30, 50, 0],
      ['L', 30, 50, 0],
      ['S', 250, 0]
    ]
  }
];

// 時間帯ごとの空と光(霧の色が UI の雰囲気を決める)
var SKIES = {
  morning:   { top: '#7f9cc0', horizon: '#e4ebf2', ground: '#9aa79a', fog: '#dde5ee', fogDensity: 0.00085, sun: '#fff4e2', sunI: 2.6, hemi: 0.95, sunDir: [-0.5, 0.42, -0.35], amb: '#c7d6e8', mountain: '#9fb0c6', exposure: 1.0 },
  overcast:  { top: '#76838f', horizon: '#c9d0d3', ground: '#6f7d68', fog: '#c3cbcd', fogDensity: 0.0012, sun: '#eef2f4', sunI: 1.6, hemi: 1.15, sunDir: [0.3, 0.7, 0.2], amb: '#b8c2c6', mountain: '#7f8c8c', exposure: 1.05 },
  afternoon: { top: '#5d8fc9', horizon: '#f0e6d4', ground: '#a19a74', fog: '#e8e1d2', fogDensity: 0.0006, sun: '#fff0d6', sunI: 3.0, hemi: 0.8, sunDir: [0.55, 0.55, 0.3], amb: '#d8d0c0', mountain: '#a9b2b8', exposure: 1.0 },
  dusk:      { top: '#2b3254', horizon: '#e79a6b', ground: '#4b4a44', fog: '#9b8a8f', fogDensity: 0.0008, sun: '#ffb27a', sunI: 1.9, hemi: 0.55, sunDir: [0.75, 0.16, -0.4], amb: '#7a6a80', mountain: '#5a5468', exposure: 1.1 }
};

if (typeof module !== 'undefined') module.exports = { CARS: CARS, TRACKS: TRACKS, SKIES: SKIES, makeGears: makeGears };
