// 盤面の絵:草地・タイルの板・線路・駅・障害物・草花。1 マス = 256px。
'use strict';
const { shade, vgrad, lgrad, rgrad, grainFilter, blurFilter, dropShadow, rng, svg } = require('./lib.cjs');

const S = 256;
const C = S / 2;

// ---- 色 ----
const P = {
  grass: '#8DBF5A',
  grassDark: '#6FA344',
  grassLight: '#A9D36F',
  ballast: '#CDBB98',
  ballastDark: '#A8977A',
  sleeper: '#7B4F31',
  sleeperLight: '#A06B43',
  rail: '#76808A',
  railLight: '#E3E9EE',
  railDark: '#3E454C',
};

// ---- 草地(つなぎ目のない模様) ----
function grass(seed, tint = 0) {
  const base = shade(P.grass, tint);
  const r = rng(seed);
  let blades = '';
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S;
    const h = 7 + r() * 9;
    const c = r() < 0.5 ? shade(base, -0.18) : shade(base, 0.16);
    blades += `<path d="M${x} ${y} q${-2 - r() * 2} ${-h * 0.6} ${-1 - r() * 3} ${-h} M${x} ${y} q${1 + r()} ${-h * 0.7} ${2 + r() * 3} ${-h * 1.05}" stroke="${c}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.8"/>`;
  }
  const defs = `
    <filter id="mottle" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="${seed}" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.42  0 0 0 0 0.12  0 0 0 1.1 -0.45"/>
    </filter>
    <filter id="light" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${seed + 7}" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.85  0 0 0 0 0.95  0 0 0 0 0.55  0 0 0 1.2 -0.7"/>
    </filter>
    ${grainFilter('grain', { freq: 1.4, amount: 0.12, seed })}`;
  return svg(S, S, defs, `
    <rect width="${S}" height="${S}" fill="${base}" filter="url(#grain)"/>
    <rect width="${S}" height="${S}" filter="url(#mottle)" opacity="0.55"/>
    <rect width="${S}" height="${S}" filter="url(#light)" opacity="0.5"/>
    ${blades}`);
}

// ---- 回せるタイルの板(少し盛り上がった草のタイル。下に厚みが見える) ----
function plate() {
  const defs = `
    ${vgrad('pg', [[0, '#D2E8A0'], [1, '#B2D47C']])}
    ${vgrad('side', [[0, '#7FA34B'], [1, '#5E8233']])}
    ${lgrad('rim', 0, 0, 1, 1, [[0, '#FFFFFF', 0.9], [0.4, '#FFFFFF', 0.0], [0.6, '#2E4A16', 0.0], [1, '#2E4A16', 0.35]])}
    ${blurFilter('sh', 5)}
    ${grainFilter('g', { freq: 1.3, amount: 0.12, seed: 11 })}
    <filter id="tex" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="31"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.62  0 0 0 0 0.25  0 0 0 1.0 -0.45"/>
    </filter>
    <clipPath id="top"><rect x="10" y="8" width="236" height="232" rx="30"/></clipPath>`;
  return svg(S, S, defs, `
    <rect x="12" y="20" width="234" height="234" rx="32" fill="#22380F" opacity="0.45" filter="url(#sh)"/>
    <rect x="10" y="14" width="236" height="234" rx="30" fill="url(#side)"/>
    <rect x="10" y="8" width="236" height="232" rx="30" fill="url(#pg)" filter="url(#g)"/>
    <rect x="10" y="8" width="236" height="232" clip-path="url(#top)" filter="url(#tex)" opacity="0.5"/>
    <rect x="12" y="10" width="232" height="228" rx="28" fill="none" stroke="url(#rim)" stroke-width="4"/>`);
}

