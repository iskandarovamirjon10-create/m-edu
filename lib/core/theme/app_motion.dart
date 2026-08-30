import 'package:flutter/material.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DESIGN SYSTEM v3.2 — MOTION ENGINE
///
/// v3.2 §3 + backward compatible nomlar.
/// ═══════════════════════════════════════════════════════════════════════

class AppMotion {
  AppMotion._();

  // ─── Duration (v3.2 §3.2) ────────────────────────────────────────────
  static const Duration micro = Duration(milliseconds: 80);
  static const Duration fast = Duration(milliseconds: 120);
  static const Duration normal = Duration(milliseconds: 200);
  static const Duration emphasis = Duration(milliseconds: 280);
  static const Duration modal = Duration(milliseconds: 240);
  static const Duration page = Duration(milliseconds: 320);
  static const Duration hover = Duration(milliseconds: 150);
  static const Duration focus = Duration(milliseconds: 120);
  static const Duration press = Duration(milliseconds: 100);
  static const Duration route = Duration(milliseconds: 300);
  static const Duration dialogOpen = Duration(milliseconds: 250);
  static const Duration dialogClose = Duration(milliseconds: 180);
  static const Duration drawerSlide = Duration(milliseconds: 280);
  static const Duration toastIn = Duration(milliseconds: 300);
  static const Duration toastOut = Duration(milliseconds: 200);
  static const Duration skeleton = Duration(milliseconds: 1500);
  static const Duration successCheck = Duration(milliseconds: 400);
  static const Duration numberCounter = Duration(milliseconds: 600);
  static const Duration pulse = Duration(milliseconds: 800);
  static const Duration sidebarCollapse = Duration(milliseconds: 300);
  static const Duration staggerStep = Duration(milliseconds: 70);
  static const Duration staggerBase = Duration(milliseconds: 420);

  // ─── Easing (v3.2 §3.1) ──────────────────────────────────────────────
  static const Curve standard = Curves.easeInOut;
  static const Curve decelerate = Curves.easeOutCubic;
  static const Curve spring = Curves.easeOutBack;
  static const Curve accelerate = Curves.easeInCubic;
  static const Curve entrance = Curves.easeOutCubic;
  static const Curve exit = Curves.easeOutCubic;
  static const Curve springy = Curves.easeOutBack;

  // ─── Component-specific (v3.2 §3.2) ──────────────────────────────────
  static const double hoverOffsetY = -4;
  static const double pressedScale = 0.97;
  static const double hoverScale = 1.01;
  static const double dialogOpenScale = 0.95;
  static const double dialogCloseScale = 0.97;
  static const Color shimmerStart = Color(0xFFF1F5F9);
  static const Color shimmerEnd = Color(0xFFE2E8F0);
}

/// Reduced-motion-ga mos motion tokenlari.
class AppMotionData {
  const AppMotionData({
    required this.micro,
    required this.fast,
    required this.normal,
    required this.emphasis,
    required this.modal,
    required this.page,
    required this.hover,
    required this.route,
    required this.dialogOpen,
    required this.dialogClose,
    required this.standard,
    required this.decelerate,
    required this.spring,
    required this.accelerate,
    required this.entrance,
  });

  final Duration micro;
  final Duration fast;
  final Duration normal;
  final Duration emphasis;
  final Duration modal;
  final Duration page;
  final Duration hover;
  final Duration route;
  final Duration dialogOpen;
  final Duration dialogClose;
  final Curve standard;
  final Curve decelerate;
  final Curve spring;
  final Curve accelerate;
  final Curve entrance;

  bool get reduced => micro == Duration.zero;
}

/// `context.appMotion` — reduced-motion holatiga mos motion.
extension AppMotionContextX on BuildContext {
  AppMotionData get appMotion {
    final reduced = MediaQuery.disableAnimationsOf(this);
    if (reduced) {
      return const AppMotionData(
        micro: Duration.zero,
        fast: Duration.zero,
        normal: Duration.zero,
        emphasis: Duration.zero,
        modal: Duration.zero,
        page: Duration.zero,
        hover: Duration(milliseconds: 150),
        route: Duration(milliseconds: 150),
        dialogOpen: Duration(milliseconds: 150),
        dialogClose: Duration(milliseconds: 150),
        standard: Curves.linear,
        decelerate: Curves.linear,
        spring: Curves.linear,
        accelerate: Curves.linear,
        entrance: Curves.linear,
      );
    }
    return const AppMotionData(
      micro: AppMotion.micro,
      fast: AppMotion.fast,
      normal: AppMotion.normal,
      emphasis: AppMotion.emphasis,
      modal: AppMotion.modal,
      page: AppMotion.page,
      hover: AppMotion.hover,
      route: AppMotion.route,
      dialogOpen: AppMotion.dialogOpen,
      dialogClose: AppMotion.dialogClose,
      standard: AppMotion.standard,
      decelerate: AppMotion.decelerate,
      spring: AppMotion.spring,
      accelerate: AppMotion.accelerate,
      entrance: AppMotion.entrance,
    );
  }

  bool get reduceMotion => MediaQuery.disableAnimationsOf(this);
}
