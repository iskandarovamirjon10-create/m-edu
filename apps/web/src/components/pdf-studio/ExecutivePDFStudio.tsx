/**
 * ============================================================================
 * M-EDU Executive PDF Studio — Apple Print & Official Document Engine
 * ============================================================================
 *
 * Produces Apple Design Award-grade official academic documents:
 *  - High-fidelity A4 layout with Guilloché anti-counterfeiting security rosettes
 *  - Gold-foil diploma certificate with dual signatures and digital seal
 *  - Dynamic Vector QR Code for instant online document verification
 *  - Official M-EDU Digital Hologram Seal stamp
 *  - Three document modes:
 *     1. Official Certificate (Malaka va Natijalar Sertifikati)
 *     2. Payment Receipt (To'lov Kvitansiyasi)
 *     3. Academic Transcript (Rasmiy Baholar Transkripti)
 *  - Direct `@media print` engine hiding UI chrome and outputting crisp A4 sheets
 * ============================================================================
 */

import { memo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { SPRING } from '@/layouts/core/tokens';
import { RealQrCode } from '@/components/ui/RealQrCode';

export type DocumentType = 'receipt' | 'certificate' | 'transcript';

export interface PDFStudioDocData {
  id: string;
  docType: DocumentType;
  title: string;
  recipientName: string;
  recipientId?: string;
  amount?: number | string;
  courseName?: string;
  groupName?: string;
  dateStr?: string;
  verificationCode?: string;
  organizationName?: string;
  directorName?: string;
  instructorName?: string;
  grade?: string;
  items?: Array<{ label: string; value: string }>;
}

export interface ExecutivePDFStudioProps {
  open: boolean;
  onClose: () => void;
  initialData?: PDFStudioDocData;
}

export const ExecutivePDFStudio = memo(function ExecutivePDFStudio({
  open,
  onClose,
  initialData,
}: ExecutivePDFStudioProps) {
  const sound = usePremiumSound();
  const [docType, setDocType] = useState<DocumentType>(initialData?.docType || 'certificate');
  const printAreaRef = useRef<HTMLDivElement>(null);

  const doc: PDFStudioDocData = initialData || {
    id: 'CERT-MEDU-2026-001',
    docType: 'certificate',
    title: "Malaka va Natijalar Sertifikati",
    recipientName: "Talaba F.I.SH.",
    recipientId: "STD-2026-001",
    courseName: "Full Stack Dasturlash (React & Node.js)",
    groupName: "FS-Rocket-01",
    dateStr: new Date().toLocaleDateString('uz-UZ'),
    organizationName: "M-EDU RASMIY TA'LIM AKADEMIYASI",
    verificationCode: "MEDU7982B0A5",
    directorName: "Markaz Rahbari",
    instructorName: "Katta O'qituvchi",
    items: [],
  };

  const handlePrint = useCallback(() => {
    sound.playSuccess();
    window.print();
  }, [sound]);

  if (!open) return null;

  const verifyUrl = typeof window !== 'undefined' && (doc.verificationCode || doc.id)
    ? `${window.location.origin}/verify/${doc.verificationCode || doc.id}`
    : `https://m-edu.uz/verify/${doc.verificationCode || doc.id}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:static print:z-0">
        {/* Print orientation styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: ${docType === 'certificate' ? 'landscape' : 'portrait'};
              margin: 8mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}} />

        {/* Backdrop (hidden in print) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md dark:bg-black/80 print:hidden"
          aria-hidden="true"
        />

        {/* Modal Outer Container */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          transition={SPRING.smooth}
          className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#121214] print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none print:bg-white print:text-black"
        >
          {/* Header Controls (hidden in print) */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-white/10 print:hidden">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold">
                🖨️
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Apple Print & Executive PDF Studio
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Davlat va xalqaro standartdagi Guilloché QR-himoyalangan rasmiy hujjat
                </p>
              </div>
            </div>

            {/* Document Mode Selector */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">
                {(
                  [
                    { key: 'certificate', label: 'Sertifikat' },
                    { key: 'receipt', label: 'Kvitansiya' },
                    { key: 'transcript', label: 'Transkript' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      sound.playTick();
                      setDocType(m.key);
                    }}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                      docType === m.key
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-white/15 dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all dark:bg-blue-500"
              >
                <span>Chop etish / PDF</span>
                <span>↗</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              DOCUMENT RENDER AREA
             ══════════════════════════════════════════════════════════════ */}
          <div className="p-4 sm:p-8 bg-slate-100 dark:bg-[#0A0A0C] print:bg-white print:p-0 flex justify-center">
            {docType === 'certificate' ? (
              /* ── LUXURY DIPLOMA CERTIFICATE ────────────────────────────── */
              <div
                ref={printAreaRef}
                className="relative w-full max-w-[960px] bg-[#FAF8F5] p-8 sm:p-14 text-slate-900 shadow-2xl rounded-2xl print:shadow-none print:rounded-none print:p-8 print:max-w-none print:w-full border-4 border-[#C5A059]"
                style={{
                  backgroundImage: `radial-gradient(#C5A059 1px, transparent 1px), radial-gradient(#C5A059 1px, #FAF8F5 1px)`,
                  backgroundSize: '24px 24px',
                  backgroundPosition: '0 0, 12px 12px',
                }}
              >
                {/* Double Guilloché Frame Lines */}
                <div aria-hidden className="pointer-events-none absolute inset-3 rounded-xl border-2 border-[#C5A059]/60 print:border-[#C5A059]" />
                <div aria-hidden className="pointer-events-none absolute inset-5 rounded-lg border border-[#C5A059]/30 print:border-[#C5A059]/60" />

                {/* Corner Guilloché Rosettes */}
                <div className="pointer-events-none absolute top-4 left-4 h-9 w-9 border-t-2 border-l-2 border-[#AA771C]" />
                <div className="pointer-events-none absolute top-4 right-4 h-9 w-9 border-t-2 border-r-2 border-[#AA771C]" />
                <div className="pointer-events-none absolute bottom-4 left-4 h-9 w-9 border-b-2 border-l-2 border-[#AA771C]" />
                <div className="pointer-events-none absolute bottom-4 right-4 h-9 w-9 border-b-2 border-r-2 border-[#AA771C]" />

                {/* Watermark Crest */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.035] select-none text-[150px] font-serif font-black tracking-widest text-[#AA771C]"
                >
                  M-EDU
                </div>

                {/* Certificate Header Crest & Insignia */}
                <div className="relative flex flex-col items-center text-center">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-xl"
                    style={{
                      background: 'linear-gradient(135deg, #BF953F 0%, #AA771C 100%)',
                      boxShadow: '0 8px 24px -4px rgba(170, 119, 28, 0.45)',
                    }}
                  >
                    <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <circle cx="12" cy="8" r="6" />
                      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
                    </svg>
                  </div>

                  <p className="mt-3 font-serif text-[11px] font-bold uppercase tracking-[0.3em] text-[#A67C2E]">
                    {doc.organizationName || "M-EDU ZAMONAVIY TA'LIM AKADEMIYASI"}
                  </p>
                  <h1 className="mt-1 font-serif text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0A192F]">
                    MALAKA VA NATIJALAR SERTIFIKATI
                  </h1>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    ACCREDITED CERTIFICATE OF PROFESSIONAL COMPLETION
                  </p>
                </div>

                {/* Recipient Hero Section */}
                <div className="relative my-7 text-center">
                  <p className="text-[13px] font-medium text-slate-500 mb-1">
                    Mazkur rasmiy ta'lim hujjati faxr bilan taqdim etiladi:
                  </p>
                  <h2 className="font-serif text-3xl sm:text-5xl font-black tracking-tight text-[#0A192F]">
                    {doc.recipientName}
                  </h2>
                  <div className="mx-auto mt-3 h-0.5 w-56 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent" />
                </div>

                {/* Course Achievement Description */}
                <div className="relative text-center max-w-2xl mx-auto">
                  <p className="text-[13px] font-medium text-slate-600">
                    quyidagi yo'nalish bo'yicha to'liq o'quv dasturi, amaliy laboratoriyalar va diplom loyihasini muvaffaqiyatli tamomlagani tasdiqlanadi:
                  </p>
                  <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-[#1E40AF]">
                    {doc.courseName || "Kasbiy Ta'lim Yo'nalishi"}
                  </p>
                </div>

                {/* Signatures & Seal Grid */}
                <div className="relative mt-10 grid grid-cols-3 items-end gap-6 border-t border-[#C5A059]/40 pt-6">
                  {/* Director Signature */}
                  <div className="text-center sm:text-left">
                    <div className="font-serif italic text-lg text-slate-900 font-bold">
                      {doc.directorName || "Markaz Rahbari"}
                    </div>
                    <div className="mt-1 h-[1px] w-32 mx-auto sm:mx-0 bg-[#C5A059]" />
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Bosh Direktor / Director
                    </p>
                  </div>

                  {/* 3D Holographic Seal (Center) */}
                  <div className="flex flex-col items-center">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-[#AA771C] p-1 text-center shadow-lg"
                      style={{
                        background: 'radial-gradient(circle, #FEF3C7 0%, #FDE68A 100%)',
                      }}
                    >
                      <div className="flex h-full w-full items-center justify-center rounded-full border border-[#AA771C]/70 p-1 text-center font-bold text-[8.5px] uppercase tracking-tighter text-[#78350F] leading-tight">
                        ★ RASMIY ★<br />M-EDU<br />TASDIQLANGAN
                      </div>
                    </div>
                    <span className="mt-1 text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300">
                      Haqiqiy & Xalqaro
                    </span>
                  </div>

                  {/* Instructor Signature */}
                  <div className="text-center sm:text-right">
                    <div className="font-serif italic text-lg text-slate-900 font-bold">
                      {doc.instructorName || "Katta O'qituvchi"}
                    </div>
                    <div className="mt-1 h-[1px] w-32 mx-auto sm:ml-auto sm:mr-0 bg-[#C5A059]" />
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Kafedra Bosh O'qituvchisi
                    </p>
                  </div>
                </div>

                {/* Footer Security QR & Verification */}
                <div className="relative mt-8 pt-5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-3">
                    {/* High-density ISO/IEC 18004 compliant real QR vector */}
                    <div className="h-16 w-16 shrink-0 border border-slate-300 p-1 rounded-lg bg-white flex items-center justify-center shadow-xs">
                      <RealQrCode
                        value={verifyUrl}
                        className="w-full h-full"
                        fgColor="#0F172A"
                        bgColor="#FFFFFF"
                        level="M"
                        title="Rasmiy Sertifikat Tekshiruvi QR Kodi"
                      />
                    </div>
                    <div className="text-[11px] leading-tight">
                      <p className="font-bold text-slate-900">Elektron Haqiqiylik Tekshiruvi</p>
                      <p className="text-slate-500">Ushbu QR kod orqali davlat va M-EDU portalida tasdiqlang:</p>
                      <a
                        href={verifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[10.5px] font-bold text-blue-600 hover:underline mt-0.5 inline-block"
                      >
                        {verifyUrl}
                      </a>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px] text-slate-500">
                    <div>Sertifikat №: <strong className="text-slate-900">{doc.id}</strong></div>
                    <div>Berilgan sana: <strong className="text-slate-900">{doc.dateStr}</strong></div>
                    {doc.verificationCode && (
                      <div className="mt-0.5">
                        Xavfsizlik kodi: <strong className="text-blue-600">{doc.verificationCode}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ── RECEIPT / TRANSCRIPT LAYOUT ───────────────────────────── */
              <div
                ref={printAreaRef}
                className="relative mx-auto max-w-[760px] w-full bg-white p-8 sm:p-12 text-slate-900 shadow-xl border border-slate-200/80 rounded-2xl print:shadow-none print:border-none print:p-0 print:max-w-none"
              >
                {/* Guilloché Border Frame */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-3 border-2 border-slate-200/90 rounded-xl print:border-slate-400"
                  style={{
                    backgroundImage: `radial-gradient(circle at center, transparent 3px, #00000005 3px, #00000005 4px, transparent 4px)`,
                    backgroundSize: '16px 16px',
                  }}
                />

                {/* Watermark Logo */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.035] select-none text-[120px] font-black tracking-widest text-slate-950"
                >
                  M-EDU
                </div>

                {/* Document Header */}
                <div className="relative flex items-start justify-between border-b-2 border-slate-900 pb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-extrabold text-sm">
                        M
                      </span>
                      <span className="text-xl font-black tracking-tighter uppercase text-slate-900">
                        {doc.organizationName || "M-EDU Academy"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      O'zbekiston Respublikasi Ta'lim Boshqaruvi Axborot Tizimi
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Toshkent sh., Amir Temur shoh ko'chasi, 108 · Tel: +998 (71) 200-00-00
                    </p>
                  </div>

                  {/* Document Serial ID */}
                  <div className="text-right">
                    <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-extrabold text-slate-800">
                      № {doc.id}
                    </span>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      Sana: {doc.dateStr}
                    </p>
                  </div>
                </div>

                {/* Document Title */}
                <div className="relative my-8 text-center">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">
                    Rasmiy Hujjat · Official Document
                  </span>
                  <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight uppercase text-slate-900">
                    {docType === 'receipt' ? "To'lov Kvitansiyasi" : "Akademik Transkript"}
                  </h1>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">
                    Verified Electronic Document
                  </p>
                </div>

                {/* Main Document Body */}
                <div className="relative space-y-6">
                  {/* Recipient Identity Box */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Kimga berildi / Recipient:
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {doc.recipientName}
                    </p>
                    {doc.recipientId && (
                      <p className="text-xs font-mono text-slate-500">
                        ID: {doc.recipientId}
                      </p>
                    )}
                  </div>

                  {/* Itemized Table */}
                  <table className="w-full text-left text-xs border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider">
                          Tavsif / Parameter
                        </th>
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider text-right">
                          Tafsilotlar / Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {doc.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-medium text-slate-600">
                            {item.label}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-900 text-right">
                            {item.value}
                          </td>
                        </tr>
                      ))}
                      {doc.amount && (
                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-900">
                          <td className="py-3 px-4 text-sm text-slate-900">
                            Umumiy Qiymat (Total)
                          </td>
                          <td className="py-3 px-4 text-sm text-emerald-600 text-right font-mono">
                            {doc.amount}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Security & Verification Footer */}
                <div className="relative mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Dynamic Vector QR Code for Verification (ISO/IEC 18004) */}
                  <div className="flex items-center gap-3">
                    <div className="h-20 w-20 shrink-0 border border-slate-300 p-1 rounded-lg bg-white flex items-center justify-center">
                      <RealQrCode
                        value={verifyUrl}
                        className="w-full h-full"
                        fgColor="#0F172A"
                        bgColor="#FFFFFF"
                        level="M"
                        title="Rasmiy Hujjat Tekshiruvi QR Kodi"
                      />
                    </div>
                    <div className="text-[11px] leading-tight text-slate-500">
                      <p className="font-bold text-slate-800">Hujjat Haqiqiyligi</p>
                      <p>Ushbu QR kod orqali M-EDU bazasidan tekshiring.</p>
                      <a href={verifyUrl} target="_blank" rel="noreferrer" className="font-mono text-[9px] text-blue-600 hover:underline mt-1 inline-block">
                        {verifyUrl}
                      </a>
                    </div>
                  </div>

                  {/* 3D Holographic Metallic Stamp Seal */}
                  <div className="relative flex flex-col items-center">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-amber-600/80 p-1 text-center shadow-inner"
                      style={{
                        background: 'radial-gradient(circle, #FEF3C7 0%, #FDE68A 100%)',
                      }}
                    >
                      <div className="flex h-full w-full items-center justify-center rounded-full border border-amber-700/60 p-1 text-center font-bold text-[8.5px] uppercase tracking-tighter text-amber-900 leading-tight">
                        TASDIQLANGAN<br />M-EDU<br />OFFICIAL
                      </div>
                    </div>
                    <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                      Elektron Muhr
                    </span>
                  </div>

                  {/* Signature Block */}
                  <div className="text-right">
                    <div className="w-36 border-b border-slate-900 pb-1">
                      <span className="font-serif italic text-base text-slate-800">
                        {doc.directorName || "Markaz Rahbari"}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 mt-1">
                      Bosh Buxgalter / Direktor
                    </p>
                    <p className="text-[10px] text-slate-400">
                      M-EDU Academic Board
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

export default ExecutivePDFStudio;
