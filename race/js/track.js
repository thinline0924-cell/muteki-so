/* =========================================================
   track.js — コースの形を計算する(画面には描かない、数字だけ)
   ・TrackGen.build(def) でコースの中心線・幅・縁石・ランオフ・壁を作る
   ・TrackGen.project(track, x, y, hint) で「いまコースのどこにいるか」を調べる
   ・racing line(走行ライン)と、車ごとの目標速度もここで計算する
   座標:x=東, y=北(上から見た2D)/ z=標高
   ========================================================= */
var TrackGen = (function () {
  var DS = 2; // 中心線の点の間隔(m)

  function signedAngle(seg) {
    if (seg[0] === 'S') return 0;
    return (seg[0] === 'L' ? 1 : -1) * seg[2];
  }

  // セグメント列をたどって終点を求める(角度は度)
  function walkEnd(segs) {
    var x = 0, y = 0, th = 0, dirs = [];
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (s[0] === 'S') {
        dirs.push({ i: i, dx: Math.cos(th), dy: Math.sin(th) });
        x += Math.cos(th) * s[1]; y += Math.sin(th) * s[1];
      } else {
        var sg = s[0] === 'L' ? 1 : -1, R = s[1], a = sg * s[2] * Math.PI / 180;
        var cx = x + sg * R * -Math.sin(th), cy = y + sg * R * Math.cos(th);
        th += a;
        x = cx - sg * R * -Math.sin(th); y = cy - sg * R * Math.cos(th);
      }
    }
    return { x: x, y: y, th: th, dirs: dirs };
  }

  // 1. 曲がる角度の合計をちょうど ±360° にする 2. 直線2本の長さを変えて始点に戻す
  function closeLoop(segsIn, scale) {
    var sc = scale || 1;
    var segs = segsIn.map(function (s) { var c = s.slice(); c[1] *= sc; return c; });
    var T = 0;
    segs.forEach(function (s) { T += signedAngle(s); });
    var f = (T < 0 ? -360 : 360) / T;
    segs.forEach(function (s) { if (s[0] !== 'S') s[2] *= f; });
    // すべての直線を「長さに比例して」少しずつ伸び縮みさせて閉じる(最小ノルム解)
    var w = walkEnd(segs), fix = [];
    for (var iter = 0; iter < 4; iter++) {
      w = walkEnd(segs);
      var Ex = w.x, Ey = w.y;
      var a11 = 0, a12 = 0, a22 = 0;
      w.dirs.forEach(function (d) {
        var L2 = Math.pow(segs[d.i][1], 2);
        a11 += L2 * d.dx * d.dx; a12 += L2 * d.dx * d.dy; a22 += L2 * d.dy * d.dy;
      });
      var det = a11 * a22 - a12 * a12;
      var lx = (a22 * Ex - a12 * Ey) / det, ly = (-a12 * Ex + a11 * Ey) / det;
      w.dirs.forEach(function (d) {
        var L = segs[d.i][1];
        var dl = -L * L * (d.dx * lx + d.dy * ly);
        segs[d.i][1] = Math.max(30, L + dl);
        if (iter === 0) fix.push(Math.round(dl));
      });
    }
    w = walkEnd(segs);
    return { segs: segs, scale: f, fix: fix, err: Math.hypot(w.x, w.y) };
  }

  function gaussSmoothLoop(arr, sigma) {
    var n = arr.length, r = Math.ceil(sigma * 3), ker = [], sum = 0, out = new Float64Array(n);
    for (var k = -r; k <= r; k++) { var g = Math.exp(-k * k / (2 * sigma * sigma)); ker.push(g); sum += g; }
    for (var i = 0; i < n; i++) {
      var acc = 0;
      for (var k2 = -r; k2 <= r; k2++) acc += arr[(i + k2 + n * 4) % n] * ker[k2 + r];
      out[i] = acc / sum;
    }
    return out;
  }

  function build(def) {
    var closed = closeLoop(def.segs, def.scale);
    var segs = closed.segs;
    // --- 1m 間隔でたどる ---
    var px = [], py = [], pz = [];
    var x = 0, y = 0, th = 0, z = 0;
    segs.forEach(function (s) {
      var dz = s[0] === 'S' ? (s[2] || 0) : (s[3] || 0);
      var z0 = z;
      if (s[0] === 'S') {
        var n = Math.max(1, Math.round(s[1]));
        for (var k = 0; k < n; k++) {
          var t = k / n;
          px.push(x + Math.cos(th) * s[1] * t); py.push(y + Math.sin(th) * s[1] * t);
          pz.push(z0 + dz * (0.5 - 0.5 * Math.cos(Math.PI * t)));
        }
        x += Math.cos(th) * s[1]; y += Math.sin(th) * s[1];
      } else {
        var sg = s[0] === 'L' ? 1 : -1, R = s[1], a = s[2] * Math.PI / 180;
        var len = R * a, n2 = Math.max(2, Math.round(len));
        var cx = x + sg * R * -Math.sin(th), cy = y + sg * R * Math.cos(th);
        for (var k2 = 0; k2 < n2; k2++) {
          var t2 = k2 / n2, th2 = th + sg * a * t2;
          px.push(cx - sg * R * -Math.sin(th2)); py.push(cy - sg * R * Math.cos(th2));
          pz.push(z0 + dz * (0.5 - 0.5 * Math.cos(Math.PI * t2)));
        }
        th += sg * a;
        x = cx - sg * R * -Math.sin(th); y = cy - sg * R * Math.cos(th);
      }
      z = z0 + dz;
    });
    // 標高の誤差(最後に0へ戻らない分)を全体にならす
    var n1 = px.length, resid = z;
    for (var i = 0; i < n1; i++) pz[i] -= resid * i / n1;
    // 角のつなぎ目をなめらかに
    var sx = gaussSmoothLoop(px, 5), sy = gaussSmoothLoop(py, 5), sz = gaussSmoothLoop(pz, 22);

    // --- 2m 間隔に並べ直す ---
    var cum = [0];
    for (var j = 1; j <= n1; j++) {
      var a0 = (j - 1) % n1, b0 = j % n1;
      cum.push(cum[j - 1] + Math.hypot(sx[b0] - sx[a0], sy[b0] - sy[a0]));
    }
    var L = cum[n1], N = Math.round(L / DS), ds = L / N;
    var tr = {
      def: def, N: N, ds: ds, length: L,
      x: new Float64Array(N), y: new Float64Array(N), z: new Float64Array(N),
      tx: new Float64Array(N), ty: new Float64Array(N), nx: new Float64Array(N), ny: new Float64Array(N),
      k: new Float64Array(N), grade: new Float64Array(N), hw: new Float64Array(N),
      kerbL: new Uint8Array(N), kerbR: new Uint8Array(N),
      runL: new Float64Array(N), runR: new Float64Array(N),
      gravelL: new Uint8Array(N), gravelR: new Uint8Array(N),
      closeInfo: closed
    };
    var jj = 0;
    for (var m = 0; m < N; m++) {
      var target = m * ds;
      while (cum[jj + 1] < target) jj++;
      var f = (target - cum[jj]) / Math.max(1e-9, cum[jj + 1] - cum[jj]);
      var ia = jj % n1, ib = (jj + 1) % n1;
      tr.x[m] = sx[ia] + (sx[ib] - sx[ia]) * f;
      tr.y[m] = sy[ia] + (sy[ib] - sy[ia]) * f;
      tr.z[m] = sz[ia] + (sz[ib] - sz[ia]) * f;
    }
    // 最低点を0に
    var zmin = Infinity;
    for (m = 0; m < N; m++) zmin = Math.min(zmin, tr.z[m]);
    for (m = 0; m < N; m++) tr.z[m] -= zmin;

    // 向き・法線・曲率
    for (m = 0; m < N; m++) {
      var p = (m - 1 + N) % N, q = (m + 1) % N;
      var dx = tr.x[q] - tr.x[p], dy = tr.y[q] - tr.y[p], dl = Math.hypot(dx, dy);
      tr.tx[m] = dx / dl; tr.ty[m] = dy / dl;
      tr.nx[m] = tr.ty[m]; tr.ny[m] = -tr.tx[m]; // 右向きの法線
      tr.grade[m] = (tr.z[q] - tr.z[p]) / (2 * ds);
      tr.hw[m] = def.width / 2;
    }
    var kr = new Float64Array(N);
    for (m = 0; m < N; m++) {
      var p2 = (m - 2 + N) % N, q2 = (m + 2) % N;
      var a1 = Math.atan2(tr.ty[p2], tr.tx[p2]), a2 = Math.atan2(tr.ty[q2], tr.tx[q2]);
      var da = a2 - a1;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      kr[m] = da / (4 * ds);
    }
    tr.k = gaussSmoothLoop(kr, 3);

    buildHash(tr);
    buildEdges(tr);
    buildRacingLine(tr);
    // セクター(3分割)
    tr.sectors = [0, L / 3, 2 * L / 3];
    return tr;
  }

  // ---- 近くの点をすばやく探すためのマス目 ----
  var CELL = 50;
  function hkey(cx, cy) { return cx * 73856093 ^ cy * 19349663; }
  function buildHash(tr) {
    var h = new Map();
    for (var i = 0; i < tr.N; i++) {
      var key = hkey(Math.floor(tr.x[i] / CELL), Math.floor(tr.y[i] / CELL));
      var a = h.get(key);
      if (!a) { a = []; h.set(key, a); }
      a.push(i);
    }
    tr.hash = h;
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (i = 0; i < tr.N; i++) {
      minx = Math.min(minx, tr.x[i]); maxx = Math.max(maxx, tr.x[i]);
      miny = Math.min(miny, tr.y[i]); maxy = Math.max(maxy, tr.y[i]);
    }
    tr.bounds = { minx: minx, miny: miny, maxx: maxx, maxy: maxy };
  }
  // (x,y) から半径 r 以内の点の番号を集める
  function nearIdx(tr, x, y, r, out) {
    out.length = 0;
    var c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL);
    var d0 = Math.floor((y - r) / CELL), d1 = Math.floor((y + r) / CELL);
    for (var cx = c0; cx <= c1; cx++) for (var cy = d0; cy <= d1; cy++) {
      var a = tr.hash.get(hkey(cx, cy));
      if (a) for (var k = 0; k < a.length; k++) out.push(a[k]);
    }
    return out;
  }
  // いちばん近い中心線までの距離(他の区間も含む)。地形づくりで使う
  var _tmp = [];
  function nearest(tr, x, y, maxR) {
    var idx = nearIdx(tr, x, y, maxR, _tmp), best = -1, bd = maxR * maxR;
    for (var k = 0; k < idx.length; k++) {
      var i = idx[k], dx = tr.x[i] - x, dy = tr.y[i] - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
  }

  function circDiff(a, b, N) { var d = Math.abs(a - b) % N; return Math.min(d, N - d); }

  // ---- 縁石・ランオフ・壁の位置 ----
  function buildEdges(tr) {
    var N = tr.N, i, k;
    var corner = new Uint8Array(N), tight = new Uint8Array(N);
    for (i = 0; i < N; i++) {
      var ak = Math.abs(tr.k[i]);
      if (ak > 1 / 320) corner[i] = 1;
      if (ak > 1 / 160) tight[i] = 1;
    }
    var dil = function (src, r) {
      var o = new Uint8Array(N);
      for (var a = 0; a < N; a++) if (src[a]) for (var b = -r; b <= r; b++) o[(a + b + N) % N] = 1;
      return o;
    };
    var kerb = dil(corner, 8), grav = dil(tight, 14);
    var sideOut = new Int8Array(N); // カーブの外側:+1=右, -1=左
    for (i = 0; i < N; i++) {
      // 前後の曲率を見て外側を決める
      var acc = 0;
      for (k = -14; k <= 14; k++) acc += tr.k[(i + k + N) % N];
      sideOut[i] = acc > 0 ? 1 : -1; // 左カーブ(k>0)なら外側は右
    }
    var runL = new Float64Array(N), runR = new Float64Array(N);
    for (i = 0; i < N; i++) {
      tr.kerbL[i] = kerb[i]; tr.kerbR[i] = kerb[i];
      var base = 11;
      var outR = sideOut[i] > 0, big = grav[i] ? 26 : (kerb[i] ? 16 : base);
      runR[i] = outR ? big : (kerb[i] ? 9 : base);
      runL[i] = outR ? (kerb[i] ? 9 : base) : big;
      tr.gravelR[i] = grav[i] && outR ? 1 : 0;
      tr.gravelL[i] = grav[i] && !outR ? 1 : 0;
    }
    // 他の区間が近いときは、壁をその手前で止める
    var tmp = [];
    for (i = 0; i < N; i++) {
      var idx = nearIdx(tr, tr.x[i], tr.y[i], 110, tmp);
      for (k = 0; k < idx.length; k++) {
        var j = idx[k];
        if (circDiff(i, j, N) < 70) continue;
        var dx = tr.x[j] - tr.x[i], dy = tr.y[j] - tr.y[i];
        var along = dx * tr.tx[i] + dy * tr.ty[i];
        if (Math.abs(along) > 30) continue;
        var q = dx * tr.nx[i] + dy * tr.ny[i];
        var dz = Math.abs(tr.z[j] - tr.z[i]);
        if (dz > 7) continue; // 立体交差なら気にしない
        var gap = Math.abs(q) - tr.hw[i] - tr.hw[j];
        var lim = Math.max(3, gap / 2 - 1);
        if (q > 0) runR[i] = Math.min(runR[i], lim); else runL[i] = Math.min(runL[i], lim);
      }
    }
    // 急に変わらないよう、最小値フィルタ → 平均
    var smoothRun = function (r) {
      var m = new Float64Array(N);
      for (var a = 0; a < N; a++) {
        var mn = Infinity;
        for (var b = -10; b <= 10; b++) mn = Math.min(mn, r[(a + b + N) % N]);
        m[a] = mn;
      }
      return gaussSmoothLoop(m, 5);
    };
    tr.runL = smoothRun(runL); tr.runR = smoothRun(runR);
    tr.sideOut = sideOut;
  }

  // ---- 走行ライン:曲率が小さくなるようにコース幅の中で寄せる ----
  function buildRacingLine(tr) {
    var N = tr.N, i, it;
    var step = 5, M = Math.floor(N / step);
    var off = new Float64Array(M);
    var lim = function (ii) { return tr.hw[ii] - 1.6; };
    var cx = function (ii, o) { return tr.x[ii] + tr.nx[ii] * o; };
    var cy = function (ii, o) { return tr.y[ii] + tr.ny[ii] * o; };
    // 粗い点で何回も「両隣の真ん中へ寄せる」
    for (it = 0; it < 1400; it++) {
      for (var m = 0; m < M; m++) {
        var a = ((m - 1 + M) % M) * step, b = ((m + 1) % M) * step, c = m * step;
        var ma = (m - 1 + M) % M, mb = (m + 1) % M;
        var tx = (cx(a, off[ma]) + cx(b, off[mb])) / 2, ty = (cy(a, off[ma]) + cy(b, off[mb])) / 2;
        var o = (tx - tr.x[c]) * tr.nx[c] + (ty - tr.y[c]) * tr.ny[c];
        var L = lim(c);
        off[m] = Math.max(-L, Math.min(L, off[m] + (o - off[m]) * 0.9));
      }
    }
    var line = new Float64Array(N);
    for (i = 0; i < N; i++) {
      var m0 = Math.floor(i / step) % M, m1 = (m0 + 1) % M, f = (i - Math.floor(i / step) * step) / step;
      line[i] = off[m0] * (1 - f) + off[m1] * f;
    }
    // 細かい点でも少し
    for (it = 0; it < 60; it++) {
      for (i = 0; i < N; i++) {
        var a2 = (i - 1 + N) % N, b2 = (i + 1) % N;
        var tx2 = (cx(a2, line[a2]) + cx(b2, line[b2])) / 2, ty2 = (cy(a2, line[a2]) + cy(b2, line[b2])) / 2;
        var o2 = (tx2 - tr.x[i]) * tr.nx[i] + (ty2 - tr.y[i]) * tr.ny[i];
        var L2 = lim(i);
        line[i] = Math.max(-L2, Math.min(L2, o2));
      }
    }
    tr.line = line;
    // ライン上の曲率
    var lx = new Float64Array(N), ly = new Float64Array(N), lk = new Float64Array(N);
    for (i = 0; i < N; i++) { lx[i] = cx(i, line[i]); ly[i] = cy(i, line[i]); }
    for (i = 0; i < N; i++) {
      var p = (i - 3 + N) % N, q = (i + 3) % N;
      var a1 = Math.atan2(ly[i] - ly[p], lx[i] - lx[p]), a3 = Math.atan2(ly[q] - ly[i], lx[q] - lx[i]);
      var da = a3 - a1;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      var dl = Math.hypot(lx[i] - lx[p], ly[i] - ly[p]) + Math.hypot(lx[q] - lx[i], ly[q] - ly[i]);
      lk[i] = da / (dl / 2);
    }
    tr.lineK = gaussSmoothLoop(lk, 2);
    tr.lineX = lx; tr.lineY = ly;
  }

  // ---- 車ごとの目標速度(AI とブレーキ目安看板が使う) ----
  function peakPower(car) {
    var best = 0;
    car.torque.forEach(function (p) { best = Math.max(best, p[1] * p[0] * 2 * Math.PI / 60); });
    return best;
  }
  function speedProfile(tr, car, gripScale) {
    var N = tr.N, g = 9.81, m = car.mass, rho = 0.6125;
    var mu = car.mu * 0.86 * (gripScale || 1);
    var P = peakPower(car) * 0.88 + (car.ers ? car.ers.power * 0.7 : 0);
    if (car.ers && car.ers.cap) P = Math.min(P, car.ers.cap);
    var v = new Float64Array(N), i, pass;
    for (i = 0; i < N; i++) {
      var k = Math.abs(tr.lineK[i]) + 1e-6;
      var den = m * k - mu * rho * car.clA;
      var vc = den > 0 ? Math.sqrt(mu * m * g / den) : 110;
      v[i] = Math.min(vc, 110);
    }
    var latUse = function (ii, vv) {
      var amax = mu * (g + rho * car.clA * vv * vv / m);
      var al = vv * vv * Math.abs(tr.lineK[ii]);
      return Math.sqrt(Math.max(0.08, 1 - Math.pow(al / amax, 2)));
    };
    var ds = tr.ds;
    for (pass = 0; pass < 2; pass++) {
      for (var c = N * 2; c > 0; c--) { // 後ろから:ブレーキで落とせる速度
        i = c % N; var nx = (i + 1) % N, vv = v[nx];
        var dec = Math.min(mu * (g + rho * car.clA * vv * vv / m), car.brake / m + 3) * 0.9 * latUse(nx, vv) + rho * car.cdA * vv * vv / m + g * tr.grade[i];
        var lim = Math.sqrt(vv * vv + 2 * Math.max(1, dec) * ds);
        if (v[i] > lim) v[i] = lim;
      }
      for (var c2 = 0; c2 < N * 2; c2++) { // 前から:加速で届く速度
        i = c2 % N; var nx2 = (i + 1) % N, v0 = Math.max(v[i], 3);
        var acc = Math.min(P / (m * v0), mu * g * 0.62 + rho * car.clA * v0 * v0 / m * 0.5) * latUse(i, v0) - rho * car.cdA * v0 * v0 / m - 0.015 * g - g * tr.grade[i];
        var lim2 = Math.sqrt(Math.max(1, v0 * v0 + 2 * acc * ds));
        if (v[nx2] > lim2) v[nx2] = lim2;
      }
    }
    return v;
  }

  // ---- 位置 → コース上の座標 ----
  var _near = [];
  function project(tr, x, y, hint, out) {
    out = out || {};
    var N = tr.N, best = -1, bd = Infinity, i, k, dx, dy, d;
    if (hint != null && hint >= 0) {
      for (k = -40; k <= 40; k++) {
        i = (hint + k + N) % N; dx = x - tr.x[i]; dy = y - tr.y[i]; d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
    }
    if (best < 0 || bd > 60 * 60) {
      var idx = nearIdx(tr, x, y, 150, _near);
      if (idx.length === 0) { idx = []; for (i = 0; i < N; i++) idx.push(i); }
      for (k = 0; k < idx.length; k++) {
        i = idx[k]; dx = x - tr.x[i]; dy = y - tr.y[i]; d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
    }
    // となりの点との間で正確に
    var i0 = best, i1 = (best + 1) % N, ip = (best - 1 + N) % N;
    var segx = tr.x[i1] - tr.x[i0], segy = tr.y[i1] - tr.y[i0];
    var t = ((x - tr.x[i0]) * segx + (y - tr.y[i0]) * segy) / (segx * segx + segy * segy);
    if (t < 0) {
      i0 = ip; i1 = best;
      segx = tr.x[i1] - tr.x[i0]; segy = tr.y[i1] - tr.y[i0];
      t = ((x - tr.x[i0]) * segx + (y - tr.y[i0]) * segy) / (segx * segx + segy * segy);
    }
    t = Math.max(0, Math.min(1, t));
    var nx = tr.nx[i0] + (tr.nx[i1] - tr.nx[i0]) * t, ny = tr.ny[i0] + (tr.ny[i1] - tr.ny[i0]) * t;
    var nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
    var cxp = tr.x[i0] + segx * t, cyp = tr.y[i0] + segy * t;
    out.i = i0; out.t = t;
    out.s = (i0 + t) * tr.ds;
    out.lat = (x - cxp) * nx + (y - cyp) * ny;
    out.z = tr.z[i0] + (tr.z[i1] - tr.z[i0]) * t;
    out.grade = tr.grade[i0];
    out.nx = nx; out.ny = ny;
    out.tx = -ny; out.ty = nx;
    out.hw = tr.hw[i0];
    out.runL = tr.runL[i0] + (tr.runL[i1] - tr.runL[i0]) * t;
    out.runR = tr.runR[i0] + (tr.runR[i1] - tr.runR[i0]) * t;
    return out;
  }

  // 横位置から路面の種類
  function surfaceAt(tr, i, lat) {
    var hw = tr.hw[i], a = Math.abs(lat);
    if (a <= hw) return 0;                         // アスファルト
    var right = lat > 0;
    if (a <= hw + 1.4 && (right ? tr.kerbR[i] : tr.kerbL[i])) return 1; // 縁石
    if (a <= hw + 2.2) return 2;                   // 路肩(舗装)
    if (right ? tr.gravelR[i] : tr.gravelL[i]) return 4; // グラベル
    return 3;                                       // 芝
  }

  // コース上の位置(s, 横位置)→ 2D座標
  function pointAt(tr, s, lat) {
    var L = tr.length; s = ((s % L) + L) % L;
    var f = s / tr.ds, i0 = Math.floor(f) % tr.N, i1 = (i0 + 1) % tr.N, t = f - Math.floor(f);
    var x = tr.x[i0] + (tr.x[i1] - tr.x[i0]) * t, y = tr.y[i0] + (tr.y[i1] - tr.y[i0]) * t;
    var nx = tr.nx[i0] + (tr.nx[i1] - tr.nx[i0]) * t, ny = tr.ny[i0] + (tr.ny[i1] - tr.ny[i0]) * t;
    var n = Math.hypot(nx, ny); nx /= n; ny /= n;
    return { x: x + nx * lat, y: y + ny * lat, z: tr.z[i0] + (tr.z[i1] - tr.z[i0]) * t, th: Math.atan2(nx, -ny), i: i0 };
  }

  // ブレーキ目安看板の位置(大きく減速する場所の手前)
  function brakeZones(tr, v) {
    var N = tr.N, out = [];
    for (var i = 0; i < N; i++) {
      var p = (i - 1 + N) % N, q = (i + 1) % N;
      if (v[i] >= v[p] && v[i] > v[q] + 0.01) {
        var mn = v[i];
        for (var k = 1; k < 200; k++) mn = Math.min(mn, v[(i + k) % N]);
        if (v[i] - mn > 16) out.push({ i: i, s: i * tr.ds, drop: v[i] - mn });
      }
    }
    return out;
  }

  return { build: build, project: project, surfaceAt: surfaceAt, pointAt: pointAt, nearest: nearest, speedProfile: speedProfile, brakeZones: brakeZones, peakPower: peakPower, closeLoop: closeLoop };
})();

if (typeof module !== 'undefined') module.exports = TrackGen;
