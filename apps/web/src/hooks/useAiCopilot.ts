// M-EDU AI Copilot — integration pass
/**
 * useAiCopilot — the AI Copilot state machine.
 *
 * Responsibilities kept in one place so both the dedicated page and the
 * global overlay behave identically:
 *   - request lifecycle (sending → idle) with a single abortable in-flight call
 *   - tool round-trips (result is fed back so the model can answer)
 *   - explicit action confirmation (nothing executes without approval)
 *   - user-safe error mapping and a retry that never duplicates a message
 *   - localStorage persistence of the conversation for the current device
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  aiChat,
  aiChatStream,
  buildActionResult,
  confirmAiAction,
  isPendingConfirmation,
  parseActionParameters,
  prettifyArguments,
  toAiErrorInfo,
} from '@/lib/ai';
import { AI_FLAGS } from '../lib/ai/flags';
import type {
  AiActionResult,
  AiChatResponse,
  AiErrorInfo,
  AiPendingAction,
  AiToolActivity,
  AiToolActivityStatus,
  AiUiMessage,
  AiWireMessage,
  AiWireToolCall,
  AiWireToolResult,
} from '@/types/ai';

export type AiStatus =
  | 'idle'
  | 'sending'
  | 'thinking'
  | 'streaming'
  | 'confirming'
  | 'awaiting_confirmation';

export interface AiCopilotOptions {
  getContext?: () => string;
  conversationId?: string;
  initialMessages?: AiUiMessage[];
  persistence?: 'local' | 'server';
}

const STORAGE_KEY = 'medu:ai-copilot:v1';
const STORAGE_VERSION = 1;

interface PersistedConversation {
  version: number;
  messages: AiUiMessage[];
  history: AiWireMessage[];
}

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

function activityStatus(result: AiWireToolResult): AiToolActivityStatus {
  if (isPendingConfirmation(result)) return 'pending_confirmation';
  if (result.error) return 'error';
  return 'success';
}

function buildActivities(
  toolCalls: AiWireToolCall[],
  toolResults: AiWireToolResult[],
): AiToolActivity[] {
  return toolResults.map((result, index) => ({
    id: result.id || `tool-${index}`,
    toolName:
      result.toolName ||
      toolCalls.find((call) => call.id === result.id)?.function.name ||
      toolCalls[index]?.function.name ||
      '',
    status: activityStatus(result),
  }));
}

function buildPendingAction(
  result: AiWireToolResult,
  call: AiWireToolCall | undefined,
): AiPendingAction {
  const rawArguments = call?.function.arguments ?? '';
  return {
    actionId: result.actionId ?? result.id ?? '',
    toolName: result.toolName || call?.function.name || '',
    parameters: parseActionParameters(rawArguments),
    rawArguments: prettifyArguments(rawArguments),
    backendMessage: result.message,
  };
}

function markActivities(
  activities: AiToolActivity[] | undefined,
  status: AiToolActivityStatus,
): AiToolActivity[] | undefined {
  if (!activities) return activities;
  return activities.map((activity) =>
    activity.status === 'pending_confirmation' ? { ...activity, status } : activity,
  );
}

/** Restore the previous conversation, dropping any now-meaningless approvals. */
function readPersistedConversation(): { messages: AiUiMessage[]; history: AiWireMessage[] } {
  const empty = { messages: [] as AiUiMessage[], history: [] as AiWireMessage[] };
  if (typeof window === 'undefined') return empty;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as PersistedConversation;
    if (!parsed || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.messages)) {
      return empty;
    }

    const messages = parsed.messages.map((message) => {
      const activities = message.toolActivities ?? [];
      const hadConfirmation =
        Boolean(message.confirmation) ||
        activities.some((activity) => activity.status === 'pending_confirmation');
      if (!hadConfirmation) return message;

      const restored: AiUiMessage = {
        ...message,
        toolActivities: activities.map((activity) =>
          activity.status === 'pending_confirmation'
            ? { ...activity, status: 'cancelled' as const }
            : activity,
        ),
      };
      delete restored.confirmation;
      return restored;
    });

    return {
      messages,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return empty;
  }
}

