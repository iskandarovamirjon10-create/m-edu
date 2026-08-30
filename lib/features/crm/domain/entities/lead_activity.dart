import 'package:equatable/equatable.dart';

/// Lead uchun timeline yozuvi (IdentityActivity bilan BIR XIL pattern).
///
/// Har bir muhim harakat (lead yaratish, bosqich o'zgarishi, konvertatsiya,
/// yo'qotish, follow-up rejalashtirish) ushbu yozuvni generatsiya qiladi —
/// Lead Detail sahifasidagi "Faoliyat tarixi" tab'i shuni ko'rsatadi.
class LeadActivity extends Equatable {
  final String leadId;
  final String type;
  final String description;
  final DateTime occurredAt;
  
  /// Kim tomonidan amalga oshirildi (xodim identifikatsiyasi).
  final String? authoredByUserId;
  
  /// Kim tomonidan (inson o'qiydigan nom).
  final String? authoredByName;
  
  /// Qo'shimcha ma'lumotlar (JSON formatida — maxfiy bo'lmagan tafsilotlar).
  final Map<String, dynamic>? metadata;

  const LeadActivity({
    required this.leadId,
    required this.type,
    required this.description,
    required this.occurredAt,
    this.authoredByUserId,
    this.authoredByName,
    this.metadata,
  });

  LeadActivity copyWith({
    String? type,
    String? description,
    DateTime? occurredAt,
    String? authoredByUserId,
    String? authoredByName,
    Map<String, dynamic>? metadata,
  }) {
    return LeadActivity(
      leadId: leadId,
      type: type ?? this.type,
      description: description ?? this.description,
      occurredAt: occurredAt ?? this.occurredAt,
      authoredByUserId: authoredByUserId ?? this.authoredByUserId,
      authoredByName: authoredByName ?? this.authoredByName,
      metadata: metadata ?? this.metadata,
    );
  }

  @override
  List<Object?> get props => [
        leadId,
        type,
        description,
        occurredAt,
        authoredByUserId,
        authoredByName,
        metadata,
      ];
}

/// Activity turlari — biznes tili bilan nomlangan.
abstract final class LeadActivityTypes {
  /// Yangi lead qo'lga kiritildi.
  static const String captured = 'CAPTURED';

  /// Pipeline bosqichi o'zgardi.
  static const String stageChanged = 'STAGE_CHANGED';

  /// Lead yo'qotilgan deb belgilandi.
  static const String markedLost = 'MARKED_LOST';

  /// Lead Identity+Student sifatida konvertatsiya qilindi.
  static const String converted = 'CONVERTED';

  /// Keyingi aloqa sanasi belgilandi.
  static const String followUpScheduled = 'FOLLOW_UP_SCHEDULED';

  /// Lead kimga tayinlandi.
  static const String assigned = 'ASSIGNED';

  /// Final holatdan qayta ochildi (reopen — alohida audit-log'langan amal).
  static const String reopened = 'REOPENED';

  /// Lead ma'lumotlari tahrirlandi.
  static const String updated = 'UPDATED';

  /// Izoh qo'shildi.
  static const String noteAdded = 'NOTE_ADDED';

  /// Telefon qo'ng'irog'i amalga oshirildi.
  static const String callMade = 'CALL_MADE';

  /// Xabar yuborildi.
  static const String messageSent = 'MESSAGE_SENT';

  /// Uchrashuv tayinlandi.
  static const String meetingScheduled = 'MEETING_SCHEDULED';
}
