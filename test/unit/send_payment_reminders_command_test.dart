import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/notifications/application/commands/send_payment_reminders_command.dart';
import 'package:m_edu/features/notifications/domain/entities/notification.dart';
import 'package:m_edu/features/notifications/domain/repositories/notification_repository.dart';
import 'package:m_edu/features/payments/domain/entities/debt.dart';

import '../helpers/fake_repositories.dart';

/// Notification uchun in-memory fake — real datasource kabi unique
/// notificationId cheklovini taqlid qiladi (Isar unique index).
class _FakeNotificationRepository implements NotificationRepository {
  final List<AppNotification> items = [];

  @override
  Future<AppNotification> save(AppNotification notification) async {
    final existing =
        items.where((n) => n.notificationId == notification.notificationId);
    if (existing.isNotEmpty) {
      throw StateError(
        'IsarError: Unique index violated (${notification.notificationId})',
      );
    }
    items.add(notification);
    return notification;
  }

  @override
  Future<AppNotification> update(AppNotification notification) async {
    final i = items
        .indexWhere((n) => n.notificationId == notification.notificationId);
    if (i < 0) {
      items.add(notification);
    } else {
      items[i] = notification;
    }
    return notification;
  }

  @override
  Future<AppNotification?> fetchById(String notificationId) async {
    for (final n in items) {
      if (n.notificationId == notificationId) return n;
    }
    return null;
  }

  @override
  Future<List<AppNotification>> fetchAll() async => List.of(items);

  @override
  Future<List<AppNotification>> fetchUnread() async =>
      items.where((n) => n.status == NotificationStatus.unread).toList();

  @override
  Future<List<AppNotification>> fetchByTarget(String identityId) async =>
      items.where((n) => n.targetIdentityId == identityId).toList();

  @override
  Future<List<AppNotification>> fetchByType(NotificationType type) async =>
      items.where((n) => n.type == type).toList();

  @override
  Future<AppNotification> markAsRead(String notificationId) async {
    final n = await fetchById(notificationId);
    if (n == null) throw Exception('Bildirishnoma topilmadi');
    return update(_withStatus(n, NotificationStatus.read));
  }

  @override
  Future<void> markAllAsRead({String? targetIdentityId}) async {}

  @override
  Future<int> countUnread({String? targetIdentityId}) async =>
      items.where((n) => n.status == NotificationStatus.unread).length;

  @override
  Future<AppNotification> archive(String notificationId) async {
    final n = await fetchById(notificationId);
    if (n == null) throw Exception('Bildirishnoma topilmadi');
    return update(_withStatus(n, NotificationStatus.archived));
  }

  static AppNotification _withStatus(
    AppNotification n,
    NotificationStatus status,
  ) {
    return AppNotification(
      notificationId: n.notificationId,
      type: n.type,
      title: n.title,
      body: n.body,
      status: status,
      targetIdentityId: n.targetIdentityId,
      relatedId: n.relatedId,
      channel: n.channel,
      delivered: n.delivered,
      createdAt: n.createdAt,
      readAt: n.readAt,
      deliveredAt: n.deliveredAt,
    );
  }

  @override
  Future<int> cleanupOld({int daysToKeep = 30}) async {
    final before = items.length;
    items.clear();
    return before;
  }
}

void main() {
  group('SendPaymentRemindersCommand (idempotency — Isar unique index)', () {
    test('birinchi yuborishda eslatma yaratiladi', () async {
      final notifications = _FakeNotificationRepository();
      final payments = FakePaymentRepository(debts: [
        Debt(
          debtId: 'DEBT-1',
          studentIdentityId: 'M-EDU-2026-000001',
          studentName: 'Ali Valiyev',
          dueDate: DateTime(2026, 1, 1),
          totalAmount: 100,
          paidAmount: 0,
          remainingAmount: 100,
          status: DebtStatus.outstanding,
          billingPeriod: '2026-01',
        ),
      ]);
      final bus = EventBus();
      final command = SendPaymentRemindersCommand(
        notificationRepository: notifications,
        paymentRepository: payments,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );

      final sent = await command.execute();

      expect(sent, 1);
      expect(notifications.items.length, 1);
      expect(
        notifications.items.first.notificationId,
        'NTF-REMIND-DEBT-1',
      );
    });

    test('takroriy yuborishda dublikat yaratilmaydi (unique index xavfi)', () async {
      final notifications = _FakeNotificationRepository();
      final payments = FakePaymentRepository(debts: [
        Debt(
          debtId: 'DEBT-1',
          studentIdentityId: 'M-EDU-2026-000001',
          studentName: 'Ali Valiyev',
          dueDate: DateTime(2026, 1, 1),
          totalAmount: 100,
          paidAmount: 0,
          remainingAmount: 100,
          status: DebtStatus.outstanding,
          billingPeriod: '2026-01',
          reminderSent: true,
          lastReminderDate: DateTime.now().subtract(const Duration(days: 2)),
        ),
      ]);
      final bus = EventBus();
      final command = SendPaymentRemindersCommand(
        notificationRepository: notifications,
        paymentRepository: payments,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );

      // 1-va 2-chi yuborish — ikkinchisi 1 kundan oldin yuborilgani uchun
      // o'tkazib yuborilishi kerak (lastReminderDate himoyasi).
      final first = await command.execute();
      final second = await command.execute();

      expect(first, 1);
      expect(second, 0);
      expect(notifications.items.length, 1);
    });

    test('markReminderSent yozilmay qolsa ham qayta eslatma yaratilmaydi', () async {
      // Xavfli ssenariy: markReminderSent muvaffaqiyatsiz bo'lsa (masalan
      // qarzdorlik endi mavjud emas) — keyingi yuborishda bitta eslatma
      // allaqachon mavjud bo'lgani uchun takroriy save bo'lmasligi kerak.
      final notifications = _FakeNotificationRepository();
      final payments = FakePaymentRepository(debts: [
        Debt(
          debtId: 'DEBT-2',
          studentIdentityId: 'M-EDU-2026-000002',
          studentName: 'Bobur Karimov',
          dueDate: DateTime(2026, 1, 1),
          totalAmount: 200,
          paidAmount: 0,
          remainingAmount: 200,
          status: DebtStatus.outstanding,
          billingPeriod: '2026-01',
        ),
      ]);
      final bus = EventBus();
      final command = SendPaymentRemindersCommand(
        notificationRepository: notifications,
        paymentRepository: payments,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );

      // Birinchi yuborish eslatmani yaratadi (markReminderSent ham ishlaydi).
      await command.execute();

      // Eslatma mavjud bo'lganda qayta yuborish — dublikat save'ga urinish
      // (unique index xato tashlaydi). Idempotency tekshiruvi buni bloklaydi.
      final sentAgain = await command.execute();

      expect(notifications.items.length, 1, reason: 'dublikat yaratilmasligi kerak');
      expect(sentAgain, 0);
    });
  });
}
