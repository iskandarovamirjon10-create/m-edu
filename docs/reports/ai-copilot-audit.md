# M-EDU AI / Copilot — Forensic Audit (Phase 1)

> Status: **re-derived from the actual repository** at commit `96a0e01` (branch `main`),
> 2026-10-01. This document replaces the previously referenced (but absent)
> `ai-copilot-audit.md`. Where the rebuild brief asserted a finding, this audit
> records the **verified** evidence, and notes corrections.
>
> Baseline tooling state at time of audit:
> - `npm run typecheck -w @medu/web` → **0 errors**.
> - `npm run typecheck -w @medu/api` → **0 errors** after relocating one legacy
>   spec that sat outside `__tests__/` (see §7).

---

## 0. Method

1. Enumerate every AI/Copilot-related file on both sides (`apps/api`, `apps/web`,
   `packages/contracts`).
2. Trace each symbol (`AiService`, `CopilotService`, `useAiCopilot`,
   `useCopilotChat`, `aiApi`, `copilotApi`, AI routes) to all references, including
   tests and the Telegram module.
3. Classify each file as **active**, **orphaned**, or **shared dependency**.
4. Record the target contract gaps (types, persistence, actions, security, i18n).

---

## 1. Backend inventory

| File | Role | Verdict |
| --- | --- | --- |
| `apps/api/src/ai/ai.controller.ts` | `POST /ai/chat`; `JwtAuthGuard`; tenant from `@CurrentUser` | active (web frontend + Telegram) |
| `apps/api/src/ai/ai.service.ts` | Gemini SDK call + hardcoded Uzbek prompt + regex "intelligent fallback" | active; **duplicate engine** |
| `apps/api/src/ai/copilot/copilot.controller.ts` | `POST /ai/copilot/chat`; `@CurrentUser() user: any` | duplicate engine |
| `apps/api/src/ai/copilot/copilot.service.ts` | Tool loop + Redis pending actions + in-process permission heuristic | duplicate engine |
| `apps/api/src/ai/copilot/copilot.tools.ts` | Tool definitions; `parameters: any` | duplicate tool system |
| `apps/api/src/ai/copilot/copilot.types.ts` | empty | dead |
| `apps/api/src/ai/copilot/copilot.context.ts` | empty | dead |
| `apps/api/src/ai/copilot/copilot.guard.ts` | empty | dead |
| `apps/api/src/ai/providers/gemini.provider.ts` | direct REST `fetch` to Gemini; `any`-typed; returns error text as content | duplicated provider logic |
| `apps/api/src/ai/ai.module.ts` | wires both engines | will be rewritten |

### 1.1 Backend duplication (verified)

Two independent, non-shared engines:

- **Simple engine** — `AiService` → `POST /ai/chat`. Counts `student`, `group`,
  `teacher`; builds a system prompt with tenant statistics; no tools, no
  persistence, no actions. If Gemini is unreachable it silently returns a canned
  Uzbek "fallback" string.
- **Tool engine** — `CopilotService` → `POST /ai/copilot/chat`. Has a tool loop,
  Redis-backed pending actions (magic strings `CONFIRM_ACTION:` / `CANCEL_ACTION:`),
  and an in-process role/permission heuristic `hasPermission()`.

The two engines never share a provider abstraction, a prompt, a type, or a route
namespace. This is the duplication the rebuild must collapse to one.

### 1.2 Shared dependencies that block naive deletion

**`AiService` is not web-only.** It is imported by the Telegram integration:

- `apps/api/src/telegram/commands/copilot.command.ts` (line 2, 45)
- `apps/api/src/telegram/__tests__/telegram-copilot.command.spec.ts` (line 3, 92, 121)

> ⚠️ Deleting `AiService` without migrating the Telegram `/copilot` command would
> break the bot. The canonical engine must expose an `AiService`-compatible
> entry point (identity + tenant statistics + "M-EDU topics only" scope) or the
> Telegram command must be migrated in the same change.

### 1.3 Provider layer

`GeminiProvider` calls the Gemini REST API directly with `fetch`, bypassing the
`@google/genai` SDK. It types payloads as `any`, and — critically — **converts
provider failures into user-visible assistant text** (`"Kechirasiz, AI
xizmatida xatolik…"`). There is no distinction between "model answered" and
"provider failed", which makes the frontend unable to offer retry correctly.

`AiService` additionally does its own independent Gemini SDK loading via
`require('@google/genai')`. So there are **two** different Gemini integrations.

