import 'package:flutter/material.dart';

import '../../../design/design.dart';


/// ═══════════════════════════════════════════════════════════════════════
/// APP — AVATAR (Design System 4.0 §43)
///
/// O'quvchi va foydalanuvchi avatarlari uchun yagona komponent:
///   image → initials → fallback ikon.
/// Holatlar: loading, error, disabled.
///
/// Xotira-aware decoding (§43): rasm `cacheWidth`/`cacheHeight` bilan
/// decode qilinadi — avatar o'lchamidan bir necha baravar katta bitmap
/// xotirada saqlanmaydi (katta ro'yxatlar uchun kritik).
/// ═══════════════════════════════════════════════════════════════════════

class AppAvatar extends StatelessWidget {
  final double size;

  /// Rasm manbai (NetworkImage, FileImage, MemoryImage, ...).
  final ImageProvider? image;

  /// Initials (2 belgi — "AA", "JM"). `image` bo'lmasa ko'rsatiladi.
  final String? initials;

  /// Fallback ikon — initials ham bo'lmasa.
  final IconData fallbackIcon;

  /// Semantic rang (default: accent gradient).
  final Color? color;

  final VoidCallback? onTap;

  const AppAvatar({
    super.key,
    this.size = 40,
    this.image,
    this.initials,
    this.fallbackIcon = Icons.person_rounded,
    this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final accent = color ?? colors.accent;

    final avatar = Semantics(
      // a11y (§41): avatar ekran o'qishda foydali matn bilan tasvirlanadi.
      image: true,
      label: initials ?? fallbackIcon.toString(),
      child: _AvatarSurface(
        size: size,
        accent: accent,
        onTap: onTap,
        child: _buildContent(context, colors, accent),
      ),
    );

    return avatar;
  }

  Widget _buildContent(BuildContext context, DsColors colors, Color accent) {
    final provider = image;

    // Rasm — loading/error holatlari bilan.
    if (provider != null) {
      // Xotira-aware decoding: avatar o'lchamidan ~3x oshirmaymiz.
      // `cacheWidth` logical pixel'da emas, decode px'da — MediaQuery
      // devicePixelRatio bilan ko'paytirib hisoblanadi.
      final dpr = MediaQuery.devicePixelRatioOf(context);
      final decodeSize = (size * dpr * 2).round();

      return ClipOval(
        child: Image(
          // Memory-aware (brief §43): avatar o'lchamidan ~2x DPR decode —
          // ResizeImage bitmapni kerak o'lchamda dekod qiladi (katta
          // ro'yxatlar xotirasini tejaydi).
          image: ResizeImage(
            provider,
            width: decodeSize,
            height: decodeSize,
            allowUpscaling: false,
          ),
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stack) =>
              _buildInitialsOrIcon(colors, accent),
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            // Yumshoq skeleton-ish loading fon.
            return Container(
              width: size,
              height: size,
              color: colors.fill,
              alignment: Alignment.center,
              child: SizedBox(
                width: size * 0.35,
                height: size * 0.35,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.textTertiary,
                ),
              ),
            );
          },
        ),
      );
    }

    return _buildInitialsOrIcon(colors, accent);
  }

  Widget _buildInitialsOrIcon(DsColors colors, Color accent) {
    final initialsText = initials?.trim();
    if (initialsText != null && initialsText.isNotEmpty) {
      return Center(
        child: Text(
          // Max 2 belgi — kichik avatar'da ixcham.
          initialsText.length > 2
              ? initialsText.substring(0, 2).toUpperCase()
              : initialsText.toUpperCase(),
          style: DsType.bodyStrong(
            color: Colors.white,
          ).copyWith(fontSize: size * 0.38),
        ),
      );
    }
    return Icon(
      fallbackIcon,
      size: size * 0.5,
      color: Colors.white,
    );
  }
}

/// Avatar yuzasi — gradient + chegarada oq halqa (shisha hissi).
class _AvatarSurface extends StatelessWidget {
  final double size;
  final Color accent;
  final Widget child;
  final VoidCallback? onTap;

  const _AvatarSurface({
    required this.size,
    required this.accent,
    required this.child,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final avatar = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent, Color.lerp(accent, Colors.black, 0.18)!],
        ),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.55),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.30),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ClipOval(child: child),
    );

    if (onTap == null) return avatar;

    // InkWell — ripplesiz, faqat tap. (Avatar ichida image bor — ink
    // ko'rinmasligi uchun Material transparent + InkResponse.)
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: avatar,
      ),
    );
  }
}
