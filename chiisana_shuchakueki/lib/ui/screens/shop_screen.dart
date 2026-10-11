import 'package:flutter/material.dart';

import '../../game/catalog.dart';
import '../../game/game_controller.dart';
import '../../game/sound.dart';
import '../../game/town.dart';
import '../game_scope.dart';
import '../widgets/item_art.dart';
import '../art.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// 建物ショップ。コインで建物・装飾を開放する。
class ShopScreen extends StatelessWidget {
  const ShopScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final game = GameScope.of(context);
    final forSale = [
      for (final i in game.catalog.items)
        if (i.unlock.kind == UnlockKind.purchase) i,
    ];
    return DefaultTabController(
      length: 3,
      child: GameScaffold(
        body: SafeArea(
          child: Column(
            children: [
              ScreenHeader(
                title: '建物ショップ',
                trailing: [
                  CounterChip(
                    key: const ValueKey('shop-coins'),
                    image: 'coin',
                    text: '${game.progress.coins}',
                  ),
                ],
              ),
              const TabBar(
                labelColor: Colors.white,
                unselectedLabelColor: Colors.white60,
                indicatorColor: Palette.star,
                dividerColor: Colors.transparent,
                labelStyle: TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                tabs: [
                  Tab(text: 'すべて'),
                  Tab(text: '建物'),
                  Tab(text: '装飾'),
                ],
              ),
              Expanded(
                child: PaperPanel(
                  margin: const EdgeInsets.fromLTRB(10, 6, 10, 10),
                  padding: EdgeInsets.zero,
                  child: TabBarView(
                    children: [
                      _list(game, forSale),
                      _list(game, forSale.where((i) => i.type == ItemType.building).toList()),
                      _list(game, forSale.where((i) => i.type == ItemType.decoration).toList()),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _list(GameController game, List<CollectibleItem> items) {
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: items.length,
      separatorBuilder: (_, _) => const Divider(height: 16),
      itemBuilder: (context, i) => _ShopRow(game: game, item: items[i]),
    );
  }
}

class _ShopRow extends StatelessWidget {
  const _ShopRow({required this.game, required this.item});

  final GameController game;
  final CollectibleItem item;

  void _buy(BuildContext context) {
    final r = game.buy(item.id);
    final messenger = ScaffoldMessenger.of(context)..hideCurrentSnackBar();
    switch (r) {
      case BuyResult.ok:
        game
          ..play(Sfx.buy)
          ..vibrate(Haptic.light);
        messenger.showSnackBar(SnackBar(content: Text('「${item.name}」を手に入れた! 町の区画に置いてみよう')));
      case BuyResult.notEnoughCoins:
        messenger.showSnackBar(const SnackBar(content: Text('コインが足りません。ステージをクリアして集めよう')));
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final owned = game.owns(item.id);
    final price = item.price ?? 0;
    final enough = game.progress.coins >= price;
    return Row(
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(color: Palette.paper, borderRadius: BorderRadius.circular(14)),
          child: ItemArt(item: item, size: 60),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
              const SizedBox(height: 2),
              Text(
                item.description,
                style: const TextStyle(fontSize: 12, height: 1.35, color: Palette.inkSoft),
              ),
              const SizedBox(height: 4),
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 2,
                children: [
                  ArtImage(Art.ui('coin'), width: 20, height: 20),
                  Text('$price  ', style: const TextStyle(fontWeight: FontWeight.w800)),
                  Text(
                    item.type == ItemType.building ? '大きな区画' : '小さな区画',
                    style: const TextStyle(fontSize: 11, color: Palette.inkSoft),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 74,
          child: owned
              ? const Text(
                  '持っている',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Palette.green, fontWeight: FontWeight.w900),
                )
              : ChunkyButton(
                  key: ValueKey('buy-${item.id}'),
                  label: '購入',
                  height: 38,
                  fontSize: 14,
                  color: Palette.green,
                  shadow: Palette.greenDark,
                  muted: !enough,
                  onPressed: () => _buy(context),
                ),
        ),
      ],
    );
  }
}
