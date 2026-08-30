import 'package:isar/isar.dart';

import '../models/lead_task_record.dart';

/// Isar asosidagi lead task datasource.
class IsarTaskDataSource {
  final Isar _db;

  IsarTaskDataSource(this._db);

  Future<LeadTaskRecord> insert(LeadTaskRecord record) async {
    await _db.writeTxn(() async {
      await _db.leadTaskRecords.put(record);
    });
    return record;
  }

  Future<LeadTaskRecord> update(LeadTaskRecord record) async {
    return _db.writeTxn(() async {
      final existing = await _db.leadTaskRecords
          .filter()
          .taskIdEqualTo(record.taskId)
          .findFirst();
      if (existing != null) {
        record.id = existing.id;
      }
      await _db.leadTaskRecords.put(record);
      return record;
    });
  }

  Future<LeadTaskRecord?> findById(String taskId) {
    return _db.leadTaskRecords
        .filter()
        .taskIdEqualTo(taskId)
        .findFirst();
  }

  Future<List<LeadTaskRecord>> findByLeadId(String leadId) {
    return _db.leadTaskRecords
        .filter()
        .leadIdEqualTo(leadId)
        .sortByDueAt()
        .findAll();
  }

  Future<List<LeadTaskRecord>> findByAssignedUser(String userId) {
    return _db.leadTaskRecords
        .filter()
        .assignedToUserIdEqualTo(userId)
        .sortByDueAt()
        .findAll();
  }

  Future<List<LeadTaskRecord>> findPendingByUser(String userId) {
    return _db.leadTaskRecords
        .filter()
        .assignedToUserIdEqualTo(userId)
        .statusEqualTo('pending')
        .sortByPriority()
        .thenByDueAt()
        .findAll();
  }

  Future<List<LeadTaskRecord>> findOverdue() {
    final now = DateTime.now();
    return _db.leadTaskRecords
        .filter()
        .statusEqualTo('pending')
        .dueAtLessThan(now)
        .sortByDueAt()
        .findAll();
  }

  Future<List<LeadTaskRecord>> findPendingDueSoon(Duration window) {
    final now = DateTime.now();
    final deadline = now.add(window);
    return _db.leadTaskRecords
        .filter()
        .statusEqualTo('pending')
        .dueAtBetween(now, deadline)
        .sortByDueAt()
        .findAll();
  }

  Future<List<LeadTaskRecord>> findPendingWithoutReminder() {
    return _db.leadTaskRecords
        .filter()
        .statusEqualTo('pending')
        .reminderSentEqualTo(false)
        .findAll();
  }

  Future<int> countByStatus(String status) {
    return _db.leadTaskRecords
        .filter()
        .statusEqualTo(status)
        .count();
  }

  Future<int> countPendingByUser(String userId) {
    return _db.leadTaskRecords
        .filter()
        .assignedToUserIdEqualTo(userId)
        .statusEqualTo('pending')
        .count();
  }

  Future<void> deleteById(String taskId) async {
    await _db.writeTxn(() async {
      final record = await _db.leadTaskRecords
          .filter()
          .taskIdEqualTo(taskId)
          .findFirst();
      if (record != null) {
        await _db.leadTaskRecords.delete(record.id);
      }
    });
  }
}
