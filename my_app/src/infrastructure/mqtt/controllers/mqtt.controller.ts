import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MqttPublishDto } from '../dto/mqtt-publish.dto';
import { MQTT_COMMAND_EVENT } from '../mqtt.constants';
import { MqttBrokerService } from '../services/mqtt-broker.service';

@ApiTags('MQTT')
@Controller('mqtt')
export class MqttController {
  constructor(private readonly mqttBrokerService: MqttBrokerService) {}

  @Get('status')
  @ApiOperation({ summary: 'Xem trạng thái kết nối MQTT' })
  getStatus(): { connected: boolean; brokerUrl: string; sensorTopic: string; commandTopic: string; ackTopic: string } {
    return this.mqttBrokerService.getStatus();
  }

  @Post('publish')
  @ApiOperation({ summary: 'Publish dữ liệu lên MQTT broker' })
  async publish(@Body() dto: MqttPublishDto): Promise<{ message: string; topic: string; event: string }> {
    const topic = dto.topic ?? this.mqttBrokerService.getCommandTopic();

    await this.mqttBrokerService.publish(topic, dto.payload, {
      retain: dto.retain,
      qos: dto.qos,
    });

    return {
      message: 'Đã publish dữ liệu lên MQTT broker',
      topic,
      event: MQTT_COMMAND_EVENT,
    };
  }
}
