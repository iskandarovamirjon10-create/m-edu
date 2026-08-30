import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/intelligence/application/recommendations/next_best_action_service.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/payments/domain/entities/debt.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';

void main() {
  final now = DateTime(2026, 8, 16, 10, 0);
  const service = NextBestActionService();

  Identity identity({
    String id = 'M-EDU-2026-000001',
    String? phone = '+998901234567',
  }) =>
      Identity(
        identityId: id,
        firstName: 'Ali',
        lastName: 'Valiyev',
        role: IdentityRole.student,
        status: IdentityStatus.active,
        phone: phone,
        qrSeed: 'seed',
        createdAt: now.subtract(const Duration(days: 30)),
      );

  Student student({
    String id = 'M-EDU-2026-000001',
    bool paid = true,
    bool withGroup = true,
    bool withParent = true,
  }) =>
      Student(
        identityId: id,
        studentNumber: 1,
        groupId: withGroup ? 'GRP-1' : null,
        groupName: withGroup ? '9-B' : null,
        parentName: withParent ? 'Ona' : null,
        parentPhone: withParent ? '+998900000000' : null,
        studentStatus: StudentStatus.active,
        paymentStatus: paid,
        totalPaid: paid ? 500000 : 0,
        enrolledAt: now.subtract(const Duration(days: 30)),
      );

  Debt debt({
    String id = 'DEBT-1',
    DateTime? dueDate,
    int remaining = 200000,
    DebtStatus status = DebtStatus.outstanding,
  }) =>
      Debt(
        debtId: id,
        studentIdentityId: 'M-EDU-2026-000001',
        studentName: 'Ali Valiyev',
        dueDate: dueDate ?? now.subtract(const Duration(days: 5)),
        totalAmount: remaining,
        paidAmount: 0,
        remainingAmount: remaining,
        status: status,
        billingPeriod: '2026-08',
      );

  RecommendationSnapshot snapshot({
    List<Debt> debts = const [],
    List<Student> students = const [],
    List<Identity> identities = const [],
    List<AttendanceEntry> attendance = const [],
    int expected = 0,
    int pendingSync = 0,
  }) =>
      RecommendationSnapshot(
        debts: debts,
        students: students,
        identities: identities,
        todayAttendance: attendance,
        expectedAttendanceCount: expected,
        pendingSyncCount: pendingSync,
        now: now,
      );

  group('NextBestActionService — real ma\'lumot asosida', () {
    test('muddati o\'tgan qarz → "To\'lovni qayd etish" tavsiyasi', () {
      final result = service.compute(snapshot(
        debts: [debt()],
      ));
      expect(result, isNotEmpty);
      final top = result.first;
      expect(top.id, startsWith('payment.overdue'));
      expect(top.sources.single.kind, 'debt');
      expect(top.sources.single.reference, 'DEBT-1');
      expect(top.description, contains('200000'));
    });

    test('qarz yo\'q bo\'lsa — payment tavsiyasi yo\'q', () {
      final result = service.compute(snapshot());
      expect(result.any((r) => r.id.startsWith('payment.overdue')), isFalse);
    });

    test('to\'lamagan talaba → tavsiya beradi', () {
      final result = service.compute(snapshot(
        students: [student(paid: false)],
        identities: [identity()],
      ));
      expect(result.any((r) => r.id.startsWith('student.unpaid')), isTrue);
    });

    test('hammasi to\'lagan → unpaid tavsiyasi yo\'q', () {
      final result = service.compute(snapshot(
        students: [student(paid: true)],
        identities: [identity()],
      ));
      expect(result.any((r) => r.id.startsWith('student.unpaid')), isFalse);
    });

    test('to\'liq bo\'lmagan profil (telefon yo\'q) → tavsiya', () {
      final result = service.compute(snapshot(
        students: [student()],
        identities: [identity(phone: null)],
      ));
      expect(result.any((r) => r.id.startsWith('student.incomplete')), isTrue);
    });

    test('to\'liq profil → incomplete tavsiyasi yo\'q', () {
      final result = service.compute(snapshot(
        students: [student(withParent: true)],
        identities: [identity(phone: '+998901234567')],
      ));
      expect(result.any((r) => r.id.startsWith('student.incomplete')), isFalse);
    });

    test('davomat kutilayotgan, lekin belgilanmagan → tavsiya', () {
      final result = service.compute(snapshot(
        students: [student()],
        identities: [identity()],
        expected: 10,
        attendance: const [],
      ));
      expect(result.any((r) => r.id.startsWith('attendance.missing')), isTrue);
    });

    test('davomat to\'liq → attendance tavsiyasi yo\'q', () {
      final result = service.compute(snapshot(
        expected: 1,
        attendance: [
          AttendanceEntry(
            identityId: 'M-EDU-2026-000001',
            fullName: 'Ali Valiyev',
            role: 'student',
            attendanceDate: now,
            method: 'manual',
          ),
        ],
      ));
      expect(result.any((r) => r.id.startsWith('attendance.missing')), isFalse);
    });

    test('sinxronlash navbati bor → "Sinxronlashni boshlash"', () {
      final result = service.compute(snapshot(pendingSync: 3));
      expect(result.any((r) => r.id.startsWith('sync.pending')), isTrue);
    });

    test('sinxronlash navbati bo\'sh → sync tavsiyasi yo\'q', () {
      final result = service.compute(snapshot(pendingSync: 0));
      expect(result.any((r) => r.id.startsWith('sync.pending')), isFalse);
    });
  });

  group('NextBestActionService — ustuvorlik va determinizm', () {
    test('tavsiyalar ustuvorlik bo\'yicha tartiblangan', () {
      final result = service.compute(snapshot(
        debts: [debt(remaining: 500000, dueDate: now.subtract(const Duration(days: 10)))],
        pendingSync: 5,
      ));
      for (var i = 0; i < result.length - 1; i++) {
        expect(
          result[i].priority.score,
          greaterThanOrEqualTo(result[i + 1].priority.score),
        );
      }
    });

    test('deterministik: bir xil snapshot → bir xil natija', () {
      final s = snapshot(
        debts: [debt()],
        students: [student(paid: false)],
        identities: [identity(phone: null)],
        pendingSync: 2,
      );
      final a = service.compute(s);
      final b = service.compute(s);
      expect(a.map((r) => r.id).toList(), b.map((r) => r.id).toList());
    });

    test('har bir tavsiya "Nega?" uchun manbaga ega', () {
      final result = service.compute(snapshot(
        debts: [debt()],
        pendingSync: 1,
      ));
      for (final recommendation in result) {
        expect(recommendation.sources, isNotEmpty,
            reason: '${recommendation.id} manbasi bo\'lishi shart');
      }
    });
  });
}
