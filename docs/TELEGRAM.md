# Telegram Integration (Foundation + Slice 2 + Slice 3: Production Hardening)

> Status: **Foundation, command/callback surface and the production delivery
> pipeline are implemented and tested.**
> Identity, linking, webhook hardening, deduplication, distributed rate
> limiting, auditing, the full command router, signed inline-keyboard
> callbacks, role-specific menus, parent/child scoped data views and UZ/RU/EN
> localization are in place. Slice 3 closes the delivery gaps:
>
> - `TelegramAccount` is now the **authoritative** Telegram delivery identity
>   (the notification worker no longer reads `ParentAccount.telegramChatId`),
> - lifecycle (`ACTIVE`/`DISCONNECTED`/`BLOCKED`/`SUSPENDED`) is enforced on
>   every send and a permanent provider failure (`bot blocked`, `chat gone`)
>   marks the account `BLOCKED` so nothing is ever retried into a dead chat,
> - Telegram notification preferences (channel + per-category) and quiet hours,
> - a delivery-tracking model with categorized failures and idempotency,
> - bounded retention jobs, an admin observability endpoint and a Settings →
>   Integrations → Telegram UI.
>
> Still deliberately out of scope: the Telegram Mini App, and
> `/announcements` / `/reports` (no backing application services yet — see
> [Roadmap](#13-roadmap-what-is-not-implemented-yet)).

Telegram is a **communication channel** of the M-EDU platform, never a second
source of business truth and never an authorization authority. It is treated as
an external, fully untrusted client.

```
                    M-EDU CORE
                        │
          ┌─────────────┴─────────────┐
          ↓                           ↓
     Web client                  Telegram (untrusted)
          │                           │
          └─────────────┬─────────────┘
                        ↓
              M-EDU Application Layer
                        ↓
                 Domain / RBAC / tenant rules
                        ↓
             Notification pipeline (BullMQ)
                        ↓
        In-app · SMS · Email · Telegram (adapter)
```

---

## 1. Architecture

| Concern | Component |
| --- | --- |
| Bot API adapter (only place that calls Telegram) | `src/telegram/telegram.service.ts` |
| Link-token issue/consume, disconnect, status | `src/telegram/telegram-link.service.ts` |
| Webhook deduplication (`update_id`) | `src/telegram/telegram-update.service.ts` |
| Distributed limiter (attempts + command/callback floods + one-time claims) | `src/telegram/telegram-attempt-limiter.service.ts` |
| Public webhook endpoint | `src/telegram/telegram-webhook.controller.ts` |
| Self-service settings API | `src/telegram/telegram.controller.ts` |
| Authenticated request context (chat → principal → role) | `src/telegram/telegram-context.service.ts` |
| Signed callback envelopes | `src/telegram/telegram-callback.service.ts` |
| Command dispatch | `src/telegram/telegram-command.router.ts` + `commands/*` |
| Callback dispatch (buttons) | `src/telegram/telegram-callback.router.ts` |
| i18n catalogue (uz/ru/en) | `src/telegram/i18n/telegram-i18n.ts` |
| Keyboard builders / HTML escaping | `src/telegram/ui/*` |
| Lifecycle-aware delivery addressing + BLOCKED marking | `src/telegram/telegram-delivery.service.ts` |
| Admin observability (tenant-scoped) | `src/telegram/telegram-observability.service.ts` + `telegram-admin.controller.ts` |
| Delivery tracking (status/failure/attempts) | `src/notifications/notification-delivery.service.ts` |
| Telegram notification policy (channel, category, quiet hours) | `src/notifications/telegram-notification-policy.service.ts` |
| Quiet-hours timezone math (pure) | `src/notifications/quiet-hours.ts` |
| Quiet-hours deferred delivery sweep | `src/notifications/telegram-deferred-delivery.service.ts` |
| Delivery-record retention | `src/notifications/notification-retention.service.ts` |
| Domain-notification delivery (worker) | `src/notifications/events/notification-event.processor.ts` |
| Settings UI | `apps/web/src/components/TelegramIntegration.tsx` |

The module is split so the dependency graph stays acyclic:

- `TelegramCoreModule` — adapter, identity, linking, dedup, limiter, context,
  callback signing. Depends on **nothing** from the business domain. This is
  what `NotificationsModule` imports.
- `TelegramCommandsModule` — webhook, command/callback routers, command
  handlers. The ONLY place Telegram couples to business modules, and always
  through their application services (never repositories, never Prisma).

`HelpCommand` resolves the `TELEGRAM_COMMANDS` registry lazily via `ModuleRef`
(it is itself a member of the registry — constructor injection would be a DI
cycle). Both routers come from the core module; the limiter and update service
are exported from it for exactly that reason.

Domain notifications do **not** call the Telegram HTTP API from business
services. They emit a domain event onto the `notification-events` queue, whose
worker performs delivery. Telegram remains an integration, not a core
availability dependency: if Telegram is down, events are queued/retried and the
rest of the platform is unaffected.

---

## 2. Database

Migration: `prisma/migrations/20260925000000_add_telegram_identity/`
(idempotent, additive — no destructive changes).

### `TelegramAccount`
Durable mapping of an **external** Telegram identity onto an existing M-EDU
principal.

| Column | Notes |
| --- | --- |
| `telegramUserId` | Telegram int64, stored as **string** |
| `chatId` | DM chat id, stored as string |
| `status` | `TelegramAccountStatus` |
| `userId` / `parentAccountId` | exactly one is set (User row vs ParentAccount) |
| `linkedAt`, `lastSeenAt`, `disconnectedAt` | lifecycle timestamps |

Uniqueness: `telegramUserId` and `chatId` are **globally unique**. A single
central M-EDU bot is assumed, so one Telegram identity maps to at most one
M-EDU principal. (White-label/per-organization bots would require replacing
these uniques with `@@unique([botId, telegramUserId])` — deliberately not
implemented yet.)

### `TelegramLinkToken`
| Column | Notes |
| --- | --- |
| `tokenHash` | **SHA-256 only** — the raw token is never persisted |
| `targetType` | `USER` \| `PARENT_ACCOUNT` |
| `expiresAt`, `usedAt` | short TTL + atomic single-use marker |

### `TelegramUpdate`
`updateId BIGINT` primary key + `receivedAt`. Metadata only, **no payloads**.
This is what makes "process exactly once" a database guarantee across API
instances rather than a process-local `Map`.

### Legacy columns — migration state (release N)

`User.telegramChatId` and `ParentAccount.telegramChatId` remain as a
**compatibility mirror** and are `@deprecated` in `schema.prisma`. They are no
longer a delivery input:

| Consumer | State |
| --- | --- |
| `src/notifications/events/notification-event.processor.ts` | **Migrated.** The parent Telegram path resolves `TelegramAccount` (`status = ACTIVE`, same `organizationId`) via `TelegramDeliveryService`. The legacy column is never read to address a message. |
| `src/telegram/telegram-link.service.ts` | Dual-writes the mirror on link, clears it on disconnect/block (release N). |
| `src/telegram/telegram-delivery.service.ts` | Clears the mirror on a permanent failure, but only when it still points at that exact chat. |
| `src/automation/automation.service.ts` | Resolves a chat id from `entity.data.telegramChatId` (rule payload data, not the User column) or an explicit `action.chatId`. Reads no schema column; rule payloads should migrate to `TelegramAccount` lookups in the automation slice. |
| `src/common/selects/user.select.ts` | Strips the column from API responses (security allowlist). Must remain until the column is dropped. |

Explicit release plan:

- **release N (current)** — `TelegramAccount` authoritative for delivery;
  legacy columns dual-written as a compatibility mirror.
- **release N+1** — remove the dual-write (leave the columns in place,
  unread/unwritten) and verify no consumer remains.
- **release N+2** — drop `telegramChatId`, `telegramLinkToken` and
  `telegramLinkExpiresAt` in an explicitly-justified, destructive migration.

The old plaintext `telegramLinkToken` / `telegramLinkExpiresAt` columns were
already no longer written or read; they are dropped in release N+2 only.

Tests preventing regression: `telegram-link.service.spec.ts` asserts the
mirror write/cleanup; `telegram-delivery.service.spec.ts` asserts the
conditional cleanup; `notification-event.processor.telegram.spec.ts` asserts
the worker **ignores a stale `telegramChatId`** when no `ACTIVE` account
exists, and addresses `TelegramAccount` when one does.

---

## 3. Account linking flow

```
M-EDU Web (authenticated)
   │  POST /api/telegram/link
   ↓
Server derives the principal from the JWT (never from input)
   ↓
randomBytes(32) → 64-hex token  (256-bit)
   ↓
stores SHA-256 hash + 10-minute TTL, deletes any previous pending token
   ↓
returns { token, deepLink: https://t.me/<bot>?start=<token>, expiresAt }
   ↓
User opens the deep link → Telegram → POST /api/webhooks/telegram
   ↓
secret verified → update_id claimed → token hashed & looked up
   ↓
atomic claim: UPDATE … SET usedAt = now WHERE id = ? AND usedAt IS NULL
   ↓
identity linked  →  TelegramAccount upsert  →  legacy delivery pointer mirrored
   ↓
audit + confirmation reply
```

**The link token is only ever issued for the caller's own M-EDU principal.**
Nothing supplied by Telegram (username, name, phone, chat id) can choose which
account is linked.

Disconnect: `DELETE /api/telegram/link` (web) or `/unlink` (bot). Both mark the
account `DISCONNECTED`, clear the delivery pointer and delete pending tokens.

---

## 4. Webhook

`POST /api/webhooks/telegram` (public; authenticated by Telegram's secret
header `X-Telegram-Bot-Api-Secret-Token`).

Handling order:
1. Verify the secret token, compared in **constant time over SHA-256 digests**
   (normalises length, so neither the value nor its length leaks).
   **Fails closed (500)** when `TELEGRAM_WEBHOOK_SECRET` is not configured.
2. Reject oversized bodies (`> 256 KB`) with 413.
3. Require a positive integer `update_id`; otherwise 400 (malformed/forged).
4. Atomically claim `update_id`. Duplicate → `200 {status:"duplicate"}` with no
   side effects (Telegram stops retrying).
5. Dispatch: button presses → callback router, text → link flow or command
   router; non-commands are ignored.
6. Any post-claim failure is logged internally and answered with a generic
   status — internal errors are never returned to Telegram.

### Callback security (Slice 2)

`callback_data` is fully attacker-controlled, so every button carries an
opaque signed envelope instead of a resource id:

```
<code>~<argBase64url>~<expEpochBase36>~<HMAC-SHA256(80 bit)>
                     signed over: code | arg | exp | chatId
```

On every press the callback router, in order:

1. rate-limits per chat (distributed, see below) and rejects data > 128 bytes,
2. re-resolves the M-EDU context from the chat id (lifecycle, role, tenant),
3. verifies HMAC, expiry and chat binding — a payload captured from another
   chat, tampered in any field, expired, or signed with a different secret is
   rejected with a generic toast,
4. dispatches. A signature is NOT authorization: child actions re-resolve the
   child by INDEX from the caller's freshly-authorized children list
   (`ParentPortalService`), re-check the per-child visibility flag, and the
   underlying portal call re-verifies the link server-side.

**Replay defense:** TTL alone does not make a sensitive action single-use.
State-changing callbacks (`ul` — unlink confirmation) additionally take a
distributed one-time claim (`Redis SET NX`, TTL = the envelope's remaining
lifetime, keyed by the SHA-256 of the exact verified payload). The first press
consumes it; a concurrent or replayed press — on any API instance — is refused.
Navigation callbacks (menus, pagination) are intentionally re-usable: every
press re-authorizes and is idempotent. If Redis is unavailable the claim fails
open, and the operations stay safe because they are idempotent (a second
unlink finds no ACTIVE link).

Child indexes are re-resolved on EVERY press, so a child removed between menu
render and button press yields "not found", never another family's data.

### Rate limiting

All counters live in Redis (`TelegramAttemptLimiter`) and are shared by every
API instance. Per chat, per sliding 60 s window:

| Scope | Limit | Behaviour when exceeded |
| --- | --- | --- |
| Commands | 30 | Localized "slow down" reply, no handler runs |
| Callbacks | 45 | Toast, no dispatch |
| Link-token failures | 10 per hour | `/start` refused |
| Sensitive one-time claims | 1 per payload | Replayed press refused |

Redis-unavailable behaviour: limiter fails open (availability over strict
throttling); link tokens remain single-use and 256-bit, so brute-force
resistance does not depend on the counter.

### Localization (UZ / RU / EN)

Every user-facing bot string comes from `src/telegram/i18n/telegram-i18n.ts`.
Language precedence: M-EDU user preference → organization default → Telegram
`language_code` (untrusted fallback) → `en`. `/language` persists to the
existing `UserSettings` row via `UsersService.updateSettings` (self-target
only); `ParentAccount` has no settings model, so the command answers that
switching is unavailable rather than inventing storage. Dynamic values are
escaped with `escapeHtml` (`&`, `<`, `>` only — Telegram's HTML subset) before
interpolation into trusted templates; translation templates themselves are
never escaped, so nothing is double-escaped.

### Role-specific menus

`mainMenuKeyboard` renders from the CURRENT resolved context on every request:
STUDENT (profile, schedule, attendance, payments, notifications), PARENT
(children, notifications), TEACHER (today, groups, students, profile,
attendance, schedule), plus settings/help everywhere and the admin sub-menu
only for `ADMIN_ROLES`. A button is never rendered for a command the role
could not run — the same `canRun` predicate the router enforces drives `/help`.
Role downgrade/deactivation/organization move take effect on the next message
(identity is re-read per request; nothing is cached).

### Command surface (Slice 2)

Text messages are parsed as `/<name>` (case-insensitive, `@botname` suffix
allowed, whitespace-normalized, arguments preserved). Commands:

| Command | Roles | Behaviour |
| --- | --- | --- |
| `/start`, `/menu` | all | Role-specific main menu, recomputed from the live context every time |
| `/help` | all | Lists only the commands the caller's role may run (registry-derived) |
| `/profile` | all | Own name/email/role/phone; students also balance + groups; parents also linked-children count |
| `/schedule` | all | STUDENT: own enrolments (via `ScheduleService` user scope); TEACHER: own groups; PARENT: child picker; ADMIN: org |
| `/attendance` | all | STUDENT: own rows only; TEACHER: own groups; PARENT: child picker; ADMIN: org |
| `/payments` | admin, student, parent | STUDENT: own payments; PARENT: child picker; teaching roles are excluded at the router |
| `/notifications` | all | The caller's own in-app notifications (`NotificationsService`, user-scoped) |
| `/students`, `/teachers`, `/groups`, `/today`, `/admin`, `/teacher` | staff | Paginated rosters, scoped by `ctx.teacherId` for teachers |
| `/settings` | all | Connection state, language, unlink entry |
| `/language` | all | UZ/RU/EN picker; persists to `UserSettings.language`; ParentAccounts are told it's unavailable |
| `/unlink` | all | Confirmation keyboard; the disconnect happens only on the signed one-time callback |

Unknown commands get a localized "not available" reply; every list reply is
paginated through signed `PAGE` callbacks (page bounded to 1..20, list name
whitelisted).

---

## 4b. Notification delivery (Slice 3)

```
Domain event ──▶ notification-events queue ──▶ NotificationEventProcessor
                                                    │
                       resolve parents (tenant-scoped, org-matched)
                                                    │
                       TelegramDeliveryService.resolveActiveTargetsForPrincipals
                              (status = ACTIVE AND organizationId matches)
                                                    │
                       TelegramNotificationPolicyService.evaluate
                          channel enabled? · category enabled? · quiet hours?
                                                    │
             ┌──────────────────────────────────────┼───────────────────────┐
             ▼                                      ▼                       ▼
        SENT (markSent)                    DEFERRED (markDeferred)     SKIPPED (markSkipped)
                                                    │                       │
                                    TelegramDeferredDeliveryService     SMS fallback
                                      (@Cron, DB-backed, claimed)         (existing)
```

### Failure classification (`telegram-delivery.service.ts`)

| Provider outcome | Category | Action |
| --- | --- | --- |
| 403 "bot was blocked" | `BLOCKED_USER` | Account → **BLOCKED**, mirror cleared, audited (`TELEGRAM_ACCOUNT_BLOCKED`), delivery `FAILED`, SMS fallback runs |
| 400 "chat not found" | `INVALID_CHAT` | Same as above |
| 429 / 5xx / timeout / network | `RATE_LIMITED`, `TELEGRAM_SERVER_ERROR`, `TIMEOUT`, `NETWORK_ERROR` | Delivery re-scheduled with backoff (2 min → capped 1 h, max 6 attempts) via the deferral sweep; the account is **not** touched |
| 401 (bad bot token) / no token | `UNAUTHORIZED`, `NOT_CONFIGURED` | Recorded `FAILED`; **never** blocks an account (it is an operator problem affecting every chat) |
| other 4xx | `PERMANENT` | Recorded `FAILED`, not retried, account not blocked (unclassifiable) |

A blocked account can only become deliverable again through the normal re-link
flow (`/start <token>`), which atomically returns it to `ACTIVE`. Context
resolution rejects every non-`ACTIVE` state, so a stale button, an old deep
link or a queued job can never revive access.

### Delivery tracking (`NotificationDelivery`)

One row per `(event instance, principal, channel)`, keyed by a unique `dedupKey`
that mirrors the in-app dedup key (`principal + event type + entity + day`), so
a duplicate event reuses the row instead of creating a second delivery. It
stores status, categorized failure, attempt count, timestamps and (only for a
quiet-hours deferral) the rendered title/body. It never stores the bot token,
webhook/callback secret or a raw Telegram payload.

### Notification preferences

Resolution order (server is the source of truth; Telegram never supplies a
value):

```
user channel setting (UserSettings.telegramNotifications)
  > per-category setting (NotificationPreference.telegramEnabled)
  > organization default (Organization.settings.telegramNotifications)
  > enabled
```

`ParentAccount` has no settings model, so it inherits the organization default
and has **no** quiet hours — an explicit limitation, not invented persistence.

### Quiet hours

- `UserSettings.quietHoursEnabled / quietHoursStart / quietHoursEnd`; wall-clock
  `HH:mm` in `UserSettings.timezone` → organization timezone → UTC.
- Start inclusive, end exclusive; `start == end` means disabled (a half-filled
  form, not "silence all day"); midnight-crossing windows are supported.
- Inside the window the notification is **deferred, never dropped**: the row is
  marked `DEFERRED` with `deferredUntil` = the end of the window and the
  delivery is re-run by `TelegramDeferredDeliveryService`.
- The sweep is DB-backed (restart-safe), claims due rows atomically (one
  delivery across instances), recovers abandoned `PROCESSING` claims, and
  re-defers transient failures with backoff up to a bounded attempt budget.
- A deferred delivery deliberately does **not** trigger the SMS fallback (the
  retry is already scheduled — a second channel would double-notify).

### `/settings`, `/notifications`

`/settings` shows the connection, language, the Telegram channel toggle, quiet
hours and the per-category list. Every change goes through the existing
application services (`UsersService.updateSettings`,
`NotificationPreferenceService`) and is followed by a full context re-resolution
and re-render, so what the user sees is what the server stored. Toggle payloads
carry the TARGET value (`on`/`off`), so replaying a captured button re-applies
the same state instead of flipping it. `ParentAccount` is told the settings are
unavailable rather than shown fake controls.

`/notifications` is paginated through the same signed, chat-bound `PAGE`
cursor (`notifications` is whitelisted server-side), queries only `ctx.userId`,
escapes every title, shows read/unread markers and never renders internal ids.

### Admin observability

`GET /api/telegram/admin/overview` (`@Roles(...ADMIN_ROLES)`) returns
tenant-scoped account counts by lifecycle state, `lastSeenAt`, 24 h delivery
health and recent categorized failures. The global webhook volume is returned
**only** to the pre-existing `SUPER_ADMIN` role (the `TelegramUpdate` ledger has
no organization column). No secret, bot token or raw Telegram id is exposed.

---

## 5. Security controls

| Threat | Control |
| --- | --- |
| Account takeover via Telegram | Link tokens only issued from an authenticated M-EDU session; Telegram data never selects the account |
| Deep-link replay | Single-use `usedAt`, atomic `updateMany` claim |
| Deep-link brute force | 256-bit token + `TELEGRAM_LINK_MAX_FAILED_ATTEMPTS` per chat in Redis |
| Token leak from DB dump | Only SHA-256 hashes stored |
| Webhook spoofing | `secret_token` verified timing-safely; fails closed when unset |
| Duplicate updates | `TelegramUpdate` PK (DB-level), works across instances |
| Identity reassignment | A Telegram identity linked to another principal is refused (`IDENTITY_CONFLICT`) |
| Stale authorization | Target is re-verified (active + same organization) at consume time |
| Cross-tenant access | `organizationId` comes from the token row / JWT, never from input |
| Secret leakage | Token never logged, never persisted, never returned except to the owner once |
| Abuse / flooding | Global throttler + per-route `@Throttle`; distributed attempt limiter |
| Internal error disclosure | Generic replies only; details go to structured logs |
| Forged callback data | HMAC over (code, arg, exp, chat); dedicated `TELEGRAM_CALLBACK_SECRET` preferred, JWT_SECRET fallback, fail-closed when unset |
| Callback tampering | Any modified field breaks the signature; oversized data rejected pre-verification |
| Callback replay | Short TTL + distributed one-time claim for state-changing codes |
| Callback cross-user replay | Signature binds the chat id; another chat cannot verify |
| Child IDOR via callback | Children addressed by index into the caller's own authorized list, re-resolved per press |
| Parent→child staleness | Fresh portal re-resolution per press; removed link ⇒ "not found" |
| Command flood / callback flood | Distributed per-chat counters (30 cmd / 45 cb per 60 s) |
| Missing resource row widening scope | Student/teacher commands fail closed to an empty view, never the org-wide list |
| Large Telegram ids | `updateId` handled as `BigInt`; chat/telegram user ids as strings; no numeric arithmetic on identity |
| HTML injection in messages | Every dynamic value escaped; hostile names/statuses render inert |
| Stale legacy delivery pointer | The worker addresses `TelegramAccount` only; a leftover `telegramChatId` is ignored (tested) |
| Delivery to a non-ACTIVE account | Every send resolves `status = ACTIVE`; a BLOCKED/SUSPENDED/DISCONNECTED account is never a target |
| Cross-tenant delivery | Target resolution requires `organizationId` match and drops mismatched rows (fail closed) |
| Retrying into a dead chat | Permanent 403/400 marks the account `BLOCKED` and stops delivery |
| Losing a notification to quiet hours | Deferred (persisted + swept), never dropped |
| Setting replay | Toggle payloads carry the target value, so a replay re-applies, never inverts |
| Duplicate deliveries | Unique `dedupKey` per (event, principal, channel, day); deferred claims are atomic |
| Secrets in the settings UI | The API never returns token/webhook/callback secret or a chat id |

Webhook rejections (bad/missing secret, oversized) are **structured-logged, not
written to `AuditLog`**, because a rejected webhook has no resolvable
`organizationId` (the column is non-nullable). Tenant-scoped events
(link created/consumed, connected, disconnected) are audited.

Action names: `TELEGRAM_LINK_CREATED`, `TELEGRAM_LINK_CONSUMED`,
`TELEGRAM_LINK_FAILED`, `TELEGRAM_CONNECTED`, `TELEGRAM_DISCONNECTED`
(resource `TELEGRAM_ACCOUNT`).

---

## 6. API surface

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/telegram/status` | self-service | username, status, timestamps. Never chat ids |
| `POST` | `/api/telegram/link` | self-service | 5/min; returns a one-time deep link |
| `DELETE` | `/api/telegram/link` | self-service | disconnect |
| `POST` | `/api/telegram/test-notification` | self-service | 3/min |
| `GET` | `/api/telegram/admin/overview` | `@Roles(...ADMIN_ROLES)` | Tenant-scoped lifecycle counts, 24 h delivery health, recent categorized failures. Global webhook volume only for `SUPER_ADMIN`. No secrets, no raw ids |
| `POST` | `/api/webhooks/telegram` | public + secret header | Telegram only |

All self-service routes are `@AllowSelfService()`: the principal is derived
from the JWT, and the request cannot name another account.

---

## 7. Environment variables

Set in the API environment only — **never** shipped to the frontend bundle.

| Variable | Required | Notes |
| --- | --- | --- |
| `TELEGRAM_ENABLED` | no | Kill switch. Only the literal `false` disables delivery |
| `TELEGRAM_BOT_TOKEN` | when enabled | BotFather token |
| `TELEGRAM_BOT_USERNAME` | for deep links | `@name` or `name` |
| `TELEGRAM_WEBHOOK_SECRET` | production | ≥32 chars; webhook fails closed without it |
| `TELEGRAM_WEBHOOK_URL` | production | Public HTTPS endpoint |
| `TELEGRAM_CALLBACK_SECRET` | recommended | Dedicated HMAC key for callback envelopes; falls back to `JWT_SECRET` when unset |

`assertValidConfig` refuses production startup when `TELEGRAM_ENABLED=true` and
any of the token/username/secret (or secret length) is missing.

---

## 8. Local development

```bash
# API env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=<botfather token>
TELEGRAM_BOT_USERNAME=<bot username>
TELEGRAM_WEBHOOK_SECRET=<32+ random chars>

# Expose the API publicly, then register the webhook once
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<public-host>/api/webhooks/telegram" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Redis carries the attempt limiter; with `REDIS_ENABLED=false` the limiter fails
open (link tokens still cannot be brute-forced).

---

## 9. Deployment

1. Run migrations: `prisma migrate deploy` (additive; safe on a live DB).
2. Provide the environment variables above.
3. Register/refresh the webhook (`setWebhook`) and verify
   `getWebhookInfo` reports no `last_error_message`.
4. Secret rotation: update `TELEGRAM_BOT_TOKEN` (BotFather revoke/regenerate)
   and re-run `setWebhook` with the new `secret_token`; no data migration is
   needed because no secret is stored in the database.

---

## 10. Data retention

| Data | Retention | Mechanism |
| --- | --- | --- |
| `TelegramUpdate` | 7 days (`TELEGRAM_UPDATE_RETENTION_DAYS`) | `TelegramUpdateService.sweep()` (6-hourly, indexed) |
| `TelegramLinkToken` | 7 days after expiry (`TELEGRAM_LINK_TOKEN_RETENTION_DAYS`) | `TelegramUpdateService.purgeExpiredLinkTokens()` — bounded 1 000-row batches, retry-safe; only hashes at rest |
| `NotificationDelivery` | 30 days (`NOTIFICATION_DELIVERY_RETENTION_DAYS`) | `NotificationRetentionService` (daily 03:00, bounded batches over `createdAt`) |
| `TelegramAccount` | Life of the link; metadata only; state transitions instead of deletion | — |
| `TelegramLinkLog` | Audit trail; follows the existing audit-retention convention | — |

Retention jobs are scheduled, configurable, chunked (no large transaction),
retry-safe and log a structured summary; a failed sweep is logged as a warning
and never affects webhook handling. They never touch `AuditLog` — audit
retention is a separate, existing system.

---

## 11. Testing

```bash
cd apps/api
npx vitest run src/telegram          # 226 tests, 14 files
npx vitest run src/notifications     # 99 tests, 14 files
npx tsc --noEmit -p tsconfig.json
```

Coverage in the foundation slice: token entropy/hash/TTL, atomic single-use
claim, replay and race rejection, rate limiting, identity-conflict refusal,
stale-target rejection, legacy pointer mirroring, audit emission, webhook
secret verification, oversized body, missing `update_id`, duplicate update,
`/start`, `/unlink`, error containment.

Slice 3 adds: lifecycle-aware target resolution (`ACTIVE` only, tenant match,
mismatched rows dropped), permanent vs transient failure classification,
`BLOCKED` marking (conditional `updateMany`, race-safe, mirror cleared only when
it still points at that chat, audited), the worker ignoring a stale legacy
`telegramChatId`, delivery dedup keys, quiet-hours math (boundaries, midnight
crossing, timezone resolution, invalid/disabled windows, deferral target),
notification policy resolution (user → category → organization default, no
settings model for `ParentAccount`), deferral sweep behaviour (deliver, skip
inactive, transient re-defer with backoff, attempt budget, stale-claim recovery,
single-flight), retention batching, settings toggles (persist through the
application service, value-carrying idempotent payloads, unknown
category/malformed window refused, `ParentAccount` refused, re-resolution), and
`/notifications` scoping/pagination/escaping.

Slice 2 adds: context resolution (lifecycle states, role downgrade,
tenant mismatch, parent context), command routing (parsing, case-insensitivity,
arguments, unknown/malformed/long/unicode commands), RBAC denial per role,
per-chat rate-limit scoping (31st command / 46th callback), error containment
(no internal leak), callback envelope security (forgery, tampering, expiry,
cross-chat, malformed, oversized, unknown codes), unlink confirmation (valid,
wrong-chat, forged, expired, already-disconnected semantics, concurrent
double-press, replay), child authorization (out-of-range index, revoked link
staleness race, per-child flag refusal, non-parent refusal), command-handler
scoping (student/teacher/admin queries carry only verified ids, IDOR attempts
cannot widen queries, fail-closed empty scopes, tenant scope on every call),
HTML escaping (hostile names/statuses/group titles), role menus (only
reachable commands shown, admin menu excluded for non-admins, downgrade
shrinks immediately), large-Telegram-ID handling, i18n parity across uz/ru/en
and the `resolveLanguage` precedence chain.

**Migration verification:** `npx tsx scripts/verify-telegram-migration.ts`
boots an ephemeral embedded Postgres and asserts the tables, enum, unique
indexes, foreign keys and the duplicate-`update_id` guarantee. It requires a
non-administrative OS user (embedded Postgres refuses to run as an admin on
Windows) — run it in CI/Linux or as an unprivileged user.

**Executed locally (2026-09, Windows):** the embedded-Postgres harness ran end
to end and reported `All Telegram migration checks passed.` for every check,
including the Slice-3 additions (`NotificationDelivery` table, its four indexes,
its unique `dedupKey`, the `NotificationDeliveryStatus` enum, the
`UserSettings` quiet-hours columns, the `NotificationPreference.telegramEnabled`
column, and live duplicate rejection).

Two **pre-existing, non-Telegram** migrations
(`20260907000000_phase3_1_integrity_constraints`,
`20260923150000_restore_missing_fks`) did not apply on this host because the
embedded Postgres instance initialises with a `WIN1252` database encoding and
those files contain a `→` (U+2192) character. The harness reports them
separately and they are unrelated to Telegram and to this slice; a UTF-8
database (CI/Linux) applies them. CI (ubuntu) executes the full migration set on
real Postgres on every push.

No test calls the real Telegram API.

---

## 12. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Webhook returns 500 | `TELEGRAM_WEBHOOK_SECRET` not set — fails closed by design |
| Webhook returns 401 | `setWebhook` was registered with a different `secret_token` |
| Bot replies "invalid or has expired" | Token used, expired (>10 min) or generated for another principal |
| Bot replies "already linked to another M-EDU account" | That Telegram identity is linked elsewhere; disconnect it there first |
| Deep link missing | `TELEGRAM_BOT_USERNAME` unset (`POST /telegram/link` returns 503) |
| Delivery stops after disconnect | Expected — the delivery pointer is cleared on disconnect |
| Messages silently dropped | `TELEGRAM_ENABLED=false` or `TELEGRAM_BOT_TOKEN` missing (warned at boot) |

---

## 13. Roadmap (what is NOT implemented yet)

- **Telegram Mini App** — deliberately not implemented. There is no product
  requirement for it; if one appears it needs server-side `initData`
  verification and its own threat model. This slice explicitly does not add
  Mini App infrastructure.
- **`/announcements` / `/reports`** — no backing application service exists yet,
  so no buttons are rendered and no fake data is produced. This is the next
  feature boundary: expose them once a real announcements/reports service is
  available.
- **Parent language/preferences storage** — `ParentAccount` has no settings
  model. Parents inherit the organization language and have no quiet hours;
  the bot and the web UI both state this rather than pretending otherwise.
- **Legacy column removal** — `telegramChatId` / `telegramLinkToken` /
  `telegramLinkExpiresAt` are removed in release N+2 (see the migration state
  table above).
- **Per-organization (white-label) bots** — a single central bot is assumed;
  per-tenant bots would require `@@unique([botId, telegramUserId])` and a bot
  registry.
- **Automation-rule chat addressing** — `automation.service.ts` still resolves a
  chat id from rule payload data; it should use `TelegramAccount` lookups in the
  automation slice.
- **Cancelled-lesson / stale-reminder validation.**
