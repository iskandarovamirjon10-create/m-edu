import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/notification.dart';
import '../../domain/events/notification_events.dart';
import '../../domain/repositories/notification_repository.dart';
import '../../../payments/domain/repositories/payment_repository.dart';

/// To'lov eslatmalarini to'plam sifatida yuborish uchun command.
class SendPaymentRemindersCommand {
  final NotificationRepository _notificationRepository;
  final PaymentRepository _paymentRepository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): to'lov eslatmalari — moliya moduli.
  final UserRole actorRole;

  SendPaymentRemindersCommand({
    required NotificationRepository notificationRepository,
    required PaymentRepository paymentRepository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _notificationRepository = notificationRepository,
        _paymentRepository = paymentRepository,
        _eventBus = eventBus;

  /// Muddati o'tgan qarzdorlarga eslatma yuboradi.
  Future<int> execute() async {
    Permissions.require(actorRole, AppPermission.financeCreate);

    final overdueDebts = await _paymentRepository.fetchOverdueDebts();
    final now = DateTime.now();
    int sentCount = 0;

    for (final debt in overdueDebts) {
      // Oxirgi eslatmadan beri kamida 1 kun o'tgan bo'lishi kerak.
      if (debt.lastReminderDate != null) {
        final daysSinceLastReminder =
            now.difference(debt.lastReminderDate!).inDays;
        if (daysSinceLastReminder < 1) continue;
      }

      // Idempotency (AUDIT-FIX P1): deterministik notificationId bilan
      // takroriy yozuv yaratilsa Isar unique index xatosi (IsarError:
      // Unique index violated) tashlanadi. Agar eslatma allaqachon
      // mavjud bo'lsa — qayta yaratmaymiz.
      final existing = await _notificationRepository
          .fetchById('NTF-REMIND-${debt.debtId}');
      if (existing != null) continue;

      final notification = AppNotification(
        notificationId: 'NTF-REMIND-${debt.debtId}',
        type: NotificationType.paymentReminder,
        title: "To'lov eslatmasi",
        body:
            "${debt.studentName ?? 'Talaba'} uchun ${debt.remainingAmount} so'm "
            "to'lov muddati o'tgan. Iltimos, to'lovni amalga oshiring.",
        targetIdentityId: debt.studentIdentityId,
        relatedId: debt.debtId,
        channel: DeliveryChannel.inApp,
        delivered: true,
        deliveryState: DeliveryState.sent,
        createdAt: now,
      );

      await _notificationRepository.save(notification);

      // Qarzdorlikda eslatma yuborilganligini belgilash.
      await _paymentRepository.markReminderSent(debt.debtId);

      _eventBus.publish(PaymentReminderSentEvent(
        studentIdentityId: debt.studentIdentityId,
        amount: debt.remainingAmount,
        occurredAt: now,
      ));

      sentCount++;
    }

    return sentCount;
  }
}
