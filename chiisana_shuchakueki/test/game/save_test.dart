import 'dart:convert';

import 'package:chiisana_shuchakueki/game/game_controller.dart';
import 'package:chiisana_shuchakueki/game/progress.dart';
import 'package:chiisana_shuchakueki/game/progress_store.dart';
import 'package:chiisana_shuchakueki/game/town.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<GameController> boot(ProgressStore store) =>
      GameController.load(bundle: rootBundle, store: store);

  test('クリア・購入・配置が保存され、再起動しても戻る', () async {
    final store = MemoryProgressStore();
    final a = await boot(store);
    for (final st in a.stages.take(3)) {
      a.recordClear(st, st.stars.three);
    }
    final coinsBefore = a.progress.coins;
    expect(a.buy('tree'), BuyResult.ok);
    a.place('spot1', 'tree');
    a.select('train_hidamari');
    a.markTutorialSeen('rotate');
    await a.save();
    expect(store.saveCount, greaterThan(0));

    // アプリを閉じて開き直したつもり
    final b = await boot(store);
    expect(b.progress.isCleared(a.stages.first.id), isTrue);
    expect(b.progress.recordOf(a.stages.first.id).bestStars, 3);
    expect(b.progress.coins, coinsBefore - b.catalog.item('tree')!.price!);
    expect(b.progress.placedBuildings['spot1'], 'tree');
    expect(b.tutorialSeen('rotate'), isTrue);
    expect(b.continueStage!.id, b.stages[3].id);
  });

  test('こわれたセーブデータでも起動できる(最初から)', () async {
    for (final broken in ['{not json', '[]', '"text"', '{"coins": "x", "records": 5}']) {
      final g = await boot(MemoryProgressStore(broken));
      expect(g.progress.coins, 0, reason: broken);
      expect(g.owns('train_hidamari'), isTrue);
      expect(g.continueStage!.id, '1-1');
    }
  });

  test('古い形(版番号なし・新しい項目なし)のセーブデータを読める', () async {
    final old = jsonEncode({
      'records': {
        '1-1': {'cleared': true, 'bestStars': 2, 'bestMoves': 3},
      },
      'coins': 45,
    });
    final g = await boot(MemoryProgressStore(old));
    expect(g.progress.coins, 45);
    expect(g.progress.recordOf('1-1').bestStars, 2);
    expect(g.progress.selectedTrain, isNull);
    expect(g.train.id, 'train_hidamari');
  });

  test('データを消すと最初からになり、設定は残る', () async {
    final store = MemoryProgressStore();
    final g = await boot(store);
    g.recordClear(g.stages.first, 1);
    g.updateSettings(g.progress.settings.copyWith(vibration: false));
    await g.resetProgress();
    expect(g.progress.coins, 0);
    expect(g.progress.records, isEmpty);
    expect(g.progress.settings.vibration, isFalse);
    expect(g.owns('train_hidamari'), isTrue);
    final again = await boot(store);
    expect(again.progress.records, isEmpty);
  });

  group('端末への保存(SharedPreferences)', () {
    test('保存して読み戻せる', () async {
      SharedPreferences.setMockInitialValues({});
      final store = PrefsProgressStore();
      final p = PlayerProgress(coins: 77)..unlockedItems.add('tree');
      await store.save(p);
      final back = await store.load();
      expect(back.coins, 77);
      expect(back.unlockedItems, contains('tree'));
    });

    test('読めないデータは退避して、最初から始める', () async {
      SharedPreferences.setMockInitialValues({PrefsProgressStore.key: '{broken'});
      final back = await PrefsProgressStore().load();
      expect(back.coins, 0);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(PrefsProgressStore.brokenKey), '{broken');
    });

    test('データを消せる', () async {
      SharedPreferences.setMockInitialValues({});
      final store = PrefsProgressStore();
      await store.save(PlayerProgress(coins: 5));
      await store.clear();
      expect((await store.load()).coins, 0);
    });
  });
}
