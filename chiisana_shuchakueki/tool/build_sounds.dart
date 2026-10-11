// 効果音と BGM を合成して assets/sounds/*.wav に書き出す(開発用の道具)。
//
//   dart run tool/build_sounds.dart
//
// 外部の音源は使わず、波形を計算して作る(ライセンスの心配がない自作素材)。
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

const rate = 22050;

void main() {
  final out = Directory('assets/sounds')..createSync(recursive: true);
  final sounds = <String, List<double>>{
    'tap': tap(),
    'button': button(),
    'depart': depart(),
    'arrive': arrive(),
    'fail': fail(),
    'coin': coin(),
    'buy': buy(),
    'unlock': unlock(),
    'star': star(),
    'bgm': bgm(),
  };
  sounds.forEach((name, samples) {
    final file = File('${out.path}/$name.wav');
    file.writeAsBytesSync(wav(samples));
    stdout.writeln('${file.path}  ${(samples.length / rate).toStringAsFixed(2)} 秒');
  });
}

List<double> silence(double sec) => List.filled((sec * rate).round(), 0.0);

double freq(num midi) => 440.0 * math.pow(2, (midi - 69) / 12);

/// 音を足しこむ
void mix(List<double> buf, List<double> src, double at, [double gain = 1]) {
  final start = (at * rate).round();
  for (var i = 0; i < src.length && start + i < buf.length; i++) {
    buf[start + i] += src[i] * gain;
  }
}

/// オルゴールのような音(サイン波+倍音、すぐ減衰)
List<double> bell(double f, double sec, {double decay = 5, double bright = 0.3}) {
  final n = (sec * rate).round();
  return List.generate(n, (i) {
    final t = i / rate;
    final env = math.exp(-decay * t) * math.min(1.0, t * 400);
    return env *
        (math.sin(2 * math.pi * f * t) +
            bright * math.sin(2 * math.pi * f * 2 * t) +
            bright * 0.3 * math.sin(2 * math.pi * f * 3 * t));
  });
}

List<double> tone(
  double f0,
  double f1,
  double sec, {
  double decay = 8,
  String wave = 'sine',
  double attack = 0.003,
}) {
  final n = (sec * rate).round();
  var phase = 0.0;
  return List.generate(n, (i) {
    final t = i / rate;
    final f = f0 + (f1 - f0) * (i / n);
    phase += 2 * math.pi * f / rate;
    final env = math.exp(-decay * t) * math.min(1.0, t / attack) * math.min(1.0, (n - i) / 200);
    final v = switch (wave) {
      'tri' => 2 / math.pi * math.asin(math.sin(phase)),
      'soft' => math.sin(phase) + 0.2 * math.sin(phase * 3),
      _ => math.sin(phase),
    };
    return env * v;
  });
}

List<double> noise(double sec, {double decay = 60, int seed = 1}) {
  final r = math.Random(seed);
  final n = (sec * rate).round();
  return List.generate(n, (i) => math.exp(-decay * i / rate) * (r.nextDouble() * 2 - 1));
}

List<double> tap() {
  final b = silence(0.09);
  mix(b, tone(1500, 900, 0.07, decay: 60), 0, 0.6);
  mix(b, noise(0.02, decay: 300), 0, 0.25);
  return b;
}

List<double> button() {
  final b = silence(0.1);
  mix(b, tone(700, 900, 0.08, decay: 40, wave: 'soft'), 0, 0.5);
  return b;
}

/// 汽笛「ポッポー」
List<double> depart() {
  final b = silence(1.0);
  List<double> whistle(double sec) {
    final n = (sec * rate).round();
    return List.generate(n, (i) {
      final t = i / rate;
      final vib = 1 + 0.006 * math.sin(2 * math.pi * 6 * t);
      final env = math.min(1.0, t * 30) * math.min(1.0, (n - i) / (0.06 * rate));
      var v = 0.0;
      for (final f in [587.0, 740.0, 880.0]) {
        v += math.sin(2 * math.pi * f * vib * t) / 3;
      }
      return env * v;
    });
  }

  mix(b, whistle(0.18), 0, 0.5);
  mix(b, whistle(0.55), 0.26, 0.5);
  mix(b, noise(0.8, decay: 4, seed: 3), 0.2, 0.04);
  return b;
}

List<double> arrive() {
  final b = silence(1.6);
  final notes = [76, 79, 84, 88];
  for (var i = 0; i < notes.length; i++) {
    mix(b, bell(freq(notes[i]), 1.2, decay: 3.5), i * 0.12, 0.3);
  }
  return b;
}

