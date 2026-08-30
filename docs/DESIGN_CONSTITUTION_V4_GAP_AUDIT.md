# M-EDU — Design Constitution v4.0 → Current State Gap Audit

> Date: 2026-08-17 · Type: audit (no code changed) · Scope: design-system
> conformance only — screen-level design is out of scope per constitution §Scope.
>
> Sources compared:
> - **v4.0** = the pasted "M-EDU DESIGN CONSTITUTION v4.0" (this audit quotes its sections A–AL).
> - **v3.1** = `docs/LIQUID_GLASS_TOKENS.md` + `docs/DECISIONS.md` D8/D12 (the current locked spec).
> - **Code** = `lib/core/theme/{app_colors,app_tokens,app_motion,app_density,app_responsive,app_theme,module_colors}.dart`,
>   `lib/shared/design_system/**` (App + Liquid + Crystal layers), spot checks of feature pages.

## Verdict

The current design system is **v3.1-based and directionally aligned** with v4.0
(strategic glass, tokens-only, reduced-motion support, RBAC-aware navigation,
48×48dp targets, offline/sync semantics), but it **does not conform to v4.0 as
written**. The constitution explicitly reclassifies v3.1's locked values
(blur 12/8/20/24 + dynamic 6→16, radius 8/16/24/999, cool neutrals, brand
`#4A6CF7`/`#7C4DFF`) as *historical decisions* to be superseded by its own
semantic tokens. Biggest structural gaps: **no glass performance tiers (T1/T2/T3)
or `PerformanceTierProvider`**, **color system not migrated** (brand, warm
neutrals, semantic palette), **typography scale and font mix off-spec**,
**radius/semantic-spacing/density tables partially mapped**, **motion tokens
renamed and re-valued**, and **no lint/governance enforcement** of the
"no literals in feature code" invariant.

Severity key: **HIGH** = blocks conformance (constitution INVARIANT or
accessibility) · **MED** = significant rework, no accessibility breach ·
**LOW** = rename/cleanup · **OPEN** = constitution itself marks it
`REQUIRES VALIDATION` / `REQUIRES PRODUCT DECISION` (no migration possible yet).

---

## 1. Summary table

