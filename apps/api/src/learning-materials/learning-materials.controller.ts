import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LearningMaterialsService, MaterialQuery } from './learning-materials.service';
import { CreateFolderDto, CreateMaterialDto } from './material.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Learning Materials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('learning-materials')
export class LearningMaterialsController {
  constructor(private readonly materialsService: LearningMaterialsService) {}

  @AllowAnyRole()
  @Get()
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'List accessible learning materials' })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('role') role: string,
    @Query() query: MaterialQuery,
  ) {
    return this.materialsService.findAll(orgId, query, role);
  }

  @AllowAnyRole()
  @Get('folders')
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'List LMS folders' })
  getFolders(
    @CurrentUser('organizationId') orgId: string,
    @Query('parentId') parentId?: string,
  ) {
    return this.materialsService.getFolders(orgId, parentId);
  }

  @Post('folders')
  @Roles(...ADMIN_ROLES, 'TEACHER')
  @ApiOperation({ summary: 'Create LMS folder' })
  createFolder(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.materialsService.createFolder(orgId, dto);
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Get learning material details' })
  findOne(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('role') role: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.materialsService.findOne(orgId, id, role);
  }

  @Post()
  @Roles(...ADMIN_ROLES, 'TEACHER')
  @ApiOperation({ summary: 'Upload/Register a new learning material' })
  create(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateMaterialDto,
  ) {
    return this.materialsService.create(orgId, dto);
  }
}

