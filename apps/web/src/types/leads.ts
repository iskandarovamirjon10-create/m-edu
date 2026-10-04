/**
 * CRM, leads and prospect management domain models.
 */

export type LeadStage = 'NEW' | 'CONTACTED' | 'TRIAL_LESSON' | 'WON' | 'LOST';

export type LeadActivityType =
  | 'CALL'
  | 'MESSAGE'
  | 'MEETING'
  | 'REMINDER'
  | 'TASK'
  | 'NOTE';

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