export function useAiCopilot(options: AiCopilotOptions = {}) {
  const [initial] = useState(() => {
    if (options.conversationId && options.initialMessages) return { messages: options.initialMessages, history: [] };
    if (options.persistence === 'server') return { messages: options.initialMessages || [], history: [] };
    return readPersistedConversation();
  });
  const [messages, setMessages] = useState<AiUiMessage[]>(initial.messages);
  const [status, setStatus] = useState<AiStatus>('idle');
  const [error, setError] = useState<AiErrorInfo | null>(null);
  const [lastPrompt, setLastPrompt] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(options.conversationId);

  const conversationIdRef = useRef<string | undefined>(options.conversationId);
  const historyRef = useRef<AiWireMessage[]>(initial.history);
  const messagesRef = useRef<AiUiMessage[]>(initial.messages);
  const statusRef = useRef<AiStatus>('idle');
  const abortRef = useRef<AbortController | null>(null);
  const cancelReasonRef = useRef<'none' | 'user' | 'reset'>('none');

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (options.conversationId !== undefined) {
      setConversationId(options.conversationId);
      conversationIdRef.current = options.conversationId;
    }
  }, [options.conversationId]);

  /** Persist on every visible change; an empty conversation clears the key. */
  useEffect(() => {
    if (typeof window === 'undefined' || options.persistence === 'server') return;
    try {
      if (messages.length === 0 && historyRef.current.length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const payload: PersistedConversation = {
        version: STORAGE_VERSION,
        messages,
        history: historyRef.current,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Storage disabled or full — the conversation simply stays in memory.
    }
  }, [messages]);

  const updateStatus = useCallback((next: AiStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const appendMessage = useCallback((message: AiUiMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  /** One abortable request cycle, including tool round-trips. */
  const runChat = useCallback(
    async (wire: AiWireMessage[]) => {
      updateStatus('sending');
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;
      cancelReasonRef.current = 'none';

      const activeConvId = conversationIdRef.current || options.conversationId;

      try {
        let response;
        if (AI_FLAGS.streaming) {
          const partialId = nextId('assistant');
          const partialMessage = {
            id: partialId,
            role: 'assistant' as const,
            content: '',
            createdAt: Date.now(),
            streaming: true
          };
          setMessages(prev => [...prev, partialMessage]);
          
          const streamRes = await aiChatStream(wire, {
            signal: controller.signal,
            conversationId: activeConvId,
            onDelta: (chunk) => {
              if (statusRef.current !== 'streaming' && statusRef.current !== 'awaiting_confirmation') {
                updateStatus('streaming');
              }
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIdx = newMessages.length - 1;
                if (lastIdx >= 0 && newMessages[lastIdx].id === partialId) {
                  newMessages[lastIdx] = { ...newMessages[lastIdx], content: newMessages[lastIdx].content + chunk };
                }
                return newMessages;
              });
            },
            onTool: (toolEvent: any) => {
              if (!toolEvent) return;
              const tType = toolEvent.type;
              if (tType === 'tool_running') {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  if (lastIdx >= 0 && newMessages[lastIdx].id === partialId) {
                    const activities = newMessages[lastIdx].toolActivities || [];
                    const existingIdx = activities.findIndex((a) => a.toolName === toolEvent.toolName);
                    const updated = existingIdx >= 0
                      ? activities.map((a, i) => (i === existingIdx ? { ...a, status: 'running' as const } : a))
                      : [...activities, { id: toolEvent.toolName, toolName: toolEvent.toolName, status: 'running' as const }];
                    newMessages[lastIdx] = { ...newMessages[lastIdx], toolActivities: updated };
                  }
                  return newMessages;
                });
              } else if (tType === 'tool_result') {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  if (lastIdx >= 0 && newMessages[lastIdx].id === partialId) {
                    const activities = newMessages[lastIdx].toolActivities || [];
                    const status = toolEvent.status === 'success' ? ('success' as const) : ('error' as const);
                    const existingIdx = activities.findIndex((a) => a.toolName === toolEvent.toolName);
                    const updated = existingIdx >= 0
                      ? activities.map((a, i) => (i === existingIdx ? { ...a, status } : a))
                      : [...activities, { id: toolEvent.toolName, toolName: toolEvent.toolName, status }];
                    newMessages[lastIdx] = { ...newMessages[lastIdx], toolActivities: updated };
                  }
                  return newMessages;
                });
              } else if (tType === 'action_pending') {
                const rawArgs = typeof toolEvent.parameters === 'string'
                  ? toolEvent.parameters
                  : JSON.stringify(toolEvent.parameters || {});
                const pendingAction: AiPendingAction = {
                  actionId: toolEvent.actionId || '',
                  toolName: toolEvent.toolName || '',
                  parameters: parseActionParameters(rawArgs),
                  rawArguments: prettifyArguments(rawArgs),
                  backendMessage: toolEvent.message,
                };
                updateStatus('awaiting_confirmation');
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastIdx = newMessages.length - 1;
                  if (lastIdx >= 0 && newMessages[lastIdx].id === partialId) {
                    newMessages[lastIdx] = {
                      ...newMessages[lastIdx],
                      confirmation: pendingAction,
                      toolActivities: [
                        ...(newMessages[lastIdx].toolActivities || []),
                        {
                          id: toolEvent.actionId || toolEvent.toolName,
                          toolName: toolEvent.toolName,
                          status: 'pending_confirmation' as const,
                        },
                      ],
                    };
                  }
                  return newMessages;
                });
              }
            },
          });
          
          if (streamRes.conversationId) {
            setConversationId(streamRes.conversationId);
            conversationIdRef.current = streamRes.conversationId;
          }

          setMessages(prev => {
            const newMessages = [...prev];
            const lastIdx = newMessages.length - 1;
            if (lastIdx >= 0 && newMessages[lastIdx].id === partialId) {
              newMessages[lastIdx] = { ...newMessages[lastIdx], streaming: false };
            }
            return newMessages;
          });
          
          response = {
            type: 'message',
            message: { role: 'assistant', content: streamRes.content },
            conversationId: streamRes.conversationId
          } as AiChatResponse & { conversationId?: string };
          
          historyRef.current = [...wire, { role: 'assistant', content: streamRes.content }];
          const msgsNow = messagesRef.current;
          const lastMsg = msgsNow[msgsNow.length - 1];
          const hasPending = Boolean(lastMsg?.confirmation) || statusRef.current === 'awaiting_confirmation';
          if (!hasPending) {
            updateStatus('idle');
          } else {
            updateStatus('awaiting_confirmation');
          }
          return;
        } else {
          response = await aiChat(wire, { signal: controller.signal, conversationId: activeConvId });
          if ((response as any)?.conversationId) {
            setConversationId((response as any).conversationId);
            conversationIdRef.current = (response as any).conversationId;
          }
        }
        if (controller.signal.aborted) return;

        if (response.type === 'tool_calls') {
          const toolCalls = response.message.toolCalls ?? [];
          const toolResults = response.toolResults ?? [];
          const activities = buildActivities(toolCalls, toolResults);
          const pending = toolResults.find(isPendingConfirmation);

          if (pending) {
            const call = toolCalls.find((item: { id: string }) => item.id === pending.id) ?? toolCalls[0];
            historyRef.current = wire;
            appendMessage({
              id: nextId('assistant'),
              role: 'assistant',
              content: response.message.content ?? '',
              createdAt: Date.now(),
              toolActivities: activities,
              confirmation: buildPendingAction(pending, call),
            });
            updateStatus('awaiting_confirmation');
            return;
          }

          appendMessage({
            id: nextId('assistant'),
            role: 'assistant',
            content: response.message.content ?? '',
            createdAt: Date.now(),
            toolActivities: activities,
          });

          const withTools: AiWireMessage[] = [
            ...wire,
            { role: 'assistant', content: response.message.content ?? '', toolCalls },
            ...toolResults.map((result: { id: string, error?: unknown, result?: unknown }) => ({
              role: 'tool' as const,
              toolCallId: result.id,
              content: JSON.stringify(result.error ?? result.result ?? result),
            })),
          ];
          historyRef.current = withTools;
          updateStatus('thinking');

          const followUp = await aiChat(withTools, { signal: controller.signal });
          if (controller.signal.aborted) return;

          historyRef.current = [
            ...withTools,
            { role: 'assistant', content: followUp.message.content ?? '' },
          ];
          appendMessage({
            id: nextId('assistant'),
            role: 'assistant',
            content: followUp.message.content ?? '',
            createdAt: Date.now(),
          });
          updateStatus('idle');
          return;
        }

        const content = response.message.content ?? '';
        historyRef.current = [...wire, { role: 'assistant', content }];
        appendMessage({
          id: nextId('assistant'),
          role: 'assistant',
          content,
          createdAt: Date.now(),
        });
        updateStatus('idle');
      } catch (thrown) {
        if (controller.signal.aborted) {
          const cancelReason: string = cancelReasonRef.current;
          if (cancelReason === 'user') {
            appendMessage({
              id: nextId('system'),
              role: 'system',
              content: 'Javob bekor qilindi.',
              createdAt: Date.now(),
              kind: 'info',
            });
          }
          cancelReasonRef.current = 'none';
          updateStatus('idle');
          return;
        }

        setError(toAiErrorInfo(thrown, 'chat'));
        updateStatus('idle');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [appendMessage, updateStatus],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || statusRef.current !== 'idle') return;

      const turn: AiWireMessage = { role: 'user', content: trimmed };
      const wire = [...historyRef.current, turn];
      historyRef.current = wire;
      appendMessage({
        id: nextId('user'),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      });
      setLastPrompt(trimmed);
      await runChat(wire);
    },
    [appendMessage, runChat],
  );

  /** Re-issue the last request with the exact same history (no duplication). */
  const retry = useCallback(async () => {
    if (statusRef.current !== 'idle') return;
    const wire = historyRef.current;
    if (wire.length === 0) return;
    await runChat(wire);
  }, [runChat]);

  const stop = useCallback(() => {
    const controller = abortRef.current;
    if (!controller || controller.signal.aborted) return;
    cancelReasonRef.current = 'user';
    controller.abort();
  }, []);

  const confirm = useCallback(async () => {
    const action = messagesRef.current.find((message) => message.confirmation)?.confirmation;
    if (!action) return;

    updateStatus('confirming');

    try {
      const result = await confirmAiAction(action.actionId);
      const actionResult: AiActionResult = buildActionResult(result);
      setMessages((prev) =>
        prev.map((message) =>
          message.confirmation?.actionId === action.actionId
            ? {
                ...message,
                confirmation: undefined,
                actionError: undefined,
                actionResult,
                toolActivities: markActivities(message.toolActivities, 'success'),
              }
            : message,
        ),
      );
      updateStatus('idle');
    } catch (thrown) {
      const info = toAiErrorInfo(thrown, 'confirm');
      setMessages((prev) =>
        prev.map((message) =>
          message.confirmation?.actionId === action.actionId
            ? {
                ...message,
                confirmation: undefined,
                actionError: info,
                toolActivities: markActivities(message.toolActivities, 'error'),
              }
            : message,
        ),
      );
      updateStatus('idle');
    }
  }, [updateStatus]);

  const reject = useCallback(() => {
    const action = messagesRef.current.find((message) => message.confirmation)?.confirmation;
    if (!action) return;

    setMessages((prev) => [
      ...prev.map((message) =>
        message.confirmation?.actionId === action.actionId
          ? {
              ...message,
              confirmation: undefined,
              toolActivities: markActivities(message.toolActivities, 'cancelled'),
            }
          : message,
      ),
      {
        id: nextId('system'),
        role: 'system',
        content: 'Amal bekor qilindi. Boshqa topshiriq berishingiz mumkin.',
        createdAt: Date.now(),
        kind: 'info',
      },
    ]);
    updateStatus('idle');
  }, [updateStatus]);

  const dismissActionError = useCallback(() => {
    setMessages((prev) =>
      prev.map((message) => (message.actionError ? { ...message, actionError: undefined } : message)),
    );
  }, []);

  const clear = useCallback(() => {
    cancelReasonRef.current = 'reset';
    abortRef.current?.abort();
    abortRef.current = null;
    historyRef.current = [];
    messagesRef.current = [];
    setMessages([]);
    setError(null);
    setLastPrompt('');
    setConversationId(undefined);
    conversationIdRef.current = undefined;
    updateStatus('idle');
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore — nothing else to clean up
      }
    }
  }, [updateStatus]);

  const hydrate = useCallback((newMessages: AiUiMessage[], newHistory: AiWireMessage[] = [], newConversationId?: string) => {
    cancelReasonRef.current = 'reset';
    abortRef.current?.abort();
    abortRef.current = null;
    historyRef.current = newHistory;
    messagesRef.current = newMessages;
    setMessages(newMessages);
    setError(null);
    setLastPrompt('');
    if (newConversationId !== undefined) {
      setConversationId(newConversationId);
      conversationIdRef.current = newConversationId;
    }
    updateStatus('idle');
  }, [updateStatus]);

  const busy = status === 'sending' || status === 'thinking' || status === 'streaming' || status === 'confirming';

  return {
    messages,
    status,
    error,
    busy,
    canSend: status === 'idle',
    lastPrompt,
    conversationId,
    setConversationId,
    send,
    retry,
    stop,
    confirm,
    reject,
    dismissActionError,
    clear,
    hydrate,
  };
}
