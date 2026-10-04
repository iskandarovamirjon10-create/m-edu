/**
 * Internal staff and communication chat domain models.
 */

import type { User } from './auth';

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
