// M-EDU AI Copilot — integration pass
import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, HttpException, HttpStatus, Req, Res, Headers } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { STAFF_ROLES, isAdminRole } from '../auth/authorization.policy';
import { AllowPublic } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Request, Response } from 'express';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ChatHistoryItemDto {
  @IsString()
  @IsIn(['user', 'model', 'assistant', 'system'])
  role: string;

  @IsString()
  @MaxLength(10000)
  content: string;
}

export class ChatBodyDto {
  @IsString()
  @MaxLength(4000)
  message: string;

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
}

export class ImportMessageDto {
  @IsString()
  @MaxLength(4000)
  content: string;

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
  conversations: ImportConversationDto[];
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('health')
  @AllowPublic()
  health() {
    // Report the ACTUAL resolved provider/model state. The previous
    // `AI_MODEL ?? 'gpt-4o-mini'` referenced an env var nothing else reads
    // and a model that is never used (regression: F-13).
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    return {
      ok: true,
      model,
      provider: 'gemini',
      configured: Boolean(process.env.GEMINI_API_KEY),
      uptime: process.uptime(),
    };
  }

  @Get('conversations')
  @Roles(...STAFF_ROLES)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getConversations(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: string,
  ) {
    if (!organizationId) throw new HttpException('Tenant context required', HttpStatus.FORBIDDEN);
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.aiService.getConversations(organizationId, userId, Math.min(parsedLimit, 100));
  }

  @Post('conversations')
  @Roles(...STAFF_ROLES)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createConversation(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { title?: string },
  ) {
    if (!organizationId) throw new HttpException('Tenant context required', HttpStatus.FORBIDDEN);
    return this.aiService.createConversation(organizationId, userId, body.title);
  }

  @Get('conversations/:id/messages')
  @Roles(...STAFF_ROLES)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMessages(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') conversationId: string,
  ) {
    if (!organizationId) throw new HttpException('Tenant context required', HttpStatus.FORBIDDEN);
    return this.aiService.getMessages(organizationId, userId, conversationId);
  }

  @Delete('conversations/:id')
  @Roles(...STAFF_ROLES)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteConversation(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') conversationId: string,
    @Res() res: Response
  ) {
    if (!organizationId) throw new HttpException('Tenant context required', HttpStatus.FORBIDDEN);
    await this.aiService.deleteConversation(organizationId, userId, conversationId);
    res.status(HttpStatus.NO_CONTENT).send();
  }

  @Get('insights')
  @Roles(...STAFF_ROLES)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getInsights(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query('scope') scope: string,
    @Headers('X-Page-Context') pageContext: string,
  ) {
    if (!organizationId) throw new HttpException('Tenant context required', HttpStatus.FORBIDDEN);
    return this.aiService.getInsights(organizationId, userId, scope, pageContext);
  }

  @Get('suggestions')
  @Roles(...STAFF_ROLES)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getSuggestions(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Query('context') context: string,
    @Headers('Accept-Language') lang: string,
  ) {
    if (!organizationId) throw new HttpException('Tenant context required', HttpStatus.FORBIDDEN);
    return this.aiService.getSuggestions(organizationId, userId, context, lang);
  }

  @Post('chat')
  @Roles(...STAFF_ROLES)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async chat(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Body() body: ChatBodyDto,
  ) {
    if (!organizationId) throw new HttpException('Tenant context required', HttpStatus.FORBIDDEN);
    try {
      return await this.aiService.chat(
        organizationId, 
        userId, 
        body.message || '', 
        body.history || [],
        body.conversationId,
        isAdminRole(role),
      );
    } catch (e: unknown) {
      if (e instanceof HttpException) throw e;
      const errorMessage = e instanceof Error ? e.message : 'AI error';
      throw new HttpException(errorMessage, HttpStatus.BAD_GATEWAY);
    }
  }

  @Post('chat/stream')
  @Roles(...STAFF_ROLES)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async chatStream(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Body() body: ChatBodyDto,
    @Res() res: Response
  ) {
    if (!organizationId) throw new HttpException('Tenant context required', HttpStatus.FORBIDDEN);
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      await this.aiService.chatStream(
        organizationId,
        userId,
        body.message || '',
        body.history || [],
        body.conversationId,
        res,
        isAdminRole(role),
        role,
      );
    } catch (e: unknown) {
      if (e instanceof HttpException) throw e;
      const errorMessage = e instanceof Error ? e.message : 'AI error';
      res.write(`event: error\ndata: ${JSON.stringify({ code: '502', message: errorMessage })}\n\n`);
      res.end();
    }
  }

  @Post('conversations/import')
  @Roles(...STAFF_ROLES)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async importConversations(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: ImportConversationsBodyDto,
  ) {
    if (!organizationId) throw new HttpException('Tenant context required', HttpStatus.FORBIDDEN);
    return this.aiService.importConversations(organizationId, userId, body.conversations);
  }
}
