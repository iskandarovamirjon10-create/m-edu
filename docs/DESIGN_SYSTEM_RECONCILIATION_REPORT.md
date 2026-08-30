# M-EDU — Design System Reconciliation Report

> Date: 2026-08-17 · Status: **audit only — no code changed** · Decision gate:
> this report must be approved before any migration begins.
>
> Method: repository sweep of `lib/core/theme/**`, `lib/shared/design_system/**`,
> all `lib/features/**` presentation code, `main.dart`, `pubspec.yaml`, and
> `docs/{LIQUID_GLASS_TOKENS,DECISIONS,CURRENT_STATE,GAPS}.md` against
> M-EDU DESIGN CONSTITUTION v4.0. Every claim cites a file/line or a measured count.

## Gate 0 — APPROVED 2026-08-17 (design authority accepted)

**Product decisions (recorded, implementation in their phases):**

- **C-42 icon family → RESOLVED: Material Symbols Rounded.** One family,
  product-wide, no mixing (implementation = P2 icon pass + font bundling).
- **C-06 module accents → RESOLVED (restrained semantic set):** Dashboard
  = primary, Students = blue, Attendance = green, Finance = amber, Reports
  = violet. Modules are NOT separate color themes (implementation = P1).

**P0 accessibility foundation — implemented 2026-08-17 (this gate):**
C-39 text scaling (1.4 → 2.0 clamp), C-38 48dp touch targets
(`AppDensity.minTouchTarget` + `touchTargetFloor`), C-03/C-05 v4.0 semantic/
text/border colors (`app_colors.dart` + synced `app_theme.dart` statics),
C-47 design-literal regression gate (`tool/check_design_literals.dart` +
`tool/design_literal_baseline.json` + `.github/workflows/ci.yml`), and the
C-32 performance-tier foundation (`core/theme/performance_tier.dart` —
structural only; no rendering behavior change; thresholds REQUIRE VALIDATION).
Validation: contrast unit tests, tier unit tests, 48dp widget tests, 200%
text-scale widget tests; `flutter analyze` + full `flutter test` must pass
before any P1 work begins.

**P0 validation result (2026-08-17): `flutter analyze` = 0 issues; full
`flutter test` = 912 passed, 1 skipped (gated live face-calibration);
20 new tests added (contrast ×7, tier ×5, touch target ×6, text scale ×2);
`dart run tool/check_design_literals.dart` = PASS at baseline
(19/279/417/31/212). P0 is CLOSED — no P1 work starts without a new
approval gate.**

## Sources available

| Ref | Status |
|---|---|
| M-EDU DESIGN CONSTITUTION v4.0 | present (pasted; `Downloads/…/M-EDU_DESIGN_CONSTITUTION_v4.0-2.md`) |
| **M-EDU VISUAL SYSTEM v1.0** | **MISSING — not in repository.** Only cited twice inside the constitution (curves §O; T1/T2/T3 frame-cost budgets §AH). No values can be audited against it; those items are `REQUIRES VALIDATION` until the document is supplied. |
| LIQUID_GLASS_TOKENS.md | present (v3.1 — treated by v4.0 as *historical*) |
| DECISIONS.md | present (D8, D12 lock superseded values) |
| Dart theme/token files | present (`core/theme/*`, Crystal/Liquid/App layers) |
| Components | present (`shared/design_system/{app,crystal,liquid}` + top-level `glass_*`) |

## Verdict

The codebase is tokenized and well-consolidated (Crystal delegates 1:1 to
`AppTokens`/`AppColors` — no duplicated values there), but it implements the
**v3.1 spec**, which v4.0 explicitly supersedes. **Zero** of the v4.0 semantic
tokens exist by name; **none** of the four v4.0 INVARIANT-bearing systems
(color, typography scale, glass tiers, motion family) match. There is exactly
**one** live `BackdropFilter` (opt-in, off by default) and **no** glass behind
scrolling content. The largest engineering gaps are: no T1/T2/T3 glass tier
system, ~178 `BorderRadius.circular` literals in features, ~174 raw `EdgeInsets`
literals, 149+ named-color literals, text scaling clamped at 1.4× (v4.0 §AC
requires 200% usability), and Android default density of 44 (< 48dp invariant).

---

# CONFLICT REGISTER

Format: CONFLICT / CURRENT / V4.0 (or VISUAL SYSTEM) / IMPACT / RECOMMENDATION /
CLASSIFICATION / MIGRATION PRIORITY.

## A. Colors

CONFLICT: C-01 Brand palette
CURRENT: `#4A6CF7` primary + `#7C4DFF` gradient end (`app_colors.dart:149`,
`app_theme.dart:60`); used for FABs, buttons, hero, identity.
V4.0: Blue-first `color.primary.500/600/700 = #2F6FEF/#1E58D6/#1746AC`;
purple restricted to Identity/approved AI (§I).
IMPACT: Purple is a general UI accent today — §I INVARIANT breach; rebrand visible
in every screen.
RECOMMENDATION: Migrate brand tokens to the v4.0 blue family; keep a purple
`identity.*` token consumed only by Identity components (allowed by §W/§X).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P0

