import { IsString, MinLength } from 'class-validator';

export class LinkChannelDto {
  @IsString()
  @MinLength(1)
  externalId!: string;
}
