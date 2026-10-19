/**
 * ============================================================================
 * DashboardSkeleton v2.0 — Premium layout-matched placeholder
 * ============================================================================
 * Fixes:
 *  - Card radii & layout now match DashboardHeader v3.0 / KPICard v2.0 /
 *    ActivityRings v2.0 (no post-load "jump")
 *  - Responsive heights (chart rows drop fixed px on mobile)
 *  - Action bar mirrors the 3-control rhythm (clock · primary · refresh)
 *  - Staggered entrance (motion-safe) for a "revealing" feel
 *  - Full a11y: role=status, aria-live, aria-busy, sr-only announcement
 *  - respects prefers-reduced-motion throughout
 * Design:
 *  - Aurora hint in header card (matches v3.0 gradient wash)
 *  - Specular hairline on every card (matches component surface)
 *  - Refined shimmer rhythm (varied widths per slot)
 * ============================================================================
 */

import { type ReactNode } from 'react';
import { cn, Shimmer } from '@/lib/design';

interface SkeletonCardProps {
  children: ReactNode;
  className?: string;
  /** Entrance animation delay in ms — for the staggered reveal. */
  delay?: number;
  /** Promotes radius to 3xl — used for the top header tile. */
  elevated?: boolean;
}

function SkeletonCard({ children, className, delay = 0, elevated }: SkeletonCardProps) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        'relative overflow-hidden border bg-card/85 backdrop-blur-xl',
        elevated ? 'rounded-3xl' : 'rounded-2xl',
        'border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-8px_rgba(0,0,0,0.08)]',
        'dark:border-white/[0.08] dark:shadow-none',
        // Apple-style specular hairline (matches real component surfaces)
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px',
        'before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent',
        'dark:before:via-white/[0.12]',
        'motion-safe:animate-[skeletonIn_480ms_cubic-bezier(0.22,1,0.36,1)_both]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Dashboard ma'lumotlari yuklanmoqda"
    >
      <span className="sr-only">
        Dashboard ma'lumotlari yuklanmoqda, bir oz kuting…
      </span>

      {/* ══ Header — mirrors DashboardHeader v3.0 ═══════════════════ */}
      <SkeletonCard elevated delay={0} className="p-5 sm:p-6 lg:p-7">
        {/* Aurora hint (same position/opacity as real header) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(10,132,255,0.10),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(10,132,255,0.14),transparent_70%)]" />
          <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(94,92,230,0.08),transparent_70%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(94,92,230,0.12),transparent_70%)]" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          {/* Left: badge · greeting · subtitle */}
          <div className="min-w-0 flex-1 space-y-3.5 sm:space-y-4">
            {/* Identity badge */}
            <Shimmer className="h-7 w-48" rounded="9999px" />

            {/* Greeting — matches text-[26px] → sm:[30px] → lg:[32px] */}
            <Shimmer
              className="h-8 w-72 sm:h-9 sm:w-80 lg:h-10 lg:w-[26rem]"
              rounded="10px"
            />

            {/* Subtitle — two lines on desktop, one on mobile */}
            <div className="space-y-2">
              <Shimmer className="h-3.5 w-full max-w-lg" rounded="9999px" />
              <Shimmer className="hidden h-3.5 w-2/3 max-w-md sm:block" rounded="9999px" />
            </div>
          </div>

          {/* Right: 3-control action bar (clock · primary · refresh) */}
          <div className="flex w-full items-center gap-2 sm:gap-2.5 lg:w-auto lg:shrink-0">
            {/* LiveClock pill */}
            <Shimmer className="h-11 w-24 shrink-0" rounded="16px" />
            {/* Primary briefing button (grows on mobile) */}
            <Shimmer className="h-11 flex-1 lg:w-40 lg:flex-initial" rounded="16px" />
            {/* Refresh button */}
            <Shimmer className="h-11 w-11 shrink-0" rounded="16px" />
          </div>
        </div>
      </SkeletonCard>

      {/* ══ KPI grid — mirrors KPICard v2.0 ═══════════════════════ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard
            key={i}
            delay={80 + i * 55}
            className="flex h-full flex-col justify-between gap-3 p-3.5 sm:p-4 lg:p-5"
          >
            {/* Title + icon tile */}
            <div className="flex items-start justify-between gap-3">
              <Shimmer className="h-3 w-20" rounded="4px" />
              <Shimmer className="h-9 w-9 sm:h-10 sm:w-10" rounded="12px" />
            </div>

            {/* Value */}
            <Shimmer className="h-7 w-28 sm:h-8 lg:h-9" rounded="6px" />

            {/* Description + trend chip */}
            <div className="flex items-center justify-between gap-2">
              <Shimmer className="h-3 w-24 sm:w-32" rounded="9999px" />
              <Shimmer className="h-5 w-14" rounded="9999px" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* ══ Chart rows (8/4 split × 2) ═══════════════════════════ */}
      {[0, 1].map((row) => (
        <div key={row} className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          {/* Wide chart */}
          <SkeletonCard
            delay={320 + row * 80}
            className="p-5 lg:col-span-8 lg:h-[320px]"
          >
            <div className="flex items-center justify-between">
              <Shimmer className="h-5 w-32 sm:w-40" rounded="6px" />
              <Shimmer className="h-8 w-24" rounded="10px" />
            </div>
            <Shimmer
              className="mt-5 h-[200px] w-full lg:h-[220px]"
              rounded="12px"
            />
          </SkeletonCard>

          {/* Side list */}
          <SkeletonCard
            delay={360 + row * 80}
            className="p-5 lg:col-span-4 lg:h-[320px]"
          >
            <Shimmer className="h-5 w-28 sm:w-36" rounded="6px" />
            <div className="mt-4 space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Shimmer key={i} className="h-12 w-full lg:h-14" rounded="12px" />
              ))}
            </div>
          </SkeletonCard>
        </div>
      ))}

      {/* ══ Bottom 3 cards ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} delay={560 + i * 60} className="p-5">
            <div className="flex items-center justify-between">
              <Shimmer className="h-5 w-28 sm:w-32" rounded="6px" />
              <Shimmer className="h-6 w-14" rounded="9999px" />
            </div>
            <Shimmer className="mt-4 h-[180px] w-full" rounded="12px" />
            <Shimmer className="mt-3 h-9 w-full" rounded="10px" />
          </SkeletonCard>
        ))}
      </div>

      {/* Scoped keyframe — Apple ease entrance */}
      <style>{`
        @keyframes skeletonIn {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}

export default DashboardSkeleton;