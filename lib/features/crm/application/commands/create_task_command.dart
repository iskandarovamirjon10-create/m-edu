import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../domain/entities/lead_task.dart';
import '../../domain/repositories/lead_task_repository.dart';
import '../../domain/repositories/lead_repository.dart';
import '../services/lead_task_service.dart';

/// CreateTask request.
class CreateTaskRequest {
  final String leadId;
  final String title;
  final String? description;
  final LeadTaskType type;
  final DateTime dueAt;
  final String assignedToUserId;
  final int priority;

  const CreateTaskRequest({
    required this.leadId,
    required this.title,
    this.description,
    this.type = LeadTaskType.reminder,
    required this.dueAt,
    required this.assignedToUserId,
    this.priority = 3,
  });
}

/// Lead'ga yangi vazifa yaratish command'i.
class CreateTaskCommand {
  final LeadTaskService _taskService;
  final LeadRepository _leadRepository;
  final EventBus _eventBus;
  final AuditService _auditService;

  CreateTaskCommand({
    required LeadTaskService taskService,
    required LeadRepository leadRepository,
    required EventBus eventBus,
    required AuditService auditService,
  })  : _taskService = taskService,
        _leadRepository = leadRepository,
        _eventBus = eventBus,
        _auditService = auditService;

  Future<LeadTask> execute(CreateTaskRequest request) async {
    // Lead mavjudligini tekshirish.
    final lead = await _leadRepository.fetchByLeadId(request.leadId);
    if (lead == null) {
      throw const NotFoundFailure('Lead topilmadi');
    }

    try {
      final task = await _taskService.createTask(
        leadId: request.leadId,
        title: request.title,
        description: request.description,
        type: request.type,
        dueAt: request.dueAt,
        assignedToUserId: request.assignedToUserId,
        priority: request.priority,
      );

      // Audit log.
      await _auditService.record(
        action: AuditAction.leadFollowUpScheduled,
        targetType: 'lead_task',
        targetId: task.taskId,
        details: '${request.title} — ${request.leadId}',
      );

      return task;
    } catch (e) {
      if (e is Failure) rethrow;
      throw ValidationFailure('Vazifa yaratishda xatolik: $e');
    }
  }
}
