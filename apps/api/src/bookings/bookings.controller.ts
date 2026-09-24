import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { STAFF_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateBookingDto, BookingQueryDto } from './dto/booking.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'List resource bookings' })
  async findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.findAll(orgId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create booking with conflict detection' })
  async create(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(orgId, dto);
  }
}
