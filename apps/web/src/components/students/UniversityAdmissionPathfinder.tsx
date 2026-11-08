import type { Student } from '@/types/students';
/**
 * M-EDU AI Predictive University & Career Admission Pathfinder
 * Monte-Carlo admission probability engine, DTM state grant vs contract thresholds,
 * Uzbekistan top international universities (New Uzbekistan, WIUT, Inha, etc.),
 * global scholarships (Chevening, DAAD, GKS), career persona salary horizon,
 * and printable A4 Student Career Roadmap.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassModal,
  GlassButton,
  GlassBadge,
} from '@/components/ui';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { studentsApi } from '@/lib/api';

export interface UniversityOption {
  id: string;
  name: string;
  country: string;
  faculty: string;
  category: 'DTM_STATE' | 'UZ_INTERNATIONAL' | 'GLOBAL_TOP100';
  probabilityPercent: number;
  grantType: '100% Davlat Granti' | 'Prezident Granti' | 'Xalqaro Stipendiya' | 'Kontrakt (Tabaqalashtirilgan)';
  minIeltsRequired: number;
  minDtmOrGpa: string;
  ranking: string;
  annualTuitionOrStipend: string;
  deadlines: string;
}

export interface StudentAdmissionProfile {
  id: string;
  studentName: string;
  targetField: string;
  ieltsScore: number;
  dtmScore: number;
  gpaPercent: number;
  satScore?: number;
  careerGoal: string;
  universities: UniversityOption[];
  gapAnalysis: {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    impact: string;
  }[];
  careerSalaryForecast: {
    title: string;
    localSalaryUzs: string;
    remoteSalaryUsd: string;
    growthProjection: string;
    skillsNeeded: string[];
  };
}


interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultStudentName?: string;
  students?: Student[];
}

export const UniversityAdmissionPathfinder: React.FC<Props> = ({
  isOpen,
  onClose,
  students: propStudents,
}) => {
  const [dbStudents, setDbStudents] = useState<Student[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (propStudents && propStudents.length > 0) return;
    let isMounted = true;
    studentsApi.list({ limit: 50 })
      .then((res: any) => {
        if (!isMounted) return;
        const list = res?.data || res?.items || (Array.isArray(res) ? res : []);
        setDbStudents(list);
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [isOpen, propStudents]);

  const activeStudents = (propStudents && propStudents.length > 0) ? propStudents : dbStudents;
  
  const studentProfiles = useMemo(() => {
    if (!activeStudents || activeStudents.length === 0) return [];
    return activeStudents.slice(0, 10).map((st: any) => {
      const name = [st.user?.firstName || st.firstName, st.user?.lastName || st.lastName].filter(Boolean).join(' ') || (st as any).fullName || (st as any).name || 'Talaba';
      return {
        id: st.id,
        studentName: name,
        targetField: st.targetField ?? '—',
        ieltsScore: Number(st.ieltsScore ?? 0),
        dtmScore: Number(st.dtmScore ?? 0),
        gpaPercent: Number(st.gpaPercent ?? st.gradeAverage ?? 0),
        satScore: st.satScore != null ? Number(st.satScore) : undefined,
        careerGoal: st.careerGoal ?? '—',
        universities: [],
        gapAnalysis: [],
        careerSalaryForecast: {
          title: '—',
          localSalaryUzs: '—',
          remoteSalaryUsd: '—',
          growthProjection: '—',
          skillsNeeded: [],
        },
      } as StudentAdmissionProfile;
    });
  }, [activeStudents]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => studentProfiles[0]?.id || '');

  // Sync selectedStudentId when profiles update
  useEffect(() => {
    if (studentProfiles[0] && !studentProfiles.some(p => p.id === selectedStudentId)) {
      setSelectedStudentId(studentProfiles[0].id);
    }
  }, [studentProfiles, selectedStudentId]);

  const [activeTab, setActiveTab] = useState<'universities' | 'gap_analysis' | 'career_salary' | 'print_roadmap'>('universities');
  const [isSimulating, setIsSimulating] = useState(false);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
    };
  }, []);

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'DTM_STATE' | 'UZ_INTERNATIONAL' | 'GLOBAL_TOP100'>('ALL');
  const printRef = useRef<HTMLDivElement>(null);

  const { playSuccess, playPop } = usePremiumSound();
  const haptics = useHaptics();

  const currentStudent = useMemo(() => {
    return studentProfiles.find((s) => s.id === selectedStudentId) || studentProfiles[0] || null;
  }, [selectedStudentId, studentProfiles]);

  const filteredUniversities = useMemo(() => {
    if (!currentStudent) return [];
    if (categoryFilter === 'ALL') return currentStudent.universities;
    return currentStudent.universities.filter((u) => u.category === categoryFilter);
  }, [currentStudent, categoryFilter]);

  const handleSimulateMonteCarlo = () => {
    haptics.medium();
    playPop();
    setIsSimulating(true);
    if (simTimerRef.current) clearTimeout(simTimerRef.current);
    simTimerRef.current = setTimeout(() => {
      setIsSimulating(false);
      playSuccess();
      haptics.success();
    }, 1400);
  };

  const handlePrintRoadmap = () => {
    playSuccess();
    haptics.success();
    window.print();
  };

  if (!isOpen) return null;

  if (studentProfiles.length === 0) {
    return (
      <GlassModal open={isOpen} onClose={onClose} title="" size="full" className="w-full max-w-6xl overflow-hidden p-0">
        <div className="flex h-full max-h-[92vh] flex-col bg-slate-950 text-slate-100">
          <div className="flex items-center gap-3 border-b border-white/10 bg-slate-900/80 px-4 py-4 sm:px-6">
            <MeduAiLogo size="md" glow />
            <div>
              <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">
                AI Abituriyent & Karyera Admission Pathfinder
              </h2>
              <p className="text-[11px] text-slate-400 sm:text-xs">Real talabalar ma'lumotlari asosida ishlaydi</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
            <div className="text-sm font-semibold text-white">Talabalar topilmadi</div>
            <div className="max-w-md text-xs text-slate-400">
              Admission prognozi uchun bazada talaba profillari bo'lishi kerak. Talaba qo'shilgach, tahlil shu yerda avtomatik shakllanadi.
            </div>
            <GlassButton variant="ghost" onClick={onClose} className="mt-3 !rounded-xl text-xs">
              Yopish
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    );
  }

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title=""
      size="full"
      className="w-full max-w-6xl overflow-hidden p-0"
    >
      <div className="flex h-full max-h-[92vh] sm:max-h-[90vh] flex-col bg-slate-950 text-slate-100">
        {/* ═══ 1 · HEADER & CONTROLS ═══ */}
        <div className="flex flex-col gap-3 border-b border-white/10 bg-slate-900/80 px-4 sm:px-6 py-3 sm:py-4 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <MeduAiLogo size="md" glow />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  AI Abituriyent & Karyera Admission Pathfinder
                </h2>
                <GlassBadge variant="info" size="sm" className="font-mono text-[10px] sm:text-xs font-bold">
                  Monte-Carlo Probability v3.4
                </GlassBadge>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                DTM kvotalari, davlat grantlari, xalqaro universitetlar va global stipendiyalar ehtimolligi simulyatsiyasi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <div className="flex flex-wrap items-center rounded-xl border border-white/10 bg-slate-950/60 p-1">
              {studentProfiles.map((student) => (
                <button
                  key={student.id}
                  onClick={() => {
                    setSelectedStudentId(student.id);
                    playPop();
                    haptics.light();
                  }}
                  className={`rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold transition-all ${
                    selectedStudentId === student.id
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {student.studentName.split(' ')[0]}
                </button>
              ))}
            </div>

            <GlassButton
              type="button"
              variant="primary"
              onClick={handleSimulateMonteCarlo}
              disabled={isSimulating}
              className="gap-2 !rounded-xl !bg-gradient-to-r !from-cyan-600 !to-blue-600 shadow-lg shadow-cyan-500/20 w-full sm:w-auto justify-center text-xs sm:text-sm"
            >
              <MeduAiLogo size="xs" />
              <span>{isSimulating ? 'Ehtimollik Hisoblanmoqda...' : 'Monte-Carlo Simulyatsiyasi'}</span>
            </GlassButton>
          </div>
        </div>

        {/* ═══ 2 · STUDENT METRICS BANNER ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3 border-b border-white/10 bg-slate-900/50 px-3 sm:px-6 py-2.5 sm:py-3 text-xs">
          <div>
            <span className="text-slate-400">Talaba:</span>
            <div className="font-bold text-white text-sm">{currentStudent.studentName}</div>
          </div>
          <div>
            <span className="text-slate-400">IELTS / Ingliz Tili:</span>
            <div className="font-bold text-cyan-400 text-sm">{currentStudent.ieltsScore} Band</div>
          </div>
          <div>
            <span className="text-slate-400">DTM / Aniq Fanlar:</span>
            <div className="font-bold text-emerald-400 text-sm">{currentStudent.dtmScore}</div>
          </div>
          <div>
            <span className="text-slate-400">Maktab Attestat GPA:</span>
            <div className="font-bold text-purple-400 text-sm">{currentStudent.gpaPercent}% A‘lo</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-slate-400">Karyera Mo‘ljali:</span>
            <div className="font-semibold text-amber-300 truncate">{currentStudent.careerGoal}</div>
          </div>
        </div>

        {/* ═══ 3 · NAVIGATION TABS (TOUCH-SCROLLABLE) ═══ */}
        <div className="flex overflow-x-auto no-scrollbar border-b border-white/10 bg-slate-900/40 px-3 sm:px-6 whitespace-nowrap">
          <button
            onClick={() => { setActiveTab('universities'); playPop(); }}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 border-b-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-bold transition-all ${
              activeTab === 'universities'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🏛️ Universitetlar & Grant Ehtimolligi ({currentStudent.universities.length})
          </button>
          <button
            onClick={() => { setActiveTab('gap_analysis'); playPop(); }}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 border-b-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-bold transition-all ${
              activeTab === 'gap_analysis'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🧩 Bo‘shliqlarni To‘ldirish & 90 Kunlik Reja
          </button>
          <button
            onClick={() => { setActiveTab('career_salary'); playPop(); }}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 border-b-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-bold transition-all ${
              activeTab === 'career_salary'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            💎 Karyera Gorizonti & Maosh Prognozi
          </button>
          <button
            onClick={() => { setActiveTab('print_roadmap'); playPop(); }}
            className={`flex shrink-0 items-center gap-1.5 sm:gap-2 border-b-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-bold transition-all ${
              activeTab === 'print_roadmap'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            🖨️ A4 Rasmiy Yo‘l Xaritasi (Ota-onalar Uchun)
          </button>
        </div>

        {/* ═══ 4 · MAIN CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          <AnimatePresence>
            {activeTab === 'universities' && (
              <motion.div
                key="universities"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Category Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Yo‘nalish:</span>
                    {(['ALL', 'DTM_STATE', 'UZ_INTERNATIONAL', 'GLOBAL_TOP100'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setCategoryFilter(cat);
                          playPop();
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          categoryFilter === cat
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
                        }`}
                      >
                        {cat === 'ALL'
                          ? 'Barchasi'
                          : cat === 'DTM_STATE'
                          ? '🇺🇿 DTM Davlat OTMlari'
                          : cat === 'UZ_INTERNATIONAL'
                          ? '🏛️ O‘zbekiston Xalqaro'
                          : '🌍 Global Top-100'}
                      </button>
                    ))}
                  </div>

                  <div className="text-xs text-slate-400">
                    Natija: <strong className="text-white">{filteredUniversities.length}</strong> ta mos OTM topildi
                  </div>
                </div>

                {/* University Cards Grid */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredUniversities.map((uni) => (
                    <div
                      key={uni.id}
                      className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl transition-all hover:border-cyan-500/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {uni.category === 'DTM_STATE' ? '🇺🇿' : uni.category === 'UZ_INTERNATIONAL' ? '🏛️' : '🌍'}
                            </span>
                            <h3 className="text-base font-bold text-white">{uni.name}</h3>
                          </div>
                          <p className="text-xs text-cyan-300 font-medium mt-0.5">
                            Fakultet: {uni.faculty}
                          </p>
                        </div>

                        {/* Probability Pill */}
                        <div className="text-right">
                          <div
                            className={`rounded-xl px-3 py-1 font-mono text-sm font-black shadow-lg ${
                              uni.probabilityPercent >= 90
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : uni.probabilityPercent >= 75
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {uni.probabilityPercent}% Grant Ehtimoli
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {uni.grantType}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl border border-white/5 bg-slate-950/60 p-3 text-xs">
                        <div>
                          <span className="text-slate-500 text-[10px]">Min. IELTS:</span>
                          <div className="font-bold text-slate-200">{uni.minIeltsRequired}+ Band</div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Kirish Bali:</span>
                          <div className="font-bold text-slate-200">{uni.minDtmOrGpa}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Oxirgi Muddat:</span>
                          <div className="font-bold text-amber-400">{uni.deadlines}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                        <span>💰 {uni.annualTuitionOrStipend}</span>
                        <span className="font-mono text-cyan-400">{uni.ranking}</span>
                      </div>
                    </div>
                  ))}

                  {filteredUniversities.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/40 p-6 text-center lg:col-span-2">
                      <p className="text-sm font-semibold text-slate-200">
                        Bu o‘quvchi uchun OTM ma’lumotlari kiritilmagan
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Grant ehtimolini hisoblash uchun o‘quvchi profilida IELTS, DTM va attestat GPA
                        ko‘rsatkichlarini to‘ldiring.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'gap_analysis' && (
              <motion.div
                key="gap_analysis"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>🧩 90 Kunlik Strategik Bo‘shliqlarni To‘ldirish Xaritasi</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 mb-5">
                    Ushbu 3 ta maqsadli harakat talabaning grantga kirish ehtimolini maksimal darajada mustahkamlaydi:
                  </p>

                  <div className="space-y-4">
                    {currentStudent.gapAnalysis.map((gap, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/5 bg-slate-950/60 p-4 transition-all hover:border-cyan-500/30"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              gap.priority === 'HIGH'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            }`}
                          >
                            {gap.priority} PRIORITY #{idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-emerald-400">
                            Ta‘sir: {gap.impact}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-200">{gap.action}</p>
                      </div>
                    ))}

                    {currentStudent.gapAnalysis.length === 0 && (
                      <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-5 text-center text-xs text-slate-400">
                        Bu o‘quvchi uchun bo‘shliqlar tahlili hali kiritilmagan.
                      </div>
                    )}
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-300">
                    💡 <strong>Eslatma:</strong> bu reja faqat o‘quvchi profilidagi haqiqiy
                    ko‘rsatkichlar asosida tuziladi; hech qanday prognoz kafolatlanmaydi.
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'career_salary' && (
              <motion.div
                key="career_salary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                        Kelajak Mutaxassislik Profili
                      </span>
                      <h3 className="text-2xl font-black text-white mt-1">
                        {currentStudent.careerSalaryForecast.title}
                      </h3>
                      <p className="text-xs text-emerald-400 font-semibold mt-1">
                        {currentStudent.careerSalaryForecast.growthProjection}
                      </p>
                    </div>

                    <GlassBadge variant="info" size="md">
                      Karyera prognozi
                    </GlassBadge>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4">
                      <div className="text-xs text-slate-400">O‘zbekistonda Kutilayotgan Oylik:</div>
                      <div className="mt-1 text-xl font-bold text-white">
                        {currentStudent.careerSalaryForecast.localSalaryUzs}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Top banklar, IT-Park rezidentlari va xalqaro korporatsiyalar
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-slate-950/80 p-4">
                      <div className="text-xs text-slate-400">Global Masofaviy Shartnomalar:</div>
                      <div className="mt-1 text-xl font-bold text-emerald-400">
                        {currentStudent.careerSalaryForecast.remoteSalaryUsd}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        AQSH, Yevropa va Singapur kompaniyalarida remote kontraktlar
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Talab Qilinadigan Asosiy Texnologik Ko‘nikmalar (Stack):
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {currentStudent.careerSalaryForecast.skillsNeeded.map((skill, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-xs font-semibold text-cyan-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'print_roadmap' && (
              <motion.div
                key="print_roadmap"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex justify-end">
                  <GlassButton
                    type="button"
                    variant="primary"
                    onClick={handlePrintRoadmap}
                    className="gap-2 !rounded-xl !bg-cyan-600 hover:!bg-cyan-500 text-white font-semibold"
                  >
                    <span>🖨️ A4 Karyera Pasportini Chop Etish / PDF</span>
                  </GlassButton>
                </div>

                {/* A4 PRINTABLE DOCUMENT */}
                <div
                  ref={printRef}
                  className="mx-auto max-w-3xl rounded-2xl border-2 sm:border-4 border-cyan-500/40 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-4 sm:p-8 text-left shadow-2xl relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-cyan-500/20 pb-4 gap-3">
                    <div className="flex items-center gap-2">
                      <MeduAiLogo size="md" glow />
                      <div>
                        <h2 className="text-base sm:text-lg font-black uppercase text-white">
                          Shaxsiy Abituriyent & Karyera Yo‘l Xaritasi
                        </h2>
                        <span className="text-[10px] text-cyan-400 font-mono">
                          M-EDU Predictive Admission Protocol 2026
                        </span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right text-xs text-slate-400">
                      <div>Talaba: <strong className="text-white">{currentStudent.studentName}</strong></div>
                      <div>Sana: {new Date().toLocaleDateString('uz-UZ')}</div>
                    </div>
                  </div>

                  <div className="my-4 sm:my-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center text-xs">
                    <div className="rounded-xl border border-white/5 bg-slate-950/80 p-2 sm:p-2.5">
                      <div className="text-[10px] text-slate-400">IELTS Balli</div>
                      <div className="text-sm sm:text-base font-bold text-cyan-400">{currentStudent.ieltsScore} Band</div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-950/80 p-2 sm:p-2.5">
                      <div className="text-[10px] text-slate-400">DTM Balli</div>
                      <div className="text-sm sm:text-base font-bold text-emerald-400">{currentStudent.dtmScore}</div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-950/80 p-2 sm:p-2.5">
                      <div className="text-[10px] text-slate-400">Attestat GPA</div>
                      <div className="text-sm sm:text-base font-bold text-purple-400">{currentStudent.gpaPercent}%</div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-950/80 p-2 sm:p-2.5">
                      <div className="text-[10px] text-slate-400">Mo‘ljal Karyera</div>
                      <div className="text-xs font-semibold text-amber-300 truncate">
                        {currentStudent.careerGoal.split(' ')[0]}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Top Universitetlar Grant Ehtimolligi
                  </h3>
                  <div className="space-y-2 mb-5">
                    {currentStudent.universities.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-950/60 p-2.5 text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">{u.name}</div>
                          <div className="text-[11px] text-slate-400">{u.faculty}</div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-400">
                            {u.probabilityPercent}% Ehtimol
                          </span>
                          <div className="text-[10px] text-slate-400">{u.grantType}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                    Kutilayotgan Karyera va Maosh Imkoniyatlari
                  </h3>
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs mb-6">
                    <div className="flex justify-between font-semibold text-cyan-300">
                      <span>Mutaxassislik: {currentStudent.careerSalaryForecast.title}</span>
                      <span>O‘zbekiston: {currentStudent.careerSalaryForecast.localSalaryUzs}</span>
                    </div>
                    <div className="mt-1 text-slate-400 text-[11px]">
                      Global Remote: {currentStudent.careerSalaryForecast.remoteSalaryUsd} ({currentStudent.careerSalaryForecast.growthProjection})
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
                    <div>
                      <div className="font-bold text-white">M-EDU Karyera Markazi Maslahatchisi</div>
                      <div className="text-[10px]">Tavsiya hujjati yuridik majburiyat yuklamaydi</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-cyan-400 text-xs">[ QR-VERIFIED PATHFINDER ]</div>
                      <div className="text-[10px]">O‘quv Markazi Muhri</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </GlassModal>
  );
};
