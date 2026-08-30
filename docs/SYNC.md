# M-Edu — Sync Engine (multi-device)

## Oqim

```
LOCAL WRITE (pendingSync=true)
    ↓
SyncEngine.processOnce() (har 60 soniyada + ishga tushganda)
    ↓ mapper.fetchPending() → SyncOperationDataSource.enqueue (DEDUP)
    ↓ RemoteDataSink.put/delete (Firestore — sozlangan bo'lsa)
    ↓ success → markSynced + queue clean
    ↓ network xato → markFailed (exponential backoff)
    ↓ validation xato → markPermanent (DO NOT RETRY FOREVER)
    ↓ versiya ziddiyati → markConflict (jimgina data loss yo'q)
```

## Queue (syncOperationRecords)

Har bir operatsiya uchun: `operationId` (deterministik — entityType+entityId),
`entityType`, `entityId`, `operationType` (upsert|delete), `payload`,
`version`, `retryCount`, `syncStatus`, `nextRetryAt`, `deviceId`.

- **Dedup**: bir xil entity uchun ikkinchi enqueue mavjud yozuvni
  yangilaydi (bitta operatsiya).
- **Permanent → pending**: yangi lokal o'zgarish bo'lsa yana pending bo'ladi.

## Retry (exponential backoff)

- Backoff: `2^retryCount` soniya (max 10 daqiqa).
- `maxRetries` (default 8) tugasa → `permanent` — avtomatik qayta
  urinilmaydi (operator ko'radi).
- **Validation xato → permanent darhol** (qayta urinish foydasiz).

## Conflict (ikkala qurilma bir vaqtda yozsa)

Strategiya: **versiya + server timestamp (last-write-wins)**.

- Firestore put `runTransaction` ichida: remote versiya > client versiya →
  `RemoteWriteResult.conflicted(remoteVersion)`.
- SyncEngine yozuvni `conflict` holatiga qo'yadi — ma'lumot jimgina
  yozilmaydi/yozib tashlanmaydi. Admin qayta ko'rib chiqadi.
- Idempotent put: ikki qurilma bir xil student qo'shsa — remote'da bitta
  yozuv (duplicate emas).

## Multi-device (5-6 qurilma)

- Har bir qurilma `deviceId` bilan yozadi (`DeviceIdentity`).
- `sync/{entityType}/items/{entityId}` — global namespace, idempotent.
- Batch: bitta pass'da `batchLimit` (default 100).
- **Sync xatosi appni hech qachon buzmaydi** (`SyncScheduler` xatolarni
  yutadi) — offline-first kafolati.

## Mappers

| Entity | Mapper |
|---|---|
| identity | IdentitySyncMapper |
| student | StudentSyncMapper |
| attendance | AttendanceSyncMapper |
| payment | PaymentSyncMapper |

Yangi sinxronlanadigan entity qo'shish: `SyncEntityMapper` implementatsiyasi
+ `buildSyncEngine` (sync_providers.dart) ro'yxatiga qo'shish.

## Firestore konfiguratsiyasi

Firebase sozlanmagan bo'lsa (`isConfigured=false`) — engine hech narsa
yubormaydi, queue Isar'da saqlanadi. Sozlangach — davom etadi (hech narsa
yo'qolmaydi). Qarang: `docs/FIREBASE_SETUP.md`.

## Testlar

`test/unit/sync_engine_test.dart` — offline-first, backoff, retry limit,
permanent (no-retry-forever), conflict, dedup, multi-device idempotent,
batch limit.
