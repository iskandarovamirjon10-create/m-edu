import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PaginationQuery } from '../common/dto/query';

@ApiTags('Workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('rules')
  @ApiOperation({ summary: 'List workflow rules' })
  async list(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: PaginationQuery,
  ) {
    return this.workflowService.listRules(orgId, query);
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get a single workflow rule' })
  async getRule(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.workflowService.getRule(orgId, id);
  }

  @Get('instances')
  @ApiOperation({ summary: 'List recent workflow instances' })
  async instances(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: PaginationQuery,
  ) {
    return this.workflowService.listInstances(orgId, query);
  }
}
