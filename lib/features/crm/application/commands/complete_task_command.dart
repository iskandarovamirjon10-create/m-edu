import '../../../../core/error/failures.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../domain/entities/lead_task.dart';
import '../services/lead_task_service.dart';

/// CompleteTask request.
class CompleteTaskRequest {
  final String taskId;
  final String completedByUserId;

  const CompleteTaskRequest({
    required this.taskId,
    required this.completedByUserId,
  });
}

/// Lead vazifasini bajarilgan deb belgilash command'i.
class CompleteTaskCommand {
  final LeadTaskService _taskService;
  final AuditService _auditService;

  CompleteTaskCommand({
    required LeadTaskService taskService,
    required AuditService auditService,
  })  : _taskService = taskService,
        _auditService = auditService;

  Future<LeadTask> execute(CompleteTaskRequest request) async {
    try {
      final task = await _taskService.completeTask(
        taskId: request.taskId,
        completedByUserId: request.completedByUserId,
      );

      await _auditService.record(
        action: AuditAction.leadFollowUpScheduled,
        targetType: 'lead_task',
        targetId: task.taskId,
        details: 'Vazifa bajarildi: ${task.title}',
      );

      return task;
    } catch (e) {
      if (e is Failure) rethrow;
      throw ValidationFailure('Vazifani bajarishda xatolik: $e');
    }
  }
}