CONFLICT: C-02 Unauthorized purple usage
CURRENT: `accentGradient` (blue→purple) on buttons/FABs; `liquidPurple`
`#AF52DE→#FF2D55` (`app_theme.dart:86`); `secondaryLight #FF2D55`
(`app_theme.dart:61`); `module.schedule #AF52DE` (`module_colors.dart:32`).
V4.0: Purple only inside Identity components and approved AI moments (§I, §W);
AI-5/6, AI-17.
IMPACT: Brand-purple gradient competes with the blue-first system; schedule
module reuses the restricted purple.
RECOMMENDATION: Restrict purple to `identity_*` tokens; re-point schedule accent
to an approved blue-derived or semantic token (product decision for module
accents — see C-09).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-03 Semantic state colors + WCAG
CURRENT: success `#34C759`, warning `#FF9500`, error `#FF3B30`, info `#5AC8FA`
(`app_colors.dart:157-160`).
V4.0: success `#1E9E5A`, warning `#B5750B`, error `#C5372E`, info `#2F6FEF` (§I).
IMPACT: Measured contrast on white — error 3.5:1 (FAIL 4.5:1), success 2.2:1
(FAIL 3:1), warning 2.2:1 (FAIL). v4.0 values pass (error 5.3:1, success 3.4:1).
Live §AC INVARIANT failures.
RECOMMENDATION: Adopt v4.0 semantic values; keep `*.soft` backgrounds and add a
`*.on*` foreground check to QA.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P0

CONFLICT: C-04 Surface/temperature
CURRENT: Cool neutrals — scaffold `#FAFAFC`, surface `#FFFFFF` (neutral.0/10/20…).
V4.0: Warm background family — `surface.background #F7F6F3`, `surface.default
#FFFFFF` (§I).
IMPACT: Whole-app background shifts from cool to warm; affects glass tint
perception.
RECOMMENDATION: Migrate `scaffoldBackground` and derived tints to warm values;
re-verify glass contrast on the new base (KEEP `surface.default` white).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-05 Text/border tokens
CURRENT: text `#1C1C1E/#8E8E93/#C7C7CC`, border `#E5E5EA/#C7C7CC`.
V4.0: text `#1B1D22/#5B5F6B/#8A8E99`, border `#E4E2DD/#D2D0CA` (§I).
IMPACT: Current `textSecondary #8E8E93` ≈ 3.1:1 on `#FAFAFC` — FAILS 4.5:1;
v4.0 `#5B5F6B` ≈ 5.6:1 passes. `textTertiary` used for hint text ≈ 1.5:1.
RECOMMENDATION: Adopt v4.0 values; promote tertiary usage only for metadata with
a contrast check.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P0

CONFLICT: C-06 Module accent palette
CURRENT: 12 saturated module accents + 4 camera colors (`module_colors.dart`),
incl. purple/gold/pink/teal.
V4.0: "Rainbow multi-hue interfaces prohibited"; "saturated color requires
semantic or identity justification" (§I); token layer primitive→semantic only (§I).
IMPACT: Undefined in v4.0 — module colors exist only as v3.1 legacy; risk of
rainbow interface.
RECOMMENDATION: Either (a) product decision to keep module accents with written
justification + exception, or (b) collapse to semantic/blue-family derivation.
Camera colors are identity-context → keep under `identity.*` namespace.
CLASSIFICATION: REQUIRES PRODUCT DECISION
MIGRATION PRIORITY: P1

CONFLICT: C-07 Decorative gradients
CURRENT: `liquidPurple/liquidGreen/liquidGold` (`app_theme.dart:82-92`), used
for role decorations; `successGlowGradient`, `warmAlertGradient` in AppColors.
V4.0: "Decorative gradients prohibited outside approved hero/onboarding and
Identity moments" (§I, AI-1).
IMPACT: Payment-success glow and role gradients are decoration; success must be
semantic (Audit 05 verdict).
RECOMMENDATION: Delete or confine to hero/identity; payment success uses
`color.success` + soft background only.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-08 AppTheme static color block = duplicate token source
CURRENT: `AppTheme` defines ~20 raw colors duplicating `AppColors`/`module_colors`
(primary, secondary, success/warning/error/info, text trio, separator, aurora×5,
liquidFrost/Specular/Edge, bg `#F0F2F5` `app_theme.dart:23-120`), consumed by
Liquid/Glass components.
V4.0: One semantic token source; primitive values only in token layer (§I, AG).
IMPACT: Two sources of truth for the same values → drift risk; `#F0F2F5`
(`backgroundLight`) matches nothing.
RECOMMENDATION: Replace all `AppTheme.*` color statics with `AppColors`
references or remove; keep only composition helpers.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-09 Raw `Colors.*` in feature code
CURRENT: 149+ named-color literals across features (e.g. `Colors.white` on
primary/gradients, `Colors.blueGrey` for cold leads `crm_kanban_page.dart:309`,
`Colors.black` overlays `face_scan_overlay.dart:94`).
V4.0: Feature code may not contain arbitrary color literals (§AG INVARIANT).
IMPACT: Camera overlays & kanban colors bypass tokens and dark-mode mapping.
RECOMMENDATION: Sweep to tokens (`onPrimary`, `overlay.scrim`, semantic lead
bucket tokens); white-on-primary may become `color.onPrimary` token.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-10 Raw hex in feature code
CURRENT: 11 hex literals in features — `finance_page.dart:192-193` and
`revenue_report_page.dart:56-57` (green/red chart pairs `#00A86B/#30D158/#FF3B30/
#FF6961`), `first_run_wizard_page.dart:143`, `gamification_page.dart:310`,
`user_management_page.dart:383`, `dashboard_page.dart:75-76`, `face_camera_view.dart:24`
(`#101214` camera bg).
V4.0: `Color(0x…)` prohibited outside approved token/theme layer (§AG INVARIANT).
IMPACT: Chart colors and wizard gradients are off-token; camera bg untokenized.
RECOMMENDATION: Tokenize chart series (`chart.*` semantic set), wizard gradient,
camera background (`camera.background`), dashboard surfaces.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

## B. Typography

