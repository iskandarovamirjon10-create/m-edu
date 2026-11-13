import { memo, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Award,
  CheckCircle2,
  Share2,
  Download,
  Sparkles,
  TrendingUp,
  BrainCircuit,
  QrCode,
  ShieldCheck,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useHaptics } from '@/hooks/useHaptics';

export interface StudentActivityMetrics {
  studentName: string;
  studentId: string;
  avatarUrl?: string;
  groupName: string;
  attendanceRate: number; // 0 - 100
  attendanceStreakDays: number;
  academicMastery: number; // 0 - 100
  homeworkRate: number; // 0 - 100
  completedHomeworks: number;
  totalHomeworks: number;
  mentorName?: string;
  rank?: string;
}

interface Props {
  metrics: StudentActivityMetrics;
  className?: string;
}

export const StudentActivityRingsPassport = memo(function StudentActivityRingsPassport({
  metrics,
  className = '',
}: Props) {
  const sound = usePremiumSound();
  const haptics = useHaptics();
  const [activeRing, setActiveRing] = useState<'all' | 'attendance' | 'academic' | 'homework'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // SVG Concentric Ring geometry
  const center = 100;
  const outerR = 80;
  const middleR = 60;
  const innerR = 40;
  const strokeWidth = 14;

  const getCircumference = (r: number) => 2 * Math.PI * r;
  const outerC = getCircumference(outerR);
  const middleC = getCircumference(middleR);
  const innerC = getCircumference(innerR);

  const outerOffset = outerC - (Math.min(100, Math.max(0, metrics.attendanceRate)) / 100) * outerC;
  const middleOffset = middleC - (Math.min(100, Math.max(0, metrics.academicMastery)) / 100) * middleC;
  const innerOffset = innerC - (Math.min(100, Math.max(0, metrics.homeworkRate)) / 100) * innerC;

  // AI Diagnostic Generation
  const aiDiagnosis = {
    strengths:
      metrics.attendanceRate >= 90
        ? "Namunali intizom: dars qoldirmaslik koeffitsienti yuqori va doimiy diqqat mavjud."
        : "Faol qatnashuv: amaliy mashg'ulotlarda tashabbuskorlik ko'rsatmoqda.",
    growthAreas:
      metrics.homeworkRate < 80
        ? "Mustaqil topshiriqlarni topshirish muddatlariga qat'iy rioya qilish tavsiya etiladi."
        : "Murakkabroq olimpiada yoki portfolio loyihalariga jalb etish maqsadga muvofiq.",
    parentAdvice:
      metrics.academicMastery >= 85
        ? "O'quvchining yuqori sur'atini qo'llab-quvvatlang va xalqaro sertifikat imtihonlariga yo'naltiring."
        : "Uyda haftada kamida 4 soat konsentratsiyalangan mustaqil amaliyot muhitini yarating.",
  };

  // Generate 1080x1920 Story Card
  const handleExportStory = useCallback(async () => {
    sound?.play('tap');
    haptics?.trigger?.('medium');
    setIsExporting(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1920);
      bgGrad.addColorStop(0, '#0a0d14');
      bgGrad.addColorStop(0.5, '#121826');
      bgGrad.addColorStop(1, '#05070a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1920);

      // Ambient radial orbs
      const orbGrad1 = ctx.createRadialGradient(200, 300, 50, 200, 300, 600);
      orbGrad1.addColorStop(0, 'rgba(255, 45, 85, 0.18)');
      orbGrad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = orbGrad1;
      ctx.fillRect(0, 0, 1080, 1920);

      const orbGrad2 = ctx.createRadialGradient(880, 1400, 50, 880, 1400, 700);
      orbGrad2.addColorStop(0, 'rgba(52, 199, 89, 0.15)');
      orbGrad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = orbGrad2;
      ctx.fillRect(0, 0, 1080, 1920);

      // Card Header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(' M-EDU SMART PASSPORT', 80, 140);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '26px -apple-system, sans-serif';
      ctx.fillText('O\'quvchi Rivojlanish Halqalari · Rasmiy Sertifikat', 80, 185);

      // Student Info Box
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(80, 240, 920, 220, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 56px -apple-system, sans-serif';
      ctx.fillText(metrics.studentName, 120, 330);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '32px -apple-system, sans-serif';
      ctx.fillText(`Guruh: ${metrics.groupName}  •  ID: ${metrics.studentId}`, 120, 390);

      // Draw Rings on Canvas
      const ringCenterX = 540;
      const ringCenterY = 760;
      const drawCanvasRing = (r: number, lw: number, percent: number, color: string, trackColor: string) => {
        // Track
        ctx.beginPath();
        ctx.arc(ringCenterX, ringCenterY, r, 0, 2 * Math.PI);
        ctx.lineWidth = lw;
        ctx.strokeStyle = trackColor;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Progress
        if (percent > 0) {
          ctx.beginPath();
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + (percent / 100) * 2 * Math.PI;
          ctx.arc(ringCenterX, ringCenterY, r, startAngle, endAngle);
          ctx.lineWidth = lw;
          ctx.strokeStyle = color;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      };

      drawCanvasRing(210, 32, metrics.attendanceRate, '#ff2d55', 'rgba(255, 45, 85, 0.2)');
      drawCanvasRing(158, 32, metrics.academicMastery, '#34c759', 'rgba(52, 199, 89, 0.2)');
      drawCanvasRing(106, 32, metrics.homeworkRate, '#0a84ff', 'rgba(10, 132, 255, 0.2)');

      // Center Icon or Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 50px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      const avg = Math.round((metrics.attendanceRate + metrics.academicMastery + metrics.homeworkRate) / 3);
      ctx.fillText(`${avg}%`, ringCenterX, ringCenterY + 12);
      ctx.font = '22px -apple-system, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('UMUMIY INDEKS', ringCenterX, ringCenterY + 50);
      ctx.textAlign = 'left';

      // Ring Legends
      const drawLegendPill = (y: number, color: string, title: string, value: string, sub: string) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(80, y, 920, 120, 24);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(130, y + 60, 18, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 34px -apple-system, sans-serif';
        ctx.fillText(title, 180, y + 55);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '24px -apple-system, sans-serif';
        ctx.fillText(sub, 180, y + 92);

        ctx.fillStyle = color;
        ctx.font = 'bold 42px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(value, 950, y + 72);
        ctx.textAlign = 'left';
      };

      drawLegendPill(1080, '#ff2d55', 'Davomat & Streak', `${metrics.attendanceRate}%`, `${metrics.attendanceStreakDays} kun davomiy streak`);
      drawLegendPill(1230, '#34c759', 'Akademik O\'zlashtirish', `${metrics.academicMastery}%`, 'Imtihon va test ko\'rsatkichlari');
      drawLegendPill(1380, '#0a84ff', 'Vazifalar & Amaliyot', `${metrics.homeworkRate}%`, `${metrics.completedHomeworks}/${metrics.totalHomeworks} topshirilgan`);

      // AI Seal & Footer
      ctx.fillStyle = 'rgba(147, 51, 234, 0.12)';
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
      ctx.beginPath();
      ctx.roundRect(80, 1540, 920, 240, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 30px -apple-system, sans-serif';
      ctx.fillText('✦ M-EDU NEURAL DIAGNOSTICS BRIEF', 120, 1600);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '24px -apple-system, sans-serif';
      ctx.fillText(`• ${aiDiagnosis.strengths.slice(0, 58)}...`, 120, 1650);
      ctx.fillText(`• ${aiDiagnosis.parentAdvice.slice(0, 58)}...`, 120, 1700);

      // Watermark
      ctx.fillStyle = '#64748b';
      ctx.font = '22px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Tasdiqlangan raqamli pasport · QR kod orqali tekshirish imkoniyati', 540, 1860);

      // Download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `M-EDU-Passport-${metrics.studentName.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();

      sound?.play('success');
      haptics?.trigger?.('success');
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('Story export error:', err);
      sound?.play('error');
    } finally {
      setIsExporting(false);
    }
  }, [metrics, sound, haptics, aiDiagnosis]);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 p-6 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/70 ${className}`}
    >
      {/* Decorative ambient backdrop */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 pb-5 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 via-amber-500 to-emerald-400 p-0.5 shadow-md">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950 text-white">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Rivojlanish Halqalari & Smart Pasport
              </h3>
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                 Fitness Rings
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              O'quvchining 3 yo'nalishli konsentrik faolligi va sun'iy intellekt xulosasi
            </p>
          </div>
        </div>

        {/* Action Button: Export Story / Telegram */}
        <button
          type="button"
          onClick={handleExportStory}
          disabled={isExporting}
          className="group relative flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] hover:shadow-blue-500/40 active:scale-[0.98] disabled:opacity-50"
        >
          {exportSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <span>Yuklandi!</span>
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4 transition-transform group-hover:rotate-12" />
              <span>{isExporting ? 'Tayyorlanmoqda...' : 'Story / Pasport Yuklab Olish'}</span>
            </>
          )}
        </button>
      </div>

      {/* Body: Concentric Rings + Metrics Grid */}
      <div className="relative z-10 mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        {/* Left: Interactive SVG Concentric Rings */}
        <div className="flex flex-col items-center justify-center lg:col-span-5">
          <div className="relative flex h-56 w-56 items-center justify-center">
            <svg
              className="h-full w-full -rotate-90 transform"
              viewBox="0 0 200 200"
            >
              {/* Outer Ring: Attendance / Streak (Red-Rose) */}
              <circle
                cx={center}
                cy={center}
                r={outerR}
                className="stroke-rose-500/20"
                strokeWidth={strokeWidth}
                fill="none"
              />
              <motion.circle
                cx={center}
                cy={center}
                r={outerR}
                className="stroke-rose-500"
                strokeWidth={strokeWidth}
                strokeDasharray={outerC}
                initial={{ strokeDashoffset: outerC }}
                animate={{ strokeDashoffset: outerOffset }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                strokeLinecap="round"
                fill="none"
              />

              {/* Middle Ring: Academic Mastery (Emerald-Green) */}
              <circle
                cx={center}
                cy={center}
                r={middleR}
                className="stroke-emerald-500/20"
                strokeWidth={strokeWidth}
                fill="none"
              />
              <motion.circle
                cx={center}
                cy={center}
                r={middleR}
                className="stroke-emerald-500"
                strokeWidth={strokeWidth}
                strokeDasharray={middleC}
                initial={{ strokeDashoffset: middleC }}
                animate={{ strokeDashoffset: middleOffset }}
                transition={{ duration: 1.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                strokeLinecap="round"
                fill="none"
              />

              {/* Inner Ring: Homework & Projects (Sky-Blue) */}
              <circle
                cx={center}
                cy={center}
                r={innerR}
                className="stroke-sky-500/20"
                strokeWidth={strokeWidth}
                fill="none"
              />
              <motion.circle
                cx={center}
                cy={center}
                r={innerR}
                className="stroke-sky-500"
                strokeWidth={strokeWidth}
                strokeDasharray={innerC}
                initial={{ strokeDashoffset: innerC }}
                animate={{ strokeDashoffset: innerOffset }}
                transition={{ duration: 1.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            {/* Central Badge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {Math.round((metrics.attendanceRate + metrics.academicMastery + metrics.homeworkRate) / 3)}%
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Score
              </span>
            </div>
          </div>

          {/* Quick Ring Selector Pills */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveRing('all')}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeRing === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400'
              }`}
            >
              Hammasi
            </button>
            <button
              type="button"
              onClick={() => setActiveRing('attendance')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeRing === 'attendance'
                  ? 'bg-rose-500 text-white'
                  : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Davomat
            </button>
            <button
              type="button"
              onClick={() => setActiveRing('academic')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeRing === 'academic'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Akademik
            </button>
            <button
              type="button"
              onClick={() => setActiveRing('homework')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeRing === 'homework'
                  ? 'bg-sky-500 text-white'
                  : 'bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:text-sky-400'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              Vazifalar
            </button>
          </div>
        </div>

        {/* Right: Detailed Metric Cards */}
        <div className="space-y-3 lg:col-span-7">
          {/* 1. Davomat & Streak Card */}
          <div
            className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
              activeRing === 'attendance' || activeRing === 'all'
                ? 'border-rose-500/30 bg-rose-500/5 shadow-sm dark:bg-rose-500/10'
                : 'border-slate-200/60 bg-white/40 opacity-50 dark:border-white/5 dark:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/30">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Davomat & Olovli Ketma-ketlik
                  </h4>
                  <span className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    {metrics.attendanceStreakDays} kunlik streak 🔥
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Darslarga qatnashish intizomi va turniket faolligi
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                {metrics.attendanceRate}%
              </span>
              <p className="text-[10px] text-slate-400">Hozirgi davr</p>
            </div>
          </div>

          {/* 2. Akademik O'zlashtirish Card */}
          <div
            className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
              activeRing === 'academic' || activeRing === 'all'
                ? 'border-emerald-500/30 bg-emerald-500/5 shadow-sm dark:bg-emerald-500/10'
                : 'border-slate-200/60 bg-white/40 opacity-50 dark:border-white/5 dark:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Akademik O'zlashtirish
                  </h4>
                  <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    Yuqori daraja
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Imtihonlar, testlar va oraliq nazoratlar natijasi
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {metrics.academicMastery}%
              </span>
              <p className="text-[10px] text-slate-400">Mastery Index</p>
            </div>
          </div>

          {/* 3. Uyga Vazifalar Card */}
          <div
            className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
              activeRing === 'homework' || activeRing === 'all'
                ? 'border-sky-500/30 bg-sky-500/5 shadow-sm dark:bg-sky-500/10'
                : 'border-slate-200/60 bg-white/40 opacity-50 dark:border-white/5 dark:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/30">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Mustaqil Vazifalar & Loyihalar
                  </h4>
                  <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                    {metrics.completedHomeworks} / {metrics.totalHomeworks} qabul qilingan
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Amaliy topshiriqlar va kod/portfolio topshiriqlari
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-sky-600 dark:text-sky-400">
                {metrics.homeworkRate}%
              </span>
              <p className="text-[10px] text-slate-400">Bajarilish</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: AI Parent Diagnosis Brief */}
      <div className="relative z-10 mt-6 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4.5 dark:bg-purple-500/10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
          <BrainCircuit className="h-4 w-4" />
          <span>Sun'iy Intellekt Tahlili & Ota-Onalar Tavsiyasi</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-purple-500/10 bg-white/60 p-3 dark:bg-slate-900/60">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              ✦ Kuchli tomoni:
            </span>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {aiDiagnosis.strengths}
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/10 bg-white/60 p-3 dark:bg-slate-900/60">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              ⚡ O'sish nuqtasi:
            </span>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {aiDiagnosis.growthAreas}
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/10 bg-white/60 p-3 dark:bg-slate-900/60">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
              🎯 Ota-onaga tavsiya:
            </span>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {aiDiagnosis.parentAdvice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default StudentActivityRingsPassport;
