import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../../common/types/role.type';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSensorDataDto } from './dto/create-sensor-data.dto';

@Injectable()
export class SensorService {
  constructor(private readonly prisma: PrismaService) {}

  async recordFromDevice(dto: CreateSensorDataDto) {
    const garden = await this.prisma.garden.findUnique({
      where: { id: dto.gardenId },
    });

    if (!garden) {
      throw new NotFoundException('Không tìm thấy khu vườn');
    }

    return this.prisma.sensorData.create({
      data: {
        gardenId: dto.gardenId,
        deviceId: dto.deviceId,
        packetNo: dto.packetNo,
        temperature: dto.temperature,
        humidity: dto.humidity,
        payload: dto.payload as never,
      },
    });
  }

  async create(dto: CreateSensorDataDto, ownerId: string, role: Role) {
    const garden = await this.prisma.garden.findUnique({
      where: { id: dto.gardenId },
    });

    if (!garden) {
      throw new NotFoundException('Không tìm thấy khu vườn');
    }

    if (role !== 'admin' && garden.ownerId !== ownerId) {
      throw new NotFoundException('Không có quyền thêm dữ liệu cảm biến cho khu vườn này');
    }

    return this.recordFromDevice(dto);
  }

  findByGarden(gardenId: string, ownerId: string, role: Role, limit = 100, from?: string, to?: string) {
    const receivedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };

    return this.prisma.sensorData.findMany({
      where: role === 'admin'
        ? { gardenId, ...(Object.keys(receivedAt).length ? { receivedAt } : {}) }
        : { gardenId, garden: { ownerId }, ...(Object.keys(receivedAt).length ? { receivedAt } : {}) },
      orderBy: { receivedAt: 'desc' },
      take: Number(limit),
    });
  }

  async findLatest(gardenId: string, ownerId: string, role: Role) {
    const record = await this.prisma.sensorData.findFirst({
      where: role === 'admin' ? { gardenId } : { gardenId, garden: { ownerId } },
      orderBy: { receivedAt: 'desc' },
    });

    if (!record) {
      throw new NotFoundException('Chưa có dữ liệu cảm biến cho khu vườn này');
    }

    return record;
  }

  async getAverage24h(gardenId: string, ownerId: string, role: Role) {
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const data = await this.prisma.sensorData.findMany({
      where: role === 'admin'
        ? { gardenId, receivedAt: { gte: since } }
        : { gardenId, receivedAt: { gte: since }, garden: { ownerId } },
      select: { temperature: true, humidity: true },
    });

    const temperature = data.reduce((sum, item) => sum + item.temperature, 0) / Math.max(data.length, 1);
    const humidity = data.reduce((sum, item) => sum + item.humidity, 0) / Math.max(data.length, 1);

    return { gardenId, temperature, humidity, total: data.length };
  }
}
