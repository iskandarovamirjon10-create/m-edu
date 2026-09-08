import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { SearchService, SearchQuery, SearchResponse } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Universal search across all entity types' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query (min 2 chars)' })
  @ApiQuery({ name: 'types', required: false, description: 'Comma-separated entity types to search' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results per type (default 20, max 50)' })
  @ApiResponse({ status: 200, description: 'Search results grouped by entity type' })
  async search(
    @Req() req: Request & { user: { organizationId: string } },
    @Query('q') q: string,
    @Query('types') types?: string,
    @Query('limit') limit?: string,
  ): Promise<SearchResponse> {
    const query: SearchQuery = {
      q: q || '',
      types: types ? types.split(',').map(t => t.trim().toUpperCase()) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    // OrganizationId MUST come from the authenticated principal — never hardcoded.
    return this.searchService.search(req.user.organizationId, query);
  }
}
