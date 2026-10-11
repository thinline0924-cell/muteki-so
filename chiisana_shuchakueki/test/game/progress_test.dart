import 'dart:convert';

import 'package:chiisana_shuchakueki/game/progress.dart';
import 'package:chiisana_shuchakueki/puzzle/stage.dart';
import 'package:flutter_test/flutter_test.dart';

StageDefinition stage(String id, {String? after, int minStars = 0}) => StageDefinition.fromJson({
  'id': id,
  'world': 1,
  'number': 1,
  'name': id,
  'size': {'width': 3, 'height': 2},
  'grid': ['S1 I0 G3', '.. .. ..'],
  'stars': {'three': 2, 'two': 4},
  'reward': {'coins': 10, 'firstClearBonus': 50},
  'unlock': {'afterStage': after, 'minTotalStars': minStars},
});

void main() {
  group('クリアの記録', () {
    test('初回クリアでボーナス、2 回目からは通常報酬だけ', () {
      final p = PlayerProgress();
      final first = p.recordClear(stage('a'), 2);
      expect(first.isFirstClear, isTrue);
      expect(first.stars, 3);
      expect(first.totalCoins, 60);
      expect(p.coins, 60);
      final second = p.recordClear(stage('a'), 2);
      expect(second.isFirstClear, isFalse);
      expect(second.totalCoins, 10);
      expect(p.coins, 70);
    });

    test('再挑戦で悪い結果でも、最高の星と最少手数は下がらない', () {
      final p = PlayerProgress();
      p.recordClear(stage('a'), 2); // ★3
      final worse = p.recordClear(stage('a'), 9); // ★1
      expect(worse.stars, 1);
      expect(worse.isNewBest, isFalse);
      expect(p.recordOf('a').bestStars, 3);
      expect(p.recordOf('a').bestMoves, 2);
      expect(p.totalStars, 3);
    });

    test('よい結果なら最高記録を更新する', () {
      final p = PlayerProgress();
      p.recordClear(stage('a'), 9);
      final better = p.recordClear(stage('a'), 3);
      expect(better.isNewBest, isTrue);
      expect(p.recordOf('a').bestStars, 2);
      expect(p.recordOf('a').bestMoves, 3);
    });
  });

  group('開放条件', () {
    test('前のステージをクリアすると開放', () {
      final p = PlayerProgress();
      final b = stage('b', after: 'a');
      expect(p.isUnlocked(stage('a')), isTrue);
      expect(p.isUnlocked(b), isFalse);
      p.recordClear(stage('a'), 9);
      expect(p.isUnlocked(b), isTrue);
    });

    test('合計の星が足りないと開放されない', () {
      final p = PlayerProgress();
      final c = stage('c', minStars: 3);
      p.recordClear(stage('a'), 9); // ★1
      expect(p.isUnlocked(c), isFalse);
      p.recordClear(stage('b'), 1); // ★3
      expect(p.isUnlocked(c), isTrue);
    });
  });

  group('コイン', () {
    test('足りないときは使えず、マイナスにならない', () {
      final p = PlayerProgress(coins: 100);
      expect(p.spendCoins(150), isFalse);
      expect(p.coins, 100);
      expect(p.spendCoins(-5), isFalse);
      expect(p.spendCoins(100), isTrue);
      expect(p.coins, 0);
    });

    test('上限を超えない', () {
      final p = PlayerProgress(coins: PlayerProgress.maxCoins);
      p.recordClear(stage('a'), 1);
      expect(p.coins, PlayerProgress.maxCoins);
      expect(PlayerProgress(coins: -50).coins, 0);
    });
  });

  group('セーブデータの形', () {
    test('JSON にして読み戻すと同じ内容', () {
      final p = PlayerProgress(coins: 120, unlockedItems: {'house_small'});
      p.recordClear(stage('a'), 3);
      p.placedBuildings['slot1'] = 'house_small';
      p.settings = p.settings.copyWith(vibration: false);
      final back = PlayerProgress.fromJson(jsonDecode(jsonEncode(p.toJson())));
      expect(back.coins, p.coins);
      expect(back.recordOf('a').bestStars, 2);
      expect(back.recordOf('a').bestMoves, 3);
      expect(back.lastPlayedStage, 'a');
      expect(back.unlockedItems, {'house_small'});
      expect(back.placedBuildings, {'slot1': 'house_small'});
      expect(back.settings.vibration, isFalse);
      expect(p.toJson()['version'], PlayerProgress.saveVersion);
    });

    test('欠けた・おかしな値でもクラッシュせず安全な値になる', () {
      for (final bad in [
        null,
        'x',
        42,
        <String, Object?>{},
        {'coins': 'many', 'records': 'x', 'settings': 5},
        {
          'coins': -10,
          'records': {
            'a': {'cleared': true, 'bestStars': 99, 'bestMoves': -3},
            'b': 'x',
          },
          'unlockedItems': [1, 'tree', null],
          'placedBuildings': {'s': 3, 't': 'bench'},
          'settings': {'bgmVolume': 7, 'seVolume': 'loud', 'vibration': 'yes'},
        },
      ]) {
        final p = PlayerProgress.fromJson(bad);
        expect(p.coins, greaterThanOrEqualTo(0));
        for (final r in p.records.values) {
          expect(r.bestStars, inInclusiveRange(0, 3));
          expect(r.bestMoves == null || r.bestMoves! >= 0, isTrue);
        }
        expect(p.settings.bgmVolume, inInclusiveRange(0, 1));
      }
      final p = PlayerProgress.fromJson({
        'records': {
          'a': {'cleared': true, 'bestStars': 99, 'bestMoves': -3},
        },
        'unlockedItems': [1, 'tree', null],
        'placedBuildings': {'s': 3, 't': 'bench'},
      });
      expect(p.recordOf('a').bestStars, 3);
      expect(p.recordOf('a').bestMoves, isNull);
      expect(p.unlockedItems, {'tree'});
      expect(p.placedBuildings, {'t': 'bench'});
    });
  });
}
