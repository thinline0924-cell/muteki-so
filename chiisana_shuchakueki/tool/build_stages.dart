// ステージ JSON を作り直す道具(開発用)。
//
//   dart run tool/build_stages.dart
//
// assets/stages/world_XX.json を上書きする。手作りのステージはここに
// 盤面を直接書き、ほかは stage_generator.dart で自動生成する。
// どのステージもソルバーで解けることを確かめ、最少手数から星の基準を決める。
import 'dart:convert';
import 'dart:io';

import 'package:chiisana_shuchakueki/puzzle/board.dart';
import 'package:chiisana_shuchakueki/puzzle/route.dart';
import 'package:chiisana_shuchakueki/puzzle/solver.dart';
import 'package:chiisana_shuchakueki/puzzle/stage.dart';

import 'stage_generator.dart';

class _Spec {
  const _Spec(this.name, {this.grid, this.gen, this.seed = 0, this.tutorial});
  final String name;
  final List<String>? grid;
  final GenParams? gen;
  final int seed;
  final String? tutorial;
}

class _World {
  const _World(this.number, this.name, this.unlockStars, this.specs);
  final int number;
  final String name;

  /// このワールドの最初のステージを開けるのに必要な合計の星
  final int unlockStars;
  final List<_Spec> specs;
}

final worlds = <_World>[
  _World(1, 'はじまりの町', 0, [
    const _Spec(
      'はじめての線路',
      tutorial: 'rotate',
      grid: [
        '^   ..  ..  ..  ^ ',
        '..  ..  ..  ..  ..',
        'S1  I1  I0  I1  G3',
        '..  ..  ..  ..  ..',
        '~   ..  ..  ^   ..',
      ],
    ),
    const _Spec(
      'まがり角',
      tutorial: 'curve',
      grid: [
        '^   ..  ..  ..  ^ ',
        '..  S2  ..  ..  ..',
        '..  L3  I1  L1  ..',
        '..  ..  ..  I0  ..',
        '~   ..  ..  G0  ..',
      ],
    ),
    const _Spec(
      'くねくね道',
      tutorial: 'stars',
      grid: [
        '^   ^   ..  ^   ..',
        'S1  L1  ..  L0  G3',
        '..  I0  ..  I0  ..',
        '..  L3  I1  L3  ..',
        '~   ~   ..  ..  ^ ',
      ],
    ),
    const _Spec(
      'えらべる道',
      seed: 104,
      gen: GenParams(minPath: 5, maxPath: 7, decoys: 3, obstacles: 4, minMoves: 3, maxMoves: 4),
    ),
    const _Spec(
      '森のそば',
      seed: 105,
      gen: GenParams(minPath: 6, maxPath: 8, decoys: 3, obstacles: 5, minMoves: 4, maxMoves: 5),
    ),
    const _Spec(
      '動かない線路',
      seed: 106,
      tutorial: 'fixed',
      gen: GenParams(
        minPath: 7,
        maxPath: 9,
        decoys: 4,
        obstacles: 3,
        fixedPath: 2,
        minMoves: 4,
        maxMoves: 6,
      ),
    ),
    const _Spec(
      '岩をよけて',
      seed: 107,
      tutorial: 'obstacle',
      gen: GenParams(
        minPath: 8,
        maxPath: 10,
        minTurns: 3,
        decoys: 3,
        obstacles: 6,
        minMoves: 4,
        maxMoves: 6,
      ),
    ),
    const _Spec(
      'とおまわり',
      seed: 108,
      gen: GenParams(
        minPath: 10,
        maxPath: 13,
        minTurns: 4,
        decoys: 2,
        obstacles: 6,
        fixedPath: 1,
        minMoves: 5,
        maxMoves: 7,
      ),
    ),
    const _Spec(
      'ちいさな工夫',
      seed: 109,
      gen: GenParams(
        minPath: 6,
        maxPath: 9,
        minTurns: 3,
        decoys: 9,
        obstacles: 1,
        minMoves: 4,
        maxMoves: 5,
      ),
    ),
    const _Spec(
      '終着駅へ',
      seed: 110,
      gen: GenParams(
        minPath: 9,
        maxPath: 12,
        minTurns: 4,
        decoys: 7,
        obstacles: 2,
        fixedPath: 1,
        minMoves: 5,
        maxMoves: 7,
      ),
    ),
  ]),
];

