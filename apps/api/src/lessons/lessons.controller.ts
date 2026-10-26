import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LessonsService, LessonQuery } from './lessons.service';
import { LinkLessonMaterialDto, UpdateLessonContentDto, UpdateLessonStatusDto } from './lesson.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';

@ApiTags('Lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'List academic lessons' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: LessonQuery) {
    return this.lessonsService.findAll(orgId, query);
  }

  @Get(':id/copilot-analysis')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get AI Lesson Copilot analytics, at-risk student interventions and differentiated tasks' })
  getCopilotAnalysis(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lessonsService.getLessonCopilotAnalysis(orgId, id);
  }

  @Get(':id')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Get full lesson details with pedagogical content' })
  findOne(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lessonsService.findOne(orgId, id);
  }

  @Patch(':id/status')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Update lesson status (START, COMPLETE, CANCEL)' })
  updateStatus(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonStatusDto,
  ) {
    return this.lessonsService.updateStatus(orgId, id, dto);
  }

  @Patch(':id/content')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Update lesson curriculum topic and notes' })
  updateContent(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonContentDto,
  ) {
    return this.lessonsService.updateContent(orgId, id, dto);
  }

  @Post(':id/materials')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Link learning material to lesson' })
  linkMaterial(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkLessonMaterialDto,
  ) {
    return this.lessonsService.linkMaterial(orgId, id, dto.materialId);
  }

  @Delete(':id/materials/:materialId')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Unlink learning material from lesson' })
  unlinkMaterial(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('materialId', ParseUUIDPipe) materialId: string,
  ) {
    return this.lessonsService.unlinkMaterial(orgId, id, materialId);
  }
}
