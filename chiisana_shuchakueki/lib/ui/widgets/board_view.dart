import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../puzzle/board.dart';
import '../../puzzle/tile.dart';
import '../painters/tile_painter.dart';
import '../painters/train_painter.dart';
import '../route_geometry.dart';
import '../theme.dart';

/// 列車の表示に必要なもの。
class TrainView {
  const TrainView({
    required this.geometry,
    required this.front,
    this.crashed = false,
    this.smokePhase = 0,
    this.body = Palette.train,
    this.accent = Palette.trainAccent,
  });

  final TrackGeometry geometry;
  final double front;
  final bool crashed;
  final double smokePhase;

  /// 車体と帯の色(コレクションで選んだ列車)
  final Color body;
  final Color accent;
}

/// 盤面。タイルをタップすると [onTapTile] が呼ばれる。
///
/// 盤面の正しさの判定はせず、受け取った盤面を描くだけ。
class BoardView extends StatefulWidget {
  const BoardView({
    super.key,
    required this.board,
    required this.onTapTile,
    this.enabled = true,
    this.hint,
    this.hintTaps = 0,
    this.pointer = false,
    this.train,
    this.crashAt,
  });

  final Board board;
  final void Function(Pos pos) onTapTile;
  final bool enabled;
  final Pos? hint;
  final int hintTaps;

  /// ヒントのマスに「指」を出して、タップをうながす(チュートリアル用)
  final bool pointer;
  final TrainView? train;

  /// 失敗したときに × を出す位置(マス単位の座標)
  final Offset? crashAt;

  @override
  State<BoardView> createState() => _BoardViewState();
}

class _BoardViewState extends State<BoardView> with SingleTickerProviderStateMixin {
  /// 見た目の回転(4 で一周)。3→0 のときに逆回りしないよう、累積で持つ
  late List<int> _turns;
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  @override
  void initState() {
    super.initState();
    _turns = [for (final t in widget.board.tiles) t.rotation];
    _syncPulse();
  }

  @override
  void didUpdateWidget(BoardView old) {
    super.didUpdateWidget(old);
    final tiles = widget.board.tiles;
    if (tiles.length != _turns.length) {
      _turns = [for (final t in tiles) t.rotation];
    } else {
      for (var i = 0; i < tiles.length; i++) {
        final delta = (tiles[i].rotation - _turns[i]) % 4;
        // 1 回戻した(3)ときは逆回り、それ以外は時計回りに追いつく
        _turns[i] += delta == 3 ? -1 : delta;
      }
    }
    _syncPulse();
  }

