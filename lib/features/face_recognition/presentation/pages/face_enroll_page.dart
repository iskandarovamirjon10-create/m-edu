import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/error/failures.dart';
import '../../../../design/design.dart';
import '../../../../shared/design_system/app/app_card.dart';
import '../../../identity/presentation/providers/identity_providers.dart';
import '../../../settings/presentation/providers/settings_providers.dart';
import '../../application/commands/register_face_command.dart';
import '../../domain/services/liveness_service.dart';
import '../../domain/value_objects/face_signature.dart';
import '../../infrastructure/services/camera_source.dart';
import '../../infrastructure/services/face_quality_gate.dart';
import '../../infrastructure/services/face_vision_engine.dart';
import '../providers/face_recognition_providers.dart';
import '../widgets/face_camera_view.dart';


/// Yuzni ro'yxatga olish (enrollment) sahifasi.
///
/// Kamera oldida bir nechta namunani avtomatik oladi, o'rtachalashtiradi
/// va identity uchun Face ID bazasiga saqlaydi.
class FaceEnrollPage extends ConsumerStatefulWidget {
  final String identityId;

  const FaceEnrollPage({super.key, required this.identityId});

  @override
  ConsumerState<FaceEnrollPage> createState() => _FaceEnrollPageState();
}

class _FaceEnrollPageState extends ConsumerState<FaceEnrollPage> {
  /// Namunalar soni va konsistensiya chegarasi [BiometricPolicy] dan keladi
  /// (spec §9 — yagona manba, sehrli sonlar yo'q).
  late int _targetSamples;

  /// H-05: Namunalar bir xil shaxsga tegishli ekanini tekshirish uchun
  /// minimal kosinus o'xshashlik. Boshqa odam kirsa (masalan kamera
  /// oldida navbatda turib almashilsa) uning namunasi rad etiladi.
  ///
  /// Bu qiymat matcher'ning ambiguousThreshold'idan past — enroll
  /// vaqtida tolerant bo'lamiz (bir xil odamning kichik o'zgarishlari),
  /// lekin butunlay boshqa odamni o'tkazmaymiz.
  late double _minSampleSimilarity;

  final List<FaceSignature> _samples = [];
  bool _running = false;
  bool _saving = false;
  String? _message;
  int _nullFrames = 0;
  CameraSource? _cameraSource;

  /// H-05: Rad etilgan namunalar soni (foydalanuvchiga ko'rsatish uchun).
  int _rejectedSamples = 0;

  /// H-05: Oxirgi rad etish haqida xabar ko'rsatilgan vaqt — xabar
  /// spam bo'lib ketmasligi uchun.
  DateTime? _lastRejectionNotice;

  /// GAPS-G5: jonlilik gate'i — enroll faqat jonli yuzdan qabul qilinadi
  /// (fotosuratdan enroll qilib bo'lmaydi).
  LivenessService? _liveness;

