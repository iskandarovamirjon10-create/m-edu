# M EDU — AI Copilot & External Integrations Forensic Review
**Mission ID:** MEDU-UFA-001  
**Audit Date:** 2026-10-14  
**Audit Standard:** ZERO-ASSUMPTION • EVIDENCE-DRIVEN • PRODUCTION REALITY  

---

## 1. AI Copilot & Tool Calling Architecture

### Multi-Provider Orchestration
- **Providers Supported:** Google Gemini, Groq, OpenAI.
- **Provider Selection:** Configured via `AI_PROVIDER` environment variable with dynamic fallback to rule-based assistance when upstream API limits or network timeouts occur.
- **Context Injection:** `ContextService` scopes LLM knowledge strictly to the requesting user's tenant (`organizationId`), injecting timetable, student roster, or invoice context dynamically without cross-tenant leakage.

### Tool Execution Registry & Security
- **File:** `apps/api/src/ai/tools/registry/tool-registry.service.ts`
- **Guards:**
  - All agent tools are defined with strict JSON schema definitions.
  - Inputs are validated and sanitized prior to execution.
  - **Dangerous Actions Guard:** Destructive actions (altering fees, deleting records, changing roles) cannot be executed directly by the LLM; they return a pending confirmation request requiring administrator approval via signed cryptographic token.

---

## 2. Telegram Bot & Notification Gateway

### Update Processing & Deduplication
- **File:** `apps/api/src/telegram/telegram-update.service.ts`
- **Idempotency:** Inbound Telegram `update_id` values are tracked and checked. Duplicate deliveries are logged (`telegram_update_duplicate`) and discarded, preventing repeated parent notifications or command loops.

### Resilient Delivery & Rate Limiting
- **Attempt Limiter (`TelegramAttemptLimiter`):** Enforces sliding-window rate limits per user/chat using Redis, gracefully falling back to memory if Redis is unreachable.
- **Deferred Delivery (`TelegramDeferredDeliveryService`):** Failed messages during Telegram outages are queued in the database and periodically re-dispatched via scheduled batch sweeps with exponential backoff and max retry caps.

---

## 3. Telecommunications & Payment Integrations

### SMS Gateway (Eskiz / PlayMobile)
- Automated phone number normalization (+998 XX XXX XX XX format).
- Bearer token caching with automatic re-authentication upon token expiration.
- Verified in `apps/api/src/notifications/__tests__/delivery-failure.spec.ts`.

### Payment Gateway Webhooks (Click, Payme, Uzum)
- **Signature Verification:** Constant-time `crypto.timingSafeEqual` prevents signature timing attacks.
- **Idempotency:** `externalTransactionId` unique indexes enforce exactly-once payment processing.
- **Currency Handling:** Minor-unit tiyin arithmetic guarantees zero financial discrepancy.
