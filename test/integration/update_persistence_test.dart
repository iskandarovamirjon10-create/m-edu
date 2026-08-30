import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/features/groups/infrastructure/datasources/isar_group_datasource.dart';
import 'package:m_edu/features/groups/infrastructure/models/group_record.dart';
import 'package:m_edu/features/identity/infrastructure/datasources/isar_identity_datasource.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/datasources/isar_schedule_datasource.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/room_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/schedule_record.dart';
import 'package:m_edu/features/settings/infrastructure/datasources/isar_settings_datasource.dart';
import 'package:m_edu/features/settings/infrastructure/models/subject_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/user_record.dart';
import 'package:m_edu/features/students/infrastructure/datasources/isar_student_datasource.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';
import 'package:m_edu/features/teachers/infrastructure/datasources/isar_teacher_datasource.dart';
import 'package:m_edu/features/teachers/infrastructure/models/teacher_record.dart';

// ────────────────────────────────────────────────────────────────────────────
// SYSTEMIC UPDATE FIX regressiya testi (real Isar, diskda).
//
// Oldingi xato: entity-based update `_toRecord(entity)` yangi record yaratadi
// (id = autoIncrement 0), Isar `put` esa INSERT qilardi — unique index
// buzilardi ("Unique index violated") yoki dublikat qator paydo bo'lardi.
// Tuzatish: datasource `update()` mavjud yozuvni biznes-kalit bo'yicha topib,
// uning Isar id'sini saqlaydi va REPLACE qiladi.
//
// Ushbu test har bir ta'sirlangan collection uchun:
//   insert → update (yangi record orqali) → yana update →
//   javonda hali HAM bitta qator va yangilangan qiymat.
// ────────────────────────────────────────────────────────────────────────────

/// Ushbu test faqat tegadigan collection'lar (update id-saqlash semantikasi).
List<CollectionSchema<dynamic>> _allSchemas() => [
      StudentRecordSchema,
      GroupRecordSchema,
      IdentityRecordSchema,
      TeacherRecordSchema,
      ScheduleRecordSchema,
      RoomRecordSchema,
      UserRecordSchema,
      SubjectRecordSchema,
    ];

