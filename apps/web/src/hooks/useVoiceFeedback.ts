import { useCallback, useState } from 'react';
import { useSafeI18n } from '@/i18n/I18nProvider';

const STORAGE_KEY = 'medu_face_voice_enabled';

/**
 * Intelligent Multilingual Voice Assistant for Face ID attendance.
 * Uses Web Speech API to provide verbal confirmation in Uzbek, Russian, or English.
 */
export function useVoiceFeedback() {
  const { locale } = useSafeI18n();
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const toggleVoice = useCallback((nextState?: boolean) => {
    setEnabled((prev) => {
      const value = nextState !== undefined ? nextState : !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(value));
      } catch {
        // ignore
      }
      return value;
    });
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !enabled || !text) return;
      try {
        window.speechSynthesis.cancel(); // Stop any pending speech
        const utterance = new SpeechSynthesisUtterance(text);

        // Pick matching voice
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = locale === 'ru' ? 'ru' : locale === 'en' ? 'en' : 'uz';
        const matchingVoice =
          voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
          voices.find((v) => v.lang.toLowerCase().startsWith('ru')) ||
          voices[0];

        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }

        utterance.lang = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'uz-UZ';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
      }
    },
    [isSupported, enabled, locale],
  );

  const speakSuccess = useCallback(
    (studentName: string, groupName?: string) => {
      const firstName = studentName.split(' ')[0] || studentName;
      if (locale === 'ru') {
        speak(
          groupName
            ? `Добро пожаловать, ${firstName}! Занятие по группе ${groupName} отмечено.`
            : `Добро пожаловать, ${firstName}! Посещение успешно отмечено.`,
        );
      } else if (locale === 'en') {
        speak(
          groupName
            ? `Welcome, ${firstName}! Checked into ${groupName}.`
            : `Welcome, ${firstName}! Attendance recorded.`,
        );
      } else {
        // Uzbek
        speak(
          groupName
            ? `Xush kelibsiz, ${firstName}! ${groupName} darsi belgilandi.`
            : `Xush kelibsiz, ${firstName}! Davomatingiz qayd etildi.`,
        );
      }
    },
    [locale, speak],
  );

  const speakDuplicate = useCallback(
    (studentName: string) => {
      const firstName = studentName.split(' ')[0] || studentName;
      if (locale === 'ru') {
        speak(`${firstName}, ваше посещение уже было отмечено.`);
      } else if (locale === 'en') {
        speak(`${firstName}, your attendance was already logged.`);
      } else {
        speak(`${firstName}, sizning davomatingiz allaqachon belgilangan.`);
      }
    },
    [locale, speak],
  );

  const speakUnknown = useCallback(() => {
    if (locale === 'ru') {
      speak('Лицо не распознано. Пожалуйста, обратитесь к администратору.');
    } else if (locale === 'en') {
      speak('Face not recognized. Please see the front desk.');
    } else {
      speak("Yuz aniqlanmadi. Iltimos, ma'muriyatga murojaat qiling.");
    }
  }, [locale, speak]);

  const speakAccessDenied = useCallback(
    (reason?: string) => {
      if (locale === 'ru') {
        speak(
          reason === 'INSUFFICIENT_FUNDS'
            ? 'Доступ приостановлен: требуется оплата обучения.'
            : 'Доступ отклонен.',
        );
      } else if (locale === 'en') {
        speak(
          reason === 'INSUFFICIENT_FUNDS'
            ? 'Access restricted: pending tuition balance.'
            : 'Access denied.',
        );
      } else {
        speak(
          reason === 'INSUFFICIENT_FUNDS'
            ? "Kirish cheklangan: to'lov balansi talab etiladi."
            : 'Kirish rad etildi.',
        );
      }
    },
    [locale, speak],
  );

  return {
    isSupported,
    enabled,
    toggleVoice,
    speak,
    speakSuccess,
    speakDuplicate,
    speakUnknown,
    speakAccessDenied,
  };
}
