import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'List resource bookings' })
  async findAll(@CurrentUser('organizationId') orgId: string, @Query() query: any) {
    return this.bookingsService.findAll(orgId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create booking with conflict detection' })
  async create(@CurrentUser('organizationId') orgId: string, @Body() dto: any) {
    return this.bookingsService.create(orgId, dto);
  }
}
