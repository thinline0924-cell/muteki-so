import 'direction.dart';

/// マスの種類。
enum TileKind {
  /// 何もない草地(列車は通れない)
  empty,

  /// 直線線路。回転 0 で北-南
  straight,

  /// カーブ線路。回転 0 で北-東
  curve,

  /// T字線路。回転 0 で東-南-西(北がふさがっている)
  tee,

  /// 十字線路。どの向きでも同じなので回転しない
  cross,

  /// 出発駅。回転の向きへ列車が出ていく
  start,

  /// 目的地の駅。回転の向きから列車が入ってくる
  goal,

  /// 岩(障害物)
  rock,

  /// 木(障害物)
  tree,

  /// 池(障害物)
  pond;

  /// 回転 0 のときの接続方向。
  int get baseMask => switch (this) {
    TileKind.straight => Dir.north.bit | Dir.south.bit,
    TileKind.curve => Dir.north.bit | Dir.east.bit,
    TileKind.tee => Dir.east.bit | Dir.south.bit | Dir.west.bit,
    TileKind.cross => DirMask.all,
    TileKind.start || TileKind.goal => Dir.north.bit,
    _ => DirMask.none,
  };

  /// 線路パーツ(タップで回せる種類)かどうか。
  bool get isTrack =>
      this == TileKind.straight ||
      this == TileKind.curve ||
      this == TileKind.tee ||
      this == TileKind.cross;

  bool get isStation => this == TileKind.start || this == TileKind.goal;

  bool get isObstacle => this == TileKind.rock || this == TileKind.tree || this == TileKind.pond;

  /// 見た目がちがう向きの数(直線は 2、十字は 1)。
  int get distinctRotations => switch (this) {
    TileKind.straight => 2,
    TileKind.curve || TileKind.tee => 4,
    TileKind.start || TileKind.goal => 4,
    _ => 1,
  };
}

/// 盤面の 1 マス。変更できない値オブジェクト。
class Tile {
  const Tile(this.kind, {this.rotation = 0, this.fixed = false});

  static const Tile empty = Tile(TileKind.empty);

  final TileKind kind;

  /// 時計回りに 90 度ずつ回した回数(0〜3)。
  final int rotation;

  /// true なら回転できない(固定タイル)。
  final bool fixed;

  /// 現在つながっている方向のマスク。
  int get mask => DirMask.rotateCw(kind.baseMask, rotation);

  bool connects(Dir side) => DirMask.has(mask, side);

  /// タップで回せるかどうか。十字は回しても変わらないので回せない扱い。
  bool get canRotate => kind.isTrack && !fixed && kind.distinctRotations > 1;

  /// 時計回りに 90 度回したタイル。
  Tile rotated([int times = 1]) => Tile(kind, rotation: (rotation + times) % 4, fixed: fixed);

  Tile withRotation(int r) => Tile(kind, rotation: r % 4, fixed: fixed);

  /// [entry] の辺から入ってきた列車が出ていく辺。通れないなら null。
  Dir? exitFor(Dir entry) => routeExit(kind, mask, entry);

  @override
  bool operator ==(Object other) =>
      other is Tile && other.kind == kind && other.rotation == rotation && other.fixed == fixed;

  @override
  int get hashCode => Object.hash(kind, rotation, fixed);

  @override
  String toString() => 'Tile(${kind.name}, r$rotation${fixed ? ', fixed' : ''})';
}

/// 線路パーツの通り方のルール。
///
/// [entry] は「このマスのどの辺から入ってきたか」。
/// - 直線・十字:まっすぐ抜ける
/// - カーブ:もう一方の口へ抜ける
/// - T字:まっすぐ抜けられるなら直進。突き当たりなら右へ曲がる
///   (右がなければ左)
Dir? routeExit(TileKind kind, int mask, Dir entry) {
  if (!kind.isTrack || !DirMask.has(mask, entry)) return null;
  final heading = entry.opposite; // 進んでいる向き
  switch (kind) {
    case TileKind.straight:
    case TileKind.cross:
      return DirMask.has(mask, heading) ? heading : null;
    case TileKind.curve:
      final others = DirMask.dirs(mask).where((d) => d != entry).toList();
      return others.length == 1 ? others.first : null;
    case TileKind.tee:
      if (DirMask.has(mask, heading)) return heading;
      if (DirMask.has(mask, heading.right)) return heading.right;
      if (DirMask.has(mask, heading.left)) return heading.left;
      return null;
    default:
      return null;
  }
}
