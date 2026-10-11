import 'package:flutter/material.dart';

import '../../game/game_controller.dart';
import '../../game/sound.dart';
import '../../puzzle/stage.dart';
import '../art.dart';
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
      body: GameBackground(
        child: SafeArea(
          child: Column(
            children: [
              ScreenHeader(
                title: 'ステージ選択',
                trailing: [
                  CounterChip(image: 'coin', text: '${game.progress.coins}'),
                  CounterChip(image: 'star', text: '${game.progress.totalStars}'),
                ],
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 24),
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
    // ワールドの最初のステージに必要な星(足りなければ鍵の札を出す)
    final need = pack.stages.isEmpty ? 0 : pack.stages.first.unlock.minTotalStars;
    final lockedByStars = need > game.progress.totalStars;
    return PaperPanel(
      margin: const EdgeInsets.only(bottom: 16),
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
            child: SizedBox(
              height: 92,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ArtImage(Art.ui('world_${pack.world.clamp(1, 5)}.jpg'), fit: BoxFit.cover),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                        colors: [Color(0xCCFFFAF0), Color(0x00FFFAF0)],
                        stops: [0.3, 0.75],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 12, 10),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                                decoration: BoxDecoration(
                                  color: Palette.navy,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'ワールド ${pack.world}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                pack.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.fromLTRB(4, 3, 10, 3),
                          decoration: BoxDecoration(
                            color: const Color(0xE6FFFAF0),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ArtImage(Art.ui('star'), width: 22, height: 22),
                              Text(
                                ' ${game.starsOf(pack)} / ${game.maxStarsOf(pack)}',
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (lockedByStars)
            Container(
              color: const Color(0xFFF1E4C8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              child: Row(
                children: [
                  ArtImage(Art.ui('lock'), width: 18, height: 18),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      '星を $need 個集めると開きます(いま ${game.progress.totalStars} 個)',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Palette.inkSoft,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
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
                        height: size * 1.1,
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

  String _lockedMessage(BuildContext context) {
    final game = GameScope.of(context);
    final after = stage.unlock.afterStage;
    if (after != null && !game.progress.isCleared(after)) {
      return 'ステージ $after をクリアすると遊べます';
    }
    return '星を ${stage.unlock.minTotalStars} 個集めると遊べます(いま ${game.progress.totalStars} 個)';
  }

  @override
  Widget build(BuildContext context) {
    final label = unlocked
        ? 'ステージ ${stage.number} ${stage.name}${cleared ? '、星 $stars 個' : ''}'
        : 'ステージ ${stage.number}、まだ遊べません';
    final top = unlocked
        ? (cleared ? const Color(0xFF2F7A8F) : const Color(0xFF2A6378))
        : const Color(0xFF7F8E94);
    final bottom = unlocked ? const Color(0xFF1B4656) : const Color(0xFF66747A);
    return Semantics(
      button: unlocked,
      label: label,
      excludeSemantics: true,
      child: Material(
        key: ValueKey('stage-${stage.id}'),
        color: Colors.transparent,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [top, bottom],
            ),
            border: Border.all(
              color: isNext ? Palette.orange : const Color(0x33000000),
              width: isNext ? 3 : 1.5,
            ),
            boxShadow: [
              const BoxShadow(color: Color(0x55000000), blurRadius: 3, offset: Offset(0, 3)),
              if (isNext) const BoxShadow(color: Color(0x88E9763A), blurRadius: 10),
            ],
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: unlocked
                ? () {
                    GameScope.of(context).play(Sfx.button);
                    Navigator.of(context)
                        .push(MaterialPageRoute<void>(builder: (_) => PuzzleScreen(stage: stage)));
                  }
                : () => ScaffoldMessenger.of(context)
                    ..hideCurrentSnackBar()
                    ..showSnackBar(SnackBar(content: Text(_lockedMessage(context)))),
            child: Padding(
              padding: const EdgeInsets.all(5),
              child: FittedBox(
                child: unlocked
                    ? Column(
                        children: [
                          Text(
                            '${stage.number}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              shadows: [
                                Shadow(
                                  color: Color(0x66000000),
                                  offset: Offset(0, 2),
                                  blurRadius: 2,
                                ),
                              ],
                            ),
                          ),
                          StarRow(count: stars, size: 15),
                        ],
                      )
                    : Column(
                        children: [
                          const Icon(Icons.lock_rounded, color: Color(0xFFE3E8EA), size: 24),
                          Text(
                            '${stage.number}',
                            style: const TextStyle(
                              color: Color(0xFFE3E8EA),
                              fontWeight: FontWeight.w900,
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
