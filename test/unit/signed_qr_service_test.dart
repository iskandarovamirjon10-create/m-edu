import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/features/identity/domain/services/signed_qr_codec.dart';
import 'package:m_edu/features/identity/infrastructure/datasources/isar_qr_nonce_store.dart';
import 'package:m_edu/features/identity/infrastructure/models/signed_qr_nonce_record.dart';
import 'package:m_edu/features/identity/infrastructure/services/signed_qr_service.dart';

import '../helpers/secure_storage_mock.dart';

/// P1.5: Signed QR — Ed25519 imzolash + verify zanjiri.
///
/// - valid: imzo to'g'ri, amal muddati ichida, replay emas.
/// - expired: amal muddati tugagan QR rad etiladi.
/// - invalidSignature: buzilgan imzo/payload rad etiladi.
/// - replay: bir marta ishlatilgan QR qayta skanerlanmaydi.
/// - malformed: oddiy student ID (imzolanmagan) rad etiladi.
/// - restart: kalit va nonce'lar Isar/secure storage'da saqlanadi.
void main() {
  late Directory tempDir;
  late Isar isar;
  late IsarQrNonceStore nonceStore;

  setUp(() async {
    secureStorageMock.clear();
    mockSecureStorageChannel();
    tempDir = await Directory.systemTemp.createTemp('m_edu_qr');
    isar = await Isar.open(
      [SignedQrNonceRecordSchema],
      directory: tempDir.path,
    );
    nonceStore = IsarQrNonceStore(isar);
  });

  tearDown(() async {
    await isar.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  SignedQrService service() => SignedQrService(nonceStore: nonceStore);

  test("issue → verify: valid + studentId to'g'ri (end-to-end)", () async {
    final qr = await service().issue('M-EDU-2026-000001');

    expect(qr, startsWith('M-EDU:V2~'),
        reason: "QR endi oddiy student ID emas — signed payload");

    final result = await service().verify(qr, DateTime.now().toUtc());
    expect(result.isValid, isTrue);
    expect(result.studentId, 'M-EDU-2026-000001');
  });

  test("oddiy student ID (imzolanmagan) — malformed rad etiladi", () async {
    final result = await service().verify(
      'M-EDU-2026-000001',
      DateTime.now().toUtc(),
    );
    expect(result.status, SignedQrVerificationStatus.malformed);
  });

  test("buzilgan payload (studentId o'zgartirilgan) — invalidSignature",
      () async {
    final qr = await service().issue('M-EDU-2026-000001');

    // Student ID'ni almashtirib, imzoni buzamiz.
    final tampered = qr.replaceFirst(
      'M-EDU-2026-000001',
      'M-EDU-2026-000099',
    );

    final result = await service().verify(tampered, DateTime.now().toUtc());
    expect(result.status, SignedQrVerificationStatus.invalidSignature);
  });

  test("amal muddati tugagan QR — expired", () async {
    final issuedAt = DateTime.utc(2026, 1, 1, 10);
    final qr = await service().issue(
      'M-EDU-2026-000001',
      now: issuedAt,
      validity: const Duration(hours: 1),
    );

    // Muddat ichida — valid.
    final within =
        await service().verify(qr, issuedAt.add(const Duration(minutes: 30)));
    expect(within.isValid, isTrue);

    // Muddat tugagach — expired.
    final after = await service()
        .verify(qr, issuedAt.add(const Duration(hours: 1, seconds: 1)));
    expect(after.status, SignedQrVerificationStatus.expired);
  });

  test("replay — bir marta ishlatilgan QR qayta ishlamaydi", () async {
    final qr = await service().issue('M-EDU-2026-000001');
    final now = DateTime.now().toUtc();

    final first = await service().verify(qr, now);
    expect(first.isValid, isTrue);

    // Xuddi shu QR (nonce bir xil) — replay rad etiladi.
    final second = await service().verify(qr, now);
    expect(second.status, SignedQrVerificationStatus.replay);
  });

  test("har bir issue yangi nonce — ikkita QR bir-biriga teng emas",
      () async {
    final a = await service().issue('M-EDU-2026-000001');
    final b = await service().issue('M-EDU-2026-000001');
    expect(a, isNot(equals(b)));
  });

  test("restart (yangi service, saqlangan kalit) — eski QR hali valid",
      () async {
    final qr = await service().issue('M-EDU-2026-000001');
    final now = DateTime.now().toUtc();

    // Kalit secure storage'da qoladi — yangi instansiya qayta foydalanadi
    // va ilgari chiqarilgan (hali ishlatilmagan) QR tekshirilib qoladi.
    // Eslatma: bitta QR faqat BIR marta verify bo'ladi (replay himoyasi),
    // shuning uchun bu yerda faqat bitta verify tekshiriladi.
    expect(
      (await SignedQrService(nonceStore: nonceStore).verify(qr, now)).isValid,
      isTrue,
      reason: "Restartdan keyin ham birinchi verify valid — kalit saqlanib qolgan",
    );
  });

  test("codec round-trip: encode → decode barcha maydonlarni qaytaradi", () {
    final issued = DateTime.utc(2026, 1, 1, 10);
    // 64-baytlik (Ed25519) yaroqli imzo — padding'li base64url ham ishlaydi.
    final signature = base64Url.encode(List<int>.filled(64, 7));
    expect(signature.length, 88, reason: "64 bayt → 88 belgi + padding");

    final encoded = SignedQrCodec.encode(
      studentId: 'M-EDU-2026-000001',
      issuedAt: issued,
      expiresAt: issued.add(const Duration(hours: 24)),
      nonce: 'MTIzNDU2Nzg5MDEyMzQ1Ng',
      signature: signature,
    );

    final decoded = SignedQrCodec.decode(encoded);
    expect(decoded, isNotNull);
    expect(decoded!.studentId, 'M-EDU-2026-000001');
    expect(decoded.issuedAt, issued);
    expect(decoded.expiresAt, issued.add(const Duration(hours: 24)));
    expect(decoded.signedData, contains('MTIzNDU2Nzg5MDEyMzQ1Ng'));
  });

  test("noto'g'ri format — decode null (malformed)", () {
    expect(SignedQrCodec.decode('random-string'), isNull);
    expect(SignedQrCodec.decode(''), isNull);
    expect(SignedQrCodec.decode('M-EDU:V2~only-two-parts'), isNull);
  });
}
