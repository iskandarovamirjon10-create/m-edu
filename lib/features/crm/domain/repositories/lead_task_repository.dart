import '../entities/lead_task.dart';

/// Lead task saqlash va o'qish uchun repository interfeysi.
abstract class LeadTaskRepository {
  /// Yangi vazifani saqlaydi.
  Future<LeadTask> save(LeadTask task);

  /// Vazifani yangilaydi.
  Future<LeadTask> update(LeadTask task);

  /// Vazifani topadi.
  Future<LeadTask?> findByTaskId(String taskId);

  /// Lead'ga tegishli barcha vazifalar.
  Future<List<LeadTask>> findByLeadId(String leadId);

  /// Foydalanuvchiga tayinlangan barcha vazifalar.
  Future<List<LeadTask>> findByAssignedUser(String userId);

  /// Foydalanuvchining bajarilmagan vazifalari (prioritet va muddat bo'yicha).
  Future<List<LeadTask>> findPendingByUser(String userId);

  /// Muddati o'tgan vazifalar.
  Future<List<LeadTask>> findOverdue();

  /// Muddati yaqinlashayotgan vazifalar (berilgan vaqt ichida).
  Future<List<LeadTask>> findPendingDueSoon(Duration window);

  /// Eslatma yuborilmagan pending vazifalar.
  Future<List<LeadTask>> findPendingWithoutReminder();

  /// Vazifani o'chirish.
  Future<void> deleteById(String taskId);

  /// Bajarilmagan vazifalar soni (foydalanuvchi bo'yicha).
  Future<int> countPendingByUser(String userId);
}
