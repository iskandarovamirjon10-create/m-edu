import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CameraZoneType,
  CreateCameraZoneDto,
  UpdateCameraZoneDto,
} from '../dto/camera-zone.dto';

describe('CameraZone DTOs', () => {
  describe('CreateCameraZoneDto', () => {
    it('should validate valid CreateCameraZoneDto', async () => {
      const plain = {
        name: 'Entrance Zone',
        type: CameraZoneType.ENTRANCE,
        x: 100,
        y: 200,
        width: 400,
        height: 300,
        isActive: true,
      };

      const dto = plainToInstance(CreateCameraZoneDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when coordinates are negative', async () => {
      const plain = {
        name: 'Negative Zone',
        x: -10,
        y: 20,
      };

      const dto = plainToInstance(CreateCameraZoneDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'x')).toBe(true);
    });

    it('should fail when width or height is less than 1', async () => {
      const plain = {
        width: 0,
        height: -5,
      };

      const dto = plainToInstance(CreateCameraZoneDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'width')).toBe(true);
      expect(errors.some((e) => e.property === 'height')).toBe(true);
    });

    it('should fail with invalid zone type enum', async () => {
      const plain = {
        type: 'invalid-zone-type',
      };

      const dto = plainToInstance(CreateCameraZoneDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'type')).toBe(true);
    });
  });

  describe('UpdateCameraZoneDto', () => {
    it('should validate partial update', async () => {
      const plain = {
        name: 'Updated Zone',
        width: 500,
      };

      const dto = plainToInstance(UpdateCameraZoneDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
