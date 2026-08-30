import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Argon2id parametrlari (OWASP tavsiyasi — interaktiv login uchun).
///
/// AUDIT P1-05 (spec §32): Ilgari `sha256('$email:$password')` ishlatilardi
/// — 1 iteratsiya, salt sifatida email, juda tez (offline brute-force
/// oson). Endi Argon2id: har bir hisob uchun alohida random salt.
const int _argon2MemoryKiB = 19456; // ~19 MiB
const int _argon2Iterations = 2;
const int _argon2Parallelism = 1;
const int _argon2HashLength = 32;
const int _saltLength = 16;

/// Saqlash formati (v1): `argon2id$<salt-b64>$<hash-b64>`
const String _argon2Prefix = 'argon2id\$';

/// Legacy (v0) format: `sha256('$email:$password')` — login'da avtomatik
/// Argon2id'ga ko'chiriladi (eski hisoblar buzilmaydi).
bool _isLegacyHash(String stored) =>
    !stored.startsWith(_argon2Prefix) && stored.isNotEmpty;

/// Parolni Argon2id bilan hash qiladi (yangi hisoblar uchun).
Future<String> hashPassword(String password, String email) async {
  final salt = _newSalt();
  final bytes = await _deriveBytes(password, salt);
  return '$_argon2Prefix$salt\$${base64Encode(bytes)}';
}

/// Berilgan saqlangan hash bo'yicha parolni tekshiradi.
///
/// Legacy SHA-256 hash'lar ham qo'llab-quvvatlanadi (migratsiya).
Future<bool> verifyPassword(
    String password, String email, String stored) async {
  if (_isLegacyHash(stored)) {
    // Legacy v0: sha256('$email:$password')
    // Constant-time comparison to prevent timing side-channel.
    final normalizedEmail = email.trim().toLowerCase();
    final legacyHash =
        sha256.convert(utf8.encode('$normalizedEmail:$password')).toString();
    return _constantTimeStringEquals(legacyHash, stored);
  }
  final parts = stored.split('\$');
  if (parts.length != 3) return false;
  final salt = parts[1];
  final expectedB64 = parts[2];
  try {
    final derived = await _deriveBytes(password, salt);
    return _constantTimeEquals(
      derived,
      base64Decode(expectedB64),
    );
  } catch (_) {
    return false;
  }
}

String _newSalt() {
  final random = Random.secure();
  final bytes = List<int>.generate(_saltLength, (_) => random.nextInt(256));
  return base64Encode(bytes);
}

Future<List<int>> _deriveBytes(String password, String saltB64) async {
  final algorithm = Argon2id(
    memory: _argon2MemoryKiB,
    iterations: _argon2Iterations,
    parallelism: _argon2Parallelism,
    hashLength: _argon2HashLength,
  );
  final key = await algorithm.deriveKey(
    secretKey: SecretKey(utf8.encode(password)),
    nonce: base64Decode(saltB64),
  );
  return key.extractBytes();
}

