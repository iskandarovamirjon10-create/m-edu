import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Users,
  Building2,
  TrendingUp,
  Maximize2,
  Minimize2,
  DoorOpen,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Flame,
  Radio,
  ArrowUpRight,
} from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePremiumSound } from '@/hooks/usePremiumSound';

interface RoomStatus {
  id: string;
  name: string;
  groupName: string;
  teacher: string;
  subject: string;
  occupied: number;
  capacity: number;
  status: 'ACTIVE' | 'BREAK' | 'EMPTY';
}

interface PulseEvent {
  id: string;
  studentName: string;
  groupName: string;
  time: string;
  direction: 'IN' | 'OUT';
  type: 'FACE_ID' | 'QR';
}

const INITIAL_ROOMS: RoomStatus[] = [
  { id: '101', name: 'Xona 101 · Apple Lab', groupName: 'Frontend Pro-24', teacher: 'Jasur Rahimov', subject: 'React & TypeScript', occupied: 18, capacity: 20, status: 'ACTIVE' },
  { id: '102', name: 'Xona 102 · Oxford Hall', groupName: 'IELTS Band 7.5+', teacher: 'Malika Toirova', subject: 'IELTS Academic', occupied: 15, capacity: 16, status: 'ACTIVE' },
  { id: '103', name: 'Xona 103 · Turing Studio', groupName: 'Python AI & ML', teacher: 'Bobur Sobirov', subject: 'Machine Learning', occupied: 14, capacity: 15, status: 'ACTIVE' },
  { id: '104', name: 'Xona 104 · Design Hub', groupName: 'UI/UX Vision Pro', teacher: 'Kamola Karimova', subject: 'Product Design', occupied: 12, capacity: 14, status: 'ACTIVE' },
  { id: '105', name: 'Xona 105 · Kids Arena', groupName: 'Mental Arifmetika', teacher: 'Nodira Umarova', subject: 'Arifmetika', occupied: 16, capacity: 16, status: 'ACTIVE' },
  { id: '106', name: 'Xona 106 · STEM Lab', groupName: 'Robototexnika', teacher: 'Farhod Aliyev', subject: 'Arduino & IoT', occupied: 0, capacity: 14, status: 'EMPTY' },
];

const INITIAL_PULSES: PulseEvent[] = [
  { id: 'p1', studentName: 'Azizbek Qodirov', groupName: 'Frontend Pro-24', time: '10:42:15', direction: 'IN', type: 'FACE_ID' },
  { id: 'p2', studentName: 'Madina Usmonova', groupName: 'IELTS Band 7.5+', time: '10:41:50', direction: 'IN', type: 'FACE_ID' },
  { id: 'p3', studentName: 'Sardorbek Ergashev', groupName: 'Python AI & ML', time: '10:40:12', direction: 'IN', type: 'QR' },
  { id: 'p4', studentName: 'Zilola Ahmedova', groupName: 'UI/UX Vision Pro', time: '10:39:40', direction: 'IN', type: 'FACE_ID' },
];

