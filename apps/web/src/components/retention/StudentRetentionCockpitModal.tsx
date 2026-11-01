/**
 * M-EDU Enterprise — Student Churn Prediction & Retention Cockpit Modal (`StudentRetentionCockpitModal.tsx`)
 * Predictive AI Cockpit identifying students at risk of dropout before they leave.
 * Calculates attendance drops, overdue payment friction, exam grade dips, and provides 1-click playbooks.
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
import { retentionApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useSafeI18n } from '@/i18n/I18nProvider';

interface StudentRetentionCockpitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RiskTier = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const StudentRetentionCockpitModal: React.FC<StudentRetentionCockpitModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useSafeI18n();
  const [selectedTier, setSelectedTier] = useState<RiskTier>('ALL');
  const [activeInterventionStudent, setActiveInterventionStudent] = useState<any | null>(null);
  const [interventionType, setInterventionType] = useState<string>('DIRECTOR_CALL');
  const [interventionNote, setInterventionNote] = useState<string>('');
  const [followUpDays, setFollowUpDays] = useState<number>(3);

  const queryClient = useQueryClient();
  const { playSuccess, playPop, playError } = usePremiumSound();
  const toast = useToast();

  const tierParam = selectedTier === 'ALL' ? undefined : selectedTier;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['retention-cockpit', tierParam],
    queryFn: () => retentionApi.getCockpit({ tier: tierParam, limit: 100 }),
    enabled: isOpen,
    staleTime: 30_000,
  });

  const interveneMutation = useMutation({
    mutationFn: (variables: { studentId: string; type: string; notes: string; followUpDays: number }) =>
      retentionApi.recordIntervention(variables.studentId, {
        type: variables.type,
        notes: variables.notes,
        followUpDays: variables.followUpDays,
      }),
    onSuccess: () => {
      playSuccess();
      toast.success(t('retention.interveneSuccess', 'Intervensiya muvaffaqiyatli saqlandi va vazifa rejalashtirildi!'));
      setActiveInterventionStudent(null);
      setInterventionNote('');
      queryClient.invalidateQueries({ queryKey: ['retention-cockpit'] });
    },
    onError: (err: any) => {
      playError();
      toast.error(err?.message || t('retention.interveneError', 'Intervensiyani qayd etishda xatolik yuz berdi'));
    },
  });

  const handleStartIntervention = (student: any) => {
    playPop();
    setActiveInterventionStudent(student);
    setInterventionType(student.playbookAction || 'DIRECTOR_CALL');
    setInterventionNote(
      `O'quvchi xavf omillari: ${student.factors?.join(', ')}. Telefon: ${student.parentPhone || student.phone || "Mavjud emas"}`
    );
  };

  const handleSubmitIntervention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInterventionStudent) return;
    if (!interventionNote.trim()) {
      toast.error("Iltimos, ko'rilgan chora haqida izoh yozing");
      return;
    }

    interveneMutation.mutate({
      studentId: activeInterventionStudent.studentId,
      type: interventionType,
      notes: interventionNote.trim(),
      followUpDays: Number(followUpDays) || 3,
    });
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'CRITICAL':
        return <GlassBadge variant="danger" size="sm">{t('retention.tierCritical', 'KRITIK XAVF')}</GlassBadge>;
      case 'HIGH':
        return <GlassBadge variant="warning" size="sm">{t('retention.tierHigh', 'YUQORI XAVF')}</GlassBadge>;
      case 'MEDIUM':
        return <GlassBadge variant="amber" size="sm">{t('retention.tierMedium', "O'RTA XAVF")}</GlassBadge>;
      default:
        return <GlassBadge variant="success" size="sm">{t('retention.tierLow', 'BARQAROR')}</GlassBadge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-rose-500 bg-rose-500/10 border-rose-500/30';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    if (score >= 25) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  };

  const summary = data?.summary || {
    totalEvaluated: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    totalAtRiskTuition: 0,
  };

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
            <div className="relative">
              <MeduAiLogo size="md" glow />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {t('retention.cockpitTitle', 'AI Student Retention & Churn Prediction Cockpit')}
                </h2>
                <GlassBadge variant="primary" size="sm">M-EDU PRO</GlassBadge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('retention.cockpitSubtitle', "Talabalar o'qishni tark etishidan oldin aniqlash, risk ballarini hisoblash va 1-klik intervensiya")}
              </p>
            </div>
          </div>
        </div>

        {/* Executive KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-3.5">
            <span className="text-xs text-muted-foreground font-medium">{t('retention.revenueAtRisk', 'Xavf Ostidagi Tushum (LTV)')}</span>
            <div className="text-lg font-bold text-rose-500 mt-1">
              {formatCurrency(summary.totalAtRiskTuition || 0)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              O'quvchilar ketishi xavfi ostida
            </div>
          </div>

          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 backdrop-blur-md p-3.5">
            <span className="text-xs text-rose-400 font-medium">{t('retention.criticalCount', 'Kritik Xavf (75-100)')}</span>
            <div className="text-lg font-bold text-rose-500 mt-1">
              {summary.criticalCount} ta talaba
            </div>
            <div className="text-[11px] text-rose-400/80 mt-0.5">Tezkor rahbar qo'ng'irog'i shart</div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md p-3.5">
            <span className="text-xs text-amber-400 font-medium">{t('retention.highRiskCount', 'Yuqori Xavf (50-74)')}</span>
            <div className="text-lg font-bold text-amber-500 mt-1">
              {summary.highCount} ta talaba
            </div>
            <div className="text-[11px] text-amber-400/80 mt-0.5">Davomat va qarzdorlik muammosi</div>
          </div>

          <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-3.5">
            <span className="text-xs text-muted-foreground font-medium">Baholangan Talabalar</span>
            <div className="text-lg font-bold text-foreground mt-1">
              {summary.totalEvaluated} ta
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5">
              {summary.lowCount} ta barqaror holatda
            </div>
          </div>
        </div>

        {/* Tier Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/30 pb-3">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as RiskTier[]).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => {
                playPop();
                setSelectedTier(tier);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedTier === tier
                  ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              {tier === 'ALL' && `Barchasi (${summary.totalEvaluated})`}
              {tier === 'CRITICAL' && `🚨 Kritik (${summary.criticalCount})`}
              {tier === 'HIGH' && `⚠️ Yuqori (${summary.highCount})`}
              {tier === 'MEDIUM' && `⚡ O'rta (${summary.mediumCount})`}
              {tier === 'LOW' && `✅ Barqaror (${summary.lowCount})`}
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
              🔄 Qayta tahlil qilish
            </GlassButton>
          </div>
        </div>

        {/* Student List */}
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-2" />
            <p>Talabalar xulq-atvori va risk modellari tahlil qilinmoqda...</p>
          </div>
        ) : (data?.students?.length || 0) === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-border/60 bg-muted/10 p-6">
            <div className="text-3xl mb-2">🎉</div>
            <h3 className="text-sm font-semibold text-foreground">Xavf ostidagi o'quvchilar aniqlanmadi</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedTier === 'ALL'
                ? "Barcha o'quvchilarning davomat va to'lov ko'rsatkichlari namunali darajada."
                : `Ushbu toifada (${selectedTier}) xavf guruhidagi o'quvchilar yo'q.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {data.students.map((student: any) => (
              <motion.div
                key={student.studentId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/50 bg-card/50 hover:bg-card/75 transition-colors p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {student.fullName}
                    </span>
                    {getTierBadge(student.riskTier)}
                    <span className="text-xs text-muted-foreground">
                      📞 {student.parentPhone || student.phone || 'Telefon kiritilmagan'}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>Guruhlar: <strong className="text-foreground">{student.groupNames?.join(', ') || 'Guruhsiz'}</strong></span>
                    {student.overdueBalance > 0 && (
                      <span className="text-rose-400 font-medium">
                        Qarz: {formatCurrency(student.overdueBalance)}
                      </span>
                    )}
                  </div>

                  {/* Factor Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {student.factors?.map((factor: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-muted/40 border border-border/30 text-muted-foreground"
                      >
                        ⚠️ {factor}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Score Indicator */}
                  <div className={`px-3 py-1.5 rounded-xl border text-center font-bold text-sm ${getScoreColor(student.riskScore)}`}>
                    <div className="text-[10px] uppercase tracking-wider font-medium opacity-80">Risk Ball</div>
                    {student.riskScore}/100
                  </div>

                  {/* 1-Click Playbook Action */}
                  <GlassButton
                    variant={student.riskTier === 'CRITICAL' ? 'danger' : 'primary'}
                    size="sm"
                    onClick={() => handleStartIntervention(student)}
                  >
                    ⚡ Intervensiya
                  </GlassButton>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Active Intervention Drawer / Modal */}
        <AnimatePresence>
          {activeInterventionStudent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/30 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    🎯 Tezkor Saqlab Qolish Rejasi (Retention Playbook): {activeInterventionStudent.fullName}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tavsiya etilgan chora: <strong className="text-primary">{activeInterventionStudent.playbookAction}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveInterventionStudent(null)}
                  className="text-xs text-muted-foreground hover:text-foreground p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitIntervention} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Intervensiya Turi
                    </label>
                    <select
                      value={interventionType}
                      onChange={(e) => setInterventionType(e.target.value)}
                      className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="DIRECTOR_CALL">📞 Rahbar / Direktor Shaxsiy Qo'ng'irog'i</option>
                      <option value="ACADEMIC_TUTORING">📚 Bepul Tyutor & Qayta O'zlashtirish Ajratish</option>
                      <option value="FINANCIAL_DISCOUNT">💰 Moliyaviy Chegirma & Qarzni Bo'lib To'lash</option>
                      <option value="PARENT_CONFERENCE">🤝 Markazda Ota-ona bilan Yuzma-yuz Suhbat</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Nazorat Qayta Aloqa Muddati (Kun)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={followUpDays}
                      onChange={(e) => setFollowUpDays(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Bajarilgan Chora va Suhbat Tafsiloti
                  </label>
                  <textarea
                    rows={3}
                    value={interventionNote}
                    onChange={(e) => setInterventionNote(e.target.value)}
                    placeholder="Masalan: Ota-onasiga qo'ng'iroq qilindi, o'quvchining kasalligi tufayli dars qoldirgani aniqlandi, mentor bilan 2 soat bepul tushuntirish tashkil etildi..."
                    className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <GlassButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveInterventionStudent(null)}
                  >
                    Bekor qilish
                  </GlassButton>
                  <GlassButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={interveneMutation.isPending}
                  >
                    💾 Saqlash va Vazifa Ochish
                  </GlassButton>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassModal>
  );
};
