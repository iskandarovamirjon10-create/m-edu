import { Body, Controller, Get, Post, UseGuards, Optional } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ADMIN_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/types';
import { TelegramObservabilityService } from './telegram-observability.service';
import { TelegramService } from './telegram.service';
import { TelegramPollingService } from './telegram-polling.service';
import { TelegramBootstrapService } from './telegram-bootstrap.service';

/**
 * Admin observability and diagnostics for the Telegram integration.
 *
 * `@Roles(...ADMIN_ROLES)` — the organization is taken from the authenticated
 * session and every query is scoped to it.
 *
 * No secret, bot token, webhook/callback secret or raw Telegram id is returned.
 */
@ApiTags('Telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('telegram/admin')
export class TelegramAdminController {
  constructor(
    private readonly observability: TelegramObservabilityService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    @Optional() private readonly polling?: TelegramPollingService,
    @Optional() private readonly bootstrap?: TelegramBootstrapService,
  ) {}

  @Get('overview')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Telegram integration overview for my organization' })
  overview(@CurrentUser() user: RequestUser) {
    return this.observability.overview({
      organizationId: user.organizationId,
      role: user.role,
    });
  }

  @Get('bot-info')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get live Telegram bot profile from Telegram getMe API' })
  async getBotInfo() {
    const configured = this.telegram.isConfigured();
    if (!configured) {
      return {
        configured: false,
        username: null,
        bot: null,
        isPolling: false,
      };
    }
    const bot = await this.telegram.getMe();
    return {
      configured: true,
      username: bot?.username || this.telegram.getBotUsername(),
      bot,
      isPolling: this.polling?.isPolling() ?? false,
    };
  }

  @Get('webhook-info')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get current Telegram webhook and polling status' })
  async getWebhookInfo() {
    const configured = this.telegram.isConfigured();
    const webhookInfo = configured ? await this.telegram.getWebhookInfo() : null;
    const isPolling = this.polling?.isPolling() ?? false;
    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');

    let mode: 'POLLING' | 'WEBHOOK' | 'NOT_CONFIGURED' = 'NOT_CONFIGURED';
    if (!configured) {
      mode = 'NOT_CONFIGURED';
    } else if (isPolling) {
      mode = 'POLLING';
    } else if (webhookUrl && webhookUrl.trim().length > 0) {
      mode = 'WEBHOOK';
    }

    return {
      configured,
      mode,
      webhook: webhookInfo,
      polling: this.polling?.getStatus() ?? {
        isPolling: false,
        currentOffset: 0,
        lastPollAt: null,
        errorCount: 0,
      },
    };
  }

  @Post('toggle-mode')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Switch between Webhook mode and Long-Polling mode' })
  async toggleMode(@Body() body: { mode: 'WEBHOOK' | 'POLLING' }) {
    if (!this.telegram.isConfigured()) {
      return {
        success: false,
        message: 'Telegram bot tokeni sozlanmagan',
      };
    }

    if (body.mode === 'POLLING') {
      const ok = await this.polling?.startPolling();
      return {
        success: !!ok,
        mode: 'POLLING',
        message: ok
          ? 'Long-Polling rejimi muvaffaqiyatli ishga tushirildi (Lokal/Dev rejimi)'
          : 'Long-Polling ni ishga tushirishda xatolik yuz berdi',
      };
    } else if (body.mode === 'WEBHOOK') {
      this.polling?.stopPolling();
      const ok = (await this.bootstrap?.registerWebhook()) ?? false;
      return {
        success: ok,
        mode: 'WEBHOOK',
        message: ok
          ? 'Webhook rejimi muvaffaqiyatli ulandi'
          : 'Webhook ni ulashda xatolik (TELEGRAM_WEBHOOK_URL sozlanmagan bo‘lishi mumkin)',
      };
    }

    return {
      success: false,
      message: 'Noma‘lum rejim ko‘rsatildi',
    };
  }

  @Post('ping')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Measure real-time latency to Telegram Bot API' })
  async ping() {
    if (!this.telegram.isConfigured()) {
      return {
        ok: false,
        pingMs: 0,
        error: 'Telegram bot tokeni sozlanmagan',
      };
    }
    const start = Date.now();
    const bot = await this.telegram.getMe();
    const pingMs = Date.now() - start;
    return {
      ok: !!bot,
      pingMs,
      bot,
      timestamp: new Date().toISOString(),
    };
  }
}
