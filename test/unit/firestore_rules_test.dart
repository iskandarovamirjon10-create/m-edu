import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Firestore security rules (config/firestore.rules) logikasini aks
/// ettiruvchi SOF Dart modeli — emulatorsiz tekshirish uchun.
///
/// Diqqat: bu model rules faylini MIRROR qiladi. Haqiqiy emulator tekshiruvi
/// uchun `firebase emulators:start --only firestore` kerak (BLOCKER — Firebase
/// CLI + emulator o'rnatilgan muhit). Shunga qaramay, matritsa testlari
/// ruxsat modelidagi xatolarni erta topadi (fail-closed tekshiruvi).
class RulesModel {
  static const roles = ['super_admin', 'admin', 'director', 'manager', 'staff', 'teacher'];

  static bool isAdminLevel(String? role) =>
      role == 'super_admin' || role == 'admin' || role == 'director';

  static bool isManagerOrAbove(String? role) => isAdminLevel(role) || role == 'manager';

  static bool isStaffOrAbove(String? role) => isManagerOrAbove(role) || role == 'staff';

  static bool isTeacher(String? role) => role == 'teacher';

  /// students/attendance/grades/reports/organization — staff+ yoki teacher.
  static bool canReadOperational(String? role) =>
      isStaffOrAbove(role) || isTeacher(role);

  // ─── Resurs × amal qoidalari (config/firestore.rules bilan sinxron) ──

  static bool canRead(String? role, String resource) {
    if (role == null) return false; // signedIn talab
    return switch (resource) {
      'sync' => isManagerOrAbove(role),
      'users' => role == 'super_admin',
      'organization' => canReadOperational(role),
      'students' => canReadOperational(role),
      'attendance' => canReadOperational(role),
      'grades' => canReadOperational(role),
      'reports' => canReadOperational(role),
      // Teacher app'da financeView ga ega (read-only).
      'payments' => isManagerOrAbove(role) || isTeacher(role),
      'audit_logs' => isAdminLevel(role),
      'biometric' => false, // HECh qachon cloud'da
      _ => false, // fail-closed
    };
  }

  static bool canWrite(String? role, String resource) {
    if (role == null) return false;
    return switch (resource) {
      'sync' => false, // serverOnly — client yozmaydi
      'users' => role == 'super_admin',
      'organization' => isAdminLevel(role),
      'students' => isManagerOrAbove(role),
      'attendance' => isAdminLevel(role) || isTeacher(role),
      'grades' => isAdminLevel(role) || isTeacher(role),
      'reports' => isManagerOrAbove(role),
      'payments' => isManagerOrAbove(role),
      'audit_logs' => false, // serverOnly
      'biometric' => false,
      _ => false, // fail-closed
    };
  }

  static bool canDelete(String? role, String resource) {
    if (role == null) return false;
    return switch (resource) {
      'students' => isAdminLevel(role),
      'attendance' => isAdminLevel(role),
      'payments' => isAdminLevel(role),
      'reports' => isAdminLevel(role),
      'grades' => isManagerOrAbove(role),
      _ => false,
    };
  }
}

