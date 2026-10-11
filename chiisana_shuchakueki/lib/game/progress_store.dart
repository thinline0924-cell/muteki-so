import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'progress.dart';

/// 進行状況の保存先。
abstract class ProgressStore {
  Future<PlayerProgress> load();
  Future<void> save(PlayerProgress progress);

  /// セーブデータを消す(設定画面の「データを消す」)
  Future<void> clear();
}

/// メモリ上だけに保存する(テスト用)。
class MemoryProgressStore implements ProgressStore {
  MemoryProgressStore([this.saved]);

  /// 保存された JSON 文字列
  String? saved;
  int saveCount = 0;

  @override
  Future<PlayerProgress> load() async => decodeProgress(saved);

  @override
  Future<void> save(PlayerProgress progress) async {
    saved = jsonEncode(progress.toJson());
    saveCount++;
  }

  @override
  Future<void> clear() async => saved = null;
}

/// 端末に保存する(SharedPreferences:端末の中に小さなデータを置くしくみ)。
class PrefsProgressStore implements ProgressStore {
  static const key = 'progress';
  static const brokenKey = 'progress_broken';

  @override
  Future<PlayerProgress> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(key);
      if (raw == null) return PlayerProgress();
      try {
        return PlayerProgress.fromJson(jsonDecode(raw));
      } on FormatException {
        // 読めないデータは消さずに別の場所へ退避して、最初から始める
        await prefs.setString(brokenKey, raw);
        return PlayerProgress();
      }
    } catch (e) {
      debugPrint('セーブデータを読めませんでした: $e');
      return PlayerProgress();
    }
  }

  @override
  Future<void> save(PlayerProgress progress) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, jsonEncode(progress.toJson()));
    } catch (e) {
      debugPrint('セーブできませんでした: $e');
    }
  }

  @override
  Future<void> clear() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(key);
    } catch (e) {
      debugPrint('セーブデータを消せませんでした: $e');
    }
  }
}

/// JSON 文字列から読む。null・こわれた文字列なら新しい進行状況。
PlayerProgress decodeProgress(String? raw) {
  if (raw == null) return PlayerProgress();
  try {
    return PlayerProgress.fromJson(jsonDecode(raw));
  } on FormatException {
    return PlayerProgress();
  }
}
