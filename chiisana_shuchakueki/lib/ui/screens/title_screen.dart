import 'package:flutter/material.dart';

import '../game_scope.dart';
import '../painters/scenery_painter.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'puzzle_screen.dart';
import 'stage_select_screen.dart';

/// タイトル画面。
class TitleScreen extends StatefulWidget {
  const TitleScreen({super.key});

  @override
  State<TitleScreen> createState() => _TitleScreenState();
}

class _TitleScreenState extends State<TitleScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _wave = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  )..repeat();

  @override
  void dispose() {
    _wave.dispose();
    super.dispose();
  }

  void _comingSoon(String what) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text('$whatは準備中です(次の段階で追加します)')));
  }

  void _continue() {
    final game = GameScope.of(context);
    final stage = game.continueStage;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => stage != null ? PuzzleScreen(stage: stage) : const StageSelectScreen(),
      ),
    );
  }

  void _stageSelect() {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const StageSelectScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final game = GameScope.of(context);
    final canPlay = game.stages.isNotEmpty;
    final compact = MediaQuery.sizeOf(context).height < 700;
    final buttonHeight = compact ? 48.0 : 56.0;
    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _wave,
              builder: (context, _) => CustomPaint(
                painter: SceneryPainter(wave: _wave.value, lift: compact ? 0.05 : 0),
              ),
            ),
          ),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, c) {
                return Column(
                  children: [
                    SizedBox(height: compact ? 4 : c.maxHeight * 0.04),
                    _Logo(compact: compact),
                    const Spacer(),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 360),
                        child: Column(
                          children: [
                            ChunkyButton(
                              key: const ValueKey('continue'),
                              label: 'つづきから',
                              height: buttonHeight,
                              icon: Icons.play_arrow_rounded,
                              onPressed: canPlay ? _continue : null,
                            ),
                            SizedBox(height: compact ? 8 : 14),
                            ChunkyButton(
                              key: const ValueKey('stage-select'),
                              label: 'ステージ選択',
                              height: buttonHeight,
                              icon: Icons.grid_view_rounded,
                              color: Palette.navy,
                              shadow: Palette.navyDark,
                              onPressed: canPlay ? _stageSelect : null,
                            ),
                            SizedBox(height: compact ? 8 : 14),
                            ChunkyButton(
                              label: '町を見る',
                              height: buttonHeight,
                              icon: Icons.home_rounded,
                              color: Palette.green,
                              shadow: Palette.greenDark,
                              badge: '準備中',
                              muted: true,
                              onPressed: () => _comingSoon('町づくり'),
                            ),
                            SizedBox(height: compact ? 8 : 14),
                            ChunkyButton(
                              label: 'コレクション',
                              height: buttonHeight,
                              icon: Icons.menu_book_rounded,
                              color: Palette.purple,
                              shadow: Palette.purpleDark,
                              badge: '準備中',
                              muted: true,
                              onPressed: () => _comingSoon('コレクション'),
                            ),
                          ],
                        ),
                      ),
                    ),
                    SizedBox(height: compact ? 8 : 16),
                    IconButton.filled(
                      tooltip: '設定(準備中)',
                      style: IconButton.styleFrom(backgroundColor: Palette.navyDark),
                      onPressed: () => _comingSoon('設定'),
                      icon: const Icon(Icons.settings_rounded, color: Colors.white),
                    ),
                    SizedBox(height: compact ? 8 : 18),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    const shadow = [Shadow(color: Color(0xAA163A47), blurRadius: 0, offset: Offset(0, 3))];
    return Semantics(
      header: true,
      label: 'ちいさな終着駅',
      excludeSemantics: true,
      child: Column(
        children: [
          const _RailLine(),
          const SizedBox(height: 6),
          Text(
            'ちいさな',
            style: TextStyle(
              fontSize: compact ? 22 : 32,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              letterSpacing: 6,
              shadows: shadow,
            ),
          ),
          Text(
            '終着駅',
            style: TextStyle(
              fontSize: compact ? 44 : 64,
              height: 1.05,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              letterSpacing: 8,
              shadows: shadow,
            ),
          ),
          const SizedBox(height: 6),
          const _RailLine(),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0x99163A47),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Text(
              'つながる線路、ひろがる町',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, letterSpacing: 2),
            ),
          ),
        ],
      ),
    );
  }
}

/// ロゴの上下の線路の飾り。
class _RailLine extends StatelessWidget {
  const _RailLine();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: const Size(220, 10), painter: _RailLinePainter());
  }
}

class _RailLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = Colors.white
      ..strokeWidth = 2;
    canvas.drawLine(Offset(0, 2), Offset(size.width, 2), p);
    canvas.drawLine(Offset(0, size.height - 2), Offset(size.width, size.height - 2), p);
    for (var x = 4.0; x < size.width; x += 10) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), p..strokeWidth = 2);
    }
  }

  @override
  bool shouldRepaint(_RailLinePainter oldDelegate) => false;
}
