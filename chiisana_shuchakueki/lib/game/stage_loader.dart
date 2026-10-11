import 'dart:convert';

import 'package:flutter/services.dart';

import '../puzzle/stage.dart';

/// 読みこんだステージと、読めなかった理由。
class LoadedStages {
  const LoadedStages(this.packs, this.errors);

  final List<StagePack> packs;
  final List<String> errors;

  List<StageDefinition> get stages => [for (final p in packs) ...p.stages];
}

/// assets/stages/ からステージを読む。こわれたデータがあっても止まらない。
Future<LoadedStages> loadStages(AssetBundle bundle) async {
  final errors = <String>[];
  final packs = <StagePack>[];
  List<Object?> packNames;
  try {
    final index = jsonDecode(await bundle.loadString('assets/stages/index.json'));
    packNames = index is Map && index['packs'] is List ? index['packs'] as List : [];
  } catch (e) {
    return LoadedStages(const [], ['ステージの一覧を読めませんでした: $e']);
  }
  for (final name in packNames) {
    if (name is! String) continue;
    try {
      final pack = StagePack.fromJson(jsonDecode(await bundle.loadString('assets/stages/$name')));
      packs.add(pack);
      errors.addAll(pack.errors.map((e) => '$name: $e'));
    } catch (e) {
      errors.add('$name を読めませんでした: $e');
    }
  }
  packs.sort((a, b) => a.world.compareTo(b.world));
  return LoadedStages(packs, errors);
}
