import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'game/game_controller.dart';
import 'game/stage_loader.dart';
import 'ui/game_scope.dart';
import 'ui/screens/title_screen.dart';
import 'ui/theme.dart';

class ChiisanaApp extends StatefulWidget {
  const ChiisanaApp({super.key, this.bundle, this.controller});

  /// テストで別のアセットを使いたいとき用
  final AssetBundle? bundle;

  /// 読みこみ済みの状態(テスト用)。あればアセットを読まずにこれを使う
  final GameController? controller;

  @override
  State<ChiisanaApp> createState() => _ChiisanaAppState();
}

class _ChiisanaAppState extends State<ChiisanaApp> {
  GameController? _game;
  Object? _error;

  @override
  void initState() {
    super.initState();
    if (widget.controller != null) {
      _game = widget.controller;
    } else {
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final loaded = await loadStages(widget.bundle ?? rootBundle);
      for (final e in loaded.errors) {
        debugPrint('ステージ読みこみ: $e');
      }
      if (mounted) setState(() => _game = GameController(loaded));
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  void dispose() {
    if (widget.controller == null) _game?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final game = _game;
    final Widget home;
    if (game != null) {
      home = const TitleScreen();
    } else if (_error != null) {
      home = Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'データを読みこめませんでした\n$_error',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white),
            ),
          ),
        ),
      );
    } else {
      home = const Scaffold(
        body: Center(child: CircularProgressIndicator(color: Colors.white)),
      );
    }
    final app = MaterialApp(
      title: 'ちいさな終着駅',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      locale: const Locale('ja', 'JP'),
      supportedLocales: const [Locale('ja', 'JP')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (context, child) =>
          MediaQuery.withClampedTextScaling(maxScaleFactor: 1.3, child: child!),
      home: home,
    );
    return game == null ? app : GameScope(controller: game, child: app);
  }
}
