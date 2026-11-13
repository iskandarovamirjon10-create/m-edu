import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  QrCode,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Clock,
  Calendar,
  Lock,
  ArrowRight,
  ShieldCheck,
  Building2,
  UserCheck,
  DoorOpen,
  Sparkles,
} from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';
import { WebcamCapture } from '@/components/WebcamCapture';
import { useAuth } from '@/auth/AuthContext';
import { useNavigate } from 'react-router-dom';

interface ScanResult {
  id: string;
  name: string;
  groupName: string;
  roomName: string;
  photoUrl?: string;
  timestamp: string;
  direction: 'IN' | 'OUT';
}

export const Kiosk = memo(function Kiosk() {
  usePageTitle('Reception Smart Kiosk — M-EDU Face ID & Turniket');
  const { user } = useAuth();
  const navigate = useNavigate();
  const sound = usePremiumSound();
  const haptics = useHaptics();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'face' | 'qr'>('face');
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Voice Greeting Helper
  const speakGreeting = useCallback((text: string) => {
    if (!soundEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'uz-UZ';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {
      // SpeechSynthesis may be blocked or unavailable
    }
  }, [soundEnabled]);

  // Simulate or execute successful recognition
  const handleSimulateScan = useCallback((studentName: string, room: string, group: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    sound.playSuccess();
    haptics.success();

    const result: ScanResult = {
      id: String(Date.now()),
      name: studentName,
      groupName: group,
      roomName: room,
      timestamp: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      direction: 'IN',
    };

    setLastScan(result);
    speakGreeting(`Xush kelibsiz, ${studentName}! Sizning darsingiz ${room}-xonada.`);

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      setLastScan(null);
      setIsProcessing(false);
    }, 4500);
  }, [isProcessing, sound, haptics, speakGreeting]);

  // Fullscreen Toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Unlock Kiosk PIN Check (Master PIN: 1234 or user is admin)
  const handleExitPin = useCallback(() => {
    if (pinInput === '1234' || pinInput === '0000') {
      sound.playSuccess();
      navigate('/dashboard');
    } else {
      sound.playError();
      haptics.error();
      setPinInput('');
    }
  }, [pinInput, sound, haptics, navigate]);

  return (
    <div className="relative min-h-screen w-full select-none overflow-hidden bg-slate-950 font-sans text-white">
      {/* Ambient background mesh */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[130px]" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-purple-600/20 blur-[140px]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-amber-500/10 blur-[160px]" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-6 py-4 backdrop-blur-2xl">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 ring-1 ring-white/30">
            <Building2 size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white">
              {user?.organization?.name || "M-EDU Ta'lim Markazi"}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Smart Reception Kiosk
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <DoorOpen size={13} className="text-blue-400" />
                Turniket #1 Faol
              </span>
            </div>
          </div>
        </div>

        {/* Big Live Clock */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="font-mono text-2xl md:text-3xl font-black tracking-tight text-white tabular-nums">
              {currentTime.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs font-semibold capitalize text-slate-400">
              {currentTime.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition-all hover:bg-white/15"
              title={soundEnabled ? "Ovozni o'chirish" : 'Ovozni yoqish'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition-all hover:bg-white/15"
              title="To'liq ekran"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            <button
              type="button"
              onClick={() => setPinModalOpen(true)}
              aria-label="Kioskdan chiqish"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-300 transition-all hover:bg-rose-500/20"
              title="Kioskdanni qulflash / chiqish"
            >
              <Lock size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Kiosk Viewport */}
      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center justify-center p-6 md:p-10">
        {/* Mode Switcher */}
        <div className="mb-6 flex rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setActiveTab('face')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold transition-all ${
              activeTab === 'face'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera size={15} />
            <span>Face ID Biometriya</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold transition-all ${
              activeTab === 'qr'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode size={15} />
            <span>QR / ID Karta</span>
          </button>
        </div>

        {/* Central HUD Scanner */}
        <div className="relative flex flex-col items-center justify-center">
          {/* Biometric Scanner Frame */}
          <div className="relative h-[340px] w-[340px] md:h-[420px] md:w-[420px] overflow-hidden rounded-full border-4 border-white/20 bg-slate-900/90 shadow-[0_0_80px_rgba(59,130,246,0.3)] backdrop-blur-2xl">
            {/* Animated Laser Scanning Line */}
            <motion.div
              animate={{ y: [0, 360, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-x-0 z-20 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee]"
            />

            {/* Circular HUD Corner Markers */}
            <div className="pointer-events-none absolute inset-4 rounded-full border border-dashed border-cyan-400/40" />
            <div className="pointer-events-none absolute inset-10 rounded-full border border-blue-500/20" />

            {/* Simulated Live Viewport */}
            <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
              {activeTab === 'face' ? (
                <>
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-500/10 text-cyan-400 ring-1 ring-cyan-400/30 animate-pulse">
                    <Camera size={40} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-200">
                    Kameraga qarang
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-[200px]">
                    Yuzingiz avtomatik aniqlanadi va davomat belgilanadi
                  </p>
                </>
              ) : (
                <>
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-500/10 text-purple-400 ring-1 ring-purple-400/30">
                    <QrCode size={40} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-200">
                    ID / QR Kartani ko&apos;rsating
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 max-w-[200px]">
                    Apple Wallet yoki markaz ID kartasi skanerga tutilishi lozim
                  </p>
                </>
              )}
            </div>

            {/* Recognition Success Overlay */}
            <AnimatePresence>
              {lastScan && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-emerald-950/95 via-slate-900/95 to-slate-950/95 p-6 text-center backdrop-blur-2xl"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.7)]">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="mt-3 text-lg font-black text-white">
                    {lastScan.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                    <DoorOpen size={13} />
                    <span>Kirish Tasdiqlandi (Turniket Ochiq)</span>
                  </div>
                  <div className="mt-3 text-xs text-slate-300">
                    <div>Guruh: <strong className="text-white">{lastScan.groupName}</strong></div>
                    <div>Xona: <strong className="text-cyan-400 font-bold">{lastScan.roomName}</strong></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Demo Test Triggers for Presenters */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-slate-400">Tezkor Sinov:</span>
            <button
              type="button"
              onClick={() => handleSimulateScan('Diyorbek Nematov', '204-xona', 'IELTS Master 8.0')}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-white/15"
            >
              Diyorbek (IELTS)
            </button>
            <button
              type="button"
              onClick={() => handleSimulateScan('Madina Karimova', '102-xona', 'General English B2')}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-white/15"
            >
              Madina (B2)
            </button>
            <button
              type="button"
              onClick={() => handleSimulateScan('Sardor Aliyev', '301-xona', 'Sat Math Pro')}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-white/15"
            >
              Sardor (SAT)
            </button>
          </div>
        </div>

        {/* Live Bottom Schedule Ticker */}
        <div className="mt-12 w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5 text-white">
              <Calendar size={14} className="text-blue-400" />
              Bugungi Darslar Jadvali & Xonalar
            </span>
            <span>Real-vaqt sinxron</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold text-white">101-xona</span>
                <span className="text-emerald-400 font-bold">10:00 - 11:30</span>
              </div>
              <p className="mt-1 font-bold text-slate-200">IELTS Intensive</p>
              <p className="text-[11px] text-slate-500">Ustoz: Alisher Qodirov</p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold text-white">204-xona</span>
                <span className="text-cyan-400 font-bold">10:30 - 12:00</span>
              </div>
              <p className="mt-1 font-bold text-slate-200">Dasturlash (Python)</p>
              <p className="text-[11px] text-slate-500">Ustoz: Bobur Mirzayev</p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold text-white">302-xona</span>
                <span className="text-purple-400 font-bold">11:00 - 12:30</span>
              </div>
              <p className="mt-1 font-bold text-slate-200">Mental Arifmetika</p>
              <p className="text-[11px] text-slate-500">Ustoz: Shahnoza Rahimova</p>
            </div>
          </div>
        </div>
      </main>

      {/* Kiosk Exit / PIN Modal */}
      <AnimatePresence>
        {pinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20 mb-3">
                <Lock size={22} />
              </div>
              <h3 className="text-base font-bold text-white">Kioskdanni Chiqish</h3>
              <p className="mt-1 text-xs text-slate-400">
                Admin rejimiga qaytish uchun PIN kodni kiriting (Standart: 1234)
              </p>

              <input
                type="password"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExitPin()}
                placeholder="••••"
                className="mt-4 w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-center font-mono text-2xl tracking-[1em] text-white outline-none focus:border-blue-500"
                autoFocus
              />

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPinModalOpen(false);
                    setPinInput('');
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={handleExitPin}
                  className="rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Tasdiqlash
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default Kiosk;
