import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, AllowSelfService } from '../auth/roles.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/types';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentQueryDto,
  UploadDocumentVersionDto,
} from './dto/document.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @AllowSelfService()
  @ApiOperation({ summary: 'List documents for the organization' })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: DocumentQueryDto,
  ) {
    return this.documentsService.findAll(user, query);
  }

  @Get(':id')
  @AllowSelfService()
  @ApiOperation({ summary: 'Get a document by ID' })
  async findOne(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const doc = await this.documentsService.findOne(user, id);
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  @Post()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create a new document record' })
  async create(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateDocumentDto,
  ) {
    if (!user.sub) {
      throw new ForbiddenException('Authenticated user is required');
    }
    return this.documentsService.create(user.organizationId, {
      ...body,
      uploadedBy: user.sub,
    });
  }

  @Put(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Update a document' })
  async update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: UpdateDocumentDto,
  ) {
    const updated = await this.documentsService.update(organizationId, id, body);
    if (!updated) throw new NotFoundException('Document not found');
    return updated;
  }

  @Delete(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Delete a document' })
  async delete(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    const deleted = await this.documentsService.delete(organizationId, id);
    if (!deleted) throw new NotFoundException('Document not found');
    return deleted;
  }

  @Post(':id/versions')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Upload a new version of a document' })
  async uploadVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: UploadDocumentVersionDto,
  ) {
    if (!user.sub) {
      throw new ForbiddenException('Authenticated user is required');
    }
    const version = await this.documentsService.uploadVersion(user.organizationId, id, {
      ...body,
      uploadedBy: user.sub,
    });
    if (!version) throw new NotFoundException('Document not found');
    return version;
  }
}
