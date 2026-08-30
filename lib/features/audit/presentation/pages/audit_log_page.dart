import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/extensions/l10n_context.dart';
import '../../../../core/security/permissions.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/glass_card.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../domain/entities/audit_log_entry.dart';
import '../../domain/repositories/audit_repository.dart';
import '../providers/audit_providers.dart';

/// Audit log sahifasi — barcha muhim o'zgarishlarning tarixi.
///
/// Kim, nima, qachon — barchasi xronologik tartibda.
/// Filtrlash: amal turi, maqsad turi, sana oralig'i.
class AuditLogPage extends ConsumerStatefulWidget {
  const AuditLogPage({super.key});

  @override
  ConsumerState<AuditLogPage> createState() => _AuditLogPageState();
}

class _AuditLogPageState extends ConsumerState<AuditLogPage> {
  AuditAction? _filterAction;
  String? _filterTargetType;
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.dsColors;
    final role = ref.watch(actorRoleProvider);
    final canView = Permissions.can(role, AppPermission.auditView);

    if (!canView) {
      return Scaffold(
        appBar: AppBar(
          title: Text('Faoliyat jurnali'),
          backgroundColor: context.dsColors.accent,
          foregroundColor: Colors.white,
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.lock_outline, size: 48, color: colors.textTertiary),
              SizedBox(height: 12),
              Text(
                'Ruxsat yo\'q',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: colors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('Faoliyat jurnali'),
        backgroundColor: context.dsColors.accent,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: Icon(Icons.filter_list),
            onPressed: _showFilterSheet,
            tooltip: 'Filtrlash',
          ),
        ],
      ),
      body: Column(
        children: [
          // Qidiruv
          Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              onChanged: (v) => setState(() => _searchQuery = v.trim()),
              decoration: InputDecoration(
                hintText: 'Qidirish...',
                prefixIcon: Icon(Icons.search, size: 20),
                isDense: true,
                filled: true,
                fillColor: colors.card,
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          // Filtri ko'rsatish
          if (_filterAction != null || _filterTargetType != null)
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  if (_filterAction != null)
                    Chip(
                      label: Text(_actionLabel(_filterAction!)),
                      onDeleted: () =>
                          setState(() => _filterAction = null),
                      visualDensity: VisualDensity.compact,
                    ),
                  if (_filterAction != null && _filterTargetType != null)
                    SizedBox(width: 8),
                  if (_filterTargetType != null)
                    Chip(
                      label: Text(_filterTargetType!),
                      onDeleted: () =>
                          setState(() => _filterTargetType = null),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
            ),
          // Ro'yxat
          Expanded(
            child: _AuditLogList(
              filterAction: _filterAction,
              filterTargetType: _filterTargetType,
              searchQuery: _searchQuery,
            ),
          ),
        ],
      ),
    );
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Filtrlash',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            ListTile(
              leading: Icon(Icons.all_inclusive),
              title: Text('Barcha amallar'),
              onTap: () {
                setState(() {
                  _filterAction = null;
                  _filterTargetType = null;
                });
                Navigator.pop(context);
              },
            ),
            const Divider(height: 1),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Amal turi',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ),
            for (final action in AuditAction.values.take(10))
              ListTile(
                title: Text(_actionLabel(action)),
                trailing: _filterAction == action
                    ? Icon(Icons.check, color: context.dsColors.accent)
                    : null,
                onTap: () {
                  setState(() => _filterAction = action);
                  Navigator.pop(context);
                },
              ),
            SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  String _actionLabel(AuditAction action) => action.actionLabel;
}

class _AuditLogList extends ConsumerWidget {
  final AuditAction? filterAction;
  final String? filterTargetType;
  final String searchQuery;

