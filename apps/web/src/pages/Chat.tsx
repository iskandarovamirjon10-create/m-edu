/**
 * M-EDU ChatPage — 
 *
 * Module Features:
 *  - Hero header with gradient chat tile + live chips (unread, active, online)
 *  - Ambient gradient orbs (blue + purple drift) — suite-consistent
 *  - Premium conversation rows: gradient avatar + unread pulse + preview
 *  - iMessage-style bubbles: own (gradient blue) / other (glass) with tails
 *  - Premium typing indicator (3-dot wave, Apple Messages style)
 *  - Premium composer (auto-grow textarea + circular send button)
 *  - Shimmer skeletons (not pulse)
 *  - Custom SVG icons in SVG Icons
 *  - Framer Motion spring physics + staggered blur-in
 *  - 100% logic preserved (socket, queries, mutations, i18n, aria)
 */

import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent, type KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import {
  GlassPageLoader,
  GlassErrorState,
  GlassTextArea,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import { chatApi } from '@/lib/api';
import { getSocketBaseUrl } from '@/lib/socketUrl';
import { getErrorMessage } from '@/lib/errorMessages';
import type { ChatConversation, ChatMessage } from '@/lib/types';
import { useAuth } from '@/auth/AuthContext';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { TranslateFn } from '@/i18n/I18nProvider';
import { AuroraMesh } from '@/components/ui/AuroraMesh';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};


const bubbleVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  chat: [
    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  ],
  send: [
    'M22 2 11 13',
    'M22 2l-7 20-4-9-9-4z',
  ],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  check: ['M20 6 9 17l-5-5'],
  checkDouble: [
    'M1 5l3 3L12 1',
    'M5 5l3 3L14 1',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)', glow: 'rgba(37,99,235,0.28)', border: 'rgba(37,99,235,0.20)' },
  green:   { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.20)' },
  orange:  { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  glow: 'rgba(245,158,11,0.28)',  border: 'rgba(245,158,11,0.20)' },
  red:     { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.28)',  border: 'rgba(239,68,68,0.20)' },
  purple:  { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.28)', border: 'rgba(99,102,241,0.20)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)', glow: 'rgba(2,132,199,0.28)', border: 'rgba(2,132,199,0.20)' },
  gray:    { fg: '#64748B', bg: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.22)', border: 'rgba(100,116,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
};

const AVATAR_PALETTES = [
  ['#2563EB', '#6366F1'],
  ['#6366F1', '#FF2D55'],
  ['#10B981', '#0284C7'],
  ['#F59E0B', '#FF2D55'],
  ['#6366F1', '#6366F1'],
  ['#0284C7', '#2563EB'],
  ['#FF2D55', '#F59E0B'],
  ['#30D158', '#10B981'],
];

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * SOCKET HOOK (preserved)
 * ========================================================================== */

function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const getSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = io(`${getSocketBaseUrl()}/chat`, {
        withCredentials: true,
        transports: ['polling', 'websocket'],
      });
    }
    return socketRef.current;
  }, []);
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);
  return getSocket;
}

/* ============================================================================
 * HELPERS (preserved)
 * ========================================================================== */

