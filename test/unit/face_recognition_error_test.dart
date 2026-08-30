import 'package:flutter_test/flutter_test.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/features/face_recognition/domain/errors/face_recognition_error.dart';

/// Xatolik taksonomiyasi (spec §34) — har bir nosozlik toifalangan va
/// foydalanuvchi tilida tushunarli; stack trace hech qachon UI'ga chiqmaydi.
void main() {
  group('FaceRecognitionError (spec §34)', () {
    test('har bir toifa o\'zining tushunarli xabariga ega', () {
      const errors = <FaceRecognitionError>[
        CameraPermissionDeniedError(),
        CameraUnavailableError(),
        NoFaceDetectedError(),
        MultipleFacesDetectedError(),
        FaceQualityInsufficientError(),
        FacePoseInvalidError(),
        LivenessFailedError(),
        EmbeddingGenerationFailedError(),
        GalleryUnavailableError(),
        IdentityAmbiguousError(),
        IdentityUnknownError(),
        RecognitionTimeoutError(),
        BiometricStorageUnavailableError(),
        ModelUnavailableError(),
        UnsupportedPlatformError(),
      ];
      for (final error in errors) {
        expect(error.userMessage, isNotEmpty,
            reason: '${error.runtimeType} xabari bo\'sh bo\'lmasligi kerak');
        // Hech qanday stack trace / runtimeType xabarga kirmaydi.
        expect(error.userMessage.contains('Exception'), isFalse);
        expect(error.userMessage.contains(error.runtimeType.toString()), isFalse);
      }
    });

    test('toFailure: kamera xatolari CameraFailure ga moslanadi', () {
      expect(const CameraPermissionDeniedError().toFailure(),
          isA<CameraFailure>());
      expect(const CameraUnavailableError().toFailure(), isA<CameraFailure>());
    });

    test('toFailure: qolganlari FaceRecognitionFailure ga moslanadi', () {
      expect(const LivenessFailedError().toFailure(),
          isA<FaceRecognitionFailure>());
      expect(const IdentityUnknownError().toFailure(),
          isA<FaceRecognitionFailure>());
      expect(const GalleryUnavailableError().toFailure(),
          isA<FaceRecognitionFailure>());
    });

    test('userFriendlyMessage raw exception ni oshkor qilmaydi', () {
      final message =
          userFriendlyMessage(StateError('internal stack detail: /secret'));
      expect(message.contains('internal stack detail'), isFalse);
    });

    test('qo\'shimcha kontekst xabarlari saqlanadi', () {
      const error = CameraUnavailableError('Kamera 192.168.1.64 ga ulana olmadi');
      expect(error.userMessage, contains('192.168.1.64'));
    });
  });
}
