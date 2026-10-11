import 'package:flutter/foundation.dart';

import '../puzzle/stage.dart';
import 'progress.dart';
import 'stage_loader.dart';

/// アプリ全体の状態(ステージ一覧と進行状況)。画面はこれを見て描き直す。
///
/// Phase 1 では進行状況はメモリ上だけ(アプリを閉じると消える)。
/// Phase 2 で端末への保存を追加する。
class GameController extends ChangeNotifier {
  GameController(this.loaded, {PlayerProgress? progress}) : progress = progress ?? PlayerProgress();

  final LoadedStages loaded;
  final PlayerProgress progress;

  List<StagePack> get packs => loaded.packs;
  List<StageDefinition> get stages => loaded.stages;

  StageDefinition? stageById(String id) {
    for (final s in stages) {
      if (s.id == id) return s;
    }
    return null;
  }

  /// 一覧で [stage] の次のステージ。
  StageDefinition? nextOf(StageDefinition stage) {
    final i = stages.indexWhere((s) => s.id == stage.id);
    return i >= 0 && i + 1 < stages.length ? stages[i + 1] : null;
  }

  bool isUnlocked(StageDefinition s) => progress.isUnlocked(s);

  /// 「つづきから」で遊ぶステージ:開放済みでまだクリアしていない最初のもの。
  /// 全部クリアしていれば null。
  StageDefinition? get continueStage {
    for (final s in stages) {
      if (isUnlocked(s) && !progress.isCleared(s.id)) return s;
    }
    return null;
  }

  int maxStarsOf(StagePack pack) => pack.stages.length * 3;

  int starsOf(StagePack pack) =>
      pack.stages.fold(0, (sum, s) => sum + progress.recordOf(s.id).bestStars);

  ClearResult recordClear(StageDefinition stage, int moves) {
    final r = progress.recordClear(stage, moves);
    notifyListeners();
    return r;
  }

  void markPlayed(StageDefinition stage) {
    progress.lastPlayedStage = stage.id;
  }
}
