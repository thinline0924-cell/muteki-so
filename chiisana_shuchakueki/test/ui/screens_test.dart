import 'package:chiisana_shuchakueki/ui/screens/puzzle_screen.dart';
import 'package:chiisana_shuchakueki/ui/widgets/common.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_app.dart';

Future<void> openStage(WidgetTester tester, String id) async {
  final game = await startApp(tester);
  final stage = game.stageById(id)!;
  final nav = tester.state<NavigatorState>(find.byType(Navigator));
  nav.push(MaterialPageRoute<void>(builder: (_) => PuzzleScreen(stage: stage)));
  await settle(tester);
}

void main() {
  testWidgets('タイトル:ボタンがそろい、それぞれの画面が開く', (tester) async {
    setScreen(tester, 390, 844);
    await startApp(tester);
    expect(find.text('つづきから'), findsOneWidget);
    expect(find.text('ステージ選択'), findsOneWidget);
    for (final (key, title) in const [
      ('town', 'わたしの終着駅'),
      ('collection', 'コレクション'),
      ('settings', '設定'),
    ]) {
      await tester.tap(find.byKey(ValueKey(key)));
      await settle(tester);
      expect(find.text(title), findsWidgets, reason: key);
      await tester.tap(find.byType(RoundBackButton).first);
      await settle(tester);
      expect(find.text('つづきから'), findsOneWidget);
    }
  });

  testWidgets('ステージ選択:最初だけ遊べて、ほかは鍵がかかっている', (tester) async {
    setScreen(tester, 390, 844);
    await startApp(tester);
    await tester.tap(find.byKey(const ValueKey('stage-select')));
    await settle(tester);
    expect(find.text('はじまりの町'), findsOneWidget);
    Finder lockIn(String id) => find.descendant(
      of: find.byKey(ValueKey('stage-$id')),
      matching: find.byIcon(Icons.lock_rounded),
    );
    expect(lockIn('1-1'), findsNothing);
    expect(lockIn('1-2'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('stage-1-2')));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('ステージ 1-1 をクリアすると遊べます'), findsOneWidget);
    // ワールド 2 は星が必要
    await tester.scrollUntilVisible(find.text('海辺の通り'), 200);
    expect(find.textContaining('星を 15 個集めると開きます'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('はじまりの町'), -200);
    await tester.tap(find.byKey(const ValueKey('stage-1-1')));
    await settle(tester);
    expect(find.text('はじめての線路'), findsOneWidget);
  });

  testWidgets('パズル:回す・1手戻す・リセットで手数が正しく変わる', (tester) async {
    setScreen(tester, 390, 844);
    await openStage(tester, '1-3');
    Future<void> tap(Key k) async {
      await tester.tap(find.byKey(k));
      await tester.pump(const Duration(milliseconds: 50));
    }

    const tile = ValueKey('tile-1-1');
    await tap(tile);
    await tap(tile);
    expect(find.textContaining('手数 2 /'), findsOneWidget);
    await tester.tap(find.text('1手戻す'));
    await tester.pump();
    expect(find.textContaining('手数 1 /'), findsOneWidget);
    await tester.tap(find.text('リセット'));
    await tester.pump();
    expect(find.textContaining('手数 0 /'), findsOneWidget);
    // 駅や草地をタップしても手数は増えない
    await tap(const ValueKey('tile-0-1'));
    await tap(const ValueKey('tile-2-1'));
    expect(find.textContaining('手数 0 /'), findsOneWidget);
  });

  testWidgets('パズル:つながっていないまま出発すると失敗表示、回すと消える', (tester) async {
    setScreen(tester, 390, 844);
    await openStage(tester, '1-1');
    await tester.tap(find.byKey(const ValueKey('depart')));
    await settle(tester, 4000);
    expect(find.byKey(const ValueKey('failure')), findsOneWidget);
    expect(find.text('ステージクリア!'), findsNothing);
    expect(find.text('もう一度出発'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('tile-2-2')));
    await tester.pump();
    expect(find.byKey(const ValueKey('failure')), findsNothing);
  });

  testWidgets('パズル:走行中の連続タップは無視され、状態が壊れない', (tester) async {
    setScreen(tester, 390, 844);
    await openStage(tester, '1-1');
    await tester.tap(find.byKey(const ValueKey('tile-2-2')));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('depart')));
    await tester.pump(const Duration(milliseconds: 100));
    for (var i = 0; i < 10; i++) {
      await tester.tap(find.byKey(const ValueKey('tile-2-2')), warnIfMissed: false);
      await tester.tap(find.byKey(const ValueKey('depart')), warnIfMissed: false);
      await tester.tap(find.text('リセット'), warnIfMissed: false);
      await tester.pump(const Duration(milliseconds: 20));
    }
    expect(find.textContaining('手数 1 /'), findsOneWidget);
    await settle(tester, 6000);
    expect(find.text('ステージクリア!'), findsOneWidget);
  });

  testWidgets('パズル:走行中にアプリが一時停止・復帰しても正しく終わる', (tester) async {
    setScreen(tester, 390, 844);
    await openStage(tester, '1-1');
    await tester.tap(find.byKey(const ValueKey('tile-2-2')));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('depart')));
    await tester.pump(const Duration(milliseconds: 300));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(seconds: 2));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await settle(tester, 6000);
    expect(find.text('ステージクリア!'), findsOneWidget);
  });

  testWidgets('パズル:ヒントで回すマスと回数が出る', (tester) async {
    setScreen(tester, 390, 844);
    await openStage(tester, '1-1');
    await tester.tap(find.text('ヒント'));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('×1'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('tile-2-2')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('×1'), findsNothing);
    // もう解けているので、ヒントはその旨を伝える
    await tester.tap(find.text('ヒント'));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.textContaining('もう線路はつながっています'), findsOneWidget);
  });

  testWidgets('クリア後「もう一度」で手数 0 から遊び直せる', (tester) async {
    setScreen(tester, 390, 844);
    await openStage(tester, '1-1');
    await tester.tap(find.byKey(const ValueKey('tile-2-2')));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('depart')));
    await settle(tester, 6000);
    await tester.tap(find.byKey(const ValueKey('retry')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('ステージクリア!'), findsNothing);
    expect(find.textContaining('手数 0 /'), findsOneWidget);
  });

  testWidgets('つづきから → クリア → 「ステージ選択」でステージ選択画面へ', (tester) async {
    setScreen(tester, 390, 844);
    await startApp(tester);
    await tester.tap(find.byKey(const ValueKey('continue')));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('tile-2-2')));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const ValueKey('depart')));
    await settle(tester, 6000);
    await tester.tap(find.byKey(const ValueKey('stage-select')));
    await settle(tester);
    expect(find.text('はじまりの町'), findsOneWidget);
    // ステージ 2 が開いている
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('stage-1-2')),
        matching: find.byIcon(Icons.lock_rounded),
      ),
      findsNothing,
    );
    // 戻るとタイトル
    await tester.tap(find.byType(RoundBackButton));
    await settle(tester);
    expect(find.text('つづきから'), findsOneWidget);
  });

  for (final size in const [Size(320, 568), Size(360, 640), Size(430, 932), Size(1024, 1366)]) {
    testWidgets('画面サイズ ${size.width.toInt()}x${size.height.toInt()} で表示が崩れない', (tester) async {
      setScreen(tester, size.width, size.height);
      final game = await startApp(tester);
      await tester.tap(find.byKey(const ValueKey('stage-select')));
      await settle(tester);
      // いちばん大きい盤面のステージを開く(はみ出しがあればテストが失敗する)
      final biggest = game.stages.reduce(
        (a, b) => a.width * a.height >= b.width * b.height ? a : b,
      );
      final nav = tester.state<NavigatorState>(find.byType(Navigator));
      nav.push(MaterialPageRoute<void>(builder: (_) => PuzzleScreen(stage: biggest)));
      await settle(tester);
      // 盤面のマスがじゅうぶんな大きさで、画面内に収まっている
      final tile = tester.getRect(find.byKey(const ValueKey('tile-0-0')));
      expect(tile.width, greaterThanOrEqualTo(40));
      final last = tester.getRect(
        find.byKey(ValueKey('tile-${biggest.width - 1}-${biggest.height - 1}')),
      );
      expect(last.right, lessThanOrEqualTo(size.width));
      expect(last.bottom, lessThanOrEqualTo(size.height));
      // クリア画面も確認
      await tester.tap(find.byKey(const ValueKey('depart')));
      await settle(tester, 6000);
    });
  }
}
