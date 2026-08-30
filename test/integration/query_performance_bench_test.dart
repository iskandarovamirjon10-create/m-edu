import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';

import 'package:m_edu/features/students/infrastructure/datasources/isar_student_datasource.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';

/// ────────────────────────────────────────────────────────────────────────────
/// PHASE 17 — PERFORMANCE ENGINEERING (measure, don't guess)
///
/// 10 000 talaba bilan sintetik korpus:
///  - countAll: Isar count() — butun ro'yxatni o'qimaydi
///  - findPage(100): sahifalangan o'qish — kichik oyna
///  - findAll: to'liq skan (pagination bo'lmaganda qancha turadi)
///
/// Bu benchmark QA GATE sifatida ishlaydi: agarda sahifalangan o'qish
/// ma'lum byudjetdan oshib ketsa (regression), test FAIL bo'ladi. Byudjetlar
/// qat'iy emas — bajaruvchi qurilmaga qarab 2x tolerantlik qo'llaniladi.
/// ────────────────────────────────────────────────────────────────────────────

List<CollectionSchema<dynamic>> _schemas() => [StudentRecordSchema];

void main() {
  late Directory tempDir;
  late Isar db;
  late IsarStudentDataSource studentDs;

  // Byudjetlar (milliseconds). VM test muhitida yumshoq chegara —
  // Isar oddiy SELECT'lari 10k qatorda bir necha ms ichida bajarilishi
  // kutiladi; 2x tolerance regressionni ham ushlaydi.
  const countBudgetMs = 50;
  const pageBudgetMs = 50;
  const pageAllBudgetMs = 200;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('m_edu_perf_test');
    db = await Isar.open(_schemas(), directory: tempDir.path);
    studentDs = IsarStudentDataSource(db);

    await db.writeTxn(() async {
      for (var i = 1; i <= 10000; i++) {
        await db.studentRecords.put(StudentRecord()
          ..identityId = 'M-EDU-2026-${i.toString().padLeft(6, '0')}'
          ..studentNumber = i
          ..studentStatus = 'active'
          ..transferStatus = 'none'
          ..paymentStatus = false
          ..totalPaid = 0
          ..enrolledAt = DateTime(2026, 8, 1).add(Duration(minutes: i)));
      }
    });
  });

  tearDown(() async {
    await db.close();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  Future<Duration> measureRun(Future<void> Function() run) async {
    // Isitish (warm-up) — birinchi so'rov indeks/keshni yuklaydi.
    await run();
    final sw = Stopwatch()..start();
    await run();
    sw.stop();
    return sw.elapsed;
  }

  test('countAll 10k — indeks bo\'yicha, to\'liq skan emas', () async {
    final elapsed = await measureRun(() async {
      expect(await studentDs.countAll(), 10000);
    });
    // ignore: avoid_print — benchmark natijasi raport uchun.
    print('BENCH countAll(10k): ${elapsed.inMilliseconds}ms');
    expect(
      elapsed.inMilliseconds,
      lessThan(countBudgetMs),
      reason: 'countAll 10k qatorda $countBudgetMs ms dan oshdi — regression?',
    );
  });

  test('findPage(100) 10k — sahifalangan o\'qish byudjet ichida', () async {
    final elapsed = await measureRun(() async {
      final page = await studentDs.findPage(offset: 5000, limit: 100);
      expect(page.length, 100);
    });
    // ignore: avoid_print — benchmark natijasi raport uchun.
    print('BENCH findPage(100)@5000: ${elapsed.inMilliseconds}ms');
    expect(
      elapsed.inMilliseconds,
      lessThan(pageBudgetMs),
      reason: 'sahifalangan o\'qish $pageBudgetMs ms dan oshdi — regression?',
    );
  });

  test('findAll 10k — to\'liq skan (pagination yukini solishtirish)', () async {
    final elapsed = await measureRun(() async {
      final all = await studentDs.findAll();
      expect(all.length, 10000);
    });
    // ignore: avoid_print — benchmark natijasi raport uchun.
    print('BENCH findAll(10k): ${elapsed.inMilliseconds}ms');
    expect(
      elapsed.inMilliseconds,
      lessThan(pageAllBudgetMs),
      reason: 'to\'liq skan $pageAllBudgetMs ms dan oshdi — jiddiy regression?',
    );
  });

  test('haqiqiy browse sessiyasi (5 sahifa) to\'liq skandan arzonroq',
      () async {
    final allTime = await measureRun(() async {
      await studentDs.findAll();
    });
    // Haqiqiy infinite-scroll sessiyasi: foydalanuvchi 5 sahifa ko'radi
    // (500 ta talaba) — 10k jadvalni yuklamaydi.
    final browseTime = await measureRun(() async {
      for (var p = 0; p < 5; p++) {
        await studentDs.findPage(offset: p * 100, limit: 100);
      }
    });
    // ignore: avoid_print — benchmark natijasi raport uchun.
    print('BENCH findAll(10k)=${allTime.inMilliseconds}ms vs '
        'browse 5-sahifa=${browseTime.inMilliseconds}ms');
    // Xotira jihatidan ham, vaqt jihatidan ham browse arzonroq bo'lishi
    // kerak: 500 ta qator vs 10 000 ta qator.
    expect(
      browseTime.inMilliseconds,
      lessThan(allTime.inMilliseconds + 20),
      reason: '5 sahifalik browse to\'liq skandan sekin — regression?',
    );
  });
}
