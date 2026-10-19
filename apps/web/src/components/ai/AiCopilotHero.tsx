/**
 * AiCopilotHero — Cupertino 3D Mascot Header & Category Grid
 * Matches user mockup (Image 2)
 */

import { motion } from 'framer-motion';

interface AiCopilotHeroProps {
  onPickCategory: (prompt: string) => void;
}

export function AiCopilotHero({ onPickCategory }: AiCopilotHeroProps) {
  const categories = [
    {
      title: 'Hisobot yaratish',
      desc: 'Davomat, to\'lov, baho va boshqa hisobotlar',
      prompt: 'Bugungi davomat va to\'lov hisobotini tayyorlab ber',
      bg: 'bg-indigo-500/10 hover:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-500/20',
      iconBg: 'bg-indigo-500 text-white',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      title: 'Ma\'lumot topish',
      desc: 'O\'quvchilar, o\'qituvchilar, sinflar haqida savollar',
      prompt: '9-A sinf o\'quvchilari va o\'qituvchilari haqida to\'liq ma\'lumot ber',
      bg: 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/20',
      iconBg: 'bg-emerald-500 text-white',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      title: 'Jadval va reja',
      desc: 'Dars jadvali, xonalar, o\'qituvchilar yuklamasi',
      prompt: 'Ertangi dars jadvali va bo\'sh xonalar holatini ko\'rsat',
      bg: 'bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/20',
      iconBg: 'bg-amber-500 text-white',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      title: 'Amallar bajarish',
      desc: 'Yangi o\'quvchi qo\'shish, ma\'lumotlarni yangilash',
      prompt: 'Yangi o\'quvchini tizimga ro\'yxatdan o\'tkazishga yordam ber',
      bg: 'bg-purple-500/10 hover:bg-purple-500/15 text-purple-700 dark:text-purple-300 dark:bg-purple-500/20',
      iconBg: 'bg-purple-500 text-white',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-white/70 p-6 sm:p-7 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] backdrop-blur-md dark:bg-[#12141c]/70">
      {/* Ambient gradient aura */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-purple-500/20 via-sky-500/15 to-transparent blur-3xl" />

      {/* Top Hero Section matching Image 1: Left Title + Center 3D Mascot + Right Speech Bubble */}
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-black/[0.05] dark:border-white/[0.05]">
        {/* Left: AI Copilot Title + Beta badge + Subtitle */}
        <div className="space-y-2 text-center md:text-left flex-1 max-w-sm">
          <div className="flex items-center justify-center md:justify-start gap-2.5">
            <span className="flex text-indigo-600 dark:text-indigo-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z" />
              </svg>
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#111827] dark:text-white">
              AI Copilot
            </h1>
            <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
              Beta
            </span>
          </div>

          <p className="text-xs sm:text-[13px] font-medium leading-relaxed text-[#6B7280] dark:text-[#9CA3AF]">
            M-EDU platformasining aqlli yordamchisi. Savol bering, buyruq bering, hisobot oling.
          </p>
        </div>

        {/* Center: 3D Robot Mascot */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-full shadow-[0_16px_40px_rgba(99,102,241,0.25)] ring-4 ring-white/90 dark:ring-white/10 bg-indigo-50 dark:bg-indigo-950/40"
        >
          <img
            src="/assets/ai/robot-mascot.jpg"
            alt="M-EDU 3D Robot Mascot"
            className="h-full w-full object-cover"
          />
        </motion.div>

        {/* Right: Speech Bubble matching Image 1 */}
        <div className="relative flex-1 max-w-sm rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5 text-left">
          <div className="text-xs sm:text-[13px] font-bold text-[#111827] dark:text-white">
            Salom! 👋
          </div>
          <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Men AI Copilot.
          </div>
          <div className="mt-1 text-[11px] sm:text-xs leading-relaxed text-[#6B7280] dark:text-[#9CA3AF]">
            Ta'lim jarayonini oson va samarali boshqarishda sizga yordam beraman.
          </div>
        </div>
      </div>

      {/* 4 Prompt Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-6">
        {categories.map((cat) => (
          <button
            key={cat.title}
            type="button"
            onClick={() => onPickCategory(cat.prompt)}
            className={`flex items-start gap-3 rounded-2xl p-4 text-left transition-all hover:scale-[1.02] shadow-sm ${cat.bg}`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${cat.iconBg}`}>
              {cat.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-[13px] font-black tracking-tight text-[var(--text-primary)]">
                {cat.title}
              </div>
              <div className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)] line-clamp-2">
                {cat.desc}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
