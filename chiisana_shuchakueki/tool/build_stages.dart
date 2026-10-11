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
  _World(2, '海辺の通り', 15, [
    const _Spec(
      'しおかぜ',
      seed: 201,
      gen: GenParams(
        width: 5,
        height: 5,
        minPath: 7,
        maxPath: 9,
        decoys: 5,
        obstacles: 3,
        minMoves: 4,
        maxMoves: 6,
      ),
    ),
    const _Spec(
      '灯台の見える道',
      seed: 202,
      gen: GenParams(
        width: 5,
        height: 5,
        minPath: 8,
        maxPath: 10,
        decoys: 5,
        obstacles: 3,
        fixedPath: 1,
        minMoves: 5,
        maxMoves: 7,
      ),
    ),
    const _Spec(
      '貝がらの浜',
      seed: 203,
      gen: GenParams(
        width: 5,
        height: 5,
        minPath: 9,
        maxPath: 12,
        decoys: 6,
        obstacles: 2,
        minMoves: 5,
        maxMoves: 7,
      ),
    ),
    const _Spec(
      '港の倉庫',
      seed: 204,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 9,
        maxPath: 12,
        decoys: 6,
        obstacles: 6,
        minMoves: 5,
        maxMoves: 7,
      ),
    ),
    const _Spec(
      'かもめ通り',
      seed: 205,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 10,
        maxPath: 13,
        decoys: 7,
        obstacles: 5,
        fixedPath: 1,
        minMoves: 6,
        maxMoves: 8,
      ),
    ),
    const _Spec(
      '防波堤',
      seed: 206,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 11,
        maxPath: 14,
        decoys: 6,
        obstacles: 7,
        minTurns: 4,
        minMoves: 6,
        maxMoves: 8,
      ),
    ),
    const _Spec(
      '夕なぎ',
      seed: 207,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 10,
        maxPath: 14,
        decoys: 9,
        obstacles: 4,
        fixedPath: 2,
        minMoves: 6,
        maxMoves: 8,
      ),
    ),
    const _Spec(
      '漁師町',
      seed: 208,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 12,
        maxPath: 15,
        decoys: 8,
        obstacles: 5,
        minTurns: 4,
        minMoves: 7,
        maxMoves: 9,
      ),
    ),
    const _Spec(
      '波のリズム',
      seed: 209,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 10,
        maxPath: 13,
        decoys: 12,
        obstacles: 2,
        minMoves: 6,
        maxMoves: 8,
      ),
    ),
    const _Spec(
      '岬の駅',
      seed: 210,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 13,
        maxPath: 17,
        decoys: 8,
        obstacles: 4,
        fixedPath: 2,
        minTurns: 5,
        minMoves: 7,
        maxMoves: 10,
      ),
    ),
  ]),
  _World(3, '丘の上の町', 35, [
    const _Spec(
      '立体交差',
      seed: 301,
      tutorial: 'cross',
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 8,
        maxPath: 12,
        crossings: 1,
        decoys: 3,
        obstacles: 6,
        minMoves: 4,
        maxMoves: 6,
      ),
    ),
    const _Spec(
      '坂道',
      seed: 302,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 10,
        maxPath: 14,
        crossings: 1,
        decoys: 5,
        obstacles: 5,
        minMoves: 5,
        maxMoves: 7,
      ),
    ),
    const _Spec(
      'ぶどう畑',
      seed: 303,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 10,
        maxPath: 14,
        crossings: 1,
        decoys: 7,
        obstacles: 4,
        fixedPath: 1,
        minMoves: 6,
        maxMoves: 8,
      ),
    ),
    const _Spec(
      '風車小屋',
      seed: 304,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 12,
        maxPath: 16,
        crossings: 1,
        decoys: 6,
        obstacles: 4,
        minMoves: 6,
        maxMoves: 9,
      ),
    ),
    const _Spec(
      '見晴らし台',
      seed: 305,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 12,
        maxPath: 16,
        crossings: 2,
        decoys: 5,
        obstacles: 4,
        minMoves: 6,
        maxMoves: 9,
      ),
    ),
    const _Spec(
      '十字路の町',
      seed: 306,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 12,
        maxPath: 16,
        crossings: 2,
        decoys: 7,
        obstacles: 3,
        fixedPath: 1,
        minMoves: 7,
        maxMoves: 9,
      ),
    ),
    const _Spec(
      '牧場',
      seed: 307,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 13,
        maxPath: 18,
        crossings: 1,
        decoys: 8,
        obstacles: 3,
        minMoves: 7,
        maxMoves: 10,
      ),
    ),
    const _Spec(
      'ふたつの橋',
      seed: 308,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 13,
        maxPath: 18,
        crossings: 2,
        decoys: 8,
        obstacles: 2,
        fixedPath: 2,
        minMoves: 7,
        maxMoves: 10,
      ),
    ),
    const _Spec(
      '丘のトンネル',
      seed: 309,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 12,
        maxPath: 16,
        crossings: 1,
        decoys: 12,
        obstacles: 1,
        minMoves: 7,
        maxMoves: 10,
      ),
    ),
    const _Spec(
      '星見の丘',
      seed: 310,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 15,
        maxPath: 20,
        crossings: 2,
        decoys: 8,
        obstacles: 2,
        fixedPath: 2,
        minMoves: 8,
        maxMoves: 11,
      ),
    ),
  ]),
  _World(4, 'にぎやかな駅前', 55, [
    const _Spec(
      'T字の分かれ道',
      seed: 401,
      tutorial: 'tee',
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 7,
        maxPath: 10,
        pathTees: 1,
        decoys: 3,
        obstacles: 5,
        minMoves: 4,
        maxMoves: 6,
      ),
    ),
    const _Spec(
      '商店街',
      seed: 402,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 9,
        maxPath: 12,
        pathTees: 1,
        decoys: 5,
        obstacles: 4,
        minMoves: 5,
        maxMoves: 7,
      ),
    ),
    const _Spec(
      '市場',
      seed: 403,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 9,
        maxPath: 12,
        pathTees: 2,
        decoys: 5,
        decoyTees: true,
        obstacles: 4,
        minMoves: 6,
        maxMoves: 8,
      ),
    ),
    const _Spec(
      'ポイント切替',
      seed: 404,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 10,
        maxPath: 14,
        pathTees: 2,
        decoys: 6,
        decoyTees: true,
        obstacles: 3,
        fixedPath: 1,
        minMoves: 6,
        maxMoves: 9,
      ),
    ),
    const _Spec(
      'パン屋の角',
      seed: 405,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 11,
        maxPath: 14,
        pathTees: 2,
        crossings: 1,
        decoys: 6,
        obstacles: 3,
        minMoves: 7,
        maxMoves: 9,
      ),
    ),
    const _Spec(
      '噴水広場',
      seed: 406,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 12,
        maxPath: 15,
        pathTees: 2,
        decoys: 8,
        decoyTees: true,
        obstacles: 2,
        minMoves: 7,
        maxMoves: 10,
      ),
    ),
    const _Spec(
      '時計台',
      seed: 407,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 12,
        maxPath: 16,
        pathTees: 3,
        decoys: 7,
        decoyTees: true,
        obstacles: 3,
        fixedPath: 1,
        minMoves: 7,
        maxMoves: 10,
      ),
    ),
    const _Spec(
      '夜店',
      seed: 408,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 12,
        maxPath: 16,
        pathTees: 2,
        crossings: 1,
        decoys: 8,
        obstacles: 2,
        minMoves: 8,
        maxMoves: 11,
      ),
    ),
    const _Spec(
      '乗りかえ駅',
      seed: 409,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 11,
        maxPath: 15,
        pathTees: 3,
        decoys: 11,
        decoyTees: true,
        obstacles: 1,
        minMoves: 8,
        maxMoves: 11,
      ),
    ),
    const _Spec(
      '駅前大通り',
      seed: 410,
      gen: GenParams(
        width: 6,
        height: 6,
        minPath: 14,
        maxPath: 19,
        pathTees: 3,
        crossings: 1,
        decoys: 8,
        decoyTees: true,
        obstacles: 2,
        fixedPath: 2,
        minMoves: 9,
        maxMoves: 12,
      ),
    ),
  ]),
  _World(5, '終着駅の町', 75, [
    const _Spec(
      '大きな町',
      seed: 501,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 12,
        maxPath: 16,
        decoys: 8,
        obstacles: 8,
        minMoves: 7,
        maxMoves: 9,
      ),
    ),
    const _Spec(
      '線路の迷路',
      seed: 502,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 14,
        maxPath: 18,
        decoys: 12,
        obstacles: 4,
        fixedPath: 1,
        minMoves: 8,
        maxMoves: 10,
      ),
    ),
    const _Spec(
      '雪の朝',
      seed: 503,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 14,
        maxPath: 19,
        crossings: 1,
        decoys: 10,
        obstacles: 5,
        minMoves: 8,
        maxMoves: 11,
      ),
    ),
    const _Spec(
      '森の向こう',
      seed: 504,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 15,
        maxPath: 20,
        pathTees: 2,
        decoys: 10,
        decoyTees: true,
        obstacles: 5,
        minMoves: 9,
        maxMoves: 12,
      ),
    ),
    const _Spec(
      '湖のほとり',
      seed: 505,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 16,
        maxPath: 21,
        crossings: 1,
        pathTees: 1,
        decoys: 10,
        obstacles: 6,
        fixedPath: 2,
        minMoves: 9,
        maxMoves: 12,
      ),
    ),
    const _Spec(
      '鉄橋',
      seed: 506,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 17,
        maxPath: 22,
        crossings: 2,
        decoys: 10,
        obstacles: 4,
        minMoves: 10,
        maxMoves: 13,
      ),
    ),
    const _Spec(
      '夜行列車',
      seed: 507,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 16,
        maxPath: 22,
        pathTees: 2,
        crossings: 1,
        decoys: 12,
        decoyTees: true,
        obstacles: 3,
        fixedPath: 2,
        minMoves: 10,
        maxMoves: 13,
      ),
    ),
    const _Spec(
      'ふたたびの春',
      seed: 508,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 18,
        maxPath: 24,
        crossings: 2,
        pathTees: 1,
        decoys: 10,
        obstacles: 4,
        minMoves: 11,
        maxMoves: 14,
      ),
    ),
    const _Spec(
      '最後の分岐',
      seed: 509,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 16,
        maxPath: 22,
        pathTees: 3,
        decoys: 16,
        decoyTees: true,
        obstacles: 2,
        minMoves: 11,
        maxMoves: 14,
      ),
    ),
    const _Spec(
      'ちいさな終着駅',
      seed: 510,
      gen: GenParams(
        width: 7,
        height: 7,
        minPath: 20,
        maxPath: 26,
        crossings: 2,
        pathTees: 2,
        decoys: 12,
        decoyTees: true,
        obstacles: 2,
        fixedPath: 3,
        minMoves: 12,
        maxMoves: 16,
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
