import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/features/face_recognition/application/commands/register_face_command.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/face_recognition/application/face_matcher.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/face_signature.dart';

import '../helpers/fake_repositories.dart';

/// D7 (biometric audit): bir xil yuz BOSHQA identity'ga enroll qilinmasligi
/// kerak; bir xil identity'ni qayta enroll qilish esa mumkin; aniq override
/// (`allowDuplicate`) dublikatga ruxsat beradi.
void main() {
  late FakeFaceRecognitionRepository faceRepo;
  late FakeIdentityRepository identityRepo;
  late RegisterFaceCommand command;

  /// 16 o'lchamli bir xil vektor — o'z-o'ziga cosine = 1.0.
  FaceSignature sig(List<double> v) =>
      FaceSignature(vector: v, source: 'test');

  // Turli yo'nalishdagi vektorlar — cosine 1.0 emas.
  final faceA = sig(List.generate(16, (i) => 0.1 + i * 0.01));
  // Almashinuvchi ishorali vektor — faceA ga ortogonal (cosine ≈ 0).
  final faceB = sig(List.generate(16, (i) => i.isEven ? 0.95 : -0.95));

  setUp(() {
    faceRepo = FakeFaceRecognitionRepository();
    identityRepo = FakeIdentityRepository();
    command = RegisterFaceCommand(
      repository: faceRepo,
      identityRepository: identityRepo,
      matcher: const FaceMatcher(
        matchThreshold: 0.92,
        ambiguousThreshold: 0.88,
      ),
      actorRole: UserRole.superAdmin,
    );
  });

  test('bir xil yuz boshqa identity\'ga enroll qilinmaydi (D7)', () async {
    // Identity A yuzi allaqachon bazada.
    await faceRepo.saveFace(
      identityId: 'M-EDU-2026-000001',
      signature: faceA,
      sampleCount: 5,
    );

    // Identity B — XUDDI SHU yuz bilan enroll qilmoqchi.
    await expectLater(
      command.execute(RegisterFaceRequest(
        identityId: 'M-EDU-2026-000002',
        signature: faceA,
        sampleCount: 5,
      )),
      throwsA(isA<DuplicateEnrollmentFailure>()),
    );

    // Yuz B'ga saqlanmadi — bitta yuz, bitta identity.
    expect(faceRepo.faces.keys, ['M-EDU-2026-000001']);
  });

  test('butunlay boshqa yuz enroll qilinishi mumkin', () async {
    await faceRepo.saveFace(
      identityId: 'M-EDU-2026-000001',
      signature: faceA,
      sampleCount: 5,
    );

    await command.execute(RegisterFaceRequest(
      identityId: 'M-EDU-2026-000002',
      signature: faceB,
      sampleCount: 5,
    ));

    expect(faceRepo.faces.containsKey('M-EDU-2026-000002'), isTrue);
  });

  test('bir xil identity\'ni qayta enroll qilish mumkin (yangilash)',
      () async {
    await faceRepo.saveFace(
      identityId: 'M-EDU-2026-000001',
      signature: faceA,
      sampleCount: 5,
    );

    // Xuddi shu identity uchun yangilangan namuna — dublikat EMAS.
    await command.execute(RegisterFaceRequest(
      identityId: 'M-EDU-2026-000001',
      signature: faceA,
      sampleCount: 8,
    ));
    expect(faceRepo.sampleCounts['M-EDU-2026-000001'], 8);
  });

  test('allowDuplicate=true aniq override bilan dublikat ruxsat etiladi',
      () async {
    await faceRepo.saveFace(
      identityId: 'M-EDU-2026-000001',
      signature: faceA,
      sampleCount: 5,
    );

    await command.execute(RegisterFaceRequest(
      identityId: 'M-EDU-2026-000002',
      signature: faceA,
      sampleCount: 5,
      allowDuplicate: true,
    ));
    expect(faceRepo.faces.containsKey('M-EDU-2026-000002'), isTrue);
  });

  test('noto\'g\'ri inputlar hali ham ValidationFailure tashlaydi', () async {
    await expectLater(
      command.execute(RegisterFaceRequest(
        identityId: '',
        signature: faceA,
        sampleCount: 5,
      )),
      throwsA(isA<ValidationFailure>()),
    );
    await expectLater(
      command.execute(RegisterFaceRequest(
        identityId: 'M-EDU-2026-000001',
        signature: const FaceSignature(vector: []),
        sampleCount: 5,
      )),
      throwsA(isA<ValidationFailure>()),
    );
  });
}
