import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/payments/application/commands/receive_payment_command.dart';
import 'package:m_edu/features/payments/domain/entities/debt.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/payments/domain/events/payment_events.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/fake_repositories.dart';

void main() {
  late FakePaymentRepository repository;
  late EventBus bus;

  setUp(() {
    repository = FakePaymentRepository();
    bus = EventBus();
  });

  tearDown(() => bus.dispose());

  ReceivePaymentCommand command(UserRole role) => ReceivePaymentCommand(
        repository: repository,
        eventBus: bus,
        actorRole: role,
      );

  const baseRequest = ReceivePaymentRequest(
    studentIdentityId: 'STU-1',
    studentName: 'Ali',
    amount: 100000,
    paymentType: PaymentType.cash,
    billingPeriod: '2026-08',
  );

  group('ReceivePaymentCommand (RBAC §32)', () {
    test('financeCreate ruxsati yo\'q rol → PermissionDeniedFailure', () {
      expect(
        () => command(UserRole.teacher).execute(baseRequest),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });

    test('noma\'lum rol (fail-closed) ham rad etiladi', () {
      expect(
        () => command(UserRole.unknown).execute(baseRequest),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });

    test('admin ruxsati bilan to\'lov qabul qilinadi', () async {
      final payment =
          await command(UserRole.admin).execute(baseRequest);
      expect(payment.status, PaymentStatus.completed);
      expect(payment.paymentId, startsWith('PAY-'));
    });
  });

  group('ReceivePaymentCommand (validatsiya)', () {
    test('bo\'sh student ID rad etiladi', () {
      expect(
        () => command(UserRole.admin).execute(
          const ReceivePaymentRequest(
            studentIdentityId: '  ',
            amount: 100000,
            paymentType: PaymentType.cash,
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('musbat bo\'lmagan summa rad etiladi', () {
      expect(
        () => command(UserRole.admin).execute(
          const ReceivePaymentRequest(
            studentIdentityId: 'STU-1',
            amount: 0,
            paymentType: PaymentType.cash,
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('chegirma summadan ko\'p bo\'lsa rad etiladi', () {
      expect(
        () => command(UserRole.admin).execute(
          const ReceivePaymentRequest(
            studentIdentityId: 'STU-1',
            amount: 100000,
            paymentType: PaymentType.cash,
            discountAmount: 150000,
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });
  });

  group('ReceivePaymentCommand (qarz bilan atomik)', () {
    test('to\'lov qarzdorlikni kamaytiradi va qisman qarzni yangilaydi',
        () async {
      repository.debts.add(Debt(
        debtId: 'DEBT-1',
        studentIdentityId: 'STU-1',
        dueDate: DateTime(2026, 8, 10),
        totalAmount: 250000,
        paidAmount: 0,
        remainingAmount: 250000,
        status: DebtStatus.outstanding,
        billingPeriod: '2026-08',
      ));

      await command(UserRole.admin).execute(baseRequest);

      final debt = repository.debts.single;
      expect(debt.status, DebtStatus.partial);
      expect(debt.paidAmount, 100000);
      expect(debt.remainingAmount, 150000);
      expect(debt.syncVersion, 2, reason: 'sync version must bump');
    });

    test('to\'liq qoplovchi to\'lov qarzni paid qiladi', () async {
      repository.debts.add(Debt(
        debtId: 'DEBT-2',
        studentIdentityId: 'STU-1',
        dueDate: DateTime(2026, 8, 10),
        totalAmount: 50000,
        paidAmount: 0,
        remainingAmount: 50000,
        status: DebtStatus.outstanding,
        billingPeriod: '2026-08',
      ));

      await command(UserRole.admin).execute(baseRequest);

      expect(repository.debts.single.status, DebtStatus.paid);
      expect(repository.debts.single.remainingAmount, 0);
    });

    test('to\'lov va qarz yangilanishi birga saqlanadi', () async {
      repository.debts.add(Debt(
        debtId: 'DEBT-3',
        studentIdentityId: 'STU-1',
        dueDate: DateTime(2026, 8, 10),
        totalAmount: 300000,
        paidAmount: 0,
        remainingAmount: 300000,
        status: DebtStatus.outstanding,
        billingPeriod: '2026-08',
      ));

      await command(UserRole.admin).execute(baseRequest);

      expect(repository.payments, hasLength(1));
      expect(repository.debts.single.paidAmount, 100000);
    });
  });

  group('ReceivePaymentCommand (event)', () {
    test('PaymentReceivedEvent tarqatiladi', () async {
      PaymentReceivedEvent? received;
      final sub = bus.on<PaymentReceivedEvent>().listen((e) => received = e);

      await command(UserRole.admin).execute(baseRequest);

      await Future<void>.delayed(Duration.zero);
      expect(received, isNotNull);
      expect(received!.payment.amount, 100000);
      expect(received!.payment.studentIdentityId, 'STU-1');
      await sub.cancel();
    });

    test('to\'lov ID mikrosekund + tasodifiy — parallel to\'lovlar noyob',
        () async {
      final results = await Future.wait([
        command(UserRole.admin).execute(baseRequest),
        command(UserRole.admin).execute(baseRequest),
      ]);
      expect(results[0].paymentId, isNot(results[1].paymentId));
    });
  });
}
