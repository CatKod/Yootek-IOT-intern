import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MQTT_MESSAGE_EVENT, MQTT_STATUS_EVENT } from '../mqtt.constants';
import { MqttBrokerService } from '../services/mqtt-broker.service';

@WebSocketGateway({
  namespace: '/mqtt',
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

  constructor(private readonly mqttBrokerService: MqttBrokerService) {}

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized for MQTT live stream');
    this.unsubscribe = this.mqttBrokerService.onMessage((message) => {
      this.server?.emit(MQTT_MESSAGE_EVENT, message);
    });
  }

  handleConnection(client: Socket): void {
    client.emit(MQTT_STATUS_EVENT, this.mqttBrokerService.getStatus());
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}
