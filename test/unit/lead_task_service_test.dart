import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/crm/domain/entities/lead_task.dart';
import 'package:m_edu/features/crm/domain/repositories/lead_task_repository.dart';
import 'package:m_edu/features/crm/application/services/lead_task_service.dart';

/// Fake implementation of LeadTaskRepository for testing.
class _FakeLeadTaskRepository implements LeadTaskRepository {
  final Map<String, LeadTask> _tasks = {};

  @override
  Future<LeadTask> save(LeadTask task) async {
    _tasks[task.taskId] = task;
    return task;
  }

  @override
  Future<LeadTask> update(LeadTask task) async {
    _tasks[task.taskId] = task;
    return task;
  }

  @override
  Future<LeadTask?> findByTaskId(String taskId) async => _tasks[taskId];

  @override
  Future<List<LeadTask>> findByLeadId(String leadId) async =>
      _tasks.values.where((t) => t.leadId == leadId).toList();

  @override
  Future<List<LeadTask>> findByAssignedUser(String userId) async =>
      _tasks.values.where((t) => t.assignedToUserId == userId).toList();

  @override
  Future<List<LeadTask>> findPendingByUser(String userId) async => _tasks
      .values
      .where((t) =>
          t.assignedToUserId == userId && t.status == LeadTaskStatus.pending)
      .toList();

  @override
  Future<List<LeadTask>> findOverdue() async {
    final now = DateTime.now();
    return _tasks.values
        .where((t) =>
            t.status == LeadTaskStatus.pending && t.dueAt.isBefore(now))
        .toList();
  }

  @override
  Future<List<LeadTask>> findPendingDueSoon(Duration window) async {
    final now = DateTime.now();
    final deadline = now.add(window);
    return _tasks.values
        .where((t) =>
            t.status == LeadTaskStatus.pending &&
            t.dueAt.isAfter(now) &&
            t.dueAt.isBefore(deadline))
        .toList();
  }

  @override
  Future<List<LeadTask>> findPendingWithoutReminder() async => _tasks.values
      .where((t) =>
          t.status == LeadTaskStatus.pending && !t.reminderSent)
      .toList();

  @override
  Future<void> deleteById(String taskId) async {
    _tasks.remove(taskId);
  }

  @override
  Future<int> countPendingByUser(String userId) async =>
      _tasks.values
          .where((t) =>
              t.assignedToUserId == userId &&
              t.status == LeadTaskStatus.pending)
          .length;
}

