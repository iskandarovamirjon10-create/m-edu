import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';
import '../../../../features/attendance/presentation/providers/attendance_statistics_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/widgets/identity_avatar.dart';
import '../../../identity/presentation/widgets/status_badge.dart';
import '../../domain/entities/student.dart';

/// Talaba kartochkasi — ro'yxat sahifasida ishlatiladi.
///
/// Glassmorphism uslubida, Crystal Air Design System ga mos.
///
/// Davomat foizi [studentAttendanceStatsProvider] orqali DERIVED
/// hisoblanadi (Phase 5: Attendance + Schedule source of truth) —
/// Student'dagi eski denormalized field o'rniga.
class StudentCard extends ConsumerWidget {
  final Student student;
  final Identity? identity;
  final VoidCallback? onTap;
  final bool showGroup;
  final bool showPaymentStatus;
  final bool showAttendance;

  const StudentCard({
    super.key,
    required this.student,
    this.identity,
    this.onTap,
    this.showGroup = true,
    this.showPaymentStatus = true,
    this.showAttendance = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Granular: faqat shu studentning stats'i hisoblanadi. Har bir card
    // o'z Family provider'ini watch qiladi (2 ta indexed query: schedule +
    // attendance) — Isar in-memory bo'lgani uchun arzon. Evaziga targeted
    // invalidation ishlaydi: AttendanceMarkedEvent'da FAQAT shu provider
    // qayta hisoblanadi, butun ro'yxat emas (user talabi, §5). ListView
    // lazy build qilgani uchun faqat ko'rinadigan cardlar so'raladi.
    final attendanceAsync = showAttendance
        ? ref.watch(studentAttendanceStatsProvider(student.identityId))
        : null;

    return GestureDetector(
      onTap: onTap ?? () => context.push('/students/${student.identityId}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: context.dsColors.surface,
          border: Border.all(
            color: context.dsColors.border.withValues(alpha: 0.5),
            width: 0.8,
          ),
          boxShadow: [
            BoxShadow(
              color: context.dsColors.divider.withValues(alpha: 0.25),
              blurRadius: 20,
              offset: const Offset(0, 8),
              spreadRadius: -6,
            ),
          ],
        ),
        child: Row(
          children: [
            if (identity != null)
              IdentityAvatar(identity: identity!, radius: 26)
            else
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  gradient: context.dsColors.accentGradient,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Center(
                  child: Text(
                    '#${student.studentNumber}',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    identity?.fullName ?? 'Talaba #${student.studentNumber}',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: context.dsColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  if (identity != null)
                    Text(
                      identity!.identityId,
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.accent,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.3,
                      ),
                    ),
                  if (showGroup && student.hasGroup) ...[
                    SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(
                          Icons.groups_outlined,
                          size: 12,
                          color: context.dsColors.textSecondary,
                        ),
                        SizedBox(width: 4),
                        Text(
                          student.groupName ?? student.groupId!,
                          style: TextStyle(
                            fontSize: 12,
                            color: context.dsColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (identity != null) StatusBadge(status: identity!.status),
                if (showPaymentStatus) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: student.hasPaid
                          ? context.dsColors.success.withValues(alpha: 0.15)
                          : context.dsColors.error.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      student.hasPaid ? 'To\'langan' : 'Qarzdor',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color:
                            student.hasPaid ? context.dsColors.success : context.dsColors.error,
                      ),
                    ),
                  ),
                ],
                if (showAttendance && attendanceAsync != null) ...[
                  SizedBox(height: 4),
                  attendanceAsync.when(
                    loading: () => Text(
                      '—',
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.textTertiary,
                      ),
                    ),
                    error: (_, __) => Text(
                      '—',
                      style: TextStyle(
                        fontSize: 12,
                        color: context.dsColors.textTertiary,
                      ),
                    ),
                    data: (stats) => Text(
                      '${stats.percentage.toStringAsFixed(0)}%',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: _attendanceColor(context, stats.percentage),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  static Color _attendanceColor(BuildContext context, double percentage) {
    if (percentage >= 80) return context.dsColors.success;
    if (percentage >= 60) return context.dsColors.warning;
    return context.dsColors.error;
  }
}