CONFLICT: C-11 Font families
CURRENT: Inter (body) + **Roboto** (display/headline/AppBar —
`app_theme.dart:155-207`) + JetBrainsMono (ID/mono — `app_tokens.dart:212`).
V4.0: Inter is the primary typeface (§J INVARIANT); mono family unspecified.
IMPACT: Roboto headings break the §J invariant and dilute brand voice.
RECOMMENDATION: Inter everywhere (including display/headline); mono → product
decision (Inter tabular or keep JetBrainsMono as a documented exception).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-12 Font delivery
CURRENT: `google_fonts` fetches at runtime (no font assets in `pubspec.yaml`);
`assets/fonts` was deleted as empty (per pubspec comment).
V4.0: Inter is an INVARIANT — offline-first product requires the font to be
present offline (§J, product context offline-first).
IMPACT: First-run/offline screens may fall back to system font, violating the
INVARIANT; inconsistent rendering across devices.
RECOMMENDATION: Bundle Inter (and mono) as assets; keep google_fonts only as a
cache/fallback path.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-13 Typography scale
CURRENT: display 32/h1 28/h2 24/h3 20/title 18/body 16/bodySmall 14/label 13/
caption 12 (`app_tokens.dart` AppType).
V4.0: display 40/H1 32/H2 26/H3 22/H4 18/body-large 16/body 14/label 13/caption 12/
numeric-large 28/numeric-table 14 tabular (§J).
IMPACT: Scale is one step smaller and lacks H4/numeric-large at spec sizes;
headings look underweight vs v4.0.
RECOMMENDATION: Adopt v4.0 sizes; map `title`→H4 18; add `numericLarge` 28.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-14 Label weight + secondary scale
CURRENT: `label` = w600 (`app_tokens.dart:175`); ThemeData body 17/15, label 12
(`app_theme.dart:185-197`).
V4.0: Label w500 (§J); body-large 16 / body 14; caption 12.
IMPACT: Two conflicting scales in one app (AppType vs ThemeData); label too heavy.
RECOMMENDATION: Unify on the v4.0 scale; drop ThemeData's 17/15 sizes to
16/14; label → w500.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-15 Bottom-nav label size
CURRENT: bottom nav labels at **10px** (`app_theme.dart:221-223`).
V4.0: caption 12 minimum; body ≥14 for standard content (§J).
IMPACT: 10px is below the smallest v4.0 size; readability on Android.
RECOMMENDATION: Raise to 12 (caption token) with 48dp target.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-16 Modular ratio 1.25
CURRENT: effective ratio ≈ 1.2; no multilingual validation evidence.
V4.0: 1.25 is `EXPERIMENTAL` until uz/ru/en + 200% testing (§J, D-025).
IMPACT: Cannot lock typography until validated.
RECOMMENDATION: Keep scale close to 1.25, validate, then lock.
CLASSIFICATION: REQUIRES VALIDATION
MIGRATION PRIORITY: P2

## C. Spacing

CONFLICT: C-17 Scale gaps
CURRENT: `AppSpacing` = 4/8/12/16/20/24/32/40/48/64 (`app_tokens.dart:24-36`).
V4.0: canonical 4/8/12/16/20/24/32/40/48/64/80/96 (§K).
IMPACT: Missing 80/96 for hero/wide sections.
RECOMMENDATION: Add 80/96.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-18 Android page padding
CURRENT: mobile horizontal padding **20** (`app_tokens.dart:52`,
`app_responsive.dart:49`).
V4.0: Android 16dp side margins (§G); `space.page` 16px Android (§K).
IMPACT: Content inset 4px too wide on every Android screen.
RECOMMENDATION: mobilePadding → 16.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-19 Control padding semantics
CURRENT: inputs `16/14` (`app_theme.dart:249`), buttons `28/16` horizontal.
V4.0: `space.control.padding` 12h/8v (§K).
IMPACT: Raw paddings drift from the semantic table; density scaling misses them.
RECOMMENDATION: Map to `space.control.padding` + density-aware scaling.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-20 Grid gutter
CURRENT: gutter 20 desktop / 24 wide (`app_responsive.dart:62-63`).
V4.0: `space.grid.gutter` 24 desktop (§K, F 12-col grid).
IMPACT: Desktop grid slightly tighter than spec.
RECOMMENDATION: desktop gutter → 24.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-21 Raw EdgeInsets in features
CURRENT: 174+ `EdgeInsets.*` literals in features; off-scale values incl. 3, 5, 6,
10, 11, 13, 14, 18, 20, 28, 40, 96 (`dashboard_today_schedule.dart:189` 3,
`identity_detail_page.dart:732` 2, `first_run_wizard_page.dart:240` 3, …).
V4.0: Feature code may not contain raw `EdgeInsets(...)` (§AG INVARIANT); spacing
values must be tokens (§K).
IMPACT: Untracked spacing breaks the 4px rhythm and density scaling.
RECOMMENDATION: Mechanical sweep to `AppSpacing.*`/semantic tokens; off-scale
values → nearest token (owner review).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

## D. Radius

