// Face skan qaror dvigateli (spec §3, §16, §42, §43).
//
// Page (presentation) kamera hayot sikli va kadr oqimini boshqaradi; har bir
// tahlil natijasi [FaceScanFrameEvent] sifatida controller'ga uzatiladi.
// Controller quyidagilarni hal qiladi:
//
//  1. Liveness (blink) gate'i — jonlilik o'tmaguncha moslik qilinmaydi (§11).
//  2. Nomzod mosligi (matcher) — threshold + margin (§14).
//  3. Vaqtinchalik konsensus — bir xil nomzod ketma-ket N kadr (§16).
//  4. Cooldown — o'sha identity yaqinda tasdiqlangan bo'lsa qayta yozilmaydi
//     (dublikat davomat, §19).
//  5. Eski (stale) natija himoyasi — async matcher/attendance natijasi faqat
//     joriy kadr/identifikatsiya uchun amal qiladi (§42).
//  6. Kuzatuv natijalari ([FaceRecognitionResult]) — xavfsiz meta-ma'lumot,
//     xom biometrik ma'lumotsiz (§35).
//
// Sof Dart (Flutter/Riverpod/Isar/ML Kit dan mustaqil) — unit test qilish
// uchun barcha tashqi bog'liqliklar in'ektsiya qilinadi.

import 'package:flutter/foundation.dart';

import '../domain/errors/face_recognition_error.dart';
import '../domain/services/liveness_service.dart';
import '../domain/services/recognition_state_machine.dart';
import '../domain/value_objects/biometric_policy.dart';
import '../domain/value_objects/face_recognition_result.dart';
import 'face_matcher.dart';
import 'face_scan_state.dart';

/// Kamera oqimi holati (camera life cycle — page tomonidan uzatiladi).
enum FaceScanCameraStatus { idle, connecting, streaming, reconnecting, unavailable }

/// Face skan qaror dvigateli.
class FaceScanController extends ChangeNotifier {
  final BiometricPolicy policy;
  final FaceMatcher matcher;

  /// Ro'yxatga olingan yuzlar bazasini yuklovchi (sessiya davomida kešlangan).
  final Future<List<EnrolledFace>> Function() loadGallery;

  /// Liveness kuzatuvchisi fabrikasi (testlar fake beradi).
  final LivenessService Function() createLiveness;

  /// Identity tasdiqlanganda chaqiriladi — attendance qarorini page
  /// (attendance domeni) hal qiladi va natijani qaytaradi.
  ///
  /// O'zgaruvchan (mutable): provider controller'ni writer'siz yaratadi,
  /// page o'z ref-bog'liq yopilishini (closure) ishga tushishidan oldin
  /// o'rnatadi. Testlar to'g'ridan-to'g'ri o'rnatadi.
  Future<FaceAttendanceOutcome> Function(FaceScanIdentified identified)?
      attendanceWriter;

  /// Har bir yakuniy natija uchun kuzatuv yozuvi (xavfsiz meta-ma'lumot).
  final void Function(FaceRecognitionResult result)? onResult;

  /// Kadr manbasi ('hikvision' | 'device' | 'test').
  final String cameraSource;

  /// Vaqt manbai (test determinizmi uchun).
  final DateTime Function() clock;

  FaceScanController({
    required this.policy,
    required this.matcher,
    required this.loadGallery,
    required this.createLiveness,
    this.attendanceWriter,
    this.onResult,
    this.cameraSource = 'default',
    DateTime Function()? clock,
  }) : clock = clock ?? DateTime.now {
    _state = const FaceScanIdle();
    // Konsensus tracker ham bir xil soatdan ishlaydi — testlarda vaqt
    // in'ektsiyasi deterministik (real ishda ikkalasi DateTime.now).
    _consensus = TemporalConsensusTracker(policy: policy, now: clock);
  }

  late final TemporalConsensusTracker _consensus;

  late FaceScanUiState _state;
  FaceScanCameraStatus _cameraStatus = FaceScanCameraStatus.idle;

  FaceScanUiState get state => _state;
  FaceScanCameraStatus get cameraStatus => _cameraStatus;

  LivenessService? _liveness;
  List<EnrolledFace>? _gallery;

  /// Kadr ketma-ketligi — eski async natijani bekor qilish uchun (§42).
  int _frameSequence = 0;

