/**
 * M-EDU Enterprise — Smart Sibling, Family Cluster, Merit & Loyalty Discount Modal (`SmartDiscountClusterModal.tsx`)
 * Automatically links siblings by parent phone/account, calculates tiered multi-child discounts,
 * academic excellence merit grants, and multi-course bundles with 40% cap protection.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GlassModal,
  GlassButton,
  GlassBadge,
  useToast,
} from '@/components/ui';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { smartDiscountApi, studentsApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useSafeI18n } from '@/i18n/I18nProvider';

interface SmartDiscountClusterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudentId?: string;
}

interface DiscountStudent {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  parentPhone?: string;
}

interface Sibling {
  id: string;
  name?: string;
  groups?: string[];
}

interface FamilyNetwork {
  primaryStudent?: { name?: string; phone?: string };
  siblings?: Sibling[];
}

interface DiscountBreakdownItem {
  description?: string;
  rule?: string;
  percent?: number;
  amount?: number;
}

interface DiscountEvaluation {
  breakdown?: DiscountBreakdownItem[];
  totalDiscountPercent?: number;
  totalDiscountAmount?: number;
  finalTuitionAmount?: number;
}

interface FamilyApplyResult {
  affectedStudentsCount?: number;
}

export const SmartDiscountClusterModal: React.FC<SmartDiscountClusterModalProps> = ({
  isOpen,
  onClose,
  initialStudentId,
}) => {
  const { t } = useSafeI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);
  const [sampleTuition, setSampleTuition] = useState<number>(600_000);

  const queryClient = useQueryClient();
  const { playSuccess, playPop, playError } = usePremiumSound();
  const toast = useToast();

  // Search students if not selected
  const { data: studentsData } = useQuery<{ items?: DiscountStudent[] }>({
    queryKey: ['students-quick-search', searchQuery],
    queryFn: () =>
      studentsApi.list({ search: searchQuery, limit: 8 }) as Promise<{ items?: DiscountStudent[] }>,
    enabled: isOpen && !selectedStudentId && searchQuery.length >= 2,
  });

  // Fetch Family Network
  const {
    data: familyData,
    isLoading: isFamilyLoading,
  } = useQuery<FamilyNetwork>({
    queryKey: ['family-network', selectedStudentId],
    queryFn: () =>
      smartDiscountApi.getFamilyNetwork(selectedStudentId!) as Promise<FamilyNetwork>,
    enabled: isOpen && !!selectedStudentId,
  });

  // Evaluate Discounts for this student
  const {
    data: evaluationData,
  } = useQuery<DiscountEvaluation>({
    queryKey: ['discount-evaluation', selectedStudentId, sampleTuition],
    queryFn: () =>
      smartDiscountApi.evaluate({
        studentId: selectedStudentId!,
        tuitionAmount: Number(sampleTuition) || 600_000,
      }) as Promise<DiscountEvaluation>,
    enabled: isOpen && !!selectedStudentId,
  });

  // Apply Family Discounts Mutation
  const applyFamilyMutation = useMutation({
    mutationFn: () =>
      smartDiscountApi.applyFamilyDiscounts({
        studentId: selectedStudentId!,
        discountPercentTier2: 10,
        discountPercentTier3: 20,
      }) as Promise<FamilyApplyResult>,
    onSuccess: (res: FamilyApplyResult) => {
      playSuccess();
      toast.success(
        `Oila klasteri tasdiqlandi! ${res.affectedStudentsCount ?? 0} ta farzandga yangi chegirma qoidalari kiritildi.`
      );
      queryClient.invalidateQueries({ queryKey: ['family-network'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      playError();
      toast.error(err?.message || "Chegirmani qo'llashda xatolik yuz berdi");
    },
  });

  const studentsList: DiscountStudent[] = studentsData?.items ?? [];
  const siblings: Sibling[] = familyData?.siblings ?? [];

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
                  {t('smartDiscounts.title', 'Smart Oila Klasteri & Dinamik Chegirmalar Engine')}
                </h2>
                <GlassBadge variant="primary" size="sm">M-DISCOUNT</GlassBadge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('smartDiscounts.subtitle', "Aka-uka/opa-singillar tarmog'ini avto-aniqlash, ko'p bolalik, a'lochi (merit) va sadoqat chegirmalari")}
              </p>
            </div>
          </div>
        </div>

        {/* Student Selector */}
        {!selectedStudentId ? (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-foreground">
              Tahlil qilish uchun talabani qidiring yoki tanlang:
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Talaba ismi, familiyasi yoki telefoni..."
              className="w-full text-xs rounded-xl border border-border/50 bg-background/50 px-4 py-2.5 text-foreground focus:outline-none focus:border-primary"
            />

            {studentsList.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {studentsList.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      playPop();
                      setSelectedStudentId(st.id);
                    }}
                    className="p-3 text-left rounded-xl border border-border/40 bg-card/40 hover:bg-card/75 transition-all"
                  >
                    <div className="font-semibold text-xs text-foreground">
                      {st.firstName} {st.lastName}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      📞 {st.parentPhone || st.phone || "Telefon yo'q"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Active Student Bar */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex items-center justify-between">
              <div className="text-xs">
                <div className="font-bold text-foreground">
                  {familyData?.primaryStudent?.name || "Tanlangan Talaba"}
                </div>
                <div className="text-muted-foreground text-[11px] mt-0.5">
                  Telefon: {familyData?.primaryStudent?.phone || "Mavjud emas"} · Oila Klasteri: <strong className="text-foreground">{siblings.length} ta farzand</strong>
                </div>
              </div>

              <GlassButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  playPop();
                  setSelectedStudentId(null);
                }}
              >
                Boshqa talaba
              </GlassButton>
            </div>

            {/* Sibling Network Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  👨‍👩‍👧‍👦 Aniqlangan Aka-uka / Opa-singillar ({siblings.length} ta)
                </h3>
                {siblings.length > 1 && (
                  <GlassBadge variant="success" size="sm">
                    {siblings.length}x Ko'p Farzandli Oila
                  </GlassBadge>
                )}
              </div>

              {isFamilyLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Oila zanjiri qidirilmoqda...</div>
              ) : siblings.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground border border-dashed rounded-xl">
                  Ushbu talabaga bog'langan aka-uka yoki opa-singillar aniqlanmadi (yagona o'quvchi).
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {siblings.map((sib: Sibling, idx: number) => (
                    <div
                      key={sib.id}
                      className="p-3 rounded-xl border border-border/40 bg-card/40 flex items-center justify-between"
                    >
                      <div className="text-xs space-y-0.5">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{idx + 1}-farzand: {sib.name}</span>
                          {sib.id === selectedStudentId && (
                            <span className="text-[10px] text-primary">(Hozirgi)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Guruhlari: {sib.groups?.join(', ') || 'Faol guruhi yo\'q'}
                        </div>
                      </div>

                      <div className="text-right">
                        <GlassBadge
                          variant={idx === 0 ? 'neutral' : idx === 1 ? 'warning' : 'success'}
                          size="sm"
                        >
                          {idx === 0 ? '0% (Asosiy)' : idx === 1 ? '-10% Sibling' : '-20% Sibling'}
                        </GlassBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discount Evaluation Breakdown */}
            {evaluationData && (
              <div className="rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-border/30 pb-2.5">
                  <span className="text-xs font-bold text-foreground">
                    🎯 Talabaning Hisoblangan Dinamik Chegirma Kartasi
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Oylik to'lov:</span>
                    <input
                      type="number"
                      step={50_000}
                      value={sampleTuition}
                      onChange={(e) => setSampleTuition(Number(e.target.value))}
                      className="w-28 text-xs font-semibold rounded-lg border border-border/50 bg-background/50 px-2 py-1 text-right text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {evaluationData.breakdown?.map((item: DiscountBreakdownItem, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-b-0"
                    >
                      <div className="space-y-0.5">
                        <span className="font-medium text-foreground">{item.description}</span>
                        <div className="text-[10px] text-muted-foreground uppercase">{item.rule}</div>
                      </div>
                      <span className="font-bold text-emerald-500">
                        -{item.percent}% ({formatCurrency(item.amount)})
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-border/30 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Jami Chegirma (Maksimal 40% himoyasi bilan):</div>
                    <div className="text-sm font-bold text-emerald-500">
                      -{evaluationData.totalDiscountPercent}% (-{formatCurrency(evaluationData.totalDiscountAmount)})
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">To'lanishi Kerak Bo'lgan Summa:</div>
                    <div className="text-lg font-black text-foreground">
                      {formatCurrency(evaluationData.finalTuitionAmount)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={onClose}
              >
                Yopish
              </GlassButton>
              <GlassButton
                variant="primary"
                size="sm"
                loading={applyFamilyMutation.isPending}
                onClick={() => applyFamilyMutation.mutate()}
              >
                💾 Oila Klasteriga Chegirmani Saqlash
              </GlassButton>
            </div>
          </div>
        )}
      </div>
    </GlassModal>
  );
};
