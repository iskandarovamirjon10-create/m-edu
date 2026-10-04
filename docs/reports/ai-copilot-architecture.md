# M-EDU AI — Target Architecture & Migration Map (Phase 2)

> Companion to `ai-copilot-audit.md`. This is the **single source of truth** for
> the canonical AI architecture. It replaces the previously referenced (but
> absent) `ai-copilot-architecture.md`.

---

## 1. Principles

1. **One engine.** No `AiServiceV2`, no second controller, no parallel state.
2. **Protocol first.** Backend and frontend share one strongly-typed protocol,
   published from `@medu/contracts` (already a dependency of `@medu/api` and
   `@medu/web`).
3. **Provider-independent application layer.** Business code never imports Gemini
   types or SDKs.
4. **AI never touches Prisma directly.** `AI → Tool → Domain Service → Repository → DB`.
5. **The frontend is never trusted.** Identity, tenant, role and permissions are
   derived server-side; confirmation re-validates everything.
6. **Model output is untrusted.** It is schema-validated before it becomes a tool
   call or an action.
7. **Durable conversation + action state** lives in PostgreSQL; Redis only caches,
   rate-limits and coordinates.

---

## 2. Shared protocol (`packages/contracts/src/ai/`)

Exported via `packages/contracts/src/index.ts`.

```
packages/contracts/src/ai/
├── ai.enums.ts     // const-object enums + union types (mirrors packages/contracts/src/enums.ts style)
├── ai.types.ts     // entities, tool contracts, stream events, error model
└── index.ts
```

### 2.1 Enums (follow the existing `const … as const` + `type` pattern)

```ts
export const AiRole = { SYSTEM:'system', USER:'user', ASSISTANT:'assistant', TOOL:'tool' } as const;
export type AiRole = (typeof AiRole)[keyof typeof AiRole];

export const AiMessageStatus = { PENDING:'pending', STREAMING:'streaming', COMPLETED:'completed', FAILED:'failed', CANCELLED:'cancelled' } as const;
export type AiMessageStatus = …;

export const AiActionStatus = {
  PROPOSED:'PROPOSED', PENDING_CONFIRMATION:'PENDING_CONFIRMATION', CONFIRMED:'CONFIRMED',
  EXECUTING:'EXECUTING', COMPLETED:'COMPLETED',
  REJECTED:'REJECTED', EXPIRED:'EXPIRED', FAILED:'FAILED', CANCELLED:'CANCELLED',
} as const;
export type AiActionStatus = …;

export const AiToolRiskLevel = { LOW:'low', MEDIUM:'medium', HIGH:'high', CRITICAL:'critical' } as const;
export type AiToolRiskLevel = …;

export const AiErrorCode = {
  AI_PROVIDER_UNAVAILABLE:'AI_PROVIDER_UNAVAILABLE', AI_PROVIDER_TIMEOUT:'AI_PROVIDER_TIMEOUT',
  AI_RATE_LIMITED:'AI_RATE_LIMITED', AI_TOOL_NOT_FOUND:'AI_TOOL_NOT_FOUND',
  AI_TOOL_NOT_AUTHORIZED:'AI_TOOL_NOT_AUTHORIZED', AI_TOOL_INVALID_INPUT:'AI_TOOL_INVALID_INPUT',
  AI_ACTION_NOT_FOUND:'AI_ACTION_NOT_FOUND', AI_ACTION_EXPIRED:'AI_ACTION_EXPIRED',
  AI_ACTION_NOT_AUTHORIZED:'AI_ACTION_NOT_AUTHORIZED', AI_ACTION_ALREADY_RESOLVED:'AI_ACTION_ALREADY_RESOLVED',
  AI_ACTION_FAILED:'AI_ACTION_FAILED', AI_INVALID_INPUT:'AI_INVALID_INPUT',
  AI_CONVERSATION_NOT_FOUND:'AI_CONVERSATION_NOT_FOUND', AI_INTERNAL:'AI_INTERNAL',
} as const;
export type AiErrorCode = …;
```

### 2.2 Core entities

```ts
export interface AiMessage<TMeta = AiMessageMeta> {
  id: string;
  conversationId: string;
  role: AiRole;
  content: string;
  status: AiMessageStatus;
  createdAt: string;          // ISO
  toolCalls?: AiToolCall[];
  toolResult?: AiToolResult;
  action?: AiActionSummary;
  error?: AiErrorPayload;
}

export interface AiConversation {
  id: string;
  organizationId: string;
  title: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  archivedAt: string | null;
  messageCount: number;
}

export interface AiActionSummary {
  id: string;
  status: AiActionStatus;
  toolName: string;
  riskLevel: AiToolRiskLevel;
  summary: string;
  parameters: Record<string, unknown>;
  expiresAt: string;
  result?: Record<string, unknown> | null;
  error?: AiErrorPayload | null;
}
```

