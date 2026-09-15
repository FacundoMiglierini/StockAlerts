import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { InvitationService } from './invitation.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import { NotificationChannelsService } from '../notification-channels/notification-channels.service.js';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly invitationService: InvitationService,
    private readonly channelsService: NotificationChannelsService,
  ) {}

  // Linking/unlinking channels themselves lives in
  // notification-channels.controller.ts (PUT/DELETE /users/me/channels/:type)
  // — this just composes the summary for display.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const channels = await this.channelsService.listForUser(user.id);
    return { id: user.id, email: user.email, role: user.role, channels };
  }

  // Email is the account identifier — not editable here or anywhere else.
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // No public self-registration: accounts are created either by the seed
  // script (first admin) or here, by an existing admin.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return { id: user.id, email: user.email, role: user.role };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  listAll() {
    return this.usersService.listAll();
  }

  // Emails the invitee a link to set their own password and activate the
  // account (auth.controller.ts's POST /auth/accept-invite) — an admin only
  // picks the email + role here, never a password on the invitee's behalf.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('invite')
  async invite(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    await this.invitationService.createInvitation(
      admin.email,
      dto.email,
      dto.role,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  async updateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const user = await this.usersService.setActive(admin.id, id, dto.active);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      active: user.active,
      isDefaultAdmin: user.isDefaultAdmin,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.usersService.remove(admin.id, id);
  }
}
