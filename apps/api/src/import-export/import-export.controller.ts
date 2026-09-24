import {
  Controller, Get, Post, Query, Body, UseGuards, UseInterceptors,
  UploadedFile, Res, Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ImportExportService, StartImportDto, ImportListQuery, ExportListQuery } from './import-export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Import / Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORG_ADMIN, Role.SUPER_ADMIN)
@Controller()
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  // ---- Imports -------------------------------------------------------------

  @Get('imports')
  @ApiOperation({ summary: 'List import jobs' })
  async listImports(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: ImportListQuery,
  ) {
    return this.importExportService.listImports(orgId, query);
  }

  @Post('imports')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Start a new import job' })
  async startImport(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: StartImportDto,
    @UploadedFile() file?: any,
  ) {
    return this.importExportService.startImport(orgId, dto, file);
  }

  // ---- Exports -------------------------------------------------------------

  @Get('exports')
  @ApiOperation({ summary: 'List export jobs' })
  async listExports(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: ExportListQuery,
  ) {
    return this.importExportService.listExports(orgId, query);
  }

  @Get('template')
  @ApiOperation({ summary: 'Download a CSV template for an entity type' })
  async downloadTemplate(
    @CurrentUser('organizationId') orgId: string,
    @Query('entityType') entityType: string,
    @Res() res: Response,
  ) {
    const buffer = await this.importExportService.downloadTemplate(orgId, entityType);
    res.setHeader('Content-Disposition', `attachment; filename="${entityType.toLowerCase()}_template.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(buffer);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export data as CSV for an entity type' })
  async exportData(
    @CurrentUser('organizationId') orgId: string,
    @Query('entityType') entityType: string,
    @Query('format') format: string = 'csv',
    @Res() res: Response,
  ) {
    const buffer = await this.importExportService.exportData(orgId, entityType, format);
    res.setHeader('Content-Disposition', `attachment; filename="${entityType.toLowerCase()}_export.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(buffer);
  }
}
