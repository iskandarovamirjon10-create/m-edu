// QISM: group_detail_page.dart ning "part" fayli — leaf widgetlar.
//
// `part of` sababli asosiy fayl bilan bir xil privat scopeni bo'lishadi.

part of 'group_detail_page.dart';

/// Guruh sarlavhasi: gradient avatar + nom + kod + holat.
class _HeaderCard extends StatelessWidget {
  final Group group;

  const _HeaderCard({required this.group});

  @override
  Widget build(BuildContext context) {
    final initials = group.code ??
        (group.name.length >= 2
            ? group.name.substring(0, 2).toUpperCase()
            : group.name.toUpperCase());

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: context.dsColors.accentGradient,
        boxShadow: [
          BoxShadow(
            color: context.dsColors.accent.withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.white.withValues(alpha: 0.4)),
            ),
            child: Center(
              child: Text(
                initials,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  group.name,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                if (group.subject != null)
                  Text(
                    group.subject!,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                  ),
                const SizedBox(height: 10),
                _GroupStatusBadge(status: group.status),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Sig'im ko'rsatkichi: progress bar + band/bo'sh joylar.
class _OccupancyCard extends StatelessWidget {
  final Group group;

  const _OccupancyCard({required this.group});

  @override
  Widget build(BuildContext context) {
    final occupancyColor = group.occupancyPercentage >= 90
        ? context.dsColors.error
        : group.occupancyPercentage >= 70
            ? context.dsColors.warning
            : context.dsColors.success;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _glassDecoration(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Sig\'im',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: context.dsColors.textPrimary,
                ),
              ),
              const Spacer(),
              Text(
                '${group.currentSize}/${group.capacity}',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: occupancyColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: (group.occupancyPercentage / 100).clamp(0.0, 1.0),
              backgroundColor: context.dsColors.border.withValues(alpha: 0.3),
              valueColor: AlwaysStoppedAnimation<Color>(occupancyColor),
              minHeight: 8,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _StatChip(
                icon: Icons.group_add_outlined,
                label: group.isFull
                    ? 'Guruh to\'lgan'
                    : '${group.availableSlots} ta bo\'sh joy',
                color: group.isFull ? context.dsColors.error : context.dsColors.success,
              ),
              const Spacer(),
              Text(
                '${group.occupancyPercentage.toStringAsFixed(0)}% band',
                style: TextStyle(
                  fontSize: 12,
                  color: context.dsColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Asosiy ma'lumotlar: o'qituvchi, xona, narx, o'quv yili, izoh.
class _InfoCard extends StatelessWidget {
  final Group group;

  const _InfoCard({required this.group});

  @override
  Widget build(BuildContext context) {
    final rows = <(IconData, String, String)>[
      if (group.hasTeacher)
        (
          Icons.person_outline,
          "O'qituvchi",
          group.teacherName ?? '—',
        ),
      if (group.hasRoom)
        (
          Icons.room_outlined,
          'Xona',
          group.roomName ?? '—',
        ),
      if (group.monthlyFee > 0)
        (
          Icons.attach_money,
          'Oylik to\'lov',
          '${_formatCurrency(group.monthlyFee)} so\'m',
        ),
      if (group.academicYear != null)
        (Icons.school_outlined, "O'quv yili", group.academicYear!),
      if (group.academicYear == null &&
          group.monthlyFee == 0 &&
          !group.hasRoom &&
          !group.hasTeacher &&
          group.notes == null)
        (
          Icons.info_outline,
          'Izoh',
          'Qo\'shimcha ma\'lumot kiritilmagan',
        ),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _glassDecoration(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ma\'lumotlar',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: context.dsColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          for (final (icon, label, value) in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _InfoRow(icon: icon, label: label, value: value),
            ),
          if (group.notes != null && group.notes!.trim().isNotEmpty) ...[
            const Divider(height: 1),
            const SizedBox(height: 12),
            _InfoRow(
              icon: Icons.notes_outlined,
              label: 'Izoh',
              value: group.notes!,
            ),
          ],
        ],
      ),
    );
  }
}

/// Dars jadvali: kunlar, vaqt oralig'i, boshlanish/tugash sanasi.
class _ScheduleCard extends StatelessWidget {
  final Group group;

  const _ScheduleCard({required this.group});

  @override
  Widget build(BuildContext context) {
    final hasSchedule = group.daysOfWeek.isNotEmpty ||
        group.startTime != null ||
        group.startDate != null;

    if (!hasSchedule) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: _glassDecoration(context),
        child: Row(
          children: [
            Icon(Icons.schedule_outlined,
                size: 20, color: context.dsColors.textSecondary),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Dars jadvali kiritilmagan',
                style: TextStyle(
                    fontSize: 13, color: context.dsColors.textSecondary),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _glassDecoration(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Dars jadvali',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: context.dsColors.textPrimary,
            ),
          ),
          if (group.daysOfWeek.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: group.daysOfWeek
                  .map(
                    (day) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: context.dsColors.accent.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        _capitalize(day),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: context.dsColors.accent,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          const SizedBox(height: 12),
          if (group.startTime != null)
            _InfoRow(
              icon: Icons.access_time,
              label: 'Vaqt',
              value: group.endTime != null
                  ? '${group.startTime!} – ${group.endTime!}'
                  : group.startTime!,
            ),
          if (group.startDate != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _InfoRow(
                icon: Icons.event_outlined,
                label: 'Boshlanish',
                value: _formatDate(group.startDate!),
              ),
            ),
          if (group.endDate != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _InfoRow(
                icon: Icons.event_available_outlined,
                label: 'Tugash',
                value: _formatDate(group.endDate!),
              ),
            ),
        ],
      ),
    );
  }
}

/// Guruh davomat statistikasi (P1.5) — real lesson-instance ma'lumotidan
/// hisoblangan (groupAttendanceStatsProvider). Yozuv bo'lmasa 0 ko'rsatiladi
/// (hardcoded emas — real repository'dan derived qiymat).
class _AttendanceCard extends ConsumerWidget {
  final Group group;

  const _AttendanceCard({required this.group});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(groupAttendanceStatsProvider(group.groupId));

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: _glassDecoration(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Davomat',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: context.dsColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          statsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
            error: (error, _) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                "Davomatni hisoblashda xato: $error",
                style: TextStyle(fontSize: 12, color: context.dsColors.error),
              ),
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
                      Text(
                        '${percentage.toStringAsFixed(0)}%',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: color,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(
                            value: (percentage / 100).clamp(0.0, 1.0),
                            backgroundColor:
                                context.dsColors.border.withValues(alpha: 0.3),
                            valueColor: AlwaysStoppedAnimation<Color>(color),
                            minHeight: 8,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _AttendanceMiniStat(
                        label: 'Reja',
                        value: '${stats.scheduledLessons}',
                        color: context.dsColors.accent,
                      ),
                      _AttendanceMiniStat(
                        label: 'Qatnashdi',
                        value: '${stats.presentCount}',
                        color: context.dsColors.success,
                      ),
                      _AttendanceMiniStat(
                        label: 'Kechikkan',
                        value: '${stats.lateLessons}',
                        color: context.dsColors.warning,
                      ),
                      _AttendanceMiniStat(
                        label: "Kelmagan",
                        value: '${stats.absentLessons}',
                        color: context.dsColors.error,
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _AttendanceMiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _AttendanceMiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: context.dsColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

/// Guruh a'zolari ro'yxati — StudentCard'lar (identity ism bilan).
class _MembersSection extends ConsumerWidget {
  final Group group;

  const _MembersSection({required this.group});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentsAsync = ref.watch(studentsByGroupProvider(group.groupId));
    final identitiesAsync = ref.watch(identityListProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              "A'zolar",
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: context.dsColors.textPrimary,
              ),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: context.dsColors.accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${group.currentSize}',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: context.dsColors.accent,
                ),
              ),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: group.hasAvailableSlots
                  ? () => context.push('/groups/${group.groupId}/add-students')
                  : null,
              icon: Icon(Icons.person_add_alt_1, size: 18),
              label: Text(context.l10n.actionAdd),
            ),
          ],
        ),
        SizedBox(height: 4),
        Text(
          'Guruhga biriktirilgan o\'quvchilar',
          style:
              TextStyle(fontSize: 12, color: context.dsColors.textSecondary),
        ),
        const SizedBox(height: 12),
        studentsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) => Text(
            'Xato: $error',
            style: TextStyle(color: context.dsColors.error),
          ),
          data: (students) {
            if (students.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(20),
                decoration: _glassDecoration(context),
                child: Column(
                  children: [
                    Icon(Icons.person_add_alt_1,
                        size: 32, color: context.dsColors.textTertiary),
                    SizedBox(height: 10),
                    Text(
                      'Bu guruhga hali a\'zolar qo\'shilmagan',
                      style: TextStyle(
                        fontSize: 13,
                        color: context.dsColors.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: group.hasAvailableSlots
                          ? () => context
                              .push('/groups/${group.groupId}/add-students')
                          : null,
                      icon: const Icon(Icons.person_add_alt_1, size: 18),
                      label: Text(context.l10n.attendanceAddStudent),
                    ),
                  ],
                ),
              );
            }

            return identitiesAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => Text(
                'Xato: $error',
                style: TextStyle(color: context.dsColors.error),
              ),
              data: (identities) {
                final identityMap = {
                  for (final i in identities) i.identityId: i,
                };
                return Column(
                  children: [
                    for (final student in students)
                      RepaintBoundary(
                        child: Row(
                          children: [
                            Expanded(
                              child: StudentCard(
                                student: student,
                                identity: identityMap[student.identityId] ??
                                    _unknownIdentity(student.identityId),
                                showGroup: false,
                                showPaymentStatus: true,
                              ),
                            ),
                            const SizedBox(width: 4),
                            _RemoveMemberButton(
                              onPressed: () => _confirmRemove(
                                context,
                                ref,
                                student,
                                identityMap[student.identityId]?.fullName ??
                                    'Talaba #${student.studentNumber}',
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                );
              },
            );
          },
        ),
      ],
    );
  }
}

/// A'zoni guruhdan chiqarish tugmasi (tasdiqlash dialogi bilan).
class _RemoveMemberButton extends StatelessWidget {
  final VoidCallback onPressed;

  const _RemoveMemberButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.dsColors.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: IconButton(
        tooltip: 'Guruhdan chiqarish',
        icon: const Icon(Icons.person_remove_outlined, size: 20),
        color: context.dsColors.error,
        onPressed: onPressed,
      ),
    );
  }
}

/// O'quvchini guruhdan chiqarish: tasdiqlash → command → snackbar.
Future<void> _confirmRemove(
  BuildContext context,
  WidgetRef ref,
  Student student,
  String fullName,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Guruhdan chiqarish'),
      content: Text(
        '$fullName guruhdan chiqarilsinmi?\n\n'
        "O'quvchi guruhsiz qoladi va istalgan guruhga qayta qo'shilishi mumkin.",
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Bekor qilish'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Chiqarish'),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;

  final messenger = ScaffoldMessenger.of(context);
  try {
    // C-03: Ro'yxatlar GroupMemberRemovedEvent orqali avtomatik yangilanadi.
    await ref.read(removeStudentFromGroupCommandProvider).execute(
          groupId: student.groupId!,
          studentIdentityId: student.identityId,
        );
    if (context.mounted) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('$fullName guruhdan chiqarildi'),
          backgroundColor: context.dsColors.success,
        ),
      );
    }
  } on Failure catch (failure) {
    if (context.mounted) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    }
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: context.dsColors.accent.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: context.dsColors.accent),
        ),
        SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  color: context.dsColors.textSecondary,
                ),
              ),
              SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _StatChip(
      {required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: color),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
      ],
    );
  }
}

