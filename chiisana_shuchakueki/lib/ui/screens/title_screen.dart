import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../game/sound.dart';
import '../art.dart';
import '../game_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'collection_screen.dart';
import 'puzzle_screen.dart';
import 'settings_screen.dart';
import 'stage_select_screen.dart';
import 'town_screen.dart';

/// タイトル画面。
class TitleScreen extends StatefulWidget {
  const TitleScreen({super.key});

  @override
  State<TitleScreen> createState() => _TitleScreenState();
}

class _TitleScreenState extends State<TitleScreen> with SingleTickerProviderStateMixin {
  /// ロゴがふわっと上下する
  late final AnimationController _float = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 4),
  )..repeat(reverse: true);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    precacheImage(AssetImage(Art.ui('title.jpg')), context);
  }

  @override
  void dispose() {
    _float.dispose();
    super.dispose();
  }

  void _open(Widget screen) {
    GameScope.of(context).play(Sfx.button);
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  void _continue() {
    final game = GameScope.of(context);
    final stage = game.continueStage;
    _open(stage != null ? PuzzleScreen(stage: stage) : const StageSelectScreen());
  }

  @override
  Widget build(BuildContext context) {
    final game = GameScope.of(context);
    final canPlay = game.stages.isNotEmpty;
    final size = MediaQuery.sizeOf(context);
    final compact = size.height < 700;
    final buttonHeight = compact ? 48.0 : 56.0;
    final gap = compact ? 8.0 : 12.0;
    return Scaffold(
      backgroundColor: const Color(0xFF8CC562),
      body: Stack(
        children: [
          Positioned.fill(child: ArtImage(Art.ui('title.jpg'), fit: BoxFit.cover)),
          // ボタンの下を少し暗くして読みやすく
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: size.height * 0.5,
            child: const IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x00000000), Color(0x33203A10)],
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                SizedBox(height: compact ? 6 : size.height * 0.035),
                AnimatedBuilder(
                  animation: _float,
                  builder: (context, child) => Transform.translate(
                    offset: Offset(0, math.sin(_float.value * math.pi) * -4),
                    child: child,
                  ),
                  child: _Logo(compact: compact),
                ),
                const Spacer(),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 34),
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
                        SizedBox(height: gap),
                        ChunkyButton(
                          key: const ValueKey('stage-select'),
                          label: 'ステージ選択',
                          height: buttonHeight,
                          icon: Icons.grid_view_rounded,
                          color: const Color(0xFF2A6378),
                          shadow: Palette.navyDark,
                          onPressed: canPlay ? () => _open(const StageSelectScreen()) : null,
                        ),
                        SizedBox(height: gap),
                        ChunkyButton(
                          key: const ValueKey('town'),
                          label: '町を見る',
                          height: buttonHeight,
                          icon: Icons.home_rounded,
                          color: Palette.green,
                          shadow: Palette.greenDark,
                          onPressed: () => _open(const TownScreen()),
                        ),
                        SizedBox(height: gap),
                        ChunkyButton(
                          key: const ValueKey('collection'),
                          label: 'コレクション',
                          height: buttonHeight,
                          icon: Icons.menu_book_rounded,
                          color: Palette.purple,
                          shadow: Palette.purpleDark,
                          badge: game.newItemCount > 0 ? 'NEW ${game.newItemCount}' : null,
                          badgeColor: Palette.danger,
                          onPressed: () => _open(const CollectionScreen()),
                        ),
                      ],
                    ),
                  ),
                ),
                SizedBox(height: compact ? 8 : 16),
                _RoundIconButton(
                  key: const ValueKey('settings'),
                  icon: Icons.settings_rounded,
                  tooltip: '設定',
                  onPressed: () => _open(const SettingsScreen()),
                ),
                SizedBox(height: compact ? 6 : 14),
              ],
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
    return Semantics(
      header: true,
      label: 'ちいさな終着駅',
      excludeSemantics: true,
      child: Column(
        children: [
          const _RailLine(width: 230),
          const SizedBox(height: 4),
          OutlinedText('ちいさな', fontSize: compact ? 24 : 30, strokeWidth: 6, letterSpacing: 8),
          OutlinedText('終着駅', fontSize: compact ? 50 : 66, strokeWidth: 9, letterSpacing: 10),
          const SizedBox(height: 4),
          const _RailLine(width: 230),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 5),
            decoration: BoxDecoration(
              color: const Color(0xD91C4352),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0x66FFFFFF), width: 1.5),
            ),
            child: const Text(
              'つながる線路、ひろがる町',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                letterSpacing: 2,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// ロゴの上下の線路の飾り。
class _RailLine extends StatelessWidget {
  const _RailLine({required this.width});

  final double width;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: Size(width, 12), painter: _RailLinePainter());
  }
}

class _RailLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final shadow = Paint()
      ..color = const Color(0x661C4352)
      ..strokeWidth = 4;
    final p = Paint()
      ..color = Colors.white
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    for (final paint in [shadow, p]) {
      final dy = identical(paint, shadow) ? 1.5 : 0.0;
      canvas.drawLine(Offset(0, 2 + dy), Offset(size.width, 2 + dy), paint);
      canvas.drawLine(
        Offset(0, size.height - 2 + dy),
        Offset(size.width, size.height - 2 + dy),
        paint,
      );
      for (var x = 6.0; x < size.width; x += 12) {
        canvas.drawLine(Offset(x, dy), Offset(x, size.height + dy), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_RailLinePainter oldDelegate) => false;
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: Ink(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xE61C4352),
            border: Border.all(color: const Color(0x88FFFFFF), width: 2),
            boxShadow: const [
              BoxShadow(color: Color(0x55000000), blurRadius: 6, offset: Offset(0, 3)),
            ],
          ),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onPressed,
            child: SizedBox(
              width: 50,
              height: 50,
              child: Icon(icon, color: Colors.white, size: 28),
            ),
          ),
        ),
      ),
    );
  }
}
