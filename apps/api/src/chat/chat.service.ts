import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';
import { ChatConversation, ChatMessage, ChatParticipant } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(
    organizationId: string,
    userId: string,
    data: CreateConversationDto,
  ): Promise<ChatConversation> {
    const participants = Array.from(new Set([...data.participantIds, userId]));

    // Multi-tenant check: ensure all invited participants belong to the organization
    const validCount = await this.prisma.user.count({
      where: {
        id: { in: participants },
        organizationId,
      },
    });

    if (validCount !== participants.length) {
      throw new BadRequestException(
        'One or more participants are invalid or not members of this organization',
      );
    }

    return this.prisma.chatConversation.create({
      data: {
        organizationId,
        type: data.type || 'DIRECT',
        title: data.title,
        createdBy: userId,
        participants: {
          create: participants.map((pId) => ({
            userId: pId,
          })),
        },
      },
      include: {
        participants: true,
      },
    });
  }

  async getConversations(organizationId: string, userId: string): Promise<any[]> {
    const conversations = await this.prisma.chatConversation.findMany({
      where: {
        organizationId,
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });

    const conversationIds = conversations.map((c) => c.id);
    const unreadRows =
      conversationIds.length > 0
        ? await this.prisma.chatMessage.groupBy({
            by: ['conversationId'],
            where: {
              organizationId,
              conversationId: { in: conversationIds },
              senderId: { not: userId },
              isRead: false,
            },
            _count: { conversationId: true },
          })
        : [];
    const unreadMap = new Map(
      unreadRows.map((row) => [row.conversationId, row._count.conversationId]),
    );

    return conversations.map((conv) => ({
      ...conv,
      unreadCount: unreadMap.get(conv.id) ?? 0,
    }));
  }

  private async _requireParticipant(
    organizationId: string,
    conversationId: string,
    userId: string,
  ): Promise<ChatParticipant> {
    const participant = await this.prisma.chatParticipant.findFirst({
      where: {
        conversationId,
        userId,
        conversation: { organizationId },
      },
    });

    if (!participant) {
      throw new ForbiddenException('Not a participant of this conversation');
    }
    return participant;
  }

  async getConversationMessages(
    organizationId: string,
    userId: string,
    conversationId: string,
  ): Promise<ChatMessage[]> {
    await this._requireParticipant(organizationId, conversationId, userId);

    return this.prisma.chatMessage.findMany({
      where: {
        organizationId,
        conversationId,
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
  }

  async sendMessage(
    organizationId: string,
    userId: string,
    data: SendMessageDto,
  ): Promise<ChatMessage> {
    await this._requireParticipant(organizationId, data.conversationId, userId);

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          organizationId,
          conversationId: data.conversationId,
          senderId: userId,
          message: data.message,
          attachmentUrl: data.attachmentUrl,
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

      await tx.chatConversation.updateMany({
        where: { id: data.conversationId, organizationId },
        data: { lastMessageAt: new Date() },
      });

      return message;
    });
  }

  async markMessagesAsRead(
    organizationId: string,
    conversationId: string,
    userId: string,
  ): Promise<number> {
    await this._requireParticipant(organizationId, conversationId, userId);

    const now = new Date();

    const [updatedMessages] = await this.prisma.$transaction([
      this.prisma.chatMessage.updateMany({
        where: {
          organizationId,
          conversationId,
          senderId: { not: userId },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: now,
        },
      }),
      this.prisma.chatParticipant.update({
        where: {
          conversationId_userId: { conversationId, userId },
        },
        data: {
          lastReadAt: now,
        },
      }),
    ]);

    return updatedMessages.count;
  }
}
