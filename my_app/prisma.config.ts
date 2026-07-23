import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from '@prisma/config';

// Prisma CLI (generate / db push / studio) đọc kết nối từ secrets/secret.json
// thay vì file .env mặc định, để dùng chung một nguồn cấu hình với ứng dụng.
const secretPath = join(process.cwd(), 'secrets', 'secret.json');
const secret = JSON.parse(readFileSync(secretPath, 'utf-8')) as {
  MONGODB_URI: string;
};

process.env.DATABASE_URL = secret.MONGODB_URI;

export default defineConfig({
  schema: join('prisma', 'schema.prisma'),
});
