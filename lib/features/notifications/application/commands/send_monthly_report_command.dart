import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/reports/application/queries/monthly_report_queries.dart';
import '../../../../features/reports/domain/entities/monthly_attendance_summary.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../../features/settings/domain/repositories/settings_repository.dart';
import '../../../notifications/domain/entities/notification.dart';
import '../../../notifications/domain/entities/telegram_report_delivery.dart';
import '../../../notifications/domain/events/notification_events.dart';
import '../../../notifications/domain/repositories/notification_repository.dart';
import '../../../notifications/domain/repositories/telegram_report_delivery_repository.dart';
import '../../../notifications/infrastructure/services/telegram_service.dart';

/// Oylik hisobot yuborish natijasi.
class SendMonthlyReportResult {
  /// Hisobot o'chirilgan bo'lsa — true (settings'dagi toggle).
  final bool disabled;

  final int sent;

  /// Telegram ID'si yo'qligi uchun o'tkazib yuborilganlar.
  final int skipped;

  /// Xato yuz berganlar.
  final int failed;

  /// Navbatga qo'shilganlar (offline/retry uchun).
  final int queued;

  final int year;
  final int month;

  const SendMonthlyReportResult({
    this.disabled = false,
    this.sent = 0,
    this.skipped = 0,
    this.failed = 0,
    this.queued = 0,
    required this.year,
    required this.month,
  });

  int get totalAttempts => sent + skipped + failed + queued;
}

