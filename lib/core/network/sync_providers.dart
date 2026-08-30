import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../di/core_providers.dart';
import 'connectivity/connectivity_manager.dart';
import 'device_identity.dart';
import 'domain/remote_data_sink.dart';
import 'infrastructure/datasources/sync_conflict_datasource.dart';
import 'infrastructure/datasources/sync_cursor_datasource.dart';
import 'infrastructure/datasources/sync_operation_datasource.dart';
import 'infrastructure/models/sync_operation_record.dart';
import 'infrastructure/mappers/attendance_sync_mapper.dart';
import 'infrastructure/mappers/grade_sync_mapper.dart';
import 'infrastructure/mappers/group_sync_mapper.dart';
import 'infrastructure/mappers/homework_sync_mapper.dart';
import 'infrastructure/mappers/identity_sync_mapper.dart';
import 'infrastructure/mappers/payment_sync_mapper.dart';
import 'infrastructure/mappers/schedule_sync_mapper.dart';
import 'infrastructure/mappers/student_sync_mapper.dart';
import 'infrastructure/remote/firestore_remote_data_sink.dart';
import 'sync_engine.dart';
import 'sync_status.dart';

/// Sync engine'ni qurish — main (scheduler) va provider uchun yagona fabrika.
///
/// ProviderScope'ga bog'liq emas: to'g'ridan-to'g'ri [AppDatabase] bilan
/// ishlaydi. Firebase sozlanmagan bo'lsa sink isConfigured=false → engine
/// hech narsa yubormaydi (offline-first).
Future<SyncEngine> buildSyncEngine(AppDatabase database) async {
  final deviceId = await DeviceIdentity(database.instance).getDeviceId();
  return SyncEngine(
    remote: FirestoreRemoteDataSink(),
    queue: SyncOperationDataSource(database.instance),
    cursorDataSource: SyncCursorDataSource(database.instance),
    conflictDataSource: SyncConflictDataSource(database.instance),
    mappers: [
      IdentitySyncMapper(database.instance),
      StudentSyncMapper(database.instance),
      AttendanceSyncMapper(database.instance),
      PaymentSyncMapper(database.instance),
      GroupSyncMapper(database.instance),
      GradeSyncMapper(database.instance),
      HomeworkSyncMapper(database.instance),
      ScheduleSyncMapper(database.instance),
    ],
    deviceId: deviceId,
  );
}

/// Cloud ma'lumot manbai — Firebase sozlangan bo'lsa Firestore sink,
/// aks holda isConfigured=false (offline-first, sync o'chirilgan).
final remoteDataSinkProvider = Provider<RemoteDataSink>((ref) {
  ref.watch(appDatabaseProvider);
  return FirestoreRemoteDataSink();
});

/// Sync engine — deviceId + queue + mappers bilan.
final syncEngineProvider = FutureProvider<SyncEngine>((ref) async {
  final db = ref.watch(appDatabaseProvider);
  return buildSyncEngine(db);
});

/// Davriy sinxronlashni boshqaradi: app ishga tushganda + har [interval]
/// daqiqada `processOnce` ishga tushadi (queued offline yozuvlar yuboriladi).
///
/// Xatoliklar yutiladi — sync hech qachon appni buzmaydi. Timer faqat
/// bitta pass'ni ishga tushiradi; keyingi pass keyingi intervalda.
///
/// Live status (§43): [status] orqali [SyncStatusController] yangilanadi —
/// UI (top bar) sinxronlash holatini ko'rsatadi, lekin bloklamaydi.
class SyncScheduler {
  final Future<SyncEngine> Function() _engineLoader;
  final SyncStatusController? status;
  final Duration interval;
  Timer? _timer;
  bool _running = false;

  /// Hozir pass bajarilayotganmi? (AUDIT M-EDU-SYNC-002)
  ///
  /// Bitta pass davomiyligi interval'dan uzoq bo'lsa (katta navbat, sekin
  /// tarmoq) `Timer.periodic` qo'shimcha pass ishga tushirishi mumkin edi
  /// — ikkita parallel `processOnce` bir xil operatsiyalarni qayta-qayta
  /// yuborardi (idempotent put tufayli ma'lumot buzilmasa ham, keraksiz
  /// tarmoq yuki + remote'da takroriy yon ta'sirlar). Endi pass davomida
  /// kelgan timer tick'lari o'tkazib yuboriladi — keyingi tick yangi pass
  /// boshlaydi.
  bool _passInProgress = false;

  SyncScheduler(
    this._engineLoader, {
    this.status,
    this.interval = const Duration(minutes: 1),
  });

  void start() {
    if (_running) return;
    _running = true;
    _timer = Timer.periodic(interval, (_) => _runOnce());
    // Ishga tushganda darhol bir marta sinxronlaymiz.
    _runOnce();
  }

  Future<void> _runOnce() async {
    if (_passInProgress) return;
    _passInProgress = true;
    try {
      final engine = await _engineLoader();
      if (!engine.isEnabled) {
        status?.setDisabled();
        return;
      }
      status?.beginSync();
      final result = await engine.processOnce();
      status?.finishSync(result);
      // Navbatdagi yozuvlar soni — UI ko'rsatkichi uchun (pending).
      try {
        final pending = await engine.pendingCount();
        status?.updatePending(pending);
      } catch (_) {
        // Navbatni o'qib bo'lmasa — pending ko'rsatilmaydi (blok emas).
      }
    } catch (e) {
      // Sync xatosi appni buzmaydi (offline-first kafolati).
      status?.syncFailed(e.toString());
    } finally {
      _passInProgress = false;
    }
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _running = false;
  }
}

/// Connectivity holati — [ConnectivityManager] provider'ı.
///
/// Top bar va boshqa UI komponentlar `context`'dan kuzatadi. Plugin
/// ishlamasa (test/web desktop) — offline sifatida xavfsiz.
final connectivityManagerProvider = Provider<ConnectivityManager>((ref) {
  final manager = ConnectivityManager();
  manager.start();
  ref.onDispose(manager.dispose);
  return manager;
});

/// Joriy ulanish holati — stream (o'zgarishlarda yangilanadi).
final connectionStatusProvider = StreamProvider<ConnectionStatus>((ref) {
  final manager = ref.watch(connectivityManagerProvider);
  return manager.status;
});

/// Sync navbati datasource'i — bloklangan operatsiyalarni ko'rish/hal qilish.
final syncOperationDataSourceProvider =
    Provider<SyncOperationDataSource>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return SyncOperationDataSource(db.instance);
});

/// Bloklangan (conflict/permanent) sync operatsiyalar — admin ko'rib
/// chiqishi uchun (GAPS-G4, DECISIONS-D13).
///
/// Conflict'lar hech qachon avtomatik hal qilinmaydi; admin quyidagilardan
/// birini tanlaydi: [SyncOperationDataSource.retryBlocked] (local-wins) yoki
/// [SyncOperationDataSource.discardBlocked] (remote-wins).
final blockedSyncOperationsProvider =
    FutureProvider<List<SyncOperationRecord>>((ref) async {
  final queue = ref.watch(syncOperationDataSourceProvider);
  return queue.blockedOperations();
});
