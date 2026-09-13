import { IsString, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  token!: string;

  @MinLength(8)
  password!: string;
}
