import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto } from '../common/dto';
import { GroupQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @AllowAnyRole()
  @Get()
  @ApiOperation({ summary: 'List groups' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: GroupQuery) {
    return this.groupsService.findAll(orgId, query);
  }

  @AllowAnyRole()
  @Get(':id')
  @ApiOperation({ summary: 'Get group details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.groupsService.findOne(orgId, id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a group' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Update a group' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Deactivate a group' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.groupsService.remove(orgId, id);
  }
}