  const _AuditLogList({
    required this.filterAction,
    required this.filterTargetType,
    required this.searchQuery,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.dsColors;
    final entriesAsync = ref.watch(auditLogListProvider);

    return entriesAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Text(
          'Xatolik: $e',
          style: TextStyle(color: colors.textSecondary),
        ),
      ),
      data: (entries) {
        var filtered = entries;

        // Filtrlash
        if (filterAction != null) {
          filtered =
              filtered.where((e) => e.action == filterAction).toList();
        }
        if (filterTargetType != null) {
          filtered = filtered
              .where((e) => e.targetType == filterTargetType)
              .toList();
        }
        if (searchQuery.isNotEmpty) {
          final q = searchQuery.toLowerCase();
          filtered = filtered
              .where((e) =>
                  e.description.toLowerCase().contains(q) ||
                  e.actorName.toLowerCase().contains(q) ||
                  e.targetId.toLowerCase().contains(q) ||
                  (e.details?.toLowerCase().contains(q) ?? false))
              .toList();
        }

        if (filtered.isEmpty) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.history, size: 48, color: colors.textTertiary),
                SizedBox(height: 12),
                Text(
                  'Yozuvlar topilmadi',
                  style: TextStyle(
                    fontSize: 14,
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          );
        }

        return ListView.builder(
          padding: EdgeInsets.all(16),
          itemCount: filtered.length,
          itemBuilder: (context, index) =>
              _AuditLogTile(entry: filtered[index]),
        );
      },
    );
  }
}

class _AuditLogTile extends StatelessWidget {
  final AuditLogEntry entry;

  const _AuditLogTile({required this.entry});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: GlassCard(
        padding: EdgeInsets.all(12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Amal turiga qarab rang
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: _actionColor(context, entry.action).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                _actionIcon(entry.action),
                size: 18,
                color: _actionColor(context, entry.action),
              ),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    entry.actionLabel,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: colors.textPrimary,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    '${entry.actorName} • ${entry.targetType}',
                    style: TextStyle(
                      fontSize: 12,
                      color: colors.textSecondary,
                    ),
                  ),
                  if (entry.details != null &&
                      entry.details!.isNotEmpty) ...[
                    SizedBox(height: 4),
                    Text(
                      entry.details!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.textTertiary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  DateFormat('dd.MM').format(entry.occurredAt),
                  style: TextStyle(
                    fontSize: 11,
                    color: colors.textTertiary,
                  ),
                ),
                Text(
                  DateFormat('HH:mm').format(entry.occurredAt),
                  style: TextStyle(
                    fontSize: 11,
                    color: colors.textTertiary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _actionColor(BuildContext context, AuditAction action) => switch (action) {
        AuditAction.paymentCreated ||
        AuditAction.paymentRefunded ||
        AuditAction.paymentCancelled ||
        AuditAction.debtCreated ||
        AuditAction.expenseCreated =>
          context.dsColors.warning,
        AuditAction.studentCreated ||
        AuditAction.studentUpdated ||
        AuditAction.studentArchived ||
        AuditAction.studentRestored ||
        AuditAction.studentTransferred ||
        AuditAction.studentGraduated ||
        AuditAction.studentDeleted =>
          context.dsColors.info,
        AuditAction.leadCaptured ||
        AuditAction.leadStageChanged ||
        AuditAction.leadMarkedLost ||
        AuditAction.leadConverted ||
        AuditAction.leadFollowUpScheduled ||
        AuditAction.leadUpdated =>
          context.dsColors.info,
        AuditAction.userCreated ||
        AuditAction.userUpdated ||
        AuditAction.userStatusChanged ||
        AuditAction.userDeleted =>
          context.dsColors.accent,
        _ => context.dsColors.success,
      };

  IconData _actionIcon(AuditAction action) => switch (action) {
        AuditAction.paymentCreated ||
        AuditAction.paymentRefunded ||
        AuditAction.paymentCancelled ||
        AuditAction.debtCreated ||
        AuditAction.expenseCreated =>
          Icons.payment,
        AuditAction.studentCreated ||
        AuditAction.studentUpdated ||
        AuditAction.studentArchived ||
        AuditAction.studentRestored ||
        AuditAction.studentTransferred ||
        AuditAction.studentGraduated ||
        AuditAction.studentDeleted =>
          Icons.school,
        AuditAction.leadCaptured ||
        AuditAction.leadStageChanged ||
        AuditAction.leadMarkedLost ||
        AuditAction.leadConverted ||
        AuditAction.leadFollowUpScheduled ||
        AuditAction.leadUpdated =>
          Icons.handshake,
        AuditAction.userCreated ||
        AuditAction.userUpdated ||
        AuditAction.userStatusChanged ||
        AuditAction.userDeleted =>
          Icons.person,
        AuditAction.backupCreated ||
        AuditAction.backupRestored =>
          Icons.backup,
        _ => Icons.info_outline,
      };
}
