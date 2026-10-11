// ステージの自動生成(開発用の道具。アプリには入らない)。
//
// 乱数の種(seed)と条件から盤面を作り、ソルバーで解けることと最少手数を
// 確かめる。同じ seed なら同じ盤面になる。
import 'dart:math';

import 'package:chiisana_shuchakueki/puzzle/board.dart';
import 'package:chiisana_shuchakueki/puzzle/direction.dart';
import 'package:chiisana_shuchakueki/puzzle/route.dart';
import 'package:chiisana_shuchakueki/puzzle/solver.dart';
import 'package:chiisana_shuchakueki/puzzle/tile.dart';

class GenParams {
  const GenParams({
    this.width = 5,
    this.height = 5,
    required this.minPath,
    required this.maxPath,
    this.minTurns = 2,
    this.crossings = 0,
    this.decoys = 2,
    this.decoyTees = false,
    this.obstacles = 3,
    this.fixedPath = 0,
    this.pathTees = 0,
    required this.minMoves,
    required this.maxMoves,
  });

  final int width;
  final int height;

  /// 経路上の線路マスの数(駅を除く)
  final int minPath;
  final int maxPath;
  final int minTurns;

  /// 十字で交差する回数(この数ちょうど)
  final int crossings;

  /// 経路に関係ない線路(まどわせるための線路)
  final int decoys;
  final bool decoyTees;
  final int obstacles;

  /// 正しい向きで固定する経路上のタイル数
  final int fixedPath;

  /// 経路の上に置く T字の数(直線、または右へ曲がるカーブを T字に替える)
  final int pathTees;
  final int minMoves;
  final int maxMoves;
}

class Generated {
  Generated(this.board, this.minMoves);
  final Board board;
  final int minMoves;
}

class _PathCell {
  _PathCell(this.pos, this.entry, this.exit);
  final Pos pos;
  final Dir entry;
  final Dir exit;
}

/// 盤面の「形」(回転を除いた配置)。同じ盤面の使い回しを見つけるのに使う。
String layoutSignature(Board b) => b.tiles.map((t) => t.kind.index.toString()).join();

Generated? generate(GenParams p, int seed, {Set<String> usedLayouts = const {}}) {
  final rng = Random(seed);
  for (var attempt = 0; attempt < 4000; attempt++) {
    final g = _tryOnce(p, rng);
    if (g == null) continue;
    if (usedLayouts.contains(layoutSignature(g.board))) continue;
    return g;
  }
  return null;
}

