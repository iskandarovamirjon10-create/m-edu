import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HomeworkService } from './homework.service';
import { CreateHomeworkDto, UpdateHomeworkDto } from '../common/dto';
import { HomeworkQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Homework')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('homework')
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @AllowAnyRole()
  @Get()
  @ApiOperation({ summary: 'List homework' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: HomeworkQuery) {
    return this.homeworkService.findAll(orgId, query);
  }

  @AllowAnyRole()
  @Get(':id')
  @ApiOperation({ summary: 'Get homework details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.homeworkService.findOne(orgId, id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER')
  @ApiOperation({ summary: 'Create homework' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateHomeworkDto) {
    return this.homeworkService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER')
  @ApiOperation({ summary: 'Update homework' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id') id: string, @Body() dto: UpdateHomeworkDto) {
    return this.homeworkService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Delete homework' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.homeworkService.remove(orgId, id);
  }
}