// ---- 固定タイルの板(石の台座とびょう) ----
function plateFixed() {
  const defs = `
    ${vgrad('fg', [[0, '#D9CBA9'], [1, '#BCA982']])}
    ${grainFilter('g', { freq: 1.1, amount: 0.22, seed: 5 })}
    ${rgrad('rv', 0.35, 0.3, 0.7, [[0, '#F4EEE2'], [0.45, '#9C8F78'], [1, '#5E5446']])}`;
  const m = 10, r = 22;
  const rivet = (x, y) => `<circle cx="${x + 1.5}" cy="${y + 2.5}" r="11" fill="#3E3529" opacity="0.35"/><circle cx="${x}" cy="${y}" r="10" fill="url(#rv)"/>`;
  return svg(S, S, defs, `
    <rect x="${m}" y="${m}" width="${S - 2 * m}" height="${S - 2 * m}" rx="${r}" fill="url(#fg)" filter="url(#g)"/>
    <rect x="${m + 3}" y="${m + 3}" width="${S - 2 * m - 6}" height="${S - 2 * m - 6}" rx="${r - 3}" fill="none" stroke="#7D6E54" stroke-width="3" opacity="0.5"/>
    <rect x="${m}" y="${m}" width="${S - 2 * m}" height="${S - 2 * m}" rx="${r}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.35"/>
    ${rivet(34, 34)}${rivet(S - 34, 34)}${rivet(34, S - 34)}${rivet(S - 34, S - 34)}`);
}

// ---- 線路 ----
// 形は「直線(縦)」「カーブ(右上の角が中心)」の組み合わせ。
// seg: {t:'line', vertical:true} / {t:'arc', cx, cy, a0}
const BALLAST_HALF = 62;
const GAUGE = 27;
const SLEEPER_HALF = 50;

function ballastShape(seg, extra = 0) {
  const w = (BALLAST_HALF + extra) * 2;
  if (seg.t === 'line') {
    return seg.vertical
      ? `<rect x="${C - w / 2}" y="-4" width="${w}" height="${S + 8}"/>`
      : `<rect x="-4" y="${C - w / 2}" width="${S + 8}" height="${w}"/>`;
  }
  return `<path d="${arcPath(seg, 128)}" fill="none" stroke-width="${w}" stroke-linecap="butt"/>`;
}

function arcPath(seg, rad) {
  // 角 (cx,cy) を中心にした 90 度の弧
  const a0 = seg.a0, a1 = a0 + Math.PI / 2;
  const p0 = [seg.cx + Math.cos(a0) * rad, seg.cy + Math.sin(a0) * rad];
  const p1 = [seg.cx + Math.cos(a1) * rad, seg.cy + Math.sin(a1) * rad];
  return `M${p0[0]} ${p0[1]} A${rad} ${rad} 0 0 1 ${p1[0]} ${p1[1]}`;
}

/** 線にそった点と向き(t: 0..1) */
function along(seg, t) {
  if (seg.t === 'line') {
    return seg.vertical ? { x: C, y: t * S, ang: Math.PI / 2 } : { x: t * S, y: C, ang: 0 };
  }
  const a = seg.a0 + t * Math.PI / 2;
  return { x: seg.cx + Math.cos(a) * 128, y: seg.cy + Math.sin(a) * 128, ang: a + Math.PI / 2 };
}