CONFLICT: C-22 Small-control radius
CURRENT: `AppRadius.sm = 8` (`app_tokens.dart:61`); many features use 8.
V4.0: controls 10–12px (§L); 8px DEPRECATED as universal control radius.
IMPACT: Buttons/badges too square for the v4.0 calm-premium language.
RECOMMENDATION: sm → 10–12 (choose 12); deprecate 8 token.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-23 Theme radius mix
CURRENT: inputs 12, buttons **14** (`app_theme.dart:262`), snackbar/dialog **14**,
FAB **16**, cards 16.
V4.0: controls 10–12, cards 16, modals 20–24, glass 20–28 (§L).
IMPACT: Buttons off-spec (14), dialogs/snackbar far below modal range (14).
RECOMMENDATION: buttons → 12; dialog/sheet → 20–24; snackbar → 12 (transient
control) or 16.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-24 Raw BorderRadius in features
CURRENT: 178+ `BorderRadius.circular(...)` literals; off-scale values 2, 6, 18,
22, 28, 30 (`student_detail_page.dart:732` 2, `add_lesson_sheet.dart:96` 2,
`group_detail_page_widgets.dart:40` 18, `wizard_step_header.dart:27` 22,
`splash_page.dart:82` 30, `digital_id_card.dart:33` 28 hero — 28 is allowed for
hero per §L).
V4.0: No raw `BorderRadius.circular` in feature code (§AG); radius tokens only (§L).
IMPACT: Radius language is inconsistent per feature; QA cannot distinguish
intentional (hero 28) from drift (2/6/18/22/30).
RECOMMENDATION: Sweep to `AppRadius.*`; keep hero 28 as an explicit
`radius.hero` token.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

## E. Elevation, borders, shadows

CONFLICT: C-25 Elevation model
CURRENT: 3 shadow levels (surface/elevated/floating — `app_tokens.dart:88-131`) +
`CrystalGlassSurface` elevation 0–3.
V4.0: 5 levels 0–4: background, content, elevated, **floating glass**, **modal**
(§M).
IMPACT: Modal surfaces share the floating treatment; level-4 modal distinction
missing; "adjacent levels distinguishable without shadow-only" unverifiable.
RECOMMENDATION: Add `elevation.modal` + glass-level tokens; map Crystal 3→glass,
4→modal.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-26 Border tokens
CURRENT: separator `#E5E5EA`/`#C7C7CC`; card border width 0.5
(`app_theme.dart:235`); `liquidBorder #CCFFFFFF`.
V4.0: `border.subtle #E4E2DD` / `border.default #D2D0CA`; glass.border 1px (§I, N).
IMPACT: Border values superseded; 0.5px hairline vs 1px glass border.
RECOMMENDATION: Migrate hex values; unify border width tokens (surface 0.5–1,
glass 1).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-27 Shadow restraint
CURRENT: `AppShadow.floating` includes a brand-colored glow
(`app_tokens.dart:126-130`); `AppShadow.glow` helper exists.
V4.0: Shadows restrained, tokenized; large blurred shadows prohibited on
continuously scrolling content; elevation communicates hierarchy not decoration
(§M).
IMPACT: Brand glow is decorative emphasis; scrolling-content shadows unchecked.
RECOMMENDATION: Keep surface/elevated; move glow to identity-approved contexts only.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

## F. Motion

CONFLICT: C-28 Duration family
CURRENT: micro 80 / fast 120 / normal 200 / emphasis 280 / modal 240 / page 320
(`app_motion.dart:28-33`).
V4.0: instant 100 / fast 160 / standard 220 / emphasized 320 / exit 160 (§O).
IMPACT: Every token re-valued; no exit token; modal=240 has no v4.0 equivalent.
RECOMMENDATION: Rename/revalue to v4.0 family; add `motion.exit`; map modal→220–320.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-29 Transitions > 320ms
CURRENT: `CrystalMotion.flip` 600 (`crystal_motion.dart:32`), stagger base 420 +
70/step (`app_motion.dart:36-39`), shimmer 900 (`liquid_glass_button.dart:55`),
sparkline 520 (`crystal_sparkline.dart:53`), crystal button 400
(`crystal_button.dart:71`), login 800 (`login_page.dart:402`), splash 1500
(`splash_page.dart:26`).
V4.0: no standard transition > 320ms without an explicit workflow reason; entrance
may exceed (§O).
IMPACT: Splash (1500) is arguably entrance; flip/shimmer/stagger are decorative
with no documented reason.
RECOMMENDATION: Document or shorten each >320ms case; verify reduced-motion
kills shimmer/stagger.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-30 Raw durations in features
CURRENT: `Duration(milliseconds: 150/180/200/300/350/800/1200/1500)` across
features (login, splash, wizard, sheets, dashboard, gamification, grades,
revenue, camera settings).
V4.0: arbitrary animation durations prohibited in feature code (§AG).
IMPACT: Untracked motion contradicts the single motion engine.
RECOMMENDATION: Sweep to `AppMotion.*`/`context.appMotion`.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-31 Easing curves
CURRENT: standard/entrance/exit/springy defined (`app_motion.dart:45-56`);
reduced-motion → linear/zero (verified in `AppMotionContextX`).
V4.0/VISUAL SYSTEM: curves are `EXPERIMENTAL` until motion testing (§O).
IMPACT: Curves are provisional in both docs — nothing to change yet.
RECOMMENDATION: Keep current curves; record as REQUIRES VALIDATION with v4.0
metrics (≥80% preference/no-error).
CLASSIFICATION: REQUIRES VALIDATION
MIGRATION PRIORITY: P3

## G. Glass

CONFLICT: C-32 No performance tiers
CURRENT: no `PerformanceTierProvider`; no T1/T2/T3 anywhere (search `tier` = 0).
V4.0: tiers resolved via one provider (§AG); T1 60fps ≤10ms, T2 ≤5ms, T3 ≥45fps
no sustained jank (§AH); frame thresholds >16.6ms T1 / >18.2ms T2/T3 (§N).
IMPACT: The constitution's central glass architecture is absent; every device
gets the same (T3-like) treatment; no degradation path.
RECOMMENDATION: New: `PerformanceTierProvider` (Riverpod) + tiered glass
primitive; current behavior becomes the T3 tier. Requires device matrix
validation before locking thresholds.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P0

