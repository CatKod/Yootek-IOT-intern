import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AppConfig {
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
}

// Nạp cấu hình từ secrets/secret.json để dùng cho ConfigModule của NestJS.
export function loadConfiguration(): AppConfig {
  const secretPath = join(process.cwd(), 'secrets', 'secret.json');
  const raw = readFileSync(secretPath, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<AppConfig>;

  if (!parsed.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI trong secrets/secret.json');
  }

  return {
    MONGODB_URI: parsed.MONGODB_URI,
    JWT_SECRET: parsed.JWT_SECRET ?? 'doi-thanh-mot-chuoi-bi-mat',
    JWT_EXPIRES_IN: parsed.JWT_EXPIRES_IN ?? '1d',
  };
}
