import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AllowSelfService } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/types';
import { StudyService } from './study.service';
import {
  CreateFocusSessionDto,
  CreateStudyCardsDto,
  CreateStudyDeckDto,
  ReviewStudyCardDto,
  UpdateStudyCardDto,
  UpdateStudyDeckDto,
} from './dto/study.dto';

/**
 * Study Studio — every authenticated principal works on their own decks.
 * `@AllowSelfService()` is the correct opt-in for family accounts (students
 * and parents); the service always scopes by `userId` + `organizationId`.
 */
@Controller('study')
@UseGuards(JwtAuthGuard, RolesGuard)
@AllowSelfService()
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Get('overview')
  overview(@CurrentUser() user: RequestUser) {
    return this.study.overview(user.sub, user.organizationId);
  }

  @Get('decks')
  listDecks(@CurrentUser() user: RequestUser) {
    return this.study.listDecks(user.sub, user.organizationId);
  }

  @Post('decks')
  createDeck(@CurrentUser() user: RequestUser, @Body() dto: CreateStudyDeckDto) {
    return this.study.createDeck(user.sub, user.organizationId, dto);
  }

  @Patch('decks/:id')
  updateDeck(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudyDeckDto,
  ) {
    return this.study.updateDeck(user.sub, user.organizationId, id, dto);
  }

  @Delete('decks/:id')
  deleteDeck(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.study.deleteDeck(user.sub, user.organizationId, id);
  }

  @Get('decks/:id/cards')
  listCards(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.study.listCards(user.sub, user.organizationId, id);
  }

  @Post('decks/:id/cards')
  addCards(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateStudyCardsDto,
  ) {
    return this.study.addCards(user.sub, user.organizationId, id, dto);
  }

  @Patch('cards/:id')
  updateCard(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudyCardDto,
  ) {
    return this.study.updateCard(user.sub, user.organizationId, id, dto);
  }

  @Delete('cards/:id')
  deleteCard(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.study.deleteCard(user.sub, user.organizationId, id);
  }

  @Get('queue')
  queue(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '', 10);
    return this.study.queue(
      user.sub,
      user.organizationId,
      Number.isFinite(parsed) ? parsed : 40,
    );
  }

  @Post('cards/:id/review')
  reviewCard(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewStudyCardDto,
  ) {
    return this.study.reviewCard(user.sub, user.organizationId, id, dto);
  }

  @Post('focus-sessions')
  createFocusSession(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateFocusSessionDto,
  ) {
    return this.study.createFocusSession(user.sub, user.organizationId, dto);
  }
}