CONFLICT: C-33 Blur/opacity values
CURRENT: blur 12(nav)/8(card)/20(modal)/24(floating) + dynamic 6→16; opacity
0.70/0.55/0.72/0.85 (`app_tokens.dart:66-75`, `app_colors.dart:141-145`).
V4.0: T1 24px@68%, T2 10px@82%, T3 0px@92%; blur radius never animated on T2/T3
(§N).
IMPACT: v3.1 values are the exact "historical decisions" v4.0 Audit 01 replaces.
RECOMMENDATION: Replace with T1/T2/T3 token sets; delete dynamic pair (C-34).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P0

CONFLICT: C-34 Scroll-reactive blur tokens
CURRENT: `AppBlur.dynamicMin/Max = 6/16` defined, **zero usages**
(`app_tokens.dart:74-75`); `LIQUID_GLASS_TOKENS.md` §4 still prescribes it.
V4.0: scroll-coupled blur prohibited (Audit 03; §N; AI-23).
IMPACT: Dead tokens + doc prescription of a prohibited behavior.
RECOMMENDATION: Delete tokens; amend doc.
CLASSIFICATION: DEPRECATE
MIGRATION PRIORITY: P1

CONFLICT: C-35 Glass primitives multiplicity
CURRENT: 3+ wrappers: `liquid_glass_container`, `glass_card`
(+`GlassCardGradient`), `crystal_glass_surface` (only live BackdropFilter, opt-in
off-by-default); `liquid_glass_button`, `liquid_glass_text_field` carry their own
tints.
V4.0: every glass surface isolated through the approved rendering primitive;
feature code may not implement BackdropFilter (§N).
IMPACT: Tier resolution cannot be centralized across 3 wrappers; blur behavior
diverges.
RECOMMENDATION: Consolidate to one `GlassSurface` primitive (tier-aware);
others become thin aliases.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-36 Glass usage map
CURRENT: glass on nav, cards, sheets, floating panels, identity; NO glass behind
scrolling content; NO scroll-time blur. (BackdropFilter: exactly 1 site.)
V4.0: permitted contexts only; glass prohibited on tables/forms/lists/scrolling
backgrounds (§N).
IMPACT: None — current usage already conforms.
RECOMMENDATION: KEEP; add a guard comment tying the primitive to §N.
CLASSIFICATION: KEEP
MIGRATION PRIORITY: P3

## H. Density, touch targets, responsive

CONFLICT: C-37 Density naming + per-mode tokens
CURRENT: compact 36 / comfortable 44 / spacious 52 (`app_density.dart:54-63`);
fixed `maxContentWidth 1440`; no per-mode cell padding / card gap / toolbar /
sidebar tokens.
V4.0: Dense 36 / Standard 44 / Comfortable 52 **plus** cell padding 6/10·8/12·12/16,
card gap 12/16/24, toolbar 40/44/48, sidebar item 40/44/48, max width
1600/1440/1200 (§F); role defaults Director→Comfortable, Manager/Admin→Standard,
Admin high-volume→Dense.
IMPACT: Names invert meaning vs v4.0 (current "comfortable"=44=Standard);
per-mode tokens absent; role defaults absent; a "fourth mode" risk if a role
needs another preset.
RECOMMENDATION: Rename enum (`dense/standard/comfortable`), add per-mode token
table, set role defaults, keep user toggle.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-38 Android touch targets
CURRENT: Android default density = comfortable → control/row **44**
(`app_density.dart:61`); `AppButton.sm` base 40 (`app_button.dart:46`);
comment cites old "≥44" spec.
V4.0: Android product controls ≥ **48×48dp** (§G, §AC INVARIANTs).
IMPACT: Buttons/rows at 44 and 40 below the invariant (Material tap padding may
pad some, not all).
RECOMMENDATION: Android default maps to a 48-min set; sm button → 48 hit target;
update the `≥44` comment.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P0

CONFLICT: C-39 Text scaling clamp
CURRENT: `MediaQuery.withClampedTextScaling(min 1.0, max 1.4)` (`main.dart:330-334`);
rationale: dense-glass layouts break.
V4.0: text must remain usable at **200%** scaling without clipping/loss (§AC
SYSTEM RULE; §J reflow).
IMPACT: Direct conflict — the clamp violates §AC; the cited reason (layout
breakage) is exactly what v4.0 forbids as acceptable.
RECOMMENDATION: Remove the 1.4 clamp; make layouts reflow (dense modes +
glass surfaces must tolerate ≥1.5; validate to 2.0).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P0

CONFLICT: C-40 Breakpoint/width rules
CURRENT: width-based breakpoints (<600/<900/<1440) + 12-col grid
(`app_responsive.dart`) — matches v4.0's width-based model (§H).
V4.0: responsive = width + role + complexity + input; no device-name-only
breakpoints; each region's transform defined explicitly (§H).
IMPACT: Core model conforms; per-region transform rules are undocumented.
RECOMMENDATION: KEEP model; document region transforms (collapse/stack/sheet/
full-screen/overflow) per breakpoint in component docs.
CLASSIFICATION: KEEP
MIGRATION PRIORITY: P3

## I. Navigation, icons, components

