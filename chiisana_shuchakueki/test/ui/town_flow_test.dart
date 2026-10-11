import 'package:chiisana_shuchakueki/app.dart';
import 'package:chiisana_shuchakueki/game/game_controller.dart';
import 'package:chiisana_shuchakueki/game/progress_store.dart';
import 'package:chiisana_shuchakueki/game/town.dart';
import 'package:chiisana_shuchakueki/ui/screens/puzzle_screen.dart';
import 'package:chiisana_shuchakueki/ui/widgets/common.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_app.dart';

Future<void> back(WidgetTester tester) async {
  await tester.tap(find.byType(RoundBackButton).last);
  await settle(tester);
}

void main() {
  testWidgets('町:お店で買って、区画に置き、住民がやってくる', (tester) async {
    setScreen(tester, 390, 844);
    final game = await startApp(tester);
    game.progress.recordClear(game.stages.first, 1);
    for (var i = 0; i < 20; i++) {
      game.progress.recordClear(game.stages.first, 1); // コインをためる
    }
    final coins = game.progress.coins;

    await tester.tap(find.byKey(const ValueKey('town')));
    await settle(tester);
    expect(find.text('さびしい駅前'), findsOneWidget);
    // 最初のヒントを閉じる
    await tester.tap(find.byTooltip('閉じる'));
    await settle(tester, 300);
    expect(game.tutorialSeen('town'), isTrue);

    // お店でベンチを買う
    await tester.tap(find.byKey(const ValueKey('shop')));
    await settle(tester);
    await tester.tap(find.text('装飾'));
    await settle(tester, 600);
    await tester.tap(find.byKey(const ValueKey('buy-bench')));
    await settle(tester, 400);
    final bench = game.catalog.item('bench')!;
    expect(game.progress.coins, coins - bench.price!);
    expect(find.text('持っている'), findsWidgets);
    await back(tester);

    // 小さな区画に置く → ねこがやってくる
    await tester.tap(find.byKey(const ValueKey('slot-spot1')));
    await settle(tester, 600);
    await tester.tap(find.byKey(const ValueKey('choose-bench')));
    await settle(tester, 1000);
    expect(game.progress.placedBuildings['spot1'], 'bench');
    expect(find.text('新しい住民がやってきた!'), findsOneWidget);
    expect(find.text('ねこ'), findsWidgets);
    await tester.tap(find.text('やったね'));
    await settle(tester, 600);
    expect(find.text('ひとが集まりはじめた駅前'), findsOneWidget);

    // 片づける
    await tester.tap(find.byKey(const ValueKey('slot-spot1')));
    await settle(tester, 600);
    await tester.tap(find.byKey(const ValueKey('remove')));
    await settle(tester, 600);
    expect(game.progress.placedBuildings, isEmpty);
    expect(game.owns('bench'), isTrue);
  });

  testWidgets('図鑑:NEW の印、列車を選ぶとパズルの列車が変わる', (tester) async {
    setScreen(tester, 390, 844);
    final game = await startApp(tester);
    game.progress.unlockedItems.add('train_sakura');
    await tester.tap(find.byKey(const ValueKey('collection')));
    await settle(tester);
    expect(find.text('NEW'), findsWidgets);
    expect(find.text('???'), findsWidgets);
    await tester.tap(find.byKey(const ValueKey('card-train_sakura')));
    await settle(tester, 600);
    expect(find.text('春になると、桜の花びらを乗せて走る。'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('use-item')));
    await settle(tester, 300);
    expect(game.train.id, 'train_sakura');
    expect(game.isNew('train_sakura'), isFalse);
  });

  testWidgets('設定:振動のオン・オフと音量が保存される', (tester) async {
    setScreen(tester, 390, 844);
    final game = await startApp(tester);
    await tester.tap(find.byKey(const ValueKey('settings')));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('vibration')));
    await tester.pump();
    expect(game.progress.settings.vibration, isFalse);
    await tester.drag(find.byType(Slider).first, const Offset(-400, 0));
    await tester.pump();
    expect(game.progress.settings.bgmVolume, 0);
    await tester.tap(find.text('プライバシーポリシー'));
    await settle(tester);
    expect(find.textContaining('個人情報を集めません'), findsOneWidget);
    await back(tester);
    // データを消す
    game.progress.recordClear(game.stages.first, 1);
    await tester.scrollUntilVisible(find.byKey(const ValueKey('reset')), 100);
    await tester.tap(find.byKey(const ValueKey('reset')));
    await settle(tester, 400);
    await tester.tap(find.byKey(const ValueKey('reset-ok')));
    await settle(tester, 400);
    expect(game.progress.records, isEmpty);
    expect(game.progress.settings.vibration, isFalse, reason: '設定は残る');
  });

  testWidgets('チュートリアル:最初のステージは指で教え、つながると出発をうながす', (tester) async {
    setScreen(tester, 390, 844);
    final game = await startApp(tester);
    await tester.tap(find.byKey(const ValueKey('continue')));
    await settle(tester);
    expect(find.byKey(const ValueKey('pointer')), findsOneWidget);
    expect(find.text('光っている線路をタップしよう'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('tile-2-2')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.byKey(const ValueKey('pointer')), findsNothing);
    expect(find.text('線路がつながった!「出発」を押そう'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('depart')));
    await settle(tester, 6000);
    expect(game.tutorialSeen('rotate'), isTrue);
    // クリア画面から町へ
    await tester.tap(find.byKey(const ValueKey('town')));
    await settle(tester);
    expect(find.text('わたしの終着駅'), findsOneWidget);
    // もう一度 1-1 を開いても、もう指は出ない
    final nav = tester.state<NavigatorState>(find.byType(Navigator));
    nav.push(MaterialPageRoute<void>(builder: (_) => PuzzleScreen(stage: game.stages.first)));
    await settle(tester);
    expect(find.byKey(const ValueKey('pointer')), findsNothing);
  });

  testWidgets('アプリを開き直すと、進み具合・町・選んだ列車が戻る', (tester) async {
    setScreen(tester, 390, 844);
    final store = MemoryProgressStore();
    final game = await startApp(tester, store: store);
    for (final st in game.stages.take(4)) {
      game.recordClear(st, st.stars.three);
    }
    expect(game.buy('house_small'), BuyResult.ok);
    game.place('lot1', 'house_small');
    await tester.runAsync(game.save);

    // 開き直す
    await tester.pumpWidget(const SizedBox());
    final again = (await tester.runAsync(
      () => GameController.load(bundle: rootBundle, store: store),
    ))!;
    await tester.pumpWidget(ChiisanaApp(controller: again));
    await tester.pump();
    expect(again.progress.totalStars, 12);
    expect(again.progress.placedBuildings['lot1'], 'house_small');
    await tester.tap(find.byKey(const ValueKey('stage-select')));
    await settle(tester);
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('stage-1-5')),
        matching: find.byIcon(Icons.lock_rounded),
      ),
      findsNothing,
    );
  });

  for (final size in const [Size(320, 568), Size(1024, 1366)]) {
    testWidgets('町・お店・図鑑・設定が ${size.width.toInt()}x${size.height.toInt()} で崩れない', (tester) async {
      setScreen(tester, size.width, size.height);
      final game = await startApp(tester);
      game.markTutorialSeen('town');
      for (final id in [
        'house_small',
        'clocktower',
        'tree',
        'fountain',
        'resident_cat',
        'resident_baker',
      ]) {
        game.progress.unlockedItems.add(id);
      }
      game.place('lot1', 'clocktower');
      game.place('spot3', 'fountain');
      for (final key in ['town', 'collection', 'settings']) {
        await tester.tap(find.byKey(ValueKey(key)));
        await settle(tester);
        if (key == 'town') {
          await tester.tap(find.byKey(const ValueKey('shop')));
          await settle(tester);
          await back(tester);
        }
        await back(tester);
      }
    });
  }
}
