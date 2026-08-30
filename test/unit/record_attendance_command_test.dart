import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/attendance/application/commands/mark_attendance_status_command.dart';
import 'package:m_edu/features/attendance/application/commands/record_attendance_command.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/attendance/domain/events/attendance_events.dart';

import '../helpers/fake_repositories.dart';

/// §14 auto-toggle invariant — [RecordAttendanceCommand] yadrosi.
void main() {
  late FakeAttendanceRepository repository;
  late EventBus eventBus;
  late List<AttendanceMarkedEvent> published;
  late RecordAttendanceCommand command;

  /// Broadcast stream event'larni asinxron yetkazadi — kutamiz.
  Future<void> pump() => Future<void>.delayed(Duration.zero);

  setUp(() {
    repository = FakeAttendanceRepository();
    eventBus = EventBus();
    published = [];
    eventBus.on<AttendanceMarkedEvent>().listen((e) => published.add(e));
    command = RecordAttendanceCommand(
      repository: repository,
      eventBus: eventBus,
      actorRole: UserRole.superAdmin,
    );
  });

  group('RecordAttendanceCommand (auto-toggle)', () {

    test('birinchi belgilash — CHECK-IN (yangi yozuv)', () async {
      final result = await command.execute(_request());
      await pump();

      expect(result.recorded, isTrue);
      expect(result.action, AttendanceAction.checkIn);
      expect(result.entry, isNotNull);
      expect(result.entry!.checkInAt, isNotNull);
      expect(result.entry!.checkOutAt, isNull);
      expect(repository.entries, hasLength(1));
      expect(published, hasLength(1));
    });

    test('ikkinchi belgilash — CHECK-OUT (dublikat YARATILMAYDI)', () async {
      await command.execute(_request());
      final result = await command.execute(_request());
      await pump();

      expect(result.recorded, isTrue);
      expect(result.action, AttendanceAction.checkOut);
      expect(result.entry!.checkOutAt, isNotNull);
      // Hali ham bitta yozuv — §14: 1 talaba + 1 kun = 1 primary yozuv.
      expect(repository.entries, hasLength(1));
      expect(published, hasLength(2));
    });

    test('uchinchi belgilash — TAKRORIY (e\'tiborsiz)', () async {
      await command.execute(_request());
      await command.execute(_request());
      final result = await command.execute(_request());
      await pump();

      expect(result.recorded, isFalse);
      expect(result.action, AttendanceAction.duplicate);
      expect(result.isDuplicate, isTrue);
      expect(repository.entries, hasLength(1));
      expect(published, hasLength(2)); // takroriy event yuborilmaydi.
    });

    test('har bir student uchun alohida primary yozuv', () async {
      await command.execute(_request(identityId: 'M-EDU-2026-000001'));
      await command.execute(_request(identityId: 'M-EDU-2026-000002'));

      expect(repository.entries, hasLength(2));
    });

    test('bo\'sh identityId — ValidationFailure', () async {
      expect(
        () => command.execute(_request(identityId: '')),
        throwsA(isA<ValidationFailure>()),
      );
    });
  });

  // ═══════════ P0-02: dars (lesson) darajasidagi auto-toggle ═══════════
  group('RecordAttendanceCommand (lesson-scoped, V3)', () {
    test('bitta dars: check-in → check-out → takroriy — bitta yozuv', () async {
      final checkIn =
          await command.execute(_request(lessonId: 'LESSON-SCH-1-20260810'));
      final checkOut =
          await command.execute(_request(lessonId: 'LESSON-SCH-1-20260810'));
      final duplicate =
          await command.execute(_request(lessonId: 'LESSON-SCH-1-20260810'));
      await pump();

      expect(checkIn.action, AttendanceAction.checkIn);
      expect(checkOut.action, AttendanceAction.checkOut);
      expect(duplicate.action, AttendanceAction.duplicate);
      expect(repository.entries, hasLength(1));
      expect(repository.entries.single.lessonId, 'LESSON-SCH-1-20260810');
    });

    test('bir kunda ikkita dars — ikkita alohida yozuv', () async {
      await command.execute(_request(lessonId: 'LESSON-SCH-1-20260810'));
      await command.execute(_request(lessonId: 'LESSON-SCH-2-20260810'));
      await pump();

      expect(repository.entries, hasLength(2));
      expect(
        repository.entries.map((e) => e.lessonId).toSet(),
        {'LESSON-SCH-1-20260810', 'LESSON-SCH-2-20260810'},
      );
    });

    test('legacy kundalik yozuv dars aniqlanganda yangilanadi', () async {
      // V2: lessonId'siz belgilash.
      await command.execute(_request());
      expect(repository.entries.single.lessonId, isNull);

      // Dars aniqlangan belgilash — yangi yozuv emas, legacy yangilanadi.
      final result =
          await command.execute(_request(lessonId: 'LESSON-SCH-1-20260810'));
      await pump();

      expect(result.action, AttendanceAction.checkIn);
      expect(repository.entries, hasLength(1));
      expect(repository.entries.single.lessonId, 'LESSON-SCH-1-20260810');
    });
  });

  // ═══════════ P0-02: holat belgilash dars darajasida ═══════════
  group('MarkAttendanceStatusCommand (lesson-scoped, V3)', () {
    late MarkAttendanceStatusCommand statusCommand;

    setUp(() {
      // repository/eventBus — main() darajasidagi setUp'da yangilanadi.
      statusCommand = MarkAttendanceStatusCommand(
        repository: repository,
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );
    });

    test('dars bo\'yicha belgilash — lessonId bilan yozuv; tahrir bitta yozuv',
        () async {
      final result = await statusCommand.execute(
        _statusRequest(status: AttendanceStatus.present),
      );
      expect(result.entry.lessonId, 'LESSON-SCH-1-20260810');
      expect(repository.entries, hasLength(1));

      // Xuddi shu darsga absent → yangi yozuv emas, tahrir (V3 invariant).
      final edit = await statusCommand.execute(
        _statusRequest(status: AttendanceStatus.absent),
      );
      expect(edit.wasUpdated, isTrue);
      expect(repository.entries, hasLength(1));
      expect(repository.entries.single.status, 'absent');
      expect(repository.entries.single.lessonId, 'LESSON-SCH-1-20260810');
      // V4: tahrirlangan yozuv — "Tahrirlangan" belgisi (Tarix uchun).
      expect(repository.entries.single.editedAt, isNotNull);
    });

    test('yangi yozuvda editedAt null — asl holat (Tarix belgisi yo\'q)',
        () async {
      final result = await statusCommand.execute(
        _statusRequest(status: AttendanceStatus.present),
      );
      expect(result.wasUpdated, isFalse);
      expect(repository.entries.single.editedAt, isNull);
    });

    test('turli darslar — turli yozuvlar', () async {
      await statusCommand.execute(
        _statusRequest(
          lessonId: 'LESSON-SCH-1-20260810',
          status: AttendanceStatus.present,
        ),
      );
      await statusCommand.execute(
        _statusRequest(
          lessonId: 'LESSON-SCH-2-20260810',
          status: AttendanceStatus.late,
        ),
      );

      expect(repository.entries, hasLength(2));
    });
  });
}

RecordAttendanceRequest _request({
  String identityId = 'M-EDU-2026-000001',
  String? lessonId,
}) {
  return RecordAttendanceRequest(
    identityId: identityId,
    fullName: 'Ali Valiyev',
    role: 'student',
    method: 'face',
    lessonId: lessonId,
    confidence: 0.94,
    source: 'hikvision',
  );
}

MarkAttendanceStatusRequest _statusRequest({
  String? lessonId = 'LESSON-SCH-1-20260810',
  required AttendanceStatus status,
}) {
  return MarkAttendanceStatusRequest(
    identityId: 'M-EDU-2026-000001',
    fullName: 'Ali Valiyev',
    role: 'student',
    attendanceDate: DateTime(2026, 8, 10),
    lessonId: lessonId,
    status: status,
  );
}
