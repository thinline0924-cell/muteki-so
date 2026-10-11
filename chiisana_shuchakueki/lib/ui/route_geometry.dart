import 'dart:math' as math;
import 'dart:ui';

import '../puzzle/board.dart';
import '../puzzle/direction.dart';
import '../puzzle/route.dart';

/// 経路の結果(RouteResult)を、列車アニメーション用の線と弧に変換する。
///
/// 座標の単位は「マス」。マス (x, y) は (x, y)〜(x+1, y+1) の正方形。
/// 判定はせず、決まった結果を見た目にするだけ。
class TrackGeometry {
  TrackGeometry._(this._segments) : length = _segments.fold(0.0, (s, e) => s + e.length);

  final List<_Segment> _segments;

  /// 全体の長さ(マス単位)。
  final double length;

  /// 先頭から [distance] 進んだ位置と、進行方向の角度(ラジアン)。
  ({Offset pos, double angle}) at(double distance) {
    var d = distance.clamp(0.0, length);
    for (final s in _segments) {
      if (d <= s.length || identical(s, _segments.last)) {
        return s.at((d / s.length).clamp(0.0, 1.0));
      }
      d -= s.length;
    }
    return _segments.last.at(1);
  }

  /// 走りはじめの位置(列車の先頭)。
  static const double startFront = 0.95;

  /// 着いたときに先頭が止まる位置(終わりからの距離)。
  static const double endMargin = 0.05;

  /// 列車を止める位置(先頭)。
  double get stopFront => math.max(startFront, length - endMargin);

  /// 出発前:列車が出発駅に止まっているときの線。
  static TrackGeometry idle(Board board) {
    final start = board.start;
    if (start == null) return fromRoute(const RouteResult(RouteOutcome.invalidBoard, []));
    final exits = DirMask.dirs(board.at(start).mask);
    if (exits.isEmpty) return fromRoute(const RouteResult(RouteOutcome.invalidBoard, []));
    return fromRoute(RouteResult(RouteOutcome.arrived, [RouteStep(start, null, exits.first)]));
  }

  static TrackGeometry fromRoute(RouteResult result) {
    final segs = <_Segment>[];
    final steps = result.steps;
    if (steps.isEmpty) {
      return TrackGeometry._([_Line(Offset.zero, const Offset(0.01, 0))]);
    }
    for (final step in steps) {
      final c = _center(step.pos);
      final entry = step.entry;
      final exit = step.exit;
      if (entry == null && exit != null) {
        // 出発駅:駅の奥から出口まで(列車が駅の中に収まるように)
        segs.add(_Line(_edge(c, exit.opposite), _edge(c, exit)));
      } else if (exit == null && entry != null) {
        // 目的地:入口から駅の奥まで
        segs.add(_Line(_edge(c, entry), _edge(c, entry.opposite)));
      } else if (entry != null && exit != null) {
        if (exit == entry.opposite) {
          segs.add(_Line(_edge(c, entry), _edge(c, exit)));
        } else {
          final corner = c + Offset(entry.dx * 0.5 + exit.dx * 0.5, entry.dy * 0.5 + exit.dy * 0.5);
          segs.add(_Arc(corner, _edge(c, entry), _edge(c, exit)));
        }
      }
    }
    // 失敗したとき:ぶつかる所まで少しはみ出して止まる
    final last = steps.last;
    if (!result.isSuccess && last.exit != null) {
      final bump = switch (result.outcome) {
        RouteOutcome.offBoard || RouteOutcome.loop => 0.0,
        _ => 0.18,
      };
      if (bump > 0) {
        final from = _edge(_center(last.pos), last.exit!);
        segs.add(_Line(from, from + Offset(last.exit!.dx * bump, last.exit!.dy * bump)));
      }
    }
    return TrackGeometry._(segs);
  }

  static Offset _center(Pos p) => Offset(p.x + 0.5, p.y + 0.5);

  static Offset _edge(Offset center, Dir d) => center + Offset(d.dx * 0.5, d.dy * 0.5);
}

abstract class _Segment {
  double get length;
  ({Offset pos, double angle}) at(double t);
}

class _Line extends _Segment {
  _Line(this.a, this.b);
  final Offset a;
  final Offset b;

  @override
  double get length => (b - a).distance;

  @override
  ({Offset pos, double angle}) at(double t) =>
      (pos: Offset.lerp(a, b, t)!, angle: (b - a).direction);
}

class _Arc extends _Segment {
  _Arc(this.center, Offset from, Offset to)
    : _start = (from - center).direction,
      _sweep = _normalize((to - center).direction - (from - center).direction);

  final Offset center;
  final double _start;
  final double _sweep;
  static const double _r = 0.5;

  static double _normalize(double a) {
    var x = a;
    while (x > math.pi) {
      x -= 2 * math.pi;
    }
    while (x < -math.pi) {
      x += 2 * math.pi;
    }
    return x;
  }

  @override
  double get length => _r * _sweep.abs();

  @override
  ({Offset pos, double angle}) at(double t) {
    final a = _start + _sweep * t;
    final pos = center + Offset(math.cos(a) * _r, math.sin(a) * _r);
    // 接線の向き(回る向きで ±90 度)
    final angle = a + (_sweep > 0 ? math.pi / 2 : -math.pi / 2);
    return (pos: pos, angle: angle);
  }
}
