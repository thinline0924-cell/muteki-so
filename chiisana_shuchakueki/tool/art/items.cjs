// 町に置く建物・装飾、駅舎、住民の絵(少し上から見た 3/4 の角度)。256×256、足もとは下の中央。
'use strict';
const { shade, vgrad, lgrad, rgrad, grainFilter, blurFilter, rng, svg } = require('./lib.cjs');

const S = 256;

const commonDefs = () => `
  ${blurFilter('gs', 7)}
  ${blurFilter('soft', 2)}
  ${grainFilter('grain', { freq: 1.1, amount: 0.1, seed: 3 })}
  ${vgrad('glass', [[0, '#E9F7FC'], [0.5, '#A9D8EC'], [1, '#6FAFCB']])}
  ${vgrad('glassWarm', [[0, '#FFF6D6'], [1, '#F6CF7A']])}`;

const groundShadow = (cx = 132, cy = 232, rx = 104, ry = 18) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1E3510" opacity="0.32" filter="url(#gs)"/>`;

function windowBox(x, y, w, h, frame = '#FFFFFF', warm = false, shutters = null) {
  const sh = shutters
    ? `<rect x="${x - 9}" y="${y - 1}" width="8" height="${h + 2}" rx="1.5" fill="${shutters}"/><rect x="${x + w + 1}" y="${y - 1}" width="8" height="${h + 2}" rx="1.5" fill="${shutters}"/>`
    : '';
  return `${sh}
    <rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="3" fill="${frame}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="url(#${warm ? 'glassWarm' : 'glass'})"/>
    <line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${frame}" stroke-width="3"/>
    <line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${frame}" stroke-width="3"/>
    <path d="M${x + 3} ${y + h * 0.42} L${x + w * 0.38} ${y + 3}" stroke="#FFFFFF" stroke-width="3" opacity="0.7"/>
    <rect x="${x - 5}" y="${y + h + 2}" width="${w + 10}" height="5" rx="2" fill="${shade(frame, -0.15)}"/>`;
}

/** 三角屋根の家(棟は正面と平行)。o: 色や飾り */
function house(o) {
  const wall = o.wall, roof = o.roof;
  const defs = `${commonDefs()}
    ${vgrad('roofF', [[0, shade(roof, 0.12)], [1, shade(roof, -0.12)]])}
    ${vgrad('wallF', [[0, shade(wall, 0.04)], [1, shade(wall, -0.06)]])}
    ${vgrad('wallS', [[0, shade(wall, -0.18)], [1, shade(wall, -0.28)]])}`;
  // 屋根の瓦の段
  let tiles = '';
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const y = 63 + (136 - 63) * t;
    const xl = 60 + (36 - 60) * t, xr = 208 + (194 - 208) * t;
    tiles += `<line x1="${xl}" y1="${y}" x2="${xr}" y2="${y}" stroke="${shade(roof, -0.3)}" stroke-width="2" opacity="0.55"/>`;
  }
  const chimney = o.chimney
    ? `<polygon points="150,44 168,44 168,84 150,90" fill="${shade('#9C5B3C', 0)}"/><polygon points="168,44 178,39 178,80 168,84" fill="#7A4430"/><rect x="146" y="38" width="26" height="8" rx="2" fill="#6B3A28"/>
       <circle cx="166" cy="24" r="9" fill="#FFFFFF" opacity="0.75"/><circle cx="178" cy="12" r="6" fill="#FFFFFF" opacity="0.55"/>`
    : '';
  return svg(S, S, defs, `
    ${groundShadow()}
    <polygon points="184,128 224,106 224,208 184,230" fill="url(#wallS)" filter="url(#grain)"/>
    <rect x="48" y="128" width="136" height="102" fill="url(#wallF)" filter="url(#grain)"/>
    <rect x="48" y="214" width="136" height="16" fill="${shade(wall, -0.32)}"/>
    <polygon points="184,214 224,192 224,208 184,230" fill="${shade(wall, -0.45)}"/>
    <rect x="48" y="128" width="136" height="12" fill="#000000" opacity="0.12"/>
    <polygon points="184,128 224,106 204,64" fill="${shade(wall, -0.12)}"/>
    ${chimney}
    <polygon points="34,138 196,138 208,62 60,62" fill="url(#roofF)"/>
    ${tiles}
    <polygon points="196,138 230,110 208,62" fill="${shade(roof, -0.3)}"/>
    <line x1="60" y1="62" x2="208" y2="62" stroke="${shade(roof, 0.3)}" stroke-width="5" stroke-linecap="round"/>
    <line x1="34" y1="138" x2="196" y2="138" stroke="${shade(roof, -0.4)}" stroke-width="4" stroke-linecap="round"/>
    <line x1="196" y1="138" x2="230" y2="110" stroke="${shade(roof, -0.45)}" stroke-width="4" stroke-linecap="round"/>
    ${o.front || ''}
    ${o.extra || ''}`);
}

