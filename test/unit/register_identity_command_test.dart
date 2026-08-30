import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/identity/application/commands/register_identity_command.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/entities/identity_activity.dart';
import 'package:m_edu/features/identity/domain/events/identity_events.dart';
import 'package:m_edu/features/identity/domain/repositories/identity_repository.dart';
import 'package:m_edu/features/identity/domain/services/identity_id_generator.dart';
import 'package:m_edu/features/identity/domain/value_objects/real_id.dart';

void main() {
  // Fake generator deterministik — shu ID'ni qaytaradi (Random(42)).
  final expectedIdentityId = RealId.generate(
    now: DateTime(2026, 1, 1),
    random: Random(42),
  ).value;

  group('RegisterIdentityCommand', () {
    late FakeIdentityRepository repository;
    late FakeIdentityIdGenerator idGenerator;
    late EventBus eventBus;
    late RegisterIdentityCommand command;

    setUp(() {
      repository = FakeIdentityRepository();
      idGenerator = FakeIdentityIdGenerator();
      eventBus = EventBus();
      command = RegisterIdentityCommand(
        repository: repository,
        idGenerator: idGenerator,
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );
    });

    test('real ID, status=active, qrSeed va audit hodisa bilan saqlaydi',
        () async {
      final publishedFuture =
          eventBus.on<IdentityRegisteredEvent>().first.then((e) => e.identity);

      final identity = await command.execute(
        const RegisterIdentityRequest(
          firstName: 'Ali',
          lastName: 'Valiyev',
          role: IdentityRole.student,
        ),
      );

      final published = await publishedFuture;

      // A2/E2: ULID asosidagi global yagona ID (deterministik test id).
      expect(identity.identityId, expectedIdentityId);
      expect(identity.status, IdentityStatus.active);
      expect(identity.qrSeed, isNotEmpty);
      expect(identity.fullName, 'Ali Valiyev');

      // Repository'ga saqlangan va audit yozuv qo'shilgan.
      expect(repository.saved.length, 1);
      expect(repository.activities.length, 1);
      expect(
          repository.activities.first.type, IdentityActivityTypes.registered);

      // Event bus orqali tarqatilgan.
      expect(published.identityId, identity.identityId);
    });

    test('bo\'sh ism uchun ValidationFailure tashlaydi', () async {
      expect(
        () => command.execute(
          const RegisterIdentityRequest(
            firstName: ' ',
            lastName: 'Valiyev',
            role: IdentityRole.student,
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('noto\'g\'ri telefon uchun ValidationFailure tashlaydi', () async {
      expect(
        () => command.execute(
          const RegisterIdentityRequest(
            firstName: 'Ali',
            lastName: 'Valiyev',
            role: IdentityRole.teacher,
            phone: '12',
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('telefon raqamini normalizatsiya qiladi', () async {
      final identity = await command.execute(
        const RegisterIdentityRequest(
          firstName: 'Ali',
          lastName: 'Valiyev',
          role: IdentityRole.student,
          phone: '+998 90 123 45 67',
        ),
      );
      expect(identity.phone, '+998901234567');
    });

    test(
        'bir xil telefon raqami bilan qayta ro\'yxatdan o\'tkazish taqiqlanadi',
        () async {
      // Birinchi registratsiya.
      await command.execute(
        const RegisterIdentityRequest(
          firstName: 'Ali',
          lastName: 'Valiyev',
          role: IdentityRole.student,
          phone: '+998901234567',
        ),
      );

      // Ikkinchi registratsiya — bir xil telefon → DuplicateIdentityFailure.
      expect(
        () => command.execute(
          const RegisterIdentityRequest(
            firstName: 'Bekzod',
            lastName: 'Karimov',
            role: IdentityRole.student,
            phone: '+998 90 123 45 67',
          ),
        ),
        throwsA(isA<DuplicateIdentityFailure>()),
      );
    });

    test('takroriy identityId da DuplicateIdentityFailure tarqaladi', () async {
      // Repository'da allaqachon shu ID'li yozuv bor (bazadagi
      // unique-index holati simulyatsiyasi).
      repository.saved.add(
        Identity(
          identityId: expectedIdentityId,
          firstName: 'Eski',
          lastName: 'Yozuv',
          role: IdentityRole.staff,
          status: IdentityStatus.active,
          qrSeed: 'q-old',
          createdAt: DateTime.fromMillisecondsSinceEpoch(0),
        ),
      );
      idGenerator = FakeIdentityIdGenerator(duplicate: true);
      command = RegisterIdentityCommand(
        repository: repository,
        idGenerator: idGenerator,
        eventBus: eventBus,
        actorRole: UserRole.superAdmin,
      );

      expect(
        () => command.execute(
          const RegisterIdentityRequest(
            firstName: 'Ali',
            lastName: 'Valiyev',
            role: IdentityRole.student,
          ),
        ),
        throwsA(isA<DuplicateIdentityFailure>()),
      );
    });
  });
}

/// Test uchun deterministik ULID generator: Random(42) har safar BIR XIL
/// ID qaytaradi (duplicate senariylarida repo'ga shu ID bilan seed qilamiz).
class FakeIdentityIdGenerator implements IdentityIdGenerator {
  final bool duplicate;

  FakeIdentityIdGenerator({this.duplicate = false});

  @override
  Future<RealId> next() async {
    // Har chaqiruvda YANGI Random(42) — bir xil ketma-ketlikdan birinchi
    // ID qaytadi (deterministik, A2/E2: ULID global yagona).
    return RealId.generate(
      now: DateTime(2026, 1, 1),
      random: Random(42),
    );
  }
}

class FakeIdentityRepository implements IdentityRepository {
  final List<Identity> saved = [];
  final List<IdentityActivity> activities = [];

  @override
  Future<Identity> save(Identity identity) async {
    final exists = saved.any((i) => i.identityId == identity.identityId);
    if (exists) {
      throw const DuplicateIdentityFailure('Bu ID allaqachon mavjud');
    }
    saved.add(identity);
    return identity;
  }

  @override
  Future<void> recordActivity(IdentityActivity activity) async {
    activities.add(activity);
  }

  @override
  Future<Identity> updateStatus(
    String identityId,
    IdentityStatus newStatus,
  ) async {
    final index = saved.indexWhere((i) => i.identityId == identityId);
    if (index == -1) throw const NotFoundFailure('Topilmadi');
    return saved[index];
  }

  @override
  Future<Identity> update(Identity identity) async {
    final index = saved.indexWhere((i) => i.identityId == identity.identityId);
    if (index == -1) throw const NotFoundFailure('Topilmadi');
    saved[index] = identity;
    return identity;
  }

  @override
  Future<void> deleteByIdentityId(String identityId) async {
    saved.removeWhere((i) => i.identityId == identityId);
  }

  @override
  Future<int> repointActivities(
      String fromIdentityId, String toIdentityId) async {
    var count = 0;
    for (var i = 0; i < activities.length; i++) {
      final activity = activities[i];
      if (activity.identityId == fromIdentityId) {
        activities[i] = IdentityActivity(
          identityId: toIdentityId,
          type: activity.type,
          description: activity.description,
          occurredAt: activity.occurredAt,
        );
        count++;
      }
    }
    return count;
  }

  @override
  Future<Identity?> fetchByIdentityId(String identityId) async {
    for (final identity in saved) {
      if (identity.identityId == identityId) return identity;
    }
    return null;
  }

  @override
  Future<Identity?> fetchByPhone(String normalizedPhone) async {
    for (final identity in saved) {
      if (identity.phone == normalizedPhone) return identity;
    }
    return null;
  }

  @override
  Future<List<Identity>> fetchAll() async => List.of(saved);

  @override
  Future<List<Identity>> fetchByIds(List<String> identityIds) async =>
      saved.where((i) => identityIds.contains(i.identityId)).toList();

  @override
  Future<List<Identity>> fetchByRole(IdentityRole role) async =>
      saved.where((i) => i.role == role).toList();

  @override
  Future<List<Identity>> fetchByStatus(IdentityStatus status) async =>
      saved.where((i) => i.status == status).toList();

  @override
  Future<List<IdentityActivity>> fetchActivities(String identityId) async =>
      activities.where((a) => a.identityId == identityId).toList();
}
