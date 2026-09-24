import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  UploadDocumentVersionDto,
  DocumentQueryDto,
} from '../dto/document.dto';

describe('Document DTOs', () => {
  describe('CreateDocumentDto', () => {
    it('validates a valid create payload', async () => {
      const dto = plainToInstance(CreateDocumentDto, {
        title: 'Student Handbook',
        description: 'Official school handbook',
        category: 'POLICY',
        fileUrl: 'https://storage.medu.uz/docs/handbook.pdf',
        mimeType: 'application/pdf',
        fileSize: 1048576,
        tags: ['handbook', 'rules'],
        relatedEntityType: 'STUDENT',
        relatedEntityId: '123',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects missing required fields (title, fileUrl)', async () => {
      const dto = plainToInstance(CreateDocumentDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(2);
      const props = errors.map((e) => e.property);
      expect(props).toContain('title');
      expect(props).toContain('fileUrl');
    });

    it('rejects negative fileSize', async () => {
      const dto = plainToInstance(CreateDocumentDto, {
        title: 'Handbook',
        fileUrl: 'https://example.com/doc.pdf',
        fileSize: -10,
      });
      const errors = await validate(dto);
      const sizeErr = errors.find((e) => e.property === 'fileSize');
      expect(sizeErr).toBeDefined();
    });
  });

  describe('UpdateDocumentDto', () => {
    it('allows partial update fields', async () => {
      const dto = plainToInstance(UpdateDocumentDto, {
        title: 'Updated Title',
        isActive: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('UploadDocumentVersionDto', () => {
    it('validates version payload', async () => {
      const dto = plainToInstance(UploadDocumentVersionDto, {
        fileUrl: 'https://example.com/v2.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        note: 'Version 2 with revisions',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects empty fileUrl', async () => {
      const dto = plainToInstance(UploadDocumentVersionDto, {
        fileUrl: '',
      });
      const errors = await validate(dto);
      const urlErr = errors.find((e) => e.property === 'fileUrl');
      expect(urlErr).toBeDefined();
    });
  });

  describe('DocumentQueryDto', () => {
    it('transforms and validates numeric pagination', async () => {
      const dto = plainToInstance(DocumentQueryDto, {
        page: '2',
        limit: '25',
        search: 'handbook',
        category: 'POLICY',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(25);
    });

    it('rejects non-positive page', async () => {
      const dto = plainToInstance(DocumentQueryDto, {
        page: '0',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
