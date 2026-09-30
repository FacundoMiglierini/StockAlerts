import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PortfoliosService } from './portfolios.service.js';
import { CreatePortfolioDto } from './dto/create-portfolio.dto.js';
import { PreviewPortfolioDto } from './dto/preview-portfolio.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';

@UseGuards(JwtAuthGuard)
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.portfoliosService.findAllForUser(user.id);
  }

  // POST but read-only, so 200 rather than Nest's default 201 for POST.
  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: PreviewPortfolioDto) {
    return this.portfoliosService.preview(dto);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePortfolioDto,
  ) {
    return this.portfoliosService.create(user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.portfoliosService.remove(user.id, id);
  }
}
