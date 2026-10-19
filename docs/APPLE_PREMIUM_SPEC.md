# M-EDU Apple-Premium Redesign Spec (normative)

All rewritten components MUST follow this. Same public API, new restrained visuals.

## 1. Design language
- **Surfaces**: solid `bg-card` (token) + hairline `border border-subtle` + soft shadow.
  Only chrome (modal panel, popover, dropdown, toast, tooltip) may use blur:
  `backdrop-blur-xl bg-glass` — never `saturate(200%)`, never stacked sheens.
- **No** feTurbulence/feDisplacementMap filters, no runtime `inject*Styles()`,
  no per-instance `<style dangerouslySetInnerHTML>`, no conic rainbow, no candy glow.
- **Radii**: inputs/buttons `rounded-lg` (8px), cards/panels `rounded-xl` (12px),
  modals `rounded-2xl` (16px), pills `rounded-full`. No arbitrary `rounded-[20px]`.
- **Colors**: only tokens — CSS vars (`var(--text-primary)` …) or Tailwind
  `brand-*`, `apple-*`, `surface-*`. ZERO raw hex in JSX/styles.
- **Type**: body 14px (`text-sm`/`text-md`), labels 12px medium, captions 11-12px.
  No `font-black`, no `text-[9px]`–`text-[10.5px]`. Numbers `tabular-nums`.
- **Motion**: `duration-150`/`duration-200` + `ease-apple-spring`
  (`cubic-bezier(0.32,0.72,0,1)`). Press feedback `active:scale-[0.98]`.
  Respect `prefers-reduced-motion` (use `usePrefersReducedMotion` from `@/lib/design`).
- **Icons**: inline SVG, 16/18px, `strokeWidth` 1.75, `currentColor`. No emoji.
- **Focus**: `focus-visible:outline-2 outline-offset-2 outline-[var(--border-focus)]`
  or ring `0 0 0 3px var(--focus-ring)`. Never remove without replacement.

## 2. Shared utilities (import, do not re-implement)
```ts
import { cn, usePrefersReducedMotion } from '@/lib/design';
```
`cn(...)` joins classes, drops falsy. Also exported there: `TONES`, `SPRING`,
`CountUp`, `Shimmer`, `Icon`, `getInitials`, `avatarGradient`, `statusColor`.

## 3. Tokens available
CSS vars (see `src/styles/design-tokens.css`): `--bg-card`, `--bg-input`,
`--text-primary/secondary/tertiary/muted`, `--border-subtle/medium/strong`,
`--primary`, `--danger`, `--success`, `--warning`, `--focus-ring`,
`--radius-md/lg/xl/2xl`, `--dur-fast/normal`, plus `--tone-*-fg/bg/border`.
Tailwind: `brand-500 #007AFF`, `apple-blue/green/orange/red/purple/teal/pink`,
`surface-50..950` (Apple grays). Dark mode via `.dark` class — always pair
light+dark utilities (e.g. `bg-white dark:bg-surface-900`).

## 4. Component size targets
Rewrite cleanly at ~30–60% of original line count. Keep JSDoc brief.
Remove dead code; dev-warning boilerplate is optional (keep only useful ones).

## 5. Hard rules
1. **Export names, prop names, prop types, and defaults stay identical**
   (including deprecated aliases). Callers in 88 files must compile unchanged.
2. Keep accepting props you no longer use (mark `/** @deprecated no-op */` in JSDoc,
   keep in the interface) — e.g. `disableRefraction`, `noReflection`.
3. `forwardRef` stays where it exists today.
4. Accessibility must be at least as good: roles, aria-*, labels, keyboard.
5. i18n: components with user-facing strings use `useI18n().t('...')` when a key
   already exists (grep locales), else English literal fallback.
6. Must pass `npx tsc --noEmit` with the repo's strict config
   (`noUnusedLocals`, `noUnusedParameters` are ON).
7. Do NOT edit barrels (`src/components/ui/index.ts`, `src/components/ui.tsx`)
   — another task handles them.
8. Do NOT add dependencies.

## 6. Per-component look (canonical recipes)
- **Button**: heights xs28/sm32/md36/lg40/xl48; icon-only square + `aria-label`.
  primary `bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-xs`;
  secondary `bg-black/[0.04] hover:bg-black/[0.07] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]`
  with `--text-primary`; ghost transparent hover bg; danger `bg-apple-red text-white`;
  link underline. Loading: spinner replaces content, `aria-busy="true"`, disabled.
  Success (kept): brief check state. `asChild` via cloneElement — keep behavior.