### 1.4 Persistence

There is **no AI-specific persistence**. Relevant facts:

- No `Conversation` / `AiMessage` / `AiAction` models exist in
  `apps/api/prisma/schema.prisma` (`ChatConversation`/`ChatMessage` are the
  human-to-human chat module, unrelated).
- The tool engine parks pending actions **only in Redis with a 5-minute TTL**
  (`copilot.service.ts`), so an unconfirmed action is lost on TTL expiry and is
  not auditable.
- The frontend stores its entire conversation in `localStorage`
  (`medu:ai-copilot:v1`).

### 1.5 Action execution (the 501)

`apps/web/src/lib/ai.ts` `confirmAiAction()`:

```ts
export async function confirmAiAction(actionId: string): Promise<Record<string, unknown>> {
  void actionId;
  throw new ApiError(501, 'AI amallarini tasdiqlash backendda hozircha qo‘llab-quvvatlanmaydi.');
}
```

The frontend renders a confirmation card, but confirming can never succeed. The
`CopilotService` equivalent (`CONFIRM_ACTION:<id>` as a chat message) exists but
is unreachable from the web UI. **There is no real, backend-authorized action
lifecycle.**

### 1.6 Type-safety violations (backend)

- `copilot.controller.ts`: `@CurrentUser() user: any`.
- `copilot.service.ts`: `args: any`, `data: any`, `PendingAction.args: any`,
  `new RedisCtor(opts: any)`, `as any` casts across every `executeTool` branch.
- `copilot.tools.ts`: `parameters: any`.
- `gemini.provider.ts`: `parameters: any`, `args: any`, `result: any`,
  `requestBody: any`.
- `ai.service.ts`: heavy `as unknown as` casts to fake a Gemini SDK type.

### 1.7 Security posture (backend)

| Concern | Finding |
| --- | --- |
| Tenant isolation | `AiService` filters by `organizationId`; `CopilotService` passes it to domain services. **But** `CopilotController` has no DTO/ValidationPipe and trusts `user.organizationId` only because auth populates it — no explicit re-check. |
| Authorization | `hasPermission()` is a hand-written role→suffix heuristic (`:read`/`:create`), inconsistent with `@medu/contracts` `RolePermissions`. |
| Input validation | `/ai/chat` and `/ai/copilot/chat` bodies are untyped interfaces; no `class-validator`. |
| Rate limiting | Global Throttler + Redis storage exist (`common/guards/throttler-redis.storage.ts`) but there is **no AI-specific budget** for chat/tools/actions. |
| Prompt injection | System prompts say "ignore previous instructions", but **model output is never validated** before being turned into a pending action; tool-arg schemas are `any`. |
| Audit | No `audit.record(...)` calls for AI tool/action events. |
| Error model | Provider errors are laundered into assistant text. |

### 1.8 Tests (backend)

- `apps/api/test/copilot.e2e.spec.ts` — hits `/ai/chat` (identity, off-topic
  refusal, prompt-injection refusal, statistics). **Pins the simple engine.**
- `apps/api/src/ai/copilot/__tests__/copilot.service.spec.ts` — unit tests the
  legacy tool engine (formerly `jest.*` globals; relocated in §7).
- `apps/api/src/telegram/__tests__/telegram-copilot.command.spec.ts` — pins the
  Telegram `AiService` dependency.

---

## 2. Frontend inventory

### 2.1 Active path (`/ai-copilot`)

```
routes/index.tsx  (path: 'ai-copilot')
  → pages/AiCopilot.tsx            (419 lines)
      → hooks/useAiCopilot.ts      (443 lines)  state machine
          → lib/ai.ts              (323 lines)  transport + tool vocabulary + error mapping
              → lib/api.ts  aiApi.chat()  → POST /ai/chat
          → types/ai.ts            (122 lines)
      → components/ai/AiMessageList.tsx, AiComposer.tsx, AiActionConfirmation.tsx, …
```

`GlobalAiCopilot` (`components/ai/GlobalAiCopilot.tsx`, mounted in
`layouts/AppLayout.tsx`, Ctrl/Cmd+J) uses the **same** `useAiCopilot`, so the
overlay and the page are already one state machine — good, and worth preserving.

### 2.2 Orphaned path (not routed)

```
pages/AICopilot/AICopilot.tsx         (22 lines)  — NOT referenced by routes/index.tsx
  → components/ai-copilot/*           (12 files; 4 are zero-byte)
  → hooks/ai/useCopilotChat.ts        (react-query mutation)
  → lib/api.ts  copilotApi.chat()     → POST /ai/copilot/chat
```

