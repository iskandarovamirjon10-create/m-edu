import 'dart:io' show Platform;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/theme/performance_tier.dart';

/// PerformanceTier foundation (Design Constitution v4.0 §N/§AH/§AG, C-32).
///
/// Deteksiya heuristikasi PROVISIONAL — aniq chegaralar device matrix
/// benchmark'ida validatsiya qilinadi (report §E). Testlar mapping
/// determinizmni va konservativ default'ni qoriqlaydi.
void main() {
  group('performanceTierFromCoreCount (provisional mapping)', () {
    test('low cores -> T3 (conservative)', () {
      expect(performanceTierFromCoreCount(0), PerformanceTier.t3);
      expect(performanceTierFromCoreCount(2), PerformanceTier.t3);
      expect(performanceTierFromCoreCount(3), PerformanceTier.t3);
    });

    test('mid cores -> T2', () {
      expect(performanceTierFromCoreCount(4), PerformanceTier.t2);
      expect(performanceTierFromCoreCount(7), PerformanceTier.t2);
    });

    test('high cores -> T1', () {
      expect(performanceTierFromCoreCount(8), PerformanceTier.t1);
      expect(performanceTierFromCoreCount(16), PerformanceTier.t1);
    });
  });

  group('performanceTierProvider', () {
    test('default consistent with current device', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final tier = container.read(performanceTierProvider);
      expect(
        tier,
        performanceTierFromCoreCount(Platform.numberOfProcessors),
      );
    });

    test('override provides fixed value for tests', () {
      final container = ProviderContainer(
        overrides: [
          performanceTierProvider.overrideWithValue(PerformanceTier.t3),
        ],
      );
      addTearDown(container.dispose);
      expect(container.read(performanceTierProvider), PerformanceTier.t3);
    });
  });
}
