// 夜光区 — 自作の WebGL2 レンダラー
// ・街(静的メッシュ)/敵や武器(部品メッシュ)/光の粒(パーティクル)/空 を描く
// ・明るい部分をにじませる「ブルーム」と、参考画像風の「イラスト調」仕上げ
(function () {
  var M = NF.M, m4 = M.m4;
  var R = {};
  var gl;
  var MAX_LIGHTS = 24;

  // 頂点の形: 位置3 法線3 UV2 レイヤー1 色3 発光1 濡れ1 = 14 float
  var STRIDE = 14;

  // ---------------- シェーダー ----------------
  var VS_WORLD = [
    '#version 300 es',
    'layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec2 aUV;',
    'layout(location=3) in float aLayer; layout(location=4) in vec3 aCol; layout(location=5) in float aEmi; layout(location=6) in float aWet;',
    'uniform mat4 uVP, uModel;',
    'out vec3 vW; out vec3 vN; out vec2 vUV; flat out float vLayer; out vec3 vCol; out float vEmi; out float vWet;',
    'void main(){ vec4 w=uModel*vec4(aPos,1.0); vW=w.xyz; vN=mat3(uModel)*aNor; vUV=aUV; vLayer=aLayer; vCol=aCol; vEmi=aEmi; vWet=aWet; gl_Position=uVP*w; }'
  ].join('\n');

  var FS_WORLD = [
    '#version 300 es',
    'precision highp float; precision highp sampler2DArray;',
    'uniform sampler2DArray uTex;',
    'uniform vec3 uCam; uniform vec4 uTint; uniform vec3 uAmbTop, uAmbBot, uMoonDir, uMoonCol, uFogCol, uSkyRefl;',
    'uniform float uFogDen, uTime, uEmiGain, uAmbBoost, uLitMax;',
    'uniform vec4 uLPos[' + MAX_LIGHTS + ']; uniform vec4 uLCol[' + MAX_LIGHTS + ']; uniform int uNL;',
    'in vec3 vW; in vec3 vN; in vec2 vUV; flat in float vLayer; in vec3 vCol; in float vEmi; in float vWet;',
    'layout(location=0) out vec4 o;',
    'void main(){',
    '  vec4 t=texture(uTex, vec3(vUV, vLayer));',
    '  vec3 base=t.rgb*vCol*uTint.rgb;',
    '  vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;',
    '  vec3 V=normalize(uCam-vW); float dist=length(uCam-vW);',
    '  float wet = vWet>0.0 ? vWet*(0.35+0.65*t.a) : 0.0;',  // 地面ではアルファ=水たまり
    '  float emi = vWet>0.0 ? 0.0 : t.a*vEmi;',
    '  vec3 lit=mix(uAmbBot,uAmbTop,n.y*0.5+0.5)*(1.0+uAmbBoost*3.0)+uMoonCol*max(dot(n,uMoonDir),0.0)+uAmbBoost*vec3(0.5,0.48,0.55)*(0.6+0.4*max(dot(n,normalize(vec3(-0.3,0.8,0.5))),0.0));',
    '  vec3 spec=vec3(0.0); float shin=mix(24.0,260.0,wet);',
    '  for(int i=0;i<' + MAX_LIGHTS + ';i++){ if(i>=uNL) break;',
    '    vec3 L=uLPos[i].xyz-vW; float d=length(L); L/=max(d,0.001);',
    '    float a=clamp(1.0-d/uLPos[i].w,0.0,1.0); a*=a;',
    '    vec3 c=uLCol[i].rgb*uLCol[i].w*a;',
    '    lit+=c*(max(dot(n,L),0.0)*0.85+0.15);',
    '    vec3 H=normalize(L+V); spec+=c*pow(max(dot(n,H),0.0),shin)*(0.08+wet*3.0);',
    '  }',
    '  lit=min(lit,vec3(uLitMax)); spec=min(spec,vec3(uLitMax));',
    '  float fres=pow(1.0-max(dot(n,V),0.0),4.0);',
    '  vec3 col=base*lit*(1.0-wet*0.45)+spec+uSkyRefl*fres*wet*0.35+base*(emi*uEmiGain+uTint.a);',
    '  float f=1.0-exp(-dist*dist*uFogDen*uFogDen);',
    '  col=mix(col,uFogCol,clamp(f,0.0,1.0));',
    '  o=vec4(col, wet*(1.0-clamp(f,0.0,1.0)));',
    '}'
  ].join('\n');

  // パーティクル: 位置3 UV2 色4 形1
  var VS_FX = [
    '#version 300 es',
    'layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aCol; layout(location=3) in float aShape;',
    'uniform mat4 uVP; out vec2 vUV; out vec4 vCol; flat out float vShape; out float vDist; uniform vec3 uCam;',
    'void main(){ vUV=aUV; vCol=aCol; vShape=aShape; vDist=length(aPos-uCam); gl_Position=uVP*vec4(aPos,1.0); }'
  ].join('\n');
  var FS_FX = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV; in vec4 vCol; flat in float vShape; in float vDist; uniform float uFogDen; uniform float uAlphaMode;',
    'layout(location=0) out vec4 o;',
    'void main(){',
    '  vec2 p=vUV*2.0-1.0; float a;',
    '  if(vShape<0.5){ float r=length(p); a=exp(-r*r*3.5)*(1.0-smoothstep(0.85,1.0,r)); }',          // やわらかい丸
    '  else if(vShape<1.5){ a=exp(-p.y*p.y*6.0)*(1.0-smoothstep(0.7,1.0,abs(p.x))); }',             // 光の筋
    '  else if(vShape<2.5){ float r=length(p); a=exp(-pow((r-0.82)*9.0,2.0)); }',                      // 輪
    '  else if(vShape<3.5){ float r=length(p); a=1.0-smoothstep(0.7,1.0,r); }',                        // かたい丸(煙・破片)
    '  else if(vShape<4.5){ a=1.0-smoothstep(0.85,1.0,max(abs(p.x),abs(p.y))); }',                     // 四角
    '  else { float r=length(p); a=(1.0-smoothstep(0.35,0.55,r))*0.95+exp(-r*r*4.0)*0.3; }',          // 弾痕
    '  float f=exp(-vDist*vDist*uFogDen*uFogDen*0.6);',
    '  if(uAlphaMode>0.5) o=vec4(vCol.rgb, vCol.a*a*f); else o=vec4(vCol.rgb*vCol.a*a*f,0.0);',
    '}'
  ].join('\n');

  // 画面いっぱいの三角形
  var VS_FULL = [
    '#version 300 es',
    'out vec2 vUV; void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUV=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0); }'
  ].join('\n');

  var FS_SKY = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV; uniform mat4 uInvVP; uniform vec3 uCam; uniform float uTime; uniform vec3 uSkyTop, uSkyHor, uSkyGlow; uniform vec3 uBeamCol;',
    'layout(location=0) out vec4 o;',
    'float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }',
    'float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }',
    'float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n2(p); p*=2.03; a*=0.5; } return s; }',
    'void main(){',
    '  vec4 w=uInvVP*vec4(vUV*2.0-1.0,1.0,1.0); vec3 d=normalize(w.xyz/w.w-uCam);',
    '  float y=d.y;',
    '  vec3 col=mix(uSkyHor,uSkyTop,smoothstep(-0.05,0.55,y));',
    '  col+=uSkyGlow*exp(-max(y,0.0)*7.0)*0.9;',
    '  if(y>0.0){',
    '    vec2 cp=d.xz/(y+0.08)*1.6+vec2(uTime*0.01,uTime*0.004);',
    '    float c=fbm(cp); c=smoothstep(0.35,0.85,c);',
    '    col=mix(col, uSkyGlow*0.55+uSkyHor*0.4, c*0.75*exp(-y*1.6));',
    '    float st=step(0.9965,h(floor(d.xz/(y+0.2)*90.0)))*(1.0-c)*smoothstep(0.1,0.5,y);',
    '    col+=vec3(st)*0.6;',
    '    for(int i=0;i<3;i++){',          // サーチライトの光の柱
    '      float fi=float(i); float ang=uTime*(0.11+fi*0.04)+fi*2.1;',
    '      vec3 bd=normalize(vec3(sin(ang)*0.35,1.0,cos(ang)*0.35+0.2*fi-0.2));',
    '      float b=pow(max(dot(d,bd),0.0),1400.0)*0.6+pow(max(dot(d,bd),0.0),120.0)*0.05;',
    '      col+=uBeamCol*b*smoothstep(0.0,0.3,y);',
    '    }',
    '  }',
    '  o=vec4(col,0.0);',
    '}'
  ].join('\n');

  // 明るい部分の抽出
  var FS_BRIGHT = [
    '#version 300 es', 'precision highp float;',
    'in vec2 vUV; uniform sampler2D uSrc; uniform float uThresh; layout(location=0) out vec4 o;',
    'void main(){ vec3 c=texture(uSrc,vUV).rgb; float l=max(max(c.r,c.g),c.b); float k=max(l-uThresh,0.0)/max(l,0.0001); o=vec4(c*k,1.0); }'
  ].join('\n');
  // ぼかし(縮小時)
  var FS_DOWN = [
    '#version 300 es', 'precision highp float;',
    'in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uTexel; layout(location=0) out vec4 o;',
    'void main(){ vec2 t=uTexel; vec3 s=texture(uSrc,vUV).rgb*4.0;',
    ' s+=texture(uSrc,vUV+vec2(-t.x,-t.y)).rgb+texture(uSrc,vUV+vec2(t.x,-t.y)).rgb+texture(uSrc,vUV+vec2(-t.x,t.y)).rgb+texture(uSrc,vUV+vec2(t.x,t.y)).rgb;',
    ' o=vec4(s/8.0,1.0); }'
  ].join('\n');
  // ぼかし(拡大時)
  var FS_UP = [
    '#version 300 es', 'precision highp float;',
    'in vec2 vUV; uniform sampler2D uSrc; uniform vec2 uTexel; layout(location=0) out vec4 o;',
    'void main(){ vec2 t=uTexel; vec3 s=vec3(0.0);',
    ' s+=texture(uSrc,vUV+vec2(-t.x*2.0,0.0)).rgb+texture(uSrc,vUV+vec2(t.x*2.0,0.0)).rgb+texture(uSrc,vUV+vec2(0.0,-t.y*2.0)).rgb+texture(uSrc,vUV+vec2(0.0,t.y*2.0)).rgb;',
    ' s+=(texture(uSrc,vUV+vec2(-t.x,-t.y)).rgb+texture(uSrc,vUV+vec2(t.x,-t.y)).rgb+texture(uSrc,vUV+vec2(-t.x,t.y)).rgb+texture(uSrc,vUV+vec2(t.x,t.y)).rgb)*2.0;',
    ' o=vec4(s/12.0,1.0); }'
  ].join('\n');

  // 仕上げ: トーンマップ・ブルーム合成・ビネット・ダメージ・イラスト調(セピア線画)
  var FS_FINAL = [
    '#version 300 es', 'precision highp float;',
    'in vec2 vUV; uniform sampler2D uScene, uBloom, uDepth;',
    'uniform float uBloomAmt, uExposure, uTime, uDamage, uSepia, uFlash, uChroma, uLow, uSlowmo;',
    'uniform vec2 uTexel; uniform vec3 uFlashCol; uniform mat4 uInvVP, uVP; uniform vec3 uCam; uniform float uSSR;',
    'layout(location=0) out vec4 o;',
    'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }',
    'float lin(float d){ float n=0.06, f=600.0; return 2.0*n*f/(f+n-(d*2.0-1.0)*(f-n)); }',
    'float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }',
    'void main(){',
    '  vec2 uv=vUV; vec2 cc=uv-0.5;',
    '  float ca=uChroma*(0.002+dot(cc,cc)*0.012);',
    '  vec3 sc=vec3(texture(uScene,uv+cc*ca).r, texture(uScene,uv).g, texture(uScene,uv-cc*ca).b);',
    '  vec3 bl=texture(uBloom,uv).rgb;',
    '  // 濡れた地面の映りこみ(画面上で光線をたどる)',
    '  float wet=texture(uScene,uv).a;',
    '  if(wet>0.01 && uSSR>0.5){',
    '    float dz=texture(uDepth,uv).r;',
    '    vec4 wp=uInvVP*vec4(uv*2.0-1.0, dz*2.0-1.0, 1.0); wp/=wp.w;',
    '    vec3 V=normalize(wp.xyz-uCam);',
    '    float jit=h(uv*vec2(1733.0,977.0)+fract(uTime*7.0));',
    '    vec3 rf=reflect(V, vec3(0.0,1.0,0.0)); rf.xz+=(vec2(jit,h(uv.yx*311.0))-0.5)*(1.0-wet)*0.05;',
    '    vec3 acc=vec3(0.0); float hit=0.0; float stp=0.35;',
    '    vec3 p=wp.xyz+rf*stp*jit;',
    '    for(int i=0;i<28;i++){',
    '      p+=rf*stp; stp*=1.16;',
    '      vec4 cp=uVP*vec4(p,1.0); if(cp.w<=0.0) break; vec3 nd=cp.xyz/cp.w; vec2 su=nd.xy*0.5+0.5;',
    '      if(su.x<0.0||su.x>1.0||su.y<0.0||su.y>1.0) break;',
    '      float sd=texture(uDepth,su).r; float pz=nd.z*0.5+0.5;',
    '      if(pz>sd && lin(pz)-lin(sd)<stp*2.5+0.5){ acc=texture(uScene,su).rgb+texture(uBloom,su).rgb*0.5; vec2 e2=abs(su-0.5)*2.0; hit=(1.0-smoothstep(0.75,1.0,max(e2.x,e2.y)))*(1.0-float(i)/28.0); break; }',
    '    }',
    '    float fres=0.25+0.75*pow(1.0-max(dot(-V,vec3(0.0,1.0,0.0)),0.0),3.0);',
    '    sc+=acc*hit*wet*fres*0.85;',
    '  }',
    '  vec3 col=aces((sc+bl*uBloomAmt)*uExposure);',
    '  col=pow(col,vec3(1.0/1.1));',
    '  if(uSepia>0.001){',
    '    // 参考画像風: 深い茶・オリーブ・クリームの三色に塗り分け、輪郭に線を引く',
    '    float l=dot(col,vec3(0.3,0.55,0.15)); l=pow(l,0.65);',
    '    float q=floor(l*4.0+h(uv*vec2(913.0,577.0))*0.15)/3.0;',
    '    vec3 dark=vec3(0.20,0.15,0.10), mid=vec3(0.55,0.53,0.35), lite=vec3(0.86,0.83,0.58), cream=vec3(0.96,0.93,0.74);',
    '    vec3 tone= q<0.34 ? mix(dark,mid,q*3.0) : (q<0.67 ? mix(mid,lite,(q-0.34)*3.0) : mix(lite,cream,(q-0.67)*3.0));',
    '    float d0=lin(texture(uDepth,uv).r);',
    '    float e=0.0; vec2 t=uTexel*1.3;',
    '    float dl=lin(texture(uDepth,uv-vec2(t.x,0)).r), dr=lin(texture(uDepth,uv+vec2(t.x,0)).r), du=lin(texture(uDepth,uv-vec2(0,t.y)).r), dd=lin(texture(uDepth,uv+vec2(0,t.y)).r);',
    '    e=abs(dl+dr+du+dd-4.0*d0)/max(d0,0.5);',
    '    float lc=dot(texture(uScene,uv+vec2(t.x,0)).rgb-texture(uScene,uv-vec2(t.x,0)).rgb,vec3(0.33))+dot(texture(uScene,uv+vec2(0,t.y)).rgb-texture(uScene,uv-vec2(0,t.y)).rgb,vec3(0.33));',
    '    float line=clamp(smoothstep(0.08,0.25,e)+smoothstep(0.35,0.9,abs(lc))*0.6,0.0,1.0);',
    '    tone=mix(tone, vec3(0.16,0.12,0.08), line*0.85);',
    '    col=mix(col,tone,uSepia);',
    '  }',
    '  // 低体力・被弾',
    '  float vig=smoothstep(0.25,0.85,length(cc*vec2(1.25,1.0)));',
    '  col*=1.0-vig*0.45;',
    '  col=mix(col, vec3(0.75,0.05,0.04), vig*clamp(uDamage,0.0,1.0)*0.8);',
    '  col=mix(col, col*vec3(1.0,0.75,0.75), uLow*(0.5+0.5*sin(uTime*6.0))*vig);',
    '  // スローモーション中は色を少し抜く',
    '  float g=dot(col,vec3(0.33)); col=mix(col, vec3(g)*vec3(0.9,1.0,1.08), uSlowmo*0.55);',
    '  col+=uFlashCol*uFlash;',
    '  col+=(h(uv*vec2(1920.0,1080.0)+fract(uTime))-0.5)*0.035;',
    '  o=vec4(col,1.0);',
    '}'
  ].join('\n');

  function compile(vs, fs, name) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(name + ': ' + gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(name + ': ' + gl.getProgramInfoLog(p));
    var u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i);
      var nm = info.name.replace(/\[0\]$/, '');
      u[nm] = gl.getUniformLocation(p, info.name);
    }
    return { p: p, u: u };
  }

  // ---------------- 描画先(フレームバッファ)----------------
  function makeTarget(w, h, float, withDepth) {
    var t = { w: w, h: h };
    t.fb = gl.createFramebuffer();
    t.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    if (withDepth) {
      t.depth = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t.depth);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t.depth, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return t;
  }
  function freeTarget(t) {
    if (!t) return;
    gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); if (t.depth) gl.deleteTexture(t.depth);
  }

  // ---------------- メッシュ ----------------
  // 頂点配列(Float32Array)と添字から VAO を作る
  R.createMesh = function (verts, idx, dynamic) {
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    var sizes = [3, 3, 2, 1, 3, 1, 1], off = 0;
    for (var i = 0; i < sizes.length; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, sizes[i], gl.FLOAT, false, STRIDE * 4, off * 4);
      off += sizes[i];
    }
    var ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    var big = verts.length / STRIDE > 65535;
    var ia = big ? new Uint32Array(idx) : new Uint16Array(idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ia, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao: vao, vb: vb, ib: ib, count: idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
  };
  R.freeMesh = function (m) {
    if (!m) return;
    gl.deleteVertexArray(m.vao); gl.deleteBuffer(m.vb); gl.deleteBuffer(m.ib);
  };

  // メッシュを組み立てる道具
  R.Builder = function () {
    this.v = []; this.i = []; this.n = 0;
  };
  R.Builder.prototype.quad = function (p0, p1, p2, p3, nrm, uv0, uv1, o) {
    // p0→p1→p2→p3 は反時計まわり。uv0=(u0,v0) uv1=(u1,v1)
    var v = this.v, L = o.layer || 0, c = o.col || [1, 1, 1], e = o.emi || 0, w = o.wet || 0;
    var uvs = [[uv0[0], uv0[1]], [uv1[0], uv0[1]], [uv1[0], uv1[1]], [uv0[0], uv1[1]]];
    var ps = [p0, p1, p2, p3];
    for (var k = 0; k < 4; k++) {
      v.push(ps[k][0], ps[k][1], ps[k][2], nrm[0], nrm[1], nrm[2], uvs[k][0], uvs[k][1], L, c[0], c[1], c[2], e, w);
    }
    var n = this.n;
    this.i.push(n, n + 1, n + 2, n, n + 2, n + 3);
    this.n += 4;
  };
  // 箱。o.uv = テクスチャ1枚あたりの大きさ(m)。o.faces で面ごとの上書き
  R.Builder.prototype.box = function (x0, y0, z0, x1, y1, z1, o) {
    o = o || {};
    var tw = o.uv || 0, faces = o.faces || {};
    var sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    function uvr(a, b) { return tw ? [a / tw, b / tw] : [1, 1]; }
    var self = this;
    function face(name, p0, p1, p2, p3, n, w, h) {
      if (o.skip && o.skip.indexOf(name) >= 0) return;
      var fo = faces[name] ? Object.assign({}, o, faces[name]) : o;
      var tw2 = fo.uv || 0;
      var u1 = fo.uvRect ? fo.uvRect : null;
      if (u1) self.quad(p0, p1, p2, p3, n, [u1[0], u1[1]], [u1[2], u1[3]], fo);
      else {
        var r = tw2 ? [w / tw2, h / (fo.uvH || tw2)] : [1, 1];
        var off = fo.uvOff || [0, 0];
        self.quad(p0, p1, p2, p3, n, [off[0], off[1]], [off[0] + r[0], off[1] + r[1]], fo);
      }
    }
    face('pz', [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], sx, sy);
    face('nz', [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], sx, sy);
    face('px', [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], sz, sy);
    face('nx', [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], sz, sy);
    face('py', [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], sx, sz);
    face('ny', [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], sx, sz);
    void uvr;
  };
  // 平面(上向き)
  R.Builder.prototype.floor = function (x0, z0, x1, z1, y, o) {
    var tw = o.uv || 1, off = o.uvOff || [0, 0];
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [off[0] + x0 / tw, off[1] + z1 / tw], [off[0] + x1 / tw, off[1] + z0 / tw], o);
  };
  // 縦の板(看板など)。中心 c、幅 w、高さ h、向き nrm(水平)
  R.Builder.prototype.panel = function (c, w, h, nrm, o) {
    var rx = -nrm[2], rz = nrm[0];
    var hw = w / 2, hh = h / 2;
    var r = o.uvRect || [0, 0, 1, 1];
    this.quad([c[0] - rx * hw, c[1] - hh, c[2] - rz * hw], [c[0] + rx * hw, c[1] - hh, c[2] + rz * hw],
      [c[0] + rx * hw, c[1] + hh, c[2] + rz * hw], [c[0] - rx * hw, c[1] + hh, c[2] - rz * hw], nrm, [r[0], r[1]], [r[2], r[3]], o);
  };
  R.Builder.prototype.build = function () {
    return R.createMesh(new Float32Array(this.v), this.i);
  };

  // 部品用の単位メッシュ
  function unitCube() { var b = new R.Builder(); b.box(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5, {}); return b.build(); }
  function unitSphere(seg, ring) {
    var v = [], idx = [];
    for (var r = 0; r <= ring; r++) {
      var th = r / ring * Math.PI;
      for (var s = 0; s <= seg; s++) {
        var ph = s / seg * Math.PI * 2;
        var x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
        v.push(x * 0.5, y * 0.5, z * 0.5, x, y, z, s / seg, r / ring, 0, 1, 1, 1, 0, 0);
      }
    }
    for (r = 0; r < ring; r++) for (s = 0; s < seg; s++) {
      var a = r * (seg + 1) + s, b = a + seg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    return R.createMesh(new Float32Array(v), idx);
  }
  function unitCyl(seg, topR) {
    // Y 方向に長さ1、半径0.5(上の半径 topR*0.5)
    var v = [], idx = [], n = 0;
    topR = topR === undefined ? 1 : topR;
    for (var s = 0; s <= seg; s++) {
      var ph = s / seg * Math.PI * 2, cx = Math.cos(ph), cz = Math.sin(ph);
      v.push(cx * 0.5, -0.5, cz * 0.5, cx, 0, cz, s / seg, 0, 0, 1, 1, 1, 0, 0);
      v.push(cx * 0.5 * topR, 0.5, cz * 0.5 * topR, cx, 0, cz, s / seg, 1, 0, 1, 1, 1, 0, 0);
    }
    for (s = 0; s < seg; s++) { var a = s * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    n = (seg + 1) * 2;
    // ふた
    for (var cap = 0; cap < 2; cap++) {
      var yy = cap ? 0.5 : -0.5, ny = cap ? 1 : -1, rr = cap ? topR : 1;
      var c0 = n; v.push(0, yy, 0, 0, ny, 0, 0.5, 0.5, 0, 1, 1, 1, 0, 0); n++;
      for (s = 0; s <= seg; s++) {
        ph = s / seg * Math.PI * 2;
        v.push(Math.cos(ph) * 0.5 * rr, yy, Math.sin(ph) * 0.5 * rr, 0, ny, 0, 0.5, 0.5, 0, 1, 1, 1, 0, 0); n++;
      }
      for (s = 0; s < seg; s++) { if (cap) idx.push(c0, c0 + 2 + s, c0 + 1 + s); else idx.push(c0, c0 + 1 + s, c0 + 2 + s); }
    }
    return R.createMesh(new Float32Array(v), idx);
  }

  // ---------------- テクスチャ(配列テクスチャ)----------------
  R.setTextures = function (canvases) {
    var size = canvases[0].width;
    if (R.texArr) gl.deleteTexture(R.texArr);
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, size, size, canvases.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (var i = 0; i < canvases.length; i++) {
      var px = canvases[i].data || canvases[i].getContext('2d').getImageData(0, 0, size, size).data;
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, size, size, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(px.buffer, px.byteOffset, px.byteLength));
    }
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    var ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    R.texArr = t;
  };

  // ---------------- パーティクル ----------------
  var FX_STRIDE = 10, FX_MAX = 12000;
  function FxBatch() {
    this.data = new Float32Array(FX_MAX * 4 * FX_STRIDE);
    this.count = 0;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    var sizes = [3, 2, 4, 1], off = 0;
    for (var i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, sizes[i], gl.FLOAT, false, FX_STRIDE * 4, off * 4);
      off += sizes[i];
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.fxIndex);
    gl.bindVertexArray(null);
  }
  FxBatch.prototype.push = function (a, b, c, d, col, shape) {
    if (this.count >= FX_MAX) return;
    var o = this.count * 4 * FX_STRIDE, D = this.data;
    var ps = [a, b, c, d], uv = [0, 0, 1, 0, 1, 1, 0, 1];
    for (var k = 0; k < 4; k++) {
      D[o++] = ps[k][0]; D[o++] = ps[k][1]; D[o++] = ps[k][2];
      D[o++] = uv[k * 2]; D[o++] = uv[k * 2 + 1];
      D[o++] = col[0]; D[o++] = col[1]; D[o++] = col[2]; D[o++] = col[3];
      D[o++] = shape;
    }
    this.count++;
  };
  // 画面を向いた四角
  FxBatch.prototype.sprite = function (p, size, col, shape, rot) {
    var r = R.camRight, u = R.camUp, s = size / 2;
    var rx = r[0], ry = r[1], rz = r[2], ux = u[0], uy = u[1], uz = u[2];
    if (rot) {
      var c = Math.cos(rot), sn = Math.sin(rot);
      var nrx = rx * c + ux * sn, nry = ry * c + uy * sn, nrz = rz * c + uz * sn;
      ux = ux * c - rx * sn; uy = uy * c - ry * sn; uz = uz * c - rz * sn;
      rx = nrx; ry = nry; rz = nrz;
    }
    this.push([p[0] - rx * s - ux * s, p[1] - ry * s - uy * s, p[2] - rz * s - uz * s],
      [p[0] + rx * s - ux * s, p[1] + ry * s - uy * s, p[2] + rz * s - uz * s],
      [p[0] + rx * s + ux * s, p[1] + ry * s + uy * s, p[2] + rz * s + uz * s],
      [p[0] - rx * s + ux * s, p[1] - ry * s + uy * s, p[2] - rz * s + uz * s], col, shape === undefined ? 0 : shape);
  };
  // a→b の光の筋(カメラ向きの帯)
  FxBatch.prototype.streak = function (a, b, width, col) {
    var d = M.sub(b, a), cam = R.camPos;
    var mid = M.mul(M.add(a, b), 0.5);
    var side = M.norm(M.cross(d, M.sub(cam, mid)));
    var w = width / 2;
    this.push(M.madd(a, side, -w), M.madd(b, side, -w), M.madd(b, side, w), M.madd(a, side, w), col, 1);
  };
  // 法線 n の面にはり付く四角(弾痕・衝撃波)
  FxBatch.prototype.decal = function (p, n, size, col, shape) {
    var up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    var t = M.norm(M.cross(up, n)), b = M.cross(n, t), s = size / 2;
    var q = M.madd(p, n, 0.02);
    this.push(M.add(q, M.add(M.mul(t, -s), M.mul(b, -s))), M.add(q, M.add(M.mul(t, s), M.mul(b, -s))),
      M.add(q, M.add(M.mul(t, s), M.mul(b, s))), M.add(q, M.add(M.mul(t, -s), M.mul(b, s))), col, shape);
  };
  FxBatch.prototype.flush = function () {
    if (!this.count) return;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * 4 * FX_STRIDE);
    gl.drawElements(gl.TRIANGLES, this.count * 6, gl.UNSIGNED_INT, 0);
    this.count = 0;
  };

  // ---------------- 初期化 ----------------
  R.init = function (canvas) {
    R.canvas = canvas;
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    if (!gl) return false;
    R.gl = gl;
    R.floatOK = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    R.progWorld = compile(VS_WORLD, FS_WORLD, 'world');
    R.progFx = compile(VS_FX, FS_FX, 'fx');
    R.progSky = compile(VS_FULL, FS_SKY, 'sky');
    R.progBright = compile(VS_FULL, FS_BRIGHT, 'bright');
    R.progDown = compile(VS_FULL, FS_DOWN, 'down');
    R.progUp = compile(VS_FULL, FS_UP, 'up');
    R.progFinal = compile(VS_FULL, FS_FINAL, 'final');
    R.emptyVao = gl.createVertexArray();
    // パーティクルの添字(共通)
    var idx = new Uint32Array(FX_MAX * 6);
    for (var i = 0; i < FX_MAX; i++) { idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); }
    R.fxIndex = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, R.fxIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    R.fxAdd = new FxBatch();
    R.fxAlpha = new FxBatch();
    R.fxView = new FxBatch(); // 武器の手前(マズルフラッシュ)
    R.cube = unitCube();
    R.sphere = unitSphere(14, 10);
    R.cyl = unitCyl(14, 1);
    R.cone = unitCyl(14, 0.02);
    R.camPos = [0, 0, 0]; R.camRight = [1, 0, 0]; R.camUp = [0, 1, 0]; R.camFwd = [0, 0, -1];
    R.vp = m4.create(); R.proj = m4.create(); R.view = m4.create(); R.invVP = m4.create();
    R.vpView = m4.create();
    R.scale = 1;
    R.lightPos = new Float32Array(MAX_LIGHTS * 4);
    R.lightCol = new Float32Array(MAX_LIGHTS * 4);
    R.nLights = 0;
    R.maxLights = MAX_LIGHTS;
    R.env = {
      ambTop: [0.16, 0.15, 0.24], ambBot: [0.07, 0.05, 0.08], moonDir: M.norm([0.3, 0.8, 0.4]), moonCol: [0.06, 0.07, 0.12],
      fogCol: [0.11, 0.07, 0.15], fogDen: 0.012, skyTop: [0.01, 0.01, 0.04], skyHor: [0.18, 0.06, 0.20], skyGlow: [0.55, 0.12, 0.35],
      beam: [0.25, 0.35, 0.5], skyRefl: [0.35, 0.15, 0.4], emiGain: 1.5
    };
    R.post = { bloom: 0.9, exposure: 1.0, damage: 0, sepia: 0, flash: 0, flashCol: [1, 1, 1], chroma: 1, low: 0, slowmo: 0 };
    R.resize();
    return true;
  };

  R.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2) * R.scale;
    var w = Math.max(2, Math.floor(R.canvas.clientWidth * dpr)), h = Math.max(2, Math.floor(R.canvas.clientHeight * dpr));
    if (R.W === w && R.H === h) return;
    R.canvas.width = w; R.canvas.height = h; R.W = w; R.H = h;
    freeTarget(R.scene);
    R.scene = makeTarget(w, h, R.floatOK, true);
    if (R.blur) R.blur.forEach(freeTarget);
    R.blur = [];
    var bw = w, bh = h;
    for (var i = 0; i < 5; i++) {
      bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1);
      R.blur.push(makeTarget(bw, bh, R.floatOK, false));
    }
  };

  R.setCamera = function (pos, yaw, pitch, roll, fov, near, far) {
    R.fov = fov;
    m4.perspective(R.proj, fov, R.W / R.H, near || 0.06, far || 600);
    m4.view(R.view, pos, yaw, pitch, roll);
    m4.mul(R.vp, R.proj, R.view);
    m4.invert(R.invVP, R.vp);
    R.camPos = pos.slice();
    var w = m4.compose(new Float32Array(16), 0, 0, 0, pitch, yaw, roll || 0, 1, 1, 1);
    R.camRight = [w[0], w[1], w[2]]; R.camUp = [w[4], w[5], w[6]]; R.camFwd = [-w[8], -w[9], -w[10]];
    R.camMatrix = w;
  };
  // 武器を描くための別カメラ(視野角を固定して壁にめりこまないように)
  R.setViewCamera = function (fov) {
    var p = m4.perspective(new Float32Array(16), fov, R.W / R.H, 0.01, 50);
    m4.mul(R.vpView, p, R.view);
  };

  // 光源をセット(近い順に MAX_LIGHTS 個まで)
  R.setLights = function (list) {
    var n = Math.min(list.length, R.maxLights);
    for (var i = 0; i < n; i++) {
      var L = list[i];
      R.lightPos[i * 4] = L.p[0]; R.lightPos[i * 4 + 1] = L.p[1]; R.lightPos[i * 4 + 2] = L.p[2]; R.lightPos[i * 4 + 3] = L.r;
      R.lightCol[i * 4] = L.c[0]; R.lightCol[i * 4 + 1] = L.c[1]; R.lightCol[i * 4 + 2] = L.c[2]; R.lightCol[i * 4 + 3] = L.i;
    }
    R.nLights = n;
  };

  function useWorld(vp, cam) {
    var P = R.progWorld, u = P.u, e = R.env;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform3fv(u.uCam, cam);
    gl.uniform3fv(u.uAmbTop, e.ambTop); gl.uniform3fv(u.uAmbBot, e.ambBot);
    gl.uniform3fv(u.uMoonDir, e.moonDir); gl.uniform3fv(u.uMoonCol, e.moonCol);
    gl.uniform3fv(u.uFogCol, e.fogCol); gl.uniform1f(u.uFogDen, e.fogDen);
    gl.uniform3fv(u.uSkyRefl, e.skyRefl);
    gl.uniform1f(u.uTime, R.time || 0); gl.uniform1f(u.uEmiGain, e.emiGain);
    gl.uniform4fv(u.uLPos, R.lightPos); gl.uniform4fv(u.uLCol, R.lightCol);
    gl.uniform1i(u.uNL, R.nLights);
    gl.uniform1f(u.uAmbBoost, 0); gl.uniform1f(u.uLitMax, 100.0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.texArr);
    gl.uniform1i(u.uTex, 0);
  }
  var IDENT = m4.create(), WHITE = [1, 1, 1, 0];
  function drawMesh(mesh, model, tint) {
    var u = R.progWorld.u;
    gl.uniformMatrix4fv(u.uModel, false, model || IDENT);
    gl.uniform4fv(u.uTint, tint || WHITE);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
  }

  function fullscreen(prog, target) {
    if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, target.w, target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, R.W, R.H); }
    gl.useProgram(prog.p);
    gl.bindVertexArray(R.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function bindTex(prog, name, unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.u[name], unit);
  }

  // 1フレームを描く
  // frame = { statics:[mesh], parts:[{mesh, m, tint}], viewParts:[{mesh,m,tint}], fxHook(fxAdd, fxAlpha), time }
  R.render = function (frame) {
    R.time = frame.time;
    var e = R.env;
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.scene.fb);
    gl.viewport(0, 0, R.W, R.H);
    gl.depthMask(true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 空
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    var S = R.progSky;
    gl.useProgram(S.p);
    gl.uniformMatrix4fv(S.u.uInvVP, false, R.invVP);
    gl.uniform3fv(S.u.uCam, R.camPos);
    gl.uniform1f(S.u.uTime, frame.time);
    gl.uniform3fv(S.u.uSkyTop, e.skyTop); gl.uniform3fv(S.u.uSkyHor, e.skyHor); gl.uniform3fv(S.u.uSkyGlow, e.skyGlow);
    gl.uniform3fv(S.u.uBeamCol, e.beam);
    gl.bindVertexArray(R.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 街
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    useWorld(R.vp, R.camPos);
    var i;
    for (i = 0; i < frame.statics.length; i++) drawMesh(frame.statics[i]);
    gl.disable(gl.CULL_FACE);
    for (i = 0; i < frame.parts.length; i++) { var p = frame.parts[i]; drawMesh(p.mesh, p.m, p.tint); }

    // 光の粒
    if (frame.fxHook) frame.fxHook(R.fxAdd, R.fxAlpha, R.fxView);
    var F = R.progFx;
    gl.useProgram(F.p);
    gl.uniformMatrix4fv(F.u.uVP, false, R.vp);
    gl.uniform3fv(F.u.uCam, R.camPos);
    gl.uniform1f(F.u.uFogDen, e.fogDen);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.uniform1f(F.u.uAlphaMode, 1);
    R.fxAlpha.flush();
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    gl.uniform1f(F.u.uAlphaMode, 0);
    R.fxAdd.flush();
    gl.disable(gl.BLEND);
    gl.depthMask(true);

    // 手に持った武器
    if (frame.viewParts && frame.viewParts.length) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      useWorld(R.vpView, R.camPos);
      gl.uniform1f(R.progWorld.u.uFogDen, 0);
      gl.uniform1f(R.progWorld.u.uAmbBoost, 0.22); gl.uniform1f(R.progWorld.u.uLitMax, 1.6);
      for (i = 0; i < frame.viewParts.length; i++) { var q = frame.viewParts[i]; drawMesh(q.mesh, q.m, q.tint); }
      if (R.fxView.count) {
        gl.useProgram(F.p);
        gl.uniformMatrix4fv(F.u.uVP, false, R.vpView);
        gl.uniform3fv(F.u.uCam, R.camPos);
        gl.uniform1f(F.u.uFogDen, 0);
        gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
        gl.uniform1f(F.u.uAlphaMode, 0);
        R.fxView.flush();
        gl.disable(gl.BLEND); gl.depthMask(true);
      }
    }
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);

    // ブルーム
    var P = R.post;
    var B = R.progBright;
    gl.useProgram(B.p);
    bindTex(B, 'uSrc', 0, R.scene.tex);
    gl.uniform1f(B.u.uThresh, 0.9);
    fullscreen(B, R.blur[0]);
    var D = R.progDown;
    for (i = 1; i < R.blur.length; i++) {
      gl.useProgram(D.p);
      bindTex(D, 'uSrc', 0, R.blur[i - 1].tex);
      gl.uniform2f(D.u.uTexel, 1 / R.blur[i - 1].w, 1 / R.blur[i - 1].h);
      fullscreen(D, R.blur[i]);
    }
    var U = R.progUp;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (i = R.blur.length - 1; i > 0; i--) {
      gl.useProgram(U.p);
      bindTex(U, 'uSrc', 0, R.blur[i].tex);
      gl.uniform2f(U.u.uTexel, 1 / R.blur[i].w, 1 / R.blur[i].h);
      fullscreen(U, R.blur[i - 1]);
    }
    gl.disable(gl.BLEND);

    var Fi = R.progFinal;
    gl.useProgram(Fi.p);
    bindTex(Fi, 'uScene', 0, R.scene.tex);
    bindTex(Fi, 'uBloom', 1, R.blur[0].tex);
    bindTex(Fi, 'uDepth', 2, R.scene.depth);
    gl.uniform1f(Fi.u.uBloomAmt, P.bloom); gl.uniform1f(Fi.u.uExposure, P.exposure);
    gl.uniform1f(Fi.u.uTime, frame.time); gl.uniform1f(Fi.u.uDamage, P.damage);
    gl.uniform1f(Fi.u.uSepia, P.sepia); gl.uniform1f(Fi.u.uFlash, P.flash);
    gl.uniform3fv(Fi.u.uFlashCol, P.flashCol);
    gl.uniform1f(Fi.u.uChroma, P.chroma); gl.uniform1f(Fi.u.uLow, P.low); gl.uniform1f(Fi.u.uSlowmo, P.slowmo);
    gl.uniform2f(Fi.u.uTexel, 1 / R.W, 1 / R.H);
    gl.uniformMatrix4fv(Fi.u.uInvVP, false, R.invVP); gl.uniformMatrix4fv(Fi.u.uVP, false, R.vp);
    gl.uniform3fv(Fi.u.uCam, R.camPos); gl.uniform1f(Fi.u.uSSR, R.ssr === false ? 0 : 1);
    fullscreen(Fi, null);
    gl.activeTexture(gl.TEXTURE0);
  };

  NF.R = R;
})();
