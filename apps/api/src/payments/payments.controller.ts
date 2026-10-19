import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto } from '../common/dto';
import { PaymentQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES } from '../auth/authorization.policy';
import { Idempotent } from '../common/idempotency';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'List payments' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: PaymentQuery) {
    return this.paymentsService.findAll(orgId, query);
  }

  @Get(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get payment details' })
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id') id: string) {
    return this.paymentsService.findOne(orgId, id);
  }

  @Post()
  @Idempotent({ ttlSeconds: 86400 })
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Record a payment' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a payment' })
  update(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(orgId, id, dto);
  }
}
