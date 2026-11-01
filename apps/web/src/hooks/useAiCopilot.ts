/**
 * useAiCopilot — Authoritative AI Copilot State Engine.
 *
 * Responsibilities:
 *   - Typed state transitions via reducer (predictable state machine).
 *   - Abortable request lifecycle (sending -> thinking -> streaming -> idle).
 *   - Automatic tool roundtrips & explicit action approvals.
 *   - Safe SSE stream parsing with partial content preservation on abort.
 *   - Robust cancellation & cleanup on unmount or conversation switch.
 *   - LocalStorage persistence (when persistence === 'local') and server sync.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
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
import { AI_FLAGS } from '@/lib/ai/flags';
import type {
  AiActionResult,
  AiAttachment,
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
  route?: string;
  model?: string;
}

const STORAGE_KEY = 'medu:ai-copilot:v1';
const STORAGE_VERSION = 1;

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
    result: (result as any).result || (result as any).data,
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

function readPersistedConversation(): { messages: AiUiMessage[]; history: AiWireMessage[] } {
  const empty = { messages: [] as AiUiMessage[], history: [] as AiWireMessage[] };
  if (typeof window === 'undefined') return empty;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as {
      version?: number;
      messages?: AiUiMessage[];
      history?: AiWireMessage[];
    };
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.messages)) return empty;

    const cleanedMessages = parsed.messages.map((message) => {
      if (!message.confirmation) return message;
      return {
        ...message,
        confirmation: undefined,
        toolActivities: markActivities(message.toolActivities, 'cancelled'),
      };
    });

    return {
      messages: cleanedMessages,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return empty;
  }
}

function persistConversation(messages: AiUiMessage[], history: AiWireMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (messages.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        messages,
        history,
      }),
    );
  } catch {
    // quota exceeded or storage disabled — fail safely
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Reducer State & Actions
 * ────────────────────────────────────────────────────────────────────────── */

interface CopilotState {
  messages: AiUiMessage[];
  status: AiStatus;
  error: AiErrorInfo | null;
  lastPrompt: string;
  conversationId?: string;
}

type CopilotAction =
  | { type: 'SET_STATUS'; status: AiStatus }
  | { type: 'SET_ERROR'; error: AiErrorInfo | null }
  | { type: 'SET_CONVERSATION_ID'; conversationId?: string }
  | { type: 'APPEND_MESSAGE'; message: AiUiMessage }
  | { type: 'UPDATE_LAST_MESSAGE'; updater: (prev: AiUiMessage) => AiUiMessage }
  | { type: 'UPDATE_MESSAGES'; updater: (prev: AiUiMessage[]) => AiUiMessage[] }
  | { type: 'RESET'; messages?: AiUiMessage[]; conversationId?: string }
  | { type: 'SET_LAST_PROMPT'; prompt: string };

function copilotReducer(state: CopilotState, action: CopilotAction): CopilotState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_CONVERSATION_ID':
      return { ...state, conversationId: action.conversationId };
    case 'APPEND_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };
    case 'UPDATE_LAST_MESSAGE': {
      if (state.messages.length === 0) return state;
      const next = [...state.messages];
      const lastIdx = next.length - 1;
      next[lastIdx] = action.updater(next[lastIdx]);
      return { ...state, messages: next };
    }
    case 'UPDATE_MESSAGES':
      return { ...state, messages: action.updater(state.messages) };
    case 'RESET':
      return {
        messages: action.messages ?? [],
        status: 'idle',
        error: null,
        lastPrompt: '',
        conversationId: action.conversationId,
      };
    case 'SET_LAST_PROMPT':
      return { ...state, lastPrompt: action.prompt };
    default:
      return state;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Main Hook
 * ────────────────────────────────────────────────────────────────────────── */

