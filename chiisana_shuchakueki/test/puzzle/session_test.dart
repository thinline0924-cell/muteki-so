import 'package:chiisana_shuchakueki/puzzle/board.dart';
import 'package:chiisana_shuchakueki/puzzle/rating.dart';
import 'package:chiisana_shuchakueki/puzzle/route.dart';
import 'package:chiisana_shuchakueki/puzzle/session.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_helpers.dart';

void main() {
  Board sample() => boardOf(['S1 I0 L0', '.. .. I0', '.. .. G0']);

  group('操作', () {
    test('回すと手数が増え、盤面が変わる', () {
      final s = PuzzleSession(sample());
      expect(s.rotate(const Pos(1, 0)), isTrue);
      expect(s.moves, 1);
      expect(s.board.at(const Pos(1, 0)).rotation, 1);
    });

    test('駅・草地・盤面外は回せず、手数も増えない', () {
      final s = PuzzleSession(sample());
      expect(s.rotate(const Pos(0, 0)), isFalse); // 出発駅
      expect(s.rotate(const Pos(0, 1)), isFalse); // 草地
      expect(s.rotate(const Pos(5, 5)), isFalse);
      expect(s.moves, 0);
      expect(s.board, s.initialBoard);
    });

    test('1手戻すと盤面と手数が元に戻る', () {
      final s = PuzzleSession(sample());
      s.rotate(const Pos(1, 0));
      s.rotate(const Pos(2, 0));
      s.rotate(const Pos(2, 0));
      final afterTwo = boardAfter(s.initialBoard, [const Pos(1, 0), const Pos(2, 0)]);
      expect(s.undo(), isTrue);
      expect(s.moves, 2);
      expect(s.board, afterTwo);
      expect(s.undo(), isTrue);
      expect(s.undo(), isTrue);
      expect(s.board, s.initialBoard);
      expect(s.undo(), isFalse); // もう戻せない
      expect(s.moves, 0);
    });

    test('リセットで最初の盤面と手数 0 に戻る', () {
      final s = PuzzleSession(sample());
      for (var i = 0; i < 7; i++) {
        s.rotate(const Pos(2, 0));
      }
      expect(s.reset(), isTrue);
      expect(s.board, s.initialBoard);
      expect(s.moves, 0);
      expect(s.canUndo, isFalse);
    });

    test('解いて出発するとクリア', () {
      final s = PuzzleSession(sample());
      s.rotate(const Pos(1, 0)); // 直線を東西に
      s.rotate(const Pos(2, 0)); // 北東 → 東南
      s.rotate(const Pos(2, 0)); // 東南 → 南西
      final r = s.depart()!;
      expect(r.outcome, RouteOutcome.arrived);
    });

    test('走行中は回す・戻す・リセット・再出発ができない', () {
      final s = PuzzleSession(sample());
      s.rotate(const Pos(1, 0));
      expect(s.depart(), isNotNull);
      expect(s.isRunning, isTrue);
      expect(s.rotate(const Pos(2, 0)), isFalse);
      expect(s.undo(), isFalse);
      expect(s.reset(), isFalse);
      expect(s.depart(), isNull);
      expect(s.moves, 1);
      s.finishRun();
      expect(s.rotate(const Pos(2, 0)), isTrue);
    });
  });

  group('星の評価', () {
    const t = StarThresholds(three: 4, two: 7);
    test('基準手数以下で ★3、次の基準以下で ★2、それ以外は ★1', () {
      expect(t.starsFor(0), 3);
      expect(t.starsFor(4), 3);
      expect(t.starsFor(5), 2);
      expect(t.starsFor(7), 2);
      expect(t.starsFor(8), 1);
      expect(t.starsFor(100), 1);
    });
  });
}

Board boardAfter(Board b, List<Pos> taps) {
  var r = b;
  for (final p in taps) {
    r = r.withTile(p, r.at(p).rotated());
  }
  return r;
}
