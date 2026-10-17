// DOM の UI:上の暗い帯(手持ち・速度・音・店・Debug)、下のブーストボタン、
// タイトル・強化カード・ショップ・結果(夜明け)の各画面、トースト(短いお知らせ)。
//
// 見た目の約束:紙(クリーム)+インク(こげ茶)+赤。角は小さく、影は「ずらしたインク」。
// 絵文字・色の帯・丸いピル型ボタンは使わない。

import type { DebugAction, Game } from '../game/Game';
import { fmt } from '../game/JuiceManager';
import { MODES, type ModeDef, type ModeId } from '../game/Modes';
import { todayKey } from '../game/rng';
import { META } from '../game/Save';
import { RARITY_LABEL, type UpgradeDef } from '../game/Upgrades';
import { Tutorial } from './Tutorial';

export interface ResultInfo {
  score: number;
  best: number;
  newBest: boolean;
  line: number;
  /** ショットごとのスコア(グラフ用) */
  history: number[];
  /** 次のラインまであといくつだったか */
  nextGap: number;
  maxShot: number;
  bestCombo: number;
  coins: number;
  canContinue: boolean;
  mode: ModeDef;
}

const TEMPLATE = `
<div class="frame">
  <canvas class="screen" aria-label="ゲーム画面"></canvas>

  <header class="topbar">
    <div class="tb-coins"><span class="tb-dim">手持ち</span><b data-coins>0</b></div>
    <div class="tb-title"></div>
    <div class="tb-right">
      <div class="speed" role="group" aria-label="ゲームスピード">
        <button data-speed="1">1x</button>
        <button data-speed="2">2x</button>
        <button data-speed="3">3x</button>
      </div>
      <button class="tb-btn" data-act="sound" aria-label="音のオン・オフ">音</button>
      <button class="tb-btn" data-act="shop" aria-label="ショップ">店</button>
      <button class="tb-btn debug-btn" data-act="debug" aria-expanded="false"><span class="mono">🛠️</span>Debug</button>
    </div>
  </header>

  <div class="debug-panel" hidden>
    <div class="debug-title">神モード <small>テスト用</small></div>
    <button data-dbg="fire20">ボール 20 個 即発射</button>
    <button data-dbg="convert">全ペグを分裂&amp;爆発化</button>
    <button data-dbg="coins">コイン +10,000</button>
    <button data-dbg="skip">次のラインへスキップ</button>
    <button data-dbg="shots">ショット +5</button>
    <button data-dbg="resetpass">購入状態をリセット</button>
  </div>

  <div class="hud-bottom">
    <button class="boost-btn" data-act="boost">
      <span class="ad-chip">AD</span>
      <span class="boost-text"><b>×2 BALL</b><small>今回のショットだけ</small></span>
    </button>
  </div>

  <section class="overlay title-screen" hidden>
    <h1 class="logo" aria-label="夜窓ピンボール">
      <span class="l1" aria-hidden="true"><i>夜</i><i>窓</i></span>
      <span class="l2" aria-hidden="true"><i>ピ</i><i>ン</i><i>ボ</i><i class="bar">ー</i><i>ル</i></span>
    </h1>
    <nav class="menu" aria-label="遊び方を選ぶ">
      <div data-modes></div>
      <div class="menu-links">
        <button class="menu-sub" data-act="howto">遊び方</button>
        <button class="menu-sub" data-act="meta">強化とショップ</button>
      </div>
    </nav>
  </section>

  <section class="overlay cards-screen" hidden>
    <div class="sheet">
      <div class="sheet-head">
        <span class="eyebrow" data-cards-sub>LINE 1 突破</span>
        <h2>強化をひとつ選ぶ</h2>
      </div>
      <div class="cards" data-cards></div>
      <button class="btn line-ink" data-act="reroll"><span class="ad-chip ink">AD</span><span data-reroll-label>広告を見て引き直す</span></button>
    </div>
  </section>

  <section class="overlay shop-screen" hidden>
    <div class="sheet">
      <div class="sheet-head">
        <h2>ショップ</h2>
        <button class="close" data-act="close-shop" aria-label="閉じる">閉じる</button>
      </div>
      <div class="tabs" role="tablist">
        <button data-tab="pass" role="tab">パス</button>
        <button data-tab="meta" role="tab">永続強化</button>
      </div>
      <div class="tab-body" data-tabbody="pass">
        <div class="pass">
          <div class="pass-head"><span class="stamp">PASS</span><h3>広告削除+倍速解放パス</h3></div>
          <div class="price">¥600<small>買い切り</small></div>
          <ul class="rows">
            <li>2x / 3x のゲームスピードを解放</li>
            <li>リワード広告を見ずに、報酬をすぐ受け取れる</li>
            <li>一度買えばずっと有効</li>
          </ul>
          <button class="btn ink" data-act="buy">¥600 で購入する</button>
          <p class="note">※デモ用のモック購入です。実際の決済は行われません。</p>
        </div>
      </div>
      <div class="tab-body" data-tabbody="meta" hidden>
        <div class="meta-coins">手持ち <b data-coins2>0</b> 枚</div>
        <div class="meta-list" data-meta></div>
        <p class="note">永続強化は次のランから反映されます。</p>
      </div>
    </div>
  </section>

  <section class="overlay over-screen" hidden>
    <div class="sheet over">
      <span class="eyebrow" data-ov="mode">一晩</span>
      <h2 class="over-title" data-ov="title">夜明け</h2>
      <div class="over-big" data-ov="score">0</div>
      <p class="over-sub" data-ov="best">自己ベスト更新!</p>
      <figure class="history">
        <figcaption>一晩の記録(1 本が 1 ショット)</figcaption>
        <div class="bars" data-ov="history"></div>
      </figure>
      <ul class="rows">
        <li>越えたライン <b data-ov="line">0</b></li>
        <li>最大ショット <b data-ov="shot">0</b> ・ 最大コンボ <b data-ov="combo">0</b></li>
        <li>獲得コイン <b data-ov="coins">0</b> 枚</li>
        <li class="warn" data-ov="gap">あと 0 で次のラインだった</li>
      </ul>
      <button class="btn line-ink" data-act="continue"><span class="ad-chip ink">AD</span><span><span data-cont-label>広告を見て夜を延長</span><small data-cont-sub>ショット +3+全ペグ誘爆(1 回だけ)</small></span></button>
      <button class="btn line-ink center" data-act="copy">結果をコピーする</button>
      <button class="btn ink" data-act="retry">もう一度</button>
      <button class="btn bare" data-act="to-title">タイトルへ</button>
    </div>
  </section>

  <div class="toast" role="status" aria-live="polite"></div>
  <div class="rotate-hint">スマホを縦にして遊んでね</div>
  <div class="tint" aria-hidden="true"></div>
  <div class="vignette" aria-hidden="true"></div>
</div>`;