export function useAiCopilot(options: AiCopilotOptions = {}) {
  const {
    persistence = 'local',
    getContext,
    conversationId: initialConversationId,
    initialMessages,
    route: explicitRoute,
    model: explicitModel,
  } = options;

  const [state, dispatch] = useReducer(copilotReducer, undefined, () => {
    if (initialMessages && initialMessages.length > 0) {
      return {
        messages: initialMessages,
        status: 'idle' as AiStatus,
        error: null,
        lastPrompt: '',
        conversationId: initialConversationId,
      };
    }
    if (persistence === 'local') {
      const stored = readPersistedConversation();
      return {
        messages: stored.messages,
        status: 'idle' as AiStatus,
        error: null,
        lastPrompt: '',
        conversationId: initialConversationId,
      };
    }
    return {
      messages: [],
      status: 'idle' as AiStatus,
      error: null,
      lastPrompt: '',
      conversationId: initialConversationId,
    };
  });

  const abortRef = useRef<AbortController | null>(null);
  const cancelReasonRef = useRef<'user' | 'reset' | 'none'>('none');
  const historyRef = useRef<AiWireMessage[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Initialize history wire messages from initial storage/hydration
  useEffect(() => {
    if (persistence === 'local') {
      const stored = readPersistedConversation();
      if (stored.history.length > 0) {
        historyRef.current = stored.history;
      }
    }
  }, [persistence]);

  // Persist conversation updates
  useEffect(() => {
    if (persistence === 'local') {
      persistConversation(state.messages, historyRef.current);
    }
  }, [state.messages, persistence]);

  // Synchronize conversationId changes from parent
  useEffect(() => {
    if (initialConversationId !== undefined && initialConversationId !== stateRef.current.conversationId) {
      dispatch({ type: 'SET_CONVERSATION_ID', conversationId: initialConversationId });
    }
  }, [initialConversationId]);

  const updateStatus = useCallback((status: AiStatus) => {
    if (!isMountedRef.current) return;
    dispatch({ type: 'SET_STATUS', status });
  }, []);

  const stop = useCallback(() => {
    if (!abortRef.current) return;
    cancelReasonRef.current = 'user';
    abortRef.current.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (prompt: string, attachments?: AiAttachment[]) => {
      const text = prompt.trim();
      if (!text && (!attachments || attachments.length === 0)) return;
      if (stateRef.current.status !== 'idle') return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      cancelReasonRef.current = 'none';

      dispatch({ type: 'SET_ERROR', error: null });
      dispatch({ type: 'SET_LAST_PROMPT', prompt: text });

      const userMessage: AiUiMessage = {
        id: nextId('user'),
        role: 'user',
        content: text,
        attachments,
        createdAt: Date.now(),
      };
      dispatch({ type: 'APPEND_MESSAGE', message: userMessage });

      // The authenticated context travels as structured `route` metadata, so
      // the prompt itself stays exactly what the user typed. Prefixing
      // `[Context: …]` leaked UI chrome into persisted history and into the
      // markdown transcript.
      const userWireMessage: AiWireMessage = {
        role: 'user',
        content: text,
        attachments,
      };

      const wire: AiWireMessage[] = [...historyRef.current, userWireMessage];
      historyRef.current = wire;

      updateStatus('sending');

      try {
        let response: AiChatResponse & { conversationId?: string };
        const activeConvId = stateRef.current.conversationId;

        if (AI_FLAGS.streaming) {
          updateStatus('thinking');
          const partialId = nextId('assistant');
          let hasPendingAction = false;
          let hasAppendedAssistant = false;

          const ensureAssistantAppended = () => {
            if (!hasAppendedAssistant) {
              hasAppendedAssistant = true;
              updateStatus('streaming');
              dispatch({
                type: 'APPEND_MESSAGE',
                message: {
                  id: partialId,
                  role: 'assistant',
                  content: '',
                  createdAt: Date.now(),
                  streaming: true,
                },
              });
            }
          };

          const activeRoute =
            explicitRoute || (typeof window !== 'undefined' ? window.location.pathname : undefined);

          const streamRes = await aiChatStream(wire, {
            signal: controller.signal,
            conversationId: activeConvId,
            route: activeRoute,
            model: explicitModel,
            onDelta: (delta: string) => {
              if (!isMountedRef.current) return;
              ensureAssistantAppended();
              dispatch({
                type: 'UPDATE_LAST_MESSAGE',
                updater: (prev) =>
                  prev.id === partialId ? { ...prev, content: (prev.content || '') + delta } : prev,
              });
            },
            onTool: (toolEvent: any) => {
              if (!isMountedRef.current) return;
              ensureAssistantAppended();
              if (toolEvent.type === 'tool_running') {
                dispatch({
                  type: 'UPDATE_LAST_MESSAGE',
                  updater: (prev) => {
                    if (prev.id !== partialId) return prev;
                    const existing = prev.toolActivities || [];
                    return {
                      ...prev,
                      toolActivities: [
                        ...existing,
                        { id: toolEvent.toolName, toolName: toolEvent.toolName, status: 'running' },
                      ],
                    };
                  },
                });
              } else if (toolEvent.type === 'tool_result') {
                dispatch({
                  type: 'UPDATE_LAST_MESSAGE',
                  updater: (prev) => {
                    if (prev.id !== partialId) return prev;
                    const existing = prev.toolActivities || [];
                    return {
                      ...prev,
                      toolActivities: existing.map((act) =>
                        act.toolName === toolEvent.toolName
                          ? {
                              ...act,
                              status: toolEvent.status || 'success',
                              result: toolEvent.result !== undefined ? toolEvent.result : act.result,
                            }
                          : act,
                      ),
                    };
                  },
                });
              } else if (toolEvent.type === 'action_pending') {
                ensureAssistantAppended();
                hasPendingAction = true;
                const pendingAction: AiPendingAction = {
                  actionId: toolEvent.actionId,
                  toolName: toolEvent.toolName,
                  parameters: parseActionParameters(JSON.stringify(toolEvent.parameters || {})),
                  backendMessage: toolEvent.message,
                };
                updateStatus('awaiting_confirmation');
                dispatch({
                  type: 'UPDATE_LAST_MESSAGE',
                  updater: (prev) => {
                    if (prev.id !== partialId) return prev;
                    return {
                      ...prev,
                      confirmation: pendingAction,
                      toolActivities: [
                        ...(prev.toolActivities || []),
                        {
                          id: toolEvent.actionId || toolEvent.toolName,
                          toolName: toolEvent.toolName,
                          status: 'pending_confirmation',
                        },
                      ],
                    };
                  },
                });
              }
            },
          });

          if (streamRes.conversationId) {
            dispatch({ type: 'SET_CONVERSATION_ID', conversationId: streamRes.conversationId });
          }

          if (!hasAppendedAssistant) {
            hasAppendedAssistant = true;
            dispatch({
              type: 'APPEND_MESSAGE',
              message: {
                id: partialId,
                role: 'assistant',
                content: streamRes.content || '',
                createdAt: Date.now(),
                streaming: false,
              },
            });
          } else {
            dispatch({
              type: 'UPDATE_LAST_MESSAGE',
              updater: (prev) => (prev.id === partialId ? { ...prev, streaming: false } : prev),
            });
          }

          response = {
            type: 'message',
            message: { role: 'assistant', content: streamRes.content },
            conversationId: streamRes.conversationId,
          };

          historyRef.current = [...wire, { role: 'assistant', content: streamRes.content }];
          if (!hasPendingAction) {
            updateStatus('idle');
          } else {
            updateStatus('awaiting_confirmation');
          }
          return;
        }

        const activeRoute =
          explicitRoute || (typeof window !== 'undefined' ? window.location.pathname : undefined);

        // Non-streaming REST execution
        response = await aiChat(wire, {
          signal: controller.signal,
          conversationId: activeConvId,
          route: activeRoute,
          model: explicitModel,
        });
        if ((response as any)?.conversationId) {
          dispatch({ type: 'SET_CONVERSATION_ID', conversationId: (response as any).conversationId });
        }

        if (controller.signal.aborted) return;

        if (response.type === 'tool_calls') {
          const toolCalls = response.message?.toolCalls ?? [];
          const toolResults = response.toolResults ?? [];
          const activities = buildActivities(toolCalls, toolResults);
          const pending = toolResults.find(isPendingConfirmation);

          if (pending) {
            const call = toolCalls.find((item: { id: string }) => item.id === pending.id) ?? toolCalls[0];
            historyRef.current = wire;
            dispatch({
              type: 'APPEND_MESSAGE',
              message: {
                id: nextId('assistant'),
                role: 'assistant',
                content: response.message?.content ?? '',
                createdAt: Date.now(),
                toolActivities: activities,
                confirmation: buildPendingAction(pending, call),
              },
            });
            updateStatus('awaiting_confirmation');
            return;
          }

          dispatch({
            type: 'APPEND_MESSAGE',
            message: {
              id: nextId('assistant'),
              role: 'assistant',
              content: response.message?.content ?? '',
              createdAt: Date.now(),
              toolActivities: activities,
            },
          });

          const withTools: AiWireMessage[] = [
            ...wire,
            { role: 'assistant', content: response.message?.content ?? '', toolCalls },
            ...toolResults.map((result: { id: string; error?: unknown; result?: unknown }) => ({
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
            { role: 'assistant', content: followUp.message?.content ?? '' },
          ];
          dispatch({
            type: 'APPEND_MESSAGE',
            message: {
              id: nextId('assistant'),
              role: 'assistant',
              content: followUp.message?.content ?? '',
              createdAt: Date.now(),
            },
          });
          updateStatus('idle');
          return;
        }

        const content = response.message?.content ?? '';
        historyRef.current = [...wire, { role: 'assistant', content }];
        dispatch({
          type: 'APPEND_MESSAGE',
          message: {
            id: nextId('assistant'),
            role: 'assistant',
            content,
            createdAt: Date.now(),
          },
        });
        updateStatus('idle');
      } catch (thrown) {
        if (controller.signal.aborted) {
          const cancelReason: string = cancelReasonRef.current;
          if (cancelReason === 'user') {
            dispatch({
              type: 'APPEND_MESSAGE',
              message: {
                id: nextId('system'),
                role: 'system',
                content: 'Javob bekor qilindi.',
                createdAt: Date.now(),
                kind: 'info',
              },
            });
          }
          cancelReasonRef.current = 'none';
          updateStatus('idle');
          return;
        }

        const errInfo = toAiErrorInfo(thrown, 'chat');
        if (errInfo.code === 'forbidden' || errInfo.code === 'not_found') {
          dispatch({ type: 'SET_CONVERSATION_ID', conversationId: undefined });
        }
        dispatch({ type: 'SET_ERROR', error: errInfo });
        updateStatus('idle');
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [getContext, updateStatus, explicitModel],
  );

  const retry = useCallback(async () => {
    const prompt = stateRef.current.lastPrompt;
    if (!prompt) return;

    // Remove the trailing error state and last user message from UI list so it is re-sent cleanly
    dispatch({
      type: 'UPDATE_MESSAGES',
      updater: (prev) => {
        const lastIdx = prev.length - 1;
        if (lastIdx >= 0 && prev[lastIdx].role === 'user') {
          return prev.slice(0, lastIdx);
        }
        return prev;
      },
    });

    if (historyRef.current.length > 0) {
      const lastWire = historyRef.current[historyRef.current.length - 1];
      if (lastWire?.role === 'user') {
        historyRef.current = historyRef.current.slice(0, -1);
      }
    }

    dispatch({ type: 'SET_ERROR', error: null });
    await send(prompt);
  }, [send]);

  const confirm = useCallback(async () => {
    const action = stateRef.current.messages.find((message) => message.confirmation)?.confirmation;
    if (!action) return;

    updateStatus('confirming');
    try {
      const result = await confirmAiAction(action.actionId);
      const actionResult: AiActionResult = buildActionResult(result);

      dispatch({
        type: 'UPDATE_MESSAGES',
        updater: (prev) =>
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
      });
      updateStatus('idle');
    } catch (thrown) {
      const info = toAiErrorInfo(thrown, 'confirm');
      dispatch({
        type: 'UPDATE_MESSAGES',
        updater: (prev) =>
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
      });
      updateStatus('idle');
    }
  }, [updateStatus]);

  const reject = useCallback(() => {
    const action = stateRef.current.messages.find((message) => message.confirmation)?.confirmation;
    if (!action) return;

    dispatch({
      type: 'UPDATE_MESSAGES',
      updater: (prev) => [
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
      ],
    });
    updateStatus('idle');
  }, [updateStatus]);

  const dismissActionError = useCallback(() => {
    dispatch({
      type: 'UPDATE_MESSAGES',
      updater: (prev) =>
        prev.map((message) => (message.actionError ? { ...message, actionError: undefined } : message)),
    });
  }, []);

  const clear = useCallback(() => {
    cancelReasonRef.current = 'reset';
    abortRef.current?.abort();
    abortRef.current = null;
    historyRef.current = [];
    dispatch({ type: 'RESET' });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const hydrate = useCallback(
    (newMessages: AiUiMessage[], newHistory: AiWireMessage[] = [], newConversationId?: string) => {
      cancelReasonRef.current = 'reset';
      abortRef.current?.abort();
      abortRef.current = null;
      historyRef.current = newHistory;
      dispatch({
        type: 'RESET',
        messages: newMessages,
        conversationId: newConversationId,
      });
    },
    [],
  );

  const setConversationId = useCallback((id?: string) => {
    dispatch({ type: 'SET_CONVERSATION_ID', conversationId: id });
  }, []);

  const busy =
    state.status === 'sending' ||
    state.status === 'thinking' ||
    state.status === 'streaming' ||
    state.status === 'confirming';

  return {
    messages: state.messages,
    status: state.status,
    error: state.error,
    busy,
    canSend: state.status === 'idle',
    lastPrompt: state.lastPrompt,
    conversationId: state.conversationId,
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
