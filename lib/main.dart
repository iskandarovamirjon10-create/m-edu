import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'l10n/app_localizations.dart';
import 'package:permission_handler/permission_handler.dart';

import 'app/pin_lock_lifecycle.dart';
import 'features/auth/presentation/pages/pin_lock_page.dart';

import 'core/constants/app_constants.dart';
import 'core/database/app_database.dart';
import 'core/error/global_error_handler.dart';
import 'core/services/app_logger.dart';
import 'core/theme/app_density.dart';

import 'core/network/infrastructure/models/device_info_record.dart';
import 'core/network/infrastructure/models/sync_conflict_record.dart';
import 'core/network/infrastructure/models/sync_cursor_record.dart';
import 'core/network/infrastructure/models/sync_operation_record.dart';

import 'core/extensions/l10n_context.dart';
import 'core/network/infrastructure/remote/firebase_bootstrap.dart';
import 'core/network/sync_providers.dart';
import 'core/network/sync_status.dart';
import 'core/di/core_providers.dart';
import 'design/design.dart';
import 'core/router/app_router.dart';

import 'features/settings/domain/entities/app_settings.dart';
import 'features/settings/presentation/providers/settings_providers.dart';

import 'features/identity/infrastructure/models/identity_activity_record.dart';
import 'features/identity/infrastructure/models/identity_record.dart';
import 'features/identity/infrastructure/models/sequence_counter.dart';

import 'features/organization/infrastructure/models/organization_record.dart';
import 'features/students/infrastructure/models/student_record.dart';
import 'features/teachers/infrastructure/models/teacher_record.dart';
import 'features/groups/infrastructure/models/group_record.dart';

import 'features/payments/infrastructure/models/payment_record.dart';
import 'features/payments/infrastructure/models/debt_record.dart';
import 'features/payments/infrastructure/models/expense_record.dart';

import 'features/scheduling/infrastructure/models/schedule_record.dart';
import 'features/scheduling/infrastructure/models/room_record.dart';

import 'features/notifications/infrastructure/models/notification_record.dart';
import 'features/notifications/infrastructure/models/telegram_linking_token_record.dart';
import 'features/notifications/infrastructure/models/telegram_report_delivery_record.dart';

import 'features/face_recognition/infrastructure/models/face_record.dart';
import 'features/face_recognition/infrastructure/models/recognition_attempt_record.dart';

import 'features/settings/infrastructure/models/settings_record.dart';
import 'features/settings/infrastructure/models/user_record.dart';
import 'features/settings/infrastructure/models/subject_record.dart';

import 'features/homework/infrastructure/models/homework_submission_record.dart';

import 'features/attendance/infrastructure/models/attendance_record.dart';
import 'features/attendance/infrastructure/models/attendance_session_record.dart';

import 'features/crm/infrastructure/models/lead_record.dart';
import 'features/crm/infrastructure/models/lead_activity_record.dart';
import 'features/crm/infrastructure/models/lead_task_record.dart';

import 'features/grades/infrastructure/models/grade_record.dart';

import 'features/identity/infrastructure/models/signed_qr_nonce_record.dart';

import 'features/attendance/infrastructure/migrations/attendance_schema_v2_migration.dart';

import 'features/reports/infrastructure/models/report_record.dart';
import 'features/audit/infrastructure/models/audit_log_record.dart';

import 'features/face_recognition/infrastructure/diagnostics/face_diagnostics_service.dart';

import 'features/students/application/services/financial_reconciliation_service.dart';

import 'features/payments/infrastructure/datasources/isar_payment_datasource.dart';
import 'features/payments/infrastructure/repositories_impl/payment_repository_impl.dart';

import 'features/students/infrastructure/datasources/isar_student_datasource.dart';
import 'features/students/infrastructure/repositories_impl/student_repository_impl.dart';

/// P0 debug (spec §19).
///
/// `--dart-define=FACE_DIAGNOSE=true` bilan ishga tushirilganda
/// Face ID pipeline real qurilmada diagnostika qilinadi.
///
/// Production build'da default qiymat false.
const bool _faceDiagnoseEnabled =
    bool.fromEnvironment('FACE_DIAGNOSE');

/// Global sync scheduler.
///
/// App lifecycle davomida bitta scheduler ishlatiladi.
SyncScheduler? _syncScheduler;

/// System UI configuration
Future<void> _setupSystemUI() async {
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,                  systemNavigationBarColor: Color(0xFFF4F5F7),
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );
}

