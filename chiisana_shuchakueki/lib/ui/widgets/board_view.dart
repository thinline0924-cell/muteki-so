import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../puzzle/board.dart';
import '../../puzzle/direction.dart';
import '../../puzzle/tile.dart';
import '../art.dart';
import '../route_geometry.dart';
import '../theme.dart';

/// 列車の表示に必要なもの。
class TrainView {
  const TrainView({
    required this.geometry,
    required this.front,
    required this.trainId,
    this.crashed = false,
  });

  final TrackGeometry geometry;

  /// 先頭の位置(経路の始まりからの距離、マス単位)
  final double front;

  /// 走らせる列車(コレクションで選んだもの)
  final String trainId;
  final bool crashed;
}

/// 盤面。タイルをタップすると [onTapTile] が呼ばれる。
///
/// 盤面の正しさの判定はせず、受け取った盤面を描くだけ。
/// 絵は assets/images/board/(1 マス = 256px の自作素材)。
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
        final frame = c.maxWidth < 320 ? 4.0 : 11.0;
        const depth = 8.0; // 盤面の厚み(下に見える木の側面)
        final cell = math
            .min((c.maxWidth - frame * 2) / b.width, (c.maxHeight - frame * 2 - depth) / b.height)
            .floorToDouble();
        final w = cell * b.width;
        final h = cell * b.height;
        return Center(
          child: SizedBox(
            width: w + frame * 2,
            height: h + frame * 2 + depth,
            child: Stack(
              children: [
                // 厚み(側面)と落ち影
                Positioned(
                  left: 0,
                  right: 0,
                  top: depth,
                  bottom: 0,
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF5E3D24),
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: const [
                        BoxShadow(color: Color(0x66000000), blurRadius: 14, offset: Offset(0, 8)),
                      ],
                    ),
                  ),
                ),
                // 木の枠
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  height: h + frame * 2,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(18),
                      image: DecorationImage(
                        image: AssetImage(Art.board('wood')),
                        repeat: ImageRepeat.repeat,
                        scale: 2.5,
                        filterQuality: FilterQuality.medium,
                      ),
                      gradient: const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xFFB98557), Color(0xFF8E5E38)],
                      ),
                      border: Border.all(color: const Color(0x33FFFFFF), width: 1.5),
                    ),
                  ),
                ),
                Positioned(
                  left: frame,
                  top: frame,
                  width: w,
                  height: h,
                  child: DecoratedBox(
                    position: DecorationPosition.foreground,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(9),
                      border: Border.all(color: const Color(0x55301B0C), width: 2),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(9),
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          for (final p in b.positions) _ground(p, cell),
                          for (final p in b.positions) _tile(p, cell),
                          if (widget.hint != null) _hintMark(widget.hint!, cell),
                          if (widget.train != null) ..._train(widget.train!, cell),
                          for (final p in b.positions)
                            if (b.at(p).kind.isStation) _stationLabel(p, b.at(p), cell),
                          if (widget.crashAt != null) _crashMark(widget.crashAt!, cell, b),
                          if (widget.pointer && widget.hint != null)
                            _pointerMark(widget.hint!, cell),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _ground(Pos p, double cell) {
    final tile = widget.board.at(p);
    final seed = (p.x * 73856093) ^ (p.y * 19349663);
    final flowers = tile.kind == TileKind.empty && seed % 3 == 0;
    return Positioned(
      left: p.x * cell,
      top: p.y * cell,
      width: cell,
      height: cell,
      child: IgnorePointer(
        child: Stack(
          fit: StackFit.expand,
          children: [
            ArtImage(Art.board((p.x + p.y).isEven ? 'grass_a' : 'grass_b'), fit: BoxFit.fill),
            if (flowers) ArtImage(Art.board('flowers_${1 + (seed ~/ 3).abs() % 4}')),
          ],
        ),
      ),
    );
  }

  Widget _tile(Pos p, double cell) {
    final tile = widget.board.at(p);
    final index = p.y * widget.board.width + p.x;
    Widget? child;
    if (tile.kind.isTrack) {
      final name = switch (tile.kind) {
        TileKind.straight => 'track_straight',
        TileKind.curve => 'track_curve',
        TileKind.tee => 'track_tee',
        _ => 'track_cross',
      };
      child = Stack(
        fit: StackFit.expand,
        children: [
          ArtImage(Art.board(tile.canRotate ? 'plate' : 'plate_fixed')),
          AnimatedRotation(
            turns: _turns[index] / 4,
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOutBack,
            child: ArtImage(Art.board(name)),
          ),
        ],
      );
    } else if (tile.kind.isStation) {
      child = RotatedBox(
        quarterTurns: tile.rotation,
        child: ArtImage(Art.board(tile.kind == TileKind.goal ? 'station_goal' : 'station_start')),
      );
    } else if (tile.kind.isObstacle) {
      child = ArtImage(
        Art.board(switch (tile.kind) {
          TileKind.tree => 'tree',
          TileKind.rock => 'rock',
          _ => 'pond',
        }),
      );
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
          child: child ?? const SizedBox.expand(),
        ),
      ),
    );
  }

  /// 駅の札(「出発」「終点」)。屋根と反対側に、回さずに出す
  Widget _stationLabel(Pos p, Tile tile, double cell) {
    final goal = tile.kind == TileKind.goal;
    final side = Dir.west.rotatedCw(tile.rotation);
    final vertical = side == Dir.east || side == Dir.west;
    final text = goal ? '終点' : '出発';
    final color = goal ? const Color(0xFF2F6797) : const Color(0xFFC0442F);
    final fs = math.max(9.0, cell * 0.15);
    final label = Container(
      padding: EdgeInsets.symmetric(horizontal: fs * 0.35, vertical: fs * 0.2),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(fs * 0.4),
        border: Border.all(color: Colors.white, width: math.max(1, fs * 0.12)),
        boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 3, offset: Offset(0, 1))],
      ),
      child: Text(
        vertical ? text.split('').join('\n') : text,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Colors.white,
          fontSize: fs,
          height: 1.05,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
    final align = switch (side) {
      Dir.north => const Alignment(0, -0.78),
      Dir.east => const Alignment(0.8, 0.1),
      Dir.south => const Alignment(0, 0.78),
      Dir.west => const Alignment(-0.8, 0.1),
    };
    return Positioned(
      left: p.x * cell,
      top: p.y * cell,
      width: cell,
      height: cell,
      child: IgnorePointer(
        child: Align(alignment: align, child: label),
      ),
    );
  }

  /// 列車(先頭車と客車)。絵は右向きなので、進む向きに回して置く
  List<Widget> _train(TrainView t, double cell) {
    const imgW = 150 / 256, imgH = 112 / 256;
    const locoLen = 116 / 256, coachLen = 104 / 256, gap = 0.035;
    final locoAt = t.geometry.at(t.front - locoLen / 2);
    final coachAt = t.geometry.at(t.front - locoLen - gap - coachLen / 2);
    Widget car(({Offset pos, double angle}) at, bool loco) => Positioned(
      left: (at.pos.dx - imgW / 2) * cell,
      top: (at.pos.dy - imgH / 2) * cell,
      width: imgW * cell,
      height: imgH * cell,
      child: IgnorePointer(
        child: Transform.rotate(
          angle: at.angle,
          child: ArtImage(Art.trainTop(t.trainId, loco: loco)),
        ),
      ),
    );
    return [car(coachAt, false), car(locoAt, true)];
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
        child: ArtImage(Art.ui('hand'), key: const ValueKey('pointer'), width: size, height: size),
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
