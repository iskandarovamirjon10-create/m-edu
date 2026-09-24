import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, RotateApiKeyDto } from './dto/api-key.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @AllowAnyRole()
  @Get('scopes')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Get available API key scopes' })
  @ApiResponse({ status: 200, description: 'List of available scopes returned successfully.' })
  async scopes() {
    return this.apiKeysService.getScopes();
  }

  @AllowAnyRole()
  @Get('usage')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Get API key usage statistics' })
  @ApiQuery({ name: 'keyId', required: false, description: 'Optional specific key ID to filter usage' })
  @ApiResponse({ status: 200, description: 'API key usage statistics returned successfully.' })
  async usageStats(
    @CurrentUser('organizationId') orgId: string,
    @Query('keyId') keyId?: string,
  ) {
    return this.apiKeysService.getUsageStats(orgId, keyId);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input.' })
  async create(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.generate(orgId, dto, userId);
  }

  @AllowAnyRole()
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'List all API keys for the organization' })
  @ApiResponse({ status: 200, description: 'List of API keys returned successfully.' })
  async list(@CurrentUser('organizationId') orgId: string) {
    return this.apiKeysService.list(orgId);
  }

  @Put(':id/rotate')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Rotate an existing API key' })
  @ApiResponse({ status: 200, description: 'API key rotated successfully.' })
  @ApiResponse({ status: 404, description: 'API key not found.' })
  async rotate(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RotateApiKeyDto,
  ) {
    return this.apiKeysService.rotate(orgId, id, dto, userId);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 204, description: 'API key revoked successfully.' })
  @ApiResponse({ status: 404, description: 'API key not found.' })
  async revoke(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    await this.apiKeysService.revoke(orgId, id);
  }
}