/// Oylik davomat hisobotini barcha ota-onalarga Telegram orqali yuborish.
///
/// - Settings'dagi `sendMonthlyReport` o'chirilgan bo'lsa — hech narsa
///   yuborilmaydi (result.disabled = true).
/// - Faqat Telegram ID bog'langan ota-onalarga yuboriladi.
/// - Har bir yuborish ilova ichidagi bildirishnomalarga ham yoziladi.
/// - Takroriy yuborishni oldini olish uchun delivery queue ishlatiladi.
class SendMonthlyReportCommand {
  final SettingsRepository _settingsRepository;
  final MonthlyReportQueries _monthlyReportQueries;
  final NotificationRepository _notificationRepository;
  final TelegramService _telegramService;
  final TelegramReportDeliveryRepository _deliveryRepository;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): Telegram orqali hisobot yuborish.
  final UserRole actorRole;

  SendMonthlyReportCommand({
    required SettingsRepository settingsRepository,
    required MonthlyReportQueries monthlyReportQueries,
    required NotificationRepository notificationRepository,
    required TelegramService telegramService,
    required TelegramReportDeliveryRepository deliveryRepository,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _settingsRepository = settingsRepository,
        _monthlyReportQueries = monthlyReportQueries,
        _notificationRepository = notificationRepository,
        _telegramService = telegramService,
        _deliveryRepository = deliveryRepository,
        _eventBus = eventBus;

  Future<SendMonthlyReportResult> execute({
    required int year,
    required int month,
  }) async {
    Permissions.require(actorRole, AppPermission.telegramUse);

    final settings = await _settingsRepository.getSettings();

    // Settings'dan o'chirilgan — yubormaymiz (bu xususiyatni admin
    // settings bo'limidan istalgan payt o'chirib qo'yishi mumkin).
    if (!settings.sendMonthlyReport) {
      return SendMonthlyReportResult(year: year, month: month, disabled: true);
    }

    final token = settings.telegramBotToken?.trim() ?? '';
    if (token.isEmpty) {
      throw const ValidationFailure(
        'Telegram bot token kiritilmagan — Settings → Oylik hisobot',
      );
    }

    final summaries = await _monthlyReportQueries.fetchForMonth(year, month);
    final period = '$year-${month.toString().padLeft(2, '0')}';
    var sent = 0;
    var skipped = 0;
    var failed = 0;
    var queued = 0;

    for (final summary in summaries) {
      if (!summary.hasTelegramContact) {
        skipped++;
        continue;
      }

      // Idempotency: allaqachon yuborilgan bo'lsa — o'tkazib yuboramiz.
      final alreadySent = await _deliveryRepository.isAlreadySent(
        summary.identityId,
        period,
      );
      if (alreadySent) {
        skipped++;
        continue;
      }

      // Delivery yozuvini yaratish (navbatga qo'shish).
      final delivery = TelegramReportDelivery(
        parentId: summary.identityId,
        studentIdentityId: summary.identityId,
        telegramChatId: summary.parentTelegramId!.trim(),
        period: period,
        status: TelegramDeliveryStatus.sending,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      try {
        final text = _buildMessage(settings, summary, year, month);

        // Delivery yozuvini saqlash.
        final savedDelivery = await _deliveryRepository.save(delivery);

        // Telegram API orqali yuborish.
        final ok = await _telegramService.sendMessage(
          botToken: token,
          chatId: summary.parentTelegramId!.trim(),
          text: text,
        );

        // Delivery holatini yangilash.
        final now = DateTime.now();
        if (ok) {
          await _deliveryRepository.update(
            savedDelivery.copyWith(
              status: TelegramDeliveryStatus.sent,
              attemptCount: savedDelivery.attemptCount + 1,
              sentAt: now,
              updatedAt: now,
            ),
          );
        } else {
          await _deliveryRepository.update(
            savedDelivery.copyWith(
              status: TelegramDeliveryStatus.failed,
              attemptCount: savedDelivery.attemptCount + 1,
              errorCode: 'API_FALSE',
              errorMessage: 'Telegram API ok=false qaytardi',
              updatedAt: now,
            ),
          );
        }

        // Ilova ichidagi bildirishnomalarga ham yozamiz (audit-log).
        final notification = AppNotification(
          notificationId:
              'NTF-MONTHLY-${summary.identityId}-${now.millisecondsSinceEpoch}',
          type: NotificationType.attendanceAlert,
          title: 'Oylik davomat hisoboti',
          body: _buildNotificationBody(summary, year, month, ok),
          targetIdentityId: summary.identityId,
          relatedId: period,
          channel: DeliveryChannel.telegram,
          delivered: ok,
          // §16: "Sent" faqat Telegram API haqiqiy success berganida.
          deliveryState: ok ? DeliveryState.sent : DeliveryState.failed,
          createdAt: now,
          deliveredAt: ok ? now : null,
        );
        await _notificationRepository.save(notification);

        if (ok) {
          sent++;
          _eventBus.publish(
            NotificationCreatedEvent(
              notification: notification,
              occurredAt: now,
            ),
          );
        } else {
          failed++;
        }
      } catch (_) {
        // Delivery holatini xato deb belgilash.
        final now = DateTime.now();
        final existingDelivery = await _deliveryRepository.findByParentAndPeriod(
          summary.identityId,
          period,
        );
        if (existingDelivery != null) {
          await _deliveryRepository.update(
            existingDelivery.copyWith(
              status: TelegramDeliveryStatus.failed,
              attemptCount: existingDelivery.attemptCount + 1,
              errorCode: 'EXCEPTION',
              errorMessage: 'Yuborishda xatolik yuz berdi',
              updatedAt: now,
            ),
          );
        }
        // Bitta ota-onada xato bo'lsa ham qolganlariga yuborish davom etadi.
        failed++;
      }
    }

    // Keyingi avtomatik yuborishni oldini olish uchun belgilab qo'yamiz.
    // Faqat kamida bitta xabar muvaffaqiyatli yuborilganda — aks holda
    // ota-ona bog'langach tizim qayta urinib ko'radi.
    if (sent > 0 && settings.lastMonthlyReportSent != period) {
      await _settingsRepository
          .saveSettings(settings.copyWith(lastMonthlyReportSent: period));
    }

    return SendMonthlyReportResult(
      sent: sent,
      skipped: skipped,
      failed: failed,
      queued: queued,
      year: year,
      month: month,
    );
  }

  /// Telegram xabar matnini quradi (kengaytirilgan format).
  String _buildMessage(
    AppSettings settings,
    MonthlyAttendanceSummary summary,
    int year,
    int month,
  ) {
    final monthName = _monthNameUz(month);
    final percent = summary.attendancePercent.toStringAsFixed(0);

    final lines = <String>[
      '📊 M-Edu — Oylik davomat hisoboti',
      '🗓 $monthName $year',
      '',
      '👤 ${summary.fullName}',
      if (summary.groupName != null) '🏫 Guruh: ${summary.groupName}',
      '',
      '📚 Jami darslar: ${summary.totalSchoolDays}',
      '✅ Kelgan: ${summary.presentDays} kun',
      '⏰ Kechikkan: ${summary.lateDays} kun',
      '❌ Kelmagan: ${summary.absentDays} kun',
      '📝 Sababli: ${summary.excusedDays} kun',
      '',
      '📈 Davomat: $percent%',
      '',
      'Hurmat bilan, M-Edu tizimi',
    ];
    return lines.join('\n');
  }

  /// Ilova ichidagi bildirishnoma matnini quradi.
  String _buildNotificationBody(
    MonthlyAttendanceSummary summary,
    int year,
    int month,
    bool sent,
  ) {
    final monthName = _monthNameUz(month);
    final status = sent ? 'yuborildi ✓' : 'xato ✗';
    return '${summary.fullName}: $monthName oyida '
        '${summary.presentDays} kun kelgan, '
        '${summary.lateDays} kun kechikkan, '
        '${summary.absentDays} kun kelmagan. '
        'Telegram: $status';
  }

  static String _monthNameUz(int month) {
    const months = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
      'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
    ];
    return months[month - 1];
  }
}
