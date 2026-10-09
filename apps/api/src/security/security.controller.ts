import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { ResolveSecurityAlertDto } from './dto/security.dto';
import { SecurityAlertQueryDto } from './dto/security.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
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
    @Query() query: SecurityAlertQueryDto,
  ) {
    return this.securityService.findAlerts(orgId, query);
  }

  @Post('alerts/:id/resolve')
  @ApiOperation({ summary: 'Resolve a security alert' })
  async resolve(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: ResolveSecurityAlertDto,
  ) {
    return this.securityService.resolve(orgId, id, userId, body?.note);
  }
}
