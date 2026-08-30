import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/features/identity/application/queries/identity_duplicates_query.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/entities/identity_activity.dart';
import 'package:m_edu/features/identity/domain/repositories/identity_repository.dart';

void main() {
  group('IdentityDuplicatesQuery', () {
    late FakeIdentityRepository repository;
    late IdentityDuplicatesQuery query;

    setUp(() {
      repository = FakeIdentityRepository();
      query = IdentityDuplicatesQuery(repository: repository);
    });

    Identity identity({
      required String id,
      String firstName = 'Ali',
      String lastName = 'Valiyev',
      String? phone,
      String? email,
      IdentityStatus status = IdentityStatus.active,
    }) {
      return Identity(
        identityId: id,
        firstName: firstName,
        lastName: lastName,
        role: IdentityRole.student,
        status: status,
        phone: phone,
        email: email,
        qrSeed: 'seed-$id',
        createdAt: DateTime(2026, 1, 1),
      );
    }

    test("bir xil telefon raqami bo'yicha dublikat topiladi", () async {
      repository
          .seed(identity(id: 'M-EDU-2026-000001', phone: '+998901234567'));
      repository
          .seed(identity(id: 'M-EDU-2026-000002', phone: '+998 90 123 45 67'));
      repository.seed(
        identity(
          id: 'M-EDU-2026-000003',
          firstName: 'Bekzod',
          lastName: 'Karimov',
          phone: '+998903334455',
        ),
      );

      final duplicates = await query.findDuplicatesFor('M-EDU-2026-000001');

      expect(duplicates.length, 1);
      expect(duplicates.single.identity.identityId, 'M-EDU-2026-000002');
      expect(duplicates.single.matchedBy, DuplicateMatchReasons.phone);
      expect(duplicates.single.confidence, 1.0);
    });

    test("bir xil email bo'yicha dublikat topiladi (registr muhim emas)",
        () async {
      repository.seed(
        identity(id: 'M-EDU-2026-000001', email: 'Ali@Example.com'),
      );
      repository.seed(
        identity(id: 'M-EDU-2026-000002', email: 'ali@example.com'),
      );

      final duplicates = await query.findDuplicatesFor('M-EDU-2026-000001');

      expect(duplicates.length, 1);
      expect(duplicates.single.matchedBy, DuplicateMatchReasons.email);
    });

    test("ism-familiya o'xshashligi bo'yicha fuzzy dublikat topiladi",
        () async {
      // "Valiyev" vs "Valiev" — xato yozilgan ism holati.
      repository.seed(identity(id: 'M-EDU-2026-000001', lastName: 'Valiyev'));
      repository.seed(identity(id: 'M-EDU-2026-000002', lastName: 'Valiev'));

      final duplicates = await query.findDuplicatesFor('M-EDU-2026-000001');

      expect(duplicates.length, 1);
      expect(duplicates.single.matchedBy, DuplicateMatchReasons.name);
      expect(duplicates.single.confidence, greaterThanOrEqualTo(0.85));
    });

    test("kirill (rus) ismlar bo'yicha ham dublikat topiladi", () async {
      repository.seed(
        identity(
          id: 'M-EDU-2026-000001',
          firstName: 'Иван',
          lastName: 'Иванов',
        ),
      );
      repository.seed(
        identity(
          id: 'M-EDU-2026-000002',
          firstName: 'Иван',
          lastName: 'Иванова',
        ),
      );

      final duplicates = await query.findDuplicatesFor('M-EDU-2026-000001');

      expect(duplicates.length, 1);
      expect(duplicates.single.matchedBy, DuplicateMatchReasons.name);
    });

    test("bog'liq bo'lmagan identity dublikat hisoblanmaydi", () async {
      repository.seed(identity(id: 'M-EDU-2026-000001', lastName: 'Valiyev'));
      repository.seed(
        identity(
          id: 'M-EDU-2026-000002',
          firstName: 'Bekzod',
          lastName: 'Karimov',
          phone: '+998903334455',
          email: 'bekzod@example.com',
        ),
      );

      final duplicates = await query.findDuplicatesFor('M-EDU-2026-000001');

      expect(duplicates, isEmpty);
    });

    test("arxivlangan identity dublikat sifatida ko'rsatilmaydi", () async {
      repository
          .seed(identity(id: 'M-EDU-2026-000001', phone: '+998901234567'));
      repository.seed(
        identity(
          id: 'M-EDU-2026-000002',
          phone: '+998901234567',
          status: IdentityStatus.archived,
        ),
      );

      final duplicates = await query.findDuplicatesFor('M-EDU-2026-000001');

      expect(duplicates, isEmpty);
    });

    test("o'zi o'zini dublikat deb topilmaydi", () async {
      repository
          .seed(identity(id: 'M-EDU-2026-000001', phone: '+998901234567'));

      final duplicates = await query.findDuplicatesFor('M-EDU-2026-000001');

      expect(duplicates, isEmpty);
    });

    test("mavjud bo'lmagan identity uchun bo'sh ro'yxat qaytadi", () async {
      final duplicates = await query.findDuplicatesFor('M-EDU-2026-099999');

      expect(duplicates, isEmpty);
    });
  });
}

class FakeIdentityRepository implements IdentityRepository {
  final List<Identity> saved = [];

  void seed(Identity identity) => saved.add(identity);

  @override
  Future<Identity> save(Identity identity) async {
    seed(identity);
    return identity;
  }

  @override
  Future<void> recordActivity(IdentityActivity activity) async {}

  @override
  Future<Identity> update(Identity identity) async {
    final index = saved.indexWhere((i) => i.identityId == identity.identityId);
    if (index == -1) throw const NotFoundFailure('Topilmadi');
    saved[index] = identity;
    return identity;
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
  Future<int> repointActivities(
    String fromIdentityId,
    String toIdentityId,
  ) async {
    return 0;
  }

  @override
  Future<void> deleteByIdentityId(String identityId) async {
    saved.removeWhere((i) => i.identityId == identityId);
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
      const [];
}
