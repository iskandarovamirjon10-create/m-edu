import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get security summary' })
  async getSummary(@CurrentUser('organizationId') orgId: string) {
    return this.securityService.getSummary(orgId);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Find security alerts' })
  async findAlerts(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: any,
  ) {
    return this.securityService.findAlerts(orgId, query);
  }

  @Post('alerts/:id/resolve')
  @ApiOperation({ summary: 'Resolve a security alert' })
  async resolve(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { note?: string },
  ) {
    return this.securityService.resolve(orgId, id, userId, body.note);
  }
}
