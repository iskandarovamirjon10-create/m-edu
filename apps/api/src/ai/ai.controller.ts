// M-EDU AI Copilot — Enterprise Controller Layer
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  HttpCode,
  Res,
  Headers,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { STAFF_ROLES, isAdminRole } from '../auth/authorization.policy';
import { AllowPublic } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { DraftParentMessageDto, GenerateQuizDto } from './dto/deep-ai.dto';
import { RenameConversationDto } from './dto/conversation.dto';

// ============================================================================
// Validated Data Transfer Objects (DTOs)
// ============================================================================

const ROUTE_REGEX = /^\/[a-zA-Z0-9_\-/]*$/;

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(200)
  title?: string;
}

export class ChatHistoryItemDto {
  @IsString()
  @IsIn(['user', 'model', 'assistant', 'system'])
  role!: string;

  @IsString()
  @MaxLength(10_000)
  content!: string;
}

export class ChatAttachmentDto {
  @IsString()
  @IsIn(['image', 'document'])
  type!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/, {
    message: 'Unsupported attachment MIME type',
  })
  mimeType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15_000_000)
  base64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class ChatBodyDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(ROUTE_REGEX, { message: 'Invalid route format' })
  route?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentDto)
  attachments?: ChatAttachmentDto[];
}

export class ImportMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsIn(['user', 'assistant'])
  role?: 'user' | 'assistant';
}

export class ImportConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportMessageDto)
  messages?: ImportMessageDto[];
}

export class ImportConversationsBodyDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportConversationDto)
  conversations!: ImportConversationDto[];
}

