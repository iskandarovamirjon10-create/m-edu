/**
 * Platform feature flag domain models.
 */

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
