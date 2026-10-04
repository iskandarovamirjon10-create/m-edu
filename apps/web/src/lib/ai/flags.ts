// M-EDU AI Copilot — integration pass
export const AI_FLAGS: {
  conversations: boolean;
  insights: boolean;
  suggestions: boolean;
  streaming: boolean;
} = {
  conversations: import.meta.env.VITE_AI_CONVERSATIONS_ENABLED === 'true',
  insights:      import.meta.env.VITE_AI_INSIGHTS_ENABLED === 'true',
  suggestions:   import.meta.env.VITE_AI_SUGGESTIONS_ENABLED === 'true',
  streaming:     import.meta.env.VITE_AI_STREAMING_ENABLED === 'true',
};
