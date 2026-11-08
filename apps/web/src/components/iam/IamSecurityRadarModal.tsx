import { useState, useCallback, useEffect } from 'react';
import {
  GlassModal,
  GlassButton,
  GlassBadge,
  useToasts,
} from '@/components/ui';
import { iamApi } from '@/lib/api';
import { usePremiumSound } from '@/hooks/usePremiumSound';

interface IamSecurityRadarModalProps {
  open: boolean;
  onClose: () => void;
}

type TabType = 'SESSIONS' | 'EVENTS' | 'KILL_SWITCH';

export function IamSecurityRadarModal({ open, onClose }: IamSecurityRadarModalProps) {
  const { push } = useToasts();
  const sound = usePremiumSound();

  const [activeTab, setActiveTab] = useState<TabType>('SESSIONS');
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  // Tenant kill-switch state
  const [orgIdInput, setOrgIdInput] = useState('');
  const [orgActionLoading, setOrgActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, sess, evs] = await Promise.all([
        iamApi.getSecurityOverview().catch(() => null),
        iamApi.getActiveSessions(50).catch(() => []),
        iamApi.getSecurityEvents(50).catch(() => []),
      ]);
      setOverview(ov);
      setSessions(sess);
      setEvents(evs);
    } catch {
      push('error', 'Xavfsizlik ma\'lumotlarini yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  const handleTerminateSession = useCallback(
    async (sessionId: string) => {
      setTerminatingId(sessionId);
      try {
        await iamApi.terminateSession(sessionId);
        sound.playPop?.();
        push('success', 'Sessiya muvaffaqiyatli uzildi');
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (overview) {
          setOverview((o: any) => ({
            ...o,
            activeSessionsCount: Math.max(0, (o.activeSessionsCount || 1) - 1),
          }));
        }
      } catch (err: any) {
        sound.playError?.();
        push('error', err?.message || 'Sessiyani to\'xtatishda xatolik');
      } finally {
        setTerminatingId(null);
      }
    },
    [overview, push, sound],
  );

  const handleSuspendOrg = useCallback(async () => {
    if (!orgIdInput.trim()) return;
    setOrgActionLoading(true);
    try {
      await iamApi.suspendOrganization(orgIdInput.trim());
      sound.playSuccess?.();
      push('success', 'Tashkilot faoliyati to\'xtatildi va barcha faol sessiyalari uzildi!');
      setOrgIdInput('');
      fetchData();
    } catch (err: any) {
      sound.playError?.();
      push('error', err?.message || 'Tashkilotni to\'xtatishda xatolik yuz berdi');
    } finally {
      setOrgActionLoading(false);
    }
  }, [fetchData, orgIdInput, push, sound]);

  const handleActivateOrg = useCallback(async () => {
    if (!orgIdInput.trim()) return;
    setOrgActionLoading(true);
    try {
      await iamApi.activateOrganization(orgIdInput.trim());
      sound.playSuccess?.();
      push('success', 'Tashkilot qayta faollashtirildi!');
      setOrgIdInput('');
      fetchData();
    } catch (err: any) {
      sound.playError?.();
      push('error', err?.message || 'Tashkilotni faollashtirishda xatolik yuz berdi');
    } finally {
      setOrgActionLoading(false);
    }
  }, [fetchData, orgIdInput, push, sound]);

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Platform Owner IAM • Xavfsizlik Radari"
      size="xl"
    >
      <div className="space-y-4">
        {/* Top KPI Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Faol Sessiyalar
              </span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {overview?.activeSessionsCount ?? '—'}
            </p>
          </div>

          <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-white/60 dark:bg-surface-900/60 p-3 backdrop-blur-xl">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Jami Hisoblar
            </span>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
              {overview?.totalUsersCount ?? '—'}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-3 backdrop-blur-xl">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
              Parol Kutilmoqda
            </span>
            <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
              {overview?.mustChangePasswordCount ?? '—'}
            </p>
          </div>

          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.08] p-3 backdrop-blur-xl">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
              To'xtatilgan
            </span>
            <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">
              {overview?.suspendedUsersCount ?? '—'}
            </p>
          </div>
        </div>

        {/* Tab Selector & Refresh */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] pb-2">
          <div className="flex gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('SESSIONS')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'SESSIONS'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-surface-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Jonli Sessiyalar ({sessions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('EVENTS')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'EVENTS'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-surface-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Hodisalar Jurnali ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('KILL_SWITCH')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'KILL_SWITCH'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-rose-600 hover:text-rose-800 dark:text-rose-400'
              }`}
            >
              ⚡ Tashkilot Kill-Switch
            </button>
          </div>

          <GlassButton
            type="button"
            variant="secondary"
            onClick={fetchData}
            disabled={loading}
            className="text-xs"
            icon={
              <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            }
          >
            Yangilash
          </GlassButton>
        </div>

        {/* Tab Content */}
        <div className="min-h-[320px] max-h-[50vh] overflow-y-auto">
          {/* TAB 1: ACTIVE SESSIONS */}
          {activeTab === 'SESSIONS' && (
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Ayni paytda hech qanday faol sessiya mavjud emas
                </div>
              ) : (
                sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/50 dark:bg-surface-900/50 p-3 backdrop-blur-xl transition-all hover:border-black/[0.12] dark:hover:border-white/[0.16]"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {sess.fullName}
                        </span>
                        {sess.username && (
                          <span className="font-mono text-xs text-brand-600 dark:text-brand-400">
                            @{sess.username}
                          </span>
                        )}
                        <GlassBadge variant="neutral" size="sm">
                          {sess.role}
                        </GlassBadge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {sess.organizationName} • IP: <span className="font-mono">{sess.ipAddress || 'Lokal'}</span> • {sess.userAgent?.slice(0, 45) || 'Veb-brauzer'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right text-[11px] text-slate-400">
                        <span>Faollik: </span>
                        <strong className="text-slate-700 dark:text-slate-300 font-mono">
                          {sess.lastActiveAt ? new Date(sess.lastActiveAt).toLocaleTimeString('uz-UZ') : 'Hozirgina'}
                        </strong>
                      </div>

                      <GlassButton
                        type="button"
                        variant="secondary"
                        disabled={terminatingId === sess.id}
                        onClick={() => handleTerminateSession(sess.id)}
                        className="text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                        icon={
                          terminatingId === sess.id ? (
                            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          )
                        }
                      >
                        Sessiyani uzish
                      </GlassButton>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: AUDIT EVENTS */}
          {activeTab === 'EVENTS' && (
            <div className="space-y-2">
              {events.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Hech qanday audit hodisasi yozilmagan
                </div>
              ) : (
                events.map((ev, i) => (
                  <div
                    key={ev.id || i}
                    className="flex items-center justify-between rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/40 dark:bg-surface-900/40 p-2.5 text-xs backdrop-blur-xl"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-2 w-2 rounded-full ${ev.success ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {ev.eventType}
                        </span>
                        {ev.reason && (
                          <span className="text-slate-400 ml-1.5 font-mono">({ev.reason})</span>
                        )}
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          IP: {ev.ipAddress || '—'} {ev.userId ? `• Foydalanuvchi: ${ev.userId.slice(0, 8)}...` : ''}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400">
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString('uz-UZ') : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: EMERGENCY TENANT KILL-SWITCH */}
          {activeTab === 'KILL_SWITCH' && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.05] p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xl font-bold">
                  ⚡
                </span>
                <div>
                  <h4 className="font-bold text-base text-rose-900 dark:text-rose-300">
                    Favqulodda Tashkilotni To'xtatish (Kill-Switch)
                  </h4>
                  <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-1 leading-relaxed">
                    Tashkilot faoliyati to'xtatilganda, unga tegishli barcha foydalanuvchilarning faol seanslari
                    darhol bekor qilinadi va yangi kirishlar bloklanadi. Qayta faollashtirilganda barcha ma'lumotlar o'z joyida saqlanib qoladi.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Tashkilot ID (Organization UUID):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={orgIdInput}
                    onChange={(e) => setOrgIdInput(e.target.value)}
                    placeholder="Masalan: 3f8b1a20-..."
                    className="flex-1 rounded-xl border border-black/[0.1] bg-white/80 px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none dark:border-white/[0.12] dark:bg-surface-800/80 dark:text-slate-100"
                  />
                  <GlassButton
                    type="button"
                    variant="primary"
                    disabled={orgActionLoading || !orgIdInput.trim()}
                    onClick={handleSuspendOrg}
                    className="text-xs bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    To'xtatish (Freeze)
                  </GlassButton>
                  <GlassButton
                    type="button"
                    variant="secondary"
                    disabled={orgActionLoading || !orgIdInput.trim()}
                    onClick={handleActivateOrg}
                    className="text-xs"
                  >
                    Faollashtirish
                  </GlassButton>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.08] pt-3">
          <span className="text-xs text-slate-400">
            M-EDU Centralized IAM • Platform Owner Security Radar
          </span>
          <GlassButton type="button" variant="secondary" onClick={onClose}>
            Yopish
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}

export default IamSecurityRadarModal;
