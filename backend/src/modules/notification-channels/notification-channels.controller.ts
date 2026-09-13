import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, Put, UseGuards } from '@nestjs/common';
import { NotificationChannelsService } from './notification-channels.service.js';
import { LinkChannelDto } from './dto/link-channel.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { NotificationChannelType } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';

// A user's own linked channels — always scoped to the caller, never
// another user's, so there's no separate admin/roles concern here.
@UseGuards(JwtAuthGuard)
@Controller('users/me/channels')
export class NotificationChannelsController {
  constructor(private readonly channelsService: NotificationChannelsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.channelsService.listForUser(user.id);
  }

  @Put(':type')
  link(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type', new ParseEnumPipe(NotificationChannelType)) type: NotificationChannelType,
    @Body() dto: LinkChannelDto,
  ) {
    return this.channelsService.link(user.id, type, dto.externalId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':type')
  async unlink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type', new ParseEnumPipe(NotificationChannelType)) type: NotificationChannelType,
  ) {
    await this.channelsService.unlink(user.id, type);
  }
}
