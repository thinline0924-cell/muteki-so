/* =========================================================
   carmodel.js — プロトタイプカーの3Dモデルをその場で組み立てる
   ・車体は「上から見た形 × 高さの関数」で作る曲面
   ・ローカル座標:+X=前, +Y=上, +Z=右
   ========================================================= */
var CarModel = (function () {
  var shared = null;
  function sharedMats() {
    if (shared) return shared;
    var carbonTex = Tex.carbon();
    shared = {
      carbon: new THREE.MeshPhysicalMaterial({ color: 0x9aa0a8, map: carbonTex, metalness: 0.4, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.8, metalness: 0.1 }),
      inner: new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1, side: THREE.DoubleSide }),
      tire: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.88, metalness: 0.0 }),
      tireSide: new THREE.MeshStandardMaterial({ map: Tex.tireSide(), roughness: 0.85 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.22 }),
      exhaust: new THREE.MeshStandardMaterial({ color: 0x6b5a4a, metalness: 0.9, roughness: 0.45 }),
      rims: {
        spoke: new THREE.MeshStandardMaterial({ map: Tex.rim('spoke'), metalness: 0.85, roughness: 0.3 }),
        mesh: new THREE.MeshStandardMaterial({ map: Tex.rim('mesh'), metalness: 0.85, roughness: 0.3 }),
        turbine: new THREE.MeshStandardMaterial({ map: Tex.rim('turbine'), metalness: 0.85, roughness: 0.3 })
      },
      shadow: new THREE.MeshBasicMaterial({ map: Tex.shadowBlob(), transparent: true, depthWrite: false, opacity: 0.85 }),
      flame: new THREE.SpriteMaterial({ map: Tex.soft('rgba(255,190,110,1)'), color: 0xffa060, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
    };
    return shared;
  }

  function sm(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function interp(keys, x) {
    if (x >= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (x >= keys[i][0]) {
        var a = keys[i - 1], b = keys[i], t = (x - b[0]) / (a[0] - b[0]);
        t = t * t * (3 - 2 * t);
        return b[1] + (a[1] - b[1]) * t;
      }
    }
    return keys[keys.length - 1][1];
  }
  function smax(a, b, k) { return (a + b + Math.sqrt((a - b) * (a - b) + k)) / 2; }

  function bodyGeometry(def) {
    var S = def.shape, L = def.length, W = def.width / 2;
    var fo = (L - def.wheelbase) / 2 + (S.wing === 'low' ? -0.05 : 0.08);
    var xf = L / 2 - fo, xr = xf - def.wheelbase, R = def.radius;
    var uw = (def.trackW / 2) / W;
    var keys = [ // 中心線の高さ(前→後ろ)
      [L / 2, S.nose * 0.75], [L / 2 - 0.25, S.nose], [L / 2 - 0.9, S.deck * 0.72], [L * 0.12, S.deck],
      [-L * 0.1, S.deck * 1.04], [-L * 0.32, (S.deck + S.tail) / 2], [-L / 2 + 0.3, S.tail], [-L / 2, S.tail * 0.97]
    ];
    function halfW(x) { return W * (1 - 0.1 * sm(L / 2 - 0.7, L / 2, x) - 0.03 * sm(L / 2 - 0.4, L / 2, -x)); }
    function arch(x) {
      var lift = 0;
      [xf, xr].forEach(function (xa) {
        var ra = R + 0.07, dx = x - xa;
        if (Math.abs(dx) < ra) lift = Math.max(lift, R + Math.sqrt(ra * ra - dx * dx) - 0.09);
      });
      return lift;
    }
    function top(x, u) {
      var c = interp(keys, x) * (1 - 0.07 * u * u);
      var f = 0;
      [[xf, S.fender], [xr, S.fender * (S.wing === 'low' ? 0.98 : 1.0)]].forEach(function (a) {
        var dx = (x - a[0]) / (R + 0.55);
        if (Math.abs(dx) < 1) {
          var bx = Math.pow(Math.cos(dx * Math.PI / 2), 0.7);
          var bu = Math.exp(-Math.pow((Math.abs(u) - uw) / 0.24, 2));
          f = Math.max(f, a[1] * bx * bu);
        }
      });
      // 後輪から後ろはフェンダーが尾まで流れる
      if (x < xr) {
        var bu2 = Math.exp(-Math.pow((Math.abs(u) - uw) / 0.26, 2));
        f = Math.max(f, (S.tail * 0.98) * bu2 * sm(-L / 2 - 0.2, xr, x) * 1.0);
      }
      return smax(c, f, 0.004);
    }
    var NX = 84, NU = 44, pos = [], idx = [];
    var grid = [];
    for (var i = 0; i <= NX; i++) {
      var x = L / 2 - (i / NX) * L;
      var hw = halfW(x), al = arch(x);
      var noseK = x > L / 2 - 0.22 ? Math.pow(Math.max(0, 1 - Math.pow((x - (L / 2 - 0.22)) / 0.22, 2.2)), 1 / 2.2) : 1;
      var tailK = x < -L / 2 + 0.05 ? Math.pow(Math.max(0, 1 - Math.pow((-L / 2 + 0.05 - x) / 0.05, 6)), 1 / 6) : 1;
      for (var j = 0; j <= NU; j++) {
        var t = j / NU, u = -Math.cos(Math.PI * t); // t=0 右端 / t=1 左端
        var fl = 0.085 + al * sm(0.5, 0.8, Math.abs(u));
        var h = top(x, u);
        var round = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 5)), 1 / 5);
        var z = fl + (h - fl) * round * noseK * tailK;
        var px = x, py = z, pz = -u * hw * (0.985 + 0.015 * round);
        pos.push(px, py, pz);
        grid.push({ x: x, z: z, u: u });
      }
    }
    for (i = 0; i < NX; i++) for (j = 0; j < NU; j++) {
      var a = i * (NU + 1) + j, b = a + 1, c = a + NU + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // 3枚(右側面/上面/左側面)に分けて、それぞれに合ったUVを付ける
    var nrm = g.getAttribute('normal').array;
    var sheets = [[0, 8], [8, NU - 8], [NU - 8, NU]];
    var out = new THREE.BufferGeometry(), P = [], N = [], UV = [], I = [], base = 0;
    sheets.forEach(function (sh, k) {
      var cols = sh[1] - sh[0] + 1;
      for (var ii = 0; ii <= NX; ii++) for (var jj = sh[0]; jj <= sh[1]; jj++) {
        var vi = ii * (NU + 1) + jj, gp = grid[vi];
        P.push(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]);
        N.push(nrm[vi * 3], nrm[vi * 3 + 1], nrm[vi * 3 + 2]);
        var uu = (gp.x + L / 2) / L, vv;
        if (k === 0) vv = Math.min(1, gp.z / 1.15) * 0.3;
        else if (k === 2) vv = 0.7 + Math.min(1, gp.z / 1.15) * 0.3;
        else vv = 0.3 + 0.4 * (gp.u + 1) / 2;
        UV.push(uu, vv);
      }
      for (ii = 0; ii < NX; ii++) for (jj = 0; jj < cols - 1; jj++) {
        var a2 = base + ii * cols + jj, b2 = a2 + 1, c2 = a2 + cols, d2 = c2 + 1;
        I.push(a2, b2, c2, b2, d2, c2);
      }
      base += (NX + 1) * cols;
    });
    out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    out.setIndex(I);
    return { geo: out, xf: xf, xr: xr, top: top, halfW: halfW, keys: keys };
  }

  function airfoilGeo(span, chord, thick) {
    var sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.bezierCurveTo(chord * 0.15, thick * 1.2, chord * 0.6, thick * 0.9, chord, thick * 0.15);
    sh.lineTo(chord, 0);
    sh.bezierCurveTo(chord * 0.6, thick * 0.1, chord * 0.2, -thick * 0.3, 0, 0);
    var g = new THREE.ExtrudeGeometry(sh, { depth: span, bevelEnabled: false, curveSegments: 10 });
    g.translate(-chord, 0, -span / 2);
    return g;
  }

  function wheel(def, mats, front, side) {
    var R = def.radius, wdt = front ? 0.31 : 0.36;
    var steer = new THREE.Group(), spin = new THREE.Group();
    steer.add(spin);
    var prof = [];
    var ri = R * 0.66, ro = R, hw = wdt / 2, sh = 0.035;
    prof.push(new THREE.Vector2(ri, -hw));
    prof.push(new THREE.Vector2(ro - sh, -hw));
    for (var k = 0; k <= 4; k++) { var a = -Math.PI / 2 + k / 4 * Math.PI / 2; prof.push(new THREE.Vector2(ro - sh + Math.cos(a) * sh, -hw + sh + Math.sin(a) * sh)); }
    for (k = 0; k <= 4; k++) { var a2 = k / 4 * Math.PI / 2; prof.push(new THREE.Vector2(ro - sh + Math.cos(a2) * sh, hw - sh + Math.sin(a2) * sh)); }
    prof.push(new THREE.Vector2(ri, hw));
    var tg = new THREE.LatheGeometry(prof, 40);
    tg.rotateX(Math.PI / 2);
    var tire = new THREE.Mesh(tg, mats.tire);
    tire.castShadow = true;
    spin.add(tire);
    // 側面(文字入り)
    var sideRing = new THREE.Mesh(new THREE.RingGeometry(ri, ro - 0.02, 40, 1), mats.tireSide);
    sideRing.position.z = side * (hw + 0.001);
    if (side < 0) sideRing.rotation.y = Math.PI;
    spin.add(sideRing);
    // ホイール
    var rimMat = mats.rims[def.id === 'kestrel' ? 'spoke' : def.id === 'rotary' ? 'mesh' : 'turbine'];
    var rimDisc = new THREE.Mesh(new THREE.CircleGeometry(ri, 32), rimMat);
    rimDisc.position.z = side * (hw - 0.05);
    if (side < 0) rimDisc.rotation.y = Math.PI;
    spin.add(rimDisc);
    var lip = new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, wdt * 0.9, 32, 1, true), mats.chrome);
    lip.rotation.x = Math.PI / 2;
    spin.add(lip);
    // ブレーキディスク(熱で光る)
    var discMat = new THREE.MeshStandardMaterial({ color: 0x3a3b3e, metalness: 0.7, roughness: 0.5, emissive: 0xff4a10, emissiveIntensity: 0 });
    var disc = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.035, 28), discMat);
    disc.rotation.x = Math.PI / 2; disc.position.z = side * (hw - 0.13);
    steer.add(disc);
    var caliper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), new THREE.MeshStandardMaterial({ color: 0xc0242c, metalness: 0.4, roughness: 0.4 }));
    caliper.position.set(-R * 0.35, R * 0.3, side * (hw - 0.08));
    steer.add(caliper);
    return { steer: steer, spin: spin, disc: discMat, R: R };
  }

  function build(def, opt) {
    opt = opt || {};
    var mats = sharedMats();
    var S = def.shape, L = def.length, W = def.width / 2;
    var root = new THREE.Group();     // 位置と向き
    var chassis = new THREE.Group();  // ロール・ピッチ(サスペンションの動き)
    root.add(chassis);
    var paint = new THREE.MeshPhysicalMaterial({ map: Tex.livery(def), metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
    var B = bodyGeometry(def);
    var body = new THREE.Mesh(B.geo, paint);
    body.castShadow = true; body.receiveShadow = true;
    chassis.add(body);

    // 内側の黒い箱(ホイールハウスから中が見えないように)
    var tub = new THREE.Mesh(new THREE.BoxGeometry(def.wheelbase + 0.7, 0.3, W * 1.3), mats.inner);
    tub.position.set((B.xf + B.xr) / 2, 0.24, 0); chassis.add(tub);
    var floor = new THREE.Mesh(new THREE.BoxGeometry(L - 0.3, 0.04, W * 1.8), mats.dark);
    floor.position.set(-0.05, 0.07, 0); chassis.add(floor);
    // フロントスプリッター
    var split = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.025, W * 1.9), mats.carbon);
    split.position.set(L / 2 - 0.12, 0.055, 0); chassis.add(split);
    // ディフューザー
    var dif = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, W * 1.5), mats.carbon);
    dif.position.set(-L / 2 + 0.25, 0.16, 0); dif.rotation.z = -0.28; chassis.add(dif);
    for (var f = -2; f <= 2; f++) {
      var fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.012), mats.carbon);
      fin.position.set(-L / 2 + 0.25, 0.12, f * 0.32); fin.rotation.z = -0.28; chassis.add(fin);
    }

    // キャノピー(ガラス)
    var glass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(def.livery.glass), metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
    var cx = S.cockpitX * L / 2;
    var deckAt = B.top(cx, 0);
    var can = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    can.scale.set(S.cockpitL / 2, Math.max(0.12, (S.cockpitH - deckAt) * 0.9 + 0.04), 0.42);
    can.position.set(cx, deckAt - 0.04, 0);
    can.castShadow = true;
    chassis.add(can);
    // ルーフの塗装帯(キャノピーの上に細い帯)
    var roof = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 12, 0, Math.PI * 2, 0, Math.PI / 2), paint);
    roof.scale.set(S.cockpitL / 2 * 0.62, can.scale.y * 1.012, 0.16);
    roof.position.copy(can.position);
    chassis.add(roof);

    // シャークフィン
    if (S.fin) {
      var fs = new THREE.Shape();
      var x0 = cx - S.cockpitL * 0.3, x1 = -L / 2 + 0.35;
      fs.moveTo(x0, 0); fs.lineTo(x1, 0); fs.lineTo(x1, 0.42); fs.quadraticCurveTo((x0 + x1) / 2, 0.36, x0, 0.02);
      var fg = new THREE.ExtrudeGeometry(fs, { depth: 0.02, bevelEnabled: false });
      fg.translate(0, 0, -0.01);
      var finM = new THREE.Mesh(fg, paint);
      finM.position.y = S.deck * 0.95 + 0.02;
      finM.castShadow = true;
      chassis.add(finM);
    }
    // リアウイング
    var wingY = S.wing === 'low' ? 0.93 : S.wing === 'swan' ? 1.04 : 1.02;
    var wingX = -L / 2 + (S.wing === 'high' ? 0.05 : 0.18);
    var span = W * 2 - (S.wing === 'low' ? 0.04 : 0.12);
    var wingM = new THREE.Mesh(airfoilGeo(span, 0.36, 0.05), mats.carbon);
    wingM.position.set(wingX + 0.36, wingY, 0); wingM.rotation.z = 0.12;
    wingM.castShadow = true;
    chassis.add(wingM);
    var flap = new THREE.Mesh(airfoilGeo(span, 0.16, 0.03), paint);
    flap.position.set(wingX + 0.02, wingY + 0.05, 0); flap.rotation.z = 0.42;
    chassis.add(flap);
    [-1, 1].forEach(function (sd) {
      var epH = S.wing === 'low' ? 0.5 : 0.36;
      var ep = new THREE.Mesh(new THREE.BoxGeometry(0.56, epH, 0.016), paint);
      ep.position.set(wingX + 0.2, wingY + 0.06 - epH / 2 + 0.12, sd * span / 2);
      ep.castShadow = true;
      chassis.add(ep);
    });
    if (S.wing === 'swan' || S.wing === 'high') {
      [-1, 1].forEach(function (sd) {
        var py = new THREE.Mesh(new THREE.BoxGeometry(0.22, wingY - S.tail + 0.08, 0.02), mats.carbon);
        py.position.set(wingX + 0.2, (wingY + S.tail) / 2, sd * 0.32);
        chassis.add(py);
      });
    }

    // ミラー
    [-1, 1].forEach(function (sd) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.16), paint);
      m.position.set(cx + S.cockpitL * 0.38, S.fender + 0.03, sd * (W * 0.78));
      chassis.add(m);
      var mg = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.06), mats.chrome);
      mg.position.set(cx + S.cockpitL * 0.38 - 0.051, S.fender + 0.03, sd * (W * 0.78)); mg.rotation.y = -Math.PI / 2;
      chassis.add(mg);
    });

    // ライト
    var headMat = new THREE.MeshStandardMaterial({ color: 0xeef4ff, emissive: 0xdde8ff, emissiveIntensity: 1.6, roughness: 0.2 });
    var tailMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1020, emissiveIntensity: 0.6, roughness: 0.3 });
    var hx = B.xf + 0.35, hy = B.top(B.xf + 0.35, 0.82) * 0.98;
    [-1, 1].forEach(function (sd) {
      if (S.lights === 'round') {
        var hl = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), headMat);
        hl.position.set(hx + 0.12, hy - 0.04, sd * W * 0.78); hl.rotation.y = Math.PI / 2 - 0.15 * sd; hl.rotation.x = 0;
        hl.rotation.order = 'YXZ'; hl.rotation.x = -0.6;
        chassis.add(hl);
      } else if (S.lights === 'strip') {
        for (var q = 0; q < 4; q++) {
          var st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.07), headMat);
          st.position.set(hx + 0.1 - q * 0.02, hy - 0.02 - q * 0.035, sd * (W * 0.72 + q * 0.02));
          chassis.add(st);
        }
      } else {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.42), headMat);
        bar.position.set(hx + 0.12, hy - 0.05, sd * W * 0.74);
        chassis.add(bar);
      }
    });
    if (S.lights === 'bar') {
      var tb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, W * 1.8), tailMat);
      tb.position.set(-L / 2 + 0.005, S.tail * 0.9, 0); chassis.add(tb);
    } else {
      [-1, 1].forEach(function (sd) {
        var tl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, S.lights === 'strip' ? 0.05 : 0.22), tailMat);
        tl.position.set(-L / 2 + 0.005, S.tail * 0.82, sd * W * 0.72);
        chassis.add(tl);
      });
      var rain = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.06), tailMat);
      rain.position.set(-L / 2 + 0.01, 0.36, 0); chassis.add(rain);
    }
    // マフラー
    var exhausts = [];
    var exz = def.id === 'rotary' ? [0] : (def.id === 'kestrel' ? [-0.35, 0.35] : [-0.12, 0.12]);
    exz.forEach(function (z) {
      var ex = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.25, 14, 1, true), mats.exhaust);
      ex.rotation.z = Math.PI / 2;
      var ey = def.id === 'kestrel' ? 0.3 : 0.5;
      ex.position.set(-L / 2 + 0.06, ey, z);
      chassis.add(ex);
      exhausts.push(new THREE.Vector3(-L / 2 - 0.05, ey, z));
    });
    var flames = exhausts.map(function (p) {
      var sp = new THREE.Sprite(mats.flame.clone());
      sp.position.copy(p); sp.scale.set(0.5, 0.5, 0.5); sp.visible = false;
      chassis.add(sp);
      return sp;
    });

    // タイヤ
    var wheels = [];
    [[B.xf, 1, true], [B.xf, -1, true], [B.xr, 1, false], [B.xr, -1, false]].forEach(function (w) {
      var wh = wheel(def, mats, w[2], w[1]);
      wh.steer.position.set(w[0], def.radius, w[1] * (def.trackW / 2));
      wh.front = w[2]; wh.side = w[1];
      root.add(wh.steer); // ホイールは車体のロールと別に動く
      wheels.push(wh);
    });

    // 足元のやわらかい影
    var blob = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.25, W * 2.6), mats.shadow);
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02;
    blob.renderOrder = -1;
    root.add(blob);

    var spinAngle = 0;
    var model = {
      root: root, chassis: chassis, wheels: wheels, exhausts: exhausts, flames: flames,
      headMat: headMat, tailMat: tailMat, paint: paint, glass: glass, xf: B.xf, xr: B.xr,
      // physics の状態を見た目に反映
      update: function (st, dt) {
        spinAngle -= (st.speedLong || 0) * dt / def.radius;
        for (var i = 0; i < 4; i++) {
          var w = wheels[i];
          w.spin.rotation.z = spinAngle * (w.front ? 1 : 1 + (st.wheelspin || 0) * 0.6);
          w.steer.rotation.y = w.front ? (st.steer || 0) : 0;
          var heat = st.brakeTemp ? Math.max(0, (st.brakeTemp[i] - 450) / 500) : 0;
          w.disc.emissiveIntensity = Math.min(2.2, heat * 2.5);
          // サスペンションの縮み(見た目)
          w.steer.position.y = def.radius + (st.wheelBump ? st.wheelBump[i] : 0);
        }
        chassis.rotation.z = -(st.pitch || 0);
        chassis.rotation.x = (st.roll || 0);
        chassis.position.y = st.heave || 0;
        tailMat.emissiveIntensity = (st.brake > 0.05 ? 3.2 : 0.7) + (st.lightsOn ? 0.6 : 0);
        headMat.emissiveIntensity = st.lightsOn ? 3.0 : 1.4;
        for (var k = 0; k < flames.length; k++) {
          var fl = st.flame || 0;
          flames[k].visible = fl > 0.02;
          if (fl > 0.02) { var s = 0.25 + fl * 0.6 * (0.7 + Math.random() * 0.6); flames[k].scale.set(s * 1.4, s, s); flames[k].material.opacity = Math.min(1, fl * 1.5); }
        }
      }
    };
    return model;
  }
  return { build: build };
})();
