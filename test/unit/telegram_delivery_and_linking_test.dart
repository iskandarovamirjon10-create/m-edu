import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/notifications/application/commands/generate_telegram_linking_token_command.dart';
import 'package:m_edu/features/notifications/application/commands/process_telegram_linking_command.dart';
import 'package:m_edu/features/notifications/application/commands/send_monthly_report_command.dart';
import 'package:m_edu/features/notifications/domain/entities/telegram_linking_token.dart';
import 'package:m_edu/features/notifications/domain/entities/telegram_report_delivery.dart';
import 'package:m_edu/features/notifications/domain/entities/notification.dart';
import 'package:m_edu/features/notifications/domain/repositories/notification_repository.dart';
import 'package:m_edu/features/notifications/domain/repositories/telegram_linking_token_repository.dart';
import 'package:m_edu/features/notifications/domain/repositories/telegram_report_delivery_repository.dart';
import 'package:m_edu/features/notifications/infrastructure/services/telegram_service.dart';
import 'package:m_edu/features/reports/application/queries/monthly_report_queries.dart';
import 'package:m_edu/features/reports/domain/entities/monthly_attendance_summary.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';

import '../helpers/fake_repositories.dart';

// ── Fakes ──────────────────────────────────────────────────────────────

class _FakeTelegramService extends TelegramService {
  _FakeTelegramService({this.failFor = const {}});
  final Set<String> failFor;
  final List<String> sentChatIds = [];
  int sendCalls = 0;
  bool verifyResult = true;

  @override
  Future<bool> verifyBotToken(String botToken) async => verifyResult;

  @override
  Future<bool> sendMessage({
    required String botToken,
    required String chatId,
    required String text,
  }) async {
    sendCalls++;
    if (failFor.contains(chatId)) return false;
    sentChatIds.add(chatId);
    return true;
  }
}

class _FakeNotificationRepository implements NotificationRepository {
  final List<AppNotification> items = [];
  @override
  Future<AppNotification> save(AppNotification n) async { items.add(n); return n; }
  @override
  Future<AppNotification> update(AppNotification n) async => n;
  @override
  Future<AppNotification?> fetchById(String id) async => null;
  @override
  Future<List<AppNotification>> fetchAll() async => items;
  @override
  Future<List<AppNotification>> fetchUnread() async => [];
  @override
  Future<List<AppNotification>> fetchByTarget(String id) async => [];
  @override
  Future<List<AppNotification>> fetchByType(NotificationType t) async => [];
  @override
  Future<AppNotification> markAsRead(String id) async => throw UnimplementedError();
  @override
  Future<void> markAllAsRead({String? targetIdentityId}) async {}
  @override
  Future<int> countUnread({String? targetIdentityId}) async => 0;
  @override
  Future<AppNotification> archive(String id) async => throw UnimplementedError();
  @override
  Future<int> cleanupOld({int daysToKeep = 30}) async => 0;
}

class _FakeDeliveryRepo implements TelegramReportDeliveryRepository {
  final List<TelegramReportDelivery> items = [];
  final Set<String> sentSet = {};

  @override
  Future<TelegramReportDelivery> save(TelegramReportDelivery d) async { items.add(d); return d; }
  @override
  Future<TelegramReportDelivery> update(TelegramReportDelivery d) async {
    final i = items.indexWhere((x) => x.parentId == d.parentId && x.period == d.period);
    if (i >= 0) items[i] = d; else items.add(d);
    if (d.status == TelegramDeliveryStatus.sent) sentSet.add('${d.parentId}-${d.period}');
    return d;
  }
  @override
  Future<TelegramReportDelivery?> findByParentAndPeriod(String p, String pr) async {
    for (final d in items) { if (d.parentId == p && d.period == pr) return d; }
    return null;
  }
  @override
  Future<List<TelegramReportDelivery>> fetchByParent(String p) async => items.where((d) => d.parentId == p).toList();
  @override
  Future<List<TelegramReportDelivery>> fetchAll({int limit = 100}) async => items.take(limit).toList();
  @override
  Future<List<TelegramReportDelivery>> fetchPending() async => items.where((d) => d.isPending).toList();
  @override
  Future<List<TelegramReportDelivery>> fetchRetryable() async => items.where((d) => d.canRetry).toList();
  @override
  Future<bool> isAlreadySent(String p, String pr) async => sentSet.contains('$p-$pr');
  @override
  Future<bool> isPending(String p, String pr) async => false;
}

