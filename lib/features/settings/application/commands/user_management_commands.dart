import '../../../../core/auth/local_auth_store.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/security/permissions.dart';
import '../../../audit/application/services/audit_service.dart';
import '../../../audit/domain/entities/audit_log_entry.dart';
import '../../domain/entities/app_settings.dart';

/// USER MANAGEMENT (PHASE E) — production-ready lifecycle command'lari.
///
/// Barchasi application layer'da RBAC bilan himoyalangan (faqat
/// `usersCreate/Edit/Deactivate/Delete` — superAdmin). Self-guard:
/// o'zini pastlatish/o'chirish va oxirgi superAdmin'ni yo'qotish
/// taqiqlanadi. Har bir amal audit log'ga yoziladi.
///
/// Permission faqat UI'da emas — shu yerda majburiy tekshiriladi
/// (spec §32: "UI tugmani yashirish security emas").

/// Yangi login hisob yaratish (rol aniq beriladi).
class CreateUserCommand {
  final LocalAuthStore _store;
  final AuditService? _audit;
  final UserRole actorRole;
  final String? actorEmail;

  CreateUserCommand({
    required LocalAuthStore store,
    AuditService? auditService,
    this.actorEmail,
    // FAIL CLOSED: actor berilmasa — DENY.
    this.actorRole = UserRole.unknown,
  })  : _store = store,
        _audit = auditService;

  Future<LocalAccount> execute({
    required String email,
    required String name,
    required String password,
    required UserRole role,
  }) async {
    Permissions.require(actorRole, AppPermission.usersCreate);

    final normalizedEmail = email.trim();
    if (normalizedEmail.isEmpty || !normalizedEmail.contains('@')) {
      throw const ValidationFailure("Email noto'g'ri formatda");
    }
    if (password.length < 6) {
      throw const ValidationFailure('Parol kamida 6 ta belgi bo\'lishi kerak');
    }

    // AUDIT P2-03: wire format orqali saqlash — 'super_admin' (register
    // bilan bir xil). `role.name` 'superAdmin' (camelCase) bo'lardi —
    // ikkita format aralashib qolmasligi uchun `role.wire` ishlatiladi.
    final account = await _store.createAccount(
      email: normalizedEmail,
      name: name.trim(),
      password: password,
      role: role.wire,
      createdBy: actorEmail,
    );
    if (account == null) {
      throw const ValidationFailure(
        "Bu email allaqachon ro'yxatdan o'tgan",
      );
    }

    await _audit?.record(
      action: AuditAction.userCreated,
      targetType: 'user',
      targetId: normalizedEmail,
      details: 'rol: ${role.name}',
    );
    return account;
  }
}

/// Hisobni tahrirlash (ism / rol). O'z rolini o'zgartirish taqiqlanadi
/// (lockout oldini olish) va oxirgi superAdmin demote qilinmaydi.
class UpdateUserCommand {
  final LocalAuthStore _store;
  final AuditService? _audit;
  final UserRole actorRole;
  final String? actorEmail;

  UpdateUserCommand({
    required LocalAuthStore store,
    AuditService? auditService,
    this.actorEmail,
    this.actorRole = UserRole.unknown,
  })  : _store = store,
        _audit = auditService;

