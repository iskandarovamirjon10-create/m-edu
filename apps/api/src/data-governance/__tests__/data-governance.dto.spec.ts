import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpsertRetentionPolicyDto } from '../dto/data-governance.dto';

describe('DataGovernance DTOs Validation', () => {
  it('validates valid UpsertRetentionPolicyDto', async () => {
    const dto = plainToInstance(UpsertRetentionPolicyDto, {
      dataType: 'STUDENT_RECORDS',
      retentionDays: 365,
      archivalDays: 180,
      deleteAfterDays: 730,
      isActive: true,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('fails when retentionDays is less than 30', async () => {
    const dto = plainToInstance(UpsertRetentionPolicyDto, {
      dataType: 'STUDENT_RECORDS',
      retentionDays: 10,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0].property).toBe('retentionDays');
  });

  it('fails when retentionDays exceeds 3650', async () => {
    const dto = plainToInstance(UpsertRetentionPolicyDto, {
      dataType: 'STUDENT_RECORDS',
      retentionDays: 5000,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0].property).toBe('retentionDays');
  });
});
