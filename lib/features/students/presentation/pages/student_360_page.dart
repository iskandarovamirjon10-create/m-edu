// Student 360 page — full aggregate view.
//
// F24 fix: Student 360 aggregator is now exposed via a dedicated page.
// Reached from /students/:identityId/360 (push route from StudentDetailPage
// "View 360" action) and from /identity/:identityId (existing identity
// detail for completeness).
//
// Architecture:
//   page  →  student360Provider  →  Student360Aggregator
//         →  10 snapshot composition
//
// The page treats each snapshot as an independent card. Cards that
// `isAvailable=false` or `hasAny=false` are visually muted but still
// rendered (no crash, no empty state, no data lost).
import 'package:flutter/material.dart';
import 'package:m_edu/core/extensions/l10n_context.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../design/design.dart';

import '../../../../core/error/failures.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../scheduling/domain/entities/schedule.dart';
import '../../domain/student_360/student_360.dart';
import '../providers/student_360_providers.dart';

class Student360Page extends ConsumerWidget {
  final String identityId;
  const Student360Page({super.key, required this.identityId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(student360Provider(identityId));
    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.student360Title),
        actions: [
          IconButton(
            tooltip: 'Yangilash',
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(student360Provider(identityId)),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorView(error: e),
        data: (s360) => _Body(s360: s360),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final Object error;
  const _ErrorView({required this.error});

  @override
  Widget build(BuildContext context) {
    final isAuth = error is PermissionDeniedFailure;
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isAuth ? Icons.lock_outline : Icons.error_outline,
              size: 64,
              color: context.dsColors.error,
            ),
            const SizedBox(height: 16),
            Text(
              isAuth
                  ? "Sizda bu talabaning ma'lumotini ko'rish uchun ruxsat yo'q"
                  : "Ma'lumotni yuklashda xatolik",
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              isAuth
                  ? "Admin yoki direktor bilan bog'laning"
                  : "$error",
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final Student360 s360;
  const _Body({required this.s360});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _IdentityCard(s360: s360),
        const SizedBox(height: 12),
        _AcademicCard(s360: s360),
        const SizedBox(height: 12),
        _AttendanceCard(s360: s360),
        const SizedBox(height: 12),
        _FinancialCard(s360: s360),
        const SizedBox(height: 12),
        _CommunicationCard(s360: s360),
        const SizedBox(height: 12),
        _ScheduleCard(s360: s360),
        const SizedBox(height: 12),
        _CrmCard(s360: s360),
        const SizedBox(height: 12),
        _TimelineCard(s360: s360),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;
  final bool muted;

  const _Card({
    required this.title,
    required this.icon,
    required this.child,
    this.muted = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: muted ? 0 : 2,
      color: muted
          ? theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5)
          : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: theme.textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _IdentityCard extends StatelessWidget {
  final Student360 s360;
  const _IdentityCard({required this.s360});
  @override
  Widget build(BuildContext context) {
    final i = s360.identity;
    return _Card(
      title: 'Shaxs',
      icon: Icons.person,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(i.fullName, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text('ID: ${i.identityId}'),
          if (i.phone != null) Text('Tel: ${i.phone}'),
          Text(
            'Holati: ${_statusLabel(i.status)}',
            style: TextStyle(
              color: i.status == IdentityStatus.active
                  ? Colors.green
                  : Colors.orange,
            ),
          ),
        ],
      ),
    );
  }

  String _statusLabel(IdentityStatus s) {
    switch (s) {
      case IdentityStatus.active:
        return 'Faol';
      case IdentityStatus.frozen:
        return 'Muzlatilgan';
      case IdentityStatus.graduated:
        return 'Bitirgan';
      case IdentityStatus.archived:
        return 'Arxivlangan';
    }
  }
}

class _AcademicCard extends StatelessWidget {
  final Student360 s360;
  const _AcademicCard({required this.s360});
  @override
  Widget build(BuildContext context) {
    final a = s360.academic;
    return _Card(
      title: 'Akademik',
      icon: Icons.school,
      muted: !a.hasGroup,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Guruh: ${a.currentGroupName ?? a.currentGroupId ?? "—"}'),
          if (a.academicYear != null) Text('Yil: ${a.academicYear}'),
          Text('Status: ${a.studentStatus}'),
          if (a.isPendingTransfer)
            const Text(
              "Guruh o'tkazish jarayonda",
              style: TextStyle(color: Colors.orange),
            ),
        ],
      ),
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  final Student360 s360;
  const _AttendanceCard({required this.s360});
  @override
  Widget build(BuildContext context) {
    final a = s360.attendance;
    final muted = !a.isAvailable;
    return _Card(
      title: 'Davomat',
      icon: Icons.event_available,
      muted: muted,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!a.isAvailable)
            Text(context.l10n.studentNoAttendanceStats)
          else ...[
            Text(
              'Foiz: ${a.percentage.toStringAsFixed(1)}%',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 4),
            Text('Jami: ${a.scheduledLessons} dars'),
            Text('Keldi: ${a.totalAttended}'),
            Text('Kechikdi: ${a.lateLessons}'),
            Text('Sababli: ${a.excusedLessons}'),
            Text('Kelmadi: ${a.absentLessons}'),
          ],
        ],
      ),
    );
  }
}

class _FinancialCard extends StatelessWidget {
  final Student360 s360;
  const _FinancialCard({required this.s360});
  @override
  Widget build(BuildContext context) {
    final f = s360.financial;
    return _Card(
      title: 'Moliya',
      icon: Icons.payments,
      muted: !f.hasAnyPayment && !f.hasDebt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (f.hasAnyPayment) ...[
            Text(
              'Jami to\'langan: ${_money(f.totalPaid)}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text('To\'lovlar: ${f.paymentCount}'),
            if (f.lastPaymentDate != null)
              Text(
                'Oxirgisi: ${DateFormat.yMMMd().format(f.lastPaymentDate!)}',
              ),
          ],
          if (f.hasDebt) ...[
            const SizedBox(height: 8),
            Text(
              'Qarz: ${_money(f.outstandingDebt)}',
              style: TextStyle(
                color: context.dsColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (f.hasOverdue)
              Text(
                'Muddati o\'tgan: ${DateFormat.yMMMd().format(f.nearestOverdueAt!)}',
                style: TextStyle(color: context.dsColors.error),
              ),
          ],
          if (!f.hasAnyPayment && !f.hasDebt) Text(context.l10n.studentNoPayments),
        ],
      ),
    );
  }

  String _money(int uzs) =>
      '${NumberFormat.decimalPattern().format(uzs)} so\'m';
}

class _CommunicationCard extends StatelessWidget {
  final Student360 s360;
  const _CommunicationCard({required this.s360});
  @override
  Widget build(BuildContext context) {
    final c = s360.communication;
    return _Card(
      title: 'Aloqa',
      icon: Icons.chat,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                c.telegramLinked ? Icons.check_circle : Icons.cancel,
                color: c.telegramLinked ? context.dsColors.success : context.dsColors.textTertiary,
                size: 16,
              ),
              const SizedBox(width: 4),
              Text(
                'Telegram: ${c.telegramLinked ? "bog'langan" : "bog'lanmagan"}',
              ),
            ],
          ),
          if (c.smsHistory.isEmpty && !c.smsAvailable)
            const Text('SMS tarixi mavjud emas (sms: intent — provider yo\'q)'),
          const SizedBox(height: 4),
          Text(
            'Bildirishnomalar: ${c.notificationHistory.length} ta',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  final Student360 s360;
  const _ScheduleCard({required this.s360});
  @override
  Widget build(BuildContext context) {
    final sc = s360.schedule;
    return _Card(
      title: 'Dars jadvali',
      icon: Icons.calendar_today,
      muted: !sc.hasGroup,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!sc.hasGroup)
            Text(context.l10n.studentNotInGroup)
          else if (sc.todayLessons.isEmpty)
            const Text('Bugun dars yo\'q')
          else ...[
            const Text('Bugungi darslar:'),
            const SizedBox(height: 4),
            for (final s in sc.todayLessons.take(5)) _ScheduleRow(s: s),
            if (sc.upcomingLessons.isNotEmpty) ...[
              const SizedBox(height: 8),
              const Text('Yaqin orada:'),
              for (final s in sc.upcomingLessons.take(3)) _ScheduleRow(s: s),
            ],
          ],
        ],
      ),
    );
  }
}

