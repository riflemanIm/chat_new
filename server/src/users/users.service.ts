import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: dto,
      });
      return this.sanitizeUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Username already exists');
      }
      throw error;
    }
  }

  async search(userId: string, dto: SearchUsersDto) {
    const q = dto.q?.trim();
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        ...(q
          ? {
              OR: [
                { username: { contains: q, mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: dto.limit,
      orderBy: { username: 'asc' },
    });
    return users.map((user) => this.sanitizeUser(user));
  }

  private sanitizeUser<T extends { passwordHash: string }>(user: T) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
