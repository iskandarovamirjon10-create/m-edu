import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResourcesService } from './resources.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Resources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List resources' })
  async findAll(@CurrentUser('organizationId') orgId: string, @Query() query: any) {
    return this.resourcesService.findAll(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one resource' })
  async findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.resourcesService.findOne(orgId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create resource' })
  async create(@CurrentUser('organizationId') orgId: string, @Body() dto: any) {
    return this.resourcesService.create(orgId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update resource' })
  async update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: any) {
    return this.resourcesService.update(orgId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove resource' })
  async remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.resourcesService.remove(orgId, id);
  }
}
