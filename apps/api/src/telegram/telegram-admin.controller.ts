import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ADMIN_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/types';
import { TelegramObservabilityService } from './telegram-observability.service';

/**
 * Admin observability for the Telegram integration.
 *
 * `@Roles(...ADMIN_ROLES)` — the organization is taken from the authenticated
 * session and every query is scoped to it, so an admin can only ever see their
 * own organization's accounts and delivery health. The one global metric
 * (webhook volume) is additionally gated on `SUPER_ADMIN` inside the service.
 *
 * No secret, bot token, webhook/callback secret or raw Telegram id is returned.
 */
@ApiTags('Telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('telegram/admin')
export class TelegramAdminController {
  constructor(private readonly observability: TelegramObservabilityService) {}

  @Get('overview')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Telegram integration overview for my organization' })
  overview(@CurrentUser() user: RequestUser) {
    return this.observability.overview({
      organizationId: user.organizationId,
      role: user.role,
    });
  }
}
