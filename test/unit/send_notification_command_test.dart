import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/notifications/application/commands/send_notification_command.dart';
import 'package:m_edu/features/notifications/domain/entities/notification.dart';
import 'package:m_edu/features/notifications/domain/events/notification_events.dart';
import 'package:m_edu/features/notifications/domain/repositories/notification_repository.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

class _FakeNotificationRepository implements NotificationRepository {
  final List<AppNotification> items = [];

  @override
  Future<AppNotification> save(AppNotification notification) async {
    items.add(notification);
    return notification;
  }

  @override
  Future<AppNotification> update(AppNotification notification) async {
    final i = items.indexWhere((n) => n.notificationId == notification.notificationId);
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
  Future<AppNotification> markAsRead(String notificationId) async =>
      throw UnimplementedError();

  @override
  Future<void> markAllAsRead({String? targetIdentityId}) async {}

  @override
  Future<int> countUnread({String? targetIdentityId}) async =>
      items.where((n) => n.status == NotificationStatus.unread).length;

  @override
  Future<AppNotification> archive(String notificationId) async =>
      throw UnimplementedError();

  @override
  Future<int> cleanupOld({int daysToKeep = 30}) async => 0;
}

void main() {
  group('SendNotificationCommand — RBAC', () {
    test('ruxsatsiz rol (unknown) → PermissionDeniedFailure, hech narsa saqlanmaydi', () async {
      final repo = _FakeNotificationRepository();
      final command = SendNotificationCommand(
        repository: repo,
        eventBus: EventBus(),
        actorRole: UserRole.unknown,
      );

      await expectLater(
        command.execute(
          const SendNotificationRequest(
            type: NotificationType.general,
            title: 'Sarlavha',
            body: 'Matn',
          ),
        ),
        throwsA(isA<PermissionDeniedFailure>()),
      );
      expect(repo.items, isEmpty);
    });

    test('ruxsatli rol (superAdmin) → muvaffaqiyatli saqlanadi', () async {
      final repo = _FakeNotificationRepository();
      final bus = EventBus();
      var eventCount = 0;
      bus.on<NotificationCreatedEvent>().listen((_) => eventCount++);
      final command = SendNotificationCommand(
        repository: repo,
        eventBus: bus,
        actorRole: UserRole.superAdmin,
      );

      final saved = await command.execute(
        const SendNotificationRequest(
          type: NotificationType.general,
          title: 'Sarlavha',
          body: 'Matn',
        ),
      );

      expect(saved.notificationId, startsWith('NTF-'));
      expect(repo.items.length, 1);
      // Broadcast stream hodisalari asinxron yetkaziladi.
      await Future<void>.delayed(Duration.zero);
      expect(eventCount, 1);
    });
  });

  group('SendNotificationCommand — validatsiya', () {
    SendNotificationCommand command() => SendNotificationCommand(
          repository: _FakeNotificationRepository(),
          eventBus: EventBus(),
          actorRole: UserRole.superAdmin,
        );

    test('bo\'sh sarlavha → ValidationFailure', () async {
      await expectLater(
        command().execute(
          const SendNotificationRequest(
            type: NotificationType.general,
            title: '   ',
            body: 'Matn',
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('bo\'sh matn → ValidationFailure', () async {
      await expectLater(
        command().execute(
          const SendNotificationRequest(
            type: NotificationType.general,
            title: 'Sarlavha',
            body: '',
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });
  });

  group('SendNotificationCommand — kanal holati (§16: yolg\'on "Sent" yo\'q)', () {
    test('in-app kanal → darhol delivered/sent', () async {
      final repo = _FakeNotificationRepository();
      final command = SendNotificationCommand(
        repository: repo,
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      final saved = await command.execute(
        const SendNotificationRequest(
          type: NotificationType.attendanceAlert,
          title: 'Davomat',
          body: 'Ali keldi',
          channel: DeliveryChannel.inApp,
        ),
      );

      expect(saved.delivered, isTrue);
      expect(saved.deliveryState, DeliveryState.sent);
      expect(saved.deliveredAt, isNotNull);
    });

    test('tashqi kanal (telegram) → queued, delivered=false (API javobsiz "sent" emas)', () async {
      final repo = _FakeNotificationRepository();
      final command = SendNotificationCommand(
        repository: repo,
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      final saved = await command.execute(
        const SendNotificationRequest(
          type: NotificationType.paymentReminder,
          title: 'To\'lov',
          body: 'Qarzdorlik',
          channel: DeliveryChannel.telegram,
          relatedId: 'DEBT-1',
        ),
      );

      expect(saved.delivered, isFalse);
      expect(saved.deliveryState, DeliveryState.queued);
      expect(saved.deliveredAt, isNull);
      expect(saved.relatedId, 'DEBT-1');
    });

    test('maqsadli bildirishnoma targetIdentityId bilan saqlanadi', () async {
      final repo = _FakeNotificationRepository();
      final command = SendNotificationCommand(
        repository: repo,
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      final saved = await command.execute(
        SendNotificationRequest(
          type: NotificationType.paymentReceived,
          title: 'To\'lov qabul qilindi',
          body: '500 000 so\'m',
          targetIdentityId: 'M-EDU-2026-000001',
        ),
      );

      expect(saved.targetIdentityId, 'M-EDU-2026-000001');
    });
  });
}
