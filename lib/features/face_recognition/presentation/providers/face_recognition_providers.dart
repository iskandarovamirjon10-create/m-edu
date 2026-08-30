import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/core_providers.dart';
import '../../../../features/auth/presentation/providers/auth_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../settings/presentation/providers/settings_providers.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../application/commands/register_face_command.dart';
import '../../application/face_attendance_guard.dart';
import '../../application/face_matcher.dart';
import '../../application/face_scan_controller.dart';
import '../../domain/repositories/face_recognition_repository.dart';
import '../../domain/repositories/recognition_attempt_repository.dart';
import '../../domain/services/liveness_service.dart';
import '../../domain/value_objects/biometric_policy.dart';
import '../../infrastructure/datasources/isar_face_datasource.dart';
import '../../infrastructure/datasources/isar_recognition_attempt_datasource.dart';
import '../../infrastructure/repositories_impl/face_recognition_repository_impl.dart';
import '../../infrastructure/repositories_impl/recognition_attempt_repository_impl.dart';
import '../../infrastructure/services/camera_discovery_service.dart';
import '../../infrastructure/services/camera_source.dart';
import '../../infrastructure/services/camera_source_factory.dart';
import '../../infrastructure/services/camera_stream_service.dart';
import '../../infrastructure/services/face_quality_gate.dart';
import '../../infrastructure/services/face_vision_engine.dart';
import '../../infrastructure/services/hikvision_camera_config.dart';
import '../../infrastructure/services/snapshot_service.dart';
import '../../infrastructure/services/tflite_face_vision_engine.dart';

final faceRecognitionRepositoryProvider =
    Provider<FaceRecognitionRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return FaceRecognitionRepositoryImpl(IsarFaceDataSource(db.instance));
});

final registerFaceCommandProvider = Provider<RegisterFaceCommand>(
  (ref) => RegisterFaceCommand(
    repository: ref.watch(faceRecognitionRepositoryProvider),
    identityRepository: ref.watch(identityRepositoryProvider),
    // D7: dublikat enroll tekshiruvi — policy thresholdlari yagona manbadan.
    matcher: ref.watch(faceMatcherProvider),
    actorRole: ref.watch(actorRoleProvider),
  ),
);

/// Markazlashtirilgan versiyalangan biometrik siyosat (spec §9, §55).
///
/// Barcha thresholdlar yagona [BiometricPolicy] manbaidan keladi.
/// Moslik chegaralari sozlamalardan (kalibrlash natijasi) olinadi,
/// qolganlari policy defaultlari. Qabul qilinmaydigan kombinatsiyalar
/// qurilishda rad etiladi (validatsiya).
final biometricPolicyProvider = Provider<BiometricPolicy>((ref) {
  final settings = ref.watch(appSettingsProvider).valueOrNull;
  final base = const BiometricPolicy();
  final policy = BiometricPolicy.validated(
    base.withMatchThresholds(
      matchThreshold: settings?.matchThreshold ?? base.matchThreshold,
      ambiguousThreshold:
          settings?.ambiguousThreshold ?? base.ambiguousThreshold,
    ),
  );
  return policy;
});

/// Moslik chegaralari [biometricPolicyProvider] dan keladi (yagona manba).
final faceMatcherProvider = Provider<FaceMatcher>((ref) {
  return FaceMatcher.fromPolicy(ref.watch(biometricPolicyProvider));
});

