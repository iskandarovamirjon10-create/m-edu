import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService, PaymeJsonRpcRequest, ClickWebhookPayload } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto } from '../common/dto';
import { CloseCashierShiftDto, ZReportQueryDto } from './dto/z-report.dto';
import { PaymentQuery } from '../common/dto/query';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ADMIN_ROLES } from '../auth/authorization.policy';
import { Idempotent } from '../common/idempotency';
import { AllowPublic } from '../auth/public.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @AllowPublic()
  @Post('webhook/payme/:orgId')
  @ApiOperation({ summary: 'Public Payme JSON-RPC 2.0 webhook for student tuition payments' })
  async handlePaymeWebhook(
    @Param('orgId') orgId: string,
    @Body() body: PaymeJsonRpcRequest,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.paymentsService.handlePaymeWebhook(orgId, authHeader, body);
  }

  @AllowPublic()
  @Post('webhook/click/:orgId')
  @ApiOperation({ summary: 'Public Click Merchant webhook for student tuition payments' })
  async handleClickWebhook(
    @Param('orgId') orgId: string,
    @Body() payload: ClickWebhookPayload,
  ) {
    return this.paymentsService.handleClickWebhook(orgId, payload);
  }

  @Get()
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'List payments' })
  findAll(@CurrentUser('organizationId') orgId: string, @Query() query: PaymentQuery) {
    return this.paymentsService.findAll(orgId, query);
  }

  @Get('cashier/z-report/summary')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Get live cashier shift reconciliation summary (Z-Hisobot)' })
  getZReportSummary(
    @CurrentUser('organizationId') orgId: string,
    @Query() query: ZReportQueryDto,
  ) {
    return this.paymentsService.getZReportSummary(orgId, query);
  }

  @Get('cashier/z-report/history')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'List recent closed cashier shifts (Z-Hisobot history)' })
  getZReportHistory(
    @CurrentUser('organizationId') orgId: string,
    @Query('limit') limit?: number,
  ) {
    return this.paymentsService.getRecentZReports(orgId, limit ? Number(limit) : 20);
  }

  @Post('cashier/z-report/close')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Finalize and close cashier shift with Z-Report' })
  closeCashierShift(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser() user: { sub: string; firstName?: string; lastName?: string },
    @Body() dto: CloseCashierShiftDto,
  ) {
    return this.paymentsService.closeCashierShift(orgId, user, dto);
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
  create(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-idempotency-key') xIdempotencyKey?: string,
  ) {
    const key = idempotencyKey || xIdempotencyKey;
    return key
      ? this.paymentsService.create(orgId, dto, key)
      : this.paymentsService.create(orgId, dto);
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
