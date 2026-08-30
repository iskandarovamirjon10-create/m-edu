import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../../../../firebase_options.dart';
import '../../../services/app_logger.dart';

/// Firebase konfiguratsiyasini yuklash va ishga tushirish.
///
/// SECURE CONFIGURATION MECHANISM (task §4, §34):
/// - Firebase client konfiguratsiyasi source code'da emas — qurilmadagi
///   `m_edu_firebase.json` faylida saqlanadi (gitignore qilingan);
/// - Fayl joylashuvi: `--dart-define=FIREBASE_CONFIG_PATH=/abs/path.json`
///   berilgan bo'lsa o'sha yo'l, aks holda ilova qo'llab-quvvatlash
///   papkasidagi `m_edu_firebase.json`;
/// - Fayl format:
///   ```json
///   {
///     "apiKey": "...",
///     "appId": "...",
///     "messagingSenderId": "...",
///     "projectId": "...",
///     "storageBucket": "..."
///   }
///   ```
/// - Fayl yo'q bo'lsa (yoki noto'g'ri) → Firebase ishga tushmaydi →
///   [isFirebaseConfigured] false → sync engine o'chirilgan, app offline-first
///   ishlashda davom etadi (hech qanday crash, hech qanday mock).
class FirebaseBootstrap {
  static const _configPathOverride =
      String.fromEnvironment('FIREBASE_CONFIG_PATH');

  static bool _initialized = false;
  static bool _configured = false;

  /// Birinchi chaqiriqning natijasini kutuvchi future (idempotent —
  /// parallel chaqiriqlar bitta natijani oladi). ULTRA CORE §22: birinchi
  /// kadrni bloklamaslik uchun `initialize()` post-frame'da unawaited
  /// chaqiriladi; scheduler esa shu future tugashini kutadi.
  static Future<void>? _initFuture;

  /// Firebase ishga tushirilgan va haqiqiy konfiguratsiya mavjudmi?
  static bool get isFirebaseConfigured => _configured;

  /// Ilova ishga tushishida bir marta chaqiriladi. Hech qachon rethrow
  /// qilmaydi — Firebase yo'q bo'lsa app offline ishlaydi.
  ///
  /// Idempotent: ikkinchi chaqiriq birinchi chaqiriq tugashini kutadi
  /// (aynI future qaytariladi) — "tez ikki chaqiriq" race'i yo'q.
  static Future<void> initialize() {
    final pending = _initFuture;
    if (pending != null) return pending;
    final future = _doInitialize();
    _initFuture = future;
    return future;
  }

  static Future<void> _doInitialize() async {
    if (_initialized) return;
    _initialized = true;

    try {
      final options = await _loadOptions();
      if (options == null) {
        AppLogger.info(
            'Firebase: config not found — cloud sync disabled (offline-first)');
        return;
      }
      await Firebase.initializeApp(options: options);
      _configured = true;
      AppLogger.info('Firebase: initialized (project ${options.projectId})');
    } catch (e) {
      // Noto'g'ri konfiguratsiya — app ishlashda davom etadi.
      AppLogger.warning(
          'Firebase: init failed — offline mode. (${e.runtimeType})');
      _configured = false;
    }
  }

  static Future<FirebaseOptions?> _loadOptions() async {
    // F-G02 FIX: Primary path — use DefaultFirebaseOptions from
    // firebase_options.dart (generated from google-services.json).
    // This is the standard FlutterFire approach and eliminates the
    // dependency on a manually placed m_edu_firebase.json file.
    try {
      return DefaultFirebaseOptions.currentPlatform;
    } catch (e) {
      AppLogger.info(
          'Firebase: DefaultFirebaseOptions unavailable (${e.runtimeType})');
    }

    // Fallback: file-based configuration for custom/deployment-specific
    // Firebase projects (preserves offline-first flexibility).
    final path = await _configPath();
    if (path == null) return null;
    final file = File(path);
    if (!await file.exists()) return null;

    try {
      final raw = await file.readAsString();
      final data = jsonDecode(raw) as Map<String, dynamic>;
      final apiKey = data['apiKey'] as String?;
      final appId = data['appId'] as String?;
      final projectId = data['projectId'] as String?;
      if (apiKey == null ||
          apiKey.isEmpty ||
          appId == null ||
          projectId == null) {
        AppLogger.info('Firebase: config incomplete — offline mode');
        return null;
      }
      return FirebaseOptions(
        apiKey: apiKey,
        appId: appId,
        messagingSenderId: data['messagingSenderId'] as String? ?? '',
        projectId: projectId,
        storageBucket: data['storageBucket'] as String?,
        authDomain: data['authDomain'] as String?,
        databaseURL: data['databaseURL'] as String?,
      );
    } catch (e) {
      AppLogger.warning(
          'Firebase: config parse error — offline mode (${e.runtimeType})');
      return null;
    }
  }

  static Future<String?> _configPath() async {
    if (_configPathOverride.isNotEmpty) return _configPathOverride;
    if (kIsWeb) return null; // Web'da fayl o'qish scope'da emas.
    try {
      final dir = await getApplicationSupportDirectory();
      return '${dir.path}/m_edu_firebase.json';
    } catch (_) {
      return null;
    }
  }
}