function door(x, y, color = '#8B5634') {
  return `<rect x="${x - 2}" y="${y - 2}" width="34" height="${230 - y + 2}" rx="15" fill="${shade(color, -0.3)}"/>
    <rect x="${x}" y="${y}" width="30" height="${230 - y}" rx="13" fill="${color}"/>
    <rect x="${x + 5}" y="${y + 8}" width="20" height="14" rx="6" fill="url(#glassWarm)" opacity="0.9"/>
    <circle cx="${x + 23}" cy="${y + 34}" r="2.5" fill="#F2C94C"/>
    <rect x="${x - 6}" y="228" width="42" height="6" rx="2" fill="#B8AA92"/>`;
}

function flowerBox(x, y, w) {
  const r = rng(x * 7 + y);
  const cols = ['#F7A8C0', '#FFE27A', '#FFFFFF', '#F49A62'];
  let f = '';
  for (let i = 0; i < w / 8; i++) f += `<circle cx="${x + 4 + i * 8}" cy="${y - 3 - r() * 4}" r="4" fill="${cols[i % 4]}"/>`;
  return `<rect x="${x}" y="${y - 6}" width="${w}" height="8" rx="4" fill="#5E9A3A"/>${f}<rect x="${x - 2}" y="${y}" width="${w + 4}" height="8" rx="2" fill="#9C6B45"/>`;
}

const items = {
  house_small: () => house({
    wall: '#F6E8CB', roof: '#D2553E', chimney: true,
    front: `${windowBox(64, 154, 34, 30, '#FFFFFF', false, '#5E9A3A')}${windowBox(140, 154, 30, 30, '#FFFFFF', true)}${flowerBox(60, 194, 42)}${door(104, 170)}`,
  }),
  house_blue: () => house({
    wall: '#FFFFFF', roof: '#3E7CB1',
    front: `${windowBox(62, 152, 30, 34, '#DDE8F0')}${windowBox(142, 152, 30, 34, '#DDE8F0')}${door(102, 168, '#3E6C95')}`,
    extra: `<circle cx="126" cy="100" r="11" fill="#FFFFFF" stroke="#2F5F8A" stroke-width="3"/><circle cx="126" cy="100" r="5" fill="#A9D8EC"/>`,
  }),
  shop: () => storefront({ wall: '#F2E6CF', stripe: '#D9473B', sign: '商店', goods: true }),
  cafe: () => storefront({ wall: '#EFDDBF', stripe: '#3F8A52', sign: 'カフェ', cafe: true }),
  bakery: () => house({
    wall: '#F7D9A8', roof: '#8B4A2B', chimney: true,
    front: `${windowBox(60, 156, 38, 32, '#FFFFFF', true)}${door(108, 168, '#7A4430')}${windowBox(150, 156, 22, 32, '#FFFFFF', true)}`,
    extra: `<g transform="translate(126 112)"><ellipse rx="30" ry="18" fill="#FFFFFF" stroke="#8B4A2B" stroke-width="3"/><ellipse rx="20" ry="9" fill="#D9963A"/><path d="M-8 -6 l4 12 M0 -7 l4 13 M8 -6 l4 12" stroke="#F7E0B5" stroke-width="2.5" stroke-linecap="round"/></g>`,
  }),
  clocktower: clockTower,
  tree: decoTree,
  flowerbed,
  bench,
  streetlamp: lamp,
  mailbox,
  pond: decoPond,
  fountain,
};

