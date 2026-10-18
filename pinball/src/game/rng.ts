// 乱数。ふだんは Math.random。「今夜の一局(デイリー)」のときだけ、日付から作った
// 種(シード)つき乱数に切り替えて、同じ日なら誰でも同じ盤面・同じ強化カードになるようにする。
// 盤面用とカード用を別の流れにしておくと、遊び方が違っても並びが揃いやすい。

/** 種つき乱数。途中から再開できるよう、内部の状態(数 1 つ)を外から読み書きできる */
class Seeded {
  s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next = (): number => {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let board: Seeded | null = null;
let card: Seeded | null = null;

/** 盤面づくり用の乱数 */
export const boardRand = (): number => (board ? board.next() : Math.random());
/** 強化カードの抽選用の乱数 */
export const cardRand = (): number => (card ? card.next() : Math.random());

export function useSeed(seed: number | null): void {
  if (seed === null) {
    board = null;
    card = null;
  } else {
    board = new Seeded(seed);
    card = new Seeded(seed ^ 0x9e3779b9);
  }
}

/** 種つき乱数の今の状態(続きから遊ぶときの保存用)。種なしなら null */
export function seedState(): [number, number] | null {
  return board && card ? [board.s, card.s] : null;
}

export function restoreSeedState(st: [number, number] | null): void {
  if (!st) {
    useSeed(null);
    return;
  }
  board = new Seeded(0);
  card = new Seeded(0);
  board.s = st[0];
  card.s = st[1];
}

/** 今日の日付(端末の時刻)から「20261014」のような番号を作る */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
