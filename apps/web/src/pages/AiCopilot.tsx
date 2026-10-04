/**
 * M-EDU AI Copilot — Apple Design Award Edition
 *
 * Premium craft:
 *  - Ambient gradient orbs (theme-aware, subtle drift)
 *  - Motion container with staggered fade + blur-in entrance
 *  - Premium glass chat frame with double-ring gloss
 *  - Refined A11y labels + reduced-motion support
 *  - Composition only: state and API logic stay in `hooks/useAiCopilot`
 */

import { useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui';
import {
  AiComposer,
  AiCopilotHeader,
  AiMessageList,
} from '@/components/ai';
import { useAiCopilot } from '@/hooks/useAiCopilot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const frameVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: SPRING.smooth,
  },
};

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

/**
 * Ambient gradient orbs — Apple-style soft blobs behind the chat.
 * Respects `prefers-reduced-motion`.
 */
function AmbientOrbs() {
  const reduced = useReducedMotion();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Top-left indigo/cyan */}
      <motion.div
        className="absolute -left-[10%] -top-[10%] h-[42%] w-[42%] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(84,115,252,0.16), transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={
          reduced
            ? undefined
            : { x: [0, 24, 0], y: [0, 18, 0], opacity: [0.85, 1, 0.85] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Bottom-right emerald/cyan */}
      <motion.div
        className="absolute -bottom-[12%] -right-[10%] h-[48%] w-[44%] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(16,185,129,0.14), transparent 70%)',
          filter: 'blur(70px)',
        }}
        animate={
          reduced
            ? undefined
            : { x: [0, -28, 0], y: [0, -22, 0], opacity: [0.8, 1, 0.8] }
        }
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Center subtle purple glow */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[36%] w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(175,82,222,0.10), transparent 70%)',
          filter: 'blur(80px)',
        }}
        animate={
          reduced
            ? undefined
            : { scale: [1, 1.08, 1], opacity: [0.7, 0.95, 0.7] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export default function AiCopilot() {
  const {
    messages,
    status,
    error,
    busy,
    canSend,
    lastPrompt,
    send,
    retry,
    stop,
    confirm,
    reject,
    dismissActionError,
    clear,
  } = useAiCopilot();

  const online = useOnlineStatus();
  const [clearOpen, setClearOpen] = useState(false);

  const handlePickPrompt = (text: string): void => {
    if (canSend) send(text);
  };

  const handleConfirmClear = (): void => {
    clear();
    setClearOpen(false);
  };

  return (
    <div className="relative flex h-[calc(100svh-7.25rem)] min-h-[20rem] min-w-0 flex-col overflow-hidden lg:h-[calc(100svh-8.25rem)]">
      {/* Ambient premium background */}
      <AmbientOrbs />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4 sm:px-6 sm:pt-6"
      >
        {/* Header */}
        <motion.div variants={frameVariants}>
          <AiCopilotHeader
            online={online}
            busy={busy}
            onClear={() => setClearOpen(true)}
          />
        </motion.div>

        {/* Premium chat frame */}
        <motion.section
          variants={frameVariants}
          aria-label="AI suhbat"
          className="group relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--bg-glass)] shadow-[var(--shadow-lg)] backdrop-blur-xl"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.55), var(--shadow-lg)',
          }}
        >
          {/* Top gloss */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-[1.75rem]"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
            }}
          />

          {/* Inner ring for depth */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]"
          />

          {/* Messages */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <AiMessageList
              messages={messages}
              status={status}
              error={error}
              lastPrompt={lastPrompt}
              promptsDisabled={!canSend}
              onPickPrompt={handlePickPrompt}
              onRetry={retry}
              onConfirm={confirm}
              onReject={reject}
              onDismissActionError={dismissActionError}
            />
          </div>

          {/* Composer */}
          <div className="relative">
            <AiComposer status={status} onSend={send} onStop={stop} />
          </div>
        </motion.section>
      </motion.div>

      {/* Clear chat confirmation */}
      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleConfirmClear}
        title="Chatni tozalash"
        description="Suhbat tarixi shu qurilmadan o‘chiriladi. Bu amalni ortga qaytarib bo‘lmaydi."
        confirmLabel="Tozalash"
        cancelLabel="Bekor qilish"
        tone="danger"
      />
    </div>
  );
}