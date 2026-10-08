/**
 * Domain events that drive the notification pipeline (37-Phase Report §21:
 * Event → Rule → Channel → Delivery). Emitted by services on state changes,
 * delivered to BullMQ by NotificationEventService, consumed by the worker.
 *
 * Events are data-only and versioned: adding fields is backwards compatible,
 * renaming or removing requires a new version bump of the payload contract.
 */

export const NOTIFICATION_EVENTS_QUEUE = 'notification-events';
/** Distinct dead-letter queue — must never be the source queue (avoids infinite retry loop). */
export const NOTIFICATION_EVENTS_DLQ = 'notification-events-dlq';

export type NotificationEventType =
  | 'ATTENDANCE_MARKED_PRESENT'
  | 'ATTENDANCE_MARKED_ABSENT'
  | 'ATTENDANCE_MARKED_LATE'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_REMINDER'
  | 'INVOICE_ISSUED'
  | 'LEAD_CONVERTED'
  | 'LESSON_CANCELLED'
  | 'FOLLOWUP_DUE';

export interface NotificationEventPayload {
  organizationId: string;
  type: NotificationEventType;
  /** ISO timestamp of the originating business change. */
  occurredAt: string;
  /** Primary entity reference for deep-linking. */
  entityType: string;
  entityId: string;
  /** Denormalized context so the worker needs no extra reads for rendering. */
  data: {
    /** Student display name + contact channels, when the event concerns one. */
    studentId?: string;
    studentName?: string;
    userId?: string;
    parentPhone?: string;
    parentEmail?: string;
    date?: string;
    amount?: number;
    [key: string]: unknown;
  };
}

/** Delivery channels, in priority order per user preference. */
export type NotificationChannel = 'IN_APP' | 'SMS' | 'TELEGRAM' | 'EMAIL' | 'PUSH';

export interface ChannelDeliveryResult {
  channel: NotificationChannel;
  ok: boolean;
  error?: string;
}
