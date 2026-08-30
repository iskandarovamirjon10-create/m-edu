import 'dart:io' show Socket, NetworkInterface;
import 'dart:typed_data';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:isar/isar.dart';

import '../../../../features/attendance/infrastructure/models/attendance_session_record.dart';
import '../../../../features/settings/infrastructure/datasources/isar_settings_datasource.dart';
import '../../../../features/settings/infrastructure/services/secure_settings_store.dart';
import '../../application/face_matcher.dart';
import '../../infrastructure/datasources/isar_face_datasource.dart';
import '../../infrastructure/repositories_impl/face_recognition_repository_impl.dart';
import '../../infrastructure/services/camera_source.dart';
import '../../infrastructure/services/camera_stream_service.dart';
import '../../infrastructure/services/face_vision_engine.dart';
import '../../infrastructure/services/hikvision_camera_config.dart';
import '../../infrastructure/services/snapshot_service.dart';
import '../models/face_record.dart';
import 'face_debug_snapshot.dart';

/// Face ID pipeline diagnostikasi (P0 debug, spec §19 `face:diagnose`).
///
/// DEVELOPMENT/DIAGNOSTIC ONLY — production UX'ga kiritilmaydi, real
/// kadr/embedding/parol log qilinmaydi. Har qatlam PASS/FAIL/NOT_REACHED
/// hisobotini qaytaradi.
///
/// `main()` da `--dart-define=FACE_DIAGNOSE=true` bilan ishga tushganda
/// chaqiriladi (qarang: main.dart).
class FaceDiagnosticsService {
  final Isar isar;

  FaceDiagnosticsService(this.isar);

  Future<List<FaceDebugSnapshot>> run() async {
    final results = <FaceDebugSnapshot>[];

    // ── 1) CONFIG ──────────────────────────────────────────────────────
    final settings = await IsarSettingsDataSource(isar).getSettings();
    final password = await SecureSettingsStore().readHikvisionPassword();

    final rawUsername = settings.hikvisionUsername?.trim() ?? '';
    final config = HikvisionCameraConfig(
      ip: settings.hikvisionIp?.trim() ?? '',
      port: settings.hikvisionPort,
      // FACE-01 fix bilan bir xil logika: bo'sh username → 'admin'.
      username: rawUsername.isEmpty ? 'admin' : rawUsername,
      password: password ?? '',
      channel: settings.hikvisionChannel,
      rtspPath: settings.hikvisionRtspPath,
    );

    // Bo'sh parol — yaroqli konfiguratsiya (kamera auth'isiz bo'lishi
    // mumkin), shuning uchun FAIL emas — faqat ma'lumot sifatida
    // ko'rsatiladi (asl root cause: noto'g'ri IP, parol emas).
    final configIssues = <String>[
      if (!settings.hikvisionEnabled) 'hikvisionEnabled=false',
      if ((settings.hikvisionIp ?? '').trim().isEmpty) 'ip=empty',
      if (!config.isValid) 'config.invalid',
    ];
    final passDetail = StringBuffer()
      ..write('IP=${config.ip}:${config.port}, user=${config.username}, '
          'channel=${config.channel}, path=${config.effectivePath}');
    if (config.password.isEmpty) passDetail.write(', parol: (bo\'sh)');
    results.add(FaceDebugSnapshot(
      layer: 'CONFIG',
      status: configIssues.isEmpty ? 'PASS' : 'FAIL',
      detail: configIssues.isEmpty
          ? passDetail.toString()
          : '${configIssues.join(', ')} (IP=${config.ip})',
    ));

    // ── 2) NETWORK (TCP) ───────────────────────────────────────────────
    if (config.ip.isEmpty) {
      results.add(const FaceDebugSnapshot(
        layer: 'NETWORK',
        status: 'NOT_REACHED',
        detail: 'IP sozlanmagan — TCP test o\'tkazilmadi',
      ));
    } else {
      final reachable = await _tcpReachable(config.ip, config.port);
      final selfIp = await _isOwnDeviceIp(config.ip);
      results.add(FaceDebugSnapshot(
        layer: 'NETWORK',
        status: reachable ? 'PASS' : 'FAIL',
        detail: reachable
            ? 'TCP ${config.ip}:${config.port} ochiq'
            : 'TCP ${config.ip}:${config.port} yopiq/aniqlanmadi'
                '${selfIp ? ' — ⚠ bu IP qurilmaning O\'Z IP-si (kamera emas!)' : ''}',
      ));
      if (selfIp) {
        results.add(const FaceDebugSnapshot(
          layer: 'SELF_IP',
          status: 'FAIL',
          detail:
              'Kamera IP qurilmaning o\'z Wi-Fi IP-si bilan bir xil — '
              'kamera bu manzilda emas. Haqiqiy kamera IP\'sini kiriting.',
        ));
      }
    }

