import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/security/permissions.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

/// Permission matritsasi testlari (PHASE F — single source of truth).
///
/// Rol × permission qoidalari `permissions.dart` dagi `Permissions.can`
/// bilan bir xil ishlatiladi — UI, command'lar va testlar bir qoida.
void main() {
  group('Permissions.can — RBAC matritsasi', () {
    test('superAdmin hamma narsaga ruxsatga ega', () {
      for (final permission in AppPermission.values) {
        expect(
          Permissions.can(UserRole.superAdmin, permission),
          isTrue,
          reason: 'superAdmin $permission ga ega bo\'lishi kerak',
        );
      }
    });

    test('admin users boshqaruvidan tashqari hammasiga ega', () {
      const writeOnly = {
        AppPermission.usersCreate,
        AppPermission.usersEdit,
        AppPermission.usersDeactivate,
        AppPermission.usersDelete,
      };
      for (final permission in AppPermission.values) {
        final expected = !writeOnly.contains(permission);
        expect(
          Permissions.can(UserRole.admin, permission),
          expected,
          reason: 'admin $permission: kutilgan $expected',
        );
      }
    });

    test('director admin darajasida (users yozish yo\'q, ko\'rish bor)', () {
      const writeOnly = {
        AppPermission.usersCreate,
        AppPermission.usersEdit,
        AppPermission.usersDeactivate,
        AppPermission.usersDelete,
      };
      for (final permission in AppPermission.values) {
        final expected = !writeOnly.contains(permission);
        expect(
          Permissions.can(UserRole.director, permission),
          expected,
          reason: 'director $permission: kutilgan $expected',
        );
      }
      expect(Permissions.can(UserRole.director, AppPermission.usersView), isTrue);
    });

    test('teacher davomat/ko\'rish ruxsatlariga ega, moliya boshqaruvi yo\'q', () {
      const allowed = {
        AppPermission.studentsView,
        AppPermission.attendanceView,
        AppPermission.attendanceCreate,
        AppPermission.reportsView,
        AppPermission.scheduleView,
        AppPermission.scheduleCreate,
        AppPermission.financeView,
        AppPermission.faceIdUse,
        // Baholar (o'zlashtirish): o'qituvchi baho qo'yadi.
        AppPermission.gradesView,
        AppPermission.gradesCreate,
      };
      for (final permission in AppPermission.values) {
        expect(
          Permissions.can(UserRole.teacher, permission),
          allowed.contains(permission),
          reason: 'teacher $permission: kutilgan ${allowed.contains(permission)}',
        );
      }
    });

    test('staff o\'quvchilar/guruhlar bilan ishlay oladi, moliya va sozlamalar yo\'q', () {
      const allowed = {
        AppPermission.studentsView,
        AppPermission.studentsCreate,
        AppPermission.studentsEdit,
        AppPermission.studentsArchive,
        AppPermission.teachersView,
        AppPermission.groupsView,
        AppPermission.groupsCreate,
        AppPermission.groupsEdit,
        AppPermission.scheduleView,
        AppPermission.scheduleCreate,
        AppPermission.attendanceView,
        AppPermission.attendanceCreate,
        AppPermission.reportsView,
        AppPermission.gradesView,
        AppPermission.gradesCreate,
      };
      for (final permission in AppPermission.values) {
        expect(
          Permissions.can(UserRole.staff, permission),
          allowed.contains(permission),
          reason: 'staff $permission: kutilgan ${allowed.contains(permission)}',
        );
      }
    });

    test('teacher sensitive amallarni bajara olmaydi (§32)', () {
      expect(Permissions.can(UserRole.teacher, AppPermission.financeCreate), isFalse);
      expect(Permissions.can(UserRole.teacher, AppPermission.studentsCreate), isFalse);
      expect(Permissions.can(UserRole.teacher, AppPermission.studentsEdit), isFalse);
      expect(Permissions.can(UserRole.teacher, AppPermission.settingsEdit), isFalse);
      expect(Permissions.can(UserRole.teacher, AppPermission.usersView), isFalse);
      expect(Permissions.can(UserRole.teacher, AppPermission.backupCreate), isFalse);
      expect(Permissions.can(UserRole.teacher, AppPermission.backupRestore), isFalse);
      expect(Permissions.can(UserRole.teacher, AppPermission.telegramUse), isFalse);
      expect(Permissions.can(UserRole.teacher, AppPermission.faceIdConfigure), isFalse);
    });

    test('manager operatsion + moliya ko\'rish, moliya boshqaruvi yo\'q', () {
      const allowed = {
        AppPermission.studentsView,
        AppPermission.studentsCreate,
        AppPermission.studentsEdit,
        AppPermission.studentsArchive,
        AppPermission.teachersView,
        AppPermission.groupsView,
        AppPermission.groupsCreate,
        AppPermission.groupsEdit,
        AppPermission.scheduleView,
        AppPermission.scheduleCreate,
        AppPermission.attendanceView,
        AppPermission.attendanceCreate,
        AppPermission.financeView,
        AppPermission.reportsView,
        AppPermission.gradesView,
        AppPermission.gradesCreate,
        // CRM (spec §5): manager CRM'ni boshqaradi.
        AppPermission.crmLeadsView,
        AppPermission.crmLeadsCreate,
        AppPermission.crmLeadsEdit,
      };
      for (final permission in AppPermission.values) {
        expect(
          Permissions.can(UserRole.manager, permission),
          allowed.contains(permission),
          reason: 'manager $permission: kutilgan ${allowed.contains(permission)}',
        );
      }
      // Manager to'lov amallarini bajarolmaydi — faqat admin.
      expect(Permissions.can(UserRole.manager, AppPermission.financeCreate), isFalse);
    });

    test('student hech qanday ruxsatga ega emas (fail-closed)', () {
      for (final permission in AppPermission.values) {
        expect(
          Permissions.can(UserRole.student, permission),
          isFalse,
          reason: 'student $permission ga ega bo\'lmasligi kerak',
        );
      }
    });

    test('parent hech qanday ruxsatga ega emas (fail-closed)', () {
      for (final permission in AppPermission.values) {
        expect(
          Permissions.can(UserRole.parent, permission),
          isFalse,
          reason: 'parent $permission ga ega bo\'lmasligi kerak',
        );
      }
    });

    test('unknown hech qanday ruxsatga ega emas (fail-closed)', () {
      for (final permission in AppPermission.values) {
        expect(
          Permissions.can(UserRole.unknown, permission),
          isFalse,
          reason: 'unknown $permission ga ega bo\'lmasligi kerak',
        );
      }
    });
  });

  group('Permissions.require — application-layer tekshiruv', () {
    test('ruxsat bo\'lsa xato tashlamaydi', () {
      expect(
        () => Permissions.require(UserRole.admin, AppPermission.financeCreate),
        returnsNormally,
      );
    });

    test('ruxsat bo\'lmasa PermissionDeniedFailure tashlaydi', () {
      expect(
        () => Permissions.require(UserRole.teacher, AppPermission.financeCreate),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });

    test('PermissionDeniedFailure user-friendly xabarga ega', () {
      try {
        Permissions.require(UserRole.staff, AppPermission.backupCreate);
        fail('PermissionDeniedFailure tashlanishi kerak edi');
      } on PermissionDeniedFailure catch (e) {
        expect(e.message, contains('ruxsatingiz yetarli emas'));
      }
    });
  });
}
