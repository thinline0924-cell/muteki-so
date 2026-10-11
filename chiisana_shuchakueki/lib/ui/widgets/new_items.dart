import 'package:flutter/material.dart';

import '../../game/catalog.dart';
import '../../game/sound.dart';
import '../game_scope.dart';
import '../art.dart';
import '../theme.dart';
import 'common.dart';
import 'item_art.dart';

/// 新しく手に入れたものを知らせる(獲得演出)。
Future<void> showNewItemsDialog(BuildContext context, List<CollectibleItem> items) async {
  if (items.isEmpty) return;
  GameScope.of(context).play(Sfx.unlock);
  final title = items.every((i) => i.type == ItemType.resident) ? '新しい住民がやってきた!' : '新しいものを手に入れた!';
  await showDialog<void>(
    context: context,
    builder: (context) => Dialog(
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: PaperPanel(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              height: 40,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Opacity(
                    opacity: 0.6,
                    child: ArtImage(Art.ui('rays'), width: 160, height: 160, fit: BoxFit.cover),
                  ),
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      color: Palette.ink,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 10,
              runSpacing: 10,
              children: [for (final i in items) NewItemChip(item: i, animate: true)],
            ),
            const SizedBox(height: 16),
            ChunkyButton(
              label: 'やったね',
              height: 48,
              fontSize: 17,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    ),
  );
}

/// アイテムの絵と名前の小さな札。
class NewItemChip extends StatelessWidget {
  const NewItemChip({super.key, required this.item, this.animate = false, this.size = 60});

  final CollectibleItem item;
  final bool animate;
  final double size;

  @override
  Widget build(BuildContext context) {
    final child = Container(
      width: size + 36,
      padding: const EdgeInsets.fromLTRB(4, 6, 4, 6),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFFDF6), Color(0xFFF6EBD3)],
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Palette.star, width: 2.5),
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 4, offset: Offset(0, 2))],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ItemArt(item: item, size: size),
          const SizedBox(height: 2),
          Text(
            item.type.label,
            style: const TextStyle(
              fontSize: 10,
              color: Palette.inkSoft,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            item.name,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, height: 1.2),
          ),
        ],
      ),
    );
    if (!animate) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.4, end: 1),
      duration: const Duration(milliseconds: 600),
      curve: Curves.elasticOut,
      builder: (context, v, c) => Transform.scale(scale: v, child: c),
      child: child,
    );
  }
}

/// 取得条件の説明文。
String unlockText(CollectibleItem item, Catalog catalog) {
  final u = item.unlock;
  return switch (u.kind) {
    UnlockKind.start => '最初から持っている',
    UnlockKind.purchase => 'お店で ${item.price} コインで買う',
    UnlockKind.stars => '星を ${u.value} 個集める',
    UnlockKind.clear => 'ステージ ${u.stage} をクリアする',
    UnlockKind.placed => '町に「${catalog.item(u.item ?? '')?.name ?? '?'}」を置く',
    UnlockKind.town => '町に建物や装飾を ${u.value} 個置く',
  };
}
