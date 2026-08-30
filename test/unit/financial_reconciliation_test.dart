import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/features/students/application/services/financial_reconciliation_service.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';

import '../helpers/fake_repositories.dart';

void main() {
  group('FinancialReconciliationService (P1-001)', () {
    late FakePaymentRepository paymentRepo;
    late FakeStudentRepository studentRepo;
    late FinancialReconciliationService service;

    setUp(() {
      paymentRepo = FakePaymentRepository();
      studentRepo = FakeStudentRepository();
      service = FinancialReconciliationService(
        paymentRepository: paymentRepo,
        studentRepository: studentRepo,
      );
    });

    test('totalPaid to\'g\'ri hisoblanadi — bitta to\'lov', () async {
      studentRepo.students.add(_student(totalPaid: 0));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        status: PaymentStatus.completed,
      ));

      final fixed = await service.reconcileAll();
      expect(fixed, 1);
      expect(studentRepo.students.single.totalPaid, 300000);
      expect(studentRepo.students.single.paymentStatus, isTrue);
    });

    test('totalPaid to\'g\'ri hisoblanadi — bir nechta to\'lov', () async {
      studentRepo.students.add(_student(totalPaid: 0));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 100000,
        status: PaymentStatus.completed,
      ));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 200000,
        status: PaymentStatus.completed,
      ));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 50000,
        status: PaymentStatus.completed,
      ));

      final fixed = await service.reconcileAll();
      expect(fixed, 1);
      // 100000 + 200000 + 50000 = 350000
      // paidAmount = amount - discountAmount + lateFee
      // All payments have discountAmount=0, lateFee=0 → paidAmount = amount
      expect(studentRepo.students.single.totalPaid, 350000);
    });

    test('chegirma va late fee to\'g\'ri hisoblanadi', () async {
      studentRepo.students.add(_student(totalPaid: 0));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        discountAmount: 30000,
        lateFee: 10000,
        status: PaymentStatus.completed,
      ));
      // paidAmount = 300000 - 30000 + 10000 = 280000

      final fixed = await service.reconcileAll();
      expect(fixed, 1);
      expect(studentRepo.students.single.totalPaid, 280000);
    });

    test('failed to\'lov hisobga olinmaydi', () async {
      studentRepo.students.add(_student(totalPaid: 300000, paymentStatus: true));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        status: PaymentStatus.failed,
      ));

      final fixed = await service.reconcileAll();
      expect(fixed, 1);
      expect(studentRepo.students.single.totalPaid, 0);
      expect(studentRepo.students.single.paymentStatus, isFalse);
    });

    test('refunded to\'lov hisobga olinmaydi', () async {
      studentRepo.students.add(_student(totalPaid: 300000, paymentStatus: true));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        status: PaymentStatus.refunded,
      ));

      final fixed = await service.reconcileAll();
      expect(fixed, 1);
      expect(studentRepo.students.single.totalPaid, 0);
      expect(studentRepo.students.single.paymentStatus, isFalse);
    });

    test('pending to\'lov hisobga olinmaydi', () async {
      studentRepo.students.add(_student(totalPaid: 300000, paymentStatus: true));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        status: PaymentStatus.pending,
      ));

      final fixed = await service.reconcileAll();
      expect(fixed, 1);
      expect(studentRepo.students.single.totalPaid, 0);
      expect(studentRepo.students.single.paymentStatus, isFalse);
    });

    test('idempotent — ikkinchi marta bajarilsa tuzatish qaytadan amalga oshmaydi', () async {
      studentRepo.students.add(_student(totalPaid: 0));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        status: PaymentStatus.completed,
      ));

      final first = await service.reconcileAll();
      expect(first, 1);

      final second = await service.reconcileAll();
      expect(second, 0); // Qayta tuzatish shart emas
      expect(studentRepo.students.single.totalPaid, 300000);
    });

    test('totalPaid xato bo\'lsa tuzatiladi (crash recovery)', () async {
      // Simulyatsiya: crash tufayli totalPaid noto\'g\'ri qolgan
      studentRepo.students.add(_student(totalPaid: 100000)); // noto'g'ri
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        status: PaymentStatus.completed,
      ));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 200000,
        status: PaymentStatus.completed,
      ));

      final fixed = await service.reconcileAll();
      expect(fixed, 1);
      // 300000 + 200000 = 500000 (to'g'ri), 100000 (noto'g'ri) emas
      expect(studentRepo.students.single.totalPaid, 500000);
    });

    test('talaba topilmasa — xato tashlanmaydi', () async {
      // Bo'sh repos
      final fixed = await service.reconcileAll();
      expect(fixed, 0);
    });

    test('boshqa talabalarga tegishli to\'lovlar hisobga olinmaydi', () async {
      studentRepo.students.add(_student(
        identityId: 'M-EDU-2026-000001',
        totalPaid: 0,
      ));
      studentRepo.students.add(_student(
        identityId: 'M-EDU-2026-000002',
        totalPaid: 0,
      ));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        status: PaymentStatus.completed,
      ));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000002',
        amount: 500000,
        status: PaymentStatus.completed,
      ));

      final fixed = await service.reconcileAll();
      expect(fixed, 2);

      final s1 = studentRepo.students.firstWhere(
          (s) => s.identityId == 'M-EDU-2026-000001');
      final s2 = studentRepo.students.firstWhere(
          (s) => s.identityId == 'M-EDU-2026-000002');
      expect(s1.totalPaid, 300000);
      expect(s2.totalPaid, 500000);
    });

    test('oxirgi to\'lov sanasi yangilanadi', () async {
      studentRepo.students.add(_student(totalPaid: 0));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 100000,
        status: PaymentStatus.completed,
        paymentDate: DateTime(2026, 8, 1),
      ));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 200000,
        status: PaymentStatus.completed,
        paymentDate: DateTime(2026, 8, 15),
      ));

      final fixed = await service.reconcileAll();
      expect(fixed, 1);
      expect(studentRepo.students.single.lastPaymentDate, DateTime(2026, 8, 15));
    });

    test('to\'lovlar aralashtirilgan — faqat completed hisobga olinadi', () async {
      studentRepo.students.add(_student(totalPaid: 0));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 100000,
        status: PaymentStatus.completed,
      ));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 200000,
        status: PaymentStatus.failed,
      ));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 300000,
        status: PaymentStatus.completed,
      ));
      paymentRepo.payments.add(_payment(
        studentIdentityId: 'M-EDU-2026-000001',
        amount: 50000,
        status: PaymentStatus.refunded,
      ));

      final fixed = await service.reconcileAll();
      expect(fixed, 1);
      // Faqat completed: 100000 + 300000 = 400000
      expect(studentRepo.students.single.totalPaid, 400000);
      expect(studentRepo.students.single.paymentStatus, isTrue);
    });
  });
}

Student _student({
  String identityId = 'M-EDU-2026-000001',
  required int totalPaid,
  bool paymentStatus = false,
}) {
  return Student(
    identityId: identityId,
    studentNumber: 1,
    studentStatus: StudentStatus.active,
    totalPaid: totalPaid,
    paymentStatus: paymentStatus,
    enrolledAt: DateTime(2026, 8, 1),
  );
}

Payment _payment({
  required String studentIdentityId,
  required int amount,
  required PaymentStatus status,
  int discountAmount = 0,
  int lateFee = 0,
  DateTime? paymentDate,
}) {
  return Payment(
    paymentId: 'PAY-${DateTime.now().microsecondsSinceEpoch}',
    studentIdentityId: studentIdentityId,
    amount: amount,
    paymentType: PaymentType.cash,
    status: status,
    paymentDate: paymentDate ?? DateTime.now(),
    discountAmount: discountAmount,
    lateFee: lateFee,
  );
}
