import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../auth/roles.guard';
import { AllowSelfService, AllowAnyRole } from '../../../auth/roles.decorator';
import { CurrentUser } from '../../../auth/current-user.decorator';
import type { RequestUser } from '../../../auth/types';
import { ArenaAvatarsService } from '../services/arena-avatars.service';

@ApiTags('Mind Arena Avatars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('arena/avatars')
export class ArenaAvatarsController {
  constructor(private readonly avatarsService: ArenaAvatarsService) {}

  @Get()
  @AllowSelfService()
  @ApiOperation({ summary: 'List all available avatars in the global 3D catalog' })
  async getCatalog() {
    return this.avatarsService.getCatalog();
  }

  @Get(':slug')
  @AllowSelfService()
  @ApiOperation({ summary: 'Get details and renders of a specific avatar by slug' })
  async getBySlug(@Param('slug') slug: string) {
    return this.avatarsService.getBySlug(slug);
  }
}
