import 'package:equatable/equatable.dart';

/// Avtomatlashtirish trigg'eri — qaysi hodisa qoidani ishga tushiradi.
enum AutomationTrigger {
  /// Yangi talaba yaratilganda.
  studentCreated,

  /// To'lov/qarz holati o'zgarganda.
  paymentChanged,

  /// Davomat belgilanganda.
  attendanceMarked,

  /// Ilova ochilganda (kunlik kontekst).
  appStarted,

  /// Tarmoq holati tiklanganda.
  networkRestored,

  /// Har qanday ma'lumot o'zgarganda (umumiy).
  dataChanged,
}

/// Bajariladigan avtomatik amal.
enum AutomationAction {
  /// Dashboard xulosasini yangilash (invalidatsiya).
  refreshDashboard,

  /// Tavsiyalarni qayta hisoblash.
  refreshRecommendations,

  /// Sinxronlashni boshlash.
  startSync,

  /// Bildirishnoma yaratish.
  createNotification,
}

/// Trigger → Condition → Action qoidasi.
///
/// Deterministik va shaffof: [condition] real ma'lumotga asoslanadi,
/// [action] aniq belgilangan. Qoida nima uchun ishga tushganini [trigger]
/// va [description] tushuntiradi.
class AutomationRule extends Equatable {
  /// Yagona qoida ID'si.
  final String id;

  /// Inson o'qiydigan tavsif (settings/audit uchun).
  final String description;

  /// Qaysi triggerda tekshiriladi.
  final AutomationTrigger trigger;

  /// Bajariladigan amal.
  final AutomationAction action;

  /// Yoqilgan/o'chirilgan (foydalanuvchi nazorati — §37).
  final bool enabled;

  const AutomationRule({
    required this.id,
    required this.description,
    required this.trigger,
    required this.action,
    this.enabled = true,
  });

  @override
  List<Object?> get props => [id, description, trigger, action, enabled];
}
