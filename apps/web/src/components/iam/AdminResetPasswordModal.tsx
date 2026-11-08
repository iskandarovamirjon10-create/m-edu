import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { iamApi } from '@/lib/api';
import {
  GlassModal,
  GlassButton,
  GlassInput,
  GlassField,
  useToasts,
} from '@/components/ui';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import type { User } from '@/lib/types';
import { fullName } from '@/lib/format';
import { OnboardingSlipModal } from './OnboardingSlipModal';

interface AdminResetPasswordModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function generateSecurePassword(length = 12): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*';
  const all = uppers + lowers + numbers + symbols;

  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);

  // Guarantee at least 1 of each category
  const chars = [
    uppers[array[0] % uppers.length],
    lowers[array[1] % lowers.length],
    numbers[array[2] % numbers.length],
    symbols[array[3] % symbols.length],
  ];

  for (let i = 4; i < length; i++) {
    chars.push(all[array[i] % all.length]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = chars.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

function evaluateStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: 'bg-transparent' };
  let s = 0;
  if (pwd.length >= 8) s += 1;
  if (pwd.length >= 12) s += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s += 1;
  if (/[0-9]/.test(pwd)) s += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) s += 1;

  if (s <= 2) return { score: 1, label: 'Zaif', color: 'bg-rose-500' };
  if (s === 3) return { score: 2, label: "O'rtacha", color: 'bg-amber-500' };
  if (s === 4) return { score: 3, label: 'Yaxshi', color: 'bg-blue-500' };
  return { score: 4, label: 'Juda kuchli', color: 'bg-emerald-500' };
}

