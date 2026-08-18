import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { CreateSensorDataDto } from '../../../modules/sensor/dto/create-sensor-data.dto';
import { SensorService } from '../../../modules/sensor/sensor.service';
import { MQTT_STATUS_EVENT, WS_LED_STATE_EVENT, WS_SENSOR_DATA_EVENT } from '../mqtt.constants';
import { MqttBrokerService } from '../services/mqtt-broker.service';

const gardenRoom = (gardenId: string): string => `garden:${gardenId}`;

@WebSocketGateway({
  namespace: '/smart-garden',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class MqttGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MqttGateway.name);
  private unsubscribe?: () => void;

  constructor(
    private readonly mqttBrokerService: MqttBrokerService,
    private readonly sensorService: SensorService,
  ) {}

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized for SmartGarden live stream');

    this.unsubscribe = this.mqttBrokerService.onMessage((message) => {
      if (message.topic === this.mqttBrokerService.getSensorTopic()) {
        this.handleSensorMessage(message);
        return;
      }

      if (message.topic === this.mqttBrokerService.getCommandTopic()) {
        this.logger.log(`Command message received on MQTT: ${message.rawPayload}`);
        const gardenId = this.extractGardenId(message.payload);
        if (gardenId) {
          this.server?.to(gardenRoom(gardenId)).emit(WS_LED_STATE_EVENT, message.payload);
        }
        return;
      }

      if (message.topic === this.mqttBrokerService.getAckTopic()) {
        this.logger.log(`ACK received from ESP32: ${message.rawPayload}`);
        const gardenId = this.extractGardenId(message.payload);
        this.server?.emit(WS_LED_STATE_EVENT, {
          ack: true,
          gardenId,
          ...(typeof message.payload === 'object' && message.payload !== null
            ? (message.payload as Record<string, unknown>)
            : {}),
        });
        return;
      }

      if (message.topic === this.mqttBrokerService.getStatusTopic()) {
        this.logger.log(`LED status from ESP32: ${message.rawPayload}`);
        const gardenId = this.extractGardenId(message.payload);
        this.server?.emit(WS_LED_STATE_EVENT, message.payload);
        if (gardenId) {
          this.server?.to(gardenRoom(gardenId)).emit(WS_LED_STATE_EVENT, message.payload);
        }
      }
    });
  }

  private handleSensorMessage(message: { payload: unknown; rawPayload: string }): void {
    this.server?.emit(WS_SENSOR_DATA_EVENT, message);

    if (!this.isRecord(message.payload)) {
      return;
    }

    const payload = message.payload as Record<string, unknown>;
    const gardenId = this.extractGardenId(payload);

    if (gardenId) {
      this.server?.to(gardenRoom(gardenId)).emit(WS_SENSOR_DATA_EVENT, message);
    }

    void this.handleSensorPayload(payload);
  }

  private async handleSensorPayload(payload: Record<string, unknown>): Promise<void> {
    const gardenId = this.extractGardenId(payload);

    if (!gardenId) {
      this.logger.warn('Sensor payload thiếu gardenId, bỏ qua');
      return;
    }

    const dto: CreateSensorDataDto = {
      gardenId,
      deviceId: typeof payload.deviceId === 'string' ? payload.deviceId : undefined,
      packetNo:
        typeof payload.packet_no === 'number'
          ? payload.packet_no
          : typeof payload.packetNo === 'number'
            ? payload.packetNo
            : undefined,
      temperature: Number(payload.temperature ?? 0),
      humidity: Number(payload.humidity ?? 0),
      payload,
    };

    try {
      await this.sensorService.recordFromDevice(dto);
    } catch (error) {
      this.logger.warn(`Không lưu được dữ liệu cảm biến: ${(error as Error).message}`);
    }
  }

  private extractGardenId(payload: unknown): string | undefined {
    if (!this.isRecord(payload)) {
      return undefined;
    }
    const value = payload.gardenId ?? payload.garderID;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  handleConnection(client: Socket): void {
    client.emit(MQTT_STATUS_EVENT, this.mqttBrokerService.getStatus());

    const rawGardenId = (client.handshake.query?.gardenId ?? client.handshake.auth?.gardenId) as string | undefined;
    if (rawGardenId) {
      void client.join(gardenRoom(rawGardenId));
      this.logger.log(`Client ${client.id} joined garden room ${rawGardenId}`);
    }

    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}
