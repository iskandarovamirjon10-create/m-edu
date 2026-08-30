import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/notifications/application/commands/send_monthly_report_command.dart';
import 'package:m_edu/features/notifications/domain/entities/notification.dart';
import 'package:m_edu/features/notifications/domain/entities/telegram_report_delivery.dart';
import 'package:m_edu/features/notifications/domain/repositories/notification_repository.dart';
import 'package:m_edu/features/notifications/domain/repositories/telegram_report_delivery_repository.dart';
import 'package:m_edu/features/notifications/infrastructure/services/telegram_service.dart';
import 'package:m_edu/features/reports/application/queries/monthly_report_queries.dart';
import 'package:m_edu/features/reports/domain/entities/monthly_attendance_summary.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/fake_repositories.dart';

/// TelegramService'ning yuborish natijasini boshqaradigan fake.
class _FakeTelegramService extends TelegramService {
  _FakeTelegramService({this.failFor = const {}});

  /// Yuborilishi muvaffaqiyatsiz bo'ladigan chat_id'lar to'plami.
  final Set<String> failFor;

  final List<String> sentChatIds = [];
  int sendCalls = 0;

  @override
  Future<bool> sendMessage({
    required String botToken,
    required String chatId,
    required String text,
  }) async {
    sendCalls++;
    if (failFor.contains(chatId)) return false;
    sentChatIds.add(chatId);
    return true;
  }
}

class _FakeNotificationRepository implements NotificationRepository {
  final List<AppNotification> items = [];

  @override
  Future<AppNotification> save(AppNotification notification) async {
    items.add(notification);
    return notification;
  }

