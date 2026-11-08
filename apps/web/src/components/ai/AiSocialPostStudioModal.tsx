'use client';

/**
 * ============================================================================
 * M-EDU — AI SMM & E’lonlar Studiyasi (`AiSocialPostStudioModal.tsx`) — V2
 * ============================================================================
 * Liquid Glass modal: Telegram / Instagram / Facebook / SMS uchun e’lon matnlari.
 *
 * V2 da nimalar tuzatildi / qo‘shildi:
 *  - Preview endi *generatsiya qilingan* platformani ko‘rsatadi (avval platforma
 *    almashsa, SMS matni Instagram kartasida chiqib qolardi).
 *  - Poyga holati (race condition): modal yopilsa yoki qayta bosilsa eski javob
 *    yangisini ustiga yozmaydi; 30 soniyalik timeout → lokal shablon.
 *  - To‘g‘ri SMS hisobi: GSM-7 (+kengaytma belgilar = 2 birlik) va Unicode (UCS-2),
 *    "o‘/g‘" egri apostroflar sabab 70 belgilik segmentga tushib qolishi ogohlantiriladi,
 *    bitta tugma bilan GSM-7 ga moslash.
 *  - Belgi limiti endi *butun post* (matn + teglar) bo‘yicha hisoblanadi
 *    (Instagram 2200 limiti teglarni ham o‘z ichiga oladi), Telegram rasmli post 1024.
 *  - Soxta raqamlar olib tashlandi ("92% bitiruvchi", "atigi 3 ta joy", "👁 1.8K",
 *    "Sponsored", "35% ko‘proq qamrov"). Marketing matnida tasdiqlanmagan da’vo
 *    huquqiy xavf — buning o‘rniga da’volarni aniqlovchi "Tekshiruv" paneli bor.
 *  - Konversiya bahosi: shaffof tekshiruv ro‘yxati (nima yetishmayapti + tavsiya).
 *  - Fokus tuzoq (focus trap), Esc, fokusni qaytarish, aria-live, prefers-reduced-motion,
 *    iOS zoom bo‘lmasligi uchun 16px input, safe-area, 100dvh.
 *  - Telegram WebApp: ulashish `openTelegramLink` orqali, uzun matn → nusxalash.
 *  - Tahrirlangan variantni asl holatiga qaytarish, teglarni normallashtirish.
 *  - Sound/haptics hooklari ref orqali — keraksiz qayta renderlar yo‘q.
 *
 * Eksport qilingan tiplar va props o‘zgarmagan (orqaga mos).
 * ============================================================================
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  Bell,
  Bookmark,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit3,
  Eraser,
  Eye,
  Flame,
  Gift,
  Heart,
  Image as ImageIcon,
  MapPin,
  Megaphone,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Rocket,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  Target,
  ThumbsUp,
  Trophy,
  Users,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { aiApi } from '@/lib/api';
import { cn } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';

// ============================================================================
// TYPES (public API — o‘zgarmagan)
// ============================================================================

export type SocialPlatform = 'TELEGRAM' | 'INSTAGRAM' | 'FACEBOOK' | 'SMS';

export type SocialGoal =
  | 'NEW_GROUP'
  | 'DISCOUNT_OFFER'
  | 'EVENT'
  | 'EXAM_RESULTS'
  | 'PARENT_NOTICE'
  | 'GENERAL';

export type SocialTone = 'exciting' | 'professional' | 'urgent' | 'friendly';

export interface SocialPostVariant {
  id: string;
  styleName: string;
  hook: string;
  content: string;
  hashtags: string[];
  callToAction: string;
  characterCount?: number;
  estimatedReadTime?: string;
}

export interface SocialPostResponse {
  topic: string;
  platform: SocialPlatform;
  goal: SocialGoal;
  tone: SocialTone;
  targetAudience?: string;
  variants: SocialPostVariant[];
  suggestedVisuals?: string[];
  bestPostingTime?: string;
  complianceTips?: string[];
}

export interface AiSocialPostStudioModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  defaultTopic?: string;
  defaultPlatform?: SocialPlatform;
  defaultGoal?: SocialGoal;
}

type IconType = React.ComponentType<{ className?: string }>;

interface FormState {
  topic: string;
  platform: SocialPlatform;
  goal: SocialGoal;
  tone: SocialTone;
  targetAudience: string;
  priceOffer: string;
  callToAction: string;
  contactPhone: string;
  centerAddress: string;
}

// ============================================================================
// CONFIG
// ============================================================================

const GENERATION_TIMEOUT_MS = 30_000;
const SMS_TARGET_UNITS = 306; // 2 ta GSM-7 segment (153 × 2)
const TELEGRAM_SHARE_MAX_ENCODED = 3900;

const PLATFORMS: ReadonlyArray<{
  id: SocialPlatform;
  label: string;
  badge: string;
  previewTitle: string;
  maxChars: number;
  /** Platformaning "yumshoq" limiti (masalan rasm bilan Telegram post). */
  softLimit?: { value: number; hint: string };
  bestTime: string;
  gradient: string;
  activeBorder: string;
  activeBg: string;
  iconBg: string;
  Icon: IconType;
}> = [
  {
    id: 'TELEGRAM',
    label: 'Telegram',
    badge: 'Kanal va guruh',
    previewTitle: 'Telegram kanal ko‘rinishi',
    maxChars: 4096,
    softLimit: { value: 1024, hint: 'Rasm yoki video bilan yuborilsa, matn 1024 belgigacha.' },
    bestTime: '18:30 – 21:00 oralig‘i ko‘pincha faol bo‘ladi. O‘z kanalingiz statistikasi bilan tekshiring.',
    gradient: 'from-sky-500 to-blue-600',
    activeBorder: 'border-sky-500/80 dark:border-sky-400/80',
    activeBg: 'bg-sky-500/10 dark:bg-sky-500/15',
    iconBg: 'bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-sky-500/25',
    Icon: Send,
  },
  {
    id: 'INSTAGRAM',
    label: 'Instagram',
    badge: 'Post va Reels',
    previewTitle: 'Instagram lenta ko‘rinishi',
    maxChars: 2200,
    softLimit: { value: 125, hint: 'Birinchi 125 belgidan keyin "ko‘proq" chiqadi — jalb qiluvchi gap shu yerda bo‘lsin.' },
    bestTime: '19:00 – 21:30 oralig‘i odatda yaxshi natija beradi. Insights bo‘limidan tekshiring.',
    gradient: 'from-pink-500 via-rose-500 to-amber-500',
    activeBorder: 'border-rose-500/80 dark:border-rose-400/80',
    activeBg: 'bg-rose-500/10 dark:bg-rose-500/15',
    iconBg: 'bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 text-white shadow-rose-500/25',
    Icon: Share2,
  },
  {
    id: 'FACEBOOK',
    label: 'Facebook',
    badge: 'Rasmiy sahifa',
    previewTitle: 'Facebook sahifa posti',
    maxChars: 5000,
    bestTime: 'Ish kunlari 12:00 – 14:00 va 19:00 – 21:00. O‘z sahifangiz statistikasini kuzating.',
    gradient: 'from-blue-600 to-indigo-700',
    activeBorder: 'border-indigo-500/80 dark:border-indigo-400/80',
    activeBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    iconBg: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-indigo-500/25',
    Icon: ThumbsUp,
  },
  {
    id: 'SMS',
    label: 'SMS xabar',
    badge: 'Qisqa va aniq',
    previewTitle: 'SMS simulyatori',
    maxChars: 320,
    bestTime: '09:30 – 11:30 yoki 17:00 – 19:00. Kechqurun 21:00 dan keyin yubormang.',
    gradient: 'from-emerald-500 to-teal-600',
    activeBorder: 'border-emerald-500/80 dark:border-emerald-400/80',
    activeBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/25',
    Icon: MessageSquare,
  },
];

const GOALS: ReadonlyArray<{ id: SocialGoal; label: string; Icon: IconType; accent: string }> = [
  { id: 'NEW_GROUP', label: 'Yangi guruh qabuli', Icon: Rocket, accent: 'text-violet-500' },
  { id: 'DISCOUNT_OFFER', label: 'Aksiya va chegirma', Icon: Gift, accent: 'text-rose-500' },
  { id: 'EVENT', label: 'Ochiq dars, master-klass', Icon: Target, accent: 'text-sky-500' },
  { id: 'EXAM_RESULTS', label: 'Imtihon natijalari', Icon: Trophy, accent: 'text-amber-500' },
  { id: 'PARENT_NOTICE', label: 'Ota-onalar majlisi', Icon: Users, accent: 'text-emerald-500' },
  { id: 'GENERAL', label: 'Umumiy e’lon', Icon: Bell, accent: 'text-indigo-500' },
];

const TONES: ReadonlyArray<{ id: SocialTone; label: string; desc: string; Icon: IconType }> = [
  { id: 'exciting', label: 'Jo‘shqin', desc: 'Yorqin va dinamik', Icon: Zap },
  { id: 'professional', label: 'Rasmiy', desc: 'Ishonchli, akademik', Icon: ShieldCheck },
  { id: 'urgent', label: 'Shoshilinch', desc: 'Muddat va joy cheklovi', Icon: Flame },
  { id: 'friendly', label: 'Samimiy', desc: 'Iliq va do‘stona', Icon: Heart },
];

