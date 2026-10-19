/**
 * M-EDU AuditDiffViewer — Apple / Linear-grade Object State Inspector
 *
 * Visualizes before/after field diffs with field-level highlighting,
 * side-by-side comparison, and clean JSON formatting.
 */

import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AuditDiffViewerProps {
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  className?: string;
}

function formatValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export const AuditDiffViewer = memo(function AuditDiffViewer({
  previousValue,
  newValue,
  changedFields,
  className = '',
}: AuditDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');

  const diffEntries = useMemo(() => {
    const prev = previousValue || {};
    const curr = newValue || {};

    let keys = changedFields && changedFields.length > 0 ? changedFields : null;
    if (!keys) {
      const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
      keys = Array.from(allKeys).filter((k) => {
        return JSON.stringify(prev[k]) !== JSON.stringify(curr[k]);
      });
    }

    return keys.map((key) => {
      const oldVal = prev[key];
      const newVal = curr[key];
      const isAdded = oldVal === undefined && newVal !== undefined;
      const isRemoved = oldVal !== undefined && newVal === undefined;
      const isModified = !isAdded && !isRemoved;

      return {
        key,
        oldVal,
        newVal,
        isAdded,
        isRemoved,
        isModified,
      };
    });
  }, [previousValue, newValue, changedFields]);

  if (!previousValue && !newValue) {
    return (
      <div className={`text-xs text-muted-foreground italic py-3 text-center ${className}`}>
        Tafsilotli diff ma'lumotlari mavjud emas
      </div>
    );
  }

  // Pure Create event
  if (!previousValue && newValue) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          Yangi obyekt yaratilgan
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 font-mono text-xs text-emerald-900 dark:text-emerald-200 overflow-x-auto max-h-60">
          <pre>{JSON.stringify(newValue, null, 2)}</pre>
        </div>
      </div>
    );
  }

  // Pure Delete event
  if (previousValue && !newValue) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
          <span className="flex h-2 w-2 rounded-full bg-rose-500" />
          Obyekt tizimdan o'chirilgan
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 font-mono text-xs text-rose-900 dark:text-rose-200 overflow-x-auto max-h-60">
          <pre>{JSON.stringify(previousValue, null, 2)}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* View Switcher */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          O'zgarishlar tarixi ({diffEntries.length} maydon)
        </span>
        <div className="flex items-center gap-1 rounded-lg bg-black/5 dark:bg-white/5 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setViewMode('visual')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === 'visual'
                ? 'bg-white dark:bg-zinc-800 shadow-sm text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Visual Diff
          </button>
          <button
            type="button"
            onClick={() => setViewMode('raw')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              viewMode === 'raw'
                ? 'bg-white dark:bg-zinc-800 shadow-sm text-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'visual' ? (
          <motion.div
            key="visual"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2 max-h-96 overflow-y-auto pr-1"
          >
            {diffEntries.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-2 text-center">
                Maydonlar qiymatida sezilarli farq aniqlanmadi
              </div>
            ) : (
              diffEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] p-3 text-xs shadow-sm backdrop-blur-md"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono font-semibold text-primary">{entry.key}</span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        entry.isAdded
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : entry.isRemoved
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {entry.isAdded ? '+ Qo\'shildi' : entry.isRemoved ? '- O\'chirildi' : '~ Tahrirlandi'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {/* Old Value */}
                    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 font-mono text-[11px] text-rose-800 dark:text-rose-300 overflow-x-auto">
                      <div className="text-[9px] uppercase tracking-wider font-sans font-bold text-rose-600 dark:text-rose-400 mb-0.5">
                        Oldingi qiymat
                      </div>
                      <pre className="whitespace-pre-wrap break-all">{formatValue(entry.oldVal)}</pre>
                    </div>

                    {/* New Value */}
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 font-mono text-[11px] text-emerald-800 dark:text-emerald-300 overflow-x-auto">
                      <div className="text-[9px] uppercase tracking-wider font-sans font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                        Yangi qiymat
                      </div>
                      <pre className="whitespace-pre-wrap break-all">{formatValue(entry.newVal)}</pre>
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="raw"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono max-h-80 overflow-y-auto"
          >
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-rose-900 dark:text-rose-200 overflow-x-auto">
              <div className="text-[10px] uppercase font-sans font-bold text-rose-600 dark:text-rose-400 mb-1">
                Oldingi holat (Snapshot)
              </div>
              <pre>{JSON.stringify(previousValue, null, 2)}</pre>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-emerald-900 dark:text-emerald-200 overflow-x-auto">
              <div className="text-[10px] uppercase font-sans font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                Yangi holat (Snapshot)
              </div>
              <pre>{JSON.stringify(newValue, null, 2)}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
