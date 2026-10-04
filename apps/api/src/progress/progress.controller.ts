import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Student Progress & 360')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @AllowAnyRole()
  @Get('student-360/:studentId')
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Get Unified Student 360 profile with deterministic risk and objective mastery' })
  getStudent360(
    @CurrentUser('organizationId') orgId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.progressService.getStudent360(orgId, studentId);
  }
}

