import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../puzzle/tile.dart';
import '../theme.dart';

/// 線路パーツを「回転 0 の向き」で描く。回転は外側の AnimatedRotation が行う。
class TrackPainter extends CustomPainter {
  const TrackPainter(this.kind, {this.fixed = false, this.highlight = false});

  final TileKind kind;
  final bool fixed;
  final bool highlight;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    paintTrackPiece(canvas, s, kind, fixed: fixed);
  }

  @override
  bool shouldRepaint(TrackPainter old) =>
      old.kind != kind || old.fixed != fixed || old.highlight != highlight;
}

/// 線路 1 マス分を描く(回転 0 の向き)。
void paintTrackPiece(Canvas canvas, double s, TileKind kind, {bool fixed = false}) {
  final parts = <_Piece>[];
  switch (kind) {
    case TileKind.straight:
      parts.add(const _Piece.straight(vertical: true));
    case TileKind.curve:
      parts.add(const _Piece.curve(cornerX: 1, cornerY: 0)); // 北-東
    case TileKind.tee:
      // 東-西の直線と、南から東へ曲がる枝(突き当たりでは右へ曲がるルール)
      parts.add(const _Piece.straight(vertical: false));
      parts.add(const _Piece.curve(cornerX: 1, cornerY: 1));
    case TileKind.cross:
      parts.add(const _Piece.straight(vertical: true));
      parts.add(const _Piece.straight(vertical: false));
    default:
      return;
  }
  for (final p in parts) {
    p.paintBallast(canvas, s);
  }
  for (final p in parts) {
    p.paintSleepers(canvas, s);
  }
  for (final p in parts) {
    p.paintRails(canvas, s);
  }
}

class _Piece {
  const _Piece.straight({required this.vertical}) : curve = false, cornerX = 0, cornerY = 0;
  const _Piece.curve({required this.cornerX, required this.cornerY})
    : curve = true,
      vertical = false;

  final bool curve;
  final bool vertical;
  final int cornerX;
  final int cornerY;

  static const ballastHalf = 0.21;
  static const gauge = 0.12;

  void paintBallast(Canvas c, double s) {
    final paint = Paint()
      ..color = Palette.ballast
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * ballastHalf * 2;
    _stroke(c, s, 0, paint);
  }

  void paintSleepers(Canvas c, double s) {
    final paint = Paint()
      ..color = Palette.sleeper
      ..strokeWidth = s * 0.075
      ..strokeCap = StrokeCap.butt;
    const n = 5;
    for (var i = 0; i < n; i++) {
      final t = (i + 0.5) / n;
      final (p, dir) = _pointAt(t);
      final nrm = Offset(-math.sin(dir), math.cos(dir));
      final a = (p + nrm * 0.19) * s;
      final b = (p - nrm * 0.19) * s;
      c.drawLine(a, b, paint);
    }
  }

  void paintRails(Canvas c, double s) {
    final rail = Paint()
      ..color = Palette.rail
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.05;
    final shine = Paint()
      ..color = Palette.railShine
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.018;
    for (final off in [-gauge, gauge]) {
      _stroke(c, s, off, rail);
      _stroke(c, s, off, shine);
    }
  }

  /// 中心線から [offset] だけずらした線を描く。
  void _stroke(Canvas c, double s, double offset, Paint paint) {
    if (!curve) {
      if (vertical) {
        c.drawLine(Offset((0.5 + offset) * s, 0), Offset((0.5 + offset) * s, s), paint);
      } else {
        c.drawLine(Offset(0, (0.5 + offset) * s), Offset(s, (0.5 + offset) * s), paint);
      }
      return;
    }
    final r = (0.5 + offset) * s;
    final center = Offset(cornerX * s, cornerY * s);
    c.drawArc(Rect.fromCircle(center: center, radius: r), _startAngle, math.pi / 2, false, paint);
  }

  // 四隅のどこを中心にした弧か → 描きはじめの角度
  double get _startAngle => switch ((cornerX, cornerY)) {
    (1, 0) => math.pi / 2, // 右上の角:下向き〜左向き
    (1, 1) => math.pi, // 右下の角
    (0, 1) => -math.pi / 2, // 左下の角
    _ => 0, // 左上の角
  };

