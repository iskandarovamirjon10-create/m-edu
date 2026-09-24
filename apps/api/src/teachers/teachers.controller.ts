import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto, UpdateTeacherDto } from '../common/dto';
import { TeacherQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';

@ApiTags('Teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List teachers' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: TeacherQuery) {
    return this.teachersService.findAll(orgId, query);
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get teacher details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.teachersService.findOne(orgId, id);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a teacher' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateTeacherDto) {
    return this.teachersService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a teacher' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachersService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Delete a teacher (not assigned to groups) or deactivate otherwise' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.teachersService.remove(orgId, id);
  }
}