  @override
  void initState() {
    super.initState();
    final policy = ref.read(biometricPolicyProvider);
    _targetSamples = policy.enrollmentTargetSamples;
    _minSampleSimilarity = policy.enrollmentMinSampleSimilarity;
    WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void dispose() {
    _running = false;
    _cameraSource?.dispose();
    _cameraSource = null;
    super.dispose();
  }

  /// H-05: Yangi namunani qabul qilish mumkinmi?
  ///
  /// Birinchi namunadan so'ng har bir yangi namuna birinchi namunaga
  /// qiyoslanadi — o'xshashlik juda past bo'lsa, bu boshqa odam yoki
  /// ishonchsiz kadr, rad etiladi.
  bool _acceptSample(FaceSignature candidate) {
    if (_samples.isEmpty) return true;
    final reference = _samples.first;
    final similarity = reference.cosineSimilarity(candidate);
    return similarity >= _minSampleSimilarity;
  }

  /// Foydalanuvchiga vaqtincha xabar ko'rsatadi (spam bo'lib ketmasligi
  /// uchun 3 soniya throttle).
  void _showNotice(String message) {
    final now = DateTime.now();
    if (_lastRejectionNotice != null &&
        now.difference(_lastRejectionNotice!) < const Duration(seconds: 3)) {
      return;
    }
    _lastRejectionNotice = now;
    if (!mounted) return;
    setState(() => _message = message);
  }

  Future<void> _start() async {
    // P0 FIX: Use CameraSourceFactory instead of hardcoded RTSP.
    // This allows enrollment via Android device camera, USB webcam,
    // or Hikvision RTSP — whichever is available on the platform.
    _cameraSource = ref.read(cameraSourceProvider);
    
    if (!_cameraSource!.isAvailable) {
      setState(() => _message = 'Kamera mavjud emas — sozlamalarni tekshiring');
      return;
    }

    if (!FaceVisionEngine.isSupportedOnPlatform) {
      setState(
          () => _message = 'Yuz tanish bu platformada qo\'llab-quvvatlanmaydi');
      return;
    }

    try {
      await _cameraSource!.open();
    } catch (e) {
      final msg = e is CameraException ? e.message : 'Kameraga ulanishda xatolik';
      setState(() => _message = msg);
      return;
    }

    // GAPS-G5: yangi enroll sessiyasi — liveness kuzatuvini tozalaymiz.
    _liveness?.reset();
    _liveness = null;
    _running = true;
    unawaited(_captureLoop());
  }

  Future<void> _captureLoop() async {
    final intervalMs =
        ref.read(appSettingsProvider).valueOrNull?.scanIntervalMs ?? 1200;
    final engine = ref.read(faceVisionEngineProvider);

    while (mounted && _running && _samples.length < _targetSamples) {
      final source = _cameraSource;
      if (source == null || !source.isStreaming) break;
      final frame = await source.captureFrame();
      if (frame == null) {
        // Kamera kadr bermayapti — uzoq vaqt kutib qolmaslik uchun.
        _nullFrames++;
        if (_nullFrames > 10) {
          if (mounted) {
            setState(() =>
                _message = 'Kameradan kadr olinmayapti — oqimni tekshiring');
          }
          _running = false;
          break;
        }
      } else {
        _nullFrames = 0;
        final outcome = await engine.analyze(frame);
        switch (outcome) {
          case NoFaceOutcome():
            // Yuz yo'q — kadr o'tkazib yuboriladi.
            break;
          case EngineUnavailableOutcome(:final reason):
            // Dvigatel modeli yuklanmagan — enroll to'xtatiladi.
            _showNotice(reason);
            _running = false;
            break;
          case MultipleFacesOutcome():
            // spec §3: 2+ yuz — enroll davom ettirilmaydi.
            _showNotice(
              'Iltimos, faqat bitta shaxs ko\'rinishiga ishonch hosil qiling',
            );
          case FaceRejectedOutcome(:final issues):
            // spec §4: sifat gate'idan o'tmadi — embedding olinmaydi.
            final reason = issues.isEmpty
                ? 'Yuz sifati yetarli emas'
                : issues.map(faceQualityIssueLabel).join(', ');
            _showNotice('Yuz sifati yetarli emas — $reason');
          case FaceDetectedOutcome(:final observation):
            if (!observation.signature.isEmpty) {
              // GAPS-G5: enroll faqat jonlilik tasdiqlangach qabul qilinadi
              // (foto/ekran replay'idan yuz enrol qilib bo'lmaydi).
              final liveness = _liveness ??=
                  LivenessService(config: ref.read(faceLivenessConfigProvider));
              final snap = liveness.feed(observation.eyeOpenness);
              if (snap.status != LivenessStatus.live) {
                _showNotice(snap.message);
                if (snap.status == LivenessStatus.timedOut) {
                  liveness.reset();
                }
                break;
              }
              // H-05: Namuna bir xil shaxsga tegishli bo'lishi shart.
              if (!_acceptSample(observation.signature)) {
                _rejectedSamples++;
                _showNotice(
                  'Yuz bir xil emas — kamera oldida bitta shaxs turing. '
                  'Rad etilgan namunalar: $_rejectedSamples',
                );
              } else {
                _rejectedSamples = 0;
                if (!mounted) return;
                setState(() {
                  _samples.add(observation.signature);
                  if (_message != null && _samples.isNotEmpty) {
                    _message = null;
                  }
                });
              }
            }
        }
      }
      await Future<void>.delayed(Duration(milliseconds: intervalMs));
    }

    if (mounted && _samples.isNotEmpty) {
      unawaited(_save());
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final signature = FaceSignature.mean(_samples);
      await ref.read(registerFaceCommandProvider).execute(
            RegisterFaceRequest(
              identityId: widget.identityId,
              signature: signature,
              sampleCount: _samples.length,
            ),
          );
      ref.read(faceVersionProvider.notifier).state++;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text('Yuz namunasi saqlandi (${_samples.length} ta namunadan)'),
          backgroundColor: context.dsColors.success,
        ),
      );
      context.pop();
    } on Failure catch (failure) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(failure.message),
          backgroundColor: context.dsColors.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cameraSource = ref.watch(cameraSourceProvider);
    final identity =
        ref.watch(identityDetailProvider(widget.identityId)).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text('Yuz namunasi'),
        actions: [
          if (_samples.isNotEmpty)
            IconButton(
              tooltip: 'Qayta boshlash',
              icon: Icon(Icons.refresh),
              onPressed: () => setState(() {
                _samples.clear();
                _running = true;
                unawaited(_captureLoop());
              }),
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      identity?.fullName ?? widget.identityId,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: context.dsColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Yuzingizni kamera oldida frontal ushlab turing. '
                      '5 ta namunani avtomatik olamiz.',
                      style: TextStyle(
                        fontSize: 13,
                        color: context.dsColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 16),
              if (!cameraSource.isAvailable)
                AppCard(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text(
                        cameraSource.displayName,
                        style:
                            TextStyle(color: context.dsColors.textSecondary),
                      ),
                    ),
                  ),
                )
              else ...[
                AspectRatio(
                  aspectRatio: 4 / 3,
                  child: FaceCameraView(
                    service: ref.watch(cameraStreamServiceProvider),
                    overlay: _buildOverlay(),
                  ),
                ),
                SizedBox(height: 16),
                _buildProgress(),
              ],
              if (_message != null) ...[
                SizedBox(height: 16),
                Text(
                  _message!,
                  style: TextStyle(color: context.dsColors.error, fontSize: 13),
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOverlay() {
    return Center(
      child: Container(
        width: 180,
        height: 220,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.cyanAccent, width: 2.5),
          color: Colors.cyanAccent.withValues(alpha: 0.06),
        ),
        child: Icon(
          Icons.face_retouching_natural,
          size: 72,
          color: Colors.white54,
        ),
      ),
    );
  }

  Widget _buildProgress() {
    final progress = _samples.length / _targetSamples;
    return AppCard(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Namunalar',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: context.dsColors.textPrimary,
                ),
              ),
              Text(
                '${_samples.length} / $_targetSamples',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: context.dsColors.accent,
                ),
              ),
            ],
          ),
          SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              backgroundColor: context.dsColors.accent.withValues(alpha: 0.12),
              valueColor: AlwaysStoppedAnimation(context.dsColors.accent),
            ),
          ),
          SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(_targetSamples, (i) {
              final done = i < _samples.length;
              return Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: done
                      ? context.dsColors.success
                      : context.dsColors.border.withValues(alpha: 0.3),
                ),
                child: Icon(
                  done ? Icons.check : Icons.person_outline,
                  size: 18,
                  color: done ? Colors.white : context.dsColors.textTertiary,
                ),
              );
            }),
          ),
          if (_saving) ...[
            SizedBox(height: 14),
            const Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