  /// Identifikatsiya tokeni — attendance natijasi faqat o'sha identifikatsiya
  /// konteksti hali eng oxirgi bo'lsa qo'llaniladi (§42).
  int _identificationToken = 0;

  /// So'nggi tasdiqlangan identity + vaqt — cooldown (§19).
  ({String identityId, DateTime at})? _lastIdentified;

  // ── Hayot sikli ─────────────────────────────────────────────────────

  /// Yangi skan sessiyasi (sahifa ochilganda/start tugmasi).
  void start() {
    _frameSequence = 0;
    _identificationToken = 0;
    _consensus.reset();
    _liveness?.reset();
    _gallery = null;
    _lastIdentified = null;
    _state = const FaceScanWatching();
    notifyListeners();
  }

  /// Skan to'xtatilganda (sahifa yopilganda/dispose).
  void stop() {
    _frameSequence++;
    _state = const FaceScanIdle();
    _cameraStatus = FaceScanCameraStatus.idle;
    notifyListeners();
  }

  void setCameraStatus(FaceScanCameraStatus status) {
    _cameraStatus = status;
    notifyListeners();
  }

  /// Umumiy xato (kamera sozlanmagan/ruxsat yo'q/platforma) — UI holatga
  /// o'tkazadi. [retryable] — "Qayta urinish" tugmasi ko'rsatiladi.
  void fail(FaceRecognitionError error, {bool retryable = false}) {
    _frameSequence++;
    _state = FaceScanFailed(error: error, retryable: retryable);
    notifyListeners();
  }

  // ── Kadr oqimi ──────────────────────────────────────────────────────

  /// Dvigatel tahlil natijasini qabul qiladi (har kadrda bir marta).
  void handleFrame(FaceScanFrameEvent event) {
    final seq = ++_frameSequence;
    _handle(seq, event);
  }

  Future<void> _handle(int seq, FaceScanFrameEvent event) async {
    switch (event) {
      case NoFaceFrameEvent():
        // 0 yuz — konsensus tozalanadi (qaror emas, shuning uchun
        // natija yozuvi chiqarilmaydi — §35: faqat qaror toifalari).
        _consensus.reset();
        _state = const FaceScanWatching();
        notifyListeners();

      case EngineUnavailableFrameEvent(:final reason):
        // Dvigatel modeli yuklanmagan — aniq xato holati.
        // "No face detected" emas, foydalanuvchi tushunishi kerak.
        _frameSequence++;
        _state = FaceScanEngineUnavailable(reason: reason);
        notifyListeners();

      case MultipleFacesFrameEvent():
        // spec §3: 2+ yuz — avtomatik tanlov yo'q.
        _consensus.reset();
        _onResult(FaceRecognitionOutcome.multipleFaces);
        _state = const FaceScanMultipleFaces();
        notifyListeners();

      case FaceRejectedFrameEvent():
        // spec §4: sifat gate'i o'tmadi — imzo moslikka kirmaydi.
        _consensus.reset();
        _onResult(FaceRecognitionOutcome.qualityRejected);
        _state = const FaceScanQualityRejected();
        notifyListeners();

      case FaceDetectedFrameEvent():
        await _onFaceDetected(seq, event);
    }
  }

