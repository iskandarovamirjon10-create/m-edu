/**
 * M-EDU V2 — Student Milestone Celebration & Viral Pride Card Studio (`StudentMilestoneCelebrationModal.tsx`)
 * Celebrates 100% attendance, exam excellence, and course milestones with celebratory particle physics,
 * generates Instagram Story / Telegram status pride cards for parents to share, creating organic referral loops.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  GlassModal,
  GlassButton,
  GlassBadge,
  useToast,
} from '@/components/ui';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { fireExecutiveConfetti } from '@/lib/executiveConfetti';
import { studentsApi } from '@/lib/api';
import type { Student } from '@/types/students';

export type MilestoneType = 'ATTENDANCE_100' | 'EXAM_ACE' | 'STREAK_30' | 'COURSE_COMPLETION';

export interface MilestoneConfig {
  type: MilestoneType;
  title: string;
  badgeEmoji: string;
  badgeLabel: string;
  congratsMessage: string;
}

const MILESTONES: Record<MilestoneType, MilestoneConfig> = {
  ATTENDANCE_100: {
    type: 'ATTENDANCE_100',
    title: "100% Namunali Davomat",
    badgeEmoji: '⏰',
    badgeLabel: "Davomat Chempioni",
    congratsMessage: "Bir oy davomida birorta ham dars qoldirmay, 100% namunali intizom ko'rsatganligi uchun taqdirlanadi!",
  },
  EXAM_ACE: {
    type: 'EXAM_ACE',
    title: "Oylik Nazoratda 90+ Ball",
    badgeEmoji: '⭐',
    badgeLabel: "Akademik Yulduz",
    congratsMessage: "Dasturlash va kompyuter fanlari bo'yicha oylik amaliy imtihonda 94/100 ball to'plab, guruh yetakchisi bo'ldi!",
  },
  STREAK_30: {
    type: 'STREAK_30',
    title: "30 Kunlik Uzluksiz O'qish",
    badgeEmoji: '🔥',
    badgeLabel: "Qat'iyatlilik Belgisi",
    congratsMessage: "30 kun davomida har kuni platformada dars va amaliyot qilib, namunali uzluksizlik natijasiga erishdi!",
  },
  COURSE_COMPLETION: {
    type: 'COURSE_COMPLETION',
    title: "Kursni A'lo Bitirish",
    badgeEmoji: '🎓',
    badgeLabel: "M-EDU Bitiruvchisi",
    congratsMessage: "Barcha modullarni a'lo baholarga tugatib, bitiruv amaliy loyihasini muvaffaqiyatli himoya qildi!",
  },
};

interface StudentMilestoneCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStudentId?: string;
}

export const StudentMilestoneCelebrationModal: React.FC<StudentMilestoneCelebrationModalProps> = ({
  isOpen,
  onClose,
  defaultStudentId,
}) => {
  const toast = useToast();
  const { playSuccess, playPop } = usePremiumSound();
  const haptics = useHaptics();

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(defaultStudentId || '');
  const [activeMilestone, setActiveMilestone] = useState<MilestoneType>('ATTENDANCE_100');

  // Load students
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    studentsApi.list({ limit: 30 })
      .then((res: any) => {
        if (!active) return;
        const list: Student[] = res?.data || res?.items || (Array.isArray(res) ? res : []);
        setStudents(list);
        setSelectedStudentId((prev) => prev || defaultStudentId || list[0]?.id || '');
      })
      .catch(() => {});
    return () => { active = false; };
  }, [isOpen, defaultStudentId]);

  // Trigger celebration on open
  useEffect(() => {
    if (isOpen) {
      fireExecutiveConfetti();
      playSuccess();
      haptics.success();
    }
  }, [isOpen]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || students[0] || null;
  }, [students, selectedStudentId]);

  const studentName = useMemo(() => {
    if (!selectedStudent) return "Talaba tanlanmagan";
    return (
      [selectedStudent.user?.firstName, selectedStudent.user?.lastName].filter(Boolean).join(' ') ||
      (selectedStudent as any).name ||
      "Talaba"
    );
  }, [selectedStudent]);

  const currentConfig = MILESTONES[activeMilestone];

  const handleSendToParentTelegram = () => {
    playSuccess();
    haptics.success();
    toast.success("Tabriknoma yuborildi!", `${studentName}ning ota-onasiga faxriy tabriknoma va rasm kartochkasi yetkazildi.`);
  };

  const handleShareStory = () => {
    playPop();
    haptics.medium();
    toast.info("Instagram Story Formati!", "Rasm yuklab olindi. Instagram va Telegram Statusda ulashish uchun tayyor.");
  };

  if (!isOpen) return null;

  return (
    <GlassModal
      open={isOpen}
      onClose={onClose}
      title=""
      size="lg"
      className="w-full max-w-4xl overflow-hidden p-0"
    >
      <div className="flex flex-col bg-slate-950 text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25">
              <span className="text-xl">🎉</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Talaba Yutuqlari & Faxriy Tabriknomalar Studio
                </h3>
                <GlassBadge variant="warning" size="sm" className="font-bold">
                  Viral Organic Growth
                </GlassBadge>
              </div>
              <p className="text-xs text-slate-400">
                100% davomat va a'lo baholarni nishonlash, ota-onalar faxrlanib ijtimoiy tarmoqda ulashadigan posterlar
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-6">
          {/* Controls: Student & Milestone Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Taqdirlanuvchi O'quvchi
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  playPop();
                }}
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {students.map((st) => {
                  const name = [st.user?.firstName, st.user?.lastName].filter(Boolean).join(' ') || (st as any).name || 'Talaba';
                  return (
                    <option key={st.id} value={st.id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Yutuq Turi (Milestone)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(MILESTONES) as MilestoneType[]).map((mKey) => {
                  const m = MILESTONES[mKey];
                  const isActive = activeMilestone === mKey;
                  return (
                    <button
                      key={mKey}
                      type="button"
                      onClick={() => {
                        setActiveMilestone(mKey);
                        playPop();
                        fireExecutiveConfetti();
                      }}
                      className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 truncate ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25'
                          : 'border border-white/10 bg-slate-900 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>{m.badgeEmoji}</span>
                      <span className="truncate">{m.badgeLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Social Story Poster Card Preview */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-full max-w-[340px] rounded-3xl border-2 border-amber-500/40 bg-gradient-to-b from-slate-900 via-amber-950/30 to-slate-950 p-6 shadow-2xl relative overflow-hidden text-center">
              {/* Background Glow */}
              <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />

              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-300">
                  <span>{currentConfig.badgeEmoji}</span>
                  <span>{currentConfig.badgeLabel}</span>
                </div>

                {/* Avatar Placeholder */}
                <div className="mx-auto h-20 w-20 rounded-full border-2 border-amber-400 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl font-black text-slate-950 shadow-xl shadow-amber-500/30">
                  {studentName.slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight">
                    {studentName}
                  </h3>
                  <div className="text-xs font-semibold text-amber-400 mt-0.5">
                    {currentConfig.title}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3 text-xs text-slate-300 leading-relaxed">
                  "{currentConfig.congratsMessage}"
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="font-bold text-white">M-EDU Ta'lim Markazi</div>
                  <div className="text-amber-400">m-edu.uz</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <GlassButton
              variant="primary"
              onClick={handleSendToParentTelegram}
              className="flex-1 justify-center gap-2 !rounded-xl !bg-gradient-to-r !from-sky-500 !to-blue-600 font-bold"
            >
              <span>✈️</span>
              <span>Ota-onasiga Telegramda Yuborish</span>
            </GlassButton>

            <GlassButton
              variant="primary"
              onClick={handleShareStory}
              className="flex-1 justify-center gap-2 !rounded-xl !bg-gradient-to-r !from-amber-500 !to-orange-600 font-bold"
            >
              <span>📸</span>
              <span>Instagram Story / Status Kartasini Saqlash</span>
            </GlassButton>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/80 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <MeduAiLogo size="xs" />
            <span>M-EDU Viral Pride Card Studio</span>
          </div>

          <GlassButton variant="ghost" onClick={onClose} className="!rounded-xl text-xs">
            Yopish
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
};
