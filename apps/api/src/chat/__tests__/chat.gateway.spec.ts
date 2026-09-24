import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WsException } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ChatGateway, AuthedSocket, SocketUser } from '../chat.gateway';
import { ChatService } from '../chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let mockChatService: {
    sendMessage: ReturnType<typeof vi.fn>;
    markMessagesAsRead: ReturnType<typeof vi.fn>;
  };
  let mockPrisma: {
    chatParticipant: {
      findFirst: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    user: { findUnique: ReturnType<typeof vi.fn> };
  };
  let mockConfig: {
    get: ReturnType<typeof vi.fn>;
  };
  let mockJwt: { verify: ReturnType<typeof vi.fn> };
  let mockServer: {
    to: ReturnType<typeof vi.fn>;
  };
  let mockRoomEmitter: {
    emit: ReturnType<typeof vi.fn>;
  };

  const mockUser: SocketUser = {
    id: 'user-1',
    email: 'user1@example.com',
    organizationId: 'org-1',
    role: 'STUDENT',
  };

  beforeEach(() => {
    mockChatService = {
      sendMessage: vi.fn(),
      markMessagesAsRead: vi.fn(),
    };
    mockPrisma = {
      chatParticipant: {
        findFirst: vi.fn(),
        count: vi.fn(),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
      },
    };
    mockConfig = {
      get: vi.fn().mockReturnValue('test-jwt-secret'),
    };
    mockJwt = {
      verify: vi.fn().mockReturnValue({ sub: 'user-1' }),
    };
    mockRoomEmitter = {
      emit: vi.fn(),
    };
    mockServer = {
      to: vi.fn().mockReturnValue(mockRoomEmitter),
    };

    gateway = new ChatGateway(
      mockChatService as unknown as ChatService,
      mockConfig as unknown as ConfigService,
      mockPrisma as unknown as PrismaService,
      mockJwt as unknown as JwtService,
    );
    gateway.server = mockServer as unknown as Server;
  });

  function createAuthedSocket(user: SocketUser = mockUser): AuthedSocket {
    return {
      id: 'socket-1',
      user,
      handshake: { headers: {}, auth: { token: 'test-token' } },
      join: vi.fn(),
      leave: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as AuthedSocket;
  }

  describe('Connection and Disconnection', () => {
    it('should join user room on handleConnection', async () => {
      const client = createAuthedSocket();
      await gateway.handleConnection(client);
      expect(client.join).toHaveBeenCalledWith('user_user-1');
    });

    it('should handle disconnect cleanly', () => {
      const client = createAuthedSocket();
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });

  describe('handleSendMessage', () => {
    it('should send message and broadcast to conversation room', async () => {
      const client = createAuthedSocket();
      const payload = {
        conversationId: 'conv-1',
        message: 'Hello!',
      };
      const createdMessage = {
        id: 'msg-1',
        organizationId: 'org-1',
        senderId: 'user-1',
        ...payload,
        createdAt: new Date(),
      };

      mockChatService.sendMessage.mockResolvedValue(createdMessage);

      const result = await gateway.handleSendMessage(client, payload);

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        payload,
      );
      expect(mockServer.to).toHaveBeenCalledWith('conversation_conv-1');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith(
        'newMessage',
        createdMessage,
      );
      expect(result).toEqual(createdMessage);
    });

    it('should throw WsException if sendMessage fails', async () => {
      const client = createAuthedSocket();
      mockChatService.sendMessage.mockRejectedValue(new Error('DB failure'));

      await expect(
        gateway.handleSendMessage(client, {
          conversationId: 'conv-1',
          message: 'Hello',
        }),
      ).rejects.toThrow(WsException);
    });
  });

  describe('handleJoinConversation', () => {
    it('should verify participant in org and join room', async () => {
      const client = createAuthedSocket();
      mockPrisma.chatParticipant.count.mockResolvedValue(1);

      const res = await gateway.handleJoinConversation(client, 'conv-1');

      // Membership is verified with a count scoped to the caller's org.
      expect(mockPrisma.chatParticipant.count).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv-1',
          userId: 'user-1',
          conversation: { organizationId: 'org-1' },
        },
      });
      expect(client.join).toHaveBeenCalledWith('conversation_conv-1');
      expect(res).toEqual({ joined: true, conversationId: 'conv-1' });
    });

    it('should throw WsException if user is not a participant of conversation', async () => {
      const client = createAuthedSocket();
      mockPrisma.chatParticipant.count.mockResolvedValue(0);

      await expect(
        gateway.handleJoinConversation(client, 'conv-1'),
      ).rejects.toThrow(WsException);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should throw WsException if conversationId is invalid', async () => {
      const client = createAuthedSocket();

      await expect(
        gateway.handleJoinConversation(client, '  '),
      ).rejects.toThrow(WsException);
    });
  });

  describe('handleLeaveConversation', () => {
    it('should leave room and return status', () => {
      const client = createAuthedSocket();

      const res = gateway.handleLeaveConversation(client, 'conv-1');

      expect(client.leave).toHaveBeenCalledWith('conversation_conv-1');
      expect(res).toEqual({ left: true, conversationId: 'conv-1' });
    });

    it('should throw WsException if conversationId is empty', () => {
      const client = createAuthedSocket();

      expect(() => gateway.handleLeaveConversation(client, '')).toThrow(
        WsException,
      );
    });
  });

  describe('handleTyping', () => {
    it('should emit typing event to conversation room', async () => {
      const client = createAuthedSocket();
      const payload = {
        conversationId: 'conv-1',
        isTyping: true,
      };
      mockPrisma.chatParticipant.count.mockResolvedValue(1);

      await gateway.handleTyping(client, payload);

      expect(mockServer.to).toHaveBeenCalledWith('conversation_conv-1');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('typing', {
        conversationId: 'conv-1',
        userId: 'user-1',
        isTyping: true,
      });
    });
  });

  describe('handleMarkRead', () => {
    it('should mark messages as read and broadcast event', async () => {
      const client = createAuthedSocket();
      mockChatService.markMessagesAsRead.mockResolvedValue(3);

      const res = await gateway.handleMarkRead(client, {
        conversationId: 'conv-1',
      });

      expect(mockChatService.markMessagesAsRead).toHaveBeenCalledWith(
        'org-1',
        'conv-1',
        'user-1',
      );
      expect(mockServer.to).toHaveBeenCalledWith('conversation_conv-1');
      expect(mockRoomEmitter.emit).toHaveBeenCalledWith('messagesRead', {
        conversationId: 'conv-1',
        userId: 'user-1',
        updatedCount: 3,
      });
      expect(res).toEqual({ updated: 3 });
    });
  });
});