function storefront(o) {
  const wall = o.wall;
  const defs = `${commonDefs()}
    ${vgrad('wallF', [[0, shade(wall, 0.04)], [1, shade(wall, -0.06)]])}
    ${vgrad('wallS', [[0, shade(wall, -0.2)], [1, shade(wall, -0.3)]])}`;
  // ひさし(しま模様、前にせり出す)
  let aw = '';
  const n = 7, x0 = 40, x1 = 192, y0 = 140, y1 = 166;
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n, b = x0 + ((x1 - x0) * (i + 1)) / n;
    aw += `<path d="M${a + 6} ${y0} H${b + 6} L${b} ${y1} Q${(a + b) / 2} ${y1 + 9} ${a} ${y1} Z" fill="${i % 2 ? '#FFFFFF' : o.stripe}"/>`;
  }
  const goods = o.goods
    ? `<rect x="58" y="196" width="50" height="22" rx="3" fill="#9C6B45"/>${['#E9763A', '#F2C94C', '#D9473B', '#5E9A3A', '#E9763A'].map((c, i) => `<circle cx="${64 + i * 10}" cy="${194}" r="6" fill="${c}"/>`).join('')}`
    : '';
  const cafe = o.cafe
    ? `<g transform="translate(200 214)"><ellipse cx="0" cy="12" rx="20" ry="5" fill="#000" opacity="0.2"/><rect x="-2" y="-14" width="4" height="26" fill="#6B4B33"/><ellipse cx="0" cy="-14" rx="18" ry="5" fill="#FFFFFF" stroke="#8B6A4E" stroke-width="2"/></g>
       <g transform="translate(34 178)"><rect x="0" y="0" width="20" height="30" rx="3" fill="#2E3B44"/><text x="10" y="13" font-size="8" fill="#FFFFFF" text-anchor="middle" font-weight="bold">本日</text><text x="10" y="24" font-size="7" fill="#F2C94C" text-anchor="middle">ケーキ</text></g>`
    : '';
  return svg(S, S, defs, `
    ${groundShadow()}
    <polygon points="186,96 222,78 222,206 186,228" fill="url(#wallS)" filter="url(#grain)"/>
    <rect x="46" y="96" width="140" height="132" fill="url(#wallF)" filter="url(#grain)"/>
    <polygon points="40,96 192,96 226,76 74,76" fill="${shade(wall, -0.35)}"/>
    <rect x="40" y="88" width="152" height="12" fill="${shade(wall, -0.42)}"/>
    <polygon points="192,88 226,70 226,80 192,100" fill="${shade(wall, -0.55)}"/>
    <rect x="62" y="104" width="108" height="28" rx="5" fill="#5B3B24"/>
    <rect x="65" y="107" width="102" height="22" rx="4" fill="#6E4A2E"/>
    <text x="116" y="124" font-size="17" font-weight="bold" fill="#FFF6E0" text-anchor="middle" font-family="sans-serif">${o.sign}</text>
    <rect x="58" y="168" width="68" height="48" rx="3" fill="#FFFFFF"/>
    <rect x="62" y="172" width="60" height="42" rx="2" fill="url(#glassWarm)"/>
    <path d="M66 208 L84 176" stroke="#FFFFFF" stroke-width="4" opacity="0.6"/>
    ${goods}
    ${door(140, 170, '#6E4A2E')}
    ${aw}
    <rect x="46" y="214" width="140" height="16" fill="${shade(wall, -0.32)}"/>
    <polygon points="186,214 222,192 222,206 186,228" fill="${shade(wall, -0.45)}"/>
    ${cafe}`);
}

