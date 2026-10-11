// 列車の絵。盤面用(真上から・右向き)と、図鑑・町用(横から)。
'use strict';
const { shade, mix, vgrad, lgrad, blurFilter, svg } = require('./lib.cjs');

// 盤面用の大きさ(1 マス = 256px として)
const TOP_W = 150; // 進む向き
const TOP_H = 112;

/** 真上から見た車両(右が前)。loco=true で先頭車 */
function trainTop(body, accent, loco) {
  const L = loco ? 116 : 104; // 車体の長さ
  const W = 84; // 幅
  const x0 = (TOP_W - L) / 2, y0 = (TOP_H - W) / 2;
  const nose = loco ? 30 : 12;
  const defs = `
    ${vgrad('roof', [[0, shade(body, -0.25)], [0.18, shade(body, 0.05)], [0.5, shade(body, 0.22)], [0.82, shade(body, 0.05)], [1, shade(body, -0.3)]])}
    ${vgrad('top', [[0, '#FFFFFF', 0.0], [0.45, '#FFFFFF', 0.35], [0.55, '#FFFFFF', 0.0]])}
    ${blurFilter('sh', 4)}`;
  const bodyPath = (dx = 0, dy = 0, inset = 0) => {
    const x = x0 + dx + inset, y = y0 + dy + inset, l = L - inset * 2, w = W - inset * 2;
    const rb = 16 - inset * 0.5, rf = nose - inset * 0.5;
    return `M${x + rb} ${y} H${x + l - rf} Q${x + l} ${y} ${x + l} ${y + rf} V${y + w - rf} Q${x + l} ${y + w} ${x + l - rf} ${y + w} H${x + rb} Q${x} ${y + w} ${x} ${y + w - rb} V${y + rb} Q${x} ${y} ${x + rb} ${y} Z`;
  };
  // 側面の窓(上から見ると車体のふちに並ぶ)
  let windows = '';
  const winCount = loco ? 2 : 4;
  const winStart = x0 + (loco ? 18 : 12);
  const winGap = loco ? 22 : 21;
  for (let i = 0; i < winCount; i++) {
    for (const yy of [y0 + 4, y0 + W - 11]) {
      windows += `<rect x="${winStart + i * winGap}" y="${yy}" width="15" height="7" rx="2" fill="#BFE6F5" stroke="${shade(body, -0.4)}" stroke-width="1"/>`;
    }
  }
  const front = loco
    ? `<path d="M${x0 + L - 26} ${y0 + 12} Q${x0 + L - 6} ${y0 + 14} ${x0 + L - 5} ${y0 + W / 2} Q${x0 + L - 6} ${y0 + W - 14} ${x0 + L - 26} ${y0 + W - 12} Z" fill="#2E4552"/>
       <path d="M${x0 + L - 22} ${y0 + 18} Q${x0 + L - 12} ${y0 + 22} ${x0 + L - 11} ${y0 + 32}" stroke="#9FD3EA" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>
       <circle cx="${x0 + L - 3}" cy="${y0 + 16}" r="5" fill="#FFF3A8" stroke="#C9A43A" stroke-width="1.5"/>
       <circle cx="${x0 + L - 3}" cy="${y0 + W - 16}" r="5" fill="#FFF3A8" stroke="#C9A43A" stroke-width="1.5"/>`
    : '';
  const vents = loco
    ? `<rect x="${x0 + 22}" y="${y0 + 30}" width="30" height="24" rx="5" fill="${shade(body, -0.15)}" stroke="${shade(body, -0.4)}" stroke-width="1.5"/>
       <rect x="${x0 + 27}" y="${y0 + 35}" width="20" height="3" rx="1.5" fill="${shade(body, -0.45)}"/><rect x="${x0 + 27}" y="${y0 + 41}" width="20" height="3" rx="1.5" fill="${shade(body, -0.45)}"/><rect x="${x0 + 27}" y="${y0 + 47}" width="20" height="3" rx="1.5" fill="${shade(body, -0.45)}"/>`
    : `<rect x="${x0 + 22}" y="${y0 + 33}" width="18" height="18" rx="4" fill="${shade(body, -0.15)}" stroke="${shade(body, -0.4)}" stroke-width="1.2"/>
       <rect x="${x0 + L - 40}" y="${y0 + 33}" width="18" height="18" rx="4" fill="${shade(body, -0.15)}" stroke="${shade(body, -0.4)}" stroke-width="1.2"/>`;
  return svg(TOP_W, TOP_H, defs, `
    <path d="${bodyPath(3, 6)}" fill="#1B2620" opacity="0.45" filter="url(#sh)"/>
    <path d="${bodyPath()}" fill="${shade(body, -0.45)}"/>
    <path d="${bodyPath(0, 0, 2.5)}" fill="url(#roof)"/>
    <rect x="${x0 + 4}" y="${y0 + 14}" width="${L - 8}" height="7" fill="${accent}" opacity="0.95"/>
    <rect x="${x0 + 4}" y="${y0 + W - 21}" width="${L - 8}" height="7" fill="${accent}" opacity="0.95"/>
    ${windows}
    <path d="${bodyPath(0, 0, 2.5)}" fill="url(#top)"/>
    ${vents}${front}`);
}

// 横から見た列車(図鑑・町・お店用)。2 両
const SIDE_W = 360, SIDE_H = 150;
function trainSide(body, accent) {
  const defs = `
    ${vgrad('b', [[0, shade(body, 0.2)], [0.55, body], [1, shade(body, -0.25)]])}
    ${vgrad('roof', [[0, shade(body, -0.05)], [1, shade(body, -0.35)]])}
    ${vgrad('glass', [[0, '#DFF3FB'], [1, '#8FC6DD']])}
    ${blurFilter('sh', 4)}`;
  const car = (x, w, loco) => {
    const y = 34, h = 84;
    const front = loco
      ? `M${x} ${y + 22} Q${x} ${y} ${x + 30} ${y} H${x + w - 10} Q${x + w} ${y} ${x + w} ${y + 10} V${y + h} H${x} Z`
      : `M${x} ${y + 10} Q${x} ${y} ${x + 10} ${y} H${x + w - 10} Q${x + w} ${y} ${x + w} ${y + 10} V${y + h} H${x} Z`;
    const wins = [];
    const n = loco ? 3 : 4;
    const start = loco ? x + 36 : x + 14;
    const gap = loco ? 34 : 38;
    for (let i = 0; i < n; i++) {
      wins.push(`<rect x="${start + i * gap}" y="${y + 14}" width="${loco ? 24 : 28}" height="26" rx="4" fill="url(#glass)" stroke="${shade(body, -0.45)}" stroke-width="2"/>
        <path d="M${start + i * gap + 4} ${y + 36} L${start + i * gap + 14} ${y + 18}" stroke="#FFFFFF" stroke-width="3" opacity="0.6"/>`);
    }
    const wheels = [x + 26, x + 52, x + w - 52, x + w - 26]
      .map((cx) => `<circle cx="${cx}" cy="${y + h + 6}" r="13" fill="#2F3438"/><circle cx="${cx}" cy="${y + h + 6}" r="6" fill="#8C949B"/><circle cx="${cx - 2}" cy="${y + h + 4}" r="2" fill="#E4E8EB"/>`)
      .join('');
    return `
      <path d="${front}" fill="url(#b)" stroke="${shade(body, -0.45)}" stroke-width="3"/>
      <rect x="${x + 2}" y="${y + 50}" width="${w - 4}" height="10" fill="${accent}"/>
      <rect x="${x + 2}" y="${y + 64}" width="${w - 4}" height="3" fill="${accent}" opacity="0.7"/>
      <path d="M${x + (loco ? 24 : 8)} ${y - 4} H${x + w - 8} Q${x + w - 2} ${y - 4} ${x + w - 4} ${y + 2} H${x + (loco ? 20 : 4)} Z" fill="url(#roof)"/>
      ${wins.join('')}
      ${loco ? `<rect x="${x + 6}" y="${y + 30}" width="20" height="16" rx="5" fill="url(#glass)" stroke="${shade(body, -0.45)}" stroke-width="2"/><circle cx="${x + 8}" cy="${y + 72}" r="5" fill="#FFF3A8" stroke="#B8902A" stroke-width="1.5"/>` : ''}
      <rect x="${x + 8}" y="${y + h - 8}" width="${w - 16}" height="10" rx="3" fill="#3A4045"/>
      ${wheels}`;
  };
  return svg(SIDE_W, SIDE_H, defs, `
    <ellipse cx="${SIDE_W / 2}" cy="${SIDE_H - 12}" rx="${SIDE_W * 0.46}" ry="9" fill="#1B2620" opacity="0.35" filter="url(#sh)"/>
    <rect x="186" y="80" width="12" height="10" fill="#3A4045"/>
    ${car(14, 172, true)}
    ${car(194, 152, false)}`);
}

module.exports = { trainTop, trainSide, TOP_W, TOP_H, SIDE_W, SIDE_H };
