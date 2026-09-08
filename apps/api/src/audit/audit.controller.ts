import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditQueryDto, AuditResponseDto } from './audit.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List all audit events for the organization' })
  @ApiResponse({ status: 200, description: 'Paginated audit events', type: AuditResponseDto })
  async findAll(
    @Req() req: Request & { user: { organizationId: string } },
    @Query() query: AuditQueryDto,
  ): Promise<AuditResponseDto> {
    return this.auditService.findAll(req.user.organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single audit event by ID' })
  @ApiResponse({ status: 200, description: 'Audit event detail' })
  async findOne(
    @Req() req: Request & { user: { organizationId: string } },
    @Param('id') id: string,
  ) {
    return this.auditService.findOne(req.user.organizationId, id);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get change history for a specific entity' })
  async getEntityHistory(
    @Req() req: Request & { user: { organizationId: string } },
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getEntityHistory(req.user.organizationId, entityType, entityId);
  }
}
