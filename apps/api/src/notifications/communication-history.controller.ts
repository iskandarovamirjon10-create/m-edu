import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CommunicationHistoryService } from './communication-history.service';
import { HistoryFiltersDto } from './dto/communication-history.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { RequestUser } from '../auth/types';

@ApiTags('Communication History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('communication')
export class CommunicationHistoryController {
  constructor(private readonly communicationHistory: CommunicationHistoryService) {}

  @Get('history')
  @ApiOperation({ summary: 'List communication history for the organization' })
  getHistory(
    @Req() req: Request & { user: RequestUser },
    @Query() query: HistoryFiltersDto,
  ) {
    return this.communicationHistory.getHistory(req.user.organizationId, query);
  }

  @Get('timeline')
  @ApiOperation({ summary: 'Get communication timeline for an entity' })
  getTimeline(
    @Req() req: Request & { user: RequestUser },
    @Query() query: HistoryFiltersDto,
  ) {
    return this.communicationHistory.getTimeline(
      req.user.organizationId,
      query.entityType ?? '',
      query.entityId ?? '',
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get communication delivery statistics' })
  getStats(
    @Req() req: Request & { user: RequestUser },
    @Query() query: HistoryFiltersDto,
  ) {
    return this.communicationHistory.getStats(req.user.organizationId, {
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }
}
