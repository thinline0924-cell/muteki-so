/* =========================================================
   physics.js — 車の動き(1秒に120回計算する)
   ・タイヤ4本それぞれの荷重・すべり角・摩擦円
   ・空気抵抗とダウンフォース、荷重移動
   ・エンジン(トルクカーブ)・ターボのラグ・ハイブリッド(ERS)
   ・ギア(自動/手動)・TCS/ABS/姿勢制御/ステアリング補助
   座標:x,y=地面(上から見た2D), th=向き(反時計回り), 左が+
   ========================================================= */
var CarSim = (function () {
  var G = 9.81, HRHO = 0.6125; // 1/2 × 空気の密度
  var SURF = {
    mu: [1.0, 0.93, 0.95, 0.62, 0.5],
    roll: [0.012, 0.02, 0.014, 0.07, 0.2],
    shake: [0, 0.6, 0.1, 0.35, 0.8]
  };
  var C_PAC = 1.5, ALPHA_PEAK = 0.105, B_PAC = Math.tan(Math.PI / (2 * C_PAC)) / ALPHA_PEAK;
  function pac(a) { return Math.sin(C_PAC * Math.atan(B_PAC * a)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function torqueAt(curve, rpm) {
    if (rpm <= curve[0][0]) return curve[0][1] * Math.max(0.3, rpm / curve[0][0]);
    for (var i = 1; i < curve.length; i++) {
      if (rpm <= curve[i][0]) {
        var a = curve[i - 1], b = curve[i], t = (rpm - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    var l = curve[curve.length - 1];
    return Math.max(0, l[1] * (1 - (rpm - l[0]) / 1500));
  }

  function Car(def, assists) {
    this.def = def;
    this.m = def.mass;
    this.L = def.wheelbase;
    this.a = this.L * (1 - def.weightFront); // 重心→前軸
    this.b = this.L * def.weightFront;       // 重心→後軸
    this.tw = def.trackW;
    this.Izz = this.m * this.a * this.b * 1.1;
    this.R = def.radius;
    this.peakT = 0;
    for (var i = 0; i < def.torque.length; i++) this.peakT = Math.max(this.peakT, def.torque[i][1]);
    this.assists = assists || { tcs: true, abs: true, stab: true, steer: true, auto: true };
    this.proj = {};
    this.wpx = [this.a, this.a, -this.b, -this.b];
    this.wpy = [this.tw / 2, -this.tw / 2, this.tw / 2, -this.tw / 2];
    this.reset(0, 0, 0);
  }
  var P = Car.prototype;

  P.reset = function (x, y, th, z) {
    this.x = x; this.y = y; this.th = th; this.z = z || 0;
    this.vx = 0; this.vy = 0; this.r = 0;
    this.u = 0; this.v = 0; this.speed = 0;
    this.steer = 0; this.steerN = 0; this.thr = 0; this.brk = 0;
    this.gear = 1; this.shiftT = 0; this.rpm = this.def.idle; this.limiterT = 0;
    this.boost = 0; this.boostBar = 0; this.blowoff = 0;
    this.ersE = this.def.ers ? this.def.ers.battery * 0.9 : 0;
    this.ersP = 0; this.harvestP = 0;
    this.otReserve = this.def.overtake && this.def.overtake.capacity ? this.def.overtake.capacity : 0;
    this.otActive = false;
    this.axF = 0; this.ayF = 0;
    this.Fz = [0, 0, 0, 0]; this.alpha = [0, 0, 0, 0]; this.sx = [0, 0, 0, 0];
    this.Fx = [0, 0, 0, 0]; this.Fy = [0, 0, 0, 0]; this.mu = [0, 0, 0, 0];
    this.tireT = [62, 62, 62, 62]; this.brakeT = [180, 180, 180, 180];
    this.surf = [0, 0, 0, 0]; this.wheelBump = [0, 0, 0, 0];
    this.slideLat = 0; this.slideLong = 0; this.wheelspin = 0; this.lock = 0;
    this.down = 0; this.drag = 0; this.powerKW = 0; this.torqueNm = 0;
    this.fuel = 75; this.oilT = 88; this.waterT = 82;
    this.hint = -1; this.revT = 0;
    this.pop = 0; this.popT = 0; this.flame = 0; this.prevThr = 0;
    this.events = [];
    this.pitch = 0; this.roll = 0; this.heave = 0;
    this.slip = 0; // スリップストリーム(0..1)
    this.shiftFlash = 0;
  };

  // 補助つきの最大舵角(キーボードでも滑らかに曲がれるように)
  P.maxLock = function () {
    var u = Math.abs(this.u), low = 0.4;
    if (u < 4) return low;
    if (this.assists.steer) {
      var kin = Math.abs(Math.atan2(this.v + this.a * this.r, u));
      return clamp(ALPHA_PEAK * 1.25 + kin, 0.035, low);
    }
    return low / (1 + Math.pow(u / 26, 2));
  };

  P.shiftUp = function () {
    var n = this.def.gears.ratios.length;
    if (this.gear === -1) { this.gear = 1; return true; }
    if (this.gear < n && this.shiftT <= 0) { this.gear++; this.shiftT = this.def.shiftTime; this.events.push({ t: 'shift', up: true }); this.shiftFlash = 1; return true; }
    return false;
  };
  P.shiftDown = function (force) {
    if (this.gear > 1 && this.shiftT <= 0) {
      var g = this.def.gears, nr = this.rpm * g.ratios[this.gear - 2] / g.ratios[this.gear - 1];
      if (!force && nr > this.def.limiter * 1.02) { this.events.push({ t: 'deny' }); return false; }
      this.gear--; this.shiftT = this.def.shiftTime * 0.8; this.events.push({ t: 'shift', up: false }); return true;
    }
    return false;
  };

  /* input: { throttle, brake, steer(-1..1 左+), steerAbs(rad,AI用), shiftUp, shiftDown, boost } */
  P.step = function (dt, input, track) {
    var d = this.def, m = this.m, i;
    var c = Math.cos(this.th), s = Math.sin(this.th);
    var u = this.vx * c + this.vy * s, v = -this.vx * s + this.vy * c;
    var spd = Math.hypot(u, v);
    this.u = u; this.v = v; this.speed = spd;

    // ---- バック(停止中にブレーキを押し続ける)----
    var thrIn = input.throttle, brkIn = input.brake;
    if (this.gear === -1) { var tmp = thrIn; thrIn = brkIn; brkIn = tmp; }
    if (this.gear >= 1 && spd < 0.8 && input.brake > 0.5 && input.throttle < 0.1) {
      this.revT += dt; if (this.revT > 0.45) { this.gear = -1; this.revT = 0; }
    } else if (this.gear === -1 && spd < 0.8 && input.throttle > 0.5) {
      this.gear = 1;
    } else this.revT = 0;

    // ---- ペダル(キーボードでも急すぎないように)----
    this.thr += clamp(thrIn - this.thr, -dt * 9, dt * 6);
    this.brk += clamp(brkIn - this.brk, -dt * 10, dt * 7);

    // ---- ステアリング ----
    var lock = this.maxLock();
    if (input.steerAbs != null) {
      var tgt = clamp(input.steerAbs, -lock, lock);
      this.steer += clamp(tgt - this.steer, -dt * 2.6, dt * 2.6);
      this.steerN = this.steer / lock;
    } else {
      var sIn = input.steer;
      var rate = (Math.abs(sIn) < Math.abs(this.steerN) || sIn * this.steerN < 0) ? 6.5 : 3.6 - Math.min(1.6, spd / 50);
      this.steerN += clamp(sIn - this.steerN, -dt * rate, dt * rate);
      this.steer = this.steerN * lock;
    }

    // ---- ギア ----
    if (input.shiftUp) this.shiftUp();
    if (input.shiftDown) this.shiftDown();
    var ratios = d.gears.ratios, fin = d.gears.final, nG = ratios.length;
    if (this.shiftT > 0) this.shiftT -= dt;
    if (this.assists.auto && this.gear >= 1 && this.shiftT <= 0) {
      if (this.rpm > d.redline * 0.985 && this.gear < nG && this.wheelspin < 0.5) this.shiftUp();
      else if (this.gear > 1) {
        var down = this.rpm * ratios[this.gear - 2] / ratios[this.gear - 1];
        var thresh = this.brk > 0.1 ? 0.9 : 0.78;
        if (down < d.redline * thresh && this.rpm < d.redline * (this.brk > 0.1 ? 0.7 : 0.5)) this.shiftDown();
      }
    }
    var ratio = this.gear === -1 ? -2.9 * fin : ratios[this.gear - 1] * fin;

    // ---- コース上の位置と路面 ----
    var pj = TrackGen.project(track, this.x, this.y, this.hint, this.proj);
    this.hint = pj.i;
    this.z = pj.z;
    var grade = pj.grade * (c * pj.tx + s * pj.ty);
    for (i = 0; i < 4; i++) {
      var ox = c * this.wpx[i] - s * this.wpy[i], oy = s * this.wpx[i] + c * this.wpy[i];
      var latw = pj.lat + ox * pj.nx + oy * pj.ny;
      this.surf[i] = TrackGen.surfaceAt(track, pj.i, latw);
    }

    // ---- 空力 ----
    var q = HRHO * spd * spd;
    this.drag = q * d.cdA * (1 - this.slip * 0.32);
    this.down = q * d.clA * (1 - this.slip * 0.12);

    // ---- 荷重 ----
    var h = d.cgH, Wt = m * G;
    var FzF = Wt * d.weightFront + this.down * d.aeroFront - m * this.axF * h / this.L;
    var FzR = Wt * (1 - d.weightFront) + this.down * (1 - d.aeroFront) + m * this.axF * h / this.L;
    var latT = m * this.ayF * h / this.tw, rf = 0.55;
    this.Fz[0] = FzF / 2 - latT * rf; this.Fz[1] = FzF / 2 + latT * rf;
    this.Fz[2] = FzR / 2 - latT * (1 - rf); this.Fz[3] = FzR / 2 + latT * (1 - rf);
    for (i = 0; i < 4; i++) this.Fz[i] = Math.max(60, this.Fz[i]);
    var Fz0 = Wt / 4;

    // ---- エンジン ----
    var wheelOmega = u / this.R;
    var engFromWheel = Math.abs(wheelOmega * ratio) * 60 / (2 * Math.PI);
    var launch = d.idle + this.thr * (d.redline * 0.55 - d.idle);
    var clutch = clamp(1 - (spd - 2) / 10, 0, 1); // 発進時の半クラッチ
    var tgtRpm = Math.max(engFromWheel, d.idle * 0.95);
    if (this.gear === 1 || this.gear === -1) tgtRpm = Math.max(tgtRpm, launch * clutch + engFromWheel * (1 - clutch));
    tgtRpm += this.wheelspin * 1800 * this.thr;
    if (this.shiftT > 0 && this.thr > 0.5) tgtRpm = Math.max(tgtRpm, this.rpm * 0.995);
    this.rpm += (tgtRpm - this.rpm) * Math.min(1, dt * 16);
    this.rpm = clamp(this.rpm, d.idle * 0.9, d.limiter + 120);
    // レブリミッター
    if (this.rpm >= d.limiter) this.limiterT = 0.045;
    if (this.limiterT > 0) this.limiterT -= dt;
    // ターボ
    if (d.turbo) {
      var spool = clamp((this.rpm - d.turbo.spool * 0.6) / (d.turbo.spool * 0.7), 0, 1);
      var bt = this.thr * spool;
      var tau = bt > this.boost ? d.turbo.lag : 0.12;
      this.boost += (bt - this.boost) * Math.min(1, dt / tau);
      if (this.prevThr > 0.6 && this.thr < 0.25 && this.boost > 0.45) { this.blowoff = 1; this.events.push({ t: 'blowoff', k: this.boost }); this.boost *= 0.4; }
      this.boostBar = this.boost * d.turbo.maxBar;
    }
    var tq = torqueAt(d.torque, this.rpm);
    if (d.turbo) tq *= (d.turbo.base + (1 - d.turbo.base) * this.boost) / (d.turbo.base + (1 - d.turbo.base) * 0.92);
    // オーバーテイク(スクランブルブースト)
    this.otActive = false;
    if (d.overtake && d.overtake.kind === 'scramble') {
      if (input.boost && this.otReserve > 0 && this.thr > 0.5) { tq *= 1 + d.overtake.torque; this.otReserve -= dt; this.otActive = true; }
      else this.otReserve = Math.min(d.overtake.capacity, this.otReserve + dt * 0.12);
    }
    var engTq = tq * this.thr;
    if (this.limiterT > 0 || (this.shiftT > 0 && d.gearbox === 'H')) engTq = 0;
    if (this.shiftT > 0 && d.gearbox === 'SEQ') engTq *= 0.3;
    // エンジンブレーキ
    var eb = (1 - this.thr) * this.peakT * (0.05 + 0.07 * this.rpm / d.redline) * (1 - clutch);
    var netTq = engTq - eb * Math.sign(u || 1) * (this.gear === -1 ? -1 : 1);
    this.torqueNm = engTq;
    this.powerKW = engTq * this.rpm * 2 * Math.PI / 60 / 1000;
    var Fdrive = netTq * ratio * 0.9 / this.R;

    // ---- ハイブリッド ----
    var Fers = 0; this.ersP = 0; this.harvestP = 0;
    if (d.ers) {
      var on = this.thr > 0.9 && spd > d.ers.minSpeed && this.ersE > 0 && this.gear >= 1;
      if (on) {
        var p = d.ers.power * (input.boost ? 1 : 0.6);
        if (d.ers.cap) p = Math.max(0, Math.min(p, d.ers.cap - this.powerKW * 1000));
        this.ersP = p; this.otActive = !!input.boost;
        Fers = p / Math.max(spd, 6);
        this.ersE = Math.max(0, this.ersE - p * dt);
      }
      if (this.brk > 0.05 && spd > 5) {
        this.harvestP = Math.min(d.ers.harvest, this.brk * d.ers.harvest * 1.4);
        this.ersE = Math.min(d.ers.battery, this.ersE + this.harvestP * dt * 0.85);
      } else if (this.thr < 0.05 && spd > 15) {
        this.harvestP = d.ers.harvest * 0.25;
        this.ersE = Math.min(d.ers.battery, this.ersE + this.harvestP * dt * 0.85);
      }
    }

    // ---- ブレーキ ----
    var Fb = this.brk * d.brake;
    var regenF = this.harvestP / Math.max(spd, 6);

    // ---- タイヤ ----
    var FX = 0, FY = 0, MZ = 0, slideL = 0, slideX = 0, spin = 0, lockAmt = 0;
    for (i = 0; i < 4; i++) {
      var front = i < 2, px = this.wpx[i], py = this.wpy[i];
      var vwx = u - this.r * py, vwy = v + this.r * px;
      var dl = front ? this.steer : 0, cd = Math.cos(dl), sd = Math.sin(dl);
      var lon = vwx * cd + vwy * sd, lat = -vwx * sd + vwy * cd;
      var alpha = Math.atan2(lat, Math.max(Math.abs(lon), 3));
      var Fz = this.Fz[i], tt = this.tireT[i];
      var tempG = 1 - Math.min(0.1, Math.pow((tt - 92) / 55, 2) * 0.1);
      var loadG = 1 - 0.09 * (Fz / Fz0 - 1);
      var mu = d.mu * SURF.mu[this.surf[i]] * tempG * clamp(loadG, 0.72, 1.08) * (front ? 1 : 1.05);
      var Fmax = mu * Fz;
      var Fy = -Fmax * pac(alpha);
      // 前後の力の要求
      var Fx = 0, driven = !front || (Fers > 0 && d.ers.front);
      if (!front) Fx += Fdrive / 2;
      if (front && Fers > 0) Fx += Fers / 2;
      var brakeW = Fb * (front ? d.brakeFront : 1 - d.brakeFront) / 2 + (front ? regenF / 2 : 0);
      var dir = lon > 0.05 ? 1 : (lon < -0.05 ? -1 : 0);
      if (dir === 0) brakeW = Math.min(brakeW, Math.abs(lon) * m * 0.25 / dt);
      Fx -= brakeW * (dir || Math.sign(lon));
      Fx -= SURF.roll[this.surf[i]] * Fz * (dir || 0);
      // TCS / ABS
      var room = Math.sqrt(Math.max(0, Fmax * Fmax - 0.8 * Fy * Fy));
      if (this.assists.tcs && Fx * dir > 0 && driven && Math.abs(Fx) > room * 1.03) Fx = room * 1.03 * Math.sign(Fx);
      if (this.assists.abs && Fx * dir < 0 && Math.abs(Fx) > room * 0.97) Fx = room * 0.97 * Math.sign(Fx);
      // 摩擦円
      var tot = Math.hypot(Fx, Fy), ws = 0;
      if (tot > Fmax) {
        var over = tot / Fmax;
        if (Fx * dir < 0 && Math.abs(Fx) > Fmax * 1.05) { // ロック
          lockAmt = Math.max(lockAmt, Math.min(1, Math.abs(Fx) / Fmax - 1));
          Fx = Math.sign(Fx) * Fmax * 0.86; Fy *= 0.32;
        } else {
          var k = 0.97 / over; Fx *= k; Fy *= k;
          if (driven && Fx * dir > 0) ws = over - 1;
        }
      }
      if (driven) spin = Math.max(spin, ws);
      slideL = Math.max(slideL, Math.max(0, Math.abs(alpha) - ALPHA_PEAK * 1.15) * 6 * Math.min(1, spd / 8));
      // タイヤ温度
      var work = Math.abs(Fy * lat) + Math.abs(Fx) * (ws + lockAmt) * spd * 0.4 + Fz * spd * 0.004;
      this.tireT[i] += work * dt / 16000 - (tt - 55) * dt * 0.012 * (1 + spd / 50);
      // ブレーキ温度
      this.brakeT[i] += brakeW * Math.abs(lon) * dt / 2600 - (this.brakeT[i] - 120) * dt * 0.05 * (1 + spd / 40);
      this.alpha[i] = alpha; this.Fx[i] = Fx; this.Fy[i] = Fy; this.mu[i] = mu;
      this.sx[i] = driven ? ws : -lockAmt;
      var fxc = Fx * cd - Fy * sd, fyc = Fx * sd + Fy * cd;
      FX += fxc; FY += fyc; MZ += px * fyc - py * fxc;
    }
    this.wheelspin = spin; this.slideLat = Math.min(1.5, slideL); this.lock = lockAmt;
    this.slideLong = Math.min(1.5, spin + lockAmt);

    // 空気抵抗・坂
    if (spd > 0.01) { FX -= this.drag * u / spd; FY -= this.drag * v / spd; }
    FX -= m * G * grade;

    // 姿勢制御(スピンしかけたら少しだけ戻す)
    if (this.assists.stab && spd > 8) {
      var rRef = u * this.steer / (this.L * (1 + Math.pow(u / 70, 2)));
      var rMax = (this.mu[2] * G * 1.2 + this.down / m) / Math.max(u, 1);
      rRef = clamp(rRef, -rMax, rMax);
      var err = this.r - rRef, beta = Math.atan2(v, Math.abs(u));
      if (Math.abs(beta) > 0.05 && err * this.r > 0) MZ -= clamp(err * this.Izz * 8, -this.Izz * 5, this.Izz * 5);
    }

    // ---- 積分 ----
    var Fwx = FX * c - FY * s, Fwy = FX * s + FY * c;
    this.vx += Fwx / m * dt; this.vy += Fwy / m * dt;
    this.r += MZ / this.Izz * dt;
    if (spd < 2.5) this.r *= 1 - dt * 4;
    if (spd < 0.25 && this.thr < 0.05) { this.vx *= 0.85; this.vy *= 0.85; this.r *= 0.8; }
    this.th += this.r * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    var kf = Math.min(1, dt * 9);
    this.axF += (FX / m - this.axF) * kf; this.ayF += (FY / m - this.ayF) * kf;

    // ---- 壁 ----
    this.collideWalls(track, dt);

    // ---- 見た目のための値 ----
    this.pitch += (-this.axF * 0.0032 - this.pitch) * Math.min(1, dt * 8);
    this.roll += (this.ayF * 0.0042 - this.roll) * Math.min(1, dt * 8);
    var shake = 0;
    for (i = 0; i < 4; i++) {
      var sh = SURF.shake[this.surf[i]] * Math.min(1, spd / 20);
      this.wheelBump[i] = sh > 0 ? (Math.random() - 0.5) * 0.035 * sh : this.wheelBump[i] * 0.8;
      shake = Math.max(shake, sh);
    }
    this.shake = shake;
    this.heave = -this.down / (m * G) * 0.018 + (shake ? (Math.random() - 0.5) * 0.012 * shake : 0);

    // アクセルを戻したときのアフターファイア
    if (this.prevThr > 0.7 && this.thr < 0.2 && this.rpm > d.redline * 0.55) this.popT = d.id === 'rotary' ? 1.2 : 0.7;
    this.flame *= 0.8;
    if (this.popT > 0) {
      this.popT -= dt;
      if (Math.random() < dt * (d.id === 'rotary' ? 26 : 14)) { this.flame = 0.6 + Math.random() * 0.5; this.events.push({ t: 'pop', k: Math.random() }); }
    }
    if (this.shiftT > 0 && d.gearbox === 'SEQ' && this.thr > 0.8 && Math.random() < 0.25) this.flame = Math.max(this.flame, 0.5);
    this.prevThr = this.thr;
    this.shiftFlash *= 0.9;

    // 温度と燃料
    this.oilT += ((88 + this.rpm / d.redline * 22 + this.thr * 6) - this.oilT) * dt * 0.02;
    this.waterT += ((80 + this.rpm / d.redline * 14) - this.waterT) * dt * 0.03;
    this.fuel = Math.max(0, this.fuel - (0.002 + this.thr * this.rpm / d.redline * 0.03) * dt);
  };

  P.collideWalls = function (track, dt) {
    var pj = TrackGen.project(track, this.x, this.y, this.hint, this.proj);
    this.hint = pj.i;
    var c = Math.cos(this.th), s = Math.sin(this.th);
    var hl = this.def.length / 2 * 0.92, hwid = this.def.width / 2 * 0.95;
    var limR = pj.hw + pj.runR, limL = -(pj.hw + pj.runL);
    var worst = 0, cpx = 0, cpy = 0, side = 0;
    for (var k = 0; k < 4; k++) {
      var lx = k < 2 ? hl : -hl, ly = (k % 2 ? 1 : -1) * hwid;
      var ox = c * lx - s * ly, oy = s * lx + c * ly;
      var lat = pj.lat + ox * pj.nx + oy * pj.ny;
      var pen = 0, sd = 0;
      if (lat > limR) { pen = lat - limR; sd = 1; } else if (lat < limL) { pen = limL - lat; sd = -1; }
      if (pen > worst) { worst = pen; cpx = ox; cpy = oy; side = sd; }
    }
    if (worst > 0) {
      var nx = pj.nx * side, ny = pj.ny * side; // 壁に向かう向き
      this.x -= nx * worst; this.y -= ny * worst;
      // 接触点の速度
      var pvx = this.vx - this.r * cpy, pvy = this.vy + this.r * cpx;
      var vn = pvx * nx + pvy * ny;
      if (vn > 0) {
        var e = 0.28;
        var jn = (1 + e) * vn;
        this.vx -= nx * jn; this.vy -= ny * jn;
        // こすれて減速
        var tx = -ny, ty = nx, vt = this.vx * tx + this.vy * ty;
        var fr = Math.min(Math.abs(vt), jn * 0.45) * Math.sign(vt);
        this.vx -= tx * fr; this.vy -= ty * fr;
        // 回転
        var Jx = -nx * jn * this.m, Jy = -ny * jn * this.m;
        this.r += (cpx * Jy - cpy * Jx) / this.Izz * 0.35;
        this.events.push({ t: 'hit', k: Math.min(1, vn / 18), x: this.x + cpx, y: this.y + cpy, scrape: Math.abs(vt) });
      } else if (this.speed > 3) {
        this.events.push({ t: 'scrape', k: Math.min(1, this.speed / 60), x: this.x + cpx, y: this.y + cpy });
      }
    }
  };

  // コース上の s / 横位置 に置く
  P.place = function (track, sPos, lat) {
    var p = TrackGen.pointAt(track, sPos, lat);
    this.reset(p.x, p.y, p.th, p.z);
    this.hint = p.i;
  };
  // コースへ戻す(R キー)
  P.recover = function (track) {
    var pj = TrackGen.project(track, this.x, this.y, this.hint, this.proj);
    var keep = { ersE: this.ersE, fuel: this.fuel, tireT: this.tireT.slice(), otReserve: this.otReserve };
    var lat = clamp(pj.lat, -pj.hw + 2.5, pj.hw - 2.5);
    this.place(track, pj.s, lat);
    this.ersE = keep.ersE; this.fuel = keep.fuel; this.tireT = keep.tireT; this.otReserve = keep.otReserve;
  };

  return { Car: Car, torqueAt: torqueAt, ALPHA_PEAK: ALPHA_PEAK, SURF: SURF };
})();

if (typeof module !== 'undefined') module.exports = CarSim;
