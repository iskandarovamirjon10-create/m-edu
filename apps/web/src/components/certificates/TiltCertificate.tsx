import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { formatDate } from '@/lib/format';

export interface TiltCertificateProps {
  data: {
    certificateNumber: string;
    verificationCode?: string;
    student?: { firstName?: string; lastName?: string; name?: string };
    course?: { name?: string };
    issueDate?: string | Date;
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
    setRotateX(-((y - centerY) / centerY) * 10);
    setRotateY(((x - centerX) / centerX) * 10);
    
    // Glare position
    setGlarePosition({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.25,
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
    'Talaba Ismi';

  const courseName = data.course?.name || 'M-EDU O\'quv Kursi';

  return (
    <div style={{ perspective: 1200 }} className="w-full flex justify-center py-2">
      <motion.div
        ref={cardRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        animate={{ rotateX, rotateY }}
        transition={SPRING.snappy}
        className="relative w-full max-w-3xl rounded-[28px] p-[3px] transition-shadow duration-500"
        style={{
          background:
            'linear-gradient(135deg, #BF953F 0%, #FCF6BA 25%, #B38728 50%, #FBF5B7 75%, #AA771C 100%)',
          boxShadow:
            '0 28px 72px -16px rgba(191, 149, 63, 0.45), 0 12px 32px -8px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Dynamic Holographic Glare Sheen */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[28px] transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255,255,255,0.7) 0%, transparent 60%)`,
            opacity: glarePosition.opacity,
            mixBlendMode: 'overlay',
          }}
        />

        {/* Outer White / Dark Container */}
        <div className="relative rounded-[25px] bg-[#FAF8F5] p-6 sm:p-10 text-center dark:bg-[#0D1117] overflow-hidden">
          {/* Subtle Guilloche Watermark Pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
            style={{
              backgroundImage: `radial-gradient(#C5A059 1px, transparent 1px), radial-gradient(#C5A059 1px, #FAF8F5 1px)`,
              backgroundSize: '24px 24px',
              backgroundPosition: '0 0, 12px 12px',
            }}
          />

          {/* Double Gold Guilloche Inner Border */}
          <div className="pointer-events-none absolute inset-3 rounded-[20px] border border-[#C5A059]/40 dark:border-[#C5A059]/30" />
          <div className="pointer-events-none absolute inset-4 rounded-[16px] border border-[#C5A059]/20 dark:border-[#C5A059]/15" />

          {/* Top Gold Corner Accents */}
          <div className="pointer-events-none absolute top-4 left-4 h-6 w-6 border-t-2 border-l-2 border-[#C5A059]" />
          <div className="pointer-events-none absolute top-4 right-4 h-6 w-6 border-t-2 border-r-2 border-[#C5A059]" />
          <div className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-[#C5A059]" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-[#C5A059]" />

          {/* Header Seal & Crest */}
          <div className="relative flex flex-col items-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #BF953F 0%, #AA771C 100%)',
                boxShadow: '0 8px 24px -4px rgba(170, 119, 28, 0.5)',
              }}
            >
              <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="8" r="6" />
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
              </svg>
            </div>

            <p className="mt-3 font-serif text-[11px] font-bold uppercase tracking-[0.28em] text-[#C5A059]">
              M-EDU GLOBAL ACADEMY
            </p>
            <h2 className="mt-1 font-serif text-2xl font-bold tracking-tight text-[#0A192F] dark:text-[#F8FAFC] sm:text-3xl">
              CERTIFICATE OF EXCELLENCE
            </h2>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[#64748B] dark:text-[#94A3B8]">
              Mazkur sertifikat rasmiy ravishda taqdim etiladi
            </p>
          </div>

          {/* Student Name Hero */}
          <div className="my-5 relative">
            <h3 className="font-serif text-3xl font-extrabold tracking-tight text-[#0A192F] dark:text-[#FFFFFF] sm:text-4xl">
              {studentName}
            </h3>
            <div className="mx-auto mt-2 h-0.5 w-40 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />
          </div>

          {/* Course & Achievement Text */}
          <p className="text-[13px] font-medium text-[#64748B] dark:text-[#94A3B8]">
            quyidagi yo'nalish bo'yicha to'liq ta'lim dasturini muvaffaqiyatli yakunlaganligi uchun:
          </p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-[#2563EB] sm:text-2xl">
            {courseName}
          </p>

          {/* Dual Signatures & Seal */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 items-end gap-4 border-t border-[#0000000c] pt-6 dark:border-[#ffffff0c]">
            {/* Signature 1 */}
            <div className="text-center sm:text-left">
              <div className="font-serif italic text-lg text-[#0A192F] dark:text-[#F8FAFC] opacity-80">
                Direktor
              </div>
              <div className="mt-1 h-[1px] w-28 mx-auto sm:mx-0 bg-[#C5A059]/50" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Akademiya Rahbari
              </p>
            </div>

            {/* Security Crest & Verification Status (Center) */}
            <div className="hidden sm:flex flex-col items-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                VERIFIED & AUTHENTIC
              </span>
              <p className="mt-1 text-[9.5px] font-mono text-[#64748B]">
                ID: {data.certificateNumber}
              </p>
            </div>

            {/* Signature 2 */}
            <div className="text-center sm:text-right">
              <div className="font-serif italic text-lg text-[#0A192F] dark:text-[#F8FAFC] opacity-80">
                Kafedra mudiri
              </div>
              <div className="mt-1 h-[1px] w-28 mx-auto sm:ml-auto sm:mr-0 bg-[#C5A059]/50" />
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Bosh O'qituvchi
              </p>
            </div>
          </div>

          {/* Footer Metadata & Verification Code */}
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
                <span className="rounded-md bg-[#2563EB]/10 px-2 py-0.5 font-mono text-xs font-bold text-[#2563EB]">
                  {data.verificationCode}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TiltCertificate;