| # | Area (v4.0 §) | v4.0 requirement | Current state | Severity |
|---|---|---|---|---|
| 1 | Color — brand (I) | Blue-first `#2F6FEF` family; purple only Identity/AI | Brand `#4A6CF7`→`#7C4DFF` purple gradient used product-wide (identity card, login, hero, FAB) | **HIGH** |
| 2 | Color — semantics (I) | success `#1E9E5A`, warning `#B5750B`, error `#C5372E`, info `#2F6FEF` | `#34C759 / #FF9500 / #FF3B30 / #5AC8FA` — error & success fail WCAG AA on white (§7 below) | **HIGH** |
| 3 | Color — surfaces/text (I) | Warm bg `#F7F6F3`; text `#1B1D22/#5B5F6B/#8A8E99`; border `#E4E2DD/#D2D0CA` | Cool neutrals `#FAFAFC/#1C1C1E/#8E8E93/#C7C7CC`; `textSecondary` fails 4.5:1 (§7) | **HIGH** |
| 4 | Glass tiers (N, AH) | T1/T2/T3 resolution, `PerformanceTierProvider`, fallback, glass budget 3–4 layers | No tiers; real blur removed for perf; one ad-hoc BackdropFilter site; effectively "T3-only" for everything | **HIGH** |
| 5 | Flutter literals (AG) | No raw `Color(0x…)`, `EdgeInsets`, `BorderRadius.circular`, blur, duration in feature code; lint enforcement | Theme layer is tokenized, but feature code + `app_theme.dart` statics contain many literals; no lint rule exists | **HIGH** |
| 6 | Motion (O) | 100/160/220/320/160ms family; nothing >320ms without reason | `AppMotion` 80/120/200/280/240/320ms; `CrystalMotion.flip 600ms`, stagger 420ms, shimmer 900ms | MED |
| 7 | Radius (L) | controls 10–12, cards 16, modals 20–24, glass 20–28 | `sm=8` (deprecated by v4.0), buttons/snackbar/dialog 14, FAB 16, inputs 12 | MED |
| 8 | Typography (J) | Inter only; Display 40/H1 32/H2 26/H3 22/H4 18/Body 16/14, Label 13 w500, Numeric table 14 tabular | Inter + **Roboto** (display/headline/AppBar) + JetBrainsMono; scale one step smaller (32/28/24/20/18/16/14/13/12); label w600 not w500 | MED |
| 9 | Spacing (K) | scale 4…96 incl. 80/96; semantic tokens (page 16 Android, control padding 12/8, card gap 16/12, hero 64+) | Scale caps at 64; Android page padding **20** (spec 16); input padding 16/14, button 28/16 | MED |
| 10 | Elevation (M) | 5 levels (0–4), glass=L3, modal=L4 | 3-level shadow system + Crystal 0–3; no dedicated modal level | MED |
| 11 | Density (F, D-012) | Comfortable 52 / Standard 44 / Dense 36 + per-mode cell padding/card gap/toolbar/sidebar/max-width | `compact/comfortable/spacious` = 36/44/52 (same heights, swapped names); fixed max-width 1440; no per-mode cell/toolbar/sidebar tokens | MED |
| 12 | Dark mode (I) | Architecturally reserved, *not designed in v4.0*; token names must not change | Fully implemented dark palette (`AppColors.dark`) — not a violation, but naming grammar differs from v4.0 | MED |
| 13 | Scroll-reactive blur (N, Audit 03) | **Prohibited** behind scrolling content; dynamic tokens removed | `AppBlur.dynamicMin/Max (6→16)` still defined (dead tokens); `docs/LIQUID_GLASS_TOKENS.md` still prescribes scroll-reactive blur | MED |
| 14 | Docs (source) | Constitution supersedes v3.1 values; decision log updated | `LIQUID_GLASS_TOKENS.md` still "yagona manba" with superseded values; `DECISIONS.md` D12 locks them | MED |
| 15 | Icon family (AD) | One family, **REQUIRES PRODUCT DECISION** | Material Icons used consistently product-wide (good candidate) | OPEN |
| 16 | T1/T2/T3 thresholds, glass blur/opacity (AL) | `REQUIRES VALIDATION` (device matrix) | Not started — no benchmark harness | OPEN |
| 17 | Bottom-nav structure (E) | 4–5 items `EXPERIMENTAL` | 5-tab shell — matches; exact per-role set unvalidated | OPEN |
| 18 | Typography ratio 1.25 (J) | `EXPERIMENTAL` | Current scale is effectively ~1.2; no multilingual validation evidence | OPEN |
| 19 | Identity visualization (W, X) | `REQUIRES VALIDATION` | Face states implemented (`face_scan_status_panel`); trust testing pending | OPEN |

---

## 2. Already conforming (no action)

- **Strategic glass, not universal** (§N INVARIANT): glass is limited to nav,
  floating panels, cards, identity; dense tables/forms use solid surfaces.
- **No glass behind scrolling content** (§N, §AI-23): real blur only in
  `crystal_glass_surface.dart` (off by default); `liquid_glass_container.dart`
  explicitly removed BackdropFilter for scroll performance.
- **Glass has a fallback** (§N): `LiquidGlassContainer` renders tinted/solid
  material without blur — a T3-equivalent fallback exists structurally.
- **Reduced motion** (§O INVARIANT): `AppMotionData` zeroes durations and uses
  linear curves when `MediaQuery.disableAnimationsOf` is set.
- **Android min target 48×48dp** (§G, §AC INVARIANT): enforced in
  `app_button.dart`-style density math — *except* comfortable default is 44
  (see §6 item 7).
- **Offline is normal mode, not error** (§V): sync engine + `app_connection_status`
  distinguishes online/offline/syncing/synced/conflict; Pending vs Synced is not
  presented as server-confirmed.
- **Identity first-class + explicit states** (§W): state machine
  (`face_scan_status_panel.dart`, `recognition_status_cards.dart`) covers the
  listed states; purple reserved to identity/brand moments (though overused — §1 row 1).
- **Search + Command Palette as infrastructure** (§Z, §AA): Ctrl+K palette
  (`command_palette_host.dart:51`), global search sheet (`dashboard_page.dart:360`).
- **RBAC-aware navigation** (§AB INVARIANT): route guards + command gating; one
  component library across roles, no per-role forks.
- **Component inventory** (§P): nearly the full list exists as App/Crystal/Liquid
  components (buttons, inputs, selects, tabs, cards, tables, modals, sheets,
  dialogs, toast, snackbar, tooltip, avatar, badge, status, timeline
  (`activity_timeline_widget`), charts (`crystal_sparkline`, reports), KPI
  (`app_metric_card`), calendar/schedule, student identity card
  (`digital_id_card`), attendance, payments, notifications, empty/loading/error states).
