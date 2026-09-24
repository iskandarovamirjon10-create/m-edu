import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ExamType } from '@prisma/client';
import {
  CreateExamDto,
  UpdateExamDto,
  PublishExamDto,
  CreateExamResultDto,
} from '../dto/exam.dto';

describe('Exam DTOs', () => {
  describe('CreateExamDto', () => {
    it('validates a correct payload', async () => {
      const dto = plainToInstance(CreateExamDto, {
        groupId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        subject: 'Mathematics',
        title: 'Midterm Exam',
        examDate: '2026-10-01T09:00:00Z',
        duration: 90,
        totalMarks: 100,
        passingMarks: 60,
        examType: ExamType.MIDTERM,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid uuid for groupId', async () => {
      const dto = plainToInstance(CreateExamDto, {
        groupId: 'invalid-id',
        subject: 'Math',
        title: 'Exam',
        examDate: '2026-10-01T09:00:00Z',
        duration: 90,
        totalMarks: 100,
        passingMarks: 60,
        examType: ExamType.MIDTERM,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('groupId');
    });

    it('rejects non-positive duration', async () => {
      const dto = plainToInstance(CreateExamDto, {
        groupId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        subject: 'Math',
        title: 'Exam',
        examDate: '2026-10-01T09:00:00Z',
        duration: 0,
        totalMarks: 100,
        passingMarks: 60,
        examType: ExamType.FINAL,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('duration');
    });
  });

  describe('UpdateExamDto', () => {
    it('validates partial update', async () => {
      const dto = plainToInstance(UpdateExamDto, {
        title: 'Updated Title',
        totalMarks: 120,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('PublishExamDto', () => {
    it('validates boolean flag', async () => {
      const dto = plainToInstance(PublishExamDto, {
        isPublished: true,
        force: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('CreateExamResultDto', () => {
    it('validates marks and studentId', async () => {
      const dto = plainToInstance(CreateExamResultDto, {
        studentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        marksObtained: 85,
        notes: 'Great work',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects negative marks', async () => {
      const dto = plainToInstance(CreateExamResultDto, {
        studentId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        marksObtained: -5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('marksObtained');
    });
  });
});