/// Guruh holati belgisi (Faol / Nofaol / Arxiv).
class _GroupStatusBadge extends StatelessWidget {
  final GroupStatus status;

  const _GroupStatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      GroupStatus.active => ('Faol', context.dsColors.success),
      GroupStatus.inactive => ('Nofaol', context.dsColors.textSecondary),
      GroupStatus.archived => ('Arxiv', context.dsColors.warning),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String title;
  final String message;

  const _ErrorView({
    this.title = "Ma'lumotlarni yuklashda xato",
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 56, color: context.dsColors.error),
            SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 6),
            Text(
              message,
              style: TextStyle(
                fontSize: 13,
                color: context.dsColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

BoxDecoration _glassDecoration(BuildContext context) {
  return BoxDecoration(
    borderRadius: BorderRadius.circular(20),
    color: context.dsColors.surface,
    border: Border.all(color: context.dsColors.border.withValues(alpha: 0.5)),
    boxShadow: [
      BoxShadow(
        color: context.dsColors.divider.withValues(alpha: 0.25),
        blurRadius: 20,
        offset: const Offset(0, 8),
        spreadRadius: -6,
      ),
    ],
  );
}

Identity _unknownIdentity(String identityId) {
  return Identity(
    identityId: identityId,
    firstName: "Noma'lum",
    lastName: '',
    role: IdentityRole.student,
    status: IdentityStatus.active,
    qrSeed: '',
    createdAt: DateTime.now(),
  );
}

String _capitalize(String value) {
  if (value.isEmpty) return value;
  return value[0].toUpperCase() + value.substring(1);
}

String _formatDate(DateTime date) {
  final m = date.month.toString().padLeft(2, '0');
  final d = date.day.toString().padLeft(2, '0');
  return '$d.$m.${date.year}';
}

String _formatCurrency(int amount) {
  return amount.toString().replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (Match m) => '${m[1]}.',
      );
}
