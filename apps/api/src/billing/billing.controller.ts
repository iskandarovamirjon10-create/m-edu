import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { BillingService } from './billing.service';
import { PaymeRpcRequest } from './adapters/payme.adapter';
import { ClickWebhookPayload } from './adapters/click.adapter';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, AllowAnyRole } from '../auth/roles.decorator';
import { ADMIN_ROLES } from '../auth/authorization.policy';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/types';
import { AllowPublic } from '../auth/public.decorator';
import { listPaymentProviders } from './payment-providers';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * Payme Merchant Webhook Endpoint (JSON-RPC 2.0).
   * Unauthenticated via JWT; authenticated via Payme Basic Auth header.
   */
  @AllowPublic()
  @Post('payme')
  @HttpCode(HttpStatus.OK)
  async handlePaymeWebhook(
    @Body() body: PaymeRpcRequest,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.billingService.handlePaymeWebhook(body, authHeader);
  }

  /**
   * Click Merchant Webhook Endpoint.
   * Unauthenticated via JWT; authenticated via Click MD5 signature.
   */
  @AllowPublic()
  @Post('click')
  @HttpCode(HttpStatus.OK)
  async handleClickWebhook(@Body() payload: ClickWebhookPayload) {
    return this.billingService.handleClickWebhook(payload);
  }

  /**
   * API-05: which payment providers actually exist, and which of them are
   * configured in this deployment. The UI/docs read this instead of hard-coding
   * a provider list that can drift away from the adapters.
   */
  @Get('providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @AllowAnyRole()
  getProviders() {
    return { providers: listPaymentProviders() };
  }

  /**
   * Retrieves list of invoices for the authenticated organization.
   */
  @Get('invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  async getInvoices(@CurrentUser() user: RequestUser) {
    if (!user?.organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.billingService.getOrganizationInvoices(user.organizationId);
  }

  /**
   * Generates checkout links (Payme, Click) for a specific invoice.
   */
  @Get('invoices/:invoiceNumber/pay-links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  async getPaymentLinks(
    @CurrentUser() user: RequestUser,
    @Param('invoiceNumber') invoiceNumber: string,
  ) {
    if (!user?.organizationId) {
      throw new BadRequestException('Organization context is required');
    }
    if (!invoiceNumber?.trim()) {
      throw new BadRequestException('Invoice number is required');
    }
    return this.billingService.getPaymentLinks(user.organizationId, invoiceNumber.trim());
  }
}
