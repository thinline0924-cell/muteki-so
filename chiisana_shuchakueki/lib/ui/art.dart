import 'package:flutter/widgets.dart';

/// 絵(assets/images/)の場所。絵は tool/art/ の SVG から作った自作の素材。
abstract final class Art {
  static String board(String name) => 'assets/images/board/$name.png';
  static String trainTop(String trainId, {required bool loco}) =>
      'assets/images/trains/${trainId}_${loco ? 'loco' : 'coach'}.png';
  static String item(String itemId) => 'assets/images/items/$itemId.png';

  /// 名前に拡張子がなければ .png
  static String town(String name) => 'assets/images/town/${_ext(name)}';
  static String ui(String name) => 'assets/images/ui/${_ext(name)}';

  static String _ext(String name) => name.contains('.') ? name : '$name.png';

  /// 盤面の絵を先に読みこんでおく(はじめて表示したときのちらつきを防ぐ)
  static Future<void> precacheBoard(BuildContext context, String trainId) async {
    final names = [
      'grass_a',
      'grass_b',
      'plate',
      'plate_fixed',
      'track_straight',
      'track_curve',
      'track_tee',
      'track_cross',
      'station_start',
      'station_goal',
      'tree',
      'rock',
      'pond',
      'wood',
      'flowers_1',
      'flowers_2',
      'flowers_3',
      'flowers_4',
    ];
    final futures = [
      for (final n in names) precacheImage(AssetImage(board(n)), context),
      precacheImage(AssetImage(trainTop(trainId, loco: true)), context),
      precacheImage(AssetImage(trainTop(trainId, loco: false)), context),
    ];
    try {
      await Future.wait(futures);
    } catch (_) {
      // 読めない絵があってもゲームは続ける
    }
  }
}

/// アセットの絵(なめらかに拡大縮小する)
class ArtImage extends StatelessWidget {
  const ArtImage(this.path, {super.key, this.fit = BoxFit.contain, this.width, this.height});

  final String path;
  final BoxFit fit;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) => Image.asset(
    path,
    fit: fit,
    width: width,
    height: height,
    filterQuality: FilterQuality.medium,
    gaplessPlayback: true,
    errorBuilder: (context, error, stack) => const SizedBox.shrink(),
  );
}
