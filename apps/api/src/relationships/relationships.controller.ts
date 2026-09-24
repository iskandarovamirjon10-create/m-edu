import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RelationshipsService } from './relationships.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Relationships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORG_ADMIN, Role.SUPER_ADMIN)
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
    // Clamp a caller-supplied depth to [1,5]; fall back to 2 only when the
    // value is absent or unparseable. Treating 0 as "absent" (as a plain
    // `depth || 2` does) would silently widen the graph for an explicit 0.
    const parsed = depth === undefined ? Number.NaN : parseInt(depth, 10);
    const d = Number.isNaN(parsed) ? 2 : Math.max(1, Math.min(5, parsed));
    return this.relationshipsService.getGraph(orgId, entityType, entityId, d);
  }
}
