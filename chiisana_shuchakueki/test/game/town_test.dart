import 'dart:convert';
import 'dart:io';

import 'package:chiisana_shuchakueki/game/catalog.dart';
import 'package:chiisana_shuchakueki/game/progress.dart';
import 'package:chiisana_shuchakueki/game/town.dart';
import 'package:chiisana_shuchakueki/puzzle/stage.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final catalog = Catalog.fromJson(jsonDecode(File('assets/data/catalog.json').readAsStringSync()));
  final house = catalog.item('house_small')!;
  final large = catalog.slots.firstWhere((s) => s.size == 'large');
  final small = catalog.slots.firstWhere((s) => s.size == 'small');

  PlayerProgress fresh({int coins = 0}) {
    final p = PlayerProgress(coins: coins);
    TownRules.sanitize(catalog, p);
    return p;
  }

  group('最初の状態', () {
    test('最初の列車・駅舎・駅長さんを持っている', () {
      final p = fresh();
      expect(
        p.unlockedItems,
        containsAll(['train_hidamari', 'station_wood', 'resident_stationmaster']),
      );
      expect(TownRules.selectedTrain(catalog, p).id, 'train_hidamari');
      expect(TownRules.selectedStation(catalog, p).id, 'station_wood');
    });
  });

  group('お店', () {
    test('コインで買える。コインは値段の分だけ減る', () {
      final p = fresh(coins: 1000);
      expect(TownRules.buy(catalog, p, 'house_small'), BuyResult.ok);
      expect(p.coins, 1000 - house.price!);
      expect(TownRules.owns(p, 'house_small'), isTrue);
    });

    test('コインが足りないと買えず、コインも変わらない', () {
      final p = fresh(coins: house.price! - 1);
      expect(TownRules.buy(catalog, p, 'house_small'), BuyResult.notEnoughCoins);
      expect(p.coins, house.price! - 1);
      expect(TownRules.owns(p, 'house_small'), isFalse);
    });

    test('2 回は買えない(二重に払わない)', () {
      final p = fresh(coins: 1000);
      TownRules.buy(catalog, p, 'house_small');
      final after = p.coins;
      expect(TownRules.buy(catalog, p, 'house_small'), BuyResult.alreadyOwned);
      expect(p.coins, after);
    });

    test('売り物でないもの・ないものは買えない', () {
      final p = fresh(coins: 99999);
      expect(TownRules.buy(catalog, p, 'train_sakura'), BuyResult.notForSale);
      expect(TownRules.buy(catalog, p, 'nothing'), BuyResult.unknownItem);
      expect(p.coins, 99999);
    });
  });

  group('置く・片づける', () {
    test('持っている建物を大きな区画に置ける', () {
      final p = fresh(coins: 1000);
      TownRules.buy(catalog, p, 'house_small');
      expect(TownRules.place(catalog, p, large.id, 'house_small'), PlaceResult.ok);
      expect(p.placedBuildings[large.id], 'house_small');
    });

    test('持っていない・大きさがちがう・置けないものは置けない', () {
      final p = fresh(coins: 1000);
      expect(TownRules.place(catalog, p, large.id, 'house_small'), PlaceResult.notOwned);
      TownRules.buy(catalog, p, 'house_small');
      expect(TownRules.place(catalog, p, small.id, 'house_small'), PlaceResult.wrongSize);
      expect(TownRules.place(catalog, p, large.id, 'train_hidamari'), PlaceResult.notPlaceable);
      expect(TownRules.place(catalog, p, 'nowhere', 'house_small'), PlaceResult.unknownSlot);
      expect(p.placedBuildings, isEmpty);
    });

    test('片づけてもアイテムはなくならず、コインも戻らない(増えない)', () {
      final p = fresh(coins: 1000);
      TownRules.buy(catalog, p, 'house_small');
      TownRules.place(catalog, p, large.id, 'house_small');
      final coins = p.coins;
      expect(TownRules.remove(p, large.id), isTrue);
      expect(TownRules.remove(p, large.id), isFalse);
      expect(TownRules.owns(p, 'house_small'), isTrue);
      expect(p.coins, coins);
    });

    test('同じものをいくつも置ける・置き換えられる', () {
      final p = fresh(coins: 1000);
      TownRules.buy(catalog, p, 'tree');
      TownRules.buy(catalog, p, 'bench');
      final smalls = catalog.slots.where((s) => s.size == 'small').toList();
      TownRules.place(catalog, p, smalls[0].id, 'tree');
      TownRules.place(catalog, p, smalls[1].id, 'tree');
      TownRules.place(catalog, p, smalls[0].id, 'bench');
      expect(p.placedBuildings, {smalls[0].id: 'bench', smalls[1].id: 'tree'});
    });
  });

  group('獲得条件', () {
    test('建物を置くと住民がやってくる(1 回だけ知らせる)', () {
      final p = fresh(coins: 1000);
      TownRules.buy(catalog, p, 'bakery');
      TownRules.place(catalog, p, large.id, 'bakery');
      final added = TownRules.refreshUnlocks(catalog, p);
      expect(added.map((i) => i.id), contains('resident_baker'));
      expect(TownRules.refreshUnlocks(catalog, p), isEmpty);
      // 片づけても住民はいなくならない
      TownRules.remove(p, large.id);
      TownRules.refreshUnlocks(catalog, p);
      expect(TownRules.owns(p, 'resident_baker'), isTrue);
    });

    test('星を集めると列車が手に入る', () {
      final p = fresh();
      final need = catalog.item('train_sakura')!.unlock.value;
      for (var i = 0; i < need; i++) {
        p.records['s$i'] = const StageRecord(cleared: true, bestStars: 1);
      }
      expect(TownRules.refreshUnlocks(catalog, p).map((i) => i.id), contains('train_sakura'));
    });

    test('ステージクリアで列車が手に入る', () {
      final p = fresh();
      p.records['2-10'] = const StageRecord(cleared: true, bestStars: 1);
      expect(TownRules.refreshUnlocks(catalog, p).map((i) => i.id), contains('train_midori'));
    });

    test('町に置いた数で駅舎が手に入る', () {
      final p = fresh(coins: 99999);
      TownRules.buy(catalog, p, 'tree');
      final smalls = catalog.slots.where((s) => s.size == 'small').toList();
      final need = catalog.item('station_brick')!.unlock.value;
      for (var i = 0; i < need; i++) {
        TownRules.place(catalog, p, smalls[i].id, 'tree');
      }
      expect(TownRules.refreshUnlocks(catalog, p).map((i) => i.id), contains('station_brick'));
    });
  });

  group('列車・駅舎を選ぶ', () {
    test('持っているものだけ選べる', () {
      final p = fresh();
      expect(TownRules.select(catalog, p, 'train_sakura'), isFalse);
      p.unlockedItems.add('train_sakura');
      expect(TownRules.select(catalog, p, 'train_sakura'), isTrue);
      expect(TownRules.selectedTrain(catalog, p).id, 'train_sakura');
      expect(TownRules.select(catalog, p, 'house_small'), isFalse);
    });
  });

  test('こわれたセーブデータを整える(ない区画・持っていない建物・おかしな選択を取りのぞく)', () {
    final p =
        PlayerProgress(
            placedBuildings: {'nowhere': 'tree', large.id: 'house_small', small.id: 'clocktower'},
            unlockedItems: {'ghost_item', 'clocktower'},
            seenItems: {'ghost_item'},
          )
          ..selectedTrain = 'house_small'
          ..selectedStation = 'station_white';
    TownRules.sanitize(catalog, p);
    expect(p.placedBuildings, isEmpty, reason: 'ない区画/持っていない/大きさちがい');
    expect(p.unlockedItems, isNot(contains('ghost_item')));
    expect(p.seenItems, isEmpty);
    expect(p.selectedTrain, isNull);
    expect(p.selectedStation, isNull);
    expect(TownRules.selectedTrain(catalog, p).id, 'train_hidamari');
  });

  test('全ステージの初回クリア報酬で、お店の品をすべて買える(お金のバランス)', () {
    final index = jsonDecode(File('assets/stages/index.json').readAsStringSync()) as Map;
    var coins = 0;
    for (final name in index['packs'] as List) {
      final pack = StagePack.fromJson(jsonDecode(File('assets/stages/$name').readAsStringSync()));
      for (final s in pack.stages) {
        coins += s.reward.coins + s.reward.firstClearBonus;
      }
    }
    final total = catalog.items.fold<int>(0, (sum, i) => sum + (i.price ?? 0));
    expect(coins, greaterThanOrEqualTo(total));
    // ワールド 1 だけで、最初の建物が買える
    expect(house.price, lessThanOrEqualTo(300));
  });

  test('発展のようすの名前', () {
    expect(TownRules.developmentTitle(0), 'さびしい駅前');
    expect(TownRules.developmentTitle(14), 'ちいさな終着駅の町');
  });
}
