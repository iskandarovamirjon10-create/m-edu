import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from '../search.controller';
import { SearchService, SearchResponse } from '../search.service';

describe('SearchController', () => {
  let controller: SearchController;
  let service: {
    search: ReturnType<typeof vi.fn>;
  };

  const orgId = 'org-1';

  beforeEach(async () => {
    service = {
      search: vi.fn(),
    };

    controller = new SearchController(service as unknown as SearchService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    it('delegates to searchService.search with parsed parameters', async () => {
      const mockResponse: SearchResponse = {
        query: 'ali',
        results: [],
        total: 0,
        byType: {},
        tookMs: 5,
      };
      service.search.mockResolvedValue(mockResponse);

      const result = await controller.search(orgId, 'ali', 'student,teacher', '10');
      expect(result).toEqual(mockResponse);
      expect(service.search).toHaveBeenCalledWith(orgId, {
        q: 'ali',
        types: ['STUDENT', 'TEACHER'],
        limit: 10,
      });
    });

    it('defaults query to empty string when q is missing or blank', async () => {
      const mockResponse: SearchResponse = {
        query: '',
        results: [],
        total: 0,
        byType: {},
        tookMs: 0,
      };
      service.search.mockResolvedValue(mockResponse);

      const result = await controller.search(orgId, '');
      expect(result).toEqual(mockResponse);
      expect(service.search).toHaveBeenCalledWith(orgId, {
        q: '',
        types: undefined,
        limit: undefined,
      });
    });
  });
});
