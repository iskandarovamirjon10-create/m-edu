import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  ResolveEarlyWarningDto,
  EarlyWarningQueryDto,
} from '../dto/early-warning.dto';

describe('EarlyWarning DTOs', () => {
  describe('ResolveEarlyWarningDto', () => {
    it('validates valid note', async () => {
      const dto = plainToInstance(ResolveEarlyWarningDto, {
        note: 'Resolved after student counseling',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects overly long note (>1000 chars)', async () => {
      const dto = plainToInstance(ResolveEarlyWarningDto, {
        note: 'a'.repeat(1001),
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('note');
    });
  });

  describe('EarlyWarningQueryDto', () => {
    it('transforms and validates pagination and severity', async () => {
      const dto = plainToInstance(EarlyWarningQueryDto, {
        page: '2',
        limit: '50',
        severity: 'HIGH',
        ruleId: 'attendance-low',
        entityType: 'STUDENT',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(50);
      expect(dto.severity).toBe('HIGH');
    });

    it('rejects invalid severity', async () => {
      const dto = plainToInstance(EarlyWarningQueryDto, {
        severity: 'UNKNOWN_SEVERITY',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('severity');
    });

    it('rejects non-positive page', async () => {
      const dto = plainToInstance(EarlyWarningQueryDto, {
        page: -1,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