  /// 中心線上の位置 t(0〜1)と、その向き。
  (Offset, double) _pointAt(double t) {
    if (!curve) {
      return vertical ? (Offset(0.5, t), math.pi / 2) : (Offset(t, 0.5), 0.0);
    }
    final a = _startAngle + t * math.pi / 2;
    final p = Offset(cornerX + math.cos(a) * 0.5, cornerY + math.sin(a) * 0.5);
    return (p, a + math.pi / 2);
  }
}

/// 回せる線路の下に敷く「板」。固定タイルはボルトつきの平らな板。
class TilePlatePainter extends CustomPainter {
  const TilePlatePainter({required this.fixed, this.pressed = false});

  final bool fixed;
  final bool pressed;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final rect = Rect.fromLTWH(s * 0.04, s * 0.04, s * 0.92, s * 0.92);
    final r = RRect.fromRectAndRadius(rect, Radius.circular(s * 0.14));
    if (fixed) {
      canvas.drawRRect(r, Paint()..color = Palette.plateFixed.withValues(alpha: 0.55));
      final bolt = Paint()..color = const Color(0xFF6F6553);
      for (final o in [
        Offset(s * 0.15, s * 0.15),
        Offset(s * 0.85, s * 0.15),
        Offset(s * 0.15, s * 0.85),
        Offset(s * 0.85, s * 0.85),
      ]) {
        canvas.drawCircle(o, s * 0.045, bolt);
        canvas.drawCircle(
          o - Offset(s * 0.012, s * 0.012),
          s * 0.018,
          Paint()..color = const Color(0xFFD9D0BC),
        );
      }
    } else {
      canvas.drawRRect(r.shift(Offset(0, s * 0.035)), Paint()..color = const Color(0x33405A2A));
      canvas.drawRRect(
        r,
        Paint()..color = pressed ? const Color(0xFFDDE9B8) : const Color(0xFFC4DD92),
      );
      canvas.drawRRect(
        r,
        Paint()
          ..color = const Color(0x66FFFFFF)
          ..style = PaintingStyle.stroke
          ..strokeWidth = s * 0.02,
      );
    }
  }

  @override
  bool shouldRepaint(TilePlatePainter old) => old.fixed != fixed || old.pressed != pressed;
}

/// 駅・障害物・草地など、回らないマスを描く。
class StaticTilePainter extends CustomPainter {
  const StaticTilePainter(this.tile, {this.seed = 0});

  final Tile tile;

