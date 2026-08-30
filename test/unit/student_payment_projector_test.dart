import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/payments/domain/events/payment_events.dart';
import 'package:m_edu/features/students/application/services/student_payment_projector.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';

import '../helpers/fake_repositories.dart';
import '../helpers/test_helpers.dart';

void main() {
  group('StudentPaymentProjector (C-03)', () {
    test('to\'lov qabul qilinganda Student read-model yangilanadi', () async {
      final bus = EventBus();
      final studentRepo = FakeStudentRepository(
        students: [_student(totalPaid: 0)],
      );

      final projector = StudentPaymentProjector(
        studentRepository: studentRepo,
        eventBus: bus,
      );
      addTearDown(projector.dispose);
      addTearDown(bus.dispose);

      final payment = Payment(
        paymentId: 'PAY-20260809-00001',
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 8, 9, 12, 0),
        status: PaymentStatus.completed,
        discountAmount: 0,
        lateFee: 0,
      );

      bus.publish(PaymentReceivedEvent(
        payment: payment,
        occurredAt: payment.paymentDate,
      ));

      await waitUntil(() => studentRepo.students.single.paymentStatus);
      final updated = studentRepo.students.single;
      expect(updated.paymentStatus, isTrue);
      expect(updated.totalPaid, 300000);
      expect(updated.lastPaymentDate, payment.paymentDate);
    });

    test('chegirma va late fee to\'g\'ri hisobga olinadi', () async {
      final bus = EventBus();
      final studentRepo = FakeStudentRepository(
        students: [_student(totalPaid: 0)],
      );
      final projector = StudentPaymentProjector(
        studentRepository: studentRepo,
        eventBus: bus,
      );
      addTearDown(projector.dispose);
      addTearDown(bus.dispose);

      final payment = Payment(
        paymentId: 'PAY-1',
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 8, 9),
        status: PaymentStatus.completed,
        discountAmount: 30000,
        lateFee: 10000,
      );
      // paidAmount = 300000 - 30000 + 10000 = 280000
      expect(payment.paidAmount, 280000);

      bus.publish(PaymentReceivedEvent(
        payment: payment,
        occurredAt: payment.paymentDate,
      ));

      await waitUntil(() => studentRepo.students.single.paymentStatus);
      expect(studentRepo.students.single.totalPaid, 280000);
    });

    test('birinchi to\'lovdan keyingi to\'lov summasi yig\'iladi', () async {
      final bus = EventBus();
      final studentRepo = FakeStudentRepository(
        students: [_student(totalPaid: 100000)],
      );
      final projector = StudentPaymentProjector(
        studentRepository: studentRepo,
        eventBus: bus,
      );
      addTearDown(projector.dispose);
      addTearDown(bus.dispose);

      final payment = Payment(
        paymentId: 'PAY-2',
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 200000,
        paymentType: PaymentType.card,
        paymentDate: DateTime(2026, 8, 10),
        status: PaymentStatus.completed,
      );

      bus.publish(PaymentReceivedEvent(
        payment: payment,
        occurredAt: payment.paymentDate,
      ));

      await waitUntil(
        () => studentRepo.students.single.totalPaid == 300000,
      );
    });

    test('Student topilmasa — xato yozuv yaratilmaydi (no-op)', () async {
      final bus = EventBus();
      final studentRepo = FakeStudentRepository();

      final projector = StudentPaymentProjector(
        studentRepository: studentRepo,
        eventBus: bus,
      );
      addTearDown(projector.dispose);
      addTearDown(bus.dispose);

      final payment = Payment(
        paymentId: 'PAY-3',
        studentIdentityId: 'M-EDU-2026-999999',
        amount: 100000,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 8, 9),
        status: PaymentStatus.completed,
      );

      bus.publish(PaymentReceivedEvent(
        payment: payment,
        occurredAt: payment.paymentDate,
      ));

      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(studentRepo.students, isEmpty);
    });
  });
}

Student _student({required int totalPaid}) {
  return Student(
    identityId: 'M-EDU-2026-000001',
    studentNumber: 1,
    studentStatus: StudentStatus.active,
    totalPaid: totalPaid,
    enrolledAt: DateTime(2026, 8, 1),
  );
}
