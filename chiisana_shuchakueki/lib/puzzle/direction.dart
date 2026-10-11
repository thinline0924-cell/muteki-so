/// 盤面の方向(北・東・南・西)と、接続方向を表すビットマスクの道具。
///
/// 座標系は「x は右へ増える、y は下へ増える」。北 = 画面の上。
library;

enum Dir {
  north(0, -1),
  east(1, 0),
  south(0, 1),
  west(-1, 0);

  const Dir(this.dx, this.dy);

  final int dx;
  final int dy;

  /// 接続マスクでのビット(北=1, 東=2, 南=4, 西=8)。
  int get bit => 1 << index;

  /// 反対の方向。
  Dir get opposite => Dir.values[(index + 2) % 4];

  /// 時計回りに [times] 回(90度ずつ)回した方向。負の数なら反時計回り。
  Dir rotatedCw([int times = 1]) => Dir.values[(index + times) % 4];

  /// 進行方向から見て右。
  Dir get right => rotatedCw(1);

  /// 進行方向から見て左。
  Dir get left => rotatedCw(3);
}

/// 接続方向を 4 ビットのマスクで扱うための関数群。
abstract final class DirMask {
  static const int none = 0;
  static const int all = 15;

  /// [mask] を時計回りに [times] 回(90度ずつ)回す。
  static int rotateCw(int mask, int times) {
    final t = times % 4;
    var m = mask & all;
    for (var i = 0; i < t; i++) {
      m = ((m << 1) | (m >> 3)) & all;
    }
    return m;
  }

  static bool has(int mask, Dir d) => mask & d.bit != 0;

  static int of(Iterable<Dir> dirs) => dirs.fold(0, (m, d) => m | d.bit);

  static List<Dir> dirs(int mask) => [
    for (final d in Dir.values)
      if (has(mask, d)) d,
  ];

  static int count(int mask) => dirs(mask).length;
}
