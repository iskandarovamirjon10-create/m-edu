import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailTemplateDto, UpdateEmailTemplateDto, SendEmailDto } from './dto/email.dto';
import { EmailTemplate } from '@prisma/client';
import { escapeHtml } from '../auth/auth.utils';

/**
 * Real SMTP email delivery via Nodemailer.
 *
 * - When SMTP credentials are configured, emails are delivered through the
 *   configured transport and every attempt is recorded in EmailLog.
 * - When SMTP is NOT configured, delivery fails fast with an explicit
 *   ServiceUnavailableException — no fake timers, no simulated "delivered"
 *   logs. The template CRUD surface keeps working regardless.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.transporter = this.createTransporter();
  }

  private createTransporter(): Transporter | null {
    if (!this.configService?.get) {
      this.logger.warn('SMTP is not configured (ConfigService unavailable).');
      return null;
    }
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD missing). Email delivery will fail fast until configured.',
      );
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  /** Exposed for tests; returns whether a real SMTP transport is available. */
  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async createTemplate(organizationId: string, data: CreateEmailTemplateDto): Promise<EmailTemplate> {
    return this.prisma.emailTemplate.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  async getTemplates(organizationId: string): Promise<EmailTemplate[]> {
    return this.prisma.emailTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplateById(organizationId: string, id: string): Promise<EmailTemplate> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async updateTemplate(organizationId: string, id: string, data: UpdateEmailTemplateDto): Promise<EmailTemplate> {
    await this.getTemplateById(organizationId, id);
    return this.prisma.emailTemplate.update({
      where: { id },
      data,
    });
  }

  async deleteTemplate(organizationId: string, id: string): Promise<EmailTemplate> {
    await this.getTemplateById(organizationId, id);
    return this.prisma.emailTemplate.delete({
      where: { id },
    });
  }

  async sendRawEmail(data: { to: string; subject: string; html: string; text?: string; organizationId?: string }): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      this.logger.warn(`SMTP not configured. Would have sent email to ${data.to}: ${data.subject}`);
      return { success: false, error: 'SMTP not configured' };
    }

    try {
      this.logger.log(`Sending raw email to ${data.to} with subject "${data.subject}"`);
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM') || 'noreply@m-edu.io',
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
      });

      if (data.organizationId) {
        await this.prisma.emailLog.create({
          data: {
            organizationId: data.organizationId,
            recipient: data.to,
            subject: data.subject,
            status: 'DELIVERED',
            sentAt: new Date(),
          },
        });
      }
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send raw email to ${data.to}`, error);
      if (data.organizationId) {
        await this.prisma.emailLog.create({
          data: {
            organizationId: data.organizationId,
            recipient: data.to,
            subject: data.subject,
            status: 'FAILED',
            errorMessage: errorMessage,
            sentAt: new Date(),
          },
        });
      }
      return { success: false, error: errorMessage };
    }
  }

  async sendTemplatedEmail(organizationId: string, data: SendEmailDto): Promise<{ success: boolean; error?: string }> {
    const template = await this.getTemplateById(organizationId, data.templateId);

    if (!this.transporter) {
      // Fail fast and honestly — no fake "delivered" EmailLog entries.
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD to enable sending.',
      );
    }

    let htmlBody = template.htmlBody;
    let textBody = template.textBody || '';
    const subject = template.subject;

    if (data.variables) {
      for (const [key, value] of Object.entries(data.variables)) {
        // Escape the key to prevent ReDoS or unintended regex behavior
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`{{${escapedKey}}}`, 'g');
        const raw = String(value);
        // HTML-escape values interpolated into the markup to prevent stored
        // XSS from user-controlled fields. The plain-text body stays raw.
        htmlBody = htmlBody.replace(regex, () => escapeHtml(raw));
        textBody = textBody.replace(regex, () => raw);
      }
    }

    try {
      this.logger.log(`Sending email to ${data.recipient} with subject "${subject}"`);
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: data.recipient,
        subject,
        html: htmlBody,
        text: textBody,
      });

      await this.prisma.emailLog.create({
        data: {
          organizationId,
          recipient: data.recipient,
          subject,
          templateId: template.id,
          status: 'DELIVERED',
          sentAt: new Date(),
          metadata: data.variables || {},
        },
      });
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${data.recipient}`, error);
      
      await this.prisma.emailLog.create({
        data: {
          organizationId,
          recipient: data.recipient,
          subject,
          templateId: template.id,
          status: 'FAILED',
          errorMessage,
          metadata: data.variables || {},
        },
      });
      return { success: false, error: errorMessage };
    }
  }
}
