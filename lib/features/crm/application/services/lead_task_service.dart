import '../../domain/entities/lead_task.dart';
import '../../domain/repositories/lead_task_repository.dart';

/// Lead task biznes logikasi — CRUD, eslatmalar, muddat o'tish tekshiruvi.
class LeadTaskService {
  final LeadTaskRepository _repository;

  LeadTaskService(this._repository);

  /// Yangi vazifa yaratadi (ID generatsiya qilinadi).
  Future<LeadTask> createTask({
    required String leadId,
    required String title,
    String? description,
    LeadTaskType type = LeadTaskType.reminder,
    required DateTime dueAt,
    required String assignedToUserId,
    int priority = 3,
  }) {
    // Validatsiya
    if (title.trim().isEmpty) {
      throw ArgumentError('Vazifa nomi bo\'sh bo\'lmasligi kerak');
    }
    if (priority < 1 || priority > 5) {
      throw ArgumentError('Prioritet 1-5 oralig\'ida bo\'lishi kerak');
    }

    final now = DateTime.now();
    final task = LeadTask(
      taskId: 'TASK-${now.millisecondsSinceEpoch}-'
          '${leadId.hashCode.abs().toString().padLeft(6, '0')}',
      leadId: leadId,
      title: title.trim(),
      description: description?.trim(),
      type: type,
      dueAt: dueAt,
      assignedToUserId: assignedToUserId,
      priority: priority,
      createdAt: now,
    );

    return _repository.save(task);
  }

  /// Vazifani bajarilgan deb belgilaydi.
  Future<LeadTask> completeTask({
    required String taskId,
    required String completedByUserId,
  }) async {
    final task = await _repository.findByTaskId(taskId);
    if (task == null) {
      throw ArgumentError('Vazifa topilmadi: $taskId');
    }
    if (task.status != LeadTaskStatus.pending) {
      throw StateError(
        'Faqat pending vazifalar bajarilgan deb belgilanishi mumkin',
      );
    }

    final updated = task.copyWith(
      status: LeadTaskStatus.completed,
      completedAt: DateTime.now(),
      completedByUserId: completedByUserId,
      updatedAt: DateTime.now(),
    );

    return _repository.update(updated);
  }

  /// Vazifani bekor qiladi.
  Future<LeadTask> cancelTask(String taskId) async {
    final task = await _repository.findByTaskId(taskId);
    if (task == null) {
      throw ArgumentError('Vazifa topilmadi: $taskId');
    }

    final updated = task.copyWith(
      status: LeadTaskStatus.cancelled,
      updatedAt: DateTime.now(),
    );

    return _repository.update(updated);
  }

  /// Eslatma yuborilgan deb belgilaydi.
  Future<LeadTask> markReminderSent(String taskId) async {
    final task = await _repository.findByTaskId(taskId);
    if (task == null) {
      throw ArgumentError('Vazifa topilmadi: $taskId');
    }

    final updated = task.copyWith(
      reminderSent: true,
      updatedAt: DateTime.now(),
    );

    return _repository.update(updated);
  }

  /// Foydalanuvchining "Bugungi vazifalar" ro'yxati.
  Future<List<LeadTask>> getTodayTasks(String userId) async {
    final pending = await _repository.findPendingByUser(userId);
    final now = DateTime.now();
    final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59);

    return pending.where((t) => t.dueAt.isBefore(endOfDay)).toList();
  }

  /// Foydalanuvchining muddati o'tgan vazifalari.
  Future<List<LeadTask>> getOverdueTasks(String userId) async {
    final pending = await _repository.findPendingByUser(userId);
    return pending.where((t) => t.isOverdue).toList();
  }

  /// Muddati 3 kun ichida tugaydigan vazifalar (eslatma uchun).
  Future<List<LeadTask>> getDueSoonTasks(String userId) async {
    return _repository.findPendingDueSoon(const Duration(days: 3));
  }

  /// Eslatma yuborishi kerak bo'lgan vazifalar (muddati yetgan va
  /// eslatma hali yuborilmagan).
  Future<List<LeadTask>> getTasksNeedingReminder() async {
    final withoutReminder = await _repository.findPendingWithoutReminder();
    final now = DateTime.now();
    return withoutReminder.where((t) => t.dueAt.isBefore(now)).toList();
  }

  /// Lead'ning barcha vazifalari.
  Future<List<LeadTask>> getLeadTasks(String leadId) async {
    return _repository.findByLeadId(leadId);
  }

  /// Vazifani o'chirish.
  Future<void> deleteTask(String taskId) {
    return _repository.deleteById(taskId);
  }
}
