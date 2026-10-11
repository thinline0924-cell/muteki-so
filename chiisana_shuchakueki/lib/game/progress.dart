import '../puzzle/stage.dart';

/// 1 ステージ分の記録。
class StageRecord {
  const StageRecord({this.cleared = false, this.bestStars = 0, this.bestMoves});

  final bool cleared;

  /// これまでの最高の星(0〜3)
  final int bestStars;

  /// これまでの最少手数(未クリアなら null)
  final int? bestMoves;

  Map<String, Object?> toJson() => {
    'cleared': cleared,
    'bestStars': bestStars,
    if (bestMoves != null) 'bestMoves': bestMoves,
  };

  static StageRecord fromJson(Object? json) {
    if (json is! Map) return const StageRecord();
    final stars = json['bestStars'];
    final moves = json['bestMoves'];
    return StageRecord(
      cleared: json['cleared'] == true,
      bestStars: stars is int ? stars.clamp(0, 3) : 0,
      bestMoves: moves is int && moves >= 0 ? moves : null,
    );
  }
}

/// クリアしたときの結果(クリア画面に出す)。
class ClearResult {
  const ClearResult({
    required this.stars,
    required this.moves,
    required this.coins,
    required this.firstClearBonus,
    required this.isFirstClear,
    required this.isNewBest,
  });

  final int stars;
  final int moves;

  /// 今回もらったコイン(初回ボーナスを除く)
  final int coins;

  /// 今回もらった初回ボーナス(初回でなければ 0)
  final int firstClearBonus;
  final bool isFirstClear;

  /// 星の最高記録を更新したか
  final bool isNewBest;

  int get totalCoins => coins + firstClearBonus;
}

/// 設定。
class GameSettings {
  const GameSettings({this.bgmVolume = 0.6, this.seVolume = 0.8, this.vibration = true});

  final double bgmVolume;
  final double seVolume;
  final bool vibration;

  GameSettings copyWith({double? bgmVolume, double? seVolume, bool? vibration}) => GameSettings(
    bgmVolume: bgmVolume ?? this.bgmVolume,
    seVolume: seVolume ?? this.seVolume,
    vibration: vibration ?? this.vibration,
  );

  Map<String, Object?> toJson() => {
    'bgmVolume': bgmVolume,
    'seVolume': seVolume,
    'vibration': vibration,
  };

  static GameSettings fromJson(Object? json) {
    if (json is! Map) return const GameSettings();
    double vol(Object? v, double d) => v is num ? v.toDouble().clamp(0.0, 1.0) : d;
    return GameSettings(
      bgmVolume: vol(json['bgmVolume'], 0.6),
      seVolume: vol(json['seVolume'], 0.8),
      vibration: json['vibration'] is bool ? json['vibration'] as bool : true,
    );
  }
}

/// プレイヤーの進行状況。セーブデータの中身そのもの。
///
/// 画面とは無関係な Dart のクラスなので、テストで直接使える。
/// 端末への保存(SharedPreferences)は Phase 2 で追加する。
class PlayerProgress {
  PlayerProgress({
    this.lastPlayedStage,
    Map<String, StageRecord>? records,
    int coins = 0,
    Set<String>? unlockedItems,
    Map<String, String>? placedBuildings,
    this.settings = const GameSettings(),
  }) : records = records ?? {},
       unlockedItems = unlockedItems ?? {},
       placedBuildings = placedBuildings ?? {},
       _coins = _clampCoins(coins);

  /// セーブデータの形式の版。形を変えたら上げて、fromJson で古い形を読み替える。
  static const int saveVersion = 1;

  /// コインの上限(表示が崩れない・桁あふれしない範囲)
  static const int maxCoins = 9999999;

  String? lastPlayedStage;
  final Map<String, StageRecord> records;
  int _coins;
  final Set<String> unlockedItems;

  /// 町の配置場所 ID → 置いた建物の ID
  final Map<String, String> placedBuildings;
  GameSettings settings;

  int get coins => _coins;

  static int _clampCoins(int v) => v.clamp(0, maxCoins);

  int get totalStars => records.values.fold(0, (sum, r) => sum + r.bestStars);

  StageRecord recordOf(String stageId) => records[stageId] ?? const StageRecord();

  bool isCleared(String stageId) => recordOf(stageId).cleared;

  bool isUnlocked(StageDefinition s) {
    final after = s.unlock.afterStage;
    if (after != null && !isCleared(after)) return false;
    return totalStars >= s.unlock.minTotalStars;
  }

  /// クリアを記録する。星の最高記録は下がらない。
  ClearResult recordClear(StageDefinition stage, int moves) {
    final stars = stage.stars.starsFor(moves);
    final old = recordOf(stage.id);
    final first = !old.cleared;
    final bonus = first ? stage.reward.firstClearBonus : 0;
    records[stage.id] = StageRecord(
      cleared: true,
      bestStars: stars > old.bestStars ? stars : old.bestStars,
      bestMoves: old.bestMoves == null || moves < old.bestMoves! ? moves : old.bestMoves,
    );
    _coins = _clampCoins(_coins + stage.reward.coins + bonus);
    lastPlayedStage = stage.id;
    return ClearResult(
      stars: stars,
      moves: moves,
      coins: stage.reward.coins,
      firstClearBonus: bonus,
      isFirstClear: first,
      isNewBest: stars > old.bestStars,
    );
  }

  /// コインを使う。足りなければ何もせず false。
  bool spendCoins(int amount) {
    if (amount < 0 || amount > _coins) return false;
    _coins -= amount;
    return true;
  }

  Map<String, Object?> toJson() => {
    'version': saveVersion,
    'lastPlayedStage': lastPlayedStage,
    'records': {for (final e in records.entries) e.key: e.value.toJson()},
    'coins': _coins,
    'unlockedItems': unlockedItems.toList()..sort(),
    'placedBuildings': placedBuildings,
    'settings': settings.toJson(),
  };

  /// セーブデータを読む。欠けた値・おかしな値は安全な初期値にする。
  static PlayerProgress fromJson(Object? json) {
    if (json is! Map) return PlayerProgress();
    final records = <String, StageRecord>{};
    final rawRecords = json['records'];
    if (rawRecords is Map) {
      rawRecords.forEach((k, v) {
        if (k is String) records[k] = StageRecord.fromJson(v);
      });
    }
    final coins = json['coins'];
    final items = json['unlockedItems'];
    final placed = json['placedBuildings'];
    final last = json['lastPlayedStage'];
    return PlayerProgress(
      lastPlayedStage: last is String ? last : null,
      records: records,
      coins: coins is int ? coins : 0,
      unlockedItems: items is List ? items.whereType<String>().toSet() : null,
      placedBuildings: placed is Map
          ? {
              for (final e in placed.entries)
                if (e.key is String && e.value is String) e.key as String: e.value as String,
            }
          : null,
      settings: GameSettings.fromJson(json['settings']),
    );
  }
}