### 2.3 Tool contract

```ts
export interface AiToolDefinition<TInput = unknown, TResult = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;         // validated immediately at the boundary
  riskLevel: AiToolRiskLevel;
  requiresConfirmation: boolean;
  permission: string;                   // checked against AiContext.permissions
  // Read tools: no confirmation. Write tools: confirm then execute.
  execute(input: TInput, context: AiContext): Promise<TResult>;
}
```

> `zod` is already a dependency of both `apps/api` and `apps/web`, so the schema
> type is safe to reference from `@medu/contracts` (used for runtime validation
> on the server; the frontend only consumes the inferred types).

### 2.4 Context

```ts
export interface AiContext {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
  route?: string;
  entity?: { type: string; id: string };
  locale: 'uz' | 'ru' | 'en';
}
```

Derived **server-side** from the JWT (`@CurrentUser`) + `RolePermissions`; never
trusted from the request body.

### 2.5 Streaming events (discriminated union)

```ts
export type AiStreamEvent =
  | { type: 'message.started';  messageId: string }
  | { type: 'message.delta';    messageId: string; delta: string }
  | { type: 'tool.started';     toolCallId: string; toolName: string }
  | { type: 'tool.completed';   toolCallId: string; toolName: string; ok: boolean }
  | { type: 'action.pending';   action: AiActionSummary }
  | { type: 'message.completed'; message: AiMessage }
  | { type: 'error';            error: AiErrorPayload };
```

Streaming is **only** implemented if the current transport supports it cleanly; a
non-streamed JSON endpoint is the guaranteed baseline. The controller exposes
`POST /ai/conversations/:id/messages` (JSON) and may add
`POST /ai/conversations/:id/messages/stream` (SSE) in a later step. We do **not**
fake streaming.

---

## 3. Canonical backend (`apps/api/src/ai/`)

```
apps/api/src/ai/
├── ai.module.ts
├── ai.controller.ts                 // conversations, chat, actions
├── application/
│   ├── ai-gateway.service.ts        // orchestration: context → model → tools → persistence
│   ├── conversation.service.ts      // CRUD + pagination + tenant scoping
│   ├── context.service.ts           // builds AiContext from AuthedUser
│   ├── tool-orchestrator.service.ts // validation, authorization, execution, re-prompt
│   ├── action.service.ts            // durable action lifecycle + idempotency
│   └── ai-policy.service.ts         // permission + risk policy
├── domain/
│   ├── ai.types.ts                  // re-exports protocol from @medu/contracts
│   ├── conversation.types.ts
│   ├── tool.types.ts
│   ├── action.types.ts
│   └── ai.errors.ts                 // typed AiException → HTTP mapping
├── infrastructure/
│   ├── providers/
│   │   ├── ai-provider.interface.ts // AiProvider port
│   │   └── gemini.provider.ts       // Gemini adapter
│   ├── persistence/
│   │   ├── ai-conversation.repository.ts
│   │   └── ai-action.repository.ts
│   ├── redis/
│   │   └── ai-rate-limit.service.ts // Redis-backed budget (RedisThrottler storage)
│   └── streaming/                   // reserved; SSE adapter when enabled
├── tools/
│   ├── registry/
│   │   ├── tool-registry.service.ts
│   │   └── index.ts                 // registers all tools
│   ├── students/ teachers/ attendance/ lessons/ payments/ dashboard/ reports/
├── dto/
│   ├── chat.dto.ts  conversation.dto.ts  action.dto.ts  tool.dto.ts
└── guards/ai.guard.ts
```

### 3.1 Provider port

```ts
export interface AiProvider {
  generate(request: AiGenerateRequest): Promise<AiGenerateResponse>;
  stream?(request: AiGenerateRequest, signal?: AbortSignal): AsyncIterable<AiStreamEvent>;
}
```

Gemini remains solely an infrastructure implementation. Provider failures throw
`AiProviderError` (mapped to `AI_PROVIDER_UNAVAILABLE` / `AI_PROVIDER_TIMEOUT`) —
**never** silently converted to assistant text.

### 3.2 Orchestration (`AiGatewayService`)

