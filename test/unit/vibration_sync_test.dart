import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/app/vibration_sync.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/attendance/domain/events/attendance_events.dart';
import 'package:m_edu/features/groups/domain/entities/group.dart';
import 'package:m_edu/features/groups/domain/events/group_events.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/events/identity_events.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/payments/domain/events/payment_events.dart';

void main() {
  group('VibrationCoordinator', () {
    late EventBus bus;
    late List<VibrationIntensity> vibrations;
    late VibrationCoordinator coordinator;

    setUp(() {
      bus = EventBus();
      vibrations = [];
      coordinator = VibrationCoordinator(
        bus: bus,
        vibrate: (level) async => vibrations.add(level),
        isEnabled: () async => true,
      );
      coordinator.start();
    });

    tearDown(() => coordinator.dispose());

    Future<void> pump() => Future<void>.delayed(Duration.zero);

    test('IdentityRegisteredEvent (shaxs qo\'shildi) → heavy tebranish',
        () async {
      bus.publish(IdentityRegisteredEvent(
        identity: _identity(),
        occurredAt: DateTime.now(),
      ));
      await pump();
      expect(vibrations, [VibrationIntensity.heavy]);
    });

    test('AttendanceMarkedEvent (davomat) → heavy tebranish', () async {
      bus.publish(AttendanceMarkedEvent(
        identityId: 'M-EDU-2026-000001',
        fullName: 'Ali Valiyev',
        method: 'manual',
        timestamp: DateTime.now(),
      ));
      await pump();
      expect(vibrations, [VibrationIntensity.heavy]);
    });

    test('PaymentReceivedEvent (to\'lov) → heavy tebranish', () async {
      bus.publish(PaymentReceivedEvent(
        payment: _payment(),
        occurredAt: DateTime.now(),
      ));
      await pump();
      expect(vibrations, [VibrationIntensity.heavy]);
    });

    test('GroupCreatedEvent (guruh) → medium tebranish', () async {
      bus.publish(GroupCreatedEvent(
        group: Group(
          groupId: 'GRP-1',
          name: 'Matematika-101',
          capacity: 15,
        ),
        occurredAt: DateTime.now(),
      ));
      await pump();
      expect(vibrations, [VibrationIntensity.medium]);
    });

    test("tebranish o'chirilgan bo'lsa hech narsa bo'lmaydi", () async {
      // Alohida bus + o'chirilgan koordinator — setUp'dagi yoqilgan
      // koordinator bu hodisani eshitmasligi uchun.
      final disabledBus = EventBus();
      final disabled = VibrationCoordinator(
        bus: disabledBus,
        vibrate: (level) async => vibrations.add(level),
        isEnabled: () async => false,
      );
      disabled.start();
      addTearDown(disabled.dispose);

      disabledBus.publish(IdentityRegisteredEvent(
        identity: _identity(),
        occurredAt: DateTime.now(),
      ));
      await pump();
      expect(vibrations, isEmpty);
    });

    test('throttle: bir-biriga yaqin hodisalar bitta tebranish beradi',
        () async {
      bus.publish(IdentityRegisteredEvent(
        identity: _identity(),
        occurredAt: DateTime.now(),
      ));
      bus.publish(AttendanceMarkedEvent(
        identityId: 'M-EDU-2026-000001',
        fullName: 'Ali Valiyev',
        method: 'face',
        timestamp: DateTime.now(),
      ));
      await pump();
      expect(vibrations, hasLength(1));
    });

  });
}

Identity _identity() {
  return Identity(
    identityId: 'M-EDU-2026-000001',
    firstName: 'Ali',
    lastName: 'Valiyev',
    role: IdentityRole.student,
    status: IdentityStatus.active,
    qrSeed: 'seed-1',
    createdAt: DateTime(2026, 8, 9),
  );
}

Payment _payment() {
  return Payment(
    paymentId: 'PAY-20260809-00001',
    studentIdentityId: 'M-EDU-2026-000001',
    amount: 300000,
    paymentType: PaymentType.cash,
    paymentDate: DateTime(2026, 8, 9, 12),
    status: PaymentStatus.completed,
  );
}
