import 'package:flutter/material.dart';

import 'dart:async';

import 'package:flutter/scheduler.dart';

import '../../game/catalog.dart';
import '../../game/progress.dart';
import '../../game/sound.dart';
import '../../puzzle/stage.dart';
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

  /// このクリアで新しく手に入れたもの
  final List<CollectibleItem> newItems;
  final VoidCallback onTown;

  final StageDefinition stage;
  final ClearResult result;
  final VoidCallback onRetry;

  /// 次のステージがない・開いていないときは null
  final VoidCallback? onNext;
  final VoidCallback onStageSelect;

  @override
  State<ClearOverlay> createState() => _ClearOverlayState();
}

class _ClearOverlayState extends State<ClearOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..forward();
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
          Timer(Duration(milliseconds: ((280 + i * 250) * scale).round()), () {
            if (mounted) game.play(Sfx.star);
          }),
        );
      }
      _timers.add(
        Timer(Duration(milliseconds: ((300 + 3 * 250) * scale).round()), () {
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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.result;
    return Material(
      color: const Color(0xEE163A47),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: FadeTransition(
                opacity: CurvedAnimation(parent: _c, curve: const Interval(0, 0.25)),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const _Ribbon(text: 'ステージクリア!'),
                    const SizedBox(height: 14),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [for (var i = 0; i < 3; i++) _popStar(i, i < r.stars)],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '手数 ${r.moves}(★3は ${widget.stage.stars.three} 手、★2は ${widget.stage.stars.two} 手まで)',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                    if (r.isNewBest && !r.isFirstClear)
                      const Padding(
                        padding: EdgeInsets.only(top: 6),
                        child: Text(
                          '最高記録を更新!',
                          style: TextStyle(color: Palette.star, fontWeight: FontWeight.w900),
                        ),
                      ),
                    const SizedBox(height: 16),
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
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
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
                            shadow: Palette.creamDark,
                            foreground: Palette.navy,
                            fontSize: 16,
                            height: 50,
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
                            shadow: Palette.creamDark,
                            foreground: Palette.navy,
                            fontSize: 16,
                            height: 50,
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
    );
  }

  Widget _popStar(int i, bool filled) {
    final start = 0.2 + i * 0.18;
    final anim = CurvedAnimation(
      parent: _c,
      curve: Interval(start, (start + 0.3).clamp(0, 1), curve: Curves.elasticOut),
    );
    return Padding(
      padding: EdgeInsets.only(bottom: i == 1 ? 18 : 0, left: 4, right: 4),
      child: ScaleTransition(
        scale: anim,
        child: Icon(
          Icons.star_rounded,
          size: i == 1 ? 76 : 62,
          color: filled ? Palette.star : const Color(0x55FFFFFF),
          shadows: const [Shadow(color: Color(0x66000000), blurRadius: 6, offset: Offset(0, 3))],
        ),
      ),
    );
  }

  Widget _rewards(ClearResult r) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(color: Palette.cream, borderRadius: BorderRadius.circular(18)),
      child: Column(
        children: [
          const Text(
            '獲得したもの',
            style: TextStyle(fontWeight: FontWeight.w800, color: Palette.inkSoft),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _rewardItem(
                const Icon(Icons.star_rounded, color: Palette.star, size: 34),
                '${r.stars}',
              ),
              _rewardItem(
                const Icon(Icons.monetization_on_rounded, color: Palette.coin, size: 34),
                null,
                count: r.coins,
              ),
              if (r.isFirstClear)
                _rewardItem(
                  const Icon(Icons.card_giftcard_rounded, color: Palette.danger, size: 34),
                  '初クリア +${r.firstClearBonus}',
                ),
            ],
          ),
        ],
      ),
    );
  }

  /// [count] があれば 0 から数え上げて表示する
  Widget _rewardItem(Widget icon, String? text, {int? count}) {
    const style = TextStyle(fontWeight: FontWeight.w800, fontSize: 15);
    return Column(
      children: [
        icon,
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

class _Ribbon extends StatelessWidget {
  const _Ribbon({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 10),
      decoration: BoxDecoration(
        color: Palette.danger,
        borderRadius: BorderRadius.circular(10),
        boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 6, offset: Offset(0, 3))],
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 28,
          fontWeight: FontWeight.w900,
          letterSpacing: 2,
        ),
      ),
    );
  }
}
