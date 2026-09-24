import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBranchDto, UpdateBranchDto, AssignManagerDto } from '../dto/branch.dto';

describe('Branch DTOs', () => {
  describe('CreateBranchDto', () => {
    it('should validate valid CreateBranchDto and sanitize HTML in name', async () => {
      const plain = {
        name: '<b>Downtown Campus</b>',
        code: 'DT-1',
        address: '123 Main St',
        phone: '+1234567890',
        email: 'branch@example.com',
        timezone: 'UTC',
        currency: 'USD',
      };

      const dto = plainToInstance(CreateBranchDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
      expect(dto.name).toBe('Downtown Campus');
    });

    it('should fail when name is empty', async () => {
      const plain = {
        name: '',
      };

      const dto = plainToInstance(CreateBranchDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('should fail when email is invalid', async () => {
      const plain = {
        name: 'Valid Name',
        email: 'not-an-email',
      };

      const dto = plainToInstance(CreateBranchDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });
  });

  describe('UpdateBranchDto', () => {
    it('should validate valid partial update', async () => {
      const plain = {
        name: 'Updated Campus',
        isActive: false,
      };

      const dto = plainToInstance(UpdateBranchDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('AssignManagerDto', () => {
    it('should validate valid UUID for managerId', async () => {
      const plain = {
        managerId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      };

      const dto = plainToInstance(AssignManagerDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should fail when managerId is not a UUID', async () => {
      const plain = {
        managerId: 'invalid-id-not-uuid',
      };

      const dto = plainToInstance(AssignManagerDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'managerId')).toBe(true);
    });
  });
});
