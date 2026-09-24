import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Role, ChatConversation, ChatMessage } from '@prisma/client';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto } from './dto/chat.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AllowAnyRole } from '../auth/roles.decorator';

const CHAT_ROLES = [
  Role.SUPER_ADMIN,
  Role.ORG_ADMIN,
  Role.MANAGER,
  Role.TEACHER,
  Role.ASSISTANT,
  Role.STUDENT,
];

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Create a new conversation between users.
   */
  @Post('conversations')
  @Roles(...CHAT_ROLES)
  async createConversation(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() data: CreateConversationDto,
  ): Promise<ChatConversation> {
    return this.chatService.createConversation(organizationId, userId, data);
  }

  /**
   * Get all conversations for the current user.
   */
  @AllowAnyRole()
  @Get('conversations')
  @Roles(...CHAT_ROLES)
  async getConversations(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<any[]> {
    return this.chatService.getConversations(organizationId, userId);
  }

  /**
   * Get paginated messages for a conversation.
   */
  @AllowAnyRole()
  @Get('conversations/:id/messages')
  @Roles(...CHAT_ROLES)
  async getConversationMessages(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ): Promise<ChatMessage[]> {
    return this.chatService.getConversationMessages(
      organizationId,
      userId,
      conversationId,
    );
  }

  /**
   * Send a message to a conversation.
   */
  @Post('messages')
  @Roles(...CHAT_ROLES)
  async sendMessage(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() data: SendMessageDto,
  ): Promise<ChatMessage> {
    return this.chatService.sendMessage(organizationId, userId, data);
  }

  /**
   * Mark all messages in a conversation as read.
   */
  @Post('conversations/:id/read')
  @Roles(...CHAT_ROLES)
  async markRead(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ): Promise<{ updated: number }> {
    const updated = await this.chatService.markMessagesAsRead(
      organizationId,
      conversationId,
      userId,
    );
    return { updated };
  }
}