/// Yuz dvigateli: Android/iOS/macOS — ML Kit,
/// Windows/Linux — TFLite FaceMesh (to'liq oflayn).
final faceVisionEngineProvider = Provider<FaceVisionEngine>((ref) {
  final qualityGate = ref.watch(faceQualityGateProvider);
  final policy = ref.watch(biometricPolicyProvider);
  final FaceVisionEngine engine;
  if (kIsWeb) {
    // Web'da yuz tanish qo'llab-quvvatlanmaydi (isSupportedOnPlatform
    // false → UI tushunarli holat ko'rsatadi). `tflite_flutter`/`dart:ffi`
    // import zanjiri web build'ni buzmasligi uchun shim web'da stub
    // dvigatelni yuklaydi — bu yerda ham Platform tekshiruvi qilinmaydi.
    engine = TFLiteFaceVisionEngine(qualityGate: qualityGate);
  } else if (Platform.isAndroid || Platform.isIOS || Platform.isMacOS) {
    engine = MLKitFaceVisionEngine(
      qualityGate: qualityGate,
      maxYawDegrees: policy.maxYawDegrees,
      maxPitchDegrees: policy.maxPitchDegrees,
    );
  } else {
    engine = TFLiteFaceVisionEngine(qualityGate: qualityGate);
  }
  ref.onDispose(engine.dispose);
  return engine;
});

/// GAPS-G5: liveness (anti-spoofing) konfiguratsiyasi — [BiometricPolicy]
/// dan (spec §9: yagona manba).
final faceLivenessConfigProvider = Provider<LivenessConfig>((ref) {
  final policy = ref.watch(biometricPolicyProvider);
  return LivenessConfig(
    requiredBlinks: policy.livenessRequiredBlinks,
    window: policy.livenessWindow,
  );
});

/// Yuz sifat gate'i (spec §4) — o'lcham/yorug'lik/xiralik tekshiruvi,
/// chegaralar [BiometricPolicy] dan (spec §9).
final faceQualityGateProvider = Provider<FaceQualityGate>((ref) {
  final policy = ref.watch(biometricPolicyProvider);
  return FaceQualityGate(
    config: FaceQualityConfig(
      minFaceAreaFraction: policy.minimumFaceAreaFraction,
    ),
  );
});

/// Face davomat oldi tekshiruvi (spec §17-18): shaxs faol + o'quvchi
/// bo'lsa bazada mavjud/faol + dars guruhiga tegishli.
final faceAttendanceGuardProvider = Provider<FaceAttendanceGuard>(
  (ref) => FaceAttendanceGuard(
    studentRepository: ref.watch(studentRepositoryProvider),
  ),
);

/// RTSP kamera oqimi xizmati.
///
/// `autoDispose` — Face ID / enroll sahifasidan chiqilganda media_kit
/// player to'liq yopiladi (RTSP oqim va dekodlash to'xtaydi). Avval oddiy
/// [Provider] edi: oqim sahifa yopilgandan keyin ham fon rejimida
/// dekodlashda davom etardi — CPU/xotira yuki va qotib qolish (freeze)
/// sabablaridan biri edi.
final cameraStreamServiceProvider =
    Provider.autoDispose<CameraStreamService>((ref) {
  CameraStreamService.ensureInitialized();
  final service = CameraStreamService();
  ref.onDispose(() => service.dispose());
  return service;
});

/// Yagona kamera manbasi (multi-camera qo'llab-quvvatlash).
///
/// `autoDispose` — sahifa yopilganda kamera resurslari tozalanadi.
/// Turli kamera turlarini (Hikvision, USB, Android) bitta interfeys
/// orqali boshqaradi.
final cameraSourceProvider =
    Provider.autoDispose<CameraSource>((ref) {
  final hikvisionConfig = ref.watch(hikvisionConfigProvider);
  
  // Create camera source based on platform and configuration
  final source = CameraSourceFactory.createBestAvailable(
    hikvisionConfig: hikvisionConfig,
  );
  
  ref.onDispose(() => source.dispose());
  return source;
});

/// Mavjud kamera turlari ro'yxati.
final availableCameraTypesProvider = Provider<List<CameraSourceType>>((ref) {
  return CameraSourceFactory.getAvailableTypes();
});

/// ISAPI snapshot fallback xizmati.
final snapshotServiceProvider = Provider<SnapshotService>(
  (ref) => SnapshotService(),
);

/// LAN'dagi kamerani avtomatik qidirish xizmati (oddiy foydalanuvchi
/// uchun kamera IP'sini bilmasdan qo'shish imkoniyati).
final cameraDiscoveryServiceProvider = Provider<CameraDiscoveryService>(
  (ref) => CameraDiscoveryService(),
);

