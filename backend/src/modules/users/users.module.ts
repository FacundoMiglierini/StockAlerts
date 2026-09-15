import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersService } from './users.service.js';
import { InvitationService } from './invitation.service.js';
import { UsersController } from './users.controller.js';
import { NotificationChannelsModule } from '../notification-channels/notification-channels.module.js';
import { MailerModule } from '../../common/mailer/mailer.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    NotificationChannelsModule,
    MailerModule,
  ],
  providers: [UsersService, InvitationService],
  controllers: [UsersController],
  // InvitationService is exported so AuthModule (which already imports
  // UsersModule) can use it for the public accept-invite endpoint.
  exports: [UsersService, InvitationService],
})
export class UsersModule {}
