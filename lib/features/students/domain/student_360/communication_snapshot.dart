import 'package:equatable/equatable.dart';

import '../../../notifications/domain/entities/notification.dart' as notif;

/// Student 360 — COMMUNICATION snapshot.
///
/// Student'ning notification tarixini (barcha yuborilgan xabarlar —
/// Telegram, in-app) va parent Telegram bog'lanish holatini ko'rsatadi.
///
/// MUHIM: SMS tarixini M-EDU saqlamaydi (sms: intent ishlatiladi —
/// yuborilganlik holati tizimda qayd etilmaydi, [SmsService] ga qarang).
/// Shuning uchun `smsHistory` snapshot'ta bo'sh bo'ladi va `smsAvailable`
/// = false.
class CommunicationSnapshot extends Equatable {
  /// Parent Telegram bog'langanmi?
  final bool telegramLinked;

  /// Telegram chat ID (null — bog'lanmagan).
  final String? telegramChatId;

  /// Barcha yuborilgan notification'lar (in-app + Telegram delivery
  /// record'lari) — oxirgi 50 ta.
  final List<notif.AppNotification> notificationHistory;

  /// SMS history — Hozirda MAVJUD EMAS (sms: intent tashqi SMS app'ga
  /// uzatadi, M-EDU ichida log qilinmaydi).
  final List<SmsHistoryEntry> smsHistory;

  /// SMS log qo'llab-quvvatlanadimi? false = UNVERIFIED (snapshot bo'sh).
  final bool smsAvailable;

  const CommunicationSnapshot({
    required this.telegramLinked,
    required this.telegramChatId,
    required this.notificationHistory,
    required this.smsHistory,
    required this.smsAvailable,
  });

  /// Bo'sh snapshot — hech qanday aloqa tarixiga ega bo'lmagan student.
  const CommunicationSnapshot.empty()
      : telegramLinked = false,
        telegramChatId = null,
        notificationHistory = const [],
        smsHistory = const [],
        smsAvailable = false;

  @override
  List<Object?> get props => [
        telegramLinked,
        telegramChatId,
        notificationHistory,
        smsHistory,
        smsAvailable,
      ];
}

/// SMS tarixi yozuvi — Hozirda snapshot'ning `smsHistory` maydoni
/// uchun placeholder tip. M-EDU'da SMS provider integratsiyasi
/// mavjud bo'lmagani uchun bu yerda hech qachon qiymat bo'lmaydi.
/// Agar kelajakda SMS gateway qo'shilsa, shu entity'ning provider
/// adapter'i to'ldiriladi.
class SmsHistoryEntry {
  final DateTime sentAt;
  final String phone;
  final String message;
  final String? providerMessageId;

  const SmsHistoryEntry({
    required this.sentAt,
    required this.phone,
    required this.message,
    required this.providerMessageId,
  });
}
