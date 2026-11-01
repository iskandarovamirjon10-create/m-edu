import { useState, memo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GlassModal,
  GlassButton,
  GlassInput,
  GlassField,
  GlassSelect,
  useToasts,
} from '@/components/ui';
import { groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { getErrorMessage } from '@/lib/errorMessages';
import { fullName } from '@/lib/format';
import type { Teacher } from '@/lib/types';

interface BulkGroupActionsModalsProps {
  selectedIds: string[];
  isOpen: boolean;
  activeModal: 'status' | 'teacher' | 'room' | null;
  onClose: () => void;
  onSuccess: () => void;
  teachers?: Teacher[];
  availableRooms?: string[];
}

export const BulkGroupActionsModals = memo(function BulkGroupActionsModals({
  selectedIds,
  isOpen,
  activeModal,
  onClose,
  onSuccess,
  teachers = [],
  availableRooms = [],
}: BulkGroupActionsModalsProps) {
  const { t } = useSafeI18n();
  const { push } = useToasts();
  const qc = useQueryClient();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  // 1. Bulk Status State
  const [targetStatus, setTargetStatus] = useState<boolean>(true);

  // 2. Bulk Teacher State
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  // 3. Bulk Room State
  const [selectedRoom, setSelectedRoom] = useState<string>('');

  const count = selectedIds.length;

  // Mutations
  const statusMutation = useMutation({
    mutationFn: () => groupsApi.bulkStatus({ groupIds: selectedIds, isActive: targetStatus }),
    onSuccess: (data) => {
      sound.playSuccess();
      haptics.success();
      push({
        type: 'success',
        title: t('groups.bulk.statusSuccessTitle', `${count} ta guruh yangilandi`),
        message: data.message || t('groups.bulk.statusSuccessDesc', 'Guruhlar holati muvaffaqiyatli saqlandi'),
      });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      sound.playError();
      haptics.error();
      push({
        type: 'error',
        title: t('common.error', 'Xatolik yuz berdi'),
        message: getErrorMessage(err),
      });
    },
  });

  const teacherMutation = useMutation({
    mutationFn: () =>
      groupsApi.bulkTeacher({
        groupIds: selectedIds,
        teacherId: selectedTeacherId === '' ? null : selectedTeacherId,
      }),
    onSuccess: (data) => {
      sound.playSuccess();
      haptics.success();
      push({
        type: 'success',
        title: t('groups.bulk.teacherSuccessTitle', `O'qituvchi biriktirildi`),
        message: data.message || `${count} ta guruhga yangi o'qituvchi tayinlandi`,
      });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      sound.playError();
      haptics.error();
      push({
        type: 'error',
        title: t('common.error', 'Xatolik yuz berdi'),
        message: getErrorMessage(err),
      });
    },
  });

  const roomMutation = useMutation({
    mutationFn: () =>
      groupsApi.bulkRoom({
        groupIds: selectedIds,
        room: selectedRoom.trim() === '' ? null : selectedRoom.trim(),
      }),
    onSuccess: (data) => {
      sound.playSuccess();
      haptics.success();
      push({
        type: 'success',
        title: t('groups.bulk.roomSuccessTitle', `Xona biriktirildi`),
        message: data.message || `${count} ta guruhga yangi xona tayinlandi`,
      });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      sound.playError();
      haptics.error();
      push({
        type: 'error',
        title: t('common.error', 'Xatolik yuz berdi'),
        message: getErrorMessage(err),
      });
    },
  });

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen || !activeModal) return null;

  return (
    <>
      {/* 1. BULK STATUS MODAL */}
      <GlassModal
        open={activeModal === 'status'}
        onClose={handleClose}
        title={t('groups.bulk.statusModalTitle', 'Guruhlar holatini o\'zgartirish')}
        className="max-w-md"
      >
        <div className="space-y-5">
          <p className="text-[13px] text-[var(--text-secondary)]">
            {t(
              'groups.bulk.statusModalSubtitle',
              { count },
              `Tanlangan ${count} ta guruhning faollik holatini birdaniga yangilash:`
            )}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTargetStatus(true)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                targetStatus
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold ring-2 ring-emerald-500/20'
                  : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-[var(--text-secondary)]'
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-[14px]">{t('groups.bulk.activate', 'Faollashtirish')}</span>
              <span className="text-[11px] opacity-75 mt-0.5">{t('groups.bulk.activeDesc', 'Darslar va davomat ochiq')}</span>
            </button>

            <button
              type="button"
              onClick={() => setTargetStatus(false)}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
                !targetStatus
                  ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold ring-2 ring-amber-500/20'
                  : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-[var(--text-secondary)]'
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              </div>
              <span className="text-[14px]">{t('groups.bulk.deactivate', 'Nofaol qilish')}</span>
              <span className="text-[11px] opacity-75 mt-0.5">{t('groups.bulk.deactiveDesc', 'Arxivlash / Yakunlash')}</span>
            </button>
          </div>

          {!targetStatus && (
            <div className="rounded-xl bg-amber-500/[0.08] border border-amber-500/20 p-3 text-[12px] text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>
                {t(
                  'groups.bulk.deactivateWarning',
                  'Diqqat: Guruhlarni nofaol qilish ularga rejalashtirilgan kelgusi darslarni bekor qiladi va talabalar faol aʼzoligini to\'xtatadi.'
                )}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <GlassButton variant="ghost" onClick={handleClose} disabled={statusMutation.isPending}>
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={() => statusMutation.mutate()}
              loading={statusMutation.isPending}
            >
              {t('groups.bulk.apply', 'Qo\'llash')} ({count})
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* 2. BULK TEACHER MODAL */}
      <GlassModal
        open={activeModal === 'teacher'}
        onClose={handleClose}
        title={t('groups.bulk.teacherModalTitle', 'O\'qituvchini biriktirish')}
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--text-secondary)]">
            {t(
              'groups.bulk.teacherModalSubtitle',
              { count },
              `Tanlangan ${count} ta guruh uchun o'qituvchini tanlang:`
            )}
          </p>

          <GlassField label={t('groups.form.teacher', 'O\'qituvchi')}>
            <GlassSelect
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
            >
              <option value="">— {t('groups.bulk.noTeacher', 'O\'qituvchisiz (Bo\'shatish)')} —</option>
              {teachers.map((tItem) => {
                const name = fullName(tItem.user?.firstName, tItem.user?.lastName);
                const spec = tItem.specializations?.length ? ` (${tItem.specializations.join(', ')})` : '';
                return (
                  <option key={tItem.id} value={tItem.id}>
                    {name}{spec}
                  </option>
                );
              })}
            </GlassSelect>
          </GlassField>

          <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <GlassButton variant="ghost" onClick={handleClose} disabled={teacherMutation.isPending}>
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={() => teacherMutation.mutate()}
              loading={teacherMutation.isPending}
            >
              {t('common.save', 'Saqlash')} ({count})
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* 3. BULK ROOM MODAL */}
      <GlassModal
        open={activeModal === 'room'}
        onClose={handleClose}
        title={t('groups.bulk.roomModalTitle', 'Xona biriktirish')}
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-[13px] text-[var(--text-secondary)]">
            {t(
              'groups.bulk.roomModalSubtitle',
              { count },
              `Tanlangan ${count} ta guruh uchun xonani belgilang:`
            )}
          </p>

          <GlassField label={t('groups.form.room', 'Xona nomi / raqami')}>
            <GlassInput
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              placeholder="Masalan: 204-xona yoki Lab A"
            />
          </GlassField>

          {availableRooms.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                {t('groups.bulk.quickRooms', 'Mavjud xonalar:')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableRooms.slice(0, 8).map((rm) => (
                  <button
                    key={rm}
                    type="button"
                    onClick={() => setSelectedRoom(rm)}
                    className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition-all ${
                      selectedRoom === rm
                        ? 'bg-brand-500 text-white shadow-sm'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {rm}
                  </button>
                ))}
                {selectedRoom && (
                  <button
                    type="button"
                    onClick={() => setSelectedRoom('')}
                    className="rounded-lg px-2 py-1 text-[11px] text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    {t('common.clear', 'Tozalash')}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <GlassButton variant="ghost" onClick={handleClose} disabled={roomMutation.isPending}>
              {t('common.cancel', 'Bekor qilish')}
            </GlassButton>
            <GlassButton
              variant="primary"
              onClick={() => roomMutation.mutate()}
              loading={roomMutation.isPending}
            >
              {t('common.save', 'Saqlash')} ({count})
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </>
  );
});
