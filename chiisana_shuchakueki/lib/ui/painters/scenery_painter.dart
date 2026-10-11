import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// タイトル画面の景色:海の見える小さな終着駅。
class SceneryPainter extends CustomPainter {
  const SceneryPainter({this.trainX = 0.52, this.wave = 0, this.lift = 0});

  /// 景色全体を上へずらす割合(背の低い画面でボタンと重ならないように)
  final double lift;

  /// 列車の位置(画面幅に対する割合)
  final double trainX;

  /// 波のゆらぎ(0〜1)
  final double wave;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final horizon = h * (0.37 - lift);
    final groundTop = h * (0.45 - lift);

    // 空
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, horizon + 2),
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Palette.skyHigh, Palette.sky, Color(0xFFE9F3E6)],
          stops: [0, 0.7, 1],
        ).createShader(Rect.fromLTWH(0, 0, w, horizon)),
    );
    // 雲
    for (final (x, y, r) in [(0.14, 0.31, 1.0), (0.84, 0.2, 1.1), (0.55, 0.33, 0.6)]) {
      _cloud(canvas, Offset(w * x, h * y), w * 0.06 * r);
    }
    // 海
    canvas.drawRect(
      Rect.fromLTWH(0, horizon, w, groundTop - horizon + 4),
      Paint()..color = Palette.sea,
    );
    final sparkle = Paint()
      ..color = Colors.white.withValues(alpha: 0.5)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    final rnd = math.Random(3);
    for (var i = 0; i < 14; i++) {
      final x = rnd.nextDouble() * w + math.sin((wave + i / 14) * math.pi * 2) * 4;
      final y = horizon + 6 + rnd.nextDouble() * (groundTop - horizon - 12);
      canvas.drawLine(Offset(x, y), Offset(x + 10 + rnd.nextDouble() * 10, y), sparkle);
    }
    // 遠くの島と灯台
    final island = Path()
      ..moveTo(w * 0.70, horizon + 2)
      ..quadraticBezierTo(w * 0.82, horizon - h * 0.05, w * 0.98, horizon + 2)
      ..close();
    canvas.drawPath(island, Paint()..color = Palette.hillFar);
    _lighthouse(canvas, Offset(w * 0.85, horizon - h * 0.03), h * 0.075);
    // 小舟
    _boat(canvas, Offset(w * 0.4, horizon + (groundTop - horizon) * 0.45), h * 0.03);

    // 地面(丘)
    final ground = Path()
      ..moveTo(0, groundTop + h * 0.01)
      ..quadraticBezierTo(w * 0.25, groundTop - h * 0.03, w * 0.55, groundTop + h * 0.005)
      ..quadraticBezierTo(w * 0.8, groundTop + h * 0.025, w, groundTop - h * 0.01)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();
    canvas.drawPath(
      ground,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Palette.hill, Color(0xFF4F8A45)],
        ).createShader(Rect.fromLTWH(0, groundTop, w, h - groundTop)),
    );

    // 線路
    final railY = groundTop + h * 0.075;
    canvas.drawRect(
      Rect.fromLTWH(0, railY - h * 0.006, w, h * 0.022),
      Paint()..color = Palette.ballast,
    );
    final sleeper = Paint()..color = Palette.sleeper;
    for (var x = 0.0; x < w; x += 14) {
      canvas.drawRect(Rect.fromLTWH(x, railY - h * 0.002, 8, h * 0.014), sleeper);
    }
    canvas.drawLine(
      Offset(0, railY),
      Offset(w, railY),
      Paint()
        ..color = Palette.rail
        ..strokeWidth = 3,
    );

    // 駅舎
    _station(canvas, Offset(w * 0.04, railY - h * 0.012), w * 0.34, h * 0.105);
    // 列車
    _train(canvas, Offset(w * trainX, railY - 3), w * 0.44, h * 0.052);
    // 花
    final fr = math.Random(11);
    const flowerColors = [Color(0xFFF7B3C0), Color(0xFFFFF4C2), Colors.white, Color(0xFFF08A5D)];
    for (var i = 0; i < 40; i++) {
      final x = fr.nextDouble() * w;
      final y = railY + h * 0.04 + fr.nextDouble() * (h - railY - h * 0.04);
      if (x > w * 0.12 && x < w * 0.88 && y < h * 0.93) continue; // ボタンの後ろは控えめに
      canvas.drawCircle(
        Offset(x, y),
        3 + fr.nextDouble() * 2,
        Paint()..color = flowerColors[fr.nextInt(flowerColors.length)],
      );
    }
  }

  void _cloud(Canvas c, Offset o, double r) {
    final p = Paint()..color = Colors.white.withValues(alpha: 0.92);
    c.drawCircle(o, r, p);
    c.drawCircle(o + Offset(r * 0.9, r * 0.2), r * 0.75, p);
    c.drawCircle(o + Offset(-r * 0.9, r * 0.25), r * 0.7, p);
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(o.dx - r * 1.5, o.dy, r * 3.1, r * 0.8),
        Radius.circular(r * 0.4),
      ),
      p,
    );
  }

  void _lighthouse(Canvas c, Offset base, double hgt) {
    final w = hgt * 0.32;
    final body = Path()
      ..moveTo(base.dx - w / 2, base.dy)
      ..lineTo(base.dx - w * 0.35, base.dy - hgt)
      ..lineTo(base.dx + w * 0.35, base.dy - hgt)
      ..lineTo(base.dx + w / 2, base.dy)
      ..close();
    c.drawPath(body, Paint()..color = Colors.white);
    c.drawRect(
      Rect.fromLTWH(base.dx - w * 0.45, base.dy - hgt * 0.45, w * 0.9, hgt * 0.14),
      Paint()..color = Palette.danger,
    );
    c.drawRect(
      Rect.fromLTWH(base.dx - w * 0.3, base.dy - hgt * 1.15, w * 0.6, hgt * 0.17),
      Paint()..color = const Color(0xFFFFE9A8),
    );
    c.drawPath(
      Path()
        ..moveTo(base.dx - w * 0.42, base.dy - hgt * 1.15)
        ..lineTo(base.dx, base.dy - hgt * 1.35)
        ..lineTo(base.dx + w * 0.42, base.dy - hgt * 1.15)
        ..close(),
      Paint()..color = Palette.danger,
    );
  }

  void _boat(Canvas c, Offset o, double s) {
    c.drawPath(
      Path()
        ..moveTo(o.dx - s, o.dy)
        ..lineTo(o.dx + s, o.dy)
        ..lineTo(o.dx + s * 0.7, o.dy + s * 0.4)
        ..lineTo(o.dx - s * 0.7, o.dy + s * 0.4)
        ..close(),
      Paint()..color = const Color(0xFF7A4E33),
    );
    c.drawPath(
      Path()
        ..moveTo(o.dx, o.dy - s * 1.6)
        ..lineTo(o.dx + s * 0.9, o.dy - s * 0.1)
        ..lineTo(o.dx, o.dy - s * 0.1)
        ..close(),
      Paint()..color = Colors.white,
    );
  }

  void _station(Canvas c, Offset bottomLeft, double w, double h) {
    final x = bottomLeft.dx;
    final y = bottomLeft.dy;
    // ホーム
    c.drawRect(
      Rect.fromLTWH(x - 6, y - h * 0.12, w + 12, h * 0.14),
      Paint()..color = const Color(0xFFD8C9A8),
    );
    // 建物
    final wall = Rect.fromLTWH(x + w * 0.1, y - h * 0.82, w * 0.8, h * 0.7);
    c.drawRect(wall, Paint()..color = const Color(0xFFF5E6C8));
    c.drawRect(
      Rect.fromLTWH(wall.left, wall.bottom - h * 0.08, wall.width, h * 0.08),
      Paint()..color = const Color(0xFF8B5E3C),
    );
    // 窓と扉
    final win = Paint()..color = const Color(0xFF7FB5D1);
    c.drawRect(Rect.fromLTWH(wall.left + w * 0.08, wall.top + h * 0.22, w * 0.14, h * 0.2), win);
    c.drawRect(Rect.fromLTWH(wall.right - w * 0.22, wall.top + h * 0.22, w * 0.14, h * 0.2), win);
    c.drawRect(
      Rect.fromLTWH(wall.center.dx - w * 0.08, wall.top + h * 0.3, w * 0.16, h * 0.32),
      Paint()..color = const Color(0xFF8B5E3C),
    );
    // 屋根
    c.drawPath(
      Path()
        ..moveTo(wall.left - w * 0.08, wall.top)
        ..lineTo(wall.center.dx, wall.top - h * 0.38)
        ..lineTo(wall.right + w * 0.08, wall.top)
        ..close(),
      Paint()..color = Palette.roof,
    );
    // 時計
    final clock = Offset(wall.center.dx, wall.top - h * 0.14);
    c.drawCircle(clock, h * 0.1, Paint()..color = Colors.white);
    c.drawCircle(
      clock,
      h * 0.1,
      Paint()
        ..color = const Color(0xFF6B4B33)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );
    final hand = Paint()
      ..color = const Color(0xFF333333)
      ..strokeWidth = 1.5;
    c.drawLine(clock, clock + Offset(0, -h * 0.07), hand);
    c.drawLine(clock, clock + Offset(h * 0.05, 0), hand);
  }

  void _train(Canvas c, Offset bottomLeft, double w, double h) {
    final carW = w * 0.48;
    for (var i = 0; i < 2; i++) {
      final x = bottomLeft.dx + i * (carW + w * 0.03);
      final body = RRect.fromRectAndCorners(
        Rect.fromLTWH(x, bottomLeft.dy - h, carW, h * 0.86),
        topLeft: Radius.circular(i == 0 ? h * 0.35 : h * 0.15),
        topRight: Radius.circular(h * 0.15),
        bottomLeft: const Radius.circular(3),
        bottomRight: const Radius.circular(3),
      );
      c.drawRRect(body, Paint()..color = Palette.train);
      c.drawRect(
        Rect.fromLTWH(x, bottomLeft.dy - h * 0.38, carW, h * 0.1),
        Paint()..color = const Color(0xFFF3E6CF),
      );
      final win = Paint()..color = const Color(0xFFDDF0F8);
      for (var k = 0; k < 4; k++) {
        c.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(
              x + carW * (0.08 + k * 0.23),
              bottomLeft.dy - h * 0.8,
              carW * 0.16,
              h * 0.32,
            ),
            const Radius.circular(2),
          ),
          win,
        );
      }
      final wheel = Paint()..color = const Color(0xFF333333);
      c.drawCircle(Offset(x + carW * 0.2, bottomLeft.dy - h * 0.08), h * 0.13, wheel);
      c.drawCircle(Offset(x + carW * 0.8, bottomLeft.dy - h * 0.08), h * 0.13, wheel);
    }
  }

  @override
  bool shouldRepaint(SceneryPainter old) =>
      old.trainX != trainX || old.wave != wave || old.lift != lift;
}