void main() {
  final used = <String>{};
  final packFiles = <String>[];
  for (final world in worlds) {
    final stages = <Map<String, Object?>>[];
    String? prevId;
    for (var i = 0; i < world.specs.length; i++) {
      final spec = world.specs[i];
      final number = i + 1;
      final id = '${world.number}-$number';
      Board board;
      if (spec.grid != null) {
        final parsed = StageDefinition.fromJson({
          'id': id,
          'world': 1,
          'number': 1,
          'name': 'x',
          'size': {
            'width': spec.grid![0].trim().split(RegExp(r'\s+')).length,
            'height': spec.grid!.length,
          },
          'grid': spec.grid,
          'stars': {'three': 1, 'two': 1},
          'reward': {'coins': 0, 'firstClearBonus': 0},
        });
        board = parsed.board;
      } else {
        final g = generate(spec.gen!, spec.seed, usedLayouts: used);
        if (g == null) {
          stderr.writeln('ステージ $id を生成できませんでした');
          exitCode = 1;
          return;
        }
        board = g.board;
      }
      if (!used.add(layoutSignature(board))) {
        stderr.writeln('ステージ $id の盤面が他と同じです');
        exitCode = 1;
        return;
      }
      if (RouteSimulator.run(board).isSuccess) {
        stderr.writeln('ステージ $id は最初から解けています');
        exitCode = 1;
        return;
      }
      final sol = Solver.solve(board);
      if (sol == null) {
        stderr.writeln('ステージ $id は解けません');
        exitCode = 1;
        return;
      }
      final min = sol.moves;
      final slack = (min / 2).ceil() < 2 ? 2 : (min / 2).ceil();
      final difficulty =
          (world.number - 1) * 2 +
          (number <= 3
              ? 1
              : number <= 7
              ? 2
              : 3);
      stages.add({
        'id': id,
        'world': world.number,
        'number': number,
        'name': spec.name,
        'difficulty': difficulty,
        'size': {'width': board.width, 'height': board.height},
        'grid': _gridRows(board),
        'stars': {'three': min, 'two': min + slack},
        'reward': {'coins': 10 + difficulty * 5, 'firstClearBonus': 20 + difficulty * 10},
        if (spec.tutorial != null) 'tutorial': spec.tutorial,
        'unlock': {'afterStage': prevId, 'minTotalStars': number == 1 ? world.unlockStars : 0},
      });
      stdout.writeln('$id ${spec.name}  最少 $min 手');
      for (final row in _gridRows(board)) {
        stdout.writeln('   $row');
      }
      prevId = id;
    }
    final file = File('assets/stages/world_${world.number.toString().padLeft(2, '0')}.json');
    const enc = JsonEncoder.withIndent('  ');
    file.writeAsStringSync(
      '${enc.convert({'world': world.number, 'name': world.name, 'stages': stages})}\n',
    );
    stdout.writeln('→ ${file.path}');
    packFiles.add(file.uri.pathSegments.last);
  }
  File('assets/stages/index.json')
      .writeAsStringSync('${const JsonEncoder.withIndent('  ').convert({'packs': packFiles})}\n');
}

List<String> _gridRows(Board b) => [
  for (var y = 0; y < b.height; y++)
    [for (var x = 0; x < b.width; x++) StageDefinition.tokenOf(b.at(Pos(x, y))).padRight(3)]
        .join(' ')
        .trimRight(),
];
