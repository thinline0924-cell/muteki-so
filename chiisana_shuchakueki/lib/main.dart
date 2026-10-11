import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // 縦画面で遊ぶ
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(const ChiisanaApp());
}
