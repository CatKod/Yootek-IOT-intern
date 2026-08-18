import { Injectable } from '@nestjs/common';
import { type Role } from '../../common/types/role.type';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePriceDto } from './dto/create-price.dto';
import { CreateVegetableDto } from './dto/create-vegetable.dto';
import { UpdateVegetableDto } from './dto/update-vegetable.dto';

@Injectable()
export class VegetablesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, role: Role, dto: CreateVegetableDto) {
    await this.ensureGardenAccess(dto.gardenId, ownerId, role);

    return this.prisma.vegetable.create({
      data: {
        gardenId: dto.gardenId,
        name: dto.name,
        importedQuantity: dto.importedQuantity ?? 0,
        soldQuantity: dto.soldQuantity ?? 0,
      },
    });
  }

  async findAll(ownerId: string, role: Role) {
    const where = role === 'admin' ? undefined : { garden: { ownerId } };

    return this.prisma.vegetable.findMany({
      where,
      include: { garden: true, prices: { orderBy: { effectiveAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, ownerId: string, role: Role, dto: UpdateVegetableDto) {
    const vegetable = await this.ensureVegetableAccess(id, ownerId, role);

    if (
      typeof dto.importedQuantity === 'number' &&
      typeof dto.soldQuantity === 'number' &&
      dto.soldQuantity > dto.importedQuantity
    ) {
      throw new Error('Số lượng bán ra không được vượt quá số lượng nhập vào');
    }

    const currentImported = dto.importedQuantity ?? vegetable.importedQuantity;
    const currentSold = dto.soldQuantity ?? vegetable.soldQuantity;

    if (currentSold > currentImported) {
      throw new Error('Số lượng bán ra không được vượt quá số lượng nhập vào');
    }

    return this.prisma.vegetable.update({
      where: { id },
      data: dto,
    });
  }

  async sell(id: string, ownerId: string, role: Role, quantity: number) {
    const vegetable = await this.ensureVegetableAccess(id, ownerId, role);

    if (!vegetable.currentPrice) {
      throw new Error('Rau chưa có giá bán, vui lòng nhập giá trước');
    }

    const newSoldQuantity = vegetable.soldQuantity + quantity;
    if (newSoldQuantity > vegetable.importedQuantity) {
      throw new Error('Số lượng bán ra vượt quá số lượng nhập vào');
    }

    const unitPrice = Number(vegetable.currentPrice);
    const totalAmount = unitPrice * quantity;

    return this.prisma.$transaction(async (tx) => {
      const updatedVegetable = await tx.vegetable.update({
        where: { id },
        data: { soldQuantity: newSoldQuantity },
      });

      const sale = await tx.sale.create({
        data: {
          gardenId: vegetable.gardenId,
          vegetableId: vegetable.id,
          quantity,
          unitPrice,
          totalAmount,
        },
      });

      return { vegetable: updatedVegetable, sale };
    });
  }

  async createPrice(id: string, ownerId: string, role: Role, dto: CreatePriceDto) {
    const vegetable = await this.ensureVegetableAccess(id, ownerId, role);

    return this.prisma.$transaction(async (tx) => {
      await tx.vegetable.update({
        where: { id: vegetable.id },
        data: { currentPrice: dto.price },
      });

      return tx.vegetablePrice.create({
        data: {
          vegetableId: vegetable.id,
          price: dto.price,
        },
      });
    });
  }

  async updatePrice(id: string, ownerId: string, role: Role, dto: CreatePriceDto) {
    const vegetable = await this.ensureVegetableAccess(id, ownerId, role);
    const latestPrice = await this.prisma.vegetablePrice.findFirst({
      where: { vegetableId: vegetable.id },
      orderBy: { effectiveAt: 'desc' },
    });

    if (!latestPrice) {
      throw new Error('Rau này chưa có giá để cập nhật');
    }

    return this.prisma.vegetablePrice.update({
      where: { id: latestPrice.id },
      data: { price: dto.price },
    });
  }

  async deletePrice(id: string, ownerId: string, role: Role) {
    const vegetable = await this.ensureVegetableAccess(id, ownerId, role);
    const latestPrice = await this.prisma.vegetablePrice.findFirst({
      where: { vegetableId: vegetable.id },
      orderBy: { effectiveAt: 'desc' },
    });

    if (!latestPrice) {
      throw new Error('Rau này chưa có giá để xóa');
    }

    await this.prisma.vegetablePrice.delete({ where: { id: latestPrice.id } });
    return { message: 'Đã xóa giá rau thành công' };
  }

  async getPrice(id: string, ownerId: string, role: Role) {
    const vegetable = await this.ensureVegetableAccess(id, ownerId, role);
    const latestPrice = await this.prisma.vegetablePrice.findFirst({
      where: { vegetableId: vegetable.id },
      orderBy: { effectiveAt: 'desc' },
    });

    return latestPrice;
  }

  private async ensureGardenAccess(gardenId: string, ownerId: string, role: Role) {
    const garden = await this.prisma.garden.findUnique({ where: { id: gardenId } });
    if (!garden) {
      throw new Error('Không tìm thấy khu vườn');
    }
    if (role !== 'admin' && garden.ownerId !== ownerId) {
      throw new Error('Bạn không có quyền thao tác trên khu vườn này');
    }
  }

  private async ensureVegetableAccess(id: string, ownerId: string, role: Role) {
    const vegetable = await this.prisma.vegetable.findUnique({
      where: { id },
      include: { garden: true },
    });

    if (!vegetable) {
      throw new Error(`Không tìm thấy vegetable ${id}`);
    }

    if (role !== 'admin' && vegetable.garden.ownerId !== ownerId) {
      throw new Error('Bạn không có quyền thao tác trên loại rau này');
    }

    return vegetable;
  }
}
