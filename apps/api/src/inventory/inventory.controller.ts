import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  CreateTransactionDto,
  StockAdjustmentDto,
} from './dto/inventory.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PaginationParams } from '../common/dto/pagination';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { AllowAnyRole } from '../auth/roles.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ===================== Inventory Items =====================

  @AllowAnyRole()
  @Get('items')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async findAllItems(
    @CurrentUser() user: RequestUser,
    @Query() params: PaginationParams,
  ) {
    return this.inventoryService.findAllItems(user.organizationId, params);
  }

  @AllowAnyRole()
  @Get('items/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async findItemById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.findItemById(user.organizationId, id);
  }

  @Post('items')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async createItem(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryService.createItem(user.organizationId, dto);
  }

  @Put('items/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async updateItem(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(user.organizationId, id, dto);
  }

  @Delete('items/:id')
  @Roles(Role.ORG_ADMIN)
  async deleteItem(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.deleteItem(user.organizationId, id);
  }

  // ===================== Transactions =====================

  @AllowAnyRole()
  @Get('items/:itemId/transactions')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getTransactionHistory(
    @CurrentUser() user: RequestUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query() params: PaginationParams,
  ) {
    return this.inventoryService.getTransactionHistory(user.organizationId, itemId, params);
  }

  @Post('transactions')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async createTransaction(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTransactionDto,
  ) {
    // Security: userId comes from auth, not from DTO.
    return this.inventoryService.createTransaction(user.organizationId, dto, user.id);
  }

  // ===================== Stock Management =====================

  @Put('items/:id/stock')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async updateStock(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quantity') quantity: number,
  ) {
    return this.inventoryService.updateStock(user.organizationId, id, quantity);
  }

  @Patch('items/:id/adjust')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async adjustStock(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StockAdjustmentDto,
  ) {
    return this.inventoryService.adjustStock(user.organizationId, id, dto.adjustment);
  }

  // ===================== Reports =====================

  @AllowAnyRole()
  @Get('stock-report')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getStockReport(@CurrentUser() user: RequestUser) {
    return this.inventoryService.getStockReport(user.organizationId);
  }

  @AllowAnyRole()
  @Get('categories')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getCategoryStats(@CurrentUser() user: RequestUser) {
    return this.inventoryService.getCategoryStats(user.organizationId);
  }
}
