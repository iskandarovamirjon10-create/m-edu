import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';
import { ScheduleOptimizerService } from './schedule-optimizer.service';
import {
  AutoFixScheduleConflictDto,
  ConflictAuditQueryDto,
  ResolveConflictDto,
} from './dto/schedule-optimizer.dto';

@ApiTags('Schedule Optimizer & Conflict Resolver')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedule/optimizer')
export class ScheduleOptimizerController {
  constructor(private readonly optimizerService: ScheduleOptimizerService) {}

  @Get('conflicts')
  @Roles(...STAFF_ROLES)
  @ApiOperation({
    summary: 'Full matrix scan for teacher collisions, room double-bookings, and capacity overflows',
  })
  async auditConflicts(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: ConflictAuditQueryDto,
  ) {
    return this.optimizerService.auditAllConflicts(orgId, query);
  }

  @Post('suggest-resolution')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'AI suggestions for collision-free alternative rooms and time slots',
  })
  async suggestResolution(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: ResolveConflictDto,
  ) {
    return this.optimizerService.suggestResolvedSlots(orgId, dto);
  }

  @Post('apply-resolution')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'One-click atomic relocation to resolve schedule collision with audit log',
  })
  async applyResolution(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: AutoFixScheduleConflictDto,
  ) {
    return this.optimizerService.autoFixConflict(orgId, actorId, dto);
  }
}
