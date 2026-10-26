import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AllowAnyRole, Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '@prisma/client';
import {
  AddInvoiceItemDto,
  CreateInvoiceDto,
  CreateRefundDto,
  RecordPaymentDto,
  ProrateInvoiceDto,
} from './dto/invoice.dto';
import { Idempotent } from '../common/idempotency';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @AllowAnyRole()
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List invoices (admin)' })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('overdue') overdue?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll(orgId, {
      status,
      studentId,
      overdue: overdue === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @AllowAnyRole()
  @Get('my')
  @Roles(Role.STUDENT, Role.ORG_ADMIN, Role.MANAGER, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Current student balance and invoices' })
  myBalance(@CurrentUser() user: { organizationId: string; id: string; role: Role }) {
    return this.invoicesService.getBalanceForUser(user.organizationId, user.id);
  }

  @AllowAnyRole()
  @Get('students/:studentId/balance')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Student balance (admin view)' })
  studentBalance(
    @CurrentUser('organizationId') orgId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.invoicesService.getStudentBalance(orgId, studentId);
  }

  @AllowAnyRole()
  @Get('students/:studentId/debtor-status')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  @ApiOperation({ summary: 'Check if student has overdue unpaid debt (debtor lockout policy)' })
  debtorStatus(
    @CurrentUser('organizationId') orgId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query('graceDays') graceDays?: string,
  ) {
    return this.invoicesService.checkStudentDebtorStatus(
      orgId,
      studentId,
      graceDays ? Number(graceDays) : 5,
    );
  }

  @Post('prorate-preview')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Preview prorated tuition calculation for mid-month enrollment' })
  proratePreview(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: ProrateInvoiceDto,
  ) {
    return this.invoicesService.proratePreview(orgId, dto);
  }

  @Post('prorate')
  @Idempotent({ ttlSeconds: 86400 })
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create and issue a prorated tuition invoice' })
  createProrated(
    @CurrentUser() user: { organizationId: string; id: string },
    @Body() dto: ProrateInvoiceDto,
  ) {
    return this.invoicesService.createProratedInvoice(user.organizationId, user.id, dto);
  }

  @AllowAnyRole()
  @Get(':id/payment-links')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER, Role.STUDENT)
  @ApiOperation({ summary: 'Generate Payme and Click payment deep links and QR codes' })
  async paymentLinks(
    @CurrentUser() user: { organizationId: string; id: string; role: Role },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (user.role === Role.STUDENT) {
      await this.invoicesService.getInvoiceForStudent(user.organizationId, user.id, id);
    }
    return this.invoicesService.getPaymentLinks(user.organizationId, id);
  }

  @AllowAnyRole()
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER, Role.STUDENT)
  @ApiOperation({ summary: 'Invoice detail with payments and refunds' })
  findOne(
    @CurrentUser() user: { organizationId: string; id: string; role: Role },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (user.role === Role.STUDENT) {
      return this.invoicesService.getInvoiceForStudent(user.organizationId, user.id, id);
    }
    return this.invoicesService.findOne(user.organizationId, id);
  }

  @Post()
  @Idempotent({ ttlSeconds: 86400 })
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a DRAFT invoice with line items' })
  create(
    @CurrentUser() user: { organizationId: string; id: string },
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.createInvoice(user.organizationId, user.id, dto);
  }

  @Post(':id/items')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Add a line item to a DRAFT invoice' })
  addItem(
    @CurrentUser() user: { organizationId: string; id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInvoiceItemDto,
  ) {
    return this.invoicesService.addItem(user.organizationId, user.id, id, dto);
  }

  @Post(':id/issue')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Issue a DRAFT invoice' })
  issue(
    @CurrentUser() user: { organizationId: string; id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.issueInvoice(user.organizationId, user.id, id);
  }

  @Post(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Cancel an invoice (no payments recorded)' })
  cancel(
    @CurrentUser() user: { organizationId: string; id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.invoicesService.cancelInvoice(user.organizationId, user.id, id, reason ?? '');
  }

  @Post(':id/payments')
  @Idempotent({ ttlSeconds: 86400 })
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Record a payment against an invoice (issues receipt)' })
  recordPayment(
    @CurrentUser() user: { organizationId: string; id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    if (dto.invoiceId && dto.invoiceId !== id) {
      throw new UnauthorizedException('Payment invoiceId must match the URL');
    }
    return this.invoicesService.recordPayment(user.organizationId, user.id, {
      ...dto,
      invoiceId: id,
    });
  }

  @Post('refunds')
  @Idempotent({ ttlSeconds: 86400 })
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Request a refund against a paid payment' })
  requestRefund(
    @CurrentUser() user: { organizationId: string; id: string },
    @Body() dto: CreateRefundDto,
  ) {
    return this.invoicesService.requestRefund(user.organizationId, user.id, dto);
  }

  @Post('refunds/:id/process')
  @Idempotent({ ttlSeconds: 86400 })
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Process (approve + execute) a requested refund' })
  processRefund(
    @CurrentUser() user: { organizationId: string; id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body('gatewayExternalId') gatewayExternalId?: string,
  ) {
    return this.invoicesService.processRefund(user.organizationId, user.id, id, gatewayExternalId);
  }

  @Post('refunds/:id/reject')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Reject a requested refund' })
  rejectRefund(
    @CurrentUser() user: { organizationId: string; id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.invoicesService.rejectRefund(user.organizationId, user.id, id, reason ?? '');
  }
}

