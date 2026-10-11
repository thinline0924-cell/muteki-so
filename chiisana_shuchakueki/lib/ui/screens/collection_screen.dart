import 'package:flutter/material.dart';

import '../../game/catalog.dart';
import '../../game/game_controller.dart';
import '../../game/sound.dart';
import '../game_scope.dart';
import '../painters/item_painter.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/new_items.dart';

/// コレクション図鑑。
class CollectionScreen extends StatelessWidget {
  const CollectionScreen({super.key});

  static const tabs = [
    ItemType.train,
    ItemType.station,
    ItemType.building,
    ItemType.decoration,
    ItemType.resident,
  ];

  @override
  Widget build(BuildContext context) {
    final game = GameScope.of(context);
    final all = game.catalog.items;
    final owned = all.where((i) => game.owns(i.id)).length;
    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 14, 4),
                child: Row(
                  children: [
                    const RoundBackButton(),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'コレクション',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Text(
                      '$owned / ${all.length}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ),
              TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                labelColor: Colors.white,
                unselectedLabelColor: Colors.white60,
                indicatorColor: Palette.star,
                dividerColor: Colors.transparent,
                labelStyle: const TextStyle(fontWeight: FontWeight.w800),
                tabs: [
                  for (final t in tabs)
                    Tab(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(t.label),
                          if (game.catalog.ofType(t).any((i) => game.isNew(i.id)))
                            Container(
                              margin: const EdgeInsets.only(left: 4),
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Palette.danger,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
              Expanded(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(10, 6, 10, 10),
                  decoration: BoxDecoration(
                    color: Palette.cream,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: TabBarView(
                    children: [for (final t in tabs) _grid(game, game.catalog.ofType(t))],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _grid(GameController game, List<CollectibleItem> items) {
    return LayoutBuilder(
      builder: (context, c) {
        final cols = c.maxWidth > 500 ? 4 : 3;
        return GridView.builder(
          padding: const EdgeInsets.all(12),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: cols,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.78,
          ),
          itemCount: items.length,
          itemBuilder: (context, i) => _Card(game: game, item: items[i]),
        );
      },
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.game, required this.item});

  final GameController game;
  final CollectibleItem item;

  bool get _inUse => game.train.id == item.id || game.station.id == item.id;

  @override
  Widget build(BuildContext context) {
    final owned = game.owns(item.id);
    return Material(
      color: owned ? Palette.paper : const Color(0xFFE2DACB),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        key: ValueKey('card-${item.id}'),
        borderRadius: BorderRadius.circular(14),
        onTap: () {
          game.play(Sfx.button);
          if (owned) game.markSeen(item.id);
          showModalBottomSheet<void>(
            context: context,
            backgroundColor: Palette.cream,
            showDragHandle: true,
            builder: (_) => _Detail(game: game, item: item),
          );
        },
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 8, 4, 6),
              child: Column(
                children: [
                  Expanded(
                    child: FittedBox(
                      child: ItemArt(item: item, size: 72, locked: !owned),
                    ),
                  ),
                  Text(
                    owned ? item.name : '???',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
            if (!owned)
              const Positioned(
                right: 6,
                top: 6,
                child: Icon(Icons.lock_rounded, size: 16, color: Palette.inkSoft),
              ),
            if (game.isNew(item.id))
              Positioned(left: 6, top: 6, child: _badge('NEW', Palette.danger)),
            if (owned && _inUse) Positioned(right: 6, top: 6, child: _badge('使用中', Palette.green)),
          ],
        ),
      ),
    );
  }

  Widget _badge(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6)),
    child: Text(
      text,
      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900),
    ),
  );
}

class _Detail extends StatelessWidget {
  const _Detail({required this.game, required this.item});

  final GameController game;
  final CollectibleItem item;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: game,
      builder: (context, _) {
        final owned = game.owns(item.id);
        final selectable = owned && (item.type == ItemType.train || item.type == ItemType.station);
        final inUse = game.train.id == item.id || game.station.id == item.id;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ItemArt(item: item, size: 130, locked: !owned),
                const SizedBox(height: 6),
                Text(
                  item.type.label,
                  style: const TextStyle(color: Palette.inkSoft, fontWeight: FontWeight.w700),
                ),
                Text(
                  owned ? item.name : '???',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  owned ? item.description : 'まだ手に入れていません',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, height: 1.5),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Palette.paper,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '手に入れ方:${unlockText(item, game.catalog)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Palette.inkSoft,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (selectable) ...[
                  const SizedBox(height: 14),
                  ChunkyButton(
                    key: const ValueKey('use-item'),
                    label: inUse ? '使用中' : (item.type == ItemType.train ? 'この列車を走らせる' : 'この駅舎にする'),
                    icon: inUse ? Icons.check_rounded : Icons.swap_horiz_rounded,
                    color: Palette.green,
                    shadow: Palette.greenDark,
                    height: 50,
                    fontSize: 16,
                    onPressed: inUse
                        ? null
                        : () {
                            game.select(item.id);
                            game.play(Sfx.buy);
                          },
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
