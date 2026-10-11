import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../game/catalog.dart';
import '../theme.dart';
import 'item_painter.dart';

/// 町の設計図の大きさ(区画の座標はこの中の値)
const townDesignSize = Size(360, 480);

/// 町の背景:丘・線路・駅舎・止まっている列車・広場・道・海。
/// 建物や住民は別のウィジェットとして上に重ねる(置いたときに動かせるように)。
class TownPainter extends CustomPainter {
  TownPainter({
    required this.station,
    required this.train,
    required this.slots,
    required this.occupied,
    this.showMarkers = true,
    this.wave = 0,
  });

  final CollectibleItem station;
  final CollectibleItem train;
  final List<TownSlot> slots;

  /// 何か置いてある区画の ID
  final Set<String> occupied;

  /// 空いている区画に「+」の目印を出す
  final bool showMarkers;
  final double wave;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / townDesignSize.width;
    canvas.save();
    canvas.scale(k);
    _paint(canvas);
    canvas.restore();
  }

  void _paint(Canvas c) {
    const w = 360.0;
    const h = 480.0;
    // 地面
    c.drawRect(
      const Rect.fromLTWH(0, 0, w, h),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF9CC96E), Color(0xFF86B85A)],
        ).createShader(const Rect.fromLTWH(0, 0, w, h)),
    );
    // 遠くの丘
    final hills = Path()
      ..moveTo(0, 40)
      ..quadraticBezierTo(70, 0, 150, 30)
      ..quadraticBezierTo(230, 58, 300, 18)
      ..quadraticBezierTo(340, 0, 360, 22)
      ..lineTo(360, 0)
      ..lineTo(0, 0)
      ..close();
    c.drawPath(hills, Paint()..color = const Color(0xFF6FA75A));
    // 草のもよう
    final r = math.Random(21);
    final tuft = Paint()
      ..color = const Color(0xFF79AA4E)
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 70; i++) {
      final x = r.nextDouble() * w;
      final y = 40 + r.nextDouble() * 390;
      c.drawLine(Offset(x, y), Offset(x - 2, y - 4), tuft);
      c.drawLine(Offset(x, y), Offset(x + 2, y - 4), tuft);
    }

    // 広場
    final plaza = RRect.fromRectAndRadius(
      const Rect.fromLTWH(55, 128, 250, 92),
      const Radius.circular(18),
    );
    c.drawRRect(plaza, Paint()..color = const Color(0xFFE6D9BD));
    _pavement(c, plaza.outerRect);
    // 道
    const road = Rect.fromLTWH(160, 210, 40, 236);
    c.drawRect(road, Paint()..color = const Color(0xFFD9CBAE));
    final dash = Paint()
      ..color = const Color(0xFFF5EEDC)
      ..strokeWidth = 2;
    for (var y = 222.0; y < 440; y += 18) {
      c.drawLine(Offset(180, y), Offset(180, y + 8), dash);
    }

    // 線路(駅の前を横切る)
    const railY = 118.0;
    c.drawRect(const Rect.fromLTWH(0, railY - 7, w, 14), Paint()..color = Palette.ballast);
    final sleeper = Paint()..color = Palette.sleeper;
    for (var x = 0.0; x < w; x += 10) {
      c.drawRect(Rect.fromLTWH(x, railY - 6, 5, 12), sleeper);
    }
    final rail = Paint()
      ..color = Palette.rail
      ..strokeWidth = 2;
    c.drawLine(const Offset(0, railY - 4), const Offset(w, railY - 4), rail);
    c.drawLine(const Offset(0, railY + 4), const Offset(w, railY + 4), rail);
    // 車止め
    c.drawRect(const Rect.fromLTWH(340, railY - 8, 6, 16), Paint()..color = Palette.danger);

    // 駅舎と列車
    paintStationBuilding(
      c,
      const Rect.fromLTWH(118, 24, 124, 88),
      roof: colorOf(station.colors['roof'], Palette.roof),
      wall: colorOf(station.colors['wall'], const Color(0xFFF5E6C8)),
    );
    // 列車の車輪(絵の高さの 0.8 あたり)が線路に乗るように置く
    c.save();
    c.translate(10, railY - 72);
    paintItemArt(c, 90, train);
    c.restore();

    // 海と桟橋
    final sea = Path()
      ..moveTo(0, 446)
      ..quadraticBezierTo(90, 438 + math.sin(wave * 2 * math.pi) * 2, 180, 446)
      ..quadraticBezierTo(270, 454, 360, 444)
      ..lineTo(360, 480)
      ..lineTo(0, 480)
      ..close();
    c.drawRect(const Rect.fromLTWH(0, 436, w, 14), Paint()..color = const Color(0xFFEBDDB4));
    c.drawPath(sea, Paint()..color = Palette.sea);
    final spark = Paint()
      ..color = const Color(0x88FFFFFF)
      ..strokeWidth = 1.5;
    for (var i = 0; i < 8; i++) {
      final x = (i * 47 + wave * 30) % w;
      c.drawLine(Offset(x, 462 + (i % 3) * 6), Offset(x + 12, 462 + (i % 3) * 6), spark);
    }
    c.drawRect(const Rect.fromLTWH(168, 440, 24, 34), Paint()..color = const Color(0xFF9C6B45));
    for (var y = 444.0; y < 474; y += 6) {
      c.drawLine(
        Offset(168, y),
        Offset(192, y),
        Paint()
          ..color = const Color(0xFF7A5034)
          ..strokeWidth = 1,
      );
    }

    // 区画の地面と目印
    for (final s in slots) {
      final large = s.size == 'large';
      final pad = Rect.fromCenter(
        center: Offset(s.x, s.y - (large ? 6 : 4)),
        width: large ? 92 : 40,
        height: large ? 22 : 16,
      );
      c.drawOval(pad, Paint()..color = const Color(0x2A3D5A1E));
      if (showMarkers && !occupied.contains(s.id)) {
        final box = RRect.fromRectAndRadius(
          Rect.fromCenter(
            center: Offset(s.x, s.y - (large ? 32 : 18)),
            width: large ? 84 : 38,
            height: large ? 58 : 32,
          ),
          const Radius.circular(10),
        );
        c.drawRRect(box, Paint()..color = const Color(0x33FFFFFF));
        _dashedRRect(c, box);
        final plus = Paint()
          ..color = Colors.white
          ..strokeWidth = 3
          ..strokeCap = StrokeCap.round;
        final ctr = box.center;
        const a = 7.0;
        c.drawLine(ctr - const Offset(a, 0), ctr + const Offset(a, 0), plus);
        c.drawLine(ctr - const Offset(0, a), ctr + const Offset(0, a), plus);
      }
    }
  }

  void _pavement(Canvas c, Rect r) {
    final line = Paint()
      ..color = const Color(0x22000000)
      ..strokeWidth = 1;
    for (var y = r.top + 12; y < r.bottom; y += 14) {
      c.drawLine(Offset(r.left + 10, y), Offset(r.right - 10, y), line);
    }
  }

  void _dashedRRect(Canvas c, RRect r) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final path = Path()..addRRect(r);
    for (final m in path.computeMetrics()) {
      for (var d = 0.0; d < m.length; d += 10) {
        c.drawPath(m.extractPath(d, math.min(d + 5, m.length)), paint);
      }
    }
  }

  @override
  bool shouldRepaint(TownPainter old) =>
      old.station.id != station.id ||
      old.train.id != train.id ||
      old.showMarkers != showMarkers ||
      old.wave != wave ||
      old.occupied.length != occupied.length ||
      !old.occupied.containsAll(occupied);
}

/// 住民が立つ場所(設計図の座標)。持っている住民を順に置く。
const residentSpots = [
  Offset(225, 112), // 駅長さんはホーム
  Offset(95, 168),
  Offset(270, 166),
  Offset(206, 200),
  Offset(188, 262),
  Offset(172, 330),
  Offset(188, 398),
  Offset(120, 440),
];
