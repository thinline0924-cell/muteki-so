// アプリで使っている文字が、同梱フォント(文字を絞ったもの)にすべて入っているか。
// 失敗したら `python3 tool/fonts/subset_fonts.py` でフォントを作り直す。
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('使っている文字がすべてフォントに入っている', () {
    final charset = File('assets/fonts/charset.txt').readAsStringSync().runes.toSet();
    final missing = <String>{};
    for (final (dir, ext) in const [('lib', '.dart'), ('assets', '.json')]) {
      for (final f in Directory(dir).listSync(recursive: true).whereType<File>()) {
        if (!f.path.endsWith(ext)) continue;
        for (final r in f.readAsStringSync().runes) {
          if (r >= 0x80 && !charset.contains(r)) missing.add(String.fromCharCode(r));
        }
      }
    }
    expect(missing, isEmpty, reason: 'フォントにない文字: ${missing.join()}');
  });
}
