export interface AppConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PORT: number;
  MQTT_BROKER_URL: string;
  MQTT_SENSOR_TOPIC: string;
  MQTT_COMMAND_TOPIC: string;
  MQTT_ACK_TOPIC: string;
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
    MQTT_BROKER_URL: process.env.MQTT_BROKER_URL ?? 'mqtt://broker.hivemq.com:1883',
    MQTT_SENSOR_TOPIC: process.env.MQTT_SENSOR_TOPIC ?? 'esp32/sensors/data',
    MQTT_COMMAND_TOPIC: process.env.MQTT_COMMAND_TOPIC ?? 'esp32/control/command',
    MQTT_ACK_TOPIC: process.env.MQTT_ACK_TOPIC ?? 'esp32/control/ack',
  };
}