/// Doimiy vaqtda taqqoslash — byte array (timing attack himoyasi).
bool _constantTimeEquals(List<int> a, List<int> b) {
  if (a.length != b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff == 0;
}

/// Doimiy vaqtda taqqoslash — String (timing attack himoyasi).
bool _constantTimeStringEquals(String a, String b) {
  if (a.length != b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
  }
  return diff == 0;
}

/// Hisob holati (USER LIFECYCLE — PHASE E).
enum AccountStatus {
  /// Faol — kirishi mumkin.
  active,

  /// To'xtatilgan — vaqtincha kirishi taqiqlangan (keyin qayta
  /// faollashtirilishi mumkin).
  suspended,

  /// Arxivlangan — kirishi taqiqlangan, ma'lumot saqlanadi.
  archived,

  /// Noma'lum (eski/zararlangan yozuv) — FAIL CLOSED: kirish yo'q.
  unknown;

  /// Saqlash formati (string).
  String get wire => name;

  static AccountStatus fromWire(String? value) {
    for (final status in AccountStatus.values) {
      if (status.name == value) return status;
    }
    // Eski hisoblar (status maydoni yo'q) — faol deb hisoblanadi.
    if (value == null || value.isEmpty) return AccountStatus.active;
    return AccountStatus.unknown;
  }
}

/// Mahalliy ro'yxatdan o'tgan hisob (email → ism, parol hash'i va rol).
class LocalAccount {
  final String email;

  /// Ism (tahrirlanishi mumkin — updateAccount).
  String name;

  String passwordHash;

  /// Rol — `UserRole.name` qiymati ('super_admin', 'admin', 'teacher',
  /// 'staff', 'unknown').
  ///
  /// AUDIT P2-01 (RBAC, spec §14): rol endi hisob bilan birga saqlanadi —
  /// login'da hardcode qilinmaydi. Belgilanmagan hisob → `'unknown'`
  /// (hech qanday ruxsatga ega emas — DENY by default).
  String role;

  /// Hisob holati — faol bo'lmagan hisob kira olmaydi (PHASE E).
  AccountStatus status;

  /// Hisob yaratilgan vaqt.
  final DateTime createdAt;

  /// Oxirgi o'zgartirilgan vaqt.
  DateTime updatedAt;

  /// Oxirgi muvaffaqiyatli kirish vaqti (null — hali kirmagan).
  DateTime? lastLoginAt;

  /// Hisobni yaratgan foydalanuvchi email'i (null — birinchi hisob).
  final String? createdBy;

  LocalAccount({
    required this.email,
    required this.name,
    required this.passwordHash,
    this.role = 'unknown',
    this.status = AccountStatus.active,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.lastLoginAt,
    this.createdBy,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  /// Kirishga ruxsat bormi? (FAIL CLOSED: faqat active)
  bool get canLogin => status == AccountStatus.active;

  Map<String, dynamic> toJson() => {
        'email': email,
        'name': name,
        'passwordHash': passwordHash,
        'role': role,
        'status': status.wire,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
        'lastLoginAt': lastLoginAt?.toIso8601String(),
        'createdBy': createdBy,
      };

  factory LocalAccount.fromJson(Map<String, dynamic> json) => LocalAccount(
        email: json['email'] as String,
        name: json['name'] as String? ?? '',
        passwordHash: json['passwordHash'] as String? ?? '',
        role: json['role'] as String? ?? 'unknown',
        status: AccountStatus.fromWire(json['status'] as String?),
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
            DateTime.now(),
        lastLoginAt: DateTime.tryParse(json['lastLoginAt'] as String? ?? ''),
        createdBy: json['createdBy'] as String?,
      );
}

/// Mahalliy auth ma'lumotlari ombori.
///
/// ═══════════════════════════════════════════════════════════════════════
/// SECURITY MODEL — LOCAL-ONLY AUTHENTICATION
/// ═══════════════════════════════════════════════════════════════════════
///
/// This application uses LOCAL-ONLY authentication. This is an
/// INTENTIONAL ARCHITECTURE DECISION, not a missing feature.
///
/// Threat model:
/// - Authentication is device-scoped: accounts exist only on this device.
/// - There is NO server-side session validation.
/// - There is NO multi-device session revocation.
/// - The role stored locally is the ONLY authorization source.
/// - An attacker with physical device access AND device unlock can
///   potentially extract the SecureStorage encryption key (requires
///   root/jailbreak on modern Android/iOS).
///
/// What this means for production:
/// - RBAC enforcement in the app is CLIENT-SIDE ONLY.
/// - Firestore security rules provide SERVER-SIDE RBAC for cloud data.
/// - Local auth is sufficient for single-device deployment.
/// - For multi-device or high-security deployment, Firebase Auth
///   should be integrated (code exists in GoogleAuthService but is
///   not configured/verified).
///
/// Password storage:
/// - New passwords: Argon2id (OWASP recommended) with random salt.
/// - Legacy passwords: SHA-256 (auto-migrated to Argon2id on login).
/// - Stored in flutter_secure_storage (Android Keystore / iOS Keychain).
///
/// Eslatma: kelajakda Firebase Auth ulanganda shu sinf o'rniga
/// server-side tekshiruv ishlatiladi.
class LocalAuthStore {
  static const _accountsKey = 'm_edu_local_accounts_v1';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<List<LocalAccount>> _readAll() async {
    try {
      final raw = await _storage.read(key: _accountsKey);
      if (raw == null || raw.isEmpty) return [];
      final list = jsonDecode(raw) as List<dynamic>;

      // Eski (plaintext parol) hisoblarni Argon2id formatiga migratsiya.
      var migrated = false;
      final accounts = <LocalAccount>[];
      for (final e in list) {
        final map = e as Map<String, dynamic>;
        final email = map['email'] as String;
        final legacyPlain = map['password'] as String?;
        // Legacy (P2-01 dan oldingi) hisoblarda 'role' yo'q — ular hammasi
        // admin edi (eski xulq-atvor buzilmasligi uchun 'admin' saqlanadi).
        final role = map['role'] as String? ?? 'admin';
        if (legacyPlain != null && legacyPlain.isNotEmpty) {
          accounts.add(LocalAccount(
            email: email,
            name: map['name'] as String? ?? '',
            passwordHash: await hashPassword(legacyPlain, email),
            role: role,
            status: AccountStatus.fromWire(map['status'] as String?),
            createdAt: DateTime.tryParse(map['createdAt'] as String? ?? '') ??
                DateTime.now(),
            updatedAt: DateTime.tryParse(map['updatedAt'] as String? ?? '') ??
                DateTime.now(),
            lastLoginAt: DateTime.tryParse(map['lastLoginAt'] as String? ?? ''),
            createdBy: map['createdBy'] as String?,
          ));
          migrated = true;
        } else {
          final account = LocalAccount.fromJson(map);
          // Legacy (P2-02 dan oldingi): 'role' yozilmagan hisoblar hammasi
          // admin edi — parol allaqachon hash'langan bo'lsa ham 'admin'
          // sifatida migratsiya qilinadi (eski xulq-atvor buzilmaydi).
          if (map['role'] == null) {
            account.role = 'admin';
            migrated = true;
          }
          accounts.add(account);
        }
      }

      if (migrated) await _writeAll(accounts);
      return accounts;
    } catch (_) {
      // Buzilgan ma'lumot bo'lsa ham ilovani bloklamaymiz.
      return [];
    }
  }

  Future<void> _writeAll(List<LocalAccount> accounts) async {
    final payload = jsonEncode([
      for (final account in accounts) account.toJson(),
    ]);
    await _storage.write(key: _accountsKey, value: payload);
  }

  /// Ro'yxatdan o'tish. Email band bo'lsa `null` qaytaradi.
  ///
  /// AUDIT P2-01 (RBAC, spec §14): BIRINCHI hisob — egasi (owner) sifatida
  /// `'super_admin'` rolini oladi; keyingi hisoblar `'unknown'` rol bilan
  /// yaratiladi (hech qanday ruxsat yo'q). Ochiq registratsiya endi ADMIN
  /// yaratmaydi — rol faqat superAdmin tomonidan ko'tarilishi mumkin.
  Future<LocalAccount?> register({
    required String email,
    required String name,
    required String password,
  }) async {
    final accounts = await _readAll();
    if (accounts
        .any((a) => a.email.toLowerCase() == email.trim().toLowerCase())) {
      return null;
    }
    final isFirstAccount = accounts.isEmpty;
    final account = LocalAccount(
      email: email.trim(),
      name: name.trim(),
      passwordHash: await hashPassword(password, email),
      role: isFirstAccount ? 'super_admin' : 'unknown',
    );
    accounts.add(account);
    await _writeAll(accounts);
    return account;
  }

  /// Barcha hisoblarni qaytaradi (user management uchun).
  Future<List<LocalAccount>> listAccounts() => _readAll();

  /// Yangi hisob yaratadi (USER LIFECYCLE — faqat superAdmin).
  ///
  /// Rol ochiq-oydin beriladi (registratsiyadan farqli — rol superAdmin
  /// tomonidan belgilanadi). Email band bo'lsa `null` qaytaradi.
  Future<LocalAccount?> createAccount({
    required String email,
    required String name,
    required String password,
    required String role,
    String? createdBy,
  }) async {
    final accounts = await _readAll();
    if (accounts
        .any((a) => a.email.toLowerCase() == email.trim().toLowerCase())) {
      return null;
    }
    final account = LocalAccount(
      email: email.trim(),
      name: name.trim(),
      passwordHash: await hashPassword(password, email),
      role: role,
      createdBy: createdBy,
    );
    accounts.add(account);
    await _writeAll(accounts);
    return account;
  }

  /// Hisobni yangilaydi (ism / rol).
  Future<LocalAccount?> updateAccount({
    required String email,
    String? name,
    String? role,
  }) async {
    final accounts = await _readAll();
    for (final account in accounts) {
      if (account.email.toLowerCase() == email.trim().toLowerCase()) {
        if (name != null) account.name = name.trim();
        if (role != null) account.role = role;
        account.updatedAt = DateTime.now();
        await _writeAll(accounts);
        return account;
      }
    }
    return null;
  }

  /// Hisob holatini o'zgartiradi (active/suspended/archived).
  Future<LocalAccount?> setStatus({
    required String email,
    required AccountStatus status,
  }) async {
    final accounts = await _readAll();
    for (final account in accounts) {
      if (account.email.toLowerCase() == email.trim().toLowerCase()) {
        account.status = status;
        account.updatedAt = DateTime.now();
        await _writeAll(accounts);
        return account;
      }
    }
    return null;
  }

  /// Hisobni butunlay o'chiradi (SECURE DELETE — faqat superAdmin,
  /// o'zini va oxirgi superAdmin'ni o'chirib bo'lmaydi — command tekshiradi).
  Future<bool> deleteAccount(String email) async {
    final accounts = await _readAll();
    final before = accounts.length;
    accounts.removeWhere(
        (a) => a.email.toLowerCase() == email.trim().toLowerCase());
    if (accounts.length == before) return false;
    await _writeAll(accounts);
    return true;
  }

  /// Hisob rolini o'zgartirish (foydalanuvchi boshqaruvi / test).
  ///
  /// Rolni faqat superAdmin o'zgartira oladi — bu tekshiruv qo'ng'iroq
  /// qiluvchi command (application layer) darajasida bajariladi.
  Future<bool> updateRole({
    required String email,
    required String role,
  }) async {
    final updated = await updateAccount(email: email, role: role);
    return updated != null;
  }

  /// Email va parol mos kelsa hisobni qaytaradi, aks holda `null`.
  ///
  /// Legacy (SHA-256) hash bilan kirilganda — hisob Argon2id'ga
  /// ko'chiriladi (P1-05 migratsiya, foydalanuvchi sezmaydi).
  /// Oxirgi kirish vaqti (lastLoginAt) yangilanadi — USER LIFECYCLE.
  Future<LocalAccount?> authenticate({
    required String email,
    required String password,
  }) async {
    final accounts = await _readAll();
    for (final account in accounts) {
      if (account.email.toLowerCase() == email.trim().toLowerCase() &&
          await verifyPassword(password, email, account.passwordHash)) {
        var changed = false;
        if (_isLegacyHash(account.passwordHash)) {
          account.passwordHash = await hashPassword(password, email);
          changed = true;
        }
        account.lastLoginAt = DateTime.now();
        changed = true;
        if (changed) await _writeAll(accounts);
        return account;
      }
    }
    return null;
  }

  /// Email ro'yxatdan o'tganmi? (xato xabari uchun)
  Future<bool> emailExists(String email) async {
    final accounts = await _readAll();
    return accounts
        .any((a) => a.email.toLowerCase() == email.trim().toLowerCase());
  }

  /// Email bo'yicha hisobni topadi (sessiya tekshiruvi uchun).
  Future<LocalAccount?> findByEmail(String email) async {
    final accounts = await _readAll();
    for (final account in accounts) {
      if (account.email.toLowerCase() == email.trim().toLowerCase()) {
        return account;
      }
    }
    return null;
  }
}
