import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import request from '@/lib/api';

interface AcademicRiskItem {
  studentId: string;
  studentName: string;
  groupId: string | null;
  groupName: string | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  lastGrade: number | null;
  attendanceRate: number;
  homeworkCompletion: number;
  phone?: string | null;
  parentPhone?: string | null;
  suggestedAction?: string;
}

export function RetentionRadarWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['academic-risk-radar'],
    queryFn: () =>
      request('/academic-risk?limit=5') as Promise<{ items: AcademicRiskItem[]; total: number }>,
    staleTime: 60000,
  });

  const students = data?.items || [];
  const highRiskStudents = students.filter((s) => s.riskLevel === 'HIGH');

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-red-500/25 bg-white/70 p-6 shadow-[0_12px_40px_rgba(255,59,48,0.06)] backdrop-blur-2xl transition-all dark:border-red-500/20 dark:bg-[#1C1C1E]/70 dark:shadow-[0_12px_40px_rgba(255,59,48,0.15)]">
      {/* Background Soft Ambient Glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-orange-500/10 blur-3xl" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/15 text-xl border border-red-500/30 text-red-500 shadow-sm">
            <span className="relative z-10">🚨</span>
            <span className="absolute inset-0 animate-ping rounded-2xl bg-red-500/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[16px] tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                Retention Radar
              </h3>
              <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-red-600 dark:text-red-400">
                Chiqib ketish xavfi
              </span>
            </div>
            <p className="mt-0.5 text-[12px] font-medium text-[#86868B] dark:text-[#98989D]">
              Davomat va baholar asosida kursni tark etish ehtimoli yuqori bo‘lgan o‘quvchilar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {highRiskStudents.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-600 dark:text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              {highRiskStudents.length} ta yuqori xavf
            </span>
          )}
          <Link
            to="/academic-risk"
            className="text-[12px] font-semibold text-[#007AFF] hover:underline dark:text-[#0A84FF]"
          >
            Barchasini ko‘rish →
          </Link>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 space-y-2.5">
        {isLoading ? (
          <div className="py-8 text-center text-[13px] font-medium text-[#86868B]">
            Radar skanerlamoqda...
          </div>
        ) : students.length === 0 ? (
          <div className="py-8 text-center text-[13px] font-semibold text-[#34C759] dark:text-[#30D158]">
            ✅ Ajoyib! Hozirda chiqib ketish xavfi ostidagi o‘quvchilar yo‘q.
          </div>
        ) : (
          students.map((student) => {
            const isHigh = student.riskLevel === 'HIGH';
            return (
              <motion.div
                key={student.studentId}
                whileHover={{ scale: 1.008 }}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                  isHigh
                    ? 'border-red-500/30 bg-red-500/[0.07] hover:border-red-500/50 dark:bg-red-500/[0.12]'
                    : 'border-black/[0.06] bg-black/[0.02] hover:bg-black/[0.04] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs tracking-tight shadow-xs ${
                      isHigh
                        ? 'bg-red-500/20 text-red-600 border border-red-500/30 dark:text-red-300'
                        : 'bg-amber-500/20 text-amber-600 border border-amber-500/30 dark:text-amber-300'
                    }`}
                  >
                    {Math.round(student.riskScore)}%
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[13.5px] text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2 truncate">
                      <Link
                        to={`/students/${student.studentId}`}
                        className="hover:underline truncate"
                      >
                        {student.studentName}
                      </Link>
                      {student.groupName && (
                        <span className="text-[12px] font-normal text-[#86868B] shrink-0">
                          ({student.groupName})
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[#86868B] dark:text-[#98989D] truncate">
                      {student.suggestedAction || 'Holat nazorat ostida'}
                    </div>
                  </div>
                </div>

                {/* Quick Action Button */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {(student.parentPhone || student.phone) && (
                    <a
                      href={`tel:${student.parentPhone || student.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-black/[0.05] border border-black/[0.08] px-3 py-1.5 text-[11.5px] font-semibold text-[#1D1D1F] hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-600 transition-all dark:bg-white/[0.08] dark:border-white/10 dark:text-white dark:hover:text-emerald-400"
                    >
                      <span>📞</span>
                      <span>Qo‘ng‘iroq</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('open-quick-payment', {
                          detail: { studentId: student.studentId },
                        }),
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-indigo-500/15 border border-indigo-500/30 px-3 py-1.5 text-[11.5px] font-bold text-indigo-600 hover:bg-indigo-500/25 transition-all dark:text-indigo-300"
                  >
                    <span>⚡ To‘lov</span>
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default RetentionRadarWidget;
