// 夜光区 — 絵の具箱(テクスチャをその場で描く)
// 画像ファイルは使わず、canvas に描いてから GPU に送る。
// 透明度(アルファ)は「光っている度合い」として使う(地面だけは「水たまり」)
(function () {
  var M = NF.M;
  var SIZE = 512;
  var T = {};
  var L = {};
  var list = [], data = [];
  var FONT = '"Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP","IPAGothic","WenQuanYi Zen Hei",sans-serif';

  function layer(name) {
    var c = document.createElement('canvas');
    c.width = c.height = SIZE;
    var g = c.getContext('2d', { willReadFrequently: true });
    L[name] = list.length;
    list.push(c);
    return g;
  }
  // アルファを別に描くための仕組み: 色は g に、光る場所は mask に描いて最後に合成
  function withMask(g, drawColor, drawMask) {
    drawColor(g);
    var m = document.createElement('canvas'); m.width = m.height = SIZE;
    var mg = m.getContext('2d', { willReadFrequently: true });
    mg.fillStyle = '#000'; mg.fillRect(0, 0, SIZE, SIZE);
    drawMask(mg);
    var cd = g.getImageData(0, 0, SIZE, SIZE), md = mg.getImageData(0, 0, SIZE, SIZE);
    for (var i = 0; i < cd.data.length; i += 4) cd.data[i + 3] = md.data[i];
    // canvas に戻すと透明な所の色が消えるので、データのまま取っておく
    data[list.indexOf(g.canvas)] = cd.data;
  }
  function noise(g, rnd, amt, alpha) {
    var d = g.getImageData(0, 0, SIZE, SIZE);
    for (var i = 0; i < d.data.length; i += 4) {
      var n = (rnd() - 0.5) * amt;
      d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
      if (alpha !== undefined) d.data[i + 3] = alpha;
    }
    g.putImageData(d, 0, 0);
  }
  function stains(g, rnd, n, col) {
    for (var i = 0; i < n; i++) {
      var x = rnd() * SIZE, y = rnd() * SIZE, r = 10 + rnd() * 60;
      var gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  // 雨だれの筋
  function streaks(g, rnd, n) {
    for (var i = 0; i < n; i++) {
      var x = rnd() * SIZE, y = rnd() * SIZE * 0.6, h = 40 + rnd() * 200;
      var gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x, y, 1 + rnd() * 3, h);
    }
  }

  // 水たまりのマスク(ぼんやりした塊 → くっきり)。cover が大きいほど広い
  function puddles(m, rnd, count, cover) {
    m.fillStyle = '#000'; m.fillRect(0, 0, SIZE, SIZE);
    for (var i = 0; i < count; i++) {
      var x = rnd() * SIZE, y = rnd() * SIZE, r = 15 + rnd() * 70;
      for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
        var gr = m.createRadialGradient(x + ox * SIZE, y + oy * SIZE, 0, x + ox * SIZE, y + oy * SIZE, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        m.fillStyle = gr; m.fillRect(x + ox * SIZE - r, y + oy * SIZE - r, r * 2, r * 2);
      }
    }
    var d = m.getImageData(0, 0, SIZE, SIZE);
    for (var k = 0; k < d.data.length; k += 4) {
      var v = d.data[k] / 255 + (rnd() - 0.5) * 0.06;
      v = M.smooth((v - (0.6 - cover)) / 0.16);
      d.data[k] = d.data[k + 1] = d.data[k + 2] = Math.floor(v * 255);
    }
    m.putImageData(d, 0, 0);
  }

  T.build = function () {
    var rnd = M.rng(1234);
    var g;

    // 0: 白(光らない)
    g = layer('white'); g.fillStyle = '#fff'; g.fillRect(0, 0, SIZE, SIZE);
    withMask(g, function () {}, function () {});
    // 1: 白(全部光る)
    g = layer('glow'); g.fillStyle = '#fff'; g.fillRect(0, 0, SIZE, SIZE);
    withMask(g, function () {}, function (m) { m.fillStyle = '#fff'; m.fillRect(0, 0, SIZE, SIZE); });

    // 2: アスファルト(アルファ=水たまり)
    g = layer('asphalt');
    withMask(g, function (g) {
      g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, SIZE, SIZE);
      noise(g, rnd, 40);
      stains(g, rnd, 30, 'rgba(10,10,14,0.5)');
      g.strokeStyle = 'rgba(15,15,18,0.8)'; g.lineWidth = 2;
      for (var i = 0; i < 12; i++) { // ひび
        g.beginPath(); var x = rnd() * SIZE, y = rnd() * SIZE; g.moveTo(x, y);
        for (var k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); }
        g.stroke();
      }
      g.fillStyle = 'rgba(60,60,64,0.6)'; // マンホール
      g.beginPath(); g.arc(380, 120, 40, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,20,20,0.9)'; g.lineWidth = 3;
      for (var r = 12; r < 40; r += 8) { g.beginPath(); g.arc(380, 120, r, 0, Math.PI * 2); g.stroke(); }
    }, function (m) {
      puddles(m, rnd, 70, 0.18);
    });

    // 3: 歩道タイル
    g = layer('sidewalk');
    withMask(g, function (g) {
      g.fillStyle = '#3a3a40'; g.fillRect(0, 0, SIZE, SIZE);
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
        var v = 52 + rnd() * 18;
        g.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 6) + ')';
        g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      }
      noise(g, rnd, 25);
      stains(g, rnd, 14, 'rgba(10,10,14,0.4)');
    }, function (m) { puddles(m, rnd, 30, 0.02); });

    // 4: コンクリート(屋上・壁)
    g = layer('concrete');
    withMask(g, function (g) {
      g.fillStyle = '#46444a'; g.fillRect(0, 0, SIZE, SIZE);
      noise(g, rnd, 30);
      stains(g, rnd, 20, 'rgba(20,18,22,0.35)');
      g.strokeStyle = 'rgba(25,25,28,0.7)'; g.lineWidth = 2;
      for (var i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(SIZE, i * 128); g.stroke(); }
      streaks(g, rnd, 30);
    }, function () {});

    // 5〜10: ビルの壁(窓が光る)
    var winPal = [[255, 205, 140], [150, 215, 255], [255, 120, 200], [180, 255, 220], [255, 235, 200], [255, 160, 90]];
    function facade(name, opt) {
      g = layer(name);
      var lit = [];
      withMask(g, function (g) {
        g.fillStyle = opt.wall; g.fillRect(0, 0, SIZE, SIZE);
        noise(g, rnd, 22);
        var cols = opt.cols, rows = opt.rows, cw = SIZE / cols, rh = SIZE / rows;
        for (var r = 0; r < rows; r++) {
          if (opt.band) { g.fillStyle = opt.band; g.fillRect(0, r * rh + rh - 6, SIZE, 6); }
          for (var c = 0; c < cols; c++) {
            var x = c * cw + cw * opt.mx, y = r * rh + rh * opt.my, w = cw * (1 - opt.mx * 2), h = rh * (1 - opt.my * 2);
            var on = rnd() < opt.lit;
            var pc = winPal[Math.floor(rnd() * (opt.warm ? 2 : winPal.length))];
            if (opt.warm && rnd() < 0.25) pc = winPal[4];
            var k = 0.55 + rnd() * 0.45;
            if (on) {
              g.fillStyle = 'rgb(' + Math.floor(pc[0] * k) + ',' + Math.floor(pc[1] * k) + ',' + Math.floor(pc[2] * k) + ')';
              g.fillRect(x, y, w, h);
              if (rnd() < 0.5) { // ブラインド
                g.fillStyle = 'rgba(0,0,0,0.35)';
                for (var b = 0; b < h; b += 5) g.fillRect(x, y + b, w, 2);
              }
              if (rnd() < 0.3) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x + w * rnd() * 0.6, y + h * 0.3, w * 0.25, h * 0.7); } // 人影
              lit.push([x, y, w, h, 0.55 + rnd() * 0.45]);
            } else {
              g.fillStyle = 'rgb(' + (14 + rnd() * 10) + ',' + (16 + rnd() * 10) + ',' + (24 + rnd() * 12) + ')';
              g.fillRect(x, y, w, h);
              g.fillStyle = 'rgba(120,140,190,0.10)'; g.fillRect(x, y, w * 0.4, h); // 映りこみ
            }
            g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
            if (opt.ac && rnd() < 0.18) { // 室外機
              g.fillStyle = '#5d5f62'; g.fillRect(x + w * 0.1, y + h + 2, w * 0.5, rh * opt.my * 1.6);
              g.strokeStyle = '#2b2b2e'; g.strokeRect(x + w * 0.1, y + h + 2, w * 0.5, rh * opt.my * 1.6);
            }
          }
        }
        if (opt.strip) { // ネオンの帯
          g.fillStyle = opt.strip; g.fillRect(0, 0, 10, SIZE); g.fillRect(SIZE - 10, 0, 10, SIZE);
        }
        streaks(g, rnd, 40);
      }, function (m) {
        for (var i = 0; i < lit.length; i++) {
          var q = lit[i], v = Math.floor(q[4] * 255);
          m.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; m.fillRect(q[0], q[1], q[2], q[3]);
        }
        if (opt.strip) { m.fillStyle = '#fff'; m.fillRect(0, 0, 10, SIZE); m.fillRect(SIZE - 10, 0, 10, SIZE); }
      });
    }
    facade('facade0', { wall: '#35323a', cols: 4, rows: 4, mx: 0.14, my: 0.2, lit: 0.45, warm: true, band: '#26242a', ac: true });
    facade('facade1', { wall: '#2b3038', cols: 8, rows: 6, mx: 0.08, my: 0.12, lit: 0.35, band: '#1d2128' });
    facade('facade2', { wall: '#3c3530', cols: 3, rows: 4, mx: 0.2, my: 0.25, lit: 0.5, warm: true, ac: true });
    facade('facade3', { wall: '#1c2028', cols: 6, rows: 10, mx: 0.04, my: 0.08, lit: 0.3, strip: '#ff3fa8' });
    facade('facade4', { wall: '#2f3532', cols: 5, rows: 5, mx: 0.1, my: 0.18, lit: 0.4, band: '#3a403c', ac: true });
    facade('facade5', { wall: '#241f2a', cols: 6, rows: 8, mx: 0.06, my: 0.1, lit: 0.38, strip: '#38e8ff' });

    // 11: 金属パネル(木箱・コンテナ)
    g = layer('metal');
    withMask(g, function (g) {
      g.fillStyle = '#4c4f55'; g.fillRect(0, 0, SIZE, SIZE);
      for (var x = 0; x < SIZE; x += 32) { g.fillStyle = (x / 32) % 2 ? '#43464c' : '#55585e'; g.fillRect(x, 0, 16, SIZE); }
      noise(g, rnd, 26);
      g.strokeStyle = '#26282c'; g.lineWidth = 8; g.strokeRect(4, 4, SIZE - 8, SIZE - 8);
      g.fillStyle = '#e8c547'; g.font = 'bold 54px ' + FONT; g.fillText('KY-07', 40, 90);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      for (var i = 0; i < 14; i++) { g.fillRect(rnd() * SIZE, rnd() * SIZE, 30 + rnd() * 80, 3); }
      stains(g, rnd, 12, 'rgba(90,40,20,0.35)');
    }, function () {});

    // 12: 自販機の正面(光る)
    g = layer('vending');
    withMask(g, function (g) {
      g.fillStyle = '#d8dde4'; g.fillRect(0, 0, SIZE, SIZE);
      g.fillStyle = '#c3e8ff'; g.fillRect(30, 30, 452, 300);
      var cols = ['#ff4d6a', '#3fc1ff', '#ffd23f', '#6aff8e', '#ff9b3f', '#c77dff'];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 6; c++) {
        g.fillStyle = cols[(r * 2 + c) % 6]; g.fillRect(50 + c * 72, 50 + r * 95, 44, 70);
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(52 + c * 72, 52 + r * 95, 10, 66);
        g.fillStyle = '#222'; g.fillRect(56 + c * 72, 124 + r * 95, 32, 10);
      }
      g.fillStyle = '#1b1d21'; g.fillRect(30, 350, 300, 120);
      g.fillStyle = '#ff2b6e'; g.font = 'bold 40px ' + FONT; g.fillText('冷たい', 350, 410);
      g.fillStyle = '#111'; g.fillRect(360, 430, 110, 50);
    }, function (m) {
      m.fillStyle = '#ddd'; m.fillRect(30, 30, 452, 300);
      m.fillStyle = '#fff'; m.fillRect(340, 370, 140, 50);
    });

    // 13: 格子(床グレーチング・柵)
    g = layer('grate');
    withMask(g, function (g) {
      g.fillStyle = '#1a1b1e'; g.fillRect(0, 0, SIZE, SIZE);
      g.fillStyle = '#5a5d63';
      for (var x = 0; x < SIZE; x += 32) g.fillRect(x, 0, 8, SIZE);
      for (var y = 0; y < SIZE; y += 64) g.fillRect(0, y, SIZE, 6);
      noise(g, rnd, 20);
    }, function () {});

    // 14〜21: ネオン看板
    var hWords = ['ラーメン', '居酒屋', 'カラオケ', '薬局', 'ホテル', '質屋', 'BAR', '24H', 'ゲーム', '珈琲', '整体', '漢方', '電脳', '義体修理', '夜光', '酒'];
    var vWords = ['ラーメン', '居酒屋', '占い', '麻雀', '焼鳥', '電気街', '寿司', 'サイバー', '餃子', '中古', '喫茶', '按摩', '回転', '薬', '夜市', '質'];
    T.signs = [];
    function neonText(g, text, x, y, size, vertical, maxLen) {
      g.font = 'bold ' + size + 'px ' + FONT;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      var chars = vertical ? text.split('') : [text];
      var step = vertical ? Math.min(size * 1.05, maxLen / chars.length) : 0;
      var y0 = vertical ? y - step * (chars.length - 1) / 2 : y;
      for (var pass = 0; pass < 3; pass++) {
        g.shadowColor = 'rgba(255,255,255,1)';
        g.shadowBlur = pass === 0 ? 26 : pass === 1 ? 10 : 0;
        g.fillStyle = pass === 2 ? '#ffffff' : 'rgba(205,205,205,0.75)';
        g.lineWidth = pass === 2 ? 0 : 6;
        for (var i = 0; i < chars.length; i++) {
          var cy = vertical ? y0 + i * step : y;
          if (pass < 2) { g.strokeStyle = 'rgba(190,190,190,0.7)'; g.strokeText(chars[i], x, cy); }
          g.fillText(chars[i], x, cy);
        }
      }
      g.shadowBlur = 0;
    }
    for (var s = 0; s < 4; s++) {
      g = layer('signH' + s);
      (function (s) {
        withMask(g, function (g) {
          g.fillStyle = '#0c0b10'; g.fillRect(0, 0, SIZE, SIZE);
          for (var k = 0; k < 4; k++) {
            var w = hWords[s * 4 + k];
            g.strokeStyle = 'rgba(160,160,160,0.6)'; g.lineWidth = 4; g.strokeRect(10, k * 128 + 10, SIZE - 20, 108);
            var sz = w.length > 3 ? Math.min(84, 420 / w.length) : 84;
            neonText(g, w, SIZE / 2, k * 128 + 66, sz, false);
            T.signs.push({ layer: L['signH' + s], rect: [0, (k * 128) / SIZE, 1, ((k + 1) * 128) / SIZE], vertical: false, text: w });
          }
        }, function (m) {
          // 文字の明るさをそのまま光らせる
          var d = g.getImageData(0, 0, SIZE, SIZE), md = m.getImageData(0, 0, SIZE, SIZE);
          for (var i = 0; i < d.data.length; i += 4) { var v = Math.max(d.data[i], d.data[i + 1], d.data[i + 2]); md.data[i] = md.data[i + 1] = md.data[i + 2] = Math.min(255, v * 1.3 + 8); }
          m.putImageData(md, 0, 0);
        });
      })(s);
    }
    for (s = 0; s < 4; s++) {
      g = layer('signV' + s);
      (function (s) {
        withMask(g, function (g) {
          g.fillStyle = '#0c0b10'; g.fillRect(0, 0, SIZE, SIZE);
          for (var k = 0; k < 4; k++) {
            var w = vWords[s * 4 + k];
            g.strokeStyle = 'rgba(160,160,160,0.6)'; g.lineWidth = 4; g.strokeRect(k * 128 + 10, 10, 108, SIZE - 20);
            neonText(g, w, k * 128 + 64, SIZE / 2, 84, true, 460);
            T.signs.push({ layer: L['signV' + s], rect: [(k * 128) / SIZE, 0, ((k + 1) * 128) / SIZE, 1], vertical: true, text: w });
          }
        }, function (m) {
          var d = g.getImageData(0, 0, SIZE, SIZE), md = m.getImageData(0, 0, SIZE, SIZE);
          for (var i = 0; i < d.data.length; i += 4) { var v = Math.max(d.data[i], d.data[i + 1], d.data[i + 2]); md.data[i] = md.data[i + 1] = md.data[i + 2] = Math.min(255, v * 1.3 + 8); }
          m.putImageData(md, 0, 0);
        });
      })(s);
    }

    // 22: 大型ホログラム広告(上下2枚)
    g = layer('billboard');
    withMask(g, function (g) {
      // 上: 「夜光ソーダ」
      var gr = g.createLinearGradient(0, 0, SIZE, 256);
      gr.addColorStop(0, '#1a0638'); gr.addColorStop(1, '#ff2f8f');
      g.fillStyle = gr; g.fillRect(0, 0, SIZE, 256);
      g.fillStyle = 'rgba(255,255,255,0.12)'; for (var y = 0; y < 256; y += 6) g.fillRect(0, y, SIZE, 2);
      g.fillStyle = '#7ff8ff'; g.beginPath(); g.arc(120, 128, 80, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a0638'; g.beginPath(); g.arc(140, 112, 64, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 76px ' + FONT; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('夜光ソーダ', 210, 105);
      g.fillStyle = '#7ff8ff'; g.font = 'bold 30px ' + FONT; g.fillText('YAKO SODA — 眠らない街の味', 214, 185);
      // 下: 「義体クリニック」
      gr = g.createLinearGradient(0, 256, SIZE, 512);
      gr.addColorStop(0, '#00303a'); gr.addColorStop(1, '#00c2a8');
      g.fillStyle = gr; g.fillRect(0, 256, SIZE, 256);
      g.fillStyle = 'rgba(255,255,255,0.12)'; for (y = 256; y < 512; y += 6) g.fillRect(0, y, SIZE, 2);
      g.strokeStyle = '#fff'; g.lineWidth = 6;
      g.beginPath(); g.arc(110, 384, 70, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(110, 320); g.lineTo(110, 448); g.moveTo(50, 384); g.lineTo(170, 384); g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 66px ' + FONT; g.fillText('義体クリニック', 200, 360);
      g.fillStyle = '#ffe66b'; g.font = 'bold 30px ' + FONT; g.fillText('腕・脚・眼 即日交換 OK', 204, 440);
    }, function (m) { m.fillStyle = '#d0d0d0'; m.fillRect(0, 0, SIZE, SIZE); });

    // 23: ジャンプ台(矢印が光る)
    g = layer('jumppad');
    withMask(g, function (g) {
      g.fillStyle = '#16181c'; g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = '#ffffff'; g.lineWidth = 22; g.lineJoin = 'round';
      for (var i = 0; i < 3; i++) {
        var y = 150 + i * 110;
        g.beginPath(); g.moveTo(110, y + 70); g.lineTo(256, y - 30); g.lineTo(402, y + 70); g.stroke();
      }
      g.lineWidth = 14; g.strokeRect(20, 20, SIZE - 40, SIZE - 40);
    }, function (m) {
      m.strokeStyle = '#fff'; m.lineWidth = 22; m.lineJoin = 'round';
      for (var i = 0; i < 3; i++) { var y = 150 + i * 110; m.beginPath(); m.moveTo(110, y + 70); m.lineTo(256, y - 30); m.lineTo(402, y + 70); m.stroke(); }
      m.lineWidth = 14; m.strokeRect(20, 20, SIZE - 40, SIZE - 40);
    });

    // 24: 屋台ののれん・ひさし(しま模様)
    g = layer('awning');
    withMask(g, function (g) {
      for (var x = 0; x < SIZE; x += 64) { g.fillStyle = (x / 64) % 2 ? '#b8323b' : '#e9e1cf'; g.fillRect(x, 0, 64, SIZE); }
      noise(g, rnd, 20);
      streaks(g, rnd, 20);
    }, function () {});

    // 25: ちょうちん
    g = layer('lantern');
    withMask(g, function (g) {
      g.fillStyle = '#ff5a3c'; g.fillRect(0, 0, SIZE, SIZE);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (var y = 0; y < SIZE; y += 40) g.fillRect(0, y, SIZE, 6);
      g.fillStyle = '#1a0a08'; g.font = 'bold 200px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('祭', SIZE / 2, SIZE / 2);
      g.fillStyle = '#222'; g.fillRect(0, 0, SIZE, 30); g.fillRect(0, SIZE - 30, SIZE, 30);
    }, function (m) {
      m.fillStyle = '#c8c8c8'; m.fillRect(0, 30, SIZE, SIZE - 60);
      m.fillStyle = '#303030'; m.font = 'bold 200px ' + FONT; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillText('祭', SIZE / 2, SIZE / 2);
    });

    // 26: シャッター(落書きつき)
    g = layer('shutter');
    withMask(g, function (g) {
      g.fillStyle = '#6a6c70'; g.fillRect(0, 0, SIZE, SIZE);
      for (var y = 0; y < SIZE; y += 16) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, SIZE, 3); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, y + 4, SIZE, 2); }
      noise(g, rnd, 30);
      var gcol = ['#ff3fa8', '#38e8ff', '#c8ff3a', '#ffb02e'];
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (var i = 0; i < 3; i++) {
        g.strokeStyle = gcol[i]; g.lineWidth = 14;
        g.beginPath(); var x = 40 + rnd() * 300, yy = 120 + rnd() * 300; g.moveTo(x, yy);
        for (var k = 0; k < 7; k++) { x += 20 + rnd() * 30; yy += (rnd() - 0.5) * 90; g.lineTo(x, yy); }
        g.stroke();
      }
      g.fillStyle = '#ffffff'; g.font = 'bold 70px ' + FONT; g.textAlign = 'center';
      g.fillText('NO FUTURE', SIZE / 2, 110);
      streaks(g, rnd, 25);
    }, function () {});

    // 27: 店の入口(中が光る)
    g = layer('shopfront');
    withMask(g, function (g) {
      g.fillStyle = '#1e1c22'; g.fillRect(0, 0, SIZE, SIZE);
      var gr = g.createLinearGradient(0, 120, 0, SIZE);
      gr.addColorStop(0, '#ffe2b0'); gr.addColorStop(1, '#ff9f6a');
      g.fillStyle = gr; g.fillRect(40, 140, 432, 372);
      g.fillStyle = 'rgba(40,20,30,0.85)';
      for (var i = 0; i < 4; i++) g.fillRect(70 + i * 105, 300 + rnd() * 40, 60, 212); // 棚と人影
      g.fillStyle = '#2a2830'; g.fillRect(40, 140, 432, 14); g.fillRect(250, 140, 12, 372);
      g.fillStyle = '#0f0e12'; g.fillRect(0, 0, SIZE, 120);
      g.fillStyle = '#ffffff'; g.font = 'bold 70px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('営業中', SIZE / 2, 62);
    }, function (m) {
      m.fillStyle = '#b0b0b0'; m.fillRect(40, 140, 432, 372);
      m.fillStyle = '#fff'; m.font = 'bold 70px ' + FONT; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillText('営業中', SIZE / 2, 62);
    });

    // 28: 六角形のホロ(盾・ボス)
    g = layer('hex');
    withMask(g, function (g) {
      g.fillStyle = '#000'; g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = '#fff'; g.lineWidth = 4;
      var r = 32, hgt = Math.sqrt(3) * r;
      for (var y = -1; y < SIZE / hgt + 1; y++) for (var x = -1; x < SIZE / (r * 1.5) + 1; x++) {
        var cx = x * r * 1.5, cy = y * hgt + (x % 2 ? hgt / 2 : 0);
        g.beginPath();
        for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        g.closePath(); g.stroke();
      }
    }, function (m) {
      m.drawImage(list[L.hex], 0, 0);
    });

    // 29: 敵の装甲板(パネル線)
    g = layer('armor');
    withMask(g, function (g) {
      g.fillStyle = '#c9ccd2'; g.fillRect(0, 0, SIZE, SIZE);
      noise(g, rnd, 18);
      g.strokeStyle = 'rgba(30,30,40,0.7)'; g.lineWidth = 4;
      g.strokeRect(20, 20, 220, 200); g.strokeRect(270, 20, 220, 120); g.strokeRect(270, 170, 220, 300); g.strokeRect(20, 260, 220, 210);
      g.fillStyle = 'rgba(30,30,40,0.6)';
      for (var i = 0; i < 20; i++) { g.beginPath(); g.arc(30 + rnd() * 450, 30 + rnd() * 450, 5, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#e8c547'; g.fillRect(270, 60, 220, 30);
      g.fillStyle = '#111'; g.font = 'bold 26px ' + FONT; g.fillText('MK-IV  危険', 290, 84);
    }, function () {});

    // 30: 端末の画面(光る)
    g = layer('screen');
    withMask(g, function (g) {
      g.fillStyle = '#04110f'; g.fillRect(0, 0, SIZE, SIZE);
      g.fillStyle = '#4dffc3'; g.font = '22px monospace'; g.textAlign = 'left';
      for (var y = 30; y < SIZE; y += 28) {
        var str = '';
        for (var k = 0; k < 30; k++) str += rnd() < 0.15 ? ' ' : String.fromCharCode(0x30A0 + Math.floor(rnd() * 90));
        g.globalAlpha = 0.4 + rnd() * 0.6; g.fillText(str, 16, y);
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(0,0,0,0.3)'; for (y = 0; y < SIZE; y += 4) g.fillRect(0, y, SIZE, 2);
    }, function (m) { m.fillStyle = '#bbb'; m.fillRect(0, 0, SIZE, SIZE); });

    // 31: 車のボディ(窓と線)
    g = layer('car');
    withMask(g, function (g) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, SIZE, SIZE);
      noise(g, rnd, 14);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 300, SIZE, 6); g.fillRect(250, 0, 4, 300);
      stains(g, rnd, 8, 'rgba(60,40,30,0.3)');
    }, function () {});

    return list.map(function (c, i) { return { width: SIZE, data: data[i] }; });
  };

  T.L = L;
  T.SIZE = SIZE;
  T.FONT = FONT;
  NF.T = T;
})();
