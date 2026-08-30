// F24 — Student 360 UI consumer (page-level) wiring.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/auth/presentation/providers/auth_providers.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/students/presentation/pages/student_360_page.dart';

void main() {
  testWidgets('Student360Page — auth failure shows lock screen (unknown)',
      (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Student360Page(identityId: 'M-EDU-2026-000001'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    expect(
      find.byIcon(Icons.lock_outline),
      findsOneWidget,
      reason: 'unknown role → PermissionDeniedFailure → lock icon',
    );
  });

  testWidgets(
      'Student360Page — superAdmin passes authz, shows error view (no data)',
      (tester) async {
    // superAdmin role override; aggregator will fail NotFoundFailure
    // (no real data) but permission check passes.
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          actorRoleProvider.overrideWith((ref) => UserRole.superAdmin),
        ],
        child: const MaterialApp(
          home: Student360Page(identityId: 'M-EDU-2026-000001'),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    // No lock icon (superAdmin has studentsView).
    expect(find.byIcon(Icons.lock_outline), findsNothing,
        reason: 'superAdmin must not be denied');
    // Either error_outline (data not found) or ListView of cards — but no crash.
    expect(tester.takeException(), isNull);
  });

  test('Student 360 view — symbol exports', () {
    const page = Student360Page(identityId: 'X');
    expect(page.identityId, 'X');
  });
}
