/**
 * M-EDU V2 — 6-Dimensional Academic & Competency Radar (`StudentAcademicRadar.tsx`)
 * Visualizes longitudinal competency: Theory, Practical, Attendance, Homework, Engagement, Teamwork.
 * Interactive SVG polar geometry with cohort benchmarking and personalized growth insights.
 */

import { useState, useMemo, memo } from 'react';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { cn } from '@/lib/design';

export interface CompetencyDimension {
  key: string;
  label: string;
  score: number; // 0 - 100
  cohortAverage: number; // 0 - 100
  icon: string;
  insight: string;
}

interface StudentAcademicRadarProps {
  studentName?: string;
  dimensions?: CompetencyDimension[];
}

export const StudentAcademicRadar = memo(function StudentAcademicRadar({
  studentName = "Talaba",
  dimensions: propDimensions,
}: StudentAcademicRadarProps) {
  const { playTick } = usePremiumSound();

  const [showCohortOverlay, setShowCohortOverlay] = useState(true);
  const [activeDimension, setActiveDimension] = useState<CompetencyDimension | null>(null);

  const dimensions = useMemo<CompetencyDimension[]>(() => {
    if (propDimensions && propDimensions.length === 6) return propDimensions;

    return [
      {
        key: 'theory',
        label: 'Nazariy Bilim',
        score: 92,
        cohortAverage: 78,
        icon: '📖',
        insight: "Olimpiada darajasidagi chuqur konseptual tushunchaga ega",
      },
      {
        key: 'practical',
        label: 'Amaliy Loyihalar',
        score: 88,
        cohortAverage: 72,
        icon: '💻',
        insight: "Haqiqiy loyihalarni mustaqil ishlab chiqa oladi",
      },
      {
        key: 'attendance',
        label: 'Davomat & Intizom',
        score: 98,
        cohortAverage: 86,
        icon: '⏰',
        insight: "Dars qoldirish xatari minimal, namunali intizom",
      },
      {
        key: 'homework',
        label: 'Uyga Vazifa',
        score: 85,
        cohortAverage: 80,
        icon: '📝',
        insight: "Topshiriqlar o'z vaqtida va sifatli topshiriladi",
      },
      {
        key: 'engagement',
        label: 'Darsdagi Faollik',
        score: 94,
        cohortAverage: 75,
        icon: '🔥',
        insight: "Munozaralarda faol yetakchi va savol beruvchi",
      },
      {
        key: 'teamwork',
        label: 'Jamoaviy Ish',
        score: 82,
        cohortAverage: 74,
        icon: '🤝',
        insight: "Guruh bilan muloqot qiladi, taqdimotlarda ishonchli",
      },
    ];
  }, [propDimensions]);

  // Overall Index
  const overallScore = useMemo(() => {
    const sum = dimensions.reduce((acc, d) => acc + d.score, 0);
    return Math.round(sum / dimensions.length);
  }, [dimensions]);

  // Geometry calculations for 6-axis radar (Center 150, 150, Radius 105)
  const CX = 150;
  const CY = 150;
  const R = 105;
  const numAxes = dimensions.length;

  const getCoordinates = (value: number, axisIndex: number) => {
    const angle = (Math.PI * 2 / numAxes) * axisIndex - Math.PI / 2;
    const distance = (value / 100) * R;
    const x = CX + distance * Math.cos(angle);
    const y = CY + distance * Math.sin(angle);
    return { x, y };
  };

  // Student polygon points
  const studentPoints = dimensions
    .map((d, i) => {
      const { x, y } = getCoordinates(d.score, i);
      return `${x},${y}`;
    })
    .join(' ');

  // Cohort average polygon points
  const cohortPoints = dimensions
    .map((d, i) => {
      const { x, y } = getCoordinates(d.cohortAverage, i);
      return `${x},${y}`;
    })
    .join(' ');

  // Grid levels (25%, 50%, 75%, 100%)
  const gridLevels = [25, 50, 75, 100];

  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-2xl backdrop-blur-3xl dark:border-white/15 dark:bg-[#18181b]/90 text-[var(--text-primary,#1d1d1f)] dark:text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-300 text-lg">
            🕸️
          </span>
          <div>
            <h4 className="text-sm font-bold tracking-tight">
              6-O'lchamli Akademik Kompetensiya Radari
            </h4>
            <p className="text-[11px] text-[var(--text-secondary,#86868b)]">
              {studentName}ning ko'p qirrali qobiliyatlari va guruh benchmarki
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              playTick();
              setShowCohortOverlay((prev) => !prev);
            }}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all',
              showCohortOverlay
                ? 'border-brand-500/30 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                : 'border-black/10 dark:border-white/15 text-[var(--text-secondary)]',
            )}
          >
            📊 Guruh Benchmarki ({showCohortOverlay ? 'Yoqiq' : 'O\'chiq'})
          </button>

          <div className="rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 px-3 py-1 text-xs font-extrabold">
            GPA: {overallScore}%
          </div>
        </div>
      </div>

      {/* Interactive SVG Radar Stage */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6">
        <div className="relative shrink-0">
          <svg width="300" height="300" viewBox="0 0 300 300" className="overflow-visible select-none">
            {/* Background concentric rings */}
            {gridLevels.map((lvl) => {
              const points = Array.from({ length: numAxes })
                .map((_, i) => {
                  const { x, y } = getCoordinates(lvl, i);
                  return `${x},${y}`;
                })
                .join(' ');
              return (
                <polygon
                  key={lvl}
                  points={points}
                  fill="none"
                  stroke="currentColor"
                  className="text-black/[0.08] dark:text-white/[0.08]"
                  strokeWidth="1"
                  strokeDasharray={lvl < 100 ? '2,2' : undefined}
                />
              );
            })}

            {/* Radial spoke lines */}
            {dimensions.map((_, i) => {
              const { x, y } = getCoordinates(100, i);
              return (
                <line
                  key={i}
                  x1={CX}
                  y1={CY}
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  className="text-black/[0.08] dark:text-white/[0.08]"
                  strokeWidth="1"
                />
              );
            })}

            {/* Cohort benchmark polygon */}
            {showCohortOverlay && (
              <polygon
                points={cohortPoints}
                fill="rgba(156, 163, 175, 0.2)"
                stroke="rgba(156, 163, 175, 0.6)"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
            )}

            {/* Student performance polygon */}
            <polygon
              points={studentPoints}
              fill="rgba(14, 165, 233, 0.25)"
              stroke="#0284c7"
              strokeWidth="2.5"
              className="drop-shadow-[0_4px_12px_rgba(14,165,233,0.3)] transition-all"
            />

            {/* Axis dots and interactive points */}
            {dimensions.map((dim, i) => {
              const { x, y } = getCoordinates(dim.score, i);
              const labelPos = getCoordinates(124, i);
              const isSelected = activeDimension?.key === dim.key;

              return (
                <g key={dim.key}>
                  {/* Axis Label */}
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 4}
                    textAnchor="middle"
                    className={cn(
                      'text-[10px] font-bold cursor-pointer transition-colors',
                      isSelected ? 'fill-sky-500 font-extrabold' : 'fill-[var(--text-secondary,#86868b)]',
                    )}
                    onClick={() => { playTick(); setActiveDimension(dim); }}
                  >
                    {dim.icon} {dim.label}
                  </text>

                  {/* Student score dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 6 : 4.5}
                    className="fill-sky-500 stroke-white dark:stroke-black stroke-2 cursor-pointer transition-all hover:scale-125"
                    onClick={() => { playTick(); setActiveDimension(dim); }}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Dimension Inspection Panel */}
        <div className="flex-1 w-full max-w-sm space-y-2.5">
          <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] p-4">
            {activeDimension ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                    {activeDimension.icon} {activeDimension.label}
                  </span>
                  <span className="text-base font-extrabold text-[var(--text-primary)] dark:text-white">
                    {activeDimension.score}%
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {activeDimension.insight}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-tertiary)] border-t border-black/[0.05] dark:border-white/[0.06] pt-2">
                  <span>Guruh o'rtachasi: {activeDimension.cohortAverage}%</span>
                  <span className="text-emerald-500 font-bold">
                    +{activeDimension.score - activeDimension.cohortAverage}% ustun
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-[var(--text-secondary)]">
                <span className="text-xl block mb-1">💡</span>
                Tafsilotlarni ko'rish uchun diagrammadagi nuqtalardan birini bosing
              </div>
            )}
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.03] p-2.5 border border-black/[0.04] dark:border-white/[0.06]">
              <span className="text-[10px] text-[var(--text-secondary)] block">Eng kuchli tomoni</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">⏰ Davomat (98%)</span>
            </div>
            <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.03] p-2.5 border border-black/[0.04] dark:border-white/[0.06]">
              <span className="text-[10px] text-[var(--text-secondary)] block">Rivojlanish nuqtasi</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">🤝 Jamoaviy ish (82%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
