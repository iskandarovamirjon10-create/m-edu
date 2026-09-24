import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SearchService, SearchQuery, SearchResponse } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Universal search across all entity types' })
  async search(
    @CurrentUser('organizationId') orgId: string,
    @Query('q') q: string,
    @Query('types') types?: string,
    @Query('limit') limit?: string,
  ): Promise<SearchResponse> {
    const query: SearchQuery = {
      q: q || '',
      types: types ? types.split(',').map(t => t.trim().toUpperCase()) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    return this.searchService.search(orgId, query);
  }
}
