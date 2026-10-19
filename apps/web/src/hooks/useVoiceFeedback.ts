import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useSafeI18n } from '@/i18n/I18nProvider';

// ============================================================================
// 1. CONSTANTS & TYPES
// ============================================================================

const STORAGE_KEY = 'medu_face_voice_enabled';
const VOICE_STATE_EVENT = 'medu:voice-enabled-changed';

export type SupportedLocale = 'uz' | 'ru' | 'en';

export type VoiceAudioKey =
  | 'attendance_success'
  | 'attendance_duplicate'
  | 'attendance_unknown'
  | 'access_denied_debt'
  | 'access_denied'
  | 'face_scan_prompt'
  | 'enrollment_success'
  | 'payment_success'
  | 'briefing_intro'
  | 'briefing_outro';

export const AUDIO_FILE_MAP: Readonly<Record<VoiceAudioKey, string>> = {
  attendance_success: 'welcome.mp3',
  attendance_duplicate: 'already_checked.mp3',
  attendance_unknown: 'not_recognized.mp3',
  access_denied_debt: 'payment_required.mp3',
  access_denied: 'access_denied.mp3',
  face_scan_prompt: 'look_at_camera.mp3',
  enrollment_success: 'enrollment_success.mp3',
  payment_success: 'payment_success.mp3',
  briefing_intro: 'briefing_intro.mp3',
  briefing_outro: 'briefing_outro.mp3',
};

// ============================================================================
// 2. SSR-SAFE REACTIVE EXTERNAL STORE (Cross-Component & Cross-Tab Sync)
// ============================================================================

const storeListeners = new Set<() => void>();
let isVoiceEnabledState = true;
let isStoreInitialized = false;

function readEnabledFromStorage(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  } catch {
    return true;
  }
}

function initVoiceStore(): void {
  if (isStoreInitialized || typeof window === 'undefined') return;
  isStoreInitialized = true;
  isVoiceEnabledState = readEnabledFromStorage();

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue !== null) {
      const next = e.newValue === 'true';
      if (isVoiceEnabledState !== next) {
        isVoiceEnabledState = next;
        storeListeners.forEach((l) => l());
      }
    }
  });
}

function subscribeVoiceStore(listener: () => void): () => void {
  initVoiceStore();
  storeListeners.add(listener);
  return () => storeListeners.delete(listener);
}

function getVoiceEnabledSnapshot(): boolean {
  initVoiceStore();
  return isVoiceEnabledState;
}

function getServerVoiceEnabledSnapshot(): boolean {
  return true; // SSR Hydration xatosini 100% oldini oladi
}

export function setVoiceFeedbackEnabled(nextState: boolean): void {
  initVoiceStore();
  if (isVoiceEnabledState === nextState) return;
  isVoiceEnabledState = nextState;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(nextState));
    } catch {
      // Ignore storage errors in private/kiosk mode
    }
    window.dispatchEvent(new CustomEvent<boolean>(VOICE_STATE_EVENT, { detail: nextState }));
  }

  storeListeners.forEach((l) => l());
}

// ============================================================================
// 3. SMART TTS VOICE SELECTOR & 404 CACHE ENGINE
// ============================================================================

// Serverda yo'q bo'lgan (404) audio fayllarni qayta-qayta so'ramaslik uchun kesh
const missingAudioUrlCache = new Set<string>();

// Yuklangan mp3 fayllarni xotirada tayyor ushlab turish (Zero-latency playback)
const preloadedAudioCache = new Map<string, HTMLAudioElement>();

let cachedVoices: SpeechSynthesisVoice[] = [];

function initSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  initSpeechVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    initSpeechVoices();
  };
}

/**
 * Apple Siri / Google Natural / Microsoft Neural ovozlarini ustuvor tanlovchi algoritm
 */
function selectBestVoice(locale: SupportedLocale): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length > 0 ? cachedVoices : initSpeechVoices();
  if (voices.length === 0) return null;

  const targetLang = locale === 'ru' ? 'ru' : locale === 'en' ? 'en' : 'uz';

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const lang = v.lang.toLowerCase();
    const name = v.name.toLowerCase();
    let score = 0;

    if (lang.startsWith(targetLang)) score += 100;
    else if (targetLang === 'uz' && lang.startsWith('tr')) score += 40; // Turkcha fonetika fallback
    else if (targetLang === 'uz' && lang.startsWith('ru')) score += 30;
    else return -1;

    // Premium / Neural / Siri ovozlariga yuqori ball beramiz
    if (name.includes('natural') || name.includes('neural')) score += 50;
    if (name.includes('siri') || name.includes('premium') || name.includes('enhanced')) score += 45;
    if (name.includes('google') || name.includes('microsoft')) score += 25;
    if (!v.localService) score += 10; // Cloud-based voices usually sound more natural

    return score;
  };

  let bestVoice: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const v of voices) {
    const s = scoreVoice(v);
    if (s > bestScore) {
      bestScore = s;
      bestVoice = v;
    }
  }

  return bestVoice ?? voices[0] ?? null;
}

