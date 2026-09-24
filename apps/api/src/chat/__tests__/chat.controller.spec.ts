import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatController } from '../chat.controller';
import { ChatService } from '../chat.service';
import { CreateConversationDto, SendMessageDto } from '../dto/chat.dto';

describe('ChatController', () => {
  let controller: ChatController;
  let service: {
    createConversation: ReturnType<typeof vi.fn>;
    getConversations: ReturnType<typeof vi.fn>;
    getConversationMessages: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    markMessagesAsRead: ReturnType<typeof vi.fn>;
  };

  const orgId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const convId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    service = {
      createConversation: vi.fn(),
      getConversations: vi.fn(),
      getConversationMessages: vi.fn(),
      sendMessage: vi.fn(),
      markMessagesAsRead: vi.fn(),
    };

    controller = new ChatController(service as unknown as ChatService);
  });

  it('should delegate createConversation to ChatService', async () => {
    const dto: CreateConversationDto = {
      participantIds: ['44444444-4444-4444-8444-444444444444'],
      title: 'New Group',
    };
    service.createConversation.mockResolvedValue({ id: convId });

    const result = await controller.createConversation(orgId, userId, dto);

    expect(service.createConversation).toHaveBeenCalledWith(orgId, userId, dto);
    expect(result).toEqual({ id: convId });
  });

  it('should delegate getConversations to ChatService', async () => {
    service.getConversations.mockResolvedValue([{ id: convId }]);

    const result = await controller.getConversations(orgId, userId);

    expect(service.getConversations).toHaveBeenCalledWith(orgId, userId);
    expect(result).toEqual([{ id: convId }]);
  });

  it('should delegate getConversationMessages to ChatService', async () => {
    service.getConversationMessages.mockResolvedValue([{ id: 'msg-1' }]);

    const result = await controller.getConversationMessages(
      orgId,
      userId,
      convId,
    );

    expect(service.getConversationMessages).toHaveBeenCalledWith(
      orgId,
      userId,
      convId,
    );
    expect(result).toEqual([{ id: 'msg-1' }]);
  });

  it('should delegate sendMessage to ChatService', async () => {
    const dto: SendMessageDto = {
      conversationId: convId,
      message: 'Hello world',
    };
    service.sendMessage.mockResolvedValue({ id: 'msg-1', ...dto });

    const result = await controller.sendMessage(orgId, userId, dto);

    expect(service.sendMessage).toHaveBeenCalledWith(orgId, userId, dto);
    expect(result).toEqual({ id: 'msg-1', ...dto });
  });

  it('should delegate markRead to ChatService', async () => {
    service.markMessagesAsRead.mockResolvedValue(5);

    const result = await controller.markRead(orgId, userId, convId);

    expect(service.markMessagesAsRead).toHaveBeenCalledWith(
      orgId,
      convId,
      userId,
    );
    expect(result).toEqual({ updated: 5 });
  });
});
