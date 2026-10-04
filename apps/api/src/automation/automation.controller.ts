import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AutomationService } from './automation.service';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto, ToggleAutomationRuleDto } from './dto/automation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Automation Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @AllowAnyRole()
  @Get('rules')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List automation rules' })
  listRules(@CurrentUser('organizationId') orgId: string) {
    return this.automationService.listRules(orgId);
  }

  @Post('rules')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create automation rule' })
  createRule(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateAutomationRuleDto,
  ) {
    return this.automationService.createRule(orgId, dto, userId);
  }

  @AllowAnyRole()
  @Get('rules/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get automation rule' })
  getRule(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.automationService.getRule(orgId, id);
  }

  @Patch('rules/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Update automation rule' })
  updateRule(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    return this.automationService.updateRule(orgId, id, dto);
  }

  @Delete('rules/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete automation rule' })
  deleteRule(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.automationService.deleteRule(orgId, id);
  }

  @Patch('rules/:id/toggle')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Toggle automation rule' })
  toggleRule(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: ToggleAutomationRuleDto,
  ) {
    return this.automationService.toggleRule(orgId, id, dto.isActive);
  }

  @Post('rules/:id/evaluate')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Manually evaluate a rule' })
  evaluateRule(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.automationService.evaluateRule(orgId, id);
  }

  @Post('evaluate-all')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Evaluate all active rules' })
  evaluateAllRules(@CurrentUser('organizationId') orgId: string) {
    return this.automationService.evaluateAllRules(orgId);
  }

  @AllowAnyRole()
  @Get('executions')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get execution history' })
  getExecutions(
    @CurrentUser('organizationId') orgId: string,
    @Query('ruleId') ruleId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.automationService.getExecutions(orgId, ruleId, limit ? parseInt(limit, 10) : undefined);
  }

  @AllowAnyRole()
  @Get('rules/:id/stats')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get rule statistics' })
  getRuleStats(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.automationService.getRuleStats(orgId, id);
  }

  @AllowAnyRole()
  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get overall automation statistics' })
  getOverallStats(@CurrentUser('organizationId') orgId: string) {
    return this.automationService.getOverallStats(orgId);
  }
}

