import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_card.dart';
import '../../../notifications/presentation/providers/notification_providers.dart';
import '../../../reports/presentation/providers/report_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../domain/entities/app_settings.dart';
import '../providers/settings_providers.dart';

/// Oylik hisobot (Telegram) sozlamalari bo'limi.
///
/// Phase 4 refactor: settings_page.dart (2293 qator) dan ajratib chiqarilgan
/// mustaqil widget. Business logic o'zgarmagan — hammasi provider/
/// command orqali, UI ichida logic yo'q.
class MonthlyReportSection extends ConsumerStatefulWidget {
  final AppSettings settings;

  const MonthlyReportSection({super.key, required this.settings});

  @override
  ConsumerState<MonthlyReportSection> createState() =>
      _MonthlyReportSectionState();
}

class _MonthlyReportSectionState extends ConsumerState<MonthlyReportSection> {
  late final TextEditingController _tokenController;
  late bool _enabled;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _tokenController =
        TextEditingController(text: widget.settings.telegramBotToken ?? '');
    _enabled = widget.settings.sendMonthlyReport;
  }

  @override
  void dispose() {
    _tokenController.dispose();
    super.dispose();
  }

  String get _token => _tokenController.text.trim();

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      // Izoh: bo'sh token ham saqlanadi ('' saqlanadi) — shunda admin
      // maydonni tozalab, avvalgi tokenni o'chira oladi.
      await ref.read(updateSettingsCommandProvider).execute(
            widget.settings.copyWith(
              telegramBotToken: _token,
              sendMonthlyReport: _enabled,
            ),
          );
      ref.invalidate(appSettingsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Hisobot sozlamalari saqlandi'),
          backgroundColor: context.dsColors.success,
        ),
      );
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _testBot() async {
    if (_token.isEmpty) {
      _showMessage("Avval bot tokenni kiriting", context.dsColors.warning);
      return;
    }
    setState(() => _busy = true);
    final ok = await ref
        .read(telegramServiceProvider)
        .verifyBotToken(_token);
    if (!mounted) return;
    setState(() => _busy = false);
    _showMessage(
      ok
          ? 'Bot ulandi ✓ — token to\'g\'ri'
          : 'Botga ulanish muvaffaqiyatsiz — tokenni tekshiring',
      ok ? context.dsColors.success : context.dsColors.error,
    );
  }

  Future<void> _syncContacts() async {
    setState(() => _busy = true);
    try {
      final result =
          await ref.read(syncTelegramContactsCommandProvider).execute();
      ref.invalidate(studentListVersionProvider);
      if (!mounted) return;
      _showMessage(
        '${result.linked} ta ota-ona bog\'landi, '
        '${result.unmatched} ta mos kelmadi',
        result.linked > 0 ? context.dsColors.success : context.dsColors.warning,
      );
    } on Failure catch (failure) {
      if (!mounted) return;
      _showMessage(failure.message, context.dsColors.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendReport() async {
    final now = DateTime.now();
    final prevYear = now.month == 1 ? now.year - 1 : now.year;
    final prevMonth = now.month == 1 ? 12 : now.month - 1;

    setState(() => _busy = true);
    try {
      final result = await ref
          .read(sendMonthlyReportCommandProvider)
          .execute(year: prevYear, month: prevMonth);
      ref.invalidate(monthlyAttendanceReportProvider);
      ref.invalidate(notificationListVersionProvider);
      if (!mounted) return;
      if (result.disabled) {
        _showMessage(
          "Hisobot yuborish o'chirilgan — yuqoridagi tugmani yoqing",
          context.dsColors.warning,
        );
      } else {
        _showMessage(
          'Yuborildi: ${result.sent} • O\'tkazib yuborildi: ${result.skipped} '
          '(Telegram ID yo\'q) • Xato: ${result.failed}',
          result.failed == 0 ? context.dsColors.success : context.dsColors.warning,
        );
      }
    } on Failure catch (failure) {
      if (!mounted) return;
      _showMessage(failure.message, context.dsColors.error);
    } catch (e) {
      if (!mounted) return;
      _showMessage('Xatolik: $e', context.dsColors.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showMessage(String text, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), backgroundColor: color),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Bog'langan ota-onalar soni (joriy oy hisobotidan).
    final now = DateTime.now();
    final summary =
        ref.watch(monthlyAttendanceReportProvider((now.year, now.month)))
            .valueOrNull;
    final linked = summary?.where((s) => s.hasTelegramContact).length ?? 0;

    return AppCard(
      child: Column(
        children: [
          SwitchListTile(
            title: const Text('Oylik davomat hisobotini yuborish'),
            subtitle: const Text(
              'Oy yakunida ota-onalarga necha kun kelgani va kelmagani '
              'Telegram orqali yuboriladi',
            ),
            value: _enabled,
            onChanged: (value) => setState(() => _enabled = value),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _tokenController,
                  decoration: const InputDecoration(
                    labelText: 'Telegram bot token',
                    hintText: '123456789:AA...',
                    prefixIcon: Icon(Icons.key_outlined),
                    helperText: 'BotFather dan /newbot orqali oling',
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : _testBot,
                        icon: _busy
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.wifi_tethering),
                        label: const Text('Test'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _busy ? null : _save,
                        icon: const Icon(Icons.save_outlined),
                        label: Text(_busy ? 'Saqlanmoqda…' : 'Saqlash'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: context.dsColors.info.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border:
                        Border.all(color: context.dsColors.info.withValues(alpha: 0.25)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline, size: 18, color: context.dsColors.info),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Ota-ona bog\'lash: ota-ona botga o\'z telefon '
                          'raqamini (masalan +998901234567) yozib yuboradi, '
                          'so\'ng "Kontaktlarni sinxronlash" tugmasini bosing.',
                          style: TextStyle(
                            fontSize: 12,
                            height: 1.4,
                            color: context.dsColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _syncContacts,
                  icon: const Icon(Icons.sync),
                  label: const Text('Kontaktlarni sinxronlash'),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _sendReport,
                  icon: const Icon(Icons.send_outlined),
                  label: const Text("Hisobotni yuborish (o'tgan oy)"),
                ),
                SizedBox(height: 12),
                TextButton.icon(
                  onPressed: () => context.push('/reports/monthly'),
                  icon: Icon(Icons.assignment_outlined),
                  label: Text('Oylik hisobotni ko\'rish'),
                ),
                SizedBox(height: 4),
                Text(
                  '$linked ta ota-ona Telegram\'ga bog\'langan',
                  style: TextStyle(
                    fontSize: 12,
                    color: context.dsColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
