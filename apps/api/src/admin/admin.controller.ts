import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlatformGuard } from '../common/guards/platform.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('access-requests')
  @UseGuards(PlatformGuard)
  @ApiOperation({ summary: 'List all access requests (Platform Owner only)' })
  async getAccessRequests() {
    return this.adminService.getAccessRequests();
  }

  @Post('access-requests/:id/approve')
  @UseGuards(PlatformGuard)
  @ApiOperation({ summary: 'Approve an access request (Platform Owner only)' })
  async approveAccessRequest(
    @Param('id') id: string,
    @Body() body: { organizationId: string; role: string },
    @CurrentUser('sub') reviewerId: string
  ) {
    return this.adminService.approveAccessRequest(id, body.organizationId, body.role, reviewerId);
  }

  @Post('access-requests/:id/reject')
  @UseGuards(PlatformGuard)
  @ApiOperation({ summary: 'Reject an access request (Platform Owner only)' })
  async rejectAccessRequest(@Param('id') id: string, @CurrentUser('sub') reviewerId: string) {
    return this.adminService.rejectAccessRequest(id, reviewerId);
  }

  @Post('users/:id/suspend')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'PLATFORM_OWNER')
  @ApiOperation({ summary: 'Suspend a user' })
  async suspendUser(@Param('id') id: string, @CurrentUser() caller: any) {
    return this.adminService.updateUserStatus(id, 'SUSPENDED', caller);
  }

  @Post('users/:id/revoke')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN', 'PLATFORM_OWNER') // Org Admin can also revoke users from their own org
  @ApiOperation({ summary: 'Revoke a user completely' })
  async revokeUser(@Param('id') id: string, @CurrentUser() caller: any) {
    return this.adminService.updateUserStatus(id, 'REVOKED', caller);
  }
}
