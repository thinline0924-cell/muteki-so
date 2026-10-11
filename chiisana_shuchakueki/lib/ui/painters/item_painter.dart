import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../game/catalog.dart';
import '../theme.dart';

/// アイテム 1 つの絵。町・お店・図鑑・クリア画面で共通に使う。
class ItemArt extends StatelessWidget {
  const ItemArt({super.key, required this.item, this.size = 64, this.locked = false});

  final CollectibleItem item;
  final double size;

  /// 未獲得(シルエットで表示)
  final bool locked;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: ItemPainter(item, locked: locked)),
    );
  }
}

class ItemPainter extends CustomPainter {
  const ItemPainter(this.item, {this.locked = false});

  final CollectibleItem item;
  final bool locked;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    canvas.save();
    canvas.translate((size.width - s) / 2, (size.height - s) / 2);
    if (locked) {
      // 未獲得はシルエット
      canvas.saveLayer(Rect.fromLTWH(0, 0, s, s), Paint());
      paintItemArt(canvas, s, item);
      canvas.drawRect(
        Rect.fromLTWH(0, 0, s, s),
        Paint()
          ..color = const Color(0xFF8D9AA0)
          ..blendMode = BlendMode.srcIn,
      );
      canvas.restore();
    } else {
      paintItemArt(canvas, s, item);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(ItemPainter old) => old.item.id != item.id || old.locked != locked;
}

Color _c(CollectibleItem item, String key, Color fallback) => colorOf(item.colors[key], fallback);

/// s×s の正方形の中に、足もとを下の中央にそろえて描く。
void paintItemArt(Canvas c, double s, CollectibleItem item) {
  switch (item.art) {
    case 'house_small':
      _house(c, s, wall: const Color(0xFFF5E6C8), roof: Palette.roof, chimney: true);
    case 'house_blue':
      _house(c, s, wall: Colors.white, roof: Palette.roofGoal);
    case 'shop':
      _shop(c, s, wall: const Color(0xFFF3E9D2), stripe: Palette.danger, sign: '商店');
    case 'cafe':
      _shop(c, s, wall: const Color(0xFFEFE2C6), stripe: Palette.green, sign: 'カフェ', cups: true);
    case 'bakery':
      _bakery(c, s);
    case 'clocktower':
      _clockTower(c, s);
    case 'tree':
      _tree(c, s);
    case 'flowerbed':
      _flowerbed(c, s);
    case 'bench':
      _bench(c, s);
    case 'streetlamp':
      _lamp(c, s);
    case 'mailbox':
      _mailbox(c, s);
    case 'pond':
      _pond(c, s);
    case 'fountain':
      _fountain(c, s);
    case 'train':
      _train(c, s, _c(item, 'body', Palette.train), _c(item, 'accent', Palette.trainAccent));
    case 'station':
      paintStationBuilding(
        c,
        Rect.fromLTWH(s * 0.06, s * 0.2, s * 0.88, s * 0.72),
        roof: _c(item, 'roof', Palette.roof),
        wall: _c(item, 'wall', const Color(0xFFF5E6C8)),
      );
    case 'person':
      paintPerson(
        c,
        Offset(s / 2, s * 0.94),
        s * 0.9,
        hat: _c(item, 'hat', Palette.navy),
        clothes: _c(item, 'clothes', Palette.navy),
      );
    case 'cat':
      paintCat(c, Offset(s / 2, s * 0.92), s * 0.8, _c(item, 'clothes', const Color(0xFFE8A04A)));
    default:
      c.drawCircle(Offset(s / 2, s / 2), s * 0.3, Paint()..color = Palette.inkSoft);
  }
}

void _shadow(Canvas c, double s, double w) {
  c.drawOval(
    Rect.fromCenter(center: Offset(s / 2, s * 0.93), width: s * w, height: s * 0.1),
    Paint()..color = const Color(0x33000000),
  );
}

void _house(Canvas c, double s, {required Color wall, required Color roof, bool chimney = false}) {
  _shadow(c, s, 0.86);
  final body = Rect.fromLTWH(s * 0.16, s * 0.48, s * 0.68, s * 0.44);
  if (chimney) {
    c.drawRect(
      Rect.fromLTWH(s * 0.62, s * 0.22, s * 0.09, s * 0.2),
      Paint()..color = const Color(0xFF8B5E3C),
    );
    c.drawCircle(Offset(s * 0.68, s * 0.15), s * 0.05, Paint()..color = const Color(0xBBFFFFFF));
    c.drawCircle(Offset(s * 0.74, s * 0.08), s * 0.035, Paint()..color = const Color(0x99FFFFFF));
  }
  c.drawRect(body, Paint()..color = wall);
  c.drawRect(
    body,
    Paint()
      ..color = const Color(0x22000000)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.015,
  );
  c.drawPath(
    Path()
      ..moveTo(s * 0.08, s * 0.5)
      ..lineTo(s * 0.5, s * 0.2)
      ..lineTo(s * 0.92, s * 0.5)
      ..close(),
    Paint()..color = roof,
  );
  c.drawPath(
    Path()
      ..moveTo(s * 0.08, s * 0.5)
      ..lineTo(s * 0.5, s * 0.2)
      ..lineTo(s * 0.5, s * 0.26)
      ..lineTo(s * 0.16, s * 0.5)
      ..close(),
    Paint()..color = const Color(0x22FFFFFF),
  );
  // 扉と窓
  c.drawRRect(
    RRect.fromRectAndCorners(
      Rect.fromLTWH(s * 0.43, s * 0.66, s * 0.14, s * 0.26),
      topLeft: Radius.circular(s * 0.07),
      topRight: Radius.circular(s * 0.07),
    ),
    Paint()..color = const Color(0xFF8B5E3C),
  );
  _window(c, Rect.fromLTWH(s * 0.22, s * 0.6, s * 0.14, s * 0.13));
  _window(c, Rect.fromLTWH(s * 0.64, s * 0.6, s * 0.14, s * 0.13));
}

void _window(Canvas c, Rect r) {
  c.drawRect(r, Paint()..color = const Color(0xFF9FD3EA));
  final line = Paint()
    ..color = Colors.white
    ..strokeWidth = r.width * 0.12;
  c.drawLine(Offset(r.center.dx, r.top), Offset(r.center.dx, r.bottom), line);
  c.drawLine(Offset(r.left, r.center.dy), Offset(r.right, r.center.dy), line);
}

void _shop(
  Canvas c,
  double s, {
  required Color wall,
  required Color stripe,
  required String sign,
  bool cups = false,
}) {
  _shadow(c, s, 0.9);
  final body = Rect.fromLTWH(s * 0.12, s * 0.36, s * 0.76, s * 0.56);
  c.drawRect(body, Paint()..color = wall);
  c.drawRect(
    Rect.fromLTWH(s * 0.1, s * 0.3, s * 0.8, s * 0.08),
    Paint()..color = darken(wall, 0.25),
  );
  // 看板
  final signRect = Rect.fromLTWH(s * 0.24, s * 0.4, s * 0.52, s * 0.12);
  c.drawRRect(
    RRect.fromRectAndRadius(signRect, Radius.circular(s * 0.02)),
    Paint()..color = const Color(0xFF6B4B33),
  );
  _text(c, sign, signRect.center, s * 0.085, Colors.white);
  // しまのひさし
  final aw = Rect.fromLTWH(s * 0.1, s * 0.55, s * 0.8, s * 0.1);
  const n = 6;
  for (var i = 0; i < n; i++) {
    final x0 = aw.left + aw.width * i / n;
    final p = Path()
      ..moveTo(x0, aw.top)
      ..lineTo(x0 + aw.width / n, aw.top)
      ..lineTo(x0 + aw.width / n, aw.bottom)
      ..arcToPoint(Offset(x0, aw.bottom), radius: Radius.circular(aw.width / n / 2))
      ..close();
    c.drawPath(p, Paint()..color = i.isEven ? stripe : Colors.white);
  }
  // 窓と扉
  c.drawRect(
    Rect.fromLTWH(s * 0.18, s * 0.68, s * 0.28, s * 0.16),
    Paint()..color = const Color(0xFF9FD3EA),
  );
  c.drawRect(
    Rect.fromLTWH(s * 0.56, s * 0.66, s * 0.18, s * 0.26),
    Paint()..color = const Color(0xFF8B5E3C),
  );
  if (cups) {
    c.drawCircle(Offset(s * 0.26, s * 0.77), s * 0.025, Paint()..color = Colors.white);
    c.drawCircle(Offset(s * 0.37, s * 0.77), s * 0.025, Paint()..color = Colors.white);
  } else {
    for (var i = 0; i < 3; i++) {
      c.drawCircle(
        Offset(s * (0.23 + i * 0.09), s * 0.79),
        s * 0.03,
        Paint()..color = [Palette.orange, Palette.green, Palette.danger][i],
      );
    }
  }
}

void _bakery(Canvas c, double s) {
  _house(c, s, wall: const Color(0xFFF7D9A8), roof: const Color(0xFF8B4A2B), chimney: true);
  // パンの看板
  final sign = Rect.fromCenter(center: Offset(s * 0.5, s * 0.5), width: s * 0.3, height: s * 0.13);
  c.drawRRect(
    RRect.fromRectAndRadius(sign, Radius.circular(s * 0.06)),
    Paint()..color = Colors.white,
  );
  c.drawOval(
    Rect.fromCenter(center: sign.center, width: s * 0.2, height: s * 0.08),
    Paint()..color = const Color(0xFFD9963A),
  );
  for (var i = -1; i <= 1; i++) {
    c.drawLine(
      sign.center + Offset(i * s * 0.05 - s * 0.01, -s * 0.025),
      sign.center + Offset(i * s * 0.05 + s * 0.01, s * 0.025),
      Paint()
        ..color = const Color(0xFFF7E0B5)
        ..strokeWidth = s * 0.012,
    );
  }
}

void _clockTower(Canvas c, double s) {
  _shadow(c, s, 0.6);
  final body = Rect.fromLTWH(s * 0.32, s * 0.24, s * 0.36, s * 0.68);
  c.drawRect(body, Paint()..color = const Color(0xFFE9DCC0));
  c.drawRect(
    Rect.fromLTWH(s * 0.32, s * 0.24, s * 0.36, s * 0.05),
    Paint()..color = const Color(0xFFB9A57E),
  );
  c.drawPath(
    Path()
      ..moveTo(s * 0.27, s * 0.25)
      ..lineTo(s * 0.5, s * 0.02)
      ..lineTo(s * 0.73, s * 0.25)
      ..close(),
    Paint()..color = Palette.green,
  );
  final clock = Offset(s * 0.5, s * 0.4);
  c.drawCircle(clock, s * 0.11, Paint()..color = Colors.white);
  c.drawCircle(
    clock,
    s * 0.11,
    Paint()
      ..color = const Color(0xFF6B4B33)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.02,
  );
  final hand = Paint()
    ..color = Palette.ink
    ..strokeWidth = s * 0.018
    ..strokeCap = StrokeCap.round;
  c.drawLine(clock, clock + Offset(0, -s * 0.075), hand);
  c.drawLine(clock, clock + Offset(s * 0.05, s * 0.02), hand);
  c.drawRRect(
    RRect.fromRectAndCorners(
      Rect.fromLTWH(s * 0.43, s * 0.72, s * 0.14, s * 0.2),
      topLeft: Radius.circular(s * 0.07),
      topRight: Radius.circular(s * 0.07),
    ),
    Paint()..color = const Color(0xFF8B5E3C),
  );
  _window(c, Rect.fromLTWH(s * 0.44, s * 0.56, s * 0.12, s * 0.1));
}

void _tree(Canvas c, double s) {
  _shadow(c, s, 0.6);
  c.drawRect(
    Rect.fromLTWH(s * 0.45, s * 0.62, s * 0.1, s * 0.3),
    Paint()..color = const Color(0xFF7A5034),
  );
  c.drawCircle(Offset(s * 0.36, s * 0.52), s * 0.2, Paint()..color = Palette.treeDark);
  c.drawCircle(Offset(s * 0.64, s * 0.52), s * 0.2, Paint()..color = Palette.treeDark);
  c.drawCircle(Offset(s * 0.5, s * 0.36), s * 0.25, Paint()..color = Palette.tree);
  c.drawCircle(Offset(s * 0.42, s * 0.28), s * 0.08, Paint()..color = const Color(0x55FFFFFF));
}

void _flowerbed(Canvas c, double s) {
  _shadow(c, s, 0.8);
  final box = Rect.fromLTWH(s * 0.12, s * 0.66, s * 0.76, s * 0.24);
  c.drawRRect(
    RRect.fromRectAndRadius(box, Radius.circular(s * 0.04)),
    Paint()..color = const Color(0xFF9C6B45),
  );
  c.drawRect(
    Rect.fromLTWH(s * 0.15, s * 0.62, s * 0.7, s * 0.07),
    Paint()..color = const Color(0xFF6B4B33),
  );
  final r = math.Random(5);
  const colors = [
    Color(0xFFF7B3C0),
    Color(0xFFFFF4C2),
    Color(0xFFF08A5D),
    Colors.white,
    Color(0xFFB39DDB),
  ];
  for (var i = 0; i < 7; i++) {
    final x = s * (0.2 + i * 0.1);
    final y = s * (0.5 + r.nextDouble() * 0.08);
    c.drawLine(
      Offset(x, y),
      Offset(x, s * 0.64),
      Paint()
        ..color = Palette.green
        ..strokeWidth = s * 0.02,
    );
    c.drawCircle(Offset(x, y), s * 0.05, Paint()..color = colors[i % colors.length]);
    c.drawCircle(Offset(x, y), s * 0.018, Paint()..color = Palette.star);
  }
}

void _bench(Canvas c, double s) {
  _shadow(c, s, 0.8);
  final wood = Paint()..color = const Color(0xFFA8703F);
  final leg = Paint()..color = const Color(0xFF4A4A4A);
  c.drawRect(Rect.fromLTWH(s * 0.18, s * 0.66, s * 0.05, s * 0.26), leg);
  c.drawRect(Rect.fromLTWH(s * 0.77, s * 0.66, s * 0.05, s * 0.26), leg);
  for (var i = 0; i < 2; i++) {
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(s * 0.12, s * (0.44 + i * 0.09), s * 0.76, s * 0.06),
        Radius.circular(s * 0.02),
      ),
      wood,
    );
  }
  c.drawRRect(
    RRect.fromRectAndRadius(
      Rect.fromLTWH(s * 0.1, s * 0.66, s * 0.8, s * 0.07),
      Radius.circular(s * 0.02),
    ),
    wood,
  );
}

