import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DocumentsController } from '../documents.controller';
import { DocumentsService } from '../documents.service';
import type { RequestUser } from '../../auth/types';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: {
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    uploadVersion: ReturnType<typeof vi.fn>;
  };

  const mockUser: RequestUser = {
    sub: 'u-1',
    email: 'test@example.com',
    role: 'ORG_ADMIN',
    organizationId: 'org-1',
    sid: null,
  };

  beforeEach(() => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      uploadVersion: vi.fn(),
    };
    controller = new DocumentsController(service as unknown as DocumentsService);
  });

  describe('findAll', () => {
    it('calls service.findAll with orgId and query', async () => {
      service.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      const res = await controller.findAll(mockUser, { page: 1, limit: 20 });
      expect(service.findAll).toHaveBeenCalledWith(mockUser, { page: 1, limit: 20 });
      expect(res.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns document when found', async () => {
      service.findOne.mockResolvedValue({ id: 'd-1', title: 'Doc 1' });
      const res = await controller.findOne(mockUser, 'd-1');
      expect(service.findOne).toHaveBeenCalledWith(mockUser, 'd-1');
      expect(res.id).toBe('d-1');
    });

    it('throws NotFoundException when document does not exist', async () => {
      service.findOne.mockResolvedValue(null);
      await expect(controller.findOne(mockUser, 'd-missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates document with uploadedBy from user.sub', async () => {
      service.create.mockResolvedValue({ id: 'd-new', title: 'New' });
      const res = await controller.create(mockUser, {
        title: 'New',
        fileUrl: 'https://cdn.example.com/new.pdf',
      });
      expect(service.create).toHaveBeenCalledWith('org-1', {
        title: 'New',
        fileUrl: 'https://cdn.example.com/new.pdf',
        uploadedBy: 'u-1',
      });
      expect(res.id).toBe('d-new');
    });
  });

  describe('update', () => {
    it('updates document when found', async () => {
      service.update.mockResolvedValue({ id: 'd-1', title: 'Updated' });
      const res = await controller.update('org-1', 'd-1', { title: 'Updated' });
      expect(service.update).toHaveBeenCalledWith('org-1', 'd-1', { title: 'Updated' });
      expect(res.title).toBe('Updated');
    });

    it('throws NotFoundException when update returns null', async () => {
      service.update.mockResolvedValue(null);
      await expect(controller.update('org-1', 'd-1', { title: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('deletes document and returns success', async () => {
      service.delete.mockResolvedValue({ id: 'd-1' });
      const res = await controller.delete('org-1', 'd-1');
      expect(service.delete).toHaveBeenCalledWith('org-1', 'd-1');
      expect(res).toEqual({ id: 'd-1' });
    });

    it('throws NotFoundException when delete returns null', async () => {
      service.delete.mockResolvedValue(null);
      await expect(controller.delete('org-1', 'd-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadVersion', () => {
    it('uploads version and sets uploadedBy', async () => {
      service.uploadVersion.mockResolvedValue({ id: 'v-2', version: 2 });
      const res = await controller.uploadVersion(mockUser, 'd-1', {
        fileUrl: 'https://cdn.example.com/v2.pdf',
      });
      expect(service.uploadVersion).toHaveBeenCalledWith('org-1', 'd-1', {
        fileUrl: 'https://cdn.example.com/v2.pdf',
        uploadedBy: 'u-1',
      });
      expect(res.version).toBe(2);
    });

    it('throws NotFoundException when uploadVersion returns null', async () => {
      service.uploadVersion.mockResolvedValue(null);
      await expect(
        controller.uploadVersion(mockUser, 'd-1', {
          fileUrl: 'https://cdn.example.com/v2.pdf',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
