import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { NotificationChannelsService } from './notification-channels.service.js';
import { NotificationChannelsController } from './notification-channels.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [NotificationChannelsService],
  controllers: [NotificationChannelsController],
  exports: [NotificationChannelsService],
})
export class NotificationChannelsModule {}
