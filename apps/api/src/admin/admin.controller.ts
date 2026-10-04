import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('access-requests')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all access requests' })
  async getAccessRequests() {
    return this.adminService.getAccessRequests();
  }

  @Post('access-requests/:id/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve an access request' })
  async approveAccessRequest(
    @Param('id') id: string,
    @Body() body: { organizationId: string; role: string },
    @CurrentUser('sub') reviewerId: string
  ) {
    return this.adminService.approveAccessRequest(id, body.organizationId, body.role, reviewerId);
  }

  @Post('access-requests/:id/reject')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject an access request' })
  async rejectAccessRequest(@Param('id') id: string, @CurrentUser('sub') reviewerId: string) {
    return this.adminService.rejectAccessRequest(id, reviewerId);
  }

  @Post('users/:id/suspend')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Suspend a user' })
  async suspendUser(@Param('id') id: string, @CurrentUser() caller: any) {
    return this.adminService.updateUserStatus(id, 'SUSPENDED', caller);
  }

  @Post('users/:id/revoke')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN') // Org Admin can also revoke users from their own org
  @ApiOperation({ summary: 'Revoke a user completely' })
  async revokeUser(@Param('id') id: string, @CurrentUser() caller: any) {
    return this.adminService.updateUserStatus(id, 'REVOKED', caller);
  }
}
