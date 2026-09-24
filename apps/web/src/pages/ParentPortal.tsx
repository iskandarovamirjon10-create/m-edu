/**
 * ParentPortalPage — Ultra Premium Apple-Style Dashboard
 * Features smooth glassmorphism, dynamic data rings, iOS-style cards,
 * and high-end typography for parents tracking student progress.
 */
import { useState} from'react';
import { useQuery} from'@tanstack/react-query';
import { parentPortalApi} from'@/lib/api';
import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassEmptyState,
} from'@/components/ui';
import { formatCurrency, formatDate, formatTime, fullName} from'@/lib/format';
import { getErrorMessage} from'@/lib/errorMessages';
import type {
 ParentChild,
 ParentAttendanceRecord,
 ParentAttendanceSummary,
 ParentGradesResponse,
 ParentInvoicesResponse,
 Invoice,
} from'@/lib/types';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n} from'@/i18n/I18nProvider';

type ParentGrade = ParentGradesResponse['grades'][number];
type ParentExamResult = NonNullable<ParentGradesResponse['examResults']>[number];
type ParentInvoice = Invoice;
type ParentPayment = NonNullable<ParentInvoicesResponse['payments']>[number];

const ATTENDANCE_STATUS_LABEL_KEYS: Record<string, string> = {
 PRESENT:'attendance.present',
 ABSENT:'attendance.absent',
 LATE:'attendance.late',
 EXCUSED:'attendance.excused',
};

const STUDENT_STATUS_LABEL_KEYS: Record<string, string> = {
 ACTIVE:'enum.status.ACTIVE',
 INACTIVE:'enum.status.INACTIVE',
 PENDING:'enum.status.PENDING',
};

const INVOICE_STATUS_LABEL_KEYS: Record<string, string> = {
 DRAFT:'parentPortal.invoiceStatus.DRAFT',
 ISSUED:'parentPortal.invoiceStatus.ISSUED',
 PARTIALLY_PAID:'parentPortal.invoiceStatus.PARTIALLY_PAID',
 PAID:'payments.status.PAID',
 OVERDUE:'payments.status.OVERDUE',
 CANCELLED:'payments.status.CANCELLED',
 REFUNDED:'parentPortal.invoiceStatus.REFUNDED',
};

const RELATIONSHIP_LABEL_KEYS: Record<string, string> = {
 MOTHER:'parentPortal.relationship.MOTHER',
 FATHER:'parentPortal.relationship.FATHER',
 PARENT:'parentPortal.relationship.PARENT',
 GUARDIAN:'parentPortal.relationship.GUARDIAN',
 BROTHER:'parentPortal.relationship.BROTHER',
 SISTER:'parentPortal.relationship.SISTER',
 OTHER:'parentPortal.relationship.OTHER',
};

// Custom iOS-style Tab Switcher
function PremiumTabSwitcher({ tabs, active, onChange}: { tabs: { id: string; label: string}[]; active: string; onChange: (id: string) => void}) {
 return (
 <div className="flex p-1.5 mb-8 rounded-[1.5rem] bg-[var(--state-hover)] border border-[var(--border-subtle)]/50 shadow-inner overflow-x-auto custom-scrollbar w-max max-w-full">
 {tabs.map((tab) => {
 const isActive = active === tab.id;
 return (
 <button
 key={tab.id}
 type="button"
 onClick={() => onChange(tab.id)}
 className="flex-1 min-w-[120px] px-5 py-2.5 rounded-xl transition-all duration-300 relative z-10 outline-none"
 >
 {isActive && (
 <div className="absolute inset-1 rounded-[10px] bg-[var(--bg-card)] shadow-[0_2px_8px_rgba(0,0,0,0.12)] -z-10 animate-in zoom-in-95 duration-200"/>
 )}
 <span className={`text-[0.85rem] font-bold tracking-wide transition-colors duration-300 truncate block ${
 isActive ?'text-[var(--text-primary)]' :'text-[var(--text-muted)]'
}`}>
 {tab.label}
 </span>
 </button>
 );
})}
 </div>
 );
}

