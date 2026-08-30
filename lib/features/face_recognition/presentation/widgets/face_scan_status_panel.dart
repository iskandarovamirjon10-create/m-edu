import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../design/design.dart';
import '../../../identity/domain/entities/identity.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../application/face_attendance_guard.dart';
import '../../application/face_scan_state.dart';
import '../../domain/services/liveness_service.dart';
import '../face_scan_camera_driver.dart';
import '../providers/face_recognition_providers.dart';
import 'recognition_status_cards.dart';

/// Kamera holati (display) — drayver holati + unsupported flag.
enum FaceScanCameraViewStatus { connecting, streaming, reconnecting, error, unsupported }

/// Holat paneli: kamera chipi + liveness satri + ogohlantirish + natija
/// kartasi. Controller'ni o'zi kuzatadi — sahifa faqat kompozitsiya qiladi.
class FaceScanStatusPanel extends ConsumerWidget {
  final FaceScanCameraViewStatus cameraStatus;
  final int reconnectAttempt;

  /// Sifat rad etish sabablari (display-only, kadr darajasida).
  final List<String> qualityIssueLabels;

  final VoidCallback onRetry;
  final VoidCallback onSettings;

  /// Qo'lda davomat (spec §20/§27): tanib bo'lmaganda manual fallback.
  final VoidCallback onManualMarking;

