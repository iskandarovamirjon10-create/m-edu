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
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { PaymeRpcRequest } from './adapters/payme.adapter';
import { ClickWebhookPayload } from './adapters/click.adapter';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RequestUser } from '../auth/types';
import { AllowPublic } from '../auth/public.decorator';

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
   * Retrieves list of invoices for the authenticated organization.
   */
  @Get('invoices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getInvoices(@CurrentUser() user: RequestUser) {
    return this.billingService.getOrganizationInvoices(user.organizationId);
  }

  /**
   * Generates checkout links (Payme, Click) for a specific invoice.
   */
  @Get('invoices/:invoiceNumber/pay-links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPaymentLinks(
    @CurrentUser() user: RequestUser,
    @Param('invoiceNumber') invoiceNumber: string,
  ) {
    return this.billingService.getPaymentLinks(user.organizationId, invoiceNumber);
  }
}
