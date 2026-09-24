import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from '../organizations.controller';
import { OrganizationsService } from '../organizations.service';
import { UpdateOrganizationDto } from '../dto/update-organization.dto';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let service: {
    getOrganization: ReturnType<typeof vi.fn>;
    updateOrganization: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      getOrganization: vi.fn(),
      updateOrganization: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        {
          provide: OrganizationsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOrganization', () => {
    it('should delegate to service.getOrganization with current orgId', async () => {
      const mockOrg = { id: 'org-123', name: 'Test Org' };
      service.getOrganization.mockResolvedValue(mockOrg);

      const result = await controller.getOrganization('org-123');
      expect(result).toEqual(mockOrg);
      expect(service.getOrganization).toHaveBeenCalledWith('org-123');
    });
  });

  describe('updateOrganization', () => {
    it('should delegate to service.updateOrganization with orgId and dto', async () => {
      const dto: UpdateOrganizationDto = { name: 'Updated Org', email: 'org@test.uz' };
      const updatedOrg = { id: 'org-123', name: 'Updated Org', email: 'org@test.uz' };
      service.updateOrganization.mockResolvedValue(updatedOrg);

      const result = await controller.updateOrganization('org-123', dto);
      expect(result).toEqual(updatedOrg);
      expect(service.updateOrganization).toHaveBeenCalledWith('org-123', dto);
    });
  });
});
