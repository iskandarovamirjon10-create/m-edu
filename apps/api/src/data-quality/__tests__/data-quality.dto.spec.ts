import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DataQualityQueryDto, ResolveIssueDto } from '../dto/data-quality.dto';

describe('DataQuality DTOs Validation', () => {
  describe('DataQualityQueryDto', () => {
    it('validates valid query', async () => {
      const dto = plainToInstance(DataQualityQueryDto, {
        severity: 'HIGH',
        entityType: 'STUDENT',
        resolved: 'false',
        limit: 25,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when severity is invalid', async () => {
      const dto = plainToInstance(DataQualityQueryDto, {
        severity: 'EXTREME',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('severity');
    });

    it('fails when limit exceeds 100', async () => {
      const dto = plainToInstance(DataQualityQueryDto, {
        limit: 150,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('limit');
    });
  });

  describe('ResolveIssueDto', () => {
    it('validates valid note', async () => {
      const dto = plainToInstance(ResolveIssueDto, {
        note: 'Email updated in student profile',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