CONFLICT: C-41 Navigation shell
CURRENT: 5-tab StatefulShellRoute + desktop sidebar + top bar
(`main_shell_page`, `app_sidebar`, `app_shell_top_bar`); Ctrl+K palette
(`command_palette_host.dart:51`); global search (`dashboard_page.dart:360`);
breadcrumbs; RBAC guards.
V4.0: 4–5 bottom-nav items `EXPERIMENTAL` (§E, D-024); sidebar/topbar split;
palette = shortcut layer (§Z/§AA); depth ≤3 (§D).
IMPACT: Structure conforms; exact per-role destination set unvalidated; depth
rule unverified.
RECOMMENDATION: KEEP; validate per-role bottom-nav set (A/B, ≥90% first-attempt);
audit nav depth ≤3.
CLASSIFICATION: KEEP
MIGRATION PRIORITY: P3

CONFLICT: C-42 Icon system
CURRENT: Material Icons product-wide, mixed outlined+filled variants
(e.g. `Icons.school_outlined` vs filled check icons).
V4.0: one approved family (`REQUIRES PRODUCT DECISION` — §AD, AL-28); stroke-first
default, filled only for active emphasis (§AD).
IMPACT: Family unapproved; filled/outlined usage is inconsistent.
RECOMMENDATION: Lock Material Icons as the family (decision); define
stroke-first rule + active-state treatment.
CLASSIFICATION: REQUIRES PRODUCT DECISION
MIGRATION PRIORITY: P2

CONFLICT: C-43 Component states
CURRENT: `AppButton` delegates to Material states (hover/focus/pressed/disabled/
loading) (`app_button.dart:70-105`); `CrystalGlassSurface` has a full state
machine incl. focus ring (`crystal_states.dart`); focus visible on Crystal.
V4.0: state matrix per family (§Q); focus visible even with selected/error (§Q).
IMPACT: App-layer components inherit Material semantics (OK); Crystal focus ring
only when `showFocusRing` — verify default on interactive surfaces.
RECOMMENDATION: KEEP; add a state-matrix conformance test per component.
CLASSIFICATION: KEEP
MIGRATION PRIORITY: P3

CONFLICT: C-44 Duplicate components
CURRENT: 4 button impls (`app_button`, `liquid_glass_button`, `crystal_button`,
`glass_button`), 5 surface impls (`app_card`, `glass_card`, `liquid_glass_card`,
`liquid_glass_container`, `crystal_glass_surface`), 2 text fields
(`glass_text_field`, `liquid_glass_text_field`), 2 empty states.
V4.0: component library is the only approved source (§P); feature teams may not
clone components (AI-39).
IMPACT: Behavior/a11y diverge; tier work (C-32/35) must touch all of them.
RECOMMENDATION: Declare `App*` canonical; deprecate `glass_*`/`liquid_*`/`crystal_*`
overlap with migration notes (keep as aliases during transition).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

## J. Accessibility, tokens, governance

CONFLICT: C-45 Color-not-alone + contrast QA
CURRENT: status chips pair icon+text (`app_status_chip`, `status_badge`); error
uses icon+text+color in forms; no automated contrast gate.
V4.0: color never sole carrier (§AC INVARIANT); binary contrast QA (§AK).
IMPACT: Semantics mostly conform; QA gates absent.
RECOMMENDATION: KEEP semantics; add contrast/state checks to CI QA.
CLASSIFICATION: KEEP
MIGRATION PRIORITY: P2

CONFLICT: C-46 Token naming grammar
CURRENT: camelCase (`textPrimary`, `scaffoldBackground`, `AppSpacing.xs`).
V4.0: semantic dotted grammar (`text.primary`, `surface.background`,
`color.primary.500`, `space.*`, `radius.*`) (§I/§K/§L/§AF); names must not change
when dark mode is added (§I).
IMPACT: Dart cannot use dotted names directly; the contract is the *semantic
name*, which must map 1:1 in docs/lint config.
RECOMMENDATION: Introduce a name registry (`dotted name ↔ Dart identifier`) in
the token files; document it in `LIQUID_GLASS_TOKENS.md` replacement.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P2

CONFLICT: C-47 No lint enforcement
CURRENT: no analyzer rules for raw `Color(0x…)`/`EdgeInsets`/`BorderRadius`/
`Duration` outside `core/theme` (AG requires static analysis).
V4.0: enforcement via lint + review (§AG SYSTEM RULE).
IMPACT: Every literal found in this audit survives without enforcement.
RECOMMENDATION: Add a lint rule (custom_lint or analyzer plugin) scoped to
`lib/features`; add CI gate (extend `.github/workflows/ci.yml`).
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-48 No intake gate / design review stages
CURRENT: CI runs format/analyze/test/build only; no §AJ 10-question gate, no
§AK review sequence.
V4.0: feature intake gate is INVARIANT (§AJ); review sequence is pass/fail (§AK).
IMPACT: New features can reintroduce every violation above.
RECOMMENDATION: PR template with the 10 questions + design review checklist in CI.
CLASSIFICATION: MODIFY
MIGRATION PRIORITY: P1

CONFLICT: C-49 Dark mode status
CURRENT: full dark palette implemented (`AppColors.dark`, `iOS27DarkTheme`).
V4.0: dark is architecturally reserved but **not designed in v4.0** (§I).
IMPACT: Not a violation; but dark values are `derived` and must follow the new
token names (C-46).
RECOMMENDATION: KEEP implementation; re-derive values under v4.0 names; treat
dark design as v4.1.
CLASSIFICATION: KEEP
MIGRATION PRIORITY: P3

CONFLICT: C-50 Identity/face visuals
CURRENT: premium ring + purple brand gradient on digital ID card
(`digital_id_card.dart:33-45`), 13-state face panel
(`face_scan_status_panel`), camera failure recovery present.
V4.0: identity states explicit (§W); visualization `REQUIRES VALIDATION`
(§W/X, D-023); purple allowed in identity (§W).
IMPACT: Feature exists and matches state list; trust/performance of the visual
treatment unvalidated.
RECOMMENDATION: KEEP implementation; add trust/validation study before any
restyle; keep purple only here.
CLASSIFICATION: REQUIRES VALIDATION
MIGRATION PRIORITY: P2

