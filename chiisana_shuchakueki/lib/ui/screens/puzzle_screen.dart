import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../game/catalog.dart';
import '../../game/game_controller.dart';
import '../../game/progress.dart';
import '../../game/sound.dart';
import '../../puzzle/board.dart';
import '../../puzzle/route.dart';
import '../../puzzle/session.dart';
import '../../puzzle/solver.dart';
import '../../puzzle/stage.dart';
import '../art.dart';
import '../game_scope.dart';
import '../messages.dart';
import '../route_geometry.dart';
import '../theme.dart';
import '../widgets/board_view.dart';
import '../widgets/clear_overlay.dart';
import '../widgets/common.dart';
import 'stage_select_screen.dart';
import 'town_screen.dart';

enum _Phase { idle, running, failed, cleared }

/// パズル画面。
class PuzzleScreen extends StatefulWidget {
  const PuzzleScreen({super.key, required this.stage});

  final StageDefinition stage;

  @override
  State<PuzzleScreen> createState() => _PuzzleScreenState();
}

class _PuzzleScreenState extends State<PuzzleScreen> with TickerProviderStateMixin {
  /// 列車の速さ(マス/秒)
  static const double trainSpeed = 3.2;

  late PuzzleSession _session = PuzzleSession(widget.stage.board);
  late TrackGeometry _geometry = TrackGeometry.idle(widget.stage.board);
  late final AnimationController _run = AnimationController(vsync: this);

  _Phase _phase = _Phase.idle;
  RouteResult? _result;
  Hint? _hint;
  int _hintTaps = 0;
  ClearResult? _clear;
  List<CollectibleItem> _newItems = const [];
  bool _showTutorial = false;

