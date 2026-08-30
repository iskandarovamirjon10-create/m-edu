# M-EDU — DECISIONS (updated 2026-08-17)

Per v5 §20: when a requirement is ambiguous, choose the safest maintainable
enterprise option and record it here.

## D1 — One application with RBAC vs three separate apps (v5 §3)

- **Decision**: **Keep the single app** with the existing role-based shell and
  route guards. Do NOT fork Admin/Teachers/Student apps in v5.
- **Rationale**: the single app already enforces role-specific permission layers
  (route guards + command gating + fail-closed roles). Forking into 3 apps would
  duplicate ~130k LOC and triple the maintenance surface with no user-facing
  security gain; the two "apps" can ship later as thin entry points
  (separate launchers/main files sharing `core`+`features`) if a market need
  (e.g., Play Store teacher/student editions) is proven.
- **Revisit when**: a real distribution requirement (separate Play listings,
  teacher-owned devices) appears.

## D2 — Database: Isar vs SQLite

- **Decision**: **Keep Isar 3.1**.
- **Rationale**: already used end-to-end (26 collections, migrations, indexes,
  reactive queries, corruption-resilience tests). Migrating to SQLite would be
  a rewrite with no benefit at current scale.

## D3 — Firebase sync is optional, not required

- **Decision**: keep the offline-first engine with optional Firebase;
  **no fake/required cloud**. Absent config = clean offline mode (verified on
  device). A real deployment supplies `m_edu_firebase.json` via
  `--dart-define=FIREBASE_CONFIG_PATH` (secure config mechanism, gitignored).
- **Rationale**: v5 §14/§19 require offline-first; cloud is a deployment choice.

## D4 — Password hashing

- **Decision**: **Argon2id** with per-account random salt (done, P1-05).
  Legacy `sha256(email:password)` records auto-upgrade on next successful login.
  No plain SHA-256 for new accounts — v5 §18 satisfied.

## D5 — Face recognition fallback

- **Decision**: face is a fast-path for attendance; **camera/face failure must
  never block attendance** — manual + QR flows continue (verified live).
  `RecognizeStudent` is gated by `FaceAttendanceGuard` (active identity + group
  membership) with configurable thresholds from EER/target-FPR calibration.

## D6 — Liveness/anti-spoofing scope

- **Decision**: implement **landmark-based blink/static-frame liveness** (no
  external service dependency) as G5; document residual risk for replay attacks
  and keep a settings toggle. Full challenge-response (random action prompts)
  deferred unless a deployment requires it.

## D7 — Students list pagination

- **Decision**: keep full-list rendering for now (private-center scale <2k);
  add Isar offset pagination only if measurement shows jank. Recorded as G7.

## D8 — UI density & text scaling

- **Decision**: 3 density presets (compact/comfortable/spacious) + system text
  scaling clamped 1.0–1.4 (P1-07). Prevents dense-glass layouts breaking at
  high scale while honoring accessibility.

## D9 — QR identity security

- **Decision**: signed QR (Ed25519 + nonce replay protection) is the identity
  credential; RFID left as a future adapter (hardware-dependent, no current
  reader hardware) — GAPS notes it; do not fake an RFID flow.

## D10 — Localization default

- **Decision**: Uzbek primary, Russian + English secondary (done). All business
  strings go through l10n; no hardcoded UI strings in new work.

## D11 — Camera abstraction

- **Decision**: `CameraService` → adapter (`HikvisionAdapter` via RTSP config)
  with future `DahuaAdapter`/`ONVIFAdapter`/`LocalCameraAdapter` behind the same
  interface (v5 §10). Never a single point of failure (D5).

## D12 — Liquid Glass Design System v3.1 token migration

- **Decision**: migrate the design token system to the Liquid Glass v3.1 spec
  (`docs/LIQUID_GLASS_TOKENS.md`) — brand `#4A6CF7`/`#7C4DFF`, v3.1 neutrals,
  glass surfaces (0.55/0.72/0.85), semantic solid backgrounds, 3-level shadow
  system, blur budget (12/8/20/24 + dynamic 6→16), radius 8/16/24/999.
- **Implemented** 2026-08-17: `AppColors` (ThemeExtension) remains the single
  color source with new theme-aware tokens (accentHover, brandSoft,
  glassElevated/Floating/Border, heroBg, glassSheen + gradient getters);
  `app_tokens.dart` shadow/blur/radius updated; new `module_colors.dart` holds
  the 12 module accents (§1.4) + 4 camera colors (§1.6) as theme-independent
  static tokens; hardcoded brand gradients in `app_theme.dart`/digital ID card
  replaced with tokens.
- **Rationale**: consistency (spec is the single source), reviewability (token
  names in code), and future rebrand/dark-mode = value-only change.
- **Rule going forward**: no hardcoded colors — only these tokens.
- **Notes**: dark-mode values not defined by the spec were derived consistently
  (marked `derived` in code); decorative role gradients (liquidPurple/Green/Gold)
  were intentionally left unchanged — only the brand gradient was migrated.

## D13 — Sync conflict resolution is admin-mediated

- **Decision**: conflicts are **never silently auto-resolved**. The engine
  detects version conflicts, blocks the operation (no data loss, no infinite
  retry), and surfaces it for an explicit admin decision: **retry** (re-queue
  with current version — this device wins, LWW by explicit choice) or
  **discard** (accept remote state as truth).
- **Rationale**: financial/attendance writes must not be resolved by blind
  last-write-wins; a human decision keeps an audit trail and prevents silent
  data loss (§24, §75).
- **Implemented** 2026-08-17 in the diagnostics page (`/settings/diagnostics`,
  `settingsView` permission): blocked (conflict/permanent) operations list with
  per-item retry/discard actions.

## D14 — Student list browse is paged; search/filter stays full-set

- **Decision**: the students list page loads **paged** by default (`findPage`
  offset/limit, 100/page, infinite scroll) — the entire table is no longer
  pulled into memory just to open the screen. `countAll` uses Isar `count()`
  (index-based) instead of `fetchAll().length`. Identity lookups for a page
  use `findByIds` (`anyOf`) — only the visible page's identities load.
- **Rationale**: v5 §24/Phase 16 — "avoid loading the entire student database
  into memory"; initial render and scroll cost stay bounded at 10k+ records.
- **Search/filter mode** keeps full-load deliberately: cross-field substring
  matching (name, ID, group, parent, phone, email) needs the set, and the
  180 ms debounce bounds per-keystroke work. Browsing — the common case — is
  now paged.
- **Implemented** 2026-08-17: datasource `findPage`/`countAll`/`findByIds`,
  repository/query passthroughs, `studentPageProvider`/`identityByIdsProvider`,
  page infinite scroll + post-frame initial load + version-invalidation reset.
- **Test**: `test/integration/student_list_scale_test.dart` (1,000-row
  synthetic corpus, 6 tests).
