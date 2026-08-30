import 'dart:async';
import 'package:m_edu/core/extensions/l10n_context.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../attendance/application/commands/mark_attendance_status_command.dart';
import '../../../attendance/application/commands/record_attendance_command.dart';
import '../../../attendance/domain/entities/attendance_entry.dart';
import '../../../attendance/presentation/providers/attendance_providers.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../students/domain/entities/student.dart';
import '../../../students/presentation/providers/student_providers.dart';
import '../../../settings/presentation/providers/settings_providers.dart';
import '../../application/face_attendance_guard.dart';
import '../../application/face_scan_controller.dart';
import '../../application/face_scan_state.dart';
import '../../domain/errors/face_recognition_error.dart';
import '../../infrastructure/services/face_vision_engine.dart';
import '../../infrastructure/services/camera_source.dart';
import '../face_frame_mapper.dart';
import '../face_scan_camera_driver.dart';
import '../providers/face_recognition_providers.dart';
import '../widgets/active_lesson_banner.dart';
import '../widgets/camera_section.dart';
import '../widgets/face_scan_status_panel.dart';

/// Face ID sahifasi — Hikvision kamera RTSP oqimi orqali yuzni aniqlaydi,
/// tanish yuz topilsa davomatni avtomatik belgilaydi.
///
/// Bu sahifa faqat kompozitsiya qiladi (spec §32/§53):
/// - [FaceScanCameraDriver] (presentation): kamera hayot sikli + kadr oqimi
///   + chegaralangan qayta ulanish (spec §23).
/// - [FaceScanController] (application): liveness → moslik → vaqtinchalik
///   konsensus → attendance qarori (spec §16, §43).
/// - [CameraSection] / [FaceScanStatusPanel]: display qismlari o'z
///   manbalarini o'zlari kuzatadi.
class FaceScanPage extends ConsumerStatefulWidget {
  const FaceScanPage({super.key});

  @override
  ConsumerState<FaceScanPage> createState() => _FaceScanPageState();
}

class _FaceScanPageState extends ConsumerState<FaceScanPage> {
  FaceScanCameraViewStatus _cameraStatus = FaceScanCameraViewStatus.connecting;
  int _reconnectAttempt = 0;
  bool _engineSupported = true;
  FaceScanCameraDriver? _driver;
  CameraSource? _cameraSource;

  /// So'nggi yuz kuzatuvi — overlay ramkasi uchun (display-only).
  FaceObservation? _observation;