const QUICK_TOPICS: ReadonlyArray<{ label: string; goal: SocialGoal; offer?: string }> = [
  { label: 'IELTS 7.5+ Intensive', goal: 'NEW_GROUP', offer: 'Birinchi 10 o‘quvchiga 20% chegirma' },
  { label: 'Frontend React va Next.js', goal: 'NEW_GROUP', offer: 'Birinchi dars bepul' },
  { label: 'Milliy sertifikat va DTM Matematika', goal: 'EVENT' },
  { label: 'Kids English', goal: 'DISCOUNT_OFFER', offer: 'Aka-singillar uchun 25% chegirma' },
];

const DEFAULT_STYLE_NAMES = [
  'Dinamik va jalb qiluvchi',
  'Akademik va nufuzli',
  'Tezkor qaror (FOMO)',
] as const;

const VARIANT_ICONS: ReadonlyArray<IconType> = [Flame, Building2, AlertCircle];

const INITIAL_FORM: FormState = {
  topic: '',
  platform: 'TELEGRAM',
  goal: 'NEW_GROUP',
  tone: 'exciting',
  targetAudience: '',
  priceOffer: '',
  callToAction: '',
  contactPhone: '',
  centerAddress: '',
};

// ============================================================================
// STYLE TOKENS
// ============================================================================

const eyebrow = 'text-xs font-semibold text-zinc-500 dark:text-zinc-400';
const inputCls =
  'w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 px-3.5 py-2.5 ' +
  'text-[16px] sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 ' +
  'focus:border-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25 transition-colors';
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent';
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 ' +
  'hover:bg-zinc-50 dark:hover:bg-zinc-700 px-3 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-colors';

// ============================================================================
// PURE UTILITIES
// ============================================================================

const countChars = (s: string): number => Array.from(s).length;

/** Egri/turli apostroflarni to‘g‘ri ASCII ko‘rinishga keltiradi (regex tekshiruvlari uchun). */
const normalizeForMatch = (s: string): string => s.toLowerCase().replace(/[‘’ʻʼ`´]/g, "'");

function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(8, Math.round((words / 180) * 60));
  return seconds < 60 ? `${seconds} soniya` : `${Math.round(seconds / 60)} daqiqa`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function trimToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

// ---------- SMS: GSM-7 / Unicode ------------------------------------------

const GSM_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
const GSM_EXTENDED = new Set(Array.from('^{}\\[~]|€')); // har biri 2 birlik

export interface SmsMetrics {
  encoding: 'GSM-7' | 'Unicode';
  units: number;
  segments: number;
  perSegment: number;
  offending: string[];
}

export function analyzeSms(text: string): SmsMetrics {
  let units = 0;
  let unicode = false;
  const offending = new Set<string>();

  for (const ch of text) {
    if (GSM_BASIC.has(ch)) units += 1;
    else if (GSM_EXTENDED.has(ch)) units += 2;
    else {
      unicode = true;
      offending.add(ch);
    }
  }

  if (unicode) {
    units = text.length; // UCS-2: UTF-16 birliklari (emoji = 2)
    const segments = units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67);
    return { encoding: 'Unicode', units, segments, perSegment: units <= 70 ? 70 : 67, offending: [...offending] };
  }
  const segments = units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153);
  return { encoding: 'GSM-7', units, segments, perSegment: units <= 160 ? 160 : 153, offending: [] };
}

const SMS_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/[‘’ʻʼ`´]/g, "'"],
  [/[“”«»„]/g, '"'],
  [/[–—−]/g, '-'],
  [/…/g, '...'],
  [/[•·]/g, '-'],
  [/\u00A0/g, ' '],
];

/** Matnni GSM-7 ga moslaydi: egri apostrof → ', emoji va nostandart belgilar olib tashlanadi. */
export function toSmsSafe(text: string): string {
  let out = text;
  for (const [re, rep] of SMS_REPLACEMENTS) out = out.replace(re, rep);
  out = Array.from(out)
    .filter((ch) => GSM_BASIC.has(ch) || GSM_EXTENDED.has(ch))
    .join('');
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- Hashtag --------------------------------------------------------

function normalizeTags(tags: ReadonlyArray<string> | undefined | null): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const body = raw
      .trim()
      .replace(/^#+/, '')
      .replace(/\s+/g, '_')
      .replace(/[^\p{L}\p{N}_]/gu, '');
    if (!body) continue;
    const key = body.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(`#${body}`);
  }
  return result;
}

// ---------- Baholash va tekshiruv -----------------------------------------

export interface ScoreCheck {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  hint: string;
}

const CTA_RE =
  /(ro'yxatdan|yoz(il|ing)|qo'ng'iroq|murojaat|bog'lan|band qiling|joy band|belgi qoldir|"\+"|batafsil|konsultatsiya|ariza|keling)/;
