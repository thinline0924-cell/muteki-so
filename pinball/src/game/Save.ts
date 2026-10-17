// localStorage への保存。プライベートブラウズなどで使えないときは、メモリ上だけで動く。

export interface MetaLevels {
  atk: number;
  balls: number;
  hp: number;
  coin: number;
}

export interface SaveData {
  coins: number;
  meta: MetaLevels;
  pass: boolean;
  /** 自己ベスト(最終スコア)と、その時に越えたライン数 */
  bestScore: number;
  bestLine: number;
  /** 1 ショットの最大スコア */
  bestDamage: number;
  /** モードごとの自己ベスト(今夜の一局は「daily-20261014」のように日付つき) */
  bests: Record<string, number>;
  muted: boolean;
  speed: number;
  /** 遊び方の自動表示:first = まだ見ていない / on = 毎回 / off = 出さない */
  howto: 'first' | 'on' | 'off';
}

const KEY = 'yorumado-pinball-v1';

const DEFAULT: SaveData = {
  coins: 0,
  meta: { atk: 0, balls: 0, hp: 0, coin: 0 },
  pass: false,
  bestScore: 0,
  bestLine: 0,
  bestDamage: 0,
  bests: {},
  muted: false,
  speed: 1,
  howto: 'first',
};

export interface MetaDef {
  key: keyof MetaLevels;
  name: string;
  desc: string;
  icon: string;
  max: number;
  cost(lv: number): number;
}

export const META: MetaDef[] = [
  { key: 'atk', name: '初期攻撃力 UP', desc: '基礎スコア +25% / Lv', icon: '▲', max: 10, cost: (lv) => Math.round(80 * Math.pow(1.6, lv)) },
  { key: 'balls', name: '初期ボール数 UP', desc: '毎ショットのボール +1 / Lv', icon: '●', max: 2, cost: (lv) => Math.round(500 * Math.pow(3, lv)) },
  // 保存のキーは昔の名前(hp)のまま。中身は「はじめのショット数」
  { key: 'hp', name: '夜の長さ UP', desc: '一晩モードのショット +1 / Lv', icon: '☾', max: 5, cost: (lv) => Math.round(120 * Math.pow(1.7, lv)) },
  { key: 'coin', name: 'コイン獲得 UP', desc: '獲得コイン +25% / Lv', icon: '¥', max: 10, cost: (lv) => Math.round(150 * Math.pow(1.7, lv)) },
];

export class Save {
  data: SaveData;

  constructor() {
    this.data = structuredClone(DEFAULT);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SaveData>;
        this.data = { ...this.data, ...d, meta: { ...DEFAULT.meta, ...(d.meta ?? {}) }, bests: { ...(d.bests ?? {}) } };
      }
      // 昔の自己ベスト(一晩モード)を引き継ぐ
      if (this.data.bestScore > (this.data.bests.night ?? 0)) this.data.bests.night = this.data.bestScore;
      // 強化の上限を下げたので、上限を超えて育てていた分はコインで返す
      for (const m of META) {
        while (this.data.meta[m.key] > m.max) {
          this.data.meta[m.key]--;
          this.data.coins += m.cost(this.data.meta[m.key]);
        }
      }
    } catch {
      /* 保存が使えない環境 */
    }
  }

  write(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* 保存が使えない環境 */
    }
  }
}
