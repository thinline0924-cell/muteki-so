/// 星の基準。ステージごとに決める。
class StarThresholds {
  const StarThresholds({required this.three, required this.two});

  /// この手数以下なら ★3
  final int three;

  /// この手数以下なら ★2(それより多ければ ★1)
  final int two;

  /// クリアしたときの星の数(1〜3)。
  int starsFor(int moves) {
    if (moves <= three) return 3;
    if (moves <= two) return 2;
    return 1;
  }
}
