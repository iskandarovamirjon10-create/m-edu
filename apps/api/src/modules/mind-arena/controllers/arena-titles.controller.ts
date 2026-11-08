import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { RolesGuard } from '../../../auth/roles.guard';
import { AllowSelfService, AllowAnyRole } from '../../../auth/roles.decorator';
import { ArenaTitlesService } from '../services/arena-titles.service';

@ApiTags('Mind Arena Titles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('arena/titles')
export class ArenaTitlesController {
  constructor(private readonly titlesService: ArenaTitlesService) {}

  @Get()
  @AllowSelfService()
  @ApiOperation({ summary: 'List all system title achievements in the catalog' })
  async getCatalog() {
    return this.titlesService.getCatalog();
  }

  @Get(':slug')
  @AllowSelfService()
  @ApiOperation({ summary: 'Get details of a specific title by slug' })
  async getBySlug(@Param('slug') slug: string) {
    return this.titlesService.getBySlug(slug);
  }
}