function clockTower() {
  const wall = '#ECDFC2', roof = '#3F8A52';
  const defs = `${commonDefs()}
    ${vgrad('wallF', [[0, shade(wall, 0.05)], [1, shade(wall, -0.06)]])}
    ${rgrad('face', 0.4, 0.35, 0.7, [[0, '#FFFFFF'], [1, '#E6E1D6']])}`;
  return svg(S, S, defs, `
    ${groundShadow(132, 234, 70, 14)}
    <polygon points="160,74 182,62 182,214 160,230" fill="${shade(wall, -0.25)}" filter="url(#grain)"/>
    <rect x="94" y="74" width="66" height="156" fill="url(#wallF)" filter="url(#grain)"/>
    <rect x="94" y="74" width="66" height="8" fill="${shade(wall, -0.3)}"/>
    <rect x="88" y="68" width="78" height="10" rx="2" fill="#B9A57E"/><polygon points="166,68 188,56 188,64 166,78" fill="#9C8963"/>
    <polygon points="84,70 170,70 192,58 128,6" fill="${shade(roof, 0.05)}"/>
    <polygon points="170,70 192,58 128,6" fill="${shade(roof, -0.25)}"/>
    <line x1="128" y1="6" x2="128" y2="-4" stroke="#C9A43A" stroke-width="4"/><circle cx="128" cy="4" r="5" fill="#F2C94C"/>
    <circle cx="127" cy="112" r="25" fill="#8B6A4E"/>
    <circle cx="127" cy="112" r="21" fill="url(#face)"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${127 + Math.cos(a) * 16}" cy="${112 + Math.sin(a) * 16}" r="1.6" fill="#5B4A3A"/>`; }).join('')}
    <line x1="127" y1="112" x2="127" y2="98" stroke="#2E3B44" stroke-width="3.5" stroke-linecap="round"/>
    <line x1="127" y1="112" x2="137" y2="116" stroke="#2E3B44" stroke-width="3.5" stroke-linecap="round"/>
    ${windowBox(114, 150, 26, 28, '#FFFFFF', true)}
    ${door(112, 192, '#7A4430')}
    <rect x="94" y="216" width="66" height="14" fill="${shade(wall, -0.32)}"/>`);
}

function decoTree() {
  const defs = `${commonDefs()}
    ${rgrad('lf', 0.35, 0.28, 0.75, [[0, '#9AD873'], [0.55, '#4F9C45'], [1, '#2C6A30']])}
    ${rgrad('lf2', 0.35, 0.28, 0.75, [[0, '#88CA62'], [0.6, '#418D3D'], [1, '#245A28']])}`;
  return svg(S, S, defs, `
    ${groundShadow(134, 230, 70, 14)}
    <path d="M118 230 L122 160 L136 160 L140 230 Z" fill="#7A5034"/><path d="M130 160 L140 230 L134 230 Z" fill="#5A3A24"/>
    <circle cx="96" cy="128" r="46" fill="url(#lf2)"/><circle cx="164" cy="126" r="46" fill="url(#lf2)"/>
    <circle cx="130" cy="150" r="50" fill="url(#lf)"/><circle cx="128" cy="86" r="56" fill="url(#lf)"/>
    <ellipse cx="108" cy="70" rx="18" ry="11" fill="#C3EE9A" opacity="0.55"/><ellipse cx="82" cy="118" rx="12" ry="8" fill="#C3EE9A" opacity="0.45"/>
    <circle cx="150" cy="104" r="6" fill="#E05A4A"/><circle cx="104" cy="148" r="6" fill="#E05A4A"/><circle cx="164" cy="152" r="5" fill="#E05A4A"/>`);
}

function flowerbed() {
  const defs = commonDefs();
  const r = rng(9);
  const cols = ['#F7A8C0', '#FFE27A', '#FFFFFF', '#F49A62', '#C7B2F0', '#E05A6A'];
  let fl = '';
  for (let i = 0; i < 24; i++) {
    const x = 58 + r() * 140, y = 150 + r() * 34;
    const c = cols[Math.floor(r() * cols.length)];
    fl += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 18}" stroke="#4E8A36" stroke-width="3"/>`;
    fl += `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((d) => `<ellipse rx="6" ry="3.8" cx="5" transform="rotate(${d})" fill="${c}" stroke="${shade(c, -0.25)}" stroke-width="0.8"/>`).join('')}<circle r="3" fill="#F2B632"/></g>`;
  }
  return svg(S, S, defs, `
    ${groundShadow(132, 230, 96, 14)}
    <polygon points="40,190 212,190 226,180 226,212 212,226 40,226" fill="#7A5034"/>
    <rect x="40" y="190" width="172" height="36" rx="3" fill="#A8703F"/>
    ${[0, 1, 2, 3].map((i) => `<line x1="40" y1="${198 + i * 8}" x2="212" y2="${198 + i * 8}" stroke="#7A5034" stroke-width="1.5" opacity="0.6"/>`).join('')}
    <ellipse cx="128" cy="186" rx="88" ry="16" fill="#5A3A24"/>
    <ellipse cx="128" cy="176" rx="80" ry="26" fill="#5E9A3A"/>
    ${fl}`);
}

function bench() {
  const defs = commonDefs();
  const wood = '#B07A48';
  const slat = (y, h, x0 = 52, x1 = 212) => `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="${h}" rx="4" fill="${wood}"/><rect x="${x0}" y="${y}" width="${x1 - x0}" height="3" rx="1.5" fill="#D9A877"/><rect x="${x0}" y="${y + h - 3}" width="${x1 - x0}" height="3" fill="#7A5034"/>`;
  return svg(S, S, defs, `
    ${groundShadow(132, 228, 96, 12)}
    <rect x="62" y="150" width="9" height="78" rx="3" fill="#3A3F44"/><rect x="190" y="150" width="9" height="78" rx="3" fill="#3A3F44"/>
    ${slat(120, 16)}${slat(142, 16)}
    <polygon points="44,178 220,178 232,168 56,168" fill="#C9935C"/>
    ${slat(178, 16, 44, 220)}
    <rect x="70" y="194" width="8" height="34" rx="3" fill="#2E3338"/><rect x="186" y="194" width="8" height="34" rx="3" fill="#2E3338"/>`);
}