export const CommandCenterTV = memo(function CommandCenterTV() {
  usePageTitle('M-EDU Live Command Center · Wall Display');
  const sound = usePremiumSound();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [rooms, setRooms] = useState<RoomStatus[]>(INITIAL_ROOMS);
  const [pulses, setPulses] = useState<PulseEvent[]>(INITIAL_PULSES);
  const [todayRevenue, setTodayRevenue] = useState(18450000);
  const [inBuildingCount, setInBuildingCount] = useState(89);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Periodic Telemetry Simulator to keep display alive
  useEffect(() => {
    const interval = setInterval(() => {
      // Small simulated pulse
      const names = ['Otabek Rasulov', 'Dilnoza Karimova', 'Sherzod Tursunov', 'Gulnoza Saidova', 'Javohir Qosimov'];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomRoom = INITIAL_ROOMS[Math.floor(Math.random() * 4)];
      const nowStr = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setPulses((prev) => [
        {
          id: `pulse-${Date.now()}`,
          studentName: randomName,
          groupName: randomRoom.groupName,
          time: nowStr,
          direction: 'IN',
          type: Math.random() > 0.3 ? 'FACE_ID' : 'QR',
        },
        ...prev.slice(0, 4),
      ]);

      setInBuildingCount((prev) => Math.min(150, prev + 1));
      if (Math.random() > 0.5) {
        setTodayRevenue((prev) => prev + 450000);
      }
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  return (
    <div className="relative min-h-screen w-full select-none overflow-x-hidden bg-[#06080e] p-6 text-white font-sans antialiased">
      {/* Background Ambient Glow Grids */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-600/15 blur-[160px]" />
        <div className="absolute right-0 top-1/4 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[180px]" />
        <div className="absolute bottom-0 left-1/3 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[180px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1920px] space-y-6">
        {/* Top Bar: Brand, Live Pulse Beacon, Clock & Controls */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-900/60 px-8 py-5 backdrop-blur-2xl">
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-0.5 shadow-xl shadow-blue-500/25">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#070b14]">
                <Building2 className="h-7 w-7 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  M-EDU COMMAND CENTER
                </h1>
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs font-black tracking-wider text-emerald-400">
                    LIVE STREAM
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Markaziy Dispetcherlik · Jonli Telemetriya & Bino Monitori
              </p>
            </div>
          </div>

          {/* Clock & Action buttons */}
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 text-3xl font-black tracking-tight text-white">
                <Clock className="h-6 w-6 text-blue-400" />
                <span>
                  {currentTime.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-400">
                {currentTime.toLocaleDateString('uz-UZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                title={soundEnabled ? 'Ovozni o\'chirish' : 'Ovozni yoqish'}
              >
                {soundEnabled ? <Volume2 className="h-5 w-5 text-blue-400" /> : <VolumeX className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                title="To'liq ekran rejimi"
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>

        {/* 4 Hero Counters (Odometer Aesthetic) */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {/* 1. Bino ichidagi o'quvchilar */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-6 backdrop-blur-2xl shadow-xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Bino Ichidagi O'quvchilar</span>
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-5xl font-black tracking-tight text-white">
                {inBuildingCount}
              </span>
              <span className="text-sm font-semibold text-slate-400">/ 180 sig'im</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span>Optimal sig'im: 49.4% to'lgan</span>
            </div>
          </div>

          {/* 2. Bugungi Tushum */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-6 backdrop-blur-2xl shadow-xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Bugungi Kassa Tushumi</span>
              <CreditCard className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight text-emerald-400">
                {todayRevenue.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase">UZS</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
              <ArrowUpRight className="h-4 w-4" />
              <span>+18% o'tgan haftaga nisbatan</span>
            </div>
          </div>

          {/* 3. Faol Darslar */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-6 backdrop-blur-2xl shadow-xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Jonli Dars Xonalari</span>
              <Activity className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-5xl font-black tracking-tight text-indigo-400">
                5
              </span>
              <span className="text-sm font-semibold text-slate-400">/ 6 xona band</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-indigo-300">
              <Flame className="h-4 w-4 text-amber-400" />
              <span>Barcha o'qituvchilar darsda</span>
            </div>
          </div>

          {/* 4. Turniket & Biometrika */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-6 backdrop-blur-2xl shadow-xl">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Turniket Face ID Aniqligi</span>
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight text-cyan-400">
                99.8%
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-cyan-300">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>384 ta kirish bugun qayd etildi</span>
            </div>
          </div>
        </div>

        {/* Main Content: Classroom Heatmap & Live Turnstile Gate Feed */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Classroom Occupancy Matrix (8 cols) */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-2xl lg:col-span-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <DoorOpen className="h-6 w-6 text-blue-400" />
                <h2 className="text-lg font-bold text-white">
                  Xonalar & Mashg'ulotlar Holati
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Real vaqtda xonalar sig'imi
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.map((room) => {
                const percent = Math.round((room.occupied / room.capacity) * 100);
                const isActive = room.status === 'ACTIVE';

                return (
                  <div
                    key={room.id}
                    className={`relative overflow-hidden rounded-2xl border p-4.5 transition-all ${
                      isActive
                        ? 'border-blue-500/30 bg-blue-500/5 shadow-md shadow-blue-500/5'
                        : 'border-white/5 bg-white/[0.02] opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-black text-blue-400 uppercase tracking-wide">
                          {room.name}
                        </span>
                        <h4 className="mt-0.5 text-base font-bold text-white">
                          {room.groupName}
                        </h4>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {isActive ? 'Darsda' : 'Bo\'sh'}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-slate-400">
                      <p>Ustoz: <span className="font-semibold text-slate-200">{room.teacher}</span></p>
                      <p>Fan: <span className="font-semibold text-slate-200">{room.subject}</span></p>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                        <span>O'quvchilar:</span>
                        <span className="text-white font-bold">{room.occupied} / {room.capacity} ({percent}%)</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-700"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Live Biometric Turnstile Pulse Stream (4 cols) */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-2xl lg:col-span-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <Radio className="h-6 w-6 text-emerald-400 animate-pulse" />
                <h2 className="text-lg font-bold text-white">
                  Turniket Jonli Oqimi
                </h2>
              </div>
              <span className="text-xs text-emerald-400 font-bold">
                Online
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <AnimatePresence initial={false}>
                {pulses.map((pulse) => (
                  <motion.div
                    key={pulse.id}
                    initial={{ opacity: 0, y: -16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {pulse.studentName}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {pulse.groupName} · {pulse.type === 'FACE_ID' ? 'Face ID' : 'QR Kartochka'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                        KIRDI
                      </span>
                      <p className="mt-1 text-[10px] font-mono text-slate-400">{pulse.time}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CommandCenterTV;
