import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// 1. STRICT WEB SPEECH API TYPES (Zero `any` Policy)
// ============================================================================

export type SpeechErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'unknown';

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechErrorCode;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

// ============================================================================
// 2. HOOK OPTIONS & RETURN INTERFACE
// ============================================================================

export interface UseSpeechRecognitionOptions {
  /** Matn aniqlanganda chaqiriladi (isFinal: yakuniy jumla yoki oraliq matn) */
  onResult: (text: string, isFinal: boolean) => void;
  /** Tinglash to'liq to'xtaganda chaqiriladi */
  onEnd?: () => void;
  /** Xatolik yuz berganda chaqiriladi (masalan, mikrofon ruxsati berilmaganda) */
  onError?: (error: SpeechErrorCode) => void;
  /** Tanib olish tili (Standart: 'uz-UZ') */
  lang?: string;
  /** To'xtovsiz tinglash rejimi (Standart: true) */
  continuous?: boolean;
  /** Sukut sababli o'chib qolsa avtomatik qayta yoqish (Standart: false) */
  autoRestartOnSilence?: boolean;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  error: SpeechErrorCode | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

// ============================================================================
// 3. CORE HOOK IMPLEMENTATION
// ============================================================================

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as SpeechWindow;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({
  onResult,
  onEnd,
  onError,
  lang = 'uz-UZ',
  continuous = true,
  autoRestartOnSilence = false,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<SpeechErrorCode | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  
  // State Lock Refs (Race Condition va InvalidStateError oldini oladi)
  const isListeningRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const isManualStopRef = useRef(false);

  // Callback Refs (Dependency o'zgarganda mikrofonni uzib qo'ymaslik uchun)
  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  const autoRestartRef = useRef(autoRestartOnSilence);

  useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
    onErrorRef.current = onError;
    autoRestartRef.current = autoRestartOnSilence;
  }, [onResult, onEnd, onError, autoRestartOnSilence]);

  // Til (lang) dinamik o'zgarganda obyektni qayta yaratmasdan yangilash
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, [lang]);

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      isTransitioningRef.current = false;
      setError(null);
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';

        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interimChunk += transcript;
        }
      }

      // DATA LOSS FIX: Final va Interim qismlarni bir-birini bosib ketmasdan uzatamiz
      const trimmedFinal = finalChunk.trim();
      if (trimmedFinal) {
        onResultRef.current(trimmedFinal, true);
      }

      const trimmedInterim = interimChunk.trim();
      if (trimmedInterim) {
        onResultRef.current(trimmedInterim, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errCode = event.error || 'unknown';
      isTransitioningRef.current = false;

      // Foydalanuvchi o'zi to'xtatganda yoki 'no-speech' bo'lganda konsolni ifloslantirmaymiz
      if (errCode === 'aborted' && isManualStopRef.current) {
        return;
      }

      if (errCode === 'no-speech' && autoRestartRef.current && !isManualStopRef.current) {
        return; // `onend` ichida avtomatik qayta ishga tushadi
      }

      // Kritik ruxsat xatolarida avto-qayta yoqishni bloklaymiz
      if (errCode === 'not-allowed' || errCode === 'service-not-allowed' || errCode === 'audio-capture') {
        isManualStopRef.current = true;
      }

      setError(errCode);
      onErrorRef.current?.(errCode);
    };

    recognition.onend = () => {
      isTransitioningRef.current = false;

      // Agar sukut sababli o'chgan bo'lsa va autoRestart yoqilgan bo'lsa -> qayta yoqamiz
      if (!isManualStopRef.current && autoRestartRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          return;
        } catch {
          // Qayta yoqishda xato bo'lsa, normal to'xtashga o'tamiz
        }
      }

      isListeningRef.current = false;
      setIsListening(false);
      onEndRef.current?.();
    };

    recognitionRef.current = recognition;

    return () => {
      isManualStopRef.current = true;
      // MEMORY LEAK FIX: Unmountdan keyin state yangilanmasligi uchun handlerlarni uzamiz
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      try {
        recognition.abort();
      } catch {
        // Ignore abort errors on unstarted instance
      }
      recognitionRef.current = null;
      isListeningRef.current = false;
      isTransitioningRef.current = false;
    };
  }, [continuous]); // `lang` alohida useEffect orqali boshqariladi

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!isSupported || !recognition || isListeningRef.current || isTransitioningRef.current) {
      return;
    }

    isManualStopRef.current = false;
    isTransitioningRef.current = true;
    setError(null);

    try {
      recognition.lang = lang;
      recognition.start();
    } catch {
      isTransitioningRef.current = false;
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, lang]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!isSupported || !recognition || !isListeningRef.current || isTransitioningRef.current) {
      return;
    }

    isManualStopRef.current = true;
    isTransitioningRef.current = true;

    try {
      // stop() abort() dan farqli ravishda oxirgi aytilgan bo'g'inni ham serverdan qaytaradi
      recognition.stop();
    } catch {
      isTransitioningRef.current = false;
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [isSupported]);

  const toggle = useCallback(() => {
    if (isListeningRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  return {
    isListening,
    isSupported,
    error,
    start,
    stop,
    toggle,
  };
}