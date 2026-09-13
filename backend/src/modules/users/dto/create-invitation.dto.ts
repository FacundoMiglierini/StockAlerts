import { IsEmail, IsEnum } from 'class-validator';
import { Role } from '../../../generated/prisma/enums.js';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;
}