```
load conversation (tenant-scoped)
  → build context (server-side identity + permissions)
  → persist user message
  → loop (bounded, e.g. max 4 tool rounds):
        provider.generate(messages, tools, systemInstruction)
        if text        → persist assistant message, done
        if tool call   → orchestrator.authorize + validate + execute
                         read tool: append tool result, continue loop
                         write tool: create durable AiAction(PENDING_CONFIRMATION), stop
  → return assistant message (+ pending action if any)
```

### 3.3 Action lifecycle (`ActionService`)

States: `PROPOSED → PENDING_CONFIRMATION → CONFIRMED → EXECUTING → COMPLETED`,
with failure paths `REJECTED / EXPIRED / FAILED / CANCELLED`.

Confirmation (`POST /ai/actions/:id/confirm`) re-checks, server-side:
authenticated user, organization, permission, resource ownership, expiry,
current resource state, stored parameters, current action status, and replay.

**Idempotency/replay:** a conditional update on status
(`updateMany({ where: { id, status: 'PENDING_CONFIRMATION', … } })` requiring
exactly 1 affected row) is the execution gate. A second confirm gets
`AI_ACTION_ALREADY_RESOLVED`; there is no way to execute twice.

### 3.4 Error model

`AiException extends HttpException` carrying a machine `code: AiErrorCode`,
HTTP status, and safe message. A controller filter serialises
`{ code, message, details? }`. No raw provider/Prisma errors reach the client.

### 3.5 Rate limiting

Redis-backed (reuses `common/guards/throttler-redis.storage.ts`). Separate budgets
for chat, streaming, tool execution and action confirmation; exceeded → typed
`AI_RATE_LIMITED`.

---

## 4. Database (Phase 3)

New tenant-aware models (Prisma, preserving existing conventions):

```prisma
model AiConversation {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  createdBy      String   @db.Uuid
  title          String?
  archivedAt     DateTime?
  lastMessageAt  DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdByUser  User         @relation("AiConversationCreator", fields: [createdBy], references: [id])
  messages       AiMessage[]
  actions        AiAction[]
  @@index([organizationId, updatedAt])
  @@index([organizationId, createdBy])
}

model AiMessage {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  conversationId String   @db.Uuid
  role           String
  content        String   @db.Text
  status         String
  toolCalls      Json?
  toolResult     Json?
  actionId       String?  @db.Uuid
  error          Json?
  createdAt      DateTime @default(now())
  conversation   AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  organization   Organization   @relation(fields: [organizationId], references: [id])
  @@index([organizationId])
  @@index([conversationId, createdAt])
}

model AiAction {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @db.Uuid
  conversationId String   @db.Uuid
  messageId      String?  @db.Uuid
  createdBy      String   @db.Uuid
  toolName       String
  riskLevel      String
  status         String
  summary        String
  parameters     Json
  result         Json?
  error          Json?
  expiresAt      DateTime
  confirmedAt    DateTime?
  executedAt     DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organization   Organization   @relation(fields: [organizationId], references: [id])
  conversation   AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([organizationId, status])
  @@index([conversationId])
  @@index([expiresAt])
  @@index([status, expiresAt])
}
```

`AiToolExecution` is folded into `AiMessage.toolResult` for read tools; durable
write executions are captured by `AiAction`. (If the brief insists on a separate
`AiToolExecution` table, it can be added later without changing the protocol.)

Every query filters by `organizationId`. Indexes cover organization, conversation,
timestamps, action status and expiry.

---

## 5. Canonical frontend (`apps/web/src/features/ai/`)

```
apps/web/src/features/ai/
├── api/ai.client.ts        // the ONLY AI transport (replaces aiApi + copilotApi)
├── state/useAiController.ts// the ONLY AI state machine
├── types/                  // re-export shared protocol from @medu/contracts
├── components/             // workspace, sidebar, composer, message list, markdown,
│                           // tool activity, action card, error card, welcome
└── pages/AiWorkspace.tsx   // route element
```

State machine (discriminated union, no `status: string`):

```ts
type AiControllerState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'streaming'; messageId: string }
  | { status: 'thinking' }
  | { status: 'tool_running'; toolName: string }
  | { status: 'awaiting_confirmation'; action: AiActionSummary }
  | { status: 'executing_action'; actionId: string }
  | { status: 'completed' }
  | { status: 'error'; error: AiErrorPayload }
  | { status: 'cancelled' };
```

Routing: keep the existing `/ai-copilot` URL (already in `AppLayout` nav) but
render `features/ai/pages/AiWorkspace`. The global Copilot
(`GlobalAiCopilot`) mounts the same controller.

---

## 6. Migration map (old → new)

