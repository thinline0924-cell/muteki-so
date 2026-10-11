import 'direction.dart';
import 'tile.dart';

/// 盤面上の座標。x は右へ、y は下へ増える。
class Pos {
  const Pos(this.x, this.y);

  final int x;
  final int y;

  Pos step(Dir d) => Pos(x + d.dx, y + d.dy);

  @override
  bool operator ==(Object other) => other is Pos && other.x == x && other.y == y;

  @override
  int get hashCode => Object.hash(x, y);

  @override
  String toString() => '($x,$y)';
}

/// 盤面。変更できない値オブジェクトで、回すと新しい盤面を返す。
class Board {
  Board(this.width, this.height, List<Tile> tiles) : tiles = List.unmodifiable(tiles) {
    if (width <= 0 || height <= 0 || tiles.length != width * height) {
      throw ArgumentError('盤面の大きさとタイル数が合いません');
    }
  }

  final int width;
  final int height;

  /// 左上から右へ、行ごとに並べたタイル。
  final List<Tile> tiles;

  bool contains(Pos p) => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;

  Tile at(Pos p) => tiles[p.y * width + p.x];

  Iterable<Pos> get positions sync* {
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        yield Pos(x, y);
      }
    }
  }

  Board withTile(Pos p, Tile t) {
    final next = List<Tile>.of(tiles);
    next[p.y * width + p.x] = t;
    return Board(width, height, next);
  }

  /// 出発駅の位置(なければ null、複数あれば最初のもの)。
  Pos? get start => _find(TileKind.start);

  /// 目的地の駅の位置。
  Pos? get goal => _find(TileKind.goal);

  Pos? _find(TileKind kind) {
    for (final p in positions) {
      if (at(p).kind == kind) return p;
    }
    return null;
  }

  @override
  bool operator ==(Object other) {
    if (other is! Board || other.width != width || other.height != height) {
      return false;
    }
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i] != other.tiles[i]) return false;
    }
    return true;
  }

  @override
  int get hashCode => Object.hash(width, height, Object.hashAll(tiles));
}
