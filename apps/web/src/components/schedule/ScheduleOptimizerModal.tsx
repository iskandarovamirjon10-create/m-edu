/**
 * M-EDU Enterprise — AI Timetable Optimizer & Deep Conflict Resolver (`ScheduleOptimizerModal.tsx`)
 * Matrix collision scanner detecting teacher overlaps, double room bookings, student collisions,
 * and capacity overflows with 1-click AI relocation solver.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassModal,
  GlassButton,
  GlassBadge,
  useToast,
} from '@/components/ui';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { scheduleOptimizerApi } from '@/lib/api';
import { useSafeI18n } from '@/i18n/I18nProvider';

interface ScheduleOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string;
}

export const ScheduleOptimizerModal: React.FC<ScheduleOptimizerModalProps> = ({
  isOpen,
  onClose,
  branchId,
}) => {
  const { t } = useSafeI18n();
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [activeSuggestions, setActiveSuggestions] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { playSuccess, playPop, playError } = usePremiumSound();
  const toast = useToast();

  const dayParam = selectedDay === 'ALL' ? undefined : selectedDay;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['schedule-conflicts', branchId, dayParam],
    queryFn: () => scheduleOptimizerApi.auditConflicts({ branchId, dayOfWeek: dayParam }),
    enabled: isOpen,
    staleTime: 15_000,
  });

  const suggestMutation = useMutation({
    mutationFn: (scheduleId: string) => scheduleOptimizerApi.suggestResolution({ scheduleId }),
    onSuccess: (res: any) => {
      playSuccess();
      setActiveSuggestions(res);
      toast.success(t('scheduleOptimizer.solveSuccess', "AI algoritmi to'qnashuvsiz optimal slotlarni hisoblab chiqdi!"));
    },
    onError: (err: any) => {
      playError();
      toast.error(err?.message || "Slotlarni hisoblashda xatolik yuz berdi");
    },
  });

  const applyMutation = useMutation({
    mutationFn: (variables: {
      scheduleId: string;
      targetRoom: string;
      targetDayOfWeek: string;
      targetStartTime: string;
      targetEndTime: string;
    }) => scheduleOptimizerApi.applyResolution(variables),
    onSuccess: () => {
      playSuccess();
      toast.success("Dars jadvali yangi slotga muvaffaqiyatli ko'chirildi va ziddiyat bartaraf etildi!");
      setActiveSuggestions(null);
      setSelectedScheduleId(null);
      queryClient.invalidateQueries({ queryKey: ['schedule-conflicts'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (err: any) => {
      playError();
      toast.error(err?.message || "Ziddiyatni hal qilishda xatolik yuz berdi");
    },
  });

  const handleSuggest = (scheduleId: string) => {
    playPop();
    setSelectedScheduleId(scheduleId);
    suggestMutation.mutate(scheduleId);
  };

  const handleApplySuggestion = (candidate: any) => {
    if (!selectedScheduleId) return;
    playPop();
    applyMutation.mutate({
      scheduleId: selectedScheduleId,
      targetRoom: candidate.room,
      targetDayOfWeek: candidate.dayOfWeek,
      targetStartTime: candidate.startTime,
      targetEndTime: candidate.endTime,
    });
  };

  const getConflictBadge = (type: string) => {
    switch (type) {
      case 'TEACHER_COLLISION':
        return <GlassBadge variant="danger" size="sm">{t('scheduleOptimizer.teacherCollisions', "O'QITUVCHI BANDLIGI")}</GlassBadge>;
      case 'ROOM_COLLISION':
        return <GlassBadge variant="danger" size="sm">{t('scheduleOptimizer.roomCollisions', "XONA TO'QNASHOVI")}</GlassBadge>;
      case 'CAPACITY_OVERFLOW':
        return <GlassBadge variant="warning" size="sm">XONA SIG'IMI YETARSIZ</GlassBadge>;
      case 'STUDENT_COLLISION':
        return <GlassBadge variant="amber" size="sm">{t('scheduleOptimizer.studentCollisions', "TALABA DUBLLIK DARS")}</GlassBadge>;
      default:
        return <GlassBadge variant="neutral" size="sm">{type}</GlassBadge>;
    }
  };

  const conflicts = data?.conflicts || [];
  const scannedCount = data?.scannedSchedulesCount || 0;

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      size="xl"
      className="max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <MeduAiLogo size="md" glow />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {t('scheduleOptimizer.title', 'AI Jadval Optimizatori & Ziddiyatlar Audit Engine')}
                </h2>
                <GlassBadge variant="primary" size="sm">AI SOLVER</GlassBadge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('scheduleOptimizer.subtitle', "Dars to'qnashuvlari, o'qituvchi va xonalar bandligini matritsa orqali skanerlash va 1-klikda qayta taqsimlash")}
              </p>
            </div>
          </div>
        </div>

        {/* Audit Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-3.5">
            <span className="text-xs text-muted-foreground font-medium">Skanerlangan Darslar</span>
            <div className="text-lg font-bold text-foreground mt-1">
              {scannedCount} ta
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Barcha dars jadvallari</div>
          </div>

          <div className={`rounded-xl border backdrop-blur-md p-3.5 ${
            conflicts.length > 0 ? 'border-rose-500/30 bg-rose-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
          }`}>
            <span className="text-xs font-medium text-muted-foreground">{t('scheduleOptimizer.totalConflicts', 'Aniqlangan Ziddiyatlar')}</span>
            <div className={`text-lg font-bold mt-1 ${conflicts.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {conflicts.length} ta
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {conflicts.length > 0 ? 'Darhol yechim talab etiladi' : t('scheduleOptimizer.noConflicts', "To'qnashuvlar topilmadi")}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-3.5">
            <span className="text-xs text-muted-foreground font-medium">{t('scheduleOptimizer.teacherCollisions', "O'qituvchi To'qnashuvi")}</span>
            <div className="text-lg font-bold text-amber-500 mt-1">
              {conflicts.filter((c: any) => c.type === 'TEACHER_COLLISION').length} ta
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Bir vaqtda 2 dars</div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-3.5">
            <span className="text-xs text-muted-foreground font-medium">{t('scheduleOptimizer.roomCollisions', 'Xona Bandligi')}</span>
            <div className="text-lg font-bold text-rose-500 mt-1">
              {conflicts.filter((c: any) => c.type === 'ROOM_COLLISION').length} ta
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Ayni xonada 2 guruh</div>
          </div>
        </div>

        {/* Day Filter */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/30 pb-3">
          {['ALL', 'DUSHANBA', 'SESHANBA', 'CHORSHANBA', 'PAYSHANBA', 'JUMA', 'SHANBA', 'YAKSHANBA'].map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => {
                playPop();
                setSelectedDay(day);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedDay === day
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              {day === 'ALL' ? 'Barcha kunlar' : day}
            </button>
          ))}

          <div className="ml-auto">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                playPop();
                refetch();
              }}
            >
              🔍 Qayta Skanerlash
            </GlassButton>
          </div>
        </div>

        {/* Conflicts List */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-2" />
            <p>Jadval to'qnashuvlari tahlil qilinmoqda...</p>
          </div>
        ) : conflicts.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-border/60 bg-muted/10 p-6">
            <div className="text-3xl mb-2">✨</div>
            <h3 className="text-sm font-semibold text-foreground">Dars jadvalida hech qanday ziddiyat yo'q!</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Barcha o'qituvchilar, xonalar va talabalar vaqtlari to'liq muvozanatlashtirilgan.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {conflicts.map((conflict: any) => (
              <motion.div
                key={conflict.conflictId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/50 bg-card/50 hover:bg-card/75 transition-colors p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {conflict.groupName}
                    </span>
                    {getConflictBadge(conflict.type)}
                    <span className="text-xs text-muted-foreground">
                      📅 {conflict.dayOfWeek} · ⏰ {conflict.timeRange}
                    </span>
                  </div>

                  <p className="text-xs text-rose-400 font-medium">
                    ⚠️ {conflict.description}
                  </p>

                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span>O'qituvchi: <strong className="text-foreground">{conflict.teacherName}</strong></span>
                    <span>Xona: <strong className="text-foreground">{conflict.roomName}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <GlassButton
                    variant="primary"
                    size="sm"
                    loading={suggestMutation.isPending && selectedScheduleId === conflict.scheduleId}
                    onClick={() => handleSuggest(conflict.scheduleId)}
                  >
                    💡 AI Yechim Topish
                  </GlassButton>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* AI Suggested Resolution View */}
        <AnimatePresence>
          {activeSuggestions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    🎯 AI Tomonidan Taklif Qilingan Optimal Slotlar ({activeSuggestions.targetGroup?.name})
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hozirgi holat: {activeSuggestions.currentSchedule?.dayOfWeek} {activeSuggestions.currentSchedule?.startTime}-{activeSuggestions.currentSchedule?.endTime} ({activeSuggestions.currentSchedule?.room})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSuggestions(null)}
                  className="text-xs text-muted-foreground hover:text-foreground p-1"
                >
                  ✕
                </button>
              </div>

              {activeSuggestions.suggestions?.length === 0 ? (
                <div className="text-xs text-amber-400 py-3">
                  Afsuski, filiallaringizdagi xona va vaqtlar tig'izligi sababli to'g'ridan-to'g'ri bo'sh slot topilmadi. Qo'shimcha xona ochishni tavsiya qilamiz.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">
                    To'qnashuvsiz Topilgan Variantlar (Eng mosidan boshlab):
                  </div>
                  {activeSuggestions.suggestions.map((cand: any, idx: number) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-border/50 bg-background/50 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="text-xs space-y-0.5">
                        <div className="font-semibold text-foreground">
                          📅 {cand.dayOfWeek} · ⏰ {cand.startTime} - {cand.endTime} · 🚪 {cand.room}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          Moslik Ball: <span className="text-emerald-400 font-bold">{cand.score}/100</span> · {cand.reason}
                        </div>
                      </div>

                      <GlassButton
                        variant="primary"
                        size="sm"
                        loading={applyMutation.isPending}
                        onClick={() => handleApplySuggestion(cand)}
                      >
                        ✅ Ko'chirish (Avto-Hal)
                      </GlassButton>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassModal>
  );
};
