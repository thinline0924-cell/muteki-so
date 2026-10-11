/// 町づくり・コレクションのアイテム定義(assets/data/catalog.json)。
library;

enum ItemType {
  building('建物'),
  decoration('装飾'),
  train('列車'),
  station('駅舎'),
  resident('住民');

  const ItemType(this.label);
  final String label;

  /// 町に置けるかどうか
  bool get placeable => this == ItemType.building || this == ItemType.decoration;
}

/// 取得条件の種類。
enum UnlockKind {
  /// 最初から持っている
  start,

  /// コインで買う
  purchase,

  /// 合計の星が value 以上
  stars,

  /// ステージ stage をクリア
  clear,

  /// 町に item を置いたことがある
  placed,

  /// 町に value 個以上置いている
  town,
}

class ItemUnlock {
  const ItemUnlock(this.kind, {this.value = 0, this.stage, this.item});

  final UnlockKind kind;
  final int value;
  final String? stage;
  final String? item;
}

/// 収集できるもの 1 つ。
class CollectibleItem {
  const CollectibleItem({
    required this.id,
    required this.type,
    required this.name,
    required this.description,
    required this.unlock,
    this.price,
    this.size,
    required this.art,
    this.colors = const {},
  });

  final String id;
  final ItemType type;
  final String name;
  final String description;
  final ItemUnlock unlock;

  /// コインでの値段(買えないものは null)
  final int? price;

  /// 置ける区画の大きさ("large" / "small")。置けないものは null
  final String? size;

  /// 絵の種類(lib/ui/painters/ の描き分けに使う名前)
  final String art;

  /// 絵の色("#RRGGBB")
  final Map<String, String> colors;
}

/// 町の区画(建物や装飾を置ける場所)。
class TownSlot {
  const TownSlot({required this.id, required this.size, required this.x, required this.y});

  final String id;
  final String size;

  /// 360×480 の設計図の上での位置(置いたものの足もとの中心)
  final double x;
  final double y;
}

class CatalogFormatException implements Exception {
  CatalogFormatException(this.problems);
  final List<String> problems;

  @override
  String toString() => 'カタログのデータに問題があります: ${problems.join(' / ')}';
}

class Catalog {
  Catalog(List<CollectibleItem> items, this.slots)
    : items = List.unmodifiable(items),
      _byId = {for (final i in items) i.id: i};

  final List<CollectibleItem> items;
  final List<TownSlot> slots;
  final Map<String, CollectibleItem> _byId;

  CollectibleItem? item(String id) => _byId[id];

  TownSlot? slot(String id) {
    for (final s in slots) {
      if (s.id == id) return s;
    }
    return null;
  }

  List<CollectibleItem> ofType(ItemType t) => [
    for (final i in items)
      if (i.type == t) i,
  ];

  /// 最初から持っている列車・駅舎(なければ null)
  String? defaultOf(ItemType t) {
    for (final i in items) {
      if (i.type == t && i.unlock.kind == UnlockKind.start) return i.id;
    }
    return null;
  }

  /// JSON から読む。おかしなアイテムは飛ばさず、全体をエラーにする
  /// (アイテムは数が少なく、テストで必ず検査するため)。
  static Catalog fromJson(Object? json) {
    final problems = <String>[];
    if (json is! Map || json['items'] is! List || json['slots'] is! List) {
      throw CatalogFormatException(['items と slots が必要です']);
    }
    final items = <CollectibleItem>[];
    final ids = <String>{};
    for (final raw in json['items'] as List) {
      if (raw is! Map) {
        problems.add('アイテムがオブジェクトではありません');
        continue;
      }
      final id = raw['id'];
      if (id is! String || id.isEmpty) {
        problems.add('id のないアイテムがあります');
        continue;
      }
      if (!ids.add(id)) problems.add('$id が重複しています');
      final type = ItemType.values.where((t) => t.name == raw['type']).firstOrNull;
      final u = raw['unlock'];
      final kind = u is Map
          ? UnlockKind.values.where((k) => k.name == u['kind']).firstOrNull
          : null;
      final name = raw['name'];
      final desc = raw['description'];
      final price = raw['price'];
      final size = raw['size'];
      final art = raw['art'];
      if (type == null) problems.add('$id: type がおかしいです');
      if (kind == null) problems.add('$id: unlock.kind がおかしいです');
      if (name is! String || name.isEmpty) problems.add('$id: name がありません');
      if (desc is! String) problems.add('$id: description がありません');
      if (art is! String) problems.add('$id: art がありません');
      if (price != null && (price is! int || price < 0)) problems.add('$id: price がおかしいです');
      if (kind == UnlockKind.purchase && price is! int) problems.add('$id: 買えるのに値段がありません');
      if (type != null && type.placeable && size != 'large' && size != 'small') {
        problems.add('$id: size は large か small にしてください');
      }
      if (type == null || kind == null || name is! String || desc is! String || art is! String) {
        continue;
      }
      final colors = <String, String>{};
      final c = raw['colors'];
      if (c is Map) {
        c.forEach((k, v) {
          if (k is String && v is String && RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(v)) {
            colors[k] = v;
          } else {
            problems.add('$id: 色 $k がおかしいです');
          }
        });
      }
      final value = (u as Map)['value'];
      items.add(
        CollectibleItem(
          id: id,
          type: type,
          name: name,
          description: desc,
          unlock: ItemUnlock(
            kind,
            value: value is int ? value : 0,
            stage: u['stage'] is String ? u['stage'] as String : null,
            item: u['item'] is String ? u['item'] as String : null,
          ),
          price: price is int ? price : null,
          size: size is String ? size : null,
          art: art,
          colors: colors,
        ),
      );
    }
    // 条件が指すものが存在するか
    for (final i in items) {
      if (i.unlock.kind == UnlockKind.placed &&
          (i.unlock.item == null || !ids.contains(i.unlock.item))) {
        problems.add('${i.id}: unlock.item が存在しません');
      }
      if (i.unlock.kind == UnlockKind.clear && i.unlock.stage == null) {
        problems.add('${i.id}: unlock.stage がありません');
      }
    }
    final slots = <TownSlot>[];
    final slotIds = <String>{};
    for (final raw in json['slots'] as List) {
      if (raw is! Map ||
          raw['id'] is! String ||
          (raw['size'] != 'large' && raw['size'] != 'small') ||
          raw['x'] is! num ||
          raw['y'] is! num) {
        problems.add('区画のデータがおかしいです: $raw');
        continue;
      }
      if (!slotIds.add(raw['id'] as String)) problems.add('区画 ${raw['id']} が重複しています');
      slots.add(
        TownSlot(
          id: raw['id'] as String,
          size: raw['size'] as String,
          x: (raw['x'] as num).toDouble(),
          y: (raw['y'] as num).toDouble(),
        ),
      );
    }
    for (final t in [ItemType.train, ItemType.station]) {
      if (!items.any((i) => i.type == t && i.unlock.kind == UnlockKind.start)) {
        problems.add('最初から持っている${t.label}が必要です');
      }
    }
    if (problems.isNotEmpty) throw CatalogFormatException(problems);
    return Catalog(items, slots);
  }
}
