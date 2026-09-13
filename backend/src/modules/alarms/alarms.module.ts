import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AlarmsService } from './alarms.service.js';
import { AlarmsController } from './alarms.controller.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [AlarmsService],
  controllers: [AlarmsController],
})
export class AlarmsModule {}
