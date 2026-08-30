import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/attendance/application/commands/record_attendance_command.dart';
import 'package:m_edu/features/groups/application/commands/create_group_command.dart';
import 'package:m_edu/features/scheduling/application/commands/create_schedule_command.dart';
import 'package:m_edu/features/scheduling/domain/entities/schedule.dart';
import 'package:m_edu/features/settings/application/commands/create_backup_command.dart';
import 'package:m_edu/features/settings/application/commands/restore_backup_command.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/settings/domain/repositories/settings_repository.dart';
import 'package:m_edu/features/students/application/commands/register_student_command.dart';
import 'package:m_edu/features/students/application/commands/update_student_status_command.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import 'package:m_edu/features/teachers/application/commands/register_teacher_command.dart';

import '../helpers/fake_repositories.dart';

/// AUDIT P2-02: RBAC command authorization testlari.
///
/// Har bir sensitive mutation application layer'da `Permissions.require`
/// orqali tekshirilishi shart — UI tugmani yashirish security EMAS.
///
/// Ssenariylar:
///  1. authorized action → PASS
///  2. unauthorized action → DENY
///  3. unknown role → DENY
///  4. missing actor (default) → DENY  (fail-closed)
///  5. teacher boshqa himoyalangan resursga → DENY
///  6. student himoyalangan ma'lumotni o'zgartirsa → DENY
///  7. parent begona talabaga → DENY
///  8. admin ruxsat etilgan amallari → PASS
void main() {
  final bus = EventBus();

  Future<void> expectDenied<T>(
    Future<T> Function() action,
  ) async {
    await expectLater(action(), throwsA(isA<PermissionDeniedFailure>()));
  }

  group('RBAC command authorization (AUDIT P2-02)', () {
    test('1. authorized action → PASS', () async {
      final command = CreateGroupCommand(
        repository: FakeGroupRepository(),
        eventBus: bus,
        actorRole: UserRole.admin,
      );
      final group = await command.execute(
        const CreateGroupRequest(name: 'Matematika', capacity: 10),
      );
      expect(group.name, 'Matematika');
    });

    test('2. unauthorized action → DENY', () async {
      final command = CreateGroupCommand(
        repository: FakeGroupRepository(),
        eventBus: bus,
        // teacher manageGroups ruxsatiga ega EMAS.
        actorRole: UserRole.teacher,
      );
      await expectDenied(
        () => command.execute(
          const CreateGroupRequest(name: 'Guruh', capacity: 10),
        ),
      );
    });

    test('3. unknown role → DENY (hech qachon admin emas)', () async {
      final command = CreateGroupCommand(
        repository: FakeGroupRepository(),
        eventBus: bus,
        actorRole: UserRole.unknown,
      );
      await expectDenied(
        () => command.execute(
          const CreateGroupRequest(name: 'Guruh', capacity: 10),
        ),
      );
    });

    test('4. missing actor (default) → DENY — fail-closed', () async {
      // actorRole konstruktorga BERILMAGAN — default `unknown` bo'lishi shart.
      final command = CreateGroupCommand(
        repository: FakeGroupRepository(),
        eventBus: bus,
      );
      expect(command.actorRole, UserRole.unknown,
          reason: 'default actor admin bo\'lmasligi kerak (P0-3)');
      await expectDenied(
        () => command.execute(
          const CreateGroupRequest(name: 'Guruh', capacity: 10),
        ),
      );
    });

    test('5. teacher boshqa himoyalangan resursga kira olmaydi', () async {
      // manageStudents — teacher'ga berilmagan.
      final command = RegisterStudentCommand(
        repository: FakeStudentRepository(),
        identityRepository: FakeIdentityRepository(),
        eventBus: bus,
        actorRole: UserRole.teacher,
      );
      await expectDenied(
        () => command.execute(
          const RegisterStudentRequest(identityId: 'M-EDU-2026-000001'),
        ),
      );
    });

    test('6. student himoyalangan ma\'lumotni o\'zgartira olmaydi', () async {
      final command = UpdateStudentStatusCommand(
        repository: FakeStudentRepository(),
        eventBus: bus,
        actorRole: UserRole.student,
      );
      await expectDenied(
        () => command.execute('M-EDU-2026-000001', StudentStatus.frozen),
      );
    });

    test('7. parent begona talaba/ma\'lumotga kira olmaydi', () async {
      final command = RegisterTeacherCommand(
        repository: FakeTeacherRepository(),
        identityRepository: FakeIdentityRepository(),
        eventBus: bus,
        actorRole: UserRole.parent,
      );
      await expectDenied(
        () => command.execute(
          const RegisterTeacherRequest(identityId: 'M-EDU-2026-000002'),
        ),
      );
    });

    test('8. admin ruxsat etilgan amallarni bajaradi → PASS', () async {
      // Guruh yaratish (manageGroups).
      final groupCmd = CreateGroupCommand(
        repository: FakeGroupRepository(),
        eventBus: bus,
        actorRole: UserRole.admin,
      );
      await groupCmd.execute(
        const CreateGroupRequest(name: 'Ingliz tili', capacity: 12),
      );

      // Davomat belgilash (markAttendance).
      final attCmd = RecordAttendanceCommand(
        repository: FakeAttendanceRepository(),
        eventBus: bus,
        actorRole: UserRole.admin,
      );
      final result = await attCmd.execute(
        const RecordAttendanceRequest(
          identityId: 'M-EDU-2026-000001',
          fullName: 'Ali Valiyev',
          role: 'student',
          method: 'manual',
        ),
      );
      expect(result.recorded, isTrue);

      // Jadval yaratish (manageSchedule).
      final schedCmd = CreateScheduleCommand(
        repository: FakeScheduleRepository(),
        eventBus: bus,
        actorRole: UserRole.admin,
      );
      await schedCmd.execute(
        CreateScheduleRequest(
          groupId: 'GRP-1',
          teacherId: 'T-1',
          roomId: 'ROOM-1',
          dayOfWeek: DayOfWeek.monday,
          startTime: '09:00',
          endTime: '10:00',
        ),
      );
    });

    test('teacher o\'z ish oqimini bajaradi: davomat + jadval → PASS', () async {
      final attCmd = RecordAttendanceCommand(
        repository: FakeAttendanceRepository(),
        eventBus: bus,
        actorRole: UserRole.teacher,
      );
      final result = await attCmd.execute(
        const RecordAttendanceRequest(
          identityId: 'M-EDU-2026-000001',
          fullName: 'Ali Valiyev',
          role: 'student',
          method: 'manual',
        ),
      );
      expect(result.recorded, isTrue);

      final schedCmd = CreateScheduleCommand(
        repository: FakeScheduleRepository(),
        eventBus: bus,
        actorRole: UserRole.teacher,
      );
      final schedule = await schedCmd.execute(
        CreateScheduleRequest(
          groupId: 'GRP-1',
          teacherId: 'T-1',
          roomId: 'ROOM-1',
          dayOfWeek: DayOfWeek.tuesday,
          startTime: '10:00',
          endTime: '11:00',
        ),
      );
      expect(schedule.groupId, 'GRP-1');
    });
  });

  group('Backup RBAC (AUDIT P2-02: manageBackup)', () {
    test('admin zaxira yaratadi → PASS', () async {
      final repo = _FakeBackupSettingsRepository();
      final command = CreateBackupCommand(
        repository: repo,
        actorRole: UserRole.admin,
      );
      final path = await command.execute();
      expect(path, isNotEmpty);
      expect(repo.createCalls, 1);
    });

    test('teacher zaxira yarata olmaydi → DENY', () async {
      final repo = _FakeBackupSettingsRepository();
      final command = CreateBackupCommand(
        repository: repo,
        actorRole: UserRole.teacher,
      );
      await expectDenied(command.execute);
      expect(repo.createCalls, 0,
          reason: 'DENY bo\'lganda repository chaqirilmasligi kerak');
    });

    test('teacher zaxira\'dan tiklay olmaydi → DENY (destructive amal)', () async {
      final repo = _FakeBackupSettingsRepository();
      final command = RestoreBackupCommand(
        repository: repo,
        actorRole: UserRole.teacher,
      );
      await expectDenied(() => command.execute('/tmp/b.json'));
      expect(repo.restoreCalls, 0,
          reason: 'Ruxsatsiz restore hech qachon bajarilmasligi kerak');
    });

    test('superAdmin zaxira\'dan tiklaydi → PASS', () async {
      final repo = _FakeBackupSettingsRepository();
      final command = RestoreBackupCommand(
        repository: repo,
        actorRole: UserRole.superAdmin,
      );
      await command.execute('/tmp/b.json');
      expect(repo.restoreCalls, 1);
    });

    test('missing actor (default) → DENY — fail-closed', () async {
      final repo = _FakeBackupSettingsRepository();
      final command = CreateBackupCommand(repository: repo);
      expect(command.actorRole, UserRole.unknown,
          reason: 'default actor admin bo\'lmasligi kerak (P0-3)');
      await expectDenied(command.execute);
      expect(repo.createCalls, 0);
    });
  });
}

/// Backup command testlari uchun minimal settings repository fake'i.
class _FakeBackupSettingsRepository implements SettingsRepository {
  int createCalls = 0;
  int restoreCalls = 0;

  @override
  Future<String> createBackup() async {
    createCalls++;
    return '/tmp/m_edu_test_backup.json';
  }

  @override
  Future<void> restoreBackup(String backupPath) async {
    restoreCalls++;
  }

  @override
  Future<AppSettings> getSettings() async => const AppSettings();

  @override
  Future<AppSettings> saveSettings(AppSettings settings) async => settings;

  @override
  Future<List<AppUser>> fetchUsers() async => const [];

  @override
  Future<AppUser> addUser(AppUser user) async => user;

  @override
  Future<AppUser> updateUser(AppUser user) async => user;

  @override
  Future<void> deleteUser(String userId) async {}

  @override
  Future<List<Subject>> fetchSubjects() async => const [];

  @override
  Future<Subject> addSubject(Subject subject) async => subject;

  @override
  Future<Subject> updateSubject(Subject subject) async => subject;

  @override
  Future<void> deleteSubject(String subjectId) async {}

  @override
  Future<bool> isBiometricEnabled() async => false;

  @override
  Future<void> setBiometricEnabled(bool enabled) async {}
}
