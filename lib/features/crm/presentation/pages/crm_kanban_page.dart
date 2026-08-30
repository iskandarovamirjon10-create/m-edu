import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/security/permissions.dart';
import '../../../../core/services/app_haptics.dart';
import '../../../../design/design.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/design_system/glass_card.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../application/commands/advance_lead_stage_command.dart';
import '../../domain/entities/lead.dart';
import '../../domain/value_objects/lead_score.dart';
import '../providers/lead_providers.dart';
import '../widgets/capture_lead_sheet.dart';
import '../widgets/lead_detail_sheet.dart';

/// CRM — Lead Pipeline (Kanban) sahifasi.
///
/// Besh bosqichli ustun: Yangi → Bog'lanildi → Sinov darsiga yozilgan →
/// Konvertatsiya / Yo'qotilgan (ikkalasi FINAL).
///
/// - Kartalar bosqichlar orasida DRAG & DROP bilan o'tkaziladi
///   (`AdvanceLeadStageCommand` — faqat final bo'lmagan bosqichlarga).
/// - Karta bosilsa — Lead Detail sheet (timeline + amallar).
/// - FAB — yangi lead qo'lga kiritish (dedup ogohlantirishi bilan).
class CrmKanbanPage extends ConsumerStatefulWidget {
  const CrmKanbanPage({super.key});

  @override
  ConsumerState<CrmKanbanPage> createState() => _CrmKanbanPageState();
}

