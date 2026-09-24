import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GradesService } from './grades.service';
import { CreateGradeDto, UpdateGradeDto } from '../common/dto';
import { GradeQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Grades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @AllowAnyRole()
  @Get()
  @ApiOperation({ summary: 'List grades' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: GradeQuery) {
    return this.gradesService.findAll(orgId, query);
  }

  @AllowAnyRole()
  @Get(':id')
  @ApiOperation({ summary: 'Get grade details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.gradesService.findOne(orgId, id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER')
  @ApiOperation({ summary: 'Create a grade' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateGradeDto) {
    return this.gradesService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER')
  @ApiOperation({ summary: 'Update a grade' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: UpdateGradeDto) {
    return this.gradesService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Delete a grade' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.gradesService.remove(orgId, id);
  }
}