/// Sozlamalardan Hikvision kamera konfiguratsiyasi.
final hikvisionConfigProvider = Provider<HikvisionCameraConfig?>((ref) {
  final settings = ref.watch(appSettingsProvider).valueOrNull;
  if (settings == null || !settings.hikvisionEnabled) return null;
  final ip = settings.hikvisionIp?.trim() ?? '';
  if (ip.isEmpty) return null;

  // P0 (FACE-01): `?? 'admin'` faqat null uchun ishlaydi — bo'sh string
  // ('') fallback'ga tushmay qolardi. Sozlamalarda username bo'sh
  // saqlansa (form `trim()` qilib '' yozadi), RTSP URL `rtsp://:@IP/...`
  // bo'lib, hatto to'g'ri kamera ham autentifikatsiya qilolmasdi.
  // Hikvision standarti: bo'sh bo'lsa 'admin'.
  final username = settings.hikvisionUsername?.trim() ?? '';
  return HikvisionCameraConfig(
    ip: ip,
    port: settings.hikvisionPort,
    username: username.isEmpty ? 'admin' : username,
    password: settings.hikvisionPassword ?? '',
    channel: settings.hikvisionChannel,
    rtspPath: settings.hikvisionRtspPath,
  );
});

/// Tanib olish urinishlari kuzatuv ombori (spec §35 — metadata only).
final recognitionAttemptRepositoryProvider =
    Provider<RecognitionAttemptRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return RecognitionAttemptRepositoryImpl(
    IsarRecognitionAttemptDataSource(db.instance),
  );
});

/// Face skan qaror dvigateli — sahifa hayoti davomida yashaydi
/// (autoDispose: sahifa yopilganda controller tozalanadi).
///
/// `attendanceWriter` sahifa tomonidan o'rnatiladi (ref-bog'liq closure),
/// chunki davomat yozish attendance domeniga tegishli (spec §18).
final faceScanControllerProvider =
    Provider.autoDispose<FaceScanController>((ref) {
  final policy = ref.watch(biometricPolicyProvider);
  final matcher = ref.watch(faceMatcherProvider);
  final livenessConfig = ref.watch(faceLivenessConfigProvider);
  final attempts = ref.watch(recognitionAttemptRepositoryProvider);
  final controller = FaceScanController(
    policy: policy,
    matcher: matcher,
    loadGallery: () => ref.read(enrolledFacesProvider.future),
    createLiveness: () => LivenessService(config: livenessConfig),
    onResult: attempts.record,
  );
  ref.onDispose(controller.dispose);
  return controller;
});

/// Yuz bazasi versiyasi (enroll/delete dan so'ng `state++`).
final faceVersionProvider = StateProvider<int>((ref) => 0);

/// Faqat FAOL identity'larga tegishli yuzlar — aktiv matcher galereyasi.
///
/// D6/D8 (biometric audit): arxivlangan/muzlatilgan/bitirilgan shaxslar
/// oddiy davomat tanib olishda QATNASHMAYDI — galereya yuklash chegarasida
/// filtrlangan (UI emas, ma'lumot chegarasi). Identity holati o'zgarsa
/// (`identityListVersionProvider`) galereya ham yangilanadi.
final enrolledFacesProvider = FutureProvider<List<EnrolledFace>>((ref) async {
  ref.watch(faceVersionProvider);
  ref.watch(identityListVersionProvider);
  final identities = await ref.watch(identityListProvider.future);
  final activeIds = identities
      .where((i) => i.status == IdentityStatus.active)
      .map((i) => i.identityId)
      .toSet();
  final faces = await ref.watch(faceRecognitionRepositoryProvider).findAllFaces();
  return faces.where((f) => activeIds.contains(f.identityId)).toList();
});

/// Identity'ning yuzi bormi?
final hasFaceProvider = FutureProvider.family<bool, String>((ref, identityId) {
  ref.watch(faceVersionProvider);
  return ref.watch(faceRecognitionRepositoryProvider).hasFace(identityId);
});
