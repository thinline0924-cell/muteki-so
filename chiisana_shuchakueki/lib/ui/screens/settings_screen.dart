import 'package:flutter/material.dart';

import '../../game/game_controller.dart';
import '../../game/sound.dart';
import '../game_scope.dart';
import '../legal_texts.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// 設定画面。
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final game = GameScope.of(context);
    final s = game.progress.settings;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(10, 8, 12, 8),
              child: Row(
                children: [
                  RoundBackButton(),
                  SizedBox(width: 10),
                  Text(
                    '設定',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Container(
                margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                decoration: BoxDecoration(
                  color: Palette.cream,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Material(
                  type: MaterialType.transparency,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    children: [
                      _VolumeTile(
                        key: const ValueKey('bgm'),
                        icon: Icons.music_note_rounded,
                        label: 'BGM',
                        value: s.bgmVolume,
                        onChanged: (v) =>
                            game.updateSettings(game.progress.settings.copyWith(bgmVolume: v)),
                      ),
                      _VolumeTile(
                        key: const ValueKey('se'),
                        icon: Icons.volume_up_rounded,
                        label: '効果音',
                        value: s.seVolume,
                        onChanged: (v) =>
                            game.updateSettings(game.progress.settings.copyWith(seVolume: v)),
                        onChangeEnd: (_) => game.play(Sfx.coin),
                      ),
                      SwitchListTile(
                        key: const ValueKey('vibration'),
                        secondary: const Icon(Icons.vibration_rounded, color: Palette.navy),
                        title: const Text('振動', style: TextStyle(fontWeight: FontWeight.w700)),
                        value: s.vibration,
                        activeThumbColor: Palette.navy,
                        onChanged: (v) {
                          game.updateSettings(game.progress.settings.copyWith(vibration: v));
                          game.vibrate(Haptic.light);
                        },
                      ),
                      const Divider(indent: 16, endIndent: 16),
                      _LinkTile(
                        icon: Icons.save_rounded,
                        label: 'データの保存について',
                        title: 'データの保存について',
                        body: dataSaveText,
                      ),
                      _LinkTile(
                        icon: Icons.privacy_tip_rounded,
                        label: 'プライバシーポリシー',
                        title: 'プライバシーポリシー',
                        body: privacyPolicyText,
                      ),
                      _LinkTile(
                        icon: Icons.description_rounded,
                        label: '利用規約',
                        title: '利用規約',
                        body: termsText,
                      ),
                      const Divider(indent: 16, endIndent: 16),
                      ListTile(
                        key: const ValueKey('reset'),
                        leading: const Icon(Icons.delete_forever_rounded, color: Palette.danger),
                        title: const Text(
                          'データを消す',
                          style: TextStyle(color: Palette.danger, fontWeight: FontWeight.w700),
                        ),
                        subtitle: const Text('進み具合を消して最初からやり直します'),
                        onTap: () => _confirmReset(context, game),
                      ),
                      const SizedBox(height: 16),
                      const Center(
                        child: Text(
                          'のんびりと、いい旅を。',
                          style: TextStyle(color: Palette.inkSoft, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmReset(BuildContext context, GameController game) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('データを消しますか?'),
        content: const Text('クリアしたステージ、星、コイン、町、コレクションがすべて消えます。元には戻せません。'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('やめる')),
          TextButton(
            key: const ValueKey('reset-ok'),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              '消す',
              style: TextStyle(color: Palette.danger, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await game.resetProgress();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('データを消しました')));
    }
  }
}

class _VolumeTile extends StatelessWidget {
  const _VolumeTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.onChanged,
    this.onChangeEnd,
  });

  final IconData icon;
  final String label;
  final double value;
  final ValueChanged<double> onChanged;
  final ValueChanged<double>? onChangeEnd;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      child: Row(
        children: [
          Icon(icon, color: Palette.navy),
          const SizedBox(width: 16),
          SizedBox(
            width: 56,
            child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          Expanded(
            child: Slider(
              value: value,
              onChanged: onChanged,
              onChangeEnd: onChangeEnd,
              activeColor: Palette.navy,
              label: '${(value * 100).round()}',
            ),
          ),
        ],
      ),
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({
    required this.icon,
    required this.label,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String label;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: Palette.navy),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => _TextPage(title: title, body: body),
        ),
      ),
    );
  }
}

class _TextPage extends StatelessWidget {
  const _TextPage({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 12, 8),
              child: Row(
                children: [
                  const RoundBackButton(),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                decoration: BoxDecoration(
                  color: Palette.paper,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: Text(body, style: const TextStyle(fontSize: 14, height: 1.7)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