    // ── 3) RTSP + KADR ─────────────────────────────────────────────────
    final stream = CameraStreamService();
    var frame = 0;
    Uint8List? probeFrame;
    String streamDetail;
    try {
      await stream.open(config.rtspUrl);
      for (var i = 0; i < 5; i++) {
        final f = await stream.grabFrame();
        if (f != null) {
          frame++;
          probeFrame ??= f;
        }
      }
      streamDetail = frame > 0
          ? '5 ta urinishdan $frame tasida kadr olindi'
          : 'Oqim ochildi, lekin kadr olinmadi (screenshot null)';
    } catch (e) {
      streamDetail = 'RTSP ochilmadi: ${e.runtimeType}';
    } finally {
      // Diagnostika player'ini yopamiz — media_kit resurs oqib ketmasin.
      await stream.dispose();
    }
    results.add(FaceDebugSnapshot(
      layer: 'RTSP',
      status: frame > 0 ? 'PASS' : 'FAIL',
      detail: streamDetail,
    ));

    // ── 4) ISAPI snapshot fallback ─────────────────────────────────────
    Uint8List? snapshot;
    String snapshotDetail = 'snapshot olinmadi';
    try {
      snapshot = await SnapshotService().fetchSnapshot(config);
      snapshotDetail =
          snapshot != null ? 'ISAPI JPEG olindi (${snapshot.length} bayt)' : 'ISAPI null qaytardi';
    } catch (e) {
      snapshotDetail = 'ISAPI xato: ${e.runtimeType}';
    }
    results.add(FaceDebugSnapshot(
      layer: 'ISAPI',
      status: snapshot != null ? 'PASS' : 'FAIL',
      detail: snapshotDetail,
    ));

    // ── 5) DETECTOR ────────────────────────────────────────────────────
    if (!FaceVisionEngine.isSupportedOnPlatform) {
      results.add(const FaceDebugSnapshot(
        layer: 'DETECTOR',
        status: 'NOT_REACHED',
        detail: 'Bu platformada yuz dvigateli qo\'llab-quvvatlanmaydi',
      ));
    } else {
      final engine = MLKitFaceVisionEngine();
      var analyzed = 0;
      var faces = 0;
      var embeddingDim = 0;
      final frameToTest = probeFrame ?? snapshot;
      if (frameToTest != null) {
        final (w, h) = CameraFrame.readDimensions(frameToTest);
        final cameraFrame = CameraFrame(
          jpegBytes: frameToTest,
          width: w,
          height: h,
          sourceId: 'diagnostics',
        );
        final outcome = await engine.analyze(cameraFrame);
        analyzed = 1;
        if (outcome is FaceDetectedOutcome) {
          faces = 1;
          embeddingDim = outcome.observation.signature.vector.length;
        }
      }
      engine.dispose();
      results.add(FaceDebugSnapshot(
        layer: 'DETECTOR',
        status: frameToTest == null
            ? 'NOT_REACHED'
            : faces > 0
                ? 'PASS'
                : 'FAIL',
        detail: frameToTest == null
            ? 'Kadr yo\'q — detektor ishga tushirilmadi (kamera avval ishlashi kerak)'
            : analyzed == 1 && faces == 0
                ? 'Kadr tahlil qilindi, yuz topilmadi (0 face)'
                : 'Yuz aniqlandi, imzo dim=$embeddingDim',
      ));
      if (embeddingDim > 0) {
        results.add(FaceDebugSnapshot(
          layer: 'EMBEDDING',
          status: 'PASS',
          detail: 'Imzo o\'lchami: $embeddingDim',
        ));
      }
    }