class _CrmKanbanPageState extends ConsumerState<CrmKanbanPage> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';
  bool _busy = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openCaptureSheet() async {
    unawaited(AppHaptics.tap());
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const CaptureLeadSheet(),
    );
  }

  Future<void> _openDetail(Lead lead) async {
    unawaited(AppHaptics.tap());
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => LeadDetailSheet(leadId: lead.leadId),
    );
  }

  /// Drag & drop orqali bosqich o'zgartirish.
  Future<void> _moveToStage(Lead lead, LeadStage target) async {
    if (_busy || lead.stage == target || lead.isStageFinal) return;
    if (target.isFinal) return; // Final bosqich — alohida amal orqali.
    setState(() => _busy = true);
    try {
      await ref.read(advanceLeadStageCommandProvider).execute(
            AdvanceLeadStageRequest(leadId: lead.leadId, newStage: target),
          );
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(failure.message), backgroundColor: context.dsColors.error),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.dsColors;
    final kanbanAsync = ref.watch(leadKanbanProvider);
    final canEdit = Permissions.can(
        ref.watch(actorRoleProvider), AppPermission.crmLeadsEdit);

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeader(context, l10n),
            _buildStatsRow(context, kanbanAsync.valueOrNull),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _searchController,
                onChanged: (v) => setState(() => _query = v.trim()),
                decoration: InputDecoration(
                  hintText: l10n.crmSearchPlaceholder,
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _query.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _query = '');
                          },
                        ),
                  isDense: true,
                  filled: true,
                  fillColor: colors.card,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: context.dsColors.border.withValues(alpha: 0.5),
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: context.dsColors.border.withValues(alpha: 0.5),
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: kanbanAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(
                    userFriendlyMessage(e),
                    style: TextStyle(color: colors.textSecondary),
                  ),
                ),
                data: (byStage) {
                  final filtered = _filterLeads(byStage);
                  final anyResult = filtered.values.any((l) => l.isNotEmpty);
                  if (!anyResult && _query.isNotEmpty) {
                    return Center(
                      child: Text(
                        l10n.crmNoSearchResults,
                        style: TextStyle(color: colors.textSecondary),
                      ),
                    );
                  }
                  return SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final stage in LeadStage.values) ...[
                          _KanbanColumn(
                            stage: stage,
                            leads: filtered[stage] ?? const [],
                            query: _query,
                            canDrop: canEdit && !stage.isFinal,
                            busy: _busy,
                            onDrop: (lead) => _moveToStage(lead, stage),
                            onTapLead: _openDetail,
                          ),
                          const SizedBox(width: 12),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCaptureSheet,
        backgroundColor: context.dsColors.accent,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.person_add_alt_1),
        label: Text(l10n.crmNewLead),
      ),
    );
  }

  /// Qidiruv filtri — ism, telefon, email bo'yicha.
  Map<LeadStage, List<Lead>> _filterLeads(
    Map<LeadStage, List<Lead>> byStage,
  ) {
    if (_query.isEmpty) return byStage;
    final q = _query.toLowerCase();
    final result = <LeadStage, List<Lead>>{};
    for (final entry in byStage.entries) {
      result[entry.key] = entry.value
          .where((l) =>
              l.fullName.toLowerCase().contains(q) ||
              (l.phone ?? '').contains(q) ||
              (l.email ?? '').toLowerCase().contains(q))
          .toList();
    }
    return result;
  }

  Widget _buildHeader(BuildContext context, AppLocalizations l10n) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [context.dsColors.accent, context.dsColors.info],
        ),
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(24),
        ),
      ),
      child: Row(
        children: [
          // Push qilingan marshrut — orqaga qaytish tugmasi (mobil).
          IconButton(
            onPressed: () => context.pop(),
            icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
            tooltip: 'Orqaga',
          ),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.filter_alt_outlined,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.crmTitle,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.moreCrmSubtitle,
                  style: TextStyle(fontSize: 12.5, color: Colors.white70),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Jami + Hot/Warm/Cold taqsimoti (LeadScoreBucket).
  Widget _buildStatsRow(
    BuildContext context,
    Map<LeadStage, List<Lead>>? byStage,
  ) {
    final colors = context.dsColors;
    final leads = byStage == null
        ? const <Lead>[]
        : byStage.values.expand((l) => l).toList();
    var hot = 0, warm = 0, cold = 0;
    for (final lead in leads) {
      switch (lead.scoreBucket) {
        case LeadScoreBucket.hot:
          hot++;
        case LeadScoreBucket.warm:
          warm++;
        case LeadScoreBucket.cold:
          cold++;
      }
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
      child: Row(
        children: [
          _StatChip(
            label: leads.length.toString(),
            sublabel: 'jami',
            color: colors.textPrimary,
          ),
          const SizedBox(width: 8),
          _StatChip(label: '$hot', sublabel: 'Hot', color: context.dsColors.error),
          const SizedBox(width: 8),
          _StatChip(label: '$warm', sublabel: 'Warm', color: context.dsColors.warning),
          const SizedBox(width: 8),
          _StatChip(label: '$cold', sublabel: 'Cold', color: Colors.blueGrey),
        ],
      ),
    );
  }
}

/// Kichik statistik chip (jami / Hot / Warm / Cold).
class _StatChip extends StatelessWidget {
  final String label;
  final String sublabel;
  final Color color;

  const _StatChip({
    required this.label,
    required this.sublabel,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      borderRadius: 12,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: context.dsColors.textPrimary,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            sublabel,
            style: TextStyle(
              fontSize: 11,
              color: context.dsColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Bitta Kanban ustuni — sarlavha + kartalar + drop zone.
class _KanbanColumn extends StatelessWidget {
  final LeadStage stage;
  final List<Lead> leads;
  final String query;
  final bool canDrop;
  final bool busy;
  final void Function(Lead lead) onDrop;
  final void Function(Lead lead) onTapLead;

  const _KanbanColumn({
    required this.stage,
    required this.leads,
    required this.query,
    required this.canDrop,
    required this.busy,
    required this.onDrop,
    required this.onTapLead,
  });

  Color _accentColor(BuildContext context) => switch (stage) {
        LeadStage.newLead => context.dsColors.info,
        LeadStage.contacted => context.dsColors.accent,
        LeadStage.trialScheduled => context.dsColors.warning,
        LeadStage.converted => context.dsColors.success,
        LeadStage.lost => context.dsColors.error,
      };

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final l10n = context.l10n;
    final accent = _accentColor(context);

    return DragTarget<Lead>(
      onWillAcceptWithDetails: (_) => canDrop && !busy,
      onAcceptWithDetails: (details) => onDrop(details.data),
      builder: (context, candidate, rejected) {
        final highlighted = candidate.isNotEmpty && canDrop;
        return Container(
          width: 264,
          decoration: BoxDecoration(
            color: highlighted
                ? accent.withValues(alpha: 0.08)
                : colors.card.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: highlighted
                  ? accent
                  : context.dsColors.border.withValues(alpha: 0.4),
              width: highlighted ? 1.6 : 0.8,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: accent,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _stageLabel(l10n, stage),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${leads.length}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: accent,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(
                  height: 1, color: colors.border.withValues(alpha: 0.4)),
              Flexible(
                child: leads.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 28,
                        ),
                        child: Column(
                          children: [
                            Icon(
                              Icons.inbox_outlined,
                              size: 28,
                              color: colors.textTertiary,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              l10n.crmEmptyStage,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12.5,
                                color: colors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(10),
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: leads.length,
                        itemBuilder: (context, index) => _LeadCard(
                          lead: leads[index],
                          draggable: canDrop && !busy,
                          onTap: () => onTapLead(leads[index]),
                        ),
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Kanban kartasi — LongPressDraggable bilan tortib o'tkazish.
class _LeadCard extends StatelessWidget {
  final Lead lead;
  final bool draggable;
  final VoidCallback onTap;

  const _LeadCard({
    required this.lead,
    required this.draggable,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final card = Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: context.dsColors.border.withValues(alpha: 0.35),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            _bucketColor(context, lead).withValues(alpha: 0.9),
                            _bucketColor(context, lead).withValues(alpha: 0.55),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: Text(
                          lead.fullName.isEmpty
                              ? '?'
                              : lead.fullName[0].toUpperCase(),
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        lead.fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                    _BucketBadge(bucket: lead.scoreBucket),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    if (lead.maskedPhone.isNotEmpty)
                      Expanded(
                        child: Row(
                          children: [
                            Icon(
                              Icons.phone_outlined,
                              size: 13,
                              color: colors.textTertiary,
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                lead.maskedPhone,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: colors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      const Spacer(),
                    Icon(
                      _sourceIcon(lead.source),
                      size: 13,
                      color: colors.textTertiary,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        _sourceLabel(lead.source),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11.5,
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
                if (lead.nextFollowUpAt != null ||
                    lead.assignedToUserId != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (lead.nextFollowUpAt != null) ...[
                        Icon(
                          Icons.event_outlined,
                          size: 13,
                          color: context.dsColors.warning,
                        ),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            _formatDate(lead.nextFollowUpAt!),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11.5,
                              color: colors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                      const Spacer(),
                      if (lead.assignedToUserId != null)
                        CircleAvatar(
                          radius: 9,
                          backgroundColor:
                              context.dsColors.accent.withValues(alpha: 0.15),
                          child: Text(
                            lead.assignedToUserId![0].toUpperCase(),
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: context.dsColors.accent,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );

    if (!draggable) return card;
    return LongPressDraggable<Lead>(
      data: lead,
      feedback: Material(
        color: Colors.transparent,
        child: Transform.scale(
          scale: 1.04,
          child: Opacity(opacity: 0.9, child: card),
        ),
      ),
      childWhenDragging: Opacity(opacity: 0.35, child: card),
      child: card,
    );
  }
}

/// Hot / Warm / Cold badge (score bucket).
class _BucketBadge extends StatelessWidget {
  final LeadScoreBucket bucket;

  const _BucketBadge({required this.bucket});

  @override
  Widget build(BuildContext context) {
    final color = switch (bucket) {
      LeadScoreBucket.hot => context.dsColors.error,
      LeadScoreBucket.warm => context.dsColors.warning,
      LeadScoreBucket.cold => Colors.blueGrey,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        bucket.label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

Color _bucketColor(BuildContext context, Lead lead) => switch (lead.scoreBucket) {
      LeadScoreBucket.hot => context.dsColors.error,
      LeadScoreBucket.warm => context.dsColors.warning,
      LeadScoreBucket.cold => Colors.blueGrey,
    };

IconData _sourceIcon(LeadSource source) => switch (source) {
      LeadSource.instagram => Icons.photo_camera_outlined,
      LeadSource.telegram => Icons.send_outlined,
      LeadSource.referral => Icons.volunteer_activism_outlined,
      LeadSource.walkIn => Icons.directions_walk,
      LeadSource.website => Icons.language,
      LeadSource.other => Icons.help_outline,
    };

String _sourceLabel(LeadSource source) => switch (source) {
      LeadSource.instagram => 'Instagram',
      LeadSource.telegram => 'Telegram',
      LeadSource.referral => 'Referral',
      LeadSource.walkIn => 'Walk-in',
      LeadSource.website => 'Veb',
      LeadSource.other => 'Boshqa',
    };

String _stageLabel(AppLocalizations l10n, LeadStage stage) => switch (stage) {
      LeadStage.newLead => l10n.crmStageNew,
      LeadStage.contacted => l10n.crmStageContacted,
      LeadStage.trialScheduled => l10n.crmStageTrial,
      LeadStage.converted => l10n.crmStageConverted,
      LeadStage.lost => l10n.crmStageLost,
    };

String _formatDate(DateTime date) {
  final hh = date.hour.toString().padLeft(2, '0');
  final mm = date.minute.toString().padLeft(2, '0');
  return '${date.day.toString().padLeft(2, '0')}.'
      '${date.month.toString().padLeft(2, '0')} $hh:$mm';
}
