import type { ReactNode } from 'react';

function SkeletonBox({
  className = '',
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-2xl)] ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      {children}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 pb-12 pt-2 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      {/* Header Skeleton */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <div className="h-4 w-32 rounded-full bg-[var(--bg-surface)]" />
          <div className="h-8 w-64 rounded-xl bg-[var(--bg-surface)]" />
          <div className="h-4 w-48 rounded-full bg-[var(--bg-surface)]" />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-full rounded-xl bg-[var(--bg-surface)] sm:w-24" />
          ))}
        </div>
      </div>

      {/* 4 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox key={i} className="h-[148px] p-5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-[var(--bg-surface)]" />
              <div className="h-5 w-16 rounded-full bg-[var(--bg-surface)]" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-7 w-28 rounded-lg bg-[var(--bg-surface)]" />
              <div className="h-3 w-20 rounded bg-[var(--bg-surface)]" />
            </div>
          </SkeletonBox>
        ))}
      </div>

      {/* Analytics Section Skeleton */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr_1fr]">
        <SkeletonBox className="h-[360px] p-6">
          <div className="h-5 w-36 rounded bg-[var(--bg-surface)]" />
          <div className="mt-8 h-[260px] w-full rounded-xl bg-[var(--bg-surface)]" />
        </SkeletonBox>

        <SkeletonBox className="h-[360px] p-6">
          <div className="h-5 w-36 rounded bg-[var(--bg-surface)]" />
          <div className="mt-8 flex h-[240px] items-center justify-center">
            <div className="h-40 w-40 rounded-full border-8 border-[var(--bg-surface)]" />
          </div>
        </SkeletonBox>
      </div>

      {/* Feeds Section Skeleton */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SkeletonBox className="h-[320px] p-6">
          <div className="h-5 w-36 rounded bg-[var(--bg-surface)]" />
          <div className="mt-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 w-full rounded-xl bg-[var(--bg-surface)]" />
            ))}
          </div>
        </SkeletonBox>

        <SkeletonBox className="h-[320px] p-6">
          <div className="h-5 w-36 rounded bg-[var(--bg-surface)]" />
          <div className="mt-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 w-full rounded-xl bg-[var(--bg-surface)]" />
            ))}
          </div>
        </SkeletonBox>
      </div>

      {/* Financial Summary Skeleton */}
      <SkeletonBox className="h-[80px]" />
    </div>
  );
}
