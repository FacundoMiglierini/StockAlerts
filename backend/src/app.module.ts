import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AlarmsModule } from './modules/alarms/alarms.module.js';
import { NotificationChannelsModule } from './modules/notification-channels/notification-channels.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    AlarmsModule,
    NotificationChannelsModule,
  ],
})
export class AppModule {}