  Future<void> _onFaceDetected(int seq, FaceDetectedFrameEvent event) async {
    if (!_isCurrent(seq)) return;

    // ── 1) Liveness gate'i (§11) ──
    final liveness = _liveness ??= createLiveness();
    final snap = liveness.feed(event.eyeOpenness);
    if (snap.status != LivenessStatus.live) {
      if (snap.status == LivenessStatus.timedOut) {
        // Vaqt tugadi — sessiya tozalanadi, foydalanuvchi qayta urinadi.
        liveness.reset();
        _consensus.reset();
        _onResult(FaceRecognitionOutcome.livenessFailed, livenessPassed: false);
      }
      _state = FaceScanFaceDetected(liveness: snap, confidence: event.confidence);
      notifyListeners();
      return;
    }

    // ── 2) Nomzod mosligi (§14) ──
    final List<EnrolledFace> gallery;
    try {
      gallery = await _galleryOrLoad();
    } on Object {
      // Galereya yuklanmadi — xato holati allaqachon _galleryOrLoad da
      // ko'rsatilgan; bu kadr bekor qilinadi.
      return;
    }
    if (!_isCurrent(seq)) return;
    final match = matcher.findBestMatch(event.signature, gallery);
    if (!_isCurrent(seq)) return;

    if (match == null) {
      // Eng yaqin nomzod ham thresholddan past — UNKNOWN (spec §46).
      _consensus.feed(identityId: null, ambiguous: false, confidence: 0);
      _onResult(FaceRecognitionOutcome.unknown, livenessPassed: true);
      _state = const FaceScanUnknown();
      notifyListeners();
      return;
    }

    if (match.ambiguous) {
      // Nomzodlar juda yaqin — AMBIGUOUS, majburan biriktirilmaydi (§46).
      _consensus.feed(
        identityId: match.identityId,
        ambiguous: true,
        confidence: match.confidence,
      );
      _onResult(
        FaceRecognitionOutcome.ambiguous,
        identityId: match.identityId,
        confidence: match.confidence,
        livenessPassed: true,
      );
      _state = FaceScanAmbiguous();
      notifyListeners();
      return;
    }

    // ── 3) Vaqtinchalik konsensus (§16) ──
    final update = _consensus.feed(
      identityId: match.identityId,
      ambiguous: false,
      confidence: match.confidence,
    );
    if (!update.isConfirmed) {
      _state = FaceScanConfirming(
        identityId: update.candidateIdentityId!,
        confidence: update.candidateConfidence!,
        confirmedFrames: update.confirmedFrames,
        requiredFrames: update.requiredFrames,
      );
      notifyListeners();
      return;
    }

    await _confirm(update);
  }

  Future<void> _confirm(ConfirmationUpdate update) async {
    final identityId = update.candidateIdentityId!;
    final confidence = update.candidateConfidence!;

    // ── 4) Cooldown (§19): o'sha identity yaqinda tasdiqlanganmi? ──
    final now = clock();
    final last = _lastIdentified;
    if (last != null &&
        last.identityId == identityId &&
        now.difference(last.at) < policy.recognitionCooldown) {
      _onResult(
        FaceRecognitionOutcome.identified,
        identityId: identityId,
        confidence: confidence,
        livenessPassed: true,
      );
      _state = FaceScanIdentified(
        identityId: identityId,
        confidence: confidence,
        cooldownActive: true,
      );
      notifyListeners();
      return;
    }

    final token = ++_identificationToken;
    final identified =
        FaceScanIdentified(identityId: identityId, confidence: confidence);

    _onResult(
      FaceRecognitionOutcome.identified,
      identityId: identityId,
      confidence: confidence,
      livenessPassed: true,
    );
    _state = identified;
    notifyListeners();

    final writer = attendanceWriter;
    if (writer == null) {
      _lastIdentified = (identityId: identityId, at: clock());
      return;
    }

    // Attendance qarorini page (attendance domeni) hal qiladi — natija
    // faqat o'sha identifikatsiya hali eng oxirgisi bo'lsa qo'llaniladi (§42).
    final outcome = await writer(identified);
    if (!_isCurrentToken(token)) return;
    _lastIdentified = (identityId: identityId, at: clock());
    _state = identified.withAttendance(outcome);
    notifyListeners();
  }

  // ── Yordamchilar ────────────────────────────────────────────────────

  Future<List<EnrolledFace>> _galleryOrLoad() async {
    if (_gallery != null) return _gallery!;
    try {
      final gallery = await loadGallery();
      _gallery = gallery;
      return gallery;
    } on Object {
      _state = const FaceScanFailed(
        error: GalleryUnavailableError(),
        retryable: true,
      );
      notifyListeners();
      rethrow;
    }
  }

  bool _isCurrent(int seq) => seq == _frameSequence;

  bool _isCurrentToken(int token) => token == _identificationToken;

  void _onResult(
    FaceRecognitionOutcome outcome, {
    String? identityId,
    double? confidence,
    bool? livenessPassed,
  }) {
    onResult?.call(FaceRecognitionResult(
      outcome: outcome,
      identityId: identityId,
      confidence: confidence,
      livenessPassed: livenessPassed,
      cameraSource: cameraSource,
      timestamp: clock(),
    ));
  }
}
