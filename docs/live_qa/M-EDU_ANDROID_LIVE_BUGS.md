# M-EDU — ANDROID LIVE BUG REGISTER

Device: **Samsung Galaxy A27 (SM-A276B)**, Android 16 (API 36), 1080x2340
@450dpi, arm64-v8a · Session: 2026-08-17 · Build: debug 1.0.0+1

Severity: **P0** crash/data loss/security · **P1** major workflow broken ·
**P2** significant UX/performance · **P3** minor visual/comfort.

---

## BUG-001 — Back button exits app after student registration — ✅ FIXED

| Field | Value |
|---|---|
| ID | BUG-001 |
| Screen | Identity registration (`/identity/register`) → profile |
| Action | Register a student, then press Android Back |
| Expected | Return to previous screen (dashboard) |
| Actual | **App exited to launcher** (verified on device) |
| Severity | P1 |
| Evidence | Live: register "Aziz Karimov" → back → launcher; dump + logcat |
| Root cause | `register_identity_page.dart:76` — `context.go('/identity/:id')`.
  `/identity/:identityId` is a top-level route; `go()` rebuilds the whole
  stack, dropping the StatefulShell (dashboard). Back → nothing to pop →
  activity finished. |
| Fix | `context.pushReplacement('/identity/${id}')` (replaces register page,
  keeps the shell beneath) |
| Regression | `integration_test/live_qa_test.dart` (system-back after register must
  land on a real screen); full suite 797 tests pass |

## BUG-002 — Back button exits app after QR scan — ✅ FIXED

| Field | Value |
|---|---|
| ID | BUG-002 |
| Screen | Identity QR scan (`/identity/scan`) |
| Action | Successful QR scan → identity profile → press Back |
| Expected | Return to previous screen (attendance / identity list) |
| Actual | Same stack-replacement bug class as BUG-001 |
| Severity | P1 |
| Root cause | `identity_scan_page.dart:143` — `context.go('/identity/$raw')` |
| Fix | `context.pushReplacement('/identity/$raw')` |
| Regression | Same suite as BUG-001 |

## BUG-003 — P3: keyboard hides form fields + submit (no auto-scroll)

| Field | Value |
|---|---|
| Screen | Auth register, identity register, payment forms |
| Evidence | Live: with IME open the form viewport shrinks to y≤1332; phone/email
  fields + submit button fully hidden; taps at those coords hit the keyboard |
| Severity | P3 (workaround: manual scroll) |
| Fix (proposed) | `Scrollable.ensureVisible` on focus / `ScrollPadding` on the
  scroll views (G8a) |

## BUG-004 — P3: bottom content reaches screen edge (no safe-area)

| Field | Value |
|---|---|
| Screen | Identity profile "Ma'lumotlar" card, student detail "Davomat" row |
| Evidence | Live dumps: last card ends at y=2340 (screen bottom, under gesture bar) |
| Severity | P3 |
| Fix (proposed) | Bottom SafeArea/padding on those ListViews (G8b) |

## Observation — Android 16 16 KB page-size warning (not an app bug)

After install, Android shows the system compatibility warning: native libs
(isar, tflite, mpv, media_kit) are not 16 KB-page aligned. Informational;
tracks upstream native library alignment (G8c).

## Observation — registration UX ambiguity

The auth register button and the login register link share the label
"Ro'yxatdan o'tish". Cosmetic; consider distinct wording.