void _lamp(Canvas c, double s) {
  _shadow(c, s, 0.4);
  c.drawCircle(Offset(s * 0.5, s * 0.2), s * 0.18, Paint()..color = const Color(0x55FFE9A8));
  c.drawRect(
    Rect.fromLTWH(s * 0.47, s * 0.28, s * 0.06, s * 0.62),
    Paint()..color = const Color(0xFF2E3B44),
  );
  c.drawRect(
    Rect.fromLTWH(s * 0.4, s * 0.86, s * 0.2, s * 0.06),
    Paint()..color = const Color(0xFF2E3B44),
  );
  c.drawRRect(
    RRect.fromRectAndRadius(
      Rect.fromLTWH(s * 0.4, s * 0.12, s * 0.2, s * 0.17),
      Radius.circular(s * 0.03),
    ),
    Paint()..color = const Color(0xFFFFE9A8),
  );
  c.drawPath(
    Path()
      ..moveTo(s * 0.36, s * 0.13)
      ..lineTo(s * 0.5, s * 0.05)
      ..lineTo(s * 0.64, s * 0.13)
      ..close(),
    Paint()..color = const Color(0xFF2E3B44),
  );
}

void _mailbox(Canvas c, double s) {
  _shadow(c, s, 0.45);
  c.drawRect(
    Rect.fromLTWH(s * 0.45, s * 0.7, s * 0.1, s * 0.22),
    Paint()..color = const Color(0xFF4A4A4A),
  );
  c.drawRRect(
    RRect.fromRectAndCorners(
      Rect.fromLTWH(s * 0.32, s * 0.3, s * 0.36, s * 0.42),
      topLeft: Radius.circular(s * 0.18),
      topRight: Radius.circular(s * 0.18),
    ),
    Paint()..color = Palette.danger,
  );
  c.drawRect(
    Rect.fromLTWH(s * 0.38, s * 0.46, s * 0.24, s * 0.04),
    Paint()..color = const Color(0xFF5A1E18),
  );
  _text(c, '〒', Offset(s * 0.5, s * 0.6), s * 0.11, Colors.white);
}