  const FaceScanStatusPanel({
    super.key,
    required this.cameraStatus,
    required this.reconnectAttempt,
    required this.qualityIssueLabels,
    required this.onRetry,
    required this.onSettings,
    required this.onManualMarking,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.watch(faceScanControllerProvider);
    final state = controller.state;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildStatusChip(context, state),
        _buildWarningLine(state),
        const SizedBox(height: 16),
        _buildResultSection(ref, state),
      ],
    );
  }

  // ── Status chip ─────────────────────────────────────────────────────

  Widget _buildStatusChip(BuildContext context, FaceScanUiState state) {
    // Liveness satri — yuz topilganda (blink hisobi).
    final liveness = switch (state) {
      FaceScanFaceDetected(:final liveness) => liveness,
      _ => null,
    };
    final livenessLine =
        liveness == null || liveness.status == LivenessStatus.live
            ? null
            : liveness.message;

    final (icon, color, text, showRetry) = switch (state) {
      // Dvigatel modeli yuklanmagan — aniq xato (kamera ishlayotgan bo'lsa ham).
      FaceScanEngineUnavailable(:final reason) => (
          Icons.error_outline,
          context.dsColors.error,
          reason,
          true,
        ),
      _ => switch (cameraStatus) {
          FaceScanCameraViewStatus.streaming => (
              Icons.sensors,
              context.dsColors.success,
              'Kamera ulangan — yuz qidirilmoqda',
              false,
            ),
          FaceScanCameraViewStatus.connecting => (
              Icons.sync,
              context.dsColors.info,
              'Kameraga ulanmoqda…',
              false,
            ),
          FaceScanCameraViewStatus.reconnecting => (
              Icons.sync,
              context.dsColors.warning,
              'Kamera uzildi — qayta ulanmoqda ($reconnectAttempt/'
              '${FaceScanCameraDriver.kMaxReconnectAttempts})…',
              false,
            ),
          FaceScanCameraViewStatus.unsupported => (
              Icons.info_outline,
              context.dsColors.warning,
              'Yuz dvigateli yuklanmadi — tarmoqsiz ishlash modelini tekshiring',
              false,
            ),
          FaceScanCameraViewStatus.error => switch (state) {
              FaceScanFailed(:final error, :final retryable) => (
                  Icons.error_outline,
                  context.dsColors.error,
                  error.userMessage,
                  retryable,
                ),
              _ => (Icons.error_outline, context.dsColors.error, 'Xatolik', true),
            },
        },
    };

    return FaceScanStatusChip(
      icon: icon,
      color: color,
      text: text,
      livenessLine: livenessLine,
      livenessColor: liveness?.status == LivenessStatus.timedOut
          ? context.dsColors.error
          : context.dsColors.warning,
      showRetry: showRetry,
      onRetry: onRetry,
      onSettings: onSettings,
    );
  }

  // ── Ogohlantirish satri ─────────────────────────────────────────────

  Widget _buildWarningLine(FaceScanUiState state) {
    if (cameraStatus == FaceScanCameraViewStatus.unsupported ||
        state is FaceScanEngineUnavailable) {
      return const SizedBox.shrink();
    }
    return switch (state) {
      FaceScanMultipleFaces() => const FaceScanWarningLine(
          icon: Icons.people_outline,
          text: 'Iltimos, faqat bitta shaxs ko\'rinishiga ishonch hosil qiling',
        ),
      FaceScanQualityRejected() when qualityIssueLabels.isNotEmpty =>
        FaceScanWarningLine(
          icon: Icons.warning_amber_rounded,
          text: qualityIssueLabels.join(' · '),
        ),
      FaceScanUnknown() => const FaceScanWarningLine(
          icon: Icons.help_outline,
          text: 'Bu yuz ro\'yxatga olingan shaxslarga mos kelmadi',
        ),
      FaceScanAmbiguous() => const FaceScanWarningLine(
          icon: Icons.help_outline,
          text:
              'Yuz bir nechta shaxsga o\'xshaydi — noaniq, qayta urinib ko\'ring',
        ),
      _ => const SizedBox.shrink(),
    };
  }

  // ── Natija kartasi ──────────────────────────────────────────────────

  Widget _buildResultSection(WidgetRef ref, FaceScanUiState state) {
    final result = switch (state) {
      FaceScanConfirming(
        :final identityId,
        :final confidence,
        :final confirmedFrames,
        :final requiredFrames,
      ) =>
        FaceScanIdentityCard(
          identity: _identityFor(ref, identityId),
          confidence: confidence,
          confirmation: (confirmedFrames, requiredFrames),
        ),
      FaceScanIdentified(
        :final identityId,
        :final confidence,
        :final attendance,
        :final cooldownActive,
      ) =>
        FaceScanIdentityCard(
          identity: _identityFor(ref, identityId),
          confidence: confidence,
          attendance: attendance,
          cooldownActive: cooldownActive,
        ),
      FaceScanFailed() => const FaceScanHintCard(
          icon: Icons.error_outline,
          text: 'Kamera tayyor emas — qayta urinib ko\'ring',
        ),
      FaceScanEngineUnavailable(:final reason) => FaceScanHintCard(
          icon: Icons.error_outline,
          text: reason,
        ),
      _ => const FaceScanHintCard(
          text: 'Yuzni kamera oldida frontal holatda ushlab turing. '
              'Bir marta tanilgach davomat avtomatik belgilanadi.',
        ),
    };

    // Spec §20/§21: tanib bo'lmadi / noaniq / xato — manual fallback har
    // doim mavjud; hech qachon noaniq tanlov avtomatik yozilmaydi.
    final showFallback = switch (state) {
      FaceScanUnknown() || FaceScanAmbiguous() || FaceScanFailed() => true,
      _ => false,
    };
    if (!showFallback) return result;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        result,
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: onManualMarking,
            icon: const Icon(Icons.edit_outlined, size: 17),
            label: const Text("Qo'lda davomat"),
          ),
        ),
      ],
    );
  }

  Identity? _identityFor(WidgetRef ref, String identityId) =>
      ref.watch(identityDetailProvider(identityId)).valueOrNull;
}

/// FaceAttendanceGuard qarori uchun foydalanuvchi tili labeli.
String faceAttendanceDecisionLabel(FaceAttendanceDecision decision) {
  return switch (decision) {
    FaceAttendanceDecision.allow => '',
    FaceAttendanceDecision.identityInactive =>
      'Bu shaxs faol emas — davomat belgilanmadi',
    FaceAttendanceDecision.studentNotFound =>
      'O\'quvchi bazada topilmadi — davomat belgilanmadi',
    FaceAttendanceDecision.studentInactive =>
      'O\'quvchi faol emas — davomat belgilanmadi',
    FaceAttendanceDecision.studentNotInLessonGroup =>
      'O\'quvchi bu dars guruhiga tegishli emas — davomat belgilanmadi',
  };
}
