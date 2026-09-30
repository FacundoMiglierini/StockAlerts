import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CreatePortfolioDto } from './dto/create-portfolio.dto.js';
import { PortfolioImportDto } from './dto/preview-portfolio.dto.js';
import {
  Phase,
  expandRecipe,
  type PlanResult,
} from './recipes/expand-recipe.js';
import { NotificationStatus } from '../../generated/prisma/enums.js';

const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class PortfoliosService {
  constructor(private readonly prisma: PrismaService) {}

  // Writes nothing: lets the UI show exactly which alarms an import would
  // create (and which rows are rejected) before committing to it.
  preview(dto: PortfolioImportDto): PlanResult {
    return expandRecipe(dto.recipe, dto.rows, dto.options);
  }

  async create(userId: string, dto: CreatePortfolioDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Portfolio name must not be blank');
    }

    const { alarms, errors } = this.preview(dto);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: `Invalid portfolio import: ${errors.length} error(s)`,
        errors,
      });
    }

    try {
      // One transaction: either the portfolio and every alarm exist, or
      // none do — a half-imported portfolio would be worse than a failed one.
      return await this.prisma.$transaction(async (tx) => {
        const portfolio = await tx.portfolio.create({
          data: { userId, name },
        });
        await tx.alarm.createMany({
          data: alarms.map(
            ({ ticker, market, strategyType, params, phase }) => ({
              userId,
              portfolioId: portfolio.id,
              ticker,
              market,
              strategyType,
              params,
              // Already bought: skip the BUY leg (see Phase).
              ...(phase === Phase.SELL && {
                notificationStatus: NotificationStatus.NOTIFIED_ONCE,
              }),
            }),
          ),
        });
        return { ...portfolio, alarmCount: alarms.length };
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException(
          `You already have a portfolio named "${name}"`,
        );
      }
      throw error;
    }
  }

  async findAllForUser(userId: string) {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { alarms: true } } },
    });
    return portfolios.map(({ _count, ...portfolio }) => ({
      ...portfolio,
      alarmCount: _count.alarms,
    }));
  }

  // Deleting a portfolio deletes its alarms (FK ON DELETE CASCADE).
  async remove(userId: string, id: string) {
    const existing = await this.prisma.portfolio.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Portfolio not found');
    }
    await this.prisma.portfolio.delete({ where: { id: existing.id } });
  }
}