  /// 草花の配置をマスごとに変えるための数
  final int seed;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    switch (tile.kind) {
      case TileKind.empty:
        _grassDetail(canvas, s);
      case TileKind.tree:
        _tree(canvas, s);
      case TileKind.rock:
        _rock(canvas, s);
      case TileKind.pond:
        _pond(canvas, s);
      case TileKind.start:
      case TileKind.goal:
        _station(canvas, s, goal: tile.kind == TileKind.goal);
      default:
        break;
    }
  }

  void _grassDetail(Canvas c, double s) {
    final rnd = math.Random(seed);
    final tuft = Paint()
      ..color = const Color(0xFF7FAE52)
      ..strokeWidth = s * 0.025
      ..strokeCap = StrokeCap.round;
    for (var i = 0; i < 2; i++) {
      final x = s * (0.2 + rnd.nextDouble() * 0.6);
      final y = s * (0.25 + rnd.nextDouble() * 0.55);
      c.drawLine(Offset(x, y), Offset(x - s * 0.04, y - s * 0.08), tuft);
      c.drawLine(Offset(x, y), Offset(x + s * 0.01, y - s * 0.1), tuft);
      c.drawLine(Offset(x, y), Offset(x + s * 0.05, y - s * 0.07), tuft);
    }
    if (rnd.nextDouble() < 0.5) {
      final x = s * (0.2 + rnd.nextDouble() * 0.6);
      final y = s * (0.2 + rnd.nextDouble() * 0.6);
      final colors = [const Color(0xFFFFF4C2), const Color(0xFFF7B3C0), const Color(0xFFFFFFFF)];
      final petal = Paint()..color = colors[rnd.nextInt(colors.length)];
      for (var k = 0; k < 4; k++) {
        final a = k * math.pi / 2;
        c.drawCircle(
          Offset(x + math.cos(a) * s * 0.03, y + math.sin(a) * s * 0.03),
          s * 0.025,
          petal,
        );
      }
      c.drawCircle(Offset(x, y), s * 0.02, Paint()..color = Palette.star);
    }
  }

  void _tree(Canvas c, double s) {
    c.drawOval(
      Rect.fromCenter(center: Offset(s * 0.55, s * 0.78), width: s * 0.62, height: s * 0.22),
      Paint()..color = const Color(0x334A6B2A),
    );
    c.drawRect(
      Rect.fromLTWH(s * 0.46, s * 0.55, s * 0.08, s * 0.2),
      Paint()..color = const Color(0xFF7A5034),
    );
    final dark = Paint()..color = Palette.treeDark;
    final light = Paint()..color = Palette.tree;
    c.drawCircle(Offset(s * 0.38, s * 0.5), s * 0.19, dark);
    c.drawCircle(Offset(s * 0.62, s * 0.5), s * 0.19, dark);
    c.drawCircle(Offset(s * 0.5, s * 0.36), s * 0.23, light);
    c.drawCircle(Offset(s * 0.43, s * 0.3), s * 0.08, Paint()..color = const Color(0x55FFFFFF));
  }

  void _rock(Canvas c, double s) {
    c.drawOval(
      Rect.fromCenter(center: Offset(s * 0.52, s * 0.72), width: s * 0.66, height: s * 0.22),
      Paint()..color = const Color(0x33404040),
    );
    final path = Path()
      ..moveTo(s * 0.2, s * 0.68)
      ..quadraticBezierTo(s * 0.18, s * 0.38, s * 0.42, s * 0.28)
      ..quadraticBezierTo(s * 0.7, s * 0.22, s * 0.8, s * 0.48)
      ..quadraticBezierTo(s * 0.86, s * 0.7, s * 0.6, s * 0.72)
      ..close();
    c.drawPath(path, Paint()..color = Palette.rock);
    c.drawCircle(Offset(s * 0.42, s * 0.4), s * 0.07, Paint()..color = const Color(0x66FFFFFF));
    c.drawLine(
      Offset(s * 0.55, s * 0.4),
      Offset(s * 0.62, s * 0.6),
      Paint()
        ..color = const Color(0x55333333)
        ..strokeWidth = s * 0.02,
    );
  }

  void _pond(Canvas c, double s) {
    final rect = Rect.fromLTWH(s * 0.1, s * 0.16, s * 0.8, s * 0.68);
    c.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(s * 0.3)),
      Paint()..color = const Color(0xFF8DB2A0),
    );
    c.drawRRect(
      RRect.fromRectAndRadius(rect.deflate(s * 0.04), Radius.circular(s * 0.26)),
      Paint()..color = Palette.water,
    );
    final ripple = Paint()
      ..color = const Color(0x99FFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.025
      ..strokeCap = StrokeCap.round;
    c.drawArc(
      Rect.fromCenter(center: Offset(s * 0.4, s * 0.42), width: s * 0.24, height: s * 0.1),
      math.pi,
      math.pi * 0.8,
      false,
      ripple,
    );
    c.drawArc(
      Rect.fromCenter(center: Offset(s * 0.62, s * 0.62), width: s * 0.2, height: s * 0.08),
      math.pi,
      math.pi * 0.8,
      false,
      ripple,
    );
  }

  void _station(Canvas c, double s, {required bool goal}) {
    // ホーム(石だたみ)
    final rect = Rect.fromLTWH(s * 0.03, s * 0.03, s * 0.94, s * 0.94);
    c.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(s * 0.12)),
      Paint()..color = const Color(0xFFE6D9BD),
    );
    c.drawRRect(
      RRect.fromRectAndRadius(rect, Radius.circular(s * 0.12)),
      Paint()
        ..color = goal ? Palette.roofGoal : Palette.roof
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.035,
    );

    // 以下は「回転 0 = 北につながる」向きで描き、マスの中心で回す
    c.save();
    c.translate(s / 2, s / 2);
    c.rotate(tile.rotation * math.pi / 2);
    c.translate(-s / 2, -s / 2);
    // 線路(北の端から南の車止めまで)
    final ballast = Paint()..color = Palette.ballast;
    c.drawRect(Rect.fromLTWH(s * 0.29, 0, s * 0.42, s * 0.88), ballast);
    final sleeper = Paint()
      ..color = Palette.sleeper
      ..strokeWidth = s * 0.07;
    for (var i = 0; i < 4; i++) {
      final y = s * (0.1 + i * 0.22);
      c.drawLine(Offset(s * 0.31, y), Offset(s * 0.69, y), sleeper);
    }
    final rail = Paint()
      ..color = Palette.rail
      ..strokeWidth = s * 0.05;
    c.drawLine(Offset(s * 0.38, 0), Offset(s * 0.38, s * 0.86), rail);
    c.drawLine(Offset(s * 0.62, 0), Offset(s * 0.62, s * 0.86), rail);
    // 車止め
    final stop = Rect.fromLTWH(s * 0.3, s * 0.84, s * 0.4, s * 0.08);
    c.drawRect(stop, Paint()..color = Palette.danger);
    c.drawRect(
      Rect.fromLTWH(s * 0.42, s * 0.84, s * 0.08, s * 0.08),
      Paint()..color = Colors.white,
    );
    // 小さな駅舎(屋根を上から見た形)
    final roofColor = goal ? Palette.roofGoal : Palette.roof;
    final roofRect = Rect.fromLTWH(s * 0.74, s * 0.38, s * 0.2, s * 0.46);
    c.drawRect(
      roofRect.shift(Offset(s * 0.015, s * 0.02)),
      Paint()..color = const Color(0x33000000),
    );
    c.drawRect(roofRect, Paint()..color = roofColor);
    c.drawLine(
      Offset(roofRect.center.dx, roofRect.top),
      Offset(roofRect.center.dx, roofRect.bottom),
      Paint()
        ..color = const Color(0x55FFFFFF)
        ..strokeWidth = s * 0.02,
    );
    final pole = Paint()
      ..color = const Color(0xFF5B4A3A)
      ..strokeWidth = s * 0.03;
    if (goal) {
      // 旗
      c.drawLine(Offset(s * 0.84, s * 0.32), Offset(s * 0.84, s * 0.06), pole);
      final flag = Path()
        ..moveTo(s * 0.84, s * 0.06)
        ..lineTo(s * 0.97, s * 0.11)
        ..lineTo(s * 0.84, s * 0.17)
        ..close();
      c.drawPath(flag, Paint()..color = Palette.danger);
    } else {
      // 信号
      c.drawLine(Offset(s * 0.84, s * 0.32), Offset(s * 0.84, s * 0.14), pole);
      c.drawCircle(Offset(s * 0.84, s * 0.12), s * 0.06, Paint()..color = const Color(0xFF333333));
      c.drawCircle(Offset(s * 0.84, s * 0.12), s * 0.035, Paint()..color = const Color(0xFF6FE08A));
    }
    c.restore();

    // ラベル(文字は回さない)。駅舎と反対側の細い場所に置く
    final side = (3 + tile.rotation) % 4; // 回転 0 では西側
    final vertical = side == 1 || side == 3;
    final label = goal ? (vertical ? '終\n点' : '終点') : (vertical ? '出\n発' : '出発');
    final tp = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          fontSize: s * 0.135,
          fontWeight: FontWeight.w800,
          color: Colors.white,
          height: 1.05,
        ),
      ),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
    )..layout();
    final center = switch (side) {
      0 => Offset(s * 0.5, s * 0.15),
      1 => Offset(s * 0.85, s * 0.5),
      2 => Offset(s * 0.5, s * 0.85),
      _ => Offset(s * 0.15, s * 0.5),
    };
    final chip = Rect.fromCenter(
      center: center,
      width: tp.width + s * 0.07,
      height: tp.height + s * 0.04,
    );
    c.drawRRect(
      RRect.fromRectAndRadius(chip, Radius.circular(s * 0.05)),
      Paint()..color = roofColor,
    );
    tp.paint(c, chip.center - Offset(tp.width / 2, tp.height / 2));
  }

  @override
  bool shouldRepaint(StaticTilePainter old) => old.tile != tile || old.seed != seed;
}
