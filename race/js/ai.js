/* =========================================================
   ai.js — ライバル車の運転(走行ラインを目で追いかける)
   ・ステア:前方のライン上の点を狙う(ピュアパシュート)
   ・アクセル/ブレーキ:コースの目標速度と比べて決める
   ・前に車がいれば横にずれて抜きにかかる
   ========================================================= */
var AIDriver = (function () {
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function Driver(car, track, skill, profile) {
    this.car = car; this.track = track;
    this.skill = skill;              // 0.9〜1.0(1に近いほど速い)
    this.profile = profile;          // 目標速度(m/s)の配列
    this.offset = 0; this.offsetT = 0;
    this.stuck = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, steerAbs: 0, boost: false };
    this.wobble = Math.random() * 10;
  }

  Driver.prototype.update = function (dt, others, prog) {
    var car = this.car, tr = this.track, pj = car.proj, N = tr.N;
    if (pj.i == null) return this.input;
    var spd = car.speed;
    this.wobble += dt;
    // ---- 追い越し:前の車をよける ----
    var want = 0;
    if (others) {
      for (var k = 0; k < others.length; k++) {
        var o = others[k];
        if (o.car === car) continue;
        var gap = o.prog - prog;
        if (gap > -6 && gap <= 2) {
          // 横に並んだ車からは離れる
          var ld = pj.lat - o.car.proj.lat;
          if (Math.abs(ld) < 2.6) want = (ld >= 0 ? 1 : -1) * 3.2 + (pj.lat - (tr.line[pj.i] || 0));
        } else if (gap > 0 && gap < 28) {
          var latDiff = o.car.proj.lat - pj.lat;
          if (Math.abs(latDiff) < 3.2) {
            var room = o.car.proj.lat > 0 ? -1 : 1;
            want = room * 3.4;
            if (gap < 12 && o.car.speed < spd) this.blockSpeed = o.car.speed + 1.5;
          }
        }
      }
    }
    this.offset += clamp(want - this.offset, -dt * 1.8, dt * 1.8);

    // ---- ステア ----
    var look = 7 + spd * 0.42;
    var sT = pj.s + look;
    var f = ((sT / tr.ds) % N + N) % N, i0 = Math.floor(f), i1 = (i0 + 1) % N, t = f - i0;
    var ll = tr.line[i0] * (1 - t) + tr.line[i1] * t + this.offset;
    var hw = tr.hw[i0] - 1.4;
    ll = clamp(ll, -hw, hw);
    var tx = tr.x[i0] + (tr.x[i1] - tr.x[i0]) * t + tr.nx[i0] * ll;
    var ty = tr.y[i0] + (tr.y[i1] - tr.y[i0]) * t + tr.ny[i0] * ll;
    var c = Math.cos(car.th), s = Math.sin(car.th);
    var dx = tx - car.x, dy = ty - car.y;
    var lx = dx * c + dy * s, ly = -dx * s + dy * c;
    var curv = 2 * ly / (lx * lx + ly * ly + 1e-6);
    var steer = Math.atan(curv * car.L);
    // ヨーの暴れを少し抑える(カウンター)
    steer -= (car.r - spd * curv) * 0.05;
    this.input.steerAbs = steer;

    // ---- 速度 ----
    var ahead = Math.floor((pj.s + 2 + spd * 0.12) / tr.ds) % N;
    var vT = this.profile[ahead] * this.skill;
    if (Math.abs(this.offset) > 1) vT *= 0.985;
    if (this.blockSpeed) { vT = Math.min(vT, this.blockSpeed); this.blockSpeed = 0; }
    var err = vT - spd;
    if (err > -0.6) {
      this.input.throttle = clamp(0.55 + err * 0.35, 0, 1);
      this.input.brake = 0;
    } else {
      this.input.throttle = 0;
      this.input.brake = clamp(-err * 0.22, 0, 1);
    }
    // 大きく滑ったらアクセルをゆるめる
    if (car.slideLat > 0.5) this.input.throttle *= 0.6;
    this.input.boost = car.def.ers ? (car.ersE > car.def.ers.battery * 0.3 && spd > 30) : false;

    // ---- はまったら戻る ----
    if (spd < 2.5) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 3.5) { car.recover(tr); this.stuck = 0; }
    if (Math.abs(pj.lat) > tr.hw[pj.i] + 4 && spd < 12) { this.offT = (this.offT || 0) + dt; if (this.offT > 2.5) { car.recover(tr); this.offT = 0; } } else this.offT = 0;
    return this.input;
  };

  return { Driver: Driver };
})();

if (typeof module !== 'undefined') module.exports = AIDriver;
