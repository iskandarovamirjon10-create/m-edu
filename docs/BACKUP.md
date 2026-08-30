# M-Edu — Backup / Restore / Disaster Recovery

## Backup

`DatabaseBackupService` — barcha **25 foydalanuvchi kolleksiyasini** (identity,
student, group, payment, debt, expense, schedule, room, grade, attendance,
attendance session, lead, lead activity, signed QR nonce, notification,
face, settings, user, subject, audit log, report, organization, teacher,
sequence counter, identity activity) bitta JSON faylga zaxiralaydi.

```
Backup fayl (m_edu_backup_<timestamp>.json):
  _meta: createdAt, appVersion, formatVersion, schemaVersion,
         recordCounts, checksum (SHA-256 payload ustida)
  collections: {collectionName: [ ...yozuvlar ]}
```

- Yozilgandan KEYIN qayta o'qib verify qilinadi — verify o'tmasa
  `BackupFailure` (yolg'on "zaxira yaratildi" yo'q).
- Fayllar app-support papkasida `backups/` da.
- **Eslatma**: `syncOperationRecords` va `deviceInfoRecords` zaxiraga
  kirmaydi — ular qurilma-sync holati (user data emas); mappers pending
  yozuvlarni keyingi sync pass'da qayta yig'adi.

## Restore

```
Select backup → decode + checksum + schema tekshiruvi
  → JORIY HOLATNI avtomatik zaxiralash (safety)
  → YAGONA writeTxn ichida: clear barcha kolleksiya + import
  → verify: har kolleksiya soni backup'dagiga teng bo'lishi shart
```

- **Atomic**: biror import xato bersa — BUTUN transaction rollback, eski
  ma'lumot saqlanib qoladi.
- Yangiroq schema bilan yaratilgan backup rad etiladi (ilovani yangilash
  kerak). Eski (past) schema backup'lari xavfsiz restore qilinadi
  (downgrade-safe).
- RBAC: backup/restore faqat admin+ (`settings_backup_rbac_test.dart`).

## Disaster recovery simulyatsiyalari

| Scenario | Natija |
|---|---|
| **A. DB corrupted** | App yagona baza — Isar corruption'da yangi baza ochiladi; backup'dan restore qilinadi (verify + atomic) |
| **B. Device lost** | Barcha ma'lumot cloud'da emas — qurilma ma'lumoti backup faylida; yangi qurilmaga restore (yangi deviceId bilan) |
| **C. Internet 24 soat yo'q** | Barcha yozuvlar Isar'da + sync queue'da — internet qaytgach avtomatik sync (hech narsa yo'qolmaydi) |
| **D. Firebase unavailable** | `isConfigured=false` → sync o'chirilgan, app to'liq offline ishlaydi; queue saqlanadi |
| **E. Camera unavailable** | Kamera holati UI'da, manual/QR davomat ishlaydi — attendance buzilmaydi |
| **F. App crash during sync** | Yozuvlar queue'da (inFlight → keyingi pass qayta urinadi, idempotent put) — hech narsa yo'qolmaydi |

## Backup rejalash (tavsiya)

- Admin qo'lda yoki tashqi scheduler bilan: har kun oxirida backup yaratish.
- Backup fayllarini tashqi disk/cloud'ga ko'chirish operator vazifasi
  (app ichida avtomatik tashqi upload yo'q — hujjatlashtirilgan).
- Restore'dan oldin joriy holatni saqlab qolish avtomatik.

## Testlar

`test/unit/backup_codec_test.dart` — round-trip, checksum, tampered fayl,
format/schema versiyalar. Restore atomic + count verify — integratsiya
testlari (`critical_user_flow_test.dart` restart bilan).
