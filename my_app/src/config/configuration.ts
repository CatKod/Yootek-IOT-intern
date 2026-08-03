export interface AppConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PORT: number;
}

export function loadConfiguration(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;

  if (!databaseUrl) {
    throw new Error('Thiếu biến môi trường DATABASE_URL trong file .env');
  }

  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('JWT_SECRET phải tồn tại và có ít nhất 16 ký tự');
  }

  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT phải là số nguyên trong khoảng 1-65535');
  }

  return {
    DATABASE_URL: databaseUrl,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1d',
    PORT: port,
  };
}
