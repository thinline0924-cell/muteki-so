import 'board.dart';
import 'direction.dart';
import 'tile.dart';

/// 列車を走らせた結果。
enum RouteOutcome {
  /// 目的地に着いた(クリア)
  arrived,

  /// 盤面の外へ出てしまった
  offBoard,

  /// 線路のないマス(草地・障害物)へ進んだ
  noTrack,

  /// 線路はあるが、入ってきた辺とつながっていない
  disconnected,

  /// 目的地以外の駅(出発駅)に突っこんだ
  wrongStation,

  /// 同じ所をぐるぐる回り続ける
  loop,

  /// 出発駅や目的地がない・駅の向きがおかしいなど、盤面がこわれている
  invalidBoard,
}

/// 列車が通った 1 マス分の記録。
class RouteStep {
  const RouteStep(this.pos, this.entry, this.exit);

  final Pos pos;

  /// このマスへ入ってきた辺(出発駅では null)
  final Dir? entry;

  /// このマスから出ていく辺(目的地では null)
  final Dir? exit;

  @override
  String toString() => 'Step($pos, in:${entry?.name}, out:${exit?.name})';
}

class RouteResult {
  const RouteResult(this.outcome, this.steps, {this.blockedAt});

  final RouteOutcome outcome;

  /// 出発駅から順に、列車が通ったマス。ループのときは一周分を含む。
  final List<RouteStep> steps;

  /// 失敗したとき、列車が入ろうとしたマス(盤面外の座標のこともある)。
  final Pos? blockedAt;

  bool get isSuccess => outcome == RouteOutcome.arrived;
}

/// 経路の検証。盤面を受け取り、列車がどこまで進めるかを先に計算する。
///
/// 画面のアニメーションはこの結果を再生するだけで、判定には関わらない。
///
/// ループの判定:
/// 列車の「状態」を (マスの位置, 入ってきた辺) で表す。走行中に盤面は
/// 変わらないので、次のマスは状態だけで決まる。同じ状態に 2 回なったら、
/// そこから先は同じ動きを永遠にくり返すのでループと判定する。
/// 十字線路は向きを変えて 2 回通れるが、入ってきた辺がちがうので別の状態に
/// なり、誤ってループ扱いされない。
abstract final class RouteSimulator {
  static RouteResult run(Board board) {
    final start = board.start;
    final goal = board.goal;
    if (start == null || goal == null) {
      return const RouteResult(RouteOutcome.invalidBoard, []);
    }
    final startTile = board.at(start);
    final firstExit = DirMask.dirs(startTile.mask);
    if (firstExit.length != 1) {
      return const RouteResult(RouteOutcome.invalidBoard, []);
    }

    final steps = <RouteStep>[RouteStep(start, null, firstExit.first)];
    final seen = <(Pos, Dir)>{};
    var pos = start;
    var heading = firstExit.first;
    // 状態の数(マス数×4)を超えて進むことはない。念のための上限。
    final maxSteps = board.width * board.height * 4 + 2;

    for (var i = 0; i < maxSteps; i++) {
      final next = pos.step(heading);
      if (!board.contains(next)) {
        return RouteResult(RouteOutcome.offBoard, steps, blockedAt: next);
      }
      final tile = board.at(next);
      final entry = heading.opposite;

      if (tile.kind == TileKind.goal) {
        if (tile.connects(entry)) {
          steps.add(RouteStep(next, entry, null));
          return RouteResult(RouteOutcome.arrived, steps);
        }
        return RouteResult(RouteOutcome.disconnected, steps, blockedAt: next);
      }
      if (tile.kind == TileKind.start) {
        return RouteResult(RouteOutcome.wrongStation, steps, blockedAt: next);
      }
      if (!tile.kind.isTrack) {
        return RouteResult(RouteOutcome.noTrack, steps, blockedAt: next);
      }
      final exit = tile.exitFor(entry);
      if (exit == null) {
        return RouteResult(RouteOutcome.disconnected, steps, blockedAt: next);
      }
      if (!seen.add((next, entry))) {
        return RouteResult(RouteOutcome.loop, steps, blockedAt: next);
      }
      steps.add(RouteStep(next, entry, exit));
      pos = next;
      heading = exit;
    }
    return RouteResult(RouteOutcome.loop, steps);
  }
}
