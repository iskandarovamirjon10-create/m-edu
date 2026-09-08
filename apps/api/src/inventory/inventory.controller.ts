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

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ===================== Inventory Items =====================

  @Get('items')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async findAllItems(
    @CurrentUser() user: any,
    @Query() params: PaginationParams,
  ) {
    return this.inventoryService.findAllItems(user.organizationId, params);
  }

  @Get('items/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async findItemById(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.findItemById(user.organizationId, id);
  }

  @Post('items')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async createItem(
    @CurrentUser() user: any,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryService.createItem(user.organizationId, dto);
  }

  @Put('items/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async updateItem(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateItem(user.organizationId, id, dto);
  }

  @Delete('items/:id')
  @Roles(Role.ORG_ADMIN)
  async deleteItem(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.deleteItem(user.organizationId, id);
  }

  // ===================== Transactions =====================

  @Get('items/:itemId/transactions')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getTransactionHistory(
    @CurrentUser() user: any,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query() params: PaginationParams,
  ) {
    return this.inventoryService.getTransactionHistory(user.organizationId, itemId, params);
  }

  @Post('transactions')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async createTransaction(
    @CurrentUser() user: any,
    @Body() dto: CreateTransactionDto,
  ) {
    // Security: userId comes from auth, not from DTO.
    return this.inventoryService.createTransaction(user.organizationId, dto, user.id);
  }

  // ===================== Stock Management =====================

  @Put('items/:id/stock')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async updateStock(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quantity') quantity: number,
  ) {
    return this.inventoryService.updateStock(user.organizationId, id, quantity);
  }

  @Patch('items/:id/adjust')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async adjustStock(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StockAdjustmentDto,
  ) {
    return this.inventoryService.adjustStock(user.organizationId, id, dto.adjustment);
  }

  // ===================== Reports =====================

  @Get('stock-report')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getStockReport(@CurrentUser() user: any) {
    return this.inventoryService.getStockReport(user.organizationId);
  }

  @Get('categories')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getCategoryStats(@CurrentUser() user: any) {
    return this.inventoryService.getCategoryStats(user.organizationId);
  }
}