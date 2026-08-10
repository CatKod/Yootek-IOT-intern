import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MqttClient, connect } from 'mqtt';
import { EventEmitter } from 'node:events';
import { MQTT_COMMAND_TOPIC, MQTT_SENSOR_TOPIC } from '../constants/mqtt.topics';
import { MqttMessagePayload } from '../mqtt.types';

@Injectable()
export class MqttBrokerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttBrokerService.name);
  private readonly messageEmitter = new EventEmitter();
  private client?: MqttClient;
  private readonly brokerUrl: string;
  private readonly sensorTopic: string;
  private readonly commandTopic: string;
  private readonly ackTopic: string;

  constructor(private readonly configService: ConfigService) {
    this.brokerUrl = this.configService.get<string>('MQTT_BROKER_URL', 'mqtt://broker.hivemq.com:1883');
    this.sensorTopic = this.configService.get<string>('MQTT_SENSOR_TOPIC', MQTT_SENSOR_TOPIC);
    this.commandTopic = this.configService.get<string>('MQTT_COMMAND_TOPIC', MQTT_COMMAND_TOPIC);
    this.ackTopic = this.configService.get<string>('MQTT_ACK_TOPIC', 'esp32/control/ack');
  }

  onModuleInit(): void {
    this.bootstrapClient();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private bootstrapClient(): void {
    this.client = connect(this.brokerUrl, {
      reconnectPeriod: 5000,
      clean: true,
      connectTimeout: 10_000,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker at ${this.brokerUrl}`);
      this.subscribe([this.sensorTopic, this.commandTopic, this.ackTopic]);
    });

    this.client.on('reconnect', () => this.logger.warn('Reconnecting to MQTT broker...'));
    this.client.on('offline', () => this.logger.warn('MQTT client went offline'));
    this.client.on('error', (error) => this.logger.error(`MQTT error: ${error.message}`));
    this.client.on('message', (topic, payloadBuffer) => this.handleRawMessage(topic, payloadBuffer));
  }

  private subscribe(topics: string[]): void {
    this.client?.subscribe(topics, { qos: 0 }, (error) => {
      if (error) {
        this.logger.error(`Failed to subscribe MQTT topics: ${error.message}`);
        return;
      }

      this.logger.log(`Subscribed to topics: ${topics.join(', ')}`);
    });
  }

  private handleRawMessage(topic: string, payloadBuffer: Buffer): void {
    const rawPayload = payloadBuffer.toString('utf8');
    let parsedPayload: unknown = rawPayload;

    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch {
      this.logger.debug(`MQTT payload from ${topic} is not valid JSON, forwarding as string.`);
    }

    const message: MqttMessagePayload = {
      topic,
      payload: parsedPayload,
      rawPayload,
      receivedAt: new Date().toISOString(),
    };

    this.logger.log(`Received MQTT message on ${topic}`);
    this.messageEmitter.emit('message', message);
  }

  getDefaultTopic(): string {
    return this.sensorTopic;
  }

  getCommandTopic(): string {
    return this.commandTopic;
  }

  getAckTopic(): string {
    return this.ackTopic;
  }

  onMessage(listener: (message: MqttMessagePayload) => void): () => void {
    this.messageEmitter.on('message', listener);
    return () => this.messageEmitter.off('message', listener);
  }

  async publish(topic: string, payload: unknown, options?: { retain?: boolean; qos?: 0 | 1 | 2 }): Promise<void> {
    const client = await this.ensureConnected();
    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, message, { retain: options?.retain ?? false, qos: options?.qos ?? 0 }, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  async publishToSensorTopic(payload: unknown, options?: { retain?: boolean; qos?: 0 | 1 | 2 }): Promise<void> {
    await this.publish(this.sensorTopic, payload, options);
  }

  async publishToCommandTopic(payload: unknown, options?: { retain?: boolean; qos?: 0 | 1 | 2 }): Promise<void> {
    await this.publish(this.commandTopic, payload, options);
  }

  async publishAck(payload: unknown, options?: { retain?: boolean; qos?: 0 | 1 | 2 }): Promise<void> {
    await this.publish(this.ackTopic, payload, options);
  }

  getStatus(): { connected: boolean; brokerUrl: string; sensorTopic: string; commandTopic: string; ackTopic: string } {
    return {
      connected: this.client?.connected ?? false,
      brokerUrl: this.brokerUrl,
      sensorTopic: this.sensorTopic,
      commandTopic: this.commandTopic,
      ackTopic: this.ackTopic,
    };
  }

  private async ensureConnected(): Promise<MqttClient> {
    if (!this.client) {
      this.bootstrapClient();
    }

    await new Promise<void>((resolve, reject) => {
      const client = this.client;
      if (!client) {
        reject(new Error('MQTT client is not initialized'));
        return;
      }

      if (client.connected) {
        resolve();
        return;
      }

      const onConnect = (): void => {
        client.off('error', onError);
        resolve();
      };

      const onError = (error: Error): void => {
        client.off('connect', onConnect);
        reject(error);
      };

      client.once('connect', onConnect);
      client.once('error', onError);
    });

    return this.client as MqttClient;
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.client?.end(true, {}, () => {
        this.logger.log('MQTT client disconnected');
        resolve();
      });
    });

    this.client = undefined;
  }
}
