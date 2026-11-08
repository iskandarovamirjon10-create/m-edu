import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto } from '../common/dto';
import { GroupQuery } from '../common/dto/query';
import { BulkGroupRoomDto, BulkGroupStatusDto, BulkGroupTeacherDto } from './dto/groups-bulk.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';
import type { RequestUser } from '../auth/types';

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @AllowAnyRole()
  @Get()
  @ApiOperation({ summary: 'List groups' })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser() userOrQuery: RequestUser | GroupQuery,
    @Query() queryOrUser?: GroupQuery | RequestUser,
  ) {
    let user: RequestUser | undefined;
    let query: GroupQuery = {};
    if (userOrQuery && typeof userOrQuery === 'object' && ('role' in userOrQuery || 'sub' in userOrQuery)) {
      user = userOrQuery as RequestUser;
      query = (queryOrUser as GroupQuery) || {};
    } else {
      query = (userOrQuery as GroupQuery) || {};
      user = queryOrUser && typeof queryOrUser === 'object' && ('role' in queryOrUser || 'sub' in queryOrUser)
        ? (queryOrUser as RequestUser)
        : undefined;
    }
    return user
      ? this.groupsService.findAll(orgId, query, user)
      : this.groupsService.findAll(orgId, query);
  }

  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @Get('stats')
  @ApiOperation({ summary: 'Get aggregated group statistics and occupancy metrics' })
  getStats(@CurrentUser('organizationId') orgId: string) {
    return this.groupsService.getStats(orgId);
  }

  @Post('bulk/status')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Bulk update group active statuses' })
  bulkStatus(@CurrentUser('organizationId') orgId: string, @Body() dto: BulkGroupStatusDto) {
    return this.groupsService.bulkStatus(orgId, dto);
  }

  @Post('bulk/teacher')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Bulk assign teacher to groups' })
  bulkTeacher(@CurrentUser('organizationId') orgId: string, @Body() dto: BulkGroupTeacherDto) {
    return this.groupsService.bulkTeacher(orgId, dto);
  }

  @Post('bulk/room')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Bulk assign room to groups' })
  bulkRoom(@CurrentUser('organizationId') orgId: string, @Body() dto: BulkGroupRoomDto) {
    return this.groupsService.bulkRoom(orgId, dto);
  }

  @AllowAnyRole()
  @Get(':id')
  @ApiOperation({ summary: 'Get group details' })
  findOne(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser() userOrId: RequestUser | string,
    @Param('id') idOrUser?: string | RequestUser,
  ) {
    let user: RequestUser | undefined;
    let id: string = '';
    if (typeof userOrId === 'string') {
      id = userOrId;
      user = idOrUser && typeof idOrUser === 'object' && ('role' in idOrUser || 'sub' in idOrUser)
        ? (idOrUser as RequestUser)
        : undefined;
    } else {
      user = userOrId;
      id = typeof idOrUser === 'string' ? idOrUser : '';
    }
    return user
      ? this.groupsService.findOne(orgId, id, user)
      : this.groupsService.findOne(orgId, id);
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

  @AllowAnyRole()
  @Get(':id/capacity')
  @ApiOperation({ summary: 'Get real-time group capacity, occupancy rate and available seats' })
  getCapacity(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.groupsService.getGroupCapacityAndOccupancy(orgId, id);
  }

  @Post(':id/graduate')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Batch graduate students and promote to next level group' })
  graduate(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body()
    body: {
      studentIds: string[];
      targetGroupId?: string;
      targetGroupName?: string;
      targetCourseId?: string;
      archiveOldGroup?: boolean;
    },
  ) {
    return this.groupsService.graduateAndPromote(orgId, id, body);
  }
}