/// Firebase initialization - MUST be ready before runApp()
///
/// MUHIM:
///
/// Oldingi kod:
///
///   unawaited(FirebaseBootstrap.initialize());
///
/// Keyin:
///
///   runApp(...)
///
/// Bu race condition hosil qilardi.
///
/// authRouterProvider / FirebaseAuth provider MaterialApp qurilayotgan
/// vaqtda Firebase hali initialize qilinmagan bo'lishi mumkin edi.
///
/// Natija:
///
///   [core/no-app]
///   No Firebase App '[DEFAULT]' has been created
///
/// Shuning uchun Firebase'ni UI ishga tushishidan OLDIN tayyorlaymiz.
/// FirebaseBootstrap.initialize() idempotent bo'lishi sababli keyinchalik
/// scheduler tomonidan yana chaqirilishi xavfsiz.
Future<void> _initializeFirebase() async {
  try {
    await FirebaseBootstrap.initialize();

    AppLogger.info(
      'Firebase bootstrap completed before runApp',
    );
  } catch (e, stackTrace) {
    // Firebase ishlamasa ham offline-first lokal ilova ochilishi kerak.
    //
    // MUHIM:
    // Bu yerda exceptionni qayta throw qilmaymiz.
    // Chunki M-Edu offline-first arxitekturaga ega.
    //
    // Lekin error log qilinadi, shuning uchun production diagnostikasida
    // Firebase nega tayyor bo'lmaganini aniqlash mumkin.
    AppLogger.warning(
      'Firebase bootstrap failed; continuing offline-first: '
      '${e.runtimeType}: $e',
    );

    AppLogger.warning(
      'Firebase bootstrap stack trace: $stackTrace',
    );
  }
}

/// Open local database with all required schemas
Future<AppDatabase> _openDatabase() async {
  return AppDatabase.open(
    schemas: [
      // Identity
      IdentityRecordSchema,
      IdentityActivityRecordSchema,
      SequenceCounterSchema,

      // Organization
      OrganizationRecordSchema,

      // Students / Teachers / Groups
      StudentRecordSchema,
      TeacherRecordSchema,
      GroupRecordSchema,

      // Finance
      PaymentRecordSchema,
      DebtRecordSchema,
      ExpenseRecordSchema,

      // Scheduling
      ScheduleRecordSchema,
      RoomRecordSchema,

      // Grades / Notifications / Homework
      GradeRecordSchema,
      NotificationRecordSchema,
      TelegramLinkingTokenRecordSchema,
      TelegramReportDeliveryRecordSchema,
      HomeworkSubmissionRecordSchema,

      // Face recognition
      FaceRecordSchema,
      RecognitionAttemptRecordSchema,

      // Attendance
      AttendanceRecordSchema,
      AttendanceSessionRecordSchema,

      // CRM
      LeadRecordSchema,
      LeadActivityRecordSchema,
      LeadTaskRecordSchema,

      // Security / QR
      SignedQrNonceRecordSchema,

      // Settings / Users
      SettingsRecordSchema,
      UserRecordSchema,
      SubjectRecordSchema,

      // Audit / Reports
      AuditLogRecordSchema,
      ReportRecordSchema,

      // Sync
      SyncOperationRecordSchema,
      SyncCursorRecordSchema,
      SyncConflictRecordSchema,
      DeviceInfoRecordSchema,
    ],
    name: AppConstants.databaseName,
  );
}

/// Financial reconciliation service for data consistency
Future<void> _runFinancialReconciliation(AppDatabase database) async {
  //
  // Student.totalPaid — derived/projected field.
  //
  // Source of truth:
  //
  //   Payment records
  //
  // Agar crash, event yo'qolishi yoki projector xatosi sabab stale value
  // qolgan bo'lsa, startup paytida qayta hisoblanadi.
  //
  // Idempotent.
  //

  try {
    final paymentRepo = PaymentRepositoryImpl(
      IsarPaymentDataSource(database.instance),
    );

    final studentRepo = StudentRepositoryImpl(
      IsarStudentDataSource(database.instance),
    );

    final reconciliationService =
        FinancialReconciliationService(
      paymentRepository: paymentRepo,
      studentRepository: studentRepo,
    );

    final fixed =
        await reconciliationService.reconcileAll();

    if (fixed > 0) {
      AppLogger.info(
        'P1-001 Reconciliation: '
        '$fixed students totalPaid corrected',
      );
    }
  } catch (e) {
    // Reconciliation failure must NOT prevent app startup.
    AppLogger.warning(
      'P1-001 Reconciliation error '
      '(app continues): ${e.runtimeType}: $e',
    );
  }
}

/// Attendance schema migration (additive + idempotent)
Future<void> _runAttendanceSchemaMigration(AppDatabase database) async {
  try {
    await AttendanceSchemaV2Migration.run(
      database.instance,
    );
  } catch (e) {
    AppLogger.warning(
      'Attendance V2 migration failed '
      '(app continues): ${e.runtimeType}: $e',
    );
  }
}

