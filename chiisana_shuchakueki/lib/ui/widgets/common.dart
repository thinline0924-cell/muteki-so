import 'package:flutter/material.dart';

import '../art.dart';
import '../theme.dart';

/// 画面の背景:深い青緑のグラデーションに、うっすら枕木の模様。
class GameBackground extends StatelessWidget {
  const GameBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF2B6578), Palette.navy, Color(0xFF16394A)],
          stops: [0, 0.45, 1],
        ),
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          image: DecorationImage(
            image: AssetImage(Art.ui('navy')),
            repeat: ImageRepeat.repeat,
            opacity: 0.55,
            scale: 2,
          ),
        ),
        child: child,
      ),
    );
  }
}

/// 紙の質感のパネル(クリーム色)。
class PaperPanel extends StatelessWidget {
  const PaperPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(12),
    this.radius = 24,
    this.margin,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      decoration: BoxDecoration(
        color: Palette.cream,
        borderRadius: BorderRadius.circular(radius),
        image: DecorationImage(
          image: AssetImage(Art.ui('paper')),
          repeat: ImageRepeat.repeat,
          scale: 2,
        ),
        border: Border.all(color: const Color(0xFFE6D5B2), width: 2),
        boxShadow: const [
          BoxShadow(color: Color(0x55000000), blurRadius: 14, offset: Offset(0, 6)),
        ],
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

/// ぷっくりした大きなボタン。押すと少し沈む。
class ChunkyButton extends StatefulWidget {
  const ChunkyButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.color = Palette.orange,
    this.shadow = Palette.orangeDark,
    this.foreground = Colors.white,
    this.height = 56,
    this.fontSize = 19,
    this.badge,
    this.badgeColor,
    this.muted = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Color color;
  final Color shadow;
  final Color foreground;
  final double height;
  final double fontSize;

  /// 右上に出す小さな札(「NEW 3」など)
  final String? badge;

  /// 札の色(null ならクリーム色)
  final Color? badgeColor;

  /// 押せるが、まだ使えないことを示す灰色の見た目にする
  final bool muted;

  @override
  State<ChunkyButton> createState() => _ChunkyButtonState();
}

class _ChunkyButtonState extends State<ChunkyButton> {
  bool _down = false;

  void _set(bool v) {
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    final w = widget;
    final enabled = w.onPressed != null && !w.muted;
    final base = enabled ? w.color : Color.lerp(w.color, const Color(0xFF9AA0A3), 0.65)!;
    final depthColor = enabled ? w.shadow : Color.lerp(w.shadow, const Color(0xFF6E7477), 0.65)!;
    final depth = w.height * 0.09;
    final press = _down ? depth * 0.7 : 0.0;
    final r = BorderRadius.circular(w.height / 2);
    final light = w.foreground == Colors.white;
    return Semantics(
      button: true,
      enabled: w.onPressed != null,
      label: w.badge == null ? w.label : '${w.label}(${w.badge})',
      excludeSemantics: true,
      child: GestureDetector(
        onTapDown: w.onPressed == null ? null : (_) => _set(true),
        onTapUp: w.onPressed == null ? null : (_) => _set(false),
        onTapCancel: () => _set(false),
        onTap: w.onPressed,
        child: SizedBox(
          height: w.height + depth,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // 厚み(下の濃い部分)と影
              Positioned(
                left: 0,
                right: 0,
                top: depth,
                height: w.height,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: depthColor,
                    borderRadius: r,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0x55000000),
                        blurRadius: _down ? 3 : 8,
                        offset: Offset(0, _down ? 1 : 4),
                      ),
                    ],
                  ),
                ),
              ),
              AnimatedPositioned(
                duration: const Duration(milliseconds: 70),
                left: 0,
                right: 0,
                top: press,
                height: w.height,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: r,
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Color.lerp(base, Colors.white, 0.22)!,
                        base,
                        Color.lerp(base, Colors.black, 0.06)!,
                      ],
                      stops: const [0, 0.55, 1],
                    ),
                    border: Border.all(
                      color: Color.lerp(depthColor, Colors.black, 0.1)!,
                      width: 1.5,
                    ),
                  ),
                  child: Stack(
                    children: [
                      // 上のつや
                      Positioned(
                        left: w.height * 0.3,
                        right: w.height * 0.3,
                        top: 3,
                        height: w.height * 0.22,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: enabled ? 0.28 : 0.15),
                            borderRadius: BorderRadius.circular(w.height),
                          ),
                        ),
                      ),
                      Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(horizontal: w.height * 0.3),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (w.icon != null) ...[
                                Icon(
                                  w.icon,
                                  color: w.foreground,
                                  size: w.fontSize + 7,
                                  shadows: light
                                      ? const [
                                          Shadow(
                                            color: Color(0x55000000),
                                            offset: Offset(0, 1.5),
                                            blurRadius: 2,
                                          ),
                                        ]
                                      : null,
                                ),
                                const SizedBox(width: 10),
                              ],
                              Flexible(
                                child: Text(
                                  w.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: w.foreground,
                                    fontSize: w.fontSize,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.5,
                                    shadows: light
                                        ? const [
                                            Shadow(
                                              color: Color(0x55000000),
                                              offset: Offset(0, 1.5),
                                              blurRadius: 2,
                                            ),
                                          ]
                                        : null,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (w.badge != null)
                Positioned(
                  right: 14,
                  top: -9 + press,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: w.badgeColor ?? Palette.cream,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: const [
                        BoxShadow(color: Color(0x44000000), blurRadius: 3, offset: Offset(0, 1)),
                      ],
                    ),
                    child: Text(
                      w.badge!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: w.badgeColor == null ? Palette.inkSoft : Colors.white,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 小さな操作ボタン(リセット・1手戻す・ヒント)。
class ToolButton extends StatelessWidget {
  const ToolButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
    this.compact = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  /// 小さい画面用(アイコンと文字を横に並べて低くする)
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    final fg = enabled ? Palette.navy : Palette.inkSoft.withValues(alpha: 0.45);
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: Ink(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: enabled
                  ? const [Color(0xFFFFFDF7), Color(0xFFF2E7D1)]
                  : const [Color(0xFFEDE3CE), Color(0xFFE4D8BF)],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: enabled ? const Color(0xFFD9C7A3) : const Color(0xFFDDD0B6),
              width: 1.5,
            ),
            boxShadow: enabled
                ? const [BoxShadow(color: Color(0x33000000), blurRadius: 4, offset: Offset(0, 3))]
                : null,
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onPressed,
            child: SizedBox(
              height: compact ? 44 : 60,
              child: Flex(
                direction: compact ? Axis.horizontal : Axis.vertical,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: fg, size: compact ? 20 : 26),
                  SizedBox(width: compact ? 4 : 0, height: compact ? 0 : 2),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: fg),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 丸い戻るボタン。
class RoundBackButton extends StatelessWidget {
  const RoundBackButton({super.key, this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '戻る',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: Ink(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFFFFFDF7), Color(0xFFEDE1C8)],
            ),
            border: Border.all(color: const Color(0xFFD9C7A3), width: 2),
            boxShadow: const [
              BoxShadow(color: Color(0x55000000), blurRadius: 6, offset: Offset(0, 3)),
            ],
          ),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onPressed ?? () => Navigator.of(context).maybePop(),
            child: const SizedBox(
              width: 46,
              height: 46,
              child: Icon(Icons.chevron_left_rounded, color: Palette.navy, size: 34),
            ),
          ),
        ),
      ),
    );
  }
}

