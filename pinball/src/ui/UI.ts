// DOM の UI:上部バー(コイン・速度・音・ショップ・Debug)、下部のブーストボタン、
// タイトル・強化カード・ショップ・ゲームオーバーの各画面、トースト(短いお知らせ)。

import type { DebugAction, Game } from '../game/Game';
import { fmt } from '../game/JuiceManager';
import { META } from '../game/Save';
import { RARITY_LABEL, type UpgradeDef } from '../game/Upgrades';

export interface GameOverInfo {
  wave: number;
  maxDamage: number;
  bestCombo: number;
  coins: number;
  canContinue: boolean;
}

const TEMPLATE = `
<div class="frame">
  <canvas class="screen" aria-label="ゲーム画面"></canvas>

  <div class="hud-top">
    <div class="coins" title="コイン"><i class="coin-ico"></i><b data-coins>0</b></div>
    <div class="speed" role="group" aria-label="ゲームスピード">
      <button data-speed="1">1x</button>
      <button data-speed="2">2x<span class="lock">🔒</span></button>
      <button data-speed="3">3x<span class="lock">🔒</span></button>
    </div>
    <button class="icon-btn" data-act="sound" aria-label="音のオン・オフ">🔊</button>
    <button class="icon-btn" data-act="shop" aria-label="ショップ">🛒</button>
    <button class="debug-btn" data-act="debug" aria-expanded="false">🛠️Debug</button>
  </div>

  <div class="debug-panel" hidden>
    <div class="debug-title">神モード <small>(テスト用)</small></div>
    <button data-dbg="fire20">⚡ ボール20個 即発射</button>
    <button data-dbg="convert">💥 全ペグを分裂&amp;爆発化</button>
    <button data-dbg="coins">💰 コイン +10,000</button>
    <button data-dbg="skip">⏭ 次の Wave へスキップ</button>
    <button data-dbg="heal">♥ HP 全快</button>
    <button data-dbg="resetpass">↺ 購入状態リセット</button>
  </div>

  <div class="hud-bottom">
    <button class="boost-btn" data-act="boost">
      <span class="tv">📺</span>
      <span class="boost-text"><b>ボール 2 倍</b><small>今回のショットのみ</small></span>
    </button>
  </div>

  <section class="overlay title-screen" hidden>
    <div class="title-wrap">
      <div class="title-kicker">PHYSICS ROGUELITE PINBALL</div>
      <h1 class="title-logo"><span class="t1">夜窓</span><span class="t2">ピンボール</span></h1>
      <p class="title-tag">真夜中、部屋の小物たちが動き出す。<br>光の玉で、ぜんぶ弾き飛ばせ。</p>
      <ul class="legend">
        <li><i style="--c:#fff0cc"></i>通常</li>
        <li><i style="--c:#44f2ff"></i>分裂</li>
        <li><i style="--c:#ff3b4e"></i>爆発</li>
        <li><i style="--c:#ffe14a" class="big"></i>倍率</li>
        <li><i style="--c:#b86bff"></i>電撃</li>
      </ul>
      <button class="btn primary big" data-act="start">▶ はじめる</button>
      <button class="btn" data-act="meta">⬆ 永続強化・ショップ</button>
      <div class="title-best">最高 WAVE <b data-best>0</b> ・ 最大ダメージ <b data-bestdmg>0</b></div>
    </div>
  </section>

  <section class="overlay cards-screen" hidden>
    <div class="panel">
      <div class="panel-head">
        <small data-cards-sub>WAVE 1 CLEAR</small>
        <h2>強化をひとつ選ぶ</h2>
      </div>
      <div class="cards" data-cards></div>
      <button class="btn ad" data-act="reroll">📺 広告を見て引き直し</button>
    </div>
  </section>

  <section class="overlay shop-screen" hidden>
    <div class="panel">
      <div class="panel-head">
        <h2>ショップ</h2>
        <button class="close" data-act="close-shop" aria-label="閉じる">×</button>
      </div>
      <div class="tabs" role="tablist">
        <button data-tab="pass" role="tab">💎 パス</button>
        <button data-tab="meta" role="tab">⬆ 永続強化</button>
      </div>
      <div class="tab-body" data-tabbody="pass">
        <div class="pass-card">
          <div class="ribbon">おすすめ</div>
          <h3>広告削除+倍速解放パス</h3>
          <div class="price">¥600 <small>買い切り</small></div>
          <ul>
            <li>2x / 3x のゲームスピードを解放</li>
            <li>リワード広告を見ずに報酬をすぐ受け取れる</li>
            <li>一度買えばずっと有効</li>
          </ul>
          <button class="btn buy" data-act="buy">¥600 で購入</button>
          <p class="mock-note">※デモ用のモック購入です。実際の決済は行われません。</p>
        </div>
      </div>
      <div class="tab-body" data-tabbody="meta" hidden>
        <div class="meta-coins"><i class="coin-ico"></i>所持コイン <b data-coins2>0</b></div>
        <div class="meta-list" data-meta></div>
        <p class="mock-note">永続強化は次のランから反映されます。</p>
      </div>
    </div>
  </section>

  <section class="overlay over-screen" hidden>
    <div class="panel">
      <h2 class="over-title">GAME OVER</h2>
      <dl class="over-stats">
        <div><dt>到達 WAVE</dt><dd data-ov="wave">1</dd></div>
        <div><dt>最大ショット</dt><dd data-ov="dmg">0</dd></div>
        <div><dt>最大コンボ</dt><dd data-ov="combo">0</dd></div>
        <div><dt>獲得コイン</dt><dd data-ov="coins">0</dd></div>
      </dl>
      <button class="btn ad big" data-act="continue">📺 広告を見てコンティニュー<small>HP 全快+全ペグ誘爆(1 回だけ)</small></button>
      <button class="btn primary" data-act="retry">もう一度</button>
      <button class="btn" data-act="to-title">タイトルへ</button>
    </div>
  </section>

  <div class="toast" role="status" aria-live="polite"></div>
  <div class="rotate-hint">スマホを縦にして遊んでね</div>
</div>`;

export class UI {
  readonly frame: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private game: Game;
  private q: <T extends HTMLElement = HTMLElement>(sel: string) => T;
  private toastTimer = 0;
  private cache = { coins: -1, speed: -1, pass: false, muted: false, boost: '', hudVisible: false };

  constructor(root: HTMLElement, game: Game) {
    this.game = game;
    root.innerHTML = TEMPLATE;
    this.frame = root.querySelector<HTMLElement>('.frame')!;
    this.canvas = this.frame.querySelector<HTMLCanvasElement>('canvas')!;
    this.q = <T extends HTMLElement = HTMLElement>(sel: string) => this.frame.querySelector<T>(sel)!;
    this.bind();
  }

  private bind(): void {
    const g = () => this.game;
    this.frame.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      g().audio.unlock();
      g().audio.click();
      const act = btn.dataset.act;
      const sp = btn.dataset.speed;
      const dbg = btn.dataset.dbg as DebugAction | undefined;
      const tab = btn.dataset.tab;
      const metaKey = btn.dataset.metaBuy;
      if (sp) g().setSpeed(Number(sp));
      if (dbg) g().debug(dbg);
      if (tab) this.setTab(tab);
      if (metaKey) {
        g().buyMeta(metaKey);
        this.renderMeta();
      }
      switch (act) {
        case 'sound':
          g().toggleMute();
          break;
        case 'shop':
          this.openShop('pass');
          break;
        case 'meta':
          this.openShop('meta');
          break;
        case 'close-shop':
          this.closeShop();
          break;
        case 'debug': {
          const p = this.q('.debug-panel');
          p.hidden = !p.hidden;
          btn.setAttribute('aria-expanded', String(!p.hidden));
          break;
        }
        case 'boost':
          g().requestBoost();
          break;
        case 'start':
          g().newRun();
          break;
        case 'reroll':
          g().rerollCards();
          break;
        case 'continue':
          g().continueRun();
          break;
        case 'retry':
          g().newRun();
          break;
        case 'to-title':
          g().toTitle();
          break;
        case 'buy':
          this.buy(btn);
          break;
      }
    });
    // 画面外タップでショップを閉じる
    this.q('.shop-screen').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeShop();
    });
  }

  private buy(btn: HTMLElement): void {
    if (this.game.money.hasPass) return;
    btn.classList.add('processing');
    btn.textContent = '決済処理中…';
    void this.game.buyPass().then(() => this.renderPass());
  }

  // ───────── 毎フレームの同期(変わったときだけ DOM を書き換える) ─────────

  sync(): void {
    const g = this.game;
    const d = g.save.data;
    const c = this.cache;
    if (c.coins !== d.coins) {
      c.coins = d.coins;
      this.q('[data-coins]').textContent = fmt(d.coins);
      this.q('[data-coins2]').textContent = fmt(d.coins);
    }
    if (c.speed !== g.speed || c.pass !== d.pass) {
      c.speed = g.speed;
      c.pass = d.pass;
      this.frame.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => {
        const s = Number(b.dataset.speed);
        b.classList.toggle('on', s === g.speed);
        b.classList.toggle('locked', s > 1 && !d.pass);
      });
    }
    if (c.muted !== d.muted) {
      c.muted = d.muted;
      this.q('[data-act="sound"]').textContent = d.muted ? '🔇' : '🔊';
    }
    const inRun = g.state !== 'title';
    if (c.hudVisible !== inRun) {
      c.hudVisible = inRun;
      this.q('.hud-bottom').classList.toggle('show', inRun);
    }
    const boost = g.boostArmed ? 'armed' : g.state === 'aim' && !g.money.busy ? 'ready' : 'off';
    if (c.boost !== boost) {
      c.boost = boost;
      const b = this.q<HTMLButtonElement>('.boost-btn');
      b.disabled = boost !== 'ready';
      b.classList.toggle('armed', boost === 'armed');
      b.querySelector('b')!.textContent = boost === 'armed' ? 'BOOST ON!' : 'ボール 2 倍';
    }
  }

  // ───────── 画面 ─────────

  toast(msg: string): void {
    const t = this.q('.toast');
    t.textContent = msg;
    t.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('show'), 1900);
  }

  showTitle(): void {
    const d = this.game.save.data;
    this.q('[data-best]').textContent = String(d.bestWave);
    this.q('[data-bestdmg]').textContent = fmt(d.bestDamage);
    this.q('.title-screen').hidden = false;
  }

  hideTitle(): void {
    this.q('.title-screen').hidden = true;
  }

  showCards(cards: UpgradeDef[], wave: number): void {
    this.q('[data-cards-sub]').textContent = `WAVE ${wave} CLEAR!`;
    const box = this.q('[data-cards]');
    box.innerHTML = '';
    cards.forEach((def, i) => {
      const owned = this.game.owned.get(def.id) ?? 0;
      const el = document.createElement('button');
      el.className = `card r-${def.rarity}`;
      el.style.setProperty('--c', def.color);
      el.style.animationDelay = `${i * 0.08}s`;
      el.innerHTML = `
        <span class="card-icon">${def.icon}</span>
        <span class="card-body">
          <span class="card-top"><b>${def.name}</b><em>${RARITY_LABEL[def.rarity]}</em></span>
          <span class="card-desc">${def.desc}</span>
          ${owned ? `<span class="card-owned">所持 ×${owned}</span>` : ''}
        </span>`;
      el.addEventListener('click', () => this.game.pickCard(def));
      box.appendChild(el);
    });
    const reroll = this.q('[data-act="reroll"]');
    reroll.textContent = this.game.money.hasPass ? '↻ 引き直し(パス特典)' : '📺 広告を見て引き直し';
    this.q('.cards-screen').hidden = false;
  }

  hideCards(): void {
    this.q('.cards-screen').hidden = true;
  }

  openShop(tab: 'pass' | 'meta'): void {
    this.renderPass();
    this.renderMeta();
    this.setTab(tab);
    this.q('.shop-screen').hidden = false;
  }

  closeShop(): void {
    this.q('.shop-screen').hidden = true;
  }

  isShopOpen(): boolean {
    return !this.q('.shop-screen').hidden;
  }

  private setTab(tab: string): void {
    this.frame.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => {
      b.classList.toggle('on', b.dataset.tab === tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
    this.frame.querySelectorAll<HTMLElement>('[data-tabbody]').forEach((b) => {
      b.hidden = b.dataset.tabbody !== tab;
    });
  }

  private renderPass(): void {
    const btn = this.q<HTMLButtonElement>('[data-act="buy"]');
    const owned = this.game.money.hasPass;
    btn.classList.remove('processing');
    btn.classList.toggle('owned', owned);
    btn.disabled = owned;
    btn.textContent = owned ? '購入済み ✓ 2x / 3x 解放中' : '¥600 で購入';
  }

  renderMeta(): void {
    const d = this.game.save.data;
    const list = this.q('[data-meta]');
    list.innerHTML = META.map((m) => {
      const lv = d.meta[m.key];
      const max = lv >= m.max;
      const cost = m.cost(lv);
      return `
        <div class="meta-row">
          <span class="meta-icon">${m.icon}</span>
          <span class="meta-info"><b>${m.name}</b><small>Lv ${lv} / ${m.max}</small><span>${m.desc}</span></span>
          <button class="btn small" data-meta-buy="${m.key}" ${max || d.coins < cost ? 'disabled' : ''}>
            ${max ? 'MAX' : `<i class="coin-ico"></i>${fmt(cost)}`}
          </button>
        </div>`;
    }).join('');
  }

  showGameOver(info: GameOverInfo): void {
    this.q('[data-ov="wave"]').textContent = String(info.wave);
    this.q('[data-ov="dmg"]').textContent = fmt(info.maxDamage);
    this.q('[data-ov="combo"]').textContent = String(info.bestCombo);
    this.q('[data-ov="coins"]').textContent = fmt(info.coins);
    const cont = this.q<HTMLButtonElement>('[data-act="continue"]');
    cont.hidden = !info.canContinue;
    cont.firstChild!.textContent = this.game.money.hasPass ? '↻ コンティニュー(パス特典)' : '📺 広告を見てコンティニュー';
    this.q('.over-screen').hidden = false;
  }

  hideGameOver(): void {
    this.q('.over-screen').hidden = true;
  }
}