void _pond(Canvas c, double s) {
  final rect = Rect.fromLTWH(s * 0.06, s * 0.58, s * 0.88, s * 0.34);
  c.drawOval(rect, Paint()..color = const Color(0xFF8DB2A0));
  c.drawOval(rect.deflate(s * 0.035), Paint()..color = Palette.water);
  c.drawArc(
    Rect.fromCenter(center: Offset(s * 0.42, s * 0.72), width: s * 0.22, height: s * 0.07),
    math.pi,
    math.pi * 0.8,
    false,
    Paint()
      ..color = const Color(0x99FFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.02,
  );
  // あし
  for (final x in [0.16, 0.2, 0.82]) {
    c.drawLine(
      Offset(s * x, s * 0.68),
      Offset(s * (x + 0.01), s * 0.48),
      Paint()
        ..color = Palette.greenDark
        ..strokeWidth = s * 0.02,
    );
  }
  // かも
  c.drawOval(
    Rect.fromCenter(center: Offset(s * 0.62, s * 0.75), width: s * 0.14, height: s * 0.07),
    Paint()..color = Colors.white,
  );
  c.drawCircle(Offset(s * 0.68, s * 0.7), s * 0.035, Paint()..color = Palette.green);
}

void _fountain(Canvas c, double s) {
  _shadow(c, s, 0.86);
  final basin = Rect.fromLTWH(s * 0.1, s * 0.68, s * 0.8, s * 0.22);
  c.drawOval(basin, Paint()..color = const Color(0xFFC9C3B6));
  c.drawOval(basin.deflate(s * 0.035), Paint()..color = Palette.water);
  c.drawRect(
    Rect.fromLTWH(s * 0.45, s * 0.42, s * 0.1, s * 0.34),
    Paint()..color = const Color(0xFFC9C3B6),
  );
  c.drawOval(
    Rect.fromCenter(center: Offset(s * 0.5, s * 0.42), width: s * 0.36, height: s * 0.1),
    Paint()..color = const Color(0xFFC9C3B6),
  );
  final water = Paint()
    ..color = const Color(0xCC9FD3EA)
    ..style = PaintingStyle.stroke
    ..strokeWidth = s * 0.03
    ..strokeCap = StrokeCap.round;
  c.drawArc(
    Rect.fromLTWH(s * 0.22, s * 0.18, s * 0.28, s * 0.56),
    math.pi,
    math.pi * 0.55,
    false,
    water,
  );
  c.drawArc(
    Rect.fromLTWH(s * 0.5, s * 0.18, s * 0.28, s * 0.56),
    -math.pi * 0.55,
    math.pi * 0.55,
    false,
    water,
  );
  c.drawLine(Offset(s * 0.5, s * 0.38), Offset(s * 0.5, s * 0.16), water);
}

void _train(Canvas c, double s, Color body, Color accent) {
  final y = s * 0.78;
  _shadow(c, s, 0.9);
  final rect = Rect.fromLTWH(s * 0.06, y - s * 0.34, s * 0.88, s * 0.34);
  c.drawRRect(
    RRect.fromRectAndCorners(
      rect,
      topLeft: Radius.circular(s * 0.12),
      topRight: Radius.circular(s * 0.05),
      bottomLeft: Radius.circular(s * 0.02),
      bottomRight: Radius.circular(s * 0.02),
    ),
    Paint()..color = body,
  );
  c.drawRRect(
    RRect.fromRectAndCorners(
      rect,
      topLeft: Radius.circular(s * 0.12),
      topRight: Radius.circular(s * 0.05),
      bottomLeft: Radius.circular(s * 0.02),
      bottomRight: Radius.circular(s * 0.02),
    ),
    Paint()
      ..color = darken(body, 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.015,
  );
  c.drawRect(
    Rect.fromLTWH(rect.left, y - s * 0.12, rect.width, s * 0.045),
    Paint()..color = accent,
  );
  final win = Paint()..color = const Color(0xFFDDF0F8);
  for (var k = 0; k < 4; k++) {
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(s * (0.14 + k * 0.19), y - s * 0.28, s * 0.12, s * 0.11),
        Radius.circular(s * 0.015),
      ),
      win,
    );
  }
  final wheel = Paint()..color = const Color(0xFF333333);
  for (final x in [0.22, 0.38, 0.62, 0.78]) {
    c.drawCircle(Offset(s * x, y + s * 0.02), s * 0.055, wheel);
  }
  c.drawCircle(Offset(s * 0.1, y - s * 0.07), s * 0.025, Paint()..color = const Color(0xFFFFF2A8));
}

