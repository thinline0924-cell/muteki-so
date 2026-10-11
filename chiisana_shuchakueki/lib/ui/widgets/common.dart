import 'package:flutter/material.dart';

import '../theme.dart';

/// ぷっくりした大きなボタン(下に影がつく)。
class ChunkyButton extends StatelessWidget {
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

  /// 札の色(null ならクリーム色)
  final Color? badgeColor;

  /// 押せるが、まだ使えないことを示す灰色の見た目にする
  final bool muted;

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Color color;
  final Color shadow;
  final Color foreground;
  final double height;
  final double fontSize;

  /// 右上に出す小さな札(「準備中」など)
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !muted;
    final bg = enabled ? color : Color.lerp(color, const Color(0xFF9A9A9A), 0.6)!;
    final sh = enabled ? shadow : Color.lerp(shadow, const Color(0xFF777777), 0.6)!;
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: badge == null ? label : '$label($badge)',
      excludeSemantics: true,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            height: height,
            decoration: BoxDecoration(color: sh, borderRadius: BorderRadius.circular(height / 2)),
            padding: const EdgeInsets.only(bottom: 4),
            child: Material(
              color: bg,
              borderRadius: BorderRadius.circular(height / 2),
              child: InkWell(
                borderRadius: BorderRadius.circular(height / 2),
                onTap: onPressed,
                child: Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, color: foreground, size: fontSize + 6),
                        const SizedBox(width: 10),
                      ],
                      Flexible(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: foreground,
                            fontSize: fontSize,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          if (badge != null)
            Positioned(
              right: 14,
              top: -8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: badgeColor ?? Palette.cream,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Palette.inkSoft.withValues(alpha: 0.4)),
                ),
                child: Text(
                  badge!,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: badgeColor == null ? Palette.inkSoft : Colors.white,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 小さな四角い操作ボタン(リセット・1手戻す・ヒント)。
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
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: enabled ? Palette.paper : Palette.creamDark,
        borderRadius: BorderRadius.circular(14),
        elevation: enabled ? 2 : 0,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onPressed,
          child: SizedBox(
            height: compact ? 44 : 58,
            child: Flex(
              direction: compact ? Axis.horizontal : Axis.vertical,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  color: enabled ? Palette.navy : Palette.inkSoft.withValues(alpha: 0.5),
                  size: compact ? 20 : 26,
                ),
                SizedBox(width: compact ? 4 : 0, height: compact ? 0 : 2),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: enabled ? Palette.ink : Palette.inkSoft.withValues(alpha: 0.5),
                    ),
                  ),
                ),
              ],
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
        color: Palette.paper,
        shape: const CircleBorder(),
        elevation: 2,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed ?? () => Navigator.of(context).maybePop(),
          child: const SizedBox(
            width: 44,
            height: 44,
            child: Icon(Icons.chevron_left_rounded, color: Palette.navy, size: 32),
          ),
        ),
      ),
    );
  }
}

/// 星を 3 つ並べる。
class StarRow extends StatelessWidget {
  const StarRow({super.key, required this.count, this.size = 16, this.max = 3});

  final int count;
  final double size;
  final int max;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '星 $count 個',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < max; i++)
            Icon(
              Icons.star_rounded,
              size: size,
              color: i < count ? Palette.star : Palette.starEmpty,
            ),
        ],
      ),
    );
  }
}

/// 星やコインの数を出す小さな札。
class CounterChip extends StatelessWidget {
  const CounterChip({super.key, required this.icon, required this.iconColor, required this.text});

  final IconData icon;
  final Color iconColor;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Palette.navyDark,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white24),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: iconColor, size: 20),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
          ),
        ],
      ),
    );
  }
}
