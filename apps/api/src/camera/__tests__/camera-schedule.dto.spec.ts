import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CameraScheduleDay,
  CreateCameraScheduleDto,
  UpdateCameraScheduleDto,
} from '../dto/camera-schedule.dto';

describe('CameraSchedule DTOs', () => {
  describe('CreateCameraScheduleDto', () => {
    it('should pass validation with valid data', async () => {
      const plain = {
        name: 'Morning Schedule',
        dayOfWeek: CameraScheduleDay.MONDAY,
        startTime: '08:00',
        endTime: '09:30',
        isActive: true,
        processingFps: 5,
        recognitionEnabled: true,
        attendanceEnabled: true,
      };

      const dto = plainToInstance(CreateCameraScheduleDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when endTime <= startTime', async () => {
      const plain = {
        name: 'Invalid Schedule',
        dayOfWeek: CameraScheduleDay.TUESDAY,
        startTime: '10:00',
        endTime: '09:00',
      };

      const dto = plainToInstance(CreateCameraScheduleDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'startTime')).toBe(true);
    });

    it('should fail with invalid time format', async () => {
      const plain = {
        name: 'Bad Time',
        dayOfWeek: CameraScheduleDay.FRIDAY,
        startTime: '25:99',
        endTime: '12:00',
      };

      const dto = plainToInstance(CreateCameraScheduleDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'startTime')).toBe(true);
    });

    it('should fail with out of bounds processingFps', async () => {
      const plain = {
        dayOfWeek: CameraScheduleDay.WEDNESDAY,
        startTime: '08:00',
        endTime: '09:00',
        processingFps: 100, // max is 30
      };

      const dto = plainToInstance(CreateCameraScheduleDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'processingFps')).toBe(true);
    });
  });

  describe('UpdateCameraScheduleDto', () => {
    it('should pass validation with partial valid update', async () => {
      const plain = {
        name: 'Updated Schedule',
        processingFps: 10,
      };

      const dto = plainToInstance(UpdateCameraScheduleDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
