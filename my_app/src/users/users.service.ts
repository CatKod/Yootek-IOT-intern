import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

// Không bao giờ trả password ra ngoài API.
const userSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
  profile: true,
  posts: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.user.create({
        data: { ...dto, password: hashedPassword },
        select: userSelect,
      });
    } catch (error) {
      this.throwIfDuplicateEmail(error);
      throw error;
    }
  }

  findAll() {
    return this.prisma.user.findMany({ select: userSelect });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với id ${id}`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.ensureExists(id);

    const data: Prisma.UserUpdateInput = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: userSelect,
      });
    } catch (error) {
      this.throwIfDuplicateEmail(error);
      throw error;
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: `Đã xóa user với id ${id}` };
  }

  // Quan hệ 1-1: tạo mới hoặc cập nhật profile của user.
  async upsertProfile(id: string, dto: UpsertProfileDto) {
    await this.ensureExists(id);
    return this.prisma.profile.upsert({
      where: { userId: id },
      create: { ...dto, userId: id },
      update: { ...dto },
    });
  }

  private async ensureExists(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy user với id ${id}`);
    }
  }

  private throwIfDuplicateEmail(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Email đã được sử dụng');
    }
  }
}