class _FakeTokenRepo implements TelegramLinkingTokenRepository {
  final List<TelegramLinkingToken> tokens = [];
  @override
  Future<TelegramLinkingToken> save(TelegramLinkingToken t) async { tokens.add(t); return t; }
  @override
  Future<TelegramLinkingToken?> findByToken(String token) async {
    for (final t in tokens) { if (t.token == token) return t; }
    return null;
  }
  @override
  Future<TelegramLinkingToken?> findLatestByParent(String id) async {
    for (final t in tokens.reversed) { if (t.identityId == id) return t; }
    return null;
  }
  @override
  Future<void> markUsed(String token, {required String telegramChatId, String? telegramUsername}) async {
    final t = await findByToken(token);
    if (t != null) {
      tokens.remove(t);
      tokens.add(TelegramLinkingToken(
        token: t.token, identityId: t.identityId, studentIdentityId: t.studentIdentityId,
        createdAt: t.createdAt, expiresAt: t.expiresAt, used: true, usedAt: DateTime.now(),
        telegramChatId: telegramChatId, telegramUsername: telegramUsername,
      ));
    }
  }
  @override
  Future<int> cleanupExpired() async => 0;
}

class _FakeStudentRepo extends FakeStudentRepository {
  Student? updateTarget;
  @override
  Future<Student> updateParentInfo(String identityId, {String? parentName, String? parentPhone, String? parentTelegramId}) async {
    final updated = Student(
      identityId: identityId, studentNumber: 1, groupId: 'G1', groupName: 'Test',
      parentName: parentName, parentPhone: parentPhone, parentTelegramId: parentTelegramId,
      studentStatus: StudentStatus.active, enrolledAt: DateTime(2026),
    );
    updateTarget = updated;
    return updated;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

MonthlyAttendanceSummary _summary({
  required String id, required String name, String? telegramId,
  int present = 10, int late = 1, int absent = 1, int excused = 0, int total = 12,
}) => MonthlyAttendanceSummary(
  identityId: id, fullName: name, parentTelegramId: telegramId,
  presentDays: present, lateDays: late, absentDays: absent,
  excusedDays: excused, totalSchoolDays: total,
);

// ── Tests ──────────────────────────────────────────────────────────────

void main() {
  group('MonthlyAttendanceSummary — enhanced stats', () {
    test('attendancePercent includes late days', () {
      final s = _summary(id: 'A', name: 'Ali', present: 8, late: 2, absent: 2, total: 12);
      // (8 + 2) / 12 * 100 = 83.33%
      expect(s.attendancePercent, closeTo(83.33, 1));
    });

    test('attendancePercent with excused days only counts present+late', () {
      final s = _summary(id: 'A', name: 'Ali', present: 8, late: 1, absent: 1, excused: 2, total: 12);
      // (8 + 1) / 12 * 100 = 75%
      expect(s.attendancePercent, closeTo(75.0, 1));
    });

    test('hasTelegramContact is false for null/empty', () {
      expect(_summary(id: 'A', name: 'X').hasTelegramContact, isFalse);
      expect(_summary(id: 'A', name: 'X', telegramId: '  ').hasTelegramContact, isFalse);
    });

    test('hasTelegramContact is true for valid chatId', () {
      expect(_summary(id: 'A', name: 'X', telegramId: '123').hasTelegramContact, isTrue);
    });
  });

  group('TelegramReportDelivery — copyWith and idempotency', () {
    test('copyWith preserves unchanged fields', () {
      final now = DateTime.now();
      final d = TelegramReportDelivery(
        parentId: 'P1', studentIdentityId: 'S1', telegramChatId: '999',
        period: '2026-08', createdAt: now, updatedAt: now,
      );
      final updated = d.copyWith(status: TelegramDeliveryStatus.sent, sentAt: now);
      expect(updated.parentId, 'P1');
      expect(updated.status, TelegramDeliveryStatus.sent);
      expect(updated.sentAt, now);
      expect(updated.period, '2026-08');
    });

    test('idempotencyKey is consistent', () {
      final d1 = TelegramReportDelivery(
        parentId: 'P1', studentIdentityId: 'S1', telegramChatId: '999',
        period: '2026-08', createdAt: DateTime.now(), updatedAt: DateTime.now(),
      );
      final d2 = d1.copyWith(status: TelegramDeliveryStatus.failed);
      expect(d1.idempotencyKey, d2.idempotencyKey);
      expect(d1.idempotencyKey, 'P1-2026-08');
    });

    test('canRetry: failed with attemptCount < 5', () {
      final d = TelegramReportDelivery(
        parentId: 'P1', studentIdentityId: 'S1', telegramChatId: '999',
        period: '2026-08', createdAt: DateTime.now(), updatedAt: DateTime.now(),
        status: TelegramDeliveryStatus.failed, attemptCount: 3,
      );
      expect(d.canRetry, isTrue);
    });

    test('canRetry: failed with attemptCount >= 5', () {
      final d = TelegramReportDelivery(
        parentId: 'P1', studentIdentityId: 'S1', telegramChatId: '999',
        period: '2026-08', createdAt: DateTime.now(), updatedAt: DateTime.now(),
        status: TelegramDeliveryStatus.failed, attemptCount: 5,
      );
      expect(d.canRetry, isFalse);
    });

    test('canRetry: sent status is not retryable', () {
      final d = TelegramReportDelivery(
        parentId: 'P1', studentIdentityId: 'S1', telegramChatId: '999',
        period: '2026-08', createdAt: DateTime.now(), updatedAt: DateTime.now(),
        status: TelegramDeliveryStatus.sent, attemptCount: 1,
      );
      expect(d.canRetry, isFalse);
    });
  });

  group('TelegramLinkingToken — validity', () {
    test('isValid: not used and not expired', () {
      final now = DateTime.now();
      final t = TelegramLinkingToken(
        token: 'abc', identityId: 'P1', studentIdentityId: 'S1',
        createdAt: now, expiresAt: now.add(const Duration(hours: 24)),
      );
      expect(t.isValid, isTrue);
      expect(t.isExpired, isFalse);
    });

    test('isExpired: past expiration', () {
      final t = TelegramLinkingToken(
        token: 'abc', identityId: 'P1', studentIdentityId: 'S1',
        createdAt: DateTime(2026), expiresAt: DateTime(2026),
      );
      expect(t.isExpired, isTrue);
      expect(t.isValid, isFalse);
    });

    test('isValid: used token is not valid', () {
      final now = DateTime.now();
      final t = TelegramLinkingToken(
        token: 'abc', identityId: 'P1', studentIdentityId: 'S1',
        createdAt: now, expiresAt: now.add(const Duration(hours: 24)),
        used: true,
      );
      expect(t.isValid, isFalse);
    });
  });

  group('ProcessTelegramLinkingCommand', () {
    ProcessTelegramLinkingCommand _buildCommand({
      required _FakeTokenRepo tokenRepo,
      _FakeStudentRepo? studentRepo,
    }) {
      return ProcessTelegramLinkingCommand(
        tokenRepository: tokenRepo,
        studentRepository: studentRepo ?? _FakeStudentRepo(),
      );
    }

    test('valid token → success and student updated', () async {
      final now = DateTime.now();
      final tokenRepo = _FakeTokenRepo();
      tokenRepo.tokens.add(TelegramLinkingToken(
        token: 'valid123token456789012345678901234567890123456789', identityId: 'P1', studentIdentityId: 'S1',
        createdAt: now, expiresAt: now.add(const Duration(hours: 24)),
      ));
      final studentRepo = _FakeStudentRepo();
      // Add a student so fetchByIdentityId can find it.
      studentRepo.students.add(Student(
        identityId: 'S1', studentNumber: 1, groupId: 'G1', groupName: 'Test',
        parentName: 'Ota-ona', parentPhone: '+998901234567',
        studentStatus: StudentStatus.active, enrolledAt: DateTime(2026),
      ));
      final cmd = _buildCommand(tokenRepo: tokenRepo, studentRepo: studentRepo);

      final result = await cmd.execute(
        token: 'valid123token456789012345678901234567890123456789', telegramChatId: '999', telegramUsername: 'testuser',
      );

      expect(result.success, isTrue);
      expect(result.message, contains('Muvaffaqiyatli'));
      expect(studentRepo.updateTarget?.parentTelegramId, '999');
    });

    test('invalid token → failure', () async {
      final cmd = _buildCommand(tokenRepo: _FakeTokenRepo());
      final result = await cmd.execute(token: 'bad', telegramChatId: '1');
      expect(result.success, isFalse);
      expect(result.message, contains('Noto\'g\'ri format'));
    });

    test('expired token → failure', () async {
      final tokenRepo = _FakeTokenRepo();
      tokenRepo.tokens.add(TelegramLinkingToken(
        token: 'expiredtoken12345678901234567890', identityId: 'P1', studentIdentityId: 'S1',
        createdAt: DateTime(2026), expiresAt: DateTime(2026),
      ));
      final cmd = _buildCommand(tokenRepo: tokenRepo);
      final result = await cmd.execute(token: 'expiredtoken12345678901234567890', telegramChatId: '1');
      expect(result.success, isFalse);
      expect(result.message, contains('muddati tugagan'));
    });

    test('used token → failure', () async {
      final now = DateTime.now();
      final tokenRepo = _FakeTokenRepo();
      tokenRepo.tokens.add(TelegramLinkingToken(
        token: 'usedtoken1234567890123456789012345', identityId: 'P1', studentIdentityId: 'S1',
        createdAt: now, expiresAt: now.add(const Duration(hours: 24)), used: true,
      ));
      final cmd = _buildCommand(tokenRepo: tokenRepo);
      final result = await cmd.execute(token: 'usedtoken1234567890123456789012345', telegramChatId: '1');
      expect(result.success, isFalse);
      expect(result.message, contains('allaqachon ishlatilgan'));
    });

    test('unknown token → failure', () async {
      final cmd = _buildCommand(tokenRepo: _FakeTokenRepo());
      final result = await cmd.execute(
        token: 'unknown1234567890123456789012345678901', telegramChatId: '1',
      );
      expect(result.success, isFalse);
      expect(result.message, contains('topilmadi'));
    });
  });

  group('GenerateTelegramLinkingTokenCommand', () {
    test('valid config → token generated with 128 chars', () async {
      final cmd = GenerateTelegramLinkingTokenCommand(
        tokenRepository: _FakeTokenRepo(),
        settingsRepository: FakeSettingsRepository(
          settings: const AppSettings(telegramBotToken: '123:TESTTOKEN'),
        ),
        telegramService: _FakeTelegramService()..verifyResult = true,
        actorRole: UserRole.superAdmin,
      );
      final result = await cmd.execute(identityId: 'P1', studentIdentityId: 'S1');
      expect(result.displayToken.length, 128);
      expect(result.token.identityId, 'P1');
      expect(result.token.studentIdentityId, 'S1');
      expect(result.token.isValid, isTrue);
    });

    test('no bot token → ValidationFailure', () async {
      final cmd = GenerateTelegramLinkingTokenCommand(
        tokenRepository: _FakeTokenRepo(),
        settingsRepository: FakeSettingsRepository(settings: const AppSettings()),
        telegramService: _FakeTelegramService(),
        actorRole: UserRole.superAdmin,
      );
      await expectLater(
        cmd.execute(identityId: 'P1', studentIdentityId: 'S1'),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('invalid bot token (API false) → ValidationFailure', () async {
      final cmd = GenerateTelegramLinkingTokenCommand(
        tokenRepository: _FakeTokenRepo(),
        settingsRepository: FakeSettingsRepository(
          settings: const AppSettings(telegramBotToken: 'bad:token'),
        ),
        telegramService: _FakeTelegramService()..verifyResult = false,
        actorRole: UserRole.superAdmin,
      );
      await expectLater(
        cmd.execute(identityId: 'P1', studentIdentityId: 'S1'),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('RBAC: unknown role → PermissionDeniedFailure', () async {
      final cmd = GenerateTelegramLinkingTokenCommand(
        tokenRepository: _FakeTokenRepo(),
        settingsRepository: FakeSettingsRepository(
          settings: const AppSettings(telegramBotToken: '123:TOKEN'),
        ),
        telegramService: _FakeTelegramService()..verifyResult = true,
        actorRole: UserRole.unknown,
      );
      await expectLater(
        cmd.execute(identityId: 'P1', studentIdentityId: 'S1'),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });

  group('SendMonthlyReportCommand — delivery history', () {
    test('delivery record saved for each sent report', () async {
      final telegram = _FakeTelegramService();
      final deliveryRepo = _FakeDeliveryRepo();
      final notifications = _FakeNotificationRepository();
      final settings = FakeSettingsRepository(
        settings: const AppSettings(
          sendMonthlyReport: true,
          telegramBotToken: '123:TESTTOKEN',
        ),
      );
      final summaries = [
        _summary(id: 'A', name: 'Ali', telegramId: '111'),
        _summary(id: 'B', name: 'Bobur', telegramId: '222'),
      ];
      final queries = _FakeMonthlyReportQueries(summaries: summaries);
      final command = SendMonthlyReportCommand(
        settingsRepository: settings,
        monthlyReportQueries: queries,
        notificationRepository: notifications,
        telegramService: telegram,
        deliveryRepository: deliveryRepo,
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      final result = await command.execute(year: 2026, month: 8);

      expect(result.sent, 2);
      expect(deliveryRepo.items.length, 2);
      // Both delivery records should be sent.
      expect(deliveryRepo.items.every((d) => d.isSent), isTrue);
    });

    test('failed delivery has error details', () async {
      final telegram = _FakeTelegramService(failFor: {'999'});
      final deliveryRepo = _FakeDeliveryRepo();
      final notifications = _FakeNotificationRepository();
      final settings = FakeSettingsRepository(
        settings: const AppSettings(
          sendMonthlyReport: true,
          telegramBotToken: '123:TESTTOKEN',
        ),
      );
      final summaries = [
        _summary(id: 'A', name: 'Ali', telegramId: '999'),
      ];
      final queries = _FakeMonthlyReportQueries(summaries: summaries);
      final command = SendMonthlyReportCommand(
        settingsRepository: settings,
        monthlyReportQueries: queries,
        notificationRepository: notifications,
        telegramService: telegram,
        deliveryRepository: deliveryRepo,
        eventBus: EventBus(),
        actorRole: UserRole.superAdmin,
      );

      final result = await command.execute(year: 2026, month: 8);

      expect(result.failed, 1);
      expect(deliveryRepo.items.length, 1);
      final d = deliveryRepo.items.first;
      expect(d.isFailed, isTrue);
      expect(d.errorCode, 'API_FALSE');
      expect(d.errorMessage, isNotNull);
    });
  });
}

class _FakeMonthlyReportQueries extends MonthlyReportQueries {
  _FakeMonthlyReportQueries({required this.summaries})
      : super(
          studentRepository: FakeStudentRepository(),
          identityRepository: FakeIdentityRepository(),
          attendanceRepository: FakeAttendanceRepository(),
        );

  final List<MonthlyAttendanceSummary> summaries;

  @override
  Future<List<MonthlyAttendanceSummary>> fetchForMonth(int year, int month) async => summaries;
}
