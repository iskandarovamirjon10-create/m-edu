import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { LibraryService } from './library.service';
import { CreateLibraryBookDto, UpdateLibraryBookDto } from './dto/create-library-book.dto';
import { BorrowBookDto, ReturnBookDto } from './dto/library-transaction.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PaginationParams } from '../common/dto/pagination';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { AllowAnyRole } from '../auth/roles.decorator';

@Controller('library')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  // ===================== Books =====================

  @AllowAnyRole()
  @Get('books')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async findAllBooks(
    @CurrentUser() user: RequestUser,
    @Query() params: PaginationParams,
  ) {
    return this.libraryService.findAllBooks(user.organizationId, params);
  }

  @AllowAnyRole()
  @Get('books/search')
  async searchBooks(
    @CurrentUser() user: RequestUser,
    @Query('q') query: string,
  ) {
    if (!query || query.length < 2) {
      return [];
    }
    return this.libraryService.searchBooks(user.organizationId, query);
  }

  @AllowAnyRole()
  @Get('books/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async findBookById(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.libraryService.findBookById(user.organizationId, id);
  }

  @Post('books')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async createBook(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateLibraryBookDto,
  ) {
    return this.libraryService.createBook(user.organizationId, dto);
  }

  @Put('books/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async updateBook(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLibraryBookDto,
  ) {
    return this.libraryService.updateBook(user.organizationId, id, dto);
  }

  @Delete('books/:id')
  @Roles(Role.ORG_ADMIN)
  async deleteBook(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.libraryService.deleteBook(user.organizationId, id);
  }

  // ===================== Borrowing =====================

  @Post('borrow')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER, Role.ASSISTANT)
  async borrowBook(
    @CurrentUser() user: RequestUser,
    @Body() dto: BorrowBookDto,
  ) {
    return this.libraryService.borrowBook(user.organizationId, dto);
  }

  @Post('return/:id')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER, Role.ASSISTANT)
  async returnBook(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnBookDto,
  ) {
    return this.libraryService.returnBook(user.organizationId, id, dto);
  }

  @AllowAnyRole()
  @Get('overdue')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async getOverdueBooks(
    @CurrentUser() user: RequestUser,
    @Query() params: PaginationParams,
  ) {
    return this.libraryService.getOverdueBooks(user.organizationId, params);
  }

  // ===================== Student View =====================

  @AllowAnyRole()
  @Get('student/:studentId')
  @Roles(Role.ORG_ADMIN, Role.MANAGER, Role.TEACHER)
  async getStudentBorrows(
    @CurrentUser() user: RequestUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.libraryService.getStudentBorrows(user.organizationId, studentId);
  }

  // ===================== Statistics =====================

  @AllowAnyRole()
  @Get('stats')
  @Roles(Role.ORG_ADMIN, Role.MANAGER)
  async getLibraryStats(@CurrentUser() user: RequestUser) {
    return this.libraryService.getLibraryStats(user.organizationId);
  }
}
