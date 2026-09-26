import { Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AllowSelfService } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/types';
import { TelegramLinkService, TelegramPrincipal } from './telegram-link.service';

/**
 * Self-service Telegram integration surface (M-EDU Web → Settings →
 * Integrations → Telegram).
 *
 * Every route is strictly `@AllowSelfService()`: the caller can only ever act
 * on their OWN link, and the M-EDU principal is derived from the authenticated
 * session — the request body/query never selects an account. That is the
 * account-takeover boundary: possession of a Telegram account alone is not
 * enough, and possession of another user's id in a request is meaningless.
 */
@ApiTags('Telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private readonly links: TelegramLinkService) {}

  @Get('status')
  @AllowSelfService()
  @ApiOperation({ summary: 'Get my Telegram integration status' })
  status(@CurrentUser() user: RequestUser) {
    return this.links.getStatus(principalOf(user));
  }

  @Post('link')
  @AllowSelfService()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a one-time Telegram deep link for my account' })
  createLink(@CurrentUser() user: RequestUser) {
    return this.links.createLinkToken(principalOf(user));
  }

  @Delete('link')
  @AllowSelfService()
  @ApiOperation({ summary: 'Disconnect my Telegram account' })
  unlink(@CurrentUser() user: RequestUser) {
    return this.links.unlink(principalOf(user));
  }

  @Post('test-notification')
  @AllowSelfService()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a test notification to my linked Telegram chat' })
  testNotification(@CurrentUser() user: RequestUser) {
    return this.links.sendTestMessage(principalOf(user));
  }
}

function principalOf(user: RequestUser): TelegramPrincipal {
  return { sub: user.sub, organizationId: user.organizationId, role: user.role };
}
