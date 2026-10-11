import 'package:flutter/material.dart';

import '../../game/game_controller.dart';
import '../../puzzle/stage.dart';
import '../game_scope.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'puzzle_screen.dart';

/// ステージ選択画面。
class StageSelectScreen extends StatelessWidget {
  const StageSelectScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final game = GameScope.of(context);
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
                  const Expanded(
                    child: Text(
                      'ステージ選択',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  CounterChip(
                    icon: Icons.monetization_on_rounded,
                    iconColor: Palette.coin,
                    text: '${game.progress.coins}',
                  ),
                  const SizedBox(width: 6),
                  CounterChip(
                    icon: Icons.star_rounded,
                    iconColor: Palette.star,
                    text: '${game.progress.totalStars}',
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 20),
                children: [
                  for (final pack in game.packs) _WorldCard(game: game, pack: pack),
                  if (game.loaded.errors.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        '読みこめなかったステージがあります(${game.loaded.errors.length} 件)',
                        style: const TextStyle(color: Colors.white70),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WorldCard extends StatelessWidget {
  const _WorldCard({required this.game, required this.pack});

  final GameController game;
  final StagePack pack;

  @override
  Widget build(BuildContext context) {
    final next = game.continueStage;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(color: Palette.cream, borderRadius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            decoration: const BoxDecoration(
              color: Palette.paper,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ワールド ${pack.world}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Palette.inkSoft,
                        ),
                      ),
                      Text(
                        pack.name,
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.star_rounded, color: Palette.star),
                Text(
                  ' ${game.starsOf(pack)} / ${game.maxStarsOf(pack)}',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: LayoutBuilder(
              builder: (context, c) {
                const cols = 5;
                const gap = 8.0;
                final size = (c.maxWidth - gap * (cols - 1)) / cols;
                return Wrap(
                  spacing: gap,
                  runSpacing: gap,
                  children: [
                    for (final s in pack.stages)
                      SizedBox(
                        width: size,
                        height: size * 1.08,
                        child: _StageButton(
                          stage: s,
                          unlocked: game.isUnlocked(s),
                          stars: game.progress.recordOf(s.id).bestStars,
                          cleared: game.progress.isCleared(s.id),
                          isNext: next?.id == s.id,
                        ),
                      ),
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

class _StageButton extends StatelessWidget {
  const _StageButton({
    required this.stage,
    required this.unlocked,
    required this.stars,
    required this.cleared,
    required this.isNext,
  });

  final StageDefinition stage;
  final bool unlocked;
  final int stars;
  final bool cleared;
  final bool isNext;

  @override
  Widget build(BuildContext context) {
    final label = unlocked
        ? 'ステージ ${stage.number} ${stage.name}${cleared ? '、星 $stars 個' : ''}'
        : 'ステージ ${stage.number}、まだ遊べません';
    return Semantics(
      button: unlocked,
      label: label,
      excludeSemantics: true,
      child: Material(
        key: ValueKey('stage-${stage.id}'),
        color: unlocked ? Palette.navy : const Color(0xFF51666E),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: unlocked
              ? () =>
                    Navigator.of(context)
                        .push(MaterialPageRoute<void>(builder: (_) => PuzzleScreen(stage: stage)))
              : () => ScaffoldMessenger.of(context)
                  ..hideCurrentSnackBar()
                  ..showSnackBar(const SnackBar(content: Text('前のステージをクリアすると遊べます'))),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: isNext ? Border.all(color: Palette.orange, width: 3) : null,
            ),
            child: unlocked
                ? Padding(
                    padding: const EdgeInsets.all(6),
                    child: FittedBox(
                      child: Column(
                        children: [
                          Text(
                            '${stage.number}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          StarRow(count: stars, size: 14),
                        ],
                      ),
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.all(6),
                    child: FittedBox(
                      child: Column(
                        children: [
                          const Icon(Icons.lock_rounded, color: Colors.white70),
                          Text(
                            '${stage.number}',
                            style: const TextStyle(
                              color: Colors.white70,
                              fontWeight: FontWeight.w700,
                            ),
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
}
