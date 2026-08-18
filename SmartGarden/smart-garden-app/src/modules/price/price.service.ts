import { Injectable } from '@nestjs/common';
import { type Role } from '../../common/types/role.type';
import { PrismaService } from '../../prisma/prisma.service';

export type RevenueRange = 'day' | 'week' | 'month';

@Injectable()
export class PriceService {
  constructor(private readonly prisma: PrismaService) {}

  async getPriceList(range: RevenueRange, ownerId: string, role: Role) {
    const since = this.getRangeStart(range);

    const where =
      role === 'admin'
        ? { effectiveAt: { gte: since } }
        : { effectiveAt: { gte: since }, vegetable: { garden: { ownerId } } };

    const prices = await this.prisma.vegetablePrice.findMany({
      where,
      include: {
        vegetable: {
          include: { garden: true },
        },
      },
      orderBy: { effectiveAt: 'desc' },
    });

    return {
      range,
      from: since.toISOString(),
      count: prices.length,
      prices,
    };
  }

  async getAllRevenue(range: RevenueRange, ownerId: string, role: Role) {
    const since = this.getRangeStart(range);

    const where =
      role === 'admin'
        ? { soldAt: { gte: since } }
        : { soldAt: { gte: since }, garden: { ownerId } };

    const sales = await this.prisma.sale.findMany({
      where,
      select: {
        totalAmount: true,
        quantity: true,
        gardenId: true,
        soldAt: true,
      },
      orderBy: { soldAt: 'desc' },
    });

    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
    const totalQuantity = sales.reduce((sum, sale) => sum + sale.quantity, 0);

    const byGarden = new Map<string, { gardenId: string; totalRevenue: number; totalQuantity: number }>();
    for (const sale of sales) {
      const entry = byGarden.get(sale.gardenId) ?? { gardenId: sale.gardenId, totalRevenue: 0, totalQuantity: 0 };
      entry.totalRevenue += Number(sale.totalAmount);
      entry.totalQuantity += sale.quantity;
      byGarden.set(sale.gardenId, entry);
    }

    return {
      range,
      from: since.toISOString(),
      totalRevenue,
      totalQuantity,
      saleCount: sales.length,
      byGarden: [...byGarden.values()],
    };
  }

  private getRangeStart(range: RevenueRange): Date {
    const now = new Date();
    if (range === 'day') {
      now.setHours(now.getHours() - 24);
    } else if (range === 'week') {
      now.setDate(now.getDate() - 7);
    } else {
      now.setMonth(now.getMonth() - 1);
    }
    return now;
  }
}
