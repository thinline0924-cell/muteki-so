import 'package:chiisana_shuchakueki/puzzle/board.dart';
import 'package:chiisana_shuchakueki/puzzle/route.dart';
import 'package:chiisana_shuchakueki/puzzle/solver.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_helpers.dart';

void main() {
  test('最少手数を見つけ、その通りに回すとクリアできる', () {
    final b = boardOf(['S1 I0 L0', '.. .. I0', '.. .. G0']);
    final s = Solver.solve(b)!;
    expect(s.moves, 3); // 直線 1 回 + カーブ 2 回
    expect(s.rotations, {const Pos(1, 0): 1, const Pos(2, 0): 2});
    expect(RouteSimulator.run(s.apply(b)).isSuccess, isTrue);
  });

  test('直線は 180 度回しても同じ形なので、最大 1 回でよい', () {
    final b = boardOf(['S1 I0 G3']);
    expect(Solver.solve(b)!.moves, 1);
  });

  test('道が 2 つあれば、手数が少ない方を選ぶ', () {
    // 上の道:(1,1) を 2 回 + (3,1) を 3 回 = 5 手
    // 下の道:(1,1) を 1 回 = 1 手
    final b = boardOf(['.. L1 I1 L2 ..', 'S1 L1 .. L1 G3', '.. L0 I1 L3 ..']);
    final s = Solver.solve(b)!;
    expect(s.moves, 1);
    expect(s.rotations, {const Pos(1, 1): 1});
    expect(RouteSimulator.run(s.apply(b)).isSuccess, isTrue);
  });

  test('解けない盤面では null', () {
    expect(Solver.solve(boardOf(['S1 .. G3'])), isNull);
    expect(Solver.solve(boardOf(['S1 I0 ^ G3'])), isNull);
  });

  test('すでに解けているなら 0 手', () {
    expect(Solver.solve(boardOf(['S1 I1 G3']))!.moves, 0);
  });

  test('十字を通る解も見つける', () {
    final b = boardOf(['.. L0 L0 ..', 'S1 X0 L0 ..', '.. I1 .. ..', '.. G0 .. ..']);
    final s = Solver.solve(b)!;
    expect(RouteSimulator.run(s.apply(b)).isSuccess, isTrue);
  });

  test('ヒントは回すべきマスと回数を教え、従えば解ける', () {
    var b = boardOf(['S1 I0 L0', '.. .. I0', '.. .. G0']);
    for (var i = 0; i < 5; i++) {
      final h = Solver.hint(b);
      if (h == null) break;
      b = b.withTile(h.pos, b.at(h.pos).rotated(h.taps));
    }
    expect(RouteSimulator.run(b).isSuccess, isTrue);
    expect(Solver.hint(b), isNull);
  });
}
