// M-EDU AI Copilot — integration pass
/**
 * Capability flags.
 *
 * These used to default to OFF (strict `=== 'true'`), so a deployment that had
 * not set every VITE_AI_* variable silently lost streaming, the conversation
 * rail and the insight panel — the features existed but never rendered.
 * Capabilities are now ON by default and can be disabled explicitly.
 */
const enabled = (value: unknown): boolean => value !== 'false' && value !== '0';

export const AI_FLAGS: {
  conversations: boolean;
  insights: boolean;
  suggestions: boolean;
  streaming: boolean;
} = {
  conversations: enabled(import.meta.env.VITE_AI_CONVERSATIONS_ENABLED),
  insights: enabled(import.meta.env.VITE_AI_INSIGHTS_ENABLED),
  suggestions: enabled(import.meta.env.VITE_AI_SUGGESTIONS_ENABLED),
  streaming: enabled(import.meta.env.VITE_AI_STREAMING_ENABLED),
};