  Future<LocalAccount> execute({
    required String email,
    String? name,
    UserRole? role,
  }) async {
    Permissions.require(actorRole, AppPermission.usersEdit);

    final normalizedEmail = email.trim();
    // Instance field promotion qilinmaydi — lokalga ko'chiramiz.
    final selfEmail = actorEmail?.trim().toLowerCase();
    final target = await _store.findByEmail(normalizedEmail);
    if (target == null) {
      throw const NotFoundFailure("Foydalanuvchi topilmadi");
    }

    // AUDIT P2-03: wire format bo'yicha solishtirish — 'super_admin' ham,
    // 'superAdmin' ham bir xil rol ekanini tan oladi.
    if (role != null && role.wire != target.role) {
      // O'z rolini o'zgartirib bo'lmaydi (lockout).
      if (selfEmail == normalizedEmail.toLowerCase()) {
        throw const ValidationFailure(
          "O'z rolingizni o'zgartira olmaysiz",
        );
      }
      // Oxirgi superAdmin demote qilinmaydi.
      // AUDIT P2-03: wire format ('super_admin') — enum nomi emas!
      if (UserRole.fromWire(target.role) == UserRole.superAdmin &&
          role != UserRole.superAdmin) {
        final superAdmins = (await _store.listAccounts())
            .where((a) => UserRole.fromWire(a.role) == UserRole.superAdmin)
            .length;
        if (superAdmins <= 1) {
          throw const ValidationFailure(
            "Oxirgi Super Admin rolini o'zgartirib bo'lmaydi",
          );
        }
      }
    }

    // AUDIT P2-03: `role.wire` — saqlash formati bitta bo'lsin.
    final updated = await _store.updateAccount(
      email: normalizedEmail,
      name: name?.trim(),
      role: role?.wire,
    );
    if (updated == null) {
      throw const NotFoundFailure("Foydalanuvchi topilmadi");
    }

    await _audit?.record(
      action: AuditAction.userUpdated,
      targetType: 'user',
      targetId: normalizedEmail,
      details: [
        if (name != null) 'ism: ${name.trim()}',
        if (role != null) 'rol: ${role.name}',
      ].join(', '),
    );
    return updated;
  }
}

/// Hisob holatini o'zgartirish: active / suspended / archived / restore.
class ChangeUserStatusCommand {
  final LocalAuthStore _store;
  final AuditService? _audit;
  final UserRole actorRole;
  final String? actorEmail;

  ChangeUserStatusCommand({
    required LocalAuthStore store,
    AuditService? auditService,
    this.actorEmail,
    this.actorRole = UserRole.unknown,
  })  : _store = store,
        _audit = auditService;

  Future<LocalAccount> execute({
    required String email,
    required AccountStatus status,
  }) async {
    Permissions.require(actorRole, AppPermission.usersDeactivate);

    final normalizedEmail = email.trim();
    // O'zini deaktivatsiya qilib bo'lmaydi (lockout).
    final selfEmail = actorEmail?.trim().toLowerCase();
    if (status != AccountStatus.active &&
        selfEmail == normalizedEmail.toLowerCase()) {
      throw const ValidationFailure("O'z hisobingizni faolsizlantira olmaysiz");
    }

    final updated =
        await _store.setStatus(email: normalizedEmail, status: status);
    if (updated == null) {
      throw const NotFoundFailure("Foydalanuvchi topilmadi");
    }

    await _audit?.record(
      action: AuditAction.userStatusChanged,
      targetType: 'user',
      targetId: normalizedEmail,
      details: 'holat: ${status.wire}',
    );
    return updated;
  }
}

/// Hisobni butunlay o'chirish (SECURE DELETE). O'zini va oxirgi
/// superAdmin'ni o'chirib bo'lmaydi.
class DeleteUserCommand {
  final LocalAuthStore _store;
  final AuditService? _audit;
  final UserRole actorRole;
  final String? actorEmail;

  DeleteUserCommand({
    required LocalAuthStore store,
    AuditService? auditService,
    this.actorEmail,
    this.actorRole = UserRole.unknown,
  })  : _store = store,
        _audit = auditService;

  Future<void> execute(String email) async {
    Permissions.require(actorRole, AppPermission.usersDelete);

    final normalizedEmail = email.trim();
    if (actorEmail?.trim().toLowerCase() == normalizedEmail.toLowerCase()) {
      throw const ValidationFailure("O'z hisobingizni o'chira olmaysiz");
    }

    final target = await _store.findByEmail(normalizedEmail);
    if (target == null) {
      throw const NotFoundFailure("Foydalanuvchi topilmadi");
    }
    // AUDIT P2-03: wire format ('super_admin') — enum nomi emas!
    if (UserRole.fromWire(target.role) == UserRole.superAdmin) {
      final superAdmins = (await _store.listAccounts())
          .where((a) => UserRole.fromWire(a.role) == UserRole.superAdmin)
          .length;
      if (superAdmins <= 1) {
        throw const ValidationFailure(
          "Oxirgi Super Admin hisobini o'chirib bo'lmaydi",
        );
      }
    }

    final deleted = await _store.deleteAccount(normalizedEmail);
    if (!deleted) {
      throw const NotFoundFailure("Foydalanuvchi topilmadi");
    }

    await _audit?.record(
      action: AuditAction.userDeleted,
      targetType: 'user',
      targetId: normalizedEmail,
    );
  }
}
