// 開発用:全ステージを開放し、コインを多めに持った状態で起動する(見た目の確認用)。
// アプリ本体には入らない。保存はメモリ上だけ。
//   flutter run -t tool/preview/main_preview.dart
import 'package:chiisana_shuchakueki/app.dart';
import 'package:chiisana_shuchakueki/game/game_controller.dart';
import 'package:chiisana_shuchakueki/game/progress.dart';
import 'package:chiisana_shuchakueki/game/progress_store.dart';
import 'package:chiisana_shuchakueki/game/town.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final game = await GameController.load(bundle: rootBundle, store: MemoryProgressStore());
  final p = game.progress;
  for (final s in game.stages) {
    p.records[s.id] = const StageRecord(cleared: true, bestStars: 2, bestMoves: 99);
  }
  p.spendCoins(p.coins);
  p.recordClear(game.stages.first, 1);
  TownRules.refreshUnlocks(game.catalog, p);
  for (var i = 0; i < 40; i++) {
    p.recordClear(game.stages.last, 999);
  }
  // 町をにぎやかにしておく(引数 --dart-define=EMPTY_TOWN=true で空のまま)
  if (!const bool.fromEnvironment('EMPTY_TOWN')) {
    for (final i in game.catalog.items) {
      if (i.price != null) p.unlockedItems.add(i.id);
    }
    const plan = {
      'lot1': 'cafe',
      'lot2': 'bakery',
      'lot3': 'house_small',
      'lot4': 'clocktower',
      'lot5': 'house_blue',
      'spot1': 'streetlamp',
      'spot2': 'tree',
      'spot3': 'fountain',
      'spot4': 'flowerbed',
      'spot5': 'bench',
      'spot7': 'pond',
    };
    plan.forEach((slot, item) => TownRules.place(game.catalog, p, slot, item));
    TownRules.refreshUnlocks(game.catalog, p);
  }
  runApp(ChiisanaApp(controller: game));
}
