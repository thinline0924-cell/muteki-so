// 大きな絵:町の背景、タイトル画面、ワールドの絵。
'use strict';
const { shade, vgrad, lgrad, rgrad, grainFilter, blurFilter, rng, svg } = require('./lib.cjs');

// ---- 共通の部品 ----
function cloud(x, y, s, op = 0.95) {
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${op}">
    <ellipse cx="0" cy="18" rx="70" ry="22" fill="#FFFFFF"/>
    <circle cx="-34" cy="8" r="26" fill="#FFFFFF"/><circle cx="2" cy="-6" r="36" fill="#FFFFFF"/><circle cx="38" cy="8" r="24" fill="#FFFFFF"/>
    <ellipse cx="0" cy="30" rx="66" ry="10" fill="#D6E9F2" opacity="0.8"/>
  </g>`;
}

function treeBlob(x, y, s, c1 = '#5FA845', c2 = '#3F7F35') {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="6" cy="34" rx="30" ry="8" fill="#1E3510" opacity="0.25"/>
    <rect x="-3" y="10" width="7" height="24" fill="#6B4630"/>
    <circle cx="-12" cy="0" r="18" fill="${c2}"/><circle cx="12" cy="0" r="18" fill="${c2}"/><circle cx="0" cy="-14" r="22" fill="${c1}"/>
    <circle cx="-6" cy="-20" r="7" fill="#FFFFFF" opacity="0.2"/>
  </g>`;
}

