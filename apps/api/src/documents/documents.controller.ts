import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, Req, UseGuards, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents for the organization' })
  async findAll(
    @Req() req: Request & { user: { organizationId: string } },
    @Query() query: any,
  ) {
    return this.documentsService.findAll(req.user.organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document by ID' })
  async findOne(
    @Req() req: Request & { user: { organizationId: string } },
    @Param('id') id: string,
  ) {
    const doc = await this.documentsService.findOne(req.user.organizationId, id);
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new document record' })
  async create(
    @Req() req: Request & { user: { organizationId: string; id?: string; sub?: string } },
    @Body() body: any,
  ) {
    const uploadedBy = req.user.id ?? req.user.sub;
    if (!uploadedBy) throw new BadRequestException('Authenticated user is required');
    return this.documentsService.create(req.user.organizationId, { ...body, uploadedBy });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a document' })
  async update(
    @Req() req: Request & { user: { organizationId: string } },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const updated = await this.documentsService.update(req.user.organizationId, id, body);
    if (!updated) throw new NotFoundException('Document not found');
    return updated;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  async delete(
    @Req() req: Request & { user: { organizationId: string } },
    @Param('id') id: string,
  ) {
    return this.documentsService.delete(req.user.organizationId, id);
  }

  @Post(':id/versions')
  @ApiOperation({ summary: 'Upload a new version of a document' })
  async uploadVersion(
    @Req() req: Request & { user: { organizationId: string; id?: string; sub?: string } },
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const uploadedBy = req.user.id ?? req.user.sub;
    if (!uploadedBy) throw new BadRequestException('Authenticated user is required');
    return this.documentsService.uploadVersion(req.user.organizationId, id, { ...body, uploadedBy });
  }
}
