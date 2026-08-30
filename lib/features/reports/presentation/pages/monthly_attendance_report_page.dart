import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_card.dart';
import '../../../notifications/presentation/providers/notification_providers.dart';
import '../../../settings/presentation/providers/settings_providers.dart';
import '../../domain/entities/monthly_attendance_summary.dart';
import '../providers/report_providers.dart';

/// Oylik davomat hisoboti sahifasi.
///
/// Har bir o'quvchi uchun necha kun kelgani va kelmagani ko'rsatiladi.
/// Tanlangan oy uchun hisobotni ota-onalarga Telegram orqali yuborish
/// mumkin (Settings'da o'chirilgan bo'lsa — yuborilmaydi).
class MonthlyAttendanceReportPage extends ConsumerStatefulWidget {
  const MonthlyAttendanceReportPage({super.key});

  @override
  ConsumerState<MonthlyAttendanceReportPage> createState() =>
      _MonthlyAttendanceReportPageState();
}

class _MonthlyAttendanceReportPageState
    extends ConsumerState<MonthlyAttendanceReportPage> {
  late int _year;
  late int _month;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _year = now.year;
    _month = now.month;
  }

  void _changeMonth(int delta) {
    final total = _year * 12 + (_month - 1) + delta;
    setState(() {
      _year = total ~/ 12;
      _month = (total % 12) + 1;
    });
  }

  Future<void> _send() async {
    setState(() => _sending = true);
    try {
      final result = await ref
          .read(sendMonthlyReportCommandProvider)
          .execute(year: _year, month: _month);
      ref.invalidate(notificationListVersionProvider);
      if (!mounted) return;
      final message = result.disabled
          ? "Hisobot yuborish o'chirilgan — Settings → Oylik hisobot → tugmani yoqing"
          : "Yuborildi: ${result.sent} • Telegram ID yo'q: ${result.skipped} • "
              "Xato: ${result.failed}";
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor:
              result.failed == 0 ? context.dsColors.success : context.dsColors.warning,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$e'),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final report =
        ref.watch(monthlyAttendanceReportProvider((_year, _month)));
    final settings = ref.watch(appSettingsProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(title: const Text('Oylik davomat hisoboti')),
      body: Column(
        children: [
          _buildMonthSelector(),
          Expanded(
            child: report.when(
              loading: () =>
                  Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Text('Xato: $error',
                    style: TextStyle(color: context.dsColors.error)),
              ),
              data: (summaries) {
                if (summaries.isEmpty) {
                  return Center(
                    child: Text(
                      "Bu oy uchun faol o'quvchilar yo'q",
                      style: TextStyle(color: context.dsColors.textSecondary),
                    ),
                  );
                }
                return _ReportList(
                  summaries: summaries,
                  sending: _sending,
                  enabled: settings?.sendMonthlyReport ?? false,
                  onSend: _send,
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMonthSelector() {
    final monthName = _monthNameUz(_month);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: AppCard(
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              icon: Icon(Icons.chevron_left),
              onPressed: () => _changeMonth(-1),
            ),
            Column(
              children: [
                Text(
                  monthName,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.textPrimary,
                  ),
                ),
                Text(
                  '$_year',
                  style: TextStyle(
                    fontSize: 12,
                    color: context.dsColors.textSecondary,
                  ),
                ),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.chevron_right),
              onPressed: () => _changeMonth(1),
            ),
          ],
        ),
      ),
    );
  }

  static String _monthNameUz(int month) {
    const months = [
      'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
      'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
    ];
    return months[month - 1];
  }
}

class _ReportList extends StatelessWidget {
  final List<MonthlyAttendanceSummary> summaries;
  final bool sending;
  final bool enabled;
  final VoidCallback onSend;

  const _ReportList({
    required this.summaries,
    required this.sending,
    required this.enabled,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    final linked = summaries.where((s) => s.hasTelegramContact).length;
    final avgPresent = summaries.isEmpty
        ? 0
        : summaries.fold<int>(
                0, (sum, s) => sum + s.presentDays) ~/
            summaries.length;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            _StatChip(
              label: "O'quvchilar",
              value: '${summaries.length}',
              color: context.dsColors.accent,
            ),
            const SizedBox(width: 10),
            _StatChip(
              label: "Telegram'da",
              value: '$linked',
              color: context.dsColors.success,
            ),
            const SizedBox(width: 10),
            _StatChip(
              label: "O'rt. kelgan",
              value: '$avgPresent kun',
              color: context.dsColors.info,
            ),
          ],
        ),
        const SizedBox(height: 16),
        for (final summary in summaries) _SummaryRow(summary: summary),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: sending ? null : onSend,
          icon: sending
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.send_outlined),
          label: Text(sending
              ? 'Yuborilmoqda…'
              : 'Ota-onalarga Telegram orqali yuborish'),
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
        SizedBox(height: 8),
        Text(
          enabled
              ? "Hisobot $linked ta bog'langan ota-onaga yuboriladi"
              : "Hisobot yuborish o'chirilgan — Settings → Oylik hisobot bo'limidan yoqing",
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            color: enabled ? context.dsColors.textSecondary : context.dsColors.warning,
          ),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: color.withValues(alpha: 0.1),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
            SizedBox(height: 2),
            Text(
              label,
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
}

class _SummaryRow extends StatelessWidget {
  final MonthlyAttendanceSummary summary;
  const _SummaryRow({required this.summary});

  @override
  Widget build(BuildContext context) {
    final percent = summary.attendancePercent;
    final color = percent >= 80
        ? context.dsColors.success
        : percent >= 60
            ? context.dsColors.warning
            : context.dsColors.error;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.person_outline, size: 20, color: color),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        summary.fullName,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: context.dsColors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        summary.groupName ?? 'Guruhsiz',
                        style: TextStyle(
                          fontSize: 11,
                          color: context.dsColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                if (summary.hasTelegramContact)
                  Tooltip(
                    message: "Telegram bog'langan",
                    child: Icon(Icons.check_circle, size: 18, color: context.dsColors.success),
                  )
                else
                  Tooltip(
                    message: "Telegram bog'lanmagan",
                    child: Icon(Icons.circle_outlined, size: 18, color: context.dsColors.textTertiary),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _DayStat(label: 'Kelgan', value: summary.presentDays, color: context.dsColors.success),
                _DayStat(label: 'Kelmagan', value: summary.absentDays, color: context.dsColors.error),
                Column(
                  children: [
                    Text(
                      '${percent.toStringAsFixed(0)}%',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: color,
                      ),
                    ),
                    Text(
                      'Davomat',
                      style: TextStyle(fontSize: 11, color: context.dsColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DayStat extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _DayStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          '$value',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(fontSize: 11, color: context.dsColors.textSecondary),
        ),
      ],
    );
  }
}
