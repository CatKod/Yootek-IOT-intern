import { Module } from '@nestjs/common';
import { MqttController } from './controllers/mqtt.controller';
import { MqttGateway } from './gateways/mqtt.gateway';
import { MqttMicroserviceController } from './controllers/mqtt-microservice.controller';
import { MqttBrokerService } from './services/mqtt-broker.service';

@Module({
  controllers: [MqttController, MqttMicroserviceController],
  providers: [MqttBrokerService, MqttGateway],
  exports: [MqttBrokerService],
})
export class MqttModule {}
