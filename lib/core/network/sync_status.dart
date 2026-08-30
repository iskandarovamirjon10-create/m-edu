import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'sync_engine.dart';

/// ═══════════════════════════════════════════════════════════════════════
/// M-EDU SYNC STATUS (ULTRA CORE §6-7, §43)
///
/// Foydalanuvchiga ko'rinadigan sinxronlash holati:
///   idle       — hammasi sinxron, navbat bo'sh
///   syncing    — hozir yuborilmoqda
///   synced     — pass muvaffaqiyatli yakunlandi (yozuvlar yuborildi)
///   error      — oxirgi pass'da xato (permanent/conflict/network)
///   disabled   — cloud sozlanmagan (offline-first, sync o'chirilgan)
///
/// UI hech qachon bloklanmaydi (§7): bu faqat holat ko'rsatkichi —
/// sync o'zi [SyncScheduler]/[SyncEngine]'da bajariladi.
/// ═══════════════════════════════════════════════════════════════════════

enum SyncPhase { idle, syncing, synced, error, disabled }

@immutable
class SyncStatus {
  final SyncPhase phase;
  final DateTime? lastSyncAt;

  /// Navbatdagi (pending) yozuvlar soni — UI'da ko'rsatiladi.
  final int pendingCount;

  /// Oxirgi pass natijasi (troubleshooting uchun).
  final SyncRunResult? lastResult;

  /// Oxirgi xato xabari (redact qilingan, foydalanuvchi uchun qisqa).
  final String? lastError;

  const SyncStatus({
    this.phase = SyncPhase.idle,
    this.lastSyncAt,
    this.pendingCount = 0,
    this.lastResult,
    this.lastError,
  });

  bool get isSyncing => phase == SyncPhase.syncing;
  bool get hasPending => pendingCount > 0;
  bool get isCloudDisabled => phase == SyncPhase.disabled;

  SyncStatus copyWith({
    SyncPhase? phase,
    DateTime? lastSyncAt,
    int? pendingCount,
    SyncRunResult? lastResult,
    String? lastError,
  }) =>
      SyncStatus(
        phase: phase ?? this.phase,
        lastSyncAt: lastSyncAt ?? this.lastSyncAt,
        pendingCount: pendingCount ?? this.pendingCount,
        lastResult: lastResult ?? this.lastResult,
        lastError: lastError ?? this.lastError,
      );
}

/// Sync holatini boshqaruvchi — [SyncScheduler] tomonidan yangilanadi.
///
/// `notifier` orqali chaqiriladi (Riverpod StateNotifier). Barcha
/// o'zgarishlar UI'da sokin ko'rsatiladi — hech qanday dialog/blok yo'q.
class SyncStatusController extends StateNotifier<SyncStatus> {
  SyncStatusController() : super(const SyncStatus());

  void setDisabled() => state = const SyncStatus(phase: SyncPhase.disabled);

  void beginSync() {
    state = state.copyWith(phase: SyncPhase.syncing, lastError: null);
  }

  void finishSync(SyncRunResult result) {
    final anyIssue = result.anyIssues;
    state = state.copyWith(
      phase: anyIssue ? SyncPhase.error : SyncPhase.synced,
      lastSyncAt: DateTime.now(),
      lastResult: result,
      lastError: anyIssue ? _describeIssues(result) : null,
    );
  }

  void syncFailed(String message) {
    state = state.copyWith(
      phase: SyncPhase.error,
      lastSyncAt: DateTime.now(),
      lastError: message,
    );
  }

  void updatePending(int count) {
    state = state.copyWith(pendingCount: count);
  }

  String? _describeIssues(SyncRunResult result) {
    final parts = <String>[];
    if (result.failed > 0) parts.add('${result.failed} qayta uriniladi');
    if (result.permanent > 0) parts.add('${result.permanent} doimiy xato');
    if (result.conflicts > 0) parts.add('${result.conflicts} ziddiyat');
    return parts.isEmpty ? null : parts.join(', ');
  }
}

/// Riverpod provider — UI va scheduler umumiy holat manbai.
final syncStatusControllerProvider =
    StateNotifierProvider<SyncStatusController, SyncStatus>(
  (ref) => SyncStatusController(),
);
