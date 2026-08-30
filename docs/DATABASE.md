# M-Edu — Local Database (Isar) va Migratsiyalar

## Umumiy

- **Isar 3.1.0**, offline-first — barcha o'qish/yozish lokal.
- 27 kolleksiya `lib/main.dart` da ro'yxatda (`AppDatabase.open`).
- **"No Demo Data" siyosati**: baza bo'sh ochiladi, hech qanday namunaviy
  yozuv kiritilmaydi. Development ma'lumot faqat `tool/seed_data_test.dart`
  orqali (alohida katalogga).
- Pul maydonlari **har doim `int`** (so'm) — float/double taqiqlangan.

## Kolleksiyalar

| Kolleksiya | Asosiy maydonlar | Izoh |
|---|---|---|
| identityRecords | identityId (unique), firstName, lastName, role, status, phone, qrSeed, syncVersion, pendingSync | Universal ID |
| identityActivityRecords | identityId, action, method, timestamp | Audit-activity |
| sequenceCounters | key, value | realId generator |
| organizationRecords | organizationId, name, plan, createdAt | First-run |
| studentRecords | identityId (unique), studentNumber, groupId, groupName, studentStatus, transferStatus, paymentStatus, totalPaid | |
| teacherRecords | teacherId, assignedGroupIds, weeklyHours, maxWeeklyHours | |
| groupRecords | groupId, name, capacity, currentSize, teacherIds, monthlyFee | currentSize denormalized |
| paymentRecords | paymentId, amount, discountAmount, lateFee, paidAmount, status, receiptNumber, billingPeriod | |
| debtRecords | debtId, studentIdentityId, totalAmount, paidAmount, remainingAmount, dueDate, status, billingPeriod, reminderSent | |
| expenseRecords | expenseId, amount, category, date | |
| scheduleRecords | scheduleId, groupId, teacherId, roomId, dayOfWeek, startTime, endTime | TEMPLATE |
| roomRecords | roomId, name, capacity | |
| gradeRecords | gradeId, studentIdentityId, subjectId, subjectName, value (2..5), date | |
| notificationRecords | notificationId, type, body, channel, deliveryState, delivered | |
| faceRecords | identityId (unique), signature (encrypted), sampleCount, source | AES-GCM |
| attendanceRecords (V2/V3) | identityId, timestamp, attendanceDate, lessonId, checkInAt, checkOutAt, status, method, isLegacyMerged | **1 talaba + 1 dars = 1 yozuv** |
| attendanceSessionRecords | lessonId, groupId, date, status | Dars sessiyalari |
| leadRecords / leadActivityRecords | CRM | |
| signedQrNonceRecords | nonce, identityId, expiry | QR replay himoyasi |
| settingsRecords | language, theme, hikvision*, scanIntervalMs, match/ambiguousThreshold | Parol/token NULL (secure storage) |
| userRecords | userId, identityId, email, role, isActive | RBAC |
| subjectRecords | subjectId, name, code, color | |
| auditLogRecords | actorId, action, targetId, timestamp, details | |
| reportRecords | reportId, type, title, dataJson, startDate, endDate | Saqlangan hisobotlar |
| syncOperationRecords | operationId, entityType, entityId, operationType, payload, version, retryCount, syncStatus, nextRetryAt | Sync queue |
| deviceInfoRecords | deviceId, ... | Qurilma identifikatsiyasi |

## Migratsiyalar

Isar 3 **additiv** migratsiyani qo'llaydi — yangi maydon qo'shilsa eski
baza avtomatik ochiladi, maydon o'chirish qo'llab-quvvatlanmaydi.

### Attendance V2/V3 (`AttendanceSchemaV2Migration`)

- Additiv, idempotent: backup → verify → merge → hisobot.
- Legacy V1 yozuvlar fizik o'chirilmaydi — `isLegacyMerged` bilan
  belgilanadi va so'rovlardan chiqariladi.
- Migration xato bersa ham app ishlaydi (eski yozuvlar timestamp'dan
  hosil qilinadi).

### Yangi migratsiya qo'shish

1. Modelga yangi maydon qo'sh (default bilan).
2. Agar semantic o'zgarish bo'lsa — `infrastructure/migrations/` da
  idempotent skript + test (backup+verify+hisobot pattern).
3. `backupSchemaVersion` ni oshir (`backup_codec.dart`) — eski backup'lar
  restore qilinaveradi (downgrade xavfsiz), yangi backup'lar eski
  versiyaga o'tkazilmaydi.

## Restore va backup

Qarang: `docs/BACKUP.md`. Restore **atomic** — yagona writeTxn'da
clear+import; muvaffaqiyatsiz bo'lsa BUTUN rollback (eski ma'lumot qoladi).
Restore'dan oldin joriy holat avtomatik zaxiralanadi.
