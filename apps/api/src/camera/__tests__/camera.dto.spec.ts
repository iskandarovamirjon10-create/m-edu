import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CameraProtocol,
  RtspTransport,
  CreateCameraApiDto,
  UpdateCameraApiDto,
  TestCameraConnectionApiDto,
  DiscoverCamerasApiDto,
  CameraQueryApiDto,
  UpdateCameraConfigDto,
} from '../dto/camera.dto';

describe('Camera DTOs', () => {
  describe('CreateCameraApiDto', () => {
    it('should validate valid CreateCameraApiDto', async () => {
      const plain = {
        name: 'Main Gate Camera',
        vendor: 'Hikvision',
        model: 'DS-2CD',
        protocol: CameraProtocol.RTSP,
        host: '192.168.1.100',
        port: 554,
        username: 'admin',
        password: 'password123',
        streamPath: '/live/ch0',
        rtspTransport: RtspTransport.TCP,
        location: 'Main Gate',
        processingFps: 3,
        enabled: true,
        recognitionEnabled: true,
        attendanceEnabled: true,
      };

      const dto = plainToInstance(CreateCameraApiDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when name is empty', async () => {
      const plain = {
        name: '',
        host: '192.168.1.1',
      };

      const dto = plainToInstance(CreateCameraApiDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'name')).toBe(true);
    });

    it('should fail with invalid host', async () => {
      const plain = {
        name: 'Camera 1',
        host: 'not an ip or host!',
      };

      const dto = plainToInstance(CreateCameraApiDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'host')).toBe(true);
    });

    it('should fail with out of bounds port', async () => {
      const plain = {
        name: 'Camera 1',
        host: '192.168.1.1',
        port: 70000,
      };

      const dto = plainToInstance(CreateCameraApiDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'port')).toBe(true);
    });
  });

  describe('UpdateCameraApiDto', () => {
    it('should validate partial update', async () => {
      const plain = {
        name: 'Updated Name',
        processingFps: 5,
      };

      const dto = plainToInstance(UpdateCameraApiDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('TestCameraConnectionApiDto', () => {
    it('should validate valid connection test params', async () => {
      const plain = {
        host: '10.0.0.10',
        port: 554,
        protocol: CameraProtocol.RTSP,
      };

      const dto = plainToInstance(TestCameraConnectionApiDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('DiscoverCamerasApiDto', () => {
    it('should validate discovery with valid timeout', async () => {
      const plain = {
        timeoutMs: 5000,
        subnet: '192.168.1.0/24',
      };

      const dto = plainToInstance(DiscoverCamerasApiDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when timeout is less than 1000ms', async () => {
      const plain = {
        timeoutMs: 500,
      };

      const dto = plainToInstance(DiscoverCamerasApiDto, plain);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'timeoutMs')).toBe(true);
    });
  });

  describe('CameraQueryApiDto', () => {
    it('should validate query params', async () => {
      const plain = {
        page: 1,
        limit: 20,
        enabled: true,
        search: 'entrance',
      };

      const dto = plainToInstance(CameraQueryApiDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('UpdateCameraConfigDto', () => {
    it('should validate config updates', async () => {
      const plain = {
        processingFps: 10,
        recognitionEnabled: false,
        attendanceEnabled: true,
      };

      const dto = plainToInstance(UpdateCameraConfigDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
