import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ChatService } from '../chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateConversationDto, SendMessageDto } from '../dto/chat.dto';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    chatConversation: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    chatParticipant: {
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    chatMessage: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    user: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const orgId = 'org-1111-1111-1111-1111';
  const userId = 'user-1111-1111-1111-1111';

  beforeEach(async () => {
    prisma = {
      chatConversation: {
        create: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      chatParticipant: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      chatMessage: {
        create: vi.fn(),
        findMany: vi.fn(),
        groupBy: vi.fn(),
        updateMany: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
    };
    (prisma as any).$transaction = vi.fn().mockImplementation((arg: any) => {
      if (typeof arg === 'function') {
        return arg(prisma);
      }
      // Array-form transaction: resolve the actual query promises so the
      // caller sees the real mock results (not a hard-coded count).
      return Promise.all(arg);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('createConversation', () => {
    it('should create conversation with valid participants in the same organization', async () => {
      const otherUserId = 'user-2222-2222-2222-2222';
      const dto: CreateConversationDto = {
        title: 'Math Study Group',
        type: 'GROUP',
        participantIds: [otherUserId],
      };

      prisma.user.count.mockResolvedValue(2);

      const createdConversation = {
        id: 'conv-1',
        organizationId: orgId,
        title: 'Math Study Group',
        type: 'GROUP',
        createdBy: userId,
        participants: [{ userId: otherUserId }, { userId }],
      };

      prisma.chatConversation.create.mockResolvedValue(createdConversation);

      const result = await service.createConversation(orgId, userId, dto);

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          id: { in: expect.arrayContaining([otherUserId, userId]) },
          organizationId: orgId,
        },
      });
      expect(prisma.chatConversation.create).toHaveBeenCalled();
      expect(result).toEqual(createdConversation);
    });

    it('should throw BadRequestException if any participant does not belong to the organization', async () => {
      const alienUserId = 'alien-user-id';
      const dto: CreateConversationDto = {
        participantIds: [alienUserId],
      };

      // Only userId is found in the org, alienUserId is missing
      prisma.user.count.mockResolvedValue(1);

      await expect(
        service.createConversation(orgId, userId, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getConversations', () => {
    it('should return conversations with unread counts aggregated', async () => {
      const convList = [
        { id: 'c1', title: 'Conv 1', organizationId: orgId },
        { id: 'c2', title: 'Conv 2', organizationId: orgId },
      ];

      prisma.chatConversation.findMany.mockResolvedValue(convList);
      prisma.chatMessage.groupBy.mockResolvedValue([
        { conversationId: 'c1', _count: { conversationId: 3 } },
      ]);

      const result = await service.getConversations(orgId, userId);

      expect(result).toHaveLength(2);
      expect(result[0].unreadCount).toBe(3);
      expect(result[1].unreadCount).toBe(0);
      expect(prisma.chatMessage.groupBy).toHaveBeenCalledWith({
        by: ['conversationId'],
        where: {
          organizationId: orgId,
          conversationId: { in: ['c1', 'c2'] },
          senderId: { not: userId },
          isRead: false,
        },
        _count: { conversationId: true },
      });
    });

    it('should return empty list if user has no conversations', async () => {
      prisma.chatConversation.findMany.mockResolvedValue([]);

      const result = await service.getConversations(orgId, userId);

      expect(result).toEqual([]);
      expect(prisma.chatMessage.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('getConversationMessages', () => {
    it('should throw ForbiddenException if user is not a participant', async () => {
      prisma.chatParticipant.findFirst.mockResolvedValue(null);

      await expect(
        service.getConversationMessages(orgId, userId, 'conv-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return messages if user is a participant', async () => {
      prisma.chatParticipant.findFirst.mockResolvedValue({ id: 'p1' });
      const messages = [
        { id: 'm1', message: 'Hello' },
        { id: 'm2', message: 'Hi' },
      ];
      prisma.chatMessage.findMany.mockResolvedValue(messages);

      const result = await service.getConversationMessages(
        orgId,
        userId,
        'conv-1',
      );

      expect(result).toEqual(messages);
      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          conversationId: 'conv-1',
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('sendMessage', () => {
    it('should throw ForbiddenException if user is not a participant', async () => {
      prisma.chatParticipant.findFirst.mockResolvedValue(null);

      const dto: SendMessageDto = {
        conversationId: 'conv-1',
        message: 'Hello',
      };

      await expect(
        service.sendMessage(orgId, userId, dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create message and update conversation lastMessageAt', async () => {
      prisma.chatParticipant.findFirst.mockResolvedValue({ id: 'p1' });
      const message = { id: 'm1', message: 'Hello', conversationId: 'conv-1' };
      prisma.chatMessage.create.mockResolvedValue(message);
      prisma.chatConversation.updateMany.mockResolvedValue({ count: 1 });

      const dto: SendMessageDto = {
        conversationId: 'conv-1',
        message: 'Hello',
      };

      const result = await service.sendMessage(orgId, userId, dto);

      expect(result).toEqual(message);
      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          conversationId: 'conv-1',
          senderId: userId,
          message: 'Hello',
          attachmentUrl: undefined,
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      });
      expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
        where: { id: 'conv-1', organizationId: orgId },
        data: { lastMessageAt: expect.any(Date) },
      });
    });
  });

  describe('markMessagesAsRead', () => {
    it('should throw ForbiddenException if user is not a participant', async () => {
      prisma.chatParticipant.findFirst.mockResolvedValue(null);

      await expect(
        service.markMessagesAsRead(orgId, 'conv-1', userId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should mark unread messages as read and update lastReadAt', async () => {
      prisma.chatParticipant.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.chatMessage.updateMany.mockResolvedValue({ count: 4 });
      prisma.chatParticipant.update.mockResolvedValue({ id: 'p1' });

      const count = await service.markMessagesAsRead(orgId, 'conv-1', userId);

      expect(count).toBe(4);
      expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          conversationId: 'conv-1',
          senderId: { not: userId },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
      expect(prisma.chatParticipant.update).toHaveBeenCalledWith({
        where: {
          conversationId_userId: { conversationId: 'conv-1', userId },
        },
        data: {
          lastReadAt: expect.any(Date),
        },
      });
    });
  });
});
