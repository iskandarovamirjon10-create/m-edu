import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/security/permissions.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/glass_card.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../application/commands/advance_lead_stage_command.dart';
import '../../application/commands/convert_lead_command.dart';
import '../../application/commands/mark_lead_lost_command.dart';
import '../../application/commands/schedule_follow_up_command.dart';
import '../../application/commands/update_lead_details_command.dart';
import '../../domain/entities/lead.dart';
import '../../domain/entities/lead_activity.dart';
import '../../domain/services/lead_score_calculator.dart';
import '../../domain/value_objects/lead_score.dart';
import '../providers/lead_providers.dart';
import 'lead_tasks_card.dart';

/// Lead detail sheet'i — ma'lumotlar + ball tahlili + amallar + timeline.
///
/// `leadId` orqali leadListProvider'dan joriy lead watch qilinadi —
/// command'lar versiyani oshirganda sheet avtomatik yangilanadi.
class LeadDetailSheet extends ConsumerStatefulWidget {
  final String leadId;

  const LeadDetailSheet({super.key, required this.leadId});

  @override
  ConsumerState<LeadDetailSheet> createState() => _LeadDetailSheetState();
}

class _LeadDetailSheetState extends ConsumerState<LeadDetailSheet> {
  bool _busy = false;

  /// Build ichida watch — leadListVersion o'zgarganda sheet yangilanadi.
  Lead? get _lead => _findLead(ref.watch(leadListProvider).valueOrNull);

  /// Event handler'lar (build'dan tashqari) uchun read — `watch` build'da
  /// ishlatiladi, aks holda Riverpod "watch outside build" xatosini beradi.
  Lead? get _readLead => _findLead(ref.read(leadListProvider).valueOrNull);

