import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../core/network/connectivity/connectivity_manager.dart';
import '../../../../core/network/infrastructure/datasources/sync_operation_datasource.dart';
import '../../../../core/network/infrastructure/models/sync_operation_record.dart';
import '../../../../core/network/sync_providers.dart';
import '../../../../core/network/sync_status.dart';
import '../../../../design/design.dart';
import '../../../face_recognition/infrastructure/services/face_vision_engine.dart';
import '../../../face_recognition/presentation/providers/face_recognition_providers.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// ADMIN DIAGNOSTICS (ULTRA CORE §45)
///
/// Muammolarni bartaraf qilish (troubleshooting) uchun ichki holat:
///   • FPS (jonli)              — UI silliqligi
///   • Tarmoq                   — ulanish sinfi (wifi/lan/ethernet/offline)
///   • Sync                     — fazasi, pending, oxirgi xato
///   • Baza                     — Isar ochiqligi + holat
///   • Kamera                   — RTSP player ochiqligi
///   • Yuz dvigateli            — platformada qo'llab-quvvatlanishi
///
/// Bu sahifa oddiy foydalanish uchun emas — faqat tashxis uchun.
/// Hech qanday maxfiy ma'lumot (parol/token/biometrik) ko'rsatilmaydi (§46).
/// ═══════════════════════════════════════════════════════════════════════

class AdminDiagnosticsPage extends ConsumerStatefulWidget {
  const AdminDiagnosticsPage({super.key});

  @override
  ConsumerState<AdminDiagnosticsPage> createState() =>
      _AdminDiagnosticsPageState();
}

