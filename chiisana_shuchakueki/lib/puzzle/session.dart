import 'board.dart';
import 'route.dart';

/// 1 ステージを遊んでいる間の状態(盤面・手数・取り消し履歴)。
///
/// 画面とは無関係に動くので、テストで直接操作できる。
class PuzzleSession {
  PuzzleSession(this.initialBoard) : _board = initialBoard;

  final Board initialBoard;
  Board _board;
  final List<Pos> _history = [];
  bool _running = false;

  Board get board => _board;

  /// 今の手数(回した回数。1手戻すと減る)。
  int get moves => _history.length;

  bool get canUndo => _history.isNotEmpty && !_running;

  /// 列車が走っている間は true。この間は盤面を操作できない。
  bool get isRunning => _running;

  /// [p] のタイルを時計回りに 90 度回す。回せたら true。
  bool rotate(Pos p) {
    if (_running || !_board.contains(p)) return false;
    final tile = _board.at(p);
    if (!tile.canRotate) return false;
    _board = _board.withTile(p, tile.rotated());
    _history.add(p);
    return true;
  }

  /// 最後の 1 手を取り消す。取り消せたら true。
  bool undo() {
    if (!canUndo) return false;
    final p = _history.removeLast();
    _board = _board.withTile(p, _board.at(p).rotated(3));
    return true;
  }

  /// 最初の盤面に戻す(手数も 0 に戻る)。
  bool reset() {
    if (_running) return false;
    _board = initialBoard;
    _history.clear();
    return true;
  }

  /// 経路を計算して走行を始める。走行中は操作を受け付けない。
  /// すでに走行中なら null。
  RouteResult? depart() {
    if (_running) return null;
    _running = true;
    return RouteSimulator.run(_board);
  }

  /// 走行の演出が終わったら呼ぶ。
  void finishRun() {
    _running = false;
  }
}
