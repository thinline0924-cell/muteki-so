import 'board.dart';
import 'direction.dart';
import 'rating.dart';
import 'tile.dart';

/// ステージデータがおかしいときのエラー。
class StageFormatException implements Exception {
  StageFormatException(this.stageId, this.problems);

  final String stageId;
  final List<String> problems;

  @override
  String toString() =>
      'ステージ $stageId のデータに問題があります: '
      '${problems.join(' / ')}';
}

/// ステージの開放条件。
class UnlockRule {
  const UnlockRule({this.afterStage, this.minTotalStars = 0});

  /// このステージをクリアしていれば開放(null なら最初から開放)
  final String? afterStage;

  /// 合計の星がこの数以上で開放
  final int minTotalStars;
}

/// クリア報酬。
class StageReward {
  const StageReward({required this.coins, required this.firstClearBonus});

  /// クリアするたびにもらえるコイン
  final int coins;

  /// 初めてクリアしたときだけ追加でもらえるコイン
  final int firstClearBonus;
}

/// 1 ステージの定義(JSON から読みこむ)。形式は docs/stage_format.md。
class StageDefinition {
  const StageDefinition({
    required this.id,
    required this.world,
    required this.number,
    required this.name,
    required this.difficulty,
    required this.board,
    required this.stars,
    required this.reward,
    required this.unlock,
    this.tutorial,
  });

  final String id;
  final int world;
  final int number;
  final String name;
  final int difficulty;
  final Board board;
  final StarThresholds stars;
  final StageReward reward;
  final UnlockRule unlock;

  /// チュートリアルの種類(なければ null)。例: "rotate", "depart"
  final String? tutorial;

  int get width => board.width;
  int get height => board.height;

  /// JSON から読みこむ。おかしな所があれば [StageFormatException]。
  static StageDefinition fromJson(Object? json) {
    final problems = <String>[];
    if (json is! Map) {
      throw StageFormatException('?', ['ステージがオブジェクトではありません']);
    }
    final id = json['id'];
    final idText = id is String && id.isNotEmpty ? id : '?';
    if (idText == '?') problems.add('id がありません');

    int readInt(String key, {int? min, int? fallback}) {
      final v = json[key];
      if (v is int && (min == null || v >= min)) return v;
      if (v == null && fallback != null) return fallback;
      problems.add('$key が正しい整数ではありません');
      return fallback ?? 0;
    }

    final world = readInt('world', min: 1);
    final number = readInt('number', min: 1);
    final difficulty = readInt('difficulty', min: 1, fallback: 1);
    final name = json['name'];
    if (name is! String || name.isEmpty) problems.add('name がありません');

    // 盤面
    Board? board;
    final size = json['size'];
    final grid = json['grid'];
    int? w, h;
    if (size is Map && size['width'] is int && size['height'] is int) {
      w = size['width'] as int;
      h = size['height'] as int;
      if (w < 2 || h < 2 || w > 9 || h > 9) {
        problems.add('盤面の大きさは 2〜9 にしてください (${w}x$h)');
        w = h = null;
      }
    } else {
      problems.add('size {width, height} がありません');
    }
    if (grid is! List || grid.any((r) => r is! String)) {
      problems.add('grid が文字列のリストではありません');
    } else if (w != null && h != null) {
      board = _parseGrid(grid.cast<String>(), w, h, problems);
    }

    if (board != null) _checkBoard(board, problems);

    // 星
    StarThresholds? stars;
    final s = json['stars'];
    if (s is Map && s['three'] is int && s['two'] is int) {
      final three = s['three'] as int;
      final two = s['two'] as int;
      if (three < 1) problems.add('stars.three は 1 以上にしてください');
      if (two < three) problems.add('stars.two は stars.three 以上にしてください');
      stars = StarThresholds(three: three, two: two);
    } else {
      problems.add('stars {three, two} がありません');
    }

    // 報酬
    StageReward? reward;
    final r = json['reward'];
    if (r is Map && r['coins'] is int && r['firstClearBonus'] is int) {
      final coins = r['coins'] as int;
      final bonus = r['firstClearBonus'] as int;
      if (coins < 0 || bonus < 0) problems.add('報酬は 0 以上にしてください');
      reward = StageReward(coins: coins, firstClearBonus: bonus);
    } else {
      problems.add('reward {coins, firstClearBonus} がありません');
    }

    // 開放条件
    var unlock = const UnlockRule();
    final u = json['unlock'];
    if (u != null) {
      if (u is Map) {
        final after = u['afterStage'];
        final minStars = u['minTotalStars'] ?? 0;
        if ((after != null && after is! String) || minStars is! int) {
          problems.add('unlock の形がおかしいです');
        } else {
          unlock = UnlockRule(afterStage: after as String?, minTotalStars: minStars);
        }
      } else {
        problems.add('unlock の形がおかしいです');
      }
    }

    final tutorial = json['tutorial'];
    if (tutorial != null && tutorial is! String) {
      problems.add('tutorial は文字列にしてください');
    }

    if (problems.isNotEmpty) throw StageFormatException(idText, problems);
    return StageDefinition(
      id: idText,
      world: world,
      number: number,
      name: name as String,
      difficulty: difficulty,
      board: board!,
      stars: stars!,
      reward: reward!,
      unlock: unlock,
      tutorial: tutorial as String?,
    );
  }

