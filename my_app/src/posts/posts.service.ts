import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  // Quan hệ 1-n: mỗi post thuộc về một user (authorId lấy từ token).
  create(authorId: string, dto: CreatePostDto) {
    return this.prisma.post.create({
      data: {
        title: dto.title,
        content: dto.content,
        user: { connect: { id: authorId } },
      },
    });
  }

  findAll() {
    return this.prisma.post.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!post) {
      throw new NotFoundException(`Không tìm thấy post với id ${id}`);
    }
    return post;
  }

  async update(id: string, dto: UpdatePostDto) {
    await this.ensureExists(id);
    return this.prisma.post.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.post.delete({ where: { id } });
    return { message: `Đã xóa post với id ${id}` };
  }

  private async ensureExists(id: string): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException(`Không tìm thấy post với id ${id}`);
    }
  }
}
