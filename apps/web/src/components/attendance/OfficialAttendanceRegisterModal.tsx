/**
 * M-EDU V2 — Official Attendance Register Sheet Modal (`OfficialAttendanceRegisterModal.tsx`)
 *
 * Republic of Uzbekistan legal & academic standard monthly attendance roll sheet (Davomat Vedomosti).
 * Vector-clean A4 Landscape printable register with ISO/IEC 18004 QR verification seal,
 * digital signature boxes, official ministry/center header, and summary analytics.
 */

import { useState, useMemo, useEffect } from 'react';
import { GlassModal, GlassButton, useToast } from '@/components/ui';
import { RealQrCode } from '@/components/ui/RealQrCode';
import { triggerPrint } from '@/lib/printEngine';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { cn } from '@/lib/design';
import { studentsApi, groupsApi, attendanceApi } from '@/lib/api';
import { toList } from '@/lib/normalizeList';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { Student } from '@/types/students';
import type { Group } from '@/types/academics';

export interface OfficialAttendanceRegisterModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly groupId?: string;
  readonly initialGroupName?: string;
  readonly initialTeacherName?: string;
}

interface StudentRollRow {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  statuses: ('PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE' | 'UNKNOWN')[];
}

export function OfficialAttendanceRegisterModal({
  open,
  onClose,
  groupId,
  initialGroupName = '',
  initialTeacherName = '',
}: OfficialAttendanceRegisterModalProps): JSX.Element {
  const { t } = useSafeI18n();
  const { playPop, playSuccess, playTick } = usePremiumSound();
  const { success } = useToast();

  const [groupName, setGroupName] = useState(initialGroupName);
  const [teacherName, setTeacherName] = useState(initialTeacherName);
  const [month, setMonth] = useState(() =>
    new Date().toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' }),
  );
  const [students, setStudents] = useState<StudentRollRow[]>([]);
  const documentYear = new Date().getFullYear();

  // Load real registered students and group info from DB
  useEffect(() => {
    let isMounted = true;

    const toRollRows = (studentItems: Student[]): StudentRollRow[] =>
      studentItems.map((st) => ({
        id: st.id,
        name: [st.user?.firstName, st.user?.lastName].filter(Boolean).join(' ').trim() || '—',
        phone: st.user?.phone || st.parentPhone || '—',
        statuses: Array.from({ length: 12 }, () => 'UNKNOWN' as const),
      }));

    async function loadRealEnrollments() {
      try {
        // A selected group must drive the sheet — otherwise the "official"
        // register prints students from unrelated groups.
        if (groupId) {
          const [groupRes, attRes] = await Promise.allSettled([
            groupsApi.get(groupId),
            attendanceApi.list({ groupId, limit: 120 }),
          ]);

          if (!isMounted) return;

          const group = groupRes.status === 'fulfilled' ? ((groupRes.value as any) as Group) : null;
          if (group) {
            setGroupName(group.name || initialGroupName);
            if (group.teacher?.user) {
              setTeacherName(
                `${group.teacher.user.firstName} ${group.teacher.user.lastName || ''}`.trim(),
              );
            }
            const enrolled =
              group.enrollments?.map((enrollment) => enrollment.student).filter(Boolean) ?? [];
            const rows = toRollRows(enrolled);

            // Populate existing attendance if available
            const attData = attRes.status === 'fulfilled' ? (attRes.value as any) : null;
            const attItems = Array.isArray(attData?.items) ? attData.items : Array.isArray(attData) ? attData : [];
            if (attItems.length > 0) {
              const recordsByStudent = new Map<string, any[]>();
              for (const record of attItems) {
                if (!recordsByStudent.has(record.studentId)) recordsByStudent.set(record.studentId, []);
                recordsByStudent.get(record.studentId)!.push(record);
              }

              rows.forEach((row) => {
                const studentAtt = recordsByStudent.get(row.id) ?? [];
                studentAtt.forEach((rec) => {
                  const day = new Date(rec.date).getDate();
                  const dayIdx = lessonDays.indexOf(day);
                  if (dayIdx >= 0 && dayIdx < row.statuses.length) {
                    row.statuses[dayIdx] = rec.status;
                  }
                });
              });
            }

            setStudents(rows);
            return;
          }
        }

        const [stRes, grRes] = await Promise.allSettled([
          studentsApi.list({ limit: 25 }),
          groupsApi.list({ limit: 5 }),
        ]);

        if (!isMounted) return;

        const studentItems: Student[] =
          stRes.status === 'fulfilled' ? toList<Student>(stRes.value) : [];
        const groupItems: Group[] =
          grRes.status === 'fulfilled' ? toList<Group>(grRes.value) : [];

        if (groupItems.length > 0) {
          if (!initialGroupName) {
            setGroupName(groupItems[0].name || '');
          }
          if (!initialTeacherName && groupItems[0].teacher?.user) {
            setTeacherName(`${groupItems[0].teacher.user.firstName} ${groupItems[0].teacher.user.lastName || ''}`.trim());
          }
        }

        if (studentItems.length > 0) {
          setStudents(toRollRows(studentItems));
        }
      } catch {
        // Fallback
      }
    }
    if (open) {
      void loadRealEnrollments();
    }
    return () => { isMounted = false; };
  }, [open, groupId, initialGroupName]);

  // Lesson dates (e.g. 12 lessons in a month: Mon/Wed/Fri)
  const lessonDays = useMemo(() => [2, 5, 7, 9, 12, 14, 16, 19, 21, 23, 26, 28], []);

  // Compute overall class statistics
  const classStats = useMemo(() => {
    let totalSlots = 0;
    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let lateCount = 0;

    students.forEach((s) => {
      s.statuses.forEach((st) => {
        if (st === 'UNKNOWN') return;
        totalSlots++;
        if (st === 'PRESENT') presentCount++;
        else if (st === 'ABSENT') absentCount++;
        else if (st === 'EXCUSED') excusedCount++;
        else if (st === 'LATE') lateCount++;
      });
    });

    // Canonical rate: excused absences are not penalised.
    const denominator = totalSlots - excusedCount;
    const attendanceRate =
      denominator > 0
        ? Math.round(((presentCount + lateCount) / denominator) * 100)
        : totalSlots > 0 && excusedCount === totalSlots
          ? 100
          : 0;
    return { totalSlots, presentCount, absentCount, excusedCount, lateCount, attendanceRate };
  }, [students]);

  // Cycle status on cell click
  const toggleStudentStatus = (studentIdx: number, dayIdx: number) => {
    playTick();
    setStudents((prev) => {
      const next = [...prev];
      const targetRow = { ...next[studentIdx], statuses: [...next[studentIdx].statuses] };
      const current = targetRow.statuses[dayIdx];
      const cycleMap: Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE'> = {
        UNKNOWN: 'PRESENT',
        PRESENT: 'ABSENT',
        ABSENT: 'LATE',
        LATE: 'EXCUSED',
        EXCUSED: 'PRESENT',
      };
      targetRow.statuses[dayIdx] = cycleMap[current] || 'PRESENT';
      next[studentIdx] = targetRow;
      return next;
    });
  };

  const handlePrint = () => {
    playSuccess();
    triggerPrint({
      type: 'receipt-a4',
      title: `Davomat_Vedomosti_${groupName.replace(/\s+/g, '_')}_${month}`,
    });
  };

  const verificationUrl = `https://m-edu.uz/verify/attendance?group=${encodeURIComponent(groupName)}&month=${encodeURIComponent(month)}&v=2.0`;

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={`📋 ${t('attendance.registerSheet.title')}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Controls Toolbar (Hidden when printed) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400">
                {t('attendance.registerSheet.groupName')}:
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="mt-1 block rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400">
                {t('attendance.registerSheet.teacherName')}:
              </label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="mt-1 block rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400">
                {t('attendance.registerSheet.reportMonth')}:
              </label>
              <input
                type="text"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="mt-1 block rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                playPop();
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(verificationUrl).catch(() => {});
                }
                success(t('attendance.registerSheet.linkCopied'));
              }}
            >
              {t('attendance.registerSheet.copyLink')}
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 font-bold"
            >
              🖨️ {t('attendance.registerSheet.printA4')}
            </GlassButton>
          </div>
        </div>

        {/* Printable Document Container */}
        <div
          data-printable="receipt"
          className="relative rounded-2xl border border-slate-300 bg-white p-6 text-slate-900 shadow-xl dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 print:bg-white print:text-black print:border-slate-800 print:shadow-none print:p-4 print:m-0"
          style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
        >
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900/80 pb-4 text-center dark:border-white/80 print:border-black print:text-black">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 print:text-black">
                  M-EDU Cloud Educational Platform
                </span>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-slate-700">
                  {t('attendance.registerSheet.platformSubtitle')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 print:text-slate-600">STANDART: VEDOMOST-A4/UZ</span>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 print:text-black">{month}</p>
              </div>
            </div>

            <h2 className="mt-3 text-lg font-black tracking-tight uppercase print:text-black">
              {t('attendance.registerSheet.docHeading')}
            </h2>
            <div className="mt-2 flex flex-wrap justify-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-300 print:text-black">
              <span><strong>{t('attendance.registerSheet.group')}:</strong> {groupName}</span>
              <span><strong>{t('attendance.registerSheet.teacher')}:</strong> {teacherName}</span>
              <span><strong>{t('attendance.registerSheet.lessonsCount')}:</strong> {lessonDays.length}</span>
              <span><strong>{t('attendance.registerSheet.overallRate')}:</strong> {classStats.attendanceRate}%</span>
            </div>
          </div>

          {/* Roll Sheet Matrix */}
          <div className="mt-4 overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse text-left text-xs border border-slate-300 print:border-slate-800">
              <thead>
                <tr className="border-b-2 border-slate-800 bg-slate-100/80 text-[11px] font-bold text-slate-800 dark:border-white/60 dark:bg-slate-900 dark:text-slate-200 print:bg-slate-100 print:text-black print:border-black">
                  <th className="p-2 w-8 text-center border border-slate-200 print:border-slate-400">#</th>
                  <th className="p-2 min-w-[160px] border border-slate-200 print:border-slate-400">{t('attendance.registerSheet.studentNameCol')}</th>
                  {lessonDays.map((d, i) => (
                    <th key={i} className="p-1.5 text-center font-mono text-[10px] w-7 border border-slate-200 print:border-slate-400">
                      {d}
                    </th>
                  ))}
                  <th className="p-2 text-center w-12 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-slate-200 print:border-slate-400 print:bg-transparent print:text-black">{t('attendance.registerSheet.presentCol')}</th>
                  <th className="p-2 text-center w-12 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-slate-200 print:border-slate-400 print:bg-transparent print:text-black">{t('attendance.registerSheet.excusedCol')}</th>
                  <th className="p-2 text-center w-12 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-slate-200 print:border-slate-400 print:bg-transparent print:text-black">{t('attendance.registerSheet.absentCol')}</th>
                  <th className="p-2 text-center w-14 font-black border border-slate-200 print:border-slate-400 print:text-black">{t('attendance.registerSheet.rateCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10 print:divide-slate-800">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={lessonDays.length + 6} className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 print:text-slate-700">
                      {t('attendance.registerSheet.emptyStudents')}
                    </td>
                  </tr>
                ) : (
                  students.map((st, sIdx) => {
                  let p = 0;
                  let a = 0;
                  let exc = 0;
                  let l = 0;

                  st.statuses.forEach((status) => {
                    if (status === 'PRESENT') p++;
                    else if (status === 'ABSENT') a++;
                    else if (status === 'EXCUSED') exc++;
                    else if (status === 'LATE') l++;
                  });

                  const total = st.statuses.filter((status) => status !== 'UNKNOWN').length;
                  const denominator = total - exc;
                  const rate =
                    denominator > 0
                      ? Math.round(((p + l) / denominator) * 100)
                      : total > 0 && exc === total
                        ? 100
                        : 0;

                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/[0.02] border-b border-slate-200 print:border-slate-400 print:text-black"
                      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                    >
                      <td className="p-2 text-center font-bold text-slate-400 print:text-slate-700 border border-slate-200 print:border-slate-400">{sIdx + 1}</td>
                      <td className="p-2 font-semibold border border-slate-200 print:border-slate-400">
                        <div>{st.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono no-print">{st.phone}</div>
                      </td>
                      {st.statuses.map((status, dIdx) => (
                        <td
                          key={dIdx}
                          onClick={() => toggleStudentStatus(sIdx, dIdx)}
                          className="p-1 text-center font-mono cursor-pointer transition-colors hover:bg-violet-500/20 border border-slate-200 print:border-slate-400"
                          title={t('attendance.registerSheet.cycleStatusHint')}
                        >
                          {status === 'PRESENT' && <span className="font-bold text-emerald-600 dark:text-emerald-400 print:text-black">+</span>}
                          {status === 'ABSENT' && <span className="font-bold text-rose-600 dark:text-rose-400 print:text-black">-</span>}
                          {status === 'EXCUSED' && <span className="font-bold text-amber-600 dark:text-amber-400 print:text-black">S</span>}
                          {status === 'LATE' && <span className="font-bold text-sky-600 dark:text-sky-400 print:text-black">K</span>}
                        </td>
                      ))}
                      <td className="p-2 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-slate-200 print:border-slate-400 print:bg-transparent print:text-black">{p + l}</td>
                      <td className="p-2 text-center font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/5 border border-slate-200 print:border-slate-400 print:bg-transparent print:text-black">{exc}</td>
                      <td className="p-2 text-center font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/5 border border-slate-200 print:border-slate-400 print:bg-transparent print:text-black">{a}</td>
                      <td className="p-2 text-center font-black border border-slate-200 print:border-slate-400">
                        <span className={cn(
                          'inline-block px-1.5 py-0.5 rounded text-[11px]',
                          rate >= 80 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 print:bg-transparent print:text-black' :
                          rate >= 60 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 print:bg-transparent print:text-black' :
                          'bg-rose-500/20 text-rose-700 dark:text-rose-300 print:bg-transparent print:text-black'
                        )}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>

          {/* Legend and Note */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">
            <div className="flex items-center gap-4">
              <span><strong>{t('attendance.registerSheet.legend')}:</strong></span>
              <span className="text-emerald-600 font-bold">+ {t('attendance.registerSheet.legendPresent')}</span>
              <span className="text-rose-600 font-bold">- {t('attendance.registerSheet.legendAbsent')}</span>
              <span className="text-amber-600 font-bold">S {t('attendance.registerSheet.legendExcused')}</span>
              <span className="text-sky-600 font-bold">K {t('attendance.registerSheet.legendLate')}</span>
            </div>
            <div>
              Hujjat ID: <code>ATT-{month.slice(0, 3).toUpperCase()}-{groupName.slice(0, 4)}-{documentYear}</code>
            </div>
          </div>

          {/* Official Seals and Signatures */}
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6 border-t-2 border-slate-900/60 pt-4 dark:border-white/60 print:border-slate-800 print:text-black">
            {/* Teacher Signature */}
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase text-slate-500 print:text-slate-700">{t('attendance.registerSheet.teacherSign')}:</p>
              <div className="h-10 w-44 border-b border-dashed border-slate-400 flex items-end">
                <span className="text-xs font-semibold print:text-black">{teacherName}</span>
              </div>
              <p className="text-[9px] text-slate-400 print:text-slate-600">{t('attendance.registerSheet.signDate')}</p>
            </div>

            {/* Official Stamp Center Mark */}
            <div className="flex flex-col items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-violet-500/40 text-[9px] font-black text-violet-500 text-center uppercase tracking-tight print:border-slate-800 print:text-slate-800">
                {t('attendance.registerSheet.stampPlace')}
              </div>
            </div>

            {/* Director Signature */}
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase text-slate-500 print:text-slate-700">{t('attendance.registerSheet.directorSign')}:</p>
              <div className="h-10 w-48 border-b border-dashed border-slate-400 flex items-end">
                <span className="text-xs font-semibold print:text-black">{t('attendance.registerSheet.directorConfirmed')}</span>
              </div>
              <p className="text-[9px] text-slate-400 print:text-slate-600">{t('attendance.registerSheet.signDate')}</p>
            </div>

            {/* ISO/IEC 18004 Verification Seal */}
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-slate-300 p-1 bg-white print:border-slate-600">
                <RealQrCode value={verificationUrl} width={58} height={58} />
              </div>
              <div className="text-[9px] leading-tight text-slate-400 max-w-[100px] print:text-slate-700">
                <strong className="block text-slate-700 dark:text-slate-300 print:text-black">ISO/IEC 18004</strong>
                {t('attendance.registerSheet.qrSealNote')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassModal>
  );
}
