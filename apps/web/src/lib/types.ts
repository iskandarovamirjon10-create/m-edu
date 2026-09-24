// M-EDU frontend types — mirror the API contracts (Swagger / @medu/contracts).

export type Role = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MANAGER' | 'TEACHER' | 'ASSISTANT' | 'STUDENT';
export type UserRole = Role;
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type PaymentStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';
export type LeadStage = 'NEW' | 'CONTACTED' | 'TRIAL_LESSON' | 'WON' | 'LOST';
export type LeadActivityType = 'CALL' | 'MESSAGE' | 'MEETING' | 'REMINDER' | 'TASK' | 'NOTE';
export type ExpenseCategory =
  | 'SALARY' | 'RENT' | 'UTILITIES' | 'MARKETING' | 'SUPPLIES'
  | 'MAINTENANCE' | 'SOFTWARE' | 'TRAINING' | 'OTHER';
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'PAYME' | 'CLICK' | 'UZUM' | 'OTHER';

export interface Organization {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatar?: string | null;
  role: Role;
  isActive: boolean;
  organizationId: string;
  lastLoginAt?: string | null;
  organization?: Organization;
  settings?: UserSettings | null;
}

export interface UserSettings {
  id: string;
  theme?: string | null;
  language?: string | null;
  timezone?: string | null;
  emailNotifications?: boolean | null;
  pushNotifications?: boolean | null;
  smsNotifications?: boolean | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Student {
  id: string;
  organizationId: string;
  userId: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  address?: string | null;
  notes?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'isActive'>;
  groups?: { group: { id: string; name: string; room?: string | null }; isActive: boolean }[];
  payments?: Payment[];
  attendance?: Attendance[];
  _count?: { payments: number };
}

export interface Teacher {
  id: string;
  organizationId: string;
  userId: string;
  specializations: string[];
  hourlyRate?: string | null;
  bio?: string | null;
  experience?: number | null;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'isActive'>;
  groups?: Group[];
}

export interface Course {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  price: string;
  duration: number;
  level?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  organizationId: string;
  name: string;
  courseId: string;
  teacherId?: string | null;
  capacity?: number | null;
  room?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  course?: Course;
  teacher?: Teacher | null;
  enrollments?: { student: Student; isActive: boolean }[];
  schedules?: Schedule[];
  _count?: { enrollments?: number; attendance?: number };
}

export interface Schedule {
  id: string;
  groupId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string | null;
  isActive: boolean;
}

export interface Attendance {
  id: string;
  organizationId: string;
  studentId: string;
  groupId: string;
  date: string;
  status: AttendanceStatus;
  source: string;
  note?: string | null;
  confidence?: string | null;
  student?: Student;
  group?: Group;
}

export interface Payment {
  id: string;
  organizationId: string;
  studentId: string;
  amount: string;
  status: PaymentStatus;
  description?: string | null;
  dueDate?: string | null;
  method?: string | null;
  reference?: string | null;
  createdAt: string;
  student?: Student;
}

export interface Expense {
  id: string;
  organizationId: string;
  category: ExpenseCategory;
  amount: string;
  description?: string | null;
  date: string;
  receipt?: string | null;
}

export interface Lead {
  id: string;
  organizationId: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  stage: LeadStage;
  lostReason?: string | null;
  notes?: string | null;
  ownerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  subject: string;
  description?: string | null;
  outcome?: string | null;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  organizationId: string;
  leadId: string;
  scheduledAt: string;
  isCompleted: boolean;
  note?: string | null;
  lead?: Pick<Lead, 'firstName' | 'lastName'>;
}

export interface Grade {
  id: string;
  studentId: string;
  groupId: string;
  value: number;
  maxValue?: number | null;
  label?: string | null;
  notes?: string | null;
}

export interface Homework {
  id: string;
  organizationId: string;
  groupId: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  maxScore?: number | null;
  group?: Group;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  activeGroups: number;
  totalCourses?: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  monthlyRevenue: MonthlyRevenue[];
  recentPayments: Payment[];
  totalLeads: number;
  wonLeads: number;
  newLeadsThisMonth: number;
  conversionRate: number;
  upcomingFollowUps: FollowUp[];
  attendanceStats: AttendanceStat[];
  leadByStage: { stage: LeadStage; count: number }[];
}

export interface FaceEnrollment {
  id: string;
  /** POST /face/enrollments returns { enrollmentId, status } — kept alongside id for compatibility. */
  enrollmentId?: string;
  organizationId: string;
  studentId: string;
  status: FaceEnrollmentStatus;
  enrolledAt: string;
  activatedAt?: string | null;
  revokedAt?: string | null;
  /**
   * Backend GET /face/enrollments returns a flattened student summary
   * (id/firstName/lastName/studentId/isActive) — NOT the nested
   * `student.user` shape. Kept optional for compatibility.
   */
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    studentId?: string | null;
    isActive?: boolean;
  };
  /** Backend returns templates under `templates`. */
  templates?: FaceTemplate[];
  faceTemplates?: FaceTemplate[];
}

