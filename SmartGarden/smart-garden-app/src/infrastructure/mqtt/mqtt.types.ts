export interface MqttMessagePayload {
  topic: string;
  payload: unknown;
  rawPayload: string;
  receivedAt: string;
}

export interface SensorPayload {
  gardenId: string;
  packetNo?: number;
  temperature: number;
  humidity: number;
  [key: string]: unknown;
}

export interface LedCommandPayload {
  gardenId: string;
  userId?: string;
  led1State?: string;
  led2State?: string;
  led3State?: string;
  [key: string]: unknown;
}
