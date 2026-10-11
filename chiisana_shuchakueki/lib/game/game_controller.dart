import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../puzzle/stage.dart';
import 'catalog.dart';
import 'progress.dart';
import 'progress_store.dart';
import 'sound.dart';
import 'stage_loader.dart';
import 'town.dart';

/// 振動の強さ
enum Haptic { selection, light, medium, heavy }

/// アプリ全体の状態(ステージ・カタログ・進行状況・音)。画面はこれを見て描き直す。
///
/// 進行状況を変えたら、そのたびに [ProgressStore] へ保存する。
class GameController extends ChangeNotifier {
  GameController(
    this.loaded,
    this.catalog, {
    PlayerProgress? progress,
    ProgressStore? store,
    SoundService? sound,
  }) : progress = progress ?? PlayerProgress(),
       store = store ?? MemoryProgressStore(),
       sound = sound ?? SilentSound() {
    TownRules.sanitize(catalog, this.progress);
    this.sound.setVolumes(
      bgm: this.progress.settings.bgmVolume,
      se: this.progress.settings.seVolume,
    );
  }

  /// アセットとセーブデータを読みこんで作る。
  static Future<GameController> load({
    required AssetBundle bundle,
    required ProgressStore store,
    SoundService? sound,
  }) async {
    final loaded = await loadStages(bundle);
    final catalog = Catalog.fromJson(
      jsonDecode(await bundle.loadString('assets/data/catalog.json')),
    );
    final progress = await store.load();
    return GameController(loaded, catalog, progress: progress, store: store, sound: sound);
  }

  final LoadedStages loaded;
  final Catalog catalog;
  final PlayerProgress progress;
  final ProgressStore store;
  final SoundService sound;

  Future<void> _saving = Future.value();

  List<StagePack> get packs => loaded.packs;
  List<StageDefinition> get stages => loaded.stages;

  // ---- 保存 ----

  /// 保存を順番に行う(前の保存が終わってから次を書く)
  Future<void> save() => _saving = _saving.then((_) => store.save(progress));

  void _changed() {
    notifyListeners();
    unawaited(save());
  }

  // ---- ステージ ----

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

  /// クリアを記録し、新しく手に入れたアイテムも返す。
  ({ClearResult result, List<CollectibleItem> newItems}) recordClear(
    StageDefinition stage,
    int moves,
  ) {
    final r = progress.recordClear(stage, moves);
    final items = TownRules.refreshUnlocks(catalog, progress);
    _changed();
    return (result: r, newItems: items);
  }

  void markPlayed(StageDefinition stage) {
    if (progress.lastPlayedStage == stage.id) return;
    progress.lastPlayedStage = stage.id;
    unawaited(save());
  }

  // ---- 町とコレクション ----

  int get placedCount => progress.placedBuildings.length;

  bool owns(String itemId) => TownRules.owns(progress, itemId);

  BuyResult buy(String itemId) {
    final r = TownRules.buy(catalog, progress, itemId);
    if (r == BuyResult.ok) _changed();
    return r;
  }

  /// 区画に置く。新しく手に入れたもの(住民など)を返す。
  ({PlaceResult result, List<CollectibleItem> newItems}) place(String slotId, String itemId) {
    final r = TownRules.place(catalog, progress, slotId, itemId);
    if (r != PlaceResult.ok) return (result: r, newItems: const []);
    final items = TownRules.refreshUnlocks(catalog, progress);
    _changed();
    return (result: r, newItems: items);
  }

  bool removeFromSlot(String slotId) {
    final ok = TownRules.remove(progress, slotId);
    if (ok) _changed();
    return ok;
  }

  bool select(String itemId) {
    final ok = TownRules.select(catalog, progress, itemId);
    if (ok) _changed();
    return ok;
  }

  CollectibleItem get train => TownRules.selectedTrain(catalog, progress);
  CollectibleItem get station => TownRules.selectedStation(catalog, progress);

  bool isNew(String itemId) => owns(itemId) && !progress.seenItems.contains(itemId);

  int get newItemCount => catalog.items.where((i) => isNew(i.id)).length;

  void markSeen(String itemId) {
    if (progress.seenItems.add(itemId)) _changed();
  }

  // ---- チュートリアル ----

  bool tutorialSeen(String id) => progress.tutorialsSeen.contains(id);

  void markTutorialSeen(String id) {
    if (progress.tutorialsSeen.add(id)) _changed();
  }

  // ---- 設定・音・振動 ----

  void updateSettings(GameSettings s) {
    progress.settings = s;
    sound.setVolumes(bgm: s.bgmVolume, se: s.seVolume);
    _changed();
  }

  void play(Sfx sfx) => sound.play(sfx);

  void vibrate(Haptic h) {
    if (!progress.settings.vibration) return;
    switch (h) {
      case Haptic.selection:
        HapticFeedback.selectionClick();
      case Haptic.light:
        HapticFeedback.lightImpact();
      case Haptic.medium:
        HapticFeedback.mediumImpact();
      case Haptic.heavy:
        HapticFeedback.heavyImpact();
    }
  }

  /// セーブデータを消して最初からにする(設定はそのまま)。
  Future<void> resetProgress() async {
    final keep = progress.settings;
    progress
      ..records.clear()
      ..unlockedItems.clear()
      ..placedBuildings.clear()
      ..seenItems.clear()
      ..tutorialsSeen.clear()
      ..lastPlayedStage = null
      ..selectedTrain = null
      ..selectedStation = null
      ..settings = keep;
    progress.spendCoins(progress.coins);
    TownRules.sanitize(catalog, progress);
    notifyListeners();
    await save();
  }

  @override
  void dispose() {
    sound.dispose();
    super.dispose();
  }
}
