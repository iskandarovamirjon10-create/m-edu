import 'package:equatable/equatable.dart';

/// Telegram hisobot yetkazish holati — har bir yuborilgan xabar uchun
/// yoziladigan audit yozuvi.
enum TelegramDeliveryStatus {
  /// Navbatda (yuborilmagan).
  pending,

  /// Yuborilmoqda.
  sending,

  /// Muvaffaqiyatli yuborildi.
  sent,

  /// Xato yuz berdi.
  failed,
}

/// Telegram hisobot yetkazish yozuvi — audit va tarix uchun.
///
/// Har bir ota-ona + oy uchun bitta yozuv. Takroriy yuborishni
/// oldini olish uchun (parentId + period) unique.
class TelegramReportDelivery extends Equatable {
  /// Isar ichki ID.
  final int? id;

  /// Yuborilgan ota-ona identity ID'si.
  final String parentId;

  /// Talaba identity ID'si (qaysi bola uchun).
  final String studentIdentityId;

  /// Telegram chat ID.
  final String telegramChatId;

  /// Hisobot davri ("2026-08" ko'rinishida).
  final String period;

  /// Yetkazish holati.
  final TelegramDeliveryStatus status;

  /// Telegram API'dan kelgan xabar ID'si (agar mavjud bo'lsa).
  final int? telegramMessageId;

  /// Urinishlar soni.
  final int attemptCount;

  /// Yaratilgan sana.
  final DateTime createdAt;

  /// Oxirgi yangilanish sanasi.
  final DateTime updatedAt;

  /// Yuborilgan sana (sent bo'lsa).
  final DateTime? sentAt;

  /// Oxirgi xato kodi.
  final String? errorCode;

  /// Oxirgi xato matni.
  final String? errorMessage;

  const TelegramReportDelivery({
    this.id,
    required this.parentId,
    required this.studentIdentityId,
    required this.telegramChatId,
    required this.period,
    this.status = TelegramDeliveryStatus.pending,
    this.telegramMessageId,
    this.attemptCount = 0,
    required this.createdAt,
    required this.updatedAt,
    this.sentAt,
    this.errorCode,
    this.errorMessage,
  });

  /// Idempotency kaliti (takroriy yuborishni oldini olish uchun).
  /// Format: "parentId-period" — bir xil ota-ona + bir xil oy = bir xil kalit.
  String get idempotencyKey => '$parentId-$period';

  bool get isPending => status == TelegramDeliveryStatus.pending;
  bool get isSent => status == TelegramDeliveryStatus.sent;
  bool get isFailed => status == TelegramDeliveryStatus.failed;
  bool get canRetry =>
      status == TelegramDeliveryStatus.failed && attemptCount < 5;

  /// Yangilangan nusxa yaratadi.
  TelegramReportDelivery copyWith({
    int? id,
    String? parentId,
    String? studentIdentityId,
    String? telegramChatId,
    String? period,
    TelegramDeliveryStatus? status,
    int? telegramMessageId,
    int? attemptCount,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? sentAt,
    String? errorCode,
    String? errorMessage,
  }) {
    return TelegramReportDelivery(
      id: id ?? this.id,
      parentId: parentId ?? this.parentId,
      studentIdentityId: studentIdentityId ?? this.studentIdentityId,
      telegramChatId: telegramChatId ?? this.telegramChatId,
      period: period ?? this.period,
      status: status ?? this.status,
      telegramMessageId: telegramMessageId ?? this.telegramMessageId,
      attemptCount: attemptCount ?? this.attemptCount,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      sentAt: sentAt ?? this.sentAt,
      errorCode: errorCode ?? this.errorCode,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  @override
  List<Object?> get props => [
        id,
        parentId,
        studentIdentityId,
        telegramChatId,
        period,
        status,
        telegramMessageId,
        attemptCount,
        createdAt,
        updatedAt,
        sentAt,
        errorCode,
        errorMessage,
      ];
}
