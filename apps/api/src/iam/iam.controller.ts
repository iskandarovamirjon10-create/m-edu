import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { IAMService } from './iam.service';
import { PlatformGuard } from '../common/guards/platform.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/types';
import {
  AssignMembershipDto,
  BulkProvisionDto,
  CreateAccountDto,
  CreateOrganizationDto,
  ResetAccountPasswordDto,
  UpdateAccountDto,
  UpdateOrganizationDto,
} from './iam.dto';

@ApiTags('IAM - Centralized Identity & Access Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformGuard)
@Controller('iam')
export class IAMController {
  constructor(private readonly iamService: IAMService) {}

  // ==================== Organization Endpoints ====================

  @Post('organizations')
  @ApiOperation({ summary: 'Create a new organization (PLATFORM_OWNER only)' })
  createOrganization(
    @Body() dto: CreateOrganizationDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.createOrganization(dto, req.user.sub || req.user.id);
  }

  @Patch('organizations/:id')
  @ApiOperation({ summary: 'Update organization metadata (PLATFORM_OWNER only)' })
  updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.updateOrganization(id, dto, req.user.sub || req.user.id);
  }

  @Post('organizations/:id/activate')
  @ApiOperation({ summary: 'Activate an organization (PLATFORM_OWNER only)' })
  activateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.activateOrganization(id, req.user.sub || req.user.id);
  }

  @Post('organizations/:id/suspend')
  @ApiOperation({ summary: 'Suspend an organization and invalidate all its active sessions' })
  suspendOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.suspendOrganization(id, req.user.sub || req.user.id);
  }

  @Get('organizations/:id/memberships')
  @ApiOperation({ summary: 'List all memberships of an organization' })
  getOrganizationMemberships(@Param('id', ParseUUIDPipe) id: string) {
    return this.iamService.getOrganizationMemberships(id);
  }

  @Get('organizations/:id/statistics')
  @ApiOperation({ summary: 'Get account and role statistics for an organization' })
  getOrganizationStatistics(@Param('id', ParseUUIDPipe) id: string) {
    return this.iamService.getOrganizationStatistics(id);
  }

  // ==================== Account Endpoints ====================

  @Post('accounts')
  @ApiOperation({ summary: 'Provision a new individual user account (PLATFORM_OWNER only)' })
  createAccount(
    @Body() dto: CreateAccountDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.createAccount(dto, req.user.sub || req.user.id);
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: 'Update permitted profile attributes of an account' })
  updateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.updateAccount(id, dto, req.user.sub || req.user.id);
  }

  @Post('accounts/:id/activate')
  @ApiOperation({ summary: 'Activate a user account' })
  activateAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.activateAccount(id, req.user.sub || req.user.id);
  }

  @Post('accounts/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user account and invalidate active sessions' })
  suspendAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.suspendAccount(id, req.user.sub || req.user.id);
  }

  @Post('accounts/:id/reset-password')
  @ApiOperation({ summary: 'Reset a user password administratively (PLATFORM_OWNER only)' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetAccountPasswordDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.resetPassword(id, dto, req.user.sub || req.user.id);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get full account details, memberships, and status' })
  getAccount(@Param('id', ParseUUIDPipe) id: string) {
    return this.iamService.getAccount(id);
  }

  @Get('accounts/:id/security-history')
  @ApiOperation({ summary: 'Get security audit history of an account' })
  getAccountSecurityHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.iamService.getAccountSecurityHistory(id);
  }

  @Post('accounts/:id/memberships')
  @ApiOperation({ summary: 'Assign an organization membership and role to a user' })
  assignMembership(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignMembershipDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.assignMembership(id, dto, req.user.sub || req.user.id);
  }

  @Delete('accounts/:id/memberships/:orgId')
  @ApiOperation({ summary: 'Revoke an organization membership' })
  revokeMembership(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.revokeMembership(id, orgId, req.user.sub || req.user.id);
  }

  // ==================== Bulk Provisioning ====================

  @Post('bulk/preview')
  @ApiOperation({ summary: 'Validate and preview bulk accounts before confirmation' })
  previewBulk(@Body() dto: BulkProvisionDto) {
    return this.iamService.previewBulk(dto.records);
  }

  @Post('bulk/commit')
  @ApiOperation({ summary: 'Commit validated bulk accounts in safe transaction boundaries' })
  commitBulk(
    @Body() dto: BulkProvisionDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.commitBulk(dto.records, req.user.sub || req.user.id);
  }

  @Post('bulk/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload Excel/CSV file to preview bulk provisioning records' })
  async uploadBulkFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('A valid spreadsheet file is required');
    }
    const records = await this.iamService.parseExcelBuffer(file.buffer);
    return this.iamService.previewBulk(records);
  }

  // ==================== Security Center & Radar ====================

  @Get('security/overview')
  @ApiOperation({ summary: 'Get IAM Security Radar overview KPI statistics' })
  getSecurityOverview() {
    return this.iamService.getSecurityOverview();
  }

  @Get('security/sessions')
  @ApiOperation({ summary: 'Get all active sessions across organizations' })
  getActiveSessions(@Query('limit') limit?: number) {
    return this.iamService.getActiveSessions(limit ? Number(limit) : 50);
  }

  @Delete('security/sessions/:id')
  @ApiOperation({ summary: 'Administrative session termination kill-switch' })
  terminateSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.iamService.terminateSession(id, req.user.sub || req.user.id);
  }

  @Get('security/events')
  @ApiOperation({ summary: 'Get recent security events log' })
  getSecurityEvents(@Query('limit') limit?: number) {
    return this.iamService.getSecurityEvents(limit ? Number(limit) : 50);
  }
}
