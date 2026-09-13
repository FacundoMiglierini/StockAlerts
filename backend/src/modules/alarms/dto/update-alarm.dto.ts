import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { AlarmStatus } from '../../../generated/prisma/enums.js';

export class UpdateAlarmDto {
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(AlarmStatus)
  status?: AlarmStatus;
}
