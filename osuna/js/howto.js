/* howto.js — 絵が動く「遊び方」。1ページに1つのことだけ説明する。
   Howto.open(done) で始める(画面の切りかえは game.js が先にしておく)。最後まで見るか「とばす」で done() */
const Howto = (function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const VW = 300, VH = 170;
  let idx = 0, t0 = 0, prevT = 0, raf = 0, done = null, g = null;

  // ---------- 絵の部品 ----------
  function city(g, t) {
    const P = Ink.P, R = Ink.rng(9);
    g.fillStyle = P.night; g.fillRect(0, 0, VW, VH);
    Ink.seed(2 + Math.floor(t * 7), 0.6);
    g.globalAlpha = 0.35;
    let x = 4;
    while (x < VW) {
      const w = 18 + R() * 24, h = 26 + R() * 60;
      Ink.shape(g, [[x, VH + 2], [x, VH - h], [x + w, VH - h], [x + w, VH + 2]], null, 1, P.glow);
      x += w + 4;
    }
    g.globalAlpha = 1;
  }
  function finger(g, x, y, press) {
    const P = Ink.P;
    g.save(); g.translate(x, y);
    Ink.seed(5, 0.4);
    if (press) { g.beginPath(); g.arc(0, 0, 17, 0, 7); g.lineWidth = 2.5; g.strokeStyle = P.glow; g.stroke(); }
    Ink.shape(g, [[-10, 2], [10, 2], [13, 80], [-13, 80]], P.paper, 2);
    Ink.ellipse(g, 0, 2, 10, 10, P.paper, 2);
    Ink.ellipse(g, 0, -1, 5, 4, P.glow, 1);
    g.restore();
  }
  function lane(g, t, hot, label) {
    const P = Ink.P;
    g.fillStyle = hot && Math.floor(t * 8) % 2 === 0 ? P.red : P.ink;
    g.fillRect(0, 126, VW, 44);
    Ink.line(g, 0, 126, VW, 126, 2, P.glow);
    Ink.txt(g, label, VW / 2, 148, 13, { h: true, c: P.glow });
  }
  function stamp(g, text, x, y, size, col, age) {
    const s = 1 + Math.max(0, 1 - age / 0.12) * 1.2;
    g.save(); g.translate(x, y); g.rotate(-0.08); g.scale(s, s);
    Ink.txt(g, text, 0, 0, size, { c: col, sw: 6, sc: Ink.P.ink });
    g.restore();
  }
  function neon(g, on) {
    const P = Ink.P;
    g.save();
    Ink.rect(g, 12, 18, 24, 100, P.night, 1.3, P.glow);
    if (on) { g.shadowColor = P.glow; g.shadowBlur = 16; }
    g.globalAlpha = on ? 1 : 0.25;
    ['大', '当', 'り'].forEach((c, i) => Ink.txt(g, c, 24, 36 + i * 32, 18, { c: P.glow }));
    g.restore();
  }
  function bubble(g, text, x, y) {
    const P = Ink.P;
    Ink.shape(g, [[x, y], [x + 76, y], [x + 76, y + 26], [x + 14, y + 26], [x + 4, y + 36], [x + 6, y + 26], [x, y + 26]], P.glow, 2);
    Ink.txt(g, text, x + 38, y + 14, 14, { h: true });
  }
  function cross(g, cx, cy, r) {
    const P = Ink.P;
    Ink.line(g, cx - r, cy - r, cx + r, cy + r, 6, P.red);
    Ink.line(g, cx + r, cy - r, cx - r, cy + r, 6, P.red);
  }
  const HYPE = { id: 3, type: 'hype', x: 50, y: 26, w: 200, h: 72, life: 99 };
  const BONUS = { id: 4, type: 'bonus', x: 150, y: 34, w: 92, h: 92, life: 99 };
  let CRACK = null;
  function crackData() {
    if (CRACK) return CRACK;
    const R = Ink.rng(21), rays = [], cx = 110, cy = 62;
    for (let i = 0; i < 10; i++) {
      let a = i / 10 * Math.PI * 2 + R() * 0.4, x = cx, y = cy;
      const pts = [[x, y]];
      for (let k = 0; k < 4 + Math.floor(R() * 7); k++) { a += (R() - 0.5) * 0.5; x += Math.cos(a) * 16; y += Math.sin(a) * 16; pts.push([x, y]); }
      rays.push(pts);
    }
    CRACK = { x: cx, y: cy, rays, seed: 3 };
    return CRACK;
  }

  // ---------- ページ ----------
  const PAGES = [
    {
      head: '① 待つほど増える',
      text: '勝負が始まったら、<b>何もしないで待つ</b>だけ。倍率がどんどん上がって、もらえる枚数(賭けた枚数×倍率)も増えていきます。',
      loop: 7,
      draw(g, t) {
        const P = Ink.P, m = Math.exp(Math.min(t, 6) * 0.38);
        city(g, t);
        Ink.txt(g, Math.min(t, 6).toFixed(1) + '秒 待った', VW / 2, 20, 12, { h: true, c: P.glow });
        g.save(); g.shadowColor = P.glow; g.shadowBlur = 10;
        Ink.txt(g, '×' + m.toFixed(2), VW / 2, 66, 46, { c: P.glow });
        g.restore();
        Ink.txt(g, '50枚 → ' + Math.floor(50 * m) + '枚', VW / 2, 110, 19, { c: P.glow });
        Ink.txt(g, '(50枚賭けたとき)', VW / 2, 136, 12, { h: true, c: P.glow });
      }
    },
    {
      head: '② 下の帯を上へスワイプ',
      text: 'ほしい枚数になったら、画面<b>いちばん下の帯</b>に指を置いて<b>上へサッと</b>動かします。その時の枚数を受け取って勝負は終わり。(パソコンは ↑キー)',
      loop: 3.4,
      draw(g, t) {
        const P = Ink.P;
        city(g, t);
        if (t <= 1.0) {
          Ink.txt(g, '×4.20', VW / 2, 42, 34, { c: P.glow });
          Ink.txt(g, '210枚', VW / 2, 76, 16, { c: P.glow });
        }
        lane(g, t, false, '↑ ここを上にスワイプ');
        if (t > 0.1 && t < 1.4) {
          const y = t < 0.6 ? 150 : t < 1.0 ? 150 - (t - 0.6) / 0.4 * 80 : 70;
          if (t > 0.6) { g.globalAlpha = 0.5; Ink.line(g, 220, 150, 220, y, 7, P.glow); g.globalAlpha = 1; }
          finger(g, 220, y, t > 0.45 && t < 0.65);
        }
        if (t > 1.0) stamp(g, 'ゲット! +210枚', VW / 2, 62, 30, P.glow, t - 1.0);
      }
    },
    {
      head: '③ 出てくるものは押すな',
      text: '勝負中は「今タップで×10!」などが次々に出て、押させようとしてきます。<b>押したら賭けた枚数が0</b>(全損)。何もない所なら押しても平気です。',
      loop: 3.6,
      draw(g, t) {
        const P = Ink.P;
        city(g, t);
        Ink.tempter(g, HYPE, 0.5 + t, t, false);
        if (t > 0.4 && t < 1.2) {
          const k = Math.min(1, (t - 0.4) / 0.6);
          finger(g, 240 - 70 * k, 190 - 128 * k, t > 1.0);
        }
        if (t > 1.15) {
          g.globalAlpha = 0.55; g.fillStyle = P.ink; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1;
          g.beginPath(); g.arc(150, 62, 112, 0, 7); g.lineWidth = 4; g.strokeStyle = P.red; g.stroke();
          stamp(g, '全損', VW / 2, 118, 46, P.red, t - 1.15);
        }
      }
    },
    {
      head: '④ 本物だけは押す',
      text: '<b>本物のボーナス</b>は押すと倍率×3。本物は「チリン♪」と鳴って窓の看板「大当り」が光った<b>すぐあと</b>に、音なしで出ます。音と同時に出るのは<b>偽物</b>。',
      loop: 6,
      draw(g, t, at) {
        const P = Ink.P, real = t < 3, lt = real ? t : t - 3;
        city(g, t);
        Ink.txt(g, real ? '本物のとき' : '偽物のとき', VW - 8, 14, 13, { h: true, c: real ? P.glow : P.red, al: 'right' });
        if (real) {
          neon(g, lt > 0.5 && lt < 1.5);
          if (lt > 0.5 && lt < 1.3) bubble(g, 'チリン♪', 42, 20);
          if (at(0.5)) Sound.se('presign');
          if (lt > 0.95 && lt < 1.6) Ink.tempter(g, BONUS, lt - 0.95, t, false);
          if (lt > 1.1 && lt < 1.6) { const k = Math.min(1, (lt - 1.1) / 0.35); finger(g, 250 - 54 * k, 190 - 104 * k, lt > 1.42); }
          if (lt > 1.6) stamp(g, '本物! ×3', 196, 86, 30, P.glow, lt - 1.6);
        } else {
          neon(g, false);
          if (lt > 0.5 && lt < 2.8) Ink.tempter(g, BONUS, lt - 0.5, t, false);
          if (lt > 0.5 && lt < 1.4) bubble(g, 'チリン♪', 70, 34);
          if (at(3.5)) Sound.se('fakeChime');
          if (lt > 1.1 && lt < 2.8) {
            cross(g, 196, 80, 34);
            Ink.txt(g, '音と同時 = 偽物', 92, 150, 14, { h: true, c: P.glow, sw: 4, sc: P.red });
          }
        }
      }
    },
    {
      head: '⑤ ヒビが入ったら急いで',
      text: '時間がたつと画面に<b>ヒビ</b>が入ります。そうなったら<b>数秒以内</b>に受け取らないと全損。どこまで欲張るかの勝負です。',
      loop: 3.8,
      draw(g, t) {
        const P = Ink.P, hot = t > 0.4 && t < 1.95;
        city(g, t);
        if (t <= 1.95) Ink.txt(g, '×6.80', VW / 2, 44, 32, { c: P.glow });
        if (t > 0.4) Ink.crack(g, crackData(), t - 0.4);
        lane(g, t, hot, hot ? '今すぐ ↑ 受け取れ!' : '↑ ここを上にスワイプ');
        if (t > 0.4 && t < 1.95) {
          const left = Math.max(0, 3 - (t - 0.4) * 1.6);
          g.beginPath(); g.arc(266, 100, 18, 0, 7); g.fillStyle = P.ink; g.fill();
          g.beginPath(); g.arc(266, 100, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left / 3);
          g.lineWidth = 4; g.strokeStyle = P.red; g.stroke();
          Ink.txt(g, left.toFixed(1), 266, 101, 12, { c: P.glow });
        }
        if (t > 1.4 && t < 2.1) { const y = t < 1.6 ? 150 : 150 - Math.min(1, (t - 1.6) / 0.3) * 80; finger(g, 80, y, t < 1.6); }
        if (t > 1.95) stamp(g, 'セーフ!', VW / 2, 92, 38, P.glow, t - 1.95);
      }
    },
    {
      head: '⑥ 賭けて、倍か0か',
      text: '勝負の前に<b>賭ける枚数</b>を選びます。勝ったあとは「<b>倍か0か</b>」にも挑戦できます。サイコロ2つの合計が偶数(丁)か奇数(半)かを当てれば2倍、外れたら0枚。',
      loop: 3.6,
      draw(g, t) {
        const P = Ink.P;
        g.fillStyle = P.mid; g.fillRect(0, 0, VW, VH);
        Ink.seed(4 + Math.floor(t * 7), 0.6);
        Ink.txt(g, '賭ける枚数', 12, 18, 12, { h: true, al: 'left' });
        ['10', '50', '100', '500', '全部'].forEach((v, i) => {
          const x = 12 + i * 56, sel = i === 2;
          Ink.rect(g, x, 30, 50, 24, sel ? P.ink : P.glow, 1.8);
          Ink.txt(g, v, x + 25, 43, 13, { c: sel ? P.glow : P.ink });
        });
        Ink.ellipse(g, VW / 2, 112, 120, 34, P.shade, 2);
        const rolling = t < 1.2;
        const a = rolling ? 1 + Math.floor(t * 13) % 6 : 2, b = rolling ? 1 + Math.floor(t * 11 + 3) % 6 : 4;
        Ink.die(g, 128, 106, 30, a); Ink.die(g, 172, 112, 30, b);
        if (!rolling) Ink.txt(g, '2+4=6 → 偶数で「丁」!', VW / 2, 154, 15, { h: true, c: P.glow, sw: 4 });
      }
    }
  ];

  // ---------- 動かす ----------
  function render() {
    const p = PAGES[idx];
    $('hw-step').textContent = (idx + 1) + ' / ' + PAGES.length;
    $('hw-head').textContent = p.head;
    $('hw-text').innerHTML = p.text;
    $('hw-dots').innerHTML = PAGES.map((_, i) => '<i class="' + (i === idx ? 'on' : '') + '"></i>').join('');
    $('hw-prev').disabled = idx === 0;
    $('hw-next').textContent = idx === PAGES.length - 1 ? 'わかった!' : 'つぎへ';
    t0 = performance.now(); prevT = 0;
  }
  function frame(ts) {
    if ($('scr-howto').hidden) { raf = 0; return; }
    const p = PAGES[idx], t = Math.max(0, (ts - t0) / 1000) % p.loop, pt = prevT;
    // そのフレームで時刻 a を通りすぎたか(音を1回だけ鳴らすため)
    const at = a => (pt <= t ? pt < a && a <= t : a > pt || a <= t);
    g.setTransform(g.canvas.width / VW, 0, 0, g.canvas.height / VH, 0, 0);
    g.lineJoin = 'round'; g.lineCap = 'round';
    p.draw(g, t, at);
    prevT = t;
    raf = requestAnimationFrame(frame);
  }
  function finish() { const cb = done; done = null; if (raf) cancelAnimationFrame(raf); raf = 0; if (cb) cb(); }
  function open(cb) {
    done = cb; idx = 0;
    const cv = $('hw-cv');
    cv.width = VW * 3; cv.height = VH * 3;
    g = cv.getContext('2d');
    render();
    if (!raf) raf = requestAnimationFrame(frame);
  }
  $('hw-next').onclick = () => { if (idx < PAGES.length - 1) { idx++; render(); } else finish(); };
  $('hw-prev').onclick = () => { if (idx > 0) { idx--; render(); } };
  $('hw-skip').onclick = finish;

  return { open };
})();