function lamp() {
  const defs = `${commonDefs()}${rgrad('glow', 0.5, 0.5, 0.5, [[0, '#FFF3B8', 0.9], [1, '#FFF3B8', 0]])}`;
  return svg(S, S, defs, `
    ${groundShadow(132, 230, 40, 9)}
    <circle cx="128" cy="62" r="56" fill="url(#glow)"/>
    <rect x="122" y="84" width="12" height="140" rx="4" fill="#2E3B44"/><rect x="124" y="84" width="3" height="140" fill="#5C6B75"/>
    <path d="M110 230 h36 l-6 -16 h-24 Z" fill="#2E3B44"/>
    <rect x="108" y="40" width="40" height="44" rx="6" fill="#FFF3B8" stroke="#2E3B44" stroke-width="5"/>
    <line x1="128" y1="40" x2="128" y2="84" stroke="#2E3B44" stroke-width="3"/>
    <path d="M100 42 L128 20 L156 42 Z" fill="#2E3B44"/><circle cx="128" cy="16" r="5" fill="#2E3B44"/>`);
}

function mailbox() {
  const defs = `${commonDefs()}${lgrad('red', 0, 0, 1, 0, [[0, '#F06A5A'], [0.45, '#D9473B'], [1, '#A82E25']])}`;
  return svg(S, S, defs, `
    ${groundShadow(132, 230, 46, 10)}
    <rect x="116" y="180" width="24" height="48" fill="#3A3F44"/>
    <path d="M90 186 V96 Q90 60 128 60 Q166 60 166 96 V186 Z" fill="url(#red)"/>
    <rect x="86" y="180" width="84" height="12" rx="3" fill="#A82E25"/>
    <rect x="104" y="104" width="48" height="8" rx="3" fill="#4A1A14"/>
    <text x="128" y="152" font-size="30" font-weight="bold" fill="#FFFFFF" text-anchor="middle" font-family="sans-serif">〒</text>
    <path d="M100 82 Q110 66 128 64" stroke="#FFFFFF" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.5"/>`);
}

function decoPond() {
  const defs = `${commonDefs()}${rgrad('w', 0.45, 0.4, 0.65, [[0, '#2F7FA8'], [0.7, '#4FA3CB'], [1, '#8ACBE4']])}`;
  const r = rng(4);
  let stones = '';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    stones += `<ellipse cx="${128 + Math.cos(a) * 96}" cy="${190 + Math.sin(a) * 38}" rx="${11 + r() * 5}" ry="${7 + r() * 3}" fill="${r() < 0.5 ? '#C4BDAE' : '#A9A293'}" stroke="#7D7768" stroke-width="1.5"/>`;
  }
  return svg(S, S, defs, `
    <ellipse cx="128" cy="192" rx="100" ry="42" fill="#7D6E54"/>
    <ellipse cx="128" cy="190" rx="90" ry="34" fill="url(#w)"/>
    <path d="M80 182 q20 -8 40 0 M140 200 q16 -6 32 0" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>
    ${stones}
    <ellipse cx="96" cy="196" rx="14" ry="6" fill="#5FA845"/><ellipse cx="160" cy="180" rx="12" ry="5" fill="#5FA845"/>
    <g transform="translate(150 196)"><ellipse rx="14" ry="8" fill="#FFFFFF"/><circle cx="10" cy="-8" r="7" fill="#3F8A52"/><path d="M16 -8 l7 2 l-7 2 Z" fill="#F2B632"/></g>
    ${[0, 1, 2, 3].map((i) => `<path d="M${50 + i * 6} 196 q${-3 + i} -40 ${2 + i * 2} -${56 + i * 6}" stroke="#4E8A36" stroke-width="4" fill="none" stroke-linecap="round"/>`).join('')}
    <ellipse cx="57" cy="136" rx="5" ry="12" fill="#7A5232"/>`);
}

function fountain() {
  const defs = `${commonDefs()}${vgrad('stone', [[0, '#E4DED2'], [1, '#B9B2A4']])}${rgrad('w', 0.5, 0.4, 0.6, [[0, '#9FD6EE'], [1, '#4FA3CB']])}`;
  return svg(S, S, defs, `
    ${groundShadow(130, 228, 104, 16)}
    <path d="M24 186 Q24 226 128 228 Q232 226 232 186 Z" fill="url(#stone)"/>
    <ellipse cx="128" cy="186" rx="104" ry="26" fill="#CFC8BA"/>
    <ellipse cx="128" cy="186" rx="92" ry="20" fill="url(#w)"/>
    <rect x="116" y="110" width="24" height="76" rx="6" fill="url(#stone)"/>
    <ellipse cx="128" cy="112" rx="46" ry="12" fill="#CFC8BA"/><ellipse cx="128" cy="110" rx="38" ry="8" fill="url(#w)"/>
    <g stroke="#CDEFFC" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.9">
      <path d="M128 100 Q128 40 128 34"/>
      <path d="M126 50 Q86 52 70 182"/><path d="M130 50 Q170 52 186 182"/>
      <path d="M100 112 Q74 130 62 182" opacity="0.6"/><path d="M156 112 Q182 130 194 182" opacity="0.6"/>
    </g>
    <circle cx="128" cy="30" r="7" fill="#FFFFFF"/>
    <path d="M60 190 q10 -6 20 0 M170 196 q10 -6 20 0" stroke="#FFFFFF" stroke-width="3" fill="none" opacity="0.7"/>`);
}

