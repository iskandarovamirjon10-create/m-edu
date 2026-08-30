import 'package:flutter_test/flutter_test.dart';
import 'package:m_edu/core/auth/local_auth_store.dart';
import 'package:m_edu/core/error/failures.dart';
import 'package:m_edu/features/settings/application/commands/user_management_commands.dart';
import 'package:m_edu/features/settings/domain/entities/app_settings.dart';

import '../helpers/secure_storage_mock.dart';

/// USER MANAGEMENT command'lari (PHASE E) — RBAC + lifecycle + self-guard.
void main() {
  setUp(() {
    mockSecureStorageChannel();
    secureStorageMock.clear();
  });

  Future<LocalAuthStore> seedOwner() async {
    final store = LocalAuthStore();
    await store.register(
      email: 'owner@medu.uz',
      name: 'Owner',
      password: 'secret123',
    );
    return store;
  }

  group('CreateUserCommand', () {
    test('superAdmin yangi foydalanuvchi yaratadi → ALLOW', () async {
      final store = await seedOwner();
      final command = CreateUserCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      final account = await command.execute(
        email: 'teacher@medu.uz',
        name: 'Ali',
        password: 'secret123',
        role: UserRole.teacher,
      );
      expect(account.email, 'teacher@medu.uz');
      expect(account.role, 'teacher');
      expect(account.status, AccountStatus.active);
    });

    test('admin yarata olmaydi → DENY (usersCreate faqat superAdmin)',
        () async {
      final store = await seedOwner();
      final command = CreateUserCommand(
        store: store,
        actorRole: UserRole.admin,
        actorEmail: 'owner@medu.uz',
      );
      await expectLater(
        command.execute(
          email: 'x@medu.uz',
          name: 'X',
          password: 'secret123',
          role: UserRole.staff,
        ),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });

    test('duplicate email → ValidationFailure', () async {
      final store = await seedOwner();
      await store.createAccount(
        email: 'dup@medu.uz',
        name: 'Dup',
        password: 'secret123',
        role: 'teacher',
      );
      final command = CreateUserCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      await expectLater(
        command.execute(
          email: 'dup@medu.uz',
          name: 'Dup2',
          password: 'secret123',
          role: UserRole.teacher,
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('qisqa parol → ValidationFailure', () async {
      final store = await seedOwner();
      final command = CreateUserCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      await expectLater(
        command.execute(
          email: 'x@medu.uz',
          name: 'X',
          password: '123',
          role: UserRole.teacher,
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('missing actor → DENY (fail-closed)', () async {
      final store = await seedOwner();
      final command = CreateUserCommand(
        store: store,
        // actorRole berilmagan → unknown.
        actorEmail: 'owner@medu.uz',
      );
      await expectLater(
        command.execute(
          email: 'x@medu.uz',
          name: 'X',
          password: 'secret123',
          role: UserRole.teacher,
        ),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });

  group('UpdateUserCommand', () {
    test('superAdmin rol o\'zgartiradi → ALLOW', () async {
      final store = await seedOwner();
      await store.createAccount(
        email: 't@medu.uz',
        name: 'T',
        password: 'secret123',
        role: 'unknown',
      );
      final command = UpdateUserCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      final updated = await command.execute(
        email: 't@medu.uz',
        role: UserRole.manager,
      );
      expect(updated.role, 'manager');
    });

    test('o\'z rolini o\'zgartira olmaydi → ValidationFailure', () async {
      final store = await seedOwner();
      final command = UpdateUserCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      await expectLater(
        command.execute(
          email: 'owner@medu.uz',
          role: UserRole.teacher,
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('2 superAdmin bo\'lsa demote mumkin (guard oxirgini himoya qiladi)',
        () async {
      final store = await seedOwner();
      // Ikkinchi superAdmin — demote endi xavfsiz (lockout yo'q).
      await store.createAccount(
        email: 'boss@medu.uz',
        name: 'Boss',
        password: 'secret123',
        role: 'super_admin',
      );
      final command = UpdateUserCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'boss@medu.uz',
      );
      final updated = await command.execute(
        email: 'owner@medu.uz',
        role: UserRole.admin,
      );
      expect(updated.role, 'admin',
          reason: '2 ta superAdmin bo\'lganda demote ruxsat etiladi');
    });

    test('director tahrirlay olmaydi → DENY (usersEdit faqat superAdmin)',
        () async {
      final store = await seedOwner();
      await store.createAccount(
        email: 't@medu.uz',
        name: 'T',
        password: 'secret123',
        role: 'unknown',
      );
      final command = UpdateUserCommand(
        store: store,
        actorRole: UserRole.director,
        actorEmail: 'director@medu.uz',
      );
      await expectLater(
        command.execute(email: 't@medu.uz', role: UserRole.teacher),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });

  group('ChangeUserStatusCommand', () {
    test('superAdmin user deaktivatsiya qiladi → ALLOW, keyin login DENY',
        () async {
      final store = await seedOwner();
      await store.createAccount(
        email: 't@medu.uz',
        name: 'T',
        password: 'secret123',
        role: 'teacher',
      );
      final command = ChangeUserStatusCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      final updated = await command.execute(
        email: 't@medu.uz',
        status: AccountStatus.suspended,
      );
      expect(updated.status, AccountStatus.suspended);
      expect(updated.canLogin, isFalse,
          reason: 'suspended hisob kira olmasligi kerak (PHASE E)');
    });

    test('o\'zini deaktivatsiya qila olmaydi → ValidationFailure', () async {
      final store = await seedOwner();
      final command = ChangeUserStatusCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      await expectLater(
        command.execute(
          email: 'owner@medu.uz',
          status: AccountStatus.suspended,
        ),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('faollashtirish (restore) → ALLOW, canLogin true', () async {
      final store = await seedOwner();
      await store.createAccount(
        email: 't@medu.uz',
        name: 'T',
        password: 'secret123',
        role: 'teacher',
      );
      await store.setStatus(email: 't@medu.uz', status: AccountStatus.archived);
      final command = ChangeUserStatusCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      final restored = await command.execute(
        email: 't@medu.uz',
        status: AccountStatus.active,
      );
      expect(restored.canLogin, isTrue);
    });
  });

  group('DeleteUserCommand', () {
    test('superAdmin user o\'chiradi → ALLOW', () async {
      final store = await seedOwner();
      await store.createAccount(
        email: 't@medu.uz',
        name: 'T',
        password: 'secret123',
        role: 'teacher',
      );
      final command = DeleteUserCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      await command.execute('t@medu.uz');
      expect(await store.findByEmail('t@medu.uz'), isNull);
    });

    test('o\'zini o\'chira olmaydi → ValidationFailure', () async {
      final store = await seedOwner();
      final command = DeleteUserCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'owner@medu.uz',
      );
      await expectLater(
        command.execute('owner@medu.uz'),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('oxirgi superAdmin o\'chirib bo\'lmaydi → ValidationFailure',
        () async {
      final store = await seedOwner();
      final command = DeleteUserCommand(
        store: store,
        actorRole: UserRole.superAdmin,
        actorEmail: 'boss@medu.uz',
      );
      await expectLater(
        command.execute('owner@medu.uz'),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('teacher o\'chira olmaydi → DENY', () async {
      final store = await seedOwner();
      await store.createAccount(
        email: 't@medu.uz',
        name: 'T',
        password: 'secret123',
        role: 'teacher',
      );
      final command = DeleteUserCommand(
        store: store,
        actorRole: UserRole.teacher,
        actorEmail: 't@medu.uz',
      );
      await expectLater(
        command.execute('t@medu.uz'),
        throwsA(isA<PermissionDeniedFailure>()),
      );
    });
  });
}
