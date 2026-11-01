import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto } from '../common/dto';
import { CourseQuery } from '../common/dto/query';
import { BulkCoursePriceDto, BulkCourseStatusDto } from './dto/courses-bulk.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';

@ApiTags('Courses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List all courses' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: CourseQuery) {
    return this.coursesService.findAll(orgId, query);
  }

  @Get('stats')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get aggregated course statistics and popularity metrics' })
  getStats(@CurrentUser('organizationId') orgId: string) {
    return this.coursesService.getStats(orgId);
  }

  @Post('bulk/status')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk update courses active status' })
  bulkStatus(@CurrentUser('organizationId') orgId: string, @Body() dto: BulkCourseStatusDto) {
    return this.coursesService.bulkStatus(orgId, dto);
  }

  @Post('bulk/price')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Bulk update or adjust course tuition prices' })
  bulkPrice(@CurrentUser('organizationId') orgId: string, @Body() dto: BulkCoursePriceDto) {
    return this.coursesService.bulkPrice(orgId, dto);
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get course details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.coursesService.findOne(orgId, id);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a new course' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update course' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Deactivate course' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.coursesService.remove(orgId, id);
  }
}
