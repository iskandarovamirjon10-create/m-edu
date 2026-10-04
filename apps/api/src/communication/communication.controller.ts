import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import { CreateAnnouncementDto, SendMessageDto } from './communication.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Communication & Announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('communication')
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @AllowAnyRole()
  @Post('messages')
  @Roles(...STAFF_ROLES, 'PARENT')
  @ApiOperation({ summary: 'Send direct message between parent and teacher regarding a student' })
  sendMessage(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser() sender: { id: string; role: string },
    @Body() dto: SendMessageDto,
  ) {
    return this.communicationService.sendMessage(orgId, sender, dto);
  }

  @AllowAnyRole()
  @Get('messages/student/:studentId')
  @Roles(...STAFF_ROLES, 'PARENT')
  @ApiOperation({ summary: 'Get communication history for a student' })
  getMessagesForStudent(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser() requester: { id: string; role: string },
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.communicationService.getMessagesForStudent(orgId, studentId, requester);
  }

  @AllowAnyRole()
  @Get('announcements')
  @Roles(...STAFF_ROLES, 'STUDENT', 'PARENT')
  @ApiOperation({ summary: 'Get active announcements' })
  findAllAnnouncements(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.communicationService.findAllAnnouncements(orgId, role);
  }

  @Post('announcements')
  @Roles(...STAFF_ROLES)
  @ApiOperation({ summary: 'Create an announcement' })
  createAnnouncement(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.communicationService.createAnnouncement(orgId, userId, dto);
  }
}

