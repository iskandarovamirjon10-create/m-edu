import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BranchesService } from './branches.service';
import { AssignManagerDto, CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AllowAnyRole } from '../auth/roles.decorator';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @AllowAnyRole()
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List all branches' })
  findAll(@CurrentUser('organizationId') orgId: string) {
    return this.branchesService.findAll(orgId);
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get branch details' })
  findOne(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.branchesService.findOne(orgId, id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a branch' })
  create(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branchesService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Update a branch' })
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(orgId, id, dto);
  }

  @Patch(':id/deactivate')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Deactivate a branch' })
  deactivate(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.branchesService.deactivate(orgId, id);
  }

  @Patch(':id/activate')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Activate a branch' })
  activate(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.branchesService.activate(orgId, id);
  }

  @Patch(':id/manager')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Assign a branch manager' })
  assignManager(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: AssignManagerDto,
  ) {
    return this.branchesService.assignManager(orgId, id, dto.managerId);
  }

  @AllowAnyRole()
  @Get(':id/stats')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get branch statistics' })
  getStats(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.branchesService.getBranchStats(orgId, id);
  }
}
