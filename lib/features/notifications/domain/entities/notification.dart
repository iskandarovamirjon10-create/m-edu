import 'package:equatable/equatable.dart';

/// Bildirishnoma turi.
enum NotificationType {
  paymentReminder,
  paymentReceived,
  attendanceAlert,
  scheduleChange,
  general,
  system,
}

/// Bildirishnoma holati.
enum NotificationStatus { unread, read, archived }

/// Yetkazish kanali.
enum DeliveryChannel { inApp, push, sms, telegram }

/// Xabarni yetkazish holati (§16: QUEUED → SENDING → SENT / FAILED).
///
/// In-app xabarlar darhol `sent` bo'ladi; Telegram kabi tashqi kanallar
/// `queued` dan boshlanadi va API javobiga qarab `sent`/`failed` ga o'tadi.
/// "Sent" faqat API muvaffaqiyatli bo'lganda ko'rsatiladi.
enum DeliveryState { queued, sending, sent, failed }

/// Bildirishnoma entity'si (spec §6 #38-40).
///
/// Bildirishnoma quyidagi ma'lumotlarni saqlaydi:
/// - Bildirishnoma ID
/// - Tur (to'lov eslatmasi, davomat, umumiy)
/// - Sarlavha
/// - Matn
/// - Holati (o'qilgan/o'qilmagan)
/// - Maqsadli (talaba/o'qituvchi/admin)
/// - Yetkazish kanali
class AppNotification extends Equatable {
  /// Bildirishnomaning yagona identifikatori.
  final String notificationId;

  /// Bildirishnoma turi.
  final NotificationType type;

  /// Sarlavha.
  final String title;

  /// Matn.
  final String body;

  /// Bildirishnoma holati.
  final NotificationStatus status;

  /// Maqsadli identity ID (null = barchaga).
  final String? targetIdentityId;

  /// Bog'langan ma'lumot ID (masalan, paymentId, studentId).
  final String? relatedId;

  /// Yetkazish kanali.
  final DeliveryChannel channel;

  /// Yetkazilganligi.
  final bool delivered;

  /// Yetkazish holati (queued/sending/sent/failed).
  final DeliveryState deliveryState;

  /// Yaratilgan sana.
  final DateTime createdAt;

  /// O'qilgan sana.
  final DateTime? readAt;

  /// Yetkazilgan sana.
  final DateTime? deliveredAt;

  const AppNotification({
    required this.notificationId,
    required this.type,
    required this.title,
    required this.body,
    this.status = NotificationStatus.unread,
    this.targetIdentityId,
    this.relatedId,
    this.channel = DeliveryChannel.inApp,
    this.delivered = false,
    this.deliveryState = DeliveryState.queued,
    required this.createdAt,
    this.readAt,
    this.deliveredAt,
  });

  bool get isUnread => status == NotificationStatus.unread;
  bool get isRead => status == NotificationStatus.read;

  /// Bildirishnoma ikoni.
  String get icon {
    return switch (type) {
      NotificationType.paymentReminder => '💰',
      NotificationType.paymentReceived => '✅',
      NotificationType.attendanceAlert => '⚠️',
      NotificationType.scheduleChange => '📅',
      NotificationType.general => '📢',
      NotificationType.system => '⚙️',
    };
  }

  /// Kanal nomi.
  String get channelName {
    return switch (channel) {
      DeliveryChannel.inApp => 'Ilova ichida',
      DeliveryChannel.push => 'Push',
      DeliveryChannel.sms => 'SMS',
      DeliveryChannel.telegram => 'Telegram',
    };
  }

  /// Yetkazish holati nomi (UI chip uchun).
  String get deliveryStateLabel {
    return switch (deliveryState) {
      DeliveryState.queued => 'Navbatda',
      DeliveryState.sending => 'Yuborilmoqda…',
      DeliveryState.sent => 'Yuborildi',
      DeliveryState.failed => 'Xato',
    };
  }

  @override
  List<Object?> get props => [
        notificationId,
        type,
        title,
        body,
        status,
        targetIdentityId,
        relatedId,
        channel,
        delivered,
        deliveryState,
        createdAt,
        readAt,
        deliveredAt,
      ];
}
