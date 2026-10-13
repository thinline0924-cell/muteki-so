/* monetize.js — 広告と課金の窓口
   ブラウザ版では「デモ表示」を出すだけで、本物の広告も請求もありません。
   ストア版(アプリにしたとき)は、アプリ側が window.OsunaNative に次の関数を用意すれば、
   そちらが自動で使われます(AdMob や アプリ内課金 につなぐ場所)。
     OsunaNative.showRewarded(placement) -> Promise<boolean>  最後まで見たら true
     OsunaNative.showInterstitial()      -> Promise<void>
     OsunaNative.purchase(productId)     -> Promise<boolean>  買えたら true
     OsunaNative.restore()               -> Promise<string[]> 買ったことのある商品ID */
const Monetize = (function () {
  'use strict';
  const PRODUCTS = {
    noads:      { name: '広告をなくす', price: '¥480' },
    theme_crt:  { name: 'テーマ「夜光」', price: '¥160' },
    theme_dusk: { name: 'テーマ「夕焼け」', price: '¥160' }
  };
  const nat = () => window.OsunaNative || null;
  const $ = id => document.getElementById(id);

  // 広告のかわりのデモ画面
  function demoAd(kind, label) {
    return new Promise(resolve => {
      const box = $('ad'), cnt = $('ad-count'), btn = $('ad-close'), msg = $('ad-text');
      const reward = kind === 'reward';
      let left = reward ? 5 : 3;
      msg.textContent = reward
        ? 'ストア版では、ここで動画広告(約15〜30秒)が流れます。最後まで見ると「' + label + '」がもらえます。'
        : 'ストア版では、ここで全画面広告が出ます(3回の勝負ごとに1回、勝負の外だけ)。';
      box.hidden = false;
      const draw = () => {
        cnt.textContent = left > 0 ? 'あと ' + left + ' 秒' : '';
        if (reward) btn.textContent = left > 0 ? 'やめる(もらわない)' : '受け取る';
        else { btn.textContent = '閉じる'; btn.disabled = left > 0; }
      };
      draw();
      const iv = setInterval(() => { left--; draw(); if (left <= 0) clearInterval(iv); }, 1000);
      btn.onclick = () => {
        if (!reward && left > 0) return;
        clearInterval(iv); box.hidden = true; btn.disabled = false; btn.onclick = null;
        resolve(reward ? left <= 0 : undefined);
      };
    });
  }

  // 購入のかわりのデモ確認
  function demoBuy(id) {
    return new Promise(resolve => {
      const p = PRODUCTS[id];
      $('buy-text').textContent = '「' + p.name + '」' + p.price;
      $('buy').hidden = false;
      const done = ok => { $('buy').hidden = true; $('buy-ok').onclick = $('buy-no').onclick = null; resolve(ok); };
      $('buy-ok').onclick = () => done(true);
      $('buy-no').onclick = () => done(false);
    });
  }

  return {
    PRODUCTS,
    rewarded(label) { const n = nat(); return n && n.showRewarded ? n.showRewarded(label) : demoAd('reward', label); },
    interstitial() { const n = nat(); return n && n.showInterstitial ? n.showInterstitial() : demoAd('inter'); },
    purchase(id) { const n = nat(); return n && n.purchase ? n.purchase(id) : demoBuy(id); },
    restore() { const n = nat(); return n && n.restore ? n.restore() : Promise.resolve(null); }
  };
})();
