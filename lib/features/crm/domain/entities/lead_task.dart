import 'package:equatable/equatable.dart';

/// Vazifa holati.
enum LeadTaskStatus {
  /// Yangi, hali bajarilmagan.
  pending,

  /// Bajarilgan (completed).
  completed,

  /// Bekor qililgan.
  cancelled,

  /// Muddati o'tgan (overdue — avtomatik hisoblanadi).
  overdue;

  bool get isPending => this == LeadTaskStatus.pending;
  bool get isCompleted => this == LeadTaskStatus.completed;
  bool get isCancelled => this == LeadTaskStatus.cancelled;
  bool get isOverdue => this == LeadTaskStatus.overdue;
}

/// Vazifa turi — UI va filtrlash uchun.
enum LeadTaskType {
  /// Qo'ng'iroq.
  call,

  /// Xabar yuborish.
  message,

  /// Uchrashuv.
  meeting,

  /// Hujjat yuborish (shartnoma, taklifnomа).
  document,

  /// Umumiy eslatma.
  reminder,

  /// Boshqa.
  other;

  String get label => switch (this) {
        LeadTaskType.call => 'Qo\'ng\'iroq',
        LeadTaskType.message => 'Xabar',
        LeadTaskType.meeting => 'Uchrashuv',
        LeadTaskType.document => 'Hujjat',
        LeadTaskType.reminder => 'Eslatma',
        LeadTaskType.other => 'Boshqa',
      };
}

/// CRM lead'ga bog'langan vazifa.
///
/// Har bir vazifa:
/// - Bitta lead'ga bog'langan (leadId)
/// - Mas'ul xodim bor (assignedToUserId)
/// - Muddat bor (dueAt)
/// - Holati bor (status)
/// - Prioritet bor (priority: 1-5, 1 = eng muhim)
class LeadTask extends Equatable {
  /// Yagona task ID.
  final String taskId;

  /// Qaysi lead'ga tegishli.
  final String leadId;

  /// Vazifa nomi (masalan "3 kundan keyin qayta qo'ng'iroq qilish").
  final String title;

  /// Batafsil tavsif.
  final String? description;

  /// Vazifa turi.
  final LeadTaskType type;

  /// Muddati.
  final DateTime dueAt;

  /// Mas'ul xodim ID.
  final String assignedToUserId;

  /// Vazifa holati.
  final LeadTaskStatus status;

  /// Prioritet: 1 = eng muhim, 5 = eng kam muhim.
  final int priority;

  /// Eslatma yuborilganmi?
  final bool reminderSent;

  /// Bajarilgan sana (completed bo'lsa).
  final DateTime? completedAt;

  /// Kim bajarilgani (completed bo'lsa).
  final String? completedByUserId;

  /// Yaratilgan sana.
  final DateTime createdAt;

  /// Yangilangan sana.
  final DateTime? updatedAt;

  const LeadTask({
    required this.taskId,
    required this.leadId,
    required this.title,
    this.description,
    this.type = LeadTaskType.reminder,
    required this.dueAt,
    required this.assignedToUserId,
    this.status = LeadTaskStatus.pending,
    this.priority = 3,
    this.reminderSent = false,
    this.completedAt,
    this.completedByUserId,
    required this.createdAt,
    this.updatedAt,
  });

  /// Muddati o'tganmi? (pending va dueAt o'tgan bo'lsa).
  bool get isOverdue =>
      status == LeadTaskStatus.pending &&
      DateTime.now().isAfter(dueAt);

  /// Joriy holat (overdue avtomatik aniqlash bilan).
  LeadTaskStatus get effectiveStatus =>
      isOverdue ? LeadTaskStatus.overdue : status;

  /// Muddatgacha qancha vaqt qoldi.
  Duration? get timeUntilDue {
    if (status != LeadTaskStatus.pending) return null;
    final diff = dueAt.difference(DateTime.now());
    return diff.isNegative ? Duration.zero : diff;
  }

  /// Muddatdan necha kun o'tdi (overdue bo'lsa).
  int get daysOverdue {
    if (!isOverdue) return 0;
    return DateTime.now().difference(dueAt).inDays;
  }

  LeadTask copyWith({
    String? title,
    String? description,
    LeadTaskType? type,
    DateTime? dueAt,
    String? assignedToUserId,
    LeadTaskStatus? status,
    int? priority,
    bool? reminderSent,
    DateTime? completedAt,
    String? completedByUserId,
    DateTime? updatedAt,
  }) {
    return LeadTask(
      taskId: taskId,
      leadId: leadId,
      title: title ?? this.title,
      description: description ?? this.description,
      type: type ?? this.type,
      dueAt: dueAt ?? this.dueAt,
      assignedToUserId: assignedToUserId ?? this.assignedToUserId,
      status: status ?? this.status,
      priority: priority ?? this.priority,
      reminderSent: reminderSent ?? this.reminderSent,
      completedAt: completedAt ?? this.completedAt,
      completedByUserId: completedByUserId ?? this.completedByUserId,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  List<Object?> get props => [
        taskId,
        leadId,
        title,
        description,
        type,
        dueAt,
        assignedToUserId,
        status,
        priority,
        reminderSent,
        completedAt,
        completedByUserId,
        createdAt,
        updatedAt,
      ];
}