/// 画面上部:戻るボタン・題名・右側の札。
class ScreenHeader extends StatelessWidget {
  const ScreenHeader({super.key, required this.title, this.trailing = const []});

  final String title;
  final List<Widget> trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 8, 12, 8),
      child: Row(
        children: [
          const RoundBackButton(),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 21,
                fontWeight: FontWeight.w900,
                letterSpacing: 1,
                shadows: [Shadow(color: Color(0x66000000), offset: Offset(0, 2), blurRadius: 3)],
              ),
            ),
          ),
          for (var i = 0; i < trailing.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            trailing[i],
          ],
        ],
      ),
    );
  }
}

/// 星を並べる(絵の星)。
class StarRow extends StatelessWidget {
  const StarRow({super.key, required this.count, this.size = 16, this.max = 3, this.spacing = 0});

  final int count;
  final double size;
  final int max;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '星 $count 個',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < max; i++) ...[
            if (i > 0) SizedBox(width: spacing),
            ArtImage(Art.ui(i < count ? 'star' : 'star_off'), width: size, height: size),
          ],
        ],
      ),
    );
  }
}

/// コインや星の数を出す札。
class CounterChip extends StatelessWidget {
  const CounterChip({super.key, required this.image, required this.text});

  /// 絵の名前(Art.ui の名前。'coin' や 'star')
  final String image;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 3, 12, 3),
      decoration: BoxDecoration(
        color: const Color(0xCC12303D),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x33FFFFFF), width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ArtImage(Art.ui(image), width: 26, height: 26),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15),
          ),
        ],
      ),
    );
  }
}

/// 白抜きの太い文字に、濃い縁どりと影をつける(ロゴや大見出し用)。
class OutlinedText extends StatelessWidget {
  const OutlinedText(
    this.text, {
    super.key,
    required this.fontSize,
    this.color = Colors.white,
    this.stroke = const Color(0xFF1C4352),
    this.strokeWidth = 6,
    this.letterSpacing = 4,
  });

  final String text;
  final double fontSize;
  final Color color;
  final Color stroke;
  final double strokeWidth;
  final double letterSpacing;

  @override
  Widget build(BuildContext context) {
    final base = TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w900,
      letterSpacing: letterSpacing,
      height: 1.1,
    );
    return Stack(
      children: [
        Transform.translate(
          offset: Offset(0, strokeWidth * 0.7),
          child: Text(
            text,
            style: base.copyWith(
              foreground: Paint()
                ..style = PaintingStyle.stroke
                ..strokeWidth = strokeWidth * 1.6
                ..strokeJoin = StrokeJoin.round
                ..color = const Color(0x55000000),
            ),
          ),
        ),
        Text(
          text,
          style: base.copyWith(
            foreground: Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = strokeWidth
              ..strokeJoin = StrokeJoin.round
              ..color = stroke,
          ),
        ),
        Text(text, style: base.copyWith(color: color)),
      ],
    );
  }
}

/// 背景つきの Scaffold(画面の土台)。
class GameScaffold extends StatelessWidget {
  const GameScaffold({super.key, required this.body});

  final Widget body;

  @override
  Widget build(BuildContext context) => Scaffold(body: GameBackground(child: body));
}
