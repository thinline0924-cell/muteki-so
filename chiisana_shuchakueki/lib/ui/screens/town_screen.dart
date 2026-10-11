import 'package:flutter/material.dart';

import '../../game/catalog.dart';
import '../../game/game_controller.dart';
import '../../game/sound.dart';
import '../../game/town.dart';
import '../game_scope.dart';

import 'dart:math' as math;

import '../art.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/item_art.dart';
import '../widgets/new_items.dart';
import 'collection_screen.dart';
import 'shop_screen.dart';

/// 町の画面:駅前の俯瞰。区画をタップして建物や装飾を置く。
class TownScreen extends StatefulWidget {
  const TownScreen({super.key});

  @override
  State<TownScreen> createState() => _TownScreenState();
}

/// 町の設計図の大きさ(区画の座標はこの中の値)
const townDesignSize = Size(360, 480);

/// 住民が立つ場所(設計図の座標、足もと)。持っている住民を順に置く。
const residentSpots = [
  Offset(232, 112), // 駅長さんはホーム
  Offset(95, 168),
  Offset(270, 166),
  Offset(206, 202),
  Offset(188, 264),
  Offset(172, 332),
  Offset(188, 400),
  Offset(130, 440),
];

class _TownScreenState extends State<TownScreen> {
  Future<void> _openSlot(GameController game, TownSlot slot) async {
    game.play(Sfx.button);
    final chosen = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Palette.cream,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => _SlotSheet(game: game, slot: slot),
    );
    if (!mounted || chosen == null) return;
    if (chosen == _SlotSheet.removeAction) {
      game.removeFromSlot(slot.id);
      game.play(Sfx.button);
      return;
    }
    if (chosen == _SlotSheet.shopAction) {
      await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const ShopScreen()));
      return;
    }
    final r = game.place(slot.id, chosen);
    if (r.result == PlaceResult.ok) {
      game
        ..play(Sfx.tap)
        ..vibrate(Haptic.light);
      if (r.newItems.isNotEmpty) {
        await Future<void>.delayed(const Duration(milliseconds: 400));
        if (mounted) await showNewItemsDialog(context, r.newItems);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final game = GameScope.of(context);
    final catalog = game.catalog;
    final placed = game.placedCount;
    final residents = [
      for (final i in catalog.ofType(ItemType.resident))
        if (game.owns(i.id)) i,
    ];
    final showTip = !game.tutorialSeen('town');
    return Scaffold(
      body: GameBackground(
        child: SafeArea(
          child: Column(
            children: [
              ScreenHeader(
                title: 'わたしの終着駅',
                trailing: [
                  CounterChip(
                    key: const ValueKey('coins'),
                    image: 'coin',
                    text: '${game.progress.coins}',
                  ),
                  CounterChip(image: 'star', text: '${game.progress.totalStars}'),
                ],
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
                  decoration: BoxDecoration(
                    color: const Color(0x8812303D),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.location_city_rounded, color: Palette.star, size: 20),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          TownRules.developmentTitle(placed),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
                        ),
                      ),
                      Text(
                        '$placed / ${catalog.slots.length}',
                        style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 72,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(5),
                          child: LinearProgressIndicator(
                            value: catalog.slots.isEmpty ? 0 : placed / catalog.slots.length,
                            minHeight: 10,
                            color: Palette.star,
                            backgroundColor: Colors.white24,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Stack(
                    children: [
                      Positioned.fill(child: _townView(game, catalog, residents)),
                      if (showTip)
                        Positioned(
                          left: 8,
                          right: 8,
                          top: 8,
                          child: _TownTip(
                            onClose: () {
                              game
                                ..play(Sfx.button)
                                ..markTutorialSeen('town');
                            },
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: ChunkyButton(
                        key: const ValueKey('shop'),
                        label: 'お店',
                        icon: Icons.storefront_rounded,
                        color: Palette.orange,
                        shadow: Palette.orangeDark,
                        height: 50,
                        fontSize: 17,
                        onPressed: () {
                          game.play(Sfx.button);
                          Navigator.of(context)
                              .push(MaterialPageRoute<void>(builder: (_) => const ShopScreen()));
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ChunkyButton(
                        label: '図鑑',
                        icon: Icons.menu_book_rounded,
                        color: Palette.purple,
                        shadow: Palette.purpleDark,
                        height: 50,
                        fontSize: 17,
                        badge: game.newItemCount > 0 ? 'NEW ${game.newItemCount}' : null,
                        badgeColor: Palette.danger,
                        onPressed: () {
                          game.play(Sfx.button);
                          Navigator.of(
                            context,
                          ).push(MaterialPageRoute<void>(builder: (_) => const CollectionScreen()));
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _townView(GameController game, Catalog catalog, List<CollectibleItem> residents) {
    return LayoutBuilder(
      builder: (context, c) {
        final k = math.min(c.maxWidth / townDesignSize.width, c.maxHeight / townDesignSize.height);
        final w = townDesignSize.width * k;
        final h = townDesignSize.height * k;
        // 奥(上)から順に描くと、手前のものが前に来る
        final slots = [...catalog.slots]..sort((a, b) => a.y.compareTo(b.y));
        final placed = game.progress.placedBuildings;
        return Center(
          child: Container(
            width: w,
            height: h,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE6D5B2), width: 3),
              boxShadow: const [
                BoxShadow(color: Color(0x66000000), blurRadius: 14, offset: Offset(0, 6)),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(17),
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(child: ArtImage(Art.town('background.jpg'), fit: BoxFit.fill)),
                  // 駅舎と、止まっている列車
                  Positioned(
                    left: (180 - 76) * k,
                    top: 9 * k,
                    width: 152 * k,
                    height: 101 * k,
                    child: IgnorePointer(
                      child: ItemArt(item: game.station, size: 152 * k),
                    ),
                  ),
                  Positioned(
                    left: 6 * k,
                    top: 76 * k,
                    width: 118 * k,
                    height: 49 * k,
                    child: IgnorePointer(
                      child: ArtImage(Art.item(game.train.id), fit: BoxFit.fill),
                    ),
                  ),
                  for (final s in slots)
                    if (placed[s.id] == null) _slotMarker(s, k),
                  for (final s in slots)
                    if (placed[s.id] != null && catalog.item(placed[s.id]!) != null)
                      _placedItem(catalog.item(placed[s.id]!)!, s, k),
                  for (var i = 0; i < residents.length && i < residentSpots.length; i++)
                    Positioned(
                      left: residentSpots[i].dx * k - 17 * k,
                      top: residentSpots[i].dy * k - 31 * k,
                      width: 34 * k,
                      height: 34 * k,
                      child: IgnorePointer(
                        child: ItemArt(item: residents[i], size: 34 * k),
                      ),
                    ),
                  for (final s in slots) _slotTarget(game, s, k),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  /// 空いている区画の目印(点線の枠と「+」)
  Widget _slotMarker(TownSlot s, double k) {
    final large = s.size == 'large';
    final w = (large ? 82 : 38) * k, h = (large ? 54 : 32) * k;
    return Positioned(
      left: s.x * k - w / 2,
      top: (s.y - (large ? 30 : 18)) * k - h / 2,
      width: w,
      height: h,
      child: IgnorePointer(child: CustomPaint(painter: _SlotMarkerPainter())),
    );
  }

  double _artSize(TownSlot s) => s.size == 'large' ? 96 : 48;

  Widget _placedItem(CollectibleItem item, TownSlot s, double k) {
    final size = _artSize(s) * k;
    return Positioned(
      key: ValueKey('placed-${s.id}-${item.id}'),
      left: s.x * k - size / 2,
      top: s.y * k - size * 0.91,
      width: size,
      height: size,
      child: IgnorePointer(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.5, end: 1),
          duration: const Duration(milliseconds: 550),
          curve: Curves.elasticOut,
          builder: (context, v, child) =>
              Transform.scale(scale: v, alignment: Alignment.bottomCenter, child: child),
          child: ItemArt(item: item, size: size),
        ),
      ),
    );
  }

  Widget _slotTarget(GameController game, TownSlot s, double k) {
    final size = _artSize(s) * k;
    final item = game.progress.placedBuildings[s.id];
    return Positioned(
      left: s.x * k - size / 2,
      top: s.y * k - size * 0.93,
      width: size,
      height: size,
      child: Semantics(
        button: true,
        label: item == null ? '空いている区画' : '${game.catalog.item(item)?.name ?? ''}がある区画',
        child: GestureDetector(
          key: ValueKey('slot-${s.id}'),
          behavior: HitTestBehavior.opaque,
          onTap: () => _openSlot(game, s),
        ),
      ),
    );
  }
}

class _TownTip extends StatelessWidget {
  const _TownTip({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Palette.paper,
      elevation: 3,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 0, 8),
        child: Row(
          children: [
            const Icon(Icons.tips_and_updates_rounded, color: Palette.orange),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'クリアでもらったコインで、お店の建物を買おう。\n「+」の区画をタップすると置けます。',
                style: TextStyle(fontSize: 13, height: 1.35, fontWeight: FontWeight.w600),
              ),
            ),
            IconButton(
              tooltip: '閉じる',
              onPressed: onClose,
              icon: const Icon(Icons.close_rounded, color: Palette.inkSoft),
            ),
          ],
        ),
      ),
    );
  }
}

/// 区画をタップしたときの選択肢。選んだアイテム ID(または特別な値)を返す。
class _SlotSheet extends StatelessWidget {
  const _SlotSheet({required this.game, required this.slot});

  static const removeAction = '__remove__';
  static const shopAction = '__shop__';

  final GameController game;
  final TownSlot slot;

  @override
  Widget build(BuildContext context) {
    final current = game.progress.placedBuildings[slot.id];
    final currentItem = current == null ? null : game.catalog.item(current);
    final large = slot.size == 'large';
    final choices = [
      for (final i in game.catalog.items)
        if (i.type.placeable && i.size == slot.size && game.owns(i.id)) i,
    ];
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              large ? '大きな区画(建物を置けます)' : '小さな区画(装飾を置けます)',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            if (currentItem != null) ...[
              Row(
                children: [
                  ItemArt(item: currentItem, size: 44),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'いまは「${currentItem.name}」',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  TextButton.icon(
                    key: const ValueKey('remove'),
                    onPressed: () => Navigator.of(context).pop(removeAction),
                    icon: const Icon(Icons.delete_outline_rounded),
                    label: const Text('片づける'),
                  ),
                ],
              ),
              const Divider(),
            ],
            if (choices.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  large ? '置ける建物をまだ持っていません。' : '置ける装飾をまだ持っていません。',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Palette.inkSoft, fontWeight: FontWeight.w700),
                ),
              )
            else
              ConstrainedBox(
                constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.45),
                child: SingleChildScrollView(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final i in choices)
                        InkWell(
                          key: ValueKey('choose-${i.id}'),
                          borderRadius: BorderRadius.circular(14),
                          onTap: () => Navigator.of(context).pop(i.id),
                          child: Container(
                            width: 92,
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Palette.paper,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: i.id == current ? Palette.orange : Palette.creamDark,
                                width: 2,
                              ),
                            ),
                            child: Column(
                              children: [
                                ItemArt(item: i, size: 56),
                                Text(
                                  i.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).pop(shopAction),
              icon: const Icon(Icons.storefront_rounded),
              label: const Text('お店で買う'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlotMarkerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(size.shortestSide * 0.25),
    );
    canvas.drawRRect(r, Paint()..color = const Color(0x40FFFFFF));
    final dash = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(1.5, size.shortestSide * 0.06);
    final path = Path()..addRRect(r.deflate(1));
    for (final m in path.computeMetrics()) {
      final step = size.shortestSide * 0.22;
      for (var d = 0.0; d < m.length; d += step) {
        canvas.drawPath(m.extractPath(d, math.min(d + step * 0.55, m.length)), dash);
      }
    }
    final c = size.center(Offset.zero);
    final a = size.shortestSide * 0.2;
    final plus = Paint()
      ..color = Colors.white
      ..strokeWidth = math.max(2, size.shortestSide * 0.1)
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(c, a * 1.5, Paint()..color = const Color(0x553F8A52));
    canvas.drawLine(c - Offset(a, 0), c + Offset(a, 0), plus);
    canvas.drawLine(c - Offset(0, a), c + Offset(0, a), plus);
  }

  @override
  bool shouldRepaint(_SlotMarkerPainter oldDelegate) => false;
}