- **Input/TextArea/Select**: wrapper label 12px medium `text-secondary`;
  control `h-10 rounded-lg border border-medium bg-input px-3 text-sm
  focus:border-focus` + focus ring shadow; error `border-apple-red` + red ring +
  12px red message with `role="alert"`; hint 12px `text-tertiary`.
  Password toggle button `aria-label` Show/Hide. Native select + chevron bg.
- **Field**: label+error+hint wrapper that `cloneElement`s first child to inject
  `id`, `aria-invalid`, `aria-describedby`, `aria-required`. Keep this contract.
- **Modal**: portal, `role="dialog" aria-modal="true"`, labelled by title
  (`aria-labelledby`, fallback `aria-label` when no title), focus trap, Esc,
  scroll lock, focus restore; backdrop `bg-black/40 backdrop-blur-sm`;
  panel `bg-card border border-subtle shadow-modal rounded-2xl`; sizes sm..full.
  Entrance `animate-modal-in`.
- **Card/StatCard**: `bg-card border border-subtle rounded-xl shadow-card`;
  interactive hover `shadow-card-hover` + `-translate-y-px`.
  StatCard keeps label/value/trend/sparkline API — sparkline = simple SVG polyline
  in `--primary`, no glow.
- **Badge**: pill `inline-flex items-center gap-1 rounded-full border px-2 py-0.5
  text-[11px] font-medium` with tone colors (bg tone 10%, text fg, border 24%).
  Dot variant = 6px currentColor circle. Keep all variant aliases resolving.
- **Table**: clean rows, header 11px uppercase tracking-wide `text-tertiary`,
  row hover `bg-black/[0.02] dark:bg-white/[0.03]`, dividers `border-subtle`,
  sticky header option, sortable th with `aria-sort`, keep `density` prop
  (compact reduces padding).
- **Tabs**: segmented control `bg-black/[0.04] dark:bg-white/[0.06] rounded-lg p-0.5`,
  active pill `bg-card shadow-xs rounded-md`, framer `layoutId` indicator,
  full ARIA tablist + arrow keys (keep existing keyboard logic).
- **Toast**: portal host bottom/top-right; panel `bg-card border border-subtle
  shadow-dropdown rounded-xl px-4 py-3` with tone icon; progress bar line;
  module-level store; `useToast()` keeps `{ push, success, error, warning, info, toastNode }`.
- **Pagination**: compact pill buttons `h-8 min-w-8 rounded-lg`, active
  `bg-brand-500 text-white`, aria-current="page", prev/next with labels.
- **Switch**: track 40x24 rounded-full, thumb 20px white circle w/ shadow,
  spring transform, focus ring, keep sizes sm/md/lg.
- **Skeleton**: `skeleton-shimmer` bg + rounded; PageLoader = spinner + label,
  `role="status"`.
- **Spinner**: simple arc that actually animates via `animate-spin` (config has it),
  `aria-hidden` when decorative, else `role="status"` + label.
- **Empty/ErrorState**: centered 40px icon tile (tone bg), title 15px semibold,
  description 13px secondary, action buttons. ErrorState `role="alert"` + retry.
- **PageHeader**: title 28px semibold tracking-tight + optional description 14px
  secondary + actions right; NO chromatic orb, NO gradient title.
- **Tooltip**: portal, `bg-surface-900 text-white dark:bg-surface-200
  dark:text-surface-900 rounded-md px-2 py-1 text-xs shadow-dropdown`, delay 120ms,
  `aria-describedby`, Escape close, merge consumer handlers (do not drop them).
- **Divider**: 1px `bg-subtle` line, optional label; vertical variant.
- **Avatar**: initials on `avatarGradient(name)` or image; sizes xs..2xl;
  status dot with ring; no specular sheen.
- **GlassSurface (ui/Glass.tsx)**: simple div: `bg-card border border-subtle
  rounded-xl` + tone/elevation maps; tilt optional but subtle (max 4deg) and
  keyboard-safe (no clickable divs without role/tabIndex).
- **ConfirmDialog**: keep full API (type-to-confirm, tones, shortcut, async
  guard) but visually = Modal + clean callout; add `catch` on async confirm so a
  rejected promise never becomes an unhandled rejection.
- **ui.tsx legacy pieces** (TextInput/TextArea/Select/Modal): thin wrappers over
  the new components (no separate visual system). `statusColor` and `useToasts`
  stay exported with identical signatures.

## 7. Verification for each rewritten file
Run: `npx tsc --noEmit -p tsconfig.json` (from apps/web). Zero errors before finishing.
