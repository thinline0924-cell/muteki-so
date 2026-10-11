import 'package:chiisana_shuchakueki/puzzle/board.dart';
import 'package:chiisana_shuchakueki/puzzle/direction.dart';
import 'package:chiisana_shuchakueki/puzzle/route.dart';
import 'package:chiisana_shuchakueki/puzzle/tile.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_helpers.dart';

void main() {
  group('経路の検証', () {
    test('つながった線路を通って目的地に着くとクリア', () {
      final r = RouteSimulator.run(boardOf(['S1 I1 L2', '.. .. I0', '.. .. G0']));
      expect(r.outcome, RouteOutcome.arrived);
      expect(r.isSuccess, isTrue);
      expect(r.steps.map((s) => s.pos), const [
        Pos(0, 0),
        Pos(1, 0),
        Pos(2, 0),
        Pos(2, 1),
        Pos(2, 2),
      ]);
      expect(r.steps.first.entry, isNull);
      expect(r.steps.last.exit, isNull);
      expect(r.steps[2].entry, Dir.west);
      expect(r.steps[2].exit, Dir.south);
    });

    test('つながっていない線路の手前で止まる', () {
      final r = RouteSimulator.run(
        boardOf([
          'S1 I0 I1 G3', // 2 マス目が北南を向いている
        ]),
      );
      expect(r.outcome, RouteOutcome.disconnected);
      expect(r.blockedAt, const Pos(1, 0));
      expect(r.steps.length, 1);
    });

    test('線路のないマスへは進めない', () {
      final r = RouteSimulator.run(boardOf(['S1 .. G3']));
      expect(r.outcome, RouteOutcome.noTrack);
      final r2 = RouteSimulator.run(boardOf(['S1 ^ G3']));
      expect(r2.outcome, RouteOutcome.noTrack);
    });

    test('目的地に反対側から入ると失敗', () {
      final r = RouteSimulator.run(boardOf(['S1 I1 G1 ..']));
      expect(r.outcome, RouteOutcome.disconnected);
      expect(r.blockedAt, const Pos(2, 0));
    });

    test('盤面の外へ出ると失敗', () {
      final r = RouteSimulator.run(boardOf(['S1 L3 ..', '.. .. G0']));
      expect(r.outcome, RouteOutcome.offBoard);
      expect(r.blockedAt, const Pos(1, -1));
    });

    test('出発駅(目的地以外の駅)に突っこむと失敗', () {
      final r = RouteSimulator.run(boardOf(['S2 I1 L2', 'L0 I1 L3', '.. .. G0']));
      expect(r.outcome, RouteOutcome.wrongStation);
      expect(r.blockedAt, const Pos(0, 0));
    });

    test('ぐるぐる回るループを見つける', () {
      // T字を直進して右下の輪に入り、T字で右へ曲がって輪をくり返す
      final r = RouteSimulator.run(
        boardOf(['.. .. .. ..', 'S1 T0 L2 ..', '.. L0 L3 ..', 'G0 .. .. ..']),
      );
      expect(r.outcome, RouteOutcome.loop);
      expect(r.blockedAt, const Pos(2, 1));
      // T字には 2 回(ちがう向きから)入っている
      expect(r.steps.where((s) => s.pos == const Pos(1, 1)).length, 2);
    });

    test('十字を 2 回通っても(向きがちがえば)ループ扱いしない', () {
      // 8 の字:十字 (1,1) を横と縦で 1 回ずつ通る
      final r = RouteSimulator.run(
        boardOf(['.. L1 L2 ..', 'S1 X0 L3 ..', '.. I0 .. ..', '.. G0 .. ..']),
      );
      expect(r.outcome, RouteOutcome.arrived);
      expect(r.steps.where((s) => s.pos == const Pos(1, 1)).length, 2);
    });

    test('出発駅や目的地がない盤面はクラッシュせず invalidBoard', () {
      final b = Board(2, 1, const [Tile(TileKind.straight), Tile.empty]);
      expect(RouteSimulator.run(b).outcome, RouteOutcome.invalidBoard);
      final noGoal = Board(2, 1, const [Tile(TileKind.start, rotation: 1), Tile.empty]);
      expect(RouteSimulator.run(noGoal).outcome, RouteOutcome.invalidBoard);
    });
  });
}
