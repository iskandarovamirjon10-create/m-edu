import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
} from '../dto/feature-flag.dto';

describe('FeatureFlag DTOs', () => {
  describe('CreateFeatureFlagDto', () => {
    it('validates a valid flag create payload', async () => {
      const dto = plainToInstance(CreateFeatureFlagDto, {
        key: 'ai-tutor-v2',
        name: 'AI Tutor V2 Beta',
        description: 'New model rollout',
        enabled: true,
        rolloutPercentage: 50,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects missing key or name', async () => {
      const dto = plainToInstance(CreateFeatureFlagDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      const props = errors.map((e) => e.property);
      expect(props).toContain('key');
      expect(props).toContain('name');
    });

    it('rejects rollout percentage > 100 or < 0', async () => {
      const dto1 = plainToInstance(CreateFeatureFlagDto, {
        key: 'k',
        name: 'n',
        rolloutPercentage: 150,
      });
      const errors1 = await validate(dto1);
      expect(errors1.length).toBeGreaterThan(0);

      const dto2 = plainToInstance(CreateFeatureFlagDto, {
        key: 'k',
        name: 'n',
        rolloutPercentage: -5,
      });
      const errors2 = await validate(dto2);
      expect(errors2.length).toBeGreaterThan(0);
    });
  });

  describe('UpdateFeatureFlagDto', () => {
    it('validates partial update', async () => {
      const dto = plainToInstance(UpdateFeatureFlagDto, {
        enabled: false,
        rolloutPercentage: 25,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
