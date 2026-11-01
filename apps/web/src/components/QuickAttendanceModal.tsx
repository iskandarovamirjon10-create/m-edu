import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, attendanceApi } from '@/lib/api';
import { useToast } from '@/components/ui/GlassToast';
import { toLocalISOString } from '@/lib/format';

type AttendanceStatus = 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT';

interface StudentRecord {
  studentId: string;
  name: string;
  phone?: string;
  status: AttendanceStatus;
}

export function QuickAttendanceModal() {
  const queryClient = useQueryClient();
  const { push } = useToast();

  const [open, setOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [records, setRecords] = useState<StudentRecord[]>([]);

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ['quick-attendance-groups'],
    queryFn: () => groupsApi.list({ limit: 100 }) as Promise<{ items?: any[] } | any[]>,
    enabled: open,
    staleTime: 60000,
  });

  const rawGroups = Array.isArray(groupsData) ? groupsData : (groupsData?.items || []);
  const groups = rawGroups.filter((g: any) => g.isActive !== false);

  // Auto-select first group if none selected
  useEffect(() => {
    if (open && groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [open, groups, selectedGroupId]);

  // Fetch selected group details to get enrolled students
  const { data: groupDetails, isFetching: loadingStudents } = useQuery({
    queryKey: ['quick-attendance-group-details', selectedGroupId],
    queryFn: () => groupsApi.get(selectedGroupId) as Promise<any>,
    enabled: open && Boolean(selectedGroupId),
    staleTime: 30000,
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Populate records when groupDetails arrive
  useEffect(() => {
    if (groupDetails?.students || groupDetails?.enrollments) {
      const list = groupDetails.students || groupDetails.enrollments || [];
      if (!Array.isArray(list)) {
        setRecords([]);
        return;
      }
      const formatted: StudentRecord[] = [];
      for (const item of list) {
        if (!item) continue;
        const student = item.student || item;
        if (!student || typeof student !== 'object' || !student.id) continue;
        const user = student.user || {};
        const name = user.firstName
          ? `${user.firstName} ${user.lastName || ''}`.trim()
          : student.name || "O'quvchi";
        formatted.push({
          studentId: String(student.id),
          name,
          phone: user.phone || student.phone,
          status: 'PRESENT',
        });
      }

      formatted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uz'));
      setRecords(formatted);
    } else {
      setRecords([]);
    }
  }, [groupDetails]);

  const handleMarkAll = (status: AttendanceStatus) => {
    setRecords((prev) => prev.map((r) => ({ ...r, status })));
  };

  // Toggle single status: PRESENT -> LATE -> EXCUSED -> ABSENT -> PRESENT
  const cycleStatus = (studentId: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.studentId !== studentId) return r;
        const next: AttendanceStatus =
          r.status === 'PRESENT'
            ? 'LATE'
            : r.status === 'LATE'
              ? 'EXCUSED'
              : r.status === 'EXCUSED'
                ? 'ABSENT'
                : 'PRESENT';
        return { ...r, status: next };
      }),
    );
  };

  const saveAttendance = useMutation({
    mutationFn: async () => {
      if (!selectedGroupId) throw new Error('Iltimos, guruhni tanlang');
      if (records.length === 0) throw new Error("Bu guruhda faol o'quvchilar yo'q");

      // Local ISO string prevents UTC-midnight timezone shift in Uzbekistan (UTC+5)
      const todayStr = toLocalISOString();
      return attendanceApi.create({
        groupId: selectedGroupId,
        date: todayStr,
        records: records.map((r) => ({
          studentId: r.studentId,
          status: r.status,
        })),
      });
    },
    onSuccess: () => {
      const presents = records.filter((r) => r.status === 'PRESENT').length;
      const lates = records.filter((r) => r.status === 'LATE').length;
      const excuseds = records.filter((r) => r.status === 'EXCUSED').length;
      const absents = records.filter((r) => r.status === 'ABSENT').length;

      const summaryParts = [
        `${presents} keldi`,
        lates > 0 ? `${lates} kechikdi` : null,
        excuseds > 0 ? `${excuseds} sababli` : null,
        `${absents} kelmadi`,
      ].filter(Boolean).join(', ');

      push(
        'success',
        `✅ Davomat saqlandi! (${summaryParts}). Ota-onalarga xabar yuborilmoqda.`,
      );

      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      setOpen(false);
    },
    onError: (err: any) => {
      push('error', err?.message || 'Davomatni saqlashda xatolik yuz berdi');
    },
  });

  // Global listeners: Alt+A, Escape, and Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key.toLowerCase() === 'a') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a')) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (!open) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (e.key === 'Enter' && !saveAttendance.isPending && records.length > 0) {
        // Don't trigger if focus is on a select or input
        const target = e.target as HTMLElement | null;
        if (target?.tagName !== 'SELECT' && target?.tagName !== 'INPUT') {
          e.preventDefault();
          saveAttendance.mutate();
        }
      }
    };

    const handleCustomOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ groupId?: string }>;
      if (customEvent.detail?.groupId) {
        setSelectedGroupId(customEvent.detail.groupId);
      }
      setOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-quick-attendance', handleCustomOpen);
    window.addEventListener('medu:open-quick-attendance', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-quick-attendance', handleCustomOpen);
      window.removeEventListener('medu:open-quick-attendance', handleCustomOpen);
    };
  }, [open, records.length, saveAttendance]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-slate-950/70 backdrop-blur-md animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden rounded-t-[28px] rounded-b-none sm:rounded-2xl border border-black/10 bg-white/95 p-4 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] shadow-2xl backdrop-blur-md text-slate-900 dark:border-white/15 dark:bg-[#121826]/95 dark:text-white"
        style={{
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 40px -10px rgba(16, 185, 129, 0.2)',
        }}
      >
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mb-3 shrink-0 sm:hidden" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-xl shadow-lg shadow-indigo-500/30">
              📋
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Tezkor Davomat (Express Mode)
                <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                  Fast Tap
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                1 daqiqada butun guruh davomatini olish va ota-onaga bildirish
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-slate-500 hover:bg-black/10 hover:text-slate-800 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Group Selector */}
        <div className="mb-4 shrink-0">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
            Guruhni tanlang
          </label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-2.5 text-base sm:text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            {groups.map((g: any) => (
              <option key={g.id} value={g.id} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                {g.name} {g.course?.name ? `(${g.course.name})` : ''} {g.room ? `• Xona: ${g.room}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Batch Actions Bar */}
        <div className="flex items-center justify-between bg-black/[0.03] border border-black/10 rounded-2xl p-2.5 mb-3 shrink-0 dark:bg-white/5 dark:border-white/10">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Jami: <strong className="text-slate-900 dark:text-white">{records.length}</strong> o'quvchi
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleMarkAll('PRESENT')}
              className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
            >
              🟢 Keldi
            </button>
            <button
              type="button"
              onClick={() => handleMarkAll('EXCUSED')}
              className="rounded-xl bg-sky-500/10 border border-sky-500/30 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-sky-700 hover:bg-sky-500/20 dark:bg-sky-500/20 dark:text-sky-300 dark:hover:bg-sky-500/30 transition-colors flex items-center gap-1"
            >
              🔵 Sababli
            </button>
            <button
              type="button"
              onClick={() => handleMarkAll('ABSENT')}
              className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-red-700 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30 transition-colors flex items-center gap-1"
            >
              🔴 Kelmadi
            </button>
          </div>
        </div>

        {/* Student Records List (Scrollable) */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px]">
          {loadingStudents ? (
            <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400 text-sm">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent mr-2" />
              O'quvchilar yuklanmoqda...
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
              Bu guruhda o'quvchilar topilmadi
            </div>
          ) : (
            records.map((r, i) => (
              <div
                key={r.studentId}
                onClick={() => cycleStatus(r.studentId)}
                className="flex items-center justify-between rounded-2xl border border-black/[0.06] bg-black/[0.02] p-3 hover:bg-black/[0.05] cursor-pointer select-none transition-all active:scale-[0.99] dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500 w-5">{i + 1}.</span>
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">{r.name}</div>
                    {r.phone && <div className="text-xs text-slate-500 dark:text-slate-400">📞 {r.phone}</div>}
                  </div>
                </div>

                {/* Status Toggle Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    (bosing o'zgartirish uchun)
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                      r.status === 'PRESENT'
                        ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                        : r.status === 'LATE'
                        ? 'bg-amber-500/15 text-amber-700 border border-amber-500/30 shadow-sm dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                        : r.status === 'EXCUSED'
                        ? 'bg-sky-500/15 text-sky-700 border border-sky-500/30 shadow-sm dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40'
                        : 'bg-red-500/15 text-red-700 border border-red-500/30 shadow-sm dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40'
                    }`}
                  >
                    <span>
                      {r.status === 'PRESENT'
                        ? '🟢 KELDI'
                        : r.status === 'LATE'
                        ? '🟡 KECHIKDI'
                        : r.status === 'EXCUSED'
                        ? '🔵 SABABLI'
                        : '🔴 KELMADI'}
                    </span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-black/10 dark:border-white/10 mt-4 shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-black/5 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white transition-colors"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={() => {
              if (saveAttendance.isPending || records.length === 0) return;
              saveAttendance.mutate();
            }}
            disabled={saveAttendance.isPending || records.length === 0}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 py-3 font-bold text-white shadow-xl shadow-indigo-500/25 hover:from-indigo-400 hover:to-purple-500 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saveAttendance.isPending ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Davomatni Tasdiqlash</span>
                <span className="rounded-lg bg-black/20 px-2 py-0.5 text-xs font-mono">
                  ↵ Enter
                </span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

export default QuickAttendanceModal;
