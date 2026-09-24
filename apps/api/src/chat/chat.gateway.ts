import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { UseGuards, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto, TypingDto, MarkReadDto } from './dto/chat.dto';
import { WsJwtGuard, AuthenticatedSocket, AuthenticatedUser } from './ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/chat',
})
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  
  // Basic in-memory rate limiting map for sending messages: userId -> lastMessageTimestamp
  private readonly messageRateLimits = new Map<string, number>();
  private readonly MESSAGE_COOLDOWN_MS = 500;

  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Authenticate socket manually on connection since class guards run per-message.
      const token = this.extractToken(client);
      if (!token) throw new Error('No token');
      
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) throw new Error('No secret');

      const payload = this.jwtService.verify(token, { secret });
      let authenticatedUser;

      if (payload.accountType === 'parent') {
        const parent = await this.prisma.parentAccount.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, organizationId: true, isActive: true }
        });
        if (!parent || !parent.isActive) throw new Error('Parent not found or deactivated');
        
        if (payload.sid) {
          const session = await this.prisma.parentSession.findUnique({ where: { id: payload.sid } });
          if (!session || session.revokedAt || session.expiresAt < new Date()) throw new Error('Session expired or revoked');
          if (session.parentId !== parent.id || session.organizationId !== parent.organizationId) throw new Error('Session binding mismatch');
        }
        
        authenticatedUser = {
          id: parent.id,
          email: parent.email,
          organizationId: parent.organizationId,
          role: 'PARENT'
        };
      } else {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, email: true, organizationId: true, role: true, isActive: true },
        });
        if (!user || !user.isActive) throw new Error('User not found or deactivated');

        if (payload.sid) {
          const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
          if (!session || session.revokedAt || session.expiresAt < new Date()) throw new Error('Session expired or revoked');
          if (session.userId !== user.id || session.organizationId !== user.organizationId) throw new Error('Session binding mismatch');
        }
        
        authenticatedUser = user;
      }

      client.user = authenticatedUser;
      client.join(`user_${authenticatedUser.id}`);
      this.logger.debug(`Client connected: ${client.id} (user: ${authenticatedUser.id})`);
    } catch (err) {
      this.logger.warn(`Disconnecting unauthenticated client: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const user = client.user;
    if (user) {
      this.messageRateLimits.delete(user.id);
      this.logger.debug(`Client disconnected: ${client.id} (user: ${user.id})`);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto,
  ) {
    const user = this.requireUser(client);
    
    // Rate limit check
    const now = Date.now();
    const lastMsgTime = this.messageRateLimits.get(user.id) || 0;
    if (now - lastMsgTime < this.MESSAGE_COOLDOWN_MS) {
      throw new WsException('You are sending messages too fast.');
    }
    this.messageRateLimits.set(user.id, now);

    try {
      const message = await this.chatService.sendMessage(user.organizationId, user.id, data);
      this.server.to(`conversation_${data.conversationId}`).emit('newMessage', message);
      return message;
    } catch (err) {
      this.logger.error(
        `sendMessage failed for user ${user.id}, conversation ${data.conversationId}: ${this.errMessage(err)}`,
      );
      throw new WsException(this.toClientMessage(err));
    }
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() conversationId: string,
  ) {
    const user = this.requireUser(client);

    if (typeof conversationId !== 'string' || !conversationId.trim()) {
      throw new WsException('conversationId is required');
    }

    try {
      const participantCount = await this.prisma.chatParticipant.count({
        where: {
          conversationId,
          userId: user.id,
          conversation: { organizationId: user.organizationId },
        },
      });
      
      if (participantCount === 0) {
        throw new WsException('Not a participant of this conversation');
      }

      client.join(`conversation_${conversationId}`);
      return { joined: true, conversationId };
    } catch (err) {
      if (err instanceof WsException) throw err;
      this.logger.error(
        `joinConversation failed for user ${user.id}: ${this.errMessage(err)}`,
      );
      throw new WsException('Could not join conversation');
    }
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() conversationId: string,
  ) {
    if (typeof conversationId !== 'string' || !conversationId.trim()) {
      throw new WsException('conversationId is required');
    }
    client.leave(`conversation_${conversationId}`);
    return { left: true, conversationId };
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingDto,
  ) {
    const user = this.requireUser(client);

    const participantCount = await this.prisma.chatParticipant.count({
      where: {
        conversationId: data.conversationId,
        userId: user.id,
        conversation: { organizationId: user.organizationId },
      },
    });

    if (participantCount === 0) {
      throw new WsException('Not a participant of this conversation');
    }

    this.server.to(`conversation_${data.conversationId}`).emit('typing', {
      conversationId: data.conversationId,
      userId: user.id,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MarkReadDto,
  ) {
    const user = this.requireUser(client);

    try {
      const updated = await this.chatService.markMessagesAsRead(
        user.organizationId,
        data.conversationId,
        user.id,
      );

      this.server.to(`conversation_${data.conversationId}`).emit('messagesRead', {
        conversationId: data.conversationId,
        userId: user.id,
        updatedCount: updated,
      });

      return { updated };
    } catch (err) {
      this.logger.error(
        `markRead failed for user ${user.id}: ${this.errMessage(err)}`,
      );
      throw new WsException(this.toClientMessage(err));
    }
  }

  // ======================================================================
  // HELPERS
  // ======================================================================

  private requireUser(client: AuthenticatedSocket): AuthenticatedUser {
    if (!client.user) {
      throw new WsException('Unauthorized');
    }
    return client.user;
  }

  private errMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private toClientMessage(err: unknown): string {
    if (err instanceof ForbiddenException) return 'Not a participant of this conversation';
    if (err instanceof BadRequestException) return err.message || 'Invalid request';
    if (err instanceof WsException) return err.getError() as string;
    return 'Message delivery failed';
  }
  
  private extractToken(client: AuthenticatedSocket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }
    
    const cookieHeader = client.handshake.headers.cookie;
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce<Record<string, string>>((acc, c) => {
        const [key, ...rest] = c.trim().split('=');
        if (key) acc[key] = rest.join('=');
        return acc;
      }, {});
      return cookies['access_token'] || null;
    }
    
    return null;
  }
}
