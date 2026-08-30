// Student 360 widget test — real Flutter runtime'da provider'ni tekshirish.
//
// F23, F25 verification: per-student version provider ishonchli ishlaydi.
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:m_edu/features/students/presentation/providers/student_360_providers.dart';

void main() {
  group('F23/F25 — Per-student version provider invalidation', () {
    test('two students with different version counters, independent',
        () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      // Initial: 0 for both.
      expect(container.read(student360VersionProvider('A')), 0);
      expect(container.read(student360VersionProvider('B')), 0);

      // Bump A only.
      container.read(student360VersionProvider('A').notifier).state++;
      expect(container.read(student360VersionProvider('A')), 1);
      expect(container.read(student360VersionProvider('B')), 0,
          reason: 'B must be independent of A');
    });
  });
}