  void _syncPulse() {
    if (widget.hint != null) {
      if (!_pulse.isAnimating) _pulse.repeat(reverse: true);
    } else {
      _pulse.stop();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.board;
    return LayoutBuilder(
      builder: (context, c) {
        // 狭い画面では枠を細くして、マスを大きく保つ
        final frame = c.maxWidth < 320 ? 5.0 : 10.0;
        final cell = math
            .min((c.maxWidth - frame * 2) / b.width, (c.maxHeight - frame * 2) / b.height)
            .floorToDouble();
        final w = cell * b.width;
        final h = cell * b.height;
        return Center(
          child: Container(
            width: w + frame * 2,
            height: h + frame * 2,
            padding: EdgeInsets.all(frame),
            decoration: BoxDecoration(
              color: Palette.boardFrame,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(color: Color(0x55000000), blurRadius: 10, offset: Offset(0, 5)),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: w,
                height: h,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: CustomPaint(painter: _GroundPainter(b.width, b.height, cell)),
                    ),
                    for (final p in b.positions) _tile(p, cell),
                    if (widget.hint != null) _hintMark(widget.hint!, cell),
                    if (widget.train != null)
                      Positioned.fill(
                        child: IgnorePointer(
                          child: CustomPaint(
                            painter: TrainPainter(
                              geometry: widget.train!.geometry,
                              front: widget.train!.front,
                              cellSize: cell,
                              crashed: widget.train!.crashed,
                              smokePhase: widget.train!.smokePhase,
                              body: widget.train!.body,
                              accent: widget.train!.accent,
                            ),
                          ),
                        ),
                      ),
                    if (widget.crashAt != null) _crashMark(widget.crashAt!, cell, b),
                    if (widget.pointer && widget.hint != null) _pointerMark(widget.hint!, cell),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _tile(Pos p, double cell) {
    final tile = widget.board.at(p);
    final index = p.y * widget.board.width + p.x;
    Widget child;
    if (tile.kind.isTrack) {
      child = Stack(
        children: [
          Positioned.fill(
            child: CustomPaint(painter: TilePlatePainter(fixed: !tile.canRotate)),
          ),
          Positioned.fill(
            child: AnimatedRotation(
              turns: _turns[index] / 4,
              duration: const Duration(milliseconds: 160),
              curve: Curves.easeOutBack,
              child: CustomPaint(painter: TrackPainter(tile.kind)),
            ),
          ),
        ],
      );
    } else {
      child = CustomPaint(painter: StaticTilePainter(tile, seed: index * 7919 + 13));
    }
    return Positioned(
      key: ValueKey('tile-${p.x}-${p.y}'),
      left: p.x * cell,
      top: p.y * cell,
      width: cell,
      height: cell,
      child: Semantics(
        label: _describe(tile, p),
        button: tile.canRotate,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.enabled && tile.canRotate ? () => widget.onTapTile(p) : null,
          child: child,
        ),
      ),
    );
  }

  Widget _hintMark(Pos p, double cell) {
    return Positioned(
      left: p.x * cell,
      top: p.y * cell,
      width: cell,
      height: cell,
      child: IgnorePointer(
        child: AnimatedBuilder(
          animation: _pulse,
          builder: (context, _) {
            final t = _pulse.value;
            return Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: Container(
                    margin: EdgeInsets.all(cell * (0.02 + 0.04 * t)),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(cell * 0.16),
                      border: Border.all(color: Palette.star, width: 3 + 2 * t),
                      color: Palette.star.withValues(alpha: 0.12 + 0.12 * t),
                    ),
                  ),
                ),
                Positioned(
                  right: 2,
                  top: 2,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(
                      color: Palette.star,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '×${widget.hintTaps}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        color: Palette.ink,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _pointerMark(Pos p, double cell) {
    final size = math.max(32.0, cell * 0.55);
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, child) => Positioned(
        left: (p.x + 0.55) * cell - size * 0.2,
        top: (p.y + 0.55) * cell + _pulse.value * cell * 0.12,
        width: size,
        height: size,
        child: child!,
      ),
      child: IgnorePointer(
        child: Icon(
          Icons.touch_app_rounded,
          key: const ValueKey('pointer'),
          size: size,
          color: Colors.white,
          shadows: const [Shadow(color: Color(0xAA000000), blurRadius: 6)],
        ),
      ),
    );
  }

  Widget _crashMark(Offset at, double cell, Board b) {
    // 盤面の外のときは、ふちに寄せて表示する
    final x = at.dx.clamp(0.3, b.width - 0.3) * cell;
    final y = at.dy.clamp(0.3, b.height - 0.3) * cell;
    final size = math.max(28.0, cell * 0.5);
    return Positioned(
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      child: IgnorePointer(
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.3, end: 1),
          duration: const Duration(milliseconds: 260),
          curve: Curves.elasticOut,
          builder: (context, v, child) => Transform.scale(scale: v, child: child),
          child: Container(
            decoration: const BoxDecoration(
              color: Palette.danger,
              shape: BoxShape.circle,
              boxShadow: [BoxShadow(color: Color(0x66000000), blurRadius: 4)],
            ),
            child: Icon(Icons.close_rounded, color: Colors.white, size: size * 0.7),
          ),
        ),
      ),
    );
  }

  static String _describe(Tile t, Pos p) {
    final name = switch (t.kind) {
      TileKind.straight => '直線の線路',
      TileKind.curve => 'カーブの線路',
      TileKind.tee => 'T字の線路',
      TileKind.cross => '十字の線路',
      TileKind.start => '出発駅',
      TileKind.goal => '目的地の駅',
      TileKind.tree => '木',
      TileKind.rock => '岩',
      TileKind.pond => '池',
      TileKind.empty => '草地',
    };
    final extra = t.canRotate ? '、タップで回る' : (t.kind.isTrack ? '、固定' : '');
    return '${p.x + 1}列${p.y + 1}行 $name$extra';
  }
}

class _GroundPainter extends CustomPainter {
  _GroundPainter(this.w, this.h, this.cell);

  final int w;
  final int h;
  final double cell;

  @override
  void paint(Canvas canvas, Size size) {
    final a = Paint()..color = Palette.grass;
    final b = Paint()..color = Palette.grassAlt;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        canvas.drawRect(Rect.fromLTWH(x * cell, y * cell, cell, cell), (x + y).isEven ? a : b);
      }
    }
  }

  @override
  bool shouldRepaint(_GroundPainter old) => old.w != w || old.h != h || old.cell != cell;
}