// ---- 駅舎(町の絵用。横長 360×240) ----
function stationBuilding(roof, wall) {
  const W = 360, H = 240;
  const defs = `${commonDefs()}
    ${vgrad('roofF', [[0, shade(roof, 0.14)], [1, shade(roof, -0.12)]])}
    ${vgrad('wallF', [[0, shade(wall, 0.04)], [1, shade(wall, -0.07)]])}
    ${rgrad('face', 0.4, 0.35, 0.7, [[0, '#FFFFFF'], [1, '#E6E1D6']])}`;
  let tiles = '';
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    tiles += `<line x1="${44 - 20 * t}" y1="${62 + 66 * t}" x2="${316 + 20 * t}" y2="${62 + 66 * t}" stroke="${shade(roof, -0.3)}" stroke-width="2" opacity="0.5"/>`;
  }
  return svg(W, H, defs, `
    <ellipse cx="180" cy="226" rx="170" ry="16" fill="#1E3510" opacity="0.3" filter="url(#gs)"/>
    <rect x="8" y="206" width="344" height="26" rx="4" fill="#D8C9A8"/><rect x="8" y="206" width="344" height="5" fill="#EEE3CA"/>
    <rect x="44" y="128" width="272" height="82" fill="url(#wallF)" filter="url(#grain)"/>
    <rect x="44" y="196" width="272" height="14" fill="${shade(wall, -0.35)}"/>
    <rect x="44" y="128" width="272" height="10" fill="#000" opacity="0.12"/>
    ${windowBox(62, 148, 34, 32, '#FFFFFF', true)}${windowBox(110, 148, 34, 32, '#FFFFFF', true)}${windowBox(216, 148, 34, 32, '#FFFFFF', true)}${windowBox(264, 148, 34, 32, '#FFFFFF', true)}
    <rect x="160" y="146" width="40" height="64" rx="4" fill="#7A4430"/><rect x="164" y="150" width="15" height="56" rx="2" fill="url(#glassWarm)"/><rect x="181" y="150" width="15" height="56" rx="2" fill="url(#glassWarm)"/>
    <polygon points="22,132 338,132 316,60 44,60" fill="url(#roofF)"/>
    ${tiles}
    <line x1="22" y1="132" x2="338" y2="132" stroke="${shade(roof, -0.4)}" stroke-width="5" stroke-linecap="round"/>
    <line x1="44" y1="60" x2="316" y2="60" stroke="${shade(roof, 0.3)}" stroke-width="5" stroke-linecap="round"/>
    <polygon points="130,64 230,64 230,128 130,128" fill="url(#wallF)"/>
    <polygon points="120,70 180,22 240,70" fill="url(#roofF)"/><line x1="120" y1="70" x2="180" y2="22" stroke="${shade(roof, -0.35)}" stroke-width="5" stroke-linecap="round"/><line x1="180" y1="22" x2="240" y2="70" stroke="${shade(roof, -0.35)}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="180" cy="94" r="24" fill="#8B6A4E"/><circle cx="180" cy="94" r="20" fill="url(#face)"/>
    <line x1="180" y1="94" x2="180" y2="80" stroke="#2E3B44" stroke-width="3.5" stroke-linecap="round"/><line x1="180" y1="94" x2="190" y2="99" stroke="#2E3B44" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="140" y="112" width="80" height="20" rx="4" fill="#2F4F5E"/><text x="180" y="127" font-size="13" font-weight="bold" fill="#FFFFFF" text-anchor="middle" font-family="sans-serif">終着駅</text>`);
}