/// 駅舎(正面から見た形)。町の絵でも使う。
void paintStationBuilding(Canvas c, Rect r, {required Color roof, required Color wall}) {
  final w = r.width;
  final h = r.height;
  // ホーム
  c.drawRect(
    Rect.fromLTWH(r.left - w * 0.04, r.bottom - h * 0.1, w * 1.08, h * 0.1),
    Paint()..color = const Color(0xFFD8C9A8),
  );
  final body = Rect.fromLTWH(r.left + w * 0.08, r.top + h * 0.38, w * 0.84, h * 0.52);
  c.drawRect(body, Paint()..color = wall);
  c.drawRect(
    body,
    Paint()
      ..color = const Color(0x22000000)
      ..style = PaintingStyle.stroke
      ..strokeWidth = w * 0.01,
  );
  c.drawRect(
    Rect.fromLTWH(body.left, body.bottom - h * 0.06, body.width, h * 0.06),
    Paint()..color = darken(wall, 0.35),
  );
  // 窓と扉
  _window(c, Rect.fromLTWH(body.left + w * 0.06, body.top + h * 0.12, w * 0.14, h * 0.16));
  _window(c, Rect.fromLTWH(body.right - w * 0.2, body.top + h * 0.12, w * 0.14, h * 0.16));
  c.drawRect(
    Rect.fromLTWH(r.center.dx - w * 0.08, body.top + h * 0.18, w * 0.16, h * 0.28),
    Paint()..color = const Color(0xFF8B5E3C),
  );
  // 屋根
  c.drawPath(
    Path()
      ..moveTo(r.left, r.top + h * 0.4)
      ..lineTo(r.center.dx, r.top + h * 0.05)
      ..lineTo(r.right, r.top + h * 0.4)
      ..close(),
    Paint()..color = roof,
  );
  // 時計
  final clock = Offset(r.center.dx, r.top + h * 0.27);
  c.drawCircle(clock, h * 0.08, Paint()..color = Colors.white);
  c.drawCircle(
    clock,
    h * 0.08,
    Paint()
      ..color = const Color(0xFF6B4B33)
      ..style = PaintingStyle.stroke
      ..strokeWidth = h * 0.015,
  );
  final hand = Paint()
    ..color = const Color(0xFF333333)
    ..strokeWidth = h * 0.012;
  c.drawLine(clock, clock + Offset(0, -h * 0.055), hand);
  c.drawLine(clock, clock + Offset(h * 0.04, 0), hand);
}