    // ── 6) STORAGE / TEMPLATES / DECRYPT ───────────────────────────────
    final records = await isar.faceRecords.where().findAll();
    final repo = FaceRecognitionRepositoryImpl(IsarFaceDataSource(isar));
    var decryptable = 0;
    var dim = 0;
    for (final r in records) {
      final e = await repo.findFaceByIdentityId(r.identityId);
      if (e != null) {
        decryptable++;
        dim = e.signature.vector.length;
      }
    }
    results.add(FaceDebugSnapshot(
      layer: 'STORAGE',
      status: 'PASS',
      detail: 'faceRecords=${records.length}, decrypt-muvaffaqiyatli=$decryptable',
    ));
    results.add(FaceDebugSnapshot(
      layer: 'TEMPLATES',
      status: decryptable > 0 ? 'PASS' : 'FAIL',
      detail: decryptable > 0
          ? '$decryptable ta yuz namunasi (dim=$dim)'
          : '0 ta yuz namunasi — recognition doim "unknown" qaytaradi. '
              'AVVAL enroll qilish kerak (Kamera → yuzni ro\'yxatga olish).',
    ));

    // ── 7) MATCHING (o'z-o'zini tekshirish) ────────────────────────────
    if (decryptable > 0) {
      final enrolled = await repo.findAllFaces();
      final probe = enrolled.first;
      final matcher = FaceMatcher(
        matchThreshold: settings.matchThreshold,
        ambiguousThreshold: settings.ambiguousThreshold,
      );
      final match = matcher.findBestMatch(probe.signature, enrolled);
      results.add(FaceDebugSnapshot(
        layer: 'MATCHING',
        status: match != null && !match.ambiguous ? 'PASS' : 'FAIL',
        detail: match == null
            ? 'O\'z-o\'ziga moslik ham topilmadi — matcher buzilgan'
            : 'Self-match: ${match.confidence.toStringAsFixed(3)} '
                '(threshold=${settings.matchThreshold}), '
                'ambiguous=${match.ambiguous}',
      ));
    } else {
      results.add(const FaceDebugSnapshot(
        layer: 'MATCHING',
        status: 'NOT_REACHED',
        detail: 'Namuna yo\'q — matcher sinovi o\'tkazilmadi',
      ));
    }

    // ── 8) LESSON / ATTENDANCE ─────────────────────────────────────────
    final activeSessions = await isar.attendanceSessionRecords
        .filter()
        .statusEqualTo('active')
        .findAll();
    results.add(FaceDebugSnapshot(
      layer: 'LESSON',
      status: activeSessions.isNotEmpty ? 'PASS' : 'FAIL',
      detail: activeSessions.isNotEmpty
          ? '${activeSessions.length} ta faol dars sessiyasi'
          : 'Faol dars yo\'q — davomat belgilanmaydi (P1 qoidasi)',
    ));
    results.add(FaceDebugSnapshot(
      layer: 'ATTENDANCE',
      status: settings.autoMarkAttendance ? 'PASS' : 'FAIL',
      detail: 'autoMarkAttendance=${settings.autoMarkAttendance}',
    ));

    return results;
  }

  /// TCP ulanish testi — RTSP port ochiqligini real tekshiradi.
  Future<bool> _tcpReachable(String ip, int port) async {
    try {
      final socket = await Socket.connect(ip, port,
          timeout: const Duration(seconds: 4));
      socket.destroy();
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Berilgan IP qurilmaning o'z interfeyslaridan biri ekanligini
  /// tekshiradi — kamera o'rniga telefonning o'zi ko'rsatilgan bo'lsa
  /// (eng keng tarqalgan xato) aniq ko'rsatadi.
  Future<bool> _isOwnDeviceIp(String ip) async {
    if (kIsWeb) return false;
    try {
      final interfaces = await NetworkInterface.list();
      for (final iface in interfaces) {
        for (final addr in iface.addresses) {
          if (addr.address == ip) return true;
        }
      }
    } catch (_) {
      // interface list xato bersa — self-check o'tkazib yuboriladi
      // (diagnostikada emas, xato emas).
    }
    return false;
  }
}
