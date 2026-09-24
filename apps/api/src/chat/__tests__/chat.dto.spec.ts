import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CreateConversationDto,
  SendMessageDto,
  TypingDto,
  MarkReadDto,
} from '../dto/chat.dto';

describe('Chat DTOs Validation', () => {
  describe('CreateConversationDto', () => {
    it('should validate valid payload', async () => {
      const dto = plainToInstance(CreateConversationDto, {
        title: 'Project Discussion',
        type: 'GROUP',
        participantIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when participantIds is empty', async () => {
      const dto = plainToInstance(CreateConversationDto, {
        participantIds: [],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].property).toBe('participantIds');
    });

    it('should fail when participantId is not a UUID', async () => {
      const dto = plainToInstance(CreateConversationDto, {
        participantIds: ['invalid-id'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('participantIds');
    });

    it('should fail when title exceeds 200 characters', async () => {
      const dto = plainToInstance(CreateConversationDto, {
        title: 'a'.repeat(201),
        participantIds: ['11111111-1111-4111-8111-111111111111'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('title');
    });
  });

  describe('SendMessageDto', () => {
    it('should validate valid payload', async () => {
      const dto = plainToInstance(SendMessageDto, {
        conversationId: '11111111-1111-4111-8111-111111111111',
        message: 'Hello, world!',
        attachmentUrl: 'https://example.com/file.pdf',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when conversationId is invalid UUID', async () => {
      const dto = plainToInstance(SendMessageDto, {
        conversationId: 'not-uuid',
        message: 'Hello',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('conversationId');
    });

    it('should fail when message is empty or exceeds limit', async () => {
      const dtoEmpty = plainToInstance(SendMessageDto, {
        conversationId: '11111111-1111-4111-8111-111111111111',
        message: '',
      });
      const errorsEmpty = await validate(dtoEmpty);
      expect(errorsEmpty.length).toBeGreaterThanOrEqual(1);

      const dtoLong = plainToInstance(SendMessageDto, {
        conversationId: '11111111-1111-4111-8111-111111111111',
        message: 'a'.repeat(5001),
      });
      const errorsLong = await validate(dtoLong);
      expect(errorsLong.length).toBe(1);
      expect(errorsLong[0].property).toBe('message');
    });
  });

  describe('TypingDto', () => {
    it('should validate valid typing signal', async () => {
      const dto = plainToInstance(TypingDto, {
        conversationId: '11111111-1111-4111-8111-111111111111',
        isTyping: true,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when isTyping is not boolean', async () => {
      const dto = plainToInstance(TypingDto, {
        conversationId: '11111111-1111-4111-8111-111111111111',
        isTyping: 'yes',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('isTyping');
    });
  });

  describe('MarkReadDto', () => {
    it('should validate valid conversationId', async () => {
      const dto = plainToInstance(MarkReadDto, {
        conversationId: '11111111-1111-4111-8111-111111111111',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when conversationId is invalid', async () => {
      const dto = plainToInstance(MarkReadDto, {
        conversationId: 'not-uuid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0].property).toBe('conversationId');
    });
  });
});
