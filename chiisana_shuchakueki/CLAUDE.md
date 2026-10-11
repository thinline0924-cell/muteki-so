# CLAUDE.md — ちいさな終着駅(このフォルダの Flutter アプリ)

リポジトリ直下の CLAUDE.md は「霧笛荘事件」(素の HTML/JS)用のルール。
**このフォルダには当てはまらない**(ここは Flutter / Dart のアプリ)。
持ち主はプログラミング初心者。説明は日本語で、専門用語には短い説明を付ける。

## 約束
1. パズルのルール(`lib/puzzle/`)は Flutter を import しない純粋な Dart。画面の都合でルールを変えない
2. 判定は `RouteSimulator` が先に計算し、画面はその結果を再生するだけ
3. ステージは `assets/stages/*.json`。作り直しは `dart run tool/build_stages.dart`。手で JSON を書き換えたら
   `flutter test` で全ステージの検査(解ける・使い回しなし・★3 = 最少手数)を通す
4. 外部パッケージは必要性を確かめてから追加する(今は shared_preferences と audioplayers の 2 個)
5. 外部の画像・音声素材は使わない。絵は `lib/ui/painters/` で描き、音は `tool/build_sounds.dart` で合成する
6. 町・コレクションのアイテムは `assets/data/catalog.json`。ルールは `lib/game/town.dart`(純粋な Dart)
7. 進行状況を変えたら GameController 経由で保存する。セーブデータの形を変えたら `PlayerProgress.fromJson` で古い形も読めるようにする
8. 秘密鍵・署名情報・API キー・本番の広告 ID をコミットしない
9. 未実装の機能を実装済みと書かない。docs/test_plan.md と README の「いまの状態」を更新する

## 開発の順番(指示書より)
Phase 0 調査と設計(済) → Phase 1 最小プレイ可能版(済) → Phase 2 50 ステージ・保存・町・コレクション・
効果音・チュートリアル(済) → Phase 3 広告・課金 → Phase 4 公開準備

## 確認
- `flutter analyze` と `flutter test` が通ること
- 画面を変えたら、小さい画面(320×568)でもはみ出さないこと(test/ui/screens_test.dart)
- この作業環境では Android SDK が入らないため、APK は GitHub Actions(.github/workflows/chiisana_shuchakueki.yml)で作る
