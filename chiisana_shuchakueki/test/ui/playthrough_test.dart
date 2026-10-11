// すべてのステージを、ソルバーの答えどおりにタップして最後まで通しプレイする。
import 'package:chiisana_shuchakueki/puzzle/solver.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_app.dart';

void main() {
  testWidgets('つづきから → 全ステージを最少手数でクリアできる', (tester) async {
    setScreen(tester, 390, 844);
    final game = await startApp(tester);
    await tester.tap(find.byKey(const ValueKey('continue')));
    await settle(tester);

    for (var i = 0; i < game.stages.length; i++) {
      final stage = game.stages[i];
      expect(find.text(stage.name), findsWidgets, reason: '${stage.id} の画面');
      final sol = Solver.solve(stage.board)!;
      for (final e in sol.rotations.entries) {
        for (var k = 0; k < e.value; k++) {
          await tester.tap(find.byKey(ValueKey('tile-${e.key.x}-${e.key.y}')));
          await tester.pump(const Duration(milliseconds: 50));
        }
      }
      expect(find.textContaining('手数 ${sol.moves} /'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('depart')));
      await settle(tester, 8000);
      expect(find.text('ステージクリア!'), findsOneWidget, reason: '${stage.id} がクリアにならない');
      expect(game.progress.recordOf(stage.id).bestStars, 3, reason: '${stage.id} は最少手数なので ★3');

      if (i + 1 < game.stages.length) {
        await tester.tap(find.byKey(const ValueKey('next')));
        await settle(tester);
      } else {
        expect(find.byKey(const ValueKey('next')), findsNothing);
        expect(find.text('ここまでのステージをすべて遊びました!'), findsOneWidget);
      }
    }
    expect(game.progress.totalStars, game.stages.length * 3);
    expect(game.continueStage, isNull);
    final expectedCoins = game.stages.fold<int>(
      0,
      (s, st) => s + st.reward.coins + st.reward.firstClearBonus,
    );
    expect(game.progress.coins, expectedCoins);
  });
}
