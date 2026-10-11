// 同梱しているすべてのステージを検査する。
// ここで失敗したステージは「正常なステージ」として扱わない。
import 'dart:convert';
import 'dart:io';

import 'package:chiisana_shuchakueki/puzzle/route.dart';
import 'package:chiisana_shuchakueki/puzzle/solver.dart';
import 'package:chiisana_shuchakueki/puzzle/stage.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final index = jsonDecode(File('assets/stages/index.json').readAsStringSync()) as Map;
  final packs = [
    for (final name in index['packs'] as List)
      StagePack.fromJson(jsonDecode(File('assets/stages/$name').readAsStringSync())),
  ];
  final stages = [for (final p in packs) ...p.stages];

  test('ステージ集を読めて、エラーがない', () {
    for (final p in packs) {
      expect(p.errors, isEmpty, reason: 'world ${p.world}');
    }
    expect(stages.length, greaterThanOrEqualTo(10));
  });

  test('id が重複していない', () {
    final ids = stages.map((s) => s.id).toList();
    expect(ids.toSet().length, ids.length);
  });

  test('開放条件が存在するステージを指している', () {
    final ids = stages.map((s) => s.id).toSet();
    for (final s in stages) {
      final after = s.unlock.afterStage;
      if (after != null) expect(ids, contains(after), reason: s.id);
    }
    expect(stages.first.unlock.afterStage, isNull, reason: '最初のステージは最初から遊べる');
  });

  test('同じ盤面を使い回していない', () {
    final layouts = <String>{};
    for (final s in stages) {
      final sig = s.board.tiles.map((t) => '${t.kind.index}').join();
      expect(layouts.add('${s.width}x${s.height}:$sig'), isTrue, reason: '${s.id} の配置が他と同じ');
    }
  });

  for (final s in stages) {
    group('ステージ ${s.id}「${s.name}」', () {
      test('最初から解けてはいない', () {
        expect(RouteSimulator.run(s.board).isSuccess, isFalse);
      });

      test('解き方が存在し、★3 の基準手数でクリアできる', () {
        final sol = Solver.solve(s.board);
        expect(sol, isNotNull, reason: '解けない');
        expect(RouteSimulator.run(sol!.apply(s.board)).isSuccess, isTrue);
        // ★3 の基準は最少手数ちょうど(きびしすぎず、ゆるすぎない)
        expect(s.stars.three, sol.moves);
        expect(s.stars.two, greaterThan(s.stars.three));
      });
    });
  }
}
