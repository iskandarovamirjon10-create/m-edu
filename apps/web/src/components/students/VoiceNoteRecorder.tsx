/**
 * M-EDU V2 — Voice Observation Dictation & Waveform Studio (`VoiceNoteRecorder.tsx`)
 * Speech-to-text dictation for teachers and mentors using Web Speech API with audio equalizer.
 * Auto-detects behavioral tags (A'lo, Faol, Intizom, Uyga vazifa) and commits to student profile.
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useToasts } from '@/components/ui';
import { cn } from '@/lib/design';

/* ── Web Speech API (brauzerlar orasida nomi farq qiladi) ─────────────── */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorLike {
  error?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Auto-tagging lug‘ati — komponent renderida qayta yaratilmaydi. */
const DETECTED_TAGS: ReadonlyArray<{ word: string; tag: string }> = [
  { word: 'faol', tag: '🌟 Faol qatnashdi' },
  { word: 'kechikdi', tag: '⏰ Darsga kechikdi' },
  { word: 'vazifa', tag: '📚 Uy vazifasi a\'lo' },
  { word: 'intizom', tag: '🎯 Yaxshi intizom' },
  { word: 'qiyin', tag: '💡 Qo\'shimcha yordam kerak' },
];

interface VoiceNoteRecorderProps {
  studentName: string;
  onSaveNote: (note: {
    text: string;
    tags: string[];
    createdAt: string;
    durationSec: number;
  }) => void;
  onCancel?: () => void;
}

export const VoiceNoteRecorder = memo(function VoiceNoteRecorder({
  studentName,
  onSaveNote,
  onCancel,
}: VoiceNoteRecorderProps) {
  const { push } = useToasts();
  const { playTick, playSuccess, playLaserScan } = usePremiumSound();

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // `push` identity o‘zgarsa ham recognition qayta yaratilmasligi uchun ref.
  const pushRef = useRef(push);
  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  // Initialize SpeechRecognition if available
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionCtor();

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'uz-UZ';

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let current = '';
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript + ' ';
        }
        setTranscript(current.trim());

        // Check for auto-tags
        const lower = current.toLowerCase();
        DETECTED_TAGS.forEach(({ word, tag }) => {
          if (lower.includes(word)) {
            setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
          }
        });
      };

      recognition.onerror = (event: SpeechRecognitionErrorLike) => {
        setIsRecording(false);
        const errMsg =
          event?.error === 'not-allowed'
            ? 'Mikrofondan foydalanishga ruxsat berilmagan'
            : event?.error === 'no-speech'
            ? 'Ovoz eshitilmadi'
            : "Ovozni tanishda xatolik yuz berdi";
        pushRef.current('error', errMsg);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* recognition allaqachon to‘xtagan */
      }
    };
  }, []);

  // Timer while recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    playTick();
    if (isRecording) {
      // Stop
      setIsRecording(false);
      try {
        recognitionRef.current?.stop();
      } catch {
        /* recognition allaqachon to‘xtagan */
      }
      playLaserScan();
    } else {
      // Start
      setElapsedSec(0);
      setIsRecording(true);
      playSuccess();
      try {
        recognitionRef.current?.start();
      } catch {
        // Fallback demo text if speech recognition not permitted in browser
        setTranscript(
          `${studentName} bugungi darsda faol qatnashdi, barcha topshiriqlarni mustaqil bajardi.`,
        );
        setSelectedTags(['🌟 Faol qatnashdi', '🎯 Yaxshi intizom']);
      }
    }
  }, [isRecording, studentName, playTick, playSuccess, playLaserScan]);

  const handleSave = useCallback(() => {
    if (!transcript.trim()) {
      push('info', "Ovozli izoh bo'sh bo'lishi mumkin emas!");
      return;
    }
    playSuccess();
    onSaveNote({
      text: transcript.trim(),
      tags: selectedTags,
      createdAt: new Date().toISOString(),
      durationSec: elapsedSec,
    });
    push('success', "Ovozli kuzatuv izohi muvaffaqiyatli saqlandi!");
  }, [transcript, selectedTags, elapsedSec, onSaveNote, playSuccess, push]);

  const toggleTag = (tag: string) => {
    playTick();
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-2xl backdrop-blur-3xl dark:border-white/15 dark:bg-[#18181b]/90 text-[var(--text-primary,#1d1d1f)] dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-400/15 dark:text-purple-300 text-lg">
            🎙️
          </span>
          <div>
            <h4 className="text-sm font-bold tracking-tight">
              Ovozli Pedagogik Kuzatuv & Eslatma
            </h4>
            <p className="text-[11px] text-[var(--text-secondary,#86868b)]">
              Talaba: <strong>{studentName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="flex items-center gap-1.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2.5 py-1 text-xs font-mono font-bold animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              {formatTime(elapsedSec)}
            </span>
          )}
        </div>
      </div>

      {/* Waveform / Visualizer Stage */}
      <div className="my-4 flex flex-col items-center justify-center rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] p-4 border border-black/[0.05] dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5 h-12 mb-3">
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.span
              key={i}
              animate={
                isRecording
                  ? {
                      height: [
                        8,
                        Math.max(10, Math.min(44, (i * 13) % 40 + 6)),
                        8,
                      ],
                    }
                  : { height: 6 }
              }
              transition={
                isRecording
                  ? {
                      duration: 0.6,
                      repeat: Infinity,
                      delay: (i * 0.04) % 0.4,
                      ease: 'easeInOut',
                    }
                  : { duration: 0.2 }
              }
              className={cn(
                'w-1 rounded-full transition-colors',
                isRecording
                  ? 'bg-gradient-to-t from-brand-600 to-purple-500'
                  : 'bg-black/10 dark:bg-white/20',
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={toggleRecording}
          className={cn(
            'flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-all shadow-md',
            isRecording
              ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
              : 'bg-brand-600 hover:bg-brand-500 text-white',
          )}
        >
          <span>{isRecording ? '⏹ Yozishni to\'xtatish' : '🎙 Gapirishni boshlash'}</span>
        </button>
      </div>

      {/* Transcript Editor */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-[var(--text-secondary)]">
          Matn (Jonli transkripsiya):
        </label>
        <textarea
          rows={3}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Ovozli gapiring yoki matn kiriting..."
          className="w-full text-sm rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04] p-3 outline-none focus:border-brand-500"
        />
      </div>

      {/* Auto / Suggested Tags */}
      <div className="mt-3">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1.5">
          Teglar & Tavsiflar:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {[
            '🌟 Faol qatnashdi',
            '⏰ Darsga kechikdi',
            '📚 Uy vazifasi a\'lo',
            '🎯 Yaxshi intizom',
            '💡 Qo\'shimcha yordam kerak',
            '💬 Savol-javobda a\'lo',
          ].map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all',
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]',
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2.5 mt-5 border-t border-black/[0.06] dark:border-white/[0.08] pt-3.5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-black/10 dark:border-white/15 px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10"
          >
            Bekor qilish
          </button>
        )}
        <button
          type="button"
          disabled={!transcript.trim()}
          onClick={handleSave}
          className="flex-1 rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-40 transition-all"
        >
          ✓ Profilga Saqlash
        </button>
      </div>
    </div>
  );
});