- **Empty/loading/error semantics** (§U INVARIANT): `app_empty_state`,
  skeleton shimmer, offline-is-not-error — structure present.
- **Table/Data Grid rules** (§R): density-driven row heights, sticky headers not
  verified but tables exist; pagination chosen for finite datasets (D14) — matches
  §R preference.
- **Toast/snackbar durations** (§P): toast 4s (2–4s ✓), snackbar default 4s (4–8s ✓).

---

## 3. Detail — HIGH severity gaps

### 3.1 Color architecture (§I) — full migration required

| v4.0 token | v4.0 value | Current (`app_colors.dart` / `app_theme.dart`) |
|---|---|---|
| `color.primary.500/600/700` | `#2F6FEF / #1E58D6 / #1746AC` | `accentStart #4A6CF7`, `accentHover #3D5CE0`, gradient end `#7C4DFF` |
| `surface.background` | `#F7F6F3` (warm) | `#FAFAFC` (cool, neutral.10) |
| `text.primary/secondary/tertiary` | `#1B1D22 / #5B5F6B / #8A8E99` | `#1C1C1E / #8E8E93 / #C7C7CC` |
| `border.subtle/default` | `#E4E2DD / #D2D0CA` | `#E5E5EA / #C7C7CC` |
| `color.success/warning/error/info` | `#1E9E5A / #B5750B / #C5372E / #2F6FEF` | `#34C759 / #FF9500 / #FF3B30 / #5AC8FA` |

Breaches of v4.0 INVARIANTS:

