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
} from './dto/invoice.dto';

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
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Record a payment against an invoice (issues receipt)' })
  recordPayment(
    @CurrentUser() user: { organizationId: string; id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    if (dto.invoiceId !== id) {
      throw new UnauthorizedException('Payment invoiceId must match the URL');
    }
    return this.invoicesService.recordPayment(user.organizationId, user.id, dto);
  }

  @Post('refunds')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Request a refund against a paid payment' })
  requestRefund(
    @CurrentUser() user: { organizationId: string; id: string },
    @Body() dto: CreateRefundDto,
  ) {
    return this.invoicesService.requestRefund(user.organizationId, user.id, dto);
  }

  @Post('refunds/:id/process')
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