void main() {
  late Directory tempDir;
  late Isar db;
  var dbCounter = 0;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_upd_test');
    db = await Isar.open(
      _allSchemas(),
      name: 'm_edu_update_${dbCounter++}',
      directory: tempDir.path,
    );
  });

  tearDown(() async {
    await db.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  test("Student update — id saqlanadi, dublikat YO'Q, unique index buzilmaydi",
      () async {
    final ds = IsarStudentDataSource(db);
    await ds.insert(StudentRecord()
      ..identityId = 'M-EDU-2026-000001'
      ..studentNumber = 1
      ..studentStatus = 'active'
      ..transferStatus = 'none'
      ..paymentStatus = false
      ..totalPaid = 0
      ..enrolledAt = DateTime(2026, 8, 10));

    // Entity-based update: YANGI record obyekti (id=0) → REPLACE bo'lishi kerak.
    await ds.update(StudentRecord()
      ..identityId = 'M-EDU-2026-000001'
      ..studentNumber = 1
      ..groupId = 'GRP-1'
      ..groupName = 'Guruh-1'
      ..studentStatus = 'active'
      ..transferStatus = 'none'
      ..paymentStatus = false
      ..totalPaid = 0
      ..enrolledAt = DateTime(2026, 8, 10));

    // Yana update — ikkinchi marta ham xatoliksiz.
    await ds.update(StudentRecord()
      ..identityId = 'M-EDU-2026-000001'
      ..studentNumber = 1
      ..groupId = 'GRP-1'
      ..groupName = 'Guruh-1'
      ..studentStatus = 'frozen'
      ..transferStatus = 'none'
      ..paymentStatus = false
      ..totalPaid = 0
      ..enrolledAt = DateTime(2026, 8, 10));

    final all = await db.studentRecords.where().findAll();
    expect(all, hasLength(1), reason: 'Dublikat qator yaratilmasligi shart');
    expect(all.single.groupId, 'GRP-1');
    expect(all.single.groupName, 'Guruh-1');
    expect(all.single.studentStatus, 'frozen');
  });

  test('Group/Identity/Teacher update — id saqlanadi, bitta qator', () async {
    // ── Group ──
    final groupDs = IsarGroupDataSource(db);
    await groupDs.insert(GroupRecord()
      ..groupId = 'GRP-1'
      ..name = 'Eski nom'
      ..capacity = 10
      ..currentSize = 0
      ..monthlyFee = 0
      ..status = 'active');
    await groupDs.update(GroupRecord()
      ..groupId = 'GRP-1'
      ..name = 'Yangi nom'
      ..capacity = 20
      ..currentSize = 3
      ..monthlyFee = 0
      ..status = 'active');
    expect(await db.groupRecords.where().count(), 1);
    expect((await db.groupRecords.where().findAll()).single.name, 'Yangi nom');
    expect((await db.groupRecords.where().findAll()).single.currentSize, 3);

    // ── Identity ──
    final idDs = IsarIdentityDataSource(db);
    await idDs.insert(IdentityRecord()
      ..identityId = 'M-EDU-2026-000002'
      ..firstName = 'Ali'
      ..lastName = 'Valiyev'
      ..role = 'student'
      ..status = 'active'
      ..qrSeed = 'seed-1'
      ..createdAt = DateTime(2026, 8, 10));
    await idDs.update(IdentityRecord()
      ..identityId = 'M-EDU-2026-000002'
      ..firstName = 'Ali'
      ..lastName = 'Karimov'
      ..role = 'student'
      ..status = 'frozen'
      ..qrSeed = 'seed-1'
      ..createdAt = DateTime(2026, 8, 10));
    expect(await db.identityRecords.where().count(), 1);
    expect((await db.identityRecords.where().findAll()).single.lastName,
        'Karimov');
    expect((await db.identityRecords.where().findAll()).single.status, 'frozen');

    // ── Teacher ──
    final teacherDs = IsarTeacherDataSource(db);
    await teacherDs.insert(TeacherRecord()
      ..identityId = 'M-EDU-2026-000003'
      ..teacherNumber = 1
      ..status = 'active'
      ..weeklyHours = 10
      ..maxWeeklyHours = 20
      ..salary = 0);
    await teacherDs.update(TeacherRecord()
      ..identityId = 'M-EDU-2026-000003'
      ..teacherNumber = 1
      ..status = 'active'
      ..weeklyHours = 16
      ..maxWeeklyHours = 20
      ..salary = 0);
    expect(await db.teacherRecords.where().count(), 1);
    expect((await db.teacherRecords.where().findAll()).single.weeklyHours, 16);
  });

  test('Schedule/Room/User/Subject update — id saqlanadi, bitta qator',
      () async {
    final schedDs = IsarScheduleDataSource(db);

    // ── Schedule ──
    await schedDs.insert(ScheduleRecord()
      ..scheduleId = 'SCH-1'
      ..groupId = 'GRP-1'
      ..teacherId = 'T-1'
      ..roomId = 'RM-1'
      ..dayOfWeek = 1
      ..startTime = '09:00'
      ..endTime = '10:00'
      ..status = 'scheduled');
    await schedDs.update(ScheduleRecord()
      ..scheduleId = 'SCH-1'
      ..groupId = 'GRP-1'
      ..teacherId = 'T-1'
      ..roomId = 'RM-1'
      ..dayOfWeek = 1
      ..startTime = '11:00'
      ..endTime = '12:00'
      ..status = 'scheduled');
    expect(await db.scheduleRecords.where().count(), 1);
    expect((await db.scheduleRecords.where().findAll()).single.startTime,
        '11:00');

    // ── Room ──
    await schedDs.insertRoom(RoomRecord()
      ..roomId = 'RM-1'
      ..name = 'Xona-1'
      ..capacity = 20
      ..status = 'available');
    await schedDs.updateRoom(RoomRecord()
      ..roomId = 'RM-1'
      ..name = 'Xona-1 (yangilangan)'
      ..capacity = 25
      ..status = 'available');
    expect(await db.roomRecords.where().count(), 1);
    expect((await db.roomRecords.where().findAll()).single.name,
        'Xona-1 (yangilangan)');

    // ── User (addUser = upsert) ──
    final settingsDs = IsarSettingsDataSource(db);
    await settingsDs.addUser(UserRecord()
      ..userId = 'U-1'
      ..identityId = 'M-EDU-2026-000004'
      ..email = 'a@medu.uz'
      ..role = 'admin'
      ..isActive = true
      ..createdAt = DateTime(2026, 8, 10));
    await settingsDs.addUser(UserRecord()
      ..userId = 'U-1'
      ..identityId = 'M-EDU-2026-000004'
      ..email = 'a@medu.uz'
      ..role = 'director'
      ..isActive = true
      ..createdAt = DateTime(2026, 8, 10));
    expect(await db.userRecords.where().count(), 1,
        reason: 'User update dublikat yaratmaydi');
    expect((await db.userRecords.where().findAll()).single.role, 'director');

    // ── Subject (addSubject = upsert) ──
    await settingsDs.addSubject(SubjectRecord()
      ..subjectId = 'SUB-1'
      ..name = 'Matematika'
      ..isActive = true);
    await settingsDs.addSubject(SubjectRecord()
      ..subjectId = 'SUB-1'
      ..name = "Matematika (ilg'or)"
      ..isActive = true);
    expect(await db.subjectRecords.where().count(), 1);
    expect((await db.subjectRecords.where().findAll()).single.name,
        "Matematika (ilg'or)");
  });

  test('PHONE UNIQUENESS (TOCTOU fix): bir xil telefon ikki identity\'ga '
      'yozilmaydi — insert/update txn ichida atomik tekshiruv', () async {
    final idDs = IsarIdentityDataSource(db);

    IdentityRecord rec(String identityId, String phone) => IdentityRecord()
      ..identityId = identityId
      ..firstName = 'Ali'
      ..lastName = 'Valiyev'
      ..role = 'student'
      ..status = 'active'
      ..phone = phone
      ..qrSeed = 'seed-$identityId'
      ..createdAt = DateTime(2026, 8, 10);

    // 1) Oddiy holat: birinchi insert o'tadi.
    await idDs.insert(rec('M-EDU-2026-000001', '+998901234567'));

    // 2) Xuddi shu telefon bilan ikkinchi identity — RAD ETILADI (txn ichida).
    try {
      await idDs.insert(rec('M-EDU-2026-000002', '+998901234567'));
      fail('DuplicateIdentityFailure kutilgan edi');
    } on DuplicateIdentityFailure {
      // Kutilgan holat.
    }
    expect(await db.identityRecords.where().count(), 1,
        reason: 'Duplicate telefon yozuv saqlanmasligi shart');

    // 3) Boshqa telefon bilan identity yaratiladi; o'z telefonini saqlab
    //    update qilsa — o'tadi (self, update txn ichida tekshiruv).
    await idDs.insert(rec('M-EDU-2026-000003', '+998907654321'));
    await idDs.update(rec('M-EDU-2026-000003', '+998907654321'));
    expect(await db.identityRecords.where().count(), 2);

    // 4) Update orqali boshqa identity'ning telefonini o'zlashtirish — RAD.
    try {
      await idDs.update(rec('M-EDU-2026-000003', '+998901234567'));
      fail('DuplicateIdentityFailure kutilgan edi (update takeover)');
    } on DuplicateIdentityFailure {
      // Kutilgan holat.
    }
    expect(await db.identityRecords.where().count(), 2,
        reason: 'Telefon o\'zlashtirish saqlanmasligi shart');
  });

  test('PHONE UNIQUENESS — parallel registratsiya race\'da ham bitta g\'olib',
      () async {
    final idDs = IsarIdentityDataSource(db);

    IdentityRecord rec(String identityId) => IdentityRecord()
      ..identityId = identityId
      ..firstName = 'Ali'
      ..lastName = 'Valiyev'
      ..role = 'student'
      ..status = 'active'
      ..phone = '+998901112233'
      ..qrSeed = 'seed-$identityId'
      ..createdAt = DateTime(2026, 8, 10);

    // Ikkita PARALLEL insert — bir xil telefon. Isar write txn'lar
    // serializatsiyalangani uchun faqat bittasi o'tadi (check-then-insert
    // race yo'q — TOCTOU tuzatildi).
    final results = await Future.wait([
      idDs.insert(rec('M-EDU-2026-000001')).then((_) => 'ok'),
      idDs.insert(rec('M-EDU-2026-000002')).then((_) => 'ok').catchError(
          (e) => e is DuplicateIdentityFailure ? 'dup' : 'err'),
    ]);

    expect(results.contains('ok'), isTrue);
    expect(results.contains('dup'), isTrue);
    expect(await db.identityRecords.where().count(), 1,
        reason: 'Parallel registratsiyada ham bitta telefon = bitta identity');
  });
}
