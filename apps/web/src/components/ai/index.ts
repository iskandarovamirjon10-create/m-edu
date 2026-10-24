/**
 * M-EDU AI Copilot UI — public surface.
 *
 * Layout
 *   AiCopilotHeader · AiMessageList · AiComposer · AiWelcome
 *   CopilotHistoryRail · CopilotContextPanel · CopilotCommandPalette
 *
 * Messages
 *   AiUserMessage · AiAssistantMessage · AiSystemMessage
 *   AiThinking · AiToolActivityCard · AiActionConfirmation
 *
 * Primitives & assets
 *   CopilotButton · CopilotIconButton · CopilotSegmented · CopilotKbd
 *   copilotIcons (bespoke icon language)
 */
export { AiCopilotHeader, AI_MODELS, type AiCopilotHeaderProps, type ModelOption } from './AiCopilotHeader';
export {
  AiWelcome,
  AiQuickPrompt,
  AI_QUICK_PROMPTS,
  useAiQuickPrompts,
  type AiWelcomeProps,
  type AiQuickPromptProps,
  type AiQuickPromptData,
} from './AiWelcome';
export { AiMessageList, type AiMessageListProps } from './AiMessageList';
export { AiUserMessage, AiAssistantMessage, AiSystemMessage } from './AiMessages';
export { AiThinking, type AiThinkingProps } from './AiThinking';
export { AiToolActivityCard, type AiToolActivityCardProps } from './AiToolActivity';
export { AiActionConfirmation, ActionResultCard, ActionErrorNote } from './AiActionConfirmation';
export { AiComposer, type AiComposerProps } from './AiComposer';
export { AiErrorCard, type AiErrorCardProps } from './AiErrorCard';
export { MarkdownContent, type MarkdownContentProps } from './MarkdownContent';
export { AiAvatar, UserAvatar } from './AiAvatar';
export { GlobalAiCopilot } from './GlobalAiCopilot';
export { CopilotHistoryRail, type CopilotHistoryRailProps } from './CopilotHistoryRail';
export { CopilotContextPanel, type CopilotContextPanelProps } from './CopilotContextPanel';
export {
  CopilotCommandPalette,
  type CopilotCommand,
  type CopilotCommandPaletteProps,
} from './CopilotCommandPalette';
export {
  CopilotButton,
  CopilotIconButton,
  CopilotSegmented,
  CopilotKbd,
  CopilotBadge,
  CopilotStatusDot,
  type CopilotButtonProps,
  type CopilotSegmentOption,
} from './CopilotControls';
export * from './widgets';
export { AiExecutiveBriefingCard } from './AiExecutiveBriefingCard';
export { AiStudentDiagnosticWidget } from './AiStudentDiagnosticWidget';
export { AiParentMessageModal } from './AiParentMessageModal';
export { AiLessonQuizStudioModal } from './AiLessonQuizStudioModal';
