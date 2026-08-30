import 'package:isar/isar.dart';

import '../../features/attendance/infrastructure/models/attendance_record.dart';
import '../../features/attendance/infrastructure/models/attendance_session_record.dart';
import '../../features/audit/infrastructure/models/audit_log_record.dart';
import '../../features/crm/infrastructure/models/lead_activity_record.dart';
import '../../features/crm/infrastructure/models/lead_record.dart';
import '../../features/face_recognition/infrastructure/models/face_record.dart';
import '../../features/face_recognition/infrastructure/models/recognition_attempt_record.dart';
import '../../features/grades/infrastructure/models/grade_record.dart';
import '../../features/groups/infrastructure/models/group_record.dart';
import '../../features/identity/infrastructure/models/identity_activity_record.dart';
import '../../features/identity/infrastructure/models/identity_record.dart';
import '../../features/identity/infrastructure/models/sequence_counter.dart';
import '../../features/identity/infrastructure/models/signed_qr_nonce_record.dart';
import '../../features/notifications/infrastructure/models/notification_record.dart';
import '../../features/organization/infrastructure/models/organization_record.dart';
import '../../features/payments/infrastructure/models/debt_record.dart';
import '../../features/payments/infrastructure/models/expense_record.dart';
import '../../features/payments/infrastructure/models/payment_record.dart';
import '../../features/reports/infrastructure/models/report_record.dart';
import '../../features/scheduling/infrastructure/models/room_record.dart';
import '../../features/scheduling/infrastructure/models/schedule_record.dart';
import '../../features/settings/infrastructure/models/settings_record.dart';
import '../../features/settings/infrastructure/models/subject_record.dart';
import '../../features/settings/infrastructure/models/user_record.dart';
import '../../features/students/infrastructure/models/student_record.dart';
import '../../features/teachers/infrastructure/models/teacher_record.dart';
import '../../core/network/infrastructure/models/sync_conflict_record.dart';
import '../../core/network/infrastructure/models/sync_cursor_record.dart';
import '../../core/network/infrastructure/models/sync_operation_record.dart';

/// Bitta zaxiralanadigan kolleksiya tavsifi.
///
/// [key] — backup JSON'dagi kalit (Isar kolleksiya nomi bilan mos).
/// [accessor] — Isar'dan kolleksiyani oluvchi yagona nuqta; export/clear/
/// import/count hammasi shu accessor orqali ishlaydi (qo'lda bir nechta
/// joyda ro'yxat saqlanmaydi — A7/E6: canonical schema registry).
class BackupCollectionSpec {
  final String key;
  final IsarCollection<dynamic> Function(Isar db) accessor;

  const BackupCollectionSpec(this.key, this.accessor);
}

/// BACKUP SCHEMA REGISTRY — zaxira va tiklash uchun YAGONA manba.
///
/// A7/E6 (audit): ilgari kolleksiyalar ro'yxati 5 joyda qo'lda takrorlanar
/// edi (export, clear, import, verify, size) — yangi kolleksiya qo'shilsa
/// bitta joyda unutilsa, backup jimgina to'liqsiz bo'lib qolardi. Endi
/// barcha persistent kolleksiyalar shu yerda, bitta ro'yxatda.
///
/// Yangi Isar kolleksiyasi qo'shilganda:
/// 1. Shu ro'yxatga qo'shish;
/// 2. `backupSchemaVersion` ni oshirish (backup_codec.dart).
///
/// ATYOLIY ISTISNO: `DeviceInfoRecord` (qurilma identifikatori) ataylab
/// ZAXIRALANMAYDI — u qurilmaga xos (hardware ID kabi); backup'ni boshqa
/// qurilmaga tiklash uning deviceId'sini ko'chirib, sync tie-break
/// semantikasini chalkashtirardi.
abstract final class BackupCollections {
  static final List<BackupCollectionSpec> all = [
    BackupCollectionSpec('identityRecords', (db) => db.identityRecords),
    BackupCollectionSpec(
        'identityActivityRecords', (db) => db.identityActivityRecords),
    BackupCollectionSpec('sequenceCounters', (db) => db.sequenceCounters),
    BackupCollectionSpec(
        'organizationRecords', (db) => db.organizationRecords),
    BackupCollectionSpec('studentRecords', (db) => db.studentRecords),
    BackupCollectionSpec('teacherRecords', (db) => db.teacherRecords),
    BackupCollectionSpec('groupRecords', (db) => db.groupRecords),
    BackupCollectionSpec('paymentRecords', (db) => db.paymentRecords),
    BackupCollectionSpec('debtRecords', (db) => db.debtRecords),
    BackupCollectionSpec('expenseRecords', (db) => db.expenseRecords),
    BackupCollectionSpec('scheduleRecords', (db) => db.scheduleRecords),
    BackupCollectionSpec('roomRecords', (db) => db.roomRecords),
    BackupCollectionSpec('gradeRecords', (db) => db.gradeRecords),
    BackupCollectionSpec('notificationRecords', (db) => db.notificationRecords),
    BackupCollectionSpec('faceRecords', (db) => db.faceRecords),
    BackupCollectionSpec(
        'recognitionAttemptRecords', (db) => db.recognitionAttemptRecords),
    BackupCollectionSpec('attendanceRecords', (db) => db.attendanceRecords),
    BackupCollectionSpec(
        'attendanceSessionRecords', (db) => db.attendanceSessionRecords),
    BackupCollectionSpec('leadRecords', (db) => db.leadRecords),
    BackupCollectionSpec('leadActivityRecords', (db) => db.leadActivityRecords),
    BackupCollectionSpec(
        'signedQrNonceRecords', (db) => db.signedQrNonceRecords),
    BackupCollectionSpec('settingsRecords', (db) => db.settingsRecords),
    BackupCollectionSpec('userRecords', (db) => db.userRecords),
    BackupCollectionSpec('subjectRecords', (db) => db.subjectRecords),
    BackupCollectionSpec('auditLogRecords', (db) => db.auditLogRecords),
    BackupCollectionSpec('reportRecords', (db) => db.reportRecords),
    BackupCollectionSpec('syncOperationRecords', (db) => db.syncOperationRecords),
    BackupCollectionSpec('syncCursorRecords', (db) => db.syncCursorRecords),
    BackupCollectionSpec('syncConflictRecords', (db) => db.syncConflictRecords),
  ];
}
