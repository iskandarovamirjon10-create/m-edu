import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';

import '../../../../shared/design_system/app/app_surface.dart';
import '../../../../shared/design_system/loading_shimmer.dart';
import '../../../attendance/domain/entities/attendance_entry.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../payments/domain/entities/payment.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../providers/dashboard_stats_provider.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// SO'NGI FAOLIYAT (Section 2 — "Ikki ustunli pastki blok")
///
/// Activity feed — Identity Timeline'dan. Real hodisalar:
/// - Ro'yxatga olish (Identity.createdAt)
/// - Davomat belgilash (bugungi yozuvlar)
/// - To'lov qabul qilish (Payment.paymentDate)
/// Birlashtiriladi va vaqt bo'yicha saralanadi.
/// ═══════════════════════════════════════════════════════════════════════
class ActivityFeed extends ConsumerWidget {
  const ActivityFeed({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final identitiesAsync = ref.watch(identityListProvider);
    final attendanceAsync = ref.watch(todayAttendanceProvider);
    final paymentsAsync = ref.watch(paymentListProvider);

    return AppSurface.glass(
      elevation: 1,
      padding: const EdgeInsets.all(20),
      borderRadius: DsRadius.lg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "So'nggi faoliyat",
                style: DsType.h3(
                  color: context.dsColors.textPrimary,
                ),
              ),
              TextButton(
                onPressed: () => context.push('/identity'),
                child: const Text('Barchasi'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Pendant'da yuklanguncha skeleton.
          if (identitiesAsync.isLoading &&
              attendanceAsync.isLoading &&
              paymentsAsync.isLoading)
            const _FeedSkeleton()
          else
            _buildFeed(context, ref, identitiesAsync, attendanceAsync, paymentsAsync),
        ],
      ),
    );
  }

  Widget _buildFeed(
    BuildContext context,
    WidgetRef ref,
    AsyncValue<List<Identity>> identitiesAsync,
    AsyncValue<List<AttendanceEntry>> attendanceAsync,
    AsyncValue<List<Payment>> paymentsAsync,
  ) {
    final colors = context.dsColors;
    final events = <FeedEvent>[];

    // Ro'yxatga olingan shaxslar.
    final identities = identitiesAsync.valueOrNull ?? const <Identity>[];
    for (final identity in identities.take(15)) {
      events.add(FeedEvent(
        time: identity.createdAt,
        icon: _identityIcon(identity.role),
        color: colors.accent,
        title: identity.fullName,
        subtitle: '${_roleLabel(identity.role)} ro\'yxatga olindi',
        actionIcon: Icons.chevron_right_rounded,
        onTap: () => context.push('/identity/${identity.identityId}'),
      ));
    }

    // Bugungi davomat.
    final entries = attendanceAsync.valueOrNull ?? const <AttendanceEntry>[];
    for (final entry in entries.take(15)) {
      final (label, color) = _methodInfo(entry.method, colors);
      events.add(FeedEvent(
        time: entry.timestamp,
        icon: Icons.how_to_reg_rounded,
        color: color,
        title: entry.fullName,
        subtitle: 'Davomat belgilandi ($label)',
        actionIcon: Icons.chevron_right_rounded,
        onTap: () => context.push('/attendance'),
      ));
    }

    // To'lovlar.
    final payments = paymentsAsync.valueOrNull ?? const <Payment>[];
    for (final payment in payments.take(15)) {
      events.add(FeedEvent(
        time: payment.paymentDate,
        icon: Icons.payments_outlined,
        color: colors.warning,
        title: payment.studentName ?? payment.studentIdentityId,
        subtitle:
            '${formatAmount(payment.paidAmount)} so\'m to\'lov qabul qilindi',
        actionIcon: Icons.chevron_right_rounded,
        onTap: () => context.push('/finance'),
      ));
    }

    events.sort((a, b) => b.time.compareTo(a.time));

    if (events.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Column(
          children: [
            Icon(
              Icons.auto_awesome_outlined,
              size: 32,
              color: colors.textTertiary,
            ),
            const SizedBox(height: 10),
            Text(
              'Hali hech qanday faoliyat yo\'q',
              style: DsType.body(color: colors.textSecondary),
            ),
          ],
        ),
      );
    }

    final visible = events.take(6).toList();
    return Column(
      children: [
        for (var i = 0; i < visible.length; i++)
          _FeedRow(
            event: visible[i],
            isLast: i == visible.length - 1,
          ),
      ],
    );
  }

  static IconData _identityIcon(IdentityRole role) {
    return switch (role) {
      IdentityRole.student => Icons.school_outlined,
      IdentityRole.teacher => Icons.co_present_outlined,
      IdentityRole.staff => Icons.badge_outlined,
      IdentityRole.parent => Icons.family_restroom_outlined,
    };
  }

  static String _roleLabel(IdentityRole role) {
    return switch (role) {
      IdentityRole.student => 'Talaba',
      IdentityRole.teacher => "O'qituvchi",
      IdentityRole.staff => 'Xodim',
      IdentityRole.parent => 'Ota-ona',
    };
  }

  static (String, Color) _methodInfo(String method, DsColors colors) {
    return switch (method) {
      'face' => ('Yuz', colors.accent),
      'qr' => ('QR', colors.info),
      _ => ('Qo\'lda', colors.success),
    };
  }
}

/// Feed hodisasi.
class FeedEvent {
  final DateTime time;
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final IconData? actionIcon;
  final VoidCallback onTap;

  const FeedEvent({
    required this.time,
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    this.actionIcon,
    required this.onTap,
  });
}

class _FeedRow extends StatelessWidget {
  final FeedEvent event;
  final bool isLast;

  const _FeedRow({required this.event, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;

    return InkWell(
      onTap: event.onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            // Ikon.
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: event.color.withValues(alpha: 0.13),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(event.icon, size: 16, color: event.color),
            ),
            const SizedBox(width: 12),
            // Matn.
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.bodyStrong(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    event.subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.caption(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            // Vaqt + chevron.
            Text(
              _relativeTime(event.time),
              style: DsType.caption(color: colors.textTertiary),
            ),
            if (event.actionIcon != null) ...[
              const SizedBox(width: 2),
              Icon(
                event.actionIcon,
                size: 16,
                color: colors.textTertiary,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FeedSkeleton extends StatelessWidget {
  const _FeedSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: const [
        LoadingShimmer(height: 34, borderRadius: 10),
        SizedBox(height: 12),
        LoadingShimmer(height: 34, borderRadius: 10),
        SizedBox(height: 12),
        LoadingShimmer(height: 34, borderRadius: 10),
      ],
    );
  }
}

/// Nisbiy vaqt: "hozir", "5 daqiqa oldin", "2 soat oldin", "dushanba", ...
String _relativeTime(DateTime time) {
  final now = DateTime.now();
  final diff = now.difference(time);

  if (diff.inSeconds < 60) return 'hozir';
  if (diff.inMinutes < 60) return '${diff.inMinutes} daq';
  if (diff.inHours < 24 && now.day == time.day) return '${diff.inHours} soat';
  if (diff.inDays < 7) {
    const days = [
      'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba',
      'yakshanba',
    ];
    return days[time.weekday - 1];
  }
  return '${time.day}.${time.month}';
}