class _ScheduleRow extends StatelessWidget {
  final Schedule s;
  const _ScheduleRow({required this.s});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Text(
        '${s.timeRange} — ${s.subject ?? "—"}',
        style: Theme.of(context).textTheme.bodySmall,
      ),
    );
  }
}

class _CrmCard extends StatelessWidget {
  final Student360 s360;
  const _CrmCard({required this.s360});
  @override
  Widget build(BuildContext context) {
    final c = s360.crm;
    return _Card(
      title: 'CRM (Lead)',
      icon: Icons.people_alt,
      muted: !c.hasLead,
      child: c.hasLead
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Manba: ${c.source ?? "—"}'),
                if (c.capturedAt != null)
                  Text(
                    "Qabul: ${DateFormat.yMMMd().format(c.capturedAt!)}",
                  ),
                if (c.convertedAt != null)
                  Text(
                    "Konvertatsiya: ${DateFormat.yMMMd().format(c.convertedAt!)}",
                  ),
                Text('Ball: ${c.score}'),
              ],
            )
          : Text(context.l10n.studentNotFromCrm),
    );
  }
}

class _TimelineCard extends StatelessWidget {
  final Student360 s360;
  const _TimelineCard({required this.s360});
  @override
  Widget build(BuildContext context) {
    final tl = s360.timeline;
    return _Card(
      title: "Faoliyat tarixi",
      icon: Icons.timeline,
      muted: !tl.hasAny,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!tl.hasAny)
            Text(context.l10n.studentNoEvents)
          else
            for (final e in tl.events.take(10))
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(e.description),
                subtitle: Text(
                  '${e.type} • ${DateFormat.yMMMd().add_Hm().format(e.occurredAt)}',
                ),
              ),
          if (tl.events.length > 10)
            Text('+${tl.events.length - 10} ta yana...'),
        ],
      ),
    );
  }
}