function pine(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="4" cy="40" rx="20" ry="6" fill="#1E3510" opacity="0.25"/>
    <rect x="-3" y="28" width="6" height="12" fill="#6B4630"/>
    <polygon points="0,-40 24,4 -24,4" fill="#3F7F35"/><polygon points="0,-24 28,22 -28,22" fill="#367030"/><polygon points="0,-10 32,34 -32,34" fill="#2F6630"/>
    <polygon points="0,-40 -24,4 0,4" fill="#FFFFFF" opacity="0.12"/>
  </g>`;
}

function flowersPatch(x, y, n, seed, size = 1) {
  const r = rng(seed);
  const cols = ['#FFFFFF', '#FFE27A', '#F7A8C0', '#F49A62', '#C7B2F0'];
  let out = '';
  for (let i = 0; i < n; i++) {
    const fx = x + (r() - 0.5) * 60 * size, fy = y + (r() - 0.5) * 24 * size;
    const c = cols[Math.floor(r() * cols.length)];
    out += `<circle cx="${fx}" cy="${fy}" r="${2.6 * size}" fill="${c}"/><circle cx="${fx}" cy="${fy}" r="${0.9 * size}" fill="#F2B632"/>`;
  }
  return out;
}

function grassTexture(fid, seed, op = 0.5) {
  return `<filter id="${fid}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" seed="${seed}"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.45  0 0 0 0 0.12  0 0 0 1.2 -0.5"/>
    </filter>`;
}

// ---- 町の背景(設計図 360×480) ----
function townBackground() {
  const W = 360, H = 480;
  const defs = `
    ${vgrad('gr', [[0, '#A3CF73'], [1, '#86B95A']])}
    ${vgrad('sky', [[0, '#9ED4EC'], [1, '#DDF0E8']])}
    ${vgrad('sea', [[0, '#5DB0D6'], [1, '#2F7FA8']])}
    ${grassTexture('mottle', 4)}
    ${grainFilter('grain', { freq: 1.6, amount: 0.08, seed: 6 })}
    <filter id="pave" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.25" numOctaves="2" seed="3"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.32  0 0 0 0.9 -0.3"/>
    </filter>
    ${blurFilter('b2', 2)}${blurFilter('b4', 4)}`;
  const r = rng(11);
  // 草の葉
  let blades = '';
  for (let i = 0; i < 220; i++) {
    const x = r() * W, y = 70 + r() * 370;
    const c = r() < 0.5 ? '#76A84A' : '#B7DB86';
    blades += `<path d="M${x} ${y} l-1.5 -4 M${x} ${y} l1.5 -4.5" stroke="${c}" stroke-width="1.1" stroke-linecap="round" opacity="0.8"/>`;
  }
  // 石畳(広場)
  let stones = '';
  for (let y = 136; y < 216; y += 9) {
    for (let x = 60 + ((y / 9) % 2) * 6; x < 300; x += 12) {
      stones += `<rect x="${x}" y="${y}" width="11" height="8" rx="2" fill="${r() < 0.5 ? '#E7DCC2' : '#DCCFB2'}"/>`;
    }
  }
  // 道の石畳
  let road = '';
  for (let y = 214; y < 444; y += 9) {
    for (let x = 162 + ((y / 9) % 2) * 5; x < 198; x += 10) {
      road += `<rect x="${x}" y="${y}" width="9" height="8" rx="2" fill="${r() < 0.5 ? '#DDD0B4' : '#CFC1A3'}"/>`;
    }
  }
  // 線路
  let sleepers = '';
  for (let x = 0; x < W; x += 9) sleepers += `<rect x="${x}" y="111" width="5" height="14" rx="1" fill="#7B4F31"/>`;
  // 柵
  let fence = '';
  for (let x = 4; x < W; x += 14) {
    if (x > 100 && x < 260) continue;
    fence += `<rect x="${x}" y="88" width="4" height="16" rx="1" fill="#F4EBDD"/>`;
  }
  return svg(W, H, defs, `
    <rect width="${W}" height="${H}" fill="url(#gr)" filter="url(#grain)"/>
    <rect width="${W}" height="${H}" filter="url(#mottle)" opacity="0.5"/>
    <rect width="${W}" height="40" fill="url(#sky)"/>
    <path d="M0 40 Q60 6 130 26 Q200 46 260 18 Q320 -2 360 22 V64 H0 Z" fill="#7DB65A"/>
    <path d="M0 52 Q90 28 180 50 Q270 70 360 44 V80 H0 Z" fill="#8EC363"/>
    ${pine(18, 46, 0.7)}${pine(40, 52, 0.55)}${treeBlob(330, 52, 0.75)}${treeBlob(306, 60, 0.6)}${pine(345, 64, 0.55)}${treeBlob(70, 62, 0.55)}
    ${fence}
    <line x1="0" y1="92" x2="100" y2="92" stroke="#F4EBDD" stroke-width="2.5"/><line x1="260" y1="92" x2="360" y2="92" stroke="#F4EBDD" stroke-width="2.5"/>
    <line x1="0" y1="99" x2="100" y2="99" stroke="#F4EBDD" stroke-width="2.5"/><line x1="260" y1="99" x2="360" y2="99" stroke="#F4EBDD" stroke-width="2.5"/>
    <rect x="0" y="106" width="${W}" height="24" fill="#C9B793"/>
    <rect x="0" y="106" width="${W}" height="24" filter="url(#pave)" opacity="0.5"/>
    ${sleepers}
    <line x1="0" y1="113.5" x2="${W}" y2="113.5" stroke="#3E454C" stroke-width="3"/><line x1="0" y1="113" x2="${W}" y2="113" stroke="#C9D1D8" stroke-width="1"/>
    <line x1="0" y1="122.5" x2="${W}" y2="122.5" stroke="#3E454C" stroke-width="3"/><line x1="0" y1="122" x2="${W}" y2="122" stroke="#C9D1D8" stroke-width="1"/>
    <g transform="translate(348 106)"><rect width="8" height="22" rx="2" fill="#C23B2E"/><rect y="7" width="8" height="5" fill="#FFFFFF"/></g>
    ${blades}
    <rect x="52" y="132" width="256" height="90" rx="22" fill="#B8AA8C" filter="url(#b2)" opacity="0.5" transform="translate(0 3)"/>
    <rect x="52" y="130" width="256" height="90" rx="22" fill="#CFC2A4"/>
    <clipPath id="plz"><rect x="56" y="134" width="248" height="82" rx="18"/></clipPath>
    <g clip-path="url(#plz)">${stones}</g>
    <ellipse cx="180" cy="176" rx="34" ry="18" fill="none" stroke="#C4B494" stroke-width="5"/>
    <ellipse cx="180" cy="176" rx="20" ry="10" fill="#E9DFC6" stroke="#C4B494" stroke-width="3"/>
    <rect x="158" y="214" width="44" height="232" fill="#BFB091"/>
    <g>${road}</g>
    <line x1="158" y1="216" x2="158" y2="444" stroke="#A89A7C" stroke-width="2"/><line x1="202" y1="216" x2="202" y2="444" stroke="#A89A7C" stroke-width="2"/>
    ${flowersPatch(16, 250, 10, 3)}${flowersPatch(344, 290, 10, 4)}${flowersPatch(18, 380, 9, 5)}${flowersPatch(342, 420, 9, 6)}
    ${treeBlob(14, 300, 0.55)}${treeBlob(348, 372, 0.5)}${treeBlob(14, 220, 0.45)}
    <path d="M0 440 Q90 432 180 440 Q270 448 360 438 V480 H0 Z" fill="#EBDDB4"/>
    <path d="M0 452 Q90 444 180 452 Q270 460 360 450 V480 H0 Z" fill="url(#sea)"/>
    <path d="M0 452 Q90 444 180 452 Q270 460 360 450" stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="0.8"/>
    ${Array.from({ length: 10 }, (_, i) => `<path d="M${(i * 41) % 350 + 6} ${462 + (i % 3) * 5} q5 -3 10 0" stroke="#FFFFFF" stroke-width="1.5" fill="none" opacity="0.6"/>`).join('')}
    <rect x="168" y="442" width="24" height="38" fill="#9C6B45"/>
    ${[446, 452, 458, 464, 470, 476].map((y) => `<line x1="168" y1="${y}" x2="192" y2="${y}" stroke="#7A5034" stroke-width="1"/>`).join('')}
    <g transform="translate(286 462)"><path d="M-14 0 h28 l-5 7 h-18 Z" fill="#7A4E33"/><path d="M0 -2 V-24 L13 -4 Z" fill="#FFFFFF"/><path d="M-1 -2 V-18 L-10 -4 Z" fill="#F4EBDD"/></g>`);
}

// ---- タイトル画面の絵(1080×1920) ----
function titleScene() {
  const W = 1080, H = 1920;
  const horizon = 680;
  const dy = -180; // 駅・線路・列車をボタンより上に置く
  const defs = `
    ${vgrad('sky', [[0, '#5FA9D6'], [0.55, '#9FD3EC'], [1, '#F6EFD9']])}
    ${rgrad('sun', 0.5, 0.5, 0.5, [[0, '#FFF6D8', 0.95], [0.4, '#FFF1C4', 0.5], [1, '#FFF1C4', 0]])}
    ${vgrad('sea', [[0, '#7CC1DF'], [1, '#3E8FB8']])}
    ${vgrad('hill1', [[0, '#9FCF73'], [1, '#79B04E']])}
    ${vgrad('hill2', [[0, '#8CC562'], [1, '#5F9A3E']])}
    ${vgrad('ground', [[0, '#8CC562'], [1, '#4F8A36']])}
    ${vgrad('roofR', [[0, '#E2664C'], [1, '#B8402D']])}
    ${vgrad('wall', [[0, '#FBF0D9'], [1, '#E8D5B0']])}
    ${grassTexture('mottle', 8)}
    ${grainFilter('grain', { freq: 1.2, amount: 0.07, seed: 9 })}
    ${blurFilter('b6', 6)}${blurFilter('b14', 14)}
    ${vgrad('glass', [[0, '#E9F7FC'], [1, '#8FC6DD']])}
    ${vgrad('glassWarm', [[0, '#FFF6D6'], [1, '#F6CF7A']])}`;
  const r = rng(21);
  let sparkles = '';
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = horizon + 10 + r() * 170;
    sparkles += `<path d="M${x} ${y} h${14 + r() * 26}" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="${0.35 + r() * 0.4}"/>`;
  }
  let fg = '';
  for (let i = 0; i < 160; i++) {
    const x = r() * W, y = 1210 + r() * 710;
    const cols = ['#FFFFFF', '#FFE27A', '#F7A8C0', '#F49A62', '#C7B2F0'];
    const c = cols[Math.floor(r() * cols.length)];
    const s = 0.6 + ((y - 1210) / 710) * 1.2;
    fg += `<g transform="translate(${x} ${y}) scale(${s})">${[0, 72, 144, 216, 288].map((d) => `<ellipse rx="6" ry="3.6" cx="5" transform="rotate(${d})" fill="${c}"/>`).join('')}<circle r="3" fill="#F2B632"/></g>`;
  }
  let blades = '';
  for (let i = 0; i < 500; i++) {
    const x = r() * W, y = 1000 + r() * 920;
    const s = 0.6 + ((y - 1000) / 920) * 1.4;
    blades += `<path d="M${x} ${y} q${-3 * s} ${-8 * s} ${-2 * s} ${-14 * s} M${x} ${y} q${3 * s} ${-9 * s} ${4 * s} ${-15 * s}" stroke="${r() < 0.5 ? '#5E9A3A' : '#9CCB6A'}" stroke-width="${2 * s}" fill="none" stroke-linecap="round" opacity="0.75"/>`;
  }
  // 駅舎(大きい)
  const station = `<g transform="translate(110 ${870 + dy})">
    <ellipse cx="250" cy="300" rx="280" ry="26" fill="#1E3510" opacity="0.25" filter="url(#b6)"/>
    <rect x="-40" y="270" width="620" height="40" rx="6" fill="#D8C9A8"/><rect x="-40" y="270" width="620" height="8" fill="#EEE3CA"/>
    <rect x="40" y="150" width="420" height="125" fill="url(#wall)" filter="url(#grain)"/>
    <rect x="40" y="252" width="420" height="22" fill="#B48F62"/>
    ${[70, 140, 330, 400].map((x) => `<rect x="${x - 4}" y="${176}" width="48" height="52" rx="4" fill="#FFFFFF"/><rect x="${x}" y="180" width="40" height="44" rx="3" fill="url(#glassWarm)"/><line x1="${x + 20}" y1="180" x2="${x + 20}" y2="224" stroke="#FFFFFF" stroke-width="4"/>`).join('')}
    <rect x="215" y="170" width="70" height="104" rx="6" fill="#7A4430"/><rect x="222" y="178" width="26" height="92" rx="3" fill="url(#glassWarm)"/><rect x="252" y="178" width="26" height="92" rx="3" fill="url(#glassWarm)"/>
    <polygon points="0,156 500,156 462,48 38,48" fill="url(#roofR)"/>
    ${[1, 2, 3, 4].map((i) => `<line x1="${38 - 9.5 * i}" y1="${48 + 27 * i}" x2="${462 + 9.5 * i}" y2="${48 + 27 * i}" stroke="#9E3424" stroke-width="3" opacity="0.5"/>`).join('')}
    <line x1="0" y1="156" x2="500" y2="156" stroke="#8C2E20" stroke-width="7" stroke-linecap="round"/>
    <rect x="175" y="50" width="150" height="100" fill="url(#wall)"/>
    <polygon points="160,62 250,-14 340,62" fill="url(#roofR)"/>
    <line x1="160" y1="62" x2="250" y2="-14" stroke="#8C2E20" stroke-width="7" stroke-linecap="round"/><line x1="250" y1="-14" x2="340" y2="62" stroke="#8C2E20" stroke-width="7" stroke-linecap="round"/>
    <circle cx="250" cy="96" r="38" fill="#8B6A4E"/><circle cx="250" cy="96" r="32" fill="#FFFFFF"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${250 + Math.cos(a) * 25}" cy="${96 + Math.sin(a) * 25}" r="2.5" fill="#5B4A3A"/>`; }).join('')}
    <line x1="250" y1="96" x2="250" y2="74" stroke="#2E3B44" stroke-width="5" stroke-linecap="round"/><line x1="250" y1="96" x2="266" y2="104" stroke="#2E3B44" stroke-width="5" stroke-linecap="round"/>
  </g>`;
  // 列車(横から、3 両)
  const car = (x, w, loco) => `<g transform="translate(${x} 0)">
      <path d="${loco ? `M0 50 Q0 0 50 0 H${w - 14} Q${w} 0 ${w} 14 V130 H0 Z` : `M0 14 Q0 0 14 0 H${w - 14} Q${w} 0 ${w} 14 V130 H0 Z`}" fill="#D9473B" stroke="#8E2A21" stroke-width="5"/>
      <rect x="4" y="80" width="${w - 8}" height="16" fill="#F3E6CF"/>
      ${Array.from({ length: loco ? 3 : 4 }, (_, i) => `<rect x="${(loco ? 60 : 18) + i * 52}" y="22" width="38" height="40" rx="6" fill="url(#glass)" stroke="#8E2A21" stroke-width="4"/>`).join('')}
      ${loco ? `<rect x="10" y="44" width="30" height="26" rx="8" fill="url(#glass)" stroke="#8E2A21" stroke-width="4"/><circle cx="12" cy="110" r="8" fill="#FFF3A8" stroke="#B8902A" stroke-width="3"/>` : ''}
      <rect x="12" y="122" width="${w - 24}" height="16" rx="4" fill="#3A4045"/>
      ${[40, 80, w - 80, w - 40].map((cx) => `<circle cx="${cx}" cy="140" r="19" fill="#2F3438"/><circle cx="${cx}" cy="140" r="8" fill="#8C949B"/>`).join('')}
    </g>`;
  const train = `<g transform="translate(560 ${1050 + dy})">
      <ellipse cx="300" cy="166" rx="320" ry="14" fill="#1E3510" opacity="0.3" filter="url(#b6)"/>
      ${car(0, 260, true)}${car(270, 230, false)}
      <circle cx="40" cy="-30" r="22" fill="#FFFFFF" opacity="0.7"/><circle cx="70" cy="-70" r="30" fill="#FFFFFF" opacity="0.5"/><circle cx="110" cy="-118" r="36" fill="#FFFFFF" opacity="0.3"/>
    </g>`;
  let sleepers = '';
  for (let x = -20; x < W + 20; x += 34) sleepers += `<rect x="${x}" y="${1196 + dy}" width="18" height="38" rx="3" fill="#7B4F31"/>`;
  return svg(W, H, defs, `
    <rect width="${W}" height="${horizon + 20}" fill="url(#sky)"/>
    <circle cx="780" cy="560" r="300" fill="url(#sun)"/>
    ${cloud(180, 300, 1.6)}${cloud(860, 200, 1.3)}${cloud(560, 520, 0.9, 0.9)}${cloud(120, 640, 0.8, 0.85)}${cloud(980, 700, 0.7, 0.8)}
    <path d="M620 ${horizon} Q760 ${horizon - 90} 940 ${horizon} Z" fill="#8FBF8A"/>
    <g transform="translate(820 ${horizon - 64})">
      <polygon points="-20,40 -12,-120 12,-120 20,40" fill="#FFFFFF"/>
      <rect x="-19" y="-50" width="38" height="22" fill="#D9473B"/><rect x="-16" y="-110" width="32" height="18" fill="#D9473B"/>
      <rect x="-15" y="-150" width="30" height="30" fill="#FFF0B0"/><polygon points="-22,-150 0,-180 22,-150" fill="#D9473B"/>
      <rect x="-24" y="-124" width="48" height="6" fill="#2E3B44"/>
    </g>
    <path d="M0 ${horizon} Q160 ${horizon - 70} 340 ${horizon - 10} Q420 ${horizon - 30} 480 ${horizon} Z" fill="#8FC47F"/>
    ${[60, 120, 190, 260].map((x, i) => `<g transform="translate(${x} ${horizon - 40 + (i % 2) * 14})"><rect x="-16" y="-16" width="32" height="26" fill="#FBF0D9"/><polygon points="-22,-14 0,-34 22,-14" fill="${['#D2553E', '#3E7CB1', '#E8A04A', '#3F8A52'][i]}"/></g>`).join('')}
    <rect y="${horizon}" width="${W}" height="200" fill="url(#sea)"/>
    ${sparkles}
    <g transform="translate(470 ${horizon + 60})"><path d="M-30 0 h60 l-10 14 h-40 Z" fill="#7A4E33"/><path d="M0 -4 V-60 L32 -8 Z" fill="#FFFFFF"/><path d="M-3 -4 V-46 L-26 -8 Z" fill="#F4EBDD"/></g>
    <path d="M0 ${1010 + dy} Q300 ${960 + dy} 560 ${1000 + dy} Q820 ${1040 + dy} 1080 ${980 + dy} V1920 H0 Z" fill="url(#hill1)"/>
    <path d="M0 ${1010 + dy} Q300 ${960 + dy} 560 ${1000 + dy} Q820 ${1040 + dy} 1080 ${980 + dy} V1920 H0 Z" filter="url(#mottle)" opacity="0.35"/>
    ${treeBlob(990, 990 + dy, 1.6)}${pine(60, 980 + dy, 1.5)}${treeBlob(1040, 1020 + dy, 1.2)}
    ${station}
    <rect y="${1180 + dy}" width="${W}" height="70" fill="#C9B793"/>
    ${sleepers}
    <rect y="${1196 + dy}" width="${W}" height="9" fill="#3E454C"/><rect y="${1196 + dy}" width="${W}" height="3" fill="#D6DDE3"/>
    <rect y="${1224 + dy}" width="${W}" height="9" fill="#3E454C"/><rect y="${1224 + dy}" width="${W}" height="3" fill="#D6DDE3"/>
    ${train}
    <path d="M0 ${1250 + dy} Q540 ${1220 + dy} 1080 ${1250 + dy} V1920 H0 Z" fill="url(#ground)"/>
    <path d="M0 ${1250 + dy} Q540 ${1220 + dy} 1080 ${1250 + dy} V1920 H0 Z" filter="url(#mottle)" opacity="0.4"/>
    ${blades}
    ${fg}`);
}

// ---- ワールドの絵(600×200) ----
function worldBanner(n) {
  const W = 600, H = 200;
  const themes = {
    1: { sky: ['#8ECFEA', '#E6F4E4'], hill: '#8CC562', far: '#B5DB95', accent: 'meadow' },
    2: { sky: ['#7FC3E6', '#DDF1F7'], hill: '#E9DDB4', far: '#5DB0D6', accent: 'sea' },
    3: { sky: ['#9CC9E8', '#F2EED8'], hill: '#7FB55A', far: '#9CC97A', accent: 'hill' },
    4: { sky: ['#F4C48A', '#FBE9C9'], hill: '#9CC96E', far: '#C9B793', accent: 'town' },
    5: { sky: ['#5A5FA0', '#F2A97A'], hill: '#4F7A4A', far: '#6E8F6A', accent: 'dusk' },
  };
  const t = themes[n];
  const defs = `${vgrad('sky', [[0, t.sky[0]], [1, t.sky[1]]])}${grassTexture('mottle', n)}`;
  let accent = '';
  if (t.accent === 'meadow') accent = `${treeBlob(80, 120, 1.1)}${treeBlob(500, 116, 1.2)}${pine(540, 120, 1)}<g transform="translate(330 96)"><rect x="-26" y="-20" width="52" height="38" fill="#FBF0D9"/><polygon points="-34,-18 0,-48 34,-18" fill="#D2553E"/><rect x="-6" y="0" width="12" height="18" fill="#8B5634"/></g>`;
  if (t.accent === 'sea') accent = `<rect y="104" width="${W}" height="40" fill="#5DB0D6"/><path d="M0 104 h600" stroke="#FFFFFF" stroke-width="2" opacity="0.7"/><g transform="translate(470 74)"><polygon points="-10,40 -6,-30 6,-30 10,40" fill="#FFFFFF"/><rect x="-9" y="-4" width="18" height="10" fill="#D9473B"/><rect x="-8" y="-40" width="16" height="12" fill="#FFF0B0"/><polygon points="-11,-40 0,-54 11,-40" fill="#D9473B"/></g><g transform="translate(200 116)"><path d="M-16 0 h32 l-6 8 h-20 Z" fill="#7A4E33"/><path d="M0 -2 V-30 L16 -4 Z" fill="#FFFFFF"/></g>`;
  if (t.accent === 'hill') accent = `<g transform="translate(450 80)"><rect x="-14" y="-10" width="28" height="56" fill="#F4EBDD"/><polygon points="-18,-10 0,-30 18,-10" fill="#8B4A2B"/>${[0, 90, 180, 270].map((d) => `<rect x="-3" y="-60" width="6" height="58" fill="#FFFFFF" transform="rotate(${d + 20} 0 -14)"/>`).join('')}<circle cx="0" cy="-14" r="5" fill="#6B4630"/></g>${pine(100, 110, 1)}${pine(140, 118, 0.8)}`;
  if (t.accent === 'town') accent = [60, 140, 220, 380, 460, 540].map((x, i) => `<g transform="translate(${x} ${108 - (i % 2) * 6})"><rect x="-24" y="-30" width="48" height="44" fill="${['#FBF0D9', '#F7D9A8', '#FFFFFF'][i % 3]}"/><polygon points="-30,-28 0,-54 30,-28" fill="${['#D2553E', '#3E7CB1', '#8B4A2B', '#3F8A52'][i % 4]}"/><rect x="-14" y="-18" width="10" height="10" fill="#F6CF7A"/><rect x="4" y="-18" width="10" height="10" fill="#F6CF7A"/></g>`).join('') + `<g transform="translate(300 70)"><rect x="-12" y="-10" width="24" height="70" fill="#ECDFC2"/><polygon points="-16,-10 0,-36 16,-10" fill="#3F8A52"/><circle cy="6" r="8" fill="#FFFFFF" stroke="#8B6A4E" stroke-width="2"/></g>`;
  if (t.accent === 'dusk') accent = `<circle cx="470" cy="70" r="30" fill="#FFE2A8" opacity="0.9"/>${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i * 47) % 580 + 10}" cy="${12 + (i * 23) % 50}" r="1.6" fill="#FFFFFF" opacity="0.8"/>`).join('')}<g transform="translate(300 96)"><rect x="-80" y="-30" width="160" height="48" fill="#F2E3C2"/><polygon points="-92,-28 92,-28 74,-56 -74,-56" fill="#3F8A52"/><rect x="-60" y="-14" width="20" height="16" fill="#FFD27A"/><rect x="-24" y="-14" width="20" height="16" fill="#FFD27A"/><rect x="14" y="-14" width="20" height="16" fill="#FFD27A"/><rect x="48" y="-14" width="20" height="16" fill="#FFD27A"/></g>`;
  const train = `<g transform="translate(40 150)">${[0, 1, 2].map((i) => `<g transform="translate(${i * 58} 0)"><rect width="54" height="26" rx="${i === 0 ? 10 : 4}" fill="#D9473B" stroke="#8E2A21" stroke-width="2"/><rect x="2" y="15" width="50" height="4" fill="#F3E6CF"/>${[8, 22, 36].map((x) => `<rect x="${x}" y="5" width="9" height="8" rx="1.5" fill="#DFF3FB"/>`).join('')}<circle cx="12" cy="28" r="4" fill="#2F3438"/><circle cx="42" cy="28" r="4" fill="#2F3438"/></g>`).join('')}</g>`;
  return svg(W, H, defs, `
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${n === 5 ? '' : cloud(120, 40, 0.6)}${n === 5 ? '' : cloud(420, 30, 0.5)}
    <path d="M0 110 Q150 70 300 100 Q450 128 600 90 V200 H0 Z" fill="${t.far}"/>
    ${accent}
    <path d="M0 140 Q300 120 600 140 V200 H0 Z" fill="${t.hill}"/>
    <path d="M0 140 Q300 120 600 140 V200 H0 Z" filter="url(#mottle)" opacity="0.35"/>
    <rect y="176" width="${W}" height="10" fill="#C9B793"/>
    ${Array.from({ length: 40 }, (_, i) => `<rect x="${i * 15}" y="176" width="7" height="10" fill="#7B4F31"/>`).join('')}
    <line x1="0" y1="178" x2="${W}" y2="178" stroke="#3E454C" stroke-width="2"/><line x1="0" y1="184" x2="${W}" y2="184" stroke="#3E454C" stroke-width="2"/>
    ${train}
    ${n === 5 ? `<rect width="${W}" height="${H}" fill="#2A2350" opacity="0.18"/>` : ''}`);
}

module.exports = { townBackground, titleScene, worldBanner };
