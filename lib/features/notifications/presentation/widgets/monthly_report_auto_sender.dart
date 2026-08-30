import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../settings/presentation/providers/settings_providers.dart';
import '../providers/notification_providers.dart';

/// Oylik davomat hisobotini avtomatik yuboruvchi (ko'rinmas) vidjet.
///
/// Sahifa ochilganda tekshiradi: agar Settings'da `sendMonthlyReport`
/// yoqilgan bo'lsa va o'tgan oy uchun hisobot hali yuborilmagan bo'lsa —
/// o'tgan oy hisobotini ota-onalarga Telegram orqali yuboradi
/// (oy yakunida avtomatik ishlash uchun).
///
/// Settings'dan o'chirilgan bo'lsa — hech narsa qilmaydi.
class MonthlyReportAutoSender extends ConsumerStatefulWidget {
  const MonthlyReportAutoSender({super.key});

  @override
  ConsumerState<MonthlyReportAutoSender> createState() =>
      _MonthlyReportAutoSenderState();
}

class _MonthlyReportAutoSenderState extends ConsumerState<MonthlyReportAutoSender> {
  bool _checked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  Future<void> _check() async {
    if (_checked) return;
    _checked = true;

    try {
      final settings = await ref.read(appSettingsProvider.future);
      if (!settings.sendMonthlyReport) return;

      final token = settings.telegramBotToken?.trim() ?? '';
      if (token.isEmpty) return;

      final now = DateTime.now();
      // O'tgan oy (oy yakunida hisobot shu oy uchun yuboriladi).
      final prevYear = now.month == 1 ? now.year - 1 : now.year;
      final prevMonth = now.month == 1 ? 12 : now.month - 1;
      final prevKey = '$prevYear-${prevMonth.toString().padLeft(2, '0')}';

      if (settings.lastMonthlyReportSent == prevKey) return;

      await ref
          .read(sendMonthlyReportCommandProvider)
          .execute(year: prevYear, month: prevMonth);
    } catch (_) {
      // Avtomatik yuborish xatosiz o'tishi kerak — UI ni to'sib qo'ymaymiz.
    }
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
