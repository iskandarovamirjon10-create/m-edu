# M-Edu — Security

## Auth

- **Parol**: Argon2id (maxsus random salt, `cryptography` paketi).
  Legacy SHA-256 hash'lar login'da avtomatik re-hash qilinadi (migratsiya).
- **Session**: local secure storage, auth guard (GoRouter redirect).
- **Biometrik kirish**: `local_auth` (qurilma biometriyasi).
- **Hisob holati**: `userRecords.isActive` — deaktivatsiya qilingan user
  login qila olmaydi (sessiya restartda tiklanmaydi).
- Login rate limiting — login xatolar soni cheklangan.

## RBAC (fail-closed)

`lib/core/security/permissions.dart` — `Permissions.can/require` matritsa:

| Rol | Ruxsatlar (qisqacha) |
|---|---|
| super_admin | hamma narsa, users boshqaruvi |
| admin | users boshqaruvidan tashqari hammasi |
| director | admin darajasida (users yozish yo'q) |
| manager | operatsion + moliya ko'rish, users/audit yo'q |
| staff | o'quvchilar/guruhlar, moliya yo'q |
| teacher | davomat/attendance/grades, moliya boshqaruvi yo'q |
| student/parent/unknown | **hech narsa** (fail-closed) |

- Noma'lum rol → **minimal ruxsat** (hech qachon admin emas) — eski
  fail-open xato tuzatilgan.
- Ikki qatlam: UI gate + application-layer `Permissions.require`.

## Firebase rules

`config/firestore.rules` — server tomonida enforce (qarang:
`docs/FIREBASE_SETUP.md`). Negativ testlar: `test/unit/firestore_rules_test.dart`.

## Local data shifrlash

| Ma'lumot | Himoya |
|---|---|
| Face embedding | AES-256-GCM, kalit secure storage |
| Kamera paroli, Telegram token | `flutter_secure_storage` (Isar'da emas) |
| Parol hash | Argon2id |
| Qolgan Isar ma'lumotlari | at-rest shifrlanmagan (hujjatlashtirilgan cheklov) |

## Biometrik privacy

- Embedding cloud'ga hech qachon chiqmaydi (Firestore rules default deny).
- Plaintext embedding log/debug dump qilinmaydi.
- `tool/dump_device_db_test.dart` faqat metadata chiqaradi (vektor yo'q).
- Kalibrlash korpusi gitignore'da (real biometrik suratlar git'ga kirmaydi).

## Secrets

- Source code'da real secret yo'q (grep: API_KEY/TOKEN/PASSWORD/SECRET).
- Placeholder Firebase kalitlari olib tashlandi — config runtime faylda.
- `android/key.properties` + `.jks` gitignore'da.
- `AppLogger.redact` — parol/token/authorization/rtsp parol log'da
  yashiriladi (JWT dahil — `Authorization: Bearer <jwt>` to'liq redact).

## QR

Signed QR (Ed25519 + nonce replay himoyasi) — `signedQrNonceRecords`
replay'ni bloklaydi.

## Audit log

`auditLogRecords` — davomat o'zgartirish, to'lov, RBAC-ga sezgir amallar:
`actorId, action, targetId, timestamp, details` (old/new/who/when/reason).
Payment history o'chirib yuborilmaydi (refund/correction audit bilan).

## Backup xavfsizligi

- Restore oldidan avtomatik zaxira.
- Checksum (SHA-256) + schema versiya tekshiruvi.
- Restore atomic (yagona writeTxn) — muvaffaqiyatsiz bo'lsa eski ma'lumot
  qoladi.