/// 人(足もとが [foot]、背の高さ [h])
void paintPerson(Canvas c, Offset foot, double h, {required Color hat, required Color clothes}) {
  final x = foot.dx;
  final y = foot.dy;
  c.drawOval(
    Rect.fromCenter(center: Offset(x, y), width: h * 0.4, height: h * 0.07),
    Paint()..color = const Color(0x33000000),
  );
  // 体
  c.drawRRect(
    RRect.fromRectAndCorners(
      Rect.fromLTWH(x - h * 0.17, y - h * 0.48, h * 0.34, h * 0.44),
      topLeft: Radius.circular(h * 0.12),
      topRight: Radius.circular(h * 0.12),
    ),
    Paint()..color = clothes,
  );
  c.drawRect(
    Rect.fromLTWH(x - h * 0.12, y - h * 0.06, h * 0.08, h * 0.06),
    Paint()..color = const Color(0xFF3A3A3A),
  );
  c.drawRect(
    Rect.fromLTWH(x + h * 0.04, y - h * 0.06, h * 0.08, h * 0.06),
    Paint()..color = const Color(0xFF3A3A3A),
  );
  // 顔
  final head = Offset(x, y - h * 0.66);
  c.drawCircle(head, h * 0.2, Paint()..color = const Color(0xFFF6D3B3));
  c.drawCircle(head + Offset(-h * 0.07, h * 0.01), h * 0.022, Paint()..color = Palette.ink);
  c.drawCircle(head + Offset(h * 0.07, h * 0.01), h * 0.022, Paint()..color = Palette.ink);
  c.drawCircle(
    head + Offset(-h * 0.11, h * 0.07),
    h * 0.03,
    Paint()..color = const Color(0x55F08A8A),
  );
  c.drawCircle(
    head + Offset(h * 0.11, h * 0.07),
    h * 0.03,
    Paint()..color = const Color(0x55F08A8A),
  );
  // 帽子(髪)
  c.drawArc(
    Rect.fromCircle(center: head, radius: h * 0.21),
    math.pi,
    math.pi,
    true,
    Paint()..color = hat,
  );
  c.drawRect(
    Rect.fromLTWH(head.dx - h * 0.25, head.dy - h * 0.03, h * 0.5, h * 0.04),
    Paint()..color = hat,
  );
}