function formatTime(dateStr: string | null | undefined, t: TranslateFn): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('chat.time.now');
  if (diffMin < 60) return t('chat.time.minutes', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('chat.time.hours', { n: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return t('chat.time.days', { n: diffD });
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function getConversationTitle(
  conv: ChatConversation,
  currentUserId: string | undefined,
  t: TranslateFn,
): string {
  if (conv.title) return conv.title;
  const others =
    conv.participants?.filter(
      (p: { userId: string; user?: { firstName?: string; lastName?: string } }) =>
        p.userId !== currentUserId,
    ) ?? [];
  if (others.length === 1 && others[0].user) {
    return `${others[0].user.firstName} ${others[0].user.lastName}`;
  }
  if (others.length > 0) {
    return others
      .map(
        (p: { userId: string; user?: { firstName?: string; lastName?: string } }) =>
          p.user ? `${p.user.firstName}` : t('chat.someone'),
      )
      .join(',');
  }
  return t('chat.title');
}

function getParticipantInitials(conv: ChatConversation, currentUserId?: string): string {
  if (conv.title) return conv.title.slice(0, 2).toUpperCase();
  const others =
    conv.participants?.filter(
      (p: { userId: string; user?: { firstName?: string; lastName?: string } }) =>
        p.userId !== currentUserId,
    ) ?? [];
  if (others.length === 1 && others[0].user) {
    const u = others[0].user;
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() || '??';
  }
  return '??';
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/** Typing indicator — 3-dot wave */
function TypingDots({ tone = 'blue' }: { tone?: Tone }) {
  const reduced = useReducedMotion();
  const c = TONES[tone];
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full"
          style={{ background: c.fg }}
          animate={
            reduced
              ? undefined
              : { y: [0, -3, 0], opacity: [0.4, 1, 0.4], scale: [0.9, 1.15, 0.9] }
          }
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.16,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
}

/** Conversation row — premium */
function ConversationRow({
  conv,
  isActive,
  currentUserId,
  t,
  onSelect,
  index,
}: {
  conv: ChatConversation;
  isActive: boolean;
  currentUserId: string | undefined;
  t: TranslateFn;
  onSelect: (id: string) => void;
  index: number;
}) {
  const reduced = useReducedMotion();
  const title = getConversationTitle(conv, currentUserId, t);
  const initials = getParticipantInitials(conv, currentUserId);
  const lastMsg = conv.messages?.[0]?.content;
  const unread = conv.unreadCount ?? 0;
  const gradient = avatarGradient(title);

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(conv.id)}
      initial={reduced ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING.smooth, delay: index * 0.04 }}
      whileHover={reduced ? undefined : { x: 2 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2563EB]/40"
      style={{
        background: isActive ? 'rgba(37,99,235,0.08)' : 'transparent',
        border: isActive
          ? '1px solid rgba(37,99,235,0.22)'
          : '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (isActive) return;
        e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
      }}
      onMouseLeave={(e) => {
        if (isActive) return;
        e.currentTarget.style.background = 'transparent';
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e: any) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}>
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-full text-[12px] font-bold text-white ring-2 ring-white/50 dark:ring-slate-900/50"
          style={{
            background: gradient,
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px -4px rgba(0,0,0,0.25)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
            }}
          />
          <span className="relative">{initials}</span>
        </div>

        {/* Unread pulse */}
        {unread > 0 && !reduced && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ border: '2px solid rgba(37,99,235,0.5)' }}
            animate={{ scale: [1, 1.35], opacity: [0.8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {title}
          </span>
          {conv.lastMessageAt && (
            <span className="shrink-0 text-[10.5px] font-bold uppercase tracking-wider text-[#64748B]">
              {formatTime(conv.lastMessageAt, t)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className="truncate text-[12.5px]"
            style={{
              fontWeight: unread > 0 ? 600 : 500,
              color: unread > 0 ? '#1D1D1F' : '#64748B',
            }}
          >
            {lastMsg || t('chat.newConversation')}
          </span>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.snappy}
              className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
                boxShadow: '0 4px 10px -3px rgba(37,99,235,0.55)',
              }}
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/** Message bubble — iMessage-style */
function MessageBubble({
  msg,
  isOwn,
  t,
  index,
}: {
  msg: ChatMessage;
  isOwn: boolean;
  t: TranslateFn;
  index: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      variants={bubbleVariants}
      initial={reduced ? false : 'hidden'}
      animate="visible"
      custom={index}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`flex max-w-[75%] flex-col md:max-w-[65%] ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
        {!isOwn && msg.sender && (
          <span className="mb-1 ml-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
            {msg.sender.firstName} {msg.sender.lastName}
          </span>
        )}

        <div
          className={[
            'relative whitespace-pre-wrap px-4 py-2.5 text-[14px] leading-[1.5] tracking-[-0.005em]',
            'shadow-[0_2px_8px_-4px_rgba(0,0,0,0.12)]',
            isOwn
              ? 'rounded-[18px] rounded-br-[6px] text-white'
              : 'rounded-[18px] rounded-bl-[6px] text-[#1D1D1F] dark:text-[#F5F5F7]',
          ].join(' ')}
          style={
            isOwn
              ? {
                  background:
                    'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px -6px rgba(37,99,235,0.5)',
                }
              : {
                  background: 'rgba(255,255,255,0.9)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px -4px rgba(0,0,0,0.08)',
                }
          }
        >
          {msg.content}
        </div>

        <div
          className={`mt-1 flex items-center gap-1.5 ${
            isOwn ? 'mr-1 flex-row-reverse' : 'ml-1'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] tabular-nums">
            {formatTime(msg.createdAt, t)}
          </span>
          {isOwn && msg.isRead && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.snappy}
              className="inline-flex items-center"
              style={{ color: '#2563EB' }}
            >
              <Icon paths={I.checkDouble} size={14} strokeWidth={2.2} />
            </motion.span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Composer — auto-grow textarea + circular send */
function Composer({
  value,
  onChange,
  onSend,
  onTyping,
  sending,
  t,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onTyping: () => void;
  sending: boolean;
  t: TranslateFn;
}) {
  const reduced = useReducedMotion();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);

  /* Auto-grow */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 52), 128)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !sending;

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="relative z-10 border-t border-black/[0.06] bg-white/80 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80">
      <div className="mx-auto flex max-w-4xl items-end gap-2">
        <div
          className="relative flex flex-1 items-end gap-1.5 rounded-2xl border px-2 py-1.5 transition-colors"
          style={{
            borderColor: focused ? 'rgba(37,99,235,0.4)' : 'rgba(0,0,0,0.08)',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
            boxShadow: focused
              ? 'inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 3px rgba(37,99,235,0.12)'
              : 'inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 16px -10px rgba(0,0,0,0.10)',
          }}
        >
          <GlassTextArea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e);
              onTyping();
            }}
            onKeyDown={handleKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.placeholder')}
            rows={1}
            className="!min-h-[52px] max-h-32 flex-1 !resize-none !border-0 !bg-transparent !px-3 !py-3 !text-[14px] !shadow-none focus:!bg-transparent"
          />
        </div>

        <motion.button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          whileHover={canSend && !reduced ? { scale: 1.06, y: -1 } : undefined}
          whileTap={canSend ? { scale: 0.94 } : undefined}
          transition={SPRING.snappy}
          aria-label={t('chat.sendMessage')}
          className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full text-white outline-none transition-opacity disabled:opacity-35"
          style={{
            background: canSend
              ? 'linear-gradient(135deg, #2563EB 0%, #6366F1 50%, #6366F1 100%)'
              : 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
            boxShadow: canSend
              ? 'inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 22px -8px rgba(37,99,235,0.55)'
              : 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e: any) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.currentTarget.click();
            }
          }}>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35), transparent 55%)',
            }}
          />
          {sending ? (
            <motion.span
              className="relative inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <Icon
              paths={I.send}
              size={18}
              strokeWidth={2.2}
              className="relative ml-0.5"
            />
          )}
        </motion.button>
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function ChatPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('chat.title'));
  const { user } = useAuth();
  const { push, toastNode } = useToast();
  const queryClient = useQueryClient();
  const getSocket = useSocket();
  const reduced = useReducedMotion();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showMobileThread, setShowMobileThread] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});

  /* ── Queries (preserved) ──────────────────────────────────────────── */
  const conversationsQuery = useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () => chatApi.listConversations() as Promise<ChatConversation[]>,
    refetchInterval: 10_000,
  });

  const activeConversation = useMemo(() => {
    if (!activeConvId) return null;
    return (
      (conversationsQuery.data as ChatConversation[] | undefined)?.find(
        (c) => c.id === activeConvId,
      ) ?? null
    );
  }, [activeConvId, conversationsQuery.data]);

  const messagesQuery = useQuery({
    queryKey: ['chat', 'messages', activeConvId],
    queryFn: () => chatApi.getMessages(activeConvId!) as Promise<ChatMessage[]>,
    enabled: !!activeConvId,
    refetchInterval: 15_000,
  });

  /* ── Mutations (preserved) ────────────────────────────────────────── */
  const sendMessageMutation = useMutation({
    mutationFn: (data: { conversationId: string; message: string }) =>
      chatApi.sendMessage(data),
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeConvId] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const markReadMutation = useMutation({
    mutationFn: (convId: string) => chatApi.markRead(convId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  /* ── Scroll to bottom (preserved) ─────────────────────────────────── */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesQuery.data]);

  /* ── Mark read on open (preserved) ────────────────────────────────── */
  useEffect(() => {
    if (!activeConvId) return;
    markReadMutation.mutate(activeConvId);
  }, [activeConvId]);

  /* ── Socket listeners (preserved) ─────────────────────────────────── */
  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.conversationId === activeConvId) {
        queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeConvId] });
      }
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    };

    const handleTyping = (data: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      if (data.conversationId === activeConvId && data.userId !== user?.id) {
        setTypingUsers((prev) => ({ ...prev, [data.userId]: data.isTyping }));
      }
    };

    const handleMessagesRead = (data: { conversationId: string }) => {
      if (data.conversationId === activeConvId) {
        queryClient.invalidateQueries({ queryKey: ['chat', 'messages', activeConvId] });
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('messagesRead', handleMessagesRead);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('messagesRead', handleMessagesRead);
    };
  }, [activeConvId, getSocket, queryClient, user?.id]);

  /* ── Select / back (preserved) ────────────────────────────────────── */
  const handleSelectConversation = useCallback(
    (convId: string) => {
      const socket = getSocket();
      if (activeConvId) socket.emit('leaveConversation', { conversationId: activeConvId });
      setActiveConvId(convId);
      socket.emit('joinConversation', { conversationId: convId });
      setShowMobileThread(true);
      setTypingUsers({});
    },
    [activeConvId, getSocket],
  );

  const handleBack = useCallback(() => {
    setShowMobileThread(false);
  }, []);

  /* ── Typing + send (preserved) ────────────────────────────────────── */
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTyping = useCallback(() => {
    if (!activeConvId) return;
    const socket = getSocket();
    socket.emit('typing', { conversationId: activeConvId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { conversationId: activeConvId, isTyping: false });
    }, 3000);
  }, [activeConvId, getSocket]);

  const handleSend = useCallback(() => {
    const text = messageText.trim();
    if (!text || !activeConvId) return;
    const socket = getSocket();
    socket.emit('sendMessage', { conversationId: activeConvId, message: text });
    sendMessageMutation.mutate({ conversationId: activeConvId, message: text });
    socket.emit('typing', { conversationId: activeConvId, isTyping: false });
  }, [messageText, activeConvId, getSocket, sendMessageMutation]);

  /* ── Typing names (preserved) ─────────────────────────────────────── */
  const typingNames = useMemo(() => {
    if (!activeConversation || !user) return [];
    return Object.entries(typingUsers)
      .filter(([id, isTyping]) => isTyping && id !== user.id)
      .map(([id]) => {
        const p = activeConversation.participants?.find(
          (pp: { userId: string; user?: { firstName?: string; lastName?: string } }) =>
            pp.userId === id,
        );
        return p?.user ? `${p.user.firstName}` : t('chat.someone');
      });
  }, [typingUsers, activeConversation, user, t]);

  const conversations = (conversationsQuery.data as ChatConversation[] | undefined) ?? [];
  const messages = (messagesQuery.data as ChatMessage[] | undefined) ?? [];

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = conversations.length;
    const unread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    const active = conversations.filter((c) => {
      if (!c.lastMessageAt) return false;
      const diff = Date.now() - new Date(c.lastMessageAt).getTime();
      return diff < 1000 * 60 * 60 * 24;
    }).length;
    return { total, unread, active };
  }, [conversations]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (conversationsQuery.isLoading) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Shimmer key={i} className="h-[88px]" radius="1rem" />
          ))}
        </div>
        <Shimmer className="h-[600px] w-full" radius="2rem" />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (conversationsQuery.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            message={getErrorMessage(conversationsQuery.error)}
            onRetry={() => conversationsQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraMesh variant="corporate" opacity={0.65} />
      {toastNode}

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card sm:p-7"
        >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(37,99,235,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.chat} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('chat.messaging')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6366F1]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#6366F1]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.total} chats
                </span>
                {stats.unread > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#EF4444]">
                    <span className="relative flex h-1.5 w-1.5">
                      <motion.span
                        className="absolute inset-0 rounded-full bg-[#EF4444]"
                        animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
                    </span>
                    {stats.unread} unread
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('chat.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#64748B]">
                {t('chat.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          CHAT LAYOUT
      ============================================================ */}
      <motion.div
        variants={cardVariants}
        className="flex h-[70vh] min-h-[560px] gap-4"
      >
        {/* ── Left: Conversation list ─────────────────────────────── */}
        <div
          className={[
            'flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card',
            'md:w-[340px] lg:w-[380px]',
            showMobileThread ? 'hidden md:flex' : 'flex',
          ].join(' ')}
        >
          {/* Header */}
          <div className="relative flex items-center justify-between gap-2 border-b border-black/[0.05] px-5 py-4 dark:border-white/[0.05]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                <Icon paths={I.chat} size={16} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t('chat.inbox')}
                </h2>
                <p className="text-[11px] font-medium text-[#64748B]">
                  {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
                </p>
              </div>
            </div>
            {stats.active > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#10B981]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                {stats.active} active
              </span>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2.5">
            {conversations.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
                    <Icon paths={I.empty} size={22} strokeWidth={1.8} />
                  </div>
                  <p className="mt-3 text-[13.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {t('chat.inboxZero')}
                  </p>
                  <p className="mx-auto mt-1 max-w-xs text-[12px] font-medium text-[#64748B]">
                    {t('chat.inboxZeroHint')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv, i) => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConvId}
                    currentUserId={user?.id}
                    t={t}
                    onSelect={handleSelectConversation}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Thread ───────────────────────────────────────── */}
        <div
          className={[
            'flex flex-1 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card',
            !showMobileThread && activeConvId ? 'hidden md:flex' : showMobileThread ? 'flex' : 'hidden md:flex',
          ].join(' ')}
        >
          {!activeConvId ? (
            /* Empty state */
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6366F1]/10 text-[#6366F1]">
                  <Icon paths={I.chat} size={26} strokeWidth={1.8} />
                </div>
                <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t('chat.selectConversation')}
                </p>
                <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#64748B]">
                  {t('chat.selectConversationHint')}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="relative flex items-center gap-3 border-b border-black/[0.05] bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-white/[0.05] dark:bg-surface-900/80">
                <motion.button
                  type="button"
                  onClick={handleBack}
                  whileHover={reduced ? undefined : { scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  transition={SPRING.snappy}
                  aria-label={t('chat.backToInbox')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00000005] text-[#1D1D1F] outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60 dark:bg-[#ffffff08] dark:text-[#F5F5F7] md:hidden"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}>
                  <Icon paths={I.arrowLeft} size={16} strokeWidth={2.2} />
                </motion.button>

                <div
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white/50 dark:ring-slate-900/50"
                  style={{
                    background: activeConversation
                      ? avatarGradient(
                          getConversationTitle(activeConversation, user?.id, t),
                        )
                      : 'linear-gradient(135deg, #2563EB, #6366F1)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px -4px rgba(0,0,0,0.25)',
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
                    }}
                  />
                  <span className="relative">
                    {activeConversation ? getParticipantInitials(activeConversation, user?.id) : '??'}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {activeConversation
                      ? getConversationTitle(activeConversation, user?.id, t)
                      : ''}
                  </h3>
                  <div className="mt-0.5 h-4">
                    <AnimatePresence mode="wait">
                      {typingNames.length > 0 ? (
                        <motion.div
                          key="typing"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                          style={{ color: '#2563EB' }}
                        >
                          {typingNames.length === 1
                            ? t('chat.typingOne', { names: typingNames.join(',') })
                            : t('chat.typingOther', { names: typingNames.join(',') })}
                          <TypingDots tone="blue" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="active"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
                          style={{ color: '#10B981' }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                          {t('chat.active')}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5">
                {messagesQuery.isLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <GlassPageLoader label={t('chat.loadingHistory')} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
                      <Icon paths={I.chat} size={22} strokeWidth={1.8} />
                    </div>
                    <p className="mt-3 text-[13.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {t('chat.startConversation')}
                    </p>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-col gap-3">
                    {messages.map((msg, i) => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isOwn={msg.senderId === user?.id}
                        t={t}
                        index={i}
                      />
                    ))}
                    <div ref={messagesEndRef} className="h-1" />
                  </div>
                )}
              </div>

              {/* Composer */}
              <Composer
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onSend={handleSend}
                onTyping={handleTyping}
                sending={sendMessageMutation.isPending}
                t={t}
              />
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ChatPage;