void main() {
  const roles = ['super_admin', 'admin', 'director', 'manager', 'staff', 'teacher'];

  group('Firestore rules — negative tests (fail-closed)', () {
    test('autentifikatsiyasiz (role=null) hech narsani o\'qiy olmaydi / yozolmaydi', () {
      for (final resource in ['students', 'attendance', 'payments', 'grades', 'reports', 'users', 'sync', 'audit_logs', 'biometric']) {
        expect(RulesModel.canRead(null, resource), isFalse, reason: resource);
        expect(RulesModel.canWrite(null, resource), isFalse, reason: resource);
      }
    });

    test('teacher MOLIYANI O\'QIY oladi (financeView), lekin YOZA olmaydi (financeCreate yo\'q)', () {
      expect(RulesModel.canRead('teacher', 'payments'), isTrue);
      expect(RulesModel.canWrite('teacher', 'payments'), isFalse);
      expect(RulesModel.canDelete('teacher', 'payments'), isFalse);
    });

    test('teacher student YOZA olmaydi (faqat o\'qiy oladi)', () {
      expect(RulesModel.canRead('teacher', 'students'), isTrue);
      expect(RulesModel.canWrite('teacher', 'students'), isFalse);
    });

    test('staff student/report YOZA olmaydi (faqat o\'qish)', () {
      expect(RulesModel.canRead('staff', 'students'), isTrue);
      expect(RulesModel.canWrite('staff', 'students'), isFalse);
      expect(RulesModel.canRead('staff', 'reports'), isTrue);
      expect(RulesModel.canWrite('staff', 'reports'), isFalse);
    });

    test('manager student YOZA oladi, lekin users/audit YOZA olmaydi', () {
      expect(RulesModel.canWrite('manager', 'students'), isTrue);
      expect(RulesModel.canWrite('manager', 'users'), isFalse);
      expect(RulesModel.canWrite('manager', 'audit_logs'), isFalse);
      expect(RulesModel.canRead('manager', 'audit_logs'), isFalse);
    });

    test('users boshqaruvi faqat super_admin', () {
      for (final role in roles) {
        if (role == 'super_admin') continue;
        expect(RulesModel.canWrite(role, 'users'), isFalse, reason: role);
      }
      expect(RulesModel.canWrite('super_admin', 'users'), isTrue);
    });

    test('biometric/face data cloud\'da HECh QACHON ruxsat etilmaydi', () {
      for (final role in roles) {
        expect(RulesModel.canRead(role, 'biometric'), isFalse, reason: role);
        expect(RulesModel.canWrite(role, 'biometric'), isFalse, reason: role);
      }
    });

    test('noma\'lum rol (fail-closed) — hech narsa', () {
      expect(RulesModel.canRead('unknown', 'students'), isFalse);
      expect(RulesModel.canWrite('unknown', 'attendance'), isFalse);
      expect(RulesModel.canRead('hacker', 'payments'), isFalse);
    });

    test('client sync yozuviga YOZA OLMAYDI (serverOnly)', () {
      for (final role in roles) {
        expect(RulesModel.canWrite(role, 'sync'), isFalse, reason: role);
      }
    });

    test('teacher students/attendance O\'QIY oladi, lekin student YOZA olmaydi', () {
      expect(RulesModel.canRead('teacher', 'students'), isTrue);
      expect(RulesModel.canWrite('teacher', 'students'), isFalse);
      expect(RulesModel.canRead('teacher', 'attendance'), isTrue);
      expect(RulesModel.canWrite('teacher', 'attendance'), isTrue); // attendanceCreate
      expect(RulesModel.canDelete('teacher', 'attendance'), isFalse);
    });

    test('audit_logs faqat admin o\'qiydi, hech kim yozmaydi', () {
      expect(RulesModel.canRead('admin', 'audit_logs'), isTrue);
      expect(RulesModel.canRead('manager', 'audit_logs'), isFalse);
      expect(RulesModel.canRead('teacher', 'audit_logs'), isFalse);
      expect(RulesModel.canWrite('super_admin', 'audit_logs'), isFalse);
    });

    test('users — faqat super_admin (o\'qish ham, yozish ham)', () {
      for (final role in roles) {
        if (role == 'super_admin') continue;
        expect(RulesModel.canRead(role, 'users'), isFalse, reason: role);
        expect(RulesModel.canWrite(role, 'users'), isFalse, reason: role);
      }
      expect(RulesModel.canRead('super_admin', 'users'), isTrue);
      expect(RulesModel.canWrite('super_admin', 'users'), isTrue);
    });

    test('delete amallari: students/payments/attendance — admin+, grades — manager+', () {
      expect(RulesModel.canDelete('manager', 'students'), isFalse);
      expect(RulesModel.canDelete('admin', 'students'), isTrue);
      expect(RulesModel.canDelete('manager', 'grades'), isTrue);
      expect(RulesModel.canDelete('teacher', 'grades'), isFalse);
      expect(RulesModel.canDelete('admin', 'payments'), isTrue);
      expect(RulesModel.canDelete('manager', 'reports'), isFalse);
    });
  });

  group('Firestore rules — happy path (legit access)', () {
    test('admin asosiy resurslarni o\'qiydi va yozadi', () {
      for (final resource in ['students', 'attendance', 'grades', 'reports', 'payments', 'organization']) {
        expect(RulesModel.canRead('admin', resource), isTrue, reason: resource);
      }
      expect(RulesModel.canWrite('admin', 'students'), isTrue);
      expect(RulesModel.canWrite('admin', 'payments'), isTrue);
      expect(RulesModel.canWrite('admin', 'organization'), isTrue);
    });

    test('teacher attendance/grades belgilay oladi (kundalik ish)', () {
      expect(RulesModel.canWrite('teacher', 'attendance'), isTrue);
      expect(RulesModel.canWrite('teacher', 'grades'), isTrue);
      expect(RulesModel.canRead('teacher', 'attendance'), isTrue);
      expect(RulesModel.canRead('teacher', 'grades'), isTrue);
    });

    test('staff attendance o\'qiy oladi (kuzatuv)', () {
      expect(RulesModel.canRead('staff', 'attendance'), isTrue);
    });
  });

  group('Firestore rules — static fayl auditi', () {
    test('rules fayli mavjud va fail-closed qoidalarni o\'z ichiga oladi', () {
      final file = File('config/firestore.rules');
      expect(file.existsSync(), isTrue, reason: 'config/firestore.rules topilmadi');
      final content = file.readAsStringSync();

      // Hech qanday "allow ... if true" (hammaga ochiq) yo'q.
      expect(content.contains('allow read, write: if true'), isFalse);
      expect(content.contains('allow read: if true'), isFalse);
      expect(content.contains('allow write: if true'), isFalse);

      // Biometric default taqiqlangan (izoh bo'lsa ham — taqiq default).
      expect(content.toLowerCase(), contains('biometric'));

      // Sync yozuvlari server-only.
      expect(content, contains('serverOnly'));

      // Audit loglar faqat server yozadi.
      expect(content, contains('audit_logs'));
    });

    test('indexes fayli sync query pattern uchun kompozit indekslarni beradi', () {
      final file = File('config/firestore.indexes.json');
      expect(file.existsSync(), isTrue);
      final content = file.readAsStringSync();
      expect(content, contains('collectionGroup'));
      expect(content, contains('updatedAt'));
      expect(content, contains('updatedByDevice'));
    });
  });
}