function normalizeLocale(rawLocale?: string): SupportedLocale {
  const clean = (rawLocale || 'uz').toLowerCase();
  if (clean.startsWith('ru')) return 'ru';
  if (clean.startsWith('en')) return 'en';
  return 'uz';
}

function extractFirstName(fullName?: string): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] || '';
}

// ============================================================================
// 4. CORE HOOK IMPLEMENTATION
// ============================================================================

export function useVoiceFeedback() {
  const { locale: rawLocale } = useSafeI18n();
  const locale = normalizeLocale(rawLocale);

  const enabled = useSyncExternalStore(
    subscribeVoiceStore,
    getVoiceEnabledSnapshot,
    getServerVoiceEnabledSnapshot,
  );

  const [isPlaying, setIsPlaying] = useState(false);

  // Refs for active playback & Garbage Collection prevention
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const pendingResolveRef = useRef<((result: boolean) => void) | null>(null);
  const playbackSessionIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const isSupported = typeof window !== 'undefined';

  const safeSetPlaying = useCallback((state: boolean) => {
    if (isMountedRef.current) {
      setIsPlaying(state);
    }
  }, []);

  /**
   * Barcha joriy audio va sintetik nutqni xavfsiz to'xtatish va
   * osilib turgan Promise'larni yopish (Memory Leak Guard).
   */
  const stopAll = useCallback(() => {
    playbackSessionIdRef.current += 1;

    // 1. Osilib turgan Promise bo'lsa, darhol false bilan yopamiz
    if (pendingResolveRef.current) {
      const resolve = pendingResolveRef.current;
      pendingResolveRef.current = null;
      resolve(false);
    }

    // 2. HTMLAudioElement ni tozalash
    if (currentAudioRef.current) {
      const audio = currentAudioRef.current;
      currentAudioRef.current = null;
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Ignore media reset errors
      }
    }

    // 3. SpeechSynthesis ni tozalash (Oldingi callbacklar ishlab ketmasligi uchun)
    if (activeUtteranceRef.current) {
      const utterance = activeUtteranceRef.current;
      activeUtteranceRef.current = null;
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // Ignore WebSpeech cancel errors
      }
    }

    safeSetPlaying(false);
  }, [safeSetPlaying]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopAll();
    };
  }, [stopAll]);

  const toggleVoice = useCallback(
    (nextState?: boolean) => {
      const current = getVoiceEnabledSnapshot();
      const target = nextState !== undefined ? nextState : !current;
      if (!target) {
        stopAll();
      }
      setVoiceFeedbackEnabled(target);
    },
    [stopAll],
  );

  /**
   * Browser SpeechSynthesis fallback (GC-Safe & Race-Condition Protected)
   */
  const speak = useCallback(
    (text: string, onEnded?: () => void) => {
      const cleanText = text?.trim();
      if (!isSupported || !enabled || !cleanText || !('speechSynthesis' in window)) {
        onEnded?.();
        return;
      }

      stopAll();
      const sessionId = playbackSessionIdRef.current;

      try {
        // O'zbek lotin yozuvidagi tipografik apostroflarni TTS to'g'ri o'qishi uchun tekislaymiz
        const normalizedText = cleanText.replace(/[''''`]/g, "'");
        const utterance = new SpeechSynthesisUtterance(normalizedText);

        // GC BUG FIX: Utterance obyektini ref ichida saqlab turamiz
        activeUtteranceRef.current = utterance;

        const matchingVoice = selectBestVoice(locale);
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }

        utterance.lang = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'uz-UZ';
        utterance.rate = 1.03;
        utterance.pitch = 1.0;
        utterance.volume = 0.95;

        utterance.onstart = () => {
          if (playbackSessionIdRef.current !== sessionId) return;
          safeSetPlaying(true);
        };

        const handleFinish = () => {
          if (playbackSessionIdRef.current !== sessionId) return;
          activeUtteranceRef.current = null;
          safeSetPlaying(false);
          onEnded?.();
        };

        utterance.onend = handleFinish;
        utterance.onerror = handleFinish;

        window.speechSynthesis.speak(utterance);
      } catch {
        activeUtteranceRef.current = null;
        safeSetPlaying(false);
        onEnded?.();
      }
    },
    [isSupported, enabled, locale, stopAll, safeSetPlaying],
  );

  /**
   * Studiyada yozilgan MP3 faylni chaladi.
   * Agar fayl 404 bo'lsa, keshlab qo'yadi va darhol SpeechSynthesis ga o'tadi.
   */
  const playVoiceAudio = useCallback(
    async (key: VoiceAudioKey, fallbackText?: string, onEnded?: () => void): Promise<boolean> => {
      if (!isSupported || !enabled) {
        onEnded?.();
        return false;
      }

      stopAll();
      const sessionId = playbackSessionIdRef.current;

      const fileName = AUDIO_FILE_MAP[key];
      const audioUrl = `/audio/voices/${locale}/${fileName}`;

      // SMART 404 CACHE: Agar bu fayl oldin topilmagan bo'lsa, serverni bezovta qilmaymiz
      if (missingAudioUrlCache.has(audioUrl)) {
        if (fallbackText) {
          speak(fallbackText, onEnded);
        } else {
          onEnded?.();
        }
        return false;
      }

      return new Promise<boolean>((resolve) => {
        pendingResolveRef.current = resolve;

        const finishWithFallback = (cacheAsMissing: boolean) => {
          if (playbackSessionIdRef.current !== sessionId) return;

          if (cacheAsMissing) {
            missingAudioUrlCache.add(audioUrl);
          }

          currentAudioRef.current = null;
          pendingResolveRef.current = null;
          safeSetPlaying(false);

          if (fallbackText) {
            speak(fallbackText, onEnded);
          } else {
            onEnded?.();
          }
          resolve(false);
        };

        try {
          let audio = preloadedAudioCache.get(audioUrl);
          if (!audio) {
            audio = new Audio(audioUrl);
            audio.preload = 'auto';
          } else {
            audio.currentTime = 0;
          }

          currentAudioRef.current = audio;

          audio.onplay = () => {
            if (playbackSessionIdRef.current !== sessionId) return;
            preloadedAudioCache.set(audioUrl, audio!);
            safeSetPlaying(true);
          };

          audio.onended = () => {
            if (playbackSessionIdRef.current !== sessionId) return;
            currentAudioRef.current = null;
            pendingResolveRef.current = null;
            safeSetPlaying(false);
            onEnded?.();
            resolve(true);
          };

          audio.onerror = () => {
            finishWithFallback(true); // 404 yoki buzuq fayl -> keshga qo'shamiz
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((err: DOMException) => {
              // Autoplay bloklangan bo'lsa (NotAllowedError), fayl yo'q deb keshlamaymiz!
              const isAutoplayBlocked = err?.name === 'NotAllowedError';
              finishWithFallback(!isAutoplayBlocked);
            });
          }
        } catch {
          finishWithFallback(false);
        }
      });
    },
    [isSupported, enabled, locale, speak, stopAll, safeSetPlaying],
  );

  // ==========================================================================
  // 5. DOMAIN-SPECIFIC VOICE FEEDBACK METHODS (Grammatically Clean Fallbacks)
  // ==========================================================================

  // 1. Turnstile / Face Recognition: Check-in Success
  const speakSuccess = useCallback(
    (studentName?: string, groupName?: string) => {
      const firstName = extractFirstName(studentName);
      const greeting =
        locale === 'ru'
          ? firstName ? `Добро пожаловать, ${firstName}!` : 'Добро пожаловать!'
          : locale === 'en'
            ? firstName ? `Welcome, ${firstName}!` : 'Welcome!'
            : firstName ? `Xush kelibsiz, ${firstName}!` : 'Xush kelibsiz!';

      const detail =
        locale === 'ru'
          ? groupName ? `Занятие по группе ${groupName} отмечено.` : 'Посещение успешно отмечено.'
          : locale === 'en'
            ? groupName ? `Checked into ${groupName}.` : 'Attendance recorded.'
            : groupName ? `${groupName} darsi belgilandi.` : 'Davomatingiz qayd etildi.';

      // Agar aniq ism yoki guruh aytilishi kerak bo'lsa va MP3 umumiy bo'lsa,
      // MP3 mavjud bo'lganda MP3, yo'q bo'lsa shaxsiylashtirilgan TTS o'qiydi
      void playVoiceAudio('attendance_success', `${greeting} ${detail}`);
    },
    [locale, playVoiceAudio],
  );

  // 2. Turnstile / Face Recognition: Already Recorded Duplicate
  const speakDuplicate = useCallback(
    (studentName?: string) => {
      const firstName = extractFirstName(studentName);
      const fallbackText =
        locale === 'ru'
          ? firstName
            ? `${firstName}, ваше посещение уже было отмечено.`
            : 'Ваше посещение уже было отмечено.'
          : locale === 'en'
            ? firstName
              ? `${firstName}, your attendance was already logged.`
              : 'Your attendance was already logged.'
            : firstName
              ? `${firstName}, sizning davomatingiz allaqachon belgilangan.`
              : 'Sizning davomatingiz allaqachon belgilangan.';

      void playVoiceAudio('attendance_duplicate', fallbackText);
    },
    [locale, playVoiceAudio],
  );

  // 3. Turnstile / Face Recognition: Unknown face
  const speakUnknown = useCallback(() => {
    const fallbackText =
      locale === 'ru'
        ? 'Лицо не распознано. Пожалуйста, обратитесь к администратору.'
        : locale === 'en'
          ? 'Face not recognized. Please see the front desk.'
          : "Yuz aniqlanmadi. Iltimos, ma'muriyatga murojaat qiling.";

    void playVoiceAudio('attendance_unknown', fallbackText);
  }, [locale, playVoiceAudio]);

  // 4. Turnstile / Face Recognition: Access Denied (or Debt)
  const speakAccessDenied = useCallback(
    (reason?: string) => {
      const isDebt = reason === 'INSUFFICIENT_FUNDS';
      const fallbackText =
        locale === 'ru'
          ? isDebt ? 'Доступ приостановлен: требуется оплата обучения.' : 'Доступ отклонен.'
          : locale === 'en'
            ? isDebt ? 'Access restricted: pending tuition balance.' : 'Access denied.'
            : isDebt ? "Kirish cheklangan: to'lov balansi talab etiladi." : 'Kirish rad etildi.';

      void playVoiceAudio(isDebt ? 'access_denied_debt' : 'access_denied', fallbackText);
    },
    [locale, playVoiceAudio],
  );

  // 5. Face Enrollment: Looking into the Camera
  const speakFaceScanPrompt = useCallback(() => {
    const fallbackText =
      locale === 'ru'
        ? 'Пожалуйста, смотрите прямо в камеру.'
        : locale === 'en'
          ? 'Please look directly into the camera.'
          : "Iltimos, kameraga to'g'ri qarang.";

    void playVoiceAudio('face_scan_prompt', fallbackText);
  }, [locale, playVoiceAudio]);

  // 6. Face Enrollment: Enrollment Succeeded
  const speakEnrollmentSuccess = useCallback(() => {
    const fallbackText =
      locale === 'ru'
        ? 'Отлично! Ваше лицо успешно сохранено в системе.'
        : locale === 'en'
          ? 'Great! Your biometric profile has been successfully saved.'
          : 'Ajoyib! Yuzingiz tizimga muvaffaqiyatli saqlandi.';

    void playVoiceAudio('enrollment_success', fallbackText);
  }, [locale, playVoiceAudio]);

  // 7. Cashier / Payment Succeeded
  const speakPaymentSuccess = useCallback(() => {
    const fallbackText =
      locale === 'ru'
        ? 'Оплата успешно принята. Спасибо!'
        : locale === 'en'
          ? 'Payment received successfully. Thank you!'
          : "To'lov muvaffaqiyatli qabul qilindi. Rahmat!";

    void playVoiceAudio('payment_success', fallbackText);
  }, [locale, playVoiceAudio]);

  // 8. Executive AI Briefing: Intro
  const speakBriefingIntro = useCallback(
    (fallbackText?: string, onEnded?: () => void) => {
      void playVoiceAudio('briefing_intro', fallbackText, onEnded);
    },
    [playVoiceAudio],
  );

  // 9. Executive AI Briefing: Outro
  const speakBriefingOutro = useCallback(
    (fallbackText?: string, onEnded?: () => void) => {
      void playVoiceAudio('briefing_outro', fallbackText, onEnded);
    },
    [playVoiceAudio],
  );

  return {
    isSupported,
    enabled,
    isPlaying,
    stopAll,
    toggleVoice,
    speak,
    playVoiceAudio,
    speakSuccess,
    speakDuplicate,
    speakUnknown,
    speakAccessDenied,
    speakFaceScanPrompt,
    speakEnrollmentSuccess,
    speakPaymentSuccess,
    speakBriefingIntro,
    speakBriefingOutro,
  };
}