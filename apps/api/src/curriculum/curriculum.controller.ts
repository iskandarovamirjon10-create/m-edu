import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurriculumService } from './curriculum.service';
import {
  CreateCurriculumDto,
  UpdateCurriculumDto,
  CreateModuleDto,
  CreateTopicDto,
  CreateObjectiveDto,
} from './curriculum.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES, STAFF_ROLES } from '../auth/authorization.policy';

@ApiTags('Curriculum')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List curriculums' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: { subjectId?: string; courseId?: string }) {
    return this.curriculumService.findAll(orgId, query);
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get curriculum full hierarchy' })
  findOne(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.curriculumService.findOne(orgId, id);
  }

  @Post()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a new curriculum' })
  create(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateCurriculumDto,
  ) {
    return this.curriculumService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update an existing curriculum' })
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurriculumDto,
  ) {
    return this.curriculumService.update(orgId, id, dto);
  }

  @Post(':id/modules')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Add module to curriculum' })
  addModule(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateModuleDto,
  ) {
    return this.curriculumService.addModule(orgId, id, dto);
  }

  @Post(':id/modules/:moduleId/topics')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Add topic to curriculum module' })
  addTopic(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CreateTopicDto,
  ) {
    return this.curriculumService.addTopic(orgId, id, moduleId, dto);
  }

  @Post(':id/topics/:topicId/objectives')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Add learning objective to topic' })
  addObjective(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Body() dto: CreateObjectiveDto,
  ) {
    return this.curriculumService.addObjective(orgId, id, topicId, dto);
  }
}
