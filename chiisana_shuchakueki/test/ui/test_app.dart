import 'package:chiisana_shuchakueki/app.dart';
import 'package:chiisana_shuchakueki/game/game_controller.dart';
import 'package:chiisana_shuchakueki/game/progress_store.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// 本物のステージデータとカタログを読んでアプリを起動する(保存はメモリ上)。
Future<GameController> startApp(WidgetTester tester, {ProgressStore? store}) async {
  final game = (await tester.runAsync(
    () => GameController.load(bundle: rootBundle, store: store ?? MemoryProgressStore()),
  ))!;
  expect(game.loaded.errors, isEmpty);
  await tester.pumpWidget(ChiisanaApp(controller: game));
  await tester.pump();
  return game;
}

/// 画面の切り替えや演出が終わるまで進める(タイトルの波は止まらないので
/// pumpAndSettle は使わない)。
Future<void> settle(WidgetTester tester, [int ms = 1200]) async {
  for (var t = 0; t < ms; t += 100) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void setScreen(WidgetTester tester, double w, double h, {double dpr = 2}) {
  tester.view.physicalSize = Size(w * dpr, h * dpr);
  tester.view.devicePixelRatio = dpr;
  addTearDown(tester.view.reset);
}
