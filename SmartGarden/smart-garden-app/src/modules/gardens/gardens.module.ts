import { Module } from '@nestjs/common';
import { MqttModule } from '../../infrastructure/mqtt/mqtt.module';
import { GardensController } from './gardens.controller';
import { GardensService } from './gardens.service';

@Module({
  imports: [MqttModule],
  controllers: [GardensController],
  providers: [GardensService],
  exports: [GardensService],
})
export class GardenModule {}
