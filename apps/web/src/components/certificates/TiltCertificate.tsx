import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatDate } from '@/lib/format';
import { RealQrCode } from '@/components/ui/RealQrCode';

export interface TiltCertificateProps {
  data: {
    certificateNumber: string;
    verificationCode?: string;
    organizationName?: string;
    student?: { firstName?: string; lastName?: string; name?: string };
    course?: { name?: string; description?: string };
    issueDate?: string | Date;
    directorName?: string;
    instructorName?: string;
    grade?: string;
  };
  showActions?: boolean;
}

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

export function TiltCertificate({ data }: TiltCertificateProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50, opacity: 0 });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Tilt calculations
    setRotateX(-((y - centerY) / centerY) * 8);
    setRotateY(((x - centerX) / centerX) * 8);
    
    // Glare position
    setGlarePosition({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.28,
    });
  }, []);

  const onMouseLeave = useCallback(() => {
    setRotateX(0);
    setRotateY(0);
    setGlarePosition((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  const studentName =
    data.student?.name ||
    [data.student?.firstName, data.student?.lastName].filter(Boolean).join(' ') ||
    'Talaba F.I.SH.';

  const courseName = data.course?.name || 'Kasbiy Dasturlash va Ta\'lim Yo\'nalishi';
  const orgName = data.organizationName || 'M-EDU ZAMONAVIY TA\'LIM AKADEMIYASI';
  const verifyUrl = typeof window !== 'undefined' && data.verificationCode
    ? `${window.location.origin}/verify/${data.verificationCode}`
    : `https://m-edu.uz/verify/${data.verificationCode || data.certificateNumber}`;

  return (
    <div style={{ perspective: 1400 }} className="w-full flex justify-center py-2 select-none">
      <motion.div
        ref={cardRef}
        data-printable="certificate"
        id="medu-certificate-sheet"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        animate={{ rotateX, rotateY }}
        transition={SPRING.snappy}
        className="printable-certificate relative w-full max-w-3xl rounded-[28px] p-[2.5px] transition-shadow duration-500 print:max-w-none print:w-full print:rounded-none print:shadow-none print:p-0 print:transform-none"
        style={{
          background:
            'linear-gradient(135deg, #D4AF37 0%, #FFF5C0 25%, #AA7A1E 50%, #FAF0BE 75%, #8C6516 100%)',
          boxShadow:
            '0 32px 84px -16px rgba(180, 135, 40, 0.42), 0 16px 36px -8px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Dynamic Holographic Glare Sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[28px] transition-opacity duration-300 z-20 print:hidden"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255,255,255,0.75) 0%, transparent 60%)`,
            opacity: glarePosition.opacity,
            mixBlendMode: 'overlay',
          }}
        />

        {/* Outer White / Dark Container */}
        <div className="relative rounded-[25px] bg-[#FAF8F5] p-6 sm:p-10 text-center dark:bg-[#0A0D14] print:!bg-[#FAF8F5] print:p-8 overflow-hidden print:rounded-none">
          {/* Subtle Guilloche Watermark Pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
            style={{
              backgroundImage: `radial-gradient(#C5A059 1px, transparent 1px), radial-gradient(#C5A059 1px, #FAF8F5 1px)`,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px',
            }}
          />

          {/* Double Gold Guilloche Inner Border */}
          <div className="pointer-events-none absolute inset-3 rounded-[20px] border-2 border-[#C5A059]/40 dark:border-[#C5A059]/30" />
          <div className="pointer-events-none absolute inset-4 rounded-[16px] border border-[#C5A059]/20 dark:border-[#C5A059]/15" />

          {/* Top Gold Corner Accents */}
          <div className="pointer-events-none absolute top-4 left-4 h-7 w-7 border-t-2 border-l-2 border-[#C5A059]" />
          <div className="pointer-events-none absolute top-4 right-4 h-7 w-7 border-t-2 border-r-2 border-[#C5A059]" />
          <div className="pointer-events-none absolute bottom-4 left-4 h-7 w-7 border-b-2 border-l-2 border-[#C5A059]" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-7 w-7 border-b-2 border-r-2 border-[#C5A059]" />

          {/* Header Seal & Crest */}
          <div className="relative flex flex-col items-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #BF953F 0%, #AA771C 100%)',
                boxShadow: '0 8px 24px -4px rgba(170, 119, 28, 0.45)',
              }}
            >
              <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
            </div>

            <p className="mt-3 font-serif text-[11px] font-bold uppercase tracking-[0.28em] text-[#A67C2E] dark:text-[#E2C37C]">
              {orgName}
            </p>
            <h2 className="mt-1 font-serif text-lg font-bold tracking-tight text-[#0A192F] dark:text-[#F8FAFC] sm:text-2xl md:text-3xl">
              MALAKA VA NATIJALAR SERTIFIKATI
            </h2>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[#64748B] dark:text-[#94A3B8] sm:text-[11px]">
              CERTIFICATE OF EXCELLENCE & COMPLETION
            </p>
          </div>

          {/* Student Name Hero */}
          <div className="my-5 sm:my-6 relative">
            <p className="text-[11.5px] font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 sm:text-[12px]">
              Mazkur rasmiy sertifikat faxr bilan taqdim etiladi:
            </p>
            <h3 className="font-serif text-2xl font-extrabold tracking-tight text-[#0A192F] dark:text-[#FFFFFF] sm:text-4xl">
              {studentName}
            </h3>
            <div className="mx-auto mt-2 h-0.5 w-36 sm:w-44 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />
          </div>

          {/* Course & Achievement Text */}
          <p className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] sm:text-[13px]">
            Quyidagi o'quv dasturi va amaliy loyihalarni to'liq hamda muvaffaqiyatli yakunlagani tasdiqlanadi:
          </p>
          <div className="mt-1.5 inline-flex items-center gap-2">
            <p className="text-base font-bold tracking-tight text-[#2563EB] dark:text-[#60A5FA] sm:text-2xl">
              {courseName}
            </p>
          </div>

          {/* Dual Signatures & Seal */}
          <div className="mt-6 sm:mt-8 flex flex-col sm:grid sm:grid-cols-3 items-center sm:items-end gap-5 sm:gap-4 border-t border-[#0000000e] pt-5 sm:pt-6 dark:border-[#ffffff0e]">
            {/* Signature 1 */}
            <div className="text-center sm:text-left order-2 sm:order-1">
              <div className="font-serif italic text-base sm:text-lg text-[#0A192F] dark:text-[#F8FAFC] opacity-90">
                {data.directorName || 'Akademiya Rahbariyati'}
              </div>
              <div className="mt-1 h-[1px] w-28 mx-auto sm:mx-0 bg-[#C5A059]/60" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Bosh Direktor
              </p>
            </div>

            {/* Security Crest & Verification Status (Center) */}
            <div className="flex flex-col items-center gap-1 order-1 sm:order-2">
              <div className="rounded-xl p-1 bg-white shadow-sm border border-[#C5A059]/30 transition-transform duration-300 hover:scale-105">
                <RealQrCode
                  value={verifyUrl}
                  className="w-12 h-12"
                  level="M"
                  fgColor="#0A192F"
                  bgColor="#FFFFFF"
                  title="Rasmiy tekshiruv QR kodi"
                />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                RASMIY TASDIQLANGAN
              </span>
              <p className="mt-0.5 text-[9.5px] font-mono text-[#64748B] dark:text-[#94A3B8]">
                ID: {data.certificateNumber}
              </p>
            </div>

            {/* Signature 2 */}
            <div className="text-center sm:text-right order-3 sm:order-3">
              <div className="font-serif italic text-base sm:text-lg text-[#0A192F] dark:text-[#F8FAFC] opacity-90">
                {data.instructorName || 'Kafedra Bosh O\'qituvchisi'}
              </div>
              <div className="mt-1 h-[1px] w-28 mx-auto sm:ml-auto sm:mr-0 bg-[#C5A059]/60" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Yetakchi Murabbiy
              </p>
            </div>
          </div>

          {/* Footer Metadata & Verification Link */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-left text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Berilgan sana:
              </span>
              <span className="font-semibold text-[#0A192F] dark:text-[#F8FAFC]">
                {data.issueDate ? formatDate(data.issueDate instanceof Date ? data.issueDate.toISOString() : String(data.issueDate)) : '—'}
              </span>
            </div>

            {data.verificationCode && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                  Tekshiruv kodi:
                </span>
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-[#2563EB]/10 px-2 py-0.5 font-mono text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#2563EB]/20 transition-colors"
                  title="Tasdiqlash portalida tekshirish"
                >
                  {data.verificationCode} ↗
                </a>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TiltCertificate;
