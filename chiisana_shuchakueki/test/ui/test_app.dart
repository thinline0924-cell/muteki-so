import 'package:chiisana_shuchakueki/app.dart';
import 'package:chiisana_shuchakueki/game/game_controller.dart';
import 'package:chiisana_shuchakueki/game/stage_loader.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// 本物のステージデータを読んでアプリを起動する。
Future<GameController> startApp(WidgetTester tester) async {
  final loaded = (await tester.runAsync(() => loadStages(rootBundle)))!;
  expect(loaded.errors, isEmpty);
  final game = GameController(loaded);
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
