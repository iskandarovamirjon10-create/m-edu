import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../design/design.dart';

import '../../../../shared/design_system/app/app_surface.dart';
import '../../../../shared/design_system/loading_shimmer.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../payments/domain/entities/debt.dart';
import '../../../payments/presentation/providers/payment_providers.dart';
import '../../../settings/domain/entities/app_settings.dart';
import '../../../settings/presentation/providers/settings_providers.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// ALERT CENTER (Phase 4, spec §20 / Phase 1 \"Bugungi holat\").
///
/// REAL sozlamalar va REAL ma'lumotlardan keladigan holat tekshiruvi:
/// - Kamera / Face ID: `hikvisionEnabled` + IP konfiguratsiya
/// - Telegram: `telegramEnabled` + token (secure storage'da)
/// - Backup: `lastBackupDate`
/// - Printer: `printerName`
/// - Qarzdorlik: `outstandingDebtsProvider` (real DB)
///
/// FAKE SUCCESS YO'Q: faqat haqiqiy holat ko'rsatiladi. Masalan kamera
/// ulanmagan bo'lsa — \"Kamera sozlanmagan\"; \"Camera active\" deb yolg'on
/// ko'rsatilmaydi. Hamma narsa soz bo'lsa — blok ko'rsatilmaydi (0 xato).
/// ═══════════════════════════════════════════════════════════════════════
class HomeAlertCenter extends ConsumerWidget {
  const HomeAlertCenter({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(appSettingsProvider);
    final debtsAsync = ref.watch(outstandingDebtsProvider);

    return settingsAsync.when(
      loading: () => const _AlertsSkeleton(),
      error: (e, _) => _AlertsError(message: '$e'),
      data: (settings) => debtsAsync.when(
        loading: () => const _AlertsSkeleton(),
        error: (e, _) => _AlertsError(message: '$e'),
        data: (debts) {
          final alerts = _collectAlerts(settings, debts);

          final colors = context.dsColors;
          final hasCritical = alerts.any((a) => a.severity == _AlertSeverity.critical);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (alerts.isNotEmpty)
                AppSurface.glass(
                  elevation: 1,
                  padding: const EdgeInsets.all(16),
                  borderRadius: DsRadius.lg,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: hasCritical ? colors.error : colors.warning,
                              boxShadow: [
                                BoxShadow(
                                  color: (hasCritical ? colors.error : colors.warning)
                                      .withValues(alpha: 0.5),
                                  blurRadius: 6,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Diqqat talab',
                            style: DsType.h3(color: colors.textPrimary),
                          ),
                          const Spacer(),
                          Text(
                            '${alerts.length}',
                            style: DsType.label(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      for (var i = 0; i < alerts.length; i++) ...[
                        _AlertRow(alert: alerts[i]),
                        if (i != alerts.length - 1)
                          Divider(
                            height: 1,
                            color: colors.divider.withValues(alpha: 0.4),
                          ),
                      ],
                    ],
                  ),
                ),
              // Spec §03: "Kutilmoqda" holatidagi dars 24 soatdan ko'p
              // qolsa — Dashboard ogohlantirishiga chiqadi.
              const _PendingAttendanceAlert(),
            ],
          );
        },
      ),
    );
  }

