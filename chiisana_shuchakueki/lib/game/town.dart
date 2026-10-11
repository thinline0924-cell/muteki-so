import 'catalog.dart';
import 'progress.dart';

enum BuyResult { ok, unknownItem, notForSale, alreadyOwned, notEnoughCoins }

enum PlaceResult { ok, unknownSlot, unknownItem, notOwned, notPlaceable, wrongSize }

/// 町づくりとコレクションのルール。画面とは無関係な純粋な Dart。
///
/// アイテムを「持っている」= progress.unlockedItems に入っていること。
/// 条件(星・クリア・町に置いた など)を満たしたら refreshUnlocks() で追加する。
/// 一度手に入れたものは、あとで条件を満たさなくなっても消えない。
abstract final class TownRules {
  /// 町の発展のようす(置いている数で決まる)
  static String developmentTitle(int placed) => switch (placed) {
    0 => 'さびしい駅前',
    <= 3 => 'ひとが集まりはじめた駅前',
    <= 7 => 'にぎわいはじめた町',
    <= 11 => 'にぎやかな町',
    _ => 'ちいさな終着駅の町',
  };

  static bool owns(PlayerProgress p, String itemId) => p.unlockedItems.contains(itemId);

  /// 条件を満たしたのにまだ持っていないアイテムを追加し、新しく増えたものを返す。
  /// コインで買うものはここでは増えない。
  static List<CollectibleItem> refreshUnlocks(Catalog c, PlayerProgress p) {
    final added = <CollectibleItem>[];
    final placedItems = p.placedBuildings.values.toSet();
    for (final item in c.items) {
      if (p.unlockedItems.contains(item.id)) continue;
      final u = item.unlock;
      final ok = switch (u.kind) {
        UnlockKind.start => true,
        UnlockKind.purchase => false,
        UnlockKind.stars => p.totalStars >= u.value,
        UnlockKind.clear => u.stage != null && p.isCleared(u.stage!),
        UnlockKind.placed => placedItems.contains(u.item),
        UnlockKind.town => p.placedBuildings.length >= u.value,
      };
      if (ok) {
        p.unlockedItems.add(item.id);
        added.add(item);
      }
    }
    return added;
  }

  /// コインで買う。足りない・売っていない・もう持っている場合は何も変えない。
  static BuyResult buy(Catalog c, PlayerProgress p, String itemId) {
    final item = c.item(itemId);
    if (item == null) return BuyResult.unknownItem;
    if (item.unlock.kind != UnlockKind.purchase || item.price == null) {
      return BuyResult.notForSale;
    }
    if (owns(p, itemId)) return BuyResult.alreadyOwned;
    if (!p.spendCoins(item.price!)) return BuyResult.notEnoughCoins;
    p.unlockedItems.add(itemId);
    return BuyResult.ok;
  }

  /// 区画に置く(置いてあるものは入れ替わる)。同じアイテムをいくつ置いてもよい。
  static PlaceResult place(Catalog c, PlayerProgress p, String slotId, String itemId) {
    final slot = c.slot(slotId);
    if (slot == null) return PlaceResult.unknownSlot;
    final item = c.item(itemId);
    if (item == null) return PlaceResult.unknownItem;
    if (!item.type.placeable) return PlaceResult.notPlaceable;
    if (!owns(p, itemId)) return PlaceResult.notOwned;
    if (item.size != slot.size) return PlaceResult.wrongSize;
    p.placedBuildings[slotId] = itemId;
    return PlaceResult.ok;
  }

  /// 区画から片づける。片づけても、手に入れたアイテムはなくならない。
  static bool remove(PlayerProgress p, String slotId) => p.placedBuildings.remove(slotId) != null;

  /// 列車・駅舎を選ぶ。持っていなければ false。
  static bool select(Catalog c, PlayerProgress p, String itemId) {
    final item = c.item(itemId);
    if (item == null || !owns(p, itemId)) return false;
    switch (item.type) {
      case ItemType.train:
        p.selectedTrain = itemId;
      case ItemType.station:
        p.selectedStation = itemId;
      default:
        return false;
    }
    return true;
  }

  static CollectibleItem selectedTrain(Catalog c, PlayerProgress p) =>
      _selected(c, p.selectedTrain, ItemType.train);

  static CollectibleItem selectedStation(Catalog c, PlayerProgress p) =>
      _selected(c, p.selectedStation, ItemType.station);

  static CollectibleItem _selected(Catalog c, String? id, ItemType t) {
    final item = id == null ? null : c.item(id);
    if (item != null && item.type == t) return item;
    return c.item(c.defaultOf(t)!)!;
  }

  /// 読みこんだセーブデータを、今のカタログに合わせて整える
  /// (消えた区画・アイテム、持っていないのに置いてあるもの などを取りのぞく)。
  static void sanitize(Catalog c, PlayerProgress p) {
    p.unlockedItems.removeWhere((id) => c.item(id) == null);
    p.seenItems.removeWhere((id) => c.item(id) == null);
    p.placedBuildings.removeWhere((slotId, itemId) {
      final slot = c.slot(slotId);
      final item = c.item(itemId);
      return slot == null ||
          item == null ||
          !item.type.placeable ||
          item.size != slot.size ||
          !p.unlockedItems.contains(itemId);
    });
    refreshUnlocks(c, p);
    if (p.selectedTrain != null &&
        (c.item(p.selectedTrain!)?.type != ItemType.train || !owns(p, p.selectedTrain!))) {
      p.selectedTrain = null;
    }
    if (p.selectedStation != null &&
        (c.item(p.selectedStation!)?.type != ItemType.station || !owns(p, p.selectedStation!))) {
      p.selectedStation = null;
    }
  }
}
