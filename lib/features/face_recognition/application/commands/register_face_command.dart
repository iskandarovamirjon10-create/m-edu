import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../../identity/domain/entities/identity_activity.dart';
import '../../../identity/domain/repositories/identity_repository.dart';
import '../../domain/repositories/face_recognition_repository.dart';
import '../../domain/value_objects/face_signature.dart';
import '../face_matcher.dart';

/// Yuz namunasi ro'yxatga olish so'rovi.
class RegisterFaceRequest {
  final String identityId;
  final FaceSignature signature;
  final int sampleCount;

  /// D7: dublikat yuz enroll'ini ANIQ override qilish (admin qarori).
  /// Default false — bir xil yuz boshqa identity'da bo'lsa rad etiladi.
  final bool allowDuplicate;

  const RegisterFaceRequest({
    required this.identityId,
    required this.signature,
    required this.sampleCount,
    this.allowDuplicate = false,
  });
}

/// Yuzni Face ID bazasiga qo'shish/yangilash komandasi.
class RegisterFaceCommand {
  final FaceRecognitionRepository _repository;
  final IdentityRepository _identityRepository;

  /// D7: dublikat enroll tekshiruvi uchun matcher (policy thresholdlar).
  final FaceMatcher _matcher;

  /// RBAC (AUDIT P2-02): yuz yozish — o'quvchilar boshqaruvi.
  final UserRole actorRole;

  RegisterFaceCommand({
    required FaceRecognitionRepository repository,
    required IdentityRepository identityRepository,
    FaceMatcher? matcher,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _identityRepository = identityRepository,
        _matcher = matcher ?? const FaceMatcher();

  Future<void> execute(RegisterFaceRequest request) async {
    Permissions.require(actorRole, AppPermission.faceIdUse);

    if (request.identityId.isEmpty) {
      throw const ValidationFailure('Identity ID bo\'sh bo\'lmasligi kerak');
    }
    if (request.signature.isEmpty || request.signature.vector.length < 8) {
      throw const ValidationFailure(
        'Yuz namunasi yetarli emas — yuzni yaxshiroq ko\'rsatib qayta urinib ko\'ring',
      );
    }
    if (request.sampleCount < 1) {
      throw const ValidationFailure('Namunalar soni noto\'g\'ri');
    }

    // D7 (biometric audit): bir xil shaxs ikki identity'ga enroll qilinmasin.
    // Boshqa identity'larga tegishli yuzlar bilan solishtiramiz — mos chiqsa
    // dublikat enroll (identity confusion / soxta ikkinchi hisob xavfi).
    // Aniq override (`allowDuplicate`) faqat admin qarori bilan.
    if (!request.allowDuplicate) {
      final existing =
          await _repository.findAllFaces();
      final others = existing
          .where((f) => f.identityId != request.identityId)
          .toList();
      if (others.isNotEmpty) {
        final match = _matcher.findBestMatch(request.signature, others);
        if (match != null &&
            !match.ambiguous &&
            match.confidence >= _matcher.matchThreshold) {
          throw DuplicateEnrollmentFailure(
            'Bu yuz allaqachon ${match.identityId} identity\'siga ro\'yxatga '
            'olingan (o\'xshashlik: ${(match.confidence * 100).toStringAsFixed(1)}%). '
            'Bir shaxs ikki hisobga enroll qilinmaydi — dublikat bo\'lsa, '
            'identity\'larni birlashtiring.',
          );
        }
      }
    }

    await _repository.saveFace(
      identityId: request.identityId,
      signature: request.signature,
      sampleCount: request.sampleCount,
    );

    // Audit-log: yuz namunasi yangilandi/qo'shildi (Activity Timeline).
    // Audit xatosi yuzni saqlashga ta'sir qilmasligi kerak (best-effort).
    try {
      await _identityRepository.recordActivity(
        IdentityActivity(
          identityId: request.identityId,
          type: IdentityActivityTypes.faceEnrolled,
          description:
              'Yuz namunasi saqlandi — ${request.sampleCount} ta namunadan (${request.signature.source})',
          occurredAt: DateTime.now(),
        ),
      );
    } catch (_) {
      // audit yozuvi muhim emas — yuz bazasi saqlangan.
    }
  }
}