  /// REAL holatlar asosida alertlar ro'yxatini yig'adi.
  ///
  /// Har bir alert: qaysi qurilma/sozlama, holat, og'irlik va (agar mavjud
  /// bo'lsa) yo'naltiriladigan sozlamalar sahifasi.
  static List<_Alert> _collectAlerts(
    AppSettings settings,
    List<Debt> debts,
  ) {
    final alerts = <_Alert>[];

    // ── Kamera / Face ID ────────────────────────────────────────────────
    if (!settings.hikvisionEnabled) {
      alerts.add(_Alert(
        icon: Icons.videocam_off_outlined,
        title: 'Kamera sozlanmagan',
        subtitle: 'Face ID davomati uchun kamerani sozlang',
        severity: _AlertSeverity.critical,
        route: '/settings',
        isShellBranch: true,
      ));
    } else if (settings.hikvisionIp == null || settings.hikvisionIp!.trim().isEmpty) {
      alerts.add(_Alert(
        icon: Icons.videocam_off_outlined,
        title: 'Kamera IP kiritilmagan',
        subtitle: 'Kamera ulangan, lekin IP manzili yo\'q',
        severity: _AlertSeverity.critical,
        route: '/settings',
        isShellBranch: true,
      ));
    }

    // ── Telegram ────────────────────────────────────────────────────────
    if (!settings.telegramEnabled) {
      alerts.add(_Alert(
        icon: Icons.send_outlined,
        title: 'Telegram ulanmagan',
        subtitle: 'Ota-onalarga hisobot yuborish o\'chirilgan',
        severity: _AlertSeverity.warning,
        route: '/settings',
        isShellBranch: true,
      ));
    }

    // ── Backup ──────────────────────────────────────────────────────────
    if (settings.lastBackupDate == null) {
      alerts.add(_Alert(
        icon: Icons.backup_outlined,
        title: 'Backup qilinmagan',
        subtitle: 'Zaxira nusxa olish tavsiya etiladi',
        severity: _AlertSeverity.warning,
        route: '/settings',
        isShellBranch: true,
      ));
    }

    // ── Printer ─────────────────────────────────────────────────────────
    if (settings.printerName == null || settings.printerName!.trim().isEmpty) {
      alerts.add(_Alert(
        icon: Icons.print_outlined,
        title: 'Printer sozlanmagan',
        subtitle: 'Kvitansiya chop etish uchun printer tanlang',
        severity: _AlertSeverity.low,
        route: '/settings',
        isShellBranch: true,
      ));
    }

    // ── Qarzdorlik (real DB) ────────────────────────────────────────────
    if (debts.isNotEmpty) {
      alerts.add(_Alert(
        icon: Icons.warning_amber_rounded,
        title: '${debts.length} ta ochiq qarzdorlik',
        subtitle: 'Qarzdor talabalar ro\'yxatini ko\'ring',
        severity: _AlertSeverity.warning,
        route: '/payments/debts',
      ));
    }

    return alerts;
  }
}

enum _AlertSeverity { low, warning, critical }

class _Alert {
  final IconData icon;
  final String title;
  final String subtitle;
  final _AlertSeverity severity;
  final String route;

  /// Shell branch'iga (masalan /settings) go() bilan o'tiladi — More
  /// sahifasidagi `isBranchGo` bilan bir xil qoida (review Phase 4 #1).
  final bool isShellBranch;

  const _Alert({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.severity,
    required this.route,
    this.isShellBranch = false,
  });
}

/// 24 soatdan KO'P kutib qolgan, hali davomat belgilanmagan darslar
/// ogohlantirishi (spec: Attendance Center bilan bog'langan, real bazadan
/// hisoblanadi — fake statistika yo'q).
class _PendingAttendanceAlert extends ConsumerWidget {
  const _PendingAttendanceAlert();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final countAsync = ref.watch(pendingAttendanceCountProvider);
    final count = countAsync.valueOrNull ?? 0;
    if (count <= 0) return const SizedBox.shrink();

    final colors = context.dsColors;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: AppSurface.glass(
        elevation: 1,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        borderRadius: DsRadius.lg,
        onTap: () => context.push('/attendance/center'),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: colors.warning.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.how_to_reg_outlined,
                  size: 19, color: colors.warning),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$count ta dars uchun davomat 24 soatdan ko\'p kutmoqda',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.bodyStrong(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Belgilanmagan davomatlarni ko\'ring',
                    style: DsType.caption(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: colors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}

class _AlertRow extends StatelessWidget {
  final _Alert alert;

  const _AlertRow({required this.alert});

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final color = switch (alert.severity) {
      _AlertSeverity.critical => colors.error,
      _AlertSeverity.warning => colors.warning,
      _AlertSeverity.low => colors.info,
    };

    return InkWell(
      onTap: () {
        // Shell branch'lari (settings) — go(); oddiy sahifalar — push().
        if (alert.isShellBranch) {
          context.go(alert.route);
        } else {
          context.push(alert.route);
        }
      },
      borderRadius: BorderRadius.circular(DsRadius.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(alert.icon, size: 19, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    alert.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.bodyStrong(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    alert.subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: DsType.caption(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: colors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}

class _AlertsSkeleton extends StatelessWidget {
  const _AlertsSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: const [
        LoadingShimmer(width: 120, height: 14),
        SizedBox(height: 10),
        LoadingShimmer(height: 46),
        SizedBox(height: 8),
        LoadingShimmer(height: 46),
      ],
    );
  }
}

class _AlertsError extends StatelessWidget {
  final String message;

  const _AlertsError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Text(
      'Holat yuklanmadi: $message',
      style: DsType.caption(
        color: context.dsColors.error,
      ),
    );
  }
}
