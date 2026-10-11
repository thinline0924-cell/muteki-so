// 開発用:全ステージを開放した状態で起動する(見た目の確認用)。
// アプリ本体には入らない。
//   flutter run -t tool/preview/main_preview.dart
import 'package:chiisana_shuchakueki/app.dart';
import 'package:chiisana_shuchakueki/game/game_controller.dart';
import 'package:chiisana_shuchakueki/game/progress.dart';
import 'package:chiisana_shuchakueki/game/stage_loader.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final loaded = await loadStages(rootBundle);
  final progress = PlayerProgress();
  for (final s in loaded.stages) {
    progress.records[s.id] = const StageRecord(cleared: true, bestStars: 2, bestMoves: 99);
  }
  runApp(ChiisanaApp(controller: GameController(loaded, progress: progress)));
}
