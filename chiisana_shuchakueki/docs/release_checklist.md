# 公開チェックリスト

👤 = 人(持ち主)の作業が必要なもの。アカウント登録・本人確認・契約・署名・最終提出は
Claude にはできません。

ストアの規約や要件はよく変わります。**公開の直前に、必ず公式の最新情報を確認してください。**

## 1. アプリの基本情報

- [ ] 👤 アプリ ID を決める(今は仮の `com.example.chiisana_shuchakueki`。`com.example` のままでは
      Google Play に出せない)
  - Android:`android/app/build.gradle.kts` の `applicationId` と `namespace`
  - iOS:Xcode の Bundle Identifier
- [x] アプリの表示名「ちいさな終着駅」(Android・iOS・Web)
- [x] 縦画面に固定
- [ ] バージョン番号の運用を決める(`pubspec.yaml` の `version: 1.0.0+1`)
- [ ] アプリアイコン(今は Flutter の初期アイコン)
- [ ] 起動画面(スプラッシュ)

## 2. Android(Google Play)

- [ ] 👤 Google Play Console の開発者アカウント登録(登録料あり)と本人確認
- [ ] 👤 個人アカウントの場合のテスト要件(公開前に一定人数・一定期間のクローズドテストが
      求められる場合がある。最新の条件を確認)
- [ ] 👤 アップロード鍵(署名鍵)を作り、**リポジトリの外で**保管する。`key.properties` と鍵ファイルは
      Git に入れない
- [ ] `build.gradle.kts` に release 用の署名設定を追加(今は debug 署名のまま)
- [ ] 対象 API レベル:今は Flutter の既定で targetSdk 36 / minSdk 24。提出時点の Google Play の
      要件を満たしているか確認
- [ ] App Bundle(.aab)を作る:`flutter build appbundle`
- [x] 必要な権限の確認:今は特別な権限なし(shared_preferences・audioplayers も権限を追加しないことを確認)。
      広告 SDK を入れると広告 ID の権限が加わる
- [ ] データセーフティ(データの収集・共有の申告)
- [ ] コンテンツのレーティング(年齢区分)のアンケート
- [ ] ストアの説明文・スクリーンショット・フィーチャーグラフィック

## 3. iOS(App Store)

- [ ] 👤 Apple Developer Program 登録(年会費あり)
- [ ] 👤 Mac と Xcode を用意(iOS のビルドは Mac でしかできない)
- [ ] 👤 証明書・プロビジョニングプロファイル(署名の設定)
- [ ] 最低対応 iOS:今は 15.0
- [ ] App Store Connect でアプリを作成、TestFlight でテスト
- [ ] App のプライバシー(データ収集の申告)
- [ ] 年齢区分
- [ ] iPad の表示確認(縦固定のため `UIRequiresFullScreen` を設定済み)
- [x] 暗号化の申告:独自の暗号化は使っていないので `ITSAppUsesNonExemptEncryption = false`
      を設定済み(広告 SDK 追加後も HTTPS だけなら通常は対象外。提出時に確認)

## 4. プライバシー

- [x] プライバシーポリシー・利用規約の案をアプリ内(設定画面)に用意(`lib/ui/legal_texts.dart`)
- [ ] 👤 内容を確定し、連絡先を記入して、Web 上に公開 URL を用意する(ストアに載せる)
- [x] 現在(Phase 2)のアプリは、データを外部に送らない・集めない(保存は端末の中だけ)
- [ ] 広告 SDK・分析 SDK を入れたら、**実際に集めるデータを調べてから**申告する
      (推測で「集めていない」と申告しない)
- [ ] 広告の同意画面(EU などで必要。Google の UMP SDK など)
- [ ] iOS の App Tracking Transparency(トラッキングの許可を求める画面)が必要か判断する
- [ ] 子ども向け(13 歳未満など)を対象にするかを決める。対象にすると広告の規則が厳しくなる

## 5. 広告・課金(Phase 3)

- [ ] 👤 AdMob のアカウント・アプリ登録。広告ユニット ID は設定ファイルで管理し、
      **テスト用 ID と本番 ID を分ける**
- [ ] 開発中は必ずテスト広告を使う(本番広告を自分でタップすると規約違反になる)
- [ ] 👤 Google Play / App Store の商品(広告削除など)を登録。商品 ID は設定で管理する
- [ ] サンドボックス購入・ライセンステスターでテストする
- [ ] 購入の復元(非消費型商品)を実装・テストする
- [ ] 👤 有料アプリ・課金の契約、税と口座の情報(両ストア)

## 6. 秘密情報の管理

- [x] 今のリポジトリに秘密鍵・API キー・署名情報は入っていない
- [ ] 署名鍵・`key.properties`・`google-services.json` などを入れる場合は `.gitignore` に追加し、
      GitHub Actions では「Secrets」(GitHub に暗号化して預ける機能)を使う

## 7. 品質

- [ ] 👤 実機で音を確認(効果音の遅れ、BGM のつなぎ目、マナーモード・ほかのアプリの音楽との関係)
- [ ] 👤 実機でアプリを閉じて開き直し、進み具合が残っていることを確認
- [ ] 👤 Android 実機で最初から最後まで遊ぶ
- [ ] 👤 iOS 実機で最初から最後まで遊ぶ
- [ ] 古い端末・小さい画面での動作
- [ ] クラッシュや不具合の修正
- [x] 自動テスト(`flutter test`)がすべて通る
