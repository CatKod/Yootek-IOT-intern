import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AppConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

// Nạp cấu hình từ secrets/secret.json để dùng cho ConfigModule của NestJS.
export function loadConfiguration(): AppConfig {
  const secretPath = join(process.cwd(), 'secrets', 'secret.json');
  const raw = readFileSync(secretPath, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<AppConfig>;

  if (!parsed.DATABASE_URL) {
    throw new Error('Thiếu DATABASE_URL trong secrets/secret.json');
  }

  return {
    DATABASE_URL: parsed.DATABASE_URL,
    JWT_SECRET: parsed.JWT_SECRET ?? 'doi-thanh-mot-chuoi-bi-mat',
    JWT_EXPIRES_IN: parsed.JWT_EXPIRES_IN ?? '1d',
  };
}
