import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '@prisma/client';
import { AuditQueryDto, AuditResponseDto } from './audit.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORG_ADMIN, Role.SUPER_ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  private resolveOrgId(orgOrReq: string | { user?: { organizationId?: string } }): string {
    if (typeof orgOrReq === 'string' && orgOrReq.trim()) {
      return orgOrReq.trim();
    }
    if (orgOrReq && typeof orgOrReq === 'object' && typeof orgOrReq.user?.organizationId === 'string' && orgOrReq.user.organizationId.trim()) {
      return orgOrReq.user.organizationId.trim();
    }
    throw new ForbiddenException('Organization context is required');
  }

  @Get()
  @ApiOperation({ summary: 'List all audit events for the organization' })
  @ApiResponse({ status: 200, description: 'Paginated audit events', type: AuditResponseDto })
  async findAll(
    @CurrentUser('organizationId') orgOrReq: string | { user?: { organizationId?: string } },
    @Query() query: AuditQueryDto,
  ): Promise<AuditResponseDto> {
    const orgId = this.resolveOrgId(orgOrReq);
    return this.auditService.findAll(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single audit event by ID' })
  @ApiResponse({ status: 200, description: 'Audit event detail' })
  async findOne(
    @CurrentUser('organizationId') orgOrReq: string | { user?: { organizationId?: string } },
    @Param('id') id: string,
  ) {
    const orgId = this.resolveOrgId(orgOrReq);
    return this.auditService.findOne(orgId, id);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get change history for a specific entity' })
  async getEntityHistory(
    @CurrentUser('organizationId') orgOrReq: string | { user?: { organizationId?: string } },
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    const orgId = this.resolveOrgId(orgOrReq);
    return this.auditService.getEntityHistory(orgId, entityType, entityId);
  }
}
