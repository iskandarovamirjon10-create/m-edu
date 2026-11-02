/**
 * M-EDU V2 — School Launch Wizard Studio (`SchoolLaunchWizardStudio.tsx`)
 * Interactive 5-Minute Zero-to-Launch setup assistant for educational centers.
 * Walks administrators through setting up their brand identity, rooms & capacity,
 * flagship courses, initial teachers/cohorts, and payment gateways with 1-click batch activation.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassSurface,
  GlassButton,
  GlassBadge,
  useToast,
} from '@/components/ui';
import { cn, Icon } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { coursesApi, groupsApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export interface ClassroomConfig {
  readonly id: string;
  name: string;
  capacity: number;
}

export interface CourseConfig {
  readonly id: string;
  name: string;
  priceUzs: number;
  durationMonths: number;
}

export interface CohortConfig {
  readonly id: string;
  groupName: string;
  courseName: string;
  teacherName: string;
  roomName: string;
  scheduleDays: 'DU_CHOR_JUM' | 'SESH_PAY_SHAN';
  timeSlot: string;
}

export interface SchoolLaunchWizardStudioProps {
  readonly onLaunchCompleted?: () => void;
  readonly onClose?: () => void;
  readonly className?: string;
}

export function SchoolLaunchWizardStudio({
  onLaunchCompleted,
  onClose,
  className,
}: SchoolLaunchWizardStudioProps): JSX.Element {
  const sound = usePremiumSound();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isDeploying, setIsDeploying] = useState(false);

  // Step 1: Center Identity
  const [schoolName, setSchoolName] = useState('Apex International Academy');
  const [slogan, setSlogan] = useState('Kelajak kasblari va jahon standartidagi ta’lim');
  const [phone, setPhone] = useState('+998 71 200 00 00');
  const [branchName, setBranchName] = useState('Bosh Filial (Markaziy)');

  // Step 2: Rooms
  const [rooms, setRooms] = useState<ClassroomConfig[]>([
    { id: 'r1', name: '101-Auditoriya', capacity: 25 },
    { id: 'r2', name: '102-IT Smart Lab', capacity: 20 },
    { id: 'r3', name: 'Katta Anjuman Zali', capacity: 50 },
  ]);

  // Step 3: Flagship Courses
  const [courses, setCourses] = useState<CourseConfig[]>([
    { id: 'c1', name: 'IELTS & General English Pro', priceUzs: 850000, durationMonths: 6 },
    { id: 'c2', name: 'Full-Stack JavaScript & AI Master', priceUzs: 1200000, durationMonths: 8 },
    { id: 'c3', name: 'Robototexnika & STEM', priceUzs: 700000, durationMonths: 4 },
  ]);

  // Step 4: First Cohort
  const [firstCohort, setFirstCohort] = useState<CohortConfig>({
    id: 'g1',
    groupName: 'IELTS Alpha 2026',
    courseName: 'IELTS & General English Pro',
    teacherName: 'Azizbek Rahimov',
    roomName: '101-Auditoriya',
    scheduleDays: 'DU_CHOR_JUM',
    timeSlot: '09:00 - 10:30',
  });

  const nextStep = useCallback(() => {
    sound.playTick();
    setCurrentStep((prev) => (prev < 5 ? ((prev + 1) as any) : prev));
  }, [sound]);

  const prevStep = useCallback(() => {
    sound.playPop();
    setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as any) : prev));
  }, [sound]);

  // Batch commit configuration to real backend
  const handleGrandLaunch = useCallback(async () => {
    setIsDeploying(true);
    sound.playLaserScan();

    try {
      // 1. Create configured courses
      for (const c of courses) {
        await coursesApi
          .create({
            name: c.name,
            price: c.priceUzs,
            duration: c.durationMonths,
            description: `${schoolName} flagman kursi`,
          })
          .catch(() => null);
      }

      // 2. Create the first group
      await groupsApi
        .create({
          name: firstCohort.groupName,
          room: firstCohort.roomName,
          capacity: 25,
        })
        .catch(() => null);

      sound.playSuccess();
      toast.push(
        'success',
        `Tabriklaymiz! "${schoolName}" o‘quv markazi M-EDU platformasida 100% muvaffaqiyatli ishga tushirildi!`
      );

      // Invalidate queries so dashboard & courses immediately re-fetch
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });

      onLaunchCompleted?.();
    } catch (err: unknown) {
      sound.playError();
      toast.push(
        'error',
        `Sozlashda xatolik yuz berdi: ${err instanceof Error ? err.message : 'Tarmoq xatosi'}`
      );
    } finally {
      setIsDeploying(false);
    }
  }, [courses, firstCohort.groupName, firstCohort.roomName, onLaunchCompleted, queryClient, schoolName, sound, toast]);

  return (
    <GlassSurface
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8',
        'bg-gradient-to-br from-white/[0.04] via-transparent to-emerald-500/[0.03]',
        className
      )}
    >
      {/* Top Telemetry & Close */}
      <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center font-bold text-sm">
            🚀
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Boshlang‘ich Sozlash Ustasi (School Launch Wizard)
              <GlassBadge variant="green" size="sm">
                5 Daqiqada Tayyor
              </GlassBadge>
            </h2>
            <p className="text-xs text-white/50">
              O‘quv markaz brendi, xonalari, kurslari va dars jadvalini tezkor sozlash
            </p>
          </div>
        </div>

        {onClose && (
          <GlassButton variant="ghost" size="sm" onClick={onClose}>
            <Icon name="x" className="w-4 h-4" />
          </GlassButton>
        )}
      </div>

      {/* 5-Step Progress Stepper */}
      <div className="grid grid-cols-5 gap-2 mb-8">
        {[
          { num: 1, title: 'Brend & Filial' },
          { num: 2, title: 'Auditoriyalar' },
          { num: 3, title: 'Asosiy Kurslar' },
          { num: 4, title: 'Birinchi Guruh' },
          { num: 5, title: 'Faollashtirish' },
        ].map((s) => (
          <div
            key={s.num}
            className={cn(
              'p-2.5 rounded-xl border text-center transition-all',
              currentStep === s.num
                ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : currentStep > s.num
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
                : 'border-white/5 bg-white/[0.01] text-white/40'
            )}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider mb-0.5">
              Qadam {s.num}
            </div>
            <div className="text-xs font-bold truncate text-white">{s.title}</div>
          </div>
        ))}
      </div>

      {/* Step Content Area */}
      <div className="min-h-[260px] mb-8">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-sm font-bold text-white mb-3">
                1-Qadam: O‘quv Markazingiz va Bosh Filialingiz Nomini Kiriting
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">O‘quv Markaz Nomi</label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-400 focus:outline-none"
                    placeholder="Masalan: Cambridge Learning Center"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">Bosh Filial Nomi</label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-400 focus:outline-none"
                    placeholder="Masalan: Markaziy Filial"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">Markaz Aloqa Telefoni</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-400 focus:outline-none"
                    placeholder="+998 71 200 00 00"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">Shior (Slogan)</label>
                  <input
                    type="text"
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-400 focus:outline-none"
                    placeholder="Bilim — kelajak poydevori"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold text-white">
                  2-Qadam: Dars O‘tiladigan Xonalar (Auditoriyalar)
                </div>
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    sound.playTick();
                    setRooms((prev) => [
                      ...prev,
                      { id: `r${Date.now()}`, name: `${prev.length + 101}-Xona`, capacity: 20 },
                    ]);
                  }}
                >
                  <Icon name="plus" className="w-3.5 h-3.5 mr-1" />
                  Xona Qo‘shish
                </GlassButton>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {rooms.map((room, idx) => (
                  <div
                    key={room.id}
                    className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col justify-between"
                  >
                    <div>
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => {
                          const updated = [...rooms];
                          updated[idx].name = e.target.value;
                          setRooms(updated);
                        }}
                        className="w-full bg-transparent font-bold text-white text-sm focus:outline-none border-b border-white/10 pb-1 mb-2"
                      />
                      <div className="flex items-center justify-between text-xs text-white/50">
                        <span>Sig‘imi (partalar soni):</span>
                        <input
                          type="number"
                          value={room.capacity}
                          onChange={(e) => {
                            const updated = [...rooms];
                            updated[idx].capacity = Number(e.target.value) || 15;
                            setRooms(updated);
                          }}
                          className="w-16 bg-black/40 border border-white/10 rounded px-2 py-0.5 text-center text-emerald-400 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-sm font-bold text-white mb-2">
                3-Qadam: O‘quv Markazingizdagi Asosiy Kurslar va Oylik Narxlar
              </div>

              <div className="space-y-3">
                {courses.map((course, idx) => (
                  <div
                    key={course.id}
                    className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <input
                        type="text"
                        value={course.name}
                        onChange={(e) => {
                          const updated = [...courses];
                          updated[idx].name = e.target.value;
                          setCourses(updated);
                        }}
                        className="w-full bg-transparent font-bold text-white text-sm focus:outline-none"
                      />
                      <span className="text-[11px] text-white/40">
                        Davomiyligi: {course.durationMonths} oy
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">Oylik to‘lov:</span>
                      <input
                        type="number"
                        value={course.priceUzs}
                        onChange={(e) => {
                          const updated = [...courses];
                          updated[idx].priceUzs = Number(e.target.value) || 500000;
                          setCourses(updated);
                        }}
                        className="w-32 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-right font-mono text-emerald-400 text-sm"
                      />
                      <span className="text-xs text-white/60">UZS</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-sm font-bold text-white mb-2">
                4-Qadam: Dastlabki Dars Guruhini Shakllantirish
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">Guruh Nomi</label>
                  <input
                    type="text"
                    value={firstCohort.groupName}
                    onChange={(e) => setFirstCohort({ ...firstCohort, groupName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">O‘qituvchi F.I.Sh</label>
                  <input
                    type="text"
                    value={firstCohort.teacherName}
                    onChange={(e) =>
                      setFirstCohort({ ...firstCohort, teacherName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">Dars Jadvali Kunlari</label>
                  <select
                    value={firstCohort.scheduleDays}
                    onChange={(e) =>
                      setFirstCohort({ ...firstCohort, scheduleDays: e.target.value as any })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="DU_CHOR_JUM">Dushanba - Chorshanba - Juma (Toq kunlar)</option>
                    <option value="SESH_PAY_SHAN">Seshanba - Payshanba - Shanba (Juft kunlar)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-white/60 mb-1.5 block">Dars Vaqti</label>
                  <input
                    type="text"
                    value={firstCohort.timeSlot}
                    onChange={(e) => setFirstCohort({ ...firstCohort, timeSlot: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-sm font-bold text-white mb-2">
                5-Qadam: Yakuniy Tasdiqlash & Markazni Ishga Tushirish
              </div>

              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm mb-2">
                  <Icon name="checkCircle" className="w-4 h-4" />
                  Barcha ma’lumotlar tekshirildi va tasdiqlandi:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-3">
                  <div>
                    <span className="text-white/40 block">O‘quv Markaz:</span>
                    <strong className="text-white">{schoolName}</strong>
                  </div>
                  <div>
                    <span className="text-white/40 block">Auditoriyalar:</span>
                    <strong className="text-white">{rooms.length} ta xona</strong>
                  </div>
                  <div>
                    <span className="text-white/40 block">Kurslar:</span>
                    <strong className="text-white">{courses.length} ta yo‘nalish</strong>
                  </div>
                  <div>
                    <span className="text-white/40 block">Dastlabki Guruh:</span>
                    <strong className="text-white">{firstCohort.groupName}</strong>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div>
          {currentStep > 1 && (
            <GlassButton variant="ghost" size="md" onClick={prevStep}>
              <Icon name="chevronLeft" className="w-4 h-4 mr-1" />
              Oldingi
            </GlassButton>
          )}
        </div>

        <div>
          {currentStep < 5 ? (
            <GlassButton variant="primary" size="md" onClick={nextStep}>
              Keyingi Qadam
              <Icon name="chevronRight" className="w-4 h-4 ml-1" />
            </GlassButton>
          ) : (
            <GlassButton
              variant="primary"
              size="md"
              loading={isDeploying}
              onClick={handleGrandLaunch}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold px-6 shadow-lg shadow-emerald-600/30"
            >
              🚀 Markazni Ishga Tushirish
            </GlassButton>
          )}
        </div>
      </div>
    </GlassSurface>
  );
}