---

# A. Critical blockers (approve-then-fix, in order)

1. **C-39 — Text scaling clamp 1.4×** breaks §AC (200% usability). Affects all
   screens; glass/dense layouts must reflow.
2. **C-32 — No performance-tier system.** The constitution's core glass
   architecture is absent; T1/T2/T3 + provider must be built before any glass
   value migration is meaningful.
3. **C-03/C-05 — WCAG failures in current palette** (error/success/secondary
   text). Accessibility INVARIANTs — highest user impact per change.
4. **C-38 — Android targets 44/40 < 48dp** invariant.
5. **C-01 — Brand migration** (blue family + purple restriction) — visible,
   product-identity decision.
6. **C-47/C-48 — No enforcement or gates** — without them every other fix
   regresses.

# B. Design-system conflicts

- **Colors**: C-01, C-02, C-03, C-04, C-05, C-06, C-07, C-08 (MODIFY ×7,
  REQUIRES PRODUCT DECISION ×1).
- **Typography**: C-11, C-12, C-13, C-14, C-15 (MODIFY), C-16 (REQUIRES VALIDATION).
- **Spacing**: C-17, C-18, C-19, C-20 (MODIFY), C-21 (MODIFY sweep).
- **Radius**: C-22, C-23, C-24 (MODIFY).
- **Elevation/borders/shadows**: C-25, C-26, C-27 (MODIFY).
- **Motion**: C-28, C-29, C-30 (MODIFY), C-31 (REQUIRES VALIDATION).
- **Glass**: C-32, C-33, C-35 (MODIFY), C-34 (DEPRECATE), C-36 (KEEP).
- **Density/touch/responsive**: C-37, C-38, C-39 (MODIFY), C-40 (KEEP).
- **Navigation**: C-41 (KEEP). **Icons**: C-42 (REQUIRES PRODUCT DECISION).
- **Components**: C-43 (KEEP), C-44 (MODIFY).
- **A11y/tokens/governance**: C-45, C-49 (KEEP), C-46, C-47, C-48 (MODIFY),
  C-50 (REQUIRES VALIDATION).

# C. Code-level violations (measured)

| Violation | Count | Worst locations |
|---|---|---|
| `BorderRadius.circular(...)` in features | 178+ | every feature page; off-scale 2/6/18/22/30 |
| Raw `EdgeInsets.*(...)` in features | 174+ | dashboard, crm, students, identity pages |
| `Colors.*` named literals in features | 149+ | white-on-gradient, `Colors.blueGrey` (kanban), black overlays |
| Raw `Duration(milliseconds:)` in features | 20+ | login 800, splash 1500, wizard 350, shimmer 900 (design_system) |
| Raw `Color(0x…)` in features | 11 | finance/revenue chart pairs, wizard gradient, camera bg `#101214` |
| Live `BackdropFilter` | 1 | `crystal_glass_surface.dart:161` (opt-in, off by default — compliant) |
| Dead scroll-blur tokens | 2 | `AppBlur.dynamicMin/Max` (unused) |
| Duplicate color source | ~20 statics | `AppTheme` block duplicating `AppColors`/module colors |

# D. Deprecated legacy decisions

- **D-012 (density presets)** — names/values superseded by §F table (C-37).
- **D-012 note (D8)**: "3 density presets" kept, but semantics change.
- **v3.1 glass values** — blur 12/8/20/24 + dynamic 6→16 (Audit 01 verdict;
  C-33/C-34).
- **v3.1 radius sm=8** — superseded by 10–12 (§L; C-22).
- **v3.1 cool neutrals + brand `#4A6CF7/#7C4DFF`** — superseded (Audit 02/05;
  C-01…C-05).
- **Scroll-reactive blur prescription in `LIQUID_GLASS_TOKENS.md`** — prohibited
  behavior, deprecate the section (Audit 03; C-34).
- **`AppTheme` static palette as a public color API** — deprecate statics in
  favor of `AppColors` (C-08).

# E. Requires-validation decisions

- C-16 typography ratio 1.25 (multilingual + 200% test).
- C-31 motion curves + duration family (A/B, ≥80% preference, no error increase).
- C-32/33 glass T1/T2/T3 thresholds + blur/opacity (device matrix; frame-time
  budgets; §AL success metrics) — **VISUAL SYSTEM v1.0 needed**.
- C-50 identity visualization trust test (≥90% state identification).
- C-41 per-role bottom-nav set (≥90% first-attempt, ≤5s find).
- Dense-mode error rate (>10% relative error triggers review — §F).
- 200% scaling reflow validation across dense/glass surfaces (C-39).

# F. Requires-product-decision decisions

- ~~C-42 icon family~~ → **RESOLVED Gate 0: Material Symbols Rounded** (P2 impl).
- ~~C-06 module accent palette~~ → **RESOLVED Gate 0: dashboard=primary,
  students=blue, attendance=green, finance=amber, reports=violet** (P1 impl).
- Mono family (Inter tabular vs JetBrainsMono) — C-11.
- Density **defaults per role** (D-012 is "Validate") — C-37.
- Dark mode: ship as v4.1 or keep derived values under v4.0 names — C-49.
- Brand rollout scope: full palette swap in one release vs token-rename-only
  first (visual change containment) — C-01.

# G. Migration dependency graph

