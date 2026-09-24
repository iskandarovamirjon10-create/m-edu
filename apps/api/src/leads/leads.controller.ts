import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { FollowUpAutomationService } from './follow-up-automation.service';
import {
  AddLeadActivityDto,
  ConvertLeadDto,
  CreateLeadDto,
  UpdateLeadDto,
  UpdateLeadStageDto,
} from '../common/dto';
import { LeadQuery } from '../common/dto/query';
import { CreateFollowUpRuleDto, UpdateFollowUpRuleDto } from './dto/follow-up-rule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly followUpService: FollowUpAutomationService,
  ) {}

  @AllowAnyRole()
  @Get()
  @ApiOperation({ summary: 'List leads' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: LeadQuery) {
    return this.leadsService.findAll(orgId, query);
  }

  // ---------------------------------------------------------------------------
  // Follow-up automation.
  //
  // NOTE: these static routes MUST be declared before the parameterized `:id`
  // routes below — NestJS matches in declaration order, so
  // `GET /leads/follow-up-rules` would otherwise be captured by `GET /leads/:id`.
  // The web client calls every one of these paths (apps/web/src/lib/api.ts).
  // ---------------------------------------------------------------------------

  @AllowAnyRole()
  @Get('follow-up-rules')
  @ApiOperation({ summary: 'List follow-up automation rules' })
  getFollowUpRules(@CurrentUser('organizationId') orgId: string) {
    return this.followUpService.getRules(orgId);
  }

  @AllowAnyRole()
  @Get('follow-ups')
  @ApiOperation({ summary: 'List overdue follow-ups' })
  getFollowUps(@CurrentUser('organizationId') orgId: string) {
    return this.followUpService.getOverdueFollowUps(orgId);
  }

  @AllowAnyRole()
  @Get('follow-ups/stats')
  @ApiOperation({ summary: 'Follow-up statistics' })
  getFollowUpStats(@CurrentUser('organizationId') orgId: string) {
    return this.followUpService.getFollowUpStats(orgId);
  }

  @Post('follow-up-rules')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a follow-up automation rule' })
  createFollowUpRule(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateFollowUpRuleDto,
  ) {
    return this.followUpService.createRule(orgId, dto);
  }

  @Post('follow-up-rules/evaluate')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Evaluate follow-up automation rules now' })
  evaluateFollowUpRules(@CurrentUser('organizationId') orgId: string) {
    return this.followUpService.evaluateRules(orgId);
  }

  @Patch('follow-up-rules/:id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update a follow-up automation rule' })
  updateFollowUpRule(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFollowUpRuleDto,
  ) {
    return this.followUpService.updateRule(orgId, id, dto);
  }

  @Delete('follow-up-rules/:id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Delete a follow-up automation rule' })
  deleteFollowUpRule(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.followUpService.deleteRule(orgId, id);
  }

  @Post('follow-ups/:id/complete')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Mark a follow-up as complete' })
  completeFollowUp(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.followUpService.markFollowUpComplete(orgId, id);
  }

  @AllowAnyRole()
  @Get(':id')
  @ApiOperation({ summary: 'Get lead details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.leadsService.findOne(orgId, id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a lead' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update a lead' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(orgId, id, dto);
  }

  @Patch(':id/stage')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update lead stage' })
  updateStage(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadStageDto,
  ) {
    return this.leadsService.updateStage(orgId, id, dto.stage, dto.lostReason);
  }

  @Post(':id/convert')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Convert lead to student' })
  convert(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leadsService.convert(orgId, id, dto);
  }

  @Post(':id/activities')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Add lead activity' })
  addActivity(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: AddLeadActivityDto,
  ) {
    return this.leadsService.addActivity(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Delete a lead' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.leadsService.remove(orgId, id);
  }
}
