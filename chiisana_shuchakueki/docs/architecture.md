# 設計(アーキテクチャ) — ちいさな終着駅

## 1. 採用した技術と理由

| 技術 | 用途 | 理由 |
|---|---|---|
| Flutter 3.47 / Dart 3.13 | アプリ全体 | 1 つのコードで Android と iOS の両方を作れる。個人で保守しやすい |
| CustomPainter(Flutter 標準) | 盤面・線路・列車・景色の描画 | 単純な 2D パズルなのでゲームエンジン(Flame など)は不要。依存を増やさない |
| JSON | ステージデータ | コードを変えずにステージを追加・修正できる。人が読める |
| flutter_localizations(Flutter 同梱) | 日本語表示 | 端末で漢字を日本語の字形で表示させるため(中国語の字形になるのを防ぐ) |
| shared_preferences 2.5 | セーブデータ | Flutter 公式。小さなデータの保存に十分。保存の窓口(ProgressStore)を分けてあるので、必要なら SQLite へ移せる |
| audioplayers 6.8 | 効果音・BGM | 広く使われ、Android・iOS・Web に対応。追加の権限は不要(確認済み) |
| google_mobile_ads / in_app_purchase(Phase 3) | 広告・課金 | 公式に近いパッケージ。導入時に互換性と保守状況を確認する |

**外部パッケージは 2 個**(shared_preferences と audioplayers)です。

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
│  ├─ game/                  ゲーム全体の状態(town.dart まで Flutter に依存しない)
│  │  ├─ progress.dart        進行状況(セーブデータの中身)
│  │  ├─ catalog.dart         町・コレクションのアイテム定義の読みこみと検査
│  │  ├─ town.dart            買う・置く・片づける・獲得条件のルール
│  │  ├─ progress_store.dart  保存の窓口(端末用 / テスト用)
│  │  ├─ sound.dart           効果音・BGM(鳴らせなくてもゲームは止まらない)
│  │  ├─ stage_loader.dart    アセットからステージを読む
│  │  └─ game_controller.dart 全体の状態。変更のたびに保存し、画面に知らせる
│  └─ ui/                    画面と描画
│     ├─ screens/             タイトル・ステージ選択・パズル・町・お店・図鑑・設定
│     ├─ widgets/             盤面・クリア画面・獲得の知らせ・ボタン類
│     ├─ painters/            線路・駅・障害物・列車・景色・町・アイテムの絵
│     ├─ legal_texts.dart     データの保存について・プライバシーポリシー・利用規約(案)
│     └─ route_geometry.dart  経路の結果 → 列車アニメーション用の線と弧
├─ assets/stages/            ステージ JSON(index.json + world_01〜05.json)
├─ assets/data/catalog.json  町・コレクションのアイテムと区画
├─ assets/sounds/            効果音・BGM(自作の合成音)
├─ tool/                     開発用の道具(アプリには入らない)
│  ├─ build_stages.dart       ステージ JSON を作る
│  ├─ stage_generator.dart    盤面の自動生成
│  ├─ build_sounds.dart       効果音・BGM を合成する
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

### 4.2 PlayerProgress(実装済み)

| 項目 | 内容 |
|---|---|
| version | セーブデータの形式の版(今は 1) |
| lastPlayedStage | 最後に遊んだステージ |
| records | ステージごとの記録(クリア済みか・最高の星・最少手数) |
| coins | 所持コイン(0〜9,999,999) |
| unlockedItems | 開放済みのアイテム ID |
| placedBuildings | 町のスロット ID → 置いた建物 ID |
| settings | BGM・効果音の音量、振動のオン/オフ |
| selectedTrain / selectedStation | 走らせる列車・町の駅舎 |
| seenItems | 図鑑で見たアイテム(NEW の印に使う) |
| tutorialsSeen | 見終わったチュートリアル |

`toJson()` / `fromJson()` を用意済み。`fromJson()` は欠けた値・型ちがい・範囲外の値を安全な
初期値に直すので、こわれたセーブデータでもクラッシュしません。形式を変えるときは
`saveVersion` を上げ、古い版を読み替える処理を `fromJson()` に足します。

### 4.3 CollectibleItem(実装済み)

| 項目 | 内容 |
|---|---|
| id | 一意の ID(例 `train_hidamari`) |
| type | train / station / building / decoration / resident |
| name / description | 表示名、説明文 |
| unlock | 取得条件:start(最初から)/ purchase(お店)/ stars(星の合計)/ clear(ステージ)/ placed(町に置いた)/ town(置いた数) |
| price | ゲーム内価格(コイン。購入できないものはなし) |
| size | 置ける区画の大きさ(large / small) |
| art / colors | 絵の種類と色(コードで描く絵の名前) |

定義は `assets/data/catalog.json` にあり、区画(slots:ID・大きさ・位置)も同じファイルに書きます。
読みこむときに、ID の重複・値段・区画の大きさ・条件の参照先・最初の列車と駅舎の有無を検査します。

## 5. 保存のしくみ(実装済み)

- `ProgressStore`(保存の窓口)を抽象クラスにして、本番は `PrefsProgressStore`(SharedPreferences)、
  テストは `MemoryProgressStore` を使う
- 保存のタイミング:進行状況が変わるたび(クリア・購入・配置・選択・設定・チュートリアル)と、
  アプリがバックグラウンドに回ったとき。保存は順番に 1 つずつ行い、古い内容で上書きしない
- キー `progress` に JSON 文字列でまとめて保存する。読めなければ最初から始め、こわれたデータは
  `progress_broken` に退避する
- 読みこんだあと `TownRules.sanitize()` で、今のカタログにない区画・アイテムや、持っていないのに
  置いてあるものを取りのぞく(アップデートで中身が変わっても壊れない)

## 5.5 音のしくみ

- `SoundService` を窓口にして、本番は `AudioSoundService`(audioplayers)、テストは `SilentSound`
- iOS は ambient(消音スイッチに従い、ほかのアプリの音楽を止めない)、Android は game 用途で
  音声フォーカスを取らない
- 音の再生でエラーが起きても記録するだけで、ゲームは止めない
- アプリがバックグラウンドに回ると BGM を止め、戻ると再開する

## 6. 技術上のリスク

| リスク | 対策 |
|---|---|
| ステージが増えるとソルバーが遅くなる(7×7 で線路が多いとき) | 枝刈りつきの探索で、10 ステージの検証は全部で 1 秒未満。7×7 を入れるときに時間を測り、遅ければ探索を改良する |
| 小さい画面で 7×7 のマスが小さくなる | 幅 360 の画面で 1 マス 40 ピクセル前後。小さい画面では余白を詰める処理を入れ済み。テストで確認する |
| Android の大画面では縦固定が無視される(Android 16 以降) | 横長の画面でも盤面が収まるレイアウトにしている(1024×1366 でテスト済み) |
| 広告 SDK の追加でアプリが重くなる・審査要件が増える | Phase 3 で導入。データ収集の申告と同意画面(UMP)を release_checklist で管理 |
| この作業環境では Android/iOS のビルドができない | GitHub Actions で Android のビルドとテストを自動で行う。iOS は Mac が必要 |
| 音の鳴り方は実機でしか確かめられない | テストでは音を出さない実装を使う。実機で音量・遅れ・ほかのアプリとの関係を確認する(release_checklist) |
| Web 版はブラウザの決まりで、最初のタップまで BGM が鳴らない | 主な対象はスマホアプリなので対応は後回し |
