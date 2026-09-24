import { Controller, Get, Put, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DataGovernanceService } from './data-governance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpsertRetentionPolicyDto, ExportLogQueryDto, AccessAuditQueryDto } from './dto/data-governance.dto';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Data Governance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('data-governance')
export class DataGovernanceController {
  constructor(private readonly service: DataGovernanceService) {}

  @AllowAnyRole()
  @Get('retention-policies')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'List data retention policies' })
  async getRetentionPolicies(
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.service.getRetentionPolicies(orgId);
  }

  @Put('retention-policies')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create or update a retention policy' })
  async upsertRetentionPolicy(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: UpsertRetentionPolicyDto,
  ) {
    return this.service.upsertRetentionPolicy(
      orgId,
      dto.dataType,
      dto.retentionDays ?? 2555,
      dto.archivalDays ?? null,
      dto.deleteAfterDays ?? null,
      dto.isActive ?? true,
    );
  }

  @AllowAnyRole()
  @Get('export-log')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Paginated export audit log' })
  async getExportLog(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: ExportLogQueryDto,
  ) {
    return this.service.getExportLog(orgId, query);
  }

  @AllowAnyRole()
  @Get('export-stats')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Export statistics' })
  async getExportStats(
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.service.getExportStats(orgId);
  }

  @AllowAnyRole()
  @Get('access-audit')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Data access audit from AuditLog' })
  async getDataAccessAudit(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: AccessAuditQueryDto,
  ) {
    return this.service.getDataAccessAudit(orgId, query);
  }

  @Post('retention-check')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Run retention check (notify only, no deletes)' })
  async executeRetentionCheck(
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.service.executeRetentionCheck(orgId);
  }
}