const CONTACT_RE =
  /(\+?998[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b|t\.me\/|@\w{4,})/;
const OFFER_RE = /(chegirma|bepul|aksiya|bonus|sovg'a|\d+\s?%|sinov dars)/;

export function computeConversionScore(
  content: string,
  hashtags: ReadonlyArray<string>,
  platform: SocialPlatform,
  exportLength: number,
): { score: number; checks: ScoreCheck[] } {
  const text = normalizeForMatch(content);
  const isSms = platform === 'SMS';
  const meta = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[0];
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  const emojiCount = (content.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const lineBreaks = (content.match(/\n/g) ?? []).length;
  const tagMax = platform === 'INSTAGRAM' ? 15 : 10;

  const checks: ScoreCheck[] = [
    {
      id: 'cta',
      label: 'Aniq harakatga chaqiruv',
      passed: CTA_RE.test(text),
      weight: 25,
      hint: 'Oxirida bitta aniq amal yozing: "Ro‘yxatdan o‘ting", "Qo‘ng‘iroq qiling".',
    },
    {
      id: 'contact',
      label: 'Aloqa ma’lumoti',
      passed: CONTACT_RE.test(text),
      weight: 20,
      hint: 'Telefon raqam yoki @username qo‘shing — usiz mijoz sizni topa olmaydi.',
    },
    {
      id: 'offer',
      label: 'Foyda yoki taklif',
      passed: OFFER_RE.test(text),
      weight: 15,
      hint: 'Chegirma, bepul sinov darsi yoki bonus kabi aniq foyda ko‘rsating.',
    },
    {
      id: 'fit',
      label: isSms ? 'SMS 2 segmentdan oshmaydi' : 'Platforma limitiga sig‘adi',
      passed: isSms ? analyzeSms(content).segments <= 2 : exportLength <= meta.maxChars,
      weight: 15,
      hint: isSms
        ? 'Matnni qisqartiring yoki GSM-7 ga moslang.'
        : `Post ${meta.maxChars} belgidan oshmasligi kerak.`,
    },
  ];

  if (!isSms) {
    checks.push(
      {
        id: 'hook',
        label: 'Birinchi qator qisqa',
        passed: firstLine.length > 0 && firstLine.length <= (platform === 'INSTAGRAM' ? 125 : 110),
        weight: 10,
        hint: 'Birinchi qator 1–2 soniyada o‘qilishi kerak: asosiy foydani shu yerga yozing.',
      },
      {
        id: 'scan',
        label: 'Oson o‘qiladi',
        passed: lineBreaks >= 3 && emojiCount >= 1 && emojiCount <= 10,
        weight: 8,
        hint: 'Abzaslarga bo‘ling va 1–10 ta emoji bilan ajrating.',
      },
      {
        id: 'tags',
        label: 'Teglar miqdori me’yorda',
        passed: hashtags.length >= 2 && hashtags.length <= tagMax,
        weight: 7,
        hint: `2–${tagMax} ta mavzuga oid teg yetarli.`,
      },
    );
  }

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), checks };
}

const CLAIM_RULES: ReadonlyArray<{ re: RegExp; msg: string }> = [
  { re: /(kafolat|100\s?%)/, msg: '"Kafolat" yoki "100%" — hujjat bilan tasdiqlay olmasangiz, olib tashlang.' },
  {
    re: /(eng (yaxshi|kuchli|mashhur|arzon)|№\s?1|birinchi o'rinda|yagona)/,
    msg: 'Ustunlik haqidagi gap ("eng yaxshi", "yagona") isbot talab qiladi.',
  },
  {
    re: /\d{1,3}\s?%\s*(bitiruvchi|o'quvchi|talaba|natija)/,
    msg: 'Natija foizi haqiqiy statistikaga tayansin va manbasi bo‘lsin.',
  },
  {
    re: /(atigi|faqat)\s+\d+\s+ta\s+(bo'sh|o'rin|joy)/,
    msg: 'Qolgan joylar soni haqiqiy bo‘lsa yozing, aks holda mijozlar ishonchi yo‘qoladi.',
  },
];

function scanClaims(content: string): string[] {
  const text = normalizeForMatch(content);
  return CLAIM_RULES.filter((r) => r.re.test(text)).map((r) => r.msg);
}

// ---------- Lokal (fallback) generator ------------------------------------

interface FallbackInput {
  topic: string;
  platform: SocialPlatform;
  goal: SocialGoal;
  tone: SocialTone;
  targetAudience?: string;
  priceOffer?: string;
  callToAction?: string;
  contactPhone?: string;
  centerAddress?: string;
}

const TONE_COPY: Record<SocialTone, { emoji: string; cta: string }> = {
  exciting: { emoji: '🚀', cta: 'Joyingizni hoziroq band qiling!' },
  professional: { emoji: '🎓', cta: 'Batafsil ma’lumot va bepul konsultatsiya uchun biz bilan bog‘laning.' },
  urgent: { emoji: '⏳', cta: 'Joylar soni cheklangan — kechiktirmang!' },
  friendly: { emoji: '💛', cta: 'Savollaringiz bo‘lsa yozing, mamnuniyat bilan yordam beramiz!' },
};

const GOAL_COPY: Record<
  SocialGoal,
  { emoji: string; hook: (t: string) => string; intro: string; points: string[]; sms: (t: string) => string }
> = {
  NEW_GROUP: {
    emoji: '🚀',
    hook: (t) => `"${t}" bo‘yicha yangi guruhga qabul ochildi!`,
    intro: 'Bilimni amaliyotda mustahkamlamoqchi bo‘lganlar uchun yangi o‘quv guruhi darslarini boshlamoqda.',
    points: [
      '• Amaliy mashg‘ulotlar va real misollar',
      '• Tajribali ustozlar nazorati',
      '• Muntazam oraliq sinovlar va natija tahlili',
    ],
    sms: (t) => `"${t}" bo'yicha yangi guruhga qabul ochiq.`,
  },
  DISCOUNT_OFFER: {
    emoji: '🎁',
    hook: (t) => `"${t}" kursi uchun maxsus taklif!`,
    intro: 'Ta’limga sarmoya — kelajak uchun eng to‘g‘ri qaror. Taklifdan foydalanish muddati cheklangan.',
    points: [
      '• To‘liq o‘quv dasturi qulay narxda',
      '• O‘quv materiallari bilan ta’minlanadi',
      '• Dars jarayoni bilan oldindan tanishish imkoni',
    ],
    sms: (t) => `"${t}" kursiga maxsus taklif!`,
  },
  EVENT: {
    emoji: '🎯',
    hook: (t) => `"${t}" bo‘yicha ochiq dars va master-klassga taklif!`,
    intro: 'Metodika va amaliy ko‘nikmalar bilan yaqindan tanishish uchun tadbirimizga marhamat.',
    points: [
      '• Ekspert ustozlardan jonli master-klass',
      '• Savol-javob va shaxsiy tavsiyalar',
      '• Kurs dasturi bilan batafsil tanishuv',
    ],
    sms: (t) => `"${t}" bo'yicha ochiq darsga taklif qilamiz.`,
  },
  EXAM_RESULTS: {
    emoji: '🏆',
    hook: (t) => `"${t}" bo‘yicha o‘quvchilarimiz natijalari!`,
    intro: 'Muntazam mehnat va tizimli metodika samarasini ko‘rsatmoqda. Barcha o‘quvchilarimizni tabriklaymiz!',
    points: [
      '• Har bir o‘quvchi bilan xatolar ustida alohida ishlanadi',
      '• Doimiy mashq va nazorat testlari',
      '• Keyingi guruhda siz ham o‘z natijangizga erishing',
    ],
    sms: (t) => `"${t}" bo'yicha imtihon natijalari e'lon qilindi.`,
  },
  PARENT_NOTICE: {
    emoji: '👨‍👩‍👧',
    hook: (t) => `Ota-onalar uchun muhim e’lon: ${t}`,
    intro: 'Farzandingizning o‘zlashtirishi, davomati va keyingi o‘quv rejasini muhokama qilish uchun sizni markazimizga taklif etamiz.',
    points: [
      '• O‘quvchilarning oylik natijalari tahlili',
      '• Ustozlar bilan yuzma-yuz suhbat',
      '• Keyingi bosqich dasturi bilan tanishuv',
    ],
    sms: (t) => `Ota-onalar majlisi: ${t}.`,
  },
  GENERAL: {
    emoji: '📢',
    hook: (t) => `M-EDU markazidan e’lon: ${t}`,
    intro: 'O‘quvchilar va ota-onalar uchun qulay hamda sifatli ta’lim muhitini yaratishda davom etamiz.',
    points: [
      '• Yangilangan o‘quv dasturi',
      '• Samarali dars jarayoni',
      '• Doimiy qo‘llab-quvvatlash',
    ],
    sms: (t) => `${t}.`,
  },
};

const compact = (rows: ReadonlyArray<string | false | null | undefined>): string =>
  rows
    .filter((r): r is string => typeof r === 'string')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function buildTags(topic: string, platform: SocialPlatform, goal: SocialGoal, extra: string[]): string[] {
  if (platform === 'SMS') return [];
  const slug = topic
    .toLowerCase()
    .replace(/[‘’ʻʼ']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  const year = new Date().getFullYear();
  const base = [
    slug.length >= 3 && slug.length <= 30 ? slug : '',
    'medu',
    'talim',
    goal === 'NEW_GROUP' || goal === 'DISCOUNT_OFFER' ? `qabul${year}` : '',
    ...extra,
  ].filter(Boolean);
  const limit = platform === 'INSTAGRAM' ? 8 : platform === 'TELEGRAM' ? 5 : 3;
  return normalizeTags(base).slice(0, limit);
}

export function buildSocialFallback(input: FallbackInput): SocialPostResponse {
  const { topic, platform, goal, tone } = input;
  const audience = input.targetAudience?.trim();
  const offer = input.priceOffer?.trim();
  const customCta = input.callToAction?.trim();
  const phone = input.contactPhone?.trim();
  const address = input.centerAddress?.trim();
  const g = GOAL_COPY[goal];
  const toneCopy = TONE_COPY[tone];
  const meta = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[0];

  const common = {
    topic,
    platform,
    goal,
    tone,
    targetAudience: audience || undefined,
    bestPostingTime: meta.bestTime,
    complianceTips: [
      'Sana, vaqt va narxni tekshirib, aniq yozing.',
      goal === 'EXAM_RESULTS'
        ? 'Natijalarni e’lon qilishdan oldin o‘quvchi yoki ota-onasidan ruxsat oling, ball va ismlarni haqiqiy ma’lumot bilan almashtiring.'
        : 'Chegirma muddati va shartlarini matnda ko‘rsating.',
    ],
  };

  // ---------------- SMS ----------------
  if (platform === 'SMS') {
    const finish = (raw: string) => trimToLimit(toSmsSafe(raw), SMS_TARGET_UNITS);
    const tel = phone ? `Tel: ${phone}` : '';
    const cta = customCta || 'Joyingizni band qiling.';
    return {
      ...common,
      suggestedVisuals: ['Qisqa havola (t.me yoki bit.ly) qo‘shsangiz, bosish soni oshadi.'],
      variants: [
        {
          id: 'sms_a',
          styleName: 'Qisqa va aniq',
          hook: g.sms(topic),
          content: finish(`M-EDU: ${g.sms(topic)} ${offer ? offer + '.' : ''} ${cta} ${tel}`),
          hashtags: [],
          callToAction: customCta || 'Qo‘ng‘iroq qiling',
        },
        {
          id: 'sms_b',
          styleName: 'Rasmiy xabarnoma',
          hook: 'Hurmatli ota-onalar va o‘quvchilar!',
          content: finish(
            `Hurmatli ota-onalar va o'quvchilar! ${g.sms(topic)} ${address ? 'Manzil: ' + address + '.' : ''} ${
              phone ? "Ma'lumot uchun: " + phone : ''
            }`,
          ),
          hashtags: [],
          callToAction: 'Batafsil ma’lumot oling',
        },
        {
          id: 'sms_c',
          styleName: 'Shoshilinch',
          hook: 'Shoshiling!',
          content: finish(
            `Shoshiling! ${g.sms(topic)} ${offer ? offer + '.' : 'Joylar soni cheklangan.'} ${tel}`,
          ),
          hashtags: [],
          callToAction: 'Hoziroq bog‘laning',
        },
      ],
    };
  }

  // ---------------- Telegram / Instagram / Facebook ----------------
  const igNote = platform === 'INSTAGRAM' ? 'Batafsil: profil havolasi yoki Direct orqali.' : '';
  const audienceRow = audience ? `👥 Kimlar uchun: ${audience}` : false;
  const offerRow = offer ? `🎁 Maxsus taklif: ${offer}` : false;
  const phoneRow = phone ? `📞 ${phone}` : false;
  const addressRow = address ? `📍 ${address}` : false;
  const igRow = igNote ? `ℹ️ ${igNote}` : false;
  const cta = customCta || toneCopy.cta;

  const variantA = compact([
    `${g.emoji} ${g.hook(topic)}`,
    '',
    g.intro,
    audienceRow,
    '',
    '✨ Nimalar kutmoqda:',
    ...g.points,
    offerRow ? `\n${offerRow}` : false,
    '',
    `👉 ${cta}`,
    phoneRow,
    addressRow,
    igRow,
  ]);

  const variantB = compact([
    '🏛 Hurmatli ota-onalar va o‘quvchilar!',
    '',
    `Markazimizda "${topic}" yo‘nalishi bo‘yicha o‘quv dasturiga e’tiboringizni qaratamiz.`,
    audienceRow,
    '',
    '📌 Dasturning asosiy jihatlari:',
    ...g.points,
    offerRow ? `\n${offerRow}` : false,
    '',
    `💼 ${customCta || TONE_COPY.professional.cta}`,
    phoneRow,
    addressRow,
    igRow,
  ]);

  const variantC = compact([
    `⏳ "${topic}": qabul yakunlanmoqda`,
    '',
    'Guruh darslarni boshlashga tayyorlanmoqda, joylar soni cheklangan.',
    audienceRow,
    '',
    offerRow || '💥 Bugun murojaat qilganlar uchun sinov darsi haqida so‘rang.',
    '',
    `🛑 ${customCta || 'Vaqtni boy bermang — hoziroq qo‘ng‘iroq qiling yoki yozing.'}`,
    phoneRow,
    addressRow,
    igRow,
  ]);

  return {
    ...common,
    suggestedVisuals: [
      `1080×1350 px, "${topic}" sarlavhali toza karusel poster`,
      'Dars jarayoni va ustoz tushuntirishi aks etgan 15–30 soniyalik video',
      'Tabiiy kadrlar: haqiqiy sinf xonasi va o‘quvchilar (ruxsat bilan)',
    ],
    variants: [
      {
        id: 'variant_a',
        styleName: DEFAULT_STYLE_NAMES[0],
        hook: `${g.emoji} ${g.hook(topic)}`,
        content: variantA,
        hashtags: buildTags(topic, platform, goal, ['kurslar', 'natija']),
        callToAction: customCta || 'Ro‘yxatdan o‘ting',
      },
      {
        id: 'variant_b',
        styleName: DEFAULT_STYLE_NAMES[1],
        hook: '🏛 Hurmatli ota-onalar va o‘quvchilar!',
        content: variantB,
        hashtags: buildTags(topic, platform, goal, ['sifatli_talim', 'sertifikat']),
        callToAction: customCta || 'Konsultatsiya olish',
      },
      {
        id: 'variant_c',
        styleName: DEFAULT_STYLE_NAMES[2],
        hook: `⏳ "${topic}": qabul yakunlanmoqda`,
        content: variantC,
        hashtags: buildTags(topic, platform, goal, ['imkoniyat', 'chegirma']),
        callToAction: customCta || 'Joyingizni band qiling',
      },
    ],
  };
}

/** Server javobini ishonchli ko‘rinishga keltiradi; yaroqsiz bo‘lsa null. */
function normalizeResponse(
  raw: Partial<SocialPostResponse> | null | undefined,
  ctx: Pick<SocialPostResponse, 'topic' | 'platform' | 'goal' | 'tone' | 'targetAudience'>,
): SocialPostResponse | null {
  if (!raw || !Array.isArray(raw.variants)) return null;

  const variants: SocialPostVariant[] = raw.variants
    .filter((v): v is SocialPostVariant => !!v && typeof v.content === 'string' && v.content.trim().length > 0)
    .slice(0, 3)
    .map((v, i) => {
      const content = v.content.trim();
      return {
        ...v,
        id: v.id || `variant_${i + 1}`,
        styleName: v.styleName || DEFAULT_STYLE_NAMES[i] || `Variant ${i + 1}`,
        hook: v.hook || content.split('\n')[0] || '',
        content,
        hashtags: ctx.platform === 'SMS' ? [] : normalizeTags(v.hashtags),
        callToAction: v.callToAction || '',
        characterCount: countChars(content),
        estimatedReadTime: v.estimatedReadTime || readingTime(content),
      };
    });

  if (variants.length === 0) return null;
  return {
    ...ctx,
    suggestedVisuals: Array.isArray(raw.suggestedVisuals) ? raw.suggestedVisuals : undefined,
    bestPostingTime: raw.bestPostingTime,
    complianceTips: Array.isArray(raw.complianceTips) ? raw.complianceTips : undefined,
    variants,
  };
}

// ---------- Ulashish -------------------------------------------------------

type TelegramWindow = Window & {
  Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } };
};

/** t.me/share/url `url` parametrini talab qiladi; faqat matn yuborish uchun bo‘sh joy beramiz. */
const buildTelegramShareLink = (text: string): string =>
  `https://t.me/share/url?url=%20&text=${encodeURIComponent(text)}`;

// ============================================================================
// HOOKS
// ============================================================================

/** Sound/haptics obyektlari har renderda o‘zgarishi mumkin — barqaror interfeys beramiz. */
function useFeedback() {
  const sound = usePremiumSound();
  const haptics = useHaptics();
  const ref = useRef({ sound, haptics });
  ref.current = { sound, haptics };
  return useMemo(
    () => ({
      tick: () => ref.current.sound?.playTick?.(),
      success: () => {
        ref.current.sound?.playSuccess?.();
        ref.current.haptics?.success?.();
      },
      light: () => ref.current.haptics?.light?.(),
      medium: () => ref.current.haptics?.medium?.(),
    }),
    [],
  );
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useDialogBehavior(opts: {
  open: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocusRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { open, containerRef, initialFocusRef } = opts;
  const closeRef = useRef(opts.onClose);
  const submitRef = useRef(opts.onSubmit);
  closeRef.current = opts.onClose;
  submitRef.current = opts.onSubmit;

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    const raf = requestAnimationFrame(() => initialFocusRef.current?.focus({ preventScroll: true }));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        submitRef.current();
        return;
      }
      if (e.key === 'Tab' && containerRef.current) {
        const nodes = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => n.offsetParent !== null,
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, containerRef, initialFocusRef]);
}

function useCopyStatus() {
  const [status, setStatus] = useState<{ id: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async (text: string, id: string): Promise<boolean> => {
    if (!text) return false;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    setStatus({ id, ok });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(null), 2200);
    return ok;
  }, []);

  return { status, copy };
}

// ============================================================================
// SMALL PRESENTATIONAL PIECES
// ============================================================================

const Field = memo(function Field({
  label,
  value,
  onChange,
  placeholder,
  Icon,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  Icon?: IconType;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={cn(eyebrow, 'mb-1 block')}>
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />}
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(inputCls, Icon && 'pl-9')}
        />
      </div>
    </div>
  );
});

