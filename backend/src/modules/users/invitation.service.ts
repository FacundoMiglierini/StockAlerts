import { randomBytes, createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { MailerService } from '../../common/mailer/mailer.service.js';
import { UsersService } from './users.service.js';
import type { Role } from '../../generated/prisma/enums.js';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const SALT_ROUNDS = 12;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Reuses the same token/expiry/hashing shape as PasswordResetService, but
// unlike that flow this one is admin-gated (see users.controller.ts), not
// public — there's no email-enumeration concern here, so mail-delivery
// failures are allowed to surface to the inviting admin instead of being
// swallowed.
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async createInvitation(
    invitedByEmail: string,
    email: string,
    role: Role,
  ): Promise<void> {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    // A fresh invite supersedes any still-outstanding one for the same
    // email — only the link in the most recent email should work.
    await this.prisma.userInvitation.deleteMany({
      where: { email, acceptedAt: null },
    });

    const token = randomBytes(TOKEN_BYTES).toString('hex');
    await this.prisma.userInvitation.create({
      data: {
        email,
        role,
        tokenHash: hashToken(token),
        invitedByEmail,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const acceptUrl = `${frontendUrl}/accept-invite?token=${token}`;
    try {
      await this.mailer.sendInviteEmail(email, acceptUrl, invitedByEmail);
    } catch (error) {
      this.logger.error(
        `Failed to send invite email to ${email}`,
        error as Error,
      );
      throw new BadRequestException(
        'Could not send the invite email — check the mail configuration and try again',
      );
    }
  }

  async acceptInvitation(token: string, password: string): Promise<void> {
    const record = await this.prisma.userInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!record || record.acceptedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'This invite link is invalid or has expired',
      );
    }

    const existingUser = await this.usersService.findByEmail(record.email);
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.create({
        data: { email: record.email, passwordHash, role: record.role },
      }),
      this.prisma.userInvitation.update({
        where: { id: record.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
  }
}
