// 画面で使う絵のファイルが、すべてそろっているか。
// 足りなければ `NODE_PATH=$(npm root -g) node tool/art/build.cjs` で作り直す。
import 'dart:convert';
import 'dart:io';

import 'package:chiisana_shuchakueki/game/catalog.dart';
import 'package:chiisana_shuchakueki/ui/art.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final catalog = Catalog.fromJson(jsonDecode(File('assets/data/catalog.json').readAsStringSync()));

  void exists(String path) => expect(File(path).existsSync(), isTrue, reason: '$path がありません');

  test('盤面の絵', () {
    for (final n in [
      'grass_a',
      'grass_b',
      'plate',
      'plate_fixed',
      'track_straight',
      'track_curve',
      'track_tee',
      'track_cross',
      'station_start',
      'station_goal',
      'tree',
      'rock',
      'pond',
      'wood',
      'flowers_1',
      'flowers_2',
      'flowers_3',
      'flowers_4',
    ]) {
      exists(Art.board(n));
    }
  });

  test('すべてのアイテムに絵がある。列車は盤面用の絵もある', () {
    for (final i in catalog.items) {
      exists(Art.item(i.id));
      if (i.type == ItemType.train) {
        exists(Art.trainTop(i.id, loco: true));
        exists(Art.trainTop(i.id, loco: false));
      }
    }
  });

  test('画面の絵', () {
    exists(Art.town('background.jpg'));
    exists(Art.ui('title.jpg'));
    for (var w = 1; w <= 5; w++) {
      exists(Art.ui('world_$w.jpg'));
    }
    for (final n in [
      'star',
      'star_off',
      'coin',
      'lock',
      'gift',
      'hand',
      'ribbon',
      'rays',
      'paper',
      'navy',
    ]) {
      exists(Art.ui(n));
    }
  });
}
