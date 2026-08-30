import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/intelligence/application/actions/contextual_action_resolver.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';

void main() {
  const resolver = ContextualActionResolver();

  final now = DateTime(2026, 8, 16);

  Student student(StudentStatus status) => Student(
        identityId: 'M-EDU-2026-000001',
        studentNumber: 1,
        groupId: 'GRP-1',
        groupName: '9-B',
        studentStatus: status,
        enrolledAt: now,
      );

  group('ContextualActionResolver — talaba holatiga qarab', () {
    test('faol talaba → view + edit + attendance + payment + notes + history', () {
      final actions = resolver.forStudent(student(StudentStatus.active));
      final ids = actions.map((a) => a.id).toSet();
      expect(ids, contains('student.view'));
      expect(ids, contains('student.edit'));
      expect(ids, contains('student.attendance'));
      expect(ids, contains('student.payment'));
      expect(ids, contains('student.notes'));
      expect(ids, contains('student.history'));
    });

    test('arxivlangan talaba → edit/attendance/payment YO\'Q, restore bor', () {
      final actions = resolver.forStudent(student(StudentStatus.archived));
      final ids = actions.map((a) => a.id).toSet();
      expect(ids, contains('student.view'));
      expect(ids, contains('student.restore'));
      expect(ids, contains('student.history'));
      expect(ids, isNot(contains('student.edit')));
      expect(ids, isNot(contains('student.payment')));
      expect(ids, isNot(contains('student.attendance')));
    });

    test('har bir amalda reason bor (transparency)', () {
      final actions = resolver.forStudent(student(StudentStatus.active));
      for (final action in actions) {
        expect(action.reason, isNotEmpty);
        expect(action.route, isNotEmpty);
      }
    });
  });

  group('ContextualActionResolver — to\'lov holatiga qarab', () {
    Payment payment({PaymentStatus status = PaymentStatus.completed}) =>
        Payment(
          paymentId: 'PAY-1',
          studentIdentityId: 'M-EDU-2026-000001',
          amount: 200000,
          paymentType: PaymentType.cash,
          paymentDate: now,
          status: status,
          receiptNumber: 'R-001',
        );

    test('yakunlanmagan to\'lov → "Yakunlash" amali bor', () {
      final actions = resolver.forPayment(payment(status: PaymentStatus.pending));
      final ids = actions.map((a) => a.id).toSet();
      expect(ids, contains('payment.complete'));
      expect(ids, contains('payment.receipt'));
      expect(ids, contains('payment.history'));
    });

    test('yakunlangan to\'lov → "Yakunlash" amali YO\'Q (invalid)', () {
      final actions = resolver.forPayment(payment());
      final ids = actions.map((a) => a.id).toSet();
      expect(ids, isNot(contains('payment.complete')));
    });
  });

  group('ContextualActionResolver — identity', () {
    test('faol shaxs → face enroll amali bor', () {
      final identity = Identity(
        identityId: 'M-EDU-2026-000002',
        firstName: 'Bek',
        lastName: 'Karimov',
        role: IdentityRole.student,
        status: IdentityStatus.active,
        qrSeed: 'seed',
        createdAt: now,
      );
      final actions = resolver.forIdentity(identity);
      expect(actions.map((a) => a.id), contains('identity.face'));
    });
  });
}
