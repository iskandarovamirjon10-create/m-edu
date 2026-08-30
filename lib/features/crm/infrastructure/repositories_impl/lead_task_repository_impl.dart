import '../../domain/entities/lead_task.dart';
import '../../domain/repositories/lead_task_repository.dart';
import '../datasources/isar_task_datasource.dart';
import '../models/lead_task_record.dart';

/// `LeadTaskRepository` interfeysining Isar asosidagi implementatsiyasi.
class LeadTaskRepositoryImpl implements LeadTaskRepository {
  final IsarTaskDataSource _datasource;

  LeadTaskRepositoryImpl(this._datasource);

  @override
  Future<LeadTask> save(LeadTask task) async {
    final saved = await _datasource.insert(_toRecord(task));
    return _toEntity(saved);
  }

  @override
  Future<LeadTask> update(LeadTask task) async {
    final saved = await _datasource.update(_toRecord(task));
    return _toEntity(saved);
  }

  @override
  Future<LeadTask?> findByTaskId(String taskId) async {
    final record = await _datasource.findById(taskId);
    return record == null ? null : _toEntity(record);
  }

  @override
  Future<List<LeadTask>> findByLeadId(String leadId) async {
    final records = await _datasource.findByLeadId(leadId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<LeadTask>> findByAssignedUser(String userId) async {
    final records = await _datasource.findByAssignedUser(userId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<LeadTask>> findPendingByUser(String userId) async {
    final records = await _datasource.findPendingByUser(userId);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<LeadTask>> findOverdue() async {
    final records = await _datasource.findOverdue();
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<LeadTask>> findPendingDueSoon(Duration window) async {
    final records = await _datasource.findPendingDueSoon(window);
    return records.map(_toEntity).toList();
  }

  @override
  Future<List<LeadTask>> findPendingWithoutReminder() async {
    final records = await _datasource.findPendingWithoutReminder();
    return records.map(_toEntity).toList();
  }

  @override
  Future<void> deleteById(String taskId) async {
    await _datasource.deleteById(taskId);
  }

  @override
  Future<int> countPendingByUser(String userId) async {
    return _datasource.countPendingByUser(userId);
  }

  // ─── Mapping ──────────────────────────────────────────────────────

  LeadTaskRecord _toRecord(LeadTask task) {
    return LeadTaskRecord()
      ..taskId = task.taskId
      ..leadId = task.leadId
      ..title = task.title
      ..description = task.description
      ..type = task.type.name
      ..dueAt = task.dueAt
      ..assignedToUserId = task.assignedToUserId
      ..status = task.status.name
      ..priority = task.priority
      ..reminderSent = task.reminderSent
      ..completedAt = task.completedAt
      ..completedByUserId = task.completedByUserId
      ..createdAt = task.createdAt
      ..updatedAt = task.updatedAt;
  }

  LeadTask _toEntity(LeadTaskRecord record) {
    return LeadTask(
      taskId: record.taskId,
      leadId: record.leadId,
      title: record.title,
      description: record.description,
      type: _typeOf(record.type),
      dueAt: record.dueAt,
      assignedToUserId: record.assignedToUserId,
      status: _statusOf(record.status),
      priority: record.priority,
      reminderSent: record.reminderSent,
      completedAt: record.completedAt,
      completedByUserId: record.completedByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    );
  }

  static LeadTaskType _typeOf(String value) {
    for (final t in LeadTaskType.values) {
      if (t.name == value) return t;
    }
    return LeadTaskType.other;
  }

  static LeadTaskStatus _statusOf(String value) {
    for (final s in LeadTaskStatus.values) {
      if (s.name == value) return s;
    }
    return LeadTaskStatus.pending;
  }
}