// ---- 住民(ちびキャラ) ----
function person(o) {
  const skin = '#F8D9BE';
  const defs = `${commonDefs()}
    ${rgrad('skin', 0.4, 0.35, 0.7, [[0, '#FFE9D6'], [1, '#EFC4A2']])}
    ${vgrad('cl', [[0, shade(o.clothes, 0.12)], [1, shade(o.clothes, -0.15)]])}`;
  const hair = o.hairColor || '#4A3426';
  const head = 98, hx = 128;
  return svg(S, S, defs, `
    ${groundShadow(128, 236, 52, 9)}
    <rect x="102" y="200" width="20" height="32" rx="8" fill="${o.legs || '#3A3F48'}"/><rect x="134" y="200" width="20" height="32" rx="8" fill="${o.legs || '#3A3F48'}"/>
    <ellipse cx="112" cy="232" rx="14" ry="6" fill="#2E2A28"/><ellipse cx="144" cy="232" rx="14" ry="6" fill="#2E2A28"/>
    <path d="M82 214 Q80 150 128 146 Q176 150 174 214 Z" fill="url(#cl)"/>
    ${o.apron ? `<path d="M104 160 H152 V214 H104 Z" fill="${o.apron}" opacity="0.95"/><rect x="104" y="160" width="48" height="6" fill="${shade(o.apron, -0.15)}"/>` : ''}
    ${o.badge ? `<circle cx="146" cy="172" r="5" fill="#F2C94C"/>` : ''}
    <ellipse cx="80" cy="186" rx="12" ry="22" fill="url(#cl)" transform="rotate(12 80 186)"/><ellipse cx="176" cy="186" rx="12" ry="22" fill="url(#cl)" transform="rotate(-12 176 186)"/>
    <circle cx="76" cy="206" r="9" fill="${skin}"/><circle cx="180" cy="206" r="9" fill="${skin}"/>
    <circle cx="${hx}" cy="${head}" r="54" fill="${hair}"/>
    <ellipse cx="${hx}" cy="${head + 8}" rx="48" ry="46" fill="url(#skin)"/>
    ${o.hairFront || `<path d="M78 ${head - 2} Q90 ${head - 50} 128 ${head - 52} Q168 ${head - 50} 178 ${head - 2} Q150 ${head - 28} 122 ${head - 20} Q98 ${head - 14} 78 ${head - 2} Z" fill="${hair}"/>`}
    <ellipse cx="${hx - 18}" cy="${head + 14}" rx="6" ry="8" fill="#2E2A28"/><ellipse cx="${hx + 18}" cy="${head + 14}" rx="6" ry="8" fill="#2E2A28"/>
    <circle cx="${hx - 16}" cy="${head + 10}" r="2.5" fill="#FFFFFF"/><circle cx="${hx + 20}" cy="${head + 10}" r="2.5" fill="#FFFFFF"/>
    <ellipse cx="${hx - 32}" cy="${head + 30}" rx="9" ry="5" fill="#F49A9A" opacity="0.6"/><ellipse cx="${hx + 32}" cy="${head + 30}" rx="9" ry="5" fill="#F49A9A" opacity="0.6"/>
    <path d="M${hx - 8} ${head + 32} Q${hx} ${head + 39} ${hx + 8} ${head + 32}" stroke="#7A3E2E" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${o.hat || ''}${o.extra || ''}`);
}

