import 'package:chiisana_shuchakueki/puzzle/board.dart';
import 'package:chiisana_shuchakueki/puzzle/stage.dart';

/// テスト用:記号の盤面から Board を作る(ステージとしての検査はしない)。
Board boardOf(List<String> rows) {
  final cells = [for (final r in rows) r.trim().split(RegExp(r'\s+'))];
  return Board(cells.first.length, rows.length, [
    for (final row in cells)
      for (final token in row) StageDefinition.parseToken(token)!,
  ]);
}
