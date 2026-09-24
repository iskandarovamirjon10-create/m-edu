import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AllowSelfService } from '../auth/roles.decorator';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @AllowSelfService()
  @Get('me')
  @ApiOperation({ summary: 'Get current organization' })
  getOrganization(@CurrentUser('organizationId') orgId: string) {
    return this.organizationsService.getOrganization(orgId);
  }

  @Patch('me')
  @Roles('SUPER_ADMIN', 'ORG_ADMIN')
  @ApiOperation({ summary: 'Update organization settings' })
  updateOrganization(@CurrentUser('organizationId') orgId: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.updateOrganization(orgId, dto);
  }
}