  static Board? _parseGrid(List<String> rows, int w, int h, List<String> problems) {
    if (rows.length != h) {
      problems.add('grid の行数 ${rows.length} が height $h と合いません');
      return null;
    }
    final tiles = <Tile>[];
    for (var y = 0; y < h; y++) {
      final tokens = rows[y].trim().split(RegExp(r'\s+'));
      if (tokens.length != w) {
        problems.add('grid の ${y + 1} 行目のマス数 ${tokens.length} が width $w と合いません');
        return null;
      }
      for (var x = 0; x < w; x++) {
        final t = parseToken(tokens[x]);
        if (t == null) {
          problems.add('($x,$y) の "${tokens[x]}" が読めません');
          return null;
        }
        tiles.add(t);
      }
    }
    return Board(w, h, tiles);
  }

  /// 1 マス分の記号を読む。読めなければ null。
  ///
  /// `..` 草地 / `#` 岩 / `^` 木 / `~` 池 /
  /// `S1` 出発駅(東へ出る) / `G3` 目的地(西から入る) /
  /// `I0` 直線 / `L2` カーブ / `T1` T字 / `X0` 十字。末尾に `!` で固定。
  static Tile? parseToken(String token) {
    switch (token) {
      case '..':
        return Tile.empty;
      case '#':
        return const Tile(TileKind.rock);
      case '^':
        return const Tile(TileKind.tree);
      case '~':
        return const Tile(TileKind.pond);
    }
    final m = RegExp(r'^([SGILTX])([0-3])(!?)$').firstMatch(token);
    if (m == null) return null;
    final kind = switch (m.group(1)) {
      'S' => TileKind.start,
      'G' => TileKind.goal,
      'I' => TileKind.straight,
      'L' => TileKind.curve,
      'T' => TileKind.tee,
      _ => TileKind.cross,
    };
    final fixed = m.group(3) == '!' || kind.isStation || kind == TileKind.cross;
    return Tile(kind, rotation: int.parse(m.group(2)!), fixed: fixed);
  }

  /// [parseToken] の逆。
  static String tokenOf(Tile t) {
    switch (t.kind) {
      case TileKind.empty:
        return '..';
      case TileKind.rock:
        return '#';
      case TileKind.tree:
        return '^';
      case TileKind.pond:
        return '~';
      default:
        final letter = switch (t.kind) {
          TileKind.start => 'S',
          TileKind.goal => 'G',
          TileKind.straight => 'I',
          TileKind.curve => 'L',
          TileKind.tee => 'T',
          _ => 'X',
        };
        final showFixed = t.fixed && t.kind.isTrack && t.kind != TileKind.cross;
        return '$letter${t.rotation}${showFixed ? '!' : ''}';
    }
  }

  static void _checkBoard(Board board, List<String> problems) {
    final starts = board.positions.where((p) => board.at(p).kind == TileKind.start);
    final goals = board.positions.where((p) => board.at(p).kind == TileKind.goal);
    if (starts.length != 1) problems.add('出発駅はちょうど 1 つ必要です (${starts.length} 個)');
    if (goals.length != 1) problems.add('目的地はちょうど 1 つ必要です (${goals.length} 個)');
    for (final p in starts) {
      final out = p.step(DirMask.dirs(board.at(p).mask).first);
      if (!board.contains(out)) problems.add('出発駅 $p が盤面の外を向いています');
    }
    for (final p in goals) {
      final inSide = p.step(DirMask.dirs(board.at(p).mask).first);
      if (!board.contains(inSide)) problems.add('目的地 $p が盤面の外を向いています');
    }
  }
}

/// ワールド 1 つ分のステージ集(assets/stages/world_XX.json)。
class StagePack {
  const StagePack({
    required this.world,
    required this.name,
    required this.stages,
    required this.errors,
  });

  final int world;
  final String name;

  /// 正しく読めたステージ
  final List<StageDefinition> stages;

  /// 読めなかったステージの理由(アプリは止めずに、そのステージを飛ばす)
  final List<String> errors;

  static StagePack fromJson(Object? json) {
    if (json is! Map || json['stages'] is! List) {
      return const StagePack(world: 0, name: '?', stages: [], errors: ['ステージ集の形がおかしいです']);
    }
    final stages = <StageDefinition>[];
    final errors = <String>[];
    final ids = <String>{};
    for (final raw in json['stages'] as List) {
      try {
        final s = StageDefinition.fromJson(raw);
        if (!ids.add(s.id)) {
          errors.add('ステージ ${s.id} の id が重複しています');
          continue;
        }
        stages.add(s);
      } on StageFormatException catch (e) {
        errors.add(e.toString());
      } catch (e) {
        errors.add('ステージを読めませんでした: $e');
      }
    }
    final world = json['world'];
    final name = json['name'];
    return StagePack(
      world: world is int ? world : 0,
      name: name is String ? name : '',
      stages: stages,
      errors: errors,
    );
  }
}
