import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/network/connectivity/connectivity_manager.dart';
import 'package:m_edu/core/network/sync_engine.dart';
import 'package:m_edu/core/network/sync_status.dart';
import 'package:m_edu/core/network/sync_providers.dart';
import 'package:m_edu/shared/design_system/app/app_connection_status.dart';
import 'package:m_edu/features/diagnostics/presentation/pages/admin_diagnostics_page.dart';
import 'package:media_kit/media_kit.dart';

import 'package:m_edu/features/face_recognition/presentation/providers/face_recognition_providers.dart';
import 'package:m_edu/features/face_recognition/infrastructure/services/camera_stream_service.dart';

void main() {
  group('ConnectivityManager (§8-10)', () {
    test('wifi stream → ConnectionClass.wifi, lan ready', () async {
      final controller = StreamController<List<ConnectivityResult>>.broadcast();
      final manager = ConnectivityManager(source: () => controller.stream);
      manager.start();

      final seen = <ConnectionStatus>[];
      manager.status.listen(seen.add);
      controller.add([ConnectivityResult.wifi]);
      await Future<void>.delayed(Duration.zero);

      expect(manager.current.connectionClass, ConnectionClass.wifi);
      expect(manager.current.isLanReady, isTrue);
      expect(manager.current.isOnline, isTrue);
      expect(seen, isNotEmpty);
      manager.dispose();
      await controller.close();
    });

    test('none → offline, lan not ready', () async {
      final controller = StreamController<List<ConnectivityResult>>.broadcast();
      final manager = ConnectivityManager(source: () => controller.stream);
      manager.start();

      controller.add([ConnectivityResult.none]);
      await Future<void>.delayed(Duration.zero);

      expect(manager.current.connectionClass, ConnectionClass.offline);
      expect(manager.current.isOnline, isFalse);
      expect(manager.current.isLanReady, isFalse);
      manager.dispose();
      await controller.close();
    });

    test('ethernet mapped correctly and beats wifi in priority list', () async {
      final controller = StreamController<List<ConnectivityResult>>.broadcast();
      final manager = ConnectivityManager(source: () => controller.stream);
      manager.start();

      controller.add([ConnectivityResult.wifi, ConnectivityResult.ethernet]);
      await Future<void>.delayed(Duration.zero);

      expect(manager.current.connectionClass, ConnectionClass.ethernet);
      manager.dispose();
      await controller.close();
    });

    test('plugin error → safe offline fallback, no crash', () async {
      final controller = StreamController<List<ConnectivityResult>>.broadcast();
      final manager = ConnectivityManager(source: () => controller.stream);
      manager.start();
      controller.addError(Exception('plugin broke'));
      await Future<void>.delayed(Duration.zero);
      expect(manager.current.connectionClass, ConnectionClass.offline);
      manager.dispose();
      await controller.close();
    });

    test('no duplicate emission when class unchanged', () async {
      final controller = StreamController<List<ConnectivityResult>>.broadcast();
      final manager = ConnectivityManager(source: () => controller.stream);
      var count = 0;
      manager.status.listen((_) => count++);
      manager.start();

      controller.add([ConnectivityResult.wifi]);
      controller.add([ConnectivityResult.wifi]);
      controller.add([ConnectivityResult.wifi]);
      await Future<void>.delayed(Duration.zero);

      expect(count, 1, reason: 'same class must not re-emit (rebuild storm)');
      manager.dispose();
      await controller.close();
    });
  });

  group('SyncStatusController (§6-7, §43)', () {
    test('initial state is idle with no pending', () {
      final controller = SyncStatusController();
      expect(controller.state.phase, SyncPhase.idle);
      expect(controller.state.pendingCount, 0);
      expect(controller.state.isCloudDisabled, isFalse);
    });

    test('beginSync → syncing, finishSync → synced with timestamp', () {
      final controller = SyncStatusController();
      controller.beginSync();
      expect(controller.state.isSyncing, isTrue);

      controller.finishSync(const SyncRunResult(
        attempted: 2,
        synced: 2,
        failed: 0,
        permanent: 0,
        conflicts: 0,
      ));
      expect(controller.state.phase, SyncPhase.synced);
      expect(controller.state.lastSyncAt, isNotNull);
      expect(controller.state.lastError, isNull);
    });

    test('finishSync with failures → error phase with described issues', () {
      final controller = SyncStatusController();
      controller.beginSync();
      controller.finishSync(const SyncRunResult(
        attempted: 3,
        synced: 0,
        failed: 3,
        permanent: 0,
        conflicts: 0,
      ));
      expect(controller.state.phase, SyncPhase.error);
      expect(controller.state.lastError, contains('qayta uriniladi'));
    });

    test('pending count tracked without blocking UI', () {
      final controller = SyncStatusController();
      controller.updatePending(7);
      expect(controller.state.pendingCount, 7);
      expect(controller.state.hasPending, isTrue);
    });

    test('setDisabled → disabled phase (cloud not configured)', () {
      final controller = SyncStatusController();
      controller.setDisabled();
      expect(controller.state.isCloudDisabled, isTrue);
    });
  });

  group('AppConnectionStatus widget (§43)', () {
    testWidgets('renders offline status chip when offline', (tester) async {
      final controller = StreamController<List<ConnectivityResult>>.broadcast();
      final manager = ConnectivityManager(source: () => controller.stream);
      manager.start();

      final syncStatus = SyncStatusController();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            connectivityManagerProvider.overrideWithValue(manager),
            syncStatusControllerProvider.overrideWith((_) => syncStatus),
          ],
          child: const MaterialApp(
            home: Scaffold(body: AppConnectionStatus()),
          ),
        ),
      );
      await tester.pump();

      controller.add([ConnectivityResult.none]);
      await tester.pump();

      expect(find.text('Oflayn'), findsOneWidget);
      manager.dispose();
      await controller.close();
    });

    testWidgets('renders syncing indicator from status controller',
        (tester) async {
      final controller = StreamController<List<ConnectivityResult>>.broadcast();
      final manager = ConnectivityManager(source: () => controller.stream);
      manager.start();
      final syncStatus = SyncStatusController();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            connectivityManagerProvider.overrideWithValue(manager),
            syncStatusControllerProvider.overrideWith((_) => syncStatus),
          ],
          child: const MaterialApp(
            home: Scaffold(body: AppConnectionStatus()),
          ),
        ),
      );
      await tester.pump();

      syncStatus.beginSync();
      await tester.pump();

      expect(find.textContaining('Sinxronlash'), findsOneWidget);
      manager.dispose();
      await controller.close();
    });
  });

  group('AdminDiagnosticsPage (§45)', () {
    testWidgets('shows connectivity, sync, camera and face engine rows',
        (tester) async {
      final controller = StreamController<List<ConnectivityResult>>.broadcast();
      final manager = ConnectivityManager(source: () => controller.stream);
      manager.start();
      final syncStatus = SyncStatusController();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            connectivityManagerProvider.overrideWithValue(manager),
            syncStatusControllerProvider.overrideWith((_) => syncStatus),
            cameraStreamServiceProvider.overrideWith((ref) => _FakeCameraStreamService()),
          ],
          child: const MaterialApp(
            home: AdminDiagnosticsPage(),
          ),
        ),
      );
      await tester.pump();

      expect(find.text('Diagnostika'), findsOneWidget);
      expect(find.text('Ulanish'), findsOneWidget);
      expect(find.text('Sync holati'), findsOneWidget);
      // Sahifaga "Sync ziddiyatlari" bo'limi qo'shilgach pastki qatorlar
      // viewport'dan chiqib qoladi — scroll orqali tekshiriladi.
      await tester.scrollUntilVisible(find.text('Kamera (RTSP)'), 200);
      expect(find.text('Kamera (RTSP)'), findsOneWidget);
      expect(find.text('Yuz dvigateli'), findsOneWidget);
      await tester.scrollUntilVisible(find.text("Isar bazasi"), 200);
      expect(find.text("Isar bazasi"), findsOneWidget);
      manager.dispose();
      await controller.close();
    });
  });
}

/// Fake camera stream service for diagnostics page test.
/// Does not touch media_kit (native library unavailable in test env).
/// Overrides the `player` getter to return a fake that doesn't
/// require MediaKit.ensureInitialized().
class _FakeCameraStreamService implements CameraStreamService {
  _FakeCameraStreamService();

  @override
  Player get player => const _FakePlayer();

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

/// Minimal Player stand-in that satisfies the diagnostics page's
/// `player.state.playing` access without requiring native init.
class _FakePlayer implements Player {
  const _FakePlayer();

  @override
  PlayerState get state => const PlayerState();

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}
