# ステージの形式

ステージは `assets/stages/` に JSON で置きます。

```
assets/stages/
├─ index.json      読みこむファイルの一覧  {"packs": ["world_01.json", ...]}
└─ world_01.json   ワールド 1 のステージ集
```

## 1. ステージ集(world_XX.json)

```json
{
  "world": 1,
  "name": "はじまりの町",
  "stages": [ ...ステージ... ]
}
```

## 2. ステージ

```json
{
  "id": "1-2",
  "world": 1,
  "number": 2,
  "name": "まがり角",
  "difficulty": 1,
  "size": { "width": 5, "height": 5 },
  "grid": [
    "^   ..  ..  ..  ^",
    "..  S2  ..  ..  ..",
    "..  L3  I1  L1  ..",
    "..  ..  ..  I0  ..",
    "~   ..  ..  G0  .."
  ],
  "stars": { "three": 2, "two": 4 },
  "reward": { "coins": 15, "firstClearBonus": 30 },
  "tutorial": "curve",
  "unlock": { "afterStage": "1-1", "minTotalStars": 0 }
}
```

| 項目 | 必須 | 内容 |
|---|---|---|
| id | ○ | ステージ ID。全ステージで重複しないこと |
| world, number | ○ | ワールド番号・ワールド内の番号(1 以上) |
| name | ○ | 画面に出す名前 |
| difficulty | | 難易度(1 以上。省略すると 1) |
| size | ○ | 盤面の幅と高さ(2〜9) |
| grid | ○ | 盤面。`height` 行、各行に `width` 個の記号をスペース区切りで書く |
| stars | ○ | `three`:★3 になる最大手数(1 以上)、`two`:★2 になる最大手数(three 以上) |
| reward | ○ | `coins`:毎回のコイン、`firstClearBonus`:初回だけの追加コイン(0 以上) |
| tutorial | | `rotate` / `curve` / `stars` / `fixed` / `obstacle` / `cross` / `tee`(初めて遊ぶときに説明が出る。`rotate` は指で教えるモード) |
| unlock | | `afterStage`:クリアが必要なステージ ID、`minTotalStars`:必要な合計の星 |

## 3. マスの記号

| 記号 | 意味 |
|---|---|
| `..` | 草地 |
| `#` / `^` / `~` | 岩 / 木 / 池(通れない) |
| `S0`〜`S3` | 出発駅。数字は列車が出ていく向き(0=北, 1=東, 2=南, 3=西) |
| `G0`〜`G3` | 目的地の駅。数字は列車が入ってくる側(0=北, 1=東, 2=南, 3=西) |
| `I0`〜`I3` | 直線。0 で北-南、1 で東-西 |
| `L0`〜`L3` | カーブ。0 で北-東、1 で東-南、2 で南-西、3 で西-北 |
| `T0`〜`T3` | T字。0 で東-南-西(北がふさがっている)、回すごとに時計回り |
| `X0` | 十字(回せない) |
| 末尾の `!` | 固定タイル(例 `L2!`)。回せない |

数字は「回転 0 の形から、時計回りに 90° を何回回したか」です。grid に書く向きは
**遊び始めたときの向き**(バラバラの状態)です。

## 4. 読みこみ時の検査

次のような問題があるステージは、エラーとして記録して**そのステージだけ飛ばします**
(アプリは止まりません)。

- id・name・size・grid・stars・reward がない、型がちがう
- grid の行数・マスの数が size と合わない、読めない記号がある
- 出発駅・目的地がない、または 2 つ以上ある
- 駅が盤面の外を向いている
- stars.three < 1、stars.two < stars.three、報酬がマイナス
- id の重複

## 5. 自動テストでの検査(test/puzzle/stage_assets_test.dart)

- すべてのステージ集がエラーなしで読める
- 開放条件が実在するステージを指している
- 盤面の配置が他のステージと同じでない(使い回しの防止)
- **最初から解けてはいない**
- **ソルバーで解ける**(解き方どおりに回すと実際にクリアになる)
- ★3 の基準がソルバーの最少手数と一致し、★2 の基準がそれより大きい

## 6. ステージの作り方

`tool/build_stages.dart` にステージの一覧があります。手作りの盤面は grid を直接書き、
自動生成のものは条件と乱数の種(seed)を書きます。

| 条件 | 意味 |
|---|---|
| width / height | 盤面の大きさ |
| minPath / maxPath | 正解の経路の長さ(駅を除くマス数) |
| minTurns | 曲がる回数の最低 |
| crossings | 十字で交差する回数 |
| pathTees | 経路の上に置く T字の数 |
| decoys / decoyTees | まどわせる線路の数 / その中に T字を混ぜるか |
| obstacles | 障害物の数 |
| fixedPath | 正しい向きで固定する経路上の線路の数 |
| minMoves / maxMoves | 最少手数の範囲(外れたら作り直す) |

```
cd chiisana_shuchakueki
dart run tool/build_stages.dart
```

実行すると、各ステージの盤面と最少手数を表示しながら `assets/stages/` の JSON を作り直します。
解けない・最初から解けている・盤面が重複している場合はエラーで止まります。
そのあと `flutter test` で全ステージの検査を通してください。
