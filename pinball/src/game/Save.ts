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
  bestWave: number;
  bestDamage: number;
  muted: boolean;
  speed: number;
}

const KEY = 'yorumado-pinball-v1';

const DEFAULT: SaveData = {
  coins: 0,
  meta: { atk: 0, balls: 0, hp: 0, coin: 0 },
  pass: false,
  bestWave: 0,
  bestDamage: 0,
  muted: false,
  speed: 1,
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
  { key: 'atk', name: '初期攻撃力 UP', desc: '基礎ダメージ +25% / Lv', icon: '▲', max: 20, cost: (lv) => Math.round(80 * Math.pow(1.6, lv)) },
  { key: 'balls', name: '初期ボール数 UP', desc: '毎ショットのボール +1 / Lv', icon: '●', max: 4, cost: (lv) => Math.round(500 * Math.pow(3, lv)) },
  { key: 'hp', name: '最大 HP UP', desc: '最大 HP +20 / Lv', icon: '♥', max: 15, cost: (lv) => Math.round(60 * Math.pow(1.5, lv)) },
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
        this.data = { ...this.data, ...d, meta: { ...DEFAULT.meta, ...(d.meta ?? {}) } };
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
