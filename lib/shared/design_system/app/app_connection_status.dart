import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/connectivity/connectivity_manager.dart';
import '../../../core/network/sync_providers.dart';
import '../../../core/network/sync_status.dart';
import '../../../design/design.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// APP — ULANISH + SYNC HOLATI (ULTRA CORE §43, comfort #13/#14)
///
/// Bitta ixcham, bloklamaydigan ko'rsatkich: ONLINE/OFFLINE/WIFI/LAN/
/// ETHERNET + SYNCING/SYNCED/SYNC ERROR.
/// ═══════════════════════════════════════════════════════════════════════

class AppConnectionStatus extends ConsumerWidget {
  const AppConnectionStatus({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.dsColors;

    // Connectivity — real platform holati (offline-first §6).
    final connectionAsync = ref.watch(connectionStatusProvider);
    final connection = connectionAsync.valueOrNull;
    final offline = connection == null || connection.isOffline;

    // Sync — real sync engine holati (§7, §43).
    final sync = ref.watch(syncStatusControllerProvider);

    // Sokin holat: internet+sync hammasi joyida → qisqa ko'rinish.
    final (icon, tone, label, tooltip) =
        _resolve(colors, offline, connection, sync);

    return Tooltip(
      message: tooltip,
      waitDuration: const Duration(milliseconds: 400),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: DsSpacing.sm + 2,
          vertical: 5,
        ),
        decoration: BoxDecoration(
          color: colors.surfaceOverlay,
          borderRadius: DsRadius.fullAll,
          border: Border.all(
            color: tone.withValues(alpha: 0.35),
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (sync.isSyncing)
              SizedBox(
                width: 13,
                height: 13,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: tone,
                ),
              )
            else
              Icon(icon, size: 15, color: tone),
            const SizedBox(width: 5),
            Text(
              label,
              style: DsType.caption(color: tone),
            ),
            if (sync.hasPending && !sync.isSyncing) ...[
              const SizedBox(width: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: colors.warning.withValues(alpha: 0.15),
                  borderRadius: DsRadius.fullAll,
                ),
                child: Text(
                  '${sync.pendingCount}',
                  style: DsType.caption(
                    color: colors.warning,
                  ).copyWith(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  (IconData, Color, String, String) _resolve(
    DsColors colors,
    bool offline,
    ConnectionStatus? connection,
    SyncStatus sync,
  ) {
    final cls = connection?.connectionClass ?? ConnectionClass.offline;

    // Oflayn — eng muhim holat.
    if (offline || cls == ConnectionClass.offline) {
      if (sync.isSyncing) {
        return (Icons.sync_rounded, colors.info, 'Sinxronlash…',
            "Sinxronlash davom etmoqda (offline navbat)");
      }
      if (sync.phase == SyncPhase.error) {
        return (Icons.cloud_off_rounded, colors.error,
            'Oflayn · xato', 'Tarmoq yo\'q — ma\'lumotlar lokal saqlanadi');
      }
      return (Icons.cloud_off_rounded, colors.textSecondary, 'Oflayn',
          "Tarmoq yo'q — ma'lumotlar lokal saqlanadi (offline-first)");
    }

    // Online: ulanish sinfiga qarab.
    final (clsIcon, clsLabel) = switch (cls) {
      ConnectionClass.wifi => (Icons.wifi_rounded, 'WiFi'),
      ConnectionClass.ethernet => (Icons.lan_rounded, 'Ethernet'),
      ConnectionClass.lan => (Icons.lan_outlined, 'LAN'),
      ConnectionClass.localDevice => (Icons.bluetooth_rounded, 'Local'),
      _ => (Icons.language_rounded, 'Online'),
    };

    if (sync.isSyncing) {
      return (Icons.sync_rounded, colors.info, 'Sinxronlash…',
          'Cloud bilan sinxronlash davom etmoqda');
    }
    if (sync.phase == SyncPhase.error) {
      return (Icons.sync_problem_rounded, colors.warning,
          'Sync xato', sync.lastError ?? 'Sinxronlashda xato');
    }
    if (sync.hasPending) {
      return (Icons.cloud_upload_outlined, colors.info,
          '$clsLabel · ${sync.pendingCount} kutmoqda',
          '${sync.pendingCount} yozuv cloud\'ga yuborilishi kutilmoqda');
    }
    if (sync.isCloudDisabled) {
      return (clsIcon, colors.textSecondary, '$clsLabel · Lokal',
          'Cloud sozlanmagan — ma\'lumotlar lokal saqlanadi');
    }
    return (clsIcon, colors.success, '$clsLabel · Sinxron',
        'Hammasi sinxronlangan — oxirgi: ${_timeLabel(sync.lastSyncAt)}');
  }

  String _timeLabel(DateTime? time) {
    if (time == null) return '—';
    final now = DateTime.now();
    final diff = now.difference(time);
    if (diff.inMinutes < 1) return 'hozir';
    if (diff.inMinutes < 60) return '${diff.inMinutes} daqiqa oldin';
    if (diff.inHours < 24) return '${diff.inHours} soat oldin';
    return '${diff.inDays} kun oldin';
  }
}
