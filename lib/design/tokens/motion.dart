import 'package:flutter/material.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU DESIGN SYSTEM v4.0 — MOTION
///
/// Consistent animation durations and easing curves.
/// Respects reduced-motion accessibility settings.
/// ═══════════════════════════════════════════════════════════════════════

class DsMotion {
  DsMotion._();

  // ─── Durations ──────────────────────────────────────────────────────
  static const Duration instant = Duration(milliseconds: 50);
  static const Duration fast = Duration(milliseconds: 120);
  static const Duration normal = Duration(milliseconds: 200);
  static const Duration medium = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 450);

  // ─── Easing ─────────────────────────────────────────────────────────
  static const Curve standard = Curves.easeInOut;
  static const Curve enter = Curves.easeOutCubic;
  static const Curve exit = Curves.easeInCubic;
  static const Curve spring = Curves.easeOutBack;

  // ─── Component-specific ─────────────────────────────────────────────
  static const Duration tapFeedback = Duration(milliseconds: 100);
  static const Duration hover = Duration(milliseconds: 150);
  static const Duration routeTransition = Duration(milliseconds: 300);
  static const Duration dialogOpen = Duration(milliseconds: 250);
  static const Duration dialogClose = Duration(milliseconds: 180);
  static const Duration bottomSheet = Duration(milliseconds: 300);
  static const Duration skeleton = Duration(milliseconds: 1200);
}
