import 'package:flutter/material.dart';
import 'package:m_edu/core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../../features/attendance/presentation/providers/attendance_statistics_providers.dart';
import '../../../../features/grades/presentation/providers/grade_providers.dart';
import '../../../groups/presentation/providers/group_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../identity/presentation/widgets/digital_id_card.dart';
import '../../../identity/presentation/widgets/identity_avatar.dart';
import '../../../identity/presentation/widgets/status_badge.dart';
import '../../application/commands/update_student_command.dart';
import '../../domain/entities/student.dart';
import '../providers/student_providers.dart';

part 'student_detail_page_widgets.dart';

/// Talaba tafsilotlari sahifasi (spec §6 #6-11).
///
/// To'liq profil, guruh ma'lumotlari, to'lov holati,
/// davomat foizi va Activity Timeline ko'rsatiladi.
class StudentDetailPage extends ConsumerWidget {
  final String identityId;

  const StudentDetailPage({super.key, required this.identityId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentAsync = ref.watch(studentDetailProvider(identityId));
    final identityAsync = ref.watch(identityDetailProvider(identityId));

    return Scaffold(
      body: studentAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _ErrorView(message: '$error'),
        data: (student) {
          if (student == null) {
            return const _NotFoundView();
          }
          return identityAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => _ErrorView(message: '$error'),
            data: (identity) {
              if (identity == null) {
                return const _NotFoundView();
              }
              return _StudentDetailBody(
                student: student,
                identity: identity,
              );
            },
          );
        },
      ),
    );
  }
}

class _StudentDetailBody extends ConsumerWidget {
  final Student student;
  final Identity identity;

