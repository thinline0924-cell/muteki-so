# ちいさな終着駅

小さな列車を正しい線路へ導き、クリアするたびに小さな終着駅の町が育っていく、
スマートフォン向けの線路パズルです(Flutter 製。Android / iOS 向け)。

> このフォルダは、同じリポジトリの推理アドベンチャー「霧笛荘事件」とは**別のアプリ**です。

## いまの状態(Phase 1:最小プレイ可能版)

できること
- タイトル → ステージ選択 → パズル → クリア画面 の流れ
- 線路をタップで回す、1手戻す、リセット、ヒント、出発
- 列車が線路にそって走るアニメーション。失敗すると止まって理由を表示
- 星 1〜3 の評価とコイン(初回クリアボーナスあり)
- ワールド 1「はじまりの町」の 10 ステージ(すべて自動テストで解けることを確認済み)

まだできないこと(次の段階で作る)
- 進行状況の保存(今はアプリを閉じると最初からになる)
- 町づくり・コレクション・設定画面(タイトルに「準備中」と表示)
- 効果音・BGM、ステージ 11〜50、広告・課金、ストア公開の準備

## 遊んでみる(Android)

パソコンに何も入れなくても、GitHub が自動で作った APK(Android アプリのファイル)で試せます。

1. GitHub のこのリポジトリで **Actions** タブを開く
2. 「ちいさな終着駅」のいちばん新しい実行(緑のチェック)を開く
3. 下の **Artifacts** から `chiisana-shuchakueki-apk` をダウンロードして zip を開く
4. 中の `app-release.apk` を Android 端末に送り、開いてインストールする
   (「提供元不明のアプリ」の許可を求められたら許可する。テスト用の署名なのでストアには出せません)

iPhone で試すには Mac と Xcode が必要です。

## 開発する

Flutter(3.47 以上)を入れたパソコンで:

```
cd chiisana_shuchakueki
flutter pub get
flutter test                 # 自動テスト
flutter run                  # つないだ端末やエミュレーターで起動
flutter run -d chrome        # ブラウザで起動
dart run tool/build_stages.dart   # ステージ JSON を作り直す
```

全ステージを開放した状態で見た目を確かめたいときは
`flutter run -t tool/preview/main_preview.dart`。

## ドキュメント

| ファイル | 内容 |
|---|---|
| [docs/requirements.md](docs/requirements.md) | 要件、開発環境の調査結果、作業中に置いた仮定 |
| [docs/game_design.md](docs/game_design.md) | ルール、星と報酬、ステージ構成、町・コレクション、画面 |
| [docs/architecture.md](docs/architecture.md) | 技術構成、フォルダ、データ構造、リスク |
| [docs/stage_format.md](docs/stage_format.md) | ステージ JSON の書き方と検査 |
| [docs/test_plan.md](docs/test_plan.md) | テストの一覧と状況 |
| [docs/release_checklist.md](docs/release_checklist.md) | 公開までのチェックリスト(人の作業を含む) |

## 素材について

画像・音声ファイルは使っていません。絵はすべてコード(`lib/ui/painters/`)で描いた仮素材です。
外部の素材を使う場合は、商用利用とアプリ配布が許可されていることを確認し、
ライセンスをここに記録します。