  @override
  Future<AppNotification> update(AppNotification notification) async {
    final i =
        items.indexWhere((n) => n.notificationId == notification.notificationId);
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

/// Telegram yetkazish tarixi uchun fake repository.
class _FakeDeliveryRepository implements TelegramReportDeliveryRepository {
  final List<TelegramReportDelivery> items = [];
  final Set<String> alreadySent = {};

  @override
  Future<TelegramReportDelivery> save(TelegramReportDelivery delivery) async {
    items.add(delivery);
    return delivery;
  }

  @override
  Future<TelegramReportDelivery> update(TelegramReportDelivery delivery) async {
    final i = items.indexWhere(
        (d) => d.parentId == delivery.parentId && d.period == delivery.period);
    if (i >= 0) {
      items[i] = delivery;
    } else {
      items.add(delivery);
    }
    if (delivery.status == TelegramDeliveryStatus.sent) {
      alreadySent.add('${delivery.parentId}-${delivery.period}');
    }
    return delivery;
  }

  @override
  Future<TelegramReportDelivery?> findByParentAndPeriod(
    String parentId,
    String period,
  ) async {
    for (final d in items) {
      if (d.parentId == parentId && d.period == period) return d;
    }
    return null;
  }

  @override
  Future<List<TelegramReportDelivery>> fetchByParent(String parentId) async =>
      items.where((d) => d.parentId == parentId).toList();

  @override
  Future<List<TelegramReportDelivery>> fetchAll({int limit = 100}) async =>
      items.take(limit).toList();

  @override
  Future<List<TelegramReportDelivery>> fetchPending() async =>
      items.where((d) => d.isPending).toList();

  @override
  Future<List<TelegramReportDelivery>> fetchRetryable() async =>
      items.where((d) => d.canRetry).toList();

  @override
  Future<bool> isAlreadySent(String parentId, String period) async =>
      alreadySent.contains('$parentId-$period');

  @override
  Future<bool> isPending(String parentId, String period) async {
    final d = await findByParentAndPeriod(parentId, period);
    return d != null && d.isPending;
  }
}

MonthlyAttendanceSummary _summary({
  required String identityId,
  required String name,
  String? telegramId,
}) {
  return MonthlyAttendanceSummary(
    identityId: identityId,
    fullName: name,
    parentName: 'Ota-ona',
    parentTelegramId: telegramId,
    presentDays: 10,
    lateDays: 1,
    absentDays: 1,
    excusedDays: 0,
    totalSchoolDays: 12,
  );
}

void main() {
  group('SendMonthlyReportCommand — RBAC', () {
    test('ruxsatsiz rol → PermissionDeniedFailure', () async {
      final command = SendMonthlyReportCommand(
        settingsRepository: FakeSettingsRepository(),
        monthlyReportQueries: MonthlyReportQueries(
          studentRepository: FakeStudentRepository(),
          identityRepository: FakeIdentityRepository(),
          attendanceRepository: FakeAttendanceRepository(),
        ),
        notificationRepository: _FakeNotificationRepository(),
        telegramService: _FakeTelegramService(),
        deliveryRepository: _FakeDeliveryRepository(),
        eventBus: EventBus(),
        actorRole: UserRole.unknown,
      );

      await expectLater(
        command.execute(year: 2026, month: 8),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });

  group('SendMonthlyReportCommand — settings holatlari', () {
    test('sendMonthlyReport o\'chirilgan → disabled result, hech narsa yuborilmaydi', () async {
      final telegram = _FakeTelegramService();
      final command = SendMonthlyReportCommand(
        settingsRepository: FakeSettingsRepository(settings: const AppSettings()),
        monthlyReportQueries: MonthlyReportQueries(
          studentRepository: FakeStudentRepository(),
          identityRepository: FakeIdentityRepository(),
          attendanceRepository: FakeAttendanceRepository(),
        ),
        notificationRepository: _FakeNotificationRepository(),
        telegramService: telegram,
        deliveryRepository: _FakeDeliveryRepository(),
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      final result = await command.execute(year: 2026, month: 8);

      expect(result.disabled, isTrue);
      expect(result.sent, 0);
      expect(telegram.sendCalls, 0);
    });

    test('token bo\'sh → ValidationFailure (noto\'g\'ri sozlama aniq xato)', () async {
      final command = SendMonthlyReportCommand(
        settingsRepository: FakeSettingsRepository(
          settings: const AppSettings(sendMonthlyReport: true),
        ),
        monthlyReportQueries: MonthlyReportQueries(
          studentRepository: FakeStudentRepository(),
          identityRepository: FakeIdentityRepository(),
          attendanceRepository: FakeAttendanceRepository(),
        ),
        notificationRepository: _FakeNotificationRepository(),
        telegramService: _FakeTelegramService(),
        deliveryRepository: _FakeDeliveryRepository(),
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      await expectLater(
        command.execute(year: 2026, month: 8),
        throwsA(isA<ValidationFailure>()),
      );
    });
  });

  group('SendMonthlyReportCommand — yuborish oqimi', () {
    SendMonthlyReportCommand buildCommand({
      required _FakeTelegramService telegram,
      required _FakeNotificationRepository notifications,
      required List<MonthlyAttendanceSummary> summaries,
      AppSettings? settings,
      _FakeDeliveryRepository? deliveryRepo,
    }) {
      final students = FakeStudentRepository();
      final identities = FakeIdentityRepository();
      final attendance = FakeAttendanceRepository();
      final queries = _FakeMonthlyReportQueries(
        summaries: summaries,
        studentRepository: students,
        identityRepository: identities,
        attendanceRepository: attendance,
      );
      return SendMonthlyReportCommand(
        settingsRepository: FakeSettingsRepository(
          settings: settings ??
              const AppSettings(
                sendMonthlyReport: true,
                telegramBotToken: '123:TESTTOKEN',
              ),
        ),
        monthlyReportQueries: queries,
        notificationRepository: notifications,
        telegramService: telegram,
        deliveryRepository: deliveryRepo ?? _FakeDeliveryRepository(),
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );
    }

    test('faqat Telegram ID bog\'langan ota-onalarga yuboriladi (qolgani skipped)', () async {
      final telegram = _FakeTelegramService();
      final notifications = _FakeNotificationRepository();
      final command = buildCommand(
        telegram: telegram,
        notifications: notifications,
        summaries: [
          _summary(identityId: 'A', name: 'Ali', telegramId: '111'),
          _summary(identityId: 'B', name: 'Bobur'), // telegram ID yo'q
          _summary(identityId: 'C', name: 'Karim', telegramId: '333'),
        ],
      );

      final result = await command.execute(year: 2026, month: 8);

      expect(result.sent, 2);
      expect(result.skipped, 1);
      expect(result.failed, 0);
      expect(telegram.sentChatIds, ['111', '333']);
      // Ilova ichidagi bildirishnomalar ham yozilgan (audit izi).
      expect(notifications.items.length, 2);
      expect(
        notifications.items.every((n) => n.deliveryState == DeliveryState.sent),
        isTrue,
      );
    });

    test('bitta ota-onada xato bo\'lsa ham qolganlariga yuborish davom etadi (isolation)', () async {
      final telegram = _FakeTelegramService(failFor: {'222'});
      final notifications = _FakeNotificationRepository();
      final command = buildCommand(
        telegram: telegram,
        notifications: notifications,
        summaries: [
          _summary(identityId: 'A', name: 'Ali', telegramId: '111'),
          _summary(identityId: 'B', name: 'Bobur', telegramId: '222'), // fails
          _summary(identityId: 'C', name: 'Karim', telegramId: '333'),
        ],
      );

      final result = await command.execute(year: 2026, month: 8);

      expect(result.sent, 2);
      expect(result.failed, 1);
      expect(telegram.sentChatIds, ['111', '333']);
      // Muvaffaqiyatsiz bildirishnoma failed holatida, yolg'on "Sent" emas.
      final failed = notifications.items
          .firstWhere((n) => n.targetIdentityId == 'B');
      expect(failed.deliveryState, DeliveryState.failed);
      expect(failed.delivered, isFalse);
    });

    test('kamida bitta muvaffaqiyat → lastMonthlyReportSent o\'rnatiladi (qayta yuborish oldini oladi)', () async {
      final telegram = _FakeTelegramService();
      final settings = FakeSettingsRepository(
        settings: const AppSettings(
          sendMonthlyReport: true,
          telegramBotToken: '123:TESTTOKEN',
        ),
      );
      final notifications = _FakeNotificationRepository();
      final command = SendMonthlyReportCommand(
        settingsRepository: settings,
        monthlyReportQueries: MonthlyReportQueries(
          studentRepository: FakeStudentRepository(),
          identityRepository: FakeIdentityRepository(),
          attendanceRepository: FakeAttendanceRepository(),
        ),
        notificationRepository: notifications,
        telegramService: telegram,
        deliveryRepository: _FakeDeliveryRepository(),
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );
      // fetchForMonth haqiqiy query'da faol o'quvchilarsiz bo'sh bo'ladi —
      // yuborilmaydi va flag o'rnatilmaydi (hech narsa yuborilmadi).
      final result = await command.execute(year: 2026, month: 8);

      expect(result.sent, 0);
      expect(settings.settings.lastMonthlyReportSent, isNull);
    });

    test('muvaffaqiyatli yuborishdan keyin lastMonthlyReportSent saqlanadi', () async {
      final telegram = _FakeTelegramService();
      final notifications = _FakeNotificationRepository();
      final settings = FakeSettingsRepository(
        settings: const AppSettings(
          sendMonthlyReport: true,
          telegramBotToken: '123:TESTTOKEN',
        ),
      );
      final queries = _FakeMonthlyReportQueries(
        summaries: [
          _summary(identityId: 'A', name: 'Ali', telegramId: '111'),
        ],
        studentRepository: FakeStudentRepository(),
        identityRepository: FakeIdentityRepository(),
        attendanceRepository: FakeAttendanceRepository(),
      );
      final command = SendMonthlyReportCommand(
        settingsRepository: settings,
        monthlyReportQueries: queries,
        notificationRepository: notifications,
        telegramService: telegram,
        deliveryRepository: _FakeDeliveryRepository(),
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      final result = await command.execute(year: 2026, month: 8);

      expect(result.sent, 1);
      expect(settings.settings.lastMonthlyReportSent, '2026-08');
    });

    test('idempotency: allaqachon yuborilgan ota-ona qayta yuborilmaydi', () async {
      final telegram = _FakeTelegramService();
      final notifications = _FakeNotificationRepository();
      final deliveryRepo = _FakeDeliveryRepository();
      // Oldin yuborilgan deb belgilash.
      deliveryRepo.alreadySent.add('A-2026-08');
      final command = buildCommand(
        telegram: telegram,
        notifications: notifications,
        deliveryRepo: deliveryRepo,
        summaries: [
          _summary(identityId: 'A', name: 'Ali', telegramId: '111'),
          _summary(identityId: 'C', name: 'Karim', telegramId: '333'),
        ],
      );

      final result = await command.execute(year: 2026, month: 8);

      // A allaqachon yuborilgan — faqat C ga yuborilishi kerak.
      expect(result.sent, 1);
      expect(result.skipped, 1);
      expect(telegram.sentChatIds, ['333']);
    });
  });
}

/// MonthlyReportQueries — fetchForMonth'ni soxta natijalar bilan beradi
/// (qolgan metodlar real fayllardagi fake repository'larga tayanadi).
class _FakeMonthlyReportQueries extends MonthlyReportQueries {
  _FakeMonthlyReportQueries({
    required this.summaries,
    required super.studentRepository,
    required super.identityRepository,
    required super.attendanceRepository,
  });

  final List<MonthlyAttendanceSummary> summaries;

  @override
  Future<List<MonthlyAttendanceSummary>> fetchForMonth(
    int year,
    int month,
  ) async {
    return summaries;
  }
}