const PlatformPicker = memo(function PlatformPicker({
  value,
  onChange,
}: {
  value: SocialPlatform;
  onChange: (p: SocialPlatform) => void;
}) {
  const meta = PLATFORMS.find((p) => p.id === value) ?? PLATFORMS[0];
  return (
    <fieldset>
      <legend className={cn(eyebrow, 'mb-2 flex w-full items-center justify-between')}>
        <span>1. Platforma</span>
        <span className="font-medium text-zinc-400">Limit: {meta.maxChars.toLocaleString('uz-UZ')} belgi</span>
      </legend>
      <div role="radiogroup" aria-label="Platforma" className="grid grid-cols-2 gap-2">
        {PLATFORMS.map((p) => {
          const selected = value === p.id;
          const PIcon = p.Icon;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(p.id)}
              className={cn(
                'group flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-all duration-200',
                focusRing,
                selected
                  ? cn(p.activeBorder, p.activeBg, 'shadow-sm')
                  : 'border-zinc-200/80 bg-white/60 hover:border-zinc-300 hover:bg-zinc-50/80 dark:border-zinc-800/90 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-105',
                  selected ? p.iconBg : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
                )}
              >
                <PIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
                  {p.label}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-500 dark:text-zinc-400">{p.badge}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
});

const GoalPicker = memo(function GoalPicker({
  value,
  onChange,
}: {
  value: SocialGoal;
  onChange: (g: SocialGoal) => void;
}) {
  return (
    <fieldset>
      <legend className={cn(eyebrow, 'mb-2')}>2. E’lon maqsadi</legend>
      <div role="radiogroup" aria-label="E’lon maqsadi" className="grid grid-cols-2 gap-1.5">
        {GOALS.map((g) => {
          const selected = value === g.id;
          const GIcon = g.Icon;
          return (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(g.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-colors',
                focusRing,
                selected
                  ? 'border-violet-500 bg-violet-500/10 font-semibold text-violet-900 dark:text-violet-200'
                  : 'border-zinc-200/80 bg-white/50 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-800/60',
              )}
            >
              <GIcon
                className={cn('h-3.5 w-3.5 shrink-0', selected ? 'text-violet-600 dark:text-violet-400' : g.accent)}
              />
              <span className="truncate">{g.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
});

const TonePicker = memo(function TonePicker({
  value,
  onChange,
}: {
  value: SocialTone;
  onChange: (t: SocialTone) => void;
}) {
  return (
    <fieldset>
      <legend className={cn(eyebrow, 'mb-2')}>4. Matn ohangi</legend>
      <div role="radiogroup" aria-label="Matn ohangi" className="grid grid-cols-2 gap-1.5">
        {TONES.map((t) => {
          const selected = value === t.id;
          const TIcon = t.Icon;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(t.id)}
              className={cn(
                'flex items-start gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
                focusRing,
                selected
                  ? 'border-violet-500 bg-violet-500/10 text-violet-900 dark:text-violet-200'
                  : 'border-zinc-200/80 bg-white/50 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-800/50',
              )}
            >
              <TIcon
                className={cn(
                  'mt-0.5 h-3.5 w-3.5 shrink-0',
                  selected ? 'text-violet-600 dark:text-violet-400' : 'text-zinc-400',
                )}
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-tight">{t.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-400">{t.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
});

/** #teg, @username, havola va telefon raqamlarni platformadagidek rangli ko‘rsatadi. */
const RICH_RE = /(https?:\/\/\S+|#[\p{L}\p{N}_]+|@\w{3,}|\+?998[\d\s-]{9,13}\d)/gu;

const RichText = memo(function RichText({ text, linkClass }: { text: string; linkClass: string }) {
  const parts = useMemo(() => text.split(RICH_RE), [text]);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={linkClass}>
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
});

const ScorePanel = memo(function ScorePanel({ score, checks }: { score: number; checks: ScoreCheck[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const tone =
    score >= 80
      ? { ring: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'A’lo' }
      : score >= 60
        ? { ring: 'stroke-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Yaxshi' }
        : { ring: 'stroke-rose-500', text: 'text-rose-600 dark:text-rose-400', label: 'Yaxshilash kerak' };
  const circumference = 2 * Math.PI * 16;
  const missing = checks.filter((c) => !c.passed);

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/80 dark:border-zinc-800/80 dark:bg-zinc-900/80">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={cn('flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left', focusRing)}
      >
        <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className={cn(tone.ring, 'transition-[stroke-dashoffset] duration-500')}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - score / 100)}
          />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Konversiya bahosi: <span className={tone.text}>{score}</span>/100
          </span>
          <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
            {tone.label}
            {missing.length > 0 ? ` · yetishmaydi: ${missing[0].label.toLowerCase()}` : ' · barcha tekshiruvlardan o‘tdi'}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul id={panelId} className="space-y-1.5 border-t border-zinc-200/60 px-3.5 py-3 dark:border-zinc-800/70">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs">
              {c.passed ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              )}
              <span className="min-w-0">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.label}</span>
                {!c.passed && <span className="block text-zinc-500 dark:text-zinc-400">{c.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

function GeneratingSkeleton({ reduce }: { reduce: boolean }) {
  const bar = (w: string) => (
    <div className={cn('h-3 rounded-full bg-zinc-200/80 dark:bg-zinc-800', !reduce && 'animate-pulse')} style={{ width: w }} />
  );
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Variantlar yaratilmoqda">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('h-8 w-24 rounded-xl bg-zinc-200/80 dark:bg-zinc-800', !reduce && 'animate-pulse')} />
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {bar('70%')}
        {bar('95%')}
        {bar('88%')}
        {bar('60%')}
        {bar('92%')}
        {bar('45%')}
      </div>
      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">3 xil variant yozilmoqda…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center space-y-5 p-6 text-center lg:min-h-[420px]">
      <div className="relative">
        <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-violet-500/20 via-sky-500/20 to-rose-500/20 blur-xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-500/20 bg-gradient-to-tr from-violet-500/15 to-sky-500/15 text-violet-600 shadow-inner dark:text-violet-400">
          <Sparkles className="h-9 w-9" />
        </div>
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 sm:text-lg">Mavzuni yozing, qolganini biz qilamiz</h3>
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Platforma, maqsad va kurs nomini tanlab "Generatsiya qilish" tugmasini bosing. Har bir variantni tahrirlash va
          telefon ko‘rinishida tekshirish mumkin.
        </p>
      </div>
      <div className="grid w-full max-w-md grid-cols-3 gap-2.5 pt-1">
        {[
          ['3 variant', 'Turli uslubda', 'text-violet-600 dark:text-violet-400'],
          ['Jonli ko‘rinish', 'TG · IG · FB · SMS', 'text-sky-600 dark:text-sky-400'],
          ['Tahrirlash', 'Joyida o‘zgartiring', 'text-emerald-600 dark:text-emerald-400'],
        ].map(([title, sub, color]) => (
          <div
            key={title}
            className="rounded-xl border border-zinc-200/70 bg-white/60 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/50"
          >
            <p className={cn('text-xs font-bold', color)}>{title}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PREVIEW CARD
// ============================================================================

interface PreviewProps {
  platform: SocialPlatform;
  meta: (typeof PLATFORMS)[number];
  variant: SocialPostVariant;
  editing: boolean;
  onContentChange: (v: string) => void;
  exportLength: number;
  sms: SmsMetrics;
  centerAddress: string;
  onSmsSafe: () => void;
}

const PlatformPreview = memo(function PlatformPreview({
  platform,
  meta,
  variant,
  editing,
  onContentChange,
  exportLength,
  sms,
  centerAddress,
  onSmsSafe,
}: PreviewProps) {
  const [igExpanded, setIgExpanded] = useState(false);
  const time = useMemo(
    () => new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
    [],
  );

  useEffect(() => setIgExpanded(false), [variant.id, platform]);

  const percent = Math.min(100, Math.round((exportLength / meta.maxChars) * 100));
  const overSoft = meta.softLimit && platform === 'TELEGRAM' && exportLength > meta.softLimit.value;
  const linkClass =
    platform === 'SMS'
      ? 'text-emerald-700 underline dark:text-emerald-300'
      : platform === 'INSTAGRAM'
        ? 'text-sky-700 dark:text-sky-300'
        : 'text-sky-600 dark:text-sky-400';

  const igTruncated = platform === 'INSTAGRAM' && !igExpanded && !editing && countChars(variant.content) > 125;
  const bodyText = igTruncated ? `${Array.from(variant.content).slice(0, 125).join('').trimEnd()}…` : variant.content;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className={cn('flex items-center justify-between gap-3 bg-gradient-to-r px-4 py-2.5 text-white', meta.gradient)}>
        <div className="flex min-w-0 items-center gap-2">
          <Smartphone className="h-4 w-4 shrink-0 opacity-90" />
          <span className="truncate text-xs font-semibold">{meta.previewTitle}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] font-medium">
          {platform === 'SMS' ? (
            <span>
              {sms.segments} ta SMS · {sms.encoding}
            </span>
          ) : (
            <span>
              {exportLength.toLocaleString('uz-UZ')} / {meta.maxChars.toLocaleString('uz-UZ')}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {readingTime(variant.content)}
          </span>
        </div>
      </div>

      <div
        className="h-1 w-full bg-zinc-100 dark:bg-zinc-800"
        role="progressbar"
        aria-label="Belgi limiti"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={platform === 'SMS' ? Math.min(100, Math.round((sms.units / SMS_TARGET_UNITS) * 100)) : percent}
      >
        <div
          className={cn(
            'h-full transition-all duration-300',
            percent > 95 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-emerald-500',
          )}
          style={{
            width: `${platform === 'SMS' ? Math.min(100, Math.round((sms.units / SMS_TARGET_UNITS) * 100)) : percent}%`,
          }}
        />
      </div>

      {(platform === 'INSTAGRAM' || platform === 'FACEBOOK') && (
        <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800/80">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-rose-500 text-xs font-bold text-white">
            M
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold leading-none text-zinc-900 dark:text-zinc-100">m_edu_academy</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-400">{centerAddress || 'M-EDU ta’lim markazi'}</p>
          </div>
        </div>
      )}

      <div className="space-y-3 p-4">
        {editing ? (
          <div>
            <label
              htmlFor="studio-editor"
              className="mb-1 block text-xs font-semibold text-violet-600 dark:text-violet-400"
            >
              Matnni tahrirlash
            </label>
            <textarea
              id="studio-editor"
              rows={10}
              value={variant.content}
              onChange={(e) => onContentChange(e.target.value)}
              className="w-full resize-y rounded-xl border border-violet-400 bg-violet-50/20 p-3 font-sans text-[16px] leading-relaxed text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-violet-600 dark:bg-zinc-950 dark:text-zinc-100 sm:text-[14px]"
            />
          </div>
        ) : (
          <div
            className={cn(
              'max-h-[300px] select-text overflow-y-auto whitespace-pre-wrap break-words pr-1 font-sans text-[14px] leading-relaxed text-zinc-800 dark:text-zinc-100',
              platform === 'TELEGRAM' &&
                'rounded-2xl rounded-tl-sm border border-sky-100 bg-sky-50/60 p-3.5 dark:border-sky-900/40 dark:bg-sky-950/25',
              platform === 'SMS' &&
                'rounded-2xl rounded-bl-sm border border-emerald-200/60 bg-emerald-50/70 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/30',
            )}
          >
            {platform === 'TELEGRAM' && <p className="mb-1 text-xs font-bold text-sky-600 dark:text-sky-400">M-EDU</p>}
            {platform === 'SMS' && <p className="mb-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">M-EDU</p>}
            {platform === 'INSTAGRAM' && <span className="mr-1 font-bold">m_edu_academy</span>}
            <RichText text={bodyText} linkClass={linkClass} />
            {igTruncated && (
              <button
                type="button"
                onClick={() => setIgExpanded(true)}
                className="ml-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                ko‘proq
              </button>
            )}
            {(platform === 'TELEGRAM' || platform === 'SMS') && (
              <p className="mt-2 text-right text-[11px] text-zinc-400">{time}</p>
            )}
          </div>
        )}

        {platform === 'TELEGRAM' && !editing && variant.callToAction && (
          <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-center text-xs font-semibold text-sky-700 dark:text-sky-300">
            <span>{variant.callToAction}</span>
            <ChevronDown className="h-3 w-3 -rotate-90 opacity-70" />
          </div>
        )}

        {platform === 'INSTAGRAM' && !editing && (
          <div className="flex items-center justify-between pt-1 text-zinc-600 dark:text-zinc-400" aria-hidden="true">
            <div className="flex items-center gap-3.5">
              <Heart className="h-4 w-4" />
              <MessageSquare className="h-4 w-4" />
              <Send className="h-4 w-4" />
            </div>
            <Bookmark className="h-4 w-4" />
          </div>
        )}

        {meta.softLimit && platform !== 'INSTAGRAM' && overSoft && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {meta.softLimit.hint}
          </p>
        )}
        {platform === 'INSTAGRAM' && meta.softLimit && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{meta.softLimit.hint}</p>
        )}

        {platform === 'SMS' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-950/60">
            <span className="text-zinc-600 dark:text-zinc-400">
              {sms.units} birlik · segmentiga {sms.perSegment}
              {sms.encoding === 'Unicode' && sms.offending.length > 0 && (
                <> · Unicode sababi: {sms.offending.slice(0, 4).join(' ')}</>
              )}
            </span>
            {sms.encoding === 'Unicode' && (
              <button
                type="button"
                onClick={onSmsSafe}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
              >
                <Wand2 className="h-3 w-3" />
                GSM-7 ga moslash
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AiSocialPostStudioModal({
  open = false,
  isOpen,
  onClose,
  defaultTopic,
  defaultPlatform,
  defaultGoal,
}: AiSocialPostStudioModalProps) {
  const isModalOpen = isOpen ?? open;
  const reduceMotion = useReducedMotion() ?? false;
  const fx = useFeedback();
  const { status: copyStatus, copy } = useCopyStatus();

  const panelRef = useRef<HTMLDivElement>(null);
  const topicRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const [form, setForm] = useState<FormState>(() => ({
    ...INITIAL_FORM,
    topic: defaultTopic ?? '',
    platform: defaultPlatform ?? INITIAL_FORM.platform,
    goal: defaultGoal ?? INITIAL_FORM.goal,
  }));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SocialPostResponse | null>(null);
  const [baseline, setBaseline] = useState<Record<string, { content: string; hashtags: string[] }>>({});
  const [usedLocalTemplate, setUsedLocalTemplate] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [includeTags, setIncludeTags] = useState(true);
  const [newTag, setNewTag] = useState('');

  const patch = useCallback((p: Partial<FormState>) => setForm((f) => ({ ...f, ...p })), []);

  // Props orqali kelgan boshlang‘ich qiymatlar — modal ochilganda qo‘llanadi.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isModalOpen && !wasOpen.current) {
      const next: Partial<FormState> = {};
      if (defaultTopic) next.topic = defaultTopic;
      if (defaultPlatform) next.platform = defaultPlatform;
      if (defaultGoal) next.goal = defaultGoal;
      if (Object.keys(next).length) patch(next);
    }
    wasOpen.current = isModalOpen;
    if (!isModalOpen) {
      requestRef.current += 1; // kutilayotgan javobni bekor qilamiz
      setIsGenerating(false);
      setIsEditing(false);
    }
  }, [isModalOpen, defaultTopic, defaultPlatform, defaultGoal, patch]);

  const generatedPlatform = result?.platform ?? form.platform;
  const platformMeta = useMemo(
    () => PLATFORMS.find((p) => p.id === generatedPlatform) ?? PLATFORMS[0],
    [generatedPlatform],
  );

  const activeVariant = useMemo(() => {
    if (!result || result.variants.length === 0) return null;
    return result.variants[selectedIndex] ?? result.variants[0];
  }, [result, selectedIndex]);

  const platformChanged = !!result && result.platform !== form.platform;

  // ---------- generatsiya ----------
  const handleGenerate = useCallback(async () => {
    const topic = form.topic.trim();
    if (!topic || isGenerating) return;

    const requestId = ++requestRef.current;
    fx.tick();
    fx.medium();
    setIsGenerating(true);
    setIsEditing(false);

    const input: FallbackInput = {
      topic,
      platform: form.platform,
      goal: form.goal,
      tone: form.tone,
      targetAudience: form.targetAudience.trim() || undefined,
      priceOffer: form.priceOffer.trim() || undefined,
      callToAction: form.callToAction.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      centerAddress: form.centerAddress.trim() || undefined,
    };

    let next: SocialPostResponse;
    let local = false;
    try {
      const raw = (await withTimeout(aiApi.generateSocialPost(input), GENERATION_TIMEOUT_MS)) as
        | Partial<SocialPostResponse>
        | null
        | undefined;
      const normalized = normalizeResponse(raw, {
        topic,
        platform: input.platform,
        goal: input.goal,
        tone: input.tone,
        targetAudience: input.targetAudience,
      });
      if (normalized) {
        next = normalized;
      } else {
        next = buildSocialFallback(input);
        local = true;
      }
    } catch {
      next = buildSocialFallback(input);
      local = true;
    }

    if (requestId !== requestRef.current) return; // modal yopilgan yoki yangi so‘rov boshlangan

    const snapshot: Record<string, { content: string; hashtags: string[] }> = {};
    next.variants.forEach((v) => {
      snapshot[v.id] = { content: v.content, hashtags: [...v.hashtags] };
    });

    setResult(next);
    setBaseline(snapshot);
    setUsedLocalTemplate(local);
    setSelectedIndex(0);
    setIsGenerating(false);
    fx.success();

    // Mobilda natija chap ustun tagida bo‘ladi — ko‘rinishga olib o‘tamiz.
    requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 1023px)').matches) {
        resultRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }, [form, isGenerating, fx, reduceMotion]);

  useDialogBehavior({
    open: isModalOpen,
    containerRef: panelRef,
    initialFocusRef: topicRef,
    onClose,
    onSubmit: handleGenerate,
  });

  // ---------- variantni tahrirlash ----------
  const updateActive = useCallback(
    (fn: (v: SocialPostVariant) => SocialPostVariant) => {
      setResult((prev) => {
        if (!prev) return prev;
        return { ...prev, variants: prev.variants.map((v, i) => (i === selectedIndex ? fn(v) : v)) };
      });
    },
    [selectedIndex],
  );

  const updateContent = useCallback(
    (content: string) =>
      updateActive((v) => ({
        ...v,
        content,
        characterCount: countChars(content),
        estimatedReadTime: readingTime(content),
      })),
    [updateActive],
  );

  const handleCleanMarkdown = useCallback(() => {
    fx.tick();
    fx.light();
    updateActive((v) => {
      const content = v.content.replace(/\*\*(.*?)\*\*/gs, '$1').replace(/__(.*?)__/gs, '$1').replace(/\*\*|__/g, '');
      return { ...v, content, characterCount: countChars(content) };
    });
  }, [fx, updateActive]);

  const handleSmsSafe = useCallback(() => {
    fx.tick();
    updateActive((v) => {
      const content = toSmsSafe(v.content);
      return { ...v, content, characterCount: content.length, estimatedReadTime: readingTime(content) };
    });
  }, [fx, updateActive]);

  const handleResetVariant = useCallback(() => {
    if (!activeVariant) return;
    const original = baseline[activeVariant.id];
    if (!original) return;
    fx.tick();
    updateActive((v) => ({
      ...v,
      content: original.content,
      hashtags: [...original.hashtags],
      characterCount: countChars(original.content),
      estimatedReadTime: readingTime(original.content),
    }));
  }, [activeVariant, baseline, fx, updateActive]);

  const handleAddTag = useCallback(() => {
    const [formatted] = normalizeTags([newTag]);
    if (!formatted) return;
    fx.tick();
    updateActive((v) =>
      v.hashtags.some((t) => t.toLowerCase() === formatted.toLowerCase())
        ? v
        : { ...v, hashtags: [...v.hashtags, formatted] },
    );
    setNewTag('');
  }, [newTag, fx, updateActive]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      fx.tick();
      updateActive((v) => ({ ...v, hashtags: v.hashtags.filter((t) => t !== tag) }));
    },
    [fx, updateActive],
  );

  // ---------- hosilaviy qiymatlar ----------
  const isSms = generatedPlatform === 'SMS';
  const exportText = useMemo(() => {
    if (!activeVariant) return '';
    const tags = !isSms && includeTags && activeVariant.hashtags.length > 0 ? `\n\n${activeVariant.hashtags.join(' ')}` : '';
    return `${activeVariant.content}${tags}`;
  }, [activeVariant, includeTags, isSms]);

  const exportLength = useMemo(() => countChars(exportText), [exportText]);
  const sms = useMemo(() => analyzeSms(activeVariant?.content ?? ''), [activeVariant?.content]);

  const conversion = useMemo(
    () => computeConversionScore(activeVariant?.content ?? '', activeVariant?.hashtags ?? [], generatedPlatform, exportLength),
    [activeVariant?.content, activeVariant?.hashtags, generatedPlatform, exportLength],
  );

  const warnings = useMemo(() => {
    const list = [...scanClaims(activeVariant?.content ?? ''), ...(result?.complianceTips ?? [])];
    if (!isSms && exportLength > platformMeta.maxChars) {
      list.unshift(`Post ${platformMeta.label} limitidan ${exportLength - platformMeta.maxChars} belgi uzun.`);
    }
    return Array.from(new Set(list)).slice(0, 5);
  }, [activeVariant?.content, result?.complianceTips, isSms, exportLength, platformMeta]);

  const isDirty = useMemo(() => {
    if (!activeVariant) return false;
    const base = baseline[activeVariant.id];
    if (!base) return false;
    return base.content !== activeVariant.content || base.hashtags.join(' ') !== activeVariant.hashtags.join(' ');
  }, [activeVariant, baseline]);

  const hasMarkdown = !!activeVariant && /\*\*|__/.test(activeVariant.content);

  // ---------- eksport ----------
  const handleCopyAll = useCallback(async () => {
    const ok = await copy(exportText, 'full');
    if (ok) fx.success();
  }, [copy, exportText, fx]);

  const handleCopyTags = useCallback(async () => {
    if (!activeVariant) return;
    await copy(activeVariant.hashtags.join(' '), 'tags');
  }, [copy, activeVariant]);

  const handleDownload = useCallback(() => {
    if (!exportText) return;
    fx.tick();
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `m-edu-${generatedPlatform.toLowerCase()}-variant-${selectedIndex + 1}-${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [exportText, fx, generatedPlatform, selectedIndex]);

  const handleShare = useCallback(async () => {
    if (!exportText) return;
    fx.tick();
    const link = buildTelegramShareLink(exportText);
    if (link.length > TELEGRAM_SHARE_MAX_ENCODED) {
      // Havola juda uzun bo‘ladi — matnni nusxalab, Telegramni ochamiz.
      await copy(exportText, 'full');
      return;
    }
    const tg = (window as TelegramWindow).Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(link);
    else window.open(link, '_blank', 'noopener,noreferrer');
  }, [exportText, copy, fx]);

  const copiedFull = copyStatus?.id === 'full' && copyStatus.ok;
  const copyFailed = copyStatus?.id === 'full' && !copyStatus.ok;
  const copiedTags = copyStatus?.id === 'tags' && copyStatus.ok;

  const canGenerate = form.topic.trim().length > 0 && !isGenerating;

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          key="ai-smm-studio"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 md:p-6"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-zinc-950/65 backdrop-blur-md" onClick={onClose} aria-hidden="true" />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-smm-studio-title"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className="relative z-10 flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden border border-white/25 bg-white/95 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-900/95 sm:h-auto sm:max-h-[92vh] sm:rounded-[28px] max-sm:rounded-t-[28px]"
          >
            <div className="h-1 w-full shrink-0 bg-gradient-to-r from-violet-600 via-sky-500 to-rose-500" />

            {/* Header */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200/70 bg-gradient-to-r from-violet-500/[0.08] via-sky-500/[0.04] to-transparent px-5 py-3.5 dark:border-zinc-800/80 sm:px-7 sm:py-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-sky-500 text-white shadow-lg shadow-violet-500/25 ring-1 ring-white/25">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="ai-smm-studio-title"
                    className="truncate text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-lg"
                  >
                    AI SMM va e’lonlar studiyasi
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    Telegram, Instagram, Facebook va SMS uchun tayyor matnlar
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="hidden items-center rounded-lg border border-zinc-200 bg-zinc-100/70 px-2 py-1 text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400 md:inline-flex">
                  Ctrl + Enter
                </kbd>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Yopish"
                  className={cn(
                    'group flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/80 bg-white/80 text-zinc-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:border-zinc-800 dark:bg-zinc-800/80 dark:hover:border-rose-800/60 dark:hover:bg-rose-950/40 dark:hover:text-rose-400',
                    focusRing,
                  )}
                >
                  <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
                </button>
              </div>
            </header>

            {/* Body */}
            <div className="grid flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-12 lg:divide-x lg:divide-zinc-200/70 lg:dark:divide-zinc-800/80">
              {/* ------------------------- LEFT: controls ------------------------- */}
              <div className="flex flex-col lg:col-span-5 lg:max-h-full lg:overflow-y-auto">
                <div className="flex-1 space-y-5 bg-white/50 p-5 dark:bg-zinc-900/30 sm:p-6">
                  <PlatformPicker
                    value={form.platform}
                    onChange={(p) => {
                      fx.tick();
                      fx.light();
                      patch({ platform: p });
                    }}
                  />
                  <GoalPicker
                    value={form.goal}
                    onChange={(g) => {
                      fx.tick();
                      patch({ goal: g });
                    }}
                  />

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="studio-topic" className={eyebrow}>
                        3. Mavzu yoki kurs nomi <span className="text-rose-500">*</span>
                      </label>
                      {form.topic && (
                        <button
                          type="button"
                          onClick={() => patch({ topic: '' })}
                          className="text-xs font-medium text-zinc-400 transition-colors hover:text-rose-500"
                        >
                          Tozalash
                        </button>
                      )}
                    </div>
                    <input
                      id="studio-topic"
                      ref={topicRef}
                      type="text"
                      value={form.topic}
                      onChange={(e) => patch({ topic: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleGenerate();
                        }
                      }}
                      maxLength={140}
                      placeholder="Masalan: IELTS 7.5+ Intensive"
                      className={cn(inputCls, 'font-medium')}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-zinc-400">Tezkor:</span>
                      {QUICK_TOPICS.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            fx.tick();
                            setForm((f) => ({
                              ...f,
                              topic: item.label,
                              goal: item.goal,
                              priceOffer: item.offer && !f.priceOffer ? item.offer : f.priceOffer,
                            }));
                          }}
                          className="rounded-lg border border-zinc-200/80 bg-zinc-100/70 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-violet-400 hover:bg-violet-50/60 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:border-violet-600 dark:hover:bg-violet-950/40"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <TonePicker
                    value={form.tone}
                    onChange={(t) => {
                      fx.tick();
                      patch({ tone: t });
                    }}
                  />

                  {/* Qo‘shimcha detallar */}
                  <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50/60 dark:border-zinc-800/80 dark:bg-zinc-950/40">
                    <button
                      type="button"
                      aria-expanded={showAdvanced}
                      aria-controls="studio-advanced"
                      onClick={() => setShowAdvanced((v) => !v)}
                      className={cn(
                        'flex w-full items-center justify-between px-3.5 py-3 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100/70 dark:text-zinc-300 dark:hover:bg-zinc-800/40',
                        focusRing,
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <Wand2 className="h-3.5 w-3.5 text-violet-500" />
                        Taklif, aloqa va manzil
                      </span>
                      <ChevronDown className={cn('h-4 w-4 text-zinc-400 transition-transform', showAdvanced && 'rotate-180')} />
                    </button>
                    {showAdvanced && (
                      <div
                        id="studio-advanced"
                        className="space-y-3 border-t border-zinc-200/50 p-3.5 dark:border-zinc-800/50"
                      >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field
                            label="Narx yoki chegirma"
                            value={form.priceOffer}
                            onChange={(v) => patch({ priceOffer: v })}
                            placeholder="Masalan: 20% chegirma"
                          />
                          <Field
                            label="Aloqa telefoni"
                            value={form.contactPhone}
                            onChange={(v) => patch({ contactPhone: v })}
                            placeholder="+998 90 123 45 67"
                            Icon={Phone}
                            inputMode="tel"
                          />
                          <Field
                            label="Maqsadli auditoriya"
                            value={form.targetAudience}
                            onChange={(v) => patch({ targetAudience: v })}
                            placeholder="Abituriyentlar, 7–11-sinflar"
                          />
                          <Field
                            label="Markaz manzili"
                            value={form.centerAddress}
                            onChange={(v) => patch({ centerAddress: v })}
                            placeholder="Toshkent, Chilonzor 9"
                            Icon={MapPin}
                          />
                        </div>
                        <Field
                          label="Harakatga chaqiruv (ixtiyoriy)"
                          value={form.callToAction}
                          onChange={(v) => patch({ callToAction: v })}
                          placeholder="Masalan: Hoziroq qo‘ng‘iroq qiling"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Sticky generate bar */}
                <div className="sticky bottom-0 z-10 border-t border-zinc-200/70 bg-white/85 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/85 sm:px-6">
                  <button
                    type="button"
                    disabled={!canGenerate}
                    onClick={handleGenerate}
                    className={cn(
                      'group flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-bold shadow-xl transition-all duration-200',
                      focusRing,
                      canGenerate
                        ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 text-white shadow-violet-500/25 hover:from-violet-500 hover:via-indigo-500 hover:to-sky-500 active:scale-[0.985]'
                        : 'cursor-not-allowed bg-zinc-200 text-zinc-500 opacity-80 shadow-none dark:bg-zinc-800',
                    )}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className={cn('h-4 w-4', !reduceMotion && 'animate-spin')} />
                        <span>Variantlar yozilmoqda…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" />
                        <span>{result ? 'Qayta generatsiya qilish' : '3 xil e’lon generatsiya qilish'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* ------------------------- RIGHT: preview ------------------------- */}
              <div
                ref={resultRef}
                className="scroll-mt-2 bg-zinc-50/70 p-5 dark:bg-zinc-950/50 sm:p-6 lg:col-span-7 lg:overflow-y-auto"
                aria-busy={isGenerating}
              >
                <p role="status" aria-live="polite" className="sr-only">
                  {copiedFull ? 'Post nusxalandi' : copyFailed ? 'Nusxalab bo‘lmadi' : ''}
                </p>

                {isGenerating && !result ? (
                  <GeneratingSkeleton reduce={reduceMotion} />
                ) : result && activeVariant ? (
                  <div className={cn('space-y-4 transition-opacity', isGenerating && 'pointer-events-none opacity-60')}>
                    {platformChanged && (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          Quyidagi matn {PLATFORMS.find((p) => p.id === result.platform)?.label} uchun yaratilgan. Tanlangan
                          platforma uchun qayta generatsiya qiling.
                        </span>
                      </div>
                    )}

                    {/* Variant tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 pb-3 dark:border-zinc-800">
                      <div role="tablist" aria-label="Variantlar" className="flex items-center gap-1.5">
                        {result.variants.map((v, idx) => {
                          const selected = selectedIndex === idx;
                          const VIcon = VARIANT_ICONS[idx] ?? Sparkles;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              role="tab"
                              aria-selected={selected}
                              onClick={() => {
                                fx.tick();
                                setSelectedIndex(idx);
                              }}
                              className={cn(
                                'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all',
                                focusRing,
                                selected
                                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                                  : 'border border-zinc-200/70 bg-white text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700/70 dark:bg-zinc-800/90 dark:text-zinc-300 dark:hover:bg-zinc-700',
                              )}
                            >
                              <VIcon className="h-3.5 w-3.5" />
                              <span>Variant {idx + 1}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        {usedLocalTemplate ? (
                          <span
                            title="AI xizmati javob bermadi — lokal shablon ishlatildi"
                            className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                          >
                            <Zap className="h-3 w-3" />
                            Lokal shablon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <Sparkles className="h-3 w-3" />
                            AI
                          </span>
                        )}
                        <span className="hidden text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:inline">
                          {activeVariant.styleName}
                        </span>
                      </div>
                    </div>

                    <ScorePanel score={conversion.score} checks={conversion.checks} />

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {hasMarkdown && (
                        <button type="button" onClick={handleCleanMarkdown} className={cn(ghostBtn, 'py-1.5')}>
                          <Eraser className="h-3 w-3" />
                          <span>"**" tozalash</span>
                        </button>
                      )}
                      {isDirty && (
                        <button type="button" onClick={handleResetVariant} className={cn(ghostBtn, 'py-1.5')}>
                          <RotateCcw className="h-3 w-3" />
                          <span>Asl holatiga</span>
                        </button>
                      )}
                      <button
                        type="button"
                        aria-pressed={isEditing}
                        onClick={() => {
                          fx.tick();
                          setIsEditing((v) => !v);
                        }}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors',
                          focusRing,
                          isEditing
                            ? 'border-violet-500 bg-violet-600 text-white'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-violet-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
                        )}
                      >
                        {isEditing ? (
                          <>
                            <Eye className="h-3 w-3" />
                            <span>Ko‘rish</span>
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-3 w-3" />
                            <span>Tahrirlash</span>
                          </>
                        )}
                      </button>
                    </div>

                    <PlatformPreview
                      platform={result.platform}
                      meta={platformMeta}
                      variant={activeVariant}
                      editing={isEditing}
                      onContentChange={updateContent}
                      exportLength={exportLength}
                      sms={sms}
                      centerAddress={form.centerAddress.trim()}
                      onSmsSafe={handleSmsSafe}
                    />

                    {/* Hashtaglar */}
                    {!isSms && (
                      <div className="space-y-2 rounded-2xl border border-zinc-200/80 bg-white/80 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-900/70">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                            Teglar ({activeVariant.hashtags.length})
                          </span>
                          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            <input
                              type="checkbox"
                              checked={includeTags}
                              onChange={(e) => setIncludeTags(e.target.checked)}
                              className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                            />
                            Nusxalashda teglar bilan
                          </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {activeVariant.hashtags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/10 py-0.5 pl-2 pr-1 text-xs font-medium text-violet-700 dark:text-violet-300"
                            >
                              <Tag className="h-2.5 w-2.5 opacity-70" />
                              {tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                aria-label={`${tag} tegini o‘chirish`}
                                className="flex h-5 w-5 items-center justify-center rounded-md text-violet-400 transition-colors hover:text-rose-500"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddTag();
                                }
                              }}
                              aria-label="Yangi teg"
                              placeholder="yangi_teg"
                              className="w-28 rounded-lg border border-dashed border-zinc-300 bg-transparent px-2 py-1 text-[16px] text-zinc-700 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none dark:border-zinc-700 dark:text-zinc-300 sm:text-xs"
                            />
                            {newTag && (
                              <button
                                type="button"
                                onClick={handleAddTag}
                                aria-label="Tegni qo‘shish"
                                className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-white"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tekshiruv */}
                    {warnings.length > 0 && (
                      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5">
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Chop etishdan oldin tekshiring
                        </p>
                        <ul className="space-y-1 text-xs leading-snug text-amber-900/80 dark:text-amber-100/80">
                          {warnings.map((w) => (
                            <li key={w} className="flex items-start gap-1.5">
                              <span aria-hidden="true">•</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Vizual g‘oya + vaqt */}
                    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                      {result.suggestedVisuals && result.suggestedVisuals.length > 0 && (
                        <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-900/70">
                          <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
                            <ImageIcon className="h-3.5 w-3.5 text-sky-500" />
                            Vizual g‘oya
                          </p>
                          <ul className="space-y-1 leading-snug text-zinc-600 dark:text-zinc-400">
                            {result.suggestedVisuals.slice(0, 2).map((item) => (
                              <li key={item} className="flex items-start gap-1.5">
                                <span className="font-bold text-sky-500" aria-hidden="true">
                                  •
                                </span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="rounded-2xl border border-zinc-200/80 bg-white/80 p-3.5 dark:border-zinc-800/80 dark:bg-zinc-900/70">
                        <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          E’lon qilish vaqti
                        </p>
                        <p className="leading-snug text-zinc-600 dark:text-zinc-400">
                          {result.bestPostingTime || platformMeta.bestTime}
                        </p>
                      </div>
                    </div>

                    {/* Harakatlar */}
                    <div className="flex flex-wrap items-center gap-2 pb-[env(safe-area-inset-bottom)] pt-1">
                      <button
                        type="button"
                        onClick={handleCopyAll}
                        className={cn(
                          'flex min-w-[180px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-md transition-all active:scale-[0.98]',
                          focusRing,
                          copiedFull
                            ? 'bg-emerald-600 shadow-emerald-500/20'
                            : copyFailed
                              ? 'bg-rose-600 shadow-rose-500/20'
                              : 'bg-violet-600 shadow-violet-500/20 hover:bg-violet-700',
                        )}
                      >
                        {copiedFull ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Nusxalandi</span>
                          </>
                        ) : copyFailed ? (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            <span>Nusxalab bo‘lmadi — matnni belgilab oling</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            <span>
                              Postni nusxalash
                              {!isSms && includeTags && activeVariant.hashtags.length > 0 ? ' (+ teglar)' : ''}
                            </span>
                          </>
                        )}
                      </button>

                      {!isSms && activeVariant.hashtags.length > 0 && (
                        <button type="button" onClick={handleCopyTags} className={ghostBtn}>
                          {copiedTags ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Tag className="h-3.5 w-3.5 text-violet-500" />
                          )}
                          <span>Teglar</span>
                        </button>
                      )}

                      <button type="button" onClick={handleDownload} title=".txt fayl sifatida yuklab olish" className={ghostBtn}>
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">.txt</span>
                        <span className="sr-only sm:hidden">.txt yuklab olish</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleShare}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300/80 bg-sky-50 px-3.5 py-3 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Telegramga</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <EmptyState />
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AiSocialPostStudioModal;