export interface FaceTemplate {
  id: string;
  templateHash: string;
  version: number;
  status: string;
  modelVersion?: string | null;
  qualityScore?: string | null;
  enrolledAt: string;
}

export interface RecognitionSession {
  id: string;
  /** POST /face/sessions returns { sessionId, status } — kept alongside id for compatibility. */
  sessionId?: string;
  organizationId: string;
  groupId?: string | null;
  status: string;
  startedAt: string;
  endedAt?: string | null;
}

export interface RecognitionAttempt {
  id: string;
  organizationId: string;
  sessionId: string;
  identifiedStudentId?: string | null;
  status: string;
  confidence?: string | null;
  qualityScore?: string | null;
  livenessResult?: string | null;
  similarityScore?: string | null;
  occurredAt: string;
  student?: Student | null;
}

export interface FaceDevice {
  id: string;
  organizationId: string;
  name: string;
  status: string;
  lastSeenAt?: string | null;
  registeredAt: string;
}

export interface FaceAuditEvent {
  id: string;
  organizationId: string;
  type: string;
  resourceType: string;
  resourceId?: string | null;
  description: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
}

export interface Camera {
  id: string;
  organizationId: string;
  name: string;
  vendor?: string | null;
  model?: string | null;
  protocol: 'RTSP' | 'ONVIF';
  host: string;
  port: number;
  streamPath?: string | null;
  location?: string | null;
  enabled: boolean;
  recognitionEnabled: boolean;
  attendanceEnabled: boolean;
  status: string;
  lastSeenAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  credentialConfigured: boolean;
}

export interface AnalyticsOverview {
  overview: {
    totalStudents: number;
    activeStudents: number;
    totalTeachers: number;
    activeGroups: number;
    totalRevenue: number;
    monthlyRevenue: { month: string; total: number }[];
  };
  students: { monthlyNew: { month: string; count: number }[] };
  attendance: { statusDistribution: { status: AttendanceStatus; count: number }[]; averageRate: number };
  payments: { byStatus: { status: PaymentStatus; count: number; total: number }[] };
  leads: { byStage: { stage: LeadStage; count: number }[]; conversionRate: number };
}

// ==================== Refactored-page shared types ====================

export type AuditEventType =
  | 'FACE_ENROLLMENT_CREATED'
  | 'FACE_ENROLLMENT_REVOKED'
  | 'FACE_RECOGNITION_ATTEMPTED'
  | 'FACE_RECOGNITION_CONFIRMED'
  | 'FACE_RECOGNITION_REJECTED'
  | 'LIVENESS_FAILED'
  | 'DEVICE_REGISTERED'
  | 'DEVICE_ACTIVATED'
  | 'DEVICE_REVOKED'
  | 'TEMPLATE_UPDATED'
  | 'ATTENDANCE_AUTO_RECORDED'
  | 'OTHER';

export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export type FaceEnrollmentStatus = 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';

/** Schedule row as returned inside a Group detail (backend Group.schedules). */
export interface GroupSchedule {
  id: string;
  groupId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string | null;
  isActive: boolean;
}

