import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';

/// 効果音の種類(assets/sounds/ の同じ名前の wav。tool/build_sounds.dart で合成)
enum Sfx { tap, button, depart, arrive, fail, coin, buy, unlock, star }

/// 音を鳴らす窓口。音が出せない環境(テストなど)では何もしない実装を使う。
abstract class SoundService {
  void play(Sfx sfx);

  /// BGM を流す(すでに流れていれば何もしない)
  void startBgm();
  void stopBgm();

  /// 音量(0〜1)
  void setVolumes({required double bgm, required double se});

  /// アプリがバックグラウンドへ/から戻ったとき
  void onPause();
  void onResume();

  void dispose();
}

class SilentSound implements SoundService {
  @override
  void play(Sfx sfx) {}
  @override
  void startBgm() {}
  @override
  void stopBgm() {}
  @override
  void setVolumes({required double bgm, required double se}) {}
  @override
  void onPause() {}
  @override
  void onResume() {}
  @override
  void dispose() {}
}

/// audioplayers で鳴らす実装。失敗しても例外を外へ出さない(ゲームは止めない)。
class AudioSoundService implements SoundService {
  AudioSoundService() {
    _guard(
      () => AudioPlayer.global.setAudioContext(
        AudioContext(
          // ほかのアプリの音楽を止めない・消音スイッチに従う
          android: const AudioContextAndroid(
            usageType: AndroidUsageType.game,
            contentType: AndroidContentType.sonification,
            audioFocus: AndroidAudioFocus.none,
          ),
          iOS: AudioContextIOS(category: AVAudioSessionCategory.ambient),
        ),
      ),
    );
  }

  final Map<Sfx, List<AudioPlayer>> _pools = {};
  final Map<Sfx, int> _next = {};
  AudioPlayer? _bgm;
  bool _bgmWanted = false;
  bool _paused = false;
  double _bgmVolume = 0.6;
  double _seVolume = 0.8;

  static const _bgmScale = 0.45; // BGM は効果音より控えめに

  @override
  void play(Sfx sfx) {
    if (_seVolume <= 0 || _paused) return;
    final pool = _pools.putIfAbsent(
      sfx,
      () => [for (var i = 0; i < 2; i++) AudioPlayer()..setPlayerMode(PlayerMode.lowLatency)],
    );
    final i = (_next[sfx] ?? 0) % pool.length;
    _next[sfx] = i + 1;
    final p = pool[i];
    _guard(() async {
      await p.stop();
      await p.play(AssetSource('sounds/${sfx.name}.wav'), volume: _seVolume);
    });
  }

  @override
  void startBgm() {
    _bgmWanted = true;
    _updateBgm();
  }

  @override
  void stopBgm() {
    _bgmWanted = false;
    _updateBgm();
  }

  void _updateBgm() {
    final shouldPlay = _bgmWanted && !_paused && _bgmVolume > 0;
    if (shouldPlay) {
      final p = _bgm;
      if (p == null) {
        final player = _bgm = AudioPlayer();
        _guard(() async {
          await player.setReleaseMode(ReleaseMode.loop);
          await player.play(AssetSource('sounds/bgm.wav'), volume: _bgmVolume * _bgmScale);
        });
      } else if (p.state != PlayerState.playing) {
        _guard(() async {
          await p.setVolume(_bgmVolume * _bgmScale);
          await p.resume();
        });
      }
    } else if (_bgm != null && _bgm!.state == PlayerState.playing) {
      _guard(() => _bgm!.pause());
    }
  }

  @override
  void setVolumes({required double bgm, required double se}) {
    _bgmVolume = bgm.clamp(0.0, 1.0);
    _seVolume = se.clamp(0.0, 1.0);
    final p = _bgm;
    if (p != null) _guard(() => p.setVolume(_bgmVolume * _bgmScale));
    _updateBgm();
  }

  @override
  void onPause() {
    _paused = true;
    _updateBgm();
  }

  @override
  void onResume() {
    _paused = false;
    _updateBgm();
  }

  @override
  void dispose() {
    for (final pool in _pools.values) {
      for (final p in pool) {
        _guard(() => p.dispose());
      }
    }
    final b = _bgm;
    if (b != null) _guard(() => b.dispose());
  }

  static void _guard(FutureOr<void> Function() f) {
    try {
      final r = f();
      if (r is Future<void>) {
        unawaited(r.catchError((Object e) => debugPrint('音を鳴らせませんでした: $e')));
      }
    } catch (e) {
      debugPrint('音を鳴らせませんでした: $e');
    }
  }
}