function track(segs) {
  const defs = `
    <filter id="gravel" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="9" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.24  0 0 0 2.4 -1.1" result="dots"/>
      <feComposite in="dots" in2="SourceGraphic" operator="in" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="21" result="n2"/>
      <feColorMatrix in="n2" type="matrix" values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.9  0 0 0 2.2 -1.25" result="hi"/>
      <feComposite in="hi" in2="SourceGraphic" operator="in" result="h"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="d"/><feMergeNode in="h"/></feMerge>
    </filter>
    ${blurFilter('soft', 4)}
    ${blurFilter('soft2', 2)}
    ${lgrad('sl', 0, 0, 0, 1, [[0, P.sleeperLight], [0.5, P.sleeper], [1, '#5A3820']])}
    ${grainFilter('wood', { freq: 0.35, amount: 0.25, seed: 4, octaves: 1 })}`;

  // 道床(砂利)
  let ballast = '';
  for (const s of segs) {
    ballast += `<g stroke="#4F5A2A" fill="#4F5A2A" opacity="0.22" filter="url(#soft)">${ballastShape(s, 4)}</g>`;
  }
  for (const s of segs) {
    ballast += `<g stroke="${P.ballastDark}" fill="${P.ballastDark}">${ballastShape(s, 0)}</g>`;
  }
  for (const s of segs) {
    ballast += `<g stroke="${P.ballast}" fill="${P.ballast}" filter="url(#gravel)">${ballastShape(s, -7)}</g>`;
  }

  // 枕木
  let sleepers = '';
  for (const s of segs) {
    const n = s.t === 'line' ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const p = along(s, (i + 0.5) / n);
      const deg = (p.ang * 180) / Math.PI;
      sleepers += `<g transform="translate(${p.x} ${p.y}) rotate(${deg + 90})">
        <rect x="${-SLEEPER_HALF + 2}" y="-9" width="${SLEEPER_HALF * 2}" height="20" rx="4" fill="#3B2A1A" opacity="0.35" filter="url(#soft2)"/>
        <rect x="${-SLEEPER_HALF}" y="-10" width="${SLEEPER_HALF * 2}" height="19" rx="4" fill="url(#sl)" filter="url(#wood)"/>
        <rect x="${-SLEEPER_HALF + 3}" y="-8.5" width="${SLEEPER_HALF * 2 - 6}" height="3" rx="1.5" fill="#C99A6B" opacity="0.6"/>
        <rect x="${-GAUGE - 7}" y="-6" width="14" height="12" rx="2" fill="#4A4F55"/>
        <rect x="${GAUGE - 7}" y="-6" width="14" height="12" rx="2" fill="#4A4F55"/>
      </g>`;
    }
  }

  // レール(影・本体・光)
  const railStroke = (off, color, width, dy = 0) =>
    segs
      .map((s) => {
        if (s.t === 'line') {
          return s.vertical
            ? `<line x1="${C + off}" y1="-2" x2="${C + off}" y2="${S + 2}" stroke="${color}" stroke-width="${width}" transform="translate(${dy * 0.6} ${dy})"/>`
            : `<line x1="-2" y1="${C + off}" x2="${S + 2}" y2="${C + off}" stroke="${color}" stroke-width="${width}" transform="translate(${dy * 0.6} ${dy})"/>`;
        }
        return `<path d="${arcPath(s, 128 + off)}" fill="none" stroke="${color}" stroke-width="${width}" transform="translate(${dy * 0.6} ${dy})"/>`;
      })
      .join('');
  let rails = '';
  for (const off of [-GAUGE, GAUGE]) {
    rails += `<g opacity="0.45" filter="url(#soft2)">${railStroke(off, '#2A2F2E', 11, 4)}</g>`;
  }
  for (const off of [-GAUGE, GAUGE]) {
    rails += railStroke(off, P.railDark, 11);
    rails += railStroke(off, P.rail, 8);
    rails += railStroke(off - 1.5, P.railLight, 3);
  }
  return svg(S, S, defs, `<g>${ballast}</g><g>${sleepers}</g><g>${rails}</g>`);
}

const STRAIGHT = [{ t: 'line', vertical: true }];
const CURVE = [{ t: 'arc', cx: S, cy: 0, a0: Math.PI / 2 }]; // 北-東
const TEE = [{ t: 'line', vertical: false }, { t: 'arc', cx: S, cy: S, a0: Math.PI }]; // 東西 + 南→東
const CROSS = [{ t: 'line', vertical: true }, { t: 'line', vertical: false }];

