import 'dart:convert';
import 'dart:io';

import 'package:chiisana_shuchakueki/game/catalog.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, Object?> raw() =>
    jsonDecode(File('assets/data/catalog.json').readAsStringSync()) as Map<String, Object?>;

void main() {
  final catalog = Catalog.fromJson(raw());

  test('同梱のカタログを読める', () {
    expect(catalog.items.length, greaterThanOrEqualTo(20));
    expect(catalog.items.map((i) => i.id).toSet().length, catalog.items.length);
  });

  test('指示書の初期候補(駅舎・家・商店・カフェ・花壇・街灯・ベンチ・木・池・時計台)がある', () {
    for (final id in [
      'station_wood',
      'house_small',
      'shop',
      'cafe',
      'flowerbed',
      'streetlamp',
      'bench',
      'tree',
      'pond',
      'clocktower',
    ]) {
      expect(catalog.item(id), isNotNull, reason: id);
    }
  });

  test('列車・駅舎・建物・装飾・住民がそろっている', () {
    for (final t in ItemType.values) {
      expect(catalog.ofType(t), isNotEmpty, reason: t.name);
    }
    expect(catalog.defaultOf(ItemType.train), isNotNull);
    expect(catalog.defaultOf(ItemType.station), isNotNull);
  });

  test('町に置けるものは値段と区画の大きさを持ち、区画も両方の大きさがある', () {
    for (final i in catalog.items.where((i) => i.type.placeable)) {
      expect(i.price, isNotNull, reason: i.id);
      expect(i.size, anyOf('large', 'small'), reason: i.id);
    }
    expect(catalog.slots.where((s) => s.size == 'large'), isNotEmpty);
    expect(catalog.slots.where((s) => s.size == 'small'), isNotEmpty);
    expect(catalog.slots.map((s) => s.id).toSet().length, catalog.slots.length);
  });

  test('住民の条件になる建物は、町に置けるもの', () {
    for (final i in catalog.items.where((i) => i.unlock.kind == UnlockKind.placed)) {
      expect(catalog.item(i.unlock.item!)!.type.placeable, isTrue, reason: i.id);
    }
  });

  test('ステージクリアが条件のアイテムは、実在するステージを指す', () {
    final ids = <String>{};
    final index = jsonDecode(File('assets/stages/index.json').readAsStringSync()) as Map;
    for (final name in index['packs'] as List) {
      final pack = jsonDecode(File('assets/stages/$name').readAsStringSync()) as Map;
      for (final s in pack['stages'] as List) {
        ids.add((s as Map)['id'] as String);
      }
    }
    for (final i in catalog.items.where((i) => i.unlock.kind == UnlockKind.clear)) {
      expect(ids, contains(i.unlock.stage), reason: i.id);
    }
  });

  test('こわれたカタログを検出する', () {
    Map<String, Object?> withItems(List<Object?> items) => raw()..['items'] = items;
    final good = (raw()['items'] as List).cast<Map<String, Object?>>();
    expect(() => Catalog.fromJson(null), throwsA(isA<CatalogFormatException>()));
    expect(
      () => Catalog.fromJson(withItems([...good, good.first])),
      throwsA(isA<CatalogFormatException>()),
      reason: 'id の重複',
    );
    expect(
      () => Catalog.fromJson(
        withItems([
          ...good,
          {...good.first, 'id': 'x', 'price': -5},
        ]),
      ),
      throwsA(isA<CatalogFormatException>()),
    );
    expect(
      () => Catalog.fromJson(
        withItems([
          ...good,
          {...good.first, 'id': 'y', 'size': 'huge'},
        ]),
      ),
      throwsA(isA<CatalogFormatException>()),
    );
    expect(
      () => Catalog.fromJson(
        withItems([
          ...good,
          {
            ...good.first,
            'id': 'z',
            'unlock': {'kind': 'placed', 'item': 'nothing'},
          },
        ]),
      ),
      throwsA(isA<CatalogFormatException>()),
    );
    expect(
      () => Catalog.fromJson(withItems(good.where((i) => i['type'] != 'train').toList())),
      throwsA(isA<CatalogFormatException>()),
      reason: '最初の列車がない',
    );
  });
}
