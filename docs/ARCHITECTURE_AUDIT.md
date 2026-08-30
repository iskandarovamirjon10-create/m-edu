# M-EDU — ARCHITECTURE_AUDIT (verified 2026-08-17)

Audit basis: source inspection + 797 passing tests + live device walkthrough.
Existing deep-dives: `docs/ARCHITECTURE.md`, `docs/DATABASE.md`,
`docs/SECURITY.md`, `docs/SYNC.md`, `docs/FACE_RECOGNITION.md`,
`docs/CAMERA.md`. This document is the v5-conformance assessment.

## 1. Layering (v5 §5, §7) — ✅ Conforms

```
presentation → application (commands/queries) → domain → repository → infrastructure
```

- **Domain** (`domain/entities`, `domain/rules`): no Flutter/DB/SDK imports —
  verified for identity, payments, attendance, groups, students.
- **Application** (`application/commands`, `application/queries`): domain-verb
  naming per v5 §1.8 — `RegisterIdentityCommand`, `ReceivePaymentCommand`,
  `RecordAttendanceCommand`, `TransferStudentCommand`,
  `AssignStudentToGroupCommand`, `UpdateStudentStatusCommand` ✅ (no raw
  Create/Update/Delete in business layer).
- **Infrastructure** (`infrastructure/repositories_impl`, `infrastructure/models`,
  `infrastructure/services`): Isar records, camera stream, face encryption,
  hikvision config, sync engine.
- **Presentation** consumes providers only; no business rules in widgets.

## 2. CQRS + event-driven (v5 §8) — ✅ Conforms

- Commands emit domain events (`IdentityRegisteredEvent`, `PaymentRecordedEvent`,
  `AttendanceRegisteredEvent`, group/transfer events).
- `EventSyncCoordinator` + projectors keep read-models in sync (Student read-model
  receives payment + group + attendance projections) — verified live: student card
  updated with group name + "To'langan" immediately after payment.
- Events carry actor/entityId/metadata; audit timeline (`AuditLogRecord`)
  separate from UI activity.

## 3. RBAC (v5 §17) — ✅ Conforms (fail-closed)

- Roles: superAdmin / director / admin / manager / teacher / student / parent.
- Granular permissions (`student.view`, `student.register`, `payment.record`, …)
  with `Permissions.require(actorRole, …)` gating commands (application layer).
- Route-level guard fixed (P2-04): uses `state.fullPath` — `state.name` is null
  at top-level redirect in go_router 14 (was silently disabling the guard).
- Unknown/absent role → `UserRole.unknown` (lowest privilege), never admin.
- Live-verified: superAdmin flow works; 20+ RBAC unit tests pass.

## 4. Authentication (v5 §18) — ✅ Conforms

- **Argon2id** with per-account 16-byte random salt; legacy v0 `sha256` records
  auto-upgrade on successful login (P1-05).
- Session in encrypted secure storage, TTL 30 days, invalidation on
  deactivation/archive (fail-closed, PHASE E), biometric quick-login with
  last-account memory. 30+ session/RBAC tests pass.

## 5. Database (v5 §29) — ✅ Conforms

- Isar, 26 collections, indexed, offline-first local truth.
- Versioned additive migrations with backup + verify + report
  (`AttendanceSchemaV2Migration`) — ran cleanly on device (0 records, backup file
  written). Corruption-resilience tests pass (corrupt records skipped, no crash).

## 6. Offline-first + sync (v5 §19–20) — ✅ Conforms (engine)

- Local DB = source of truth; sync queue (`SyncOperationRecord`: pending →
  processing → synced, retry on failure) in `core/network/sync_engine.dart`.
- Firebase optional: absent config → app runs offline-first without crashing
  (verified on device: "cloud sync o'chirilgan (offline-first rejim)").
- Sync never blocks UI (post-frame bootstrap).
- **Conflict handling**: version-based conflict detection (`RemoteWriteResult
  .conflicted`), operations marked `conflict` with remote version — never
  silently overwritten and never auto-retried. Blocked (conflict/permanent)
  operations are reviewable and resolvable by an admin in the diagnostics page
  (retry-with-newer-version = local-wins by explicit decision, or discard =
  accept remote) — GAPS-G4 now closed.

