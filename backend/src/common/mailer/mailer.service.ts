import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Backend-owned SMTP client, separate from the worker's (worker/worker/
// notifications/email_notifier.py): the worker sends alarm-trigger emails
// on its own polling cadence (WORKER_POLL_INTERVAL_SECONDS, an hour by
// default — see root CLAUDE.md's "communicate only through the database"
// rule), which is far too slow for a password-reset link that needs to
// arrive within seconds of the request. Auth email is a backend concern,
// sent synchronously on request, and doesn't go through the worker at all.
// Mirrors the worker's WORKER_MAIL_* env var shape under a BACKEND_ prefix
// (see root CLAUDE.md's env var convention) — same provider, independent
// per-service config.
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.getOrThrow<string>('BACKEND_MAIL_HOST');
    const port = Number.parseInt(this.config.getOrThrow<string>('BACKEND_MAIL_PORT'), 10);
    const username = this.config.getOrThrow<string>('BACKEND_MAIL_USERNAME');
    const email = this.config.getOrThrow<string>('BACKEND_MAIL_EMAIL');
    const password = this.config.getOrThrow<string>('BACKEND_MAIL_PASSWORD');

    this.fromAddress = `"${username}" <${email}>`;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: email, pass: password },
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: 'Reset your Stock Alerts password',
      text: `Someone requested a password reset for this account.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    });
    this.logger.log(`Sent password reset email to ${to}`);
  }

  async sendInviteEmail(to: string, acceptUrl: string, invitedByEmail: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: "You've been invited to Stock Alerts",
      text: `${invitedByEmail} invited you to join Stock Alerts.\n\nSet up your account: ${acceptUrl}\n\nThis link expires in 1 hour.`,
    });
    this.logger.log(`Sent invite email to ${to}`);
  }
}
