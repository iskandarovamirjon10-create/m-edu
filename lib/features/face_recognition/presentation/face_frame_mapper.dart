// Dvigatel tahlil natijasini (infrastruktura) controller hodisasiga (domain)
// va display ma'lumotiga o'tkazuvchi sof funksiya.
//
// Chegara (spec §3): infrastruktura turlari ([FaceAnalysisOutcome]) UI
// mantig'iga, domain turlari ([FaceScanFrameEvent]) esa controller'ga
// tegishli — bu mapper o'rtadagi yagona ko'prik.

import '../application/face_scan_state.dart';
import '../infrastructure/services/face_quality_gate.dart';
import '../infrastructure/services/face_vision_engine.dart';

/// Kadr natijasi — controller hodisasi + display uchun meta-ma'lumot.
class MappedFrame {
  /// Controller'ga uzatiladigan hodisa (har doim mavjud).
  final FaceScanFrameEvent event;

  /// Overlay ramkasi uchun so'nggi yuz kuzatuvi (yuz bo'lsa).
  final FaceObservation? observation;

  /// Sifat rad etish sabablari (foydalanuvchi tilida, display uchun).
  final List<String> qualityIssueLabels;

  const MappedFrame({
    required this.event,
    this.observation,
    this.qualityIssueLabels = const [],
  });
}

/// [FaceAnalysisOutcome] → [MappedFrame] (spec §3-4).
MappedFrame mapFrameOutcome(FaceAnalysisOutcome outcome) {
  return switch (outcome) {
    NoFaceOutcome() => const MappedFrame(event: NoFaceFrameEvent()),
    MultipleFacesOutcome() =>
      const MappedFrame(event: MultipleFacesFrameEvent()),
    EngineUnavailableOutcome(:final reason) => MappedFrame(
        event: EngineUnavailableFrameEvent(reason: reason),
      ),
    FaceRejectedOutcome(:final issues) => MappedFrame(
        event: const FaceRejectedFrameEvent(),
        qualityIssueLabels:
            issues.map(faceQualityIssueLabel).toList(growable: false),
      ),
    FaceDetectedOutcome(:final observation) => MappedFrame(
        event: FaceDetectedFrameEvent(
          signature: observation.signature,
          confidence: observation.confidence,
          eyeOpenness: observation.eyeOpenness,
        ),
        observation: observation,
      ),
  };
}
