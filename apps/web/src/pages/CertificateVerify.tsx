/**
 * M-EDU Certificate Verification Portal — Apple Design Award Edition
 *
 * Publicly verifiable credential page:
 *  - URL route: /verify/:code and /verify
 *  - 3D interactive holographic certificate card
 *  - Official verification badge & accredited status
 *  - Anonymous access — zero login required
 *  - Print & copy verification link actions
 *  - Full i18n support
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { certificatesApi } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { GlassButton, GlassInput, useToasts } from '@/components/ui';
import { TiltCertificate } from '@/components/certificates/TiltCertificate';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

/* ============================================================================
 * ICONS
 * ========================================================================== */

function Icon({
  paths, size = 18, className = '', strokeWidth = 2,
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const I = {
  shieldCheck: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
  ],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  copy: [
    'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8',
    'M16 4h2a2 2 0 0 1 2 2v2',
    'M8 2h8a2 2 0 0 1 2 2v2H8z',
  ],
  check: ['M20 6 9 17l-5-5'],
  printer: [
    'M6 9V2h12v7',
    'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    'M6 14h12v8H6z',
  ],
  alert: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  calendar: [
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M16 2v4', 'M8 2v4', 'M3 10h18',
  ],
};


/* ============================================================================
 * MAIN VERIFICATION PAGE
 * ========================================================================== */

interface VerifyCertificateResponse {
  isValid: boolean;
  certificateNumber: string;
  verificationCode?: string;
  student?: { firstName?: string; lastName?: string };
  course?: { name?: string };
  issueDate?: string;
}

export function CertificateVerifyPage() {
  const { code: urlCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { push, toastNode } = useToasts();
  usePageTitle(t('certificates.verifyTitle') || 'Certificate Verification — M-EDU');

  const [inputCode, setInputCode] = useState(urlCode || '');
  const [activeCode, setActiveCode] = useState(urlCode || '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (urlCode) {
      setInputCode(urlCode);
      setActiveCode(urlCode);
    }
  }, [urlCode]);

  const { data, isLoading, isError } = useQuery<VerifyCertificateResponse>({
    queryKey: ['certificate-verify', activeCode],
    queryFn: () => certificatesApi.verify(activeCode) as Promise<VerifyCertificateResponse>,
    enabled: Boolean(activeCode && activeCode.trim().length > 3),
    retry: false,
  });

  const handleSearch = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = inputCode.trim().toUpperCase();
    if (trimmed) {
      setActiveCode(trimmed);
      navigate(`/verify/${trimmed}`, { replace: true });
    }
  }, [inputCode, navigate]);

  const copyLink = useCallback(() => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    push({ type: 'success', message: t('certificates.linkCopied') || 'Verification link copied to clipboard!' });
    setTimeout(() => setCopied(false), 2400);
  }, [push, t]);

  const printCertificate = useCallback(() => {
    if (typeof window !== 'undefined') window.print();
  }, []);

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#F5F5F7] via-[#FFFFFF] to-[#F5F5F7] dark:from-[#0B0C10] dark:via-[#12141A] dark:to-[#0B0C10] px-4 py-8 sm:px-6 lg:px-8">
      {toastNode}

      {/* Ambient background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-[10%] top-[10%] h-[45%] w-[45%] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(197,160,89,0.14), transparent 70%)' }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-[10%] bottom-[10%] h-[50%] w-[50%] rounded-full"
          style={{ background: 'radial-gradient(closest-side, rgba(37,99,235,0.12), transparent 70%)' }}
          animate={{ x: [0, -30, 0], y: [0, -25, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative mx-auto max-w-4xl w-full">
        {/* Top Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING.smooth}
            className="inline-flex items-center gap-2 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 px-4 py-1.5 text-xs font-bold text-[#C5A059]"
          >
            <Icon paths={I.sparkles} size={13} strokeWidth={2.4} />
            M-EDU Official Credential Verification
          </motion.div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
            {t('certificates.verifyHeading') || 'Verify Certificate Authenticity'}
          </h1>
          <p className="mt-2 text-sm text-[#64748B] max-w-lg mx-auto">
            {t('certificates.verifySub') || 'Enter the unique 12-digit verification code found on the certificate or scan its QR code.'}
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mt-6 flex max-w-md mx-auto gap-2">
            <GlassInput
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="e.g. 9B47FA2B8C11"
              className="text-center font-mono uppercase tracking-widest text-base font-bold"
              aria-label="Verification Code"
            />
            <GlassButton variant="primary" onClick={() => handleSearch()} disabled={!inputCode.trim()}>
              <span className="inline-flex items-center gap-2">
                <Icon paths={I.search} size={16} strokeWidth={2.4} />
                {t('common.verify') || 'Verify'}
              </span>
            </GlassButton>
          </form>
        </div>

        {/* Verification Result Area */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-black/[0.06] bg-white/80 p-12 text-center backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
            >
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#C5A059]/20 border-t-[#C5A059]" />
              <p className="mt-4 text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Verifying credential with M-EDU registry...
              </p>
            </motion.div>
          )}

          {!isLoading && isError && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-red-500/20 bg-red-500/5 p-10 text-center backdrop-blur-md dark:bg-red-950/20 max-w-xl mx-auto"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
                <Icon paths={I.alert} size={28} strokeWidth={2} />
              </div>
              <h3 className="mt-4 text-lg font-bold text-red-600 dark:text-red-400">
                Certificate Not Found
              </h3>
              <p className="mt-1 text-xs text-[#64748B] max-w-sm mx-auto">
                No active certificate matching code &quot;<span className="font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">{activeCode}</span>&quot; was found. Please check for typos and verify again.
              </p>
              <div className="mt-5">
                <GlassButton variant="secondary" size="sm" onClick={() => setInputCode('')}>
                  Try Another Code
                </GlassButton>
              </div>
            </motion.div>
          )}

          {!isLoading && data?.isValid && (
            <motion.div
              key="verified"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING.smooth}
              className="space-y-6"
            >
              {/* Verified Badge Header */}
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-emerald-600 dark:text-emerald-400 max-w-md mx-auto">
                <Icon paths={I.shieldCheck} size={22} strokeWidth={2.4} />
                <span className="text-sm font-bold tracking-tight">
                  Authentic Certificate Verified in Registry
                </span>
              </div>

              {/* 3D Holographic Tilt Card */}
              <TiltCertificate data={data} />

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <GlassButton variant="primary" onClick={copyLink}>
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={copied ? I.check : I.copy} size={15} strokeWidth={2.2} />
                    {copied ? 'Link Copied!' : 'Copy Verification Link'}
                  </span>
                </GlassButton>

                <GlassButton variant="secondary" onClick={printCertificate}>
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.printer} size={15} strokeWidth={2.2} />
                    Print Certificate
                  </span>
                </GlassButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Branding */}
      <footer className="mt-12 text-center text-xs font-medium text-[#64748B]">
        Powered by M-EDU Cloud Educational Infrastructure — Secured with cryptographic hash verification.
      </footer>
    </div>
  );
}

export default CertificateVerifyPage;
