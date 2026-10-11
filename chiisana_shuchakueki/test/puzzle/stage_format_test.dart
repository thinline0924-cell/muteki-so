import 'package:chiisana_shuchakueki/puzzle/stage.dart';
import 'package:chiisana_shuchakueki/puzzle/tile.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, Object?> validStage() => {
  'id': '1-1',
  'world': 1,
  'number': 1,
  'name': 'テスト',
  'difficulty': 1,
  'size': {'width': 3, 'height': 2},
  'grid': ['S1 I0 G3', '.. ^  ..'],
  'stars': {'three': 1, 'two': 3},
  'reward': {'coins': 10, 'firstClearBonus': 20},
  'tutorial': 'rotate',
  'unlock': {'afterStage': null, 'minTotalStars': 0},
};

void expectProblem(Map<String, Object?> json, String fragment) {
  expect(
    () => StageDefinition.fromJson(json),
    throwsA(
      isA<StageFormatException>().having(
        (e) => e.problems.join('\n'),
        'problems',
        contains(fragment),
      ),
    ),
  );
}

void main() {
  test('正しいステージを読める', () {
    final s = StageDefinition.fromJson(validStage());
    expect(s.id, '1-1');
    expect(s.width, 3);
    expect(s.height, 2);
    expect(s.board.at(s.board.start!).kind, TileKind.start);
    expect(s.stars.three, 1);
    expect(s.reward.firstClearBonus, 20);
    expect(s.tutorial, 'rotate');
  });

  test('記号の読み書きが往復で一致する', () {
    for (final token in ['..', '#', '^', '~', 'S1', 'G3', 'I0', 'L2', 'T1', 'X0', 'L3!', 'I1!']) {
      expect(StageDefinition.tokenOf(StageDefinition.parseToken(token)!), token);
    }
    expect(StageDefinition.parseToken('L3!')!.fixed, isTrue);
    expect(StageDefinition.parseToken('Q1'), isNull);
    expect(StageDefinition.parseToken('L4'), isNull);
  });

  test('出発駅がないと検出する', () {
    expectProblem(validStage()..['grid'] = ['.. I0 G3', '.. ^  ..'], '出発駅');
  });

  test('目的地がないと検出する', () {
    expectProblem(validStage()..['grid'] = ['S1 I0 I1', '.. ^  ..'], '目的地');
  });

  test('駅が 2 つあると検出する', () {
    expectProblem(validStage()..['grid'] = ['S1 I0 G3', 'S0 ^  ..'], '出発駅');
  });

  test('駅が盤面の外を向いていると検出する', () {
    expectProblem(validStage()..['grid'] = ['S3 I0 G3', '.. ^  ..'], '外を向いて');
  });

  test('盤面の大きさと grid が合わないと検出する', () {
    expectProblem(validStage()..['grid'] = ['S1 I0 G3'], '行数');
    expectProblem(validStage()..['grid'] = ['S1 I0 G3 ..', '.. ^  .. ..'], 'マス数');
    expectProblem(validStage()..['size'] = {'width': 30, 'height': 2}, '大きさ');
  });

  test('読めない記号を検出する', () {
    expectProblem(validStage()..['grid'] = ['S1 Z9 G3', '.. ^  ..'], '読めません');
  });

  test('星の基準がおかしいと検出する', () {
    expectProblem(validStage()..['stars'] = {'three': 5, 'two': 2}, 'stars.two');
    expectProblem(validStage()..['stars'] = {'three': 0, 'two': 2}, 'stars.three');
    expectProblem(validStage()..remove('stars'), 'stars');
  });

  test('報酬がおかしいと検出する', () {
    expectProblem(validStage()..['reward'] = {'coins': -1, 'firstClearBonus': 0}, '報酬');
  });

  test('id や名前がないと検出する', () {
    expectProblem(validStage()..remove('id'), 'id');
    expectProblem(validStage()..['name'] = '', 'name');
  });

  test('ステージ集:こわれたステージは飛ばし、ほかは読む(クラッシュしない)', () {
    final pack = StagePack.fromJson({
      'world': 1,
      'name': 'テスト',
      'stages': [
        validStage(),
        'こわれたデータ',
        validStage(), // id 重複
        validStage()
          ..['id'] = '1-2'
          ..['grid'] = null,
        validStage()..['id'] = '1-3',
      ],
    });
    expect(pack.stages.map((s) => s.id), ['1-1', '1-3']);
    expect(pack.errors.length, 3);
  });

  test('ステージ集そのものがこわれていてもクラッシュしない', () {
    for (final bad in [
      null,
      3,
      'x',
      [],
      {'stages': 'x'},
    ]) {
      final pack = StagePack.fromJson(bad);
      expect(pack.stages, isEmpty);
      expect(pack.errors, isNotEmpty);
    }
  });
}
