import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/core/event_bus/event_bus.dart';
import 'package:m_edu/features/attendance/domain/entities/attendance_entry.dart';
import 'package:m_edu/features/audit/application/services/audit_service.dart';
import 'package:m_edu/features/face_recognition/domain/value_objects/face_signature.dart';
import 'package:m_edu/features/identity/application/commands/merge_identity_command.dart';
import 'package:m_edu/features/identity/domain/entities/identity.dart';
import 'package:m_edu/features/identity/domain/entities/identity_activity.dart';
import 'package:m_edu/features/identity/domain/events/identity_events.dart';
import 'package:m_edu/features/identity/domain/repositories/identity_repository.dart';
import 'package:m_edu/features/payments/domain/entities/debt.dart';
import 'package:m_edu/features/payments/domain/entities/payment.dart';
import 'package:m_edu/features/students/domain/entities/student.dart';
import '../helpers/fake_repositories.dart';

void main() {
  group('MergeIdentityCommand', () {
    late FakeIdentityRepository repository;
    late FakeStudentRepository studentRepo;
    late FakePaymentRepository paymentRepo;
    late FakeAttendanceRepository attendanceRepo;
    late FakeFaceRecognitionRepository faceRepo;
    late EventBus eventBus;
    late MergeIdentityCommand command;

    setUp(() {
      repository = FakeIdentityRepository();
      studentRepo = FakeStudentRepository();
      paymentRepo = FakePaymentRepository();
      attendanceRepo = FakeAttendanceRepository();
      faceRepo = FakeFaceRecognitionRepository();
      eventBus = EventBus();
      command = MergeIdentityCommand(
        repository: repository,
        studentRepository: studentRepo,
        paymentRepository: paymentRepo,
        attendanceRepository: attendanceRepo,
        faceRepository: faceRepo,
        eventBus: eventBus,
        auditService: AuditService(
          repository: FakeAuditRepository(),
          actorLoader: () async => AuditActor.system,
        ),
        actorRole: UserRole.superAdmin,
      );
    });

    Identity identity({
      required String id,
      String? phone,
      String? email,
      String? photoPath,
      IdentityStatus status = IdentityStatus.active,
    }) {
      return Identity(
        identityId: id,
        firstName: 'Ali',
        lastName: 'Valiyev',
        role: IdentityRole.student,
        status: status,
        phone: phone,
        email: email,
        photoPath: photoPath,
        qrSeed: 'seed-$id',
        createdAt: DateTime(2026, 1, 1),
      );
    }

    test('dublikatni birlashtiradi: survivor saqlanadi, duplicate arxivlanadi',
        () async {
      final primary = identity(id: 'M-EDU-2026-000001', phone: '+998901234567');
      final duplicate =
          identity(id: 'M-EDU-2026-000002', phone: '+998901234567');
      repository.seed(primary);
      repository.seed(duplicate);
      repository.seedActivity(
        IdentityActivity(
          identityId: duplicate.identityId,
          type: IdentityActivityTypes.registered,
          description: 'eski yozuv',
          occurredAt: DateTime(2026, 1, 2),
        ),
      );

      final publishedFuture = eventBus.on<IdentityMergedEvent>().first;

      final merged = await command.execute(
        MergeIdentityRequest(
          primaryIdentityId: primary.identityId,
          duplicateIdentityId: duplicate.identityId,
        ),
      );

      final published = await publishedFuture;

      // Survivor qaytariladi va o'z ID'sini saqlaydi.
      expect(merged.identityId, primary.identityId);
      expect(
        repository.findById(primary.identityId)!.identityId,
        primary.identityId,
      );

      // Duplicate arxivlangan (audit izi saqlanadi, delete emas).
      expect(
        repository.findById(duplicate.identityId)!.status,
        IdentityStatus.archived,
      );

      // Activity timeline duplicate'dan survivor'ga ko'chirilgan.
      final survivorActivities =
          await repository.fetchActivities(primary.identityId);
      expect(
        survivorActivities.where((a) => a.description == 'eski yozuv').length,
        1,
      );
      expect(
        (await repository.fetchActivities(duplicate.identityId))
            .where((a) => a.description == 'eski yozuv'),
        isEmpty,
      );

      // Merge audit yozuvi qo'shilgan.
      expect(
        survivorActivities
            .any((a) => a.type == IdentityActivityTypes.identityMerged),
        isTrue,
      );

      // Event bus orqali tarqatilgan.
      expect(published.primary.identityId, primary.identityId);
      expect(published.duplicate.identityId, duplicate.identityId);
    });

    test("bo'sh maydonlar duplicate'dan to'ldiriladi, mavjud qiymat saqlanadi",
        () async {
      final primary =
          identity(id: 'M-EDU-2026-000001', email: 'primary@example.com');
      final duplicate = identity(
        id: 'M-EDU-2026-000002',
        phone: '+998901234567',
        email: 'dup@example.com',
        photoPath: '/photos/dup.jpg',
      );
      repository.seed(primary);
      repository.seed(duplicate);

      await command.execute(
        MergeIdentityRequest(
          primaryIdentityId: primary.identityId,
          duplicateIdentityId: duplicate.identityId,
        ),
      );

      final merged = repository.findById(primary.identityId)!;
      expect(merged.phone, '+998901234567'); // null → to'ldirildi
      expect(merged.email, 'primary@example.com'); // mavjud → saqlandi
      expect(merged.photoPath, '/photos/dup.jpg'); // null → to'ldirildi
    });

    test('bir xil identity birlashtirilmaydi → ValidationFailure', () async {
      final person = identity(id: 'M-EDU-2026-000001');
      repository.seed(person);

      expect(
        () => command.execute(
          MergeIdentityRequest(
            primaryIdentityId: person.identityId,
            duplicateIdentityId: person.identityId,
          ),
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test("mavjud bo'lmagan identity → NotFoundFailure", () async {
      final person = identity(id: 'M-EDU-2026-000001');
      repository.seed(person);

      expect(
        () => command.execute(
          MergeIdentityRequest(
            primaryIdentityId: person.identityId,
            duplicateIdentityId: 'M-EDU-2026-099999',
          ),
        ),
        throwsA(isA<NotFoundFailure>()),
      );
    });

    test("sabab (reason) audit yozuvida ko'rinadi", () async {
      final primary = identity(id: 'M-EDU-2026-000001', phone: '+998901234567');
      final duplicate =
          identity(id: 'M-EDU-2026-000002', phone: '+998901234567');
      repository.seed(primary);
      repository.seed(duplicate);

      await command.execute(
        MergeIdentityRequest(
          primaryIdentityId: primary.identityId,
          duplicateIdentityId: duplicate.identityId,
          reason: 'ikki marta yozilgan',
        ),
      );

      final activities = await repository.fetchActivities(primary.identityId);
      final mergeNote = activities
          .singleWhere((a) => a.type == IdentityActivityTypes.identityMerged);
      expect(mergeNote.description, contains('ikki marta yozilgan'));
      expect(mergeNote.description, contains(duplicate.identityId));
    });

    test("farq qiluvchi telefon/email audit yozuvida qayd etiladi", () async {
      // Ism-familiya bo'yicha mos kelgan, lekin telefonlari boshqa-boshqa.
      final primary = identity(
        id: 'M-EDU-2026-000001',
        phone: '+998901234567',
        email: 'primary@example.com',
      );
      final duplicate = identity(
        id: 'M-EDU-2026-000002',
        phone: '+998903334455',
        email: 'dup@example.com',
      );
      repository.seed(primary);
      repository.seed(duplicate);

      await command.execute(
        MergeIdentityRequest(
          primaryIdentityId: primary.identityId,
          duplicateIdentityId: duplicate.identityId,
        ),
      );

      // Survivor o'z qiymatlarini saqlaydi (ustiga yozilmaydi).
      final merged = repository.findById(primary.identityId)!;
      expect(merged.phone, '+998901234567');
      expect(merged.email, 'primary@example.com');

      // Yo'qotilgan qiymatlar audit yozuvida ko'rinadi.
      final activities = await repository.fetchActivities(primary.identityId);
      final mergeNote = activities
          .singleWhere((a) => a.type == IdentityActivityTypes.identityMerged);
      expect(mergeNote.description, contains('+998903334455'));
      expect(mergeNote.description, contains('dup@example.com'));
    });

    test('arxivlangan duplicate ham birlashtirilishi mumkin', () async {
      final primary = identity(id: 'M-EDU-2026-000001', phone: '+998901234567');
      final duplicate = identity(
        id: 'M-EDU-2026-000002',
        phone: '+998901234567',
        status: IdentityStatus.archived,
      );
      repository.seed(primary);
      repository.seed(duplicate);

      final merged = await command.execute(
        MergeIdentityRequest(
          primaryIdentityId: primary.identityId,
          duplicateIdentityId: duplicate.identityId,
        ),
      );

      expect(merged.identityId, primary.identityId);
      expect(
        repository.findById(duplicate.identityId)!.status,
        IdentityStatus.archived,
      );
    });

    test(
        'P0-01: Student/Payment/Debt/Attendance/Face yozuvlari primary '
        'identityId ga ko\'chiriladi', () async {
      final primary = identity(id: 'M-EDU-2026-000001');
      final duplicate =
          identity(id: 'M-EDU-2026-000002', phone: '+998901234567');
      repository.seed(primary);
      repository.seed(duplicate);

      // Duplicate identity'ga bog'langan yozuvlar.
      studentRepo.students.add(Student(
        identityId: duplicate.identityId,
        studentNumber: 1,
        studentStatus: StudentStatus.active,
        transferStatus: TransferStatus.none,
        paymentStatus: false,
        totalPaid: 0,
        enrolledAt: DateTime(2026, 1, 1),
      ));
      paymentRepo.payments.add(Payment(
        paymentId: 'PAY-1',
        studentIdentityId: duplicate.identityId,
        amount: 500000,
        paymentType: PaymentType.cash,
        paymentDate: DateTime(2026, 2, 1),
        status: PaymentStatus.completed,
      ));
      paymentRepo.debts.add(Debt(
        debtId: 'DEBT-1',
        studentIdentityId: duplicate.identityId,
        dueDate: DateTime(2026, 3, 1),
        totalAmount: 200000,
        paidAmount: 100000,
        remainingAmount: 100000,
        status: DebtStatus.partial,
        billingPeriod: '2026-02',
      ));
      attendanceRepo.entries.add(AttendanceEntry(
        identityId: duplicate.identityId,
        fullName: 'Ali Valiyev',
        role: 'student',
        attendanceDate: DateTime(2026, 2, 10),
        method: 'manual',
      ));
      await faceRepo.saveFace(
        identityId: duplicate.identityId,
        signature: const FaceSignature(vector: [0.1, 0.2, 0.3]),
        sampleCount: 3,
      );

      await command.execute(
        MergeIdentityRequest(
          primaryIdentityId: primary.identityId,
          duplicateIdentityId: duplicate.identityId,
        ),
      );

      // Barcha bog'liq yozuvlar endi PRIMARY identityId ostida.
      expect(
        (await studentRepo.fetchAll()).single.identityId,
        primary.identityId,
      );
      expect(
        (await paymentRepo.fetchAll()).single.studentIdentityId,
        primary.identityId,
      );
      expect(
        (await paymentRepo.fetchDebtsByStudentId(primary.identityId))
            .single
            .studentIdentityId,
        primary.identityId,
      );
      expect(
        (await attendanceRepo.fetchForIdentity(primary.identityId))
            .single
            .identityId,
        primary.identityId,
      );
      expect(await faceRepo.hasFace(primary.identityId), isTrue);
      expect(await faceRepo.hasFace(duplicate.identityId), isFalse);

      // Merge audit yozuvida repoint statistikasi ko'rinadi.
      final activities = await repository.fetchActivities(primary.identityId);
      final mergeNote = activities
          .singleWhere((a) => a.type == IdentityActivityTypes.identityMerged);
      expect(mergeNote.description, contains('Ko\'chirildi'));
    });

    test(
        "P0-01: ikkala tomonda yuz bo'lsa — survivor yuzi saqlanadi, "
        'duplicate yuzi o\'chiriladi', () async {
      final primary = identity(id: 'M-EDU-2026-000001');
      final duplicate =
          identity(id: 'M-EDU-2026-000002', phone: '+998901234567');
      repository.seed(primary);
      repository.seed(duplicate);

      await faceRepo.saveFace(
        identityId: primary.identityId,
        signature: const FaceSignature(vector: [9.0, 9.0]),
        sampleCount: 5,
      );
      await faceRepo.saveFace(
        identityId: duplicate.identityId,
        signature: const FaceSignature(vector: [0.1, 0.1]),
        sampleCount: 2,
      );

      await command.execute(
        MergeIdentityRequest(
          primaryIdentityId: primary.identityId,
          duplicateIdentityId: duplicate.identityId,
        ),
      );

      // Survivor o'z yuzini saqlaydi; duplicate'niki o'chiriladi.
      final survivorFace =
          await faceRepo.findFaceByIdentityId(primary.identityId);
      expect(survivorFace, isNotNull);
      expect(survivorFace!.signature.vector, [9.0, 9.0]);
      expect(await faceRepo.hasFace(duplicate.identityId), isFalse);
    });

    test("P0-01: faqat duplicate'da yuz bo'lsa — survivor'ga ko'chiriladi",
        () async {
      final primary = identity(id: 'M-EDU-2026-000001');
      final duplicate =
          identity(id: 'M-EDU-2026-000002', phone: '+998901234567');
      repository.seed(primary);
      repository.seed(duplicate);

      await faceRepo.saveFace(
        identityId: duplicate.identityId,
        signature: const FaceSignature(vector: [0.5, 0.6]),
        sampleCount: 4,
      );

      await command.execute(
        MergeIdentityRequest(
          primaryIdentityId: primary.identityId,
          duplicateIdentityId: duplicate.identityId,
        ),
      );

      expect(await faceRepo.hasFace(primary.identityId), isTrue);
      expect(await faceRepo.hasFace(duplicate.identityId), isFalse);
    });
  });
}

class FakeIdentityRepository implements IdentityRepository {
  final List<Identity> saved = [];
  final List<IdentityActivity> activities = [];

  void seed(Identity identity) => saved.add(identity);
  void seedActivity(IdentityActivity activity) => activities.add(activity);

  Identity? findById(String identityId) {
    for (final identity in saved) {
      if (identity.identityId == identityId) return identity;
    }
    return null;
  }

  @override
  Future<Identity> save(Identity identity) async {
    seed(identity);
    return identity;
  }

  @override
  Future<void> recordActivity(IdentityActivity activity) async {
    activities.add(activity);
  }

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
    final current = saved[index];
    final updated = Identity(
      identityId: current.identityId,
      firstName: current.firstName,
      lastName: current.lastName,
      middleName: current.middleName,
      role: current.role,
      status: newStatus,
      phone: current.phone,
      email: current.email,
      photoPath: current.photoPath,
      qrSeed: current.qrSeed,
      createdAt: current.createdAt,
      updatedAt: DateTime.now(),
      syncVersion: current.syncVersion + 1,
      pendingSync: true,
    );
    saved[index] = updated;
    return updated;
  }

  @override
  Future<int> repointActivities(
    String fromIdentityId,
    String toIdentityId,
  ) async {
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
  Future<void> deleteByIdentityId(String identityId) async {
    saved.removeWhere((i) => i.identityId == identityId);
    activities.removeWhere((a) => a.identityId == identityId);
  }

  @override
  Future<Identity?> fetchByIdentityId(String identityId) async =>
      findById(identityId);

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
