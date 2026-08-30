/// Audit log'ga yoziladigan muhim amal (§33).
enum AuditAction {
  identityRegistered,
  studentCreated,
  studentUpdated,
  studentArchived,
  studentRestored,
  studentGraduated,
  studentTransferred,
  studentDeleted,
  teacherDeleted,
  groupChanged,
  scheduleChanged,
  paymentCreated,
  debtCreated,
  expenseCreated,
  attendanceEdited,
  faceEnrolled,
  faceRemoved,
  telegramLinked,
  backupCreated,
  backupRestored,
  settingsChanged,
  // USER MANAGEMENT (PHASE E).
  userCreated,
  userUpdated,
  userStatusChanged,
  userDeleted,
  reportDeleted,
  identityMerged,
  paymentRefunded,
  paymentCancelled,
  // CRM (Lead Pipeline, spec §4).
  leadCaptured,
  leadStageChanged,
  leadMarkedLost,
  leadConverted,
  leadFollowUpScheduled,
  leadUpdated,
}

/// O'zbekcha amal nomi (UI uchun).
extension AuditActionX on AuditAction {
  String get actionLabel {
    return switch (this) {
      AuditAction.identityRegistered => "Shaxs ro'yxatdan o'tkazildi",
      AuditAction.studentCreated => 'O\'quvchi yaratildi',
      AuditAction.studentUpdated => "O'quvchi tahrirlandi",
      AuditAction.studentArchived => 'O\'quvchi arxivlandi',
      AuditAction.studentRestored => 'O\'quvchi tiklandi',
      AuditAction.studentGraduated => "O'quvchi bitirdi",
      AuditAction.studentTransferred => 'Guruhga o\'tkazildi',
      AuditAction.studentDeleted => "O'quvchi o'chirildi",
      AuditAction.teacherDeleted => "O'qituvchi o'chirildi",
      AuditAction.groupChanged => 'Guruh o\'zgardi',
      AuditAction.scheduleChanged => 'Jadval o\'zgardi',
      AuditAction.paymentCreated => 'To\'lov qabul qilindi',
      AuditAction.debtCreated => 'Qarz yaratildi',
      AuditAction.expenseCreated => 'Xarajat yozildi',
      AuditAction.attendanceEdited => 'Davomat o\'zgardi',
      AuditAction.faceEnrolled => 'Yuz ro\'yxatga olindi',
      AuditAction.faceRemoved => 'Yuz o\'chirildi',
      AuditAction.telegramLinked => 'Telegram bog\'landi',
      AuditAction.backupCreated => 'Zaxira yaratildi',
      AuditAction.backupRestored => 'Zaxira tiklandi',
      AuditAction.settingsChanged => 'Sozlamalar o\'zgardi',
      AuditAction.userCreated => 'Foydalanuvchi yaratildi',
      AuditAction.userUpdated => 'Foydalanuvchi o\'zgardi',
      AuditAction.userStatusChanged => 'Foydalanuvchi holati o\'zgardi',
      AuditAction.userDeleted => 'Foydalanuvchi o\'chirildi',
      AuditAction.reportDeleted => 'Hisobot o\'chirildi',
      AuditAction.identityMerged => 'Shaxslar birlashtirildi',
      AuditAction.paymentRefunded => 'To\'lov qaytarildi',
      AuditAction.paymentCancelled => 'To\'lov bekor qilindi',
      AuditAction.leadCaptured => 'Yangi lead qo\'lga kiritildi',
      AuditAction.leadStageChanged => 'Lead bosqichi o\'zgardi',
      AuditAction.leadMarkedLost => 'Lead yo\'qotilgan deb belgilandi',
      AuditAction.leadConverted => 'Lead konvertatsiya qilindi',
      AuditAction.leadFollowUpScheduled => 'Follow-up rejalashtirildi',
      AuditAction.leadUpdated => 'Lead tahrirlandi',
    };
  }
}

/// Amal natijasi.
enum AuditResult { success, failed }

