/* =========================================================
   world.js — コースの3D世界を組み立てる
   空・霧・光 / 地形 / 路面・縁石・ランオフ・壁 / 木・山・観客席
   スタートのシグナル / ブレーキ看板 / タイヤ跡 / 煙と火花
   2D(x, y, 標高z) → 3D(X=x, Y=z, Z=-y)
   ========================================================= */
var World = (function () {
  function V(x, y, z) { return new THREE.Vector3(x, z, -y); }
  function sm(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function col(hex) { return new THREE.Color(hex); }

  // ---------- 空 ----------
  var skyVS = 'varying vec3 vP; void main(){ vP = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; }';
  var skyFS = [
    'uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunDir; uniform vec3 sunCol; uniform float haze;',
    'varying vec3 vP;',
    'void main(){',
    '  float h = vP.y;',
    '  vec3 c = mix(hor, top, pow(max(h,0.0), 0.55));',
    '  c = mix(c, gnd, smoothstep(0.0, -0.08, h));',
    '  float sd = max(dot(normalize(vP), normalize(sunDir)), 0.0);',
    '  c += sunCol * (pow(sd, 900.0)*2.5 + pow(sd, 12.0)*0.25 + pow(sd, 3.0)*0.08);',
    '  c = mix(c, hor, haze*(1.0-smoothstep(0.0,0.35,abs(h))));',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'].join('\n');
  function skyMaterial(sky) {
    var sd = new THREE.Vector3(sky.sunDir[0], sky.sunDir[1], sky.sunDir[2]).normalize();
    return new THREE.ShaderMaterial({
      uniforms: { top: { value: col(sky.top) }, hor: { value: col(sky.horizon) }, gnd: { value: col(sky.ground) }, sunDir: { value: sd }, sunCol: { value: col(sky.sun) }, haze: { value: 0.35 } },
      vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false, fog: false
    });
  }

  // ---------- 帯(リボン)状の形を作る ----------
  // latA(i), latB(i): 横位置 / yA, yB: 高さのずれ / vLen: テクスチャ1枚の長さ / filter(i): その区間を作るか
  function ribbon(tr, latA, latB, yA, yB, vLen, filter, uScale) {
    var N = tr.N, pos = [], uv = [], idx = [], nrm = [];
    for (var i = 0; i <= N; i++) {
      var k = i % N, la = latA(k), lb = latB(k);
      var ax = tr.x[k] + tr.nx[k] * la, ay = tr.y[k] + tr.ny[k] * la;
      var bx = tr.x[k] + tr.nx[k] * lb, by = tr.y[k] + tr.ny[k] * lb;
      var ya = typeof yA === 'function' ? yA(k) : yA, yb = typeof yB === 'function' ? yB(k) : yB;
      pos.push(ax, tr.z[k] + ya, -ay, bx, tr.z[k] + yb, -by);
      var v = i * tr.ds / vLen;
      uv.push(0, v, uScale ? Math.abs(lb - la) / uScale : 1, v);
      nrm.push(0, 1, 0, 0, 1, 0);
    }
    for (i = 0; i < N; i++) {
      if (filter && !filter(i)) continue;
      var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // 法線が下向きなら裏返す
    var na = g.getAttribute('normal');
    if (na.count && na.getY(0) < 0) { idx = idx.map(function (x, j) { return j % 3 === 1 ? idx[j + 1] : j % 3 === 2 ? idx[j - 1] : x; }); g.setIndex(idx); g.computeVertexNormals(); }
    return g;
  }
  // 縦の壁(下→上)
  function wall(tr, latFn, h0, h1, vLen, filter, flip) {
    var N = tr.N, pos = [], uv = [], idx = [];
    for (var i = 0; i <= N; i++) {
      var k = i % N, la = latFn(k);
      var x = tr.x[k] + tr.nx[k] * la, y = tr.y[k] + tr.ny[k] * la;
      pos.push(x, tr.z[k] + h0, -y, x, tr.z[k] + h1, -y);
      var u = (flip ? -1 : 1) * i * tr.ds / vLen;
      uv.push(u, 0, u, 1);
    }
    for (i = 0; i < N; i++) {
      if (filter && !filter(i)) continue;
      var a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // ジオメトリをまとめる(頂点色つき)
  function merge(list) {
    var P = [], Nn = [], C = [], I = [], base = 0;
    list.forEach(function (it) {
      var g = it.g.index ? it.g.toNonIndexed() : it.g;
      g.computeVertexNormals();
      var p = g.getAttribute('position'), n = g.getAttribute('normal');
      var cc = col(it.c);
      for (var i = 0; i < p.count; i++) {
        P.push(p.getX(i), p.getY(i), p.getZ(i)); Nn.push(n.getX(i), n.getY(i), n.getZ(i));
        var sh = it.shade ? 1 - it.shade * Math.max(0, (it.shadeTop - p.getY(i)) / it.shadeTop) : 1;
        C.push(cc.r * sh, cc.g * sh, cc.b * sh); I.push(base + i);
      }
      base += p.count;
    });
    var g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g2.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    g2.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g2.setIndex(I);
    return g2;
  }

  // ---------- 粒子(煙・土ぼこり・火花)----------
  function Particles(max, additive, tex) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max); this.grow = new Float32Array(max);
    this.alpha = new Float32Array(max); this.col = new Float32Array(max * 3);
    this.n = 0; this.head = 0;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, max);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 600 } },
      vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aCol; varying float vA; varying vec3 vC; uniform float scale;' +
        'void main(){ vA=aAlpha; vC=aCol; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize*scale/(-mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a*vA); if(gl_FragColor.a<0.01) discard; }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geo = g;
  }
  Particles.prototype.emit = function (p, v, life, size, grow, alpha, c) {
    var i = this.head; this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grow[i] = grow; this.alpha[i] = alpha;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.a0 = this.a0 || new Float32Array(this.max); this.a0[i] = alpha;
  };
  Particles.prototype.update = function (dt, gravity, drag) {
    for (var i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      var k = i * 3;
      this.vel[k + 1] -= gravity * dt;
      var dr = 1 - drag * dt;
      this.vel[k] *= dr; this.vel[k + 1] *= dr; this.vel[k + 2] *= dr;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      var t = this.life[i] / this.maxLife[i];
      this.alpha[i] = this.a0[i] * Math.min(1, t * 1.6) * Math.min(1, (1 - t) * 8 + 0.2);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true;
  };

  // =========================================================
  function build(renderer, tr, opts) {
    opts = opts || {};
    var def = tr.def, sky = SKIES[def.time], q = opts.quality || 'high';
    var scene = new THREE.Scene();
    var rnd = Tex.rng(def.id.length * 977 + 13);
    scene.fog = new THREE.FogExp2(col(sky.fog), sky.fogDensity);
    scene.background = col(sky.horizon);

    // --- 空と環境マップ ---
    var skyMat = skyMaterial(sky);
    var skyMesh = new THREE.Mesh(new THREE.SphereGeometry(18000, 48, 24), skyMat);
    skyMesh.renderOrder = -10; skyMesh.frustumCulled = false;
    scene.add(skyMesh);
    var pm = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial(sky)));
    var envRT = pm.fromScene(envScene, 0.02);
    scene.environment = envRT.texture;
    pm.dispose();

    // --- 光 ---
    var hemi = new THREE.HemisphereLight(col(sky.amb), col(sky.ground), sky.hemi);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(col(sky.sun), sky.sunI);
    var sunDir = new THREE.Vector3(sky.sunDir[0], sky.sunDir[1], sky.sunDir[2]).normalize();
    sun.castShadow = q !== 'low';
    var sres = q === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(sres, sres);
    var sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 10; sc.far = 600;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);

    // --- 素材 ---
    var aniso = renderer.capabilities.getMaxAnisotropy();
    Tex.aniso = Math.min(8, aniso);
    var grassTint = def.scenery === 'forest' ? [64, 92, 56] : def.scenery === 'park' ? [96, 112, 62] : def.scenery === 'countryside' ? [92, 100, 62] : [82, 104, 66];
    var M = {
      road: new THREE.MeshStandardMaterial({ map: Tex.asphalt(), roughnessMap: Tex.asphaltRough(), roughness: 0.92, metalness: 0.0, color: 0xffffff }),
      shoulder: new THREE.MeshStandardMaterial({ map: Tex.asphalt(), roughness: 0.95, color: 0xb0b2b4 }),
      kerb: new THREE.MeshStandardMaterial({ map: Tex.kerb(), roughness: 0.6 }),
      grass: new THREE.MeshStandardMaterial({ map: Tex.mowStripes(grassTint), roughness: 1 }),
      gravel: new THREE.MeshStandardMaterial({ map: Tex.gravel(), roughness: 1 }),
      terrain: new THREE.MeshStandardMaterial({ map: Tex.grass(grassTint), roughness: 1, vertexColors: true }),
      wall: new THREE.MeshStandardMaterial({ map: Tex.concrete('MUSOU  PROTOTYPE  RACING'), roughness: 0.85, side: THREE.DoubleSide }),
      wallTop: new THREE.MeshStandardMaterial({ color: 0xd4d6d6, roughness: 0.8 }),
      fence: new THREE.MeshStandardMaterial({ map: Tex.fence(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.5 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x8c9399, roughness: 0.4, metalness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.7 })
    };
    M.road.map.repeat.set(1, 1);
    M.grass.map.repeat.set(1, 1);
    M.fence.map.repeat.set(1, 1);
    var hw = function (i) { return tr.hw[i]; };
    var group = new THREE.Group(); scene.add(group);
    function add(g, m, shadow) { var mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; if (shadow) mesh.castShadow = true; group.add(mesh); return mesh; }

    // --- 路面 ---
    add(ribbon(tr, function (i) { return -hw(i); }, function (i) { return hw(i); }, 0.02, 0.02, def.width), M.road);
    add(ribbon(tr, function (i) { return hw(i); }, function (i) { return hw(i) + 2.2; }, 0.015, 0.0, def.width), M.shoulder);
    add(ribbon(tr, function (i) { return -hw(i) - 2.2; }, function (i) { return -hw(i); }, 0.0, 0.015, def.width), M.shoulder);
    add(ribbon(tr, function (i) { return hw(i) - 0.05; }, function (i) { return hw(i) + 1.4; }, 0.03, 0.075, 4, function (i) { return tr.kerbR[i]; }), M.kerb);
    add(ribbon(tr, function (i) { return -hw(i) - 1.4; }, function (i) { return -hw(i) + 0.05; }, 0.075, 0.03, 4, function (i) { return tr.kerbL[i]; }), M.kerb);
    var runEdgeR = function (i) { return hw(i) + tr.runR[i]; }, runEdgeL = function (i) { return -hw(i) - tr.runL[i]; };
    add(ribbon(tr, function (i) { return hw(i) + 2.2; }, runEdgeR, -0.01, -0.01, 20, function (i) { return !tr.gravelR[i]; }, 20), M.grass);
    add(ribbon(tr, runEdgeL, function (i) { return -hw(i) - 2.2; }, -0.01, -0.01, 20, function (i) { return !tr.gravelL[i]; }, 20), M.grass);
    add(ribbon(tr, function (i) { return hw(i) + 2.2; }, runEdgeR, 0.0, 0.0, 12, function (i) { return tr.gravelR[i]; }, 12), M.gravel);
    add(ribbon(tr, runEdgeL, function (i) { return -hw(i) - 2.2; }, 0.0, 0.0, 12, function (i) { return tr.gravelL[i]; }, 12), M.gravel);
    // 壁(コンクリート)+金網
    M.wall.map.repeat.set(1, 1);
    add(wall(tr, function (i) { return runEdgeR(i) + 0.3; }, -0.4, 1.0, 16, null, true), M.wall, true);
    add(wall(tr, function (i) { return runEdgeL(i) - 0.3; }, -0.4, 1.0, 16), M.wall, true);
    add(ribbon(tr, function (i) { return runEdgeR(i) + 0.3; }, function (i) { return runEdgeR(i) + 0.7; }, 1.0, 1.0, 10), M.wallTop);
    add(ribbon(tr, function (i) { return runEdgeL(i) - 0.7; }, function (i) { return runEdgeL(i) - 0.3; }, 1.0, 1.0, 10), M.wallTop);
    var fastSection = function (i) { return Math.abs(tr.k[i]) < 1 / 400; };
    add(wall(tr, function (i) { return runEdgeR(i) + 0.5; }, 1.0, 3.6, 3, fastSection), M.fence);
    add(wall(tr, function (i) { return runEdgeL(i) - 0.5; }, 1.0, 3.6, 3, fastSection), M.fence);

    // --- 地形 ---
    var b = tr.bounds, margin = 1100;
    var x0 = b.minx - margin, x1 = b.maxx + margin, y0 = b.miny - margin, y1 = b.maxy + margin;
    var area = (x1 - x0) * (y1 - y0), cell = Math.max(12, Math.sqrt(area / (q === 'low' ? 60000 : 140000)));
    var nxc = Math.ceil((x1 - x0) / cell), nyc = Math.ceil((y1 - y0) / cell);
    var amp = def.scenery === 'forest' ? 40 : def.scenery === 'fuji' ? 26 : def.scenery === 'park' ? 6 : 10;
    var nA = Tex.valueNoise(4096, 4096, 64, 7), nB = Tex.valueNoise(4096, 4096, 16, 9);
    var zf = new Float32Array((nxc + 1) * (nyc + 1)), dfield = new Float32Array((nxc + 1) * (nyc + 1)), edge = new Float32Array((nxc + 1) * (nyc + 1));
    var meanZ = 0; for (var mi = 0; mi < tr.N; mi++) meanZ += tr.z[mi]; meanZ /= tr.N;
    var gi, gj, ix;
    for (gj = 0; gj <= nyc; gj++) for (gi = 0; gi <= nxc; gi++) {
      ix = gj * (nxc + 1) + gi;
      var px = x0 + gi * cell, py = y0 + gj * cell;
      var nr = TrackGen.nearest(tr, px, py, 260);
      if (nr) {
        zf[ix] = tr.z[nr.i]; dfield[ix] = nr.d;
        var lat = (px - tr.x[nr.i]) * tr.nx[nr.i] + (py - tr.y[nr.i]) * tr.ny[nr.i];
        edge[ix] = tr.hw[nr.i] + (lat > 0 ? tr.runR[nr.i] : tr.runL[nr.i]);
      } else { zf[ix] = meanZ; dfield[ix] = 9999; edge[ix] = 20; }
    }
    // 遠くの高さはぼかしてなめらかに
    var blur = function (src, r) {
      var tmp = new Float32Array(src.length), out = new Float32Array(src.length), a, k2;
      for (gj = 0; gj <= nyc; gj++) for (gi = 0; gi <= nxc; gi++) {
        a = 0; var cnt = 0;
        for (k2 = -r; k2 <= r; k2++) { var ii = gi + k2; if (ii < 0 || ii > nxc) continue; a += src[gj * (nxc + 1) + ii]; cnt++; }
        tmp[gj * (nxc + 1) + gi] = a / cnt;
      }
      for (gj = 0; gj <= nyc; gj++) for (gi = 0; gi <= nxc; gi++) {
        a = 0; var cnt2 = 0;
        for (k2 = -r; k2 <= r; k2++) { var jj = gj + k2; if (jj < 0 || jj > nyc) continue; a += tmp[jj * (nxc + 1) + gi]; cnt2++; }
        out[gj * (nxc + 1) + gi] = a / cnt2;
      }
      return out;
    };
    var zb = blur(blur(zf, Math.ceil(90 / cell)), Math.ceil(90 / cell));
    var tpos = [], tuv = [], tcol = [], tidx = [];
    var cGrass = col('#ffffff'), cDry = col('#d8cfa8'), cDark = col('#8fa088');
    for (gj = 0; gj <= nyc; gj++) for (gi = 0; gi <= nxc; gi++) {
      ix = gj * (nxc + 1) + gi;
      var X = x0 + gi * cell, Y = y0 + gj * cell, dd = dfield[ix], ed = edge[ix];
      var far = sm(ed + 10, ed + 420, dd);
      var hills = (nA(X * 0.25 + 2048, Y * 0.25 + 2048) - 0.5) * amp * 2 + (nB(X * 0.5 + 2048, Y * 0.5 + 2048) - 0.5) * amp * 0.4;
      var zz = zf[ix] * (1 - sm(ed, ed + 160, dd)) + zb[ix] * sm(ed, ed + 160, dd);
      var h = (zz - 0.35) + hills * far + sm(ed + 2, ed + 40, dd) * 1.2;
      if (dd < ed + 1) h = zf[ix] - 0.35;
      tpos.push(X, h, -Y);
      tuv.push(X / 22, Y / 22);
      var vn = nB(X + 1000, Y + 1000);
      var cc = cGrass.clone().lerp(vn > 0.6 ? cDry : cDark, Math.abs(vn - 0.5) * 1.2 * far);
      tcol.push(cc.r, cc.g, cc.b);
    }
    for (gj = 0; gj < nyc; gj++) for (gi = 0; gi < nxc; gi++) {
      var a0 = gj * (nxc + 1) + gi, b0 = a0 + 1, c0 = a0 + nxc + 1, d0 = c0 + 1;
      tidx.push(a0, b0, c0, b0, d0, c0);
    }
    var tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tpos, 3));
    tg.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(tcol, 3));
    tg.setIndex(tidx);
    tg.computeVertexNormals();
    // 法線が上を向くように
    if (tg.getAttribute('normal').getY(0) < 0) { for (var ti = 0; ti < tidx.length; ti += 3) { var tt = tidx[ti + 1]; tidx[ti + 1] = tidx[ti + 2]; tidx[ti + 2] = tt; } tg.setIndex(tidx); tg.computeVertexNormals(); }
    var terrain = new THREE.Mesh(tg, M.terrain); terrain.receiveShadow = true; group.add(terrain);
    M.terrain.map.repeat.set(1, 1);
    function groundAt(X, Y) { // 地形の高さ(木を置くため)
      var fx = (X - x0) / cell, fy = (Y - y0) / cell, i0 = Math.floor(fx), j0 = Math.floor(fy);
      if (i0 < 0 || j0 < 0 || i0 >= nxc || j0 >= nyc) return meanZ;
      var tx = fx - i0, ty = fy - j0, p = function (i, j) { return tpos[(j * (nxc + 1) + i) * 3 + 1]; };
      return (p(i0, j0) * (1 - tx) + p(i0 + 1, j0) * tx) * (1 - ty) + (p(i0, j0 + 1) * (1 - tx) + p(i0 + 1, j0 + 1) * tx) * ty;
    }
    // 地形の外側(遠景の地面)
    var outer = new THREE.Mesh(new THREE.RingGeometry(1, 30000, 64, 1), new THREE.MeshStandardMaterial({ color: col(grassTint.map(function (v) { return v / 255; }).length ? '#' + grassTint.map(function (v) { return ('0' + Math.round(v * 0.9).toString(16)).slice(-2); }).join('') : '#55663f'), roughness: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.set((x0 + x1) / 2, meanZ - 6, -(y0 + y1) / 2);
    outer.scale.set(1, 1, 1);
    var hole = Math.max(x1 - x0, y1 - y0) * 0.45;
    outer.geometry = new THREE.RingGeometry(hole, 30000, 64, 1);
    group.add(outer);

    // --- 遠くの山(霧の向こうにうっすら)---
    var cxw = (b.minx + b.maxx) / 2, cyw = (b.miny + b.maxy) / 2;
    var hazeCol = col(sky.fog), mCol = col(sky.mountain);
    function ring(radius, hBase, hAmp, seed, mix) {
      var pos = [], cl = [], idx = [], n = 220, nz = Tex.valueNoise(4096, 64, 28, seed);
      for (var k = 0; k <= n; k++) {
        var a = k / n * Math.PI * 2, hgt = hBase + Math.pow(nz((k % n) * 18, 10), 1.6) * hAmp + nz((k % n) * 18 * 3 % 4096, 30) * hAmp * 0.15;
        var X = cxw + Math.cos(a) * radius, Y = cyw + Math.sin(a) * radius;
        pos.push(X, -200, -Y, X, hgt, -Y);
        var c1 = mCol.clone().lerp(hazeCol, mix + 0.2), c2 = mCol.clone().lerp(hazeCol, mix);
        cl.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
      }
      for (k = 0; k < n; k++) { var a2 = k * 2; idx.push(a2, a2 + 2, a2 + 1, a2 + 1, a2 + 2, a2 + 3); }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
      g.setIndex(idx);
      var mm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
      mm.renderOrder = -5;
      return mm;
    }
    var R0 = Math.max(b.maxx - b.minx, b.maxy - b.miny) * 0.5 + 6000;
    group.add(ring(R0 + 5000, 300, def.scenery === 'forest' ? 900 : 1300, 3, 0.62));
    group.add(ring(R0 + 1200, 100, def.scenery === 'park' ? 260 : 600, 5, 0.42));
    if (def.scenery === 'fuji') {
      // 富士山(雪のかぶった円すい)
      var fx = cxw + Math.cos(-0.1) * (R0 + 6000), fy = cyw + Math.sin(-0.1) * (R0 + 6000) + 2000;
      var fg = new THREE.ConeGeometry(9500, 3800, 96, 12, true);
      var fp = fg.getAttribute('position'), fc = [], fnz = Tex.valueNoise(4096, 64, 32, 21);
      for (var fi = 0; fi < fp.count; fi++) {
        var yy = fp.getY(fi) / 3800 + 0.5, ang = Math.atan2(fp.getZ(fi), fp.getX(fi));
        // すそ野をゆるく
        var rr = Math.pow(1 - yy, 1.6) * 9500 + 380 * (1 - yy);
        var rl = Math.hypot(fp.getX(fi), fp.getZ(fi)) || 1;
        if (yy < 0.999) { fp.setX(fi, fp.getX(fi) / rl * rr); fp.setZ(fi, fp.getZ(fi) / rl * rr); }
        var snowLine = 0.58 + (fnz(((ang + Math.PI) * 600) % 4096, 20) - 0.5) * 0.18;
        var cc2 = (yy > snowLine ? col('#f4f6fa') : col('#5d6c84')).lerp(hazeCol, yy > snowLine ? 0.25 : 0.42 + (1 - yy) * 0.3);
        fc.push(cc2.r, cc2.g, cc2.b);
      }
      fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
      fg.computeVertexNormals();
      var fuji = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
      fuji.position.set(fx, 3800 / 2 - 400, -fy);
      fuji.renderOrder = -4;
      group.add(fuji);
    }

    // --- 霧のかたまり(低く流れる)---
    var mistTex = Tex.soft('rgba(255,255,255,0.9)');
    var mistMat = new THREE.SpriteMaterial({ map: mistTex, color: hazeCol, transparent: true, opacity: def.time === 'overcast' ? 0.35 : 0.22, depthWrite: false, fog: true });
    for (var mk = 0; mk < 70; mk++) {
      var mx = x0 + rnd() * (x1 - x0), my = y0 + rnd() * (y1 - y0);
      var mnr = TrackGen.nearest(tr, mx, my, 120);
      if (mnr) continue;
      var sp = new THREE.Sprite(mistMat);
      var ssz = 160 + rnd() * 260;
      sp.scale.set(ssz * 2.2, ssz * 0.5, 1);
      sp.position.set(mx, groundAt(mx, my) + ssz * 0.12, -my);
      group.add(sp);
    }

    // --- 木 ---
    function treeGeo(kind) {
      if (kind === 'conifer') {
        var parts = [{ g: new THREE.CylinderGeometry(0.25, 0.35, 3, 6).translate(0, 1.5, 0), c: '#4a3a2c' }];
        for (var l = 0; l < 3; l++) parts.push({ g: new THREE.ConeGeometry(2.6 - l * 0.6, 4.2, 7).translate(0, 3.2 + l * 2.3, 0), c: '#ffffff', shade: 0.35, shadeTop: 11 });
        return merge(parts);
      }
      return merge([
        { g: new THREE.CylinderGeometry(0.25, 0.4, 3.4, 6).translate(0, 1.7, 0), c: '#4e3e30' },
        { g: new THREE.IcosahedronGeometry(3, 1).scale(1, 0.9, 1).translate(0, 5.5, 0), c: '#ffffff', shade: 0.3, shadeTop: 8.5 },
        { g: new THREE.IcosahedronGeometry(2.2, 1).translate(1.4, 6.8, 0.6), c: '#ffffff', shade: 0.2, shadeTop: 9 }
      ]);
    }
    var treeKinds = def.scenery === 'forest' ? [['conifer', 0.8], ['broad', 0.2]] : def.scenery === 'fuji' ? [['conifer', 0.5], ['broad', 0.5]] : [['broad', 0.85], ['conifer', 0.15]];
    var treeTotal = { forest: 7000, fuji: 3200, park: 3600, countryside: 2600 }[def.scenery] * (q === 'low' ? 0.4 : q === 'mid' ? 0.7 : 1);
    var leafCols = def.time === 'dusk' ? ['#3e4a34', '#4a5238', '#36402e'] : def.scenery === 'forest' ? ['#2f4a2e', '#3a5634', '#284028', '#465e3a'] : ['#4f6a3a', '#5e7a40', '#41592f', '#6b7d48'];
    treeKinds.forEach(function (tk) {
      var n = Math.floor(treeTotal * tk[1]);
      var mesh = new THREE.InstancedMesh(treeGeo(tk[0]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), n);
      mesh.castShadow = q === 'high'; mesh.receiveShadow = false;
      var mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), pv = new THREE.Vector3(), cc3 = new THREE.Color();
      var placed = 0, tries = 0;
      while (placed < n && tries < n * 8) {
        tries++;
        var X = x0 + rnd() * (x1 - x0), Y = y0 + rnd() * (y1 - y0);
        var nr2 = TrackGen.nearest(tr, X, Y, 260);
        var dense = nr2 ? 1 : 0.25;
        if (rnd() > dense) continue;
        if (nr2) {
          var lat2 = (X - tr.x[nr2.i]) * tr.nx[nr2.i] + (Y - tr.y[nr2.i]) * tr.ny[nr2.i];
          var ed2 = tr.hw[nr2.i] + (lat2 > 0 ? tr.runR[nr2.i] : tr.runL[nr2.i]);
          if (nr2.d < ed2 + 7) continue;
          var sAt = nr2.i * tr.ds;
          if ((sAt < 420 || sAt > tr.length - 520) && nr2.d < 120) continue; // 観客席のあたり
        }
        var sz = 0.8 + rnd() * 0.9;
        pv.set(X, groundAt(X, Y) - 0.3, -Y);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
        scl.set(sz, sz * (0.85 + rnd() * 0.4), sz);
        mtx.compose(pv, quat, scl);
        mesh.setMatrixAt(placed, mtx);
        cc3.set(leafCols[Math.floor(rnd() * leafCols.length)]);
        mesh.setColorAt(placed, cc3);
        placed++;
      }
      mesh.count = placed;
      group.add(mesh);
    });

    // --- メインストレート:ピット・観客席・ゲート ---
    var stCrowd = new THREE.MeshStandardMaterial({ map: Tex.crowd(), roughness: 0.9 });
    var pitMat = new THREE.MeshStandardMaterial({ map: Tex.windows(), roughness: 0.6, metalness: 0.2 });
    var roofMat = new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.5, metalness: 0.3 });
    function placeBox(sPos, lat, w, h, d, mat, yOff, rotExtra) {
      var p = TrackGen.pointAt(tr, sPos, lat);
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(p.x, p.z + (yOff || 0) + h / 2, -p.y);
      m.rotation.y = p.th + (rotExtra || 0);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m); return m;
    }
    for (var ps = -340; ps < 180; ps += 26) {
      var iA = Math.floor((((ps % tr.length) + tr.length) % tr.length) / tr.ds);
      var latR = tr.hw[iA] + tr.runR[iA] + 14;
      var pb = placeBox(ps, latR, 26, 9, 16, pitMat, -0.4);
      pb.material = [roofMat, roofMat, roofMat, roofMat, pitMat, pitMat];
      placeBox(ps, latR - 9.5, 26, 0.4, 4, roofMat, 8.4);
      var latL = -(tr.hw[iA] + tr.runL[iA] + 6);
      // 観客席:階段状
      for (var st = 0; st < 7; st++) {
        var sb = placeBox(ps, latL - 1.6 - st * 2.2, 25, 1.1 + st * 1.25, 2.2, stCrowd, -0.4);
        sb.material = [roofMat, roofMat, roofMat, roofMat, stCrowd, stCrowd];
      }
      placeBox(ps, latL - 9, 25, 0.35, 18, roofMat, 13.2);
    }
    // スタートライン(チェッカー)
    var chk = new THREE.Mesh(new THREE.PlaneGeometry(def.width, 1.6), new THREE.MeshStandardMaterial({ map: Tex.checker(), roughness: 0.8 }));
    chk.material.map.repeat.set(def.width / 8, 1);
    var p0 = TrackGen.pointAt(tr, 0, 0);
    chk.rotation.order = 'YXZ'; chk.rotation.y = p0.th + Math.PI / 2; chk.rotation.x = -Math.PI / 2;
    chk.position.set(p0.x, p0.z + 0.035, -p0.y); chk.receiveShadow = true;
    group.add(chk);
    // グリッドの白線
    var gridMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 });
    gridSlots(tr, 12).forEach(function (gs) {
      var gp = TrackGen.pointAt(tr, gs.s + 2.6, gs.lat);
      var gm = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 2.4), gridMat);
      gm.rotation.order = 'YXZ'; gm.rotation.y = gp.th; gm.rotation.x = -Math.PI / 2;
      gm.position.set(gp.x, gp.z + 0.03, -gp.y); group.add(gm);
    });
    // スタートゲートとシグナル
    var gateLat = tr.hw[0] + 1.8;
    [-1, 1].forEach(function (sd) { placeBox(4, sd * gateLat, 0.6, 8, 0.6, M.steel, 0); });
    var beam = placeBox(4, 0, 1.2, 1.4, gateLat * 2 + 0.6, M.dark, 7.2);
    var banner = new THREE.Mesh(new THREE.PlaneGeometry(gateLat * 2, 1.3), new THREE.MeshStandardMaterial({ map: Tex.adPanel('MUSOU ― PROTOTYPE RACING', '#f2f2ef', '#1a2028', '#c0242c'), roughness: 0.6 }));
    banner.position.copy(beam.position); banner.rotation.y = p0.th - Math.PI / 2; banner.translateZ(0.62); banner.translateY(-0.1);
    group.add(banner);
    var lampMats = [];
    for (var lc = 0; lc < 5; lc++) {
      var lm = new THREE.MeshBasicMaterial({ color: 0x161819 });
      lampMats.push(lm);
      for (var lr = 0; lr < 2; lr++) {
        var lamp = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), lm);
        lamp.position.copy(beam.position);
        lamp.rotation.y = p0.th - Math.PI / 2;
        lamp.translateZ(0.63); lamp.translateX((lc - 2) * 0.7); lamp.translateY(-0.95 - lr * 0.5);
        group.add(lamp);
      }
    }

    // --- 広告ブリッジ(長い直線に)---
    var bridges = [];
    (function () {
      var runs = [], cur = null;
      for (var i = 0; i < tr.N; i++) {
        var straight = Math.abs(tr.k[i]) < 1 / 900;
        if (straight) { if (!cur) cur = { a: i, n: 0 }; cur.n++; } else if (cur) { runs.push(cur); cur = null; }
      }
      if (cur) runs.push(cur);
      runs.sort(function (a, c) { return c.n - a.n; });
      runs.slice(0, def.id === 'sarthe' ? 3 : 2).forEach(function (r, k) {
        var sB = (r.a + Math.floor(r.n * (k === 0 ? 0.62 : 0.4))) * tr.ds;
        if (Math.abs(sB) < 200 || Math.abs(sB - tr.length) < 200) sB += 260;
        bridges.push(sB);
      });
    })();
    var adTexts = [['MUSOU', '#f4f4f2', '#1a2028', '#c0242c'], ['KIRI MOTORS', '#1a2028', '#f4f4f2', '#c0242c'], ['HAKUSEN OIL', '#c0242c', '#ffffff', '#1a2028']];
    bridges.forEach(function (sB, k) {
      var ib = Math.floor(sB / tr.ds) % tr.N, span = tr.hw[ib] + 4;
      [-1, 1].forEach(function (sd) { placeBox(sB, sd * span, 1, 7.5, 1.4, M.white, 0); });
      var bm = placeBox(sB, 0, 2.2, 1.8, span * 2 + 1, M.white, 6.2);
      var t = adTexts[k % adTexts.length];
      var adm = new THREE.MeshStandardMaterial({ map: Tex.adPanel(t[0], t[1], t[2], t[3]), roughness: 0.5 });
      [1, -1].forEach(function (face) {
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, 1.6), adm);
        pl.position.copy(bm.position); pl.rotation.y = bm.rotation.y + (face > 0 ? -Math.PI / 2 : Math.PI / 2);
        pl.translateZ(1.12); group.add(pl);
      });
    });

    // --- ブレーキ目安看板 ---
    var refCar = CARS[0];
    var prof = TrackGen.speedProfile(tr, refCar);
    var zones = TrackGen.brakeZones(tr, prof);
    var boardMats = { 300: new THREE.MeshStandardMaterial({ map: Tex.board('300') }), 200: new THREE.MeshStandardMaterial({ map: Tex.board('200') }), 100: new THREE.MeshStandardMaterial({ map: Tex.board('100') }) };
    zones.forEach(function (zn) {
      var io = (zn.i + 30) % tr.N, side = tr.sideOut[io] || 1;
      [[300, -200], [200, -100], [100, 0]].forEach(function (bd) {
        var sb = zn.s + bd[1];
        var ib = ((Math.floor(sb / tr.ds) % tr.N) + tr.N) % tr.N;
        var lat = side * (tr.hw[ib] + 3.2);
        var pp = TrackGen.pointAt(tr, sb, lat);
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), M.steel);
        post.position.set(pp.x, pp.z + 0.6, -pp.y); group.add(post);
        var bdm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), boardMats[bd[0]]);
        bdm.position.set(pp.x, pp.z + 1.55, -pp.y);
        bdm.rotation.y = pp.th + Math.PI / 2;
        group.add(bdm);
      });
    });

    // --- 夕暮れ:街灯 ---
    var lampLights = null;
    if (def.time === 'dusk') {
      var nL = Math.floor(tr.length / 60) * 2;
      var poleG = new THREE.CylinderGeometry(0.12, 0.16, 9, 6).translate(0, 4.5, 0);
      var headG = new THREE.BoxGeometry(1.4, 0.25, 0.5).translate(0.6, 9, 0);
      var poles = new THREE.InstancedMesh(poleG, M.steel, nL);
      var heads = new THREE.InstancedMesh(headG, new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), nL);
      var mt = new THREE.Matrix4(), qq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), pv2 = new THREE.Vector3();
      var li = 0;
      for (var ls = 0; ls < tr.length - 30; ls += 60) {
        [-1, 1].forEach(function (sd) {
          var ib = Math.floor(ls / tr.ds) % tr.N, lat = sd * (tr.hw[ib] + (sd > 0 ? tr.runR[ib] : tr.runL[ib]) + 1.6);
          var pp = TrackGen.pointAt(tr, ls, lat);
          pv2.set(pp.x, pp.z, -pp.y);
          qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pp.th + (sd > 0 ? Math.PI / 2 : -Math.PI / 2));
          mt.compose(pv2, qq, one);
          poles.setMatrixAt(li, mt); heads.setMatrixAt(li, mt); li++;
        });
      }
      poles.count = heads.count = li;
      group.add(poles); group.add(heads);
      // 光のにじみ
      var glowMat = new THREE.SpriteMaterial({ map: Tex.soft('rgba(255,220,170,1)'), color: 0xffcf90, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
      for (var gl = 0; gl < li; gl += 2) {
        var mm2 = new THREE.Matrix4(); heads.getMatrixAt(gl, mm2);
        var gp2 = new THREE.Vector3(0.6, 9, 0).applyMatrix4(mm2);
        var spr = new THREE.Sprite(glowMat); spr.position.copy(gp2); spr.scale.set(7, 7, 1); group.add(spr);
      }
    }

    // --- 光の柱(タイトル画面の演出)---
    var beams = new THREE.Group();
    var beamMat = new THREE.ShaderMaterial({
      uniforms: { col: { value: col('#cfe6ff') } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 col; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float edge = pow(abs(dot(vN, vV)), 2.0); float a = edge * smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y)) * 0.22; gl_FragColor = vec4(col, a); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    for (var bk = 0; bk < 5; bk++) {
      var ang = -0.6 + bk * 0.35 + rnd() * 0.2, dist = R0 * 0.6 + rnd() * 2500;
      var bmsh = new THREE.Mesh(new THREE.CylinderGeometry(18 + rnd() * 30, 30, 9000, 12, 1, true), beamMat);
      bmsh.position.set(cxw + Math.cos(ang) * dist, 4200, -(cyw + Math.sin(ang) * dist));
      beams.add(bmsh);
    }
    beams.visible = false;
    scene.add(beams);

    // --- TVカメラの位置 ---
    var tvCams = [];
    for (var ts = 40; ts < tr.length; ts += 280) {
      var it = Math.floor(ts / tr.ds) % tr.N, sd2 = (tvCams.length % 2) ? 1 : -1;
      var lat3 = sd2 * (tr.hw[it] + Math.min(14, sd2 > 0 ? tr.runR[it] : tr.runL[it]) + 2);
      var pc = TrackGen.pointAt(tr, ts, lat3);
      tvCams.push({ s: ts, pos: new THREE.Vector3(pc.x, pc.z + 5 + rnd() * 4, -pc.y) });
    }

    // --- タイヤ跡 ---
    var SKID = 4000;
    var skidMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.62, 0.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), SKID);
    skidMesh.count = 0; skidMesh.frustumCulled = false; skidMesh.renderOrder = 1;
    group.add(skidMesh);
    var skidHead = 0, skM = new THREE.Matrix4(), skQ = new THREE.Quaternion(), skS = new THREE.Vector3(1, 1, 1), skP = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

    // --- 粒子 ---
    var smoke = new Particles(q === 'low' ? 300 : 900, false, Tex.soft('rgba(255,255,255,0.9)'));
    var sparks = new Particles(400, true, Tex.soft('rgba(255,230,180,1)'));
    group.add(smoke.points); group.add(sparks.points);

    var world = {
      scene: scene, sun: sun, hemi: hemi, sunDir: sunDir, sky: sky, beams: beams, tvCams: tvCams, skyMesh: skyMesh,
      smoke: smoke, sparks: sparks, groundAt: groundAt,
      setStartLights: function (n, green) {
        for (var k = 0; k < 5; k++) lampMats[k].color.set(green ? 0x20ff60 : (k < n ? 0xff1a1a : 0x161819));
      },
      addSkid: function (x, y, z, th, strength) {
        skP.set(x, z + 0.04, -y);
        skQ.setFromAxisAngle(up, th);
        skS.set(1, 1, 0.6 + strength * 0.6);
        skM.compose(skP, skQ, skS);
        skidMesh.setMatrixAt(skidHead, skM);
        skidHead = (skidHead + 1) % SKID;
        skidMesh.count = Math.min(SKID, Math.max(skidMesh.count, skidHead === 0 ? SKID : skidHead));
        skidMesh.instanceMatrix.needsUpdate = true;
      },
      update: function (dt, focus, camera) {
        sun.position.copy(focus).addScaledVector(sunDir, 300);
        sun.target.position.copy(focus);
        skyMesh.position.copy(camera.position);
        smoke.mat.uniforms.scale.value = sparks.mat.uniforms.scale.value = (window.innerHeight || 800) / (2 * Math.tan(camera.fov * Math.PI / 360));
        smoke.update(dt, -0.4, 0.9);
        sparks.update(dt, 9.8, 0.5);
      },
      dispose: function () {
        scene.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); }
        });
        envRT.dispose();
      }
    };
    return world;
  }

  // スタート位置(2列の互い違い)
  function gridSlots(tr, n) {
    var out = [];
    for (var k = 0; k < n; k++) out.push({ s: -14 - k * 9, lat: (k % 2 ? 1 : -1) * Math.min(3.2, tr.hw[0] - 2.5) });
    return out;
  }

  return { build: build, gridSlots: gridSlots, V: V };
})();
