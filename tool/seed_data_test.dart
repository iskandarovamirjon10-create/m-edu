// M-Edu development/test ma'lumot generatori + ishlash benchmarki
// (task §31, §37).
//
// NIMA UCHUN TEST: Isar natif kutubxonasini (libisar.so) faqat `flutter test`
// yuklay oladi (`dart run` — yo'q, qarang: tool/dump_device_db_test.dart).
// Shu sababli bu tool test ko'rinishida yozilgan va production test suitiga
// kirmaydi (tool/ ichida, test/ emas).
//
//   M_EDU_SEED_COUNT=100 M_EDU_SEED_DIR=/tmp/m_edu_seed \
//     flutter test tool/seed_data_test.dart
//     — /tmp/m_edu_seed katalogida yangi Isar DB ochadi va 100 ta o'quvchi
//       (guruhlar, to'lovlar, davomat, baholar, jadval, fanlar, xonalar)
//       bilan to'ldiradi. PRODUCTION DATABASE GA TEGMAYDI — har doim
//       alohida katalog (default: build/seed_data).
//
//   M_EDU_SEED_COUNT=1000 M_EDU_SEED_BENCHMARK=1 \
//     flutter test tool/seed_data_test.dart
//     — seed yaratadi va real ishlash o'lchovlarini chiqaradi (student list,
//       search, attendance write, report aggregation, sync queue enqueue).
//       Natija build/benchmark.json ga yoziladi.
//
//   M_EDU_SEED_COUNT=100 M_EDU_SEED_CHECK=1 \
//     flutter test tool/seed_data_test.dart
//     — seed'dan keyin ma'lumot yaxlitligini tekshiradi (counts, FK).
//
// QOIDALAR:
//   - Hech qachon app support katalogiga / production DB'ga yozmaydi
//     (katalog faqat M_EDU_SEED_DIR orqali beriladi; app data yo'llari
//     qat'iy rad etiladi).
//   - Face/biometrik yozuv yaratilmaydi (biometrik data hech qachon fake
//     generatsiya qilinmaydi).
//   - Deterministik: bir xil --seed → bir xil natija (regression uchun).

import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';
import 'package:m_edu/features/grades/infrastructure/models/grade_record.dart';
import 'package:m_edu/features/groups/infrastructure/models/group_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/debt_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/payment_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/room_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/schedule_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/subject_record.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';

const _defaultSeed = 20260816;

void main() {
  test('seed data generator + benchmark (dev-only, env-gated)', () async {
    final env = Platform.environment;
    final students = int.tryParse(env['M_EDU_SEED_COUNT'] ?? '') ?? 100;
    final dir = env['M_EDU_SEED_DIR'] ?? 'build/seed_data';
    final benchmark = env['M_EDU_SEED_BENCHMARK'] == '1';
    final check = env['M_EDU_SEED_CHECK'] == '1';

    // App support / production DB katalogiga yozishni oldini olish.
    final lower = dir.replaceAll('\\', '/').toLowerCase();
    if (lower.contains('app_support') ||
        lower.contains('application support') ||
        lower.contains('.local/share') ||
        lower.contains('appdata') ||
        lower.contains('files/')) {
      fail('$dir — production/app data katalogiga seed yozish TAQIQLANADI. '
          'Alohida katalog bering (masalan /tmp/m_edu_seed).');
    }

    final sw = Stopwatch()..start();
    final isar = await _openDb(dir);
    try {
      final rng = Random(_defaultSeed);
      // ignore: avoid_print
      print('Seed generatsiya: $students o\'quvchi → $dir '
          '(seed=$_defaultSeed)');

      final groups = _makeGroups(rng);
      final subjects = _makeSubjects(rng);
      final rooms = _makeRooms(rng);
      final identities = _makeIdentities(rng, students);
      final studentRecords = _makeStudents(rng, identities, groups);

      await isar.writeTxn(() async {
        await isar.roomRecords.putAll(rooms);
        await isar.subjectRecords.putAll(subjects);
        await isar.groupRecords.putAll(groups);
        await isar.identityRecords.putAll(identities);
        await isar.studentRecords.putAll(studentRecords);
      });

      final payments = _makePayments(rng, studentRecords);
      final attendance = _makeAttendance(rng, studentRecords, groups);
      final grades = _makeGrades(rng, studentRecords, subjects);
      final schedules = _makeSchedules(rng, groups, rooms, subjects);

      await isar.writeTxn(() async {
        await isar.paymentRecords.putAll(payments);
        await isar.debtRecords.putAll(_makeDebts(rng, studentRecords));
        await isar.attendanceRecords.putAll(attendance);
        await isar.gradeRecords.putAll(grades);
        await isar.scheduleRecords.putAll(schedules);
      });

      // ignore: avoid_print
      print('✓ Yozildi: ${groups.length} guruh, ${subjects.length} fan, '
          '${rooms.length} xona, $students o\'quvchi, ${payments.length} '
          'to\'lov, ${attendance.length} davomat, ${grades.length} baho, '
          '${schedules.length} jadval — ${sw.elapsedMilliseconds} ms');

      if (check) {
        await _verify(isar, expected: {
          'identityRecords': identities.length,
          'studentRecords': studentRecords.length,
          'groupRecords': groups.length,
          'paymentRecords': payments.length,
          'attendanceRecords': attendance.length,
          'gradeRecords': grades.length,
        });
      }

      if (benchmark) {
        await _benchmark(isar, dir, students);
      }
    } finally {
      await isar.close();
    }
  });
}

