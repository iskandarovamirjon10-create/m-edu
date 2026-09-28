import { useState, useEffect,  } from 'react';
import { useLocation } from 'react-router-dom';
import { useAiCopilot } from '@/hooks/useAiCopilot';
import { ROUTE_TITLES } from '@/routes';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

import { AiComposer, AiMessageList } from '.';
import { ConfirmDialog } from '@/components/ui';

export function GlobalAiCopilot() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  

  const getContext = () => {
    const route = ROUTE_TITLES.find((r) => r.pattern.test(pathname));
    return route ? route.title : 'M-EDU App';
  };

  const {
    messages, status, error,  canSend, lastPrompt, send, retry, stop, confirm, reject, dismissActionError, clear
  } = useAiCopilot({ getContext });

  const online = useOnlineStatus();
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    if (!open || clearOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, clearOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close AI Copilot' : 'Open AI Copilot'}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-[150] group"
        style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #94EAEF 0%, #5474FC 25%, #94EAEF 50%, #5474FC 75%, #94EAEF 100%)',
          padding: 2, animation: 'orb-spin 12s linear infinite',
          boxShadow: '0 12px 36px rgba(84,115,252,0.40), 0 0 60px rgba(148,234,239,0.30)',
        }}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-95"
          style={{ background: 'radial-gradient(circle at 30% 30%, #FFFFFF 0%, #F4F8FB 40%, #FFFFFF 100%)' }}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--m-vivid)' }} aria-hidden="true">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4M22 5h-4M4 17v2M5 18H3"/>
          </svg>
        </div>
      </button>

      {open && (
        <>
          <div 
            className="fixed inset-0 z-[140] bg-slate-950/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div 
            className="fixed inset-y-2 right-2 z-[150] flex w-[440px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-card)] shadow-[var(--shadow-xl)]"
            style={{
              backdropFilter: 'blur(40px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
              animation: 'glass-dropdown-in 0.3s cubic-bezier(.25,.46,.45,.94) forwards',
              transformOrigin: 'right bottom',
            }}
            role="dialog"
            aria-label="AI Copilot"
          >
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, transparent 40%, rgba(148,234,239,0.02) 100%)' }} />
            
            <div className="relative z-10 flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--m-cyan)] to-[var(--m-vivid)] text-white shadow-sm">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI Copilot</h3>
                    <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[250px]">
                      {online ? 'Online' : 'Offline'} � {getContext()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setClearOpen(true)} className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" aria-label="Clear chat">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" aria-label="Close">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-glass)]">
                <AiMessageList
                  messages={messages}
                  status={status}
                  error={error}
                  lastPrompt={lastPrompt}
                  promptsDisabled={!canSend}
                  onPickPrompt={(text) => canSend && send(text)}
                  onRetry={retry}
                  onConfirm={confirm}
                  onReject={reject}
                  onDismissActionError={dismissActionError}
                />
                <AiComposer status={status} onSend={send} onStop={stop} />
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => { clear(); setClearOpen(false); }}
        title="Chatni tozalash"
        description="Suhbat tarixi shu qurilmadan o�chiriladi. Bu amalni ortga qaytarib bo�lmaydi."
        confirmLabel="Tozalash"
        cancelLabel="Bekor qilish"
        tone="danger"
      />
    </>
  );
}