/// ねこ
void paintCat(Canvas c, Offset foot, double h, Color color) {
  final x = foot.dx;
  final y = foot.dy;
  c.drawOval(
    Rect.fromCenter(center: Offset(x, y), width: h * 0.6, height: h * 0.08),
    Paint()..color = const Color(0x33000000),
  );
  final p = Paint()..color = color;
  c.drawOval(Rect.fromLTWH(x - h * 0.28, y - h * 0.36, h * 0.5, h * 0.34), p);
  final head = Offset(x + h * 0.18, y - h * 0.46);
  c.drawCircle(head, h * 0.17, p);
  c.drawPath(
    Path()
      ..moveTo(head.dx - h * 0.15, head.dy - h * 0.05)
      ..lineTo(head.dx - h * 0.1, head.dy - h * 0.25)
      ..lineTo(head.dx - h * 0.01, head.dy - h * 0.13)
      ..moveTo(head.dx + h * 0.15, head.dy - h * 0.05)
      ..lineTo(head.dx + h * 0.1, head.dy - h * 0.25)
      ..lineTo(head.dx + h * 0.01, head.dy - h * 0.13),
    p,
  );
  c.drawCircle(head + Offset(-h * 0.06, 0), h * 0.022, Paint()..color = Palette.ink);
  c.drawCircle(head + Offset(h * 0.06, 0), h * 0.022, Paint()..color = Palette.ink);
  c.drawPath(
    Path()
      ..moveTo(x - h * 0.26, y - h * 0.2)
      ..quadraticBezierTo(x - h * 0.48, y - h * 0.3, x - h * 0.4, y - h * 0.55),
    Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = h * 0.06
      ..strokeCap = StrokeCap.round,
  );
}

void _text(Canvas c, String text, Offset center, double size, Color color) {
  final tp = TextPainter(
    text: TextSpan(
      text: text,
      style: TextStyle(fontSize: size, color: color, fontWeight: FontWeight.w800, height: 1),
    ),
    textDirection: TextDirection.ltr,
  )..layout();
  tp.paint(c, center - Offset(tp.width / 2, tp.height / 2));
}