class _AdminDiagnosticsPageState extends ConsumerState<AdminDiagnosticsPage> {
  @override
  Widget build(BuildContext context) {
    final connectionAsync = ref.watch(connectionStatusProvider);
    final syncStatus = ref.watch(syncStatusControllerProvider);
    final cameraService = ref.watch(cameraStreamServiceProvider);
    final faceSupported = FaceVisionEngine.isSupportedOnPlatform;

    // Baza provider faqat main()'da override qilinadi (test/ba'zi izolyatsiya
    // holatlarida yo'q). Sahifa qulash o'rniga "mavjud emas" ko'rsatadi.
    final dbOpen = _tryDatabaseOpen(ref);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Diagnostika'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // FPS hisoblagich — ko'rinmas, faqat kadrlar sonini kuzatadi.
          const _FpsMeter(),
          const _DiagnosticsSectionTitle('Ishlash (Performance)'),
          const SizedBox(height: 8),
          _MetricCard(
            icon: Icons.speed,
            title: 'UI FPS',
            value: '${_FpsMeter.lastFps.toStringAsFixed(0)} FPS',
            subtitle: "Jonli o'lchov — build tezligi (raster emas)",
          ),
          const SizedBox(height: 20),
          const _DiagnosticsSectionTitle('Tarmoq (Connectivity)'),
          const SizedBox(height: 8),
          _MetricCard(
            icon: _connectionIcon(connectionAsync.valueOrNull),
            title: 'Ulanish',
            value: _connectionLabel(connectionAsync.valueOrNull),
            subtitle: _connectionDetail(connectionAsync.valueOrNull),
          ),
          const SizedBox(height: 8),
          _MetricCard(
            icon: Icons.cloud_sync_outlined,
            title: 'Sync holati',
            value: _syncPhaseLabel(syncStatus.phase),
            subtitle: _syncDetail(syncStatus),
          ),
          const SizedBox(height: 16),
          const _DiagnosticsSectionTitle('Sync ziddiyatlari (bloklangan)'),
          const SizedBox(height: 8),
          _syncConflictsSection(),
          const SizedBox(height: 20),
          const _DiagnosticsSectionTitle('Qurilmalar (Devices)'),
          const SizedBox(height: 8),
          _MetricCard(
            icon: Icons.videocam_outlined,
            title: 'Kamera (RTSP)',
            value: _cameraStatusLabel(cameraService),
            subtitle: 'Hikvision oqim xizmati holati',
          ),
          const SizedBox(height: 8),
          _MetricCard(
            icon: Icons.face_retouching_natural,
            title: 'Yuz dvigateli',
            value: faceSupported ? 'Tayyor' : "Qo'llab-quvvatlanmaydi",
            subtitle: faceSupported
                ? 'ML Kit / TFLite — bu platformada ishlaydi'
                : "Bu platformada yuz tanish yo'q (faqat jonli tasvir)",
          ),
          const SizedBox(height: 20),
          const _DiagnosticsSectionTitle('Baza (Database)'),
          const SizedBox(height: 8),
          _MetricCard(
            icon: Icons.storage_outlined,
            title: 'Isar bazasi',
            value:
                dbOpen == null ? 'Mavjud emas' : (dbOpen ? 'Ochiq' : 'Yopiq'),
            subtitle: "Offline-first lokal ma'lumotlar ombori",
          ),
          const SizedBox(height: 24),
          Text(
            "Diagnostika faqat muammolarni aniqlash uchun — bu yerda hech "
            "qanday maxfiy ma'lumot (parol, token, biometrik) ko'rsatilmaydi.",
            style: TextStyle(fontSize: 12, color: context.dsColors.textTertiary),
          ),
        ],
      ),
    );
  }

  /// [appDatabaseProvider] xavfsiz o'qish — provider yo'q bo'lsa null.
  bool? _tryDatabaseOpen(WidgetRef ref) {
    try {
      final db = ref.read(appDatabaseProvider);
      return db.instance.isOpen;
    } catch (_) {
      return null;
    }
  }

  /// [syncOperationDataSourceProvider] xavfsiz o'qish — provider yo'q
  /// bo'lsa (test/izolyatsiya) null — sahifa qulash o'rniga "mavjud emas".
  SyncOperationDataSource? _trySyncQueue() {
    try {
      return ref.read(syncOperationDataSourceProvider);
    } catch (_) {
      return null;
    }
  }

  static IconData _connectionIcon(ConnectionStatus? status) {
    final cls = status?.connectionClass;
    return switch (cls) {
      ConnectionClass.wifi => Icons.wifi,
      ConnectionClass.ethernet => Icons.lan_outlined,
      ConnectionClass.internet => Icons.public,
      ConnectionClass.lan => Icons.hub_outlined,
      ConnectionClass.localDevice => Icons.bluetooth,
      _ => Icons.wifi_off,
    };
  }

  static String _connectionLabel(ConnectionStatus? status) {
    final cls = status?.connectionClass;
    return switch (cls) {
      ConnectionClass.wifi => 'WiFi',
      ConnectionClass.ethernet => 'Ethernet',
      ConnectionClass.internet => 'Internet',
      ConnectionClass.lan => 'LAN',
      ConnectionClass.localDevice => 'Mahalliy qurilma',
      _ => 'Oflayn',
    };
  }

  static String _connectionDetail(ConnectionStatus? status) {
    if (status == null) return 'Aniqlanmoqda…';
    final ready = status.isLanReady ? ' • LAN tayyor' : '';
    return '${status.detail}$ready — ${_fmtTime(status.changedAt)}';
  }

  static String _syncPhaseLabel(SyncPhase phase) {
    return switch (phase) {
      SyncPhase.idle => 'Bo\'sh',
      SyncPhase.syncing => 'Sinxronlanmoqda…',
      SyncPhase.synced => 'Sinxron',
      SyncPhase.error => 'Xato',
      SyncPhase.disabled => "O'chirilgan (cloud yo'q)",
    };
  }

  static String _syncDetail(SyncStatus status) {
    final parts = <String>[];
    if (status.pendingCount > 0) parts.add('${status.pendingCount} navbatda');
    if (status.lastSyncAt != null) {
      parts.add('Oxirgi: ${_fmtTime(status.lastSyncAt!)}');
    }
    if (status.lastError != null && status.lastError!.isNotEmpty) {
      parts.add('Xato: ${status.lastError}');
    }
    return parts.isEmpty ? "Navbat bo'sh — hammasi sinxron" : parts.join(' • ');
  }

  static String _cameraStatusLabel(dynamic service) {
    final player = service?.player;
    final playing = player != null && player.state.playing;
    return playing ? 'Ishlayapti' : "To'xtatilgan";
  }

  /// Bloklangan (conflict/permanent) sync operatsiyalar — GAPS-G4.
  ///
  /// Conflict'lar avtomatik hal qilinmaydi (DECISIONS-D13): admin aniq qaror
  /// qiladi — [SyncOperationDataSource.retryBlocked] (local-wins) yoki
  /// [SyncOperationDataSource.discardBlocked] (remote-wins).
  Widget _syncConflictsSection() {
    // Baza provider'ı faqat main()'da override qilinadi (test/ba'zi
    // izolyatsiya holatlarida yo'q) — sahifa qulash o'rniga "mavjud emas"
    // ko'rsatiladi (xuddi _tryDatabaseOpen dagi qoida).
    final queue = _trySyncQueue();
    if (queue == null) {
      return const _MetricCard(
        icon: Icons.cloud_off_outlined,
        title: 'Sync navbati',
        value: "Mavjud emas",
        subtitle:
            "Baza provider'ı yo'q — bloklangan operatsiyalar ko'rsatilmaydi",
      );
    }
    final blocked = ref.watch(blockedSyncOperationsProvider);

    return blocked.when(
      loading: () => const _MetricCard(
        icon: Icons.hourglass_empty,
        title: 'Sync navbati',
        value: 'Tekshirilmoqda…',
        subtitle: 'Bloklangan operatsiyalar o\'qilmoqda',
      ),
      error: (e, _) => _MetricCard(
        icon: Icons.error_outline,
        title: 'Sync navbati',
        value: "O'qib bo'lmadi",
        subtitle: e.toString(),
      ),
      data: (ops) {
        if (ops.isEmpty) {
          return const _MetricCard(
            icon: Icons.check_circle_outline,
            title: 'Sync ziddiyatlari',
            value: "Yo'q",
            subtitle: "Bloklangan operatsiya yo'q — navbat toza",
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => ref.invalidate(blockedSyncOperationsProvider),
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Yangilash'),
              ),
            ),
            for (final op in ops)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _BlockedOpCard(
                  op: op,
                  onRetry: () => _resolveConflict(
                    queue,
                    op.operationId,
                    discard: false,
                  ),
                  onDiscard: () => _resolveConflict(
                    queue,
                    op.operationId,
                    discard: true,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  /// Admin qarori: retry (local-wins) yoki discard (remote-wins).
  Future<void> _resolveConflict(
    SyncOperationDataSource queue,
    String operationId, {
    required bool discard,
  }) async {
    if (discard) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Lokal yozuvni o\'chirish'),
          content: const Text(
            "Bu operatsiya navbatdan o'chiriladi va remote holat haqiqat "
            'sifatida qabul qilinadi. Qaytarib bo\'lmaydi. Davom etasizmi?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Bekor qilish'),
            ),
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('O\'chirish'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    if (discard) {
      await queue.discardBlocked(operationId);
    } else {
      await queue.retryBlocked(operationId);
    }
    ref.invalidate(blockedSyncOperationsProvider);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            discard
                ? "Operatsiya o'chirildi (remote holat qabul qilindi)"
                : "Operatsiya qayta navbatga qo'yildi",
          ),
        ),
      );
    }
  }

  static String _fmtTime(DateTime t) {
    final h = t.hour.toString().padLeft(2, '0');
    final m = t.minute.toString().padLeft(2, '0');
    final s = t.second.toString().padLeft(2, '0');
    return '$h:$m:$s';
  }
}

