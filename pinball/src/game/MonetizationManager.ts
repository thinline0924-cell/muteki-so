// 広告・課金のモック(見本)。本物の広告 SDK や決済は一切つながっていない。
// リワード広告 = 最後まで見ると報酬がもらえる広告。

import type { AudioEngine } from './AudioEngine';
import type { Save } from './Save';

export type AdPlacement = 'reroll' | 'boost' | 'continue';

const AD_SECONDS = 2;

const FAKE_ADS = [
  { title: 'にゃんにゃん横丁', sub: 'ねこカフェ経営シミュレーション', mark: '猫' },
  { title: 'ぷかぷか金魚鉢', sub: '放置で増える、癒やしのアクアリウム', mark: '金' },
  { title: 'たこ焼き職人', sub: 'くるっと返して、大阪の夜をつくろう', mark: '蛸' },
];

const LABEL: Record<AdPlacement, string> = {
  reroll: '強化カードを引き直し',
  boost: '今回のショットだけボール 2 倍',
  continue: '夜を延長(ショット +3+全ペグ誘爆)',
};

export class MonetizationManager {
  busy = false;
  private save: Save;
  private audio: AudioEngine;
  private host: HTMLElement;
  private toast: (msg: string) => void;
  private adIndex = 0;

  constructor(save: Save, audio: AudioEngine, host: HTMLElement, toast: (msg: string) => void) {
    this.save = save;
    this.audio = audio;
    this.host = host;
    this.toast = toast;
  }

  get hasPass(): boolean {
    return this.save.data.pass;
  }

  /** リワード広告を「再生」して、見終わったら true を返す */
  showRewardedAd(placement: AdPlacement): Promise<boolean> {
    if (this.busy) return Promise.resolve(false);
    if (this.hasPass) {
      this.toast('パス特典:広告なしで報酬ゲット!');
      this.audio.coin();
      return Promise.resolve(true);
    }
    this.busy = true;
    const ad = FAKE_ADS[this.adIndex++ % FAKE_ADS.length];
    const el = document.createElement('div');
    el.className = 'ad-overlay';
    el.innerHTML = `
      <div class="ad-head"><span class="ad-tag">広告</span><span class="ad-timer">広告再生中...(残り${AD_SECONDS}秒)</span></div>
      <div class="ad-body">
        <div class="ad-mark">${ad.mark}</div>
        <div class="ad-title">${ad.title}</div>
        <div class="ad-sub">${ad.sub}</div>
        <div class="ad-cta">今すぐプレイ</div>
      </div>
      <div class="ad-bar"><i></i></div>
      <div class="ad-reward">報酬:${LABEL[placement]}</div>
      <div class="ad-note">※デモ用の広告モックです(架空のアプリ・実際の広告ではありません)</div>`;
    this.host.appendChild(el);
    const timer = el.querySelector<HTMLElement>('.ad-timer')!;
    const bar = el.querySelector<HTMLElement>('.ad-bar i')!;
    requestAnimationFrame(() => {
      bar.style.transition = `width ${AD_SECONDS}s linear`;
      bar.style.width = '100%';
    });
    return new Promise((resolve) => {
      let left = AD_SECONDS;
      const iv = window.setInterval(() => {
        left--;
        if (left > 0) {
          timer.textContent = `広告再生中...(残り${left}秒)`;
          return;
        }
        window.clearInterval(iv);
        timer.textContent = '再生完了!';
        el.classList.add('done');
        el.querySelector('.ad-reward')!.textContent = '報酬を獲得しました!';
        this.audio.coin();
        window.setTimeout(() => {
          el.remove();
          this.busy = false;
          resolve(true);
        }, 650);
      }, 1000);
    });
  }

  /** ¥600 パスのモック購入。決済処理中の演出のあと、解放する */
  purchasePass(): Promise<boolean> {
    if (this.hasPass) return Promise.resolve(true);
    this.busy = true;
    return new Promise((resolve) => {
      window.setTimeout(() => {
        this.save.data.pass = true;
        this.save.write();
        this.busy = false;
        this.audio.purchase();
        resolve(true);
      }, 900);
    });
  }

  /** デバッグ用:購入状態を元に戻す */
  resetPurchase(): void {
    this.save.data.pass = false;
    this.save.write();
  }
}
