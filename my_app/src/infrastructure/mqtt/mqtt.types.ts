export type MqttMessagePayload = {
  topic: string;
  payload: unknown;
  rawPayload: string;
  receivedAt: string;
};

export type SensorReading = {
  id?: number;
  packet_no?: number;
  temperature?: number;
  humidity?: number;
  tds?: number;
  pH?: number;
  [key: string]: unknown;
};
