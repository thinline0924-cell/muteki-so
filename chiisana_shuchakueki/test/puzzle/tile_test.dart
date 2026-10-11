import 'package:chiisana_shuchakueki/puzzle/direction.dart';
import 'package:chiisana_shuchakueki/puzzle/tile.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('方向', () {
    test('反対の方向', () {
      expect(Dir.north.opposite, Dir.south);
      expect(Dir.east.opposite, Dir.west);
    });
    test('時計回りに回す', () {
      expect(Dir.north.rotatedCw(), Dir.east);
      expect(Dir.west.rotatedCw(), Dir.north);
      expect(Dir.south.rotatedCw(2), Dir.north);
      expect(Dir.north.right, Dir.east);
      expect(Dir.north.left, Dir.west);
    });
    test('マスクを回す', () {
      final ns = Dir.north.bit | Dir.south.bit;
      expect(DirMask.rotateCw(ns, 1), Dir.east.bit | Dir.west.bit);
      expect(DirMask.rotateCw(ns, 2), ns);
      // 西→北へ回りこむ
      expect(DirMask.rotateCw(Dir.west.bit, 1), Dir.north.bit);
      expect(DirMask.rotateCw(Dir.north.bit, 4), Dir.north.bit);
    });
  });

  group('タイルの回転', () {
    test('タップ 1 回で 90 度回り、4 回で元に戻る', () {
      const t = Tile(TileKind.curve);
      expect(t.rotated().rotation, 1);
      expect(t.rotated(4), t);
    });

    test('直線の接続:北南 → 東西 → 北南', () {
      const t = Tile(TileKind.straight);
      expect(DirMask.dirs(t.mask), [Dir.north, Dir.south]);
      expect(DirMask.dirs(t.rotated().mask), [Dir.east, Dir.west]);
      expect(t.rotated(2).mask, t.mask);
    });

    test('カーブの接続:北東 → 東南 → 南西 → 西北', () {
      const t = Tile(TileKind.curve);
      expect(DirMask.dirs(t.mask), [Dir.north, Dir.east]);
      expect(DirMask.dirs(t.rotated(1).mask), [Dir.east, Dir.south]);
      expect(DirMask.dirs(t.rotated(2).mask), [Dir.south, Dir.west]);
      expect(DirMask.dirs(t.rotated(3).mask), [Dir.north, Dir.west]);
    });

    test('T字は 3 方向、十字は 4 方向', () {
      const tee = Tile(TileKind.tee);
      expect(DirMask.dirs(tee.mask), [Dir.east, Dir.south, Dir.west]);
      expect(DirMask.dirs(tee.rotated().mask), [Dir.north, Dir.south, Dir.west]);
      expect(DirMask.count(const Tile(TileKind.cross).mask), 4);
    });

    test('固定タイル・駅・十字・障害物は回せない', () {
      expect(const Tile(TileKind.curve).canRotate, isTrue);
      expect(const Tile(TileKind.curve, fixed: true).canRotate, isFalse);
      expect(const Tile(TileKind.start).canRotate, isFalse);
      expect(const Tile(TileKind.cross).canRotate, isFalse);
      expect(const Tile(TileKind.rock).canRotate, isFalse);
    });
  });

  group('線路の通り方', () {
    test('直線はまっすぐ抜ける。つながっていない辺からは入れない', () {
      const t = Tile(TileKind.straight); // 北南
      expect(t.exitFor(Dir.north), Dir.south);
      expect(t.exitFor(Dir.south), Dir.north);
      expect(t.exitFor(Dir.east), isNull);
    });

    test('カーブはもう一方の口へ曲がる', () {
      const t = Tile(TileKind.curve); // 北東
      expect(t.exitFor(Dir.north), Dir.east);
      expect(t.exitFor(Dir.east), Dir.north);
      expect(t.exitFor(Dir.west), isNull);
    });

    test('十字はまっすぐ抜ける', () {
      const t = Tile(TileKind.cross);
      for (final d in Dir.values) {
        expect(t.exitFor(d), d.opposite);
      }
    });

    test('T字は直進優先、突き当たりでは右へ', () {
      const t = Tile(TileKind.tee); // 東南西(北がない)
      expect(t.exitFor(Dir.west), Dir.east); // 西から入る → 直進
      expect(t.exitFor(Dir.east), Dir.west);
      // 南から入る(北へ進む)→ 北はない → 右(東)へ
      expect(t.exitFor(Dir.south), Dir.east);
      expect(t.exitFor(Dir.north), isNull);
    });

    test('草地・障害物は通れない', () {
      expect(Tile.empty.exitFor(Dir.north), isNull);
      expect(const Tile(TileKind.tree).exitFor(Dir.north), isNull);
    });
  });
}