| Legacy | Canonical replacement | Removal phase |
| --- | --- | --- |
| `AiService` + `AiController` (`POST /ai/chat`) | `AiGatewayService` + `AiController` (`POST /ai/conversations/:id/messages`) | 8 (after Telegram migration) |
| `CopilotService` + `CopilotController` (`POST /ai/copilot/chat`) | same canonical engine | 8 |
| `copilot.tools.ts` | `tools/registry` + per-domain tools | 8 |
| `providers/gemini.provider.ts` (REST, `any`) | `infrastructure/providers/gemini.provider.ts` (SDK, typed, `AiProvider`) | 8 |
| `copilot.types.ts` / `copilot.context.ts` / `copilot.guard.ts` (empty) | delete | 8 |
| Telegram `copilot.command.ts` → `AiService` | point at canonical engine (adapter keeping statistics/identity scope) | 8 |
| `apps/api/test/copilot.e2e.spec.ts` (`/ai/chat`) | rewrite against canonical routes | 8 |
| `apps/web` `aiApi` (`lib/api.ts`) | `features/ai/api/ai.client.ts` | 8 |
| `copilotApi` (`lib/api.ts`) + `services/ai/copilot.service.ts` | same | 8 |
| `pages/AiCopilot.tsx` | `features/ai/pages/AiWorkspace.tsx` | 8 |
| `pages/AICopilot/*` (unrouted) | delete | 8 |
| `components/ai/*` (active) | `features/ai/components/*` | 8 |
| `components/ai-copilot/*` (12 files, 4 empty) | delete | 8 |
| `hooks/useAiCopilot.ts` | `features/ai/state/useAiController.ts` | 8 |
| `hooks/ai/useCopilotChat.ts`, `hooks/ai/useAICopilot.ts` (empty) | delete | 8 |
| `lib/ai.ts` (transport + `ApiError(501)`) | `features/ai/api/ai.client.ts` + error map | 8 |
| `types/ai.ts` (`any`-heavy) | `@medu/contracts/ai` | 8 |
| `components/AIAssistant.tsx` (orphan) | delete | 8 |

Legacy stays **until** its replacement is verified and all references migrated.

---

## 7. Execution phases & checkpoints

Matches the user-approved sequence: PHASE 0 baseline → architecture → backend
foundation → database → tool/action engine → frontend core → premium workspace →
global copilot → legacy removal → security re-audit → final verification.
Checkpoints run typecheck/tests/prisma at each boundary. No half-migration.

## 7a. Implementation status (2026-10-01)

| Phase | Status | Evidence |
| --- | --- | --- |
| 0 Baseline + docs | ✅ done | `ai-copilot-audit.md`, this file |
| 1 Protocol | ✅ done | `packages/contracts/src/ai/*` (enums, permissions, types) |
| 2 Backend foundation | ✅ done | `apps/api/src/ai/{domain,application,infrastructure,dto,tools}` |
| 3 Database | ✅ done | 3 Prisma models + `20261001120000_add_ai_workspace`; `prisma validate` green |
| 4 Tool + action engine | ✅ done | registry + 6 tools; `AiActionService` with re-auth, atomic claim, audit |
| 5 Frontend core | ✅ done | `apps/web/src/features/ai/*`; `/ai-copilot` now renders `AiWorkspace` |
| 6 Premium UI polish | ⏳ pending | functional workspace shipped; polish/a11y/responsive pass outstanding |
| 7 Global Copilot migration | ⏳ pending | still on legacy `useAiCopilot` |
| 8 Legacy removal | ⏳ pending | legacy intentionally still present and working |
| 9 Security re-audit | ⏳ pending | |
| 10 Final verification | ⏳ pending | |

Verification actually run:
- `npm run typecheck -w @medu/api` → 0 errors.
- `npm run typecheck -w @medu/web` → 0 errors.
- `npm run build -w @medu/contracts` → clean.
- `npx prisma validate` → valid.
- API unit tests → 2545 pass; 3 **pre-existing** failures in `auth/__tests__/auth.controller.spec.ts`
  (public registration disabled) unrelated to AI.
- AI unit tests → 32 pass (context, policy, registry, zod-schema, action lifecycle
  incl. replay/expiry/failure, gateway incl. write-action diversion).
- Web legacy AI page tests → 9 failures, **pre-existing** in the current working tree
  (assert hardcoded `'AI yordamchi'` removed by prior edits), unrelated to this work.

## 8. Out of scope for this pass (explicitly deferred)

- SSE streaming endpoint (baseline is non-streamed JSON; protocol is
  stream-ready).
- A separate `AiToolExecution` table.
- Full E2E coverage of every tool against a live PostgreSQL (added incrementally).