export function AdminResetPasswordModal({
  user,
  open,
  onClose,
  onSuccess,
}: AdminResetPasswordModalProps) {
  const { push } = useToasts();
  const sound = usePremiumSound();

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (open) {
      const initialGen = generateSecurePassword(12);
      setNewPassword(initialGen);
      setShowPassword(true);
      setMustChangePassword(true);
      setError(null);
      setSuccessInfo(null);
      setCopied(false);
    }
  }, [open]);

  const strength = evaluateStrength(newPassword);

  const handleGenerate = useCallback(() => {
    sound.playTick?.();
    const generated = generateSecurePassword(12);
    setNewPassword(generated);
    setShowPassword(true);
  }, [sound]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    if (!newPassword || newPassword.length < 8) {
      setError("Parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    sound.playTick?.();

    try {
      await iamApi.resetPassword(user.id, {
        newPassword,
        mustChangePassword,
      });

      sound.playSuccess?.();
      push('success', `${fullName(user.firstName, user.lastName)} hisobi uchun yangi parol o'rnatildi va seanslar bekor qilindi.`);

      setSuccessInfo({
        username: user.username || user.email || 'user',
        password: newPassword,
      });

      onSuccess?.();
    } catch (err: any) {
      sound.playError?.();
      setError(err?.message || "Parolni yangilashda xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = useCallback(async () => {
    if (!successInfo) return;
    sound.playTick?.();
    const textToCopy = `M-EDU Kirish Ma'lumotlari:\nLogin: ${successInfo.username}\nParol: ${successInfo.password}\nHolat: Dastlabki kirishda majburiy o'zgartirish`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      push('info', "Login va yangi parol xotiraga nusxalandi");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      push('error', "Nusxalab bo'lmadi, qo'lda nusxa oling");
    }
  }, [successInfo, sound, push]);

  if (!user) return null;

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Administrator Parol Yangilash"
      wide
    >
      <div className="space-y-6 pt-1">
        {/* User preview header */}
        <div className="flex items-center justify-between rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 text-white font-bold text-sm shadow-md">
              {user.firstName?.[0] || 'U'}{user.lastName?.[0] || ''}
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)] text-sm">
                {fullName(user.firstName, user.lastName)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {user.username && (
                  <span className="font-mono text-xs text-brand-600 dark:text-brand-400 font-medium">
                    @{user.username}
                  </span>
                )}
                <span className="rounded-md bg-black/[0.06] dark:bg-white/[0.08] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
              user.isActive
                ? 'bg-emerald-500/12 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400'
                : 'bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {user.isActive ? 'Faol' : 'Nofaol'}
            </span>
          </div>
        </div>

        {/* Success View */}
        {successInfo ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-5"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-400">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-sm">Parol muvaffaqiyatli yangilandi!</p>
                <p className="text-xs opacity-90">Barcha avvalgi faol seanslar bekor qilindi. Foydalanuvchi quyidagi yangi ma'lumotlar bilan kirishi zarur.</p>
              </div>
            </div>

            {/* Credentials Card */}
            <div className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-gradient-to-br from-white/90 to-slate-50/90 dark:from-surface-900/90 dark:to-surface-800/90 p-5 shadow-lg backdrop-blur-xl">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-2.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Login (Username):</span>
                  <span className="font-mono text-sm font-bold text-[var(--text-primary)]">@{successInfo.username}</span>
                </div>
                <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-2.5">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Yangi Parol:</span>
                  <span className="font-mono text-base font-extrabold tracking-wider text-brand-600 dark:text-brand-400">{successInfo.password}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] pt-0.5">
                  <span>Dastlabki kirishda almashtirish:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Majburiy (Faollashtirilgan)</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={handleCopyCredentials}
                  className="flex-1 min-w-[170px]"
                  icon={
                    copied ? (
                      <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    )
                  }
                >
                  {copied ? 'Nusxa olindi!' : "Login va Parolni Nusxalash"}
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowSlipModal(true)}
                  icon={
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>
                  }
                >
                  Varaqani chop etish
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                >
                  Yopish
                </GlassButton>
              </div>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Password input & generator */}
            <GlassField
              label="Yangi vaqtinchalik parol"
              hint="Kamida 8 ta belgi, katta-kichik harflar, raqam va maxsus belgi tavsiya etiladi."
              error={error || undefined}
            >
              <div className="relative">
                <GlassInput
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Kuchli parol kiriting..."
                  required
                  className="font-mono pr-28 text-sm"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    title={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="p-1.5 rounded-lg text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors"
                    title="Tasodifiy kuchli parol yaratish"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.21 1.21 0 0 0 1.72 0L21.64 5.36a1.21 1.21 0 0 0 0-1.72Z"/>
                      <path d="m14 7 3 3"/>
                      <path d="M5 6v4"/>
                      <path d="M19 14v4"/>
                      <path d="M10 2v2"/>
                      <path d="M7 8H3"/>
                      <path d="M21 16h-4"/>
                      <path d="M11 3H9"/>
                    </svg>
                  </button>
                </div>
              </div>
            </GlassField>

            {/* Strength meter */}
            {newPassword && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-tertiary)]">Parol mustahkamligi:</span>
                  <span className="font-bold text-[var(--text-primary)]">{strength.label}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((tier) => (
                    <div
                      key={tier}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        tier <= strength.score ? strength.color : 'bg-black/[0.08] dark:bg-white/[0.1]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Force change option */}
            <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.02] dark:bg-white/[0.03] p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mustChangePassword}
                  onChange={(e) => setMustChangePassword(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold text-[var(--text-primary)] block">
                    Dastlabki kirishda yangi shaxsiy parol o'rnatishni majburlash (Tavsiya etiladi)
                  </span>
                  <span className="text-[var(--text-tertiary)]">
                    Foydalanuvchi tizimga kirgan zahoti ushbu vaqtinchalik parolni o'zining shaxsiy maxfiy paroli bilan almashtirmaguncha ilova imkoniyatlariga o'ta olmaydi.
                  </span>
                </div>
              </label>
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <svg className="h-4 w-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>
                <strong>Xavfsizlik kafolati:</strong> Parol yangilanishi bilan foydalanuvchining barcha mavjud seanslari (kompyuter, telefon, planshet) darhol bekor qilinadi.
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Bekor qilish
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={isSubmitting || !newPassword || newPassword.length < 8}
                icon={
                  isSubmitting ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  )
                }
              >
                {isSubmitting ? "Yangilanmoqda..." : "Parolni Yangilash"}
              </GlassButton>
            </div>
          </form>
        )}
      </div>

      {showSlipModal && successInfo && user && (
        <OnboardingSlipModal
          open={showSlipModal}
          onClose={() => setShowSlipModal(false)}
          title={`Hisob Varaqasi — @${successInfo.username}`}
          records={[
            {
              id: user.id,
              fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Foydalanuvchi',
              username: successInfo.username,
              temporaryPassword: successInfo.password,
              role: user.role,
              organizationName: user.organization?.name,
              mustChangePassword: true,
            },
          ]}
        />
      )}
    </GlassModal>
  );
}