```
Enforcement (C-47 lint) ─┐
Docs/decisions (C-34, D-012, v3.1 deprecation) ─┤ (foundation, no visual risk)
Token name registry (C-46) ──────────────────────┤
                          ▼
              Token layer v4.0
   (C-01..05 colors | C-11..15 type | C-17..20 spacing |
    C-22..23 radius | C-28 motion | C-25 elevation)   ← P0/P1 batch
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   Density & a11y fixes           Glass tier system
   (C-37 rename, C-38 48dp,      (C-32 provider → C-33 values
    C-39 text scale)              → C-35 single primitive)
            │                           │
            └─────────────┬─────────────┘
                          ▼
              Component sweep
   (C-21/24/30 literal cleanup, C-44 dedupe, C-07 gradients,
    C-09/10 feature colors, C-23/26/27/29 theme alignment)
                          ▼
              Validation & gates
   (device matrix → tier lock; 200% reflow; contrast QA;
    C-48 intake gate; VISUAL SYSTEM v1.0 supplied)
```
Blocking edges: C-39, C-38, C-03/C-05 are independent P0 fixes — can start
immediately. C-33 (glass values) must wait for C-32 (tier system). C-46 (names)
should precede C-01..05 to avoid double renames. C-47 lint should land first to
stop new literals during the sweep.

# H. Recommended migration order

1. **Gate 0 — approvals**: this report + F decisions (icon family, module
   accents, brand rollout scope).
2. **P0 (a11y, independent)**: C-39 text scale, C-38 48dp targets, C-03/C-05
   semantic colors (with contrast re-check), C-47 lint rule + CI gate.
3. **P0 (architecture)**: C-32 `PerformanceTierProvider` + single glass
   primitive; land current visuals as the T3 tier.
4. **P1 (tokens)**: C-46 name registry → C-01..05, C-11..15, C-17..20,
   C-22..23, C-25, C-28; C-34 delete; C-08 AppTheme statics; C-12 fonts bundled.
5. **P1 (components)**: C-44 dedupe (App* canonical), C-07/C-09/C-10/C-21/C-24/
   C-30 sweeps, C-37 density rename + per-mode tokens.
6. **P2**: C-06 module accents (per F decision), C-42 icon lock, C-15 bottom-nav
   labels, C-18/19/20 spacing details, C-29 >320ms motion, C-45/48 QA gates,
   C-50 identity validation.
7. **P3**: C-16/31/41 validation studies, C-36/40/41/43/45/49 KEEP items
   documented.
8. **Release**: visual snapshot + regression (`flutter test`, device QA) per
   batch; pixel QA per §AK.

# I. Files that must change (when approved)

**Token/theme layer**
- `lib/core/theme/app_colors.dart` — C-01..05, C-46, C-49 (palette + names).
- `lib/core/theme/app_tokens.dart` — C-17/18/19/21/22/33/34 (spacing, radius,
  blur, remove dynamic), C-13/14 (type scale), C-25 (elevation), C-26/27 (border/
  shadow).
- `lib/core/theme/app_motion.dart` — C-28/29/30/31 (family + exit).
- `lib/core/theme/app_density.dart` — C-37/38 (rename, per-mode table, 48dp).
- `lib/core/theme/app_responsive.dart` — C-18/20 (16px padding, 24 gutter).
- `lib/core/theme/app_theme.dart` — C-07/08/11/12/14/15/23 (statics → tokens,
  Roboto→Inter, scale, radii).
- `lib/core/theme/module_colors.dart` — C-06 (per F decision).
- `lib/main.dart` — C-39 (text scale clamp), C-10 (overlay hex → tokens).
- `lib/shared/design_system/**` — C-32/35 (tier primitive), C-44 (dedupe),
  C-23/29 (radii, motion), C-47 lint scoping.
- `pubspec.yaml` — C-12 (bundle Inter assets), C-47 (custom_lint if adopted).

**Feature code (literal sweeps)** — all pages listed in C-21/24/30/09/10
(worst: `login_page`, `splash_page`, `first_run_wizard_page`, `finance_page`,
`revenue_report_page`, `digital_id_card`, `face_camera_view`,
`crm_kanban_page`, `dashboard_widgets`, `user_management_page`).

**Docs**
- `docs/LIQUID_GLASS_TOKENS.md` — replace/supersede with v4.0 token sheet + name
  registry (C-46); deprecate v3.1 sections (D).
- `docs/DECISIONS.md` — new entries: v4.0 adoption, D8/D12 supersession,
  C-06/C-42/F decisions.
- `docs/DESIGN_SYSTEM_RECONCILIATION_REPORT.md` — this file (living decision gate).
- `.github/workflows/ci.yml` — C-47/48 gates.

# J. Files that must NOT change yet

- **Identity/face pipeline & UI** (`features/face_recognition/**`,
  `features/identity/**` camera/scan/enroll pages) — frozen until C-50 trust
  validation and camera-contrast testing (camera overlays are contrast-critical;
  C-10 camera bg is deliberately dark).
- **Business logic**: `core/network/sync*`, `core/auth/*`,
  `features/{payments,attendance}/domain|infrastructure/**`,
  biometrics (liveness, calibration) — design migration must not touch data
  semantics.
- **Database/migrations** (`core/database`, `*_migration.dart`), `third_party/`
  media_kit patch — unrelated to design.
- **Token/theme files during Gate 0** — nothing in `lib/core/theme/**` changes
  until this report + decisions are approved.
- **`docs/{SECURITY,DATABASE,SYNC,FACE_RECOGNITION,ARCHITECTURE}.md`** — out of
  scope for design reconciliation.
- **Anything behind `REQUIRES VALIDATION`** (E list) — especially glass tier
  values (C-33) until the device matrix and **VISUAL SYSTEM v1.0** are available.
