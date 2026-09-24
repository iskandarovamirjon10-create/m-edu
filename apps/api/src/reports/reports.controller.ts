import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { ReportBuilderService } from './report-builder.service';
import { AllowAnyRole, Roles } from '../auth/roles.decorator';
import {
  ExportReportDto,
  RunReportParamsDto,
  SaveReportDefinitionDto,
} from './dto/report.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportBuilderService) {}

  @AllowAnyRole()
  @Get('designs')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List available report designs and their whitelisted columns' })
  listDesigns() {
    return this.reports.listDesigns();
  }

  @AllowAnyRole()
  @Get('designs/:type')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get one report design' })
  getDesign(@Param('type') type: string) {
    return this.reports.getDesign(type);
  }

  @Post('run')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Run a report over real data (preview + pagination)' })
  run(@CurrentUser('organizationId') orgId: string, @Body() params: RunReportParamsDto) {
    return this.reports.run(orgId, params);
  }

  @Post('definitions')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Save a report definition' })
  saveDefinition(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: SaveReportDefinitionDto,
  ) {
    return this.reports.saveDefinition(orgId, userId, body);
  }

  @AllowAnyRole()
  @Get('definitions')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List saved report definitions' })
  listDefinitions(@CurrentUser('organizationId') orgId: string) {
    return this.reports.listDefinitions(orgId);
  }

  @Post('definitions/:id/run')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Run a saved report definition' })
  runSaved(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.runSaved(orgId, id);
  }

  @Delete('definitions/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Delete a saved report definition' })
  deleteDefinition(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.reports.deleteDefinition(orgId, id);
  }

  @Post('export')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Export a report as csv/xlsx/pdf with proper pagination limits' })
  async exportReport(
    @CurrentUser('organizationId') orgId: string,
    @Body() body: ExportReportDto,
    @Res() res: Response,
  ) {
    const format = body.format ?? 'csv';
    if (!['csv', 'xlsx', 'pdf'].includes(format)) {
      return res.status(400).json({ statusCode: 400, message: `Unsupported format: ${format}` });
    }
    const { buffer, contentType, extension } = await this.reports.exportResult(orgId, body.params, format);
    res.setHeader('Content-Disposition', `attachment; filename="report_${body.params.type}.${extension}"`);
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  }
}