/// Sokin FPS o'lchagich — sahifa ko'rinib turgan paytda frame'larni sanaydi
/// va soniyada bir marta [lastFps]'ni yangilaydi. Profiling vositasi emas —
/// taxminiy build tezligi ko'rsatkichi (§49: aniq "zero jank" da'vo qilinmaydi).
class _FpsMeter extends StatefulWidget {
  const _FpsMeter();

  static double lastFps = 0;

  @override
  State<_FpsMeter> createState() => _FpsMeterState();
}

class _FpsMeterState extends State<_FpsMeter>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  int _frames = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((elapsed) {
      _frames++;
    })
      ..start();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _FpsMeter.lastFps = _frames.toDouble();
          _frames = 0;
        });
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

class _DiagnosticsSectionTitle extends StatelessWidget {
  final String title;
  const _DiagnosticsSectionTitle(this.title);

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: context.dsColors.accent,
      ),
    );
  }
}

/// Bloklangan sync operatsiya kartasi — GAPS-G4 admin qarorlari.
class _BlockedOpCard extends StatelessWidget {
  final SyncOperationRecord op;
  final VoidCallback onRetry;
  final VoidCallback onDiscard;

  const _BlockedOpCard({
    required this.op,
    required this.onRetry,
    required this.onDiscard,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.dsColors;
    final isConflict = op.syncStatus == 'conflict';
    final tone = isConflict ? colors.warning : colors.error;
    final h = op.updatedAt.hour.toString().padLeft(2, '0');
    final m = op.updatedAt.minute.toString().padLeft(2, '0');
    final s = op.updatedAt.second.toString().padLeft(2, '0');

    final versionNote = op.remoteVersion != null
        ? 'v${op.version} → remote v${op.remoteVersion}'
        : 'v${op.version}';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: tone.withValues(alpha: 0.4),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: tone.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  isConflict ? Icons.sync_problem : Icons.error_outline,
                  size: 18,
                  color: tone,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      op.entityType,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: context.dsColors.textPrimary,
                      ),
                    ),
                    Text(
                      '${op.operationType} • $versionNote • '
                      '$h:$m:$s',
                      style: TextStyle(
                        fontSize: 11.5,
                        color: context.dsColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            op.lastError ?? op.operationId,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              color: context.dsColors.textTertiary,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: onRetry,
                child: const Text('Qayta yuborish'),
              ),
              TextButton(
                onPressed: onDiscard,
                child: Text(
                  'O\'chirish',
                  style: TextStyle(color: colors.error),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  final String subtitle;

  const _MetricCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: context.dsColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.dsColors.border.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: context.dsColors.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 20, color: context.dsColors.accent),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: context.dsColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: context.dsColors.textPrimary,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 11.5,
                    color: context.dsColors.textTertiary,
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
