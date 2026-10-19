# M-EDU FRONTEND V2 — DESIGN SYSTEM SPECIFICATION

Single Source of Truth: `apps/web/src/styles/design-tokens.css` & `globals.css`

## 1. Visual Philosophy: Apple-Inspired Clarity & Precision
- **Substrate**: Restrained Liquid Glass materials (sheen + specular top edge + chromatic borders + ambient orbs).
- **Surfaces**: `bg-white/55 dark:bg-white/[0.035]`, `backdrop-blur-2xl`, `ring-1 ring-inset ring-white/60 dark:ring-white/[0.08]`.
- **Palette**: Restrained brand purple/cyan accents (`--primary: #6366F1`, `brand-500: #7EC2F3`), deep neutral substrates (`#0F172A`, `#090D16`).
- **Typography**: Apple SF Pro (`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text"`) with tabular figures (`tabular-nums`) on all financial & statistical values.
- **Physics**: ODE-derived Spring-Damper animations (`stiffness: 340, damping: 30, mass: 0.9`) with strict `prefers-reduced-motion` suppression.

## 2. Core Tokens
### Elevation & Glass
- `glass-card`: `background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.6);`
- `glass-card-dark`: `background: rgba(255, 255, 255, 0.035); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.08);`
- `specular-top`: `h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25`

### Color Tones (Semantic System)
- **Primary / Vivid**: `#6366F1` / `#5474FC`
- **Success / Emerald**: `#34C759` / `#10B981`
- **Warning / Amber**: `#FF9500` / `#F59E0B`
- **Danger / Red**: `#FF3B30` / `#EF4444`
- **Cyan / Ambient**: `#06B6D4` / `#94EAEF`

### Radii Hierarchy
- Inner elements / buttons: `12px` (`rounded-xl`)
- Cards / Containers: `20px - 28px` (`rounded-[1.75rem]`)
- Modals / Panels: `32px` (`rounded-[2rem]`)
