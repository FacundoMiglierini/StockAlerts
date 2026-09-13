import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { InvitationService } from '../users/invitation.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
    private readonly invitationService: InvitationService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // Always 204, regardless of whether the email is registered — the
  // response must not reveal which emails have accounts.
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.passwordResetService.requestReset(dto.email);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordResetService.resetPassword(dto.token, dto.newPassword);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('accept-invite')
  async acceptInvite(@Body() dto: AcceptInvitationDto) {
    await this.invitationService.acceptInvitation(dto.token, dto.password);
  }
}
