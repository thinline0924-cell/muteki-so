import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../route_geometry.dart';
import '../theme.dart';

/// 列車(機関車+客車 1 両)を描く。位置は [TrackGeometry] にそって決まる。
class TrainPainter extends CustomPainter {
  TrainPainter({
    required this.geometry,
    required this.front,
    required this.cellSize,
    this.crashed = false,
    this.smokePhase = 0,
    this.body = Palette.train,
    this.accent = Palette.trainAccent,
  });

  final Color body;
  final Color accent;

  final TrackGeometry geometry;

  /// 先頭の位置(経路の始まりからの距離、マス単位)
  final double front;
  final double cellSize;
  final bool crashed;

  /// 煙のゆらぎ(0〜1 をくり返す)
  final double smokePhase;

  static const locoLength = 0.44;
  static const coachLength = 0.38;
  static const gap = 0.06;
  static const width = 0.34;

  @override
  void paint(Canvas canvas, Size size) {
    final locoCenter = front - locoLength / 2;
    final coachCenter = front - locoLength - gap - coachLength / 2;
    _car(canvas, geometry.at(coachCenter), coachLength, loco: false);
    _car(canvas, geometry.at(locoCenter), locoLength, loco: true);
  }

  void _car(Canvas c, ({Offset pos, double angle}) at, double length, {required bool loco}) {
    final s = cellSize;
    c.save();
    c.translate(at.pos.dx * s, at.pos.dy * s);
    c.rotate(at.angle);
    final w = width * s;
    final l = length * s;
    // 影
    c.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset(s * 0.02, s * 0.04), width: l, height: w),
        Radius.circular(s * 0.07),
      ),
      Paint()..color = const Color(0x44000000),
    );
    // 車体
    final body = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset.zero, width: l, height: w),
      Radius.circular(s * 0.07),
    );
    c.drawRRect(body, Paint()..color = darken(this.body, 0.3));
    c.drawRRect(body.deflate(s * 0.022), Paint()..color = this.body);
    // 屋根の帯
    c.drawRect(
      Rect.fromCenter(center: Offset.zero, width: l * 0.8, height: w * 0.32),
      Paint()..color = accent,
    );
    if (loco) {
      // 先頭の窓とライト
      c.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset(l * 0.36, 0), width: l * 0.12, height: w * 0.62),
          Radius.circular(s * 0.02),
        ),
        Paint()..color = const Color(0xFF2E3B44),
      );
      c.drawCircle(Offset(l * 0.47, -w * 0.3), s * 0.03, Paint()..color = const Color(0xFFFFF2A8));
      c.drawCircle(Offset(l * 0.47, w * 0.3), s * 0.03, Paint()..color = const Color(0xFFFFF2A8));
      // 煙突と煙
      c.drawCircle(Offset(l * 0.12, 0), s * 0.05, Paint()..color = const Color(0xFF3A3A3A));
      if (!crashed) {
        for (var i = 0; i < 3; i++) {
          final t = (smokePhase + i / 3) % 1.0;
          c.drawCircle(
            Offset(l * 0.12 - t * s * 0.5, math.sin(t * 6) * s * 0.05),
            s * (0.04 + t * 0.06),
            Paint()..color = Colors.white.withValues(alpha: 0.55 * (1 - t)),
          );
        }
      }
    } else {
      // 客車の窓
      final win = Paint()..color = const Color(0xFF9FD3EA);
      for (final x in [-0.28, 0.0, 0.28]) {
        c.drawRect(
          Rect.fromCenter(center: Offset(l * x, -w * 0.33), width: l * 0.16, height: w * 0.12),
          win,
        );
        c.drawRect(
          Rect.fromCenter(center: Offset(l * x, w * 0.33), width: l * 0.16, height: w * 0.12),
          win,
        );
      }
    }
    c.restore();
  }

  @override
  bool shouldRepaint(TrainPainter old) =>
      old.front != front ||
      old.geometry != geometry ||
      old.cellSize != cellSize ||
      old.crashed != crashed ||
      old.smokePhase != smokePhase ||
      old.body != body ||
      old.accent != accent;
}
