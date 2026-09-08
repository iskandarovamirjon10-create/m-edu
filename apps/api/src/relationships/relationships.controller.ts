import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RelationshipsService } from './relationships.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Relationships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('relationships')
export class RelationshipsController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  @Get('graph')
  @ApiOperation({ summary: 'Get the relationship graph for a root entity' })
  async getGraph(
    @CurrentUser('organizationId') orgId: string,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('depth') depth?: string,
  ) {
    const d = depth ? Math.max(1, Math.min(5, parseInt(depth, 10) || 2)) : 2;
    return this.relationshipsService.getGraph(orgId, entityType, entityId, d);
  }
}
