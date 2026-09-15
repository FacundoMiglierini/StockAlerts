import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Market, StrategyType } from '../../../generated/prisma/enums.js';

export class CreateAlarmDto {
  @IsString()
  @MinLength(1)
  ticker!: string;

  @IsEnum(StrategyType)
  strategyType!: StrategyType;

  // Optional — defaults to USA (matching the Prisma column default) when
  // omitted, so existing USA-only clients don't need to send it.
  @IsOptional()
  @IsEnum(Market)
  market?: Market;

  @IsObject()
  params!: Record<string, unknown>;
}