/** Backend GET /face/engine-status payload. */
export interface FaceEngineStatus {
  provider: string;
  isReal: boolean;
}

export interface MonthlyRevenue {
  month: string;
  total: number;
  count?: number;
}

export interface AttendanceStat {
  status: AttendanceStatus;
  count: number;
}

export interface AttendanceAnalytics {
  overall: { total: number; present: number; rate: number };
  byStatus: AttendanceStat[];
  byGroup: Array<{ groupId: string | null; _count: { status: number } }>;
  daily: Array<{ date: string; status: AttendanceStatus; count: number }>;
}

export type CameraProtocol = 'RTSP' | 'ONVIF';

export type CameraStatus =
  | 'CONFIGURED'
  | 'CONNECTING'
  | 'ONLINE'
  | 'ERROR'
  | 'DISABLED'
  | 'RECONNECTING';

// ==================== Library ====================
export interface LibraryBook {
  id: string;
  organizationId: string;
  title: string;
  author?: string;
  isbn?: string;
  barcode: string;
  category: string;
  quantity: number;
  availableQuantity: number;
  location?: string;
  publisher?: string;
  publishedYear?: number;
  language?: string;
  description?: string;
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
}

export type BorrowStatus = 'BORROWED' | 'RETURNED' | 'OVERDUE';

export interface LibraryBorrow {
  id: string;
  organizationId: string;
  bookId: string;
  studentId: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  lateFee?: number;
  status: BorrowStatus;
  notes?: string;
  book?: LibraryBook;
  student?: Student;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryStats {
  totalBooks: number;
  totalBorrowed: number;
  totalOverdue: number;
  availableBooks: number;
}

// ==================== HR & Payroll ====================
export type ContractType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type LeaveType = 'SICK' | 'VACATION' | 'PERSONAL' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Employee {
  id: string;
  organizationId: string;
  userId: string;
  employeeNumber?: string | null;
  position: string;
  department?: string | null;
  contractType: ContractType;
  salary: number;
  hireDate: string;
  isActive: boolean;
  bankAccount?: string | null;
  taxId?: string | null;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone' | 'avatar'>;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  organizationId: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
  status: LeaveStatus;
  approvedBy?: string;
  rejectionReason?: string;
  employee?: Employee;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  month: string;
  baseSalary: number;
  bonuses?: number;
  deductions?: number;
  tax?: number;
  netSalary: number;
  isPaid: boolean;
  paidDate?: string;
  employee?: Employee;
  createdAt: string;
  updatedAt: string;
}

export interface HRStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaves: number;
  totalPayroll: number;
}

// ==================== Exams ====================
export type ExamType = 'MIDTERM' | 'FINAL' | 'QUIZ' | 'ASSIGNMENT';

