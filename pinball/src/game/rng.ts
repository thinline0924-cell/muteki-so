// 乱数。ふだんは Math.random。「今夜の一局(デイリー)」のときだけ、日付から作った
// 種(シード)つき乱数に切り替えて、同じ日なら誰でも同じ盤面・同じ強化カードになるようにする。
// 盤面用とカード用を別の流れにしておくと、遊び方が違っても並びが揃いやすい。

type RandFn = () => number;

function mulberry32(seed: number): RandFn {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let board: RandFn = Math.random;
let card: RandFn = Math.random;

/** 盤面づくり用の乱数 */
export const boardRand = (): number => board();
/** 強化カードの抽選用の乱数 */
export const cardRand = (): number => card();

export function useSeed(seed: number | null): void {
  if (seed === null) {
    board = Math.random;
    card = Math.random;
  } else {
    board = mulberry32(seed);
    card = mulberry32(seed ^ 0x9e3779b9);
  }
}

/** 今日の日付(端末の時刻)から「20261014」のような番号を作る */
export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
