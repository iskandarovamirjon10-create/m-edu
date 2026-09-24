import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RelationshipsController } from '../relationships.controller';
import { RelationshipsService, type GraphResult } from '../relationships.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { ROLES_KEY } from '../../auth/roles.decorator';

describe('RelationshipsController', () => {
  let controller: RelationshipsController;
  let service: {
    getGraph: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-1';

  beforeEach(async () => {
    service = {
      getGraph: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelationshipsController],
      providers: [
        {
          provide: RelationshipsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<RelationshipsController>(RelationshipsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getGraph', () => {
    const mockGraphResult: GraphResult = {
      nodes: [
        { id: 's-1', label: 'Ali Valiyev', type: 'STUDENT', subLabel: 's-1' },
        { id: 'g-1', label: 'Math Group', type: 'GROUP' },
      ],
      edges: [
        { from: 's-1', to: 'g-1', label: 'enrolled in', type: 'ENROLLMENT' },
      ],
      rootType: 'STUDENT',
      rootId: 's-1',
    };

    it('delegates to service.getGraph with default depth of 2 when depth is undefined', async () => {
      service.getGraph.mockResolvedValue(mockGraphResult);

      const result = await controller.getGraph(orgId, 'STUDENT', 's-1');

      expect(result).toEqual(mockGraphResult);
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'STUDENT', 's-1', 2);
    });

    it('delegates to service.getGraph with parsed depth when valid depth is provided', async () => {
      service.getGraph.mockResolvedValue(mockGraphResult);

      const result = await controller.getGraph(orgId, 'STUDENT', 's-1', '3');

      expect(result).toEqual(mockGraphResult);
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'STUDENT', 's-1', 3);
    });

    it('clamps depth to minimum of 1 when depth is less than 1', async () => {
      service.getGraph.mockResolvedValue(mockGraphResult);

      await controller.getGraph(orgId, 'STUDENT', 's-1', '0');
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'STUDENT', 's-1', 1);

      await controller.getGraph(orgId, 'STUDENT', 's-1', '-5');
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'STUDENT', 's-1', 1);
    });

    it('clamps depth to maximum of 5 when depth is greater than 5', async () => {
      service.getGraph.mockResolvedValue(mockGraphResult);

      await controller.getGraph(orgId, 'STUDENT', 's-1', '6');
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'STUDENT', 's-1', 5);

      await controller.getGraph(orgId, 'STUDENT', 's-1', '100');
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'STUDENT', 's-1', 5);
    });

    it('handles boundary depths 1 and 5 correctly', async () => {
      service.getGraph.mockResolvedValue(mockGraphResult);

      await controller.getGraph(orgId, 'TEACHER', 't-1', '1');
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'TEACHER', 't-1', 1);

      await controller.getGraph(orgId, 'TEACHER', 't-1', '5');
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'TEACHER', 't-1', 5);
    });

    it('defaults depth to 2 when depth string is not a valid number (NaN)', async () => {
      service.getGraph.mockResolvedValue(mockGraphResult);

      const result = await controller.getGraph(orgId, 'COURSE', 'c-1', 'invalid');

      expect(result).toEqual(mockGraphResult);
      expect(service.getGraph).toHaveBeenCalledWith(orgId, 'COURSE', 'c-1', 2);
    });

    it('propagates errors thrown by relationshipsService.getGraph', async () => {
      service.getGraph.mockRejectedValue(new Error('Student not found: s-missing'));

      await expect(
        controller.getGraph(orgId, 'STUDENT', 's-missing', '2'),
      ).rejects.toThrow('Student not found: s-missing');
    });
  });

  describe('Guards and Decorators verification', () => {
    it('has UseGuards applied at the class level with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', RelationshipsController);
      expect(guards).toBeDefined();
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('restricts the class to admin roles (no AllowAnyRole escape hatch)', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, RelationshipsController) as string[] | undefined;
      expect(roles).toBeDefined();
      expect(roles).toContain('ORG_ADMIN');
      expect(roles).toContain('SUPER_ADMIN');
    });
  });
});
