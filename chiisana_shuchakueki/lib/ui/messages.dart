import '../puzzle/route.dart';

/// 失敗したときの説明。
String failureMessage(RouteOutcome o) => switch (o) {
  RouteOutcome.offBoard => '線路が盤面の外へ向かっています',
  RouteOutcome.noTrack => '線路のないところへ進んでしまいました',
  RouteOutcome.disconnected => '線路がつながっていません',
  RouteOutcome.wrongStation => '出発駅にもどってきてしまいました',
  RouteOutcome.loop => '同じところをぐるぐる回っています',
  RouteOutcome.invalidBoard => 'このステージのデータに問題があります',
  RouteOutcome.arrived => '到着!',
};

/// チュートリアルの文。ステージの "tutorial" の値で選ぶ。
String? tutorialMessage(String? id) => switch (id) {
  'rotate' => '線路をタップすると 90° 回ります。\n終点まで線路をつないだら「出発」!',
  'curve' => 'カーブも回せます。\n列車がどちらへ曲がるか考えてみよう。',
  'stars' => '少ない手数でクリアすると星が増えます。\n「1手戻す」「リセット」も使えます。',
  'fixed' => 'ボルトでとめられた線路は回せません。\nほかの線路を合わせよう。',
  'obstacle' => '木や岩、池のマスは通れません。\nよけて道をつくろう。',
  _ => null,
};