// Attendance Badge Styling
function getAttendanceBadge(status: string) {
 switch (status) {
 case'PRESENT': return { bg:'bg-emerald-500/10', text:'text-emerald-600', dot:'bg-emerald-500'};
 case'ABSENT': return { bg:'bg-rose-500/10', text:'text-rose-600', dot:'bg-rose-500'};
 case'LATE': return { bg:'bg-amber-500/10', text:'text-amber-600', dot:'bg-amber-500'};
 case'EXCUSED': return { bg:'bg-blue-500/10', text:'text-blue-600', dot:'bg-blue-500'};
 default: return { bg:'bg-[var(--state-hover)]', text:'text-[var(--text-secondary)]', dot:'bg-gray-400'};
}
}

function relationshipLabel(t: (key: string) => string, value?: string): string {
 if (!value) return '—';
 const key = RELATIONSHIP_LABEL_KEYS[value] ?? RELATIONSHIP_LABEL_KEYS[value.toUpperCase()];
 return key ? t(key) : value;
}

// Premium Apple Health-style Ring
function AttendanceRing({ summary}: { summary: ParentAttendanceSummary}) {
 const { t} = useI18n();
 const { byStatus, total} = summary;
 if (total === 0) return null;

 const colors: Record<string, string> = {
 PRESENT:'#10b981', // emerald-500
 ABSENT:'#f43f5e', // rose-500
 LATE:'#f59e0b', // amber-500
 EXCUSED:'#3b82f6', // blue-500
};

 let cumulative = 0;
 const entries = Object.entries((byStatus ?? {}) as Record<string, number>).filter(([, v]) => v > 0);
 const segments = entries.map(([status, count]) => {
 const pct = count / (total ?? 0);
 const start = cumulative;
 cumulative += pct;
 return { status, count, pct, start, color: colors[status] ||'#9ca3af'};
});

 const cx = 50;
 const cy = 50;
 const r = 40;
 const circumference = 2 * Math.PI * r;

 return (
 <div className="flex flex-col sm:flex-row sm:items-center gap-8 px-2 py-4">
 <div className="relative shrink-0 flex justify-center">
 <svg width={100} height={100} viewBox="0 0 100 100"className="transform -rotate-90 drop-shadow-md">
 <circle cx={cx} cy={cy} r={r} fill="none"className="stroke-gray-100 dark:stroke-white/5"strokeWidth={10} />
 {segments.map((seg) => {
 const dash = seg.pct * circumference;
 const offset = (1 - seg.start) * circumference;
 return (
 <circle
 key={seg.status}
 cx={cx} cy={cy} r={r}
 fill="none"
 stroke={seg.color}
 strokeWidth={10}
 strokeDasharray={`${dash} ${circumference - dash}`}
 strokeDashoffset={offset}
 strokeLinecap="round"
 style={{ transition:'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)'}}
 />
 );
})}
 </svg>
 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
 <span className="text-[1.5rem] font-extrabold text-[var(--text-primary)] leading-none">
 {summary.attendanceRate != null ? `${summary.attendanceRate}%` :'—'}
 </span>
 <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">{t('parentPortal.rate')}</span>
 </div>
 </div>
 <div className="flex flex-col gap-3 flex-1">
 {segments.map((s) => (
 <div key={s.status} className="flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <span className="w-2.5 h-2.5 rounded-full shadow-sm"style={{ background: s.color}} />
 <span className="text-[0.8rem] font-semibold text-[var(--text-secondary)] capitalize">
 {ATTENDANCE_STATUS_LABEL_KEYS[s.status] ? t(ATTENDANCE_STATUS_LABEL_KEYS[s.status]) : s.status.toLowerCase()}
 </span>
 </div>
 <span className="text-[0.85rem] font-bold text-[var(--text-primary)]">
 {s.count}
 </span>
 </div>
 ))}
 </div>
 </div>
 );
}