export class UI {
  readonly frame: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private game: Game;
  private q: <T extends HTMLElement = HTMLElement>(sel: string) => T;
  private toastTimer = 0;
  private tutorial: Tutorial;
  private cache = { coins: -1, speed: -1, pass: false, muted: false, boost: '', hudVisible: false, title: '' };

  constructor(root: HTMLElement, game: Game) {
    this.game = game;
    root.innerHTML = TEMPLATE;
    this.frame = root.querySelector<HTMLElement>('.frame')!;
    this.canvas = this.frame.querySelector<HTMLCanvasElement>('canvas')!;
    this.q = <T extends HTMLElement = HTMLElement>(sel: string) => this.frame.querySelector<T>(sel)!;
    this.tutorial = new Tutorial(this.frame, {
      getAuto: () => this.game.save.data.howto ?? 'first',
      setAuto: (v) => {
        this.game.save.data.howto = v;
        this.game.save.write();
      },
      click: () => this.game.audio.click(),
    });
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
      const mode = btn.dataset.mode as ModeId | undefined;
      if (mode) g().chooseMode(mode);
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
        case 'howto':
          this.tutorial.open();
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
          g().startMode(g().mode.id);
          break;
        case 'to-title':
          g().toTitle();
          break;
        case 'buy':
          this.buy(btn);
          break;
        case 'copy':
          this.copyResult();
          break;
      }
    });
    // 画面外タップでショップを閉じる
    this.q('.shop-screen').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeShop();
    });
  }

  /** 結果をコピー(クリック中に呼ぶ必要がある)。使えない環境ではお知らせだけ */
  private copyResult(): void {
    const text = this.game.resultText();
    const done = () => this.toast('結果をコピーしました');
    const fail = () => this.toast('この環境ではコピーできませんでした');
    try {
      if (navigator.clipboard) void navigator.clipboard.writeText(text).then(done, fail);
      else fail();
    } catch {
      fail();
    }
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
        b.setAttribute('aria-label', s > 1 && !d.pass ? `${s}倍速(パスで解放)` : `${s}倍速`);
      });
    }
    if (c.muted !== d.muted) {
      c.muted = d.muted;
      const b = this.q('[data-act="sound"]');
      b.classList.toggle('off', d.muted);
      b.setAttribute('aria-pressed', String(!d.muted));
    }
    const inRun = g.state !== 'title';
    // 上の帯の真ん中:遊んでいる間はモード名
    const title = inRun ? g.mode.name + (g.mode.seeded ? ` ${todayKey().slice(4, 6)}/${todayKey().slice(6)}` : '') : '';
    if (c.title !== title) {
      c.title = title;
      this.q('.tb-title').textContent = title;
    }
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
      b.querySelector('small')!.textContent = boost === 'armed' ? '次のショットで発動' : '今回のショットだけ';
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
    const box = this.q('[data-modes]');
    box.innerHTML = MODES.map((m) => {
      const best = d.bests[this.game.bestKey(m)] ?? 0;
      const day = m.seeded ? `<span class="m-day">${todayKey().slice(4, 6)}/${todayKey().slice(6)}</span>` : '';
      return `<button class="m" data-mode="${m.id}"><span class="m-name">${m.name}</span>${day}<span class="m-best">${best > 0 ? fmt(best) : ''}</span></button>`;
    }).join('');
    this.q('.title-screen').hidden = false;
  }

  hideTitle(): void {
    this.q('.title-screen').hidden = true;
  }

  showCards(cards: UpgradeDef[], line: number): void {
    this.q('[data-cards-sub]').textContent = `LINE ${line} 突破`;
    const box = this.q('[data-cards]');
    box.innerHTML = '';
    cards.forEach((def, i) => {
      const owned = this.game.owned.get(def.id) ?? 0;
      const el = document.createElement('button');
      el.className = `card r-${def.rarity}`;
      el.style.animationDelay = `${i * 0.07}s`;
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
    this.q('[data-reroll-label]').textContent = this.game.money.hasPass ? '引き直す(パス特典)' : '広告を見て引き直す';
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
    return !this.q('.shop-screen').hidden || this.tutorial.isOpen();
  }

  /** 遊び方を開く。onDone は閉じたあとに呼ぶ */
  openHowto(onDone: (() => void) | null = null): void {
    this.tutorial.open(onDone);
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
    btn.textContent = owned ? '購入済み ・ 2x / 3x 解放中' : '¥600 で購入する';
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
          <span class="meta-info"><b>${m.name}</b><span>${m.desc}</span></span>
          <span class="meta-lv">Lv <b>${lv}</b>/${m.max}</span>
          <button class="btn small" data-meta-buy="${m.key}" ${max || d.coins < cost ? 'disabled' : ''}>
            ${max ? 'MAX' : `${fmt(cost)} 枚`}
          </button>
        </div>`;
    }).join('');
  }

  showResult(r: ResultInfo): void {
    this.q('[data-ov="mode"]').textContent = r.mode.name + (r.mode.seeded ? ` ・ ${todayKey().slice(4, 6)}/${todayKey().slice(6)} の盤面` : '');
    this.q('[data-ov="title"]').textContent = r.mode.time ? '時間切れ' : '夜明け';
    const ext = r.mode.extend;
    this.q('[data-cont-sub]').textContent = ext?.time ? `${ext.time} 秒+全ペグ誘爆(1 回だけ)` : `ショット +${ext?.shots ?? 0}+全ペグ誘爆(1 回だけ)`;
    this.q('[data-ov="score"]').textContent = fmt(r.score);
    const best = this.q('[data-ov="best"]');
    best.textContent = r.newBest ? '自己ベスト更新!' : `自己ベスト ${fmt(r.best)} まで あと ${fmt(r.best - r.score)}`;
    best.classList.toggle('dim', !r.newBest);
    this.q('[data-ov="line"]').textContent = String(r.line);
    // ショットごとの棒グラフ(いちばん良かったショットは赤)
    const max = Math.max(1, ...r.history);
    const top = r.history.indexOf(max);
    this.q('[data-ov="history"]').innerHTML = r.history
      .map((v, i) => `<i class="${i === top ? 'top' : ''}" style="height:${Math.max(4, (v / max) * 100).toFixed(1)}%" title="${fmt(v)}"></i>`)
      .join('');
    this.q('[data-ov="shot"]').textContent = fmt(r.maxShot);
    this.q('[data-ov="combo"]').textContent = String(r.bestCombo);
    this.q('[data-ov="coins"]').textContent = fmt(r.coins);
    this.q('[data-ov="gap"]').textContent = `あと ${fmt(r.nextGap)} で LINE ${r.line + 1} だった`;
    const cont = this.q<HTMLButtonElement>('[data-act="continue"]');
    cont.hidden = !r.canContinue;
    const what = r.mode.time ? '時間を延長' : '夜を延長';
    this.q('[data-cont-label]').textContent = this.game.money.hasPass ? `${what}(パス特典)` : `広告を見て${what}`;
    this.q('.over-screen').hidden = false;
  }

  hideResult(): void {
    this.q('.over-screen').hidden = true;
  }
}
