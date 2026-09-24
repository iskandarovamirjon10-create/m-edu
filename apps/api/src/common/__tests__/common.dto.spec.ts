import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateStudentDto,
  CreateTeacherDto,
  CreateCourseDto,
  CreatePaymentDto,
  CreateExpenseDto,
  ChangePasswordDto,
} from '../dto/index';

describe('Common DTOs Validation & Transformation', () => {
  describe('CreateStudentDto', () => {
    it('should strip HTML tags from firstName and lastName', async () => {
      const dto = plainToInstance(CreateStudentDto, {
        firstName: '<script>alert("xss")</script>Ali',
        lastName: '<b>Valiyev</b>',
        email: 'ali@example.com',
      });

      expect(dto.firstName).toBe('alert("xss")Ali');
      expect(dto.lastName).toBe('Valiyev');

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when firstName is empty', async () => {
      const dto = plainToInstance(CreateStudentDto, {
        firstName: '',
        lastName: 'Valiyev',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].property).toBe('firstName');
    });

    it('should validate gender enum', async () => {
      const dto = plainToInstance(CreateStudentDto, {
        firstName: 'Ali',
        lastName: 'Valiyev',
        gender: 'INVALID_GENDER',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('gender');
    });
  });

  describe('CreateTeacherDto', () => {
    it('should strip HTML and validate hourlyRate', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        firstName: 'Jasur',
        lastName: 'Karimov',
        hourlyRate: 50,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when hourlyRate is negative', async () => {
      const dto = plainToInstance(CreateTeacherDto, {
        firstName: 'Jasur',
        lastName: 'Karimov',
        hourlyRate: -10,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('hourlyRate');
    });
  });

  describe('CreateCourseDto', () => {
    it('should validate valid course payload', async () => {
      const dto = plainToInstance(CreateCourseDto, {
        name: 'Fullstack Web Development',
        price: 1500000,
        duration: 6,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when price is negative or duration is 0', async () => {
      const dto = plainToInstance(CreateCourseDto, {
        name: 'Invalid Course',
        price: -100,
        duration: 0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(2);
    });
  });

  describe('CreatePaymentDto', () => {
    it('should validate valid payment', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        studentId: '11111111-1111-4111-8111-111111111111',
        amount: 250000,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when amount is 0 or negative', async () => {
      const dto = plainToInstance(CreatePaymentDto, {
        studentId: '11111111-1111-4111-8111-111111111111',
        amount: 0,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('amount');
    });
  });

  describe('CreateExpenseDto', () => {
    it('should validate valid category and date', async () => {
      const dto = plainToInstance(CreateExpenseDto, {
        category: 'UTILITIES',
        amount: 50000,
        date: '2026-09-18T10:00:00Z',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail on invalid category', async () => {
      const dto = plainToInstance(CreateExpenseDto, {
        category: 'GAMBLING',
        amount: 50000,
        date: '2026-09-18T10:00:00Z',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('category');
    });
  });

  describe('ChangePasswordDto', () => {
    it('should validate valid password length', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'oldPassword123',
        newPassword: 'newSecurePassword456',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if newPassword is too short', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'oldPassword123',
        newPassword: 'short',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('newPassword');
    });
  });
});