/// Face ID diagnostics - only runs with debug flag
Future<void> _runFaceDiagnostics(AppDatabase database) async {
  if (_faceDiagnoseEnabled) {
    try {
      final report =
          await FaceDiagnosticsService(
        database.instance,
      ).run();



      for (final result in report) {

      }


    } catch (e) {

    }
  }
}

/// Sync status controller
SyncStatusController _createSyncStatusController() {
  return SyncStatusController();
}

/// Request permissions after initial render
Future<void> _requestPermissions() async {
  //
  // Web / desktop'da permission_handler mobil permissionlaridan
  // foydalanmaymiz.
  //

  if (kIsWeb) {
    return;
  }

  if (!(Platform.isAndroid || Platform.isIOS)) {
    return;
  }

  try {
    await [
      // QR scanner / Face ID kamera
      Permission.camera,

      // Notifications
      Permission.notification,
    ].request();
  } catch (e) {
    //
    // Permission failure application startupni buzmasligi kerak.
    //
    AppLogger.warning(
      'Permission request failed: '
      '${e.runtimeType}: $e',
    );
  }
}

/// Start sync scheduler with proper initialization
void _startSyncScheduler(AppDatabase database, SyncStatusController status) {
  Future<void> startWhenReady() async {
    try {
      //
      // Firebase yuqorida main() ichida allaqachon initialize qilingan.
      //
      // Bu ikkinchi chaqiruv:
      // - idempotent bootstrap uchun
      // - boshqa initialization flow bilan race bo'lmasligi uchun
      // - eski lifecycle contractni saqlash uchun
      //

      await FirebaseBootstrap.initialize();

      // Agar eski scheduler mavjud bo'lsa, uni to'xtatamiz.
      _syncScheduler?.stop();

      _syncScheduler = SyncScheduler(
        () => buildSyncEngine(database),
        status: status,
      )..start();

      AppLogger.info(
        'Sync scheduler started',
      );
    } catch (e) {
      //
      // Offline-first:
      // Firebase ishlamasa sync scheduler appni yiqitmasligi kerak.
      //
      AppLogger.warning(
        'Sync scheduler startup failed: '
        '${e.runtimeType}: $e',
      );
    }
  }

  unawaited(startWhenReady());
}

// ============================================================================
// APPLICATION ROOT
// ============================================================================

class MEduApp extends ConsumerWidget {
  const MEduApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(appSettingsProvider);

    final savedThemeMode =
        settingsAsync.valueOrNull?.themeMode ?? AppThemeMode.system;

    final themeMode = switch (savedThemeMode) {
      AppThemeMode.light => ThemeMode.light,
      AppThemeMode.dark => ThemeMode.dark,
      AppThemeMode.system => ThemeMode.system,
    };

    final savedLanguage =
        settingsAsync.valueOrNull?.language ?? 'uz';

    final locale = switch (savedLanguage) {
      'ru' => const Locale('ru', 'RU'),
      'en' => const Locale('en', 'US'),
      _ => const Locale('uz', 'UZ'),
    };

    final densityAsync = ref.watch(appDensityProvider);
    final density =
        densityAsync.valueOrNull ?? AppDensity.comfortable;

