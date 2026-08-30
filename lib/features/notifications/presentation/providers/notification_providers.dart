import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';
import '../../application/commands/generate_telegram_linking_token_command.dart';
import '../../application/commands/process_telegram_linking_command.dart';
import '../../application/commands/send_monthly_report_command.dart';
import '../../application/commands/send_notification_command.dart';
import '../../application/commands/send_payment_reminders_command.dart';
import '../../application/commands/sync_telegram_contacts_command.dart';
import '../../application/queries/notification_queries.dart';
import '../../domain/entities/notification.dart';
import '../../domain/repositories/notification_repository.dart';
import '../../domain/repositories/telegram_linking_token_repository.dart';
import '../../domain/repositories/telegram_report_delivery_repository.dart';
import '../../infrastructure/datasources/isar_notification_datasource.dart';
import '../../infrastructure/datasources/isar_telegram_linking_token_datasource.dart';
import '../../infrastructure/datasources/isar_telegram_report_delivery_datasource.dart';
import '../../infrastructure/repositories_impl/notification_repository_impl.dart';
import '../../infrastructure/repositories_impl/telegram_linking_token_repository_impl.dart';
import '../../infrastructure/repositories_impl/telegram_report_delivery_repository_impl.dart';
import '../../infrastructure/services/sms_service.dart';
import '../../infrastructure/services/telegram_service.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../../../reports/presentation/providers/report_providers.dart';
import '../../../settings/presentation/providers/settings_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';

/// Notification repository provider.
final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return NotificationRepositoryImpl(IsarNotificationDataSource(db.instance));
});

/// Notification queries provider.
final notificationQueriesProvider = Provider<NotificationQueries>(
  (ref) => NotificationQueries(
    repository: ref.watch(notificationRepositoryProvider),
  ),
);

/// SMS yuborish xizmati (url_launcher `sms:` intent orqali).
final smsServiceProvider = Provider<SmsService>((ref) => const SmsService());

/// Send notification command provider.
final sendNotificationCommandProvider = Provider<SendNotificationCommand>(
  (ref) => SendNotificationCommand(
    repository: ref.watch(notificationRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Send payment reminders command provider.
final sendPaymentRemindersCommandProvider =
    Provider<SendPaymentRemindersCommand>(
  (ref) => SendPaymentRemindersCommand(
    notificationRepository: ref.watch(notificationRepositoryProvider),
    paymentRepository: ref.watch(paymentRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Telegram Bot API xizmati.
final telegramServiceProvider = Provider<TelegramService>(
  (ref) => TelegramService(),
);

/// Telegram bog'lash tokenlari repository.
final telegramLinkingTokenRepositoryProvider =
    Provider<TelegramLinkingTokenRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return TelegramLinkingTokenRepositoryImpl(
    IsarTelegramLinkingTokenDataSource(db.instance),
  );
});

/// Telegram hisobot yetkazish tarixi repository.
final telegramReportDeliveryRepositoryProvider =
    Provider<TelegramReportDeliveryRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return TelegramReportDeliveryRepositoryImpl(
    IsarTelegramReportDeliveryDataSource(db.instance),
  );
});

/// Oylik davomat hisobotini Telegram orqali yuborish command'i.
final sendMonthlyReportCommandProvider = Provider<SendMonthlyReportCommand>(
  (ref) => SendMonthlyReportCommand(
    settingsRepository: ref.watch(settingsRepositoryProvider),
    monthlyReportQueries: ref.watch(monthlyReportQueriesProvider),
    notificationRepository: ref.watch(notificationRepositoryProvider),
    telegramService: ref.watch(telegramServiceProvider),
    deliveryRepository: ref.watch(telegramReportDeliveryRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Telefon raqam → Telegram chat ID bog'lash command'i.
final syncTelegramContactsCommandProvider =
    Provider<SyncTelegramContactsCommand>(
  (ref) => SyncTelegramContactsCommand(
    settingsRepository: ref.watch(settingsRepositoryProvider),
    studentRepository: ref.watch(studentRepositoryProvider),
    telegramService: ref.watch(telegramServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Telegram bog'lash tokeni yaratish command'i.
final generateTelegramLinkingTokenCommandProvider =
    Provider<GenerateTelegramLinkingTokenCommand>(
  (ref) => GenerateTelegramLinkingTokenCommand(
    tokenRepository: ref.watch(telegramLinkingTokenRepositoryProvider),
    settingsRepository: ref.watch(settingsRepositoryProvider),
    telegramService: ref.watch(telegramServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Telegram bog'lash tokenini qayta ishlash command'i (bot callback uchun).
final processTelegramLinkingCommandProvider =
    Provider<ProcessTelegramLinkingCommand>(
  (ref) => ProcessTelegramLinkingCommand(
    tokenRepository: ref.watch(telegramLinkingTokenRepositoryProvider),
    studentRepository: ref.watch(studentRepositoryProvider),
  ),
);

/// Ro'yxatlarni yangilash uchun versiya hisoblagichi.
final notificationListVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha bildirishnomalar ro'yxati.
final notificationListProvider = FutureProvider<List<AppNotification>>((ref) {
  ref.watch(notificationListVersionProvider);
  return ref.watch(notificationQueriesProvider).fetchAll();
});

/// O'qilmagan bildirishnomalar.
final unreadNotificationsProvider = FutureProvider<List<AppNotification>>((ref) {
  ref.watch(notificationListVersionProvider);
  return ref.watch(notificationQueriesProvider).fetchUnread();
});

/// O'qilmaganlar soni.
final unreadCountProvider = FutureProvider<int>((ref) {
  ref.watch(notificationListVersionProvider);
  return ref.watch(notificationQueriesProvider).countUnread();
});

/// So'nggi bildirishnomalar (cheklangan).
final recentNotificationsProvider = FutureProvider<List<AppNotification>>((ref) {
  ref.watch(notificationListVersionProvider);
  return ref.watch(notificationQueriesProvider).fetchRecent(limit: 10);
});

/// Telegram yetkazish tarixi.
final telegramDeliveryHistoryProvider =
    FutureProvider<List<dynamic>>((ref) async {
  final repo = ref.watch(telegramReportDeliveryRepositoryProvider);
  return repo.fetchAll(limit: 50);
});
