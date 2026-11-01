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
import { ParentSafetyGuardService } from './parent-safety-guard.service';
import {
  ChildMovementNotificationDto,
  EmergencyParentBroadcastDto,
} from './dto/parent-safety.dto';

@ApiTags('Parent Safety Guard & Live Turnstile Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parent-portal/safety')
export class ParentSafetyGuardController {
  constructor(private readonly safetyService: ParentSafetyGuardService) {}

  @Post('movement')
  @Roles(...STAFF_ROLES)
  @ApiOperation({
    summary: 'Dispatch instant safety entry/exit notification to parents upon turnstile or Face ID event',
  })
  async notifyMovement(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: ChildMovementNotificationDto,
  ) {
    return this.safetyService.notifyParentOfMovement(orgId, dto);
  }

  @Get('live-presence')
  @Roles(...STAFF_ROLES)
  @ApiOperation({
    summary: 'Real-time headcount of students currently present inside the building and recent gate passes',
  })
  async getLivePresence(
    @CurrentUser('organizationId') orgId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.safetyService.getLiveStudentPresence(orgId, branchId);
  }

  @Post('emergency-broadcast')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Broadcast high-priority emergency alert to parents of present or all students',
  })
  async emergencyBroadcast(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: EmergencyParentBroadcastDto,
  ) {
    return this.safetyService.dispatchEmergencyBroadcast(orgId, actorId, dto);
  }
}
