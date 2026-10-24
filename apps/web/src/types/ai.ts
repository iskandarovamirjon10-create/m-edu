/**
 * AI Copilot frontend view models, wire types, and canonical protocol re-exports.
 * Canonical protocol contracts are imported directly from `@medu/contracts`.
 */

// Canonical protocol contracts from @medu/contracts
export {
  AiRole,
  AiMessageStatus,
  AiActionStatus,
  AI_ACTION_TERMINAL_STATUSES,
  AiToolRiskLevel,
  AiErrorCode,
  AiLocale,
} from '@medu/contracts';

export type {
  AiContext,
  AiErrorPayload,
  AiToolCall,
  AiToolResult,
  AiActionSummary,
  AiAction,
  AiMessage,
  AiConversation,
  AiConversationPage,
  AiMessagePage,
  AiStreamEvent,
  AiCreateConversationRequest,
  AiRenameConversationRequest,
  AiSendMessageRequest,
  AiSendMessageResponse,
  AiConfirmActionResponse,
  AiRejectActionResponse,
} from '@medu/contracts';

/* ── Frontend Copilot UI & Wire Types ───────────────────────────────────── */

export interface AIChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  type: 'text' | 'report' | 'chart' | 'table' | 'action' | 'error';
  data?: any;
  component?: string;
}

export interface CopilotQuickAction {
  label: string;
  icon: string;
  intent: string;
}

/** Legacy UI response shape */
export interface AIChatResponse {
  message: string;
  type: string;
  data: any;
  component?: string;
}

export type AiToolActivityStatus =
  | 'pending_confirmation'
  | 'error'
  | 'success'
  | 'running'
  | 'cancelled'
  | string;

export interface AiToolActivity {
  id?: string;
  toolName?: string;
  status?: AiToolActivityStatus;
  result?: any;
  error?: string;
  [key: string]: any;
}

// ── Tool Result Payload Schemas (v2) ──────────────────────────

export interface AiAttendanceStatusCount {
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | string;
  _count: { status: number };
}

export interface AiAttendanceSummaryData {
  overall?: {
    total: number;
    present: number;
    rate: number;
  };
  byStatus?: AiAttendanceStatusCount[];
  byGroup?: Array<{ groupId: string; _count: { status: number } }>;
}

export interface AiDebtorItem {
  id: string;
  student: string;
  total: number;
  paidAmount: number;
  status: string;
  dueDate: string | Date;
}

export interface AiDebtorsData {
  total: number;
  outstanding: number;
  debtors: AiDebtorItem[];
}

export interface AiScheduleLessonItem {
  id: string;
  group?: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
  teacher?: string;
}

export interface AiScheduleListData {
  total: number;
  lessons: AiScheduleLessonItem[];
}

export interface AiStudentSearchItem {
  id: string;
  firstName: string;
  lastName: string;
  groups?: string[];
  email?: string;
  phone?: string;
  balance?: number;
  attendanceRate?: number;
}

export interface AiStudentSearchData {
  total: number;
  students: AiStudentSearchItem[];
}

export interface AiGradeExamItem {
  id: string;
  title: string;
  subject: string;
  examDate?: string;
  averageMarks?: number;
  totalMarks: number;
  passingMarks: number;
  passedCount?: number;
  failedCount?: number;
  totalStudents?: number;
  passRate?: number;
}

export interface AiGradeAnalyticsData {
  totalExams: number;
  overallAverage: number;
  overallPassRate: number;
  exams: AiGradeExamItem[];
}

export interface AiBroadcastData {
  channel: 'sms' | 'telegram' | 'platform' | 'all';
  recipientGroup: string;
  recipientCount: number;
  title?: string;
  message: string;
  scheduledAt?: string;
}

export interface AiTeacherWorkloadItem {
  id: string;
  name: string;
  groupsCount: number;
  studentsCount: number;
  weeklyHours: number;
  attendanceRate: number;
  specializations?: string[];
}

export interface AiTeacherWorkloadData {
  totalTeachers: number;
  totalHours: number;
  averageAttendanceRate: number;
  teachers: AiTeacherWorkloadItem[];
}

export interface AiAttachment {
  id: string;
  type: 'image';
  url: string;
  base64?: string;
  mimeType: string;
  name?: string;
  size?: number;
}

export interface AiParameterField {
  name?: string;
  value?: string;
  key?: string;
  label?: string;
  [key: string]: any;
}

export interface AiPendingAction {
  actionId?: string;
  toolName?: string;
  parameters?: AiParameterField[];
  rawArguments?: string;
  backendMessage?: string;
  [key: string]: any;
}

export interface AiActionResult {
  type?: string;
  title?: string;
  summary?: string;
  fields?: AiParameterField[];
  raw?: string;
  actionId?: string;
  toolName?: string;
  message?: string;
  error?: string;
  [key: string]: any;
}

export interface AiErrorInfo {
  code?: string;
  message?: string;
  details?: string;
  retryable?: boolean;
  [key: string]: any;
}

export interface AiUiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  timestamp?: string;
  createdAt?: number;
  kind?: string;
  attachments?: AiAttachment[];
  activities?: AiToolActivity[];
  toolActivities?: AiToolActivity[];
  pendingAction?: AiPendingAction;
  actionError?: any;
  confirmation?: any;
  error?: AiErrorInfo;
  [key: string]: any;
}

export interface AiWireToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AiWireToolResult {
  id?: string;
  actionId?: string;
  toolName?: string;
  message?: string;
  error?: string;
  status?: string;
  [key: string]: any;
}

export interface AiWireMessage {
  role: 'user' | 'assistant' | 'tool' | string;
  content?: string;
  attachments?: AiAttachment[];
  tool_calls?: AiWireToolCall[];
  tool_call_id?: string;
  toolCallId?: string;
  [key: string]: any;
}

export interface AiChatResponse {
  content?: string;
  tool_calls?: AiWireToolCall[];
  error?: string;
  type?: string;
  message?: any;
  toolResults?: any[];
  conversationId?: string;
  [key: string]: any;
}
