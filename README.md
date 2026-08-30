# M-Edu — Ta'lim Markazi Boshqaruvi Tizimi

**M-Edu** — real o'quv markazi administratorlari har kuni ishlatadigan,
**offline-first**, **Android + Windows**'da ishlaydigan, kamera/face
recognition, davomat, to'lovlar, baholar, hisobotlar, bildirishnomalar,
backup va cloud synchronization'ga ega production education management
system.

```
              M EDU
                │
        ┌───────┴───────┐
     Android         Windows
        │               │
        └───────┬───────┘
            Presentation
                │
            Application
                │
              Domain
                │
          Infrastructure
           /     |     \
       Isar  Firebase  Camera
                │
              Cloud
```

## Asosiy imkoniyatlar

| Feature | Holat |
|---|---|
| Auth (offline, Argon2id) + RBAC (fail-closed) | ✅ |
| O'quvchilar / Guruhlar / O'qituvchilar / CRM | ✅ |
| Dars jadvali + Lesson Instance engine | ✅ |
| Davomat (dars bo'yicha, duplicate protection) | ✅ |
| Face ID (ML Kit, AES-256-GCM shifrlangan embedding) | ✅ |
| Hikvision kamera (RTSP + ISAPI + ONVIF) | ✅ |
| To'lovlar / Qarzlar / Xarajatlar (int-precision) | ✅ |
| Baholar + statistika | ✅ |
| Hisobotlar (kunlik/haftalik/oylik/daromad/qarz) | ✅ |
| Dashboard (real DB ma'lumotlari) | ✅ |
| Telegram bildirishnomalar (graceful) | ✅ |
| Backup/Restore (checksum + atomic + verify) | ✅ |
| Offline-first + Sync engine (exponential backoff) | ✅ |
| Firebase (Auth/Firestore) — runtime config | ✅ |
| Gamification (deterministik ballar) | ✅ |
| Audit log | ✅ |
| l10n: uz / ru / en | ✅ |

## Platforma holati

| Platforma | Holat |
|---|---|
| Android | ✅ release build PASS |
| Windows | ✅ release build PASS |
| Web | ⚠️ scope'dan chiqarilgan — Isar generated schema dart2js cheklovi (qarang: `docs/SETUP.md` §Web) |

## Tez boshlash

```bash
flutter pub get
flutter analyze          # 0 xato / 0 warning
flutter test             # barcha testlar PASS
flutter build apk --release
flutter build windows
```

**Release signing** (Android): `android/key.properties` kerak — yo'q bo'lsa
release build ataylab FAIL bo'ladi (debug keystore fallback TAQIQLANADI):

```bash
bash scripts/generate_release_keystore.sh   # key.properties + .jks yaratadi
```

## Hujjatlar

| Hujjat | Mazmun |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Qatlamlar, pattern'lar, qarorlar |
| [docs/SETUP.md](docs/SETUP.md) | Muhit, dev/prod rejimlar, Web scope |
| [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) | Firebase runtime config + rules deploy |
| [docs/DATABASE.md](docs/DATABASE.md) | Isar sxemasi, kolleksiyalar, migratsiyalar |
| [docs/SYNC.md](docs/SYNC.md) | Sync engine, retry, conflict, multi-device |
| [docs/FACE_RECOGNITION.md](docs/FACE_RECOGNITION.md) | ML pipeline, quality gate, kalibrlash |
| [docs/CAMERA.md](docs/CAMERA.md) | Hikvision, failure handling |
| [docs/SECURITY.md](docs/SECURITY.md) | RBAC, shifrlash, secrets, audit |
| [docs/BACKUP.md](docs/BACKUP.md) | Backup/Restore, disaster recovery |
| [docs/RELEASE.md](docs/RELEASE.md) | Android/Windows release qo'llanma |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Umumiy muammolar |

## Development ma'lumot generatori

```bash
# 1000 o'quvchi + to'lovlar/davomat/baholar — /tmp/m_edu_seed_1000 da
M_EDU_SEED_COUNT=1000 M_EDU_SEED_DIR=/tmp/m_edu_seed_1000 \
  flutter test tool/seed_data_test.dart

# + performance benchmark (build/benchmark.json)
M_EDU_SEED_COUNT=1000 M_EDU_SEED_BENCHMARK=1 \
  M_EDU_SEED_DIR=/tmp/m_edu_seed_1000 flutter test tool/seed_data_test.dart
```

Seed generator **production database'ga tegmaydi** — har doim alohida
katalogga yozadi (app data yo'llari qat'iy rad etiladi).

## Xavfsizlik (qisqacha)

- Parollar: Argon2id (maxsus salt, kuchsiz SHA-256 emas)
- Face embedding: AES-256-GCM, kalit `flutter_secure_storage`'da — cloud'ga
  hech qachon chiqmaydi
- Kamera paroli / Telegram token: secure storage'da (Isar'da emas)
- RBAC: fail-closed — noma'lum rol minimal ruxsat (hech qachon admin emas)
- Firebase rules: server tomonida rol tekshiruvi (`config/firestore.rules`)
- Loglar: parol/token/embedding hech qachon log qilinmaydi
  (`AppLogger.redact`)

## Litsenziya

Xususiy loyiha. `android/key.properties`, `test_data/`, `blobs/*.so` git'ga
kirmaydi (`.gitignore`).