  const _StudentDetailBody({
    required this.student,
    required this.identity,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        SliverAppBar(
          expandedHeight: 280,
          pinned: true,
          stretch: true,
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [context.dsColors.accent, context.dsColors.info],
                ),
              ),
              child: SafeArea(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IdentityAvatar(identity: identity, radius: 48),
                      const SizedBox(height: 16),
                      Text(
                        identity.fullName,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        identity.identityId,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white.withValues(alpha: 0.8),
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      StatusBadge(status: identity.status),
                    ],
                  ),
                ),
              ),
            ),
          ),
          actions: [
            IconButton(
              tooltip: 'Talaba 360',
              icon: const Icon(Icons.dashboard_customize),
              onPressed: () => context.push(
                '/students/${identity.identityId}/360',
              ),
            ),
            IconButton(
              tooltip: 'ID karta',
              icon: const Icon(Icons.badge_outlined),
              onPressed: () => _showIdCard(context),
            ),
            IconButton(
              tooltip: 'Boshqa harakatlar',
              icon: const Icon(Icons.more_vert),
              onPressed: () => _showActions(context, ref),
            ),
          ],
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoCard(context),
                const SizedBox(height: 16),
                _buildGroupCard(context),
                const SizedBox(height: 16),
                _buildPaymentCard(context),
                const SizedBox(height: 16),
                _buildAttendanceCard(context, ref),
                const SizedBox(height: 16),
                _buildGradesCard(context, ref),
                const SizedBox(height: 16),
                _buildParentCard(context, ref),
                const SizedBox(height: 16),
                _buildActivityTimeline(context, ref),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInfoCard(BuildContext context) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Shaxsiy ma\'lumotlar'),
          const SizedBox(height: 12),
          _InfoRow(label: 'Talaba raqami', value: '#${student.studentNumber}'),
          _InfoRow(label: 'O\'quv yili', value: student.academicYear ?? '—'),
          _InfoRow(
              label: 'Ro\'yxatga olingan',
              value: _formatDate(student.enrolledAt)),
          if (student.notes != null && student.notes!.isNotEmpty)
            _InfoRow(label: 'Izoh', value: student.notes!),
        ],
      ),
    );
  }

  Widget _buildGroupCard(BuildContext context) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Guruh'),
          SizedBox(height: 12),
          if (student.hasGroup) ...[
            _InfoRow(
                label: 'Guruh', value: student.groupName ?? student.groupId!),
            if (student.assignedAt != null)
              _InfoRow(
                  label: 'Tayinlangan',
                  value: _formatDate(student.assignedAt!)),
          ] else
            Text(
              'Hali guruhga tayinlanmagan',
              style: TextStyle(
                fontSize: 14,
                color: context.dsColors.textSecondary,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPaymentCard(BuildContext context) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('To\'lov holati'),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: student.hasPaid
                      ? context.dsColors.success.withValues(alpha: 0.15)
                      : context.dsColors.error.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  student.hasPaid ? 'To\'langan' : 'To\'lanmagan',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: student.hasPaid ? context.dsColors.success : context.dsColors.error,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _InfoRow(
            label: 'Jami to\'langan',
            value: '${_formatCurrency(student.totalPaid)} so\'m',
          ),
          if (student.lastPaymentDate != null)
            _InfoRow(
              label: 'Oxirgi to\'lov',
              value: _formatDate(student.lastPaymentDate!),
            ),
        ],
      ),
    );
  }

  Widget _buildAttendanceCard(BuildContext context, WidgetRef ref) {
    // Phase 5: foiz Attendance + Schedule'dan DERIVED hisoblanadi.
    // `AttendanceMarkedEvent` kelganda EventSyncCoordinator faqat shu
    // studentning provider'ini invalidate qiladi — profil avtomatik
    // yangilanadi (qo'lda refresh shart emas).
    final statsAsync =
        ref.watch(studentAttendanceStatsProvider(student.identityId));

    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Davomat'),
          const SizedBox(height: 12),
          statsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: LinearProgressIndicator(minHeight: 6),
            ),
            error: (error, _) => Text(
              'Xato: $error',
              style: TextStyle(fontSize: 13, color: context.dsColors.error),
            ),
            data: (stats) {
              final percentage = stats.percentage;
              final color = percentage >= 80
                  ? context.dsColors.success
                  : percentage >= 60
                      ? context.dsColors.warning
                      : context.dsColors.error;

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: (percentage / 100).clamp(0, 1),
                            backgroundColor:
                                context.dsColors.border.withValues(alpha: 0.3),
                            valueColor: AlwaysStoppedAnimation<Color>(color),
                            minHeight: 8,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '${percentage.toStringAsFixed(1)}%',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: color,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 8),
                  // §5: alohida statistika — present/late/excused/absent.
                  Text(
                    'Kelgan: ${stats.presentLessons}  •  Kechikkan: '
                    '${stats.lateLessons}  •  Kechirilgan: '
                    '${stats.excusedLessons}  •  Kelmagan: '
                    '${stats.absentLessons}  •  Reja: ${stats.scheduledLessons}',
                    style: TextStyle(
                      fontSize: 11,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildGradesCard(BuildContext context, WidgetRef ref) {
    final groupsAsync =
        ref.watch(subjectGroupsForStudentProvider(student.identityId));

    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle("O'zlashtirish (baholar)"),
          const SizedBox(height: 12),
          groupsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: LinearProgressIndicator(minHeight: 6),
            ),
            error: (error, _) => Text(
              'Xato: $error',
              style: TextStyle(fontSize: 13, color: context.dsColors.error),
            ),
            data: (groups) {
              if (groups.isEmpty) {
                return Text(
                  "Hali baholar yo'q",
                  style: TextStyle(
                    fontSize: 14,
                    color: context.dsColors.textSecondary,
                  ),
                );
              }
              final allGrades = groups.expand((g) => g.grades).toList();
              final avg = allGrades.fold<int>(0, (a, g) => a + g.value) /
                  allGrades.length;
              final avgColor = avg >= 4.5
                  ? context.dsColors.success
                  : avg >= 3.5
                      ? context.dsColors.accent
                      : avg >= 3.0
                          ? context.dsColors.warning
                          : context.dsColors.error;

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: LinearProgressIndicator(
                            value: (avg / 5).clamp(0, 1),
                            backgroundColor:
                                context.dsColors.border.withValues(alpha: 0.3),
                            valueColor: AlwaysStoppedAnimation<Color>(avgColor),
                            minHeight: 8,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        avg.toStringAsFixed(2),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: avgColor,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Jami ${allGrades.length} baho',
                    style: TextStyle(
                      fontSize: 11,
                      color: context.dsColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  for (final group in groups) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            group.subjectName,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: context.dsColors.textPrimary,
                            ),
                          ),
                        ),
                        Text(
                          group.average.toStringAsFixed(2),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: group.average >= 4.0
                                ? context.dsColors.success
                                : group.average >= 3.0
                                    ? context.dsColors.warning
                                    : context.dsColors.error,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: group.grades.take(6).map((grade) {
                        final gColor = grade.value >= 4
                            ? context.dsColors.success
                            : grade.value >= 3
                                ? context.dsColors.warning
                                : context.dsColors.error;
                        return Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: gColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '${grade.value}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: gColor,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 10),
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildParentCard(BuildContext context, WidgetRef ref) {
    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const _SectionTitle('Ota-ona / Vasiy'),
              IconButton(
                tooltip: 'Tahrirlash',
                icon: const Icon(Icons.edit_outlined, size: 20),
                color: context.dsColors.accent,
                onPressed: () => _showEditParentDialog(context, ref),
              ),
            ],
          ),
          SizedBox(height: 4),
          if (student.parentName == null &&
              student.parentPhone == null &&
              student.parentTelegramId == null)
            Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                "Ma'lumot kiritilmagan — tahrirlash tugmasini bosing",
                style: TextStyle(
                    fontSize: 13, color: context.dsColors.textSecondary),
              ),
            ),
          if (student.parentName != null)
            _InfoRow(label: 'Ism', value: student.parentName!),
          if (student.parentPhone != null)
            _InfoRow(label: 'Telefon', value: student.parentPhone!),
          if (student.parentTelegramId != null)
            _InfoRow(label: 'Telegram ID', value: student.parentTelegramId!),
        ],
      ),
    );
  }

  Future<void> _showEditParentDialog(
      BuildContext context, WidgetRef ref) async {
    final nameController =
        TextEditingController(text: student.parentName ?? '');
    final phoneController =
        TextEditingController(text: student.parentPhone ?? '');
    final telegramController =
        TextEditingController(text: student.parentTelegramId ?? '');

    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Ota-ona ma\'lumotlari'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(
                  labelText: 'Ota-ona ismi',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: phoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Telefon raqami',
                  hintText: '+998 90 123 45 67',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: telegramController,
                decoration: const InputDecoration(
                  labelText: 'Telegram chat ID (ixtiyoriy)',
                  hintText: '123456789',
                  prefixIcon: Icon(Icons.send_outlined),
                  helperText:
                      'Ota-ona botga raqamini yuborsa, sinxronlash avtomatik to\'ldiradi',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Bekor qilish'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Saqlash'),
          ),
        ],
      ),
    );

    if (saved != true || !context.mounted) return;

    try {
      // §3: UI'da to'g'ridan-to'g'ri repository'ga yozish o'rniga
      // command'ga o'tildi — `StudentUpdatedEvent` + audit log +
      // dependent state refresh hammasi command ichida bajariladi.
      await ref.read(updateStudentCommandProvider).execute(
            UpdateStudentRequest(
              identityId: student.identityId,
              parentName: nameController.text.trim().isEmpty
                  ? null
                  : nameController.text.trim(),
              parentPhone: phoneController.text.trim().isEmpty
                  ? null
                  : phoneController.text.trim(),
              parentTelegramId: telegramController.text.trim().isEmpty
                  ? null
                  : telegramController.text.trim(),
            ),
          );
      // Event orqali ro'yxat avtomatik yangilanadi; profil uchun
      // targeted invalidation yetarli.
      ref.invalidate(studentDetailProvider(student.identityId));
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Ota-ona ma\'lumotlari saqlandi'),
          backgroundColor: context.dsColors.success,
        ),
      );
    } on Failure catch (failure) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(userFriendlyMessage(failure)),
          backgroundColor: context.dsColors.error,
        ),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.l10n.studentSaveError),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      nameController.dispose();
      phoneController.dispose();
      telegramController.dispose();
    }
  }

  Widget _buildActivityTimeline(BuildContext context, WidgetRef ref) {
    final activitiesAsync =
        ref.watch(identityActivitiesProvider(identity.identityId));

    return _GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle('Faoliyat tarixi'),
          SizedBox(height: 12),
          activitiesAsync.when(
            loading: () => Center(child: CircularProgressIndicator()),
            error: (error, _) => Text(
              'Xato: $error',
              style: TextStyle(color: context.dsColors.error),
            ),
            data: (activities) {
              if (activities.isEmpty) {
                return Text(
                  'Hali faoliyat yo\'q',
                  style: TextStyle(color: context.dsColors.textSecondary),
                );
              }
              return Column(
                children: activities.take(5).map((activity) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(top: 6),
                          decoration: BoxDecoration(
                            color: context.dsColors.accent,
                            shape: BoxShape.circle,
                          ),
                        ),
                        SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                activity.description,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: context.dsColors.textPrimary,
                                ),
                              ),
                              Text(
                                _formatDateTime(activity.occurredAt),
                                style: TextStyle(
                                  fontSize: 11,
                                  color: context.dsColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  void _showIdCard(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DigitalIdCard(identity: identity),
    );
  }

  void _showActions(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: context.dsColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            SizedBox(height: 20),
            Text(
              'Boshqarish',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),
            if (student.canFreeze)
              _ActionTile(
                icon: Icons.pause_circle_outline,
                title: 'Muzlatish',
                subtitle: 'Talabani vaqtincha muzlatish',
                onTap: () async {
                  Navigator.pop(context);
                  // C-03: Ro'yxat/dashboard `StudentStatusChangedEvent`
                  // orqali avtomatik yangilanadi — qo'lda refresh shart emas.
                  await ref
                      .read(updateStudentStatusCommandProvider)
                      .execute(identity.identityId, StudentStatus.frozen);
                  ref.invalidate(studentDetailProvider(identity.identityId));
                },
              ),
            if (student.canGraduate)
              _ActionTile(
                icon: Icons.school_outlined,
                title: 'Bitirgan deb belgilash',
                subtitle: 'Talaba o\'quvni tugalladi',
                onTap: () async {
                  Navigator.pop(context);
                  // C-03: Ro'yxat/dashboard `StudentStatusChangedEvent`
                  // orqali avtomatik yangilanadi — qo'lda refresh shart emas.
                  await ref
                      .read(updateStudentStatusCommandProvider)
                      .execute(identity.identityId, StudentStatus.graduated);
                  ref.invalidate(studentDetailProvider(identity.identityId));
                },
              ),
            if (student.isActive &&
                student.transferStatus == TransferStatus.none)
              _ActionTile(
                icon: Icons.swap_horiz,
                title: student.hasGroup
                    ? 'Guruhga o\'tkazish'
                    : 'Guruhga qo\'shish',
                subtitle: student.hasGroup
                    ? 'Boshqa guruhga o\'tkazish'
                    : 'Faol guruhdan biriga qo\'shish',
                onTap: () {
                  Navigator.pop(context);
                  _showGroupTransferSheet(context, ref);
                },
              ),
            // Archive/Restore siyosati (audit): arxiv — markazni tark
            // etgan talabani arxivlash; arxivlangan talabani qayta tiklash.
            // Xato UI'da yashirilmaydi — snackbar bilan ko'rsatiladi (§10).
            if (student.studentStatus == StudentStatus.archived)
              _ActionTile(
                icon: Icons.restore,
                title: 'Qayta tiklash',
                subtitle: 'Arxivdan faol holatga qaytarish',
                onTap: () async {
                  Navigator.pop(context);
                  final messenger = ScaffoldMessenger.of(context);
                  try {
                    // C-03: Ro'yxat/dashboard `StudentStatusChangedEvent`
                    // orqali avtomatik yangilanadi.
                    await ref
                        .read(updateStudentStatusCommandProvider)
                        .execute(identity.identityId, StudentStatus.active);
                    ref.invalidate(studentDetailProvider(identity.identityId));
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text('Talaba qayta tiklandi ✓'),
                        backgroundColor: context.dsColors.success,
                      ),
                    );
                  } on Failure catch (failure) {
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(failure.message),
                        backgroundColor: context.dsColors.error,
                      ),
                    );
                  }
                },
              )
            else if (student.canArchive)
              _ActionTile(
                icon: Icons.archive_outlined,
                title: 'Arxivlash',
                subtitle: 'Talabani arxivga o\'tkazish (guruhdan chiqariladi)',
                onTap: () async {
                  Navigator.pop(context);
                  final messenger = ScaffoldMessenger.of(context);
                  try {
                    // C-03: Ro'yxat/dashboard `StudentStatusChangedEvent`
                    // + `GroupMemberRemovedEvent` orqali avtomatik yangilanadi.
                    await ref
                        .read(updateStudentStatusCommandProvider)
                        .execute(identity.identityId, StudentStatus.archived);
                    ref.invalidate(studentDetailProvider(identity.identityId));
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text('Talaba arxivlandi ✓'),
                        backgroundColor: context.dsColors.success,
                      ),
                    );
                  } on Failure catch (failure) {
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(failure.message),
                        backgroundColor: context.dsColors.error,
                      ),
                    );
                  }
                },
              ),
            // ─── Butunlay o'chirish (hard delete) ───────────────────────
            // Xavfsizlik: tasdiqlash dialogi + RBAC (studentsEdit).
            // To'lov/davomat tarixi saqlanib qoladi, guruh a'zoligi va
            // Identity profili o'chiriladi.
            _ActionTile(
              icon: Icons.delete_outline,
              title: "O'chirish",
              subtitle: 'Talabani butunlay o\'chirish (qaytarib bo\'lmaydi)',
              isDanger: true,
              onTap: () async {
                Navigator.pop(context);
                final messenger = ScaffoldMessenger.of(context);
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: Text(context.l10n.studentDeleteTitle),
                    content: Text(
                      "'${identity.fullName}' butunlay o'chiriladi. "
                      'Bu amalni qaytarib bo\'lmaydi. Davom etasizmi?',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Bekor qilish'),
                      ),
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: context.dsColors.error,
                        ),
                        onPressed: () => Navigator.pop(context, true),
                        child: Text(context.l10n.actionDelete),
                      ),
                    ],
                  ),
                );
                if (confirmed != true || !context.mounted) return;
                try {
                  await ref
                      .read(deleteStudentCommandProvider)
                      .execute(identity.identityId);
                  if (!context.mounted) return;
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(context.l10n.studentDeleteSuccess),
                      backgroundColor: context.dsColors.success,
                    ),
                  );
                  context.pop();
                } on Failure catch (failure) {
                  if (!context.mounted) return;
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(failure.message),
                      backgroundColor: context.dsColors.error,
                    ),
                  );
                }
              },
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  void _showGroupTransferSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _GroupTransferSheet(student: student),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}.${date.month.toString().padLeft(2, '0')}.${date.year}';
  }

  String _formatDateTime(DateTime date) {
    return '${date.day}.${date.month.toString().padLeft(2, '0')}.${date.year} '
        '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  String _formatCurrency(int amount) {
    return amount.toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match m) => '${m[1]}.',
        );
  }
}
