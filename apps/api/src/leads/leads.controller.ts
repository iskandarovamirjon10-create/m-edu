import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import {
  AddLeadActivityDto,
  ConvertLeadDto,
  CreateLeadDto,
  UpdateLeadDto,
  UpdateLeadStageDto,
} from '../common/dto';
import { LeadQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'List leads' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: LeadQuery) {
    return this.leadsService.findAll(orgId, query);
  }

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
