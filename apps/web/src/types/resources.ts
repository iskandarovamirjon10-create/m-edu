/**
 * Physical resource, room scheduling, and equipment booking domain models.
 */

import type { DayOfWeek } from './academics';

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
