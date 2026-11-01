/**
 * M-EDU Acoustic Sound Studio
 * Interactive Luxury Audio & Haptic Feedback Controller for Apple VisionOS / Taptic Audio
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  usePremiumSound,
  type AcousticPreset,
} from '@/hooks/usePremiumSound';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassBadge } from '@/components/ui/GlassBadge';
import { GlassButton } from '@/components/ui/GlassButton';

interface SoundPresetMeta {
  id: AcousticPreset;
  title: string;
  category: 'interaction' | 'financial' | 'biometric' | 'communication';
  description: string;
  harmonic: string;
}

const PRESET_CATALOG: SoundPresetMeta[] = [
  {
    id: 'pop',
    title: 'Fluid Capsule Pop',
    category: 'interaction',
    description: "Apple VisionOS fazoviy suyuq kapsula ochilish rezonansi",
    harmonic: '880 Hz → 1320 Hz',
  },
  {
    id: 'tick',
    title: 'Tactile Glass Click',
    category: 'interaction',
    description: 'Digital Crown va Taptic Engine ikki qatlamli shisha mikrosnap',
    harmonic: '1600 Hz + 3.2 kHz',
  },
  {
    id: 'switch',
    title: 'Ceramic Switch',
    category: 'interaction',
    description: "Aniq keramika o'tkazgich mikrotakillashi",
    harmonic: '2400 Hz → 1350 Hz',
  },
  {
    id: 'success',
    title: 'Diamond Confirmation',
    category: 'financial',
    description: 'Apple Pay va hashamatli soat akustik xitoy triada chimi',
    harmonic: 'F#5 • A#5 • C#6 • F#6',
  },
  {
    id: 'payment',
    title: 'Golden Metal Coins',
    category: 'financial',
    description: "To'lovlar va invoys qabuli uchun qimmatbaho metall jaranglashi",
    harmonic: '2093 Hz • 2637 Hz',
  },
  {
    id: 'celebration',
    title: 'Pentatonic Cascade',
    category: 'financial',
    description: "O'quvchi yutuqlari va gamifikatsiya darajasining ko'tarilish chimi",
    harmonic: 'C5 → G6 (6-nota)',
  },
  {
    id: 'faceid_match',
    title: 'Face ID Match',
    category: 'biometric',
    description: "Turniket va kamerada shaxs muvaffaqiyatli tasdiqlanganda",
    harmonic: 'G#5 → D#6 + Shimmer',
  },
  {
    id: 'faceid_denied',
    title: 'Biometric Refusal',
    category: 'biometric',
    description: "Yuz tanilmaganda yoki anti-spoofing to'sig'ida yumshoq ogohlantirish",
    harmonic: '196 Hz → 115 Hz',
  },
  {
    id: 'shutter',
    title: 'Leica Focal Shutter',
    category: 'biometric',
    description: "Yuzni ro'yxatga olish va kamera suratga olishida mexanik pardali qisqich",
    harmonic: '750 Hz + Noise + Spring',
  },
  {
    id: 'laser_scan',
    title: 'Biometric Radar',
    category: 'biometric',
    description: 'Jonli skanerlash va hudud tekshiruvi shiviri',
    harmonic: '1400 Hz → 950 Hz',
  },
  {
    id: 'notification',
    title: 'Ethereal Droplet',
    category: 'communication',
    description: 'Telegram va tizim bildirishnomalarida toza shisha tomchisi',
    harmonic: 'C6 + G6 + C7',
  },
  {
    id: 'sent',
    title: 'Airfoil Swoop',
    category: 'communication',
    description: "Xabarnoma yoki uy vazifasi jo'natilganda aerodinamik parvoz",
    harmonic: '650 Hz → 1550 Hz',
  },
  {
    id: 'delete',
    title: 'Acoustic Disposal',
    category: 'communication',
    description: "O'chirish yoki arxivlashda past chastotali yog'och qutisi qulashi",
    harmonic: '190 Hz → 95 Hz',
  },
  {
    id: 'error',
    title: 'Tactile Felt Bump',
    category: 'interaction',
    description: "Xatoliklarda quloqni charchatmaydigan yumshoq mato zarbasi",
    harmonic: '220 Hz • 175 Hz',
  },
];

const CATEGORY_NAMES: Record<SoundPresetMeta['category'], string> = {
  interaction: 'Navigatsiya va Taktil',
  financial: 'Moliya va Yutuqlar',
  biometric: 'Biometrika va Face ID',
  communication: 'Aloqa va Xabarlar',
};

export function AcousticSoundStudio() {
  const {
    isMuted,
    volume,
    hapticsEnabled,
    toggleMute,
    setVolume,
    setHapticsEnabled,
    playPreset,
  } = usePremiumSound();

  const [activePreset, setActivePreset] = useState<AcousticPreset | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | SoundPresetMeta['category']>('all');

  const handleTestSound = useCallback(
    (id: AcousticPreset) => {
      setActivePreset(id);
      playPreset(id);
      setTimeout(() => {
        setActivePreset((prev) => (prev === id ? null : prev));
      }, 600);
    },
    [playPreset]
  );

  const filteredPresets = PRESET_CATALOG.filter(
    (item) => selectedFilter === 'all' || item.category === selectedFilter
  );

  return (
    <div className="space-y-6">
      {/* 1. MASTER AUDIO BOSHQARUVI BANNERI */}
      <GlassCard className="relative overflow-hidden p-5 border border-black/[0.08] dark:border-white/[0.08]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                isMuted
                  ? 'bg-red-500/10 text-red-500 dark:bg-red-500/20'
                  : 'bg-primary-500/10 text-primary-500 dark:bg-primary-500/20'
              }`}
            >
              {isMuted ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  M-EDU Fazoviy Akustika va Taktil Tizimi
                </h3>
                <GlassBadge variant={isMuted ? 'danger' : 'success'}>
                  {isMuted ? "O'chirilgan" : 'Faol'}
                </GlassBadge>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Apple VisionOS va Taptic dvigateliga asoslangan mikro-fizik tovushlar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              variant={isMuted ? 'primary' : 'secondary'}
              size="sm"
              onClick={toggleMute}
            >
              {isMuted ? "Ovozni yoqish" : "Ovozni o'chirish"}
            </GlassButton>
            <GlassButton
              variant={hapticsEnabled ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setHapticsEnabled(!hapticsEnabled)}
              title="Mobil qurilmalarda tebranish (haptic feedback)"
            >
              Taktil: {hapticsEnabled ? 'Yoqilgan' : "O'chiq"}
            </GlassButton>
          </div>
        </div>

        {/* VOLUME SLIDER */}
        <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
            <span>Asosiy Ovoz Balandligi (Master Volume)</span>
            <span className="font-mono text-primary-500 font-bold">
              {Math.round(volume * 100)}%
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs text-[var(--text-muted)]">0%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              disabled={isMuted}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-black/[0.08] dark:bg-white/[0.1] accent-primary-500 disabled:opacity-50"
            />
            <span className="text-xs text-[var(--text-muted)]">100%</span>
          </div>
        </div>
      </GlassCard>

      {/* 2. KATEGORIYA FILTRLARI */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            selectedFilter === 'all'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'border border-black/[0.08] bg-black/[0.03] text-[var(--text-secondary)] hover:bg-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]'
          }`}
        >
          Barchasi ({PRESET_CATALOG.length})
        </button>
        {(Object.keys(CATEGORY_NAMES) as Array<SoundPresetMeta['category']>).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              selectedFilter === cat
                ? 'bg-primary-500 text-white shadow-sm'
                : 'border border-black/[0.08] bg-black/[0.03] text-[var(--text-secondary)] hover:bg-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04]'
            }`}
          >
            {CATEGORY_NAMES[cat]}
          </button>
        ))}
      </div>

      {/* 3. INTERAKTIV SOUNDBOARD PRESETLARI GRIDI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPresets.map((preset) => {
          const isPlaying = activePreset === preset.id;
          return (
            <motion.div
              key={preset.id}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="group cursor-pointer"
              onClick={() => handleTestSound(preset.id)}
            >
              <GlassCard
                className={`relative flex h-full flex-col justify-between p-4 transition-all ${
                  isPlaying
                    ? 'border-primary-500/50 bg-primary-500/[0.06] shadow-md dark:border-primary-400/50 dark:bg-primary-400/[0.08]'
                    : 'border-black/[0.06] hover:border-black/[0.12] dark:border-white/[0.08] dark:hover:border-white/[0.16]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">
                      {preset.title}
                    </h4>
                    {/* Live Waveform Indicator when playing */}
                    {isPlaying ? (
                      <div className="flex h-5 items-end gap-0.5">
                        <motion.span
                          animate={{ height: ['4px', '16px', '4px'] }}
                          transition={{ repeat: Infinity, duration: 0.3 }}
                          className="w-1 rounded-full bg-primary-500"
                        />
                        <motion.span
                          animate={{ height: ['8px', '20px', '6px'] }}
                          transition={{ repeat: Infinity, duration: 0.35, delay: 0.05 }}
                          className="w-1 rounded-full bg-primary-500"
                        />
                        <motion.span
                          animate={{ height: ['4px', '14px', '4px'] }}
                          transition={{ repeat: Infinity, duration: 0.28, delay: 0.1 }}
                          className="w-1 rounded-full bg-primary-500"
                        />
                      </div>
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/[0.08] bg-black/[0.02] text-[var(--text-muted)] group-hover:border-primary-500/40 group-hover:text-primary-500 dark:border-white/[0.08] dark:bg-white/[0.04]">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-black/[0.04] pt-2 dark:border-white/[0.04]">
                  <span className="font-mono text-[10.5px] text-[var(--text-muted)]">
                    {preset.harmonic}
                  </span>
                  <span className="text-[10.5px] font-medium text-primary-500">
                    Tinglash →
                  </span>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default AcousticSoundStudio;