Generated? _tryOnce(GenParams p, Random rng) {
  final w = p.width, h = p.height;
  final start = Pos(rng.nextInt(w), rng.nextInt(h));
  final d0 = Dir.values[rng.nextInt(4)];
  final first = start.step(d0);
  if (!_inside(first, w, h)) return null;

  final path = <_PathCell>[];
  final occupied = <Pos, int>{start: -1};
  final crosses = <Pos>{};
  Pos? goal;
  Dir? goalEntry;
  var budget = 3000;

  bool extend(Pos c, Dir entry, int turns) {
    if (--budget < 0) return false;
    if (!_inside(c, w, h)) return false;
    final heading = entry.opposite;
    final idx = occupied[c];
    if (idx != null) {
      // 交差できるのは、直線の上を直角に横切るときだけ
      if (idx < 0 || crosses.contains(c) || crosses.length >= p.crossings) {
        return false;
      }
      final cell = path[idx];
      if (cell.exit != cell.entry.opposite) return false;
      if (cell.entry == entry || cell.entry == heading) return false;
      crosses.add(c);
      if (extend(c.step(heading), heading.opposite, turns)) return true;
      crosses.remove(c);
      return false;
    }
    final len = path.length;
    if (len >= p.minPath &&
        turns >= p.minTurns &&
        crosses.length == p.crossings &&
        (len >= p.maxPath || rng.nextDouble() < 0.35)) {
      goal = c;
      goalEntry = entry;
      return true;
    }
    if (len >= p.maxPath) return false;
    final options = [heading, heading.left, heading.right]..shuffle(rng);
    for (final exit in options) {
      path.add(_PathCell(c, entry, exit));
      occupied[c] = path.length - 1;
      if (extend(c.step(exit), exit.opposite, turns + (exit == heading ? 0 : 1))) {
        return true;
      }
      path.removeLast();
      occupied.remove(c);
    }
    return false;
  }

  if (!extend(first, d0.opposite, 0)) return null;

  final tiles = List<Tile>.filled(w * h, Tile.empty);
  void put(Pos q, Tile t) => tiles[q.y * w + q.x] = t;
  put(start, Tile(TileKind.start, rotation: d0.index, fixed: true));
  put(goal!, Tile(TileKind.goal, rotation: goalEntry!.index, fixed: true));
  final pathTiles = <Pos>[];
  for (final cell in path) {
    if (crosses.contains(cell.pos)) {
      put(cell.pos, const Tile(TileKind.cross, fixed: true));
      continue;
    }
    final mask = cell.entry.bit | cell.exit.bit;
    final kind = cell.exit == cell.entry.opposite ? TileKind.straight : TileKind.curve;
    final r = [0, 1, 2, 3].firstWhere((r) => DirMask.rotateCw(kind.baseMask, r) == mask);
    put(cell.pos, Tile(kind, rotation: r));
    pathTiles.add(cell.pos);
  }

  // T字に替えられるマス:直線(横に枝を足す)か、右へ曲がるカーブ(左に枝を足す)
  if (p.pathTees > 0) {
    final candidates = [
      for (final cell in path)
        if (!crosses.contains(cell.pos) &&
            (cell.exit == cell.entry.opposite || cell.exit == cell.entry.opposite.right))
          cell,
    ]..shuffle(rng);
    if (candidates.length < p.pathTees) return null;
    for (final cell in candidates.take(p.pathTees)) {
      final heading = cell.entry.opposite;
      final extra = cell.exit == heading
          ? (rng.nextBool() ? heading.left : heading.right)
          : heading.left;
      final mask = cell.entry.bit | cell.exit.bit | extra.bit;
      final r = [0, 1, 2, 3].firstWhere((r) => DirMask.rotateCw(TileKind.tee.baseMask, r) == mask);
      if (routeExit(TileKind.tee, mask, cell.entry) != cell.exit) return null;
      put(cell.pos, Tile(TileKind.tee, rotation: r));
    }
  }

  // 固定タイル(正しい向きのまま回せない)
  pathTiles.shuffle(rng);
  final fixedSet = pathTiles.take(p.fixedPath).toSet();
  for (final q in fixedSet) {
    final t = tiles[q.y * w + q.x];
    put(q, Tile(t.kind, rotation: t.rotation, fixed: true));
  }

  // まどわせるための線路と障害物
  final empties = <Pos>[
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++)
        if (tiles[y * w + x].kind == TileKind.empty) Pos(x, y),
  ]..shuffle(rng);
  bool nearPath(Pos q) => Dir.values.any((d) {
    final n = q.step(d);
    return _inside(n, w, h) && tiles[n.y * w + n.x].kind != TileKind.empty;
  });
  // 経路の近くを先に使う(まよいやすくなる)
  empties.sort((a, b) => (nearPath(a) ? 0 : 1).compareTo(nearPath(b) ? 0 : 1));
  var used = 0;
  for (var i = 0; i < p.decoys && used < empties.length; i++, used++) {
    final roll = rng.nextDouble();
    final kind = p.decoyTees && roll < 0.2
        ? TileKind.tee
        : (roll < 0.6 ? TileKind.curve : TileKind.straight);
    put(empties[used], Tile(kind, rotation: rng.nextInt(4) % kind.distinctRotations));
  }
  final rest = empties.sublist(used)..shuffle(rng);
  const obstacleKinds = [TileKind.tree, TileKind.tree, TileKind.rock, TileKind.pond];
  for (var i = 0; i < p.obstacles && i < rest.length; i++) {
    put(rest[i], Tile(obstacleKinds[rng.nextInt(obstacleKinds.length)]));
  }

  // 経路上の線路をばらばらの向きにする
  for (final q in pathTiles) {
    if (fixedSet.contains(q)) continue;
    final t = tiles[q.y * w + q.x];
    put(q, t.withRotation(rng.nextInt(4) % t.kind.distinctRotations));
  }

  final board = Board(w, h, tiles);
  if (RouteSimulator.run(board).isSuccess) return null;
  final sol = Solver.solve(board);
  if (sol == null) return null;
  if (sol.moves < p.minMoves || sol.moves > p.maxMoves) return null;
  return Generated(board, sol.moves);
}

bool _inside(Pos p, int w, int h) => p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;