## 7. Face recognition (v5 §9, §32) — ✅ mostly / ⚠️ gaps

- Offline pipeline: camera → detection (ML Kit) → quality gates → embeddings
  (TFLite) → matching → confidence → identity decision → attendance.
- `FaceAttendanceGuard` (§17-18): active identity, group membership checks —
  20+ tests.
- Threshold calibration with EER + target-FPR recommendation; face data
  **encrypted at rest** (`face_encryption_service`), no embedding logging.
- Enrollment with consent/status/revoke workflow (face_enroll_page).
- **Liveness/anti-spoofing implemented** (GAPS-G5, 2026-08-17): landmark-based
  blink state machine (hysteresis, blink window, EAR geometry) on both ML Kit
  (eyeOpenProbability) and TFLite FaceMesh (EAR landmark sets); recognition and
  enrollment only after liveness passes; photo/screen replay rejected. Residual
  risk: high-quality video replay (documented — DECISIONS-D6, challenge-response
  deferred).

## 8. Camera (v5 §10) — ✅ Conforms

- `CameraService` abstraction over `CameraStreamService` + `HikvisionCameraConfig`
  adapter (RTSP). No direct SDK coupling in application layer.
- Camera unavailable → manual/QR attendance continues (verified live: attendance
  page empty-state with schedule CTA, identity scan page works without camera).

## 9. Reports (v5 §16) — ✅ Conforms

- Saved reports persisted (ReportRecord), revenue date-range query is real
  (filter → query, not UI-only) — verified in source; unit tests pass.

## 10. Payments (v5 §15) — ✅ Conforms

- Command-based `ReceivePaymentCommand` with receipt numbers (REC-000001 live),
  idempotency, debt tracking, UZS, expense records, finance aggregates
  (income/expense/balance + 6-month chart) — verified live.

## 11. Design system (v5 §23) — ✅ Conforms

- Custom Liquid Glass (no glassmorphism package): `LiquidAuroraBackground`
  (static radial blobs + RepaintBoundary — the previous per-frame blur perf bug
  is documented and fixed), GlassCard/GlassButton/GlassTextField, design tokens.
- **Design tokens now follow Liquid Glass v3.1** (2026-08-17, DECISIONS-D12):
  `AppColors` ThemeExtension is the single color source (brand `#4A6CF7`,
  v3.1 neutrals, glass surfaces 0.55/0.72/0.85, semantic solid bgs, dark §1.7),
  `app_tokens.dart` holds spacing/radius/blur (incl. dynamic 6→16)/shadows
  (surface/elevated/floating), `module_colors.dart` holds the 12 module accents
  + 4 camera colors. Rule: no hardcoded colors in new work.
- Theme mode (light/dark/system) + language (uz/ru/en) actually applied
  (P2 fixes), text scaling clamped 1.0–1.4.

## 12. Performance (v5 §24) — ⚠️ partial

- Aurora background static (no per-frame cost); lazy lists where used.
- **GAP: students list has no pagination/virtualization** (GAPS-G7) — acceptable
  at private-center scale (<2k students), revisit if growth.
- Live measurement (A27): no jank observed in walked flows; formal frame metrics
  pending device reconnection.

## 13. Risks / deviations found by this audit

| # | Finding | Severity |
|---|---|---|
| A1 | 193 uncommitted files — audit/rollback trail at risk | HIGH |
| A2 | No CI (analyze/test/build gates) — v5 §35 unmet | MEDIUM |
| A3 | ~~No liveness/anti-spoofing~~ — ✅ **FIXED 2026-08-17** (blink liveness, 13 tests; residual video-replay risk documented D6) | RESOLVED |
| A4 | Three-app split not started; single RBAC app (see DECISIONS-D1) | DECISION |
| A5 | Android 16: native libs not 16 KB-page aligned (system compat warning on first launch after install) | LOW (device-level) |
| A6 | P3 UX: forms don't auto-scroll focused field above keyboard; some pages' last card reaches screen bottom (no bottom safe-area padding) | LOW |
| A7 | Sync conflicts were detectable but had no review/resolution UI — ✅ **FIXED 2026-08-17** (admin diagnostics: retry/discard blocked ops) | RESOLVED |
