import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { MqttBrokerService } from '../services/mqtt-broker.service';
import { MqttMessagePayload, SensorReading } from '../mqtt.types';
import { MQTT_ACK_TOPIC, MQTT_COMMAND_TOPIC, MQTT_SENSOR_TOPIC } from '../constants/mqtt.topics';

@Controller()
export class MqttMicroserviceController {
  private readonly logger = new Logger(MqttMicroserviceController.name);

  constructor(private readonly mqttBrokerService: MqttBrokerService) {}

  @EventPattern(MQTT_SENSOR_TOPIC)
  async handleSensorEvent(
    @Payload() payload: SensorReading | MqttMessagePayload,
  ): Promise<{ accepted: boolean; topic: string }> {
    this.logger.log(`EventPattern received payload on ${MQTT_SENSOR_TOPIC}`);
    await this.mqttBrokerService.publishAck({
      type: 'sensor-ack',
      receivedAt: new Date().toISOString(),
      payload,
    });

    return {
      accepted: true,
      topic: MQTT_SENSOR_TOPIC,
    };
  }

  @MessagePattern(MQTT_COMMAND_TOPIC)
  async handleCommandMessage(
    @Payload() payload: Record<string, unknown>,
  ): Promise<{ accepted: boolean; topic: string; echo: Record<string, unknown> }> {
    this.logger.log(`MessagePattern received command on ${MQTT_COMMAND_TOPIC}`);
    await this.mqttBrokerService.publishAck({
      type: 'command-ack',
      receivedAt: new Date().toISOString(),
      payload,
    });

    return {
      accepted: true,
      topic: MQTT_COMMAND_TOPIC,
      echo: payload,
    };
  }
}