  Lead? _findLead(List<Lead>? leads) {
    if (leads == null) return null;
    for (final lead in leads) {
      if (lead.leadId == widget.leadId) return lead;
    }
    return null;
  }

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(failure.message), backgroundColor: context.dsColors.error),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _advance(LeadStage stage) {
    return _run(() async {
      await ref.read(advanceLeadStageCommandProvider).execute(
            AdvanceLeadStageRequest(leadId: widget.leadId, newStage: stage),
          );
    });
  }

  Future<void> _scheduleFollowUp() async {
    final now = DateTime.now();
    final initial = now.add(const Duration(days: 1));
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null || !mounted) return;
    await _run(() async {
      await ref.read(scheduleFollowUpCommandProvider).execute(
            ScheduleFollowUpRequest(
              leadId: widget.leadId,
              followUpAt: DateTime(date.year, date.month, date.day, time.hour,
                  time.minute),
            ),
          );
    });
  }

  Future<void> _markLost() async {
    final reason = await _promptText(
      title: context.l10n.crmMarkLost,
      hint: context.l10n.crmLostReason,
      required: true,
    );
    if (reason == null || !mounted) return;
    await _run(() async {
      await ref.read(markLeadLostCommandProvider).execute(
            MarkLeadLostRequest(leadId: widget.leadId, reason: reason),
          );
    });
  }

  Future<void> _convert() async {
    final lead = _readLead;
    final lastName = await _promptText(
      title: context.l10n.crmConvertTitle,
      hint: context.l10n.crmConvertLastName,
      initial: lead?.fullName.split(' ').lastOrNull,
    );
    if (lastName == null || !mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(context.l10n.crmConvertToStudent),
        content: Text('${lead?.fullName} — ${context.l10n.crmConvertTitle}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(context.l10n.crmCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(context.l10n.crmConvertToStudent),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _run(() async {
      await ref.read(convertLeadCommandProvider).execute(
            ConvertLeadRequest(leadId: widget.leadId, lastName: lastName),
          );
    });
  }

  Future<void> _editDetails() async {
    final lead = _readLead;
    if (lead == null) return;

    var assigned = lead.assignedToUserId;
    final notesController = TextEditingController(text: lead.notes ?? '');
    final formKey = GlobalKey<FormState>();
    final result = await showDialog<String?>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(context.l10n.crmLeadDetails),
          content: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Mas'ul ro'yxati async yuklanadi — dialog ochilishini
                  // bloklamaydi (secure storage sekin bo'lsa ham izoh
                  // tahrirlash ishlaydi).
                  FutureBuilder<List<AssignableUser>>(
                    future: ref.read(assignableUsersProvider.future),
                    builder: (context, snapshot) {
                      final users = snapshot.data ?? const <AssignableUser>[];
                      if (users.isEmpty) return const SizedBox.shrink();
                      // O'chirilgan yoki bloklangan hisobga tayinlangan
                      // bo'lsa `value` assertion bermasligi uchun null.
                      final value = users.any((u) => u.id == assigned)
                          ? assigned
                          : null;
                      return Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [                           DropdownButtonFormField<String?>(
                             initialValue: value,
                            isExpanded: true,
                            decoration: InputDecoration(
                              labelText: context.l10n.crmAssign,
                              isDense: true,
                            ),
                            items: [
                              DropdownMenuItem<String?>(
                                value: null,
                                child: Text(
                                  context.l10n.crmCancel,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: context.dsColors.textTertiary,
                                  ),
                                ),
                              ),
                              for (final user in users)
                                DropdownMenuItem<String?>(
                                  value: user.id,
                                  child: Text(
                                    user.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 14),
                                  ),
                                ),
                            ],
                            onChanged:
                                (v) => setDialogState(() => assigned = v),
                          ),
                          const SizedBox(height: 12),
                        ],
                      );
                    },
                  ),
                  TextFormField(
                    controller: notesController,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: context.l10n.crmNotes,
                      isDense: true,
                      alignLabelWithHint: true,
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(context.l10n.crmCancel),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, 'save'),
              child: Text(context.l10n.crmSave),
            ),
          ],
        ),
      ),
    );
    notesController.dispose();

    if (result != 'save' || !mounted) return;
    await _run(() async {
      await ref.read(updateLeadDetailsCommandProvider).execute(
            UpdateLeadDetailsRequest(
              leadId: widget.leadId,
              assignedToUserId: assigned,
              notes: notesController.text,
              clearAssigned: assigned == null && lead.assignedToUserId != null,
            ),
          );
    });
  }

  /// Matn kiritish dialogi — `required` bo'lsa bo'sh qaytarilmaydi.
  Future<String?> _promptText({
    required String title,
    required String hint,
    String? initial,
    bool required = false,
  }) async {
    final controller = TextEditingController(text: initial ?? '');
    final formKey = GlobalKey<FormState>();
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: controller,
            autofocus: true,
            decoration: InputDecoration(hintText: hint),
            validator: required
                ? (v) => (v == null || v.trim().isEmpty)
                    ? context.l10n.crmLostReasonRequired
                    : null
                : null,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text(context.l10n.crmCancel),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.pop(dialogContext, controller.text.trim());
              }
            },
            child: Text(context.l10n.crmSave),
          ),
        ],
      ),
    );
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final lead = _lead;
    final colors = context.dsColors;

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: colors.scaffold,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: lead == null
              ? const Center(child: CircularProgressIndicator())
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: context.dsColors.border,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                    _buildHeader(context, lead),
                    Expanded(
                      child: SingleChildScrollView(
                        controller: scrollController,
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _buildInfoCard(context, lead),
                            const SizedBox(height: 12),
                            if (!lead.isStageFinal &&
                                Permissions.can(
                                  ref.watch(actorRoleProvider),
                                  AppPermission.crmLeadsEdit,
                                )) ...[
                              _buildActionsCard(context, lead),
                              const SizedBox(height: 12),
                            ],
                            _buildScoreCard(context, lead),
                            const SizedBox(height: 12),
                            LeadTasksCard(leadId: lead.leadId),
                            const SizedBox(height: 12),
                            _buildTimelineCard(context),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
        );
      },
    );
  }

  Widget _buildHeader(BuildContext context, Lead lead) {
    final colors = context.dsColors;
    final bucketColor = switch (lead.scoreBucket) {
      LeadScoreBucket.hot => context.dsColors.error,
      LeadScoreBucket.warm => context.dsColors.warning,
      LeadScoreBucket.cold => Colors.blueGrey,
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 14),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  bucketColor.withValues(alpha: 0.9),
                  bucketColor.withValues(alpha: 0.55),
                ],
              ),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Center(
              child: Text(
                lead.fullName.isEmpty ? '?' : lead.fullName[0].toUpperCase(),
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  lead.fullName,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    _StageChip(stage: lead.stage),
                    _BucketChip(bucket: lead.scoreBucket),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(BuildContext context, Lead lead) {
    final colors = context.dsColors;
    final l10n = context.l10n;

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _infoRow(
            Icons.badge_outlined,
            lead.leadId,
            isId: true,
            color: context.dsColors.info,
          ),
          if (lead.phone != null && lead.phone!.isNotEmpty)
            _infoRow(Icons.phone_outlined, lead.phone!, canCopy: true),
          if (lead.email != null && lead.email!.isNotEmpty)
            _infoRow(Icons.email_outlined, lead.email!, canCopy: true),
          _infoRow(Icons.alt_route_outlined, _sourceLabel(lead.source)),
          _infoRow(
            Icons.schedule_outlined,
            '${l10n.crmCreatedAt}: '
            '${DateFormat('dd.MM.yyyy HH:mm').format(lead.createdAt)}',
          ),
          if (lead.assignedToUserId != null)
            _infoRow(Icons.person_pin_outlined, lead.assignedToUserId!),
          if (lead.nextFollowUpAt != null)
            _infoRow(
              Icons.event_outlined,
              '${l10n.crmFollowUpAt}: '
              '${DateFormat('dd.MM.yyyy HH:mm').format(lead.nextFollowUpAt!)}',
              color: context.dsColors.warning,
            ),
          if (lead.lostReason != null && lead.lostReason!.isNotEmpty)
            _infoRow(
              Icons.cancel_outlined,
              lead.lostReason!,
              color: context.dsColors.error,
            ),
          if (lead.convertedToIdentityId != null)
            _infoRow(
              Icons.school_outlined,
              'ID: ${lead.convertedToIdentityId}',
              color: context.dsColors.success,
            ),
          if (lead.notes != null && lead.notes!.isNotEmpty) ...[
            Divider(height: 20, color: context.dsColors.border.withValues(alpha: 0.4)),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.notes_outlined, size: 16, color: colors.textTertiary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    lead.notes!,
                    style: TextStyle(fontSize: 13, color: colors.textSecondary),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _infoRow(
    IconData icon,
    String text, {
    bool isId = false,
    bool canCopy = false,
    Color? color,
  }) {
    final colors = context.dsColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color ?? colors.textTertiary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13.5,
                fontFamily: isId ? 'monospace' : null,
                color: color ?? colors.textPrimary,
              ),
            ),
          ),
          if (canCopy)
            GestureDetector(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Nusxalandi: $text'),
                    backgroundColor: context.dsColors.success,
                    duration: const Duration(seconds: 1),
                  ),
                );
              },
              child: Icon(Icons.copy_outlined, size: 15, color: colors.textTertiary),
            ),
        ],
      ),
    );
  }

  /// Bosqich amallari: ilgari surish / follow-up / tahrirlash / konvertatsiya / lost.
  Widget _buildActionsCard(BuildContext context, Lead lead) {
    final l10n = context.l10n;
    final colors = context.dsColors;

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.crmStage,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
              color: colors.textTertiary,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (lead.stage == LeadStage.newLead)
                _actionChip(
                  label: l10n.crmStageContacted,
                  icon: Icons.call_outlined,
                  color: context.dsColors.accent,
                  onTap: () => _advance(LeadStage.contacted),
                ),
              if (lead.stage != LeadStage.trialScheduled)
                _actionChip(
                  label: l10n.crmStageTrial,
                  icon: Icons.event_available_outlined,
                  color: context.dsColors.warning,
                  onTap: () => _advance(LeadStage.trialScheduled),
                ),
            ],
          ),
          Divider(height: 24, color: context.dsColors.border.withValues(alpha: 0.4)),
          Row(
            children: [
              Expanded(
                child: _actionTile(
                  label: l10n.crmScheduleFollowUp,
                  icon: Icons.event_outlined,
                  color: context.dsColors.info,
                  onTap: _scheduleFollowUp,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _actionTile(
                  label: l10n.crmEdit,
                  icon: Icons.edit_outlined,
                  color: colors.textPrimary,
                  onTap: _editDetails,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _actionTile(
                  label: l10n.crmConvertToStudent,
                  icon: Icons.school_outlined,
                  color: context.dsColors.success,
                  onTap: _convert,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _actionTile(
                  label: l10n.crmMarkLost,
                  icon: Icons.cancel_outlined,
                  color: context.dsColors.error,
                  onTap: _markLost,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionChip({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return ActionChip(
      avatar: Icon(icon, size: 16, color: color),
      label: Text(label),
      onPressed: _busy ? null : onTap,
      backgroundColor: color.withValues(alpha: 0.1),
      side: BorderSide(color: color.withValues(alpha: 0.4)),
      labelStyle: TextStyle(fontSize: 12.5, color: color, fontWeight: FontWeight.w600),
      visualDensity: VisualDensity.compact,
    );
  }

  /// Amal qatori — LiquidGlassButton'ning Stack ichidagi min-Row'iga
  /// mos bo'lmagan Expanded/Flexible ishlatilmaydi; InkWell asosidagi
  /// chegaralangan (bounded) Row ishlatiladi.
  Widget _actionTile({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: color.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: _busy ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          child: Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildScoreCard(BuildContext context, Lead lead) {
    final l10n = context.l10n;
    final colors = context.dsColors;
    final score = LeadScoreCalculator.calculate(lead);

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                l10n.crmScoreBreakdown,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.3,
                  color: colors.textTertiary,
                ),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: _bucketColor(context, lead).withValues(alpha: 0.13),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${l10n.crmScore}: ${lead.score}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: _bucketColor(context, lead),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            score.describe(),
            style: TextStyle(fontSize: 13, color: colors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildTimelineCard(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.dsColors;
    final activitiesAsync = ref.watch(leadActivitiesProvider(widget.leadId));

    return GlassCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.crmActivityTimeline,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
              color: colors.textTertiary,
            ),
          ),
          const SizedBox(height: 10),
          activitiesAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.all(12),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
            error: (e, _) => Text(
              userFriendlyMessage(e),
              style: TextStyle(fontSize: 13, color: colors.textSecondary),
            ),
            data: (activities) => activities.isEmpty
                ? Text(
                    l10n.crmEmptyStage,
                    style:
                        TextStyle(fontSize: 13, color: colors.textSecondary),
                  )
                : Column(
                    children: [
                      for (var i = 0; i < activities.length; i++)
                        _TimelineTile(
                          activity: activities[i],
                          isLast: i == activities.length - 1,
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// Timeline yozuvi (Identity timeline uslubida).
class _TimelineTile extends StatelessWidget {
  final LeadActivity activity;
  final bool isLast;

  const _TimelineTile({required this.activity, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                width: 10,
                height: 10,
                margin: const EdgeInsets.only(top: 5),
                decoration: BoxDecoration(
                  color: _activityColor(context, activity.type),
                  shape: BoxShape.circle,
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(width: 2, color: context.dsColors.border.withValues(alpha: 0.5)),
                ),
            ],
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    activity.description,
                    style: TextStyle(
                      fontSize: 13,
                      color: colors.textPrimary,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    DateFormat('dd.MM.yyyy HH:mm').format(activity.occurredAt),
                    style: TextStyle(fontSize: 11, color: colors.textTertiary),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StageChip extends StatelessWidget {
  final LeadStage stage;

  const _StageChip({required this.stage});

  @override
  Widget build(BuildContext context) {
    final color = switch (stage) {
      LeadStage.newLead => context.dsColors.info,
      LeadStage.contacted => context.dsColors.accent,
      LeadStage.trialScheduled => context.dsColors.warning,
      LeadStage.converted => context.dsColors.success,
      LeadStage.lost => context.dsColors.error,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        _stageLabel(context, stage),
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _BucketChip extends StatelessWidget {
  final LeadScoreBucket bucket;

  const _BucketChip({required this.bucket});

  @override
  Widget build(BuildContext context) {
    final color = switch (bucket) {
      LeadScoreBucket.hot => context.dsColors.error,
      LeadScoreBucket.warm => context.dsColors.warning,
      LeadScoreBucket.cold => Colors.blueGrey,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        bucket.label,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

Color _bucketColor(BuildContext context, Lead lead) => switch (lead.scoreBucket) {
      LeadScoreBucket.hot => context.dsColors.error,
      LeadScoreBucket.warm => context.dsColors.warning,
      LeadScoreBucket.cold => Colors.blueGrey,
    };

Color _activityColor(BuildContext context, String type) => switch (type) {
      LeadActivityTypes.captured => context.dsColors.success,
      LeadActivityTypes.stageChanged => context.dsColors.info,
      LeadActivityTypes.markedLost => context.dsColors.error,
      LeadActivityTypes.converted => context.dsColors.success,
      LeadActivityTypes.followUpScheduled => context.dsColors.warning,
      LeadActivityTypes.assigned => context.dsColors.accent,
      LeadActivityTypes.reopened => context.dsColors.warning,
      LeadActivityTypes.updated => context.dsColors.info,
      _ => context.dsColors.border,
    };

String _sourceLabel(LeadSource source) => switch (source) {
      LeadSource.instagram => 'Instagram',
      LeadSource.telegram => 'Telegram',
      LeadSource.referral => 'Referral',
      LeadSource.walkIn => 'Walk-in',
      LeadSource.website => 'Veb-sayt',
      LeadSource.other => 'Boshqa',
    };

String _stageLabel(BuildContext context, LeadStage stage) {
  final l10n = context.l10n;
  return switch (stage) {
    LeadStage.newLead => l10n.crmStageNew,
    LeadStage.contacted => l10n.crmStageContacted,
    LeadStage.trialScheduled => l10n.crmStageTrial,
    LeadStage.converted => l10n.crmStageConverted,
    LeadStage.lost => l10n.crmStageLost,
  };
}
