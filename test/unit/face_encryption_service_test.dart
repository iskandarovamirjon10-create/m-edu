import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/face_recognition/infrastructure/services/face_encryption_service.dart';

import '../helpers/secure_storage_mock.dart';

/// AUDIT P0-01: AES-GCM authentication tag (MAC) saqlanishi va decrypt'da
/// ishlatilishi. Oldingi implementatsiya tag'ni tashlab yuborardi va
/// `Mac.empty` bilan ochishga urinardi — decrypt doim muvaffaqiyatsiz
/// bo'lib, yuz bazasi hech qachon o'qilmasdi.
void main() {
  setUp(() {
    secureStorageMock.clear();
    mockSecureStorageChannel();
  });

  test('encrypt → decrypt round-trip asl vektorni qaytaradi', () async {
    final service = FaceEncryptionService();
    final vector = [0.12, -0.34, 0.56, 1.0, -1.0, 0.0];

    final blob = await service.encrypt(vector);
    final decrypted = await service.decrypt(blob);

    expect(decrypted, isNotNull);
    expect(decrypted, vector);
  });

  test('saqlangan blob tarkibida haqiqiy MAC/tag bor (nonce+ciphertext+mac)',
      () async {
    final service = FaceEncryptionService();
    final blob = await service.encrypt([0.5, -0.5]);

    // Format: 12 bayt nonce + ciphertext + 16 bayt MAC.
    expect(blob.length, greaterThan(12 + 16));

    final mac = blob.sublist(blob.length - 16);
    // Tag nol baytlar emas — haqiqiy authentication tag saqlangan
    // (bo'sh tag bilan oldingi bug'li holatni aniqlaydi).
    expect(mac.any((b) => b != 0), isTrue);
  });

  test('MAC buzilgan blob decrypt bo\'lmaydi — null qaytadi', () async {
    final service = FaceEncryptionService();
    final blob = await service.encrypt([0.1, 0.2, 0.3]);

    final tampered = Uint8List.fromList(blob);
    // Oxirgi (MAC) baytni buzamiz.
    tampered[tampered.length - 1] ^= 0xFF;

    expect(await service.decrypt(tampered), isNull);
  });

  test('ciphertext buzilgan blob ham rad etiladi (integrity)', () async {
    final service = FaceEncryptionService();
    final blob = await service.encrypt([0.1, 0.2]);

    final tampered = Uint8List.fromList(blob);
    // ciphertext hududidagi bayt (nonce 0..11 dan keyin).
    tampered[13] ^= 0x01;

    expect(await service.decrypt(tampered), isNull);
  });

  test('MAC saqlanmagan eski (buzuq) format — null qaytadi, xato tashlamaydi',
      () async {
    final service = FaceEncryptionService();
    final blob = await service.encrypt([0.1, 0.2]);

    // Eski H-03 formatini simulyatsiya qilamiz: tag'ni olib tashlash.
    final legacy = Uint8List.fromList(blob.sublist(0, blob.length - 16));
    expect(await service.decrypt(legacy), isNull);
  });

  test('bo\'sh / haddan tashqari qisqa blob — null qaytadi', () async {
    final service = FaceEncryptionService();

    expect(await service.decrypt(Uint8List(0)), isNull);
    // 12+16 dan kichik — nonce+mac yetmaydi.
    expect(await service.decrypt(Uint8List(20)), isNull);
  });

  test('yangi service instansiyasi (qayta ishga tushish) eski blobni ochadi',
      () async {
    final first = FaceEncryptionService();
    final blob = await first.encrypt([0.42, -0.42, 0.99]);

    // Key secure storage'da qoladi — yangi instansiya qayta foydalanadi
    // va ilgari enroll qilingan yuzlar o'qilib qoladi.
    final second = FaceEncryptionService();
    expect(await second.decrypt(blob), [0.42, -0.42, 0.99]);
  });

  test('har bir encrypt yangi nonce ishlatadi — bloblar farq qiladi', () async {
    final service = FaceEncryptionService();
    final vector = [0.25, -0.25];

    final first = await service.encrypt(vector);
    final second = await service.encrypt(vector);

    // Bir xil vektor ikki marta shifrlansa ham nonce tasodifiy —
    // chiqish baytlari bir xil bo'lmasligi kerak (replay/precomputation
    // hujumlariga qarshi).
    expect(first, isNot(equals(second)));
  });

  test('key o\'zgarganda eski blob rad etiladi — null qaytadi (AUDIT #16)',
      () async {
    final first = FaceEncryptionService();
    final blob = await first.encrypt([0.1, 0.2]);

    // Kalit almashtirilgan holatni simulyatsiya qilamiz: secure storage'dagi
    // key'ni boshqa tasodifiy 32 baytga yozamiz.
    secureStorageMock['m_edu_face_encryption_key'] =
        base64Encode(List<int>.generate(32, (i) => i));

    final second = FaceEncryptionService();
    expect(await second.decrypt(blob), isNull);
  });
}
