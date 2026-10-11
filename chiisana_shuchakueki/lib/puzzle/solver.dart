import 'board.dart';
import 'direction.dart';
import 'route.dart';
import 'tile.dart';

/// ソルバーの答え。
class Solution {
  const Solution(this.moves, this.rotations);

  /// 最少の手数(タップ回数)。
  final int moves;

  /// 回す必要があるマスと、そのマスのタップ回数(1〜3)。
  final Map<Pos, int> rotations;

  /// 答えどおりに回した盤面。
  Board apply(Board board) {
    var b = board;
    rotations.forEach((p, n) => b = b.withTile(p, b.at(p).rotated(n)));
    return b;
  }
}

/// ヒント:どのマスを何回タップすればよいか。
class Hint {
  const Hint(this.pos, this.taps);

  final Pos pos;
  final int taps;
}

/// ステージの解き方を探す。
///
/// 出発駅から線路を 1 マスずつたどり、各マスで「入ってきた辺とつながる向き」
/// をすべて試す深さ優先探索。今までの最良より手数が多くなった枝は打ち切る。
/// 経路に乗らないマスは回す必要がないので数えない。
abstract final class Solver {
  /// 最少手数の解き方。解けないなら null。
  static Solution? solve(Board board) {
    final start = board.start;
    if (start == null || board.goal == null) return null;
    final exits = DirMask.dirs(board.at(start).mask);
    if (exits.length != 1) return null;

    Map<Pos, int>? best;
    var bestCost = 1 << 30;
    final assigned = <Pos, int>{}; // マス → 決めたタップ回数
    final visited = <(Pos, Dir)>{};

    void search(Pos from, Dir heading, int cost) {
      if (cost >= bestCost) return;
      final pos = from.step(heading);
      if (!board.contains(pos)) return;
      final tile = board.at(pos);
      final entry = heading.opposite;

      if (tile.kind == TileKind.goal) {
        if (tile.connects(entry)) {
          bestCost = cost;
          best = Map.of(assigned)..removeWhere((_, n) => n == 0);
        }
        return;
      }
      if (!tile.kind.isTrack) return;
      if (!visited.add((pos, entry))) return; // ループ
      try {
        final already = assigned[pos];
        if (already != null) {
          // 十字などで 2 回目に通るマス。向きは 1 回目に決めたまま。
          final exit = tile.rotated(already).exitFor(entry);
          if (exit != null) search(pos, exit, cost);
          return;
        }
        final tried = <int>{};
        final maxTurns = tile.canRotate ? 4 : 1;
        for (var n = 0; n < maxTurns; n++) {
          final t = tile.rotated(n);
          if (!tried.add(t.mask)) continue; // 同じ形(直線の 180 度など)
          final exit = t.exitFor(entry);
          if (exit == null) continue;
          assigned[pos] = n;
          search(pos, exit, cost + n);
          assigned.remove(pos);
        }
      } finally {
        visited.remove((pos, entry));
      }
    }

    search(start, exits.first, 0);
    final found = best;
    if (found == null) return null;
    return Solution(bestCost, found);
  }

  /// 今の盤面から、次に回すとよいマスを 1 つ教える。
  /// すでに解けている・解けない場合は null。
  static Hint? hint(Board board) {
    if (RouteSimulator.run(board).isSuccess) return null;
    final s = solve(board);
    if (s == null || s.rotations.isEmpty) return null;
    // 出発駅に近い順に教える
    final order = RouteSimulator.run(s.apply(board)).steps.map((e) => e.pos);
    for (final p in order) {
      final n = s.rotations[p];
      if (n != null) return Hint(p, n);
    }
    final first = s.rotations.entries.first;
    return Hint(first.key, first.value);
  }
}
