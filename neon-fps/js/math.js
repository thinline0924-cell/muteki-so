// 夜光区 — 小さな数学ライブラリ(ベクトル・行列・乱数)
// 行列は WebGL と同じ「列優先」の Float32Array(16)
var NF = window.NF || (window.NF = {});

(function () {
  var M = {};

  M.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  M.lerp = function (a, b, t) { return a + (b - a) * t; };
  M.smooth = function (t) { t = M.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  M.damp = function (a, b, k, dt) { return M.lerp(a, b, 1 - Math.exp(-k * dt)); };
  M.wrapAngle = function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

  // ---- 乱数(シード付き)----
  M.rng = function (seed) {
    var s = (seed >>> 0) || 1;
    var f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = function (a, b) { return a + (b - a) * f(); };
    f.int = function (a, b) { return Math.floor(a + (b - a + 1) * f()); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
    f.chance = function (p) { return f() < p; };
    return f;
  };
  M.hashStr = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // ---- vec3(配列 [x,y,z])----
  M.v3 = function (x, y, z) { return [x || 0, y || 0, z || 0]; };
  M.add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  M.sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
  M.mul = function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; };
  M.dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  M.cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  M.len = function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); };
  M.dist = function (a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return Math.sqrt(x * x + y * y + z * z); };
  M.dist2 = function (a, b) { var x = a[0] - b[0], z = a[2] - b[2]; return Math.sqrt(x * x + z * z); };
  M.norm = function (a) { var l = M.len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  M.copy = function (a) { return [a[0], a[1], a[2]]; };
  M.madd = function (a, b, s) { return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; };
  // yaw/pitch から向きベクトル(yaw=0 で -Z を向く)
  M.dirFromYawPitch = function (yaw, pitch) {
    var cp = Math.cos(pitch);
    return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
  };

  // ---- mat4 ----
  var m4 = {};
  m4.create = function () { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
  m4.identity = function (o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; };
  m4.perspective = function (o, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
    return o;
  };
  m4.mul = function (o, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (var i = 0; i < 4; i++) {
      var b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  };
  m4.invert = function (o, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  };
  // 位置・回転(Y→X→Z の順)・拡大 をまとめた行列
  m4.compose = function (o, px, py, pz, rx, ry, rz, sx, sy, sz) {
    // R = Ry * Rx * Rz (列ベクトル)
    var cx = Math.cos(rx), snx = Math.sin(rx), cy = Math.cos(ry), sny = Math.sin(ry), cz = Math.cos(rz), snz = Math.sin(rz);
    // Ry*Rx
    var a00 = cy, a01 = sny * snx, a02 = sny * cx;
    var a10 = 0, a11 = cx, a12 = -snx;
    var a20 = -sny, a21 = cy * snx, a22 = cy * cx;
    // (Ry*Rx)*Rz
    var r00 = a00 * cz + a01 * snz, r01 = -a00 * snz + a01 * cz, r02 = a02;
    var r10 = a10 * cz + a11 * snz, r11 = -a10 * snz + a11 * cz, r12 = a12;
    var r20 = a20 * cz + a21 * snz, r21 = -a20 * snz + a21 * cz, r22 = a22;
    o[0] = r00 * sx; o[1] = r10 * sx; o[2] = r20 * sx; o[3] = 0;
    o[4] = r01 * sy; o[5] = r11 * sy; o[6] = r21 * sy; o[7] = 0;
    o[8] = r02 * sz; o[9] = r12 * sz; o[10] = r22 * sz; o[11] = 0;
    o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
    return o;
  };
  // カメラ(目の位置・yaw・pitch・roll)からビュー行列
  m4.view = function (o, pos, yaw, pitch, roll) {
    var w = m4.compose(new Float32Array(16), pos[0], pos[1], pos[2], pitch, yaw, roll || 0, 1, 1, 1);
    return m4.invert(o, w);
  };
  m4.transformPoint = function (m, p) {
    var x = p[0], y = p[1], z = p[2];
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
  };

  // ---- 当たり判定 ----
  // 光線と箱(AABB)の交差。当たれば距離、外れれば -1。法線は M._hitN に入る
  M._hitN = [0, 0, 0];
  M.rayBox = function (o, d, b, maxT) {
    var tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
    for (var a = 0; a < 3; a++) {
      var lo = b[a], hi = b[a + 3];
      if (Math.abs(d[a]) < 1e-8) {
        if (o[a] < lo || o[a] > hi) return -1;
      } else {
        var inv = 1 / d[a], t1 = (lo - o[a]) * inv, t2 = (hi - o[a]) * inv, s = -1;
        if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; s = 1; }
        if (t1 > tmin) { tmin = t1; nAxis = a; nSign = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1;
      }
    }
    if (nAxis < 0) return -1; // 箱の中から
    M._hitN[0] = M._hitN[1] = M._hitN[2] = 0; M._hitN[nAxis] = nSign;
    return tmin;
  };
  // 光線と球
  M.raySphere = function (o, d, c, r, maxT) {
    var ox = o[0] - c[0], oy = o[1] - c[1], oz = o[2] - c[2];
    var b = ox * d[0] + oy * d[1] + oz * d[2];
    var cc = ox * ox + oy * oy + oz * oz - r * r;
    var disc = b * b - cc;
    if (disc < 0) return -1;
    var t = -b - Math.sqrt(disc);
    if (t < 0) t = -b + Math.sqrt(disc);
    return (t >= 0 && t <= maxT) ? t : -1;
  };
  // 線分上で点に一番近い点までの距離
  M.segPointDist = function (a, b, p) {
    var ab = M.sub(b, a), ap = M.sub(p, a);
    var t = M.clamp(M.dot(ap, ab) / (M.dot(ab, ab) || 1), 0, 1);
    return M.dist(M.madd(a, ab, t), p);
  };

  M.m4 = m4;
  NF.M = M;
})();
