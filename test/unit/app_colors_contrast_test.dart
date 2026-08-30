import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/theme/app_colors.dart';

/// WCAG 2.2 kontrast — Design Constitution v4.0 §AC INVARIANTlar.
///
/// C-03/C-05: v4.0 semantic + text palitrasi qabul qilindi — bu test
/// palitraning aksil-buzilishini (regression) bloklaydi (§AK binary QA).
double _luminance(Color c) {
  double channel(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  final r = channel(c.r);
  final g = channel(c.g);
  final b = channel(c.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

double _contrast(Color a, Color b) {
  final l1 = _luminance(a);
  final l2 = _luminance(b);
  final hi = l1 > l2 ? l1 : l2;
  final lo = l1 > l2 ? l2 : l1;
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  final light = AppColors.light;
  const white = Color(0xFFFFFFFF);

  group('WCAG 2.2 contrast — light palette (v4.0 §I)', () {
    test('text.primary on surface.background ≥ 4.5:1', () {
      expect(
        _contrast(light.textPrimary, light.scaffoldBackground),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('text.secondary on surface.background ≥ 4.5:1 (normal text)', () {
      expect(
        _contrast(light.textSecondary, light.scaffoldBackground),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('error on white ≥ 4.5:1 (normal text)', () {
      expect(_contrast(light.error, white), greaterThanOrEqualTo(4.5));
    });

    test('success on white ≥ 3:1 (graphical/large text)', () {
      expect(_contrast(light.success, white), greaterThanOrEqualTo(3.0));
    });

    test('warning on white ≥ 3:1 (graphical/large text)', () {
      expect(_contrast(light.warning, white), greaterThanOrEqualTo(3.0));
    });

    test('info on white ≥ 3:1 (graphical/large text)', () {
      expect(_contrast(light.info, white), greaterThanOrEqualTo(3.0));
    });

    test('eski v3.1 yomon kontrast qiymatlar qaytmaydi (regression)', () {
      // #8E8E93 / #FF3B30 / #34C759 / #FF9500 — WCAG'da yiqilgan eski qiymatlar.
      expect(light.textSecondary, isNot(const Color(0xFF8E8E93)));
      expect(light.error, isNot(const Color(0xFFFF3B30)));
      expect(light.success, isNot(const Color(0xFF34C759)));
      expect(light.warning, isNot(const Color(0xFFFF9500)));
    });
  });
}