// ---- 駅(回転 0 = 北につながる。東側に屋根、南に車止め) ----
function station(goal) {
  const roof = goal ? '#3E7CB1' : '#D2553E';
  const defs = `
    ${vgrad('pf', [[0, '#E9DFC8'], [1, '#D8CBAE']])}
    ${grainFilter('pg', { freq: 1.2, amount: 0.16, seed: 8 })}
    ${lgrad('rf', 0, 0, 1, 0, [[0, shade(roof, 0.18)], [0.48, shade(roof, 0.05)], [0.52, shade(roof, -0.12)], [1, shade(roof, -0.28)]])}
    ${blurFilter('sh', 6)}
    ${blurFilter('sh2', 3)}`;
  // 石畳
  let pavers = '';
  for (let y = 20; y < 246; y += 22) {
    pavers += `<line x1="8" y1="${y}" x2="248" y2="${y}" stroke="#B9AA88" stroke-width="1.5" opacity="0.6"/>`;
  }
  for (let y = 9, k = 0; y < 246; y += 22, k++) {
    for (let x = (k % 2) * 16 + 8; x < 248; x += 32) {
      pavers += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 11}" stroke="#B9AA88" stroke-width="1.5" opacity="0.5"/>`;
    }
  }
  const trackSvg = track([{ t: 'line', vertical: true }]);
  const flag = goal
    ? `<line x1="36" y1="64" x2="36" y2="18" stroke="#5B4A3A" stroke-width="4" stroke-linecap="round"/>
       <path d="M37 18 L64 26 L37 35 Z" fill="#E04A3B"/><path d="M37 18 L64 26 L37 26 Z" fill="#F07A68"/>
       <circle cx="36" cy="16" r="4" fill="#F2C94C"/>`
    : `<rect x="30" y="18" width="14" height="30" rx="7" fill="#33393E"/>
       <circle cx="37" cy="26" r="4.5" fill="#6FE08A"/><circle cx="37" cy="39" r="4.5" fill="#5A2A24"/>
       <line x1="37" y1="48" x2="37" y2="66" stroke="#4A4F55" stroke-width="4"/>`;
  return svg(S, S, defs, `
    <rect x="6" y="6" width="244" height="244" rx="26" fill="#3F5A22" opacity="0.35" filter="url(#sh2)" transform="translate(2 4)"/>
    <rect x="6" y="6" width="244" height="244" rx="26" fill="url(#pf)" filter="url(#pg)"/>
    ${pavers}
    <rect x="6" y="6" width="244" height="244" rx="26" fill="none" stroke="${shade(roof, -0.1)}" stroke-width="5" opacity="0.85"/>
    <g clip-path="inset(0 0 40px 0)">${trackSvg}</g>
    <g transform="translate(128 214)">
      <rect x="-56" y="-6" width="112" height="22" rx="5" fill="#2A2F2E" opacity="0.35" filter="url(#sh2)"/>
      <rect x="-54" y="-10" width="108" height="20" rx="5" fill="#C23B2E"/>
      <rect x="-30" y="-10" width="16" height="20" fill="#FFFFFF"/><rect x="14" y="-10" width="16" height="20" fill="#FFFFFF"/>
      <rect x="-54" y="-10" width="108" height="5" rx="2" fill="#FFFFFF" opacity="0.35"/>
    </g>
    <rect x="186" y="34" width="66" height="184" rx="6" fill="#2A2F2E" opacity="0.4" filter="url(#sh)" transform="translate(-8 8)"/>
    <rect x="192" y="28" width="58" height="184" rx="6" fill="url(#rf)"/>
    <line x1="221" y1="30" x2="221" y2="210" stroke="#FFFFFF" stroke-width="2" opacity="0.35"/>
    ${[60, 100, 140, 180].map((y) => `<line x1="194" y1="${y}" x2="248" y2="${y}" stroke="${shade(roof, -0.35)}" stroke-width="1.5" opacity="0.5"/>`).join('')}
    <rect x="192" y="28" width="58" height="184" rx="6" fill="none" stroke="${shade(roof, -0.4)}" stroke-width="2.5"/>
    ${flag}`);
}

