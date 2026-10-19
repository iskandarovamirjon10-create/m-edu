/**
 * AiCopilotRightRail — Cupertino 3-Tier Intelligent Sidebar
 * Matches user mockup (Image 2 right rail):
 * 1. Tavsiya etilgan savollar
 * 2. So'nggi suhbatlar
 * 3. AI imkoniyatlari
 */

import { useContext } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { useConversations } from '@/hooks/useConversations';
import { useI18n } from '@/i18n/I18nProvider';

interface AiCopilotRightRailProps {
  onPickPrompt: (prompt: string) => void;
  onSelectConversation?: (id: string) => void;
}

function RecentChatsContent({
  onPickPrompt,
  onSelectConversation,
}: {
  onPickPrompt: (prompt: string) => void;
  onSelectConversation?: (id: string) => void;
}) {
  const { t } = useI18n();
  const { conversations } = useConversations();

  if (conversations.length === 0) {
    return (
      <div className="py-3 text-center text-xs font-medium text-[var(--text-muted)]">
        {t('ai.noRecentChats') || 'Hozircha suhbatlar mavjud emas'}
      </div>
    );
  }

  return (
    <>
      {conversations.slice(0, 5).map((chat) => (
        <button
          key={chat.id}
          type="button"
          onClick={() => {
            if (onSelectConversation) {
              onSelectConversation(chat.id);
            } else {
              onPickPrompt(chat.title);
            }
          }}
          className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <div className="flex items-center gap-2 min-w-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] shrink-0">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="truncate font-semibold text-[var(--text-secondary)]">{chat.title || 'Yangi suhbat'}</span>
          </div>
          {chat.updatedAt && (
            <span className="text-[10px] text-[var(--text-muted)] shrink-0 pl-2 font-mono">
              {new Date(chat.updatedAt).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
            </span>
          )}
        </button>
      ))}
    </>
  );
}

export function AiCopilotRightRail({ onPickPrompt, onSelectConversation }: AiCopilotRightRailProps) {
  const { t } = useI18n();
  const hasClient = Boolean(useContext(QueryClientContext));

  const suggestedQuestions = [
    'Bugungi davomat hisoboti',
    '9-A sinf reytingini ko\'rsat',
    'Oxirgi oy to\'lovlar statistikasi',
    'Qaysi sinfda eng ko\'p yo\'qlama bor?',
    'Ertangi dars jadvalini ko\'rsat',
  ];

  const capabilities = [
    'Tabiiy tilda savollarga javob',
    'Hisobotlar va tahlillar',
    'Ma\'lumotlarni tahrirlash',
    'Rejalar va tavsiyalar',
    'Tezkor amallar bajarish',
  ];

  return (
    <div className="flex h-full w-full max-w-sm flex-col space-y-4 overflow-y-auto pr-1">
      {/* 1. Tavsiya etilgan savollar */}
      <div className="rounded-[1.75rem] border border-[var(--border-glass)] bg-white/70 p-5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.06)] backdrop-blur-md dark:bg-[#12141c]/70">
        <div className="flex items-center gap-2 pb-3.5">
          <span className="flex text-indigo-600 dark:text-indigo-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z" />
            </svg>
          </span>
          <h3 className="text-sm font-black tracking-tight text-[var(--text-primary)]">
            Tavsiya etilgan savollar
          </h3>
        </div>

        <div className="space-y-1.5">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPickPrompt(q)}
              className="group flex w-full items-center justify-between rounded-xl p-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-black/5 hover:text-indigo-600 dark:hover:bg-white/5 dark:hover:text-indigo-400"
            >
              <span className="truncate pr-2">{q}</span>
              <span className="text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. So'nggi suhbatlar */}
      <div className="rounded-[1.75rem] border border-[var(--border-glass)] bg-white/70 p-5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.06)] backdrop-blur-md dark:bg-[#12141c]/70">
        <div className="flex items-center justify-between pb-3.5">
          <div className="flex items-center gap-2">
            <span className="flex text-[var(--text-muted)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <h3 className="text-sm font-black tracking-tight text-[var(--text-primary)]">
              So'nggi suhbatlar
            </h3>
          </div>
        </div>

        <div className="space-y-1.5">
          {hasClient ? (
            <RecentChatsContent onPickPrompt={onPickPrompt} onSelectConversation={onSelectConversation} />
          ) : (
            <div className="py-3 text-center text-xs font-medium text-[var(--text-muted)]">
              {t('ai.noRecentChats') || 'Hozircha suhbatlar mavjud emas'}
            </div>
          )}
        </div>
      </div>

      {/* 3. AI imkoniyatlari */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border-glass)] bg-gradient-to-br from-indigo-500/[0.06] via-white/70 to-purple-500/[0.06] p-5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.06)] backdrop-blur-md dark:bg-[#12141c]/70">
        <div className="flex items-center gap-2.5 pb-3">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-2 ring-indigo-500/20">
            <img src="/assets/ai/robot-mascot.jpg" alt="M-EDU AI" className="h-full w-full object-cover" />
          </div>
          <h3 className="text-sm font-black tracking-tight text-[var(--text-primary)]">
            AI imkoniyatlari
          </h3>
        </div>

        <div className="space-y-2 pt-1">
          {capabilities.map((cap) => (
            <div key={cap} className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{cap}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
