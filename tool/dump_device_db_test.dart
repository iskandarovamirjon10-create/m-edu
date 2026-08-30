// Qurilmadagi Isar DB holatini ko'rsatadigan development diagnostika (P0).
//
// `flutter test` isar natif kutubxonasini yuklay oladi (dart run emas) —
// shuning uchun test ko'rinishida yozilgan. Production test suitiga
// kirmaydi (tool/ ichida, test/ emas).
//
//   adb shell run-as com.medu.m_edu cat files/m_edu.isar > /tmp/m_edu.isar
//   M_EDU_DB_PATH=/tmp/m_edu.isar flutter test tool/dump_device_db_test.dart
//
// Face ID bilan bog'liq runtime holatni chiqaradi: kamera konfiguratsiyasi,
// enroll qilingan yuzlar (faqat metadatasi — biometrik vektor chiqarilmaydi),
// user rollari, bugungi davomat. Diagnostika uchun — production'ga kirmaydi.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_record.dart';
import 'package:m_edu/features/attendance/infrastructure/models/attendance_session_record.dart';
import 'package:m_edu/features/audit/infrastructure/models/audit_log_record.dart';
import 'package:m_edu/features/face_recognition/infrastructure/models/face_record.dart';
import 'package:m_edu/features/grades/infrastructure/models/grade_record.dart';
import 'package:m_edu/features/groups/infrastructure/models/group_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_activity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/identity_record.dart';
import 'package:m_edu/features/identity/infrastructure/models/sequence_counter.dart';
import 'package:m_edu/features/identity/infrastructure/models/signed_qr_nonce_record.dart';
import 'package:m_edu/features/notifications/infrastructure/models/notification_record.dart';
import 'package:m_edu/features/organization/infrastructure/models/organization_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/debt_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/expense_record.dart';
import 'package:m_edu/features/payments/infrastructure/models/payment_record.dart';
import 'package:m_edu/features/reports/infrastructure/models/report_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/room_record.dart';
import 'package:m_edu/features/scheduling/infrastructure/models/schedule_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/settings_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/subject_record.dart';
import 'package:m_edu/features/settings/infrastructure/models/user_record.dart';
import 'package:m_edu/features/students/infrastructure/models/student_record.dart';
import 'package:m_edu/features/teachers/infrastructure/models/teacher_record.dart';

void main() {
  test('qurilma DB diagnostikasi (dev-only)', () async {
    final path = Platform.environment['M_EDU_DB_PATH'] ?? '/tmp/m_edu.isar';
    final file = File(path);
    if (!file.existsSync()) {
      // Baza pull qilinmagan bo'lsa — xato emas, skip (dokumentatsiya).
      // ignore: avoid_print
      print('SKIP: DB topilmadi: $path — avval adb bilan pull qiling');
      return;
    }

    final isar = await Isar.open(
      [
        IdentityRecordSchema,
        IdentityActivityRecordSchema,
        SequenceCounterSchema,
        OrganizationRecordSchema,
        StudentRecordSchema,
        TeacherRecordSchema,
        GroupRecordSchema,
        PaymentRecordSchema,
        DebtRecordSchema,
        ExpenseRecordSchema,
        ScheduleRecordSchema,
        RoomRecordSchema,
        GradeRecordSchema,
        NotificationRecordSchema,
        FaceRecordSchema,
        AttendanceRecordSchema,
        AttendanceSessionRecordSchema,
        SignedQrNonceRecordSchema,
        SettingsRecordSchema,
        UserRecordSchema,
        SubjectRecordSchema,
        AuditLogRecordSchema,
        ReportRecordSchema,
      ],
      name: 'm_edu',
      directory: file.parent.path,
    );

    final log = StringBuffer();
    log.writeln('═' * 60);
    log.writeln('  M-EDU QURILMA DB DIAGNOSTIKASI: ${file.path}');
    log.writeln('═' * 60);

    // ── Sozlamalar (kamera + Face ID) ──────────────────────────────
    final settings = await isar.settingsRecords.where().findAll();
    log.writeln('\n── SOZLAMALAR (${settings.length} ta) ──');
    for (final s in settings) {
      log.writeln('  hikvisionEnabled:   ${s.hikvisionEnabled}');
      log.writeln('  hikvisionIp:        ${s.hikvisionIp ?? '(null)'}');
      log.writeln('  hikvisionPort:      ${s.hikvisionPort}');
      log.writeln('  hikvisionUsername:  ${s.hikvisionUsername ?? '(null)'}');
      log.writeln('  hikvisionPassword:  ${s.hikvisionPassword == null ? '(null)' : '(set len=${s.hikvisionPassword!.length})'}');
      log.writeln('  hikvisionChannel:   ${s.hikvisionChannel}');
      log.writeln('  hikvisionRtspPath:  ${s.hikvisionRtspPath ?? '(null → default /Streaming/Channels/101)'}');
      log.writeln('  autoMarkAttendance: ${s.autoMarkAttendance}');
      log.writeln('  scanIntervalMs:     ${s.scanIntervalMs}');
      log.writeln('  matchThreshold:     ${s.matchThreshold}');
      log.writeln('  ambiguousThreshold: ${s.ambiguousThreshold}');
    }

    // ── Yuz bazasi ─────────────────────────────────────────────────
    final faces = await isar.faceRecords.where().findAll();
    log.writeln('\n── YUZ BAZASI (${faces.length} ta enroll) ──');
    if (faces.isEmpty) {
      log.writeln('  ⚠ HEÇ QANDAY enroll YO\'Q — recognition doim '
          '"unknown" (templates=0).');
    }
    for (final f in faces) {
      log.writeln('  identityId: ${f.identityId}');
      log.writeln('    source:      ${f.source}');
      log.writeln('    sampleCount: ${f.sampleCount}');
      log.writeln('    encrypted:   ${(f.encryptedSignature?.length ?? 0) > 0} (${f.encryptedSignature?.length ?? 0} bayt)');
      log.writeln('    plaintext:   ${f.signature.length} (legacy, ${f.signature.isNotEmpty ? 'hali bor!' : 'toza'})');
      log.writeln('    createdAt:   ${f.createdAt}');
      log.writeln('    updatedAt:   ${f.updatedAt}');
    }

    // ── Userlar ────────────────────────────────────────────────────
    final users = await isar.userRecords.where().findAll();
    log.writeln('\n── USERLAR (${users.length} ta) ──');
    for (final u in users) {
      log.writeln('  ${u.email} | role=${u.role} | active=${u.isActive}');
    }

    // ── Umumiy ─────────────────────────────────────────────────────
    log.writeln('\n── UMUMIY ──');
    log.writeln('  identityRecords:   ${await isar.identityRecords.count()}');
    log.writeln('  studentRecords:    ${await isar.studentRecords.count()}');
    log.writeln('  attendanceRecords: ${await isar.attendanceRecords.count()}');
    log.writeln('  auditLogRecords:   ${await isar.auditLogRecords.count()}');

    // ── Bugungi davomat ────────────────────────────────────────────
    final today = DateTime.now();
    final start = DateTime(today.year, today.month, today.day);
    final todayAtt =
        await isar.attendanceRecords.filter().timestampGreaterThan(start).findAll();
    log.writeln('  bugungi davomat: ${todayAtt.length} ta');
    for (final a in todayAtt) {
      log.writeln('    ${a.identityId} | method=${a.method} | ${a.timestamp}');
    }

    await isar.close();
    // ignore: avoid_print
    print(log);
  });
}
