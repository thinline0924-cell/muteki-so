# CLAUDE.md — このリポジトリで作業するときのルール

推理アドベンチャー「霧笛荘事件」。ブラウザで開くだけで動く静的サイト。
持ち主はプログラミング初心者。**説明は日本語で、専門用語には短い説明を付ける。**

## 持ち主の環境
- パソコンに Node.js は入っていない。ローカル実行や `npm install` を前提にしない
- 公開は Render の静的サイト(`render.yaml`)。`index.html` をダブルクリックしても遊べること(file:// で動くこと)を保つ

## 約束
1. **ビルドツールを入れない。** 素の HTML / CSS / JavaScript。React・bundler・TypeScript・ES modules(`import`)は使わない(file:// で動かなくなる)
2. 画像・音声ファイルは使わない。絵は `js/pixel.js`、音は `js/audio.js` がその場で作る
3. 配色は灰緑+白+赤(血と大事な手がかりだけ)。タイトル画面は参考画像に似せすぎない(持ち主の指摘で作り直した)
4. 事件は `js/scenario.js` が事件番号(seed)から組み立てる。同じ番号なら同じ事件になること(乱数は seeded() だけを使う)
5. どの事件番号でも解けること。変更したら、いくつかの番号で最後まで通しプレイして TRUE END に届くか確かめる

## ファイル
| ファイル | 役割 |
|---|---|
| `index.html` | 画面の骨組み |
| `css/style.css` | 見た目(スマホ縦向きにも対応) |
| `js/scenario.js` | 事件ジェネレーター。出力は game.js が読む STORY の形 |
| `js/game.js` | 進行(タイトル・事件の準備・文章・選択肢・時間・セーブ・推理・対決) |
| `js/pixel.js` | ドット絵(320×180)。`Pixel.draw / portrait / hotspots / personSpots` |
| `js/audio.js` | Web Audio で BGM・環境音・効果音を合成。`Sound.bgm / ambient / se` |

## 別アプリ:`chiisana_shuchakueki/`
線路パズル「ちいさな終着駅」(Flutter 製のスマホアプリ)。上の約束は「霧笛荘事件」用で、このフォルダには当てはまらない。
ルールは `chiisana_shuchakueki/CLAUDE.md` を見る。