void main() {
  late _FakeLeadTaskRepository repo;
  late LeadTaskService service;

  setUp(() {
    repo = _FakeLeadTaskRepository();
    service = LeadTaskService(repo);
  });

  group('LeadTaskService', () {
    test('createTask creates a task with correct fields', () async {
      final task = await service.createTask(
        leadId: 'LEAD-001',
        title: 'Qo\'ng\'iroq qilish',
        description: 'Eslatma',
        type: LeadTaskType.call,
        dueAt: DateTime.now().add(const Duration(days: 1)),
        assignedToUserId: 'user@test.com',
        priority: 2,
      );

      expect(task.taskId, startsWith('TASK-'));
      expect(task.leadId, 'LEAD-001');
      expect(task.title, 'Qo\'ng\'iroq qilish');
      expect(task.type, LeadTaskType.call);
      expect(task.status, LeadTaskStatus.pending);
      expect(task.priority, 2);
      expect(task.assignedToUserId, 'user@test.com');
    });

    test('createTask rejects empty title', () async {
      expect(
        () => service.createTask(
          leadId: 'LEAD-001',
          title: '  ',
          dueAt: DateTime.now().add(const Duration(days: 1)),
          assignedToUserId: 'user@test.com',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('createTask rejects invalid priority', () async {
      expect(
        () => service.createTask(
          leadId: 'LEAD-001',
          title: 'Test',
          dueAt: DateTime.now().add(const Duration(days: 1)),
          assignedToUserId: 'user@test.com',
          priority: 0,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('completeTask marks task as completed', () async {
      final task = await service.createTask(
        leadId: 'LEAD-001',
        title: 'Test',
        dueAt: DateTime.now().add(const Duration(days: 1)),
        assignedToUserId: 'user@test.com',
      );

      final completed = await service.completeTask(
        taskId: task.taskId,
        completedByUserId: 'user@test.com',
      );

      expect(completed.status, LeadTaskStatus.completed);
      expect(completed.completedAt, isNotNull);
      expect(completed.completedByUserId, 'user@test.com');
    });

    test('completeTask throws for non-existent task', () async {
      expect(
        () => service.completeTask(
          taskId: 'TASK-NONEXISTENT',
          completedByUserId: 'user@test.com',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('completeTask throws for already completed task', () async {
      final task = await service.createTask(
        leadId: 'LEAD-001',
        title: 'Test',
        dueAt: DateTime.now().add(const Duration(days: 1)),
        assignedToUserId: 'user@test.com',
      );

      await service.completeTask(
        taskId: task.taskId,
        completedByUserId: 'user@test.com',
      );

      expect(
        () => service.completeTask(
          taskId: task.taskId,
          completedByUserId: 'user@test.com',
        ),
        throwsA(isA<StateError>()),
      );
    });

    test('cancelTask marks task as cancelled', () async {
      final task = await service.createTask(
        leadId: 'LEAD-001',
        title: 'Test',
        dueAt: DateTime.now().add(const Duration(days: 1)),
        assignedToUserId: 'user@test.com',
      );

      final cancelled = await service.cancelTask(task.taskId);
      expect(cancelled.status, LeadTaskStatus.cancelled);
    });

    test('getTodayTasks returns only due today', () async {
      final now = DateTime.now();
      final task1 = LeadTask(
        taskId: 'TASK-1',
        leadId: 'LEAD-001',
        title: 'Today task',
        dueAt: now.add(const Duration(hours: 2)),
        assignedToUserId: 'user@test.com',
        createdAt: now,
      );
      final task2 = LeadTask(
        taskId: 'TASK-2',
        leadId: 'LEAD-001',
        title: 'Future task',
        dueAt: now.add(const Duration(days: 5)),
        assignedToUserId: 'user@test.com',
        createdAt: now,
      );
      await repo.save(task1);
      await repo.save(task2);

      final todayTasks = await service.getTodayTasks('user@test.com');
      expect(todayTasks.length, 1);
      expect(todayTasks.first.title, 'Today task');
    });

    test('getOverdueTasks returns only overdue', () async {
      final now = DateTime.now();
      final task1 = LeadTask(
        taskId: 'TASK-1',
        leadId: 'LEAD-001',
        title: 'Overdue task',
        dueAt: now.subtract(const Duration(days: 1)),
        assignedToUserId: 'user@test.com',
        createdAt: now,
      );
      final task2 = LeadTask(
        taskId: 'TASK-2',
        leadId: 'LEAD-001',
        title: 'Future task',
        dueAt: now.add(const Duration(days: 5)),
        assignedToUserId: 'user@test.com',
        createdAt: now,
      );
      await repo.save(task1);
      await repo.save(task2);

      final overdueTasks = await service.getOverdueTasks('user@test.com');
      expect(overdueTasks.length, 1);
      expect(overdueTasks.first.title, 'Overdue task');
    });

    test('markReminderSent updates reminderSent flag', () async {
      final task = await service.createTask(
        leadId: 'LEAD-001',
        title: 'Test',
        dueAt: DateTime.now().add(const Duration(days: 1)),
        assignedToUserId: 'user@test.com',
      );

      expect(task.reminderSent, false);
      final updated = await service.markReminderSent(task.taskId);
      expect(updated.reminderSent, true);
    });

    test('getTasksNeedingReminder returns pending with past due', () async {
      final now = DateTime.now();
      final task1 = LeadTask(
        taskId: 'TASK-1',
        leadId: 'LEAD-001',
        title: 'Overdue no reminder',
        dueAt: now.subtract(const Duration(hours: 1)),
        assignedToUserId: 'user@test.com',
        createdAt: now,
      );
      await repo.save(task1);

      final task2 = LeadTask(
        taskId: 'TASK-2',
        leadId: 'LEAD-001',
        title: 'Already reminded',
        dueAt: now.subtract(const Duration(hours: 1)),
        assignedToUserId: 'user@test.com',
        createdAt: now,
      );
      await repo.save(task2);
      await service.markReminderSent(task2.taskId);

      final needing = await service.getTasksNeedingReminder();
      expect(needing.length, 1);
      expect(needing.first.title, 'Overdue no reminder');
    });

    test('deleteTask removes the task', () async {
      final task = await service.createTask(
        leadId: 'LEAD-001',
        title: 'To delete',
        dueAt: DateTime.now().add(const Duration(days: 1)),
        assignedToUserId: 'user@test.com',
      );

      await service.deleteTask(task.taskId);
      final found = await repo.findByTaskId(task.taskId);
      expect(found, isNull);
    });

    test('LeadTask.isOverdue is true when pending and past due', () {
      final task = LeadTask(
        taskId: 't1',
        leadId: 'l1',
        title: 'Test',
        dueAt: DateTime.now().subtract(const Duration(hours: 1)),
        assignedToUserId: 'u1',
        createdAt: DateTime.now(),
      );

      expect(task.isOverdue, true);
      expect(task.effectiveStatus, LeadTaskStatus.overdue);
    });

    test('LeadTask.isOverdue is false when completed', () {
      final task = LeadTask(
        taskId: 't1',
        leadId: 'l1',
        title: 'Test',
        dueAt: DateTime.now().subtract(const Duration(hours: 1)),
        assignedToUserId: 'u1',
        status: LeadTaskStatus.completed,
        createdAt: DateTime.now(),
      );

      expect(task.isOverdue, false);
      expect(task.effectiveStatus, LeadTaskStatus.completed);
    });

    test('LeadTask.daysOverdue returns correct count', () {
      final task = LeadTask(
        taskId: 't1',
        leadId: 'l1',
        title: 'Test',
        dueAt: DateTime.now().subtract(const Duration(days: 3)),
        assignedToUserId: 'u1',
        createdAt: DateTime.now(),
      );

      expect(task.daysOverdue, 3);
    });

    test('LeadTask.copyWith preserves unspecified fields', () {
      final original = LeadTask(
        taskId: 't1',
        leadId: 'l1',
        title: 'Original',
        dueAt: DateTime(2026),
        assignedToUserId: 'u1',
        createdAt: DateTime(2026),
        priority: 2,
      );

      final copy = original.copyWith(title: 'Updated');
      expect(copy.title, 'Updated');
      expect(copy.taskId, 't1');
      expect(copy.leadId, 'l1');
      expect(copy.priority, 2);
    });
  });
}
