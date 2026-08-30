import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/services/app_haptics.dart';
import '../../../../core/extensions/l10n_context.dart';
import '../../../../design/design.dart';
import '../../../attendance/domain/entities/attendance_entry.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../payments/domain/entities/debt.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../../../scheduling/domain/entities/schedule.dart';
import '../../../scheduling/presentation/providers/schedule_providers.dart';

/// "So'nggi ro'yxatga olinganlar" bo'limi (real bazadan).
class DashboardIdentitySection extends ConsumerWidget {
  const DashboardIdentitySection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final identities = ref.watch(identityListProvider).valueOrNull ?? const [];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                context.l10n.dashboardRecentRegistered,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              TextButton(
                onPressed: () => context.push('/identity'),
                child: Text(context.l10n.commonAll),
              ),
            ],
          ),
          const SizedBox(height: 4),
          if (identities.isEmpty)
            const _IdentityEmptyPlaceholder()
          else
            for (final identity in identities.take(3))
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: DashboardRecentIdentityRow(identity: identity),
              ),
        ],
      ),
    );
  }
}

/// So'nggi ro'yxatdan o'tgan shaxs qatori.
class DashboardRecentIdentityRow extends StatelessWidget {
  final Identity identity;

  const DashboardRecentIdentityRow({super.key, required this.identity});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/identity/${identity.identityId}'),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: context.dsColors.card,
          border: Border.all(
            color: context.dsColors.divider.withValues(alpha: 0.4),
          ),
        ),
        child: Row(
          children: [
            Icon(_roleIcon(identity.role), color: context.dsColors.accent, size: 20),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                identity.fullName,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
            ),
            Text(
              identity.identityId,
              style: TextStyle(
                fontSize: 11,
                color: context.dsColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static IconData _roleIcon(IdentityRole role) {
    return switch (role) {
      IdentityRole.student => Icons.school_outlined,
      IdentityRole.teacher => Icons.co_present_outlined,
      IdentityRole.staff => Icons.badge_outlined,
      IdentityRole.parent => Icons.family_restroom_outlined,
    };
  }
}

/// Tezkor harakat tugmasi (glass + premium hover).
///
/// Desktop'da sichqoncha hover'da: tugma yengil kattalashadi (1.03),
/// rangi bilan yoritilgan chegaraga ega bo'ladi, ikonka yonadi va soya
/// chuqurlashadi — silliq animatsiya bilan. Bosilganda [AppHaptics] orqali
/// tebranish beriladi (sozlamalardagi gati bilan). Touch qurilmalarda
/// hover hodisasi bo'lmagani uchun bu effektlar faqat desktop'da ko'rinadi.
class DashboardQuickActionButton extends StatefulWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const DashboardQuickActionButton({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  State<DashboardQuickActionButton> createState() =>
      _DashboardQuickActionButtonState();
}

class _DashboardQuickActionButtonState extends State<DashboardQuickActionButton> {
  bool _hovered = false;

  void _handleTap() {
    // Mobil'da tebranish — desktop'da xavfsiz no-op.
    AppHaptics.tap();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: GestureDetector(
        onTap: _handleTap,
        child: AnimatedScale(
          scale: _hovered ? 1.03 : 1.0,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _hovered
                    ? color.withValues(alpha: 0.65)
                    : context.dsColors.divider.withValues(alpha: 0.55),
                width: _hovered ? 1.2 : 0.8,
              ),
              color: _hovered
                  ? Colors.white.withValues(alpha: 0.98)
                  : context.dsColors.surface,
              boxShadow: [
                BoxShadow(
                  color: _hovered
                      ? color.withValues(alpha: 0.28)
                      : context.dsColors.divider.withValues(alpha: 0.25),
                  blurRadius: _hovered ? 24 : 20,
                  offset: const Offset(0, 8),
                  spreadRadius: _hovered ? 0 : -4,
                ),
              ],
            ),
            child: Column(
              children: [
                // Ikonka — hover'da yonadi (glow).
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutCubic,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withValues(
                      alpha: _hovered ? 0.26 : 0.15,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: _hovered
                        ? [
                            BoxShadow(
                              color: color.withValues(alpha: 0.35),
                              blurRadius: 14,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Icon(widget.icon, color: color, size: 24),
                ),
                SizedBox(height: 8),
                Text(
                  widget.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: _hovered ? FontWeight.w700 : FontWeight.w500,
                    color: _hovered ? color : context.dsColors.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Hali qurilmagan feature uchun empty-state (spec §5 — soxta ma'lumot yo'q).
class DashboardEmptySection extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const DashboardEmptySection({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: context.dsColors.divider.withValues(alpha: 0.55), width: 0.8),
          color: context.dsColors.surface,
          boxShadow: [
            BoxShadow(
              color: context.dsColors.divider.withValues(alpha: 0.25),
              blurRadius: 20,
              offset: const Offset(0, 8),
              spreadRadius: -4,
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(icon, size: 40, color: context.dsColors.textTertiary),
            SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: context.dsColors.textPrimary,
              ),
            ),
            SizedBox(height: 6),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 12,
                color: context.dsColors.textSecondary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _IdentityEmptyPlaceholder extends StatelessWidget {
  const _IdentityEmptyPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: context.dsColors.divider.withValues(alpha: 0.55), width: 0.8),
        color: context.dsColors.surface,
      ),
      child: Column(
        children: [
          Icon(Icons.person_add_alt_1, size: 36, color: context.dsColors.textTertiary),
          SizedBox(height: 10),
          Text(
            context.l10n.dashboardNothingRegistered,
            style: TextStyle(fontSize: 13, color: context.dsColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CRM qulayliklari: bugungi davomat (jonli), kelayotgan darslar, qarzdorlar
// ═══════════════════════════════════════════════════════════════════════

/// Umumiy section sarlavha uslubi — joriy mavzuga mos rangda.
TextStyle _sectionTitleStyle(BuildContext context) {
  return TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: context.dsColors.textPrimary,
  );
}

/// Umumiy glass karta dekoratsiyasi — joriy mavzuga mos (dark mode'da
/// oq karta emas, qoramtir shisha).
BoxDecoration _glassCardDecoration(BuildContext context) {
  return BoxDecoration(
    borderRadius: BorderRadius.circular(20),
    color: context.dsColors.card,
    border: Border.all(
      color: context.dsColors.divider.withValues(alpha: 0.5),
      width: 0.8,
    ),
    boxShadow: [
      BoxShadow(
        color: context.dsColors.divider.withValues(alpha: 0.3),
        blurRadius: 20,
        offset: const Offset(0, 8),
        spreadRadius: -6,
      ),
    ],
  );
}

/// Summani formatlaydi (masalan 1.250.000).
String formatSum(int amount) {
  return amount.toString().replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (Match m) => '${m[1]}.',
      );
}

int _toMinutes(String time) {
  final parts = time.split(':');
  return int.parse(parts[0]) * 60 + int.parse(parts[1]);
}

String _nowTimeString() {
  final now = DateTime.now();
  final h = now.hour.toString().padLeft(2, '0');
  final m = now.minute.toString().padLeft(2, '0');
  return '$h:$m';
}

/// "Jonli" ko'rsatkichi — bugungi davomat karta tepasidagi yashil nuqta.
class _LiveBadge extends StatelessWidget {
  const _LiveBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: context.dsColors.success.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: context.dsColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Yashil nuqta — tiniq holda.
          DecoratedBox(
            decoration: BoxDecoration(
              color: context.dsColors.success,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: context.dsColors.success,
                  blurRadius: 6,
                ),
              ],
            ),
            child: SizedBox(width: 7, height: 7),
          ),
          SizedBox(width: 6),
          Text(
            context.l10n.dashboardLive,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: context.dsColors.success,
            ),
          ),
        ],
      ),
    );
  }
}

/// Bugungi davomat — jonli karta.
///
/// `AttendanceMarkedEvent` kelganda `attendanceVersionProvider` oshadi va
/// bu karta avtomatik yangilanadi (EventSync — qo'lda refresh shart emas).
class TodayAttendanceCard extends ConsumerWidget {
  const TodayAttendanceCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(todayAttendanceStatsProvider);
    final entriesAsync = ref.watch(todayAttendanceProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(context.l10n.dashboardTodayAttendance, style: _sectionTitleStyle(context)),
              const _LiveBadge(),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: _glassCardDecoration(context),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Belgilash usullari bo'yicha statistika.
                statsAsync.when(
                  loading: () => const _InlineLoader(),
                  error: (error, _) => _InlineError(message: '$error'),
                  data: (stats) => Row(
                    children: [
                      _MiniStat(
                        label: context.l10n.dashboardTotal,
                        value: '${stats.total}',
                        color: context.dsColors.accent,
                      ),
                      _MiniStat(
                        label: context.l10n.dashboardFace,
                        value: '${stats.faceCount}',
                        color: context.dsColors.info,
                      ),
                      _MiniStat(
                        label: 'QR',
                        value: '${stats.qrCount}',
                        color: context.dsColors.warning,
                      ),
                      _MiniStat(
                        label: context.l10n.dashboardManual,
                        value: '${stats.manualCount}',
                        color: context.dsColors.success,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 12),
                // So'nggi belgilanishlar.
                entriesAsync.when(
                  loading: () => const _InlineLoader(),
                  error: (error, _) => _InlineError(message: '$error'),
                  data: (entries) {
                    if (entries.isEmpty) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: Row(
                          children: [
                            Icon(
                              Icons.touch_app_outlined,
                              size: 18,
                              color: context.dsColors.textTertiary,
                            ),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                context.l10n.dashboardTodayNotMarked,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: context.dsColors.textSecondary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }
                    return Column(
                      children: [
                        for (final entry in entries.take(3))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _TodayEntryRow(entry: entry),
                          ),
                      ],
                    );
                  },
                ),
                SizedBox(height: 6),
                // Davomat belgilashga o'tish.
                FilledButton.tonalIcon(
                  onPressed: () => context.push('/attendance'),
                  icon: Icon(Icons.how_to_reg_rounded, size: 18),
                  label: Text(context.l10n.dashboardMarkAttendance),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Kichik statistika to'plami (Jami/Yuz/QR/Qo'lda).
class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
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

/// Bugungi davomat yozuvi qatori.
class _TodayEntryRow extends StatelessWidget {
  final AttendanceEntry entry;

  const _TodayEntryRow({required this.entry});

  (String, Color) _methodInfo(BuildContext context) {
    return switch (entry.method) {
      'face' => ('Yuz', context.dsColors.info),
      'qr' => ('QR', context.dsColors.warning),
      _ => ("Qo'lda", context.dsColors.success),
    };
  }

  @override
  Widget build(BuildContext context) {
    final (methodLabel, methodColor) = _methodInfo(context);
    return Row(
      children: [
        SizedBox(
          width: 46,
          child: Text(
            entry.timeRange,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: context.dsColors.textSecondary,
          ),
          ),
        ),
        SizedBox(width: 10),
        Expanded(
          child: Text(
            entry.fullName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w500,
              color: context.dsColors.textPrimary,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: methodColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            methodLabel,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: methodColor,
            ),
          ),
        ),
      ],
    );
  }
}

/// Yaqinlashib kelayotgan darslar kartasi.
///
/// Bugungi jadvaldan faqat tugamagan darslarni ko'rsatadi (keyingi 3 tasi).
/// Jadval/guruh o'zgarganda `scheduleListVersionProvider` oshadi va karta
/// avtomatik yangilanadi.
class UpcomingLessonsCard extends ConsumerWidget {
  const UpcomingLessonsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedulesAsync = ref.watch(todayScheduleProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                context.l10n.dashboardUpcomingLessons,
                style: _sectionTitleStyle(context),
              ),
              TextButton(
                onPressed: () => context.push('/schedule'),
                child: Text(context.l10n.navSchedule),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: _glassCardDecoration(context),
            child: schedulesAsync.when(
              loading: () => const _InlineLoader(),
              error: (error, _) => _InlineError(message: '$error'),
              data: (schedules) {
                final today = DayOfWeek.values[DateTime.now().weekday - 1];
                final todays = schedules
                    .where((s) => s.dayOfWeek == today)
                    .toList()
                  ..sort(
                    (a, b) => _toMinutes(a.startTime)
                        .compareTo(_toMinutes(b.startTime)),
                  );

                if (todays.isEmpty) {
                  return _SectionEmpty(
                    icon: Icons.event_busy,
                    title: context.l10n.dashboardNoLessonsToday,
                  );
                }

                final nowMinutes = _toMinutes(_nowTimeString());
                final upcoming = todays
                    .where((s) => _toMinutes(s.endTime) >= nowMinutes)
                    .toList();
                if (upcoming.isEmpty) {
                  return _SectionEmpty(
                    icon: Icons.task_alt,
                    title: context.l10n.dashboardLessonsDone,
                  );
                }

                return Column(
                  children: [
                    for (final schedule in upcoming.take(3))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _LessonRow(schedule: schedule),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Dars qatori.
class _LessonRow extends StatelessWidget {
  final Schedule schedule;

  const _LessonRow({required this.schedule});

  @override
  Widget build(BuildContext context) {
    final title = schedule.subject ?? schedule.groupName ?? schedule.groupId;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Vaqt bloki.
        Container(
          width: 52,
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: context.dsColors.accent.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Text(
                schedule.startTime,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: context.dsColors.accent,
                ),
              ),
              SizedBox(height: 2),
              Text(
                schedule.endTime,
                style: TextStyle(
                  fontSize: 10,
                  color: context.dsColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              SizedBox(height: 3),
              Text(
                [
                  if (schedule.teacherName != null) schedule.teacherName!,
                  if (schedule.roomName != null) schedule.roomName!,
                ].join(' • '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11.5,
                  color: context.dsColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        SizedBox(width: 6),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Icon(
            Icons.chevron_right,
            size: 16,
            color: context.dsColors.textTertiary,
          ),
        ),
      ],
    );
  }
}

/// Qarzdorlar kartasi.
///
/// `PaymentReceivedEvent` / `DebtCreatedEvent` kelganda `paymentListVersion`
/// oshadi va karta avtomatik yangilanadi.
class DebtorsCard extends ConsumerWidget {
  const DebtorsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final debtsAsync = ref.watch(outstandingDebtsProvider);
    final totalDebt = ref.watch(totalDebtProvider).valueOrNull ?? 0;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(context.l10n.dashboardDebtors, style: _sectionTitleStyle(context)),
              TextButton(
                onPressed: () => context.push('/payments/debts'),
                child: Text(context.l10n.commonAll),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: _glassCardDecoration(context),
            child: debtsAsync.when(
              loading: () => const _InlineLoader(),
              error: (error, _) => _InlineError(message: '$error'),
              data: (debts) {
                if (debts.isEmpty) {
                  return _SectionEmpty(
                    icon: Icons.check_circle,
                    title: context.l10n.dashboardNoDebts,
                  );
                }

                // Talaba bo'yicha birlashtirish: bitta talabaning bir necha
                // qarzdorligi (masalan turli oylar) ro'yxatda takrorlanmaydi —
                // summalari qo'shiladi, "muddati o'tgan" holati bittasi bo'lsa
                // ham ko'rsatiladi. So'ng: muddati o'tganlar birinchi, keyin
                // eng katta qarz.
                final byStudent = <String, _DebtAggregate>{};
                for (final debt in debts) {
                  final aggregate = byStudent.putIfAbsent(
                    debt.studentIdentityId,
                    () => _DebtAggregate(
                      debt.studentName ?? debt.studentIdentityId,
                      debt.groupName,
                    ),
                  );
                  aggregate.add(debt);
                }
                final sorted = byStudent.values.toList()
                  ..sort((a, b) {
                    if (a.isOverdue != b.isOverdue) {
                      return a.isOverdue ? -1 : 1;
                    }
                    return b.remaining.compareTo(a.remaining);
                  });

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          context.l10n.dashboardTotalDebt,
                          style: TextStyle(
                            fontSize: 13,
                            color: context.dsColors.textSecondary,
                          ),
                        ),
                        Text(
                          '${formatSum(totalDebt)} so\'m',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: context.dsColors.error,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Divider(height: 1),
                    const SizedBox(height: 10),
                    for (final aggregate in sorted.take(3))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _DebtRow(aggregate: aggregate),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Bir talabaning birlashtirilgan qarzdorlik holati.
class _DebtAggregate {
  final String name;
  final String? groupName;
  int remaining = 0;
  bool isOverdue = false;

  _DebtAggregate(this.name, this.groupName);

  void add(Debt debt) {
    remaining += debt.remainingAmount;
    isOverdue = isOverdue || debt.isOverdue;
  }
}

/// Qarzdor qatori (talaba bo'yicha birlashtirilgan).
class _DebtRow extends StatelessWidget {
  final _DebtAggregate aggregate;

  const _DebtRow({required this.aggregate});

  @override
  Widget build(BuildContext context) {
    final color = aggregate.isOverdue ? context.dsColors.error : context.dsColors.warning;
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            aggregate.isOverdue ? Icons.warning_amber_rounded : Icons.payment,
            size: 18,
            color: color,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                aggregate.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                  color: context.dsColors.textPrimary,
                ),
              ),
              if (aggregate.groupName != null)
                Text(
                  aggregate.groupName!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    color: context.dsColors.textSecondary,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        if (aggregate.isOverdue)
          Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: context.dsColors.error.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              context.l10n.dashboardOverdue,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w700,
                color: context.dsColors.error,
              ),
            ),
          ),
        Text(
          '${formatSum(aggregate.remaining)} so\'m',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: context.dsColors.error,
          ),
        ),
      ],
    );
  }
}

/// Bo'sh bo'lim uchun ixcham placeholder.
class _SectionEmpty extends StatelessWidget {
  final IconData icon;
  final String title;

  const _SectionEmpty({required this.icon, required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 20, color: context.dsColors.success),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontSize: 13.5,
                color: context.dsColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Yengil yuklanish indikatori.
class _InlineLoader extends StatelessWidget {
  const _InlineLoader();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 14),
      child: Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}

/// Ichki xato xabari.
class _InlineError extends StatelessWidget {
  final String message;

  const _InlineError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        'Xato: $message',
        style: TextStyle(fontSize: 12.5, color: context.dsColors.error),
      ),
    );
  }
}