// ---- 木 ----
function tree(seed = 1) {
  const r = rng(seed);
  const defs = `
    ${rgrad('leaf', 0.35, 0.3, 0.75, [[0, '#8FD16A'], [0.55, '#4E9A43'], [1, '#2F6E33']])}
    ${rgrad('leaf2', 0.35, 0.3, 0.75, [[0, '#7CC25C'], [0.6, '#3F8A3C'], [1, '#26592A']])}
    ${blurFilter('sh', 9)}
    <filter id="lt" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="${seed}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.3  0 0 0 0 0.1  0 0 0 1.6 -0.75" result="d"/>
      <feComposite in="d" in2="SourceGraphic" operator="in" result="dd"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="dd"/></feMerge>
    </filter>`;
  const blobs = [[100, 112, 62], [156, 108, 60], [128, 150, 66], [128, 84, 58]];
  return svg(S, S, defs, `
    <ellipse cx="146" cy="176" rx="96" ry="62" fill="#1E3A10" opacity="0.45" filter="url(#sh)"/>
    <g filter="url(#lt)">
      ${blobs.map(([x, y, rr], i) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="url(#${i % 2 ? 'leaf2' : 'leaf'})"/>`).join('')}
      <circle cx="128" cy="112" r="64" fill="url(#leaf)"/>
    </g>
    ${Array.from({ length: 9 }, () => {
      const x = 80 + r() * 90, y = 70 + r() * 80;
      return `<ellipse cx="${x}" cy="${y}" rx="${8 + r() * 6}" ry="${5 + r() * 4}" fill="#B6E58C" opacity="0.55"/>`;
    }).join('')}
    <circle cx="160" cy="150" r="7" fill="#E05A4A"/><circle cx="96" cy="140" r="6" fill="#E05A4A"/><circle cx="140" cy="88" r="6" fill="#E05A4A"/>
    <circle cx="158" cy="148" r="2.5" fill="#FFFFFF" opacity="0.7"/>`);
}

// ---- 岩 ----
function rock() {
  const defs = `${blurFilter('sh', 7)}${grainFilter('g', { freq: 0.9, amount: 0.2, seed: 2 })}`;
  const stone = (pts, light, mid, dark) => {
    const [a, b, c, d, e, f] = pts;
    return `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${mid}"/>
      <polygon points="${[a, b, c, [ (a[0]+c[0])/2+4, (a[1]+e[1])/2 ]].map((p) => p.join(',')).join(' ')}" fill="${light}"/>
      <polygon points="${[d, e, f, [ (a[0]+c[0])/2+4, (a[1]+e[1])/2 ]].map((p) => p.join(',')).join(' ')}" fill="${dark}"/>`;
  };
  return svg(S, S, defs, `
    <ellipse cx="140" cy="180" rx="96" ry="44" fill="#22300F" opacity="0.5" filter="url(#sh)"/>
    <g filter="url(#g)">
      ${stone([[46, 168], [70, 110], [122, 84], [170, 104], [176, 172], [110, 194]], '#C9C6BD', '#A3A096', '#77746B')}
      ${stone([[140, 182], [158, 132], [196, 120], [222, 150], [214, 190], [172, 200]], '#BEBAB0', '#99958A', '#6C685E')}
    </g>
    <path d="M80 112 q20 -16 40 -20" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.5" fill="none"/>
    <ellipse cx="96" cy="176" rx="22" ry="8" fill="#6E9A3F" opacity="0.8"/>
    <ellipse cx="190" cy="196" rx="16" ry="6" fill="#6E9A3F" opacity="0.8"/>`);
}

// ---- 池 ----
function pond() {
  const defs = `
    ${rgrad('w', 0.45, 0.45, 0.6, [[0, '#2F7FA8'], [0.7, '#4FA3CB'], [1, '#86C9E3']])}
    ${blurFilter('sh', 4)}
    ${grainFilter('g', { freq: 0.6, amount: 0.12, seed: 13, dark: false })}`;
  const shore = 'M40 128 C36 70 96 36 150 44 C206 52 232 96 222 146 C212 200 160 222 108 214 C62 206 42 180 40 128 Z';
  let stones = '';
  const r = rng(5);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = 131 + Math.cos(a) * 98 + (r() - 0.5) * 6, y = 128 + Math.sin(a) * 90 + (r() - 0.5) * 6;
    stones += `<ellipse cx="${x}" cy="${y}" rx="${10 + r() * 6}" ry="${7 + r() * 4}" fill="${r() < 0.5 ? '#BDB6A6' : '#A7A091'}" stroke="#7D7768" stroke-width="1.5"/>`;
  }
  const pad = (x, y, rr, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 L${rr} -4 A${rr} ${rr} 0 1 1 ${rr} 4 Z" fill="#5FA845" stroke="#3F7F2E" stroke-width="1.5"/><path d="M0 0 L${-rr * 0.7} ${-rr * 0.3}" stroke="#3F7F2E" stroke-width="1"/></g>`;
  return svg(S, S, defs, `
    <path d="${shore}" fill="#3F5A22" opacity="0.4" filter="url(#sh)" transform="translate(3 6)"/>
    <path d="${shore}" fill="#8B7C5E"/>
    <path d="${shore}" fill="url(#w)" filter="url(#g)" transform="translate(131 129) scale(0.9) translate(-131 -129)"/>
    ${stones}
    ${pad(96, 150, 18, 30)}${pad(160, 96, 15, -60)}${pad(176, 160, 13, 160)}
    <g transform="translate(160 96)"><circle r="7" fill="#F7B3C8"/><circle r="3" fill="#F2C94C"/></g>
    <path d="M86 96 q18 -8 36 0 M150 176 q14 -6 28 0" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M${52 + i * 6} ${150} q${-3 + i} -30 ${2 + i * 2} -${42 + i * 4}" stroke="#4E8A36" stroke-width="3.5" fill="none" stroke-linecap="round"/>`).join('')}
    <ellipse cx="58" cy="104" rx="4" ry="10" fill="#7A5232"/>`);
}

// ---- 草花(空いている草地に重ねる。背景は透明) ----
function flowers(seed) {
  const r = rng(seed);
  const colors = ['#FFFFFF', '#FFE27A', '#F7A8C0', '#F49A62', '#C7B2F0'];
  let out = '';
  const n = 2 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const cx = 40 + r() * 176, cy = 50 + r() * 160;
    // 草の株
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.35;
      out += `<path d="M${cx} ${cy} q${Math.cos(a) * 8} ${Math.sin(a) * 8} ${Math.cos(a) * 16} ${Math.sin(a) * 18}" stroke="${i % 2 ? '#5E9A3A' : '#78B24C'}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    const c = colors[Math.floor(r() * colors.length)];
    for (let i = 0; i < 3; i++) {
      const fx = cx + (r() - 0.5) * 30, fy = cy - 10 + (r() - 0.5) * 16;
      out += `<g transform="translate(${fx} ${fy})">${[0, 72, 144, 216, 288].map((d) => `<ellipse rx="4.5" ry="2.8" cx="4" transform="rotate(${d})" fill="${c}" stroke="${shade(c, -0.25)}" stroke-width="0.6"/>`).join('')}<circle r="2.4" fill="#F2B632"/></g>`;
    }
  }
  return svg(S, S, '', out);
}

// ---- 木の板(盤面の枠。つなぎ目のない模様) ----
function wood() {
  const defs = `
    <filter id="w" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.18" numOctaves="3" seed="12" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.14  0 0 0 0 0.07  0 0 0 1.4 -0.35"/>
    </filter>
    ${grainFilter('g', { freq: 1.1, amount: 0.1, seed: 2 })}`;
  return svg(S, S, defs, `<rect width="${S}" height="${S}" fill="#A8774C" filter="url(#g)"/><rect width="${S}" height="${S}" filter="url(#w)" opacity="0.75"/>`);
}

module.exports = { wood, station, tree, rock, pond, flowers,  S, P, grass, plate, plateFixed, track, STRAIGHT, CURVE, TEE, CROSS, arcPath, along, BALLAST_HALF, GAUGE, SLEEPER_HALF };
