# M-Edu Arxitektura

## Qatlamlar

Feature-first Clean Architecture + CQRS-uslub (Command/Query sinflari) +
Repository Pattern + Event-Driven (EventBus) + Riverpod DI + GoRouter.

```
lib/
├── main.dart                      — kirish nuqtasi, DB ochish, Firebase init
├── app/                           — composition root (event_sync, vibration_sync, auth_lifecycle)
├── core/
│   ├── auth/                      — session, local auth (Argon2id), biometric
│   ├── constants/                 — app_constants (secrets YO'Q)
│   ├── database/                  — Isar.open (27 kolleksiya)
│   ├── di/                        — Riverpod core providers
│   ├── error/                     — sealed Failure
│   ├── event_bus/                 — EventBus + projector'lar
│   ├── network/                   — Sync engine, Firestore sink, mappers
│   ├── router/                    — GoRouter + auth guard + RBAC gate
│   ├── security/                  — Permissions (RBAC matritsa)
│   ├── services/                  — AppLogger (redact), haptics
│   └── theme/                     — AppTheme (iOS27 glass tokenlar)
├── features/                      — attendance, auth, audit, crm, dashboard,
│                                    face_recognition, grades, groups, identity,
│                                    notifications, organization, payments,
│                                    reports, scheduling, settings, students, teachers
├── l10n/                          — uz/ru/en (ulanmagan emas — real)
└── shared/design_system/          — liquid/glass komponentlar
```

Har bir feature ichida:

```
feature/
├── presentation/   — sahifalar + Riverpod providerlar (UI holat)
├── application/    — Command/Query/Service (use-cases, RBAC tekshiruvi)
├── domain/         — Entity, Repository interfeysi, Event (platformadan mustaqil)
└── infrastructure/ — Isar model + datasource + repository impl + tashqi xizmat
```

## Qoidalar

1. **Domain hech qachon Flutter/Isar/Firebase'ga bog'lanmaydi** — faqat
   interfeyslar.
2. **RBAC ikki qatlamda**: UI'da ko'rinish (navigation gate) + command'da
   `Permissions.require` (application-layer, fail-closed).
3. **Offline-first**: barcha yozuvlar avval Isar'ga, keyin SyncEngine orqali
   cloud'ga. Hech qanday mock — Firebase sozlanmagan bo'lsa sync o'chirilgan,
   app to'liq ishlaydi.
4. **Event → state**: in-memory EventBus → `*ListVersionProvider` bump →
   UI avtomatik refresh. Read-modellar DB'dan re-derive qilinadi
   (event'lar faqat "invalidate" signali — qayta ishga tushganda hech narsa
   yo'qolmaydi).
5. **Pul — doim `int`** (so'm, tiyin emas). Float/double bilan pul
   hisoblash taqiqlanadi.
6. **Loglar — `AppLogger` orqali**, maxfiy ma'lumot avtomatik redact
   qilinadi.

## Routing

GoRouter `StatefulShellRoute.indexedStack` — 7 branch:
`/dashboard`, `/students`, `/attendance`, `/schedule`, `/more`, `/finance`
(yashirin), `/settings` (yashirin). Auth guard + RBAC gate + 404 sahifa.
Batafsil marshrut ro'yxati: `lib/core/router/app_router.dart`.

## DB

Isar 3.1.0 — 27 kolleksiya (qarang: `docs/DATABASE.md`). Additiv
migratsiyalar (`AttendanceSchemaV2Migration` — backup + verify + hisobot).

## Sync

`core/network/` — to'liq offline mutation queue:
`LOCAL WRITE → queue → remote put → ACK → markSynced`.
Retry: exponential backoff → retry limit → permanent (DO NOT RETRY FOREVER).
Conflict: versiya + server timestamp (LWW) — jimgina data loss yo'q
(qarang: `docs/SYNC.md`).

## Arxitektura qarorlari (ADR)

| Qaror | Sabab |
|---|---|
| Isar (sqflite/drift emas) | offline-first yadro, 3.1.0 ishlab chiqilgan; web cheklovi bor |
| Riverpod (bloc emas) | version-bump pattern, family provider, test oson |
| Firebase — runtime file config | secrets source'da emas; sozlanmasa offline |
| Face embedding AES-256-GCM | biometrik ma'lumot at-rest shifrlangan |
| Web — scope'dan chiqarilgan | Isar generated schema dart2js'da 64-bit hash kompilyatsiya bo'lmaydi (upstream) |
| Lesson Instance engine | 2 dars/kun = 2 alohida davomat yozuvi (P0-02) |
