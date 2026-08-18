import { Module } from '@nestjs/common';
import { SensorModule } from '../../modules/sensor/sensor.module';
import { MqttController } from './controllers/mqtt.controller';
import { MqttGateway } from './gateways/mqtt.gateway';
import { MqttBrokerService } from './services/mqtt-broker.service';

@Module({
  imports: [SensorModule],
  controllers: [MqttController],
  providers: [MqttBrokerService, MqttGateway],
  exports: [MqttBrokerService],
})
export class MqttModule {}
