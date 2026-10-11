// SVG で絵を描くための小さな道具(開発用)。
'use strict';

/** 色を明るく(amt>0)/暗く(amt<0)する。#rrggbb */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** 2 色を混ぜる */
function mix(a, b, t) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [r1, g1, b1] = c(x), [r2, g2, b2] = c(y);
  const m = (p, q) => Math.round(p + (q - p) * t);
  return '#' + ((1 << 24) | (m(r1, r2) << 16) | (m(g1, g2) << 8) | m(b1, b2)).toString(16).slice(1);
}

let uid = 0;
const id = (p = 'i') => `${p}${++uid}`;

/** 縦のグラデーション */
function vgrad(gid, stops) {
  return `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`;
}
function lgrad(gid, x1, y1, x2, y2, stops, units = 'objectBoundingBox') {
  return `<linearGradient id="${gid}" gradientUnits="${units}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`;
}
function rgrad(gid, cx, cy, r, stops, extra = '') {
  return `<radialGradient id="${gid}" cx="${cx}" cy="${cy}" r="${r}" ${extra}>${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</radialGradient>`;
}

/** ざらざらした質感(ノイズ)を重ねるフィルター。amount は濃さ */
function grainFilter(fid, { freq = 0.9, amount = 0.18, seed = 3, octaves = 2, dark = true } = {}) {
  const v = dark ? 0 : 1;
  return `<filter id="${fid}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${v}  0 0 0 0 ${v}  0 0 0 0 ${v}  0 0 0 ${amount * 4} ${-amount * 1.6}" result="a"/>
    <feComposite in="a" in2="SourceGraphic" operator="in" result="t"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="t"/></feMerge>
  </filter>`;
}

/** ふんわりした影 */
function blurFilter(fid, sd) {
  return `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
}

/** 落ち影(drop shadow) */
function dropShadow(fid, dx, dy, sd, opacity = 0.35, color = '#1d2a1a') {
  return `<filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${sd}" flood-color="${color}" flood-opacity="${opacity}"/>
  </filter>`;
}

/** 疑似乱数(同じ seed なら同じ結果) */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function svg(w, h, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
}

module.exports = { shade, mix, id, vgrad, lgrad, rgrad, grainFilter, blurFilter, dropShadow, rng, svg };
