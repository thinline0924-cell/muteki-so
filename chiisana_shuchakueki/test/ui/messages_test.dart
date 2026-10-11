import 'dart:convert';
import 'dart:io';

import 'package:chiisana_shuchakueki/puzzle/route.dart';
import 'package:chiisana_shuchakueki/ui/messages.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('ステージが使うチュートリアルには、すべて説明文がある', () {
    final index = jsonDecode(File('assets/stages/index.json').readAsStringSync()) as Map;
    for (final name in index['packs'] as List) {
      final pack = jsonDecode(File('assets/stages/$name').readAsStringSync()) as Map;
      for (final s in (pack['stages'] as List).cast<Map>()) {
        final t = s['tutorial'];
        if (t != null) expect(tutorialMessage(t as String), isNotNull, reason: '${s['id']}: $t');
      }
    }
  });

  test('失敗の種類ごとに説明がある', () {
    for (final o in RouteOutcome.values) {
      expect(failureMessage(o), isNotEmpty);
    }
  });
}
