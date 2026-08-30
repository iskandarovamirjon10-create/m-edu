import 'dart:math';

import '../../../../core/error/failures.dart';
import '../../../../core/event_bus/event_bus.dart';
import '../../../../core/security/permissions.dart';
import '../../../../features/settings/domain/entities/app_settings.dart';
import '../../domain/entities/identity.dart';
import '../../domain/entities/identity_activity.dart';
import '../../domain/events/identity_events.dart';
import '../../domain/repositories/identity_repository.dart';
import '../../domain/services/identity_id_generator.dart';
import '../../domain/value_objects/phone_number.dart';

/// Yangi shaxsni ro'yxatdan o'tkazish uchun so'rov (Command input).
class RegisterIdentityRequest {
  final String firstName;
  final String lastName;
  final String? middleName;
  final IdentityRole role;
  final String? phone;
  final String? email;
  final String? photoPath;

  const RegisterIdentityRequest({
    required this.firstName,
    required this.lastName,
    this.middleName,
    required this.role,
    this.phone,
    this.email,
    this.photoPath,
  });
}

/// `RegisterIdentity` command'i — CQRS bo'yicha yozish operatsiyasi.
///
/// Oqim: request → validatsiya → Real ID generatsiya → saqlash →
/// audit-log yozish → event tarqatish.
class RegisterIdentityCommand {
  final IdentityRepository _repository;
  final IdentityIdGenerator _idGenerator;
  final EventBus _eventBus;

  /// RBAC (AUDIT P2-02): identity yaratish — o'quvchilar boshqaruvi.
  /// Default `unknown` — actor berilmasa DENY (fail-closed).
  final UserRole actorRole;

  RegisterIdentityCommand({
    required IdentityRepository repository,
    required IdentityIdGenerator idGenerator,
    required EventBus eventBus,
    this.actorRole = UserRole.unknown,
  })  : _repository = repository,
        _idGenerator = idGenerator,
        _eventBus = eventBus;

  Future<Identity> execute(RegisterIdentityRequest request) async {
    // RBAC: ruxsat application layer'da tekshiriladi (UI emas).
    Permissions.require(actorRole, AppPermission.studentsCreate);

    final normalizedPhone = _normalizePhone(request.phone);
    _validate(request, normalizedPhone);
    await _ensureNoDuplicatePhone(normalizedPhone);

    final realId = await _idGenerator.next();
    final now = DateTime.now();

    final identity = Identity(
      identityId: realId.value,
      firstName: request.firstName.trim(),
      lastName: request.lastName.trim(),
      middleName: request.middleName?.trim(),
      role: request.role,
      status: IdentityStatus.active,
      phone: normalizedPhone,
      email: request.email?.trim().toLowerCase(),
      photoPath: request.photoPath,
      qrSeed: _generateQrSeed(),
      createdAt: now,
      syncVersion: 1,
      pendingSync: true,
    );

    final saved = await _repository.save(identity);

    final activity = IdentityActivity(
      identityId: saved.identityId,
      type: IdentityActivityTypes.registered,
      description:
          '${saved.fullName} (${_roleLabel(saved.role)}) ro\'yxatdan o\'tkazildi. '
          'ID: ${saved.identityId}',
      occurredAt: now,
    );
    await _repository.recordActivity(activity);

    _eventBus.publish(IdentityRegisteredEvent(
      identity: saved,
      occurredAt: now,
    ));

    return saved;
  }

  void _validate(RegisterIdentityRequest request, String? normalizedPhone) {
    if (request.firstName.trim().isEmpty || request.lastName.trim().isEmpty) {
      throw const ValidationFailure('Ism va familiya kiritilishi shart');
    }
    if (normalizedPhone == null &&
        request.phone != null &&
        request.phone!.trim().isNotEmpty) {
      throw const ValidationFailure('Telefon raqami noto\'g\'ri');
    }
    if (request.email != null &&
        request.email!.trim().isNotEmpty &&
        !request.email!.contains('@')) {
      throw const ValidationFailure('Email formati noto\'g\'ri');
    }
  }

  /// Telefon raqamini normalizatsiya qiladi; bo'sh/yo'q bo'lsa null qaytaradi.
  /// Noto'g'ri raqam uchun `ValidationFailure` tashlaydi.
  String? _normalizePhone(String? phone) {
    if (phone == null || phone.trim().isEmpty) return null;
    try {
      return PhoneNumber.validate(phone).normalized;
    } on FormatException catch (e) {
      throw ValidationFailure(e.message);
    }
  }

  /// QR-kod uchun yagona, taxmin qilib bo'lmaydigan seed (cryptographic random).
  /// Kelajakda dinamik QR rotatsiyasi uchun ishlatiladi (spec §3).
  String _generateQrSeed() {
    final random = Random.secure();
    return List.generate(8, (_) => random.nextInt(256))
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
  }

  /// Identity merge/dedup (spec §3): bir xil telefon raqami bilan ikki
  /// marta ro'yxatdan o'tkazish taqiqlanadi.
  Future<void> _ensureNoDuplicatePhone(String? phone) async {
    if (phone == null) return;
    final existing = await _repository.fetchByPhone(phone);
    if (existing != null) {
      throw DuplicateIdentityFailure(
        'Bu telefon raqami allaqachon ro\'yxatdan o\'tkazilgan: '
        '${existing.identityId} (${existing.fullName})',
      );
    }
  }

  static String _roleLabel(IdentityRole role) {
    return switch (role) {
      IdentityRole.student => 'o\'quvchi',
      IdentityRole.teacher => 'o\'qituvchi',
      IdentityRole.staff => 'xodim',
      IdentityRole.parent => 'ota-ona',
    };
  }
}
