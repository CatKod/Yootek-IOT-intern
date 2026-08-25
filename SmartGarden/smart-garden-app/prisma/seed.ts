import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@smartgarden.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@12345';
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Quản trị viên';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Thiếu DATABASE_URL trong .env');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      password: hashedPassword,
      role: Role.admin,
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: Role.admin,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  console.log('=== Seed thành công ===');
  console.log(`Tài khoản admin: ${admin.email}`);
  console.log(`Mật khẩu admin  : ${ADMIN_PASSWORD}`);
  console.log(`Vai trò         : ${admin.role}`);
  console.log('=======================');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Seed thất bại:', error);
  process.exit(1);
});
