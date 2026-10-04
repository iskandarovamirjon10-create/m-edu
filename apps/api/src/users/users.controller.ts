import { Request } from 'express';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto, UpdateUserSettingsDto } from '../common/dto';
import { UserQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestUser } from '../auth/types';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, AllowSelfService } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // RolesGuard denies by default when neither @Roles nor @AllowAnyRole is set,
  // so this route returned 403 for EVERY role (including SUPER_ADMIN). Listing
  // users must match the mutation routes below: admins only.
  @Get()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'List users' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: UserQuery) {
    return this.usersService.findAll(orgId, query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Get user details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.usersService.findOne(orgId, id);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Create a user' })
  create(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('role') role: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.create(orgId, dto, role);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Update a user' })
  update(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('role') role: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(orgId, id, dto, role, userId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Permanently delete a user (no Student/Teacher profile)' })
  remove(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    return this.usersService.remove(orgId, id, userId, role);
  }

  @Post('change-password')
  @AllowSelfService()
  @ApiOperation({ summary: 'Change own password' })
  changePassword(@Req() req: Request & { user: RequestUser }, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(
      req.user.organizationId,
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
      req.user.sid ?? null,
    );
  }

  @Patch(':id/settings')
  @AllowSelfService()
  @ApiOperation({ summary: 'Update user settings' })
  updateSettings(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserSettingsDto,
  ) {
    return this.usersService.updateSettings(orgId, id, dto, userId, role);
  }
}

