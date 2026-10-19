/**
 * ============================================================================
 * M-EDU Apple Liquid Glass Offline & Mesh Sync Indicator
 * ============================================================================
 *
 * Floating status island with interactive queue inspector modal:
 *  - Real-time online/offline and pending sync queue badges
 *  - Interactive inspection drawer with retry, delete, and manual sync controls
 *  - Haptic sound feedback and specular Apple Liquid Glass styling
 * ============================================================================
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  RotateCw,
  X,
  Layers,
} from 'lucide-react';
import { useOfflineSync } from '@/lib/offline-sync';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { cn } from '@/lib/design';
import { GlassSurface } from '@/components/ui';

export function OfflineIndicator() {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    queue,
    syncNow,
    clearCompleted,
    retryAction,
    removeAction,
  } = useOfflineSync();

  const sound = usePremiumSound();
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [showSyncedSuccess, setShowSyncedSuccess] = useState(false);

  // Trigger brief success pill when sync finishes with 0 pending
  useEffect(() => {
    if (isOnline && !isSyncing && pendingCount === 0 && queue.some((a) => a.status === 'completed')) {
      setShowSyncedSuccess(true);
      sound.playSuccess();
      const timer = setTimeout(() => {
        setShowSyncedSuccess(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isSyncing, pendingCount, queue, sound]);

  const handleToggleInspector = useCallback(() => {
    sound.playPop();
    setIsInspectorOpen((prev) => !prev);
  }, [sound]);

  const handleManualSync = useCallback(async () => {
    sound.playTick();
    await syncNow();
  }, [sound, syncNow]);

  const shouldShowBanner = !isOnline || isSyncing || pendingCount > 0 || showSyncedSuccess;

  return (
    <>
      <AnimatePresence>
        {shouldShowBanner && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[9990] flex items-center justify-center pointer-events-auto"
          >
            <button
              type="button"
              onClick={handleToggleInspector}
              aria-label="Offline sync status"
              className={cn(
                'group relative flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-medium tracking-tight',
                'border backdrop-blur-2xl backdrop-saturate-150 select-none shadow-lg transition-all duration-200 cursor-pointer',
                'active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/50',
                !isOnline &&
                  'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300 shadow-rose-500/10 hover:bg-rose-500/20',
                isOnline &&
                  isSyncing &&
                  'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300 shadow-amber-500/10 hover:bg-amber-500/20',
                isOnline &&
                  !isSyncing &&
                  pendingCount > 0 &&
                  'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300 shadow-blue-500/10 hover:bg-blue-500/20',
                isOnline &&
                  !isSyncing &&
                  pendingCount === 0 &&
                  showSyncedSuccess &&
                  'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-emerald-500/10 hover:bg-emerald-500/20',
              )}
            >
              {/* Status dot / spinner */}
              {!isOnline && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              )}

              {isOnline && isSyncing && (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500 shrink-0" />
              )}

              {isOnline && !isSyncing && pendingCount > 0 && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
              )}

              {isOnline && !isSyncing && pendingCount === 0 && showSyncedSuccess && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}

              {/* Status text */}
              <span>
                {!isOnline && 'Offlayn rejim'}
                {isOnline && isSyncing && 'Sinxronlanmoqda...'}
                {isOnline && !isSyncing && pendingCount > 0 && `${pendingCount} ta amal navbatda`}
                {isOnline && !isSyncing && pendingCount === 0 && showSyncedSuccess && 'Server bilan sinxronlandi'}
              </span>

              {/* Pill badge for queue count */}
              {pendingCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-black/10 dark:bg-white/15">
                  {pendingCount}
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline Queue Inspector Modal */}
      <AnimatePresence>
        {isInspectorOpen && (
          <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleToggleInspector}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Modal Surface */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative w-full max-w-lg z-10"
            >
              <GlassSurface
                tone="frost"
                elevation="floating"
                className="overflow-hidden shadow-2xl p-6 rounded-[1.75rem]"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-xl flex items-center justify-center',
                        isOnline
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                      )}
                    >
                      {isOnline ? <Layers className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        Offlayn Sinxronizatsiya Navbati
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {isOnline ? 'Internet mavjud — avtomatik uzatish yoqilgan' : 'Internet o‘chirilgan — amallar mahalliy saqlanmoqda'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleInspector}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Queue Summary & Actions */}
                <div className="flex items-center justify-between py-3">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Jami amallar: <strong className="text-[var(--text-primary)]">{queue.length}</strong> ({pendingCount} kutilmoqda)
                  </span>

                  <div className="flex items-center gap-2">
                    {queue.some((a) => a.status === 'completed') && (
                      <button
                        type="button"
                        onClick={clearCompleted}
                        className="text-xs px-2.5 py-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        Yakunlanganlarni tozalash
                      </button>
                    )}

                    {isOnline && pendingCount > 0 && (
                      <button
                        type="button"
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-apple-blue text-white shadow-sm hover:bg-apple-blue/90 disabled:opacity-50 transition-all active:scale-95"
                      >
                        <RefreshCw className={cn('w-3 h-3', isSyncing && 'animate-spin')} />
                        {isSyncing ? 'Sinxronlanmoqda...' : 'Hozir sinxronlash'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Queue Items List */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 my-1">
                  {queue.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                      Hozirda hech qanday kutayotgan offlayn amal yo‘q.
                    </div>
                  ) : (
                    queue.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          'p-3 rounded-xl border flex items-center justify-between gap-3 text-xs',
                          'bg-white/50 dark:bg-white/[0.03] transition-colors',
                          item.status === 'completed' && 'border-emerald-500/20 text-[var(--text-secondary)]',
                          item.status === 'failed' && 'border-rose-500/30 text-rose-700 dark:text-rose-300',
                          item.status === 'pending' && 'border-black/[0.06] dark:border-white/[0.08]',
                          item.status === 'syncing' && 'border-amber-500/30 bg-amber-500/5',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[var(--text-primary)] truncate">
                              {item.label}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-black/5 dark:bg-white/10 text-[var(--text-secondary)]">
                              {item.method}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                            {item.endpoint} • {new Date(item.timestamp).toLocaleTimeString()}
                          </p>
                          {item.error && (
                            <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {item.error}
                            </p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => retryAction(item.id)}
                              title="Qayta urinish"
                              className="p-1.5 rounded-lg text-apple-blue hover:bg-apple-blue/10 transition-colors"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAction(item.id)}
                            title="O‘chirish"
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer status */}
                <div className="pt-3 mt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Idempotent xavfsiz kalitlar bilan himoyalangan</span>
                  <span>M-EDU Offline Mesh v2.0</span>
                </div>
              </GlassSurface>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