Confirmed unreferenced except by each other. `components/ai-copilot/QuickActions.tsx`,
`ReportCard.tsx`, `SuggestedPrompts.tsx`, `ToolResult.tsx` are **0 bytes**.

### 2.3 Other dead/duplicate frontend files

| File | Status |
| --- | --- |
| `hooks/ai/useAICopilot.ts` | **0 bytes** — dead |
| `services/ai/copilot.service.ts` | defines a second `copilotApi` using raw `fetch`; imported by nothing — dead |
| `components/AIAssistant.tsx` (494 lines) | no importers found — orphaned |
| `types/ai.ts` | `any`-heavy, index signatures `[key: string]: any` everywhere |

### 2.4 Type-safety violations (frontend)

`types/ai.ts` declares: `data?: any`, `[key: string]: any` (×6), `status?: string`,
`role: 'user' | 'assistant' | 'system' | string`, `actionError?: any`,
`confirmation?: any`. `useAiCopilot.ts` uses `item: any` / `result: any` in the
tool-call plumbing. `useCopilotChat.ts` uses `data: any`.

### 2.5 i18n

AI surfaces hardcode Uzbek strings directly in components and in `lib/ai.ts`
(tool vocabulary, status text, error strings, confirmation copy, composer
placeholders, welcome copy). The app's i18n locales live in
`apps/web/src/i18n/locales/{en,ru,uz}.ts`. There is an `nav.aiCopilot` key, but
no AI message namespace.

### 2.6 Tests (frontend)

- `apps/web/src/pages/__tests__/AiCopilot.test.tsx` — extensive flow tests
  (empty, send, errors/retry, tool calls, confirmation, persistence, presentation)
  that mock `@/lib/ai`. **Pins the legacy protocol** and must be rewritten with the
  new contract.
- `apps/web/src/components/ai/__tests__/MarkdownContent.test.tsx`.

---

## 3. Corrections to the rebuild brief

| Brief claim | Verified result |
| --- | --- |
| "two competing systems `AiService`/`CopilotService`" | ✅ true |
| "simple route used by main flow, Copilot not integrated" | ✅ true — `/ai/chat` is wired; `/ai/copilot/chat` is orphaned |
| "multiple AI surfaces: `AiCopilot.tsx`, `AICopilot/AICopilot.tsx`" | ✅ true (`AICopilot` is unrouted) |
| "multiple hooks `useAiCopilot.ts`, `useCopilotChat.ts`" | ✅ true (+ `hooks/ai/useAICopilot.ts` which is empty) |
| "multiple transports `aiApi`, `copilotApi`" | ✅ true (two `copilotApi` even: `lib/api.ts` and `services/ai/copilot.service.ts`) |
| "~37 `any` violations" | roughly consistent; concentrated in `types/ai.ts`, `gemini.provider.ts`, `copilot.service.ts` |
| "action execution reaches a `501` placeholder" | ✅ true, frontend-only (`lib/ai.ts`) |
| "no AI-specific persistence" | ✅ true |
| "60+ hardcoded Uzbek strings" | ✅ substantially true across AI components + `lib/ai.ts` |
| "critical conversation state only in localStorage" | ✅ true |

**New finding not in the brief:** `AiService` is a hard dependency of the
Telegram `/copilot` command and its tests. Legacy removal must account for it.

---

## 4. Root causes

1. **Two engines grew in parallel** — one optimized for "chat answer", one for
   "tools", with no shared provider or protocol.
2. **No shared protocol** — the backend and frontend each invented their own
   loosely-typed shapes, so the confirmation flow could never be completed.
3. **Actions were modelled as ephemeral Redis state**, not durable, authorized,
   auditable domain state.
4. **The provider boundary leaked failure semantics into content**, so the UI
   cannot distinguish "no answer" from "provider down".

---

## 5. Non-negotiables for the rebuild

- ONE backend AI engine; ONE frontend controller; ONE API client; ONE protocol.
- Real action lifecycle with backend re-authorization and replay protection.
- Durable, tenant-scoped conversation/action persistence.
- Provider abstraction so Gemini is swappable and failures are typed.
- No `any` in AI code; discriminated unions for state.
- Telegram `/copilot` must keep working against the canonical engine.
- Delete legacy only after reference search (Phase 8).

See `ai-copilot-architecture.md` for the target design and migration map.
