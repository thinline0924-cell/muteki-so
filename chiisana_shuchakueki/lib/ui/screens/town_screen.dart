import 'package:flutter/material.dart';

import '../../game/catalog.dart';
import '../../game/game_controller.dart';
import '../../game/sound.dart';
import '../../game/town.dart';
import '../game_scope.dart';
import '../painters/item_painter.dart';
import '../painters/town_painter.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/new_items.dart';
import 'collection_screen.dart';
import 'shop_screen.dart';

/// 町の画面:駅前の俯瞰。区画をタップして建物や装飾を置く。
class TownScreen extends StatefulWidget {
  const TownScreen({super.key});

  @override
  State<TownScreen> createState() => _TownScreenState();
}

class _TownScreenState extends State<TownScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _wave = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 5),
  )..repeat();

  @override
  void dispose() {
    _wave.dispose();
    super.dispose();
  }

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
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 12, 6),
              child: Row(
                children: [
                  const RoundBackButton(),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'わたしの終着駅',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  CounterChip(
                    key: const ValueKey('coins'),
                    icon: Icons.monetization_on_rounded,
                    iconColor: Palette.coin,
                    text: '${game.progress.coins}',
                  ),
                  const SizedBox(width: 6),
                  CounterChip(
                    icon: Icons.star_rounded,
                    iconColor: Palette.star,
                    text: '${game.progress.totalStars}',
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  const Icon(Icons.location_city_rounded, color: Colors.white70, size: 18),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      TownRules.developmentTitle(placed),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
                    ),
                  ),
                  Text(
                    '$placed / ${catalog.slots.length}',
                    style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    width: 70,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: catalog.slots.isEmpty ? 0 : placed / catalog.slots.length,
                        minHeight: 8,
                        color: Palette.star,
                        backgroundColor: Colors.white24,
                      ),
                    ),
                  ),
                ],
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
    );
  }

  Widget _townView(GameController game, Catalog catalog, List<CollectibleItem> residents) {
    return LayoutBuilder(
      builder: (context, c) {
        final k = (c.maxWidth / townDesignSize.width) < (c.maxHeight / townDesignSize.height)
            ? c.maxWidth / townDesignSize.width
            : c.maxHeight / townDesignSize.height;
        final w = townDesignSize.width * k;
        final h = townDesignSize.height * k;
        // 奥(上)から順に描くと、手前のものが前に来る
        final slots = [...catalog.slots]..sort((a, b) => a.y.compareTo(b.y));
        final placed = game.progress.placedBuildings;
        return Center(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: SizedBox(
              width: w,
              height: h,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: AnimatedBuilder(
                      animation: _wave,
                      builder: (context, _) => CustomPaint(
                        painter: TownPainter(
                          station: game.station,
                          train: game.train,
                          slots: catalog.slots,
                          occupied: placed.keys.toSet(),
                          wave: _wave.value,
                        ),
                      ),
                    ),
                  ),
                  for (final s in slots)
                    if (placed[s.id] != null && catalog.item(placed[s.id]!) != null)
                      _placedItem(catalog.item(placed[s.id]!)!, s, k),
                  for (var i = 0; i < residents.length && i < residentSpots.length; i++)
                    Positioned(
                      left: residentSpots[i].dx * k - 15 * k,
                      top: residentSpots[i].dy * k - 30 * k,
                      width: 30 * k,
                      height: 30 * k,
                      child: IgnorePointer(
                        child: ItemArt(item: residents[i], size: 30 * k),
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

  double _artSize(TownSlot s) => s.size == 'large' ? 96 : 48;

  Widget _placedItem(CollectibleItem item, TownSlot s, double k) {
    final size = _artSize(s) * k;
    return Positioned(
      key: ValueKey('placed-${s.id}-${item.id}'),
      left: s.x * k - size / 2,
      top: s.y * k - size * 0.93,
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