List<double> fail() {
  final b = silence(0.6);
  mix(b, tone(330, 160, 0.45, decay: 5, wave: 'tri'), 0, 0.45);
  mix(b, tone(110, 60, 0.25, decay: 14), 0, 0.5);
  mix(b, noise(0.1, decay: 40, seed: 7), 0, 0.15);
  return b;
}

List<double> coin() {
  final b = silence(0.45);
  mix(b, bell(freq(83), 0.1, decay: 20, bright: 0.5), 0, 0.3);
  mix(b, bell(freq(88), 0.35, decay: 9, bright: 0.5), 0.07, 0.3);
  return b;
}

List<double> buy() {
  final b = silence(0.8);
  final notes = [84, 88, 91, 96];
  for (var i = 0; i < notes.length; i++) {
    mix(b, bell(freq(notes[i]), 0.5, decay: 7), i * 0.06, 0.25);
  }
  return b;
}

List<double> unlock() {
  final b = silence(1.6);
  final notes = [72, 76, 79, 84];
  for (var i = 0; i < notes.length; i++) {
    mix(b, bell(freq(notes[i]), 1.2, decay: 3, bright: 0.4), i * 0.1, 0.22);
  }
  mix(b, bell(freq(88), 1.0, decay: 3), 0.45, 0.2);
  mix(b, bell(freq(91), 1.0, decay: 3), 0.45, 0.15);
  return b;
}

List<double> star() {
  final b = silence(0.4);
  mix(b, bell(freq(93), 0.35, decay: 10, bright: 0.6), 0, 0.3);
  return b;
}

/// BGM:オルゴール風の 8 小節(くり返して流す)
List<double> bgm() {
  const beat = 0.625; // 1 拍(96 BPM)
  const bars = 8;
  final b = silence(beat * 4 * bars);
  // (音の高さ, 拍数)。null は休み
  const melody = <(int?, double)>[
    (76, 1), (79, 1), (84, 2), //
    (83, 1), (81, 1), (79, 2), //
    (77, 1), (79, 1), (81, 1), (77, 1), //
    (76, 3), (null, 1), //
    (74, 1), (76, 1), (77, 2), //
    (79, 1), (77, 1), (76, 2), //
    (74, 1), (72, 1), (74, 1), (79, 1), //
    (72, 3), (null, 1),
  ];
  var t = 0.0;
  for (final (note, beats) in melody) {
    if (note != null) {
      mix(b, bell(freq(note), math.min(2.4, beats * beat + 1.2), decay: 2.2), t, 0.22);
    }
    t += beats * beat;
  }
  // 伴奏(小節ごとの和音を 8 分音符で分散)
  const chords = [
    [48, 55, 60, 64], [43, 50, 55, 59], [41, 48, 53, 57], [48, 55, 60, 64], //
    [50, 57, 62, 65], [43, 50, 55, 59], [43, 50, 53, 59], [48, 55, 60, 64],
  ];
  for (var bar = 0; bar < bars; bar++) {
    final c = chords[bar];
    for (var k = 0; k < 8; k++) {
      final note = c[[0, 1, 2, 3, 2, 1, 2, 1][k]];
      mix(b, bell(freq(note), 0.9, decay: 4, bright: 0.15), (bar * 4 + k * 0.5) * beat, 0.09);
    }
  }
  // 最後をなめらかに 0 へ(つなぎ目のプチッという音を防ぐ)
  final fade = (0.05 * rate).round();
  for (var i = 0; i < fade; i++) {
    b[b.length - 1 - i] *= i / fade;
  }
  return b;
}

Uint8List wav(List<double> samples) {
  var peak = 0.0;
  for (final s in samples) {
    peak = math.max(peak, s.abs());
  }
  final scale = peak > 0.95 ? 0.95 / peak : 1.0;
  final data = ByteData(44 + samples.length * 2);
  void str(int o, String s) {
    for (var i = 0; i < s.length; i++) {
      data.setUint8(o + i, s.codeUnitAt(i));
    }
  }

  str(0, 'RIFF');
  data.setUint32(4, 36 + samples.length * 2, Endian.little);
  str(8, 'WAVE');
  str(12, 'fmt ');
  data.setUint32(16, 16, Endian.little);
  data.setUint16(20, 1, Endian.little); // PCM
  data.setUint16(22, 1, Endian.little); // モノラル
  data.setUint32(24, rate, Endian.little);
  data.setUint32(28, rate * 2, Endian.little);
  data.setUint16(32, 2, Endian.little);
  data.setUint16(34, 16, Endian.little);
  str(36, 'data');
  data.setUint32(40, samples.length * 2, Endian.little);
  for (var i = 0; i < samples.length; i++) {
    final v = (samples[i] * scale * 32767).round().clamp(-32768, 32767);
    data.setInt16(44 + i * 2, v, Endian.little);
  }
  return data.buffer.asUint8List();
}