    return AppDensityScope(
      density: density,

      child: PinLockLifecycle(
        child: MaterialApp.router(
          title: 'M-Edu',
          debugShowCheckedModeBanner: false,
          theme: DsTheme.light(),
          darkTheme: DsTheme.dark(),
          themeMode: themeMode,
          routerConfig: ref.watch(authRouterProvider),
          locale: locale,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('uz', 'UZ'),
            Locale('ru', 'RU'),
            Locale('en', 'US'),
          ],
          builder: (context, child) {
            final isDark = Theme.of(context).brightness == Brightness.dark;
            final pinActive = ref.watch(pinLockActiveProvider);

            return MediaQuery.withClampedTextScaling(
              minScaleFactor: 1.0,
              maxScaleFactor: 2.0,

              child: AnnotatedRegion<SystemUiOverlayStyle>(
                value: SystemUiOverlayStyle(
                  statusBarColor: Colors.transparent,
                  statusBarIconBrightness:
                      isDark ? Brightness.light : Brightness.dark,
                  statusBarBrightness:
                      isDark ? Brightness.dark : Brightness.light,
                  systemNavigationBarColor:
                      isDark ? context.dsColors.scaffold : context.dsColors.surface,
                  systemNavigationBarIconBrightness:
                      isDark ? Brightness.light : Brightness.dark,
                ),

                child: Stack(
                  children: [
                    if (child != null) child,
                    if (pinActive) const PinLockOverlay(),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

// ============================================================================
// PIN LOCK OVERLAY
// ============================================================================
class PinLockOverlay extends StatelessWidget {
  const PinLockOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return const Material(child: PinLockPage());
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // P1-05: Global xato ushlash mexanizmi — Flutter framework,
  // platform va async xatolarini AppLogger'ga yozadi.
  // Production'da Crashlytics/Sentry integratsiyasi uchun tayyor.
  GlobalErrorHandler.install();

  await _setupSystemUI();

  // P1-03 FIX: Firebase va boshqa og'ir ishlarni parallel bajarish.
  // Firebase MUST be ready before runApp(), lekin permissions parallel
  // bo'lishi mumkin — ular auth flow'ga bog'liq emas.
  await _initializeFirebase();

  // Request permissions in background (non-blocking, does not delay UI).
  unawaited(_requestPermissions());

  runApp(const AppRoot());
}

// ============================================================================
// APP ROOT — Database lifecycle + retry
// ============================================================================

/// Top-level application entry point that manages the database lifecycle.
///
/// F-D01 FIX: If AppDatabase.open() throws, the app shows a controlled
/// recovery UI instead of crashing. The user can retry database open.
///
/// When database is available: normal ProviderScope + MEduApp flow.
/// When database fails: DatabaseErrorPage with retry.
class AppRoot extends StatefulWidget {
  const AppRoot({super.key});

  @override
  State<AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<AppRoot> {
  AppDatabase? _database;
  String? _databaseError;
  bool _initialized = false;
  bool _retrying = false;

  @override
  void initState() {
    super.initState();
    _initializeDatabase();
  }

  /// Attempt to open the database.
  ///
  /// On success: post-DB tasks run, then ProviderScope + MEduApp renders.
  /// On failure: DatabaseErrorPage with retry.
  Future<void> _initializeDatabase() async {
    setState(() {
      _initialized = false;
      _retrying = false;
    });

    try {
      final database = await _openDatabase();

      // P1-03 FIX: Post-DB startup tasks parallel bajariladi.
      // Uchta task bir-biriga bog'liq emas — parallel ishga tushiriladi.
      await Future.wait([
        _runFinancialReconciliation(database),
        _runAttendanceSchemaMigration(database),
        _runFaceDiagnostics(database),
      ]);

      if (!mounted) return;

      final syncStatus = _createSyncStatusController();

      // Start periodic sync scheduler (runs unawaited, in background).
      _startSyncScheduler(database, syncStatus);

      setState(() {
        _database = database;
        _databaseError = null;
        _initialized = true;
      });
    } catch (e, stackTrace) {
      AppLogger.warning(
        'F-D01 Database open failed: ${e.runtimeType}: $e',
      );
      AppLogger.warning('F-D01 Database open stack: $stackTrace');

      if (!mounted) return;

      setState(() {
        _database = null;
        _databaseError = e.toString();
        _initialized = true;
        _retrying = false;
      });
    }
  }

  /// Retry database open — idempotent, no duplicate resources.
  void _retryDatabase() {
    if (_retrying) return;
    setState(() => _retrying = true);
    _initializeDatabase();
  }

  @override
  Widget build(BuildContext context) {
    // Still loading — minimal splash (no ProviderScope needed).
    if (!_initialized) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: const Scaffold(
          body: Center(
            child: CircularProgressIndicator(),
          ),
        ),
      );
    }

    // Database failed — show recovery UI.
    if (_database == null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: DatabaseErrorPage(
          errorMessage: _databaseError,
          onRetry: _retryDatabase,
          retrying: _retrying,
        ),
      );
    }

    // Database ready — normal app flow.
    return ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWithValue(_database!),
      ],
      child: const MEduApp(),
    );
  }
}

// ============================================================================
// DATABASE ERROR PAGE
// ============================================================================

/// Controlled recovery UI shown when database open fails.
///
/// F-D01 FIX: Shows a user-friendly error message with retry button.
/// Does NOT auto-delete or auto-recreate the database.
/// Does NOT expose internal error details to the user.
class DatabaseErrorPage extends StatelessWidget {
  final String? errorMessage;
  final VoidCallback onRetry;
  final bool retrying;

  const DatabaseErrorPage({
    super.key,
    this.errorMessage,
    required this.onRetry,
    this.retrying = false,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Error icon
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: context.dsColors.errorBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.error_outline,
                  size: 40,
                  color: context.dsColors.error,
                ),
              ),
              const SizedBox(height: 24),

              // Title
              Text(
                context.l10n.databaseErrorTitle,
                style: DsType.h1(color: context.dsColors.textPrimary),
              ),
              const SizedBox(height: 12),

              // Description
              Text(
                context.l10n.databaseErrorDescription,
                textAlign: TextAlign.center,
                style: DsType.body(color: context.dsColors.textSecondary),
              ),
              const SizedBox(height: 32),

              // Retry button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: DsButton(
                  label: context.l10n.actionRetry,
                  isLoading: retrying,
                  onPressed: retrying ? null : onRetry,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}