  /// 最初のステージの手取り足取りモード(次にタップするマスを指で示す)
  bool _guided = false;
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
  );
  bool _started = false;

  GameController get _game => GameScope.of(context);

  @override
  void initState() {
    super.initState();
    _run.addListener(() => setState(() {}));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final game = _game;
    final tut = widget.stage.tutorial;
    final unseen = tut != null && !game.tutorialSeen(tut);
    _showTutorial = unseen && tutorialMessage(tut) != null;
    _guided = unseen && tut == 'rotate';
    if (_guided) _updateGuide();
    Art.precacheBoard(context, game.train.id);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _game.markPlayed(widget.stage);
    });
  }

  @override
  void dispose() {
    _run.dispose();
    _pulse.dispose();
    super.dispose();
  }

  /// 手取り足取りモード:次に回すマスを示す。つながったら「出発」を光らせる
  void _updateGuide() {
    if (!_guided) return;
    final h = Solver.hint(_session.board);
    _hint = h;
    _hintTaps = h?.taps ?? 0;
    final pulseDepart = h == null && RouteSimulator.run(_session.board).isSuccess;
    if (pulseDepart && !_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    } else if (!pulseDepart && _pulse.isAnimating) {
      _pulse
        ..stop()
        ..value = 0;
    }
  }

  bool get _locked => _phase == _Phase.running || _phase == _Phase.cleared;

  /// 失敗表示を消して、列車を駅に戻す
  void _backToStation() {
    _phase = _Phase.idle;
    _result = null;
    _geometry = TrackGeometry.idle(_session.board);
    _run.value = 0;
  }

  void _onTapTile(Pos p) {
    if (_locked) return;
    if (!_session.rotate(p)) return;
    _game
      ..play(Sfx.tap)
      ..vibrate(Haptic.selection);
    setState(() {
      if (_phase == _Phase.failed) _backToStation();
      if (_hint != null) {
        if (_hint!.pos == p && _hintTaps > 1) {
          _hintTaps--;
        } else {
          _hint = null;
        }
      }
      _updateGuide();
    });
  }

  void _undo() {
    if (_locked) return;
    setState(() {
      if (_session.undo()) {
        _game.play(Sfx.button);
        _hint = null;
        if (_phase == _Phase.failed) _backToStation();
        _updateGuide();
      }
    });
  }

  void _reset() {
    if (_locked) return;
    setState(() {
      _session.reset();
      _game.play(Sfx.button);
      _hint = null;
      _backToStation();
      _updateGuide();
    });
  }

  void _showHint() {
    if (_locked) return;
    final h = Solver.hint(_session.board);
    if (h == null) {
      final solved = RouteSimulator.run(_session.board).isSuccess;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(solved ? 'もう線路はつながっています。「出発」を押そう!' : 'ヒントが見つかりませんでした'),
            duration: const Duration(seconds: 2),
          ),
        );
      return;
    }
    _game.play(Sfx.button);
    setState(() {
      if (_phase == _Phase.failed) _backToStation();
      _hint = h;
      _hintTaps = h.taps;
    });
  }

  Future<void> _depart() async {
    if (_locked) return;
    final result = _session.depart();
    if (result == null) return;
    _game
      ..play(Sfx.depart)
      ..vibrate(Haptic.light);
    _pulse
      ..stop()
      ..value = 0;
    setState(() {
      _phase = _Phase.running;
      _result = result;
      _hint = null;
      _geometry = TrackGeometry.fromRoute(result);
    });
    final distance = math.max(0.0, _geometry.stopFront - TrackGeometry.startFront);
    _run.duration = Duration(milliseconds: math.max(400, (distance / trainSpeed * 1000).round()));
    try {
      await _run.forward(from: 0).orCancel;
    } on TickerCanceled {
      return; // 画面を閉じた
    }
    if (!mounted) return;
    _session.finishRun();
    final game = _game;
    if (result.isSuccess) {
      game
        ..play(Sfx.arrive)
        ..vibrate(Haptic.medium);
      final clear = game.recordClear(widget.stage, _session.moves);
      final tut = widget.stage.tutorial;
      if (tut != null) game.markTutorialSeen(tut);
      setState(() {
        _phase = _Phase.cleared;
        _guided = false;
        _hint = null;
      });
      await Future<void>.delayed(const Duration(milliseconds: 350));
      if (!mounted) return;
      setState(() {
        _clear = clear.result;
        _newItems = clear.newItems;
      });
    } else {
      game
        ..play(Sfx.fail)
        ..vibrate(Haptic.heavy);
      setState(() => _phase = _Phase.failed);
    }
  }

  void _retry() {
    setState(() {
      _session = PuzzleSession(widget.stage.board);
      _clear = null;
      _newItems = const [];
      _hint = null;
      _backToStation();
    });
  }

  void _goNext(StageDefinition next) {
    Navigator.of(context)
        .pushReplacement(MaterialPageRoute<void>(builder: (_) => PuzzleScreen(stage: next)));
  }

  /// タイトルの上にステージ選択だけが積まれた状態にする
  /// (「つづきから」で来たときもステージ選択へ行けるように)
  void _goStageSelect() {
    Navigator.of(context)
      ..popUntil((r) => r.isFirst)
      ..push(MaterialPageRoute<void>(builder: (_) => const StageSelectScreen()));
  }

  void _goTown() {
    Navigator.of(context)
      ..popUntil((r) => r.isFirst)
      ..push(MaterialPageRoute<void>(builder: (_) => const TownScreen()));
  }

  double get _trainFront {
    final start = TrackGeometry.startFront;
    if (_phase == _Phase.idle) return start;
    final t = Curves.easeInOutSine.transform(_run.value);
    return start + (_geometry.stopFront - start) * t;
  }

  Offset? get _crashAt {
    final r = _result;
    if (_phase != _Phase.failed || r == null) return null;
    final last = r.steps.isEmpty ? null : r.steps.last;
    if (last == null || last.exit == null) return null;
    final c = Offset(last.pos.x + 0.5, last.pos.y + 0.5);
    return c + Offset(last.exit!.dx * 0.5, last.exit!.dy * 0.5);
  }

  @override
  Widget build(BuildContext context) {
    final game = GameScope.of(context);
    final stage = widget.stage;
    final next = game.nextOf(stage);
    final nextUnlocked = next != null && game.isUnlocked(next);
    final tutorial = _showTutorial ? tutorialMessage(stage.tutorial) : null;
    // 小さい画面では余白とボタンを詰めて、盤面を大きく保つ
    final screen = MediaQuery.sizeOf(context);
    final compact = screen.height < 700 || screen.width < 360;

    return Scaffold(
      body: GameBackground(
        child: Stack(
          children: [
            SafeArea(
              child: Column(
                children: [
                  _TopBar(stage: stage, moves: _session.moves),
                  Expanded(
                    child: PaperPanel(
                      margin: EdgeInsets.fromLTRB(
                        compact ? 6 : 10,
                        4,
                        compact ? 6 : 10,
                        compact ? 6 : 10,
                      ),
                      padding: EdgeInsets.all(compact ? 8 : 12),
                      child: Column(
                        children: [
                          if (tutorial != null)
                            _TutorialCard(
                              compact: compact,
                              text: tutorial,
                              onClose: () {
                                game.play(Sfx.button);
                                setState(() => _showTutorial = false);
                              },
                            ),
                          Expanded(
                            child: BoardView(
                              board: _session.board,
                              onTapTile: _onTapTile,
                              enabled: !_locked,
                              hint: _hint?.pos,
                              hintTaps: _hintTaps,
                              pointer: _guided,
                              train: TrainView(
                                trainId: game.train.id,
                                geometry: _geometry,
                                front: _trainFront,
                                crashed: _phase == _Phase.failed,
                              ),
                              crashAt: _crashAt,
                            ),
                          ),
                          SizedBox(height: compact ? 6 : 10),
                          _StatusLine(
                            compact: compact,
                            failure: _phase == _Phase.failed && _result != null
                                ? failureMessage(_result!.outcome)
                                : null,
                            text: switch (_phase) {
                              _Phase.running => '出発進行!',
                              _Phase.cleared => '到着!',
                              _ when _guided && _hint != null => '光っている線路をタップしよう',
                              _ when _guided => '線路がつながった!「出発」を押そう',
                              _ => _session.moves == 0 ? '線路をタップして回そう' : 'つながったら「出発」!',
                            },
                          ),
                          SizedBox(height: compact ? 6 : 10),
                          ScaleTransition(
                            scale: Tween(
                              begin: 1.0,
                              end: 1.06,
                            ).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
                            child: ChunkyButton(
                              key: const ValueKey('depart'),
                              height: compact ? 48 : 56,
                              label: _phase == _Phase.failed ? 'もう一度出発' : '出発',
                              icon: Icons.play_arrow_rounded,
                              onPressed: _locked ? null : _depart,
                            ),
                          ),
                          SizedBox(height: compact ? 6 : 10),
                          Row(
                            children: [
                              Expanded(
                                child: ToolButton(
                                  compact: compact,
                                  icon: Icons.refresh_rounded,
                                  label: 'リセット',
                                  onPressed:
                                      _locked || (_session.moves == 0 && _phase == _Phase.idle)
                                      ? null
                                      : _reset,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: ToolButton(
                                  compact: compact,
                                  icon: Icons.undo_rounded,
                                  label: '1手戻す',
                                  onPressed: _locked || !_session.canUndo ? null : _undo,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: ToolButton(
                                  compact: compact,
                                  icon: Icons.lightbulb_outline_rounded,
                                  label: 'ヒント',
                                  onPressed: _locked ? null : _showHint,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_clear != null)
              Positioned.fill(
                child: ClearOverlay(
                  stage: stage,
                  result: _clear!,
                  newItems: _newItems,
                  onRetry: _retry,
                  onNext: nextUnlocked ? () => _goNext(next) : null,
                  onStageSelect: _goStageSelect,
                  onTown: _goTown,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.stage, required this.moves});

  final StageDefinition stage;
  final int moves;

  @override
  Widget build(BuildContext context) {
    final stars = stage.stars.starsFor(moves);
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 6),
      child: Row(
        children: [
          const RoundBackButton(),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0x55000000),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'ステージ ${stage.id}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  stage.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    shadows: [
                      Shadow(color: Color(0x66000000), offset: Offset(0, 2), blurRadius: 3),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(10, 5, 10, 5),
            decoration: BoxDecoration(
              color: const Color(0xCC12303D),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x33FFFFFF), width: 1.5),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                StarRow(count: stars, size: 22, spacing: 1),
                const SizedBox(height: 1),
                Text(
                  '手数 $moves / ★3は${stage.stars.three}手',
                  key: const ValueKey('moves'),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TutorialCard extends StatelessWidget {
  const _TutorialCard({required this.text, required this.onClose, this.compact = false});

  final String text;
  final VoidCallback onClose;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(bottom: compact ? 6 : 10),
      padding: EdgeInsets.fromLTRB(10, compact ? 4 : 8, 0, compact ? 4 : 8),
      decoration: BoxDecoration(
        color: Palette.paper,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Palette.star, width: 2),
      ),
      child: Row(
        children: [
          const Icon(Icons.tips_and_updates_rounded, color: Palette.orange),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: compact ? 12 : 13.5,
                height: 1.35,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          IconButton(
            visualDensity: compact ? VisualDensity.compact : null,
            tooltip: '閉じる',
            onPressed: onClose,
            icon: const Icon(Icons.close_rounded, color: Palette.inkSoft),
          ),
        ],
      ),
    );
  }
}

/// 盤面の下の 1 行。いつも同じ高さなので、表示が変わっても盤面が動かない。
class _StatusLine extends StatelessWidget {
  const _StatusLine({required this.text, this.failure, this.compact = false});

  final bool compact;

  final String text;

  /// 失敗したときの説明(なければ null)
  final String? failure;

  @override
  Widget build(BuildContext context) {
    final failed = failure != null;
    return Container(
      key: ValueKey(failed ? 'failure' : 'status'),
      height: compact ? 44 : 54,
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: failed ? const Color(0xFFFBE3DF) : Palette.paper,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: failed ? Palette.danger.withValues(alpha: 0.5) : Palette.creamDark,
        ),
      ),
      child: Row(
        children: [
          Icon(
            failed ? Icons.warning_amber_rounded : Icons.train_rounded,
            color: failed ? Palette.danger : Palette.navy,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              failed ? '$failure\n線路を直して、もう一度出発しよう' : text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: compact ? 12 : 13,
                height: 1.3,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