- **Purple restriction** (§I: "Purple is restricted to Identity/Face Recognition
  and explicitly approved AI/premium moments; not a general UI accent"): the
  `#4A6CF7→#7C4DFF` gradient is `accentGradient` on `AppColors`, used for FABs,
  buttons, hero/login backgrounds, identity card, and gamification — purple is a
  general accent today. Note v4.0 *allows* purple in identity + approved AI
  moments, so Identity Card (`digital_id_card.dart`) can keep a premium treatment.
- **Warm surfaces** (§I: "Warm neutral surfaces are the default background
  family"): all surfaces are cool-neutral; `module_colors.dart` adds 11 saturated
  accents + 4 camera colors that v4.0 would demand semantic justification for
  (§I "Saturated color requires semantic or identity justification"; §AI-8/25).
- **Decorative gradients** (§I: "Decorative gradients are prohibited outside
  approved hero/onboarding and Identity moments"): `app_theme.dart` statics
  `liquidPurple`, `liquidGreen`, `liquidGold` (and `liquidCyan`) remain as
  decorative role gradients — D12's notes admit these were intentionally left.
  v4.0 requires removal or explicit exception (exception needs owner + expiry).
- **No component may encode light/dark white/black directly** (§I): theme layer
  uses raw `Colors.white/black` in many component themes (allowed at theme layer,
  but not tokenized) — flag for cleanup under AG enforcement.

Contrast evidence (WCAG 2.2 SC 1.4.3 — v4.0 §AC INVARIANT):

| Color | On | Ratio | Verdict |
|---|---|---|---|
| current `textSecondary #8E8E93` | `#FAFAFC` | ~3.1:1 | **FAIL 4.5:1** |
| current `textTertiary #C7C7CC` | `#FAFAFC` | ~1.5:1 | **FAIL** (metadata only) |
| current `error #FF3B30` | white | ~3.5:1 | **FAIL 4.5:1** |
| current `success #34C759` | white | ~2.2:1 | **FAIL 3:1** (graphical/large) |
| v4.0 `text.secondary #5B5F6B` | `#F7F6F3` | ~5.6:1 | pass |
| v4.0 `error #C5372E` | white | ~5.3:1 | pass |
| v4.0 `success #1E9E5A` | white | ~3.4:1 | pass 3:1 (graphical/large) |

→ Migrating to the v4.0 palette is not just rebranding; it fixes live WCAG AA
failures in error/success/secondary text.

### 3.2 Glass performance tiers (§N, §AH) — the biggest architectural gap

- v4.0 requires **T1 (real-time blur) / T2 (reduced blur) / T3 (flat tint)**
  resolved through one `PerformanceTierProvider` (§AG: "Riverpod exposes
  performance tier through one PerformanceTierProvider; components do not
  independently detect device performance").
- Current code: **no tier concept exists anywhere** (`tier` search = 0 hits).
  Real blur was removed for performance (`liquid_glass_container.dart`,
  `liquid_glass_text_field.dart`); the only live `BackdropFilter` is in
  `crystal_glass_surface.dart` (opt-in, off by default). Effectively the whole
  product is already **T3-style** — a valid fallback, but with no tier resolution,
  no T1/T2 budget logic, and no `glass.blur/opacity/border` token set matching
  v4.0 (current `AppBlur`: 12/8/20/24 + dynamic 6→16 — v4.0: T1 24px@68%,
  T2 10px@82%, T3 0px@92%).
- v4.0 §N: blur radius must never be animated on T2/T3 (OK today — no animated
  blur), glass isolated through one rendering primitive (partially — three glass
  wrappers exist: `liquid_glass_container`, `glass_card`, `crystal_glass_surface`).
- Frame-time fallback thresholds (§N EXPERIMENTAL: >16.6ms T1, >18.2ms T2/T3)
  have no benchmark harness; device profiling is still a pending release-gate item
  (GAPS-G3).

### 3.3 "No literals in feature code" (§AG INVARIANT) — unenforced

Confirmed literal usage outside the approved token/theme layer (examples, not
exhaustive — a full sweep needs a lint pass):

- `auth/login_page.dart`: `Duration(milliseconds: 800)`, `Duration(seconds: 3)`,
  `Duration(milliseconds: 300)`; `splash_page.dart`: `1500ms`, `1s` delays.
- `first_run_wizard_page.dart`: 350/200ms; `gamification_page.dart`: 300ms;
  `dashboard_widgets.dart`: 200ms; `grades_page.dart`: 180ms; `revenue_report_page.dart`: 2s.
- `crystal_button.dart:71`: `Duration(milliseconds: 400)`; `crystal_sparkline.dart`:
  `CrystalMotion.slow + 200ms`; `liquid_glass_button.dart`: 900ms shimmer.
- `app_theme.dart`: dozens of raw `Color(0x…)` literals and `Colors.white/black`
  (theme layer is the sanctioned home, but per §AG they belong to the token files;
  `AppTheme.primary/primaryLight/secondary` etc. duplicate `AppColors` values).
- No lint rule exists (search for `custom_lint`/`analyzer` plugin config — none);
  §AG requires "static analysis/lint rules plus code review", and §AJ/§AK require
  the Feature Intake Gate and Design Review to block violations.

---

## 4. Detail — MEDIUM severity gaps

### 4.1 Motion (§O)

| v4.0 | 100 instant | 160 fast | 220 standard | 320 emphasized | 160 exit |
|---|---|---|---|---|---|
| current | micro 80 | fast 120 | normal 200 | emphasis 280 | (none) |
| | modal 240, page 320 | | | | |

- No `motion.exit` token; `modal=240` and `page=320` have no v4.0 equivalent
  (320 = emphasized; >320 needs an explicit workflow reason).
- >320ms tokens: `CrystalMotion.flip 600ms`, `staggerBase 420ms`,
  `staggerStep 70ms`, 900ms shimmer. v4.0 §O: "No standard product transition
  exceeds 320ms without an explicit workflow reason" — entrance may exceed, so
  stagger/flip *may* qualify, but they need documented reasons + reduced-motion
  verification (shimmer is explicitly removed under reduced motion per §N).
- Curves are `EXPERIMENTAL` in v4.0 (fine to keep current ones until validated).

### 4.2 Radius (§L)

- `AppRadius.sm = 8` — **DEPRECATED by v4.0** ("radius.sm=8px as a universal
  small-control rule is superseded by the 10–12px control range").
- `app_theme.dart` mixes: inputs 12 (✓), buttons/snackbar/dialog **14**,
  FAB/cards 16 (✓), dialogs should be 20–24 per v4.0 (modals 20–24). Bottom
  sheets: verify current radius.
- v4.0: "Equivalent components must share equivalent radius tokens" — buttons,
  snackbar and dialog all at 14 today are *consistent* but off-spec; migrate to
  12 (controls) / 20–24 (modal surfaces).

### 4.3 Typography (§J)

- **Font mix**: `app_tokens.dart` `AppType` uses Inter (✓) + JetBrainsMono for
  IDs; `app_theme.dart` textTheme uses **GoogleFonts.roboto** for
  display/headline/AppBar and Inter for body — v4.0 §J INVARIANT is Inter-only.
- **Scale**: v4.0 Display 40/H1 32/H2 26/H3 22/H4 18 vs current 32/28/24/20/18 —
  one step smaller; missing H4-equivalent is `title` 18 w600 (close); Label must
  be **w500** (current w600); Numeric table 14 w500 tabular exists as
  `statValue`/tabular helpers (✓).
- Two scales coexist: `AppType` (16/14/13/12) vs `ThemeData.textTheme`
  (17/15/12 with roboto) — components and Material widgets disagree. Must be
  unified to the v4.0 scale.
- `mono` uses JetBrainsMono — v4.0 silent on a mono family; treat as an open
  product decision (candidate: Inter with tabular figures is sufficient per §J
  "Financial and comparative numeric columns use tabular figures").

### 4.4 Spacing (§K)

- Scale missing **80, 96** (`AppSpacing` caps at 64).
- Android page padding is **20** (`app_tokens.dart mobilePadding`,
  `app_responsive.dart compact=20`) — v4.0 §G: 16dp side margins; `space.page`
  16px Android.
- Semantic mapping gaps: `space.control.padding` 12h/8v (inputs use 16/14,
  buttons 28/16), `space.card.gap` 16/12 (present as `cardPadding`/rowPadding),
  `space.section.large` 40 (✓ `xxxxl`), `space.hero` 64+ (absent), `space.grid.gutter`
  24 desktop (desktop gutter is **20** in `app_responsive.dart` — 24 only at
  wideDesktop).
- `space.component.internal` 12 ✓ / `space.component.gap` 8 ✓ / `space.section` 32 ✓.

### 4.5 Elevation (§M)

- v4.0 defines **5 levels** (0 background, 1 content, 2 elevated, 3 floating
  glass, 4 modal/overlay) with explicit "adjacent levels distinguishable
  without shadow-only" rule.
- Current: 3 shadows (surface/elevated/floating) + `CrystalGlassSurface`
  elevation 0–3. Level 4 (modal) is not represented; glass (L3) and modal (L4)
  merge into the same `floating` shadow in places. Modal surfaces need their own
  elevation token per §M.

### 4.6 Density (§F, D-012)

- Heights already match numerically (compact 36 / comfortable 44 / spacious 52 =
  Dense 36 / Standard 44 / Comfortable 52) **but names are inverted vs v4.0** and
  defaults differ: v4.0 maps Comfortable→Director/a11y, Standard→Manager/most
  Admin, Dense→Admin high-volume; current default is `comfortable` (=Standard
  height 44) for everyone.
- v4.0 table also defines per-mode **cell padding 6/10·8/12·12/16, card gap
  12/16/24, toolbar 40/44/48, sidebar item 40/44/48, max width 1600/1440/1200** —
  current has none of these per-mode (fixed `maxContentWidth 1440`, no toolbar/
  sidebar density tokens).
- v4.0: "Density is user-togglable on desktop" — current toggle exists in
  settings (`settings_page.dart:695`) ✓. Naming migration is a simple enum rename
  (`compact→dense`, `comfortable→standard`, `spacious→comfortable`) plus default
  re-mapping per role — but changing the *default* is a product decision
  (D-012 is "Validate thresholds").

### 4.7 Android touch targets (§G, §AC)

- v4.0 INVARIANT: min **48×48dp** product controls on Android. Current default
  density `comfortable` yields `controlHeight = 44` (`app_density.dart:61`) —
  below the invariant. `spacious` (52) would pass. Decision needed: raise
  comfortable to 48, or make Android default to a 48-min mapping (v4.0's
  Comfortable=52 row implies the Android default should be the 48+ mode).

### 4.8 Dark mode (§I)

- v4.0: dark is "architecturally reserved but not designed in v4.0";
  **semantic token names must not change when dark is added**. Current code has a
  full dark palette already — not a conformance breach, but if we migrate token
  *names* to v4.0 grammar (`surface.background`, `text.primary`,
  `color.primary.500`), the dark values must follow the same names. Recommend:
  migrate names now (names are the contract), keep dark values as explicitly
  `derived` (as D12 already marks some), and treat dark design as v4.1 work.

### 4.9 Docs & decision log (§traceability, §AM)

- `docs/LIQUID_GLASS_TOKENS.md` claims "yagona manba" (single source) but is the
  superseded v3.1 source; `DECISIONS.md` D12 locks v3.1 values. Per the
  constitution's traceability policy, v3.1 values must be reclassified as
  *historical* and each supersession logged (new Decision Log entries) before or
  with any migration.
- `docs/DECISIONS.md` D8 (3 density presets) and D12 (v3.1 tokens) are the exact
  decisions v4.0 Audit 01/04/05 and §K/§L supersede — update both.

---

## 5. Constitution's own OPEN items that block parts of migration

| Item | Blocking |
|---|---|
| §AD/AL-28: icon family — `REQUIRES PRODUCT DECISION` | Material Icons is the de-facto family; lock it formally |
| §AL: T1/T2/T3 device thresholds, glass blur/opacity — `REQUIRES VALIDATION` | Glass tier implementation cannot be "finalized" until a device matrix benchmark exists (GAPS-G3 device work) |
| §E/D-024: exact 4–5 bottom-nav destinations per role | Current 5-tab shell needs role-based task-frequency validation |
| §J/D-025: 1.25 typography ratio + multilingual (uz/ru/en) testing | Scale migration should wait for this validation or run in parallel |
| §W/D-023: identity visualization trust testing | Purple/identity treatment changes must not regress trust (keep current identity visuals until tested) |
| §AL-29: "160 prior decisions" audit | Acknowledge in docs: v4.0 explicitly says the full audit cannot be honestly claimed; repo decision log D1–D14 is the only local source |

---

## 6. Recommended migration sequence (when approved)

1. **Decision pass** (no code): record in `docs/DECISIONS.md` — accept v4.0 as
   the design authority; mark D8/D12 superseded; log new decisions (v4.0 palette
   adoption, density naming/defaults, icon family, mono family, Android 48dp
   default). Update `docs/LIQUID_GLASS_TOKENS.md` header to "superseded by
   constitution v4.0" (or replace with a v4.0 token sheet).
2. **Token layer** (LOW-MED): rename/extend `app_tokens.dart` + `app_colors.dart`
   to v4.0 grammar and values — colors (with dark values kept as derived),
   radius (10–12/16/20–24), spacing (add 80/96, page 16 Android), motion
   (100/160/220/320/160 + exit), elevation level 4, density table per-mode
   tokens, remove `dynamicMin/dynamicMax`. Keep `AppColors` as the single
   ThemeExtension; add aliases so existing components compile during transition.
3. **Component pass** (MED): unify `ThemeData` typography to Inter-only v4.0
   scale; dialog/sheet radius 20–24; controls 12; Android default density to
   48dp-min; replace decorative gradients (`liquidPurple/Green/Gold`) with
   semantic treatment or logged exceptions.
4. **Glass tiers** (HIGH, largest): introduce `PerformanceTierProvider` +
   T1/T2/T3 resolution in one glass primitive; fold the three glass wrappers
   into one; wire fallback (current behavior becomes T3).
5. **Enforcement** (HIGH): add analyzer lint rules for raw `Color(0x…)`,
   `BorderRadius.circular`, `EdgeInsets`, `Duration(milliseconds:)` outside
   `core/theme`; add the §AJ ten-question intake gate to PR template/CI.
6. **Validation** (per §AL success metrics): device-matrix benchmark for tiers;
   contrast QA sweep (binary §AK checks); multilingual typography test at 200%
   scaling; density error-rate test for Dense.

Suggested phasing: 1→2 (foundation, no visual risk beyond intended) → 3 → 5
(enforcement pays off immediately, catches drift while 4 lands) → 4 → 6.

---

## 7. Appendix — contrast math (WCAG 2.2 relative luminance)

| Pair | L1 | L2 | Ratio |
|---|---|---|---|
| `#8E8E93` on `#FAFAFC` | 0.278 | 0.958 | (1.008)/(0.328) ≈ **3.1:1** — FAIL 4.5:1 |
| `#C7C7CC` on `#FAFAFC` | 0.562 | 0.958 | ≈ **1.7:1** — FAIL |
| `#FF3B30` on white | 0.247 | 1.0 | ≈ **3.5:1** — FAIL 4.5:1 |
| `#34C759` on white | 0.425 | 1.0 | ≈ **2.2:1** — FAIL 3:1 |
| `#5B5F6B` on `#F7F6F3` | ~0.130 | ~0.956 | ≈ **5.6:1** — pass |
| `#C5372E` on white | 0.150 | 1.0 | ≈ **5.3:1** — pass |
| `#1E9E5A` on white | 0.257 | 1.0 | ≈ **3.4:1** — pass 3:1 (graphical/large text) |
