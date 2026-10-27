import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AiContext, AiLocale } from '@medu/contracts';
import { AiContextService } from './application/context.service';
import { ConversationService } from './application/conversation.service';
import { AiActionService } from './application/action.service';
import { AiGatewayService } from './application/ai-gateway.service';
import {
  CreateConversationDto,
  ListConversationsQueryDto,
  ListMessagesQueryDto,
  RenameConversationDto,
} from './dto/conversation.dto';
import { SendMessageDto } from './dto/chat.dto';
import { RejectActionDto, ListActionsQueryDto } from './dto/action.dto';
import type { AiAuthenticatedUser } from './domain/ai.types';

/**
 * Canonical AI workspace API.
 *
 * All routes are tenant-scoped and authenticated; identity and permissions are
 * derived server-side by `AiContextService`. Budgets are enforced by the global,
 * Redis-backed ThrottlerGuard (tightened here for the expensive routes).
 */
@Controller('workspace/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
export class AiWorkspaceController {
  constructor(
    private readonly contextService: AiContextService,
    private readonly conversations: ConversationService,
    private readonly actions: AiActionService,
    private readonly gateway: AiGatewayService,
  ) {}

  private context(user: AiAuthenticatedUser, extra?: { route?: string; entity?: { type: string; id: string }; locale?: AiLocale }): AiContext {
    return this.contextService.fromRequest(user, extra ?? {});
  }

  /* ── Conversations ─────────────────────────────────────────────────── */

  @Get('conversations')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listConversations(
    @CurrentUser() user: AiAuthenticatedUser,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.conversations.list(this.context(user), query);
  }

  @Post('conversations')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createConversation(
    @CurrentUser() user: AiAuthenticatedUser,
    @Body() body: CreateConversationDto,
  ) {
    return this.conversations.create(this.context(user), body.title);
  }

  @Get('conversations/:id')
  getConversation(
    @CurrentUser() user: AiAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.conversations.get(this.context(user), id);
  }

  @Patch('conversations/:id')
  renameConversation(
    @CurrentUser() user: AiAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameConversationDto,
  ) {
    return this.conversations.rename(this.context(user), id, body.title);
  }

  @Delete('conversations/:id')
  archiveConversation(
    @CurrentUser() user: AiAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.conversations.archive(this.context(user), id);
  }

  @Get('conversations/:id/messages')
  listMessages(
    @CurrentUser() user: AiAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.conversations.listMessages(this.context(user), id, query);
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  sendMessage(
    @CurrentUser() user: AiAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendMessageDto,
  ) {
    const context = this.context(user, {
      route: body.route,
      entity: body.entity,
      locale: body.locale as AiLocale | undefined,
    });
    return this.gateway.sendMessage(context, id, body.content);
  }

  /* ── Actions ───────────────────────────────────────────────────────── */

  @Get('actions')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  listActions(
    @CurrentUser() user: AiAuthenticatedUser,
    @Query() query: ListActionsQueryDto,
  ) {
    return this.actions.list(this.context(user), query);
  }


  @Get('actions/:id')
  getAction(
    @CurrentUser() user: AiAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.actions.get(this.context(user), id);
  }

  @Post('actions/:id/confirm')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  confirmAction(
    @CurrentUser() user: AiAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.actions.confirm(this.context(user), id);
  }

  @Post('actions/:id/reject')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  rejectAction(
    @CurrentUser() user: AiAuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectActionDto,
  ) {
    return this.actions.reject(this.context(user), id, body.reason);
  }
}