  /// Sifat rad etish sabablari (display-only; qaror controller'da).
  List<String> _qualityIssueLabels = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = ref.read(faceScanControllerProvider);
      controller.attendanceWriter = _writeAttendance;
      controller.start();
      _start();
    });
  }

  @override
  void dispose() {
    // Kamera resurslari va reconnect timer tozalanadi (abadiy qayta
    // urinish qolmasligi uchun). Controller autoDispose — ref tozalaydi.
    _driver?.dispose();
    _driver = null;
    _cameraSource?.dispose();
    _cameraSource = null;
    super.dispose();
  }

  Future<void> _start() async {
    // Use the unified camera source
    _cameraSource = ref.read(cameraSourceProvider);
    
    if (!_cameraSource!.isAvailable) {
      _fail('Kamera mavjud emas', retryable: true);
      return;
    }

    _engineSupported = FaceVisionEngine.isSupportedOnPlatform;
    if (!_engineSupported) {
      // Windows/Linux'da ML Kit yo'q — jonli tasvir ko'rinadi, tanib
      // olish yo'q (tushunarli holat ko'rsatiladi).
      setState(() => _cameraStatus = FaceScanCameraViewStatus.unsupported);
      ref
          .read(faceScanControllerProvider)
          .setCameraStatus(FaceScanCameraStatus.streaming);
      return;
    }

    final engine = ref.read(faceVisionEngineProvider);

    _driver?.dispose();
    _driver = FaceScanCameraDriver(
      openStream: () => _cameraSource!.open(),
      grabFrame: _cameraSource!.captureFrame,
      fetchSnapshot: () => _cameraSource!.captureFrame(),
      analyzeFrame: engine.analyze,
      onFrame: _onFrame,
      onStatus: _onDriverStatus,
      scanIntervalMs: () =>
          ref.read(appSettingsProvider).valueOrNull?.scanIntervalMs ?? 1200,
    );
    await _driver!.start();
  }

  /// Drayverdan kelgan tahlil natijasi → display + controller.
  void _onFrame(MappedFrame mapped) {
    _observation = mapped.observation;
    _qualityIssueLabels = mapped.qualityIssueLabels;
    ref.read(faceScanControllerProvider).handleFrame(mapped.event);
  }

  /// Drayver holati → UI chip + controller (kuzatuv uchun).
  void _onDriverStatus(
    FaceScanCameraDriverStatus status, {
    int attempt = 0,
    int maxAttempts = FaceScanCameraDriver.kMaxReconnectAttempts,
    String? message,
  }) {
    if (!mounted) return;
    setState(() {
      _cameraStatus = switch (status) {
        FaceScanCameraDriverStatus.connecting =>
          FaceScanCameraViewStatus.connecting,
        FaceScanCameraDriverStatus.streaming =>
          FaceScanCameraViewStatus.streaming,
        FaceScanCameraDriverStatus.reconnecting =>
          FaceScanCameraViewStatus.reconnecting,
        FaceScanCameraDriverStatus.error => FaceScanCameraViewStatus.error,
      };
      _reconnectAttempt = attempt;
    });
    ref.read(faceScanControllerProvider).setCameraStatus(
          switch (status) {
            FaceScanCameraDriverStatus.connecting =>
              FaceScanCameraStatus.connecting,
            FaceScanCameraDriverStatus.streaming =>
              FaceScanCameraStatus.streaming,
            FaceScanCameraDriverStatus.reconnecting =>
              FaceScanCameraStatus.reconnecting,
            FaceScanCameraDriverStatus.error =>
              FaceScanCameraStatus.unavailable,
          },
        );
  }

  /// Attendance qarori — attendance domeni (spec §18): tanib olish "kim?"
  /// deydi, bu ko'prik "yozish mumkinmi?" degan savolni hal qiladi.
  Future<FaceAttendanceOutcome> _writeAttendance(
    FaceScanIdentified identified,
  ) async {
    final settings = ref.read(appSettingsProvider).valueOrNull;
    if (settings == null || !settings.autoMarkAttendance) {
      return const FaceAttendanceOutcome();
    }

    // P1: davomat DARS kontekstiga bog'langan. Attendance Marking'dan
    // (Lesson Detail → Davomat belgilash → Face ID) kelganda TANLANGAN
    // dars ustuvor; aks holda hozirgi faol dars.
    final lesson = ref.read(selectedMarkingLessonProvider) ??
        ref.read(activeLessonProvider).valueOrNull;
    if (lesson == null) {
      return const FaceAttendanceOutcome(
        blocked: true,
        blockedReason: "Faol dars yo'q — belgilanmadi",
      );
    }

    final identity =
        await ref.read(identityDetailProvider(identified.identityId).future);
    if (identity == null) {
      return const FaceAttendanceOutcome(
        blocked: true,
        blockedReason: 'Shaxs topilmadi — belgilanmadi',
      );
    }

    // §17-18: shaxs faol + o'quvchi bo'lsa faol dars guruhida.
    final decision = await ref
        .read(faceAttendanceGuardProvider)
        .evaluate(identity: identity, lesson: lesson);
    if (decision != FaceAttendanceDecision.allow) {
      return FaceAttendanceOutcome(
        blocked: true,
        blockedReason: faceAttendanceDecisionLabel(decision),
      );
    }

    try {
      final result = await ref
          .read(recordAttendanceCommandProvider)
          .execute(
            RecordAttendanceRequest(
              identityId: identity.identityId,
              fullName: identity.fullName,
              role: identity.role.name,
              method: 'face',
              lessonId: lesson.lessonId,
              confidence: identified.confidence,
              source: _cameraSource?.type.name ?? 'unknown',
            ),
          );
      // Audit-log (Activity Timeline): tanilgan shaxs uchun.
      if (result.recorded) {
        await ref
            .read(attendanceActivityRecorderProvider)
            .record(
              identityId: identity.identityId,
              method: 'face',
              confidence: identified.confidence,
            );
      }
      return FaceAttendanceOutcome(
        recorded: result.recorded,
        duplicate: result.isDuplicate,
      );
    } on Failure catch (failure) {
      // DB xatosi oqimni to'xtatmaydi — bloklangan holat ko'rsatiladi.
      return FaceAttendanceOutcome(blocked: true, blockedReason: failure.message);
    }
  }

  void _manualRetry() {
    final driver = _driver;
    if (driver == null) {
      unawaited(_start());
      return;
    }
    driver.manualRetry();
  }

  void _fail(String message, {bool retryable = false}) {
    ref
        .read(faceScanControllerProvider)
        .fail(CameraUnavailableError(message), retryable: retryable);
    if (mounted) {
      setState(() => _cameraStatus = FaceScanCameraViewStatus.error);
    }
  }

  void _pauseScan() {
    _driver?.pause();
    setState(() {});
  }

  void _resumeScan() {
    _driver?.resume();
    setState(() {});
  }

  // ── Build ───────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(hikvisionConfigProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Face ID'),
        actions: [
          IconButton(
            tooltip: 'Kamera sozlamalari',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.go('/settings'),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          // Controller holati o'zgarganda (ChangeNotifier.notifyListeners)
          // butun sahifa qayta quriladi — `_observation`/labels ham yangilanadi
          // (oddiy Provider `notifyListeners` ga reaksiya qilmaydi).
          child: ListenableBuilder(
            listenable: ref.watch(faceScanControllerProvider),
            builder: (context, _) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const ActiveLessonBanner(),                CameraSection(
                   config: config,
                   observation: _observation,
                   engineSupported: _engineSupported,
                   snapshotFallback: _driver?.isSnapshotFallback ?? false,
                   running: _driver?.isRunning ?? false,
                   mirrored: _observation?.sourceWidth != null &&
                       _cameraSource?.type == CameraSourceType.android,
                ),
                const SizedBox(height: 16),
                FaceScanStatusPanel(
                  cameraStatus: _cameraStatus,
                  reconnectAttempt: _reconnectAttempt,
                  qualityIssueLabels: _qualityIssueLabels,
                  onRetry: _manualRetry,
                  onSettings: () => context.go('/settings'),
                  onManualMarking: () => _manualMarking(context),
                ),
                const SizedBox(height: 16),
                _buildControls(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildControls() {
    final running = _driver?.isRunning ?? false;
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: running ? _pauseScan : _resumeScan,
            icon: Icon(running ? Icons.pause : Icons.play_arrow),
            label: Text(running ? 'To\'xtatish' : 'Davom etish'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            // Spec §27: Face ID hech qachon yagona yo'l emas — manual
            // fallback tez bo'lishi kerak.
            onPressed: () => _manualMarking(context),
            icon: const Icon(Icons.edit_outlined),
            label: Text(context.l10n.faceManualAttendance),
          ),
        ),
      ],
    );
  }

  /// Qo'lda davomat (manual fallback, spec §20/§27): tanlangan/faol dars
  /// kontekstida o'quvchini tanlab holat belgilash. Method = manual.
  Future<void> _manualMarking(BuildContext context) async {
    final lesson = ref.read(selectedMarkingLessonProvider) ??
        ref.read(activeLessonProvider).valueOrNull;
    if (lesson == null) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.l10n.faceNoActiveLesson),
          backgroundColor: context.dsColors.warning,
        ),
      );
      return;
    }

    final students = ref.read(studentListProvider).valueOrNull ?? const [];
    final groupStudents = students
        .where((s) => s.isActive && s.groupId == lesson.groupId)
        .toList();
    final candidates = groupStudents.isEmpty
        ? students.where((s) => s.isActive).toList()
        : groupStudents;
    if (candidates.isEmpty) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.l10n.faceNoStudentsInGroup),
          backgroundColor: context.dsColors.warning,
        ),
      );
      return;
    }

    // O'quvchini tanlash.
    final selected = await showDialog<Student>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Qo'lda belgilash"),
        content: SizedBox(
          width: double.maxFinite,
          height: 400,
          child: ListView.separated(
            itemCount: candidates.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final student = candidates[index];
              final identity =
                  ref.read(identityDetailProvider(student.identityId));
              final name =
                  identity.valueOrNull?.fullName ?? student.identityId;
              return ListTile(
                dense: true,
                leading: Icon(Icons.person_outline,
                    color: context.dsColors.accent),
                title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  student.groupName == null
                      ? "Guruhsiz"
                      : 'Guruh: ${student.groupName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                onTap: () => Navigator.pop(context, student),
              );
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Bekor qilish'),
          ),
        ],
      ),
    );
    if (selected == null || !context.mounted) return;

    // Holatni tanlash.
    final status = await showDialog<AttendanceStatus>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Holat'),
        children: [
          for (final s in AttendanceStatus.values)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, s),
              child: Row(
                children: [
                  Icon(_statusIcon(s.name), color: _statusColor(s.name)),
                  const SizedBox(width: 14),
                  Text(_statusLabel(s.name)),
                ],
              ),
            ),
        ],
      ),
    );
    if (status == null || !context.mounted) return;

    Identity? identity =
        ref.read(identityDetailProvider(selected.identityId)).valueOrNull;
    if (identity == null) {
      try {
        identity = await ref
            .read(identityDetailProvider(selected.identityId).future);
      } catch (_) {
        identity = null;
      }
    }
    if (identity == null || !context.mounted) return;

    try {
      await ref.read(markAttendanceStatusCommandProvider).execute(
            MarkAttendanceStatusRequest(
              identityId: identity.identityId,
              fullName: identity.fullName,
              role: identity.role.name,
              attendanceDate: lesson.date,
              lessonId: lesson.lessonId,
              status: status,
            ),
          );
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${identity.fullName} — ${_statusLabel(status.name)} '
            '(Qo\'lda)',
          ),
          backgroundColor: context.dsColors.success,
        ),
      );
    } on Failure catch (failure) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    }
  }

  String _statusLabel(String status) {
    return switch (status) {
      'present' => 'Keldi',
      'late' => 'Kech qoldi',
      'absent' => 'Kelmagan',
      'excused' => 'Uzrli',
      _ => status,
    };
  }

  IconData _statusIcon(String status) {
    return switch (status) {
      'present' => Icons.check_circle_outline,
      'late' => Icons.access_time,
      'absent' => Icons.cancel_outlined,
      'excused' => Icons.event_busy_outlined,
      _ => Icons.help_outline,
    };
  }

  Color _statusColor(String status) {
    return switch (status) {
      'present' => context.dsColors.success,
      'late' => context.dsColors.warning,
      'absent' => context.dsColors.error,
      'excused' => context.dsColors.info,
      _ => context.dsColors.accent,
    };
  }
}
