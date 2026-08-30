import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/features/identity/infrastructure/datasources/isar_identity_datasource.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/students/infrastructure/datasources/isar_student_datasource.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';

/// ────────────────────────────────────────────────────────────────────────────
/// PHASE 16 — STUDENT LIST SCALE (pagination)
///
/// "Avoid loading the entire student database into memory."
///
/// Datasource darajasida sintetik 1 000 talaba bilan tekshiriladi:
///  - findPage: faqat so'ralgan oyna qaytadi (offset/limit), tartib enrolledAt↓
///  - countAll: butun ro'yxatni yuklamasdan aniq son qaytaradi
///  - findByIds: faqat berilgan IDlar bo'yicha (browse'da ko'rinadigan
///    sahifa uchun, butun identity jadvali emas)
/// ────────────────────────────────────────────────────────────────────────────

List<CollectionSchema<dynamic>> _schemas() =>
    [StudentRecordSchema, IdentityRecordSchema];

void main() {
  late Directory tempDir;
  late Isar db;
  late IsarStudentDataSource studentDs;
  late IsarIdentityDataSource identityDs;

  const pageSize = 100;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_scale_test');
    db = await Isar.open(_schemas(), directory: tempDir.path);
    studentDs = IsarStudentDataSource(db);
    identityDs = IsarIdentityDataSource(db);

    // Sintetik 1 000 talaba — enrolledAt kamayish tartibi tekshiriladi.
    for (var i = 1; i <= 1000; i++) {
      final id = 'M-EDU-2026-${i.toString().padLeft(6, '0')}';
      await db.writeTxn(() async {
        await db.studentRecords.put(StudentRecord()
          ..identityId = id
          ..studentNumber = i
          ..studentStatus = i % 10 == 0 ? 'frozen' : 'active'
          ..transferStatus = 'none'
          ..paymentStatus = false
          ..totalPaid = 0
          ..enrolledAt = DateTime(2026, 8, 1).add(Duration(minutes: i)));
        await db.identityRecords.put(IdentityRecord()
          ..identityId = id
          ..firstName = 'Student'
          ..lastName = '$i'
          ..role = 'student'
          ..status = 'active'
          ..qrSeed = 'seed-$id'
          ..createdAt = DateTime(2026, 8, 1).add(Duration(minutes: i)));
      });
    }
  });

  tearDown(() async {
    await db.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test("countAll — butun ro'yxatni yuklamasdan aniq son", () async {
    final count = await studentDs.countAll();
    expect(count, 1000);
  });

  test("findPage — faqat so'ralgan oyna qaytadi (offset/limit)", () async {
    final page = await studentDs.findPage(offset: 0, limit: pageSize);
    expect(page.length, pageSize);

    // Ikkinchi sahifa birinchi sahifani takrorlamaydi.
    final page2 = await studentDs.findPage(offset: pageSize, limit: pageSize);
    expect(page2.length, pageSize);
    final ids1 = page.map((r) => r.identityId).toSet();
    final ids2 = page2.map((r) => r.identityId).toSet();
    expect(ids1.intersection(ids2), isEmpty);
  });

  test("findPage — enrolledAt kamayish tartibida (eng yangi birinchi)",
      () async {
    final page = await studentDs.findPage(offset: 0, limit: pageSize);
    for (var i = 0; i < page.length - 1; i++) {
      expect(
        page[i].enrolledAt.isAfter(page[i + 1].enrolledAt),
        isTrue,
        reason: 'Sahifa ichida enrolledAt kamayish tartibi buzildi',
      );
    }
    // Eng yangi yozuv (enrolledAt maksimal) birinchi keladi.
    expect(page.first.enrolledAt.isAfter(page.last.enrolledAt), isTrue);
  });

  test("findPage — oxirgi sahifa qisqa bo'lishi mumkin, chegaradan oshmaydi",
      () async {
    final lastPage = await studentDs.findPage(offset: 950, limit: pageSize);
    expect(lastPage.length, 50);
    final beyond = await studentDs.findPage(offset: 1000, limit: pageSize);
    expect(beyond, isEmpty);
  });

  test("findByIds — faqat so'ralgan IDlar qaytadi (butun jadval emas)",
      () async {
    // Ko'rinadigan sahifadagi 100 talabaning IDlari (browse oqimi).
    final visible = await studentDs.findPage(offset: 0, limit: pageSize);
    final ids = visible.map((r) => r.identityId).toList();

    final identities = await identityDs.findByIds(ids);
    expect(identities.length, pageSize);
    final returnedIds = identities.map((r) => r.identityId).toSet();
    expect(returnedIds, ids.toSet());
  });

  test("findByIds — bo'sh ro'yxat tez qaytadi (hech qanday so'rov emas)",
      () async {
    final identities = await identityDs.findByIds(const []);
    expect(identities, isEmpty);
  });
}
