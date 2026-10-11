import 'package:flutter/material.dart';

import '../../game/catalog.dart';
import '../art.dart';

/// アイテム 1 つの絵(assets/images/items/)。町・お店・図鑑・クリア画面で使う。
class ItemArt extends StatelessWidget {
  const ItemArt({super.key, required this.item, this.size = 64, this.locked = false});

  final CollectibleItem item;
  final double size;

  /// 未獲得(シルエットで表示)
  final bool locked;

  @override
  Widget build(BuildContext context) {
    final img = ArtImage(Art.item(item.id), width: size, height: size);
    if (!locked) return img;
    return Opacity(
      opacity: 0.55,
      child: ColorFiltered(
        colorFilter: const ColorFilter.mode(Color(0xFF6E7C84), BlendMode.srcIn),
        child: img,
      ),
    );
  }
}
