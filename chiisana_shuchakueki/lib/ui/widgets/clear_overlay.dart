import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../game/catalog.dart';
import '../../game/progress.dart';
import '../../game/sound.dart';
import '../../puzzle/stage.dart';
import '../art.dart';
import '../game_scope.dart';
import '../theme.dart';
import 'common.dart';
import 'new_items.dart';

/// クリア画面(パズル画面の上に重ねる)。
class ClearOverlay extends StatefulWidget {
  const ClearOverlay({
    super.key,
    required this.stage,
    required this.result,
    required this.onRetry,
    required this.onNext,
    required this.onStageSelect,
    required this.onTown,
    this.newItems = const [],
  });

  final StageDefinition stage;
  final ClearResult result;
  final VoidCallback onRetry;

  /// 次のステージがない・開いていないときは null
  final VoidCallback? onNext;
  final VoidCallback onStageSelect;
  final VoidCallback onTown;

  /// このクリアで新しく手に入れたもの
  final List<CollectibleItem> newItems;

  @override
  State<ClearOverlay> createState() => _ClearOverlayState();
}

class _ClearOverlayState extends State<ClearOverlay> with TickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  )..forward();

  /// 後ろの光がゆっくり回る・紙ふぶきが落ちる
  late final AnimationController _loop = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 12),
  )..repeat();
  final List<Timer> _timers = [];

  @override
  void initState() {
    super.initState();
    // 星が出るたびに音を鳴らす(星のアニメーションと同じ時間に合わせる)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final game = GameScope.of(context);
      final scale = timeDilation;
      for (var i = 0; i < widget.result.stars; i++) {
        _timers.add(
          Timer(Duration(milliseconds: ((350 + i * 270) * scale).round()), () {
            if (mounted) game.play(Sfx.star);
          }),
        );
      }
      _timers.add(
        Timer(Duration(milliseconds: ((400 + 3 * 270) * scale).round()), () {
          if (mounted) game.play(Sfx.coin);
        }),
      );
    });
  }

  @override
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    _c.dispose();
    _loop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.result;
    return Material(
      color: const Color(0xE8132F3C),
      child: Stack(
        children: [
          // 紙ふぶき
          Positioned.fill(
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _loop,
                builder: (context, _) =>
                    CustomPaint(painter: _ConfettiPainter(_loop.value, _c.value)),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(18),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: FadeTransition(
                    opacity: CurvedAnimation(parent: _c, curve: const Interval(0, 0.2)),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _ribbon(),
                        const SizedBox(height: 4),
                        _stars(r.stars),
                        Text(
                          '手数 ${r.moves}(★3は ${widget.stage.stars.three} 手、★2は ${widget.stage.stars.two} 手まで)',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
                        ),
                        if (r.isNewBest && !r.isFirstClear)
                          const Padding(
                            padding: EdgeInsets.only(top: 6),
                            child: Text(
                              '最高記録を更新!',
                              style: TextStyle(
                                color: Palette.star,
                                fontWeight: FontWeight.w900,
                                fontSize: 16,
                              ),
                            ),
                          ),
                        const SizedBox(height: 14),
                        _rewards(r),
                        if (widget.newItems.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          const Text(
                            '新しく手に入れたもの',
                            style: TextStyle(color: Palette.star, fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final i in widget.newItems)
                                NewItemChip(
                                  key: ValueKey('new-${i.id}'),
                                  item: i,
                                  animate: true,
                                  size: 52,
                                ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 18),
                        if (widget.onNext != null) ...[
                          ChunkyButton(
                            key: const ValueKey('next'),
                            label: '次のステージ',
                            icon: Icons.play_arrow_rounded,
                            onPressed: widget.onNext,
                          ),
                          const SizedBox(height: 10),
                        ] else
                          const Padding(
                            padding: EdgeInsets.only(bottom: 12),
                            child: Text(
                              'ここまでのステージをすべて遊びました!',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
                            ),
                          ),
                        ChunkyButton(
                          key: const ValueKey('town'),
                          label: '町へ戻る',
                          icon: Icons.home_rounded,
                          color: Palette.green,
                          shadow: Palette.greenDark,
                          fontSize: 17,
                          height: 50,
                          onPressed: widget.onTown,
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: ChunkyButton(
                                key: const ValueKey('retry'),
                                label: 'もう一度',
                                icon: Icons.replay_rounded,
                                color: Palette.paper,
                                shadow: const Color(0xFFCDBB97),
                                foreground: Palette.navy,
                                fontSize: 15,
                                height: 46,
                                onPressed: widget.onRetry,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: ChunkyButton(
                                key: const ValueKey('stage-select'),
                                label: 'ステージ選択',
                                icon: Icons.grid_view_rounded,
                                color: Palette.paper,
                                shadow: const Color(0xFFCDBB97),
                                foreground: Palette.navy,
                                fontSize: 15,
                                height: 46,
                                onPressed: widget.onStageSelect,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _ribbon() {
    final anim = CurvedAnimation(
      parent: _c,
      curve: const Interval(0, 0.35, curve: Curves.elasticOut),
    );
    return ScaleTransition(
      scale: anim,
      child: SizedBox(
        width: 330,
        height: 88,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned.fill(child: ArtImage(Art.ui('ribbon'), fit: BoxFit.fill)),
            const Padding(
              padding: EdgeInsets.only(bottom: 14),
              child: Text(
                'ステージクリア!',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 2,
                  shadows: [
                    Shadow(color: Color(0xAA6E1E18), offset: Offset(0, 2.5), blurRadius: 0),
                    Shadow(color: Color(0x66000000), offset: Offset(0, 4), blurRadius: 4),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stars(int count) {
    return SizedBox(
      height: 150,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _loop,
            builder: (context, child) =>
                Transform.rotate(angle: _loop.value * 2 * math.pi, child: child),
            child: Opacity(opacity: 0.7, child: ArtImage(Art.ui('rays'), width: 300, height: 300)),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [for (var i = 0; i < 3; i++) _popStar(i, i < count)],
          ),
        ],
      ),
    );
  }

  Widget _popStar(int i, bool filled) {
    final start = 0.2 + i * 0.18;
    final anim = CurvedAnimation(
      parent: _c,
      curve: Interval(start, (start + 0.3).clamp(0, 1), curve: Curves.elasticOut),
    );
    final size = i == 1 ? 96.0 : 76.0;
    return Padding(
      padding: EdgeInsets.only(bottom: i == 1 ? 26 : 6, left: 2, right: 2),
      child: ScaleTransition(
        scale: anim,
        child: ArtImage(Art.ui(filled ? 'star' : 'star_off'), width: size, height: size),
      ),
    );
  }

  Widget _rewards(ClearResult r) {
    return PaperPanel(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      radius: 20,
      child: Column(
        children: [
          const Text(
            '獲得したもの',
            style: TextStyle(fontWeight: FontWeight.w900, color: Palette.inkSoft),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _rewardItem('star', '${r.stars}'),
              _rewardItem('coin', null, count: r.coins),
              if (r.isFirstClear) _rewardItem('gift', '初クリア +${r.firstClearBonus}'),
            ],
          ),
        ],
      ),
    );
  }

  /// [count] があれば 0 から数え上げて表示する
  Widget _rewardItem(String image, String? text, {int? count}) {
    const style = TextStyle(fontWeight: FontWeight.w900, fontSize: 15);
    return Column(
      children: [
        ArtImage(Art.ui(image), width: 40, height: 40),
        const SizedBox(height: 2),
        if (count != null)
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: count.toDouble()),
            duration: const Duration(milliseconds: 900),
            curve: const Interval(0.4, 1, curve: Curves.easeOut),
            builder: (context, v, _) => Text('${v.round()}', style: style),
          )
        else
          Text(text ?? '', style: style),
      ],
    );
  }
}

/// 紙ふぶき(決まった並びを、時間で落とす)
class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.t, this.intro);

  final double t;

  /// 出はじめ(0〜1)。最初だけ多めに舞う
  final double intro;

  static const _colors = [
    Color(0xFFF6B92F),
    Color(0xFFE9763A),
    Color(0xFFD8473A),
    Color(0xFF6FB6D9),
    Color(0xFF7FC25A),
    Color(0xFFF7A8C0),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(7);
    final paint = Paint();
    for (var i = 0; i < 60; i++) {
      final x0 = rnd.nextDouble() * size.width;
      final speed = 0.6 + rnd.nextDouble() * 0.8;
      final phase = rnd.nextDouble();
      final y = ((t * speed * 3 + phase) % 1.0) * (size.height + 40) - 20;
      final sway = math.sin((t * 6 + phase) * math.pi * 2) * 14;
      final rot = (t * 8 + phase) * math.pi * 2;
      paint.color = _colors[i % _colors.length].withValues(alpha: 0.85 * intro.clamp(0.0, 1.0));
      canvas.save();
      canvas.translate(x0 + sway, y);
      canvas.rotate(rot);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset.zero, width: 9, height: 5),
          const Radius.circular(1.5),
        ),
        paint,
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.t != t || old.intro != intro;
}