// Premium Local Stat Card
function StatCard({ label, value, colorClass}: { label: string; value: string | number; colorClass: string}) {
 return (
 <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card">
 <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 transition-opacity group-hover:opacity-20 ${colorClass}`} aria-hidden />
 <div className="relative z-10 flex flex-col h-full">
 <p className={`text-[1.5rem] font-black tracking-tight mb-1 ${colorClass.replace('bg-','text-')}`}>
 {value}
 </p>
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wide">
 {label}
 </p>
 </div>
 </div>
 );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Main Page */
/* ────────────────────────────────────────────────────────────────────────── */
export function ParentPortalPage() {
 const { t} = useI18n();
 usePageTitle(t('parentPortal.title'));
 const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

 const childrenQuery = useQuery({ queryKey: ['parent-portal-children'], queryFn: () => parentPortalApi.children()});
 const children = (childrenQuery.data as ParentChild[] | undefined) ?? [];
 const selectedChild = children.find((c) => c.studentId === selectedStudentId) ?? children[0];

 const attendanceQuery = useQuery({
 queryKey: ['parent-portal-attendance', selectedChild?.studentId],
 queryFn: () => parentPortalApi.attendance(selectedChild!.studentId, { limit: 20}),
 enabled: !!selectedChild?.permissions?.attendance,
});

 const attendanceSummaryQuery = useQuery({
 queryKey: ['parent-portal-attendance-summary', selectedChild?.studentId],
 queryFn: () => parentPortalApi.attendanceSummary(selectedChild!.studentId),
 enabled: !!selectedChild?.permissions?.attendance,
});

 const gradesQuery = useQuery({
 queryKey: ['parent-portal-grades', selectedChild?.studentId],
 queryFn: () => parentPortalApi.grades(selectedChild!.studentId),
 enabled: !!selectedChild?.permissions?.grades,
});

 const invoicesQuery = useQuery({
 queryKey: ['parent-portal-invoices', selectedChild?.studentId],
 queryFn: () => parentPortalApi.invoices(selectedChild!.studentId),
 enabled: !!selectedChild?.permissions?.payments,
});

 if (childrenQuery.isLoading) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('parentPortal.title')}subtitle={t('parentPortal.loadingProfile')}/>
 <div className="mt-8 rounded-[2.5rem] p-16 flex items-center justify-center glass-card">
 <GlassPageLoader label="Fetching data…"/>
 </div>
 </div>
 );
}

 if (childrenQuery.isError) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('parentPortal.title')}subtitle={t('parentPortal.connectionError')}/>
 <div className="mt-8 rounded-[2.5rem] p-12 glass-card">
 <GlassErrorState message={getErrorMessage(childrenQuery.error)} onRetry={() => childrenQuery.refetch()} />
 </div>
 </div>
 );
}

 if (children.length === 0) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('parentPortal.title')}subtitle={t('parentPortal.overview')}/>
 <div className="mt-8 rounded-[2.5rem] p-12 glass-card">
 <GlassEmptyState title={t('parentPortal.noChildren')}message={t('parentPortal.noChildrenHint')}/>
 </div>
 </div>
 );
}

 const activeChild = selectedChild ?? children[0];
 const perms = activeChild.permissions ?? {};
 const student = activeChild.student;
 const studentName = fullName(student?.user.firstName ??'', student?.user.lastName ??'');

 const attendanceData = (attendanceQuery.data as ParentAttendanceRecord[] | undefined) ?? [];
 const attendanceSummary = attendanceSummaryQuery.data as ParentAttendanceSummary | undefined;
 const gradesData = gradesQuery.data as ParentGradesResponse | undefined;
 const invoicesData = invoicesQuery.data as ParentInvoicesResponse | undefined;

 return (
 <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
 
 {/* Soft Apple-style Background Ambient Orbs */}
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden>
 <div className="absolute top-[0%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-400/5 blur-[120px]"/>
 <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-indigo-400/5 blur-[130px]"/>
 </div>

 <div className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
 
 <GlassPageHeader
 title={t('parentPortal.title')}
 subtitle={t('parentPortal.subtitle')}
 />

 {/* ── Children Selector ─────────────────────────────────────────── */}
 {children.length > 1 && (
 <PremiumTabSwitcher
 tabs={children.map((c) => ({ id: c.studentId, label: fullName(c.student?.user.firstName ??'', c.student?.user.lastName ??'')}))}
 active={activeChild.studentId}
 onChange={setSelectedStudentId}
 />
 )}

 {/* ── Hero Profile Card ─────────────────────────────────────────── */}
 <div className="rounded-[2.5rem] glass-card p-6 sm:p-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative overflow-hidden group mb-8">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-brand-500/5 blur-[50px] group-hover:bg-brand-500/10 transition-colors duration-700"aria-hidden />

 <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10 w-full">
 {/* Avatar */}
 <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-[2rem] font-extrabold bg-gradient-to-br from-brand-400 to-indigo-600 text-white shadow-[0_8px_24px_rgba(84,115,252,0.4)] shrink-0 border-4 border-white ">
 {student?.user.avatar ? (
 <img src={student.user.avatar} alt={studentName} className="w-full h-full rounded-full object-cover"/>
 ) : (
 studentName.split('').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
 )}
 </div>
 
 {/* Info */}
 <div className="text-center sm:text-left flex-1 mt-2">
 <h1 className="text-[1.75rem] sm:text-[2.25rem] font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
 {studentName}
 </h1>
 <div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
 {student?.status ? (
 <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[0.75rem] font-black uppercase tracking-wider shadow-sm border border-black/5 ${student?.status ==='ACTIVE' ?'bg-emerald-500/10 text-emerald-600' :'bg-[var(--state-hover)] text-[var(--text-muted)]'}`}>
 {STUDENT_STATUS_LABEL_KEYS[student.status] ? t(STUDENT_STATUS_LABEL_KEYS[student.status]) : student.status}
 </span>
 ) : null}
 <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[0.75rem] font-black uppercase tracking-wider bg-[var(--state-hover)] text-[var(--text-secondary)] border border-black/5 ">
 {relationshipLabel(t, activeChild.relationship)}
 </span>
 </div>
 
 {/* Groups */}
 {(student?.groups?.length ?? 0) > 0 && (
 <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4 pt-4 border-t border-[var(--border-subtle)]">
 {student?.groups?.map((g: { id: string; name: string}) => (
 <span key={g.id} className="px-2.5 py-1 rounded-md text-[0.7rem] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
 {g.name}
 </span>
 ))}
 </div>
 )}
 </div>

 {/* Financial Status */}
 <div className="text-center sm:text-right hidden sm:block shrink-0">
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1">{t('parentPortal.currentBalance')}</p>
 <p className={`text-[1.75rem] font-black tracking-tight ${(student?.balance ?? 0) < 0 ?'text-rose-600' :'text-emerald-600'}`}>
 {formatCurrency(student?.balance ?? 0)}
 </p>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
 
 {/* Left Column (Attendance & Grades) */}
 <div className="lg:col-span-7 flex flex-col gap-8">
 
 {/* ── Attendance ──────────────────────────────────────────────── */}
 {perms?.attendance && (
 <div className="rounded-[2.5rem] glass-card relative overflow-hidden">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] ">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">{t('parentPortal.attendanceOverview')}</h2>
 </div>

 <div className="p-6 border-b border-[var(--border-subtle)]">
 {attendanceSummaryQuery.isLoading ? (
 <div className="h-32 flex items-center justify-center"><GlassPageLoader /></div>
 ) : attendanceSummary ? (
 <AttendanceRing summary={attendanceSummary} />
 ) : null}
 </div>

 <div className="relative z-10 w-full">
 {attendanceQuery.isLoading ? (
 <div className="p-10 flex items-center justify-center"><GlassPageLoader /></div>
 ) : attendanceData.length > 0 ? (
 <ul className="divide-y divide-gray-100 dark:divide-white/5 max-h-[360px] overflow-y-auto custom-scrollbar">
 {attendanceData.slice(0, 10).map((rec) => {
 const badge = getAttendanceBadge(rec.status);
 return (
 <li key={rec.id} className="px-6 py-4 hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)] transition-colors">
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-4 min-w-0">
 <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wider ${badge.bg} ${badge.text}`}>
 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${badge.dot}`} />
 {ATTENDANCE_STATUS_LABEL_KEYS[rec.status] ? t(ATTENDANCE_STATUS_LABEL_KEYS[rec.status]) : rec.status}
 </span>
 <div className="min-w-0">
 <p className="text-[0.95rem] font-bold text-[var(--text-primary)] truncate">{rec.group?.name ?? rec.groupName}</p>
 {rec.lesson && <p className="text-[0.8rem] font-medium text-[var(--text-muted)] truncate mt-0.5">{rec.lesson.topic} · {formatTime(rec.lesson.startTime)}</p>}
 </div>
 </div>
 <span className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest shrink-0">
 {formatDate(rec.date)}
 </span>
 </div>
 {rec.note && (
 <div className="mt-3 ml-14 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 ">
 <span className="text-[0.8rem] font-medium leading-relaxed">{rec.note}</span>
 </div>
 )}
 </li>
 );
})}
 </ul>
 ) : (
 <div className="p-10 flex justify-center"><p className="text-[0.9rem] font-medium text-[var(--text-muted)]">{t('parentPortal.noAttendance')}</p></div>
 )}
 </div>
 </div>
 )}

 {/* ── Grades ──────────────────────────────────────────────────── */}
 {perms?.grades && (
 <div className="rounded-[2.5rem] glass-card relative overflow-hidden">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] ">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">{t('parentPortal.gradesTitle')}</h2>
 </div>

 <div className="relative z-10 w-full p-2">
 {gradesQuery.isLoading ? (
 <div className="h-32 flex items-center justify-center"><GlassPageLoader /></div>
 ) : gradesData && (gradesData.grades.length > 0 || (gradesData.examResults ?? []).length > 0) ? (
 <div className="space-y-4">
 {gradesData.grades.length > 0 && (
 <div className="p-4">
 <h3 className="text-[0.75rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 ml-2">{t('parentPortal.courseAssessments')}</h3>
 <div className="space-y-2">
 {gradesData.grades.map((g: ParentGrade, idx: number) => (
 <div key={g.id ?? idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] dark:hover:border-white/10 transition-colors">
 <div className="min-w-0">
 <p className="text-[0.95rem] font-bold text-[var(--text-primary)] truncate">{g.label || g.group?.name || t('parentPortal.gradeFallback')}</p>
 {g.notes && <p className="text-[0.8rem] font-medium text-[var(--text-muted)] truncate mt-0.5">{g.notes}</p>}
 </div>
 <div className="shrink-0 px-3 py-1 rounded-xl bg-[var(--state-hover)] ">
 <span className="text-[1rem] font-extrabold text-[var(--text-primary)]">{g.value}</span>
 {g.maxValue && <span className="text-[0.8rem] font-bold text-[var(--text-muted)]">/{g.maxValue}</span>}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 {(gradesData.examResults ?? []).length > 0 && (
 <div className="p-4 border-t border-[var(--border-subtle)]">
 <h3 className="text-[0.75rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 ml-2">{t('parentPortal.examResults')}</h3>
 <div className="space-y-2">
 {(gradesData.examResults ?? []).map((er: ParentExamResult, idx: number) => (
 <div key={er.id ?? idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] dark:hover:border-white/10 transition-colors">
 <div className="min-w-0">
 <p className="text-[0.95rem] font-bold text-[var(--text-primary)] truncate">{er.exam?.title || er.examTitle || t('parentPortal.examFallback')}</p>
  <p className="text-[0.8rem] font-medium text-[var(--text-muted)] mt-0.5">{er.exam?.examType} · {t('parentPortal.maxMarks', { n: er.exam?.totalMarks ?? er.totalMarks ?? 0 })}</p>
 </div>
 <div className="flex items-center gap-3 shrink-0">
 <span className="text-[1.1rem] font-extrabold text-[var(--text-primary)]">{er.score}</span>
 <span className={`px-2.5 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wider ${er.isPassed ?'bg-emerald-500/10 text-emerald-600' :'bg-rose-500/10 text-rose-600'}`}>
 {er.isPassed ? t('parentPortal.passed') : t('parentPortal.failed')}
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 ) : (
 <div className="p-10 flex justify-center"><p className="text-[0.9rem] font-medium text-[var(--text-muted)]">{t('parentPortal.noGrades')}</p></div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Right Column (Finances) */}
 <div className="lg:col-span-5 flex flex-col gap-8">
 
 {/* ── Finances & Invoices ─────────────────────────────────────── */}
 {perms?.payments && (
 <div className="rounded-[2.5rem] glass-card relative overflow-hidden flex flex-col h-full">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] ">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">{t('parentPortal.finances')}</h2>
 </div>

 <div className="relative z-10 w-full flex flex-col flex-1 p-4">
 {invoicesQuery.isLoading ? (
 <div className="h-64 flex items-center justify-center"><GlassPageLoader /></div>
 ) : invoicesData ? (
 <>
 {/* Financial KPI Cards */}
 <div className="grid grid-cols-2 gap-3 mb-6">
 <StatCard label={t('parentPortal.outstanding')}value={formatCurrency(invoicesData.outstanding ?? 0)} colorClass="bg-amber-500"/>
 <StatCard label={t('parentPortal.overdue')}value={formatCurrency(invoicesData.overdue ?? 0)} colorClass="bg-rose-500"/>
 </div>

 <div className="space-y-6">
 {/* Invoices */}
 {invoicesData.invoices.length > 0 && (
 <div>
 <h3 className="text-[0.75rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 ml-2">{t('parentPortal.invoices')}</h3>
 <ul className="divide-y divide-gray-100 dark:divide-white/5 bg-[var(--bg-card)] rounded-[1.5rem] border border-[var(--border-subtle)]">
 {invoicesData.invoices.map((inv: ParentInvoice, idx: number) => (
 <li key={inv.id ?? idx} className="flex items-center justify-between p-4 hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)] transition-colors first:rounded-t-[1.5rem] last:rounded-b-[1.5rem]">
 <div className="min-w-0">
 <p className="text-[0.95rem] font-bold text-[var(--text-primary)] truncate">{inv.number || t('parentPortal.invoiceFallback')}</p>
 <p className="text-[0.8rem] font-medium text-[var(--text-muted)] mt-0.5">
 {inv.dueDate ? t('parentPortal.dueDate', { date: formatDate(inv.dueDate) }) : formatDate(inv.createdAt)}
 </p>
 </div>
 <div className="flex flex-col items-end gap-1.5 shrink-0">
 <span className="text-[1rem] font-black text-[var(--text-primary)]">{formatCurrency(inv.total)}</span>
 <span className={`px-2 py-0.5 rounded-md text-[0.6rem] font-black uppercase tracking-wider ${
 inv.status ==='PAID' ?'bg-emerald-500/10 text-emerald-600' :
 inv.status ==='OVERDUE' ?'bg-rose-500/10 text-rose-600' :
 inv.status ==='PARTIALLY_PAID' ?'bg-amber-500/10 text-amber-600' :
 'bg-[var(--state-hover)] text-[var(--text-secondary)]'
 }`}>
 {inv.status && INVOICE_STATUS_LABEL_KEYS[inv.status] ? t(INVOICE_STATUS_LABEL_KEYS[inv.status]) : inv.status}
 </span>
 </div>
 </li>
 ))}
 </ul>
 </div>
 )}

 {/* Recent Payments */}
 {(invoicesData.payments ?? []).length > 0 && (
 <div>
 <h3 className="text-[0.75rem] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3 ml-2">{t('parentPortal.recentPayments')}</h3>
 <ul className="divide-y divide-gray-100 dark:divide-white/5 bg-[var(--bg-card)] rounded-[1.5rem] border border-[var(--border-subtle)]">
 {(invoicesData.payments ?? []).slice(0, 10).map((pay: ParentPayment, idx: number) => (
 <li key={pay.id ?? idx} className="flex items-center justify-between p-4 hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)] transition-colors first:rounded-t-[1.5rem] last:rounded-b-[1.5rem]">
 <div className="min-w-0">
 <p className="text-[0.95rem] font-bold text-[var(--text-primary)] truncate">
 {pay.reference ? t('parentPortal.paymentWithRef', { ref: pay.reference }) : t('parentPortal.payment')}
 </p>
 <p className="text-[0.8rem] font-medium text-[var(--text-muted)] mt-0.5">
 {pay.method ||'—'} · {formatDate(pay.paidAt || pay.createdAt)}
 </p>
 </div>
 <div className="flex items-center gap-3 shrink-0">
 <span className="text-[1rem] font-black text-emerald-600 ">{formatCurrency(pay.amount)}</span>
 </div>
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 </>
 ) : (
 <div className="flex-1 flex items-center justify-center p-10"><p className="text-[0.9rem] font-medium text-[var(--text-muted)]">{t('parentPortal.noFinances')}</p></div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}

export default ParentPortalPage;