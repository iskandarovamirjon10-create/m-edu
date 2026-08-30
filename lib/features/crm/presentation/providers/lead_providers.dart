import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../audit/presentation/providers/audit_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../settings/presentation/providers/settings_providers.dart';
import '../../application/commands/advance_lead_stage_command.dart';
import '../../application/commands/capture_lead_command.dart';
import '../../application/commands/convert_lead_command.dart';
import '../../application/commands/mark_lead_lost_command.dart';
import '../../application/commands/schedule_follow_up_command.dart';
import '../../application/commands/update_lead_details_command.dart';
import '../../domain/entities/lead.dart';
import '../../domain/entities/lead_activity.dart';
import '../../domain/repositories/lead_repository.dart';
import '../../domain/services/lead_id_generator.dart';
import '../../infrastructure/datasources/isar_lead_datasource.dart';
import '../../infrastructure/repositories_impl/lead_repository_impl.dart';
import '../../infrastructure/sequence/lead_sequence_generator.dart';

/// Lead repository provider (Isar asosida).
final leadRepositoryProvider = Provider<LeadRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return LeadRepositoryImpl(IsarLeadDataSource(db.instance));
});

/// `LEAD-2026-000123` Real ID generator provider.
final leadIdGeneratorProvider = Provider<LeadIdGenerator>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return LeadSequenceGenerator(db.instance);
});

/// CaptureLead command (RBAC: crmLeadsCreate).
final captureLeadCommandProvider = Provider<CaptureLeadCommand>((ref) {
  return CaptureLeadCommand(
    repository: ref.watch(leadRepositoryProvider),
    idGenerator: ref.watch(leadIdGeneratorProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});

/// AdvanceLeadStage command (RBAC: crmLeadsEdit).
final advanceLeadStageCommandProvider = Provider<AdvanceLeadStageCommand>((ref) {
  return AdvanceLeadStageCommand(
    repository: ref.watch(leadRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});

/// MarkLeadLost command (RBAC: crmLeadsEdit).
final markLeadLostCommandProvider = Provider<MarkLeadLostCommand>((ref) {
  return MarkLeadLostCommand(
    repository: ref.watch(leadRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});

/// ScheduleFollowUp command (RBAC: crmLeadsEdit).
final scheduleFollowUpCommandProvider = Provider<ScheduleFollowUpCommand>((ref) {
  return ScheduleFollowUpCommand(
    repository: ref.watch(leadRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});

/// UpdateLeadDetails command (RBAC: crmLeadsEdit).
final updateLeadDetailsCommandProvider = Provider<UpdateLeadDetailsCommand>((ref) {
  return UpdateLeadDetailsCommand(
    repository: ref.watch(leadRepositoryProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});

/// ConvertLead command (RBAC: crmLeadsEdit + studentsCreate).
///
/// Identity registratsiyasi uchun mavjud RegisterIdentityCommand
/// provider'idan foydalanadi (u ham xuddi shu actor rolini ishlatadi).
final convertLeadCommandProvider = Provider<ConvertLeadCommand>((ref) {
  return ConvertLeadCommand(
    repository: ref.watch(leadRepositoryProvider),
    registerIdentity: ref.watch(registerIdentityCommandProvider),
    eventBus: ref.watch(eventBusProvider),
    auditService: ref.watch(auditServiceProvider),
    actorRole: ref.watch(actorRoleProvider),
  );
});

/// Lead ro'yxati versiyasi — event kelganda oshiriladi (event_sync).
final leadListVersionProvider = StateProvider<int>((ref) => 0);

/// Barcha lead'lar (yangi birinchi).
final leadListProvider = FutureProvider<List<Lead>>((ref) {
  ref.watch(leadListVersionProvider);
  return ref.watch(leadRepositoryProvider).fetchAll();
});

/// Kanban ustunlari uchun bosqich bo'yicha guruhlangan lead'lar.
final leadKanbanProvider =
    FutureProvider<Map<LeadStage, List<Lead>>>((ref) async {
  final leads = await ref.watch(leadListProvider.future);
  final byStage = <LeadStage, List<Lead>>{};
  for (final stage in LeadStage.values) {
    byStage[stage] = leads.where((l) => l.stage == stage).toList();
  }
  return byStage;
});

/// Lead uchun faoliyat tarixi (timeline).
final leadActivitiesProvider =
    FutureProvider.family<List<LeadActivity>, String>((ref, leadId) {
  ref.watch(leadListVersionProvider);
  return ref.watch(leadRepositoryProvider).fetchActivities(leadId);
});

/// Mas'ul tanlash uchun faol hisoblar ro'yxati.
final assignableUsersProvider = FutureProvider<List<AssignableUser>>((ref) async {
  final accounts = await ref.watch(userAccountsProvider.future);
  return accounts
      .where((a) => a.canLogin)
      .map((a) => AssignableUser(
            id: a.email,
            label: a.name.isEmpty ? a.email : '${a.name} (${a.email})',
          ))
      .toList();
});

/// Mas'ul foydalanuvchi — [id] lead.assignedToUserId'ga saqlanadi.
class AssignableUser {
  final String id;
  final String label;

  const AssignableUser({required this.id, required this.label});
}
