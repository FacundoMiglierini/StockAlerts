import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { Role } from '../../generated/prisma/enums.js';
import type { UsersService } from '../users/users.service.js';
import type { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    verifyPassword: ReturnType<typeof vi.fn>;
  };
  let jwtService: { signAsync: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    usersService = { findByEmail: vi.fn(), verifyPassword: vi.fn() };
    jwtService = { signAsync: vi.fn().mockResolvedValue('signed.jwt.token') };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  it('returns a token and public user info for valid credentials', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      role: Role.ADMIN,
      passwordHash: 'hash',
      active: true,
    });
    usersService.verifyPassword.mockResolvedValue(true);

    const result = await service.login('a@b.com', 'correct-password');

    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      user: { id: 'user-1', email: 'a@b.com', role: Role.ADMIN },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'a@b.com',
      role: Role.ADMIN,
    });
  });

  it('rejects an unknown email without revealing that distinction', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(service.login('nobody@b.com', 'x')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(usersService.verifyPassword).not.toHaveBeenCalled();
  });

  it('rejects a wrong password with the same error as an unknown email', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      role: Role.USER,
      passwordHash: 'hash',
    });
    usersService.verifyPassword.mockResolvedValue(false);

    await expect(service.login('a@b.com', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects a disabled account even with the correct password', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      role: Role.USER,
      passwordHash: 'hash',
      active: false,
    });
    usersService.verifyPassword.mockResolvedValue(true);

    await expect(service.login('a@b.com', 'correct-password')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
