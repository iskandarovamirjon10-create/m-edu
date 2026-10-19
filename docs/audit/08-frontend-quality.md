# M EDU — Frontend Architecture & Quality Forensic Review
**Mission ID:** MEDU-UFA-001  
**Audit Date:** 2026-10-14  
**Audit Standard:** ZERO-ASSUMPTION • EVIDENCE-DRIVEN • PRODUCTION REALITY  

---

## 1. Application Inventory & Code Splitting

- **Framework:** React 18 with Vite 6.4 bundler.
- **Scale:**
  - 82 page views (`apps/web/src/pages`).
  - 86 UI components (`apps/web/src/components`).
  - 26 custom hooks (`apps/web/src/hooks`).
  - 97 registered route paths (`apps/web/src/AppRoutes.tsx`).
- **Production Bundle Performance (`tsc -b && vite build`):**
  - **Build Duration:** 41.66s (Clean build, Exit Code 0).
  - **Chunk Architecture:**
    - `locale-uz`: 44.64 kB (10.97 kB gzip)
    - `locale-en`: 38.83 kB (9.76 kB gzip)
    - `locale-ru`: 45.31 kB (11.75 kB gzip)
    - `charts-vendor`: 422.37 kB (112.59 kB gzip)
    - `react-vendor`: 160.77 kB (52.32 kB gzip)
    - Page modules lazy-loaded via dynamic `import()` to ensure initial bundle load under 250 kB gzip.

---

## 2. Authentication & Client-Side Authorization

- **Session Context (`AuthContext.tsx`):**
  - Tracks user profile, permissions, active tenant, and JWT lifecycle.
  - Silent refresh token rotation executed in the background before token expiration.
  - Protected route wrappers inspect required roles and redirect unauthorized users to login or 403 screen.
- **Client Error Boundary:**
  - Uncaught exceptions trapped by `ErrorBoundary.tsx` are caught, prevented from white-screening the app, and asynchronously reported to the backend telemetry sink (`/api/client-errors/report`).

---

## 3. UX, Accessibility & Responsive Behavior

- **Breakpoints:** Tailwind CSS utility classes enforce mobile-first layout with breakpoints (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`).
- **Form Validation:** React Hook Form with Zod schemas prevents invalid inputs from being submitted to the backend.
- **Accessibility:** Modal dialogs, action sheets, and dropdowns include focus management, keyboard navigation (Escape to dismiss, Tab trapping), and semantic ARIA attributes.

---

## 4. Frontend Automated Test Verification

- **Runner:** Vitest with jsdom environment.
- **Results:** 50 test files, 319 tests passed with 0 failures in 106.6s (`npm test -w @medu/web`).
- **Linter Status:** `npm run lint -w @medu/web` exits with 0 errors (430 warnings, 0 blocking errors).
