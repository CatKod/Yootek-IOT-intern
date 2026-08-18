import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../../common/types/role.type';
import { MqttBrokerService } from '../../infrastructure/mqtt/services/mqtt-broker.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ControlLedDto } from './dto/control-led.dto';
import { CreateGardenDto } from './dto/create-garden.dto';
import { UpdateGardenDto } from './dto/update-garden.dto';

@Injectable()
export class GardensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttBrokerService: MqttBrokerService,
  ) {}

  create(ownerId: string, role: Role, dto: CreateGardenDto) {
    return this.prisma.garden.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId,
      },
    });
  }

  findAll(ownerId: string, role: Role) {
    return this.prisma.garden.findMany({
      where: role === 'admin' ? undefined : { ownerId },
      include: {
        vegetables: true,
        sales: true,
        sensorData: {
          orderBy: { receivedAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, ownerId: string, role: Role) {
    const garden = await this.prisma.garden.findUnique({
      where: { id },
      include: {
        vegetables: true,
        sales: { orderBy: { soldAt: 'desc' } },
        sensorData: { orderBy: { receivedAt: 'desc' }, take: 24 },
      },
    });

    if (!garden) {
      throw new NotFoundException(`Không tìm thấy garden ${id}`);
    }

    if (role !== 'admin' && garden.ownerId !== ownerId) {
      throw new ForbiddenException('Bạn không có quyền truy cập khu vườn này');
    }

    return garden;
  }

  async update(id: string, ownerId: string, role: Role, dto: UpdateGardenDto) {
    const garden = await this.ensureAccessible(id, ownerId, role);
    return this.prisma.garden.update({
      where: { id: garden.id },
      data: dto,
    });
  }

  async remove(id: string, ownerId: string, role: Role) {
    const garden = await this.ensureAccessible(id, ownerId, role);
    await this.prisma.garden.delete({ where: { id: garden.id } });
    return { message: 'Đã xóa khu vườn thành công' };
  }

  async setLedState(id: string, ownerId: string, role: Role, dto: ControlLedDto) {
    const garden = await this.ensureAccessible(id, ownerId, role);

    const updated = await this.prisma.garden.update({
      where: { id: garden.id },
      data: {
        led1State: dto.led1State,
        led2State: dto.led2State,
        led3State: dto.led3State,
      },
    });

    const command = {
      gardenId: garden.id,
      userId: garden.ownerId,
      led1State: dto.led1State,
      led2State: dto.led2State,
      led3State: dto.led3State,
    };

    await this.mqttBrokerService.publishToCommandTopic(command, { retain: true });
    return updated;
  }

  async getRevenue(gardenId: string, range: 'day' | 'week' | 'month') {
    const since = this.getRangeStart(range);

    const sales = await this.prisma.sale.findMany({
      where: { gardenId, soldAt: { gte: since } },
      select: { totalAmount: true },
    });

    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
    return { gardenId, range, totalRevenue };
  }

  async getAllRevenue(range: 'day' | 'week' | 'month') {
    const since = this.getRangeStart(range);
    const sales = await this.prisma.sale.findMany({
      where: { soldAt: { gte: since } },
      select: { totalAmount: true },
    });

    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
    return { range, totalRevenue };
  }

  private async ensureAccessible(id: string, ownerId: string, role: Role) {
    const garden = await this.prisma.garden.findUnique({ where: { id } });
    if (!garden) {
      throw new NotFoundException(`Không tìm thấy garden ${id}`);
    }
    if (role !== 'admin' && garden.ownerId !== ownerId) {
      throw new ForbiddenException('Bạn không có quyền thao tác khu vườn này');
    }
    return garden;
  }

  private getRangeStart(range: 'day' | 'week' | 'month'): Date {
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
