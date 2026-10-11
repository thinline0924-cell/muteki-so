import 'package:flutter/material.dart';

/// 色。温かく、少し懐かしいジオラマの雰囲気。
abstract final class Palette {
  static const navy = Color(0xFF1F4D5E);
  static const navyDark = Color(0xFF163A47);
  static const cream = Color(0xFFF8F0DE);
  static const creamDark = Color(0xFFEBDDC2);
  static const paper = Color(0xFFFFFAF0);
  static const ink = Color(0xFF2D3A3F);
  static const inkSoft = Color(0xFF66737A);
  static const orange = Color(0xFFE9763A);
  static const orangeDark = Color(0xFFC25A23);
  static const green = Color(0xFF3F8A52);
  static const greenDark = Color(0xFF2D6A3D);
  static const purple = Color(0xFF7B63B0);
  static const purpleDark = Color(0xFF5C4790);
  static const star = Color(0xFFF6B92F);
  static const starEmpty = Color(0xFFCFC5AF);
  static const coin = Color(0xFFE8A92A);
  static const danger = Color(0xFFD8473A);

  // 盤面
  static const grass = Color(0xFFA6CB72);
  static const grassAlt = Color(0xFF98C066);
  static const boardFrame = Color(0xFF7E5A3C);
  static const rail = Color(0xFF5E6266);
  static const railShine = Color(0xFFB9BEC2);
  static const sleeper = Color(0xFF8B5E3C);
  static const ballast = Color(0xFFC9B48E);
  static const plateFixed = Color(0xFFB0A387);
  static const train = Color(0xFFD9473B);
  static const trainDark = Color(0xFF9E2F27);
  static const roof = Color(0xFFC8553D);
  static const roofGoal = Color(0xFF3E7CB1);
  static const water = Color(0xFF6FB6D9);
  static const tree = Color(0xFF4E9A4F);
  static const treeDark = Color(0xFF3A7A3E);
  static const rock = Color(0xFF9C9A93);

  // タイトルの景色
  static const sky = Color(0xFF9FD3EA);
  static const skyHigh = Color(0xFF6FB3D6);
  static const sea = Color(0xFF3F8FB8);
  static const hill = Color(0xFF6FA75A);
  static const hillFar = Color(0xFF8FBF8A);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: Palette.navy,
    primary: Palette.orange,
    secondary: Palette.navy,
    surface: Palette.cream,
  );
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: Palette.navy,
    useMaterial3: true,
    textTheme: Typography.blackMountainView.apply(
      bodyColor: Palette.ink,
      displayColor: Palette.ink,
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
