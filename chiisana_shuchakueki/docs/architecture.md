# 設計(アーキテクチャ) — ちいさな終着駅

## 1. 採用した技術と理由

| 技術 | 用途 | 理由 |
|---|---|---|
| Flutter 3.47 / Dart 3.13 | アプリ全体 | 1 つのコードで Android と iOS の両方を作れる。個人で保守しやすい |
| CustomPainter(Flutter 標準) | 盤面・線路・列車・景色の描画 | 単純な 2D パズルなのでゲームエンジン(Flame など)は不要。依存を増やさない |
| JSON | ステージデータ | コードを変えずにステージを追加・修正できる。人が読める |
| flutter_localizations(Flutter 同梱) | 日本語表示 | 端末で漢字を日本語の字形で表示させるため(中国語の字形になるのを防ぐ) |
| shared_preferences(Phase 2 で追加予定) | セーブデータ | 小さなデータの保存に十分。データ層を分けておくので、必要なら SQLite へ移せる |
| google_mobile_ads / in_app_purchase(Phase 3) | 広告・課金 | 公式に近いパッケージ。導入時に互換性と保守状況を確認する |

**今の外部パッケージは 0 個**です(Flutter に最初から入っているものだけ)。

## 2. フォルダ構成

```
chiisana_shuchakueki/
├─ lib/
│  ├─ main.dart              起動(縦画面に固定)
│  ├─ app.dart               アプリの土台(テーマ、日本語、ステージの読みこみ)
│  ├─ puzzle/                ★パズルのルール。Flutter に依存しない純粋な Dart
│  │  ├─ direction.dart       方向と接続マスク
│  │  ├─ tile.dart            マスの種類・回転・通り方
│  │  ├─ board.dart           盤面(変更できない値)
│  │  ├─ route.dart           経路の検証(ループ・盤面外の検出)
│  │  ├─ session.dart         遊んでいる間の状態(手数・1手戻す・リセット・走行中ロック)
│  │  ├─ rating.dart          星の評価
│  │  ├─ solver.dart          最少手数の解き方とヒント
│  │  └─ stage.dart           ステージ JSON の読みこみと検査
│  ├─ game/                  ゲーム全体の状態
│  │  ├─ progress.dart        進行状況(セーブデータの中身)
│  │  ├─ stage_loader.dart    アセットからステージを読む
│  │  └─ game_controller.dart ステージ一覧+進行状況。画面に変化を知らせる
│  └─ ui/                    画面と描画
│     ├─ screens/             タイトル・ステージ選択・パズル
│     ├─ widgets/             盤面・クリア画面・ボタン類
│     ├─ painters/            線路・駅・障害物・列車・景色の絵
│     └─ route_geometry.dart  経路の結果 → 列車アニメーション用の線と弧
├─ assets/stages/            ステージ JSON(index.json + world_XX.json)
├─ tool/                     開発用の道具(アプリには入らない)
│  ├─ build_stages.dart       ステージ JSON を作る
│  ├─ stage_generator.dart    盤面の自動生成
│  └─ preview/                全ステージ開放で起動する確認用の入口
├─ test/                     自動テスト
└─ docs/                     このドキュメント
```

## 3. 層の分け方

```
 ui/(画面・絵)  ──見る──▶  game/(状態)  ──使う──▶  puzzle/(ルール)
       │                                              ▲
       └────────── 経路の結果を受け取って再生する ───────┘
```

- `puzzle/` は Flutter を一切 import しない。画面の都合でルールを変えない
- 判定は `RouteSimulator.run()` が先に全部計算し、`RouteResult`(通ったマスの列と結果)を返す。
  画面は `route_geometry.dart` でそれを線と弧に変えて、列車を動かすだけ
- 走行中は `PuzzleSession` がロックされ、回す・戻す・リセット・再出発を受け付けない
  (画面側でもボタンを無効にしている)
- 状態管理は Flutter 標準の `ChangeNotifier` + `InheritedNotifier`(画面全体で状態を共有する
  しくみ)だけ。外部ライブラリは使っていない

## 4. データ構造

### 4.1 StageDefinition(実装済み)
形式の詳細は [stage_format.md](stage_format.md)。

| 項目 | 内容 |
|---|---|
| id / world / number | ステージ ID("1-3")、ワールド番号、ワールド内の番号 |
| name / difficulty | 名前、難易度(1〜) |
| size + grid | 盤面の大きさと、マスの記号の並び(種類・初期回転・固定を含む) |
| stars | ★3・★2 の基準手数 |
| reward | 毎回のコイン、初回ボーナス |
| tutorial | チュートリアルの種類(なければなし) |
| unlock | 前に必要なステージ、必要な合計の星 |

出発駅と目的地は grid の中の `S`・`G` で表し、ちょうど 1 つずつあるかを検査します。

### 4.2 PlayerProgress(実装済み・保存は Phase 2)

| 項目 | 内容 |
|---|---|
| version | セーブデータの形式の版(今は 1) |
| lastPlayedStage | 最後に遊んだステージ |
| records | ステージごとの記録(クリア済みか・最高の星・最少手数) |
| coins | 所持コイン(0〜9,999,999) |
| unlockedItems | 開放済みのアイテム ID |
| placedBuildings | 町のスロット ID → 置いた建物 ID |
| settings | BGM・効果音の音量、振動のオン/オフ |

`toJson()` / `fromJson()` を用意済み。`fromJson()` は欠けた値・型ちがい・範囲外の値を安全な
初期値に直すので、こわれたセーブデータでもクラッシュしません。形式を変えるときは
`saveVersion` を上げ、古い版を読み替える処理を `fromJson()` に足します。

### 4.3 CollectibleItem(Phase 2 で実装予定)

| 項目 | 内容 |
|---|---|
| id | 一意の ID(例 `train_hidamari`) |
| type | train / station / building / decoration / resident |
| name / description | 表示名、説明文 |
| unlock | 取得条件(コインで購入 / 星の合計 / ステージクリア など) |
| price | ゲーム内価格(コイン。購入できないものは null) |
| asset | 絵の参照先(今はコードで描く絵の名前) |

アイテムの定義も `assets/data/collectibles.json` に JSON で置く予定です。

## 5. 保存の設計(Phase 2)

- `ProgressStore`(保存の窓口)を抽象クラスにして、本番は SharedPreferences、テストはメモリ上の
  実装を使う
- 保存のタイミング:クリアしたとき、コインを使ったとき、設定を変えたとき、アプリが
  バックグラウンドに回ったとき
- 1 つのキーに JSON 文字列でまとめて保存する。読めなければ初期状態から始め、こわれたデータは
  別のキーに退避する(あとで調べられるように)

## 6. 技術上のリスク

| リスク | 対策 |
|---|---|
| ステージが増えるとソルバーが遅くなる(7×7 で線路が多いとき) | 枝刈りつきの探索で、10 ステージの検証は全部で 1 秒未満。7×7 を入れるときに時間を測り、遅ければ探索を改良する |
| 小さい画面で 7×7 のマスが小さくなる | 幅 360 の画面で 1 マス 40 ピクセル前後。小さい画面では余白を詰める処理を入れ済み。テストで確認する |
| Android の大画面では縦固定が無視される(Android 16 以降) | 横長の画面でも盤面が収まるレイアウトにしている(1024×1366 でテスト済み) |
| 広告 SDK の追加でアプリが重くなる・審査要件が増える | Phase 3 で導入。データ収集の申告と同意画面(UMP)を release_checklist で管理 |
| この作業環境では Android/iOS のビルドができない | GitHub Actions で Android のビルドとテストを自動で行う。iOS は Mac が必要 |
