import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassSurface, GlassButton, GlassBadge, useToast } from '@/components/ui';
import { cn, Icon } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { faceApi, studentsApi } from '@/lib/api';

export type VoiceLanguage = 'uz' | 'ru' | 'en';

export interface GreetedStudent {
  id: string;
  name: string;
  avatarUrl?: string;
  studentCode: string;
  className: string;
  nextRoom: string;
  nextSubject: string;
  startTime: string;
  financialStatus: 'paid' | 'grace_period' | 'pending' | 'unknown';
  balanceFormatted: string;
  greetedAt: string;
  spokenText: string;
}

export interface BiometricVoiceGreetingConsoleProps {
  className?: string;
  defaultLanguage?: VoiceLanguage;
}

export function BiometricVoiceGreetingConsole({
  className,
  defaultLanguage = 'uz',
}: BiometricVoiceGreetingConsoleProps) {
  const toast = useToast();
  const sounds = usePremiumSound();

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const [language, setLanguage] = useState<VoiceLanguage>(defaultLanguage);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.05);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeStudent, setActiveStudent] = useState<GreetedStudent | null>(null);
  const [history, setHistory] = useState<GreetedStudent[]>([]);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [isLoadingBackend, setIsLoadingBackend] = useState(false);

  // Sync with real backend recognition history and registered students
  useEffect(() => {
    let cancelled = false;
    async function fetchBackendData() {
      setIsLoadingBackend(true);
      try {
        const [recRes, stRes] = await Promise.allSettled([
          faceApi.recognitionHistory({ limit: 5 }),
          studentsApi.list({ limit: 5 }),
        ]);

        if (cancelled) return;

        const recData = recRes.status === 'fulfilled' ? (recRes.value as any) : null;
        const stData = stRes.status === 'fulfilled' ? (stRes.value as any) : null;
        const recItems = Array.isArray(recData?.items) ? recData.items : [];
        const studentItems = Array.isArray(stData?.items) ? stData.items : [];

        if (recItems.length > 0) {
          // Faqat javobda mavjud bo'lgan maydonlar — xona, fan, balans va to'lov
          // holati o'ylab topilmaydi.
          const mapped: GreetedStudent[] = recItems.slice(0, 5).map((item: any, idx: number) => {
            const name = item.studentName || item.student?.firstName || '';
            const room = item.roomName || item.room || '';
            const subject = item.subjectName || item.subject || '';
            return {
              id: item.id || `rec-${idx}`,
              name: name || '—',
              studentCode: item.studentCode || item.code || '—',
              className: item.groupName || item.group?.name || '—',
              nextRoom: room || '—',
              nextSubject: subject || '—',
              startTime: item.startTime || '—',
              financialStatus: 'unknown',
              balanceFormatted: '—',
              greetedAt: item.createdAt ? new Date(item.createdAt).toLocaleTimeString() : '—',
              spokenText: room
                ? `Xush kelibsiz, ${name}! Darsingiz ${room}da boshlanadi.`
                : `Xush kelibsiz, ${name || 'mehmon'}!`,
            };
          });
          setHistory(mapped);
          setActiveStudent(mapped[0]);
        } else if (studentItems.length > 0) {
          const mapped: GreetedStudent[] = studentItems.slice(0, 5).map((st: any, idx: number) => {
            const fullName = `${st.user?.firstName || st.firstName || ''} ${
              st.user?.lastName || st.lastName || ''
            }`.trim();
            const groupName = st.groups?.[0]?.group?.name || '';
            return {
              id: st.id || `st-${idx}`,
              name: fullName || '—',
              studentCode: st.studentCode || st.code || '—',
              className: groupName || '—',
              nextRoom: '—',
              nextSubject: groupName || '—',
              startTime: '—',
              financialStatus: 'unknown',
              balanceFormatted:
                st.balance != null ? `${Number(st.balance).toLocaleString('uz-UZ')} UZS` : '—',
              greetedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              spokenText: `Xush kelibsiz, ${fullName || 'mehmon'}!`,
            };
          });
          setHistory(mapped);
          setActiveStudent(mapped[0]);
        }
      } catch {
        // Safe fallback
      } finally {
        if (!cancelled) setIsLoadingBackend(false);
      }
    }

    void fetchBackendData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Web Speech API Voice Synthesizer
  const speakText = useCallback(
    (text: string, lang: VoiceLanguage = language) => {
      if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        sounds.playFaceIdMatch();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;

      // Locale matching
      if (lang === 'uz') {
        utterance.lang = 'uz-UZ';
      } else if (lang === 'ru') {
        utterance.lang = 'ru-RU';
      } else {
        utterance.lang = 'en-US';
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        sounds.playLaserScan();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        sounds.playSuccess();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled, language, speechRate, speechPitch, sounds]
  );

  const handleSimulateGreeting = useCallback(() => {
    if (history.length === 0) {
      toast.error('Talaba topilmadi', "Avval talabalar ro'yxati yuklanishi kerak");
      return;
    }

    const nextIndex = (greetingIndex + 1) % history.length;
    const student = history[nextIndex];

    const hasRoom = Boolean(student.nextRoom) && student.nextRoom !== '—';
    const greetingText =
      language === 'uz'
        ? hasRoom
          ? `Xush kelibsiz, ${student.name}! Darsingiz ${student.nextRoom}da, fan: ${student.nextSubject}.`
          : `Xush kelibsiz, ${student.name}!`
        : language === 'ru'
          ? hasRoom
            ? `Добро пожаловать, ${student.name}! Ваш урок в кабинете ${student.nextRoom}, предмет: ${student.nextSubject}.`
            : `Добро пожаловать, ${student.name}!`
          : hasRoom
            ? `Welcome, ${student.name}! Your class is in room ${student.nextRoom}, subject: ${student.nextSubject}.`
            : `Welcome, ${student.name}!`;

    const updated: GreetedStudent = {
      ...student,
      id: `${student.id}-${Date.now()}`,
      greetedAt: new Date().toLocaleTimeString(),
      spokenText: greetingText,
    };

    setGreetingIndex(nextIndex);
    setActiveStudent(updated);
    setHistory((prev) => [updated, ...prev].slice(0, 10));
    speakText(greetingText);
    toast.success('Biometrik ovozli salomlashish ijro etildi', student.name);
  }, [greetingIndex, history, language, speakText, toast]);

  const activeBadgeVariant = useMemo(() => {
    if (!activeStudent) return 'neutral';
    if (activeStudent.financialStatus === 'paid') return 'success';
    if (activeStudent.financialStatus === 'grace_period') return 'warning';
    if (activeStudent.financialStatus === 'pending') return 'danger';
    return 'neutral';
  }, [activeStudent]);

  return (
    <GlassSurface
      className={cn('rounded-3xl p-4 sm:p-6 lg:p-8 space-y-6 overflow-hidden border border-border/40', className)}
    >
      {/* Header with audio visualizer indicator and controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/30 pb-5">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Icon name="mic" className="w-6 h-6" />
            {isSpeaking && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500" />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Biometrik Ovozli Salomlashish & Hologramma HUD
              </h2>
              <GlassBadge variant="cyan" size="sm">
                Web Speech AI v3
              </GlassBadge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Turniketdan o‘tgan o‘quvchilarni 3 tilda shaxsiylashtirilgan ovoz va xona ko‘rsatmasi bilan kutib olish
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center rounded-xl bg-surface-2/60 p-1 border border-border/40">
            {(['uz', 'ru', 'en'] as VoiceLanguage[]).map((lang) => (
              <button
                key={lang}
                onClick={() => {
                  setLanguage(lang);
                  sounds.playPop();
                }}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-semibold uppercase transition-all',
                  language === lang
                    ? 'bg-cyan-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {lang}
              </button>
            ))}
          </div>

          <GlassButton
            size="sm"
            variant={voiceEnabled ? 'primary' : 'secondary'}
            onClick={() => {
              setVoiceEnabled(!voiceEnabled);
              sounds.playTick();
            }}
          >
            <Icon name="mic" className="w-4 h-4 mr-1.5" />
            {voiceEnabled ? 'Ovoz faol' : 'Ovoz o‘chirilgan'}
          </GlassButton>

          <GlassButton
            size="sm"
            variant="secondary"
            onClick={handleSimulateGreeting}
            disabled={isLoadingBackend}
          >
            <Icon name="play" className="w-4 h-4 mr-1.5 text-cyan-400" />
            Simulyatsiya
          </GlassButton>
        </div>
      </div>

      {/* Main Grid: Holographic Student Card + Speech Waveform + Recent History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Holographic Interactive Student Card (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <AnimatePresence mode="wait">
            {activeStudent ? (
              <motion.div
                key={activeStudent.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-surface-1/90 via-surface-2/50 to-cyan-950/20 p-5 sm:p-6 shadow-xl backdrop-blur-xl"
              >
                {/* Decorative Cyber lines */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl pointer-events-none" />
                <div className="absolute top-3 right-4 flex items-center gap-2">
                  <GlassBadge variant={activeBadgeVariant} size="sm">
                    {activeStudent.financialStatus === 'paid'
                      ? "To'lov Aktiv"
                      : activeStudent.financialStatus === 'grace_period'
                      ? 'Imtiyozli muddat'
                      : activeStudent.financialStatus === 'pending'
                      ? 'Qarzdorlik'
                      : "To'lov holati noma'lum"}
                  </GlassBadge>
                  <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                    {activeStudent.studentCode}
                  </span>
                </div>

                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-cyan-400/60 bg-surface-3 flex items-center justify-center shadow-lg group">
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/60 to-transparent" />
                    <span className="text-2xl font-bold text-cyan-200">
                      {activeStudent.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </span>
                    {/* Live scan line effect */}
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-cyan-400 opacity-75 animate-pulse" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl sm:text-2xl font-black text-foreground">
                      {activeStudent.name}
                    </h3>
                    <p className="text-sm font-medium text-cyan-400 flex items-center gap-1.5">
                      <Icon name="star" className="w-4 h-4" />
                      {activeStudent.className}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Icon name="clock" className="w-3.5 h-3.5 text-muted-foreground" />
                      Aniqlangan vaqt: {activeStudent.greetedAt}
                    </p>
                  </div>
                </div>

                {/* Room Guidance & Schedule Highlight */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border/40">
                    <div className="text-[11px] uppercase font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Icon name="mapPin" className="w-3.5 h-3.5 text-cyan-400" />
                      Yo‘naltirilgan xona
                    </div>
                    <div className="text-sm sm:text-base font-bold text-foreground">
                      {activeStudent.nextRoom}
                    </div>
                    <div className="text-xs text-cyan-400 mt-0.5">
                      Dars vaqti: {activeStudent.startTime}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border/40">
                    <div className="text-[11px] uppercase font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                      <Icon name="book" className="w-3.5 h-3.5 text-cyan-400" />
                      Navbatdagi dars
                    </div>
                    <div className="text-sm sm:text-base font-bold text-foreground truncate">
                      {activeStudent.nextSubject}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Balans: {activeStudent.balanceFormatted}
                    </div>
                  </div>
                </div>

                {/* Live Spoken Transcript */}
                <div className="mt-4 p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-cyan-400 flex items-center gap-1.5">
                      <Icon name="mic" className="w-3.5 h-3.5" />
                      Ovozli Xabar Matni
                    </span>
                    <button
                      onClick={() => speakText(activeStudent.spokenText)}
                      className="text-xs text-cyan-300 hover:text-cyan-100 flex items-center gap-1 underline underline-offset-2"
                    >
                      <Icon name="refresh" className="w-3 h-3" />
                      Qayta eshitish
                    </button>
                  </div>
                  <p className="text-sm font-medium text-cyan-100/90 italic">
                    &ldquo;{activeStudent.spokenText}&rdquo;
                  </p>

                  {/* Audio Waveform Animation */}
                  {isSpeaking && (
                    <div className="mt-3 flex items-center gap-1 h-4">
                      {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 65, 35, 75, 85].map((h, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [`${h * 0.3}%`, `${h}%`, `${h * 0.4}%`] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.04 }}
                          className="w-1 bg-cyan-400 rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                <Icon name="user" className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Navbatdagi o‘quvchi tanlanmadi</p>
              </div>
            )}
          </AnimatePresence>

          {/* Voice Tuning Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-2/40 border border-border/30">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Ovoz Tezligi (Rate)</span>
                <span className="font-mono text-cyan-400">{speechRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Ovoz Balandligi / Pitch</span>
                <span className="font-mono text-cyan-400">{speechPitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.3"
                step="0.05"
                value={speechPitch}
                onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-surface-3 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Right: Real-time Greeting Stream Log (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="clock" className="w-3.5 h-3.5 text-cyan-400" />
              So‘nggi Kutib Olinganlar ({history.length})
            </span>
            <span className="text-[11px] text-muted-foreground">Jonli monitoring</span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-[380px] pr-1">
            {history.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl p-6">
                Hozircha kutib olingan talabalar yo‘q. Turniket orqali kirilganda ovozli xabarlar bu yerda ro‘yxatga olinadi.
              </div>
            ) : (
              history.map((item) => {
                const isSelected = activeStudent?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveStudent(item);
                      sounds.playPop();
                    }}
                    className={cn(
                      'p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3',
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/50 shadow-sm'
                        : 'bg-surface-2/40 border-border/30 hover:bg-surface-2/80'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                          {item.name}
                        </p>
                        <span className="text-[10px] text-cyan-400 font-mono">
                          {item.nextRoom.split('-')[0]}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {item.nextSubject} • {item.className}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {item.greetedAt}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakText(item.spokenText);
                        }}
                        className="p-1 rounded-md text-cyan-400 hover:bg-cyan-500/20"
                        title="Ovozni eshitish"
                      >
                        <Icon name="mic" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </GlassSurface>
  );
}
