// 小さな UI の絵:コイン・星・鍵・プレゼント・リボン・光・紙の質感・背景の模様。
'use strict';
const { shade, vgrad, lgrad, rgrad, grainFilter, blurFilter, svg } = require('./lib.cjs');

function starPath(cx, cy, R, r, n = 5) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${cx + Math.cos(a) * rad} ${cy + Math.sin(a) * rad}`;
  }
  return d + 'Z';
}

function star(on = true) {
  const S = 128;
  const defs = `
    ${rgrad('sg', 0.4, 0.3, 0.75, on ? [[0, '#FFF3B0'], [0.5, '#FFC93C'], [1, '#F29A1E']] : [[0, '#D9DEE2'], [1, '#A9B2B9']])}
    ${blurFilter('sh', 3)}`;
  const d = starPath(64, 68, 56, 26);
  return svg(S, S, defs, `
    <path d="${d}" fill="#000000" opacity="0.25" filter="url(#sh)" transform="translate(0 5)"/>
    <path d="${d}" fill="${on ? '#D9801A' : '#8A949B'}" stroke="${on ? '#C46E12' : '#7D878E'}" stroke-width="8" stroke-linejoin="round"/>
    <path d="${d}" fill="url(#sg)" transform="translate(64 68) scale(0.86) translate(-64 -68)" stroke-linejoin="round"/>
    <path d="${starPath(64, 68, 30, 14)}" fill="#FFFFFF" opacity="${on ? 0.28 : 0.2}" transform="translate(-6 -8)"/>
    <ellipse cx="46" cy="44" rx="10" ry="6" fill="#FFFFFF" opacity="0.7" transform="rotate(-30 46 44)"/>`);
}

function coin() {
  const S = 128;
  const defs = `
    ${rgrad('cg', 0.38, 0.32, 0.8, [[0, '#FFF3B0'], [0.5, '#FFC93C'], [1, '#E08A12']])}
    ${lgrad('rim', 0, 0, 1, 1, [[0, '#FFE58A'], [1, '#B8670C']])}
    ${blurFilter('sh', 3)}`;
  return svg(S, S, defs, `
    <circle cx="64" cy="70" r="54" fill="#000" opacity="0.25" filter="url(#sh)"/>
    <circle cx="64" cy="64" r="56" fill="url(#rim)"/>
    <circle cx="64" cy="64" r="45" fill="url(#cg)" stroke="#D08518" stroke-width="3"/>
    <path d="${starPath(64, 66, 24, 11)}" fill="#D9801A" opacity="0.9" transform="translate(1.5 2)"/>
    <path d="${starPath(64, 66, 24, 11)}" fill="#FFE07A"/>
    <ellipse cx="44" cy="38" rx="14" ry="7" fill="#FFFFFF" opacity="0.6" transform="rotate(-35 44 38)"/>`);
}

function lock() {
  const S = 128;
  const defs = `
    ${vgrad('lb', [[0, '#FFD866'], [1, '#D9961E']])}
    ${blurFilter('sh', 3)}`;
  return svg(S, S, defs, `
    <path d="M40 58 V42 Q40 16 64 16 Q88 16 88 42 V58" fill="none" stroke="#9AA4AB" stroke-width="14"/>
    <path d="M40 58 V42 Q40 16 64 16 Q88 16 88 42 V58" fill="none" stroke="#E4E9EC" stroke-width="5"/>
    <rect x="26" y="56" width="76" height="60" rx="14" fill="#000" opacity="0.25" filter="url(#sh)" transform="translate(0 4)"/>
    <rect x="26" y="56" width="76" height="60" rx="14" fill="url(#lb)" stroke="#B87A12" stroke-width="3"/>
    <circle cx="64" cy="82" r="9" fill="#6B4A12"/><rect x="60" y="84" width="8" height="18" rx="3" fill="#6B4A12"/>
    <rect x="32" y="62" width="64" height="8" rx="4" fill="#FFFFFF" opacity="0.4"/>`);
}

function gift() {
  const S = 128;
  const defs = `${vgrad('gb', [[0, '#F06A5A'], [1, '#C23B2E']])}${blurFilter('sh', 3)}`;
  return svg(S, S, defs, `
    <rect x="20" y="52" width="88" height="64" rx="8" fill="#000" opacity="0.25" filter="url(#sh)" transform="translate(0 4)"/>
    <rect x="20" y="52" width="88" height="64" rx="8" fill="url(#gb)"/>
    <rect x="14" y="40" width="100" height="22" rx="6" fill="#E04A3B"/>
    <rect x="56" y="40" width="16" height="76" fill="#FFD866"/>
    <path d="M64 40 Q40 10 30 30 Q26 44 64 40 Z" fill="#FFD866" stroke="#D9961E" stroke-width="2"/>
    <path d="M64 40 Q88 10 98 30 Q102 44 64 40 Z" fill="#FFD866" stroke="#D9961E" stroke-width="2"/>
    <rect x="20" y="44" width="88" height="5" fill="#FFFFFF" opacity="0.35"/>`);
}

function ribbon() {
  const W = 640, H = 170;
  const defs = `${vgrad('rb', [[0, '#F0614E'], [1, '#C7372A']])}${blurFilter('sh', 5)}`;
  return svg(W, H, defs, `
    <path d="M10 70 L90 60 L90 150 L10 160 L44 112 Z" fill="#A82E25"/>
    <path d="M630 70 L550 60 L550 150 L630 160 L596 112 Z" fill="#A82E25"/>
    <path d="M90 130 L120 146 L120 120 Z" fill="#6E1E18"/><path d="M550 130 L520 146 L520 120 Z" fill="#6E1E18"/>
    <path d="M80 32 Q320 0 560 32 L560 130 Q320 100 80 130 Z" fill="#000" opacity="0.25" filter="url(#sh)" transform="translate(0 6)"/>
    <path d="M80 32 Q320 0 560 32 L560 130 Q320 100 80 130 Z" fill="url(#rb)"/>
    <path d="M86 40 Q320 10 554 40" stroke="#FFFFFF" stroke-width="4" fill="none" opacity="0.4"/>
    <path d="M86 122 Q320 94 554 122" stroke="#8E2A21" stroke-width="4" fill="none" opacity="0.5"/>`);
}

function rays() {
  const S = 512;
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2, a1 = a0 + Math.PI / 32;
    d += `M256 256 L${256 + Math.cos(a0) * 256} ${256 + Math.sin(a0) * 256} L${256 + Math.cos(a1) * 256} ${256 + Math.sin(a1) * 256} Z`;
  }
  const defs = rgrad('fade', 0.5, 0.5, 0.5, [[0, '#FFFFFF', 0.9], [0.6, '#FFFFFF', 0.35], [1, '#FFFFFF', 0]]);
  return svg(S, S, `${defs}<mask id="m"><rect width="512" height="512" fill="url(#fade)"/></mask>`, `<path d="${d}" fill="#FFF3C4" mask="url(#m)"/>`);
}

function paper() {
  const S = 256;
  const defs = `${grainFilter('g', { freq: 0.9, amount: 0.1, seed: 4 })}
    <filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="7" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.6  0 0 0 0 0.5  0 0 0 0 0.35  0 0 0 0.6 -0.25"/></filter>`;
  return svg(S, S, defs, `<rect width="${S}" height="${S}" fill="#F8F0DE" filter="url(#g)"/><rect width="${S}" height="${S}" filter="url(#f)" opacity="0.35"/>`);
}

function navyPattern() {
  const S = 256;
  const defs = grainFilter('g', { freq: 1.0, amount: 0.08, seed: 2, dark: false });
  let ties = '';
  for (let i = 0; i < 8; i++) {
    const y = i * 32 + 8;
    ties += `<rect x="${(i % 2) * 64 + 20}" y="${y}" width="24" height="6" rx="3" fill="#FFFFFF" opacity="0.035"/><rect x="${(i % 2) * 64 + 148}" y="${y}" width="24" height="6" rx="3" fill="#FFFFFF" opacity="0.035"/>`;
  }
  return svg(S, S, defs, `<rect width="${S}" height="${S}" fill="#1F4D5E" filter="url(#g)"/>${ties}`);
}

function hand() {
  const S = 128;
  const defs = `${vgrad('hg', [[0, '#FFFFFF'], [1, '#E9E2D6']])}${blurFilter('sh', 3)}`;
  const d = 'M50 20 Q50 10 60 10 Q70 10 70 20 V56 Q72 48 80 48 Q90 48 90 58 Q92 52 100 52 Q110 52 110 64 V92 Q110 118 82 120 H64 Q44 120 34 100 L18 72 Q14 62 22 58 Q30 54 38 64 L50 78 Z';
  return svg(S, S, defs, `<path d="${d}" fill="#000" opacity="0.3" filter="url(#sh)" transform="translate(3 5)"/><path d="${d}" fill="url(#hg)" stroke="#5B4A3A" stroke-width="5" stroke-linejoin="round"/><path d="M70 56 V70 M90 58 V72" stroke="#5B4A3A" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`);
}

module.exports = { star, coin, lock, gift, ribbon, rays, paper, navyPattern, hand };
