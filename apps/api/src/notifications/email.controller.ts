import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto, SendEmailDto } from './dto/email.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, EmailTemplate } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Email')
@ApiBearerAuth()
@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('templates')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create an email template' })
  createTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Body() data: CreateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    return this.emailService.createTemplate(organizationId, data);
  }

  @AllowAnyRole()
  @Get('templates')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Get all email templates' })
  getTemplates(@CurrentUser('organizationId') organizationId: string): Promise<EmailTemplate[]> {
    return this.emailService.getTemplates(organizationId);
  }

  @AllowAnyRole()
  @Get('templates/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Get a specific email template by ID' })
  getTemplateById(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EmailTemplate> {
    return this.emailService.getTemplateById(organizationId, id);
  }

  @Put('templates/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Update an email template' })
  updateTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() data: UpdateEmailTemplateDto,
  ): Promise<EmailTemplate> {
    return this.emailService.updateTemplate(organizationId, id, data);
  }

  @Delete('templates/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete an email template' })
  deleteTemplate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<EmailTemplate> {
    return this.emailService.deleteTemplate(organizationId, id);
  }

  @Post('send')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Send an email using a template' })
  sendEmail(
    @CurrentUser('organizationId') organizationId: string,
    @Body() data: SendEmailDto,
  ): Promise<{ success: boolean; error?: string }> {
    return this.emailService.sendTemplatedEmail(organizationId, data);
  }
}
