import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const NOTIFICATION_CATEGORIES = [
  { key: 'ATTENDANCE', label: 'Attendance' },
  { key: 'PAYMENT', label: 'Payments' },
  { key: 'DEBT', label: 'Debt Alerts' },
  { key: 'ACADEMIC', label: 'Academic' },
  { key: 'CRM', label: 'CRM' },
  { key: 'SYSTEM', label: 'System' },
  { key: 'HOMEWORK', label: 'Homework' },
  { key: 'EVENT', label: 'Events' },
] as const;

export interface NotificationPreferenceResponse {
  category: string;
  label: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

export interface UpdatePreferenceDto {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
}

export interface BulkUpdatePreferenceDto extends UpdatePreferenceDto {
  category: string;
}

@Injectable()
export class NotificationPreferenceService {
  constructor(private prisma: PrismaService) {}

  async getPreferences(userId: string): Promise<NotificationPreferenceResponse[]> {
    const existing = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    return NOTIFICATION_CATEGORIES.map(cat => {
      const pref = existing.find(e => e.category === cat.key);
      return {
        category: cat.key,
        label: cat.label,
        emailEnabled: pref?.emailEnabled ?? true,
        smsEnabled: pref?.smsEnabled ?? false,
        pushEnabled: pref?.pushEnabled ?? true,
        inAppEnabled: pref?.inAppEnabled ?? true,
      };
    });
  }

  async updatePreference(
    userId: string,
    category: string,
    updates: UpdatePreferenceDto,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_category: { userId, category } },
      update: updates,
      create: { userId, category, ...updates },
    });
  }

  async bulkUpdatePreferences(
    userId: string,
    preferences: BulkUpdatePreferenceDto[],
  ) {
    // Each preference upserts a distinct (userId, category) unique key, so the
    // writes are independent — run them concurrently instead of serially.
    return Promise.all(
      preferences.map(pref => {
        const { category, ...updates } = pref;
        return this.updatePreference(userId, category, updates);
      }),
    );
  }

  async getCategories() {
    return NOTIFICATION_CATEGORIES;
  }
}
