import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Role } from '../../generated/prisma/enums.js';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  count() {
    return this.prisma.user.count();
  }

  async create(params: { email: string; password: string; role?: Role }) {
    const existing = await this.findByEmail(params.email);
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
    return this.prisma.user.create({
      data: {
        email: params.email,
        passwordHash,
        role: params.role ?? Role.USER,
      },
    });
  }

  verifyPassword(plain: string, passwordHash: string) {
    return bcrypt.compare(plain, passwordHash);
  }

  // Email is the account identifier, not changeable — only password is
  // self-service. Requires the current password, same as most auth flows,
  // so a hijacked-but-still-logged-in session can't silently lock the real
  // owner out.
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentMatches = await this.verifyPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!currentMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  // Admin-only roster (users.controller.ts gates these behind @Roles(ADMIN)).
  async listAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { alarms: true } } },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      active: u.active,
      isDefaultAdmin: u.isDefaultAdmin,
      alarmCount: u._count.alarms,
    }));
  }

  async setActive(
    actingAdminId: string,
    targetUserId: string,
    active: boolean,
  ) {
    if (actingAdminId === targetUserId) {
      throw new BadRequestException('You cannot disable your own account');
    }
    const user = await this.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isDefaultAdmin) {
      throw new BadRequestException(
        'The default admin account cannot be disabled',
      );
    }
    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { active },
    });
  }

  async remove(actingAdminId: string, targetUserId: string) {
    if (actingAdminId === targetUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const user = await this.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isDefaultAdmin) {
      throw new BadRequestException(
        'The default admin account cannot be deleted',
      );
    }
    await this.prisma.user.delete({ where: { id: targetUserId } });
  }
}
