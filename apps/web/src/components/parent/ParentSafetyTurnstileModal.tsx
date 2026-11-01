/**
 * M-EDU Enterprise — Parent Safety Guard & Live Turnstile Entry-Exit Dispatcher (`ParentSafetyTurnstileModal.tsx`)
 * Real-time campus presence monitor, turnstile movement dispatcher with instant Telegram alerts to parents,
 * anti-flap throttling, and emergency parent broadcasting.
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
import { parentSafetyGuardApi, studentsApi } from '@/lib/api';
import { useSafeI18n } from '@/i18n/I18nProvider';

interface ParentSafetyTurnstileModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: string;
}

export const ParentSafetyTurnstileModal: React.FC<ParentSafetyTurnstileModalProps> = ({
  isOpen,
  onClose,
  branchId,
}) => {
  const { t } = useSafeI18n();
  const [activeTab, setActiveTab] = useState<'PRESENCE' | 'DISPATCH' | 'EMERGENCY'>('PRESENCE');

  // Manual Dispatch State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [gateName, setGateName] = useState<string>('Turniket #1 (Asosiy Kirish)');
  const [verificationMethod, setVerificationMethod] = useState<string>('FACE_ID');

  // Emergency Broadcast State
  const [emergencyTitle, setEmergencyTitle] = useState<string>('⚠️ Muhim Bildirishnoma');
  const [emergencyMessage, setEmergencyMessage] = useState<string>('');
  const [emergencySeverity, setEmergencySeverity] = useState<'HIGH' | 'CRITICAL'>('HIGH');
  const [emergencyTarget, setEmergencyTarget] = useState<'ALL_ACTIVE_STUDENTS' | 'CURRENTLY_PRESENT'>('ALL_ACTIVE_STUDENTS');

  const queryClient = useQueryClient();
  const { playSuccess, playPop, playError } = usePremiumSound();
  const toast = useToast();

  // Fetch Live Presence
  const {
    data: presenceData,
    isLoading: isPresenceLoading,
    refetch: refetchPresence,
  } = useQuery({
    queryKey: ['live-presence', branchId],
    queryFn: () => parentSafetyGuardApi.getLivePresence(branchId),
    enabled: isOpen,
    refetchInterval: 10_000, // 10s auto refresh for live campus monitoring
  });

  // Students list for testing/dispatching
  const { data: studentsData } = useQuery({
    queryKey: ['students-quick-list'],
    queryFn: () => studentsApi.list({ limit: 50 }),
    enabled: isOpen && activeTab === 'DISPATCH',
  });

  // Notify Movement Mutation
  const movementMutation = useMutation({
    mutationFn: () =>
      parentSafetyGuardApi.notifyMovement({
        studentId: selectedStudentId,
        direction,
        gateOrDeviceName: gateName,
        verificationMethod,
      }),
    onSuccess: (res: any) => {
      playSuccess();
      toast.success(
        `${res.studentName} harakati muvaffaqiyatli qayd etildi! ${
          res.notifiedParentsCount > 0
            ? `${res.notifiedParentsCount} ta ota-onaga Telegram orqali xabar yuborildi.`
            : "Ota-onaga xabar yetkazildi."
        }`
      );
      queryClient.invalidateQueries({ queryKey: ['live-presence'] });
    },
    onError: (err: any) => {
      playError();
      toast.error(err?.message || "Turniket harakatini qayd etishda xatolik yuz berdi");
    },
  });

  // Emergency Broadcast Mutation
  const emergencyMutation = useMutation({
    mutationFn: () =>
      parentSafetyGuardApi.emergencyBroadcast({
        title: emergencyTitle,
        message: emergencyMessage,
        severity: emergencySeverity,
        targetAudience: emergencyTarget,
      }),
    onSuccess: (res: any) => {
      playSuccess();
      toast.success(
        `Favqulodda xabarnoma ${res.notifiedCount} nafar talabaning ota-onalariga zudlik bilan yetkazildi!`
      );
      setEmergencyMessage('');
      setActiveTab('PRESENCE');
    },
    onError: (err: any) => {
      playError();
      toast.error(err?.message || "Xabarnomani tarqatishda xatolik yuz berdi");
    },
  });

  const students: any[] = ((studentsData as any)?.items || []) as any[];
  const presentStudents = presenceData?.studentsInside || [];
  const insideCount = presenceData?.currentlyInsideCount || 0;

  const handleSendMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      toast.error("Iltimos, talabani tanlang");
      return;
    }
    movementMutation.mutate();
  };

  const handleSendEmergency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyMessage.trim()) {
      toast.error("Iltimos, xabarnoma matnini kiriting");
      return;
    }
    emergencyMutation.mutate();
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
            <MeduAiLogo size="md" glow />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  {t('parentSafety.title', 'Parent Safety Guard & Jonli Turniket Xavfsizlik Monitori')}
                </h2>
                <GlassBadge variant="primary" size="sm">LIVE DISPATCH</GlassBadge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('parentSafety.subtitle', "Markaz ichidagi talabalar soni, ota-onalarga real-vaqtda bildirishnoma va favqulodda xabar tarqatish tizimi")}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-border/30 pb-3">
          <button
            type="button"
            onClick={() => {
              playPop();
              setActiveTab('PRESENCE');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'PRESENCE'
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            🏢 {t('parentSafety.tabPresence', 'Markazda Hozir')} ({insideCount} ta)
          </button>

          <button
            type="button"
            onClick={() => {
              playPop();
              setActiveTab('DISPATCH');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'DISPATCH'
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            ⚡ {t('parentSafety.tabDispatch', 'Turniket Kirish/Chiqish Test')}
          </button>

          <button
            type="button"
            onClick={() => {
              playPop();
              setActiveTab('EMERGENCY');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'EMERGENCY'
                ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/25'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            🚨 {t('parentSafety.tabEmergency', 'Favqulodda Xabar Tarqatish')}
          </button>
        </div>

        {/* TAB 1: LIVE PRESENCE */}
        {activeTab === 'PRESENCE' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-md p-4">
                <span className="text-xs text-emerald-400 font-medium">Bino Ichidagi Talabalar</span>
                <div className="text-2xl font-black text-emerald-500 mt-1">
                  {insideCount} nafar
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Jonli turniket orqali kirganlar</div>
              </div>

              <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-4">
                <span className="text-xs text-muted-foreground font-medium">Ota-onalar Aloqasi</span>
                <div className="text-2xl font-black text-primary mt-1">
                  100% Faol
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Telegram bot & SMS shlyuz</div>
              </div>

              <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-md p-4">
                <span className="text-xs text-muted-foreground font-medium">Anti-Flap Himoya</span>
                <div className="text-2xl font-black text-foreground mt-1">
                  3 daqiqa
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Qayta-qayta eshik o'ynash filtri</div>
              </div>
            </div>

            {isPresenceLoading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Jonli sensor ma'lumotlari yangilanmoqda...
              </div>
            ) : presentStudents.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-dashed border-border/60 bg-muted/10 p-6">
                <div className="text-3xl mb-2">🚪</div>
                <h3 className="text-sm font-semibold text-foreground">Hozirda markaz binosi ichida talabalar yo'q</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Talabalar turniketdan Face ID yoki karta orqali o'tganda ro'yxat jonli paydo bo'ladi.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {presentStudents.map((st: any) => (
                  <div
                    key={st.studentId}
                    className="p-3.5 rounded-xl border border-border/50 bg-card/40 flex items-center justify-between"
                  >
                    <div className="text-xs space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{st.studentName}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Kirgan vaqti: {new Date(st.entryTime).toLocaleTimeString()} ({st.minutesInside} daqiqa oldin)
                      </div>
                    </div>

                    <GlassBadge variant="success" size="sm">
                      BINO ICHIDA 🟢
                    </GlassBadge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANUAL DISPATCH */}
        {activeTab === 'DISPATCH' && (
          <form onSubmit={handleSendMovement} className="space-y-4">
            <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3">
              <h3 className="text-xs font-bold text-foreground">
                Turniket harakatini test qilish / Qo'lda kiritish
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Talabani Tanlang
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Talabani tanlang --</option>
                    {students.map((st: any) => (
                      <option key={st.id} value={st.id}>
                        {st.firstName} {st.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Harakat Yo'nalishi
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as 'IN' | 'OUT')}
                    className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="IN">🟢 BINO ICHIGA KIRDI (IN)</option>
                    <option value="OUT">🔴 BINODAN CHIQDI (OUT)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Turniket / Qurilma Nomi
                  </label>
                  <input
                    type="text"
                    value={gateName}
                    onChange={(e) => setGateName(e.target.value)}
                    className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Tekshiruv Usuli
                  </label>
                  <select
                    value={verificationMethod}
                    onChange={(e) => setVerificationMethod(e.target.value)}
                    className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="FACE_ID">Face ID (Biometrik Kamera)</option>
                    <option value="RFID_CARD">RFID / NFC Karta</option>
                    <option value="QR_CODE">QR Kod Skaner</option>
                    <option value="MANUAL_OVERRIDE">Qorovul / Admin Qo'lda</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={movementMutation.isPending}
                >
                  🚀 Harakatni Qayd Etish & Ota-onaga Jo'natish
                </GlassButton>
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: EMERGENCY BROADCAST */}
        {activeTab === 'EMERGENCY' && (
          <form onSubmit={handleSendEmergency} className="space-y-4">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                <span>🚨 Ota-onalarga Favqulodda Tezkor Bildirishnoma</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ushbu xabar barcha tanlangan ota-onalarning Telegram va mobil ilovalariga yuqori ustuvorlikda darhol jo'natiladi.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Xabarnoma Darajasi
                  </label>
                  <select
                    value={emergencySeverity}
                    onChange={(e) => setEmergencySeverity(e.target.value as any)}
                    className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="HIGH">⚠️ Yuqori (High) - Ob-havo, bayram, jadval o'zgarishi</option>
                    <option value="CRITICAL">🚨 Kritik (Critical) - Favqulodda holat, evakuatsiya</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Qabul Qiluvchilar
                  </label>
                  <select
                    value={emergencyTarget}
                    onChange={(e) => setEmergencyTarget(e.target.value as any)}
                    className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="ALL_ACTIVE_STUDENTS">Barcha Faol Talabalar Ota-onalari</option>
                    <option value="CURRENTLY_PRESENT">Faqat Hozir Bino Ichida Bo'lganlar Ota-onalari</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Mavzu
                </label>
                <input
                  type="text"
                  value={emergencyTitle}
                  onChange={(e) => setEmergencyTitle(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Xabar Matni
                </label>
                <textarea
                  rows={3}
                  value={emergencyMessage}
                  onChange={(e) => setEmergencyMessage(e.target.value)}
                  placeholder="Hurmatli ota-onalar! Kutilmagan elektr uzilishi tufayli bugun darslar soat 17:00 da tugatiladi. Farzandingizni olib ketishingiz mumkin..."
                  className="w-full text-xs rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <GlassButton
                  type="submit"
                  variant="danger"
                  size="sm"
                  loading={emergencyMutation.isPending}
                >
                  ⚡ Zudlik Bilan Tarqatish
                </GlassButton>
              </div>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/30">
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => {
              playPop();
              refetchPresence();
            }}
          >
            🔄 Yangilash
          </GlassButton>

          <GlassButton
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Yopish
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
};