// ============================================================================
// Controller Implementation
// ============================================================================

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly configService: ConfigService,
  ) {}

  // --------------------------------------------------------------------------
  // Private Validation & Sanitization Helpers
  // --------------------------------------------------------------------------

  private assertTenantContext(
    organizationId?: string,
    userId?: string,
  ): asserts organizationId is string {
    if (!organizationId || !userId) {
      throw new HttpException(
        'Tenant and user context required',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private sanitizePageContext(
    routeFromBody?: string,
    rawHeaderContext?: string,
  ): string | undefined {
    const candidate = (routeFromBody || rawHeaderContext || '').trim();
    if (!candidate) return undefined;
    const sliced = candidate.slice(0, 200);
    return ROUTE_REGEX.test(sliced) ? sliced : undefined;
  }

  private canIncludeFinancials(role?: string): boolean {
    if (!role) return false;
    return isAdminRole(role) || role.toUpperCase() === 'ACCOUNTANT';
  }

  /**
   * Guard the inline-attachment channel before any provider call.
   *
   * The DTO already limits each part's MIME type and length; this caps the
   * aggregate payload so a single request cannot allocate hundreds of MB of
   * base64 in memory or exceed the provider's inline-data limit.
   */
  private assertAttachmentBudget(attachments?: ChatAttachmentDto[]): void {
    if (!attachments || attachments.length === 0) return;

    const MAX_FILES = 4;
    const MAX_TOTAL_BASE64_CHARS = 12_000_000; // ~9 MB decoded
    const MAX_FILE_BASE64_CHARS = 8_000_000; // ~6 MB decoded

    if (attachments.length > MAX_FILES) {
      throw new HttpException(
        `At most ${MAX_FILES} attachments can be sent at once`,
        HttpStatus.BAD_REQUEST,
      );
    }

    let total = 0;
    for (const attachment of attachments) {
      if (!attachment?.base64) {
        throw new HttpException('Attachment payload is empty', HttpStatus.BAD_REQUEST);
      }
      if (attachment.base64.length > MAX_FILE_BASE64_CHARS) {
        throw new HttpException(
          'Attachment is too large (max ~6 MB per file)',
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      total += attachment.base64.length;
    }

    if (total > MAX_TOTAL_BASE64_CHARS) {
      throw new HttpException(
        'Attachments are too large in total (max ~9 MB)',
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Endpoints
  // --------------------------------------------------------------------------

  @Get('health')
  @AllowPublic()
  health() {
    const model =
      this.configService.get<string>('GEMINI_MODEL') ||
      process.env.GEMINI_MODEL ||
      'gemini-3.8-flash';
    const apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      process.env.GEMINI_API_KEY;

    const configured = Boolean(apiKey);

    return {
      ok: true,
      model,
      provider: 'gemini',
      configured,
      // `fallback` means the endpoint is reachable but replies come from the
      // deterministic database-backed engine until a provider key is set.
      mode: configured ? 'live' : 'fallback',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Roles(...STAFF_ROLES)
  @Get('conversations')
  async getConversations(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertTenantContext(organizationId, userId);
    const parsed = Number.parseInt(limit ?? '', 10);
    const safeLimit = Number.isFinite(parsed)
      ? Math.min(Math.max(1, parsed), 100)
      : 50;

    return this.aiService.getConversations(organizationId, userId, safeLimit);
  }

  @Roles(...STAFF_ROLES)
  @Post('conversations')
  async createConversation(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: CreateConversationDto,
  ) {
    this.assertTenantContext(organizationId, userId);
    return this.aiService.createConversation(
      organizationId,
      userId,
      body?.title,
    );
  }

  @Roles(...STAFF_ROLES)
  @Get('conversations/:id/messages')
  async getMessages(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') conversationId: string,
  ) {
    this.assertTenantContext(organizationId, userId);
    if (!conversationId?.trim()) {
      throw new HttpException('Conversation ID required', HttpStatus.BAD_REQUEST);
    }
    return this.aiService.getMessages(
      organizationId,
      userId,
      conversationId.trim(),
    );
  }

  @Roles(...STAFF_ROLES)
  @Patch('conversations/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async renameConversation(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') conversationId: string,
    @Body() body: RenameConversationDto,
  ) {
    this.assertTenantContext(organizationId, userId);
    if (!conversationId?.trim()) {
      throw new HttpException('Conversation ID required', HttpStatus.BAD_REQUEST);
    }
    return this.aiService.renameConversation(
      organizationId,
      userId,
      conversationId.trim(),
      body.title,
    );
  }

  @Roles(...STAFF_ROLES)
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') conversationId: string,
  ): Promise<void> {
    this.assertTenantContext(organizationId, userId);
    if (!conversationId?.trim()) {
      throw new HttpException('Conversation ID required', HttpStatus.BAD_REQUEST);
    }
    await this.aiService.deleteConversation(
      organizationId,
      userId,
      conversationId.trim(),
    );
  }

  @Roles(...STAFF_ROLES)
  @Get('insights')
  async getInsights(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query('scope') scope?: string,
    @Headers('x-page-context') rawPageContext?: string,
  ) {
    this.assertTenantContext(organizationId, userId);
    const safeScope =
      scope && ['global', 'page'].includes(scope.toLowerCase())
        ? scope.toLowerCase()
        : 'global';
    const safePageContext =
      this.sanitizePageContext(undefined, rawPageContext) ?? '/';

    return this.aiService.getInsights(
      organizationId,
      userId,
      safeScope,
      safePageContext,
    );
  }

  @Roles(...STAFF_ROLES)
  @Get('suggestions')
  async getSuggestions(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query('context') context?: string,
    @Headers('accept-language') lang?: string,
  ) {
    this.assertTenantContext(organizationId, userId);
    const safeContext =
      this.sanitizePageContext(context, undefined) ?? 'default';
    const safeLang = (lang || 'uz').slice(0, 35);

    return this.aiService.getSuggestions(
      organizationId,
      userId,
      safeContext,
      safeLang,
    );
  }

  @Roles(...STAFF_ROLES)
  @Get('executive-briefing')
  async getExecutiveBriefing(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
  ) {
    this.assertTenantContext(organizationId, userId);
    return this.aiService.getExecutiveBriefing(organizationId);
  }

  @Roles(...STAFF_ROLES)
  @Get('diagnose/student/:id')
  async diagnoseStudent(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') studentId: string,
  ) {
    this.assertTenantContext(organizationId, userId);
    if (!studentId?.trim()) {
      throw new HttpException("O'quvchi ID raqami kiritilmadi", HttpStatus.BAD_REQUEST);
    }
    return this.aiService.diagnoseStudent(organizationId, studentId.trim());
  }

  @Roles(...STAFF_ROLES)
  @Post('draft-parent-message')
  async draftParentMessage(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: DraftParentMessageDto,
  ) {
    this.assertTenantContext(organizationId, userId);
    return this.aiService.draftParentMessage(organizationId, body);
  }

  @Roles(...STAFF_ROLES)
  @Post('generate-quiz')
  async generateQuiz(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: GenerateQuizDto,
  ) {
    this.assertTenantContext(organizationId, userId);
    return this.aiService.generateQuiz(organizationId, body);
  }

  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chat(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Headers('x-page-context') rawPageContext: string | undefined,
    @Body() body: ChatBodyDto,
  ) {
    this.assertTenantContext(organizationId, userId);
    this.assertAttachmentBudget(body.attachments);

    try {
      return await this.aiService.chat(
        organizationId,
        userId,
        body.message,
        body.history ?? [],
        body.conversationId,
        this.canIncludeFinancials(role),
        body.model,
        {
          userRole: role,
          principalType: 'USER',
        },
      );
    } catch (e: unknown) {
      if (e instanceof HttpException) throw e;
      const errorMessage = e instanceof Error ? e.message : 'AI service error';
      throw new HttpException(errorMessage, HttpStatus.BAD_GATEWAY);
    }
  }

  @Roles(...STAFF_ROLES)
  @Post('chat/stream')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chatStream(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Headers('x-page-context') rawPageContext: string | undefined,
    @Body() body: ChatBodyDto,
    @Res() res: Response,
  ): Promise<void> {
    this.assertTenantContext(organizationId, userId);
    this.assertAttachmentBudget(body.attachments);

    const safePageContext = this.sanitizePageContext(
      body.route,
      rawPageContext,
    );

    try {
      await this.aiService.chatStream(
        organizationId,
        userId,
        body.message,
        body.history ?? [],
        body.conversationId,
        res,
        this.canIncludeFinancials(role),
        role,
        safePageContext,
        body.model,
        body.attachments,
      );
    } catch (e: unknown) {
      const statusCode =
        e instanceof HttpException
          ? e.getStatus()
          : HttpStatus.BAD_GATEWAY;
      const errorMessage =
        e instanceof Error ? e.message : 'AI streaming error';

      // If SSE headers were not yet sent, return standard HTTP error status
      // or initialize SSE headers cleanly before sending the error frame
      if (!res.headersSent) {
        res.status(statusCode);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
      }

      if (!res.writableEnded && !res.destroyed) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            code: String(statusCode),
            message: errorMessage,
          })}\n\n`,
        );
        res.end();
      }
    }
  }

  @Roles(...STAFF_ROLES)
  @Post('conversations/import')
  async importConversations(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: ImportConversationsBodyDto,
  ) {
    this.assertTenantContext(organizationId, userId);
    return this.aiService.importConversations(
      organizationId,
      userId,
      body.conversations,
    );
  }
}