import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { Role } from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';

// Real bcrypt is intentionally slow (that's the point of it) — mock it so
// these tests exercise UsersService's logic, not bcrypt's.
vi.mock('bcrypt', () => ({
  hash: vi.fn(async (plain: string) => `hashed:${plain}`),
  compare: vi.fn(
    async (plain: string, hash: string) => hash === `hashed:${plain}`,
  ),
}));

function createPrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('hashes the password and defaults to the USER role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        role: Role.USER,
      });

      await service.create({ email: 'a@b.com', password: 'plain-password' });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'a@b.com',
          passwordHash: 'hashed:plain-password',
          role: Role.USER,
        },
      });
    });

    it('rejects a duplicate email without creating a user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ email: 'a@b.com', password: 'x' }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('updates the hash when the current password matches', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        passwordHash: 'hashed:old-pass',
      });

      await service.changePassword('1', 'old-pass', 'new-pass');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { passwordHash: 'hashed:new-pass' },
      });
    });

    it('rejects when the current password is wrong, without updating anything', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: '1',
        passwordHash: 'hashed:old-pass',
      });

      await expect(
        service.changePassword('1', 'wrong-pass', 'new-pass'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a user id that does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.changePassword('missing', 'a', 'b')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('setActive', () => {
    it('rejects an admin acting on their own account', async () => {
      await expect(
        service.setActive('admin-1', 'admin-1', false),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects disabling the default admin, even by a different admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        isDefaultAdmin: true,
      });

      await expect(
        service.setActive('admin-1', 'target', false),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a target id that does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.setActive('admin-1', 'missing', false),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates active status for an ordinary, non-self target', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        isDefaultAdmin: false,
      });
      prisma.user.update.mockResolvedValue({ id: 'target', active: false });

      await service.setActive('admin-1', 'target', false);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target' },
        data: { active: false },
      });
    });
  });

  describe('remove', () => {
    it('rejects an admin acting on their own account', async () => {
      await expect(service.remove('admin-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('rejects deleting the default admin, even by a different admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        isDefaultAdmin: true,
      });

      await expect(service.remove('admin-1', 'target')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a target id that does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('admin-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('deletes an ordinary, non-self target', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target',
        isDefaultAdmin: false,
      });

      await service.remove('admin-1', 'target');

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'target' },
      });
    });
  });
});