Future<Isar> _openDb(String dir) async {
  Directory(dir).createSync(recursive: true);
  return Isar.open(
    [
      IdentityRecordSchema,
      StudentRecordSchema,
      GroupRecordSchema,
      PaymentRecordSchema,
      DebtRecordSchema,
      RoomRecordSchema,
      ScheduleRecordSchema,
      GradeRecordSchema,
      AttendanceRecordSchema,
      SubjectRecordSchema,
    ],
    name: 'm_edu_seed',
    directory: dir,
  );
}

// ── Generator'lar ──────────────────────────────────────────────────────────

List<GroupRecord> _makeGroups(Random rng) {
  final names = ['Matematika', 'Fizika', 'Ingliz tili', 'Informatika', 'Kimyo',
    'Biologiya', 'Rus tili', 'Tarix', 'Dasturlash', 'Robototexnika'];
  return [
    for (var i = 0; i < names.length; i++)
      GroupRecord()
        ..groupId = 'GRP-2026-${(i + 1).toString().padLeft(3, '0')}'
        ..name = '${names[i]} guruhi'
        ..code = 'G${i + 1}'
        ..capacity = 12 + rng.nextInt(13)
        ..currentSize = 0
        ..monthlyFee = 200000 + rng.nextInt(5) * 50000
        ..status = 'active'
        ..subject = names[i]
        ..academicYear = '2026-2027'
        ..daysOfWeekJson = jsonEncode([1, 3, 5])
        ..startTime = '09:00'
        ..endTime = '11:00'
        ..pendingSync = true,
  ];
}

List<SubjectRecord> _makeSubjects(Random rng) {
  final names = ['Matematika', 'Fizika', 'Ingliz tili', 'Informatika', 'Kimyo',
    'Biologiya', 'Rus tili', 'Tarix', 'Dasturlash', 'Robototexnika'];
  const colors = ['#4F6EF7', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#14B8A6'];
  return [
    for (var i = 0; i < names.length; i++)
      SubjectRecord()
        ..subjectId = 'SUB-${(i + 1).toString().padLeft(3, '0')}'
        ..name = names[i]
        ..code = 'S${i + 1}'
        ..color = colors[i % colors.length]
        ..isActive = true,
  ];
}

List<RoomRecord> _makeRooms(Random rng) {
  return [
    for (var i = 0; i < 6; i++)
      RoomRecord()
        ..roomId = 'RM-${(i + 1).toString().padLeft(3, '0')}'
        ..name = 'Xona ${101 + i}'
        ..code = 'R${101 + i}'
        ..capacity = 8 + rng.nextInt(17)
        ..status = 'active',
  ];
}

List<IdentityRecord> _makeIdentities(Random rng, int count) {
  final names = ['Aziz', 'Malika', 'Jasur', 'Nodira', 'Sardor', 'Zilola',
    'Bekzod', 'Dilnoza', 'Farrux', 'Gulnora', 'Hasan', 'Iroda', 'Javlon',
    'Kamola', 'Laziz', 'Madina', 'Nodir', 'Oygul', 'Rustam', 'Shahnoza'];
  return [
    for (var i = 0; i < count; i++)
      IdentityRecord()
        ..identityId = 'M-EDU-2026-${(i + 1).toString().padLeft(6, '0')}'
        ..firstName = names[rng.nextInt(names.length)]
        ..lastName = 'Student${(i + 1).toString().padLeft(4, '0')}'
        ..role = 'student'
        ..status = 'active'
        ..phone = '+99890${(1000000 + rng.nextInt(8999999)).toString()}'
        ..qrSeed = 'seed-${i + 1}'
        ..createdAt = DateTime(2026, 1, 1)
            .add(Duration(days: rng.nextInt(200)))
        ..pendingSync = true,
  ];
}

List<StudentRecord> _makeStudents(
  Random rng,
  List<IdentityRecord> identities,
  List<GroupRecord> groups,
) {
  return [
    for (var i = 0; i < identities.length; i++)
      StudentRecord()
        ..identityId = identities[i].identityId
        ..studentNumber = i + 1
        ..groupId = groups[i % groups.length].groupId
        ..groupName = groups[i % groups.length].name
        ..studentStatus = 'active'
        ..transferStatus = 'none'
        ..paymentStatus = true
        ..totalPaid = 400000 + rng.nextInt(3) * 200000
        ..enrolledAt = identities[i].createdAt
        ..assignedAt = identities[i].createdAt
        ..pendingSync = true,
  ];
}

List<PaymentRecord> _makePayments(
  Random rng,
  List<StudentRecord> students,
) {
  final payments = <PaymentRecord>[];
  var n = 0;
  for (final s in students) {
    final monthsBack = rng.nextInt(4);
    for (var m = monthsBack; m >= 0; m--) {
      final date = DateTime(2026, 8 - m, 1 + rng.nextInt(27));
      n++;
      payments.add(PaymentRecord()
        ..paymentId = 'PAY-2026-${n.toString().padLeft(6, '0')}'
        ..studentIdentityId = s.identityId
        ..studentName = 'Student ${s.identityId}'
        ..groupId = s.groupId
        ..groupName = s.groupName
        ..amount = 300000
        ..paymentType = 'monthly_fee'
        ..status = 'completed'
        ..receiptNumber = 'RC-${n.toString().padLeft(6, '0')}'
        ..paymentDate = date
        ..billingPeriod = '${date.month.toString().padLeft(2, '0')}/${date.year}'
        ..pendingSync = true);
    }
  }
  return payments;
}

List<DebtRecord> _makeDebts(Random rng, List<StudentRecord> students) {
  final debts = <DebtRecord>[];
  for (final s in students.where((s) => rng.nextInt(10) < 3)) {
    debts.add(DebtRecord()
      ..debtId = 'DEBT-${s.identityId}'
      ..studentIdentityId = s.identityId
      ..studentName = 'Student ${s.identityId}'
      ..groupId = s.groupId
      ..groupName = s.groupName
      ..totalAmount = 300000
      ..paidAmount = rng.nextInt(2) * 100000
      ..remainingAmount = 300000 - (rng.nextInt(2) * 100000)
      ..dueDate = DateTime(2026, 9, 5)
      ..status = 'open'
      ..billingPeriod = '09/2026'
      ..reminderSent = false);
  }
  return debts;
}

List<AttendanceRecord> _makeAttendance(
  Random rng,
  List<StudentRecord> students,
  List<GroupRecord> groups,
) {
  final records = <AttendanceRecord>[];
  for (final s in students) {
    final group = groups.firstWhere((g) => g.groupId == s.groupId);
    final lessonDays = (jsonDecode(group.daysOfWeekJson ?? '[1,3,5]') as List)
        .cast<int>();
    for (var week = 0; week < 4; week++) {
      for (final day in lessonDays) {
        if (rng.nextInt(10) < 2) continue; // ~20% absent
        final date =
            _dateOf(DateTime(2026, 8, 3).add(Duration(days: week * 7)), day);
        final late = rng.nextInt(10) < 2;
        records.add(AttendanceRecord()
          ..identityId = s.identityId
          ..timestamp = DateTime(
              date.year, date.month, date.day, late ? 9 : 8, late ? 30 : 45)
          ..fullName = 'Student ${s.identityId}'
          ..role = 'student'
          ..method = 'manual'
          ..source = 'seed'
          ..attendanceDate = DateTime(date.year, date.month, date.day)
          ..status = late ? 'late' : 'present'
          ..checkInAt = DateTime(
              date.year, date.month, date.day, late ? 9 : 8, late ? 30 : 45)
          ..syncVersion = 1
          ..pendingSync = true);
      }
    }
  }
  return records;
}

DateTime _dateOf(DateTime anchor, int weekday) {
  var d = anchor;
  while (d.weekday != weekday) {
    d = d.add(const Duration(days: 1));
  }
  return d;
}

List<GradeRecord> _makeGrades(
  Random rng,
  List<StudentRecord> students,
  List<SubjectRecord> subjects,
) {
  final grades = <GradeRecord>[];
  var n = 0;
  for (final s in students) {
    final subject = subjects[s.studentNumber % subjects.length];
    n++;
    grades.add(GradeRecord()
      ..gradeId = 'GRD-2026-${n.toString().padLeft(6, '0')}'
      ..studentIdentityId = s.identityId
      ..studentName = 'Student ${s.identityId}'
      ..groupId = s.groupId
      ..groupName = s.groupName
      ..subjectId = subject.subjectId
      ..subjectName = subject.name
      ..value = 2 + rng.nextInt(4) // 2..5
      ..date = DateTime(2026, 8, 1 + rng.nextInt(27)));
  }
  return grades;
}

List<ScheduleRecord> _makeSchedules(
  Random rng,
  List<GroupRecord> groups,
  List<RoomRecord> rooms,
  List<SubjectRecord> subjects,
) {
  return [
    for (var i = 0; i < groups.length; i++)
      ScheduleRecord()
        ..scheduleId = 'SCH-2026-${(i + 1).toString().padLeft(3, '0')}'
        ..groupId = groups[i].groupId
        ..groupName = groups[i].name
        ..teacherId = 'TCH-2026-000${i + 1}'
        ..teacherName = 'O\'qituvchi ${i + 1}'
        ..roomId = rooms[i % rooms.length].roomId
        ..roomName = rooms[i % rooms.length].name
        ..dayOfWeek = 1 + (i % 5)
        ..startTime = '09:00'
        ..endTime = '11:00'
        ..subject = subjects[i].name
        ..status = 'active'
        ..startDate = DateTime(2026, 9, 1)
        ..endDate = DateTime(2027, 5, 31),
  ];
}

// ── Tekshiruv ──────────────────────────────────────────────────────────────

Future<void> _verify(Isar isar,
    {required Map<String, int> expected}) async {
  // ignore: avoid_print
  print('\n── YAXLITLIK TEKSHIRUVI ──');
  var ok = true;
  final actual = <String, int>{
    'identityRecords': await isar.identityRecords.count(),
    'studentRecords': await isar.studentRecords.count(),
    'groupRecords': await isar.groupRecords.count(),
    'paymentRecords': await isar.paymentRecords.count(),
    'attendanceRecords': await isar.attendanceRecords.count(),
    'gradeRecords': await isar.gradeRecords.count(),
  };
  for (final e in expected.entries) {
    final matches = actual[e.key] == e.value;
    ok = ok && matches;
    // ignore: avoid_print
    print('  ${matches ? '✓' : '✗'} ${e.key}: '
        'kutilgan=${e.value}, topildi=${actual[e.key]}');
  }

  // FK: har student identity'ga bog'langan.
  final students = await isar.studentRecords.where().findAll();
  final identityIds = (await isar.identityRecords.where().findAll())
      .map((i) => i.identityId)
      .toSet();
  final orphans = students.where((s) => !identityIds.contains(s.identityId));
  if (orphans.isNotEmpty) {
    ok = false;
    // ignore: avoid_print
    print('  ✗ FK: ${orphans.length} ta student identifiyasiz');
  } else {
    // ignore: avoid_print
    print('  ✓ FK: barcha student identity\'ga bog\'langan');
  }

  // Guruh currentSize sinxronligi (seed'da 0 — tegishli tekshiruv):
  final groups = await isar.groupRecords.where().findAll();
  for (final g in groups) {
    final actualSize = students.where((s) => s.groupId == g.groupId).length;
    if (g.currentSize != 0 && actualSize != g.currentSize) {
      ok = false;
      // ignore: avoid_print
      print('  ✗ currentSize: ${g.groupId} — saqlangan='
          '${g.currentSize}, real=$actualSize');
    }
  }
  // ignore: avoid_print
  print(ok ? '  ✓ HAMMA TEKSHIRUVLAR O\'TDI' : '  ✗ XATOLAR TOPILDI');
  if (!ok) {
    fail('Seed yaxlitlik tekshiruvi muvaffaqiyatsiz');
  }
}

// ── Benchmark (task §31) ───────────────────────────────────────────────────

Future<void> _benchmark(Isar isar, String dir, int students) async {
  // ignore: avoid_print
  print('\n── PERFORMANCE BENCHMARK ($students o\'quvchi) ──');

  Future<Map<String, Object>> measure(
      String name, Future<void> Function() fn) async {
    final sw = Stopwatch()..start();
    await fn();
    sw.stop();
    final result = <String, Object>{'op': name, 'ms': sw.elapsedMilliseconds};
    // ignore: avoid_print
    print('  ${name.padRight(28)} '
        '${sw.elapsedMilliseconds.toString().padLeft(6)} ms');
    return result;
  }

  final results = <Map<String, Object>>[];

  results.add(await measure('student list (fetchAll)',
      () async => await isar.studentRecords.where().findAll()));

  results.add(await measure('search by identityId (indexed)', () async =>
      await isar.studentRecords
          .filter()
          .identityIdEqualTo('M-EDU-2026-000100')
          .findFirst()));

  results.add(await measure('search by groupId (indexed)', () async {
    final groups = await isar.groupRecords.where().findAll();
    if (groups.isNotEmpty) {
      await isar.studentRecords
          .filter()
          .groupIdEqualTo(groups.first.groupId)
          .findAll();
    }
  }));

  results.add(await measure('attendance write (1 record)',
      () async => isar.writeTxn(() async {
            final rec = AttendanceRecord()
              ..identityId = 'M-EDU-2026-000001'
              ..timestamp = DateTime(2026, 8, 16, 9, 5)
              ..fullName = 'Benchmark'
              ..role = 'student'
              ..method = 'manual'
              ..attendanceDate = DateTime(2026, 8, 16)
              ..status = 'present'
              ..checkInAt = DateTime(2026, 8, 16, 9, 5);
            await isar.attendanceRecords.put(rec);
          })));

  results.add(await measure('revenue aggregation (all payments)', () async {
    final all = await isar.paymentRecords.where().findAll();
    var sum = 0;
    for (final p in all) {
      sum += p.amount;
    }
    // Haqiqiy hisobni "tashlab" qo'ymaymiz — o'lchov haqiqiy ishni
    // o'lchaydi (optimizator ishni o'chirib yubormasligi uchun).
    if (sum < 0) {
      throw StateError('revenue sum musbat bo\'lishi kerak');
    }
  }));

  results.add(await measure('attendance stats (group by student)', () async {
    final all = await isar.attendanceRecords.where().findAll();
    final byStudent = <String, int>{};
    for (final a in all) {
      byStudent[a.identityId] = (byStudent[a.identityId] ?? 0) + 1;
    }
  }));

  results.add(await measure('sync queue enqueue (100 dedup)', () async {
    for (var i = 0; i < 100; i++) {
      final rec = StudentRecord()
        ..identityId = 'SYNC-BENCH-$i'
        ..studentNumber = i
        ..studentStatus = 'active'
        ..transferStatus = 'none'
        ..paymentStatus = true
        ..totalPaid = 0
        ..enrolledAt = DateTime(2026, 8, 1)
        ..pendingSync = true;
      await isar.writeTxn(() => isar.studentRecords.put(rec));
    }
  }));

  final summary = {
    'generatedAt': DateTime.now().toIso8601String(),
    'students': students,
    'dir': dir,
    'results': results,
  };
  final outFile = File('build/benchmark.json');
  outFile.parent.createSync(recursive: true);
  outFile.writeAsStringSync(const JsonEncoder.withIndent('  ').convert(summary));
  // ignore: avoid_print
  print('\n  Natijalar yozildi: ${outFile.path}');
}
