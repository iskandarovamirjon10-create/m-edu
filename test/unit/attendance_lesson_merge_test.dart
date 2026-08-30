import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/features/attendance/infrastructure/datasources/isar_attendance_datasource.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';

/// P0-02: `putUpsert` lesson-instance darajasida merge qiladi.
///
/// Real Isar bilan — datasource darajasidagi invariantlar tekshiriladi:
/// - 1 talaba + 1 dars = 1 primary yozuv (bir kunda ikki dars — ikki yozuv).
/// - Bitta darsga qayta belgilash — merge (check-in/check-out).
/// - Legacy (V2, lessonId null) kundalik yozuv dars bilan yangilanadi.
/// - lessonId restart (DB qayta ochilishi)dan keyin saqlanadi.
void main() {
  late Directory tempDir;
  late Isar isar;
  late IsarAttendanceDataSource datasource;

  const studentId = 'M-EDU-2026-000001';
  // 2026-08-10 — dushanba.
  final date = DateTime(2026, 8, 10);

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_att_lesson');
    isar = await Isar.open([AttendanceRecordSchema], directory: tempDir.path);
    datasource = IsarAttendanceDataSource(isar);
  });

  tearDown(() async {
    await isar.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  AttendanceRecord lessonRecord(
    String lessonId, {
    required DateTime checkIn,
    DateTime? checkOut,
  }) {
    return AttendanceRecord()
      ..identityId = studentId
      ..timestamp = checkIn
      ..attendanceDate = date
      ..lessonId = lessonId
      ..checkInAt = checkIn
      ..checkOutAt = checkOut
      ..fullName = 'Ali Valiyev'
      ..role = 'student'
      ..method = 'face'
      ..status = 'present';
  }

  test('bir kunda ikkita dars — ikkita alohida primary yozuv', () async {
    final math =
        lessonRecord('LESSON-SCH-1-20260810', checkIn: DateTime(2026, 8, 10, 9));
    final english =
        lessonRecord('LESSON-SCH-2-20260810', checkIn: DateTime(2026, 8, 10, 14));

    await datasource.putUpsert(math);
    await datasource.putUpsert(english);

    final all = await isar.attendanceRecords.where().findAll();
    expect(all, hasLength(2));
    expect(
      all.map((r) => r.lessonId).toSet(),
      {'LESSON-SCH-1-20260810', 'LESSON-SCH-2-20260810'},
      reason: "Har dars o'z yozuviga ega — bir-biriga qo'shilmaydi",
    );
  });

  test('bitta darsga qayta belgilash — merge (check-in + check-out)', () async {
    await datasource.putUpsert(
      lessonRecord('L1', checkIn: DateTime(2026, 8, 10, 9)),
    );
    // Dars ichidagi ikkinchi belgilash (check-out) — dublikat emas.
    await datasource.putUpsert(
      lessonRecord(
        'L1',
        checkIn: DateTime(2026, 8, 10, 10, 20),
        checkOut: DateTime(2026, 8, 10, 10, 20),
      ),
    );

    final all = await isar.attendanceRecords.where().findAll();
    expect(all, hasLength(1));
    expect(all.single.checkInAt, DateTime(2026, 8, 10, 9),
        reason: 'Eng erta kirish saqlanadi');
    expect(all.single.checkOutAt, DateTime(2026, 8, 10, 10, 20));
    expect(all.single.lessonId, 'L1');
  });

  test('legacy kundalik yozuv dars bilan yangilanadi (upgrade)', () async {
    // V2: lessonId'siz kundalik yozuv.
    final legacy = AttendanceRecord()
      ..identityId = studentId
      ..timestamp = DateTime(2026, 8, 10, 8, 55)
      ..attendanceDate = date
      ..checkInAt = DateTime(2026, 8, 10, 8, 55)
      ..fullName = 'Ali Valiyev'
      ..role = 'student'
      ..method = 'manual';
    await datasource.putUpsert(legacy);

    // Dars aniqlangan belgilash — legacy yozuvga qo'shiladi, dublikat emas.
    await datasource.putUpsert(
      lessonRecord('L1', checkIn: DateTime(2026, 8, 10, 9)),
    );

    final all = await isar.attendanceRecords.where().findAll();
    expect(all, hasLength(1), reason: "Ikkita yozuv paydo bo'lmaydi");
    expect(all.single.lessonId, 'L1');
    expect(all.single.checkInAt, DateTime(2026, 8, 10, 8, 55),
        reason: 'Legacy check-in saqlanib qoladi');
  });

  test('V1 legacy yozuv (attendanceDate null) dars bilan yangilanadi',
      () async {
    // V1: faqat timestamp, attendanceDate null (migratsiyadan oldingi holat).
    final v1 = AttendanceRecord()
      ..identityId = studentId
      ..timestamp = DateTime(2026, 8, 10, 8, 55)
      ..checkInAt = DateTime(2026, 8, 10, 8, 55)
      ..fullName = 'Ali Valiyev'
      ..role = 'student'
      ..method = 'manual';
    await isar.writeTxn(() => isar.attendanceRecords.put(v1));

    // Dars aniqlangan belgilash — V1 yozuv topilib, yangilanadi.
    await datasource.putUpsert(
      lessonRecord('L1', checkIn: DateTime(2026, 8, 10, 9)),
    );

    final all = await isar.attendanceRecords.where().findAll();
    expect(all, hasLength(1), reason: "V1 yozuvga qo'shiladi, dublikat emas");
    expect(all.single.lessonId, 'L1');
    expect(all.single.attendanceDate, date,
        reason: 'Lesson upsert attendanceDate ni to\'ldiradi');
  });

  test('findByLesson — dars bo\'yicha barcha yozuvlar (faqat o\'sha dars)',
      () async {
    // Dushanba kuni ikkita dars — ikkita yozuv.
    await datasource.putUpsert(
      lessonRecord('L1', checkIn: DateTime(2026, 8, 10, 9)),
    );
    await datasource.putUpsert(
      lessonRecord('L2', checkIn: DateTime(2026, 8, 10, 14)),
    );
    // Legacy kundalik yozuv (lessonId null) — dars ro'yxatiga kirmaydi.
    final legacy = AttendanceRecord()
      ..identityId = studentId
      ..timestamp = DateTime(2026, 8, 10, 8, 55)
      ..attendanceDate = date
      ..checkInAt = DateTime(2026, 8, 10, 8, 55)
      ..fullName = 'Ali Valiyev'
      ..role = 'student'
      ..method = 'manual';
    await datasource.putUpsert(legacy);

    final l1 = await datasource.findByLesson('L1');
    final l2 = await datasource.findByLesson('L2');
    final missing = await datasource.findByLesson('NONE');

    expect(l1, hasLength(1));
    expect(l1.single.lessonId, 'L1');
    expect(l2, hasLength(1));
    expect(l2.single.lessonId, 'L2');
    expect(missing, isEmpty, reason: "Boshqa dars yozuvlari aralashmaydi");
  });

  test('lessonId restartdan keyin saqlanadi', () async {
    await datasource.putUpsert(
      lessonRecord('L1', checkIn: DateTime(2026, 8, 10, 9)),
    );

    // App qayta ishga tushdi — DB qayta ochiladi.
    await isar.close();
    isar = await Isar.open([AttendanceRecordSchema], directory: tempDir.path);
    datasource = IsarAttendanceDataSource(isar);

    final found = await datasource.findByStudentAndLesson(studentId, 'L1');
    expect(found, isNotNull);
    expect(found!.lessonId, 'L1');
    expect(found.checkInAt, DateTime(2026, 8, 10, 9));
  });
}