/// Audit log yozuvi — "who, what, when, target, result" (§33).
///
/// Maxfiy qiymatlar (parol, token, yuz vektori, to'liq PII) hech qachon
/// [details]'ga yozilmaydi — faqat biznes-kontekst (ID, nom, summa).
class AuditLogEntry {
  /// Yagona audit ID.
  final String auditId;

  /// Amalni bajaruvchi (who).
  final String actorUserId;
  final String actorName;

  /// Qaysi amal (what).
  final AuditAction action;

  /// Qachon (when).
  final DateTime occurredAt;

  /// Maqsad turi (target) — masalan "student", "payment", "backup".
  final String targetType;

  /// Maqsad ID'si — masalan identityId, paymentId.
  final String targetId;

  /// Natija (result).
  final AuditResult result;

  /// Xavfsiz, maxfiy bo'lmagan tafsilot (masalan "Ali Valiyev — 300000 so'm").
  final String? details;

  const AuditLogEntry({
    required this.auditId,
    required this.actorUserId,
    required this.actorName,
    required this.action,
    required this.occurredAt,
    required this.targetType,
    required this.targetId,
    this.result = AuditResult.success,
    this.details,
  });

  /// Qisqa tavsif — qidiruv va UI uchun.
  String get description => '${action.actionLabel} • $targetType';

  /// O'zbekcha amal nomi (UI uchun).
  String get actionLabel {
    return switch (action) {
      AuditAction.identityRegistered => "Shaxs ro'yxatdan o'tkazildi",
      AuditAction.studentCreated => 'O\'quvchi yaratildi',
      AuditAction.studentUpdated => "O'quvchi tahrirlandi",
      AuditAction.studentArchived => 'O\'quvchi arxivlandi',
      AuditAction.studentRestored => 'O\'quvchi tiklandi',
      AuditAction.studentGraduated => "O'quvchi bitirdi",
      AuditAction.studentTransferred => 'Guruhga o\'tkazildi',
      AuditAction.studentDeleted => "O'quvchi o'chirildi",
      AuditAction.teacherDeleted => "O'qituvchi o'chirildi",
      AuditAction.groupChanged => 'Guruh o\'zgardi',
      AuditAction.scheduleChanged => 'Jadval o\'zgardi',
      AuditAction.paymentCreated => 'To\'lov qabul qilindi',
      AuditAction.debtCreated => 'Qarz yaratildi',
      AuditAction.expenseCreated => 'Xarajat yozildi',
      AuditAction.attendanceEdited => 'Davomat o\'zgardi',
      AuditAction.faceEnrolled => 'Yuz ro\'yxatga olindi',
      AuditAction.faceRemoved => 'Yuz o\'chirildi',
      AuditAction.telegramLinked => 'Telegram bog\'landi',
      AuditAction.backupCreated => 'Zaxira yaratildi',
      AuditAction.backupRestored => 'Zaxira tiklandi',
      AuditAction.settingsChanged => 'Sozlamalar o\'zgardi',
      AuditAction.userCreated => 'Foydalanuvchi yaratildi',
      AuditAction.userUpdated => 'Foydalanuvchi o\'zgardi',
      AuditAction.userStatusChanged => 'Foydalanuvchi holati o\'zgardi',
      AuditAction.userDeleted => 'Foydalanuvchi o\'chirildi',
      AuditAction.reportDeleted => 'Hisobot o\'chirildi',
      AuditAction.identityMerged => 'Shaxslar birlashtirildi',
      AuditAction.paymentRefunded => 'To\'lov qaytarildi',
      AuditAction.paymentCancelled => 'To\'lov bekor qilindi',
      AuditAction.leadCaptured => 'Yangi lead qo\'lga kiritildi',
      AuditAction.leadStageChanged => 'Lead bosqichi o\'zgardi',
      AuditAction.leadMarkedLost => 'Lead yo\'qotilgan deb belgilandi',
      AuditAction.leadConverted => 'Lead konvertatsiya qilindi',
      AuditAction.leadFollowUpScheduled => 'Follow-up rejalashtirildi',
      AuditAction.leadUpdated => 'Lead tahrirlandi',
    };
  }
}