const residents = {
  resident_stationmaster: () => person({
    clothes: '#2F4F6E', badge: true, hairColor: '#3A2A22',
    hat: `<path d="M70 72 Q74 34 128 32 Q182 34 186 72 Z" fill="#24405A"/><rect x="66" y="66" width="124" height="14" rx="6" fill="#1B3045"/><path d="M84 80 Q128 96 172 80 L168 88 Q128 102 88 88 Z" fill="#151F2A"/><circle cx="128" cy="56" r="8" fill="#F2C94C"/><rect x="74" y="66" width="108" height="4" fill="#F2C94C"/>`,
    extra: `<path d="M118 150 L128 166 L138 150" fill="#FFFFFF"/><rect x="125" y="156" width="6" height="16" fill="#C23B2E"/>`,
  }),
  resident_shopkeeper: () => person({
    clothes: '#C46A8A', apron: '#FFFFFF', hairColor: '#C9C9C9', legs: '#6B4B5A',
    hairFront: `<path d="M78 96 Q84 50 128 46 Q172 50 178 96 Q150 70 128 72 Q104 70 78 96 Z" fill="#D9D9D9"/>`,
    hat: `<circle cx="128" cy="40" r="20" fill="#CFCFCF"/><circle cx="122" cy="36" r="6" fill="#EDEDED"/>`,
    extra: `<circle cx="110" cy="112" r="11" fill="none" stroke="#6B4B33" stroke-width="2.5"/><circle cx="146" cy="112" r="11" fill="none" stroke="#6B4B33" stroke-width="2.5"/><line x1="121" y1="112" x2="135" y2="112" stroke="#6B4B33" stroke-width="2.5"/>`,
  }),
  resident_barista: () => person({
    clothes: '#F2E9DA', apron: '#5B3B24', hairColor: '#5B3B24',
    extra: `<path d="M106 136 Q128 146 150 136 Q146 150 128 152 Q110 150 106 136 Z" fill="#5B3B24"/>`,
  }),
  resident_baker: () => person({
    clothes: '#FFFFFF', apron: '#F2C94C', hairColor: '#8B5A3C',
    hat: `<rect x="86" y="40" width="84" height="26" rx="6" fill="#FFFFFF" stroke="#E2DED6" stroke-width="2"/><circle cx="96" cy="32" r="20" fill="#FFFFFF"/><circle cx="128" cy="22" r="24" fill="#FFFFFF"/><circle cx="160" cy="32" r="20" fill="#FFFFFF"/><path d="M100 30 q10 -10 20 0" stroke="#E2DED6" stroke-width="2" fill="none"/>`,
  }),
  resident_gardener: () => person({
    clothes: '#3F8A52', apron: '#6FAE5A', hairColor: '#7A5232', legs: '#2F5F3A',
    hat: `<ellipse cx="128" cy="58" rx="76" ry="16" fill="#E8C873" stroke="#B8963A" stroke-width="2"/><path d="M86 58 Q90 22 128 20 Q166 22 170 58 Z" fill="#F0D488"/><rect x="88" y="48" width="80" height="8" fill="#D9473B"/>`,
  }),
  resident_kid: () => person({
    clothes: '#4F9FD9', hairColor: '#2E2420', legs: '#2F4F6E',
    hat: `<path d="M74 74 Q78 34 128 32 Q178 34 182 74 Z" fill="#D9473B"/><path d="M120 66 Q176 60 196 78 Q170 84 120 80 Z" fill="#B8352B"/><circle cx="128" cy="34" r="6" fill="#FFFFFF"/>`,
    extra: `<path d="M110 168 h36" stroke="#FFFFFF" stroke-width="5"/>`,
  }),
  resident_clockkeeper: () => person({
    clothes: '#6B4FA0', hairColor: '#8A8A8A', legs: '#2E2A40',
    hat: `<rect x="92" y="10" width="72" height="56" rx="6" fill="#2E2A3A"/><rect x="76" y="60" width="104" height="12" rx="6" fill="#2E2A3A"/><rect x="92" y="48" width="72" height="8" fill="#B8352B"/>`,
    extra: `<circle cx="146" cy="112" r="12" fill="none" stroke="#F2C94C" stroke-width="3"/><path d="M158 116 Q166 140 152 160" stroke="#F2C94C" stroke-width="2" fill="none"/><path d="M108 140 Q118 132 128 138 Q138 132 148 140" stroke="#8A8A8A" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  }),
  resident_cat: cat,
};

function cat() {
  const fur = '#E8A04A';
  const defs = `${commonDefs()}${rgrad('fur', 0.4, 0.35, 0.7, [[0, '#F6C27A'], [1, '#D9893A']])}`;
  return svg(S, S, defs, `
    ${groundShadow(128, 228, 70, 12)}
    <path d="M178 196 Q222 190 214 140 Q208 120 196 128" stroke="${fur}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <ellipse cx="128" cy="186" rx="62" ry="46" fill="url(#fur)"/>
    <path d="M96 150 q8 12 0 26 M112 146 q8 14 0 30 M146 146 q8 14 0 30" stroke="#C9772E" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.7"/>
    <ellipse cx="102" cy="226" rx="16" ry="8" fill="#F6C27A"/><ellipse cx="154" cy="226" rx="16" ry="8" fill="#F6C27A"/>
    <circle cx="128" cy="112" r="50" fill="url(#fur)"/>
    <path d="M86 92 L90 46 L120 72 Z" fill="${fur}"/><path d="M170 92 L166 46 L136 72 Z" fill="${fur}"/>
    <path d="M94 84 L96 58 L112 74 Z" fill="#F7B3B3"/><path d="M162 84 L160 58 L144 74 Z" fill="#F7B3B3"/>
    <path d="M112 72 q16 10 32 0" stroke="#C9772E" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="128" cy="130" rx="30" ry="20" fill="#FFF3E2"/>
    <ellipse cx="108" cy="112" rx="6" ry="9" fill="#2E2A28"/><ellipse cx="148" cy="112" rx="6" ry="9" fill="#2E2A28"/>
    <circle cx="110" cy="108" r="2.5" fill="#FFFFFF"/><circle cx="150" cy="108" r="2.5" fill="#FFFFFF"/>
    <path d="M122 126 L128 132 L134 126 Z" fill="#E07A7A"/>
    <path d="M128 132 Q122 140 116 136 M128 132 Q134 140 140 136" stroke="#7A3E2E" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M86 126 h-22 M86 134 h-20 M170 126 h22 M170 134 h20" stroke="#7A5A3A" stroke-width="2" stroke-linecap="round"/>`);
}

module.exports = { S, items, residents, stationBuilding };
