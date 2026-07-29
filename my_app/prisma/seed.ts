import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@yootek.com';
  const password = await bcrypt.hash('123456', 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Admin',
      password,
      role: Role.admin,
    },
    create: {
      name: 'Admin',
      email: adminEmail,
      password,
      role: Role.admin,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