export interface Exam {
  id: string;
  organizationId: string;
  groupId: string;
  subject: string;
  title: string;
  description?: string | null;
  examDate: string;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  examType: ExamType;
  isPublished: boolean;
  group?: { id: string; name: string; courseId?: string; course?: Course };
  results?: { id: string; marksObtained: number; isPassed: boolean }[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamResult {
  id: string;
  organizationId: string;
  examId: string;
  studentId: string;
  score: number;
  grade?: string;
  isPassed: boolean;
  rank?: number;
  submittedAt?: string;
  gradedAt?: string;
  exam?: Exam;
  student?: Student;
  createdAt: string;
  updatedAt: string;
}

export interface ExamStats {
  totalExams: number;
  upcomingExams: number;
  averageScore: number;
  passRate: number;
}

// ==================== Certificates ====================
export interface Certificate {
  id: string;
  organizationId: string;
  studentId: string;
  courseId?: string;
  certificateNumber: string;
  title: string;
  description?: string;
  issueDate: string;
  expiryDate?: string;
  verificationCode: string;
  pdfUrl?: string;
  templateId?: string;
  student?: Student;
  course?: Course;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateTemplate {
  id: string;
  organizationId: string;
  name: string;
  htmlTemplate: string;
  cssStyles?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==================== Inventory ====================
export type InventoryCategory = 'BOOKS' | 'EQUIPMENT' | 'FURNITURE' | 'SUPPLIES' | 'ELECTRONICS' | 'OTHER';
export type TransactionType = 'PURCHASE' | 'ISSUE' | 'RETURN' | 'DAMAGE' | 'DISPOSAL';

export interface InventoryItem {
  id: string;
  organizationId: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  minStock?: number;
  location?: string;
  supplier?: string;
  purchasePrice?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  organizationId: string;
  itemId: string;
  type: TransactionType;
  quantity: number;
  pricePerUnit?: number;
  totalPrice?: number;
  performedBy?: string;
  notes?: string;
  item?: InventoryItem;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStats {
  totalItems: number;
  lowStockItems: number;
  totalValue: number;
  recentTransactions: number;
}

// ==================== Global Audit Timeline ====================
export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE'
  | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED'
  | 'EXPORT' | 'IMPORT' | 'BULK_UPDATE'
  | 'PAYMENT_RECEIVED' | 'ENROLLMENT_CREATED' | 'ENROLLMENT_REVOKED'
  | 'ATTENDANCE_RECORDED' | 'GRADE_RECORDED'
  | 'DOCUMENT_UPLOADED' | 'DOCUMENT_DELETED'
  | 'WORKFLOW_TRIGGERED' | 'WORKFLOW_COMPLETED'
  | 'CUSTOM';

export type AuditEntityType =
  | 'STUDENT' | 'TEACHER' | 'USER' | 'GROUP' | 'COURSE'
  | 'PAYMENT' | 'EXPENSE' | 'LEAD' | 'NOTIFICATION'
  | 'GRADE' | 'HOMEWORK' | 'ATTENDANCE'
  | 'FACE_ENROLLMENT' | 'FACE_DEVICE' | 'FACE_RECOGNITION'
  | 'CAMERA' | 'EMPLOYEE' | 'SALARY' | 'LEAVE'
  | 'EXAM' | 'EXAM_RESULT' | 'CERTIFICATE'
  | 'INVENTORY_ITEM' | 'INVENTORY_TRANSACTION'
  | 'LIBRARY_BOOK' | 'LIBRARY_BORROW'
  | 'DOCUMENT' | 'ROOM' | 'BOOKING' | 'WORKFLOW'
  | 'FEATURE_FLAG' | 'ORGANIZATION' | 'ROLE'
  | 'OTHER';

export interface SystemAuditEvent {
  id: string;
  organizationId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  /** Optional human-readable entity label (e.g. student name). */
  entityLabel?: string | null;
  description: string;
  /** Serialised before/after JSON snapshot for diffing. */
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface AuditTimelineFilters {
  page: number;
  limit: number;
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  actorId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ChangeHistoryEntry {
  id: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: string;
  changedBy?: string | null;
}

// ==================== Universal Search ====================
export type SearchableEntityType =
  | 'STUDENT' | 'TEACHER' | 'GROUP' | 'COURSE' | 'LEAD'
  | 'PAYMENT' | 'EXAM' | 'EMPLOYEE' | 'BOOK' | 'CERTIFICATE';

export interface SearchResultItem {
  id: string;
  type: SearchableEntityType;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  href: string;
  relevanceScore: number;
  metadata?: Record<string, unknown> | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  byType: Record<SearchableEntityType, number>;
  tookMs: number;
}

// ==================== Relationship Graph ====================
export type RelationshipType =
  | 'ENROLLED_IN' | 'TEACHES' | 'MEMBER_OF' | 'OWES_PAYMENT'
  | 'PAID' | 'PARENT_OF' | 'SCHEDULED_FOR' | 'EXAMINED'
  | 'CERTIFIED_FOR' | 'BORROWED' | 'ATTENDED' | 'ASSIGNED_TO'
  | 'GRADED_IN' | 'WORKS_ON' | 'MANAGES' | 'CUSTOM';

export interface GraphNode {
  id: string;
  type: SearchableEntityType;
  label: string;
  metadata?: Record<string, unknown> | null;
  weight?: number;
  /** Position for layout; absent means unpositioned. */
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label?: string | null;
  weight?: number;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface GraphResponse {
  rootNodeId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  depth: number;
}

// ==================== Data Quality Center ====================
export type DataQualitySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DataQualityCategory =
  | 'MISSING_FIELD' | 'INVALID_FORMAT' | 'DUPLICATE'
  | 'INCONSISTENT' | 'STALE' | 'ORPHAN' | 'OTHER';

export interface DataQualityIssue {
  id: string;
  organizationId: string;
  entityType: AuditEntityType;
  entityId: string;
  category: DataQualityCategory;
  severity: DataQualitySeverity;
  field?: string | null;
  message: string;
  /** Rule identifier that detected this. */
  ruleId: string;
  detectedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
}

export interface DataQualitySummary {
  total: number;
  bySeverity: Record<DataQualitySeverity, number>;
  byCategory: Record<DataQualityCategory, number>;
  resolvedThisWeek: number;
  detectedToday: number;
  trend: { date: string; count: number }[];
}

export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  entityType: AuditEntityType;
  field?: string;
  category: DataQualityCategory;
  severity: DataQualitySeverity;
  enabled: boolean;
  lastRunAt?: string;
  lastRunIssues?: number;
}

// ==================== Workflow Engine ====================
export type WorkflowTrigger =
  | 'MANUAL' | 'ON_CREATE' | 'ON_UPDATE' | 'ON_DELETE'
  | 'ON_SCHEDULE' | 'ON_CONDITION' | 'ON_EVENT';

export type WorkflowStepType =
  | 'SEND_NOTIFICATION' | 'SEND_EMAIL' | 'CREATE_TASK'
  | 'UPDATE_FIELD' | 'WEBHOOK' | 'WAIT' | 'CONDITION'
  | 'APPROVAL' | 'ASSIGN_ROLE' | 'RUN_QUERY';

export type WorkflowInstanceStatus =
  | 'PENDING' | 'RUNNING' | 'WAITING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'startsWith' | 'endsWith';
  value: unknown;
}

export interface WorkflowStep {
  id: string;
  order: number;
  type: WorkflowStepType;
  name: string;
  config: Record<string, unknown>;
  /** Optional conditions that must pass before this step runs. */
  conditions?: WorkflowCondition[];
  /** On failure behaviour. */
  onError?: 'fail' | 'continue' | 'retry';
  retries?: number;
}

export interface WorkflowRule {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  /** Entity the rule listens on. */
  entityType: AuditEntityType;
  conditions?: WorkflowCondition[];
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  lastRunStatus?: 'success' | 'failed' | null;
  runCount?: number;
}

export interface WorkflowInstanceStep {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  output?: Record<string, unknown>;
}

export interface WorkflowInstance {
  id: string;
  organizationId: string;
  ruleId: string;
  ruleName: string;
  status: WorkflowInstanceStatus;
  triggerPayload?: Record<string, unknown>;
  steps: WorkflowInstanceStep[];
  startedAt: string;
  completedAt?: string | null;
  error?: string | null;
}

// ==================== Document Management ====================
export type DocumentCategory =
  | 'CONTRACT' | 'ID' | 'CERTIFICATE' | 'REPORT'
  | 'INVOICE' | 'POLICY' | 'CURRICULUM' | 'MEDIA' | 'OTHER';

export interface DocumentVersion {
  id: string;
  version: number;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  note?: string;
}

export interface Document {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  category: DocumentCategory;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  version: number;
  tags?: string[];
  /** Link to a related entity (e.g. studentId, employeeId, contractId). */
  relatedEntityType?: AuditEntityType;
  relatedEntityId?: string;
  uploadedBy: string;
  uploadedAt: string;
  expiresAt?: string;
  versions?: DocumentVersion[];
}

// ==================== Resource & Room Management ====================
export type ResourceType = 'ROOM' | 'EQUIPMENT' | 'VEHICLE' | 'OTHER';

export interface Resource {
  id: string;
  organizationId: string;
  name: string;
  type: ResourceType;
  capacity?: number;
  location?: string;
  description?: string;
  isActive: boolean;
  /** Bookable weekly availability (e.g. Mon-Fri 9-17). */
  availability?: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface ResourceBooking {
  id: string;
  organizationId: string;
  resourceId: string;
  resource?: Resource;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  bookedBy: string;
  bookedByName?: string;
  attendees?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== Import / Export Center ====================
export type JobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ImportExportFormat = 'CSV' | 'XLSX' | 'JSON' | 'PDF';

export interface ImportJob {
  id: string;
  organizationId: string;
  entityType: AuditEntityType;
  format: ImportExportFormat;
  fileName: string;
  status: JobStatus;
  totalRows?: number;
  processedRows?: number;
  successRows?: number;
  failedRows?: number;
  errors?: { row: number; field?: string; message: string }[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  createdBy: string;
}

export interface ExportJob {
  id: string;
  organizationId: string;
  entityType: AuditEntityType;
  format: ImportExportFormat;
  fileName?: string;
  downloadUrl?: string;
  status: JobStatus;
  rowCount?: number;
  filters?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

// ==================== Early Warning System ====================
export type WarningSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type WarningCategory =
  | 'ATTENDANCE_DROP' | 'GRADE_DROP' | 'PAYMENT_OVERDUE'
  | 'INACTIVITY' | 'ENROLLMENT_EXPIRY' | 'EXAM_AT_RISK'
  | 'TEACHER_OVERLOAD' | 'RESOURCE_CONFLICT' | 'INVENTORY_LOW'
  | 'CERTIFICATE_EXPIRY' | 'CUSTOM';

export interface EarlyWarning {
  id: string;
  organizationId: string;
  category: WarningCategory;
  severity: WarningSeverity;
  title: string;
  message: string;
  /** Entity involved. */
  entityType: AuditEntityType;
  entityId: string;
  entityLabel?: string;
  /** Underlying metric value that triggered the warning. */
  metric?: { name: string; value: number; threshold: number };
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

// ==================== Academic Risk ====================
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  category: 'ATTENDANCE' | 'GRADES' | 'PARTICIPATION' | 'PAYMENT' | 'BEHAVIOUR' | 'OTHER';
  weight: number;       // 0-1
  score: number;        // 0-100
  contribution: number; // weight * score
  description: string;
}

export interface AcademicRisk {
  studentId: string;
  studentName: string;
  level: RiskLevel;
  /** Composite risk score 0-100. */
  score: number;
  factors: RiskFactor[];
  recommendations: string[];
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  lastEvaluatedAt: string;
  /** Risk level 30 days ago. */
  previousLevel?: RiskLevel;
}

export interface AcademicRiskSummary {
  totalAtRisk: number;
  byLevel: Record<RiskLevel, number>;
  trend: { date: string; average: number }[];
  topRiskFactors: { category: RiskFactor['category']; count: number }[];
}

// ==================== Teacher Workload ====================
export interface TeacherWorkload {
  teacherId: string;
  teacherName: string;
  weeklyHours: number;
  groupsCount: number;
  studentsCount: number;
  capacityHours: number;
  utilisationPct: number;
  overload: boolean;
  upcomingClasses: {
    groupId: string;
    groupName: string;
    startAt: string;
    endAt: string;
  }[];
  riskFactors: string[];
  recommendation?: string;
}

export interface WorkloadSummary {
  totalTeachers: number;
  overloaded: number;
  underutilised: number;
  averageUtilisationPct: number;
  totalWeeklyHours: number;
  totalCapacityHours: number;
}

// ==================== Forecasting ====================
export type ForecastMetric =
  | 'REVENUE' | 'ENROLLMENTS' | 'ATTENDANCE' | 'ATTRITION' | 'CHURN';

export interface ForecastPoint {
  date: string;        // YYYY-MM-DD or YYYY-MM
  predicted: number;
  lowerBound: number;  // confidence interval lower
  upperBound: number;  // confidence interval upper
  actual?: number;     // present when date is in the past
}

export interface Forecast {
  metric: ForecastMetric;
  /** Time horizon (e.g. 30 days, 6 months). */
  horizon: string;
  method: string;     // e.g. "moving average + seasonal decomposition"
  /** 0-1; higher = more certain. */
  confidence: number;
  points: ForecastPoint[];
  generatedAt: string;
  insights: string[];
}

// ==================== Branches ====================
export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  managerId?: string | null;
  email?: string | null;
  timezone?: string | null;
  currency?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  manager?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  _count?: { users?: number; courses?: number; students?: number; teachers?: number; groups?: number };
}

// ==================== Chat ====================
export interface ChatConversation {
  id: string;
  organizationId: string;
  title?: string | null;
  createdBy: string;
  lastMessageAt?: string | null;
  createdAt: string;
  participants?: ChatParticipant[];
  messages?: ChatMessage[];
  unreadCount?: number;
}

export interface ChatParticipant {
  id: string;
  conversationId: string;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
}

export interface ChatMessage {
  id: string;
  organizationId: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
}

// ==================== Invoices ====================
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';

export interface Invoice {
  id: string;
  organizationId: string;
  studentId: string;
  number: string;
  status: InvoiceStatus;
  subtotal: string;
  discount: string;
  penalty: string;
  total: string;
  paidAmount: string;
  refundedAmount?: string;
  currency?: string | null;
  dueDate?: string | null;
  issueDate?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  /** Present on GET /invoices/:id detail response. */
  remaining?: number;
  student?: Student;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
  refunds?: InvoiceRefund[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePayment {
  id: string;
  amount: string;
  status: string;
  method?: string | null;
  reference?: string | null;
  receiptNumber?: string | null;
  receiptIssuedAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface InvoiceRefund {
  id: string;
  amount: string;
  status: 'REQUESTED' | 'PROCESSED' | 'REJECTED';
  reason?: string | null;
  requestedBy: string;
  processedBy?: string | null;
  requestedAt: string;
  processedAt?: string | null;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

export interface InvoiceTotals {
  invoiced: number;
  paid: number;
  outstanding: number;
  refunded: number;
  totalOutstanding: number;
  totalPaid: number;
  totalOverdue: number;
  countByStatus: Record<InvoiceStatus, number>;
}

// ==================== Parent Portal ====================
export interface ParentChild {
  studentId: string;
  studentName: string;
  groups: { id: string; name: string }[];
  attendanceRate: number;
  averageGrade: number;
  pendingPayments: number;
  permissions?: Record<string, boolean>;
  student?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    status: string;
    balance: number;
    groups: { id: string; name: string }[];
    user: { firstName: string; lastName: string; avatar?: string };
  };
  relationship?: string;
}

export interface ParentAttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  groupName: string;
  note?: string | null;
  group?: { id: string; name: string };
  lesson?: { topic: string; startTime: string };
}

export interface ParentAttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
  byStatus?: Record<string, number>;
  total?: number;
  attendanceRate?: number;
}

export interface ParentGradesResponse {
  grades: { id: string; groupName: string; subject?: string; value: number; maxValue?: number; label?: string; date: string; group?: { name: string }; notes?: string }[];
  average: number;
  examResults?: { id: string; examTitle?: string; score: number; totalMarks?: number; date?: string; isPassed?: boolean; exam?: { title: string; examType: string; totalMarks: number } }[];
}

export interface ParentInvoicesResponse {
  invoices: Invoice[];
  totalOutstanding: number;
  outstanding?: number;
  overdue?: number;
  payments?: { id: string; amount: string; method?: string; reference?: string; paidAt?: string; createdAt: string }[];
}

// ==================== Payroll ====================
export type PayrollStatus = 'DRAFT' | 'CALCULATED' | 'REVIEWED' | 'APPROVED' | 'PAID' | 'CANCELLED';

export interface PayrollRun {
  id: string;
  organizationId: string;
  teacherId?: string | null;
  employeeId?: string | null;
  period: string;
  year: number;
  month: number;
  periodYear: number;
  periodMonth: number;
  salaryType?: string;
  status: PayrollStatus;
  baseSalary: string;
  adjustments: string;
  deductions: string;
  tax: string;
  grossAmount?: string;
  netPay: string;
  netAmount?: string;
  processedAt?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  teacher?: Teacher;
  employee?: Employee;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollPeriodSummary {
  year: number;
  month: number;
  totalTeachers: number;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalTax: number;
  totalNet: number;
  paid?: number;
  unpaid?: number;
  teachersCount?: number;
  status: PayrollStatus;
}

// ==================== Feature Flags ====================
export type FeatureFlagType = 'BOOLEAN' | 'PERCENTAGE' | 'LIST' | 'JSON';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: FeatureFlagType;
  enabled: boolean;
  value: unknown;
  /** Optional list of organizationIds for targeted rollout. */
  rolloutOrganizations?: string[];
  /** Optional percentage 0-100 (only for PERCENTAGE type). */
  rolloutPercentage?: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== System Health ====================
export type SystemHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export interface SystemHealthMetric {
  id: string;
  name: string;
  category: 'DATABASE' | 'API' | 'CACHE' | 'STORAGE' | 'EMAIL' | 'REALTIME' | 'JOBS';
  status: SystemHealthStatus;
  value: number;
  unit: string;
  threshold?: number;
  message?: string;
  lastCheckedAt: string;
  history: { timestamp: string; value: number; status: SystemHealthStatus }[];
}

export interface SystemHealthSummary {
  status: SystemHealthStatus;
  uptime: number;            // seconds
  uptimePct: number;         // 0-100
  totalMetrics: number;
  byStatus: Record<SystemHealthStatus, number>;
  metrics: SystemHealthMetric[];
  incidents: SystemHealthIncident[];
}

export interface SystemHealthIncident {
  id: string;
  metric: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  message: string;
  startedAt: string;
  resolvedAt?: string;
  duration?: number;
}

// ==================== Security Center ====================
export type SecurityAlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SecurityAlertStatus = 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export type SecurityEventType =
  | 'BRUTE_FORCE' | 'IMPOSSIBLE_TRAVEL' | 'NEW_DEVICE'
  | 'PRIVILEGE_ESCALATION' | 'SUSPICIOUS_IP'
  | 'MASS_EXPORT' | 'SQL_INJECTION_ATTEMPT' | 'XSS_ATTEMPT'
  | 'PATH_TRAVERSAL' | 'RATE_LIMIT_HIT' | 'OAUTH_FAILURE'
  | 'PASSWORD_RESET' | 'EMAIL_CHANGE' | 'MFA_DISABLED'
  | 'ROLE_CHANGED' | 'CUSTOM';

export interface SecurityAlert {
  id: string;
  organizationId: string;
  type: SecurityEventType;
  severity: SecurityAlertSeverity;
  status: SecurityAlertStatus;
  title: string;
  message: string;
  actorId?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface SecuritySummary {
  total: number;
  byStatus: Record<SecurityAlertStatus, number>;
  bySeverity: Record<SecurityAlertSeverity, number>;
  byType: Record<SecurityEventType, number>;
  detectedThisWeek: number;
  resolvedThisWeek: number;
  riskScore: number;       // 0-100
  lastIncidentAt?: string;
}

export interface ActiveSession {
  id: string;
  userId: string;
  userName: string;
  ipAddress: string;
  userAgent: string;
  device?: string;
  location?: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

// ==================== Notifications (expanded) ====================
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
export type NotificationCategory =
  | 'ATTENDANCE' | 'PAYMENT' | 'GRADE' | 'EXAM' | 'ENROLLMENT'
  | 'WORKFLOW' | 'SYSTEM' | 'SECURITY' | 'MESSAGE' | 'OTHER';

export interface NotificationExpanded {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  type: string;
  isRead: boolean;
  readAt?: string | null;
  /** Link to navigate to when clicked. */
  href?: string | null;
  /** Related entity for grouping. */
  entityType?: AuditEntityType;
  entityId?: string;
  createdAt: string;
}
