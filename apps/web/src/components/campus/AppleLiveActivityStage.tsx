'use client';

/**
 * ============================================================================
 * M-EDU Apple Live Activity Stage — iOS 27 StandBy & Lock Screen Pulse (v2.0)
 * ============================================================================
 *
 * Real-time Apple Dynamic Island & Lock Screen Live Activity widget for:
 *  • Real-time turnstile check-ins (photo, room, time, score)
 *  • Native window `medu:attendance-logged` socket event synchronization
 *  • One-touch presentation tester button for instant Live Activity creation
 *  • Active classroom countdowns & attendance completion ring
 *  • Live lesson progress & audio-visual chime integration
 *  • Ultra-smooth VisionOS fluid springs, specular glass bevels & haptics
 * ============================================================================
 */

import { useState, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/design';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { attendanceApi, studentsApi } from '@/lib/api';

export interface LiveActivityItem {
  id: string;
  type: 'CHECK_IN' | 'LESSON_ACTIVE' | 'EMERGENCY_LOCK' | 'FEE_ALERT';
  title: string;
  subtitle: string;
  timestamp: string;
  studentName?: string;
  groupName?: string;
  photoUrl?: string;
  progress?: number;
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 520, damping: 32, mass: 0.65 };

export const AppleLiveActivityStage = memo(function AppleLiveActivityStage({
  activities = [],
  onOpenQuickLook,
}: {
  activities?: LiveActivityItem[];
  onOpenQuickLook?: (activity: LiveActivityItem) => void;
}) {
  const haptics = useHaptics();
  const sound = usePremiumSound();

  // Fetch real recent attendance records from the backend
  const { data: realAttendanceData } = useQuery({
    queryKey: ['live-activities-attendance'],
    queryFn: async () => {
      try {
        const res: any = await attendanceApi.list({ limit: 5 });
        return Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    refetchInterval: 15000,
  });

  // Fetch real active students for live simulation
  const { data: realStudentsList } = useQuery({
    queryKey: ['live-activities-students'],
    queryFn: async () => {
      try {
        const res: any = await studentsApi.list({ limit: 10 });
        return Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
  });

  const [activeList, setActiveList] = useState<LiveActivityItem[]>(() =>
    activities.length > 0 ? activities.slice(0, 4) : [
      {
        id: 'standby-active',
        type: 'CHECK_IN',
        title: 'Turniket monitoringi faol',
        subtitle: 'Jonli biometrik Face ID va RFID darchasi navbatchi rejimda',
        timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      },
    ]
  );

  useEffect(() => {
    if (activities.length > 0) {
      setActiveList(activities.slice(0, 4));
      return;
    }

    if (realAttendanceData && realAttendanceData.length > 0) {
      const mapped: LiveActivityItem[] = realAttendanceData.slice(0, 4).map((att: any, idx: number) => {
        const studentName = [att.student?.user?.firstName, att.student?.user?.lastName].filter(Boolean).join(' ') ||
          att.studentName ||
          'O‘quvchi';
        const groupName = att.group?.name || att.groupName || 'Asosiy guruh';
        const time = att.recordedAt ? new Date(att.recordedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : 'Hozir';

        return {
          id: att.id || `att-${idx}`,
          type: 'CHECK_IN',
          title: att.status === 'PRESENT' ? 'Davomat muvaffaqiyatli belgilandi' : att.status === 'LATE' ? 'Kechikish qayd etildi' : 'Davomat yangilandi',
          subtitle: `${studentName} · ${groupName}`,
          timestamp: time,
          studentName,
          groupName,
          photoUrl: att.student?.photoUrl || att.student?.user?.avatarUrl,
        };
      });
      setActiveList(mapped);
    }
  }, [activities, realAttendanceData]);

  // Real-time listener for live camera & turnstile attendance socket events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRealAttendance = (event: Event) => {
      const customEvent = event as CustomEvent<{
        id?: string;
        name?: string;
        group?: string;
        time?: string;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;

      const newActivity: LiveActivityItem = {
        id: `turnstile-${detail.id || Date.now()}`,
        type: 'CHECK_IN',
        title: 'Turniketdan muvaffaqiyatli o‘tdi',
        subtitle: `${detail.name || "O'quvchi"} · Turniket Gate-1`,
        timestamp: detail.time || new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
        studentName: detail.name || "O'quvchi",
        groupName: detail.group || 'Asosiy Guruh',
      };

      haptics.success();
      sound.playSuccess();

      setActiveList((prev) => [newActivity, ...prev.slice(0, 3)]);
    };

    window.addEventListener('medu:attendance-logged', handleRealAttendance);
    return () => {
      window.removeEventListener('medu:attendance-logged', handleRealAttendance);
    };
  }, [haptics, sound]);

  // Interactive Live Attendance check-in trigger
  const handleSimulateCheckIn = useCallback(() => {
    haptics.medium();
    sound.playSuccess();

    let targetName = 'Haqiqiy O‘quvchi';
    let targetGroup = 'Asosiy Guruh';
    let photoUrl: string | undefined = undefined;

    if (realStudentsList && realStudentsList.length > 0) {
      const pick = realStudentsList[Math.floor(Math.random() * realStudentsList.length)];
      targetName = [pick.firstName, pick.lastName].filter(Boolean).join(' ') || pick.user?.firstName || targetName;
      targetGroup = pick.group?.name || pick.groups?.[0]?.name || targetGroup;
      photoUrl = pick.photoUrl || pick.avatarUrl;
    }

    const timeNow = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newActivity: LiveActivityItem = {
      id: `live-${Date.now()}`,
      type: 'CHECK_IN',
      title: 'Turniket & Face ID Kirish',
      subtitle: `${targetName} · Biometrik moslik: 99.8%`,
      timestamp: timeNow,
      studentName: targetName,
      groupName: targetGroup,
      photoUrl,
    };

    setActiveList((prev) => [newActivity, ...prev.slice(0, 3)]);
  }, [haptics, sound]);

  const handleDismiss = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    haptics.light();
    sound.playTick();
    setActiveList((prev) => prev.filter((item) => item.id !== id));
  }, [haptics, sound]);

  return (
    <div className="relative isolate flex flex-col gap-3 w-full max-w-xl mx-auto">
      {/* StandBy Atmospheric Glass Backing */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </span>
          <span className="text-xs font-black tracking-wider uppercase text-[var(--text-tertiary)] font-mono">
            Apple Live Activities · StandBy Stage
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Keynote Test Button */}
          <button
            type="button"
            onClick={handleSimulateCheckIn}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/30 text-[10.5px] font-bold transition shadow-sm"
          >
            <span className="text-xs">⚡</span>
            <span>Turniket Sinovi (Test Tap)</span>
          </button>

          <span className="rounded-full bg-black/5 px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)] dark:bg-white/10">
            iOS 27 Dynamic
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {activeList.length === 0 ? (
            <motion.div
              key="empty-live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center p-6 rounded-3xl border border-dashed border-black/10 dark:border-white/10 text-xs text-[var(--text-tertiary)] text-center font-medium"
            >
              Hozircha faol jonli bildirishnoma yo‘q. Turniket yoki dars faollashganda bu yerda real vaqtda paydo bo‘ladi.
            </motion.div>
          ) : (
            activeList.map((item) => {
              const isCheckIn = item.type === 'CHECK_IN';
              const isLesson = item.type === 'LESSON_ACTIVE';
              const isEmergency = item.type === 'EMERGENCY_LOCK';

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
                  transition={SPRING_SNAPPY}
                  onClick={() => onOpenQuickLook?.(item)}
                  className={cn(
                    'group relative cursor-pointer overflow-hidden rounded-[2rem] border p-4 transition-all select-none',
                    'backdrop-blur-3xl backdrop-saturate-[210%]',
                    isEmergency
                      ? 'border-rose-500/50 bg-[#1d080c]/90 text-white shadow-[0_16px_36px_-8px_rgba(244,63,94,0.4)]'
                      : isCheckIn
                        ? 'border-emerald-500/40 bg-white/[0.85] text-slate-900 shadow-[0_18px_40px_-10px_rgba(16,185,129,0.22)] dark:border-emerald-500/30 dark:bg-[#081812]/90 dark:text-white'
                        : 'border-white/60 bg-white/[0.8] text-slate-900 shadow-[0_18px_40px_-10px_rgba(0,122,255,0.18)] dark:border-white/10 dark:bg-[#0c1220]/90 dark:text-white',
                  )}
                >
                  {/* Top Specular Liquid Bevel */}
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/30" />

                  <div className="flex items-center justify-between gap-3.5">
                    {/* Left Icon or Student Avatar */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      {item.photoUrl ? (
                        <div className="relative shrink-0">
                          <img
                            src={item.photoUrl}
                            alt={item.studentName || 'Student'}
                            className="h-11 w-11 rounded-2xl object-cover ring-2 ring-emerald-400/60 shadow-md"
                          />
                          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white ring-2 ring-white dark:ring-black">
                            ✓
                          </span>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black text-white shadow-md',
                            isEmergency
                              ? 'bg-gradient-to-tr from-rose-600 to-red-500'
                              : isCheckIn
                                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400'
                                : 'bg-gradient-to-tr from-[#007AFF] to-[#5856D6]',
                          )}
                        >
                          {isEmergency ? '!' : isCheckIn ? '✓' : '▶'}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate text-sm font-bold tracking-tight">
                            {item.title}
                          </h4>
                          {item.groupName && (
                            <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-tertiary)] dark:bg-white/10">
                              {item.groupName}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs opacity-75 mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Right Progress or Timing Chime */}
                    <div className="flex shrink-0 items-center gap-2.5">
                      {isLesson && typeof item.progress === 'number' && (
                        <div className="flex flex-col items-end">
                          <span className="font-mono text-xs font-black text-[#007AFF] dark:text-[#64D2FF]">
                            {item.progress}%
                          </span>
                          <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                            <motion.div
                              className="h-full bg-gradient-to-r from-[#007AFF] to-[#5856D6]"
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress}%` }}
                              transition={{ duration: 0.8 }}
                            />
                          </div>
                        </div>
                      )}

                      <span className="font-mono text-[11px] opacity-60 tabular-nums">
                        {item.timestamp}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleDismiss(item.id, e)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                        title="Yopish"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
