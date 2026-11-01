import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../../auth/authorization.policy';
import { StudentRetentionService } from './student-retention.service';
import {
  RecordInterventionDto,
  RetentionQueryDto,
} from './dto/student-retention.dto';

@ApiTags('Student Retention Cockpit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students/retention')
export class StudentRetentionController {
  constructor(private readonly retentionService: StudentRetentionService) {}

  @Get('cockpit')
  @Roles(...STAFF_ROLES)
  @ApiOperation({
    summary: 'Executive Churn Risk & Retention Cockpit summary with predictive multi-factor scoring',
  })
  async getRetentionCockpit(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: RetentionQueryDto,
  ) {
    return this.retentionService.getRetentionCockpit(orgId, query);
  }

  @Post(':studentId/intervene')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({
    summary: 'Record and dispatch an active retention intervention playbook for an at-risk student',
  })
  async recordIntervention(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') actorId: string,
    @Param('studentId') studentId: string,
    @Body() dto: RecordInterventionDto,
  ) {
    return this.retentionService.recordIntervention(orgId, studentId, actorId, dto);
  }
}
