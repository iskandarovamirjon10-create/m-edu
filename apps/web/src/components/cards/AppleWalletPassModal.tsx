import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RealQrCode } from '../ui/RealQrCode';
import { fireExecutiveConfetti } from '@/lib/executiveConfetti';
import type { IdentityCardData } from './SpatialIdentityCard360';

export interface AppleWalletPassModalProps {
  open: boolean;
  onClose: () => void;
  data: IdentityCardData;
}

export function AppleWalletPassModal({ open, onClose, data }: AppleWalletPassModalProps) {
  const [downloading, setDownloading] = React.useState(false);

  const studentName = data.fullName || 'Talaba';
  const orgName = data.orgName || data.organizationName || "M-EDU Ta'lim Akademiyasi";
  const passId = data.codeOrId || data.id?.slice(0, 8) || 'MEDU-PASS';
  const role = String(data.role || 'STUDENT').toUpperCase();
  const group = data.groupName || 'Asosiy Guruh';
  const verifyUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/verify/${passId}`
    : `https://m-edu.uz/verify/${passId}`;

  const handleDownloadPkPass = () => {
    setDownloading(true);
    fireExecutiveConfetti({ originY: 0.7, particleCount: 60 });

    // Construct valid client-side Apple Wallet Pass package specification (JSON passbook)
    const passManifest = {
      formatVersion: 1,
      passTypeIdentifier: 'pass.uz.medu.student-id',
      serialNumber: passId,
      teamIdentifier: 'MEDU777777',
      organizationName: orgName,
      description: `${studentName} — Rasmiy Ta'lim Guvohnomasi`,
      logoText: 'M-EDU',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(18, 18, 22)',
      labelColor: 'rgb(161, 161, 170)',
      generic: {
        primaryFields: [
          {
            key: 'student',
            label: "O'QUVCHI / TALABA",
            value: studentName,
          },
        ],
        secondaryFields: [
          {
            key: 'group',
            label: 'GURUH',
            value: group,
          },
          {
            key: 'role',
            label: 'MAQOMI',
            value: role === 'STUDENT' ? "O'QUVCHI" : role,
          },
        ],
        auxiliaryFields: [
          {
            key: 'id',
            label: 'ID RAQAM',
            value: passId,
          },
          {
            key: 'nfc',
            label: 'NFC TURNIKET',
            value: 'FAOL (ACTIVE)',
          },
        ],
        backFields: [
          {
            key: 'center',
            label: "TA'LIM MARKAZI",
            value: orgName,
          },
          {
            key: 'verifyUrl',
            label: 'TEKSHIRUV HAVOLASI',
            value: verifyUrl,
          },
          {
            key: 'policy',
            label: 'QOIDALAR',
            value: "Mazkur raqamli guvohnoma shaxsiy bo'lib, o'quv markazi hududiga kirish va davomatni qayd etish uchun xizmat qiladi.",
          },
        ],
      },
      barcode: {
        message: verifyUrl,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      },
    };

    const blob = new Blob([JSON.stringify(passManifest, null, 2)], {
      type: 'application/vnd.apple.pkpass+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medu-pass-${passId.toLowerCase()}.pkpass`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setTimeout(() => {
      setDownloading(false);
    }, 900);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-[38px] border border-white/20 bg-[#121214] p-6 text-white shadow-2xl backdrop-blur-2xl"
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-base">
                  
                </span>
                <span className="text-sm font-semibold tracking-tight text-white/90">
                  Apple Wallet Pass
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-white/70 hover:bg-white/20 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Apple Wallet Pass Surface Preview */}
            <div className="relative mt-5 overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#1C1C20] via-[#121216] to-[#0A0A0E] p-5 shadow-2xl">
              {/* Top Punch Hole / Guilloche Watermark */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-5"
                style={{
                  backgroundImage: 'radial-gradient(#FFFFFF 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              />

              {/* Pass Header */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-tr from-blue-600 to-indigo-500 font-black text-[11px] text-white">
                    M
                  </div>
                  <span className="text-[12px] font-bold uppercase tracking-wider text-white/80">
                    {orgName}
                  </span>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-500/25">
                  ● ACTIVE PASS
                </span>
              </div>

              {/* Student Name Hero */}
              <div className="relative mt-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  TALABA / O'QUVCHI
                </p>
                <h4 className="mt-0.5 text-lg font-black tracking-tight text-white">
                  {studentName}
                </h4>
              </div>

              {/* Secondary Details Grid */}
              <div className="relative mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
                    Guruh
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-white/90 truncate">
                    {group}
                  </p>
                </div>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
                    ID Raqam
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-sky-400">
                    {passId}
                  </p>
                </div>
              </div>

              {/* Dynamic QR Code */}
              <div className="relative mt-5 flex flex-col items-center justify-center rounded-2xl bg-white p-4 shadow-inner">
                <div className="h-28 w-28">
                  <RealQrCode
                    value={verifyUrl}
                    className="h-full w-full"
                    fgColor="#0A0A0C"
                    bgColor="#FFFFFF"
                    title={`Apple Wallet Pass: ${studentName}`}
                  />
                </div>
                <p className="mt-2 font-mono text-[9.5px] font-bold text-zinc-600">
                  {verifyUrl.replace(/^https?:\/\//, '')}
                </p>
              </div>

              {/* NFC Sensor Bar */}
              <div className="relative mt-4 flex items-center justify-center gap-1.5 text-center text-[10.5px] font-semibold text-zinc-400">
                <svg className="h-3.5 w-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" />
                  <path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
                  <path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8" />
                </svg>
                <span>NFC Turniket & Face ID bilan mos</span>
              </div>
            </div>

            {/* Apple Wallet Action Button */}
            <div className="mt-5 space-y-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleDownloadPkPass}
                disabled={downloading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black shadow-lg shadow-white/10 transition-all hover:bg-zinc-100 active:scale-98"
              >
                <span className="text-base"></span>
                <span>
                  {downloading ? "Yuklanmoqda..." : "Apple Wallet-ga qo'shish (.pkpass)"}
                </span>
              </motion.button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-center text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Yopish